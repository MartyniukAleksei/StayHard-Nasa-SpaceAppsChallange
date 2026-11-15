import { Environment, Html, Lightformer, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Outline, Select, Selection, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { dropletPosition, maxFlameDiameter, type Experiment } from "../lib/experiment";
import type { Playback } from "../lib/playback";
import { presence, sample, type Track } from "../lib/series";
import { easeInOutCubic, type TourCamera, type TourObject, type TourRunner, type TourStep } from "../lib/tour";
import { Apparatus, Chamber } from "./Apparatus";
import { createFlameMaterial } from "./flameMaterial";

export interface Layers {
  uv: boolean;
  visible: boolean;
}

/** Scene objects a tour label can attach to and whose position is not the droplet's. */
export type Anchors = Partial<Record<"needles" | "igniters", THREE.Object3D | null>>;

interface SceneProps {
  experiment: Experiment;
  playback: Playback;
  layers: Layers;
  /** DOM scale bar: the scene keeps its width in step with the camera distance. */
  scaleBar: RefObject<HTMLDivElement | null>;
  /** false while offscreen: the renderer stops drawing. */
  active: boolean;
  /** prefers-reduced-motion: no idle camera rotation, no camera flights. */
  reducedMotion: boolean;
  /** Guided tour from the assistant: moves the camera, outlines objects, shows labels. */
  tour?: TourRunner | null;
  /** Called once, after the first frame is drawn. */
  onReady?: () => void;
}

const SCALE_MM = 10;
const FOV = 34;
const HALF_TAN = Math.tan((FOV / 2) * (Math.PI / 180));
/** Camera distance at which `sizeMm` takes `share` of the frame height. */
const fit = (sizeMm: number, share: number) => sizeMm / share / (2 * HALF_TAN);
const MIN_DISTANCE = 12;
const FLIGHT_S: [number, number] = [1.2, 1.8];

const cssColor = (name: string, fallback: string) =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

const noSubscribe = () => () => {};
const zero = () => 0;
/** Re-renders on every tour transition (step, phase, pause), not on every frame. */
function useTour(tour: TourRunner | null | undefined): TourRunner | null {
  useSyncExternalStore(tour?.subscribe ?? noSubscribe, tour?.getVersion ?? zero);
  return tour ?? null;
}

// One scene unit = 1 mm. Every size and position comes from the test data.
export function Scene(props: SceneProps) {
  // start far enough for the largest flame to fill about two thirds of the frame height
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const dist = fit(maxFlameDiameter(props.experiment), 2 / 3);
    return [dist * 0.5, dist * 0.2, dist * 0.84];
  }, [props.experiment]);
  // a slow device gets a lower pixel ratio instead of a jerky camera flight
  const [maxDpr, setMaxDpr] = useState(2);
  const outline = useMemo(() => cssColor("--flame", "#4d6bff"), []);
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: FOV, near: 0.5, far: 4000 }}
      dpr={[1, maxDpr]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050505"]} />
      <PerformanceMonitor bounds={() => [50, 90]} onDecline={() => setMaxDpr((d) => Math.max(1, d - 0.5))} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 60, 30]} intensity={1.4} color="#bcd4ff" />
      <directionalLight position={[-50, -20, -40]} intensity={0.5} color="#6a7cff" />
      {/* Procedural environment (nothing to download): gives the droplet its liquid highlights */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#cfe0ff" position={[0, 6, 4]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#7f9dff" position={[-6, -2, -3]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#b9c6ff" position={[5, 0, -4]} scale={3} />
      </Environment>
      <Selection>
        <World {...props} />
        <EffectComposer multisampling={0} autoClear={false}>
          <Outline visibleEdgeColor={outline} hiddenEdgeColor={outline} edgeStrength={3} width={1400} />
          <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.35} radius={0.75} />
          <Vignette eskil={false} offset={0.22} darkness={0.85} />
        </EffectComposer>
      </Selection>
    </Canvas>
  );
}

