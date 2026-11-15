import { useFrame } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { dropletPosition, type Experiment } from "../lib/experiment";
import type { Playback } from "../lib/playback";
import { presence, sample } from "../lib/series";

// MDCA hardware around the droplet. The TIMING of every motion comes from the test log
// (experiment.events). The SHAPES are schematic, after the FLEX documents and real colour-camera frames:
//  - two opposed needles of 0.010" (0.254 mm) tubing: FLEX Engineering Requirements Document, p. 15;
//  - two igniters, one hot-wire loop each: MDCA/FLEX2 Reflight Safety Data Package, p. 22;
//  - an 80 µm silicon-carbide support fiber (fiber tests only): 2G11-070HE-0310, p. 4.
const NEEDLE_RADIUS = 0.127;
const NEEDLE_PARK = 30; // mm: where a retracted needle rests (schematic)
const NEEDLE_TRAVEL_S = 0.3; // the log does not record how long the needles take to retract
const IGNITER_PARK = 46;
// The igniter loop sits 1–5 initial droplet diameters from the droplet surface
// (FLEX Engineering Requirements Document, 4.1.29); about one in the colour-camera frames.
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

interface ApparatusProps extends Props {
  /** The first needle and the first igniter register here: tour labels attach to them. */
  anchors?: RefObject<Partial<Record<"needles" | "igniters", THREE.Object3D | null>>>;
  /** Objects the current tour step outlines. */
  focus?: ReadonlySet<string>;
}

export function Apparatus({ experiment, playback, anchors, focus }: ApparatusProps) {
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

  // A droplet on a fiber can only slide along it, so the fiber direction is taken from the droplet's
  // displacement over the test (an estimate). If the droplet barely moved: along Z.
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

    // needles: touch the droplet until "AS Needles Retract", then move away
    const needleOut = events.needlesRetract == null ? 1 : smooth((t - events.needlesRetract) / NEEDLE_TRAVEL_S);
    needles.current.forEach((g, i) => {
      if (g) g.position.y = (i === 0 ? -1 : 1) * (r + needleOut * NEEDLE_PARK);
    });

    // igniters: next to the droplet, glow between "Igniter On" and "Igniter Off", gone by "Retract Completed"
    const retractEnd = events.igniterRetracted ?? 0.4;
    const igniterOut = smooth(t / (retractEnd || 0.4));
    const heat = events.igniterOn != null && t >= events.igniterOn && t < 0 ? smooth((t - events.igniterOn) / 0.25) : 0;
    igniters.current.forEach((g, i) => {
      if (!g) return;
      const dist = r + IGNITER_GAP_D0 * d0 + igniterOut * IGNITER_PARK;
      g.position.set(IGNITER_DIRS[i][0] * dist, IGNITER_DIRS[i][1] * dist, 0);
    });
    // after power-off the wire cools in about a quarter of a second (looks, not a measurement)
    wire.emissiveIntensity = heat > 0 ? 9 * heat : 9 * Math.max(0, 1 - t / 0.25) * (t >= 0 ? 1 : 0);
  });

  return (
    <group position={experiment.deploySite}>
      <Select enabled={focus?.has("needles") ?? false}>
      {[-1, 1].map((s, i) => (
        <group
          key={s}
          ref={(g) => {
            needles.current[i] = g;
            if (i === 0 && anchors) anchors.current.needles = g;
          }}
        >
          {/* vertical run from the tip, then a horizontal run to the drive */}
          <mesh material={steel} position={[0, s * 5, 0]}>
            <cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, 10, 12]} />
          </mesh>
          <mesh material={steel} position={[s * 45, s * 10, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[NEEDLE_RADIUS, NEEDLE_RADIUS, 90, 12]} />
          </mesh>
          {/* flared tip */}
          <mesh material={steel} position={[0, s * 0.25, 0]} rotation={[s < 0 ? Math.PI : 0, 0, 0]}>
            <coneGeometry args={[0.32, 0.5, 16, 1, true]} />
          </mesh>
        </group>
      ))}
      </Select>

      <Select enabled={focus?.has("igniters") ?? false}>
      {IGNITER_DIRS.map(([dx, dy], i) => (
        <group
          key={i}
          ref={(g) => {
            igniters.current[i] = g;
            if (i === 0 && anchors) anchors.current.igniters = g;
          }}
        >
          {/* local +Y points away from the droplet */}
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
      </Select>

      {experiment.test.fiber && (
        <mesh quaternion={fiberQuaternion}>
          {/* 80 µm to scale is under a pixel, so it is drawn twice as thick to stay visible */}
          <cylinderGeometry args={[0.08, 0.08, 240, 8]} />
          <meshStandardMaterial color="#cfd8ea" emissive="#55617a" metalness={0.4} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

// The CIR combustion chamber at true scale: "a cylindrical pressure vessel with domed end caps…
// a volume of 100 liters and an internal diameter of 0.40 m and a length of 0.78 m… eight replaceable
// windows": NASA/TM—2005-213973, "The Fluids and Combustion Facility: Enabling the Exploration of Space".
// Schematic: dome depth, window size and placement, ribs; the droplet is put at the centre, on the axis.
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
        side: THREE.BackSide, // visible from inside only: from outside the chamber reads as a cutaway
        emissive: "#7088ff",
        emissiveIntensity: 0,
      }),
    [],
  );
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0b1322", metalness: 0.2, roughness: 0.08, emissive: "#2a4a80", emissiveIntensity: 0.12 }),
    [],
  );
  const rim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a94a8", metalness: 0.85, roughness: 0.35 }), []);
  const ribs = useMemo(() => {
    const body = CHAMBER_LENGTH - 2 * DOME_DEPTH;
    const geometry = new THREE.EdgesGeometry(new THREE.CylinderGeometry(CHAMBER_RADIUS - 0.5, CHAMBER_RADIUS - 0.5, body, 48, 6, true), 1);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#7f93c8", transparent: true, opacity: 0.1 }));
  }, []);

  // the flame lights the walls (looks, not a measurement)
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
