import { mediaUrl, type FileItem } from "@/features/flex-tests";
import { WHAT_HAPPENED_MODE } from "../content";

/** Files the researcher comment can be traced to, best first (kinds from media.files.describe). */
const SOURCE_KINDS = ["Test sheet (PDF)", "Researcher comments", "Test sheet (text)", "Summary report (PDF)"];

export function commentSource(files: FileItem[]): FileItem | null {
  for (const kind of SOURCE_KINDS) {
    const f = files.find((x) => x.kind === kind);
    if (f) return f;
  }
  return null;
}

type Props = {
  /** researcher comment from the NASA test sheet (may be empty) */
  comment: string;
  files: FileItem[];
  /** optional AI-generated summary; shown only in "ai" mode */
  aiSummary?: string | null;
};

/** "What happened": NASA researcher comment or an AI summary. Hidden when there is nothing to show. */
export function WhatHappened({ comment, files, aiSummary }: Props) {
  const useAi = WHAT_HAPPENED_MODE === "ai" && Boolean(aiSummary?.trim());
  const text = useAi ? aiSummary!.trim() : comment.trim();
  if (!text) return null;
  const source = commentSource(files);

  return (
    <section className="tp-sec" aria-labelledby="tp-what">
      <h2 id="tp-what" className="h-section">What happened</h2>
      {useAi ? (
        <p className="tp-what-label mono small">
          <span className="tag">derived</span> SI-generated summary
        </p>
      ) : (
        <p className="tp-what-label mono small muted">Researcher comment</p>
      )}
      <blockquote className="tp-comment" data-source={useAi ? undefined : "comment"}>
        {text}
      </blockquote>
      {!useAi && (
        <p className="small muted">
          Source:{" "}
          {source ? (
            <a href={mediaUrl(source.path)} target="_blank" rel="noreferrer">
              {source.kind} · {source.name}
            </a>
          ) : (
            "NASA PSI FLEX test table"
          )}
        </p>
      )}
    </section>
  );
}
