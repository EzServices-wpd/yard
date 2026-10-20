"use client";
/**
 * ?test=1 only: window.__yardExplode, the every-piece-visible e2e's view into the live bench
 * (scripts/e2e/see-inside-every-piece.py, PLAN §1). Read-only: it renders ID passes from the same renderer,
 * camera and pose the user sees, and never changes the scene, the model or the plan.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import type { YardProject } from "@/lib/yard/types";
import { classify, setDrawerTag } from "@/components/workspace/explode-layout";
import { faceUpMaterial, partMeshes, renderIds } from "@/components/workspace/id-pass";
import { SIM_DRAWER_TAG, simulateHollowDrawers } from "@/components/workspace/explode-sim";
import { explodeClock, explodeSettled } from "@/components/workspace/explode-state";
import { overlayRects } from "@/components/workspace/explode-driver";
import type { Rect } from "@/lib/yard/benchFrame";

export function isTestRun(): boolean {
  return typeof window !== "undefined" && /(?:^|[?&])test=1(?:&|$)/.test(window.location.search);
}

type Hook = {
  readonly settled: boolean;
  parts: { id: string; name: string; role: string; unit: string; group: string; drawerPart?: string }[];
  /** Every drawer (unit D:*): its name and its bottom part (drawerPartOf), or null for a solid drawer. */
  drawers: { unit: string; name: string; bottom: string | null }[];
  /** A part's up-facing faces (a drawer bottom's inner face): pixels visible in the full scene / its solo footprint. */
  faceUp(id: string): { visible: number; footprint: number };
  /** Test only: swap today's solid drawers for simulated hollow 5-part drawers (explode-sim.ts). */
  simHollow(): boolean;
  idPass(): Uint32Array;
  soloPass(id: string): Uint32Array;
  corners(id: string): { x: number; y: number }[];
  readonly camera: { position: number[]; target: number[]; fov: number; viewOffset: number[] | null; view: { azimuthDeg: number; elevationDeg: number } };
  readonly safeRect: Rect | null;
  /** The last camera fit used today's overlay cards and canvas size (no refit still pending). */
  readonly frameFresh: boolean;
  readonly viewport: { w: number; h: number };
  readonly solved: { rounds: number; failing: string[] } | null;
  stepper: { groups: string[]; index: number; go(i: number): boolean };
  canary(): string;
};

