import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTest } from "@/features/flex-tests";
import { chem, num, pct } from "@/shared/lib/format";
import { EndMark } from "@/shared/ui/EndMark";
import { REFS } from "../refs";
import type { Note } from "../testCards";

/** True once the element is within `margin` of the viewport; stays true after that. */
export function useNear<T extends Element>(margin = "300px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

export function Pending({ text }: { text: string }) {
  return <p className="tc-wait mono small">{text}</p>;
}

/** Source links under a claim: the short name of each paper, opening the paper or dataset. */
export function RefLinks({ ids }: { ids: string[] }) {
  return (
    <p className="tc-refs mono small">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span className="muted"> · </span>}
          <a href={REFS[id].href} target="_blank" rel="noreferrer">
            {REFS[id].short}
          </a>
        </span>
      ))}
    </p>
  );
}

export function Notes({ notes }: { notes: Note[] }) {
  return (
    <ul className="tc-notes">
      {notes.map((n) => (
        <li key={n.text}>
          <p>{n.text}</p>
          <RefLinks ids={n.refs} />
        </li>
      ))}
    </ul>
  );
}

/** One line of test conditions from the tests table. */
export function TestHead({ testNo }: { testNo: number }) {
  const { data: t } = useTest(testNo);
  if (!t) return <span>#{testNo}</span>;
  return (
    <>
      <Link to={`/studies/flex/tests/${t.test_no}`}>#{t.test_no}</Link> · {t.fuel} · {pct(t.x_o2)} O₂ in {chem(t.diluent)} ·{" "}
      {num(t.p_atm, 2, "atm")} · {t.fiber ? "on a fiber" : "free-floating"} · <EndMark type={t.end_type} />
    </>
  );
}
