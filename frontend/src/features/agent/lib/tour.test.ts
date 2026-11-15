// Run: npm test (node:test; Node 24 strips the TS types)
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Tour } from "../types.ts";
import { onTourPage, saveTour, tourHref, tourKey } from "./tour.ts";

const tour: Tour = { id: "toolu_01-0", test_no: 155, steps: [], sources: [] };

describe("agent tour", () => {
  test("href opens the test's 3D replay with the tour id", () => {
    assert.equal(tourHref(tour), "/studies/flex/tests/155?view=3d&tour=toolu_01-0#tp-media");
  });
  test("the tour starts in place only on that test's 3D replay", () => {
    assert.ok(onTourPage("/studies/flex/tests/155", "?view=3d&t=3", 155));
    assert.ok(onTourPage("/studies/flex/tests/155/", "?tour=old&view=3d", 155));
    assert.ok(!onTourPage("/studies/flex/tests/155", "?view=video", 155));
    assert.ok(!onTourPage("/studies/flex/tests/154", "?view=3d", 155));
    assert.ok(!onTourPage("/studies/flex/tests", "", 155));
  });
  test("the spec is stored under the key the scene reads, and a blocked storage is not fatal", () => {
    const saved = new Map<string, string>();
    assert.ok(saveTour({ setItem: (k, v) => void saved.set(k, v) }, tour));
    assert.deepEqual(JSON.parse(saved.get(tourKey("toolu_01-0"))!), tour);
    const blocked = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    assert.equal(saveTour(blocked, tour), false);
    assert.equal(saveTour(undefined, tour), false);
  });
});
