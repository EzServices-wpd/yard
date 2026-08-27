"use client";

import type { Panel } from "@/lib/yard/types";
import { SCREW_HEAD } from "@/components/workspace/stick-helpers";

const JOIN_TYPES = new Set(["shelf", "top", "bottom", "divider", "counter", "back"]);

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

export function CarcaseJoins({ panels, explode }: { panels: Panel[]; explode: number }) {
  if (Math.abs(explode - 1) > 0.05) return null;
  const uprights = panels.filter((p) => p.type === "upright");
  const members = panels.filter((p) => JOIN_TYPES.has(p.type));
  if (!uprights.length || !members.length) return null;

  const screws: { x: number; y: number; z: number; rx: number; rz: number }[] = [];
  const glues: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];

  for (const u of uprights) {
    const left = /left/i.test(u.name) || u.position.x + u.size.width / 2 < 0;
    const innerX = left ? u.position.x + u.size.width : u.position.x;
    const uy0 = u.position.y;
    const uy1 = u.position.y + u.size.height;
    const uz0 = u.position.z;
    const uz1 = u.position.z + u.size.depth;

    for (const m of members) {
      const mx0 = m.position.x;
      const mx1 = m.position.x + m.size.width;
      const my0 = m.position.y;
      const my1 = m.position.y + m.size.height;
      const mz0 = m.position.z;
      const mz1 = m.position.z + m.size.depth;
      const oy = overlap(uy0, uy1, my0, my1);
      const oz = overlap(uz0, uz1, mz0, mz1);
      if (oy < 0.2 || oz < 0.2) continue;
      const near =
        Math.abs(mx0 - innerX) < 0.35 ||
        Math.abs(mx1 - innerX) < 0.35 ||
        (mx0 < innerX && mx1 > innerX);
      if (!near && m.type !== "back") continue;

      const y = (Math.max(uy0, my0) + Math.min(uy1, my1)) / 2;
      if (m.type === "back") {
        const z = m.position.z + m.size.depth / 2 + 0.04;
        const span = Math.min(uy1, my1) - Math.max(uy0, my0);
        const n = span > 40 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1);
          screws.push({ x: innerX, y: uy0 + span * t, z, rx: Math.PI / 2, rz: 0 });
        }
        continue;
      }
      const zFront = Math.max(uz0, mz0) + 1.1;
      const zBack = Math.min(uz1, mz1) - 1.1;
      const proud = left ? 0.05 : -0.05;
      screws.push({ x: innerX + proud, y, z: zFront, rx: 0, rz: left ? -Math.PI / 2 : Math.PI / 2 });
      if (zBack - zFront > 2) {
        screws.push({ x: innerX + proud, y, z: zBack, rx: 0, rz: left ? -Math.PI / 2 : Math.PI / 2 });
      }
      const gz = (Math.max(uz0, mz0) + Math.min(uz1, mz1)) / 2;
      const gd = Math.max(0.4, Math.min(uz1, mz1) - Math.max(uz0, mz0) - 0.3);
      glues.push({
        x: innerX,
        y,
        z: gz,
        w: 0.05,
        h: Math.min(m.size.height, 0.75) + 0.02,
        d: gd,
      });
    }
  }

  return (
    <group>
      {screws.map((s, i) => (
        <mesh key={`s${i}`} position={[s.x, s.y, s.z]} rotation={[s.rx, 0, s.rz]}>
          <cylinderGeometry args={[0.16, 0.16, 0.07, 10]} />
          <meshStandardMaterial color={SCREW_HEAD} metalness={0.55} roughness={0.4} />
        </mesh>
      ))}
      {glues.map((g, i) => (
        <mesh key={`g${i}`} position={[g.x, g.y, g.z]}>
          <boxGeometry args={[g.w, g.h, g.d]} />
          <meshStandardMaterial color="#a67c45" roughness={0.7} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
