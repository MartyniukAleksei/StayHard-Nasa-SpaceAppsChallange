import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { dropletPosition, type Experiment } from "../lib/experiment";
import type { Playback } from "../lib/playback";
import { presence, sample } from "../lib/series";

// Апаратура MDCA навколо краплі. МОМЕНТИ руху — з журналу тесту (experiment.events).
// ФОРМИ схематичні, за описом у документах FLEX і реальними кадрами кольорової камери:
//  - дві зустрічні голки з трубки 0.010" (0.254 мм) — FLEX Engineering Requirements Document, с. 15;
//  - два запалювачі з одним кільцем розжареного дроту — MDCA/FLEX2 Reflight Safety Data Package, с. 22;
//  - нитка-опора з карбіду кремнію 80 мкм (лише тести з ниткою) — 2G11-070HE-0310, с. 4.
const NEEDLE_RADIUS = 0.127;
const NEEDLE_PARK = 30; // мм: куди відходить голка (схематично)
const NEEDLE_TRAVEL_S = 0.3; // тривалість відведення голок у журналі не записана
const IGNITER_PARK = 46;
// Кільце запалювача стоїть за 1–5 початкових діаметрів від поверхні краплі
// (FLEX Engineering Requirements Document, п. 4.1.29); на кадрах кольорової камери — близько одного.
const IGNITER_GAP_D0 = 1;
const IGNITER_DIRS: [number, number][] = [
  [-0.8, 0.6],
  [0.8, -0.6],
];

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

interface Props {
  experiment: Experiment;
  playback: Playback;
}

