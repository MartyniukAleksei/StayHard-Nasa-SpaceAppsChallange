import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { detectorFraction, hazeFraction, massFraction, type Experiment } from "../lib/experiment.ts";
import type { Playback } from "../lib/playback";
import { sample } from "../lib/series.ts";

export interface Layers {
  haze: boolean;
  detectors: boolean;
  apparatus: boolean;
}

interface SceneProps {
  experiment: Experiment;
  playback: Playback;
  layers: Layers;
  /** DOM scale bar: the scene keeps its width in step with the camera distance. */
  scaleBar: RefObject<HTMLDivElement | null>;
  /** false while offscreen: the renderer stops drawing. */
  active: boolean;
  /** prefers-reduced-motion: no idle camera rotation and no haze drift. */
  reducedMotion: boolean;
}

export const SCALE_MM = 50;
const FOV = 34;

// One scene unit = 1 mm. Smoke moves along +X in the order the documents give (SAME Baseline Concept
// Description, SAME-DOC-001 Rev A, section 4.1, pp. 5–7): sample in the smoke generation tube → aging
// chamber (with a piston that later pushes the smoke out) → dynamic diagnostics assembly, a low-volume
// duct that holds the ISS and STS smoke detectors and the sampling ports for the P-Trak and for the
// enclosure with the DustTrak and an ionization detector. Only the chamber is drawn to scale.
//
// SAME aging chamber, drawing 60089MFHA151 rev B ("Drawing_SAME Aging Chamber.PDF", sheet 1, inches).
const CHAMBER_R = 101.3; // mm, bore Ø7.977 in
const CHAMBER_L = 211; // mm, 8.31 in: our reading of the inside length in section A-A (overall 9.15 in)
const FLANGE_R = 121.9; // mm, flange Ø9.60 in
const FLANGE_T = 4.8; // mm, flange thickness 0.19 in
// Sample: 0.250 in outer diameter (title of drawing 60089MFHA415, "Ignitor Wire Coil Assembly (for 0.250 OD samples)").
const SAMPLE_R = 3.175; // mm
const SAMPLE_L = 20; // mm, schematic
const TUBE_R = 12; // mm, schematic: smoke generation tube (drawing 60089MFHD126-B not read)
const TUBE_L = 90; // mm, schematic
// Everything below is schematic: sizes and positions of the duct, detectors and instruments have no source.
const DUCT_R = 16;
const DUCT_L = 290;
const INLINE: [number, number, number] = [34, 46, 46]; // detector housings the duct passes through
const INLINE_X = { iss: 45, sts: 105 }; // mm along the duct
const BRANCH: [number, number, number] = [30, 34, 34]; // instruments on sampling lines
const BRANCH_X = { ptrak: 160, dusttrak: 198, ion_a_v: 236, ion_b_v: 274 };
const BRANCH_DROP = 75; // mm below the duct axis
const HAZE_POINTS = 2500; // illustrative: how many points stand for the P-Trak limit

const CHAMBER_X = -120; // chamber centre; the whole train is shifted so the scene centre is near its middle
const DUCT_X0 = CHAMBER_X + CHAMBER_L / 2;
const METAL = { color: "#6b7280", metalness: 0.85, roughness: 0.5, envMapIntensity: 0.25 } as const;

export function Scene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [-90, 230, 880], fov: FOV, near: 1, far: 8000 }}
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 60, 30]} intensity={1.4} color="#bcd4ff" />
      <directionalLight position={[-50, -20, -40]} intensity={0.5} color="#6a7cff" />
      {/* Procedural environment: nothing to download */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#cfe0ff" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9dff" position={[-6, -2, -3]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#b9c6ff" position={[5, 0, -4]} scale={3} />
      </Environment>
      <World {...props} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.35} radius={0.75} />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

