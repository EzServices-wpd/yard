"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { benchModelBox } from "@/lib/yard/benchFrame";
import type { YardProject } from "@/lib/yard/types";
import { BENCH_INK } from "./shop-light";
import { FIGURES, FIGURE_GAP, PROP_LAYER, propSpots, useScale, type PropSpot } from "./scale-props";

/** The bench ink (Night shop --color-fg, same as canvas.tsx HIST). Prop colours below are the objects' own materials. */
const INK = BENCH_INK.ink;
const FADE_MS = 240;
/** Right half of a standing figure, x and y as fractions of its height, neck to feet (mirrored for the left). */
const BODY: [number, number][] = [
  [0.025, 0.868], [0.03, 0.848], [0.11, 0.828], [0.135, 0.805], [0.142, 0.7], [0.137, 0.58], [0.132, 0.47], [0.126, 0.405],
  [0.106, 0.405], [0.104, 0.47], [0.103, 0.58], [0.1, 0.75], [0.092, 0.7], [0.085, 0.6], [0.1, 0.5], [0.096, 0.38],
  [0.07, 0.27], [0.066, 0.18], [0.046, 0.04], [0.062, 0], [0.014, 0], [0.02, 0.04], [0.026, 0.27], [0.03, 0.38], [0, 0.47],
];
const LABEL_IN = 7;

