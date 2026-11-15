import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { DUCT, LAYOUT, type ConfigId } from "../content";
import { frontX } from "../lib/flame";
import type { Sim } from "../lib/sim";

const TOP = DUCT.height / 2 - 3.3; // underside of the mounting rail
const HOLDER = "#8f97a6"; // stainless steel sample holders (p.94)
const BLACK_HOLDER = "#16181d"; // the rod holder is black in Fig. 6.1

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

function Post({ x, z = 0, from = 0, color }: { x: number; z?: number; from?: number; color: string }) {
  return (
    <mesh position={[x, (TOP + from) / 2, z]}>
      <boxGeometry args={[2.4, TOP - from, 2.4]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.45} />
    </mesh>
  );
}

/** PMMA rod on the flow axis with a hemispherical tip (p.67). Length and holder position are schematic. */
function Rod({ x0, x1, radius, tip, clear }: { x0: number; x1: number; radius: number; tip: "upstream" | "downstream"; clear: boolean }) {
  const length = x1 - x0 - radius;
  const tipX = tip === "upstream" ? x0 + radius : x1 - radius;
  const bodyX = tip === "upstream" ? tipX + length / 2 : tipX - length / 2;
  const holderX = tip === "upstream" ? x1 : x0;
  const material = clear ? (
    // clear cast PMMA; refractive index 1.49
    <meshPhysicalMaterial color="#e6f0ff" roughness={0.08} transmission={0.85} thickness={4} ior={1.49} clearcoat={1} clearcoatRoughness={0.1} />
  ) : (
    // black cast PMMA rods of the opposed-flow tests (p.48)
    <meshPhysicalMaterial color="#0d0e12" roughness={0.25} clearcoat={1} clearcoatRoughness={0.15} />
  );
  return (
    <group>
      <mesh position={[bodyX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, length, 48, 1, true]} />
        {material}
      </mesh>
      <mesh position={[tipX, 0, 0]} rotation={[0, 0, tip === "upstream" ? Math.PI / 2 : -Math.PI / 2]}>
        <sphereGeometry args={[radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {material}
      </mesh>
      {/* holder at the far end from the flame: an L-shaped arm up to the rail, as in Fig. 6.1 */}
      <mesh position={[holderX + (tip === "upstream" ? 3 : -3), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.1, 1.1, 8, 16]} />
        <meshStandardMaterial color={BLACK_HOLDER} metalness={0.6} roughness={0.5} />
      </mesh>
      <Post x={holderX + (tip === "upstream" ? 6 : -6)} color={BLACK_HOLDER} />
    </group>
  );
}

/**
 * Flat sample lying in the horizontal plane (the top camera looks down on the fuel surface, p.94), held in a
 * U-shaped holder whose open end is where the igniter sits (Fig. 7.1b). Holder profile is schematic.
 */
function FlatSample({ sim, kind }: { sim: Sim; kind: "flat" | "fabric" }) {
  const dims = kind === "flat" ? LAYOUT.flat : LAYOUT.fabric;
  const half = dims.halfLength;
  const fuel = useRef<THREE.Mesh>(null);
  const burnt = useRef<THREE.Mesh>(null);
  // the closed end of the U is the end the flame travels toward
  const closedEnd = kind === "flat" ? -1 : 1;
  const railZ = dims.width / 2 + 1.6;

  useFrame(() => {
    const flame = sim.flame;
    const lit = flame.phase !== "igniting" && flame.progress > 0;
    const front = frontX(kind, flame.progress, LAYOUT);
    if (kind === "flat" && fuel.current) {
      // schematic: the film is consumed behind the flame's leading edge
      const end = lit ? Math.min(half, front + 5) : half;
      fuel.current.scale.x = Math.max(0.001, (end + half) / (2 * half));
      fuel.current.position.x = (end - half) / 2;
    }
    if (kind === "fabric" && burnt.current) {
      // the fiberglass mesh keeps the sample's shape after the cotton burns (p.94): shown darker, schematic
      const end = lit ? Math.max(-half, front - 2) : -half;
      burnt.current.visible = end > -half + 0.5;
      burnt.current.scale.x = Math.max(0.001, (end + half) / (2 * half));
      burnt.current.position.x = (end - half) / 2;
    }
  });

  return (
    <group>
      <mesh ref={fuel}>
        <boxGeometry args={[2 * half, dims.thickness, dims.width]} />
        {kind === "flat" ? (
          <meshPhysicalMaterial color="#e6f0ff" roughness={0.1} transmission={0.7} thickness={1} ior={1.49} clearcoat={1} />
        ) : (
          <meshStandardMaterial color="#8f8a78" roughness={0.95} metalness={0} />
        )}
      </mesh>
      {kind === "fabric" && (
        <mesh ref={burnt} visible={false} position={[0, 0.06, 0]}>
          <boxGeometry args={[2 * half, dims.thickness + 0.12, dims.width + 0.1]} />
          <meshStandardMaterial color="#2b2a28" roughness={1} />
        </mesh>
      )}
      {[-railZ, railZ].map((z) => (
        <mesh key={z} position={[closedEnd * 2, 0, z]}>
          <boxGeometry args={[2 * half + 6, 2, 2.6]} />
          <meshStandardMaterial color={HOLDER} metalness={0.85} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[closedEnd * (half + 3.6), 0, 0]}>
        <boxGeometry args={[2.6, 2, 2 * railZ + 2.6]} />
        <meshStandardMaterial color={HOLDER} metalness={0.85} roughness={0.35} />
      </mesh>
      <Post x={closedEnd * (half - 12)} z={-railZ} from={1} color={HOLDER} />
    </group>
  );
}

/** Where the igniter wire meets the sample, and which way it parks. */
function ignitionPoint(config: ConfigId, rodRadius: number): { x: number; across: number } {
  switch (config) {
    case "rod-concurrent":
      return { x: LAYOUT.rodConcurrent.tipX - 1, across: rodRadius };
    case "rod-opposed":
      return { x: LAYOUT.rodOpposed.endX + 1, across: LAYOUT.rodOpposed.radiusMm };
    case "flat":
      return { x: LAYOUT.flat.halfLength + 1, across: LAYOUT.flat.width / 2 };
    case "fabric":
      return { x: -LAYOUT.fabric.halfLength - 1, across: LAYOUT.fabric.width / 2 };
  }
}

/**
 * Kanthal A-1 29-gauge hot wire (p.5), brought within about 1 mm of the sample by a lever (Ops procedure,
 * step 3.4). Wire shape, travel and timing are schematic; it glows only while the flame is being lit.
 */
function Igniter({ sim, config, rodRadius }: { sim: Sim; config: ConfigId; rodRadius: number }) {
  const group = useRef<THREE.Group>(null);
  const deployed = useRef(0);
  const { x, across } = ignitionPoint(config, rodRadius);
  const flat = config === "flat" || config === "fabric";

  const { geometry, material } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    if (flat) {
      // zigzag across the sample edge, as in Fig. 7.1(b)
      const n = 9;
      for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(i % 2 ? 1.1 : -1.1, 0, -across + (i / n) * 2 * across));
    } else {
      // a hook round the rod end
      for (let i = 0; i <= 16; i++) {
        const th = -Math.PI * 0.75 + (i / 16) * Math.PI * 1.5;
        pts.push(new THREE.Vector3(0, Math.sin(th) * (across + 0.8), Math.cos(th) * (across + 0.8)));
      }
    }
    const last = pts[pts.length - 1];
    pts.push(new THREE.Vector3(last.x, last.y, last.z + 4), new THREE.Vector3(last.x, last.y - 2, across + 22));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
    return {
      // 29 gauge is 0.29 mm across: drawn thicker to stay visible (schematic)
      geometry: new THREE.TubeGeometry(curve, 120, 0.32, 8),
      material: new THREE.MeshStandardMaterial({ color: "#8a8f99", metalness: 0.8, roughness: 0.4, emissive: "#ff5a14", emissiveIntensity: 0 }),
    };
  }, [flat, across]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, dt) => {
    const on = sim.flame.phase === "igniting";
    deployed.current += ((on ? 1 : 0) - deployed.current) * Math.min(1, dt * 7);
    const k = smooth(deployed.current);
    if (group.current) group.current.position.set(x, -(1 - k) * 4, (1 - k) * 16);
    material.emissiveIntensity = on ? 2.6 * smooth(sim.flame.t / 0.35) : 0;
  });

  return <group ref={group}><mesh geometry={geometry} material={material} /></group>;
}

export function Sample({ sim, config, rodRadius }: { sim: Sim; config: ConfigId; rodRadius: number }) {
  return (
    <group>
      {config === "rod-concurrent" && (
        <Rod x0={LAYOUT.rodConcurrent.tipX} x1={LAYOUT.rodConcurrent.endX} radius={rodRadius} tip="upstream" clear />
      )}
      {config === "rod-opposed" && (
        <Rod x0={LAYOUT.rodOpposed.startX} x1={LAYOUT.rodOpposed.endX} radius={LAYOUT.rodOpposed.radiusMm} tip="downstream" clear={false} />
      )}
      {(config === "flat" || config === "fabric") && <FlatSample key={config} sim={sim} kind={config} />}
      <Igniter key={`${config}-${rodRadius}`} sim={sim} config={config} rodRadius={rodRadius} />
    </group>
  );
}
