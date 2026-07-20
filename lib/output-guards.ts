const WORD_PATTERN = /[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*/g;

export function countMarkdownWords(markdown: string): number {
  return markdown.match(WORD_PATTERN)?.length ?? 0;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

export function ensureComparisonTableFirst(markdown: string): string {
  const lines = markdown.trim().split(/\r?\n/);
  if (isTableRow(lines[0] ?? "")) return lines.join("\n");

  const separatorIndex = lines.findIndex(
    (line, index) => index > 0 && isTableSeparator(line) && isTableRow(lines[index - 1]),
  );
  if (separatorIndex < 1) return lines.join("\n");

  const tableStart = separatorIndex - 1;
  let tableEnd = separatorIndex + 1;
  while (tableEnd < lines.length && isTableRow(lines[tableEnd])) tableEnd += 1;

  const table = lines.slice(tableStart, tableEnd).join("\n");
  const remainder = [...lines.slice(0, tableStart), ...lines.slice(tableEnd)]
    .join("\n")
    .trim();

  return remainder ? `${table}\n\n${remainder}` : table;
}

function sentences(block: string): string[] {
  return (
    block
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [block]
  );
}

function isProtectedSentence(sentence: string): boolean {
  return /rubber band|not allowed|no approved|substitute|did not|never aim|adult supervision/i.test(
    sentence,
  );
}

export function limitParentLetterWords(markdown: string, maximum = 240): string {
  const blocks = markdown.trim().split(/\n{2,}/);
  if (countMarkdownWords(markdown) <= maximum) return blocks.join("\n\n");

  let section = "";
  const removable: Array<{ blockIndex: number; sentenceIndex: number; wordCount: number }> = [];
  const sentencesByBlock = new Map<number, string[]>();

  blocks.forEach((block, blockIndex) => {
    if (/^##\s+/.test(block)) {
      section = block.replace(/^##\s+/, "").trim().toLowerCase();
      return;
    }

    if (!["what we built", "what your child learned"].includes(section)) return;
    if (/^(?:[-*+]\s|\d+\.\s)/m.test(block)) return;

    const parts = sentences(block);
    if (parts.length < 2) return;
    sentencesByBlock.set(blockIndex, parts);

    parts.forEach((sentence, sentenceIndex) => {
      if (!isProtectedSentence(sentence)) {
        removable.push({
          blockIndex,
          sentenceIndex,
          wordCount: countMarkdownWords(sentence),
        });
      }
    });
  });

  removable.sort((a, b) => b.wordCount - a.wordCount);
  const removed = new Map<number, Set<number>>();

  for (const candidate of removable) {
    if (countMarkdownWords(blocks.join("\n\n")) <= maximum) break;

    const removedFromBlock = removed.get(candidate.blockIndex) ?? new Set<number>();
    const parts = sentencesByBlock.get(candidate.blockIndex) ?? [];
    if (parts.length - removedFromBlock.size <= 1) continue;

    removedFromBlock.add(candidate.sentenceIndex);
    removed.set(candidate.blockIndex, removedFromBlock);
    blocks[candidate.blockIndex] = parts
      .filter((_, index) => !removedFromBlock.has(index))
      .join(" ");
  }

  return blocks.join("\n\n").trim();
}
