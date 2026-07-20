import OpenAI from "openai";
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

export function hasOpenAIProxy(): boolean {
  return Boolean(
    process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy,
  );
}

export function createOpenAIClient(apiKey: string): OpenAI {
  if (!hasOpenAIProxy()) return new OpenAI({ apiKey });

  return new OpenAI({
    apiKey,
    fetch: undiciFetch as unknown as typeof globalThis.fetch,
    fetchOptions: { dispatcher: new EnvHttpProxyAgent() },
  });
}
