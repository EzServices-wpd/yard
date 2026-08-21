import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { homeOf } from "./ghost";
import type { AssemblyStep, YardProject } from "./types";
import { stepInstanceIds } from "./assembly";

function iso(x: number, y: number, z: number) {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  return { x: (x - z) * c, y: -y + (x + z) * s };
}

export function isoViewBox(project: YardProject, highlightIds?: string[]) {
  const pts: { x: number; y: number }[] = [];
  const hot = new Set(highlightIds ?? []);
  const preferHot = hot.size > 0 && hot.size < (project.instances.length + project.panels.length) * 0.85;
  for (const inst of project.instances) {
    if (preferHot && !hot.has(inst.id)) continue;
    const p = homeOf(inst);
    pts.push(iso(p.x, p.y, p.z));
  }
  for (const panel of project.panels) {
    if (preferHot && !hot.has(panel.id)) continue;
    pts.push(iso(panel.position.x, panel.position.y, panel.position.z));
    pts.push(
      iso(
        panel.position.x + panel.size.width,
        panel.position.y + panel.size.height,
        panel.position.z + panel.size.depth,
      ),
    );
  }
  if (!pts.length) {
    for (const inst of project.instances) {
      const p = homeOf(inst);
      pts.push(iso(p.x, p.y, p.z));
    }
    for (const panel of project.panels) {
      pts.push(iso(panel.position.x, panel.position.y, panel.position.z));
    }
  }
  if (!pts.length) return { minX: -20, minY: -20, w: 40, h: 40 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(4, (maxX - minX) * 0.12);
  return { minX: minX - pad, minY: minY - pad, w: Math.max(8, maxX - minX + pad * 2), h: Math.max(8, maxY - minY + pad * 2) };
}

export function isoMarks(project: YardProject, highlightIds: string[]) {
  const marks: { x1: number; y1: number; x2: number; y2: number; hot: boolean }[] = [];
  const hot = new Set(highlightIds);
  for (const inst of project.instances) {
    const item = getCatalogItem(inst.catalogId);
    const prim = item ? toPrimitive(item, inst.cutLength) : null;
    const p = homeOf(inst);
    const a3 = inst.from ?? {
      x: p.x - Math.sin(inst.rotation.y) * ((prim?.length ?? 4) / 2),
      y: p.y,
      z: p.z - Math.cos(inst.rotation.y) * ((prim?.length ?? 4) / 2),
    };
    const b3 = inst.to ?? {
      x: p.x + Math.sin(inst.rotation.y) * ((prim?.length ?? 4) / 2),
      y: p.y,
      z: p.z + Math.cos(inst.rotation.y) * ((prim?.length ?? 4) / 2),
    };
    const a = iso(a3.x, a3.y, a3.z);
    const b = iso(b3.x, b3.y, b3.z);
    marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: hot.has(inst.id) });
  }
  for (const panel of project.panels) {
    const x = panel.position.x;
    const y = panel.position.y;
    const z = panel.position.z;
    const w = panel.size.width;
    const h = panel.size.height;
    const d = panel.size.depth;
    const c: [number, number, number][] = [
      [x, y, z],
      [x + w, y, z],
      [x + w, y, z + d],
      [x, y, z + d],
      [x, y + h, z],
      [x + w, y + h, z],
      [x + w, y + h, z + d],
      [x, y + h, z + d],
    ];
    const segs: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    const on = hot.has(panel.id);
    for (const [i, j] of segs) {
      const a = iso(c[i][0], c[i][1], c[i][2]);
      const b = iso(c[j][0], c[j][1], c[j][2]);
      marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on });
    }
  }
  return marks;
}

export function isoSvgString(project: YardProject, step?: AssemblyStep, w = 280, h = 200) {
  const ids = step ? stepInstanceIds(project, step) : [];
  const box = isoViewBox(project, ids);
  const marks = isoMarks(project, ids);
  const lines = marks
    .map((m) => {
      const stroke = m.hot ? "#1a1612" : ids.length ? "#c4b9a8" : "#6b6358";
      const sw = m.hot ? 1.6 : 0.7;
      return `<line x1="${m.x1.toFixed(2)}" y1="${m.y1.toFixed(2)}" x2="${m.x2.toFixed(2)}" y2="${m.y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join("");
  const seen = new Set<string>();
  const dots = marks
    .flatMap((m) => [
      [m.x1, m.y1] as const,
      [m.x2, m.y2] as const,
    ])
    .map(([x, y]) => {
      const k = `${x.toFixed(1)}|${y.toFixed(1)}`;
      if (seen.has(k)) return "";
      seen.add(k);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${Math.max(0.35, box.w * 0.004)}" fill="#1a1612" fill-opacity="0.45"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.minX} ${box.minY} ${box.w} ${box.h}" fill="none">${lines}${dots}</svg>`;
}
