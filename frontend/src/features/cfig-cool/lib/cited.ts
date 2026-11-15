// Splits copy with [[source-id]] markers into text and citation parts.
export type Part = { kind: "text"; text: string } | { kind: "cite"; id: string };

export function parseCited(text: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(/\s?\[\[(\w+)\]\]/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    out.push({ kind: "cite", id: m[1] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Ids cited anywhere in the given copy, in order of first appearance. */
export function citedIds(texts: string[]): string[] {
  const seen: string[] = [];
  for (const t of texts) {
    for (const p of parseCited(t)) if (p.kind === "cite" && !seen.includes(p.id)) seen.push(p.id);
  }
  return seen;
}
