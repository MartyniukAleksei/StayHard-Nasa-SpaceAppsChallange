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
  test("invalid params give no link", () => {
    assert.equal(proposalHref(p("open_compare", { test_nos: [1] })), null);
    assert.equal(proposalHref(p("open_test", { test_nos: [] })), null);
  });
});
