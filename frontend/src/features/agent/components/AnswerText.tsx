import { Fragment, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { API_BASE } from "../api";
import { answerBlocks, toBlocks, type Block, type Inline } from "../lib/answer";
import { sourceTarget } from "../lib/jump";
import { sourceLink } from "../lib/links";
import type { Answer, Source } from "../types";

type OnCite = (src: Source) => void;

/** Текст відповіді з номерами джерел; живий стрім — без цитат. */
export function AnswerText({ answer, live, onCite }: { answer: Answer | null; live?: string; onCite: OnCite }) {
  const blocks = answer ? answerBlocks(answer.segments) : toBlocks(live ?? "");
  const sources = new Map((answer?.sources ?? []).map((s) => [s.n, s]));
  return <div className="ag-text">{renderBlocks(blocks, sources, onCite)}</div>;
}

function renderBlocks(blocks: Block[], sources: Map<number, Source>, onCite: OnCite) {
  const out: ReactElement[] = [];
  let list: { ordered: boolean; items: Block[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`}>
        {list.items.map((b, i) => (
          <li key={i}>
            <Inlines inlines={b.inlines} sources={sources} onCite={onCite} />
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  blocks.forEach((b, i) => {
    if (b.type === "li" || b.type === "oli") {
      const ordered = b.type === "oli";
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push(b);
      return;
    }
    flush();
    const body = <Inlines inlines={b.inlines} sources={sources} onCite={onCite} />;
    out.push(
      b.type === "h" ? (
        <p key={i} className="ag-h">{body}</p>
      ) : (
        <p key={i}>{body}</p>
      ),
    );
  });
  flush();
  return out;
}

function Inlines({ inlines, sources, onCite }: { inlines: Inline[]; sources: Map<number, Source>; onCite: OnCite }) {
  return (
    <>
      {inlines.map((x, i) =>
        x.type === "text" ? (
          x.bold ? <strong key={i}>{x.text}</strong> : <Fragment key={i}>{x.text}</Fragment>
        ) : x.type === "nosource" ? (
          <span key={i} className="tag ag-tag ag-nosrc" title="This statement has no source in the FLEX data">no source</span>
        ) : (
          <Fragment key={i}>
            {x.n.map((k) => {
              const s = sources.get(k);
              return s ? <Cite key={k} src={s} onCite={onCite} /> : null;
            })}
          </Fragment>
        ),
      )}
    </>
  );
}

const POP_W = 300;
const QUOTE_MAX = 360;

/** [n] like NotebookLM: hover/focus shows the verbatim quote, click shows the cited place. */
function Cite({ src, onCite }: { src: Source; onCite: OnCite }) {
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const panel = el.closest(".ag-panel")?.getBoundingClientRect();
    const minL = (panel?.left ?? 0) + 8;
    const maxL = Math.min(window.innerWidth, panel?.right ?? window.innerWidth) - POP_W - 8;
    const below = r.bottom + 180 < window.innerHeight;
    setPos({ left: Math.max(minL, Math.min(maxL, r.left - 20)), top: below ? r.bottom + 6 : r.top - 6, below });
  };
  const quote = src.quotes[0] ?? "";
  const onPage = sourceTarget(src).kind === "page";
  const tipId = `ag-pop-${src.n}`;
  return (
    <>
      <button
        type="button"
        className="ag-cite"
        aria-label={`Source ${src.n}: ${src.title}`}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setPos(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPos(null)}
        onClick={() => {
          setPos(null);
          onCite(src);
        }}
      >
        [{src.n}]
      </button>
      {pos && (
        <span
          id={tipId}
          role="tooltip"
          className={pos.below ? "ag-pop" : "ag-pop above"}
          style={{ left: pos.left, top: pos.top, width: POP_W }}
        >
          <span className="mono small muted">[{src.n}] {src.title}</span>
          {quote && <q className="ag-quote">{quote.length > QUOTE_MAX ? `${quote.slice(0, QUOTE_MAX)}…` : quote}</q>}
          <span className="small muted">{onPage ? "Click to show it on the page" : "Click to open the source"}</span>
        </span>
      )}
    </>
  );
}

/** Картка джерела внизу панелі: назва, дослівні цитати, посилання. */
export function SourceCard({ src, onClose }: { src: Source; onClose: () => void }) {
  const link = sourceLink(src.url, API_BASE);
  return (
    <section className="ag-src" aria-label={`Source ${src.n}`}>
      <header className="ag-src-head">
        <span className="mono small">[{src.n}] {src.title}</span>
        <button type="button" className="btn ghost" onClick={onClose}>Close</button>
      </header>
      {src.quotes.slice(0, 2).map((q, i) => (
        <q key={i} className="ag-quote">{q.length > 360 ? `${q.slice(0, 360)}…` : q}</q>
      ))}
      <SourceLink link={link} label="Open source" />
    </section>
  );
}

export function SourceLink({ link, label }: { link: ReturnType<typeof sourceLink>; label: string }) {
  return link.internal ? (
    <Link className="btn ghost" to={link.href}>{label}</Link>
  ) : (
    <a className="btn ghost" href={link.href} target="_blank" rel="noreferrer">{label}</a>
  );
}
