import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { describeContext, pageContext } from "./context.ts";

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

describe("section and describeContext", () => {
  test("the visible section travels in page_context", () => {
    assert.deepEqual(pageContext("/studies/flex/tests/35", "", "Watch"), { route: "/studies/flex/tests/35", test_no: 35, section: "Watch" });
    assert.equal(pageContext("/", "", null).section, undefined);
  });
  test("readable labels for every page", () => {
    assert.equal(describeContext(pageContext("/studies/flex/tests/35", "", "Watch")), "Test #35 · Watch");
    assert.equal(describeContext(pageContext("/studies/flex/tests", "?diluent=N2&o2=air&test=7")), "Tests · N₂, 21% O₂ · preview #7");
    assert.equal(describeContext(pageContext("/studies/flex/compare", "?ids=13,35")), "Compare #13, #35");
    assert.equal(describeContext(pageContext("/studies/flex", "", "Watch the flames")), "FLEX overview · Watch the flames");
    assert.equal(describeContext(pageContext("/studies/flex/library", "")), "Library");
  });
});

describe("SAME-R pages", () => {
  test("study and test id travel separately from FLEX test numbers", () => {
    assert.deepEqual(pageContext("/studies/same-r/tests/73", "", "Watch"), {
      route: "/studies/same-r/tests/73",
      section: "Watch",
      study: "samer",
      test_id: "73",
    });
    assert.deepEqual(pageContext("/studies/same-r/compare", "?ids=73,x,53"), {
      route: "/studies/same-r/compare",
      study: "samer",
      test_ids: ["73", "53"],
    });
    assert.equal(pageContext("/studies/same-r", "").study, "samer");
    assert.equal(pageContext("/studies/same-rx", "").study, undefined);
    assert.equal(pageContext("/studies/same-r/tests/73", "").test_no, undefined);
  });
  test("readable labels", () => {
    assert.equal(describeContext(pageContext("/studies/same-r/tests/73", "", "Watch")), "SAME-R test 73 · Watch");
    assert.equal(describeContext(pageContext("/studies/same-r/compare", "?ids=73,53")), "SAME-R compare 73, 53");
    assert.equal(describeContext(pageContext("/studies/same-r/tests", "")), "SAME-R tests");
    assert.equal(describeContext(pageContext("/studies/same-r", "")), "SAME-R overview");
  });
});
