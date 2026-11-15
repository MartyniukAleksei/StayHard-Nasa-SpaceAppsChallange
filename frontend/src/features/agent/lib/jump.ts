// Citation → the place on the site it came from (NotebookLM-style "jump to source").
// Pure functions over the citation contract (ADR 0006, studies/flex/service.py test_source):
// self-contained for node --test.
import type { Source } from "../types.ts";

/** Where a citation leads: a page of the app (with what to show there) or an external file/DOI. */
export type JumpTarget =
  | {
      kind: "page";
      href: string;
      /** data-field keys to highlight (the Parameters table on the test page, compare columns) */
      fields: string[];
      test_nos: number[];
      /** verbatim quote to find inside [data-source="<anchor>"] */
      text?: string;
      anchor?: "comment";
      /** id of the section heading to scroll to when there is nothing finer */
      section?: string;
    }
  | { kind: "external"; href: string };

/** Labels of the test-row source text (backend test_source) → data-field keys on the pages. */
const FIELD_LABELS: [RegExp, string[]][] = [
  [/\bCIR\b/, ["cir_id"]],
  [/\bfuel\b/i, ["fuel"]],
  [/\bpressure\b/i, ["p_atm"]],
  [/\bO2\b/, ["x_o2"]],
  [/\bN2\b/, ["x_n2"]],
  [/\bCO2\b/, ["x_co2"]],
  [/\bHe\b/, ["x_he"]],
  [/\bdiluent\b/i, ["diluent"]],
  [/initial droplet diameter|\bd0\b/i, ["d0_mm"]],
  [/extinction diameter/i, ["dext_mm"]],
  [/burning rate constant|\bK\b/, ["k_mm2_s"]],
  [/burn time/i, ["burn_time_s"]],
  [/end type/i, ["end_type"]],
  [/fiber/i, ["ts_fiber"]],
];

/** Which fields a quote from a test row talks about, in the order they first appear. */
export function quoteFields(quotes: string[]): string[] {
  const out: string[] = [];
  for (const q of quotes) {
    for (const [re, keys] of FIELD_LABELS) {
      if (re.test(q)) for (const k of keys) if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

const TEST_ROW = /^\/api\/studies\/flex\/tests\/(\d+)$/;
const SERIES = /^\/api\/studies\/flex\/tests\/(\d+)\/timeseries\/([a-z_]+)/;
const NEIGHBORS = /^\/api\/studies\/flex\/tests\/(\d+)\/neighbors/;
const COMPARE = /^\/api\/studies\/flex\/compare\?(.*)$/;
const RAW_FILE = /^\/api\/media\/flex\/files\/raw\/(\d{3})\//;

const testPage = (n: number) => `/studies/flex/tests/${n}`;

export function sourceTarget(src: Pick<Source, "url" | "title" | "quotes">, apiBase = ""): JumpTarget {
  const url = src.url;
  let m = TEST_ROW.exec(url);
  if (m) {
    const n = Number(m[1]);
    return { kind: "page", href: testPage(n), fields: quoteFields(src.quotes), test_nos: [n], section: "tp-params" };
  }
  m = SERIES.exec(url);
  if (m) {
    const n = Number(m[1]);
    return { kind: "page", href: testPage(n), fields: [], test_nos: [n], section: m[2] === "droplet" ? "tp-d2" : "tp-flame" };
  }
  m = NEIGHBORS.exec(url);
  if (m) return { kind: "page", href: testPage(Number(m[1])), fields: [], test_nos: [Number(m[1])], section: "tp-nb" };
  m = COMPARE.exec(url);
  if (m) {
    const ids = new URLSearchParams(m[1]).getAll("ids").map(Number).filter((n) => n > 0).slice(0, 3);
    if (ids.length >= 2) {
      return { kind: "page", href: `/studies/flex/compare?ids=${ids.join(",")}`, fields: quoteFields(src.quotes), test_nos: ids };
    }
  }
  m = RAW_FILE.exec(url);
  if (m && /researcher comment|testsheet/i.test(src.title)) {
    const n = Number(m[1]);
    return { kind: "page", href: testPage(n), fields: [], test_nos: [n], text: src.quotes[0], anchor: "comment", section: "tp-what" };
  }
  return { kind: "external", href: url.startsWith("/api/") ? `${apiBase}${url}` : url };
}
