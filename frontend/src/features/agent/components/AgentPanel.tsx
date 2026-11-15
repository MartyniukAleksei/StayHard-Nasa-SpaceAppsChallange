import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { proposalHref } from "../lib/actions";
import type { AssistantItem, ChatItem, Proposal, Source } from "../types";
import { useAgent } from "./AgentProvider";
import { AnswerText, SourceCard } from "./AnswerText";
import { ChartBlock } from "./ChartBlock";
import "./agent.css";

/** Бічна панель чату. Змонтована в Layout поза Outlet — не закривається під час навігації. */
export function AgentPanel() {
  const { items, busy, open, setOpen, ask, stop, reset } = useAgent();
  const [text, setText] = useState("");
  const [cited, setCited] = useState<Source | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("ag-open", open);
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [items, open]);

  if (!open) return null;
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    ask(text);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) send(e);
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <aside className={cited ? "ag-panel with-src" : "ag-panel"} aria-label="FLEX assistant" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <header className="ag-head">
        <span className="h-section ag-title">Assistant</span>
        <span className="ag-head-actions">
          <button type="button" className="btn ghost" onClick={reset} disabled={!items.length}>
            New chat
          </button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      </header>
      <div className="ag-log" aria-live="polite">
        {items.length === 0 && <Intro />}
        {items.map((it) =>
          it.role === "user" ? <UserMsg key={it.id} text={it.text} /> : <Reply key={it.id} it={it} onCite={setCited} />,
        )}
        <div ref={end} />
      </div>
      {cited && <SourceCard src={cited} onClose={() => setCited(null)} />}
      <form className="ag-form" onSubmit={send}>
        <label className="sr-only" htmlFor="ag-input">Your question</label>
        <textarea
          id="ag-input"
          ref={input}
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask a follow-up…"
        />
        {busy ? (
          <button type="button" className="btn" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="btn" disabled={!text.trim()}>Ask</button>
        )}
      </form>
    </aside>
  );
}

function Intro() {
  return (
    <div className="ag-intro">
      <p className="muted small">
        Answers come only from NASA's FLEX data and documents. Every number links to its source; text without a source is
        marked. The assistant can suggest pages to open — nothing changes until you click.
      </p>
    </div>
  );
}

function UserMsg({ text }: { text: string }) {
  return <p className="ag-user">{text}</p>;
}

function Reply({ it, onCite }: { it: AssistantItem; onCite: (s: Source) => void }) {
  return (
    <div className="ag-reply">
      {it.status && !it.done && (
        <p className="ag-status mono small" role="status">
          {it.status}
        </p>
      )}
      {(it.charts ?? []).map((c, i) => (
        <ChartBlock key={i} chart={c} />
      ))}
      {(it.answer || it.live) && <AnswerText answer={it.answer} live={it.live} onCite={onCite} />}
      {it.notices.map((n, i) => (
        <p key={i} className="placeholder ag-notice" role="alert">
          {n.message}
        </p>
      ))}
      {it.proposals.length > 0 && <Proposals list={it.proposals} />}
      {it.answer && it.answer.sources.length > 0 && <SourceCount n={it.answer.sources.length} />}
    </div>
  );
}

function SourceCount({ n }: { n: number }) {
  return <p className="muted small mono ag-count">{n} source{n === 1 ? "" : "s"} · click a number to see the quote</p>;
}

function Proposals({ list }: { list: Proposal[] }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [opened, setOpened] = useState<{ id: string; from: string } | null>(null);
  return (
    <div className="ag-actions">
      {list.map((p) => {
        const href = proposalHref(p);
        if (!href) return null;
        const done = opened?.id === p.id;
        return (
          <span key={p.id} className="ag-action">
            <button
              type="button"
              className={done ? "btn ghost" : "btn"}
              onClick={() => {
                setOpened({ id: p.id, from: loc.pathname + loc.search });
                navigate(href);
              }}
            >
              {p.label}
            </button>
            {done && (
              <>
                <span className="muted small" role="status">Opened</span>
                <button type="button" className="btn ghost" onClick={() => { navigate(opened.from); setOpened(null); }}>
                  Back
                </button>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

export type { ChatItem };
