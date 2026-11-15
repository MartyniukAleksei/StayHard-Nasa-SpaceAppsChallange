import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pageContext } from "./context.ts";

describe("pageContext", () => {
  test("test page, compare and explorer", () => {
    assert.deepEqual(pageContext("/studies/flex/tests/19", ""), { route: "/studies/flex/tests/19", test_no: 19 });
    assert.deepEqual(pageContext("/studies/flex/compare", "?ids=2,45,x"), { route: "/studies/flex/compare", ids: [2, 45] });
    assert.deepEqual(pageContext("/studies/flex/tests", "?fuel=Heptane&o2=30%2B&test=27"), {
      route: "/studies/flex/tests",
      test_no: 27,
      explorer: { fuel: ["Heptane"], o2: ["30+"] },
    });
    assert.deepEqual(pageContext("/", ""), { route: "/" });
  });
});
