import "server-only";

import PDFDocument from "pdfkit/js/pdfkit.standalone";

import type { StageKey } from "@/lib/types";

type PdfBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; depth: number; marker: string; text: string }
  | { type: "quote"; text: string }
  | { type: "rule" }
  | { type: "table"; rows: string[][] };

type CreatePdfOptions = {
  markdown: string;
  documentKey: StageKey;
  documentTitle: string;
  kitName: string;
  grade: number;
};

const COLORS = {
  ink: "#1A1A1A",
  inkSoft: "#1A1A1A",
  muted: "#555B6E",
  line: "#DED9D1",
  surfaceSoft: "#FFF8EC",
  amber: "#F5A020",
  amberSoft: "#FFF3D6",
  teal: "#2ECFCF",
  tealDeep: "#1A9E9E",
  white: "#FFFFFF",
};

const PAGE_MARGIN = 48;
const CONTENT_TOP = 58;
const CONTENT_BOTTOM = 56;

function printableText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/↔/g, "<->")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/✓/g, "checked")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

function stripInlineMarkdown(value: string): string {
  return printableText(
    value
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
      .replace(/\\([|*_`])/g, "$1")
      .trim(),
  );
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => stripInlineMarkdown(cell));
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  return (
    /^#{1,3}\s+/.test(line) ||
    /^\s*(?:[-*+] |\d+\. )/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line) ||
    (isTableRow(line) && isTableSeparator(lines[index + 1] ?? ""))
  );
}

export function parseMarkdownForPdf(markdown: string): PdfBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: PdfBlock[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: stripInlineMarkdown(heading[2]),
      });
      index += 1;
      continue;
    }

    if (isTableRow(line) && isTableSeparator(lines[index + 1] ?? "")) {
      const rows = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }

    const listItem = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listItem) {
      const ordered = /\d+\./.test(listItem[2]);
      blocks.push({
        type: "list",
        ordered,
        depth: Math.min(3, Math.floor(listItem[1].replace(/\t/g, "  ").length / 2)),
        marker: ordered ? listItem[2] : "-",
        text: stripInlineMarkdown(listItem[3].replace(/^\[[ xX]\]\s*/, "")),
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", text: stripInlineMarkdown(quoteLines.join(" ")) });
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: stripInlineMarkdown(paragraphLines.join(" ")) });
  }

  return blocks;
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - PAGE_MARGIN * 2;
}

function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - CONTENT_BOTTOM;
}

function drawPageHeader(doc: PDFKit.PDFDocument): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.tealDeep)
    .text("KITPILOT", PAGE_MARGIN, 29, { characterSpacing: 1.2, lineBreak: false });
  doc
    .moveTo(PAGE_MARGIN, 43)
    .lineTo(doc.page.width - PAGE_MARGIN, 43)
    .lineWidth(0.8)
    .strokeColor(COLORS.line)
    .stroke();
  doc.x = PAGE_MARGIN;
  doc.y = CONTENT_TOP;
}

function addStyledPage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  drawPageHeader(doc);
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height <= pageBottom(doc)) return;
  addStyledPage(doc);
}

function renderHeading(doc: PDFKit.PDFDocument, block: Extract<PdfBlock, { type: "heading" }>): void {
  const sizes = { 1: 24, 2: 17, 3: 12 } as const;
  const before = block.level === 1 ? 6 : block.level === 2 ? 14 : 10;
  const after = block.level === 1 ? 12 : 7;
  const size = sizes[block.level];

  doc.font("Helvetica-Bold").fontSize(size);
  const height = doc.heightOfString(block.text, {
    width: contentWidth(doc),
    lineGap: block.level === 1 ? 2 : 1,
  });
  ensureSpace(doc, before + height + after + (block.level === 1 ? 7 : 0));
  doc.y += before;
  doc.fillColor(block.level === 3 ? COLORS.tealDeep : COLORS.ink).text(block.text, PAGE_MARGIN, doc.y, {
    width: contentWidth(doc),
    lineGap: block.level === 1 ? 2 : 1,
  });

  if (block.level === 1) {
    doc.y += 6;
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .lineWidth(1.2)
      .strokeColor(COLORS.amber)
      .stroke();
  }
  doc.y += after;
}

function renderParagraph(doc: PDFKit.PDFDocument, text: string): void {
  doc.font("Helvetica").fontSize(9.7);
  const height = doc.heightOfString(text, { width: contentWidth(doc), lineGap: 2.2 });
  ensureSpace(doc, Math.min(height + 8, pageBottom(doc) - CONTENT_TOP));
  doc.fillColor(COLORS.inkSoft).text(text, PAGE_MARGIN, doc.y, {
    width: contentWidth(doc),
    lineGap: 2.2,
  });
  doc.y += 7;
}

function renderListItem(doc: PDFKit.PDFDocument, block: Extract<PdfBlock, { type: "list" }>): void {
  const indent = block.depth * 14;
  const markerWidth = 18;
  const x = PAGE_MARGIN + indent;
  const width = contentWidth(doc) - indent - markerWidth;
  doc.font("Helvetica").fontSize(9.4);
  const height = doc.heightOfString(block.text, { width, lineGap: 1.8 });
  ensureSpace(doc, height + 5);
  const y = doc.y;
  doc
    .font(block.ordered ? "Helvetica" : "Helvetica-Bold")
    .fillColor(COLORS.tealDeep)
    .text(block.marker, x, y, { width: markerWidth - 4, lineBreak: false });
  doc
    .font("Helvetica")
    .fillColor(COLORS.inkSoft)
    .text(block.text, x + markerWidth, y, { width, lineGap: 1.8 });
  doc.y = y + height + 4;
}

function renderQuote(doc: PDFKit.PDFDocument, text: string): void {
  const padding = 11;
  const width = contentWidth(doc);
  doc.font("Helvetica-Oblique").fontSize(9.5);
  const textHeight = doc.heightOfString(text, { width: width - padding * 2 - 5, lineGap: 2 });
  const height = textHeight + padding * 2;
  ensureSpace(doc, height + 9);
  const y = doc.y;
  doc.save().rect(PAGE_MARGIN, y, width, height).fill(COLORS.amberSoft).restore();
  doc.save().rect(PAGE_MARGIN, y, 3, height).fill(COLORS.amber).restore();
  doc
    .font("Helvetica-Oblique")
    .fillColor(COLORS.inkSoft)
    .text(text, PAGE_MARGIN + padding + 3, y + padding, {
      width: width - padding * 2 - 5,
      lineGap: 2,
    });
  doc.y = y + height + 9;
}

function columnWidths(rows: string[][], totalWidth: number): number[] {
  const count = Math.max(...rows.map((row) => row.length));
  const header = rows[0].map((cell) => cell.toLowerCase());
  let ratios: number[];

  if (count === 2) ratios = [0.32, 0.68];
  else if (count === 3) ratios = [0.24, 0.34, 0.42];
  else if (count === 4 && header.includes("time") && header.includes("minutes")) {
    ratios = [0.14, 0.1, 0.23, 0.53];
  } else if (count === 4) ratios = [0.18, 0.27, 0.27, 0.28];
  else ratios = Array.from({ length: count }, () => 1 / count);

  return ratios.map((ratio) => totalWidth * ratio);
}

function rowHeight(
  doc: PDFKit.PDFDocument,
  row: string[],
  widths: number[],
  fontSize: number,
  padding: number,
  bold: boolean,
): number {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  return Math.max(
    20,
    ...widths.map((width, index) =>
      doc.heightOfString(row[index] ?? "", { width: width - padding * 2, lineGap: 1.2 }),
    ),
  ) + padding * 2;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  row: string[],
  widths: number[],
  height: number,
  rowIndex: number,
  fontSize: number,
  padding: number,
): void {
  let x = PAGE_MARGIN;
  const y = doc.y;
  const header = rowIndex === 0;

  widths.forEach((width, columnIndex) => {
    const background = header
      ? COLORS.amberSoft
      : rowIndex % 2 === 0
        ? COLORS.surfaceSoft
        : COLORS.white;
    doc.save().rect(x, y, width, height).fill(background).restore();
    doc
      .save()
      .rect(x, y, width, height)
      .lineWidth(0.55)
      .strokeColor(COLORS.line)
      .stroke()
      .restore();
    doc
      .font(header ? "Helvetica-Bold" : "Helvetica")
      .fontSize(fontSize)
      .fillColor(header ? COLORS.ink : COLORS.inkSoft)
      .text(row[columnIndex] ?? "", x + padding, y + padding, {
        width: width - padding * 2,
        lineGap: 1.2,
      });
    x += width;
  });
  doc.x = PAGE_MARGIN;
  doc.y = y + height;
}

function renderTable(doc: PDFKit.PDFDocument, rows: string[][]): void {
  if (rows.length === 0) return;
  const width = contentWidth(doc);
  const widths = columnWidths(rows, width);
  const fontSize = widths.length >= 6 ? 7.1 : widths.length >= 4 ? 7.8 : 8.6;
  const padding = widths.length >= 6 ? 4 : 5;
  const headerHeight = rowHeight(doc, rows[0], widths, fontSize, padding, true);
  const firstBodyHeight = rows[1]
    ? rowHeight(doc, rows[1], widths, fontSize, padding, false)
    : 0;

  ensureSpace(doc, headerHeight + firstBodyHeight + 10);
  drawTableRow(doc, rows[0], widths, headerHeight, 0, fontSize, padding);

  rows.slice(1).forEach((row, bodyIndex) => {
    const height = rowHeight(doc, row, widths, fontSize, padding, false);
    if (doc.y + height > pageBottom(doc)) {
      addStyledPage(doc);
      drawTableRow(doc, rows[0], widths, headerHeight, 0, fontSize, padding);
    }
    drawTableRow(doc, row, widths, height, bodyIndex + 1, fontSize, padding);
  });
  doc.y += 12;
}

function renderBlocks(doc: PDFKit.PDFDocument, blocks: PdfBlock[]): void {
  blocks.forEach((block) => {
    if (block.type === "heading") renderHeading(doc, block);
    else if (block.type === "paragraph") renderParagraph(doc, block.text);
    else if (block.type === "list") renderListItem(doc, block);
    else if (block.type === "quote") renderQuote(doc, block.text);
    else if (block.type === "table") renderTable(doc, block.rows);
    else {
      ensureSpace(doc, 18);
      doc.y += 5;
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
        .lineWidth(0.7)
        .strokeColor(COLORS.line)
        .stroke();
      doc.y += 12;
    }
  });
}

function addFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let offset = 0; offset < range.count; offset += 1) {
    doc.switchToPage(range.start + offset);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 31;
    doc
      .moveTo(PAGE_MARGIN, y - 8)
      .lineTo(doc.page.width - PAGE_MARGIN, y - 8)
      .lineWidth(0.55)
      .strokeColor(COLORS.line)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text("Generated by KitPilot · BeaverBot", PAGE_MARGIN, y, {
        width: contentWidth(doc) - 70,
        lineBreak: false,
      });
    doc.text(`${offset + 1} / ${range.count}`, doc.page.width - PAGE_MARGIN - 55, y, {
      width: 55,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

export async function createKitPilotPdf(options: CreatePdfOptions): Promise<Buffer> {
  const landscape = options.documentKey === "differentiation";
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    size: "A4",
    layout: landscape ? "landscape" : "portrait",
    margins: {
      top: CONTENT_TOP,
      right: PAGE_MARGIN,
      bottom: CONTENT_BOTTOM,
      left: PAGE_MARGIN,
    },
    info: {
      Title: `${options.kitName} Grade ${options.grade} ${options.documentTitle}`,
      Author: "KitPilot · BeaverBot",
      Creator: "KitPilot",
      Subject: `${options.documentTitle} generated for Grade ${options.grade}`,
    },
  });

  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  addStyledPage(doc);
  renderBlocks(doc, parseMarkdownForPdf(options.markdown));
  addFooters(doc);
  doc.end();

  return complete;
}
