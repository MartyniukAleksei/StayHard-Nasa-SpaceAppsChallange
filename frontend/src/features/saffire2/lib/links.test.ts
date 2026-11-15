import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyFilters, compareHref, facetValue, fromParams, parseIds, toParams } from "./links.ts";

const rows = [
  { id: "2-1", material: "Silicone", flow_direction: "concurrent", ug_burn_cm: 0, verdict: "earth_stricter" },
  { id: "2-4", material: "Silicone", flow_direction: "opposed", ug_burn_cm: 0, verdict: "earth_stricter" },
  { id: "2-5", material: "Cotton-Fiberglass (SIBAL)", flow_direction: "concurrent", ug_burn_cm: 29, verdict: "match" },
  { id: "2-7", material: "PMMA & Nomex", flow_direction: "concurrent", ug_burn_cm: 5, verdict: "not_comparable" },
  { id: "2-8", material: "PMMA", flow_direction: "concurrent", ug_burn_cm: 10, verdict: "earth_stricter" },
];

describe("saffire2 links", () => {
  test("parseIds keeps valid unique ids up to the limit", () => {
    assert.deepEqual(parseIds("2-5,2-5,x,2-0,2-8, 2-1,2-2,2-3"), ["2-5", "2-8", "2-1", "2-2"]);
    assert.deepEqual(parseIds(null), []);
  });

  test("compareHref", () => {
    assert.equal(compareHref(["2-5", "2-8"]), "/studies/saffire2/compare?ids=2-5,2-8");
    assert.equal(compareHref([]), "/studies/saffire2/compare");
  });

  test("material groups follow the Readme legend", () => {
    assert.equal(facetValue(rows[2], "material"), "SIBAL fabric");
    assert.equal(facetValue(rows[3], "material"), "PMMA & Nomex");
    assert.equal(facetValue(rows[4], "material"), "PMMA");
    assert.equal(facetValue(rows[0], "outcome"), "did not burn in µg");
  });

  test("filters combine across facets and round-trip through the URL", () => {
    const f = fromParams(new URLSearchParams("material=Silicone&flow=opposed"));
    assert.deepEqual(applyFilters(rows, f).map((r) => r.id), ["2-4"]);
    const sp = toParams(f, new URLSearchParams("sample=2-4"));
    assert.equal(sp.get("sample"), "2-4");
    assert.deepEqual(sp.getAll("material"), ["Silicone"]);
  });
});
