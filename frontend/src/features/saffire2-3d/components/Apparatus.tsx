import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Experiment module ≈ 53 × 90 × 133 cm (Urban et al., "The Spacecraft Fire Experiment (Saffire):
// Objectives, Development and Status", Fig. 1 caption; in the PSI-99 snapshot under Science Documents).
const MODULE = { w: 900, h: 1330, d: 530 }; // mm; which side is 53 vs 90 cm is not stated: schematic
// Flow duct and avionics bay side by side, split by a Lexan wall (same paper, §2). Split: schematic.
const DUCT_W = 600; // mm, schematic
const BAY_W = MODULE.w - DUCT_W;

// Card: 9 samples 5 × 29 cm in a 3 × 3 layout, numbered 1-2-3 in the top row, flow from the bottom
// (Readme Fig. 1). Pitch between strips: schematic.
const PITCH_X = 150; // mm, schematic
const PITCH_Y = 360; // mm, schematic

export const CARD = {
  x: -MODULE.w / 2 + DUCT_W / 2, // card at the centre of the duct (paper, §2)
  ductW: DUCT_W,
  ductH: MODULE.h - 140, // between the straighteners and the fans (schematic)
  ductD: MODULE.d,
};

/** Centre of sample n (1…9) on the card. */
export function sampleCenter(n: number): [number, number] {
  const col = (n - 1) % 3;
  const row = Math.floor((n - 1) / 3); // 0 = top row
  return [CARD.x + (col - 1) * PITCH_X, (1 - row) * PITCH_Y];
}

const METAL = { color: "#dfe6f2", metalness: 0.85, roughness: 0.3 };

export function Module({ labels }: { labels: boolean }) {
  const shell = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(MODULE.w, MODULE.h, MODULE.d)), []);
  useEffect(() => () => shell.dispose(), [shell]);
  const top = MODULE.h / 2;
  const bayX = MODULE.w / 2 - BAY_W / 2;
  return (
    <group>
      {/* outer frame of the module */}
      <lineSegments geometry={shell}>
        <lineBasicMaterial color="#3a404c" />
      </lineSegments>
      {/* back wall of the duct, dim */}
      <mesh position={[CARD.x, 0, -MODULE.d / 2]}>
        <planeGeometry args={[DUCT_W, MODULE.h]} />
        <meshStandardMaterial color="#1a1f2b" roughness={0.9} />
      </mesh>
      {/* Lexan wall between duct and avionics bay */}
      <mesh position={[MODULE.w / 2 - BAY_W, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[MODULE.d, MODULE.h]} />
        <meshPhysicalMaterial color="#cfe0ff" transparent opacity={0.08} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <AvionicsBay x={bayX} />
      <CardFrame />
      <Fans y={top - 60} />
      <Straighteners y={-top + 40} />
      <Cameras />
      {labels && (
        <>
          <Label position={[CARD.x, top + 40, 0]}>fans (air drawn upward)</Label>
          <Label position={[CARD.x, -top - 40, 0]}>flow straighteners · air in</Label>
          <Label position={[bayX, top - 160, 0]}>avionics bay</Label>
          <Label position={[CARD.x, -MODULE.h / 2 + 170, MODULE.d / 2 - 40]}>2 cameras view the front</Label>
        </>
      )}
    </group>
  );
}

function Label({ position, children }: { position: [number, number, number]; children: string }) {
  return (
    <Html position={position} center className="sf3d-label muted" zIndexRange={[10, 0]}>
      {children}
    </Html>
  );
}

/** Thin frame holding the nine strips (schematic proportions). */
function CardFrame() {
  const w = PITCH_X * 3;
  const h = PITCH_Y * 3;
  const bars: [number, number, number, number][] = [
    [0, h / 2, w, 8],
    [0, -h / 2, w, 8],
    [-w / 2, 0, 8, h],
    [w / 2, 0, 8, h],
    [0, PITCH_Y / 2, w, 4],
    [0, -PITCH_Y / 2, w, 4],
  ];
  return (
    <group position={[CARD.x, 0, -3]}>
      {bars.map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[bw, bh, 4]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
    </group>
  );
}

/** Fans at the top of the duct (paper, §2); count, size and spin: schematic. */
function Fans({ y }: { y: number }) {
  const rotors = useRef<THREE.Group>(null);
  useFrame((_, dt) => rotors.current?.children.forEach((r) => (r.rotation.y += dt * 4)));
  const xs = [-170, 0, 170];
  return (
    <group position={[CARD.x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[DUCT_W - 20, MODULE.d - 20]} />
        <meshStandardMaterial color="#141822" side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
      <group ref={rotors}>
        {xs.map((x) => (
          <group key={x} position={[x, -8, 0]}>
            {[0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} rotation={[0, (k * 2 * Math.PI) / 5, 0.35]} position={[0, 0, 0]}>
                <boxGeometry args={[110, 3, 26]} />
                <meshStandardMaterial {...METAL} color="#9aa3b4" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {xs.map((x) => (
        <mesh key={`r${x}`} position={[x, -8, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[66, 4, 8, 48]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
    </group>
  );
}

/** Flow straighteners at the bottom (paper, §2): a grid of thin vanes, schematic. */
function Straighteners({ y }: { y: number }) {
  const n = 10;
  const vanes = [];
  for (let i = 1; i < n; i++) {
    const fx = -DUCT_W / 2 + (DUCT_W * i) / n;
    const fz = -MODULE.d / 2 + (MODULE.d * i) / n;
    vanes.push(
      <mesh key={`x${i}`} position={[fx, 0, 0]}>
        <boxGeometry args={[1.5, 50, MODULE.d - 10]} />
        <meshStandardMaterial {...METAL} color="#7d8596" />
      </mesh>,
      <mesh key={`z${i}`} position={[0, 0, fz]}>
        <boxGeometry args={[DUCT_W - 10, 50, 1.5]} />
        <meshStandardMaterial {...METAL} color="#7d8596" />
      </mesh>,
    );
  }
  return <group position={[CARD.x, y, 0]}>{vanes}</group>;
}

/** Avionics bay boxes (power, computer, signal conditioning; paper Fig. 1). Shapes: schematic. */
function AvionicsBay({ x }: { x: number }) {
  const boxes: [number, number, number, number][] = [
    [0, 420, 200, 180],
    [0, 150, 220, 260],
    [0, -170, 200, 220],
    [0, -440, 230, 180],
  ];
  return (
    <group position={[x, 0, 0]}>
      {boxes.map(([bx, by, bw, bh], i) => (
        <mesh key={i} position={[bx, by, -40]}>
          <boxGeometry args={[bw, bh, 300]} />
          <meshStandardMaterial color="#2a303c" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Two cameras viewing the front of the sample (Readme Table 3); placement: schematic. */
function Cameras() {
  const z = MODULE.d / 2 - 50;
  return (
    <group>
      {[-90, 90].map((dx) => (
        <group key={dx} position={[CARD.x + dx, -MODULE.h / 2 + 110, z]} rotation={[0.25, 0, 0]}>
          <mesh>
            <boxGeometry args={[60, 46, 70]} />
            <meshStandardMaterial color="#20252f" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, -40]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[16, 16, 14, 24]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