export function ExplodeTestHook({ project }: { project: YardProject }) {
  const { gl, scene, camera, size, controls } = useThree();
  useEffect(() => {
    if (!isTestRun()) return;
    const parts = classify(project.panels);
    const index = new Map(parts.map((p, i) => [p.id, i + 1]));
    const live = () => {
      scene.updateMatrixWorld(true);
      const out: { mesh: THREE.Mesh; id: number }[] = [];
      for (const [id, meshes] of partMeshes(scene)) {
        const n = index.get(id);
        if (!n) continue;
        for (const mesh of meshes) if (!mesh.userData.yardGhost) out.push({ mesh, id: n });
      }
      return out;
    };
    const w = () => Math.round(size.width), h = () => Math.round(size.height);
    const hook: Hook = {
      get settled() { return explodeSettled(); },
      parts: parts.map(({ id, name, role, unit, group, drawerPart }) => ({ id, name, role, unit, group, drawerPart })),
      drawers: [...new Set(parts.filter((p) => p.unit.startsWith("D:")).map((p) => p.unit))].map((unit) => {
        const mine = parts.filter((p) => p.unit === unit);
        const bottom = mine.find((p) => p.drawerPart === "bottom");
        const named = mine.find((p) => p.role === "drawerFront") ?? mine.find((p) => p.role === "drawerBox") ?? mine[0];
        return { unit, name: named.name, bottom: bottom ? bottom.id : null };
      }),
      faceUp: (id) => {
        const n = index.get(id);
        if (!n) return { visible: 0, footprint: 0 };
        // The part's up faces keep its id; its other faces get an id no part uses, so only the inner face counts.
        const other = parts.length + 1;
        const mat = faceUpMaterial(n, other);
        try {
          const all = live().map((m) => (m.id === n ? { ...m, material: mat } : m));
          const count = (buf: Uint32Array) => { let c = 0; for (let i = 0; i < buf.length; i++) if (buf[i] === n) c++; return c; };
          const visible = count(renderIds(gl, scene, camera, all, w(), h()));
          const footprint = count(renderIds(gl, scene, camera, all.filter((m) => m.id === n), w(), h()));
          return { visible, footprint };
        } finally {
          mat.dispose();
        }
      },
      simHollow: () => {
        const st = useYard.getState();
        if (!st.project.panels.some((p) => p.type === "drawer")) return false;
        setDrawerTag(SIM_DRAWER_TAG);
        st.setProject({ ...st.project, id: `${st.project.id}-hollow`, panels: simulateHollowDrawers(st.project.panels) });
        return true;
      },
      idPass: () => renderIds(gl, scene, camera, live(), w(), h()),
      soloPass: (id) => { const n = index.get(id); return renderIds(gl, scene, camera, live().filter((m) => m.id === n), w(), h()); },
      corners: (id) => {
        const n = index.get(id), pts: { x: number; y: number }[] = [];
        for (const { mesh } of live().filter((m) => m.id === n)) {
          const g = mesh.geometry;
          if (!g.boundingBox) g.computeBoundingBox();
          const b = g.boundingBox!;
          for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
            const v = new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
            pts.push({ x: ((v.x + 1) / 2) * w(), y: ((1 - v.y) / 2) * h() });
          }
        }
        return pts;
      },
      get camera() {
        const cam = camera as THREE.PerspectiveCamera;
        const t = (controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? new THREE.Vector3();
        const d = cam.position.clone().sub(t).normalize();
        return {
          position: cam.position.toArray(), target: t.toArray(), fov: cam.fov,
          viewOffset: cam.view?.enabled ? [cam.view.offsetX, cam.view.offsetY] : null,
          view: { azimuthDeg: (Math.atan2(d.x, d.z) * 180) / Math.PI, elevationDeg: (Math.asin(d.y) * 180) / Math.PI },
        };
      },
      get safeRect() { return ((window as unknown as { __yardFrame?: { safe?: Rect } }).__yardFrame?.safe) ?? null; },
      get frameFresh() {
        const f = (window as unknown as { __yardFrame?: { overlays?: Rect[]; viewport?: { w: number; h: number } } }).__yardFrame;
        if (!f?.overlays || !f.viewport || Math.abs(f.viewport.w - w()) > 0.5 || Math.abs(f.viewport.h - h()) > 0.5) return false;
        const now = overlayRects(gl.domElement);
        return now.length === f.overlays.length && now.every((r, i) => {
          const o = f.overlays![i];
          return Math.abs(r.left - o.left) + Math.abs(r.top - o.top) + Math.abs(r.right - o.right) + Math.abs(r.bottom - o.bottom) < 1;
        });
      },
      get viewport() { return { w: w(), h: h() }; },
      get solved() { const s = explodeClock.solved; return s ? { rounds: s.rounds, failing: s.failing } : null; },
      // PR 2 fills this in (PLAN §2.6); until then there are no steps to go to.
      stepper: { groups: [...new Set(parts.map((p) => p.group))], index: -1, go: () => false },
      canary: () => {
        const st = useYard.getState();
        const card = document.querySelector("[data-yard-result-card]")?.textContent ?? "";
        const plan = st.plan ? { cutList: st.plan.cutList, bom: st.plan.bom, totals: st.plan.totals } : null;
        const panels = st.project.panels.map((p) => [p.id, p.name, p.type, p.position, p.size]);
        return JSON.stringify({ card, plan, panels });
      },
    };
    (window as unknown as { __yardExplode?: Hook }).__yardExplode = hook;
    return () => { if ((window as unknown as { __yardExplode?: Hook }).__yardExplode === hook) delete (window as unknown as { __yardExplode?: Hook }).__yardExplode; };
  }, [project, gl, scene, camera, size.width, size.height, controls]);
  return null;
}