export function Apparatus({ experiment, playback }: Props) {
  const needles = useRef<(THREE.Group | null)[]>([]);
  const igniters = useRef<(THREE.Group | null)[]>([]);
  const { events } = experiment;
  const d0 = experiment.test.d0_mm ?? experiment.droplet.cols.d_mm[0];

  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#dfe6f2", metalness: 0.85, roughness: 0.3, emissive: "#3a4458" }),
    [],
  );
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c4ccd9", metalness: 0.55, roughness: 0.42, emissive: "#1c212c" }), []);
  const ceramic = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f1ede4", roughness: 0.7 }), []);
  const wire = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#59493f", emissive: "#ff5a14", emissiveIntensity: 0, roughness: 0.5 }),
    [],
  );

  // Крапля на нитці може рухатись лише вздовж неї, тому напрямок нитки беремо з напрямку
  // зміщення краплі за час тесту (оцінка). Якщо крапля майже не рухалась — уздовж осі Z.
  const fiberQuaternion = useMemo(() => {
    const [x0, y0, z0] = experiment.deploySite;
    const [x1, y1, z1] = dropletPosition(experiment, experiment.droplet.t1);
    const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    if (dir.length() < 0.5) dir.set(0, 0, 1);
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }, [experiment]);

  useFrame(() => {
    const t = playback.t;
    const r = (sample(experiment.droplet, "d_mm", t, true) ?? experiment.test.d0_mm ?? 4) / 2;

    // голки: торкаються краплі до «AS Needles Retract», потім відходять
    const needleOut = events.needlesRetract == null ? 1 : smooth((t - events.needlesRetract) / NEEDLE_TRAVEL_S);
    needles.current.forEach((g, i) => {
      if (g) g.position.y = (i === 0 ? -1 : 1) * (r + needleOut * NEEDLE_PARK);
    });

    // запалювачі: біля краплі, світяться між «Igniter On» і «Igniter Off», відходять до «Retract Completed»
    const retractEnd = events.igniterRetracted ?? 0.4;
    const igniterOut = smooth(t / (retractEnd || 0.4));
    const heat = events.igniterOn != null && t >= events.igniterOn && t < 0 ? smooth((t - events.igniterOn) / 0.25) : 0;
    igniters.current.forEach((g, i) => {
      if (!g) return;
      const dist = r + IGNITER_GAP_D0 * d0 + igniterOut * IGNITER_PARK;
      g.position.set(IGNITER_DIRS[i][0] * dist, IGNITER_DIRS[i][1] * dist, 0);
    });
    // після вимкнення дріт остигає приблизно за чверть секунди (вигляд, не вимірювання)
    wire.emissiveIntensity = heat > 0 ? 9 * heat : 9 * Math.max(0, 1 - t / 0.25) * (t >= 0 ? 1 : 0);
  });

  return (
    <group position={experiment.deploySite}>
      {[-1, 1].map((s, i) => (
        <group key={s} ref={(g) => void (needles.current[i] = g)}>
          {/* вертикальна ділянка від кінчика і горизонтальна до приводу */}
          <mesh material={steel} position={[0, s * 5, 0]}>
            <cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, 10, 12]} />
          </mesh>
          <mesh material={steel} position={[s * 45, s * 10, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, 90, 12]} />
          </mesh>
          {/* розширений кінчик («flared») */}
          <mesh material={steel} position={[0, s * 0.25, 0]} rotation={[s < 0 ? Math.PI : 0, 0, 0]}>
            <coneGeometry args={[0.32, 0.5, 16, 1, true]} />
          </mesh>
        </group>
      ))}

      {IGNITER_DIRS.map(([dx, dy], i) => (
        <group key={i} ref={(g) => void (igniters.current[i] = g)}>
          {/* локальна вісь +Y дивиться від краплі назовні */}
          <group rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}>
            <mesh material={wire} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.85, 0.075, 12, 48]} />
            </mesh>
            <mesh material={ceramic} position={[0, 3.4, 0]}>
              <cylinderGeometry args={[1.25, 0.45, 5, 24]} />
            </mesh>
            <mesh material={body} position={[0, 13.5, 0]}>
              <boxGeometry args={[6, 15, 6]} />
            </mesh>
            <mesh material={body} position={[0, 61, 0]}>
              <cylinderGeometry args={[1.6, 1.6, 80, 16]} />
            </mesh>
          </group>
        </group>
      ))}

      {experiment.test.ts_fiber && (
        <mesh quaternion={fiberQuaternion}>
          {/* 80 мкм у масштабі — менше пікселя, тому малюємо вдвічі товще, щоб нитку було видно */}
          <cylinderGeometry args={[0.08, 0.08, 240, 8]} />
          <meshStandardMaterial color="#cfd8ea" emissive="#55617a" metalness={0.4} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

// Камера згоряння CIR у справжньому масштабі: «циліндрична посудина з куполоподібними торцями…
// об'єм 100 л, внутрішній діаметр 0.40 м, довжина 0.78 м… вісім змінних вікон» —
// NASA/TM—2005-213973, «The Fluids and Combustion Facility: Enabling the Exploration of Space».
// Схематично: глибина куполів, розмір і розташування вікон, ребра; крапля — в центрі на осі.
const CHAMBER_RADIUS = 200;
const CHAMBER_LENGTH = 780;
const DOME_DEPTH = 60;
const WINDOW_RADIUS = 42;

export function Chamber({ experiment, playback }: Props) {
  const wall = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#232a3a",
        metalness: 0.55,
        roughness: 0.62,
        side: THREE.BackSide, // видно лише зсередини: ззовні камера «прозора», як у розрізі
        emissive: "#ff9a55",
        emissiveIntensity: 0,
      }),
    [],
  );
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0b1322", metalness: 0.2, roughness: 0.08, emissive: "#2a4a80", emissiveIntensity: 0.35 }),
    [],
  );
  const rim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a94a8", metalness: 0.85, roughness: 0.35 }), []);
  const ribs = useMemo(() => {
    const body = CHAMBER_LENGTH - 2 * DOME_DEPTH;
    const geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(CHAMBER_RADIUS - 0.5, CHAMBER_RADIUS - 0.5, body, 48, 6, true), 1);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#7f93c8", transparent: true, opacity: 0.1 }));
  }, []);

  // полум'я підсвічує стінки (вигляд, не вимірювання)
  useFrame(() => {
    const t = playback.t;
    const glow = Math.max(presence(experiment.flameColor, t), presence(experiment.flameUv, t) * 0.5);
    wall.emissiveIntensity = 0.012 + glow * 0.035;
  });

  const body = CHAMBER_LENGTH - 2 * DOME_DEPTH;
  return (
    <group position={experiment.deploySite} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={wall}>
        <cylinderGeometry args={[CHAMBER_RADIUS, CHAMBER_RADIUS, body, 96, 1, true]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={wall} position={[0, (s * body) / 2, 0]} scale={[1, (s * DOME_DEPTH) / CHAMBER_RADIUS, 1]}>
          <sphereGeometry args={[CHAMBER_RADIUS, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      <primitive object={ribs} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r = CHAMBER_RADIUS - 2;
        return (
          <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a - Math.PI / 2, 0]}>
            <mesh material={glass}>
              <circleGeometry args={[WINDOW_RADIUS, 48]} />
            </mesh>
            <mesh material={rim}>
              <ringGeometry args={[WINDOW_RADIUS, WINDOW_RADIUS + 9, 48]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
