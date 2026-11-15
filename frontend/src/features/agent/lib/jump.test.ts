import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { quoteFields, sourceTarget } from "./jump.ts";

const ROW_QUOTE =
  "initial droplet diameter d0 3.85 mm; extinction diameter 3.34 mm; burning rate constant K 0.430 mm²/s; burn time 8.90 s";

describe("quoteFields", () => {
  test("maps labels of the test-row text to data-field keys", () => {
    assert.deepEqual(quoteFields([ROW_QUOTE]), ["d0_mm", "dext_mm", "k_mm2_s", "burn_time_s"]);
    assert.deepEqual(quoteFields(["pressure 1.011 atm; O2 0.210, N2 0.790"]), ["p_atm", "x_o2", "x_n2"]);
    assert.deepEqual(quoteFields(["end type Extinction; fiber-supported droplet: no."]), ["end_type", "ts_fiber"]);
  });
  test("no duplicates, nothing for unrelated text", () => {
    assert.deepEqual(quoteFields(["burn time 1 s", "burn time 2 s"]), ["burn_time_s"]);
    assert.deepEqual(quoteFields(["the flame went out"]), []);
  });
});

describe("sourceTarget", () => {
  test("test row → test page, fields from the quote, parameters section", () => {
    const t = sourceTarget({ url: "/api/studies/flex/tests/35", title: "FLEX-035 — FLEX experiment table", quotes: [ROW_QUOTE] });
    assert.equal(t.kind, "page");
    if (t.kind !== "page") return;
    assert.equal(t.href, "/studies/flex/tests/35");
    assert.deepEqual(t.test_nos, [35]);
    assert.ok(t.fields.includes("k_mm2_s"));
    assert.equal(t.section, "tp-params");
  });

  test("researcher comment → What happened with the quote to highlight", () => {
    const t = sourceTarget({
      url: "/api/media/flex/files/raw/035/FLEX-035_TestSheet.txt",
      title: "FLEX-035 TestSheet — researcher comment",
      quotes: ["indicative of cool flame burning"],
    });
    assert.deepEqual(t, {
      kind: "page",
      href: "/studies/flex/tests/35",
      fields: [],
      test_nos: [35],
      text: "indicative of cool flame burning",
      anchor: "comment",
      section: "tp-what",
    });
  });

  test("time series → the matching chart section", () => {
    const d = sourceTarget({ url: "/api/studies/flex/tests/13/timeseries/droplet", title: "", quotes: [] });
    const f = sourceTarget({ url: "/api/studies/flex/tests/13/timeseries/flame_uv", title: "", quotes: [] });
    assert.equal(d.kind === "page" && d.section, "tp-d2");
    assert.equal(f.kind === "page" && f.section, "tp-flame");
  });

  test("compare → compare page with up to three tests", () => {
    const t = sourceTarget({ url: "/api/studies/flex/compare?ids=13&ids=35", title: "", quotes: ["pressure 1 atm"] });
    assert.equal(t.kind === "page" && t.href, "/studies/flex/compare?ids=13,35");
  });

  test("PDF pages, other files and DOIs open outside", () => {
    assert.deepEqual(sourceTarget({ url: "/api/media/flex/files/docs/Science/FLEX_Test_Plan.pdf#page=4", title: "Test plan", quotes: [] }, "https://api"), {
      kind: "external",
      href: "https://api/api/media/flex/files/docs/Science/FLEX_Test_Plan.pdf#page=4",
    });
    assert.deepEqual(sourceTarget({ url: "https://doi.org/10.60555/mbq8-0451", title: "", quotes: [] }), {
      kind: "external",
      href: "https://doi.org/10.60555/mbq8-0451",
    });
  });
});
