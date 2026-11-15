import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { citedIds, parseCited } from "./cited.ts";

describe("parseCited", () => {
  test("keeps text and finds markers", () => {
    assert.deepEqual(parseCited("A flame. [[kim2023]] Then more [[irace2023]]"), [
      { kind: "text", text: "A flame." },
      { kind: "cite", id: "kim2023" },
      { kind: "text", text: " Then more" },
      { kind: "cite", id: "irace2023" },
    ]);
  });
  test("text without markers is one part", () => {
    assert.deepEqual(parseCited("plain"), [{ kind: "text", text: "plain" }]);
  });
  test("lists each cited id once, in order", () => {
    assert.deepEqual(citedIds(["x [[a]] [[b]]", "y [[a]] [[c]]"]), ["a", "b", "c"]);
  });
});
