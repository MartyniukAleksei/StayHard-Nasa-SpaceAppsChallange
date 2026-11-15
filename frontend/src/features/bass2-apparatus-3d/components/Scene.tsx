import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { DUCT, LAYOUT, PRE_QUENCH_HZ, type ConfigId } from "../content";
import { A_AT_MINIMUM } from "../lib/boundary";
import { flameShape, type FlameGeometry } from "../lib/flame";
import type { Sim } from "../lib/sim";
import { Apparatus, Cameras } from "./Apparatus";
import { createFlameGeometry, createFlameMaterial } from "./flameMaterial";
import { Sample } from "./Samples";

export interface Layers {
  tracers: boolean;
  cameras: boolean;
}

interface SceneProps {
  sim: Sim;
  config: ConfigId;
  /** Rod radius of the concurrent-flow rod, mm. */
  rodRadius: number;
  layers: Layers;
  /** DOM scale bar: the scene keeps its width in step with the camera distance. */
  scaleBar: RefObject<HTMLDivElement | null>;
  /** false while offscreen: the renderer stops drawing. */
  active: boolean;
  /** prefers-reduced-motion: no idle camera rotation, no flicker. */
  reducedMotion: boolean;
}

export const SCALE_MM = 20;
const FOV = 34;
const TARGET: [number, number, number] = [-14, 0, 0];
const FLAME_GEOMETRY: FlameGeometry = { layout: LAYOUT, preQuenchHz: PRE_QUENCH_HZ, aAtMinimum: A_AT_MINIMUM };

// One scene unit = 1 mm. The duct is to the report's dimensions; the flame is schematic.
export function Scene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [165, 116, 240], fov: FOV, near: 2, far: 5000 }}
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[120, 220, 160]} intensity={2.2} color="#bcd4ff" />
      <directionalLight position={[-160, -60, -120]} intensity={0.9} color="#6a7cff" />
      {/* Procedural environment (nothing to download): highlights on the metal and the PMMA */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#cfe0ff" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9dff" position={[-6, -2, -3]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#b9c6ff" position={[5, 0, -4]} scale={3} />
      </Environment>
      <World {...props} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.35} radius={0.75} />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

function World({ sim, config, rodRadius, layers, scaleBar, reducedMotion }: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);

  useFrame(() => {
    const c = controls.current;
    if (!c || !scaleBar.current) return;
    // how many pixels SCALE_MM millimetres take at the sample's distance
    const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * Math.tan((FOV / 2) * (Math.PI / 180)));
    scaleBar.current.style.width = `${(SCALE_MM * pxPerMm).toFixed(1)}px`;
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.35}
        minDistance={70}
        maxDistance={1100}
      />
      <Apparatus sim={sim} />
      {layers.cameras && <Cameras />}
      <Sample sim={sim} config={config} rodRadius={rodRadius} />
      <Flame sim={sim} reducedMotion={reducedMotion} />
      {layers.tracers && <Tracers sim={sim} />}
    </>
  );
}

/** The flame sheet. Its place follows the chosen configuration; its shape and size are schematic. */
function Flame({ sim, reducedMotion }: { sim: Sim; reducedMotion: boolean }) {
  const open = useRef<THREE.Mesh>(null);
  const closed = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  // colours: the design system's "live" blue, as in the FLEX replay (illustrative)
  const material = useMemo(() => createFlameMaterial("#2b45e0", "#7f97ff"), []);
  const geometries = useMemo(() => ({ open: createFlameGeometry(false), closed: createFlameGeometry(true) }), []);
  useEffect(
    () => () => {
      material.dispose();
      geometries.open.dispose();
      geometries.closed.dispose();
    },
    [material, geometries],
  );

  useFrame(({ clock }) => {
    const shape = flameShape({
      config: sim.config,
      flame: sim.flame,
      a: sim.stretch,
      rodRadiusMm: sim.rodRadiusCm * 10,
      look: sim.look,
      geometry: FLAME_GEOMETRY,
    });
    for (const [mesh, isClosed] of [[open.current, false], [closed.current, true]] as const) {
      if (!mesh) continue;
      mesh.visible = shape.visible && shape.closed === isClosed;
      if (!mesh.visible) continue;
      mesh.position.x = shape.noseX;
      mesh.scale.set(shape.length, shape.height / 2, shape.width / 2);
    }
    material.uniforms.uOpacity.value = shape.opacity;
    material.uniforms.uHole.value = shape.hole;
    material.uniforms.uTail.value = shape.closed ? 0 : 1;
    if (!reducedMotion) material.uniforms.uTime.value = clock.elapsedTime;
    if (light.current) {
      light.current.intensity = shape.visible ? shape.opacity * 650 : 0;
      // above the sample, so the surface right under the flame is not burnt out
      light.current.position.set(shape.noseX + shape.length * 0.4, shape.height / 2 + 6, 0);
    }
  });

  return (
    <>
      <pointLight ref={light} color="#9fb0ff" distance={150} decay={2} intensity={0} />
      <mesh ref={open} geometry={geometries.open} material={material} visible={false} />
      <mesh ref={closed} geometry={geometries.closed} material={material} visible={false} />
    </>
  );
}

const TRACERS = 320;

/**
 * Flow tracers through the test section. Their speed follows the flow setting (1 cm/s = 10 mm/s, so they
 * move in real time at the scene's scale); the particles themselves are illustrative: straight paths,
 * no flow around the sample.
 */
function Tracers({ sim }: { sim: Sim }) {
  const points = useMemo(() => {
    const half = DUCT.length / 2;
    const reach = DUCT.width / 2 - 5;
    const pos = new Float32Array(TRACERS * 3);
    let i = 0;
    // a fixed pseudo-random spread, so the scene looks the same on every load
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    while (i < TRACERS) {
      const y = (rnd() * 2 - 1) * reach;
      const z = (rnd() * 2 - 1) * reach;
      if (Math.abs(y) < 8 && Math.abs(z) < 15) continue; // keep clear of the sample
      pos.set([(rnd() * 2 - 1) * half, y, z], i * 3);
      i++;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({ color: "#aab8e8", size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false });
    return new THREE.Points(geometry, material);
  }, []);
  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    },
    [points],
  );

  useFrame((_, dt) => {
    if (!sim.active) return;
    const half = DUCT.length / 2;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const dx = sim.tracerCmS * 10 * Math.min(dt, 0.1);
    for (let i = 0; i < TRACERS; i++) {
      let x = arr[i * 3] + dx;
      if (x > half) x -= 2 * half;
      arr[i * 3] = x;
    }
    attr.needsUpdate = true;
  });

  return <primitive object={points} />;
}
