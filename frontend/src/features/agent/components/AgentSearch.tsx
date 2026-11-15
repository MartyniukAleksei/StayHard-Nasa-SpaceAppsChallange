import { useState, type FormEvent } from "react";
import { useAgent } from "./AgentProvider";

/** Поле в шапці: питання агенту. Enter відкриває панель і надсилає. */
export function AgentSearch() {
  const { ask, busy, setOpen, items } = useAgent();
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setOpen(true);
      return;
    }
    ask(text);
    setText("");
  };
  return (
    <form className="search ag-search" role="search" onSubmit={submit}>
      <label>
        <span className="sr-only">Ask the assistant about FLEX</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={busy ? "Answering…" : "Ask about FLEX tests, e.g. why did FLEX-019 disrupt?"}
          maxLength={2000}
          enterKeyHint="send"
        />
      </label>
      {items.length > 0 && (
        <button type="button" className="btn ghost ag-reopen" onClick={() => setOpen(true)}>
          Chat
        </button>
      )}
    </form>
  );
}