/** Where the camera sits relative to the droplet for a tour view: a direction and a distance. */
function viewOffset(kind: TourCamera, experiment: Experiment, t: number, out: THREE.Vector3): THREE.Vector3 {
  const flameNow = Math.max(sample(experiment.flameUv, "flame_d_mm", t) ?? 0, sample(experiment.flameColor, "flame_d_mm", t) ?? 0);
  const flame = flameNow > 1 ? flameNow : maxFlameDiameter(experiment);
  const droplet = sample(experiment.droplet, "d_mm", t, true) ?? 3;
  switch (kind) {
    case "flame": // the flame takes about two thirds of the frame
      return out.set(0.3, 0.28, 0.91).normalize().multiplyScalar(Math.max(MIN_DISTANCE, fit(flame, 2 / 3)));
    case "droplet": // the droplet takes about a third of the frame
      return out.set(-0.45, 0.2, 0.87).normalize().multiplyScalar(Math.max(MIN_DISTANCE, fit(droplet, 1 / 3)));
    case "camera_view": // straight along the scene's Z axis, as an onboard camera looks (an estimate)
      return out.set(0, 0, 1).multiplyScalar(Math.max(MIN_DISTANCE, fit(flame, 0.6)));
    default: // overview: the whole flame with the hardware around it
      return out.set(0.5, 0.2, 0.84).normalize().multiplyScalar(fit(maxFlameDiameter(experiment), 0.45));
  }
}

interface Flight {
  fromDir: THREE.Vector3;
  fromDist: number;
  toDir: THREE.Vector3;
  toDist: number;
  duration: number;
  elapsed: number;
}

function World({ experiment, playback, layers, scaleBar, reducedMotion, tour: tourProp, onReady }: SceneProps) {
  const tour = useTour(tourProp);
  const group = useRef<THREE.Group>(null);
  const droplet = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const anchors = useRef<Anchors>({});
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const delta = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), turn: new THREE.Quaternion() }), []);
  const flight = useRef<Flight | null>(null);
  const seenFlight = useRef(0);
  const ready = useRef(false);

  const focus = useMemo(() => new Set<TourObject>(tour && tour.phase !== "waiting" ? tour.step.focus : []), [tour, tour?.index, tour?.phase]);

  useFrame((_, dt) => {
    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }
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

      // a new tour step: fly from wherever the camera is now to the step's view. Only the offset
      // from the droplet is animated, so the flight and the follow above do not fight.
      if (tour && tour.flight !== seenFlight.current) {
        seenFlight.current = tour.flight;
        const from = scratch.v.copy(camera.position).sub(c.target);
        const fromDist = from.length();
        const fromDir = from.clone().normalize();
        const to = viewOffset(tour.step.camera, experiment, tour.step.t, new THREE.Vector3());
        const toDist = to.length();
        const duration = reducedMotion ? 0 : Math.min(FLIGHT_S[1], Math.max(FLIGHT_S[0], tour.travelS));
        flight.current = { fromDir, fromDist, toDir: to.normalize(), toDist, duration, elapsed: 0 };
      }
      const f = flight.current;
      if (f && !tour?.paused) {
        f.elapsed += dt;
        const k = f.duration > 0 ? easeInOutCubic(Math.min(1, f.elapsed / f.duration)) : 1;
        // turn the direction along the shortest arc, change the distance on a log scale
        scratch.turn.setFromUnitVectors(f.fromDir, f.toDir);
        scratch.q.identity().slerp(scratch.turn, k);
        const dist = Math.exp(Math.log(f.fromDist) + (Math.log(f.toDist) - Math.log(f.fromDist)) * k);
        camera.position.copy(scratch.v.copy(f.fromDir).applyQuaternion(scratch.q).multiplyScalar(dist)).add(c.target);
        if (k >= 1) flight.current = null;
      }
      c.update();
      // how many pixels SCALE_MM millimetres take at the droplet's distance
      const pxPerMm = viewport.height / (2 * camera.position.distanceTo(c.target) * HALF_TAN);
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
        autoRotate={!reducedMotion && !tour}
        autoRotateSpeed={0.55}
        minDistance={MIN_DISTANCE}
        maxDistance={1400}
        // the viewer took the camera: drop the flight, the next one starts from where they left it
        onStart={() => (flight.current = null)}
      />
      <Chamber experiment={experiment} playback={playback} />
      <Apparatus experiment={experiment} playback={playback} anchors={anchors} focus={focus} />
      <Trail experiment={experiment} playback={playback} highlight={focus.has("trail")} />
      <group ref={group}>
        <pointLight ref={light} color="#9fb0ff" distance={160} decay={2} />
        <Select enabled={focus.has("droplet")}>
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
        </Select>
        {layers.visible && (
          <Select enabled={focus.has("flame_color")}>
            <FlameShell track={experiment.flameColor} playback={playback} core="#2b45e0" rim="#7f97ff" seed={0} />
          </Select>
        )}
        {layers.uv && (
          <Select enabled={focus.has("flame_uv")}>
            <FlameShell track={experiment.flameUv} playback={playback} core="#5b3fd6" rim="#c2b3ff" seed={7.3} />
          </Select>
        )}
      </group>
      {tour && <TourLabels tour={tour} experiment={experiment} playback={playback} anchors={anchors} />}
    </>
  );
}

