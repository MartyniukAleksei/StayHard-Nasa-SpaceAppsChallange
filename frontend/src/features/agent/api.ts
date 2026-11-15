// POST /api/agent → події SSE. Відмова до стріму (JSON detail) стає подією limit/error.
import { createSseParser } from "./lib/sse";
import type { AgentEvent, HistoryTurn } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";
export const API_BASE = BASE;

type Detail = { reason?: string; message?: string };

export async function streamAgent(
  messages: HistoryTurn[],
  onEvent: (e: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) return;
    onEvent({ event: "error", data: { reason: "network", message: "Could not reach the assistant. Check your connection and try again." } });
    return;
  }
  if (!res.ok || !res.body) {
    let detail: Detail = {};
    try {
      const body = (await res.json()) as { detail?: Detail | string };
      detail = typeof body.detail === "object" ? body.detail : {};
    } catch {
      /* тіло не JSON */
    }
    const event = res.status === 429 || res.status === 503 ? "limit" : "error";
    onEvent({
      event,
      data: {
        reason: detail.reason ?? `http_${res.status}`,
        message: detail.message ?? `The assistant is unavailable (${res.status}). Try again later.`,
      },
    } as AgentEvent);
    return;
  }
  const parser = createSseParser((e) => onEvent(e as AgentEvent));
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
    parser.flush();
  } catch {
    if (!signal.aborted) {
      onEvent({ event: "error", data: { reason: "stream", message: "The connection dropped before the answer finished. Ask again." } });
    }
  }
}
