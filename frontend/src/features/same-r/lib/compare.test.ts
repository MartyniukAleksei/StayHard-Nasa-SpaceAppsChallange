import assert from "node:assert/strict";
import { test } from "node:test";
import { compareHref, MAX_COMPARE, parseIds } from "./compare.ts";
import { onePerBurst } from "./photos.ts";

test("parseIds keeps unique positive integers up to the limit", () => {
  assert.deepEqual(parseIds("73,x,53,73,-1,89,90"), [73, 53, 89].slice(0, MAX_COMPARE));
  assert.deepEqual(parseIds(null), []);
  assert.equal(compareHref([]), "/studies/same-r/compare");
  assert.equal(compareHref([73, 53]), "/studies/same-r/compare?ids=73,53");
});

test("onePerBurst keeps the first shot of each burst", () => {
  const names = ["iss023e040116.jpg", "iss023e041788.jpg", "iss024e008350.jpg", "iss024e008351.jpg", "iss024e008370.jpg", "iss024e014417.jpg", "iss024e014432.jpg"];
  assert.deepEqual(onePerBurst(names.map((name) => ({ name }))).map((p) => p.name), [
    "iss023e040116.jpg",
    "iss023e041788.jpg",
    "iss024e008350.jpg",
    "iss024e014417.jpg",
  ]);
});
