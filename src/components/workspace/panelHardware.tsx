"use client";

import * as THREE from "three";

const BAND = "#c49a62";
const STEEL = "#8c9096";
const PULL = "#3e3832";
const PIN = "#d4cdc4";

export function EdgeBand({ w, h, d }: { w: number; h: number; d: number }) {
  const face = w * h >= w * d && w * h >= h * d ? "xy" : w * d >= h * d ? "xz" : "yz";
  const t = Math.min(0.16, Math.min(w, h, d) * 0.28);
  const mat = <meshStandardMaterial color={BAND} roughness={0.58} metalness={0.04} />;
  if (face === "xy") {
    return (
      <group>
        <mesh position={[0, h / 2 - t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
        <mesh position={[0, -h / 2 + t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
        <mesh position={[-w / 2 + t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h - t * 2, d + 0.01]} /></mesh>
        <mesh position={[w / 2 - t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h - t * 2, d + 0.01]} /></mesh>
      </group>
    );
  }
  if (face === "xz") {
    return (
      <group>
        <mesh position={[0, 0, d / 2 - t / 2]}>{mat}<boxGeometry args={[w + 0.01, h + 0.01, t]} /></mesh>
        <mesh position={[0, 0, -d / 2 + t / 2]}>{mat}<boxGeometry args={[w + 0.01, h + 0.01, t]} /></mesh>
        <mesh position={[-w / 2 + t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h + 0.01, d - t * 2]} /></mesh>
        <mesh position={[w / 2 - t / 2, 0, 0]}>{mat}<boxGeometry args={[t, h + 0.01, d - t * 2]} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, h / 2 - t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
      <mesh position={[0, -h / 2 + t / 2, 0]}>{mat}<boxGeometry args={[w + 0.01, t, d + 0.01]} /></mesh>
      <mesh position={[0, 0, d / 2 - t / 2]}>{mat}<boxGeometry args={[w + 0.01, h - t * 2, t]} /></mesh>
      <mesh position={[0, 0, -d / 2 + t / 2]}>{mat}<boxGeometry args={[w + 0.01, h - t * 2, t]} /></mesh>
    </group>
  );
}

export function DoorHinges({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? -w / 2 + 0.85 : w / 2 - 0.85;
  const z = -d / 2 + 0.12;
  const ys = [h / 2 - 3.5, -h / 2 + 3.5];
  return (
    <group>
      {ys.map((y) => (
        <group key={y} position={[x, y, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.22, 20]} />
            <meshStandardMaterial color={STEEL} metalness={0.72} roughness={0.32} />
          </mesh>
          <mesh position={[isLeft ? 0.55 : -0.55, 0, -0.18]}>
            <boxGeometry args={[0.9, 0.42, 0.12]} />
            <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.38} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function BarPull({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? w / 2 - 1.1 : -w / 2 + 1.1;
  const z = d / 2 + 0.28;
  return (
    <group position={[x, 0, z]}>
      <mesh>
        <boxGeometry args={[0.28, 4.2, 0.28]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.7, -0.22]}>
        <boxGeometry args={[0.22, 0.22, 0.4]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, -1.7, -0.22]}>
        <boxGeometry args={[0.22, 0.22, 0.4]} />
        <meshStandardMaterial color={PULL} metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function CupPull({ d }: { w?: number; h?: number; d: number }) {
  return (
    <mesh position={[0, 0, d / 2 + 0.22]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.55, 0.7, 0.35, 16, 1, true]} />
      <meshStandardMaterial color={PULL} metalness={0.5} roughness={0.42} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** True 32mm pitch, ~5mm dia, 1-1/4" back from front edge. */
export function PinHoles({ w, h, d, isLeft }: { w: number; h: number; d: number; isLeft: boolean }) {
  const x = isLeft ? w / 2 - 0.08 : -w / 2 + 0.08;
  const z = d / 2 - 1.25;
  const start = -h / 2 + 6;
  const end = h / 2 - 4;
  const step = 1.26;
  const ys: number[] = [];
  for (let y = start; y <= end; y += step) ys.push(y);
  return (
    <group>
      {ys.map((y) => (
        <mesh key={y} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.098, 0.098, 0.28, 8]} />
          <meshStandardMaterial color={PIN} roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/** Bought coat hook: steel plate on the rail face and a curved hook sticking out into the room (+Z). */
export function CoatHook({ w, h, d }: { w: number; h: number; d: number }) {
  const plateT = Math.min(0.2, Math.max(0.12, d * 0.08));
  const hookR = Math.max(0.7, Math.min(d * 0.42, h * 0.55, 1.1));
  const tube = Math.max(0.12, Math.min(w, h, d) * 0.14);
  // Local −Z is the rail face; +Z is out into the room (past the peg rail).
  const plateZ = -d / 2 + plateT / 2;
  const stemZ = -d / 2 + plateT + hookR * 0.15;
  return (
    <group>
      <mesh position={[0, 0, plateZ]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[Math.max(w, 0.85), Math.max(h * 0.55, 1.2), plateT]} />
        <meshStandardMaterial color={STEEL} metalness={0.72} roughness={0.32} />
      </mesh>
      {/* Stem out from the plate, then a downward curl — readable from the 3/4 bench view. */}
      <mesh position={[0, h * 0.08, stemZ + hookR * 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[tube, tube, hookR * 0.7, 10]} />
        <meshStandardMaterial color={STEEL} metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, h * 0.08 - hookR * 0.35, stemZ + hookR * 0.7]} rotation={[0.2, 0, 0]} castShadow frustumCulled={false}>
        <torusGeometry args={[hookR * 0.55, tube, 10, 20, Math.PI * 1.35]} />
        <meshStandardMaterial color={STEEL} metalness={0.75} roughness={0.28} />
      </mesh>
    </group>
  );
}

