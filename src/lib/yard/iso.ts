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

export function isoViewBox(project: YardProject) {
  const pts: { x: number; y: number }[] = [];
  for (const inst of project.instances) {
    const p = homeOf(inst);
    pts.push(iso(p.x, p.y, p.z));
  }
  for (const panel of project.panels) {
    pts.push(iso(panel.position.x, panel.position.y, panel.position.z));
    pts.push(
      iso(
        panel.position.x + panel.size.width,
        panel.position.y + panel.size.height,
        panel.position.z + panel.size.depth,
      ),
    );
  }
  if (!pts.length) return { minX: -20, minY: -20, w: 40, h: 40 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(4, (maxX - minX) * 0.08);
  return { minX: minX - pad, minY: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export function isoMarks(project: YardProject, highlightIds: string[]) {
  const marks: { x1: number; y1: number; x2: number; y2: number; hot: boolean }[] = [];
  const hot = new Set(highlightIds);
  for (const inst of project.instances) {
    const item = getCatalogItem(inst.catalogId);
    const prim = item ? toPrimitive(item, inst.cutLength) : null;
    const p = homeOf(inst);
    const half = (prim?.length ?? 4) / 2;
    const dx = Math.sin(inst.rotation.y) * half;
    const dz = Math.cos(inst.rotation.y) * half;
    const a = iso(p.x - dx, p.y, p.z - dz);
    const b = iso(p.x + dx, p.y, p.z + dz);
    marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: hot.has(inst.id) });
  }
  for (const panel of project.panels) {
    const a = iso(panel.position.x, panel.position.y, panel.position.z);
    const b = iso(
      panel.position.x + panel.size.width,
      panel.position.y + panel.size.height * 0.15,
      panel.position.z + panel.size.depth,
    );
    marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: hot.has(panel.id) });
  }
  return marks;
}

export function isoSvgString(project: YardProject, step?: AssemblyStep, w = 280, h = 200) {
  const ids = step ? stepInstanceIds(project, step) : [];
  const box = isoViewBox(project);
  const marks = isoMarks(project, ids);
  const lines = marks
    .map((m) => {
      const stroke = m.hot ? "#1a1612" : ids.length ? "#c4b9a8" : "#6b6358";
      const sw = m.hot ? 1.6 : 0.7;
      return `<line x1="${m.x1.toFixed(2)}" y1="${m.y1.toFixed(2)}" x2="${m.x2.toFixed(2)}" y2="${m.y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.minX} ${box.minY} ${box.w} ${box.h}" fill="none">${lines}</svg>`;
}
