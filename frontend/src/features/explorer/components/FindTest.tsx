import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { testHref, type TestSummary } from "@/features/flex-tests";

/** "Go to test #": type a test number, open its page. Numbers are checked against the data. */
export function FindTest({ tests }: { tests: TestSummary[] }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const nos = tests.map((t) => t.test_no);
  const min = Math.min(...nos);
  const max = Math.max(...nos);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(value.replace(/^#/, ""), 10);
    if (!Number.isInteger(n) || !nos.includes(n)) {
      setError(`There is no test #${value.trim() || "?"} in FLEX (tests ${min}–${max}).`);
      return;
    }
    setError(null);
    navigate(testHref(n));
  };

  return (
    <form className="ex-find" role="search" onSubmit={submit}>
      <label className="ex-find-label mono" htmlFor={`${errId}-n`}>
        Find test #
      </label>
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
        Open test →
      </button>
      {error && (
        <p id={errId} className="ex-find-error small" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