function silhouette(fig: keyof typeof FIGURES, W: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const f = FIGURES[fig];
  const H = f.height + LABEL_IN;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = Math.round((256 * H) / W);
  const g = c.getContext("2d");
  if (!g) return null;
  const s = c.width / W;
  const px = (x: number) => c.width / 2 + x * f.height * s;
  const py = (y: number) => c.height - y * f.height * s;
  // The head is a bigger share of a child's height; the body below the neck scales to fit.
  const neck = 1 - f.head;
  const ky = neck / 0.868;
  g.fillStyle = INK;
  g.beginPath();
  BODY.forEach(([x, y], i) => (i ? g.lineTo(px(x), py(y * ky)) : g.moveTo(px(x), py(y * ky))));
  for (let i = BODY.length - 1; i >= 0; i--) g.lineTo(px(-BODY[i][0]), py(BODY[i][1] * ky));
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(px(0), py(1 - f.head / 2), f.head * 0.37 * f.height * s, (f.head / 2) * f.height * s, 0, 0, Math.PI * 2);
  g.fill();
  g.font = `600 ${Math.round(3.2 * s)}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(f.label.split(" ")[1], c.width / 2, py(1) - 3.5 * s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fade a group in over FADE_MS (opacity only; reduced motion or a hidden tab: the final frame at once). */
function useFadeIn(ref: React.RefObject<THREE.Group | null>) {
  const invalidate = useThree((s) => s.invalidate);
  const t0 = useRef(0);
  const each = (k: number) =>
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!m) return;
      m.userData.base ??= m.opacity;
      m.transparent = k < 1 || (m.userData.base as number) < 1;
      m.opacity = (m.userData.base as number) * k;
    });
  useLayoutEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden;
    t0.current = still ? 0 : performance.now();
    each(still ? 1 : 0);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame(() => {
    if (!t0.current) return;
    const k = Math.min(1, (performance.now() - t0.current) / FADE_MS);
    each(k);
    if (k >= 1) t0.current = 0;
    else invalidate();
  });
}

function Ghost({ fig, x, z }: { fig: keyof typeof FIGURES; x: number; z: number }) {
  const f = FIGURES[fig];
  const W = f.height * 0.32;
  const tex = useMemo(() => silhouette(fig, W), [fig, W]);
  const ref = useRef<THREE.Group>(null);
  useFadeIn(ref);
  // A camera-facing plane, turned about its own upright only (the feet stay on the floor).
  useFrame(({ camera }) => {
    if (ref.current) ref.current.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
  });
  const ticks = useMemo(() => {
    // Height ticks every foot (longer each yard) on the side away from the build, and one at the top of the head.
    const rx = -(W / 2 + 1);
    const out: [number, number, number][][] = [[[rx, 0, 0], [rx, f.height, 0]]];
    for (let y = 0; y <= f.height; y += 12) out.push([[rx, y, 0], [rx - (y % 36 === 0 ? 2.5 : 1.5), y, 0]]);
    out.push([[rx + 1, f.height, 0], [rx - 3, f.height, 0]]);
    return out;
  }, [W, f.height]);
  if (!tex) return null;
  const H = f.height + LABEL_IN;
  return (
    <group ref={ref} position={[x, 0, z]} name="yard-scale-figure">
      <mesh position={[0, H / 2, 0]} layers={PROP_LAYER} renderOrder={2}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={tex} transparent opacity={0.3} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {ticks.map((p, i) => (
        <Line key={i} points={p} color={INK} lineWidth={i ? 1.4 : 1} transparent opacity={i ? 0.7 : 0.4} depthWrite={false} layers={PROP_LAYER} />
      ))}
    </group>
  );
}

const TONES = {
  towel: ["#d9d2c3", "#9fb3c8", "#c9a98c"],
  book: ["#6b4f3a", "#3f5a4c", "#8a3b2e", "#c2a878", "#2f3e55"],
  mug: ["#e8e2d6"],
} as const;

function Props({ spots }: { spots: PropSpot[] }) {
  const ref = useRef<THREE.Group>(null);
  useFadeIn(ref);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mats = useMemo(() => {
    const m = new Map<string, THREE.MeshStandardMaterial>();
    for (const [kind, list] of Object.entries(TONES)) list.forEach((c, i) => m.set(`${kind}${i}`, new THREE.MeshStandardMaterial({ color: c, roughness: kind === "mug" ? 0.35 : 0.9 })));
    return m;
  }, []);
  return (
    <group ref={ref} name="yard-scale-props">
      {spots.map((p, i) =>
        p.kind === "mug" ? (
          <group key={i} position={[p.x, p.y, p.z]}>
            <mesh position={[0, p.h / 2, 0]} material={mats.get("mug0")} layers={PROP_LAYER}>
              <cylinderGeometry args={[p.w / 2, p.w / 2 - 0.1, p.h, 24, 1]} />
            </mesh>
            <mesh position={[p.w / 2, p.h * 0.55, 0]} rotation={[0, 0, -Math.PI / 2]} material={mats.get("mug0")} layers={PROP_LAYER}>
              <torusGeometry args={[0.9, 0.22, 8, 16, Math.PI]} />
            </mesh>
          </group>
        ) : (
          <mesh
            key={i}
            geometry={box}
            material={mats.get(`${p.kind}${p.tone % TONES[p.kind].length}`)}
            position={[p.x, p.y + p.h / 2, p.z]}
            // Towels sit a hair soft: a 2% squash keeps stacked folds from z-fighting.
            scale={[p.w, p.kind === "towel" ? p.h * 0.98 : p.h, p.d]}
            layers={PROP_LAYER}
          />
        ),
      )}
    </group>
  );
}

/**
 * The scale layer: the figure beside the build and props on its shelves, both off by default and switched
 * in Options (on this device only). Nothing in here is a part: no part tag, no store write, no handler.
 */
export function ScaleLayer({ project, hidden }: { project: YardProject; hidden: boolean }) {
  const { figure, props } = useScale();
  const invalidate = useThree((s) => s.invalidate);
  const box = useMemo(() => benchModelBox(project), [project]);
  const spots = useMemo(() => (props ? propSpots(project.panels, project.name) : []), [props, project.panels, project.name]);
  useLayoutEffect(() => invalidate(), [figure, props, hidden, invalidate]);
  if (hidden) return null;
  return (
    <group name="yard-scale" userData={{ yardScale: true }}>
      {figure !== "off" && <Ghost key={figure} fig={figure} x={box.minX - FIGURE_GAP - FIGURES[figure].width / 2} z={(box.minZ + box.maxZ) / 2} />}
      {spots.length > 0 && <Props key={project.id} spots={spots} />}
    </group>
  );
}
