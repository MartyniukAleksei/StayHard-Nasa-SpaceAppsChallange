import { useEffect } from "react";
import { useAgent } from "./AgentProvider";

/** Header button that opens the agent terminal (also Ctrl+` / ⌘+`, like a terminal in an editor). */
export function AgentLauncher() {
  const { open, setOpen, busy, items } = useAgent();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <button
      type="button"
      className={open ? "ag-launch on" : "ag-launch"}
      aria-expanded={open}
      aria-controls="ag-panel"
      title="Open the agent terminal (Ctrl+`)"
      onClick={() => setOpen(!open)}
    >
      <span className="ag-launch-caret" aria-hidden="true">&gt;_</span>
      <span>agent</span>
      {busy ? (
        <span className="ag-launch-dot" aria-label="answering" />
      ) : items.length > 0 && !open ? (
        <span className="ag-launch-count mono">{Math.ceil(items.length / 2)}</span>
      ) : null}
    </button>
  );
}
