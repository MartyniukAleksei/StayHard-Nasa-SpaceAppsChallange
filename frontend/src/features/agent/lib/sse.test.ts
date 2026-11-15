import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createSseParser, type RawEvent } from "./sse.ts";

describe("createSseParser", () => {
  test("parses events split across chunks", () => {
    const got: RawEvent[] = [];
    const p = createSseParser((e) => got.push(e));
    p.feed('event: text_delta\ndata: {"text":"He');
    p.feed('llo"}\n\nevent: done\r\ndata: {"ok":true}\r\n\r\n');
    assert.deepEqual(got, [
      { event: "text_delta", data: { text: "Hello" } },
      { event: "done", data: { ok: true } },
    ]);
  });
  test("flush emits a trailing event without the blank line", () => {
    const got: RawEvent[] = [];
    const p = createSseParser((e) => got.push(e));
    p.feed("event: status\ndata: plain");
    p.flush();
    assert.deepEqual(got, [{ event: "status", data: "plain" }]);
  });
});
