import { createKitPilotPdf } from "@/lib/pdf";
import type { StageKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const documentDefinitions: Record<StageKey, { title: string; slug: string }> = {
  lessonPlan: { title: "Lesson Plan", slug: "lesson-plan" },
  differentiation: { title: "3 Tiers", slug: "3-tiers" },
  parentLetter: { title: "Parent Letter", slug: "parent-letter" },
};

export async function POST(request: Request) {
  const form = await request.formData();
  const documentKey = form.get("documentKey");
  const kit = form.get("kit");
  const grade = Number(form.get("grade"));
  const content = form.get("content");

  if (
    typeof documentKey !== "string" ||
    !(documentKey in documentDefinitions) ||
    kit !== "ball-shooter" ||
    ![3, 4, 5].includes(grade) ||
    typeof content !== "string" ||
    !content ||
    content.length > 500_000
  ) {
    return Response.json({ error: "Invalid download request." }, { status: 400 });
  }

  const definition = documentDefinitions[documentKey as StageKey];

  try {
    const pdf = await createKitPilotPdf({
      markdown: content,
      documentKey: documentKey as StageKey,
      documentTitle: definition.title,
      kitName: "Ball Shooter Kit",
      grade,
    });
    const filename = `kitpilot-ball-shooter-grade${grade}-${definition.slug}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("KitPilot PDF generation failed:", error);
    return Response.json(
      { error: "KitPilot could not create this PDF. Please try again." },
      { status: 500 },
    );
  }
}
