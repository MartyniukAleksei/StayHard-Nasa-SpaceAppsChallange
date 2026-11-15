import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OUTCOME_ORDER, OUTCOMES, firstNumber, jitter, outcomeStyle } from "./outcomes.ts";

describe("outcomes", () => {
  test("every outcome has a distinct glyph and shape", () => {
    const glyphs = OUTCOME_ORDER.map((k) => OUTCOMES[k].glyph);
    const shapes = OUTCOME_ORDER.map((k) => OUTCOMES[k].shape);
    assert.equal(new Set(glyphs).size, glyphs.length);
    assert.equal(new Set(shapes).size, shapes.length);
  });

  test("unknown and missing outcomes fall back to 'Not stated'", () => {
    assert.equal(outcomeStyle(null).short, "Not stated");
    assert.equal(outcomeStyle("bogus").short, "Not stated");
    assert.equal(outcomeStyle("blowoff").glyph, "◇");
  });
});

describe("firstNumber", () => {
  test("reads report values", () => {
    assert.equal(firstNumber("13.5% O₂"), 13.5);
    assert.equal(firstNumber("~14.5% O₂ to ignite, 13.6% O₂ to survive"), 14.5);
    assert.equal(firstNumber("up to 230 s"), 230);
    assert.equal(firstNumber("—"), null);
    assert.equal(firstNumber(null), null);
  });
});

describe("jitter", () => {
  test("spreads equal x symmetrically and leaves singletons at 0", () => {
    assert.deepEqual(jitter([15, 15, 15, 20, null, 15], 0.2), [0, 1, -1, 0, 0, 2]);
  });
});
