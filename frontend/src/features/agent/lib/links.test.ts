import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sourceLink } from "./links.ts";

describe("sourceLink", () => {
  test("test rows and comparisons open app pages", () => {
    assert.deepEqual(sourceLink("/api/studies/flex/tests/19"), { href: "/studies/flex/tests/19", internal: true });
    assert.deepEqual(sourceLink("/api/studies/flex/compare?ids=2&ids=45"), {
      href: "/studies/flex/compare?ids=2,45",
      internal: true,
    });
  });
  test("files and queries go to the API base; DOI stays", () => {
    assert.deepEqual(sourceLink("/api/media/flex/files/docs/a.pdf#page=3", "https://b.app"), {
      href: "https://b.app/api/media/flex/files/docs/a.pdf#page=3",
      internal: false,
    });
    assert.equal(sourceLink("/api/studies/flex/compare?ids=2&ids=3&ids=4&ids=5").href, "/studies/flex/compare?ids=2,3,4");
    assert.equal(sourceLink("https://doi.org/10.1/x").href, "https://doi.org/10.1/x");
  });
});
