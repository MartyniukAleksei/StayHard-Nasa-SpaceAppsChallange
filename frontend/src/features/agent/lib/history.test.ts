import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ChatItem } from "../types.ts";
import { MAX_TURNS, load, save, toHistory } from "./history.ts";

const user = (text: string): ChatItem => ({ id: text, role: "user", text, context: { route: "/" } });
const reply = (text: string, done = true): ChatItem => ({
  id: `a-${text}`,
  role: "assistant",
  live: "",
  status: null,
  proposals: [],
  notices: [],
  done,
  answer: done
    ? { segments: [{ text, cites: [1], general: false, uncited: false }], sources: [{ n: 1, url: "/u", title: "T", quotes: ["q"] }] }
    : null,
});

describe("toHistory", () => {
  test("condenses answers and drops questions without an answer", () => {
    const turns = toHistory([user("Q1"), reply("A1"), user("Q2"), reply("x", false), user("Q3")]);
    assert.deepEqual(turns, [
      { role: "user", text: "Q1", page_context: { route: "/" } },
      { role: "assistant", text: "A1", sources: [{ n: 1, url: "/u", title: "T" }] },
      { role: "user", text: "Q3", page_context: { route: "/" } },
    ]);
  });
  test("keeps only the last turns", () => {
    const items = Array.from({ length: 30 }, (_, i) => (i % 2 ? reply(`A${i}`) : user(`Q${i}`)));
    assert.equal(toHistory(items).length, MAX_TURNS);
  });
});

describe("load/save", () => {
  test("round-trip and an interrupted stream is closed with a notice", () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    save(s, [user("Q"), reply("A", false)]);
    const items = load(s);
    const a = items[1];
    assert.ok(a.role === "assistant" && a.done && a.notices[0].reason === "interrupted");
  });
  test("broken storage gives an empty chat", () => {
    assert.deepEqual(load({ getItem: () => "{not json" }), []);
    assert.deepEqual(load(undefined), []);
  });
});
