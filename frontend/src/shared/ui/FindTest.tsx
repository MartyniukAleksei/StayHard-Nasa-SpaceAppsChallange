import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import "./find-test.css";

/** "Go to test #": type a test number, open its page. Numbers are checked against the study's tests. */
export function FindTest({ nos, href, study }: { nos: number[]; href: (n: number) => string; study: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const min = Math.min(...nos);
  const max = Math.max(...nos);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(value.replace(/^#/, ""), 10);
    if (!Number.isInteger(n) || !nos.includes(n)) {
      setError(`There is no test #${value.trim() || "?"} in ${study} (tests ${min}–${max}).`);
      return;
    }
    setError(null);
    navigate(href(n));
  };

  return (
    <form className="find-test" role="search" onSubmit={submit}>
      <label className="find-test-label mono" htmlFor={`${errId}-n`}>
        Go to a test
      </label>
      <div className="find-test-row">
        <span className="find-test-hash mono" aria-hidden="true">
          #
        </span>
        <input
        id={`${errId}-n`}
        type="text"
        inputMode="numeric"
        pattern="#?[0-9]*"
        placeholder={`${min}–${max}`}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
      />
        <button type="submit" className="btn-solid">
          Open →
        </button>
      </div>
      {error && (
        <p id={errId} className="find-test-error small" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
