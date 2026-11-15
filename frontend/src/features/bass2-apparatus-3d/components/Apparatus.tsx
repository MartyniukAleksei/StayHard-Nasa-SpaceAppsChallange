import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { DUCT } from "../content";
import type { Sim } from "../lib/sim";

// One scene unit = 1 mm. The flow runs along +x; x = 0 is the middle of the test section.
// Sizes with a page number come from NASA/TM-20210011385; everything else is marked schematic.

const HALF_L = DUCT.length / 2; // test section 170 mm long (p.4)
const HALF_W = DUCT.width / 2; // 76 x 76 mm cross-section (p.4)
const FAN_X0 = -HALF_L - DUCT.fanSectionLength;

const WALL = "#2b303c"; // black anodized duct (p.4), lifted from pure black so the shape reads
const STEEL = "#dfe6f2";
const DARK_METAL = "#454b59";
const LINE = "#7b8496";

/** Wall of a duct section seen from inside: only the walls facing away from the viewer are drawn. */
function DuctWalls({ x0, x1, color }: { x0: number; x1: number; color: string }) {
  const geometry = useMemo(() => {
    const w = DUCT.width;
    const h = DUCT.height;
    const r = DUCT.cornerRadius;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(w / 2, h / 2 - r);
    shape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 10 });
    g.rotateY(Math.PI / 2); // extrusion axis z -> x
    g.translate(x0, 0, 0);
    return g;
  }, [x0, x1]);
  const materials = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ visible: false }), // end caps: the duct is open at both ends
      // black anodized aluminium: dark, slightly metallic, with a faint sheen
      new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.4, side: THREE.BackSide }),
    ],
    [color],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );
  return <mesh geometry={geometry} material={materials} />;
}

/** Window pane: a thin reflective sheet in the wall plane. Frame sizes are schematic. */
function Pane({ axis, at, x0, x1, half }: { axis: "y" | "z"; at: number; x0: number; x1: number; half: number }) {
  const w = x1 - x0;
  const h = 2 * half;
  return (
    <mesh position={axis === "y" ? [(x0 + x1) / 2, at, 0] : [(x0 + x1) / 2, 0, at]} rotation={axis === "y" ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshPhysicalMaterial color="#c8d6f0" metalness={0} roughness={0.04} transparent opacity={0.12} envMapIntensity={1.6} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Closed outline through the given points. */
function Outline({ points, color = LINE }: { points: [number, number, number][]; color?: string }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color }));
  }, [points, color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  return <primitive object={line} />;
}

const rect = (
  axis: "y" | "z",
  at: number,
  x0: number,
  x1: number,
  half: number,
): [number, number, number][] =>
  axis === "y"
    ? [[x0, at, -half], [x1, at, -half], [x1, at, half], [x0, at, half]]
    : [[x0, -half, at], [x1, -half, at], [x1, half, at], [x0, half, at]];

/** Alpha map drawn on a canvas: a grid of holes (perforated plate) or of wires (screen). */
function usePattern(kind: "holes" | "wires", repeat: number): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    if (kind === "holes") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.27, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size * 0.2);
      ctx.fillRect(0, 0, size * 0.2, size);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  }, [kind, repeat]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** A flat mesh across the duct: perforated plate or wire screen. Hole and wire pitch are schematic. */
