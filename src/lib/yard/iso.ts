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
  const pad = Math.max(6, (maxX - minX) * 0.22);
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

function escXml(s: string) {
  return s.replace(/&/g, "&").replace(/</g, "<");
}

function inchLabel(n: number) {
  const r = Math.round(n * 8) / 8;
  if (Number.isInteger(r)) return `${r}"`;
  return `${String(r.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""))}"`;
}

function hotBounds(project: YardProject, ids: string[]) {
  const hot = new Set(ids);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const bump = (x: number, y: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  for (const p of project.panels) {
    if (hot.size && !hot.has(p.id)) continue;
    bump(p.position.x, p.position.y, p.position.z);
    bump(p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth);
  }
  for (const inst of project.instances) {
    if (hot.size && !hot.has(inst.id)) continue;
    if (inst.from && inst.to) {
      bump(inst.from.x, inst.from.y, inst.from.z);
      bump(inst.to.x, inst.to.y, inst.to.z);
    } else {
      const p = homeOf(inst);
      bump(p.x, p.y, p.z);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export type IsoDim = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
  label: string;
};

export function isoDims(project: YardProject, highlightIds: string[]): IsoDim[] {
  const b = hotBounds(project, highlightIds);
  if (!b) return [];
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const d = b.maxZ - b.minZ;
  const gap = Math.max(2.2, Math.max(w, h, d) * 0.08);
  const out: IsoDim[] = [];
  const add = (a: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }, label: string) => {
    const p = iso(a.x, a.y, a.z);
    const q = iso(c.x, c.y, c.z);
    out.push({
      x1: p.x,
      y1: p.y,
      x2: q.x,
      y2: q.y,
      lx: (p.x + q.x) / 2,
      ly: (p.y + q.y) / 2,
      label,
    });
  };
  if (w > 0.4) add({ x: b.minX, y: b.minY - gap, z: b.maxZ }, { x: b.maxX, y: b.minY - gap, z: b.maxZ }, inchLabel(w));
  if (h > 0.4) add({ x: b.maxX + gap, y: b.minY, z: b.maxZ }, { x: b.maxX + gap, y: b.maxY, z: b.maxZ }, inchLabel(h));
  if (d > 1.2) add({ x: b.minX - gap * 0.4, y: b.minY, z: b.minZ }, { x: b.minX - gap * 0.4, y: b.minY, z: b.maxZ }, inchLabel(d));
  return out;
}

export function isoCaption(project: YardProject, highlightIds: string[], step?: AssemblyStep) {
  const panels = highlightIds.length
    ? project.panels.filter((p) => highlightIds.includes(p.id))
    : project.panels;
  if (panels.length === 1) {
    const p = panels[0];
    return `${p.name} · ${inchLabel(p.size.width)} × ${inchLabel(p.size.height)} × ${inchLabel(p.size.depth)}`;
  }
  const b = hotBounds(project, highlightIds);
  if (b) {
    return `${inchLabel(b.maxX - b.minX)} W × ${inchLabel(b.maxY - b.minY)} H × ${inchLabel(b.maxZ - b.minZ)} D`;
  }
  return step?.title ?? "";
}

export function isoFaces(project: YardProject, highlightIds: string[]) {
  const hot = new Set(highlightIds);
  const faces: { points: string; hot: boolean }[] = [];
  for (const panel of project.panels) {
    const on = !hot.size || hot.has(panel.id);
    if (highlightIds.length && !on) continue;
    const x = panel.position.x;
    const y = panel.position.y;
    const z = panel.position.z;
    const { width: w, height: h, depth: d } = panel.size;
    const areaXY = w * h;
    const areaXZ = w * d;
    const areaYZ = h * d;
    let corners: [number, number, number][];
    if (areaXY >= areaXZ && areaXY >= areaYZ) {
      corners = [
        [x, y, z + d],
        [x + w, y, z + d],
        [x + w, y + h, z + d],
        [x, y + h, z + d],
      ];
    } else if (areaXZ >= areaYZ) {
      corners = [
        [x, y + h, z],
        [x + w, y + h, z],
        [x + w, y + h, z + d],
        [x, y + h, z + d],
      ];
    } else {
      corners = [
        [x + w, y, z],
        [x + w, y, z + d],
        [x + w, y + h, z + d],
        [x + w, y + h, z],
      ];
    }
    const pts = corners.map(([cx, cy, cz]) => {
      const p = iso(cx, cy, cz);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    });
    faces.push({ points: pts.join(" "), hot: on });
  }
  return faces;
}

export function isoSvgString(project: YardProject, step?: AssemblyStep, w = 280, h = 200) {
  const ids = step ? stepInstanceIds(project, step) : [];
  const box = isoViewBox(project, ids);
  const marks = isoMarks(project, ids);
  const dims = isoDims(project, ids);
  const faces = isoFaces(project, ids);
  const caption = isoCaption(project, ids, step);
  const fs = Math.max(1.6, box.w * 0.042);
  const faceSvg = faces
    .map(
      (f) =>
        `<polygon points="${f.points}" fill="${f.hot ? "#d9cbb0" : "#ece6da"}" fill-opacity="${f.hot ? 0.85 : 0.35}" stroke="none"/>`,
    )
    .join("");
  const lines = marks
    .map((m) => {
      const stroke = m.hot ? "#1a1612" : ids.length ? "#c4b9a8" : "#6b6358";
      const sw = m.hot ? 1.6 : 0.7;
      return `<line x1="${m.x1.toFixed(2)}" y1="${m.y1.toFixed(2)}" x2="${m.x2.toFixed(2)}" y2="${m.y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join("");
  const dimSvg = dims
    .map(
      (d) =>
        `<line x1="${d.x1.toFixed(2)}" y1="${d.y1.toFixed(2)}" x2="${d.x2.toFixed(2)}" y2="${d.y2.toFixed(2)}" stroke="#6b6358" stroke-width="0.55"/>` +
        `<text x="${d.lx.toFixed(2)}" y="${(d.ly - fs * 0.15).toFixed(2)}" text-anchor="middle" font-size="${fs.toFixed(2)}" font-family="ui-sans-serif, system-ui, sans-serif" fill="#1a1612">${d.label}</text>`,
    )
    .join("");
  const cap = caption
    ? `<text x="${(box.minX + box.w / 2).toFixed(2)}" y="${(box.minY + box.h - fs * 0.4).toFixed(2)}" text-anchor="middle" font-size="${(fs * 0.85).toFixed(2)}" font-family="ui-sans-serif, system-ui, sans-serif" fill="#6b6358">${escXml(caption)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.minX} ${box.minY} ${box.w} ${box.h}" fill="none">${faceSvg}${lines}${dimSvg}${cap}</svg>`;
}
