import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { answerBlocks, toBlocks } from "./answer.ts";

const seg = (text: string, cites: number[] = [], uncited = false) => ({ text, cites, general: false, uncited });

describe("answerBlocks", () => {
  test("citations attach after the cited text, bold spans across lines stay local", () => {
    const blocks = answerBlocks([
      seg("**Eight tests** match "),
      seg("at 0.7 atm.", [1]),
      seg(" Burn time 4.2 s.", [], true),
      seg("\n\n- FLEX-019: ", []),
      seg("Disruption", [2, 3]),
    ]);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0].inlines, [
      { type: "text", text: "Eight tests", bold: true },
      { type: "text", text: " match at 0.7 atm.", bold: false },
      { type: "cite", n: [1] },
      { type: "text", text: " Burn time 4.2 s.", bold: false },
      { type: "nosource" },
    ]);
    assert.equal(blocks[1].type, "li");
    assert.deepEqual(blocks[1].inlines.at(-1), { type: "cite", n: [2, 3] });
  });
  test("General knowledge paragraphs are flagged and the prefix removed", () => {
    const blocks = toBlocks("Data first.\n\nGeneral knowledge: a flame is a shell.\nStill general.\n\nBack.");
    assert.deepEqual(blocks.map((b) => [b.type, b.general]), [["p", false], ["p", true], ["p", true], ["p", false]]);
    assert.deepEqual(blocks[1].inlines, [{ type: "text", text: "a flame is a shell.", bold: false }]);
  });
  test("bold General knowledge prefix is recognised", () => {
    const [b] = toBlocks("**General knowledge:** K describes the slope.");
    assert.equal(b.general, true);
    assert.deepEqual(b.inlines, [{ type: "text", text: "K describes the slope.", bold: false }]);
  });
  test("headings and numbered lists", () => {
    const blocks = toBlocks("## Summary\n1. one\n2) two");
    assert.deepEqual(blocks.map((b) => b.type), ["h", "oli", "oli"]);
  });
});
