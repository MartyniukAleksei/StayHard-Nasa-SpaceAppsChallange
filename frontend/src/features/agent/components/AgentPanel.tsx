import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { proposalHref } from "../lib/actions";
import { describeContext } from "../lib/context";
import type { AssistantItem, ChatItem, PageContext, Proposal, Source } from "../types";
import { useAgent } from "./AgentProvider";
import { AnswerText, SourceCard } from "./AnswerText";
import { ChartBlock } from "./ChartBlock";
import { FrameStrip } from "./FrameBlock";
import "./agent.css";

const W_KEY = "ag-width";
const W_DEFAULT = 420;
const W_MIN = 320;
const W_MAX_SHARE = 0.7;
const W_STEP = 24;

const clampWidth = (w: number) => Math.round(Math.max(W_MIN, Math.min(window.innerWidth * W_MAX_SHARE, w)));

function storedWidth(): number {
  try {
    const v = Number(window.localStorage.getItem(W_KEY));
    return Number.isFinite(v) && v > 0 ? v : W_DEFAULT;
  } catch {
    return W_DEFAULT;
  }
}

/** Бічна панель чату. Змонтована в Layout поза Outlet — не закривається під час навігації. */
export function AgentPanel() {
  const { items, busy, open, setOpen, ask, stop, reset, context, jumpTo } = useAgent();
  const [text, setText] = useState("");
  const [cited, setCited] = useState<Source | null>(null);
  const [width, setWidth] = useState(storedWidth);
  const [full, setFull] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("ag-open", open);
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    document.documentElement.classList.toggle("ag-full", open && full);
  }, [open, full]);
  useEffect(() => {
    const w = clampWidth(width);
    document.documentElement.style.setProperty("--ag-w", `${w}px`);
    try {
      window.localStorage.setItem(W_KEY, String(w));
    } catch {
      /* private mode: the width just is not remembered */
    }
  }, [width]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [items, open]);

  if (!open) return null;
  const onCite = (src: Source) => {
    setCited(src);
    if (full) setFull(false); // the cited place is on the page: make room for it
    jumpTo(src);
  };
  const close = () => {
    if (full) setFull(false);
    else setOpen(false);
  };
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    ask(text);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) send(e);
    if (e.key === "Escape") close();
  };

  return (
    <aside
      className={`ag-panel${cited ? " with-src" : ""}${full ? " full" : ""}`}
      aria-label="FLEX assistant"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      {!full && <ResizeHandle width={width} onChange={(w) => setWidth(clampWidth(w))} />}
      <header className="ag-head">
        <span className="h-section ag-title">Assistant</span>
        <span className="ag-head-actions">
          <button type="button" className="btn ghost" onClick={() => setFull((f) => !f)} aria-pressed={full}>
            {full ? "Collapse" : "Expand"}
          </button>
          <button type="button" className="btn ghost" onClick={reset} disabled={!items.length}>
            New chat
          </button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
        <p className="ag-context mono small" title="What the assistant sees: the page and the section you are looking at">
          <span className="muted">Context:</span> {describeContext(context)}
        </p>
      </header>
      <div className="ag-log" aria-live="polite">
        {items.length === 0 && <Intro />}
        {items.map((it) =>
          it.role === "user" ? <UserMsg key={it.id} text={it.text} context={it.context} /> : <Reply key={it.id} it={it} onCite={onCite} />,
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

function UserMsg({ text, context }: { text: string; context?: PageContext }) {
  return (
    <div className="ag-user-wrap">
      <p className="ag-user">{text}</p>
      {context && <span className="ag-user-ctx mono">asked on {describeContext(context)}</span>}
    </div>
  );
}

/** Drag the left edge (or use ← →) to change the panel width; double-click resets it. */
function ResizeHandle({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => onChange(window.innerWidth - ev.clientX);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      document.documentElement.classList.remove("ag-resizing");
    };
    document.documentElement.classList.add("ag-resizing");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <div
      className="ag-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the assistant panel"
      aria-valuenow={Math.round(width)}
      aria-valuemin={W_MIN}
      tabIndex={0}
      onPointerDown={drag}
      onDoubleClick={() => onChange(W_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(width + W_STEP);
        if (e.key === "ArrowRight") onChange(width - W_STEP);
      }}
    />
  );
}

function Reply({ it, onCite }: { it: AssistantItem; onCite: (s: Source) => void }) {
  return (
    <div className="ag-reply">
      {it.status && !it.done && (
        <p className="ag-status mono small" role="status">
          {it.status}
        </p>
      )}
      {it.frames && it.frames.length > 0 && <FrameStrip frames={it.frames} />}
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
