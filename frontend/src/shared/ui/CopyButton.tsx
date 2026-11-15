import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";
const COPY_RESET_MS = 1800;

/** `[ Copy ]` button that puts `text` on the clipboard and reports the result in its label. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), COPY_RESET_MS);
  };

  const status = state === "copied" ? "Copied" : state === "failed" ? "Copy failed — select and copy manually" : "";
  return (
    <>
      <button type="button" className="btn" onClick={copy}>
        {state === "copied" ? "Copied" : label}
      </button>
      <span role="status" className={state === "failed" ? "small muted" : "sr-only"}>
        {status}
      </span>
    </>
  );
}
