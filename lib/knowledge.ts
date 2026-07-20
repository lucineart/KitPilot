import { readFile } from "node:fs/promises";
import path from "node:path";

const YAML_BLOCK = /```yaml\s*([\s\S]*?)```/i;

export async function loadKitKnowledge(): Promise<string> {
  const knowledgePath = path.join(process.cwd(), "ball-shooter-knowledge.md");
  const source = await readFile(knowledgePath, "utf8");
  const match = source.match(YAML_BLOCK);

  if (!match?.[1]?.trim()) {
    throw new Error("The Ball Shooter knowledge base is missing its YAML block.");
  }

  return match[1].trim();
}
