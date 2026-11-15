import { Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { createFlameMaterial } from "@/shared/three/flameMaterial";
import type { Playback } from "@/shared/three/playback";
import { SAMPLE_LENGTH_MM } from "../lib/burn";
import { stateAt, valueAt, type SaffireModel, type SceneSample } from "../lib/model";
import { CARD, Module, sampleCenter } from "./Apparatus";

interface SceneProps {
  model: SaffireModel;
  playback: Playback;
  active: boolean;
  reducedMotion: boolean;
  labels: boolean;
  scaleBar: RefObject<HTMLDivElement | null>;
  /** close-up of one sample: the camera starts near it and stays on it */
  focusId?: string;
}

const FOV = 32;
const SCALE_MM = 100;

// One scene unit = 1 mm. Y is up = the flow direction (fans at the top draw air upward).
export function Scene(props: SceneProps) {
  const start = useMemo<[number, number, number]>(() => {
    if (!props.focusId) return [420, 260, 1900];
    const [x, y] = sampleCenter(Number(props.focusId.split("-")[1]));
    return [x + 260, y + 90, 760];
  }, [props.focusId]);
  return (
    <Canvas
      camera={{ position: start, fov: FOV, near: 5, far: 12000 }}
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[800, 1500, 1200]} intensity={1.3} color="#bcd4ff" />
      <directionalLight position={[-1200, -400, -900]} intensity={0.45} color="#6a7cff" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#cfe0ff" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9dff" position={[-6, -2, -3]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#b9c6ff" position={[5, 0, -4]} scale={3} />
      </Environment>
      <World {...props} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.35} radius={0.7} />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

function World({ model, playback, reducedMotion, labels, scaleBar, focusId }: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const fixed = focusId ? sampleCenter(Number(focusId.split("-")[1])) : null;
  const focus = useMemo(() => new THREE.Vector3(CARD.x, 0, 0), []);
  const delta = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    // the view drifts toward the sample being recorded, keeping the viewer's angle and distance
    const { moment } = stateAt(model, playback.t);
    const idx = moment.segment ? Number(moment.segment.id.split("-")[1]) : null;
    if (fixed) focus.set(fixed[0], fixed[1], 0);
    else if (idx != null) {
      const [x, y] = sampleCenter(idx);
      focus.set(x * 0.6 + CARD.x * 0.4, y * 0.6, 0);
    } else focus.set(CARD.x, 0, 0);
    delta.copy(focus).sub(c.target).multiplyScalar(0.04);
    c.target.add(delta);
    camera.position.add(delta);
    c.update();
    const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * Math.tan((FOV / 2) * (Math.PI / 180)));
    if (scaleBar.current) scaleBar.current.style.width = `${(SCALE_MM * pxPerMm).toFixed(1)}px`;
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        target={fixed ? [fixed[0], fixed[1], 0] : [CARD.x, 0, 0]}
        enablePan={false}
        enableDamping
        autoRotate={false}
        minDistance={fixed ? 150 : 350}
        maxDistance={5200}
      />
      <Module labels={labels} />
      {model.samples.map((s) => (
        <SampleStrip key={s.id} s={s} model={model} playback={playback} labels={labels} />
      ))}
      <FlowParticles model={model} playback={playback} reducedMotion={reducedMotion} />
    </>
  );
}

// Readme Fig. 1 legend colours (illustrative tones of the same hues)
const MATERIAL_COLOR: [RegExp, string][] = [
  [/nomex/i, "#b9b38f"],
  [/pmma/i, "#a3162c"],
  [/sibal|cotton/i, "#efe7b0"],
];
const colorOf = (s: SceneSample) =>
  s.igniterAtTop ? "#cfe3f2" : (MATERIAL_COLOR.find(([re]) => re.test(s.sample.material))?.[1] ?? "#8ea7c4");

const PMMA_STRIP_MM = 50; // 2-7: 5 cm PMMA at the igniter end, 24 cm Nomex above (table)

