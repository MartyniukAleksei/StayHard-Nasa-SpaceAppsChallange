import { useRef, type PointerEvent } from "react";

import { FLOW, O2 } from "../content";
import { A_AT_MINIMUM, boundaryO2, flowForStretch, stretchRate } from "../lib/boundary";
import { useSim, type Sim } from "../lib/sim";

const W = 560;
const H = 220;
const PAD = { l: 44, r: 12, t: 14, b: 30 };
const A_MIN = 0.4;
const A_MAX = 400;
const Y_MIN = 13;
const Y_MAX = 21;
const A_TICKS = [1, 3, 10, 30, 100, 300];
const Y_TICKS = [13, 15, 17, 19, 21];

const xOf = (a: number) => PAD.l + (Math.log(a / A_MIN) / Math.log(A_MAX / A_MIN)) * (W - PAD.l - PAD.r);
const yOf = (o2: number) => PAD.t + ((Y_MAX - o2) / (Y_MAX - Y_MIN)) * (H - PAD.t - PAD.b);
const aOf = (x: number) => A_MIN * Math.pow(A_MAX / A_MIN, (x - PAD.l) / (W - PAD.l - PAD.r));
const o2Of = (y: number) => Y_MAX - ((y - PAD.t) / (H - PAD.t - PAD.b)) * (Y_MAX - Y_MIN);

/** Eq. 6.1 as a curve, clipped to the plot. */
function curvePath(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const a = A_MIN * Math.pow(A_MAX / A_MIN, i / 160);
    const o2 = boundaryO2(a);
    if (o2 > Y_MAX) continue;
    pts.push(`${pts.length ? "L" : "M"}${xOf(a).toFixed(1)},${yOf(o2).toFixed(1)}`);
  }
  return pts.join(" ");
}
const CURVE = curvePath();

/**
 * Flammability map of the PMMA rod in concurrent flow: the report's Eq. 6.1 and the chosen setting.
 * Click or drag to set flow and O2 together.
 */
export function BoundaryMap({ sim }: { sim: Sim }) {
  const { u, o2, rodRadiusCm, regime } = useSim(sim);
  const svg = useRef<SVGSVGElement>(null);
  const a = stretchRate(u, rodRadiusCm);
  const aDuctMax = stretchRate(FLOW.maxCmS, rodRadiusCm);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    const y = ((e.clientY - box.top) / box.height) * H;
    sim.setFlow(flowForStretch(aOf(Math.min(W - PAD.r, Math.max(PAD.l, x))), rodRadiusCm));
    sim.setO2(Math.round(o2Of(Math.min(H - PAD.b, Math.max(PAD.t, y))) * 10) / 10);
  };

  return (
    <figure className="b3d-map">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Flammability boundary of PMMA rods: O2 against stretch rate, with the chosen setting"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
      >
        {A_TICKS.map((t) => (
          <g key={t}>
            <line className="tick" x1={xOf(t)} x2={xOf(t)} y1={PAD.t} y2={H - PAD.b} />
            <text x={xOf(t)} y={H - PAD.b + 13} textAnchor="middle">{t}</text>
          </g>
        ))}
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line className="tick" x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} />
            <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 3} textAnchor="middle">stretch rate a, 1/s (log)</text>
        <text x={12} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}>
          O₂, % vol
        </text>

        {/* limits quoted by the report; the caption says what they are */}
        <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={yOf(O2.ignitionLimit)} y2={yOf(O2.ignitionLimit)} />
        <text x={PAD.l + 4} y={yOf(O2.ignitionLimit) + 12}>ignition ~{O2.ignitionLimit} %</text>
        <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={yOf(O2.earthUpwardLimit)} y2={yOf(O2.earthUpwardLimit)} />
        <text x={PAD.l + 4} y={yOf(O2.earthUpwardLimit) - 5}>1g limit {O2.earthUpwardLimit} %</text>
        {aDuctMax < A_MAX && (
          <>
            <line className="ref" x1={xOf(aDuctMax)} x2={xOf(aDuctMax)} y1={PAD.t} y2={H - PAD.b} />
            <text x={xOf(aDuctMax) - 4} y={PAD.t + 10} textAnchor="end">duct max</text>
          </>
        )}

        <path className="curve" d={CURVE} />
        <text className="ink" x={xOf(0.45)} y={yOf(16.3)}>quenching</text>
        <text className="ink" x={xOf(A_AT_MINIMUM)} y={yOf(17.4)} textAnchor="middle">burns</text>
        <text className="ink" x={xOf(70)} y={yOf(13.45)} textAnchor="middle">blowoff</text>

        <line className="cursor" x1={xOf(a)} x2={xOf(a)} y1={PAD.t} y2={H - PAD.b} />
        <rect className={regime === "burning" ? "dot live" : "dot"} x={xOf(a) - 4} y={yOf(o2) - 4} width={8} height={8} />
      </svg>
      <figcaption className="b3d-note">
        Curve: X(O₂) = 6·exp(−0.5·a) + 0.0167·a + 13.4, an empirical fit by Olson &amp; Ferkul (Eq. 6.1, p.75), with
        a = (3/2)(U/r)(r/r₀)^½ and r₀ = 0.318 cm. Dashed: ignition limit ~{O2.ignitionLimit} % O₂ (p.68);
        upward flame spread limit in normal gravity with an additional 4 cm/s forced flow, {O2.earthUpwardLimit} % O₂
        (p.76); the duct's maximum flow, ~{FLOW.maxCmS} cm/s (p.4). The square is the setting you chose, not a test.
        Click or drag to move it.
      </figcaption>
    </figure>
  );
}