function Mesh2D({ x, kind, repeat, color, metalness }: { x: number; kind: "holes" | "wires"; repeat: number; color: string; metalness: number }) {
  const alphaMap = usePattern(kind, repeat);
  return (
    <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[DUCT.width - 1, DUCT.height - 1]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={0.3}
        envMapIntensity={1.3}
        alphaMap={alphaMap}
        alphaTest={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Honeycomb flow straightener, drawn as a square egg-crate: the cell shape and count are schematic. */
function Honeycomb({ x }: { x: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const CELLS = 9;
  const DEPTH = 12;
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let i = 0;
    for (let k = 0; k <= CELLS; k++) {
      const at = -HALF_W + 2 + (k / CELLS) * (DUCT.width - 4);
      o.position.set(x, at, 0);
      o.scale.set(DEPTH, 0.45, DUCT.width - 4);
      o.updateMatrix();
      m.setMatrixAt(i++, o.matrix);
      o.position.set(x, 0, at);
      o.scale.set(DEPTH, DUCT.height - 4, 0.45);
      o.updateMatrix();
      m.setMatrixAt(i++, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [x]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, (CELLS + 1) * 2]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#aeb6c4" metalness={0.8} roughness={0.42} />
    </instancedMesh>
  );
}

/** Variable-speed fan at the upstream end (p.4). Blade count, size and spin rate are schematic. */
function Fan({ x, sim }: { x: number; sim: Sim }) {
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rotor.current && sim.active && !sim.reducedMotion) rotor.current.rotation.x += Math.min(dt, 0.1) * (1.5 + sim.tracerCmS * 0.55);
  });
  const blades = useMemo(() => Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2), []);
  return (
    <group position={[x, 0, 0]}>
      <group ref={rotor}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[9, 9, 12, 32]} />
          <meshStandardMaterial color={DARK_METAL} metalness={0.7} roughness={0.45} />
        </mesh>
        {blades.map((a) => (
          <group key={a} rotation={[a, 0, 0]}>
            <mesh position={[0, 20, 0]} rotation={[0, 0.6, 0]}>
              <boxGeometry args={[1.2, 22, 11]} />
              <meshStandardMaterial color="#596070" metalness={0.6} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[33, 1.6, 12, 64]} />
        <meshStandardMaterial color={DARK_METAL} metalness={0.7} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Flow duct with everything fixed to it. Order of the elements along the flow: report p.4 and Fig. 7.1(a). */
export function Apparatus({ sim }: { sim: Sim }) {
  return (
    <group>
      {/* test section, 76 x 76 x 170 mm (p.4) */}
      <DuctWalls x0={-HALF_L} x1={HALF_L} color={WALL} />
      {/* fan section upstream: length schematic */}
      <DuctWalls x0={FAN_X0} x1={-HALF_L} color="#343a48" />
      <Fan x={FAN_X0 + 16} sim={sim} />

      {/* N2 nozzle just downstream of the fan (p.6): shape schematic */}
      <mesh position={[FAN_X0 + 30, -HALF_W + 7, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 14, 16]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} />
      </mesh>

      {/* honeycomb flow straightener, then the air-speed transducer, then the inlet screen (p.4) */}
      <Honeycomb x={-HALF_L - 22} />
      <group position={[-HALF_L - 9, 0, 0]}>
        <mesh>
          <sphereGeometry args={[2, 24, 24]} />
          <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, (HALF_W - 2) / 2 + 1, 0]}>
          <cylinderGeometry args={[0.6, 0.6, HALF_W - 2, 12]} />
          <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
      <Mesh2D x={-HALF_L - 2} kind="wires" repeat={38} color="#c9d0dc" metalness={0.8} />

      {/* exit: perforated copper plate followed by a brass screen (p.4) */}
      <Mesh2D x={HALF_L + 2} kind="holes" repeat={19} color="#c77b4a" metalness={0.9} />
      <Mesh2D x={HALF_L + 8} kind="wires" repeat={30} color="#c8a94e" metalness={0.9} />

      {/* top window and front window (p.4, Fig. 7.1a): frame outline plus a glass pane */}
      <Outline points={rect("y", HALF_W, -HALF_L + 22, HALF_L - 22, 27)} />
      <Pane axis="y" at={HALF_W - 0.3} x0={-HALF_L + 22} x1={HALF_L - 22} half={27} />
      <Outline points={rect("z", HALF_W, -HALF_L + 12, HALF_L - 12, 30)} />
      <Pane axis="z" at={HALF_W - 0.3} x0={-HALF_L + 12} x1={HALF_L - 12} half={30} />
      {/* edges of the duct: both ends of the test section */}
      <Outline points={rect("y", -HALF_W, -HALF_L, HALF_L, HALF_W)} color="#565e6e" />
      <Outline points={rect("y", HALF_W, -HALF_L, HALF_L, HALF_W)} color="#565e6e" />

      {/* sample mounting rail under the top window (p.4): size schematic */}
      <mesh position={[0, HALF_W - 2.5, 0]}>
        <boxGeometry args={[124, 1.6, 5]} />
        <meshStandardMaterial color={DARK_METAL} metalness={0.75} roughness={0.4} />
      </mesh>

      {/* radiometer: downstream top back corner, viewing upstream (p.4). Housing schematic */}
      <group position={[HALF_L - 12, HALF_W - 9, -HALF_W + 9]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[4.2, 4.2, 13, 24]} />
          <meshStandardMaterial color={DARK_METAL} metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[-6.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[3, 3, 0.4, 24]} />
          <meshStandardMaterial color="#0b0d12" metalness={0.2} roughness={0.15} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Cameras outside the duct. Positions follow the report (p.4-5, Fig. 1.1 and 6.1): the Nikon still camera
 * looks down through the top window, the video camera looks into the front window through a turning mirror.
 * Bodies and distances are schematic.
 */
export function Cameras() {
  const body = <meshStandardMaterial color="#2c303a" metalness={0.5} roughness={0.5} />;
  const glass = <meshStandardMaterial color="#0b0d12" metalness={0.3} roughness={0.1} />;
  return (
    <group>
      {/* Nikon D300s with a 60 mm lens, above the top window */}
      <group position={[0, 128, 0]}>
        <mesh>
          <boxGeometry args={[48, 26, 32]} />
          {body}
        </mesh>
        <mesh position={[0, -27, 0]}>
          <cylinderGeometry args={[13, 14, 30, 40]} />
          {body}
        </mesh>
        <mesh position={[0, -42.2, 0]}>
          <cylinderGeometry args={[11, 11, 0.5, 40]} />
          {glass}
        </mesh>
      </group>
      {/* Panasonic WV-CP654 video camera and its turning mirror, in front of the front window */}
      <group position={[-128, -8, 96]}>
        <mesh>
          <boxGeometry args={[58, 30, 30]} />
          <meshStandardMaterial color="#b9bec8" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[36, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[9, 10, 14, 32]} />
          {body}
        </mesh>
        <mesh position={[43.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[7.5, 7.5, 0.5, 32]} />
          {glass}
        </mesh>
      </group>
      <mesh position={[0, -8, 96]} rotation={[0, -Math.PI * 0.75, 0]}>
        <boxGeometry args={[46, 36, 1.6]} />
        <meshStandardMaterial color="#d2ad62" metalness={0.7} roughness={0.32} />
      </mesh>
    </group>
  );
}
