import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { proposalHref } from "./actions.ts";

const p = (action: "open_tests" | "open_test" | "open_compare", params: object) =>
  ({ id: "1", label: "x", action, params }) as Parameters<typeof proposalHref>[0];

describe("proposalHref", () => {
  test("test, compare and explorer links", () => {
    assert.equal(proposalHref(p("open_test", { test_nos: [19] })), "/studies/flex/tests/19");
    assert.equal(proposalHref(p("open_compare", { test_nos: [19, 27, 28, 30] })), "/studies/flex/compare?ids=19,27,28");
    assert.equal(
      proposalHref(p("open_tests", { explorer: { fuel: ["Heptane"], o2: ["30+"], end: ["Extinction", "Disruption"] } })),
      "/studies/flex/tests?fuel=Heptane&o2=30%2B&end=Extinction,Disruption",
    );
    assert.equal(proposalHref(p("open_tests", { explorer: {} })), "/studies/flex/tests");
  });
  test("video and replay at a moment open the test page media", () => {
    assert.equal(proposalHref(p("open_video" as never, { test_nos: [207] })), "/studies/flex/tests/207?view=video#tp-media");
    assert.equal(proposalHref(p("open_replay" as never, { test_nos: [100], t_s: 6.123 })), "/studies/flex/tests/100?view=3d&t=6.12#tp-media");
  });
  test("invalid params give no link", () => {
    assert.equal(proposalHref(p("open_compare", { test_nos: [1] })), null);
    assert.equal(proposalHref(p("open_test", { test_nos: [] })), null);
  });
});

describe("proposalHref for SAME-R", () => {
  test("study samer opens the SAME-R pages", () => {
    assert.equal(proposalHref(p("open_test", { study: "samer", test_nos: [73] })), "/studies/same-r/tests/73");
    assert.equal(proposalHref(p("open_compare", { study: "samer", test_nos: [73, 53] })), "/studies/same-r/compare?ids=73,53");
    assert.equal(proposalHref(p("open_tests", { study: "samer" })), "/studies/same-r/tests");
    assert.equal(proposalHref(p("open_test", { study: "samer", test_nos: [] })), null);
  });
});
