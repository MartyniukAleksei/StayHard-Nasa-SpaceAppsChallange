import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { API_BASE, streamAgent } from "../api";
import { pageContext } from "../lib/context";
import { applyHighlight, clearHighlight, clearQuote, focusOnPage, revealElement } from "../lib/highlight";
import { load, save, toHistory } from "../lib/history";
import { sourceTarget } from "../lib/jump";
import { useVisibleSection } from "../lib/useSection";
import type { AgentEvent, AssistantItem, ChatItem, PageContext, Source } from "../types";

type Ctx = {
  items: ChatItem[];
  busy: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  ask: (text: string) => void;
  stop: () => void;
  reset: () => void;
  /** what the assistant sees right now (page + visible section) */
  context: PageContext;
  /** show a cited place on the site: navigate there, highlight it, scroll to it */
  jumpTo: (src: Source) => void;
};

const AgentCtx = createContext<Ctx | null>(null);
const store = () => (typeof window === "undefined" ? undefined : window.sessionStorage);
const uid = () => Math.random().toString(36).slice(2, 10);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ChatItem[]>(() => load(store()));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const cancelFocus = useRef<(() => void) | null>(null);
  const loc = useLocation();
  const navigate = useNavigate();
  const section = useVisibleSection(loc.pathname + loc.search);
  const context = useMemo(() => pageContext(loc.pathname, loc.search, section), [loc.pathname, loc.search, section]);
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => save(store(), items), [items]);
  useEffect(
    () => () => {
      abort.current?.abort();
      cancelFocus.current?.();
    },
    [],
  );

  const patch = useCallback((id: string, fn: (a: AssistantItem) => AssistantItem) => {
    setItems((prev) => prev.map((it) => (it.id === id && it.role === "assistant" ? fn(it) : it)));
  }, []);

  const ask = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setOpen(true);
      clearHighlight();
      clearQuote();
      const user: ChatItem = { id: uid(), role: "user", text, context: ctxRef.current };
      const reply: AssistantItem = {
        id: uid(), role: "assistant", live: "", status: "Thinking…", answer: null, proposals: [], notices: [], done: false,
      };
      const history = toHistory([...itemsRef.current, user]);
      setItems((prev) => [...prev, user, reply]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      setBusy(true);
      const onEvent = (e: AgentEvent) => {
        switch (e.event) {
          case "text_start":
          case "rewrite":
            return patch(reply.id, (a) => ({ ...a, live: "", status: e.event === "rewrite" ? "Adding missing sources…" : a.status }));
          case "text_delta":
            return patch(reply.id, (a) => ({ ...a, live: a.live + e.data.text }));
          case "status":
            return patch(reply.id, (a) => ({ ...a, status: e.data.text }));
          case "proposal":
            return patch(reply.id, (a) => ({ ...a, proposals: [...a.proposals, e.data] }));
          case "frame":
            return patch(reply.id, (a) =>
              (a.frames ?? []).some((f) => f.url === e.data.url) ? a : { ...a, frames: [...(a.frames ?? []), e.data] },
            );
          case "chart":
            return patch(reply.id, (a) => ({ ...a, charts: [...(a.charts ?? []), e.data] }));
          case "highlight": {
            // highlight on the current page and bring the first value into view
            const hits = applyHighlight(e.data.fields, e.data.test_nos);
            if (hits[0]) revealElement(hits[0]);
            return;
          }
          case "limit":
          case "error":
            return patch(reply.id, (a) => ({ ...a, notices: [...a.notices, e.data] }));
          case "done":
            return patch(reply.id, (a) => ({ ...a, answer: e.data.answer, live: "", status: null, done: true }));
        }
      };
      streamAgent(history, onEvent, ctrl.signal).finally(() => {
        patch(reply.id, (a) => (a.done ? a : { ...a, done: true, status: null }));
        setBusy(false);
      });
    },
    [busy, patch],
  );

  const jumpTo = useCallback(
    (src: Source) => {
      const target = sourceTarget(src, API_BASE);
      if (target.kind === "external") {
        window.open(target.href, "_blank", "noopener,noreferrer");
        return;
      }
      const here = window.location.pathname + window.location.search;
      if (here !== target.href) navigate(target.href);
      cancelFocus.current?.();
      cancelFocus.current = focusOnPage(target);
    },
    [navigate],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    clearHighlight();
    clearQuote();
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({ items, busy, open, setOpen, ask, stop, reset, context, jumpTo }),
    [items, busy, open, ask, stop, reset, context, jumpTo],
  );
  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}

export function useAgent(): Ctx {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error("useAgent outside AgentProvider");
  return ctx;
}
