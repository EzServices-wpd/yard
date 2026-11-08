/**
 * The Ideas hero's live model (lazy chunk: three + r3f only, no engine, no store). Draws a baked panel model
 * (scripts/gen-idea-drawings.ts) as wood plates with drawn edges, turning slowly. frameloop "demand": it
 * renders only while `active` (on screen, tab visible, motion allowed), so it costs nothing offscreen.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";

export type HeroModel = {
  overall?: { width: number; height: number; depth: number };
  panels: { p: [number, number, number]; s: [number, number, number]; yaw?: number; poly?: { plane: "xz" | "xy" | "zy"; pts: [number, number][]; holes?: [number, number, number][] }; glass?: 1 }[];
};

const WOOD = new THREE.MeshStandardMaterial({ color: "#d9c5a1", roughness: 0.85, metalness: 0 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#cfe0e6", roughness: 0.1, transparent: true, opacity: 0.45 });

function plateGeometry(m: HeroModel["panels"][number]) {
  const [w, h, d] = m.s;
  const poly = m.poly;
  if (!poly || poly.pts.length < 3) return new THREE.BoxGeometry(w, h, d);
  const shape = new THREE.Shape();
  // Holes (x, y, r in the outline's own frame) are cut through, offset like the outline: a wheel's open centre stays open.
  const [ou, ov] = poly.plane === "zy" ? [d / 2, h / 2] : poly.plane === "xz" ? [w / 2, d / 2] : [w / 2, h / 2];
  for (const [hx, hy, r] of poly.holes ?? []) {
    const hole = new THREE.Path();
    hole.absarc(hx - ou, hy - ov, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  // Same local frames as the workspace bench (stick-cloud PanelMesh).
  if (poly.plane === "zy") {
    poly.pts.forEach(([pz, py], i) => (i ? shape.lineTo(pz - d / 2, py - h / 2) : shape.moveTo(pz - d / 2, py - h / 2)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 20 });
    g.translate(0, 0, -w / 2);
    g.rotateY(-Math.PI / 2);
    return g;
  }
  if (poly.plane === "xz") {
    poly.pts.forEach(([px, pz], i) => (i ? shape.lineTo(px - w / 2, pz - d / 2) : shape.moveTo(px - w / 2, pz - d / 2)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, h / 2, 0);
    return g;
  }
  poly.pts.forEach(([px, py], i) => (i ? shape.lineTo(px - w / 2, py - h / 2) : shape.moveTo(px - w / 2, py - h / 2)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 20 });
  g.translate(0, 0, -d / 2);
  return g;
}

function Model({ model }: { model: HeroModel }) {
  const { plates, center, size } = useMemo(() => {
    const box = new THREE.Box3();
    for (const m of model.panels) {
      box.expandByPoint(new THREE.Vector3(...m.p));
      box.expandByPoint(new THREE.Vector3(m.p[0] + m.s[0], m.p[1] + m.s[1], m.p[2] + m.s[2]));
    }
    const plates = model.panels.map((m) => ({ m, geo: plateGeometry(m) }));
    return { plates, center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) };
  }, [model]);
  useEffect(() => () => plates.forEach((p) => p.geo.dispose()), [plates]);
  const { camera } = useThree();
  useEffect(() => {
    const r = Math.max(size.x, size.y, size.z);
    const dist = r * 2.35;
    camera.position.set(dist * 0.72, dist * 0.42, dist * 0.72);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return (
    <group position={[-center.x, -center.y, -center.z]}>
      {plates.map(({ m, geo }, i) => (
        <mesh key={i} geometry={geo} material={m.glass ? GLASS : WOOD} position={[m.p[0] + m.s[0] / 2, m.p[1] + m.s[1] / 2, m.p[2] + m.s[2] / 2]} rotation={[0, m.yaw ?? 0, 0]}>
          <Edges threshold={20} color="#78603f" />
        </mesh>
      ))}
    </group>
  );
}

/** Turns the model ~6°/s while active; with frameloop "demand" nothing renders while paused. */
function Turntable({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    if (!active) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      if (ref.current) ref.current.rotation.y += ((now - last) / 1000) * (Math.PI / 30);
      last = now;
      invalidate();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, invalidate]);
  return <group ref={ref} rotation={[0, -0.35, 0]}>{children}</group>;
}

export default function HeroStage({ model, active, onReady }: { model: HeroModel; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ fov: 30, near: 0.5, far: 2000 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[40, 80, 50]} intensity={1.6} />
      <directionalLight position={[-60, 20, -30]} intensity={0.35} />
      <Turntable active={active}>
        <Model model={model} />
      </Turntable>
    </Canvas>
  );
}
