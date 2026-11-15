import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { DUCT, FLAME_COLOUR, LAYOUT, VIEWS, type ConfigId, type View } from "../content";
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
  /** Flat sample thickness, mm (replay: from the tests table). */
  sampleThickness: number;
  layers: Layers;
  /** Chosen camera preset; the scene flies there and then leaves the camera to the viewer. */
  view: string;
  /** Changes every time a preset is clicked, so clicking the current one flies there again. */
  viewRequest: number;
  /** DOM scale bar: the scene keeps its width in step with the camera distance. */
  scaleBar: RefObject<HTMLDivElement | null>;
  /** false while offscreen: the renderer stops drawing. */
  active: boolean;
  /** prefers-reduced-motion: no idle camera rotation, no flicker, camera moves snap. */
  reducedMotion: boolean;
}

export const SCALE_MM = 20;
const FOV = 34;

// One scene unit = 1 mm. The duct is to the report's dimensions; the flame is schematic.
export function Scene(props: SceneProps) {
  const start = VIEWS[0];
  return (
    <Canvas
      camera={{ position: start.position, fov: FOV, near: 2, far: 5000 }}
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[120, 220, 160]} intensity={2.4} color="#bcd4ff" />
      <directionalLight position={[-160, -60, -120]} intensity={0.8} color="#6a7cff" />
      <directionalLight position={[40, -140, 60]} intensity={0.35} color="#8fa0d0" />
      {/* Procedural environment (nothing to download): highlights on the metal, the glass and the PMMA */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#cfe0ff" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9dff" position={[-6, -2, -3]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#b9c6ff" position={[5, 0, -4]} scale={3} />
        <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, -5, 2]} scale={[6, 1, 1]} />
      </Environment>
      <World {...props} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.2} luminanceSmoothing={0.35} radius={0.75} />
        <Vignette eskil={false} offset={0.22} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}

/** Where the flame sits in each configuration: the "sample" preset looks there. */
function sampleFocus(config: ConfigId): [number, number, number] {
  switch (config) {
    case "rod-concurrent":
      return [LAYOUT.rodConcurrent.tipX - 2, 0, 0];
    case "rod-opposed":
      return [LAYOUT.rodOpposed.endX - 12, 0, 0];
    case "flat":
      return [LAYOUT.flat.halfLength * 0.2, 0, 0];
    case "fabric":
      return [-LAYOUT.fabric.halfLength * 0.3, 0, 0];
  }
}

function World({ sim, config, rodRadius, sampleThickness, layers, view, viewRequest, scaleBar, reducedMotion }: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const idle = useRef(!reducedMotion);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  // a preset: fly there (snap under reduced motion); the viewer's own drag cancels the flight
  useEffect(() => {
    if (viewRequest === 0) return;
    const v: View | undefined = VIEWS.find((x) => x.id === view);
    if (!v) return;
    const target = v.target === "sample" ? sampleFocus(config) : v.target;
    const position = v.target === "sample" ? ([target[0] + v.position[0], v.position[1], v.position[2]] as [number, number, number]) : v.position;
    idle.current = false;
    const c = controls.current;
    if (reducedMotion && c) {
      camera.position.set(...position);
      c.target.set(...target);
      c.update();
      goal.current = null;
      return;
    }
    goal.current = { position: new THREE.Vector3(...position), target: new THREE.Vector3(...target) };
  }, [view, viewRequest, config, camera, reducedMotion]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => {
      goal.current = null;
      idle.current = false;
    };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, []);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const g = goal.current;
    if (g) {
      const k = 1 - Math.exp(-5 * Math.min(dt, 0.1));
      camera.position.lerp(g.position, k);
      c.target.lerp(g.target, k);
      if (camera.position.distanceTo(g.position) < 0.5 && c.target.distanceTo(g.target) < 0.5) goal.current = null;
    }
    c.autoRotate = idle.current;
    c.update();
    if (!scaleBar.current) return;
    // how many pixels SCALE_MM millimetres take at the sample's distance
    const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * Math.tan((FOV / 2) * (Math.PI / 180)));
    scaleBar.current.style.width = `${(SCALE_MM * pxPerMm).toFixed(1)}px`;
    scratch.copy(c.target);
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        target={VIEWS[0].target as [number, number, number]}
        enablePan={false}
        enableDamping
        autoRotate={false}
        autoRotateSpeed={0.35}
        minDistance={40}
        maxDistance={1100}
      />
      <Apparatus sim={sim} />
      {layers.cameras && <Cameras />}
      <Sample sim={sim} config={config} rodRadius={rodRadius} thickness={sampleThickness} />
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
  // blue is the design system's "live" colour; yellow stands for the luminous sooty part (illustrative)
  const material = useMemo(() => createFlameMaterial(FLAME_COLOUR.blue, FLAME_COLOUR.soot), []);
  const geometries = useMemo(() => ({ open: createFlameGeometry(false), closed: createFlameGeometry(true) }), []);
  const lightColour = useMemo(() => ({ blue: new THREE.Color("#9fb0ff"), soot: new THREE.Color("#ffb46a") }), []);
  useEffect(
    () => () => {
      material.dispose();
      geometries.open.dispose();
      geometries.closed.dispose();
    },
    [material, geometries],
  );

  useFrame(({ clock }) => {
    const shape = sim.view().flame;
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
    material.uniforms.uSoot.value = shape.soot;
    if (!reducedMotion) material.uniforms.uTime.value = clock.elapsedTime;
    if (light.current) {
      light.current.intensity = shape.visible ? shape.opacity * (650 + 500 * shape.soot) : 0;
      light.current.color.copy(lightColour.blue).lerp(lightColour.soot, shape.soot);
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
 * move in real time at the scene's scale; in a replay, the air display read from the video); the particles
 * themselves are illustrative: straight paths, no flow around the sample.
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
    if (!sim.active || sim.reducedMotion) return;
    const half = DUCT.length / 2;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const dx = sim.tracerCmS * 10 * Math.min(dt, 0.1);
    if (dx === 0) return;
    for (let i = 0; i < TRACERS; i++) {
      let x = arr[i * 3] + dx;
      if (x > half) x -= 2 * half;
      arr[i * 3] = x;
    }
    attr.needsUpdate = true;
  });

  return <primitive object={points} />;
}
