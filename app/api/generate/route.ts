import OpenAI, { type APIError } from "openai";

import { loadKitKnowledge } from "@/lib/knowledge";
import { createOpenAIClient, hasOpenAIProxy } from "@/lib/openai-client";
import {
  ensureComparisonTableFirst,
  limitParentLetterWords,
} from "@/lib/output-guards";
import {
  buildInstructions,
  differentiationPrompt,
  lessonPlanPrompt,
  parentLetterPrompt,
} from "@/lib/prompts";
import type {
  FormInputs,
  GenerationEvent,
  StageKey,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseInput(value: unknown): FormInputs {
  if (!value || typeof value !== "object") throw new Error("Invalid form input.");

  const body = value as Record<string, unknown>;
  const grade = Number(body.grade);
  const classSize = Number(body.classSize);
  const lessonLength = Number(body.lessonLength);
  const sessions = Number(body.sessions);
  const specialNotes = typeof body.specialNotes === "string" ? body.specialNotes.trim() : "";

  if (
    body.kit !== "ball-shooter" ||
    ![3, 4, 5].includes(grade) ||
    !Number.isInteger(classSize) ||
    classSize < 1 ||
    classSize > 80 ||
    !Number.isInteger(lessonLength) ||
    lessonLength < 20 ||
    lessonLength > 120 ||
    lessonLength % 5 !== 0 ||
    !Number.isInteger(sessions) ||
    sessions < 1 ||
    sessions > 4 ||
    !["manual", "cutter"].includes(String(body.cuttingMethod)) ||
    specialNotes.length > 1200
  ) {
    throw new Error("Please check the classroom details and try again.");
  }

  return {
    kit: "ball-shooter",
    grade: grade as FormInputs["grade"],
    classSize,
    lessonLength: lessonLength as FormInputs["lessonLength"],
    sessions: sessions as FormInputs["sessions"],
    cuttingMethod: body.cuttingMethod as FormInputs["cuttingMethod"],
    specialNotes,
  };
}

function isQuotaError(error: APIError): boolean {
  const details = [error.code, error.type, error.message].filter(Boolean).join(" ");
  return /insufficient_quota|quota|billing|credit balance/i.test(details);
}

function safeMessage(error: unknown, proxyConfigured: boolean): string {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return proxyConfigured
      ? "The OpenAI request timed out through the configured proxy. Check that the proxy is running and can reach api.openai.com."
      : "The OpenAI request timed out, and no HTTPS_PROXY or HTTP_PROXY was visible to the server. Configure the proxy in .env.local and restart KitPilot.";
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return proxyConfigured
      ? "KitPilot could not connect to OpenAI through the configured proxy. Check the proxy and try again."
      : "KitPilot could not connect to OpenAI, and no HTTPS_PROXY or HTTP_PROXY was visible to the server.";
  }

  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) return "The OpenAI API key was rejected. Check the server environment and try again.";
    if (error.status === 403) return "This OpenAI API key does not have permission to make this request.";
    if (error.status === 404) return "The configured OpenAI model is not available to this API account.";
    if (error.status === 429 && isQuotaError(error)) {
      return "This OpenAI API account has no available quota. Add billing or credits in the OpenAI Platform, then try again.";
    }
    if (error.status === 429) return "The OpenAI API rate limit was reached. Please wait a moment and try again.";
    if (error.status && error.status >= 500) return "OpenAI had a temporary server error. Please try again.";
  }

  return "KitPilot could not finish this classroom pack. Please try again.";
}

export async function POST(request: Request) {
  let input: FormInputs;

  try {
    input = parseInput(await request.json());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: GenerationEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const run = async () => {
        let activeStage: StageKey = "lessonPlan";
        const proxyConfigured = hasOpenAIProxy();

        try {
          const knowledge = await loadKitKnowledge();
          const instructions = buildInstructions(knowledge);
          const client = createOpenAIClient(apiKey);

          const generate = async (prompt: string, maxOutputTokens: number) => {
            if (request.signal.aborted) throw new Error("Request cancelled.");

            const response = await client.responses.create({
              model: "gpt-5.6",
              instructions,
              input: prompt,
              reasoning: { effort: "low" },
              max_output_tokens: maxOutputTokens,
            });
            const text = response.output_text.trim();
            if (!text) throw new Error("The model returned an empty response.");
            return text;
          };

          emit({ type: "status", stage: "lessonPlan", status: "generating" });
          const lessonPlan = await generate(lessonPlanPrompt(input), 8000);
          emit({ type: "result", stage: "lessonPlan", content: lessonPlan });

          activeStage = "differentiation";
          emit({ type: "status", stage: "differentiation", status: "generating" });
          const differentiation = ensureComparisonTableFirst(
            await generate(differentiationPrompt(input, lessonPlan), 6500),
          );
          emit({ type: "result", stage: "differentiation", content: differentiation });

          activeStage = "parentLetter";
          emit({ type: "status", stage: "parentLetter", status: "generating" });
          const parentLetter = limitParentLetterWords(
            await generate(parentLetterPrompt(input, lessonPlan), 650),
          );
          emit({ type: "result", stage: "parentLetter", content: parentLetter });
          emit({ type: "done" });
        } catch (error) {
          console.error(
            `KitPilot generation failed during ${activeStage} (proxy ${proxyConfigured ? "configured" : "not configured"}):`,
            error,
          );
          emit({ type: "error", stage: activeStage, message: safeMessage(error, proxyConfigured) });
        } finally {
          controller.close();
        }
      };

      void run();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