function World({ experiment: e, playback, layers, scaleBar, reducedMotion }: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);

  useFrame(() => {
    const c = controls.current;
    if (!c || !scaleBar.current) return;
    // how many pixels SCALE_MM millimetres take at the centre of the scene
    const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * Math.tan((FOV / 2) * (Math.PI / 180)));
    scaleBar.current.style.width = `${(SCALE_MM * pxPerMm).toFixed(1)}px`;
  });

  const at = (col: string) => (t: number) => sample(e.hkp, col, t);
  const detector = (col: string) => e.detectors.find((d) => d.col === col);
  const level = (col: string) => {
    const d = detector(col);
    return d ? (t: number) => detectorFraction(d, at(col)(t)) : null;
  };
  const scatter = level("iss_scatter_v");
  const obscuration = level("iss_obscuration_v");
  const sts = level("sts_v");
  const DETECTOR = "#a99bf0";

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.25}
        minDistance={220}
        maxDistance={2200}
      />
      <group position={[45, 20, 0]}>
        {layers.apparatus && (
          <>
            <Chamber />
            <Heater experiment={e} playback={playback} />
            <Duct />
            <Label text="SAMPLE + HEATER" position={[CHAMBER_X - CHAMBER_L / 2 - TUBE_L / 2, TUBE_R + 16, 0]} />
            <Label text="AGING CHAMBER" position={[CHAMBER_X, FLANGE_R + 16, 0]} />
            <Arrow x={CHAMBER_X - CHAMBER_L / 2 - TUBE_L - 18} />
            <Arrow x={DUCT_X0 + DUCT_L + 14} />
            <Instrument x={BRANCH_X.ptrak} label="P-TRAK" color="#7f97ff" playback={playback} level={(t) => hazeFraction(at("ptrak_per_cc")(t))} />
            {e.hasMass && (
              <Instrument x={BRANCH_X.dusttrak} label="DUSTTRAK" color="#f1f0ea" playback={playback} level={(t) => massFraction(at("dusttrak_b_mg_m3")(t))} />
            )}
          </>
        )}
        {layers.haze && <Haze experiment={e} playback={playback} drift={!reducedMotion} />}
        {layers.detectors && (
          <>
            {(scatter || obscuration) && (
              <Instrument inline x={INLINE_X.iss} label="ISS" color={DETECTOR} playback={playback} level={(t) => Math.max(scatter?.(t) ?? 0, obscuration?.(t) ?? 0)} />
            )}
            {sts && <Instrument inline x={INLINE_X.sts} label="STS" color={DETECTOR} playback={playback} level={sts} />}
            {(["ion_a_v", "ion_b_v"] as const).map((col) => {
              const l = level(col);
              return l && <Instrument key={col} x={BRANCH_X[col]} label={col === "ion_a_v" ? "ION A" : "ION B"} color={DETECTOR} playback={playback} level={l} />;
            })}
          </>
        )}
      </group>
    </>
  );
}

