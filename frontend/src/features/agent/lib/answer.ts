// Відповідь агента (сегменти з цитатами) → блоки для рендера: абзаци, пункти списку, заголовки.
// Підтримуємо лише те, що пише модель: абзаци, «- »/«1. » списки, «#» заголовки, **жирний**.
import type { Segment } from "../types.ts";

export type Inline =
  | { type: "text"; text: string; bold: boolean }
  | { type: "cite"; n: number[] }
  | { type: "nosource" };
export type Block = { type: "p" | "li" | "oli" | "h"; general: boolean; inlines: Inline[] };

const GENERAL = "General knowledge:";
// Маркери, яких не буває в тексті моделі: межі цитат і «без джерела».
const CITE = "\u0000";
const NOSRC = "\u0001";

/** Сегменти → один рядок із маркерами після кожного сегмента з цитатою / без джерела. */
export function withMarkers(segments: Segment[]): string {
  return segments
    .map((s) => {
      let t = s.text;
      if (s.uncited) t = t.replace(/(\s*)$/, `${NOSRC}$1`);
      if (s.cites.length) t = t.replace(/(\s*)$/, `${CITE}${s.cites.join(",")}${CITE}$1`);
      return t;
    })
    .join("");
}

function inlines(text: string): Inline[] {
  const out: Inline[] = [];
  const parts = text.split(new RegExp(`(${CITE}[\\d,]+${CITE}|${NOSRC})`));
  let bold = false;
  for (const part of parts) {
    if (!part) continue;
    if (part === NOSRC) {
      out.push({ type: "nosource" });
      continue;
    }
    if (part.startsWith(CITE)) {
      const n = part.slice(1, -1).split(",").map(Number);
      const last = out[out.length - 1];
      if (last?.type === "cite") last.n = [...new Set([...last.n, ...n])];
      else out.push({ type: "cite", n });
      continue;
    }
    const pieces = part.split("**");
    pieces.forEach((p, i) => {
      if (i > 0) bold = !bold;
      if (p) out.push({ type: "text", text: p, bold });
    });
  }
  return out;
}

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let general = false;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const plain = line.replace(new RegExp(`${CITE}[\\d,]+${CITE}|${NOSRC}`, "g"), "").trim();
    if (!plain) {
      general = false; // порожній рядок закриває абзац «General knowledge:»
      continue;
    }
    if (plain.replace(/^[*_#\s]+/, "").startsWith(GENERAL)) general = true; // і «**General knowledge:**»
    let type: Block["type"] = "p";
    let body = line.trimStart();
    if (/^#{1,6}\s/.test(body)) {
      type = "h";
      body = body.replace(/^#{1,6}\s+/, "");
    } else if (/^[-*•]\s/.test(body)) {
      type = "li";
      body = body.replace(/^[-*•]\s+/, "");
    } else if (/^\d+[.)]\s/.test(body)) {
      type = "oli";
      body = body.replace(/^\d+[.)]\s+/, "");
    }
    if (general && type === "p") body = body.replace(/^(\*\*)?General knowledge:(\*\*)?\s*/, "");
    blocks.push({ type, general, inlines: inlines(body) });
  }
  return blocks;
}

export const answerBlocks = (segments: Segment[]) => toBlocks(withMarkers(segments));