interface TourLabelsProps {
  tour: TourRunner;
  experiment: Experiment;
  playback: Playback;
  anchors: RefObject<Anchors>;
}

/** Short labels next to the objects of the current tour step. They move with the object when the
 *  viewer turns the scene. The text comes from the backend with the numbers already filled in. */
function TourLabels({ tour, experiment, playback, anchors }: TourLabelsProps) {
  // labels of the step that was held last stay mounted while they fade out
  const [shown, setShown] = useState<TourStep | null>(null);
  useEffect(() => {
    if (tour.labelsVisible) setShown(tour.step);
  }, [tour, tour.index, tour.phase]);
  const on = tour.labelsVisible && shown === tour.step;
  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    if (!shown) return;
    const t = playback.t;
    const [x, y, z] = dropletPosition(experiment, t);
    const r = (sample(experiment.droplet, "d_mm", t, true) ?? 2) / 2;
    shown.labels.forEach((label, i) => {
      const g = groups.current[i];
      if (!g) return;
      const hardware = label.at === "needles" || label.at === "igniters" ? anchors.current[label.at] : null;
      if (hardware) {
        hardware.getWorldPosition(g.position);
      } else if (label.at === "trail") {
        g.position.set(...experiment.deploySite);
      } else {
        const track = label.at === "flame_color" ? experiment.flameColor : label.at === "flame_uv" ? experiment.flameUv : null;
        const radius = track ? ((sample(track, "flame_d_mm", t) ?? 2 * r) / 2) * 0.72 : r * 0.72;
        g.position.set(x + radius, y + radius, z);
      }
    });
  });

  if (!shown) return null;
  return (
    <>
      {shown.labels.map((label, i) => (
        <group key={`${tour.spec.id}-${tour.spec.steps.indexOf(shown)}-${i}`} ref={(g) => void (groups.current[i] = g)}>
          <Html zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <div className={`x3d-label${on ? " on" : ""}${i % 2 ? " alt" : ""}`} aria-hidden="true">
              <i className="x3d-label-dot" />
              <span className="x3d-label-text mono">{label.text}</span>
            </div>
          </Html>
        </group>
      ))}
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
function Trail({ experiment, playback, highlight }: { experiment: Experiment; playback: Playback; highlight: boolean }) {
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
  // a line cannot be outlined, so a highlighted trail is drawn at full strength instead
  useEffect(() => {
    (line.material as THREE.LineBasicMaterial).opacity = highlight ? 1 : 0.5;
  }, [line, highlight]);

  useFrame(() => {
    let n = 0;
    while (n < times.length && times[n] <= playback.t) n++;
    line.geometry.setDrawRange(0, n);
  });

  return <primitive object={line} />;
}