/** Aging chamber, to scale. Opaque on purpose: nothing measures the smoke inside it. */
function Chamber() {
  return (
    <group position={[CHAMBER_X, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[CHAMBER_R, CHAMBER_R, CHAMBER_L, 96]} />
        <meshStandardMaterial color="#232a3a" roughness={0.55} metalness={0.4} />
      </mesh>
      {/* flange on the inlet end: which end it is on in the assembly was not read from a drawing */}
      <mesh position={[0, CHAMBER_L / 2, 0]}>
        <cylinderGeometry args={[FLANGE_R, FLANGE_R, FLANGE_T, 96]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** Diagnostics duct. Schematic. The sampling lines belong to the instruments, so an absent one leaves no stub. */
function Duct() {
  return (
    <mesh position={[DUCT_X0 + DUCT_L / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[DUCT_R, DUCT_R, DUCT_L, 48, 1, true]} />
      <meshStandardMaterial {...METAL} color="#dfe6f2" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Flow direction marker. The order of the parts is documented; the arrow itself is schematic. */
function Arrow({ x }: { x: number }) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <coneGeometry args={[5, 14, 16]} />
      <meshBasicMaterial color="#8d8d88" />
    </mesh>
  );
}

function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8d8d88";
    ctx.font = "34px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 34);
    return new THREE.CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <sprite position={position} scale={[112, 14, 1]}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}

interface InstrumentProps {
  /** mm along the duct from the chamber outlet */
  x: number;
  label: string;
  color: string;
  playback: Playback;
  /** 0..1 at time t; drives only the brightness of the face */
  level: (t: number) => number;
  /** the duct passes through the housing (ISS and STS detectors); otherwise it hangs on a sampling line */
  inline?: boolean;
}

/** Schematic housing of a detector or instrument; its face brightens with the reading. */
function Instrument({ x, label, color, playback, level, inline }: InstrumentProps) {
  const face = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (face.current) face.current.emissiveIntensity = level(playback.t) * 1.2;
  });
  const size = inline ? INLINE : BRANCH;
  const y = inline ? 0 : -BRANCH_DROP;
  return (
    <group position={[DUCT_X0 + x, y, 0]}>
      {!inline && (
        // sampling line from the duct down to this instrument
        <mesh position={[0, BRANCH_DROP / 2, 0]}>
          <cylinderGeometry args={[2, 2, BRANCH_DROP - DUCT_R, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      )}
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial {...METAL} color="#dfe6f2" />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.2]}>
        <planeGeometry args={[size[0] * 0.7, size[1] * 0.7]} />
        <meshStandardMaterial ref={face} color="#1a1a22" emissive={color} emissiveIntensity={0} />
      </mesh>
      {/* neighbouring labels sit on two rows so they do not overlap */}
      <Label text={label} position={[0, inline ? size[1] / 2 + 12 : -size[1] / 2 - (Math.round(x / 38) % 2 ? 26 : 12), 0]} />
    </group>
  );
}

/** Sample with its heater coil inside the smoke tube. Glows only while `heating` is 1. */
function Heater({ experiment, playback }: { experiment: Experiment; playback: Playback }) {
  const coil = useRef<THREE.MeshStandardMaterial>(null);
  const tube = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const x = CHAMBER_X - CHAMBER_L / 2 - TUBE_L / 2;

  useFrame(() => {
    const t = playback.t;
    const on = (sample(experiment.hkp, "heating", t) ?? 0) >= 0.5;
    const ohm = sample(experiment.hkp, "sample_ohm", t) ?? 0;
    // illustrative mapping: brightness follows the sample resistance relative to the test's maximum
    const glow = on ? 0.4 + 0.6 * (ohm / experiment.ohmMax) : 0;
    if (coil.current) coil.current.emissiveIntensity = glow * 4;
    // the tube tint follows the measured plume temperature between the test's lowest and highest value
    const plume = sample(experiment.hkp, "plume_c", t);
    const warm = plume == null ? 0 : (plume - experiment.plumeMin) / (experiment.plumeMax - experiment.plumeMin || 1);
    if (tube.current) tube.current.emissiveIntensity = warm * 0.5;
    if (light.current) light.current.intensity = glow * 4000 + warm * 1500;
  });

  return (
    <group position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_L, 48, 1, true]} />
        <meshStandardMaterial
          ref={tube}
          color="#dfe6f2"
          metalness={0.85}
          roughness={0.3}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          emissive="#ff5a14"
          emissiveIntensity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[SAMPLE_R, SAMPLE_R, SAMPLE_L, 32]} />
        <meshStandardMaterial color="#f1ede4" roughness={0.7} />
      </mesh>
      {[-2, -1, 0, 1, 2].map((k) => (
        <mesh key={k} position={[0, k * 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[SAMPLE_R + 0.9, 0.4, 12, 48]} />
          {k === 0 ? (
            <meshStandardMaterial ref={coil} color="#3a3a3a" emissive="#ff5a14" emissiveIntensity={0} />
          ) : (
            <CoilMaterial source={coil} />
          )}
        </mesh>
      ))}
      <pointLight ref={light} color="#ff8a4a" distance={260} decay={2} intensity={0} />
    </group>
  );
}

/** The other coil turns copy the glow of the first one. */
function CoilMaterial({ source }: { source: RefObject<THREE.MeshStandardMaterial | null> }) {
  const self = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (self.current && source.current) self.current.emissiveIntensity = source.current.emissiveIntensity;
  });
  return <meshStandardMaterial ref={self} color="#3a3a3a" emissive="#ff5a14" emissiveIntensity={0} />;
}

/**
 * Haze in the diagnostics duct: the number of points follows the P-Trak count, because the duct is where
 * the instruments sample the smoke. Positions are random and illustrative; no smoke shape or motion was measured.
 */
function Haze({ experiment, playback, drift }: { experiment: Experiment; playback: Playback; drift: boolean }) {
  const points = useMemo(() => {
    const pos = new Float32Array(HAZE_POINTS * 3);
    for (let i = 0; i < HAZE_POINTS; i++) {
      const r = DUCT_R * 0.9 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      pos.set([DUCT_X0 + Math.random() * DUCT_L, r * Math.cos(a), r * Math.sin(a)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({
      color: "#7f97ff",
      size: 1.4,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(geometry, material);
    p.frustumCulled = false;
    return p;
  }, []);
  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    },
    [points],
  );

  useFrame((_, dt) => {
    // null outside the series: no points
    const perCc = sample(experiment.hkp, "ptrak_per_cc", playback.t);
    points.geometry.setDrawRange(0, Math.round(HAZE_POINTS * hazeFraction(perCc)));
    if (drift && playback.playing) points.rotation.x += dt * 0.05; // illustrative
  });

  return <primitive object={points} />;
}
