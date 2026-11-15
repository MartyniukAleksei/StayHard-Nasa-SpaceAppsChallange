import { Fragment, type ReactElement } from "react";
import { Link } from "react-router";
import { API_BASE } from "../api";
import { answerBlocks, toBlocks, type Block, type Inline } from "../lib/answer";
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
          <li key={i} className={b.general ? "ag-general" : undefined}>
            <Inlines inlines={b.inlines} sources={sources} onCite={onCite} />
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };
  let generalShown = false;
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
    const tag = b.general && !generalShown;
    generalShown = b.general;
    const body = <Inlines inlines={b.inlines} sources={sources} onCite={onCite} />;
    out.push(
      b.type === "h" ? (
        <p key={i} className="ag-h">{body}</p>
      ) : (
        <p key={i} className={b.general ? "ag-general" : undefined}>
          {tag && <span className="tag ag-tag" title="Background physics, not from the FLEX data">general knowledge</span>} {body}
        </p>
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
              return s ? (
                <button key={k} type="button" className="ag-cite" aria-label={`Source ${k}: ${s.title}`} onClick={() => onCite(s)}>
                  [{k}]
                </button>
              ) : null;
            })}
          </Fragment>
        ),
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