function SampleStrip({ s, model, playback, labels }: { s: SceneSample; model: SaffireModel; playback: Playback; labels: boolean }) {
  const [cx, cy] = sampleCenter(s.index);
  const sign = s.igniterAtTop ? -1 : 1; // direction from the igniter end along the strip
  const igniterY = cy - (sign * SAMPLE_LENGTH_MM) / 2;
  const char = useRef<THREE.Mesh>(null);
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const igniter = useRef<THREE.MeshStandardMaterial>(null);
  const frame = useRef<THREE.LineSegments>(null);
  const flameMat = useMemo(() => createFlameMaterial("#2b45e0", "#7f97ff"), []);
  useEffect(() => () => flameMat.dispose(), [flameMat]);
  const composite = /&/.test(s.sample.material);

  useFrame(({ clock }) => {
    const now = stateAt(model, playback.t).samples.find((x) => x.s.id === s.id)!;
    const b = now.burn;
    // charred zone from the igniter end
    if (char.current) {
      char.current.visible = b.burned > 0.5;
      char.current.scale.y = Math.max(0.001, b.burned);
      char.current.position.y = igniterY + (sign * b.burned) / 2;
    }
    if (flame.current && light.current) {
      const len = Math.max(8, b.flameTo - b.flameFrom);
      flame.current.visible = b.flame;
      light.current.visible = b.flame;
      if (b.flame) {
        const mid = igniterY + sign * (b.flameFrom + len / 2);
        flame.current.position.set(cx, mid, 6);
        flame.current.scale.set(34, len / 2 + 10, 14);
        light.current.position.set(cx, mid, 60);
        light.current.intensity = 7e3 * now.brightness;
      }
      flameMat.uniforms.uOpacity.value = b.flame ? 0.45 + 0.55 * now.brightness : 0;
      flameMat.uniforms.uTime.value = clock.elapsedTime + s.index * 3.1;
    }
    if (igniter.current) {
      igniter.current.emissiveIntensity = now.igniterOn ? 6 : 0;
      igniter.current.color.set(now.igniterOn ? "#ff7a3a" : "#5a5a5a");
    }
    if (frame.current) (frame.current.material as THREE.LineBasicMaterial).color.set(now.active ? "#4d6bff" : "#2c313b");
  });

  const outline = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(56, SAMPLE_LENGTH_MM + 6, 4)), []);
  useEffect(() => () => outline.dispose(), [outline]);

  return (
    <group>
      {/* the strip; 2-7 is PMMA at the igniter end and Nomex above */}
      {composite ? (
        <>
          <mesh position={[cx, igniterY + (sign * PMMA_STRIP_MM) / 2, 0]}>
            <boxGeometry args={[50, PMMA_STRIP_MM, 2]} />
            <meshStandardMaterial color="#a3162c" roughness={0.5} />
          </mesh>
          <mesh position={[cx, igniterY + sign * (PMMA_STRIP_MM + (SAMPLE_LENGTH_MM - PMMA_STRIP_MM) / 2), 0]}>
            <boxGeometry args={[50, SAMPLE_LENGTH_MM - PMMA_STRIP_MM, 2]} />
            <meshStandardMaterial color="#b9b38f" roughness={0.9} />
          </mesh>
        </>
      ) : (
        <mesh position={[cx, cy, 0]}>
          <boxGeometry args={[50, SAMPLE_LENGTH_MM, 2]} />
          <meshStandardMaterial color={colorOf(s)} roughness={/pmma/i.test(s.sample.material) ? 0.35 : 0.85} />
        </mesh>
      )}
      <mesh ref={char} position={[cx, igniterY, 1.6]} visible={false}>
        <boxGeometry args={[50.5, 1, 1.2]} />
        <meshStandardMaterial color="#17120e" roughness={1} />
      </mesh>
      <lineSegments ref={frame} geometry={outline} position={[cx, cy, 0]}>
        <lineBasicMaterial color="#2c313b" />
      </lineSegments>
      {/* igniter: a hot-wire coil at the upstream end (Readme Table 1; S4 downstream) */}
      <mesh position={[cx, igniterY - sign * 8, 4]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[5, 1.4, 8, 24]} />
        <meshStandardMaterial ref={igniter} color="#5a5a5a" emissive="#ff5a14" emissiveIntensity={0} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={flame} material={flameMat} visible={false}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
      <pointLight ref={light} color="#9fb0ff" distance={600} decay={2} visible={false} />
      {labels && (
        <Html position={[cx, cy + (SAMPLE_LENGTH_MM / 2 + 26), 0]} center className="sf3d-label" zIndexRange={[10, 0]}>
          {s.id}
        </Html>
      )}
    </group>
  );
}

const N_PARTICLES = 700;

/** Air drawn upward through the duct; speed = anemometer of the sample being recorded (real time). */
function FlowParticles({ model, playback, reducedMotion }: { model: SaffireModel; playback: Playback; reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N_PARTICLES * 3);
    for (let i = 0; i < N_PARTICLES; i++) {
      pos[i * 3] = CARD.x + (Math.random() - 0.5) * (CARD.ductW - 40);
      pos[i * 3 + 1] = (Math.random() - 0.5) * CARD.ductH;
      pos[i * 3 + 2] = (Math.random() - 0.5) * (CARD.ductD - 40);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const material = useMemo(
    () => new THREE.PointsMaterial({ color: "#9aa6c4", size: 3.2, transparent: true, opacity: 0.55, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, dt) => {
    const p = points.current;
    if (!p) return;
    const { moment, samples } = stateAt(model, playback.t);
    const act = samples.find((x) => x.active);
    const cmS = act && act.tIgn != null ? valueAt(act.s.flow, act.tIgn) : null;
    // only while a recording runs: between recordings there is no flow measurement
    p.visible = moment.segment != null && cmS != null;
    if (!p.visible || reducedMotion) return;
    const step = (cmS ?? 0) * 10 * Math.min(dt, 0.05); // mm per frame, real time
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const half = CARD.ductH / 2;
    for (let i = 0; i < N_PARTICLES; i++) {
      let y = pos.getY(i) + step;
      if (y > half) y -= CARD.ductH;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}
