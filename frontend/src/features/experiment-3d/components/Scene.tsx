import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { dropletPosition, maxFlameDiameter, type Experiment } from "../lib/experiment";
import type { Playback } from "../lib/playback";
import { presence, sample, type Track } from "../lib/series";
import { Apparatus, Chamber } from "./Apparatus";
import { createFlameMaterial } from "./flameMaterial";

export interface Layers {
  uv: boolean;
  visible: boolean;
}

interface SceneProps {
  experiment: Experiment;
  playback: Playback;
  layers: Layers;
  /** DOM scale bar: the scene keeps its width in step with the camera distance. */
  scaleBar: RefObject<HTMLDivElement | null>;
  /** false while offscreen: the renderer stops drawing. */
  active: boolean;
  /** prefers-reduced-motion: no idle camera rotation. */
  reducedMotion: boolean;
}

const SCALE_MM = 10;
const FOV = 34;

// One scene unit = 1 mm. Every size and position comes from the test data.
export function Scene(props: SceneProps) {
  // start far enough for the largest flame to fill about two thirds of the frame height
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const dist = (maxFlameDiameter(props.experiment) * 1.5) / (2 * Math.tan((FOV / 2) * (Math.PI / 180)));
    return [dist * 0.5, dist * 0.2, dist * 0.84];
  }, [props.experiment]);
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: FOV, near: 0.5, far: 4000 }}
      dpr={[1, 2]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 60, 30]} intensity={1.4} color="#bcd4ff" />
      <directionalLight position={[-50, -20, -40]} intensity={0.5} color="#6a7cff" />
      {/* Procedural environment (nothing to download): gives the droplet its liquid highlights */}
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

function World({ experiment, playback, layers, scaleBar, reducedMotion }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const droplet = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const delta = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = playback.t;
    const [x, y, z] = dropletPosition(experiment, t);
    group.current?.position.set(x, y, z);

    const d = sample(experiment.droplet, "d_mm", t, true) ?? 0;
    droplet.current?.scale.setScalar(d / 2);

    if (light.current) {
      const glow = Math.max(presence(experiment.flameColor, t), presence(experiment.flameUv, t) * 0.6);
      light.current.intensity = glow * 500;
    }

    // the camera follows the droplet and keeps the angle and distance the viewer chose
    const c = controls.current;
    if (c) {
      delta.set(x, y, z).sub(c.target).multiplyScalar(0.06);
      c.target.add(delta);
      camera.position.add(delta);
      c.update();
      // how many pixels SCALE_MM millimetres take at the droplet's distance
      const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * Math.tan((FOV / 2) * (Math.PI / 180)));
      if (scaleBar.current) scaleBar.current.style.width = `${(SCALE_MM * pxPerMm).toFixed(1)}px`;
    }
  });

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.55}
        minDistance={12}
        maxDistance={1400}
      />
      <Chamber experiment={experiment} playback={playback} />
      <Apparatus experiment={experiment} playback={playback} />
      <Trail experiment={experiment} playback={playback} />
      <group ref={group}>
        <pointLight ref={light} color="#9fb0ff" distance={160} decay={2} />
        <mesh ref={droplet}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshPhysicalMaterial
            color="#dcecff"
            roughness={0.04}
            metalness={0}
            transmission={0.9}
            envMapIntensity={1.4}
            thickness={1.6}
            ior={1.39} /* n-heptane ≈ 1.39 */
            clearcoat={1}
            clearcoatRoughness={0.05}
            attenuationColor="#9cc4ff"
            attenuationDistance={6}
          />
        </mesh>
        {layers.visible && (
          <FlameShell track={experiment.flameColor} playback={playback} core="#2b45e0" rim="#7f97ff" seed={0} />
        )}
        {layers.uv && (
          <FlameShell track={experiment.flameUv} playback={playback} core="#5b3fd6" rim="#c2b3ff" seed={7.3} />
        )}
      </group>
    </>
  );
}

interface FlameShellProps {
  track: Track | null;
  playback: Playback;
  core: string;
  rim: string;
  seed: number;
}

function FlameShell({ track, playback, core, rim, seed }: FlameShellProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => createFlameMaterial(core, rim), [core, rim]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = playback.t;
    const d = sample(track, "flame_d_mm", t);
    const alpha = presence(track, t);
    m.visible = d != null && alpha > 0;
    if (d != null) m.scale.setScalar(d / 2);
    material.uniforms.uOpacity.value = alpha;
    material.uniforms.uTime.value = clock.elapsedTime + seed;
  });

  return (
    <mesh ref={mesh} material={material} visible={false}>
      <sphereGeometry args={[1, 96, 96]} />
    </mesh>
  );
}

/** Droplet path from the start of the data up to the current moment. */
function Trail({ experiment, playback }: { experiment: Experiment; playback: Playback }) {
  const { line, times } = useMemo(() => {
    const times = experiment.droplet.t;
    const pts = new Float32Array(times.length * 3);
    times.forEach((t, i) => pts.set(dropletPosition(experiment, t), i * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const material = new THREE.LineBasicMaterial({ color: "#f1f0ea", transparent: true, opacity: 0.5 });
    return { line: new THREE.Line(geometry, material), times };
  }, [experiment]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    let n = 0;
    while (n < times.length && times[n] <= playback.t) n++;
    line.geometry.setDrawRange(0, n);
  });

  return <primitive object={line} />;
}
