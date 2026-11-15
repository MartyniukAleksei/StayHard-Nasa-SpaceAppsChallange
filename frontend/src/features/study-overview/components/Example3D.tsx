import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Experiment3D } from "@/features/experiment-3d";
import { useTest } from "@/features/flex-tests";
import { chem, num, pct } from "@/shared/lib/format";
import { EndMark } from "@/shared/ui/EndMark";
import { SHOWCASE_TEST } from "../content";

/** Start loading the 3D scene (three.js + series) this far before the section scrolls into view. */
const PRELOAD_MARGIN = "300px";

/** G: one test as a 3D replay from its measured data, with links to it and to all 3D tests. */
export function Example3D() {
  const { data: t } = useTest(SHOWCASE_TEST);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: PRELOAD_MARGIN });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <section className="band" aria-labelledby="example-title">
      <div className="wrap ov-example">
        <h2 id="example-title" className="h-section">See a test in 3D</h2>
        <p className="lede">
          The droplet, the flame and the chamber of test #{SHOWCASE_TEST}, rebuilt from what the ISS cameras measured,
          next to the real onboard frames.
        </p>
        {t && (
          <p className="ov-example-cap mono small">
            #{t.test_no} · {t.fuel} · {pct(t.x_o2)} O₂ in {chem(t.diluent)} · {num(t.p_atm, 2, "atm")} ·{" "}
            <EndMark type={t.end_type} />
          </p>
        )}
        <div ref={box} className="ov-example-stage">
          {near ? <Experiment3D testNo={SHOWCASE_TEST} /> : <div className="ov-example-wait mono small">3D replay loads here…</div>}
        </div>
        <div className="ov-example-actions">
          <Link className="btn-solid" to={`/studies/flex/tests/${SHOWCASE_TEST}?view=3d#tp-media`}>
            View this example →
          </Link>
          <Link className="btn-solid" to="/studies/flex/tests?tag=3d">
            View all examples →
          </Link>
        </div>
      </div>
    </section>
  );
}
