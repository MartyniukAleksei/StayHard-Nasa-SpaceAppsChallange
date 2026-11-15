// Розмова живе лише в sessionStorage вкладки (ADR 0001/0007: сервер без стану).
import type { AssistantItem, ChatItem, HistoryTurn } from "../types.ts";

export const STORAGE_KEY = "flame.agent.chat.v1";
export const MAX_TURNS = 10; // як AGENT_HISTORY_TURNS на бекенді

/** Видимі репліки → стисла історія для запиту: текст відповіді й список джерел. */
export function toHistory(items: ChatItem[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const it of items) {
    if (it.role === "user") {
      turns.push({ role: "user", text: it.text, page_context: it.context });
    } else if (it.answer) {
      turns.push({
        role: "assistant",
        text: it.answer.segments.map((s) => s.text).join(""),
        sources: it.answer.sources.map(({ n, url, title }) => ({ n, url, title })),
      });
    } else {
      turns.pop(); // питання без відповіді (помилка, ліміт) не надсилаємо повторно
    }
  }
  return turns.slice(-MAX_TURNS);
}

export function load(storage: Pick<Storage, "getItem"> | undefined): ChatItem[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as ChatItem[]) : [];
    // незавершений стрім після перезавантаження вкладки — закриваємо
    return items.map((it) => (it.role === "assistant" && !it.done ? closeInterrupted(it) : it));
  } catch {
    return [];
  }
}

export function save(storage: Pick<Storage, "setItem"> | undefined, items: ChatItem[]): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(items.slice(-2 * MAX_TURNS)));
  } catch {
    /* приватний режим або повне сховище — розмова просто не переживе перезавантаження */
  }
}

function closeInterrupted(it: AssistantItem): AssistantItem {
  return {
    ...it,
    done: true,
    status: null,
    notices: [...it.notices, { reason: "interrupted", message: "The answer was interrupted. Ask again." }],
  };
}
