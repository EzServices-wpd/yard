import { inchFrac } from "./inchText";
import { getCatalogItem } from "./catalog";
import { panelWorldCorners, toPrimitive } from "./geometry";
import { homeOf } from "./ghost";
import type { AssemblyStep, YardProject } from "./types";
import { fmtUnitEnvelopeInches } from "./voiceHonesty";
import { stepInstanceIds } from "./assembly";

function iso(x: number, y: number, z: number) {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  return { x: (x - z) * c, y: -y + (x + z) * s };
}

function aabbEdges(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
  hot: boolean,
) {
  const c: [number, number, number][] = [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
  const segs: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return segs.map(([i, j]) => {
    const a = iso(c[i][0], c[i][1], c[i][2]);
    const b = iso(c[j][0], c[j][1], c[j][2]);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot };
  });
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
    for (const c of panelWorldCorners(panel)) pts.push(iso(c.x, c.y, c.z));
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
  const dense = project.instances.length > 80;
  const preferHot = hot.size > 0 && hot.size < project.instances.length * 0.8;
  const overview = dense && !preferHot;

  if (dense) {
    const W = project.overall.width;
    const H = project.overall.height;
    const D = project.overall.depth;
    marks.push(...aabbEdges(-W / 2, W / 2, 0, H, -D / 2, D / 2, overview));
  }

  if (!overview) {
    const stride = preferHot && hot.size > 140 ? Math.ceil(hot.size / 90) : 1;
    let n = 0;
    for (const inst of project.instances) {
      if (preferHot && !hot.has(inst.id)) continue;
      if (preferHot && stride > 1 && n++ % stride !== 0) continue;
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
      marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: hot.has(inst.id) || !hot.size });
    }
  }
  for (const panel of project.panels) {
    const on0 = hot.has(panel.id);
    if (panel.polygon) {
      const [ring0, ring1] = polygonRings(panel);
      for (let i = 0; i < ring0.length; i++) {
        const j = (i + 1) % ring0.length;
        for (const r of [ring0, ring1]) {
          const a = iso(r[i].x, r[i].y, r[i].z);
          const b = iso(r[j].x, r[j].y, r[j].z);
          marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on0 });
        }
        const a = iso(ring0[i].x, ring0[i].y, ring0[i].z);
        const b = iso(ring1[i].x, ring1[i].y, ring1[i].z);
        marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on0 });
      }
      // Holes: both rims of every hole, so an open centre reads as open.
      for (const rings of polygonHoleRings(panel)) {
        for (const r of rings) {
          for (let i = 0; i < r.length; i++) {
            const a = iso(r[i].x, r[i].y, r[i].z);
            const b = iso(r[(i + 1) % r.length].x, r[(i + 1) % r.length].y, r[(i + 1) % r.length].z);
            marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on0 });
          }
        }
      }
      continue;
    }
    if (panel.outline) {
      // Corner-unit plate: draw the real triangle / quarter-round ring, top and bottom, plus corner posts.
      const ring = outlineRingXZ(panel);
      const yb = panel.position.y;
      const yt = panel.position.y + panel.size.height;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        for (const yy of [yb, yt]) {
          const a = iso(p.x, yy, p.z);
          const b = iso(q.x, yy, q.z);
          marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on0 });
        }
      }
      for (const p of ring.length > 3 ? [ring[0], ring[1], ring[ring.length - 1]] : ring) {
        const a = iso(p.x, yb, p.z);
        const b = iso(p.x, yt, p.z);
        marks.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: on0 });
      }
      continue;
    }
    const corners = panelWorldCorners(panel);
    const c = corners.map((pt) => [pt.x, pt.y, pt.z] as [number, number, number]);
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
  return s.split("&").join("&").split("<").join("<");
}

/** The one shop-inch format (nearest 1/16, as every other drawing labels it): never "31.125"". */
function inchLabel(n: number) {
  return `${inchFrac(n)}"`;
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
    for (const c of panelWorldCorners(p)) bump(c.x, c.y, c.z);
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

function overviewBounds(project: YardProject) {
  const W = project.overall.width;
  const H = project.overall.height;
  const D = project.overall.depth;
  return { minX: -W / 2, maxX: W / 2, minY: 0, maxY: H, minZ: -D / 2, maxZ: D / 2 };
}

function useOverallDims(project: YardProject, highlightIds: string[]) {
  if (!project.fitted && project.kind !== "closet") return false;
  if (!highlightIds.length) return true;
  return highlightIds.length >= Math.max(1, project.panels.length) * 0.8;
}

export function isoDims(project: YardProject, highlightIds: string[]): IsoDim[] {
  const b = useOverallDims(project, highlightIds) ? overviewBounds(project) : hotBounds(project, highlightIds);
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
  const b = useOverallDims(project, highlightIds) ? overviewBounds(project) : hotBounds(project, highlightIds);
  if (b) {
    // Shared Dia×H densify for round tops — never AABB W×H×W diameter echo on iso/paper.
    const size = fmtUnitEnvelopeInches(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ, {
      shape: project.fitted?.unit?.shape,
      prompt: project.prompt,
      name: project.name,
      legs: project.fitted?.unit?.legs,
    });
    if (!panels.length && project.instances.length) {
      const n =
        !highlightIds.length || highlightIds.length >= project.instances.length * 0.8
          ? project.instances.length
          : highlightIds.length;
      return `${n} sticks · ${size}`;
    }
    return size;
  }
  return step?.title ?? "";
}

/** A filled face; `holes` are inner rings cut out with an even-odd fill. */
export type IsoFace = { points: string; hot: boolean; holes?: string[] };

/** SVG path data for a face and its holes; paint with fill-rule="evenodd" so each hole stays open. */
export function isoFacePath(f: IsoFace): string {
  return [f.points, ...(f.holes ?? [])].map((r) => `M ${r.split(" ").join(" L ")} Z`).join(" ");
}

export function isoFaces(project: YardProject, highlightIds: string[]) {
  const hot = new Set(highlightIds);
  const faces: IsoFace[] = [];
  for (const panel of project.panels) {
    const on = !hot.size || hot.has(panel.id);
    if (highlightIds.length && !on) continue;
    if (panel.polygon) {
      const [, top] = polygonRings(panel);
      const fmt = (ring: { x: number; y: number; z: number }[]) => ring.map((c) => {
        const p = iso(c.x, c.y, c.z);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      });
      const pts = fmt(top);
      const holes = polygonHoleRings(panel).map(([, front]) => fmt(front).join(" "));
      faces.push({ points: pts.join(" "), hot: on, ...(holes.length ? { holes } : {}) });
      continue;
    }
    if (panel.outline) {
      const yt = panel.position.y + panel.size.height;
      const pts = outlineRingXZ(panel).map((c) => {
        const p = iso(c.x, yt, c.z);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      });
      faces.push({ points: pts.join(" "), hot: on });
      continue;
    }
    const world = panelWorldCorners(panel);
    const { width: w, height: h, depth: d } = panel.size;
    const areaXY = w * h;
    const areaXZ = w * d;
    const areaYZ = h * d;
    let corners: { x: number; y: number; z: number }[];
    if (areaXY >= areaXZ && areaXY >= areaYZ) {
      corners = [world[3], world[2], world[6], world[7]];
    } else if (areaXZ >= areaYZ) {
      corners = [world[4], world[5], world[6], world[7]];
    } else {
      corners = [world[1], world[2], world[6], world[5]];
    }
    const pts = corners.map((c) => {
      const p = iso(c.x, c.y, c.z);
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
        f.holes
          ? `<path d="${isoFacePath(f)}" fill-rule="evenodd" fill="${f.hot ? "#d9cbb0" : "#ece6da"}" fill-opacity="${f.hot ? 0.85 : 0.35}" stroke="none"/>`
          : `<polygon points="${f.points}" fill="${f.hot ? "#d9cbb0" : "#ece6da"}" fill-opacity="${f.hot ? 0.85 : 0.35}" stroke="none"/>`,
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


/** Corner-unit plate outline in world XZ (right angle at the panel's −x/−z corner = the wall corner). */
export function outlineRingXZ(panel: import("./types").Panel): { x: number; z: number }[] {
  const { x, z } = panel.position;
  const { width: w, depth: d } = panel.size;
  if (panel.outline === "quarter-round") {
    const r = Math.min(w, d);
    const pts: { x: number; z: number }[] = [{ x, z }];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (Math.PI / 2);
      pts.push({ x: x + r * Math.cos(t), z: z + r * Math.sin(t) });
    }
    return pts;
  }
  return [
    { x, z },
    { x: x + w, z },
    { x, z: z + d },
  ];
}

/**
 * Odd-shape polygon plate as two world rings (bottom/back face and top/front face), in the same local frames as the
 * 3D bench (stick-cloud): "xz" = plan outline (x, z) extruded up by height; "xy" = face outline (x, y) extruded back
 * by depth; "zy" = face outline (z, y) extruded across x by width (a wheel on an x axle). Before, "zy" fell through
 * to "xy" and a flat wheel was drawn as a drum as deep as it is round.
 */
export function polygonRings(panel: import("./types").Panel): { x: number; y: number; z: number }[][] {
  return placeRings(panel, panel.polygon!.pts);
}

/** Segments per drawn hole circle (one class rule for every renderer). */
export function holeSegments(r: number): number {
  // One rule for every round hole (iso, PDF, parts plate, nest): enough sides that the flat between two corners
  // bows in no more than HOLE_SAG (1/64"), so a 1 1/2" birdhouse entrance reads round (16 sides)
  // (Critic #93: it drew as a ~9-gon). 12..64 sides: every side is a depth-sorted face in the PDF, so a dowel hole stays light.
  if (!(r > 0)) return HOLE_MIN_SIDES;
  const n = Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - HOLE_SAG / r)));
  return Math.max(HOLE_MIN_SIDES, Math.min(HOLE_MAX_SIDES, n));
}
export const HOLE_SAG = 1 / 64;
export const HOLE_MIN_SIDES = 12;
export const HOLE_MAX_SIDES = 64;

/**
 * Each hole of a polygon plate as its own pair of world rings (back/bottom, front/top), placed exactly like the
 * outline. Before, every renderer drew the outer edge only, so a wheel's open centre was a solid disc.
 */
export function polygonHoleRings(panel: import("./types").Panel): { x: number; y: number; z: number }[][][] {
  const holes = panel.polygon?.holes ?? [];
  return holes
    .filter((h) => h.r > 0)
    .map((h) => placeRings(panel, Array.from({ length: holeSegments(h.r) }, (_, k) => {
      const t = (k / holeSegments(h.r)) * Math.PI * 2;
      return [h.x + h.r * Math.cos(t), h.y + h.r * Math.sin(t)] as [number, number];
    })));
}

/**
 * Each hole as a true circle on both faces: centre c0 (back/bottom) and c1 (front/top) plus the two radius vectors
 * u, v (the circle is c + u·cos t + v·sin t). The placement is affine, so a renderer that projects these (an iso
 * view is affine too) can draw the rim as exact Bézier arcs instead of a polygon (Critic #93: 16-gon at 400 dpi).
 */
export type HoleCircle = { c0: { x: number; y: number; z: number }; c1: { x: number; y: number; z: number }; u: { x: number; y: number; z: number }; v: { x: number; y: number; z: number } };
export function polygonHoleCircles(panel: import("./types").Panel): HoleCircle[] {
  const holes = panel.polygon?.holes ?? [];
  return holes
    .filter((h) => h.r > 0)
    .map((h) => {
      const [r0, r1] = placeRings(panel, [[h.x, h.y], [h.x + h.r, h.y], [h.x, h.y + h.r]]);
      const d = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
      return { c0: r0[0], c1: r1[0], u: d(r0[1], r0[0]), v: d(r0[2], r0[0]) };
    });
}

function placeRings(panel: import("./types").Panel, pts: [number, number][]): { x: number; y: number; z: number }[][] {
  const poly = panel.polygon!;
  const { x, y, z } = panel.position;
  const { width: w, height: h, depth: d } = panel.size;
  let r0: { x: number; y: number; z: number }[];
  let r1: { x: number; y: number; z: number }[];
  if (poly.plane === "xz") {
    r0 = pts.map(([px, pz]) => ({ x: x + px, y, z: z + pz }));
    r1 = r0.map((p) => ({ ...p, y: y + h }));
  } else if (poly.plane === "zy") {
    r0 = pts.map(([pz, py]) => ({ x, y: y + py, z: z + pz }));
    r1 = r0.map((p) => ({ ...p, x: x + w }));
  } else {
    r0 = pts.map(([px, py]) => ({ x: x + px, y: y + py, z }));
    r1 = r0.map((p) => ({ ...p, z: z + d }));
  }
  // A turned part turns its outline too, whatever the plane (the 3D bench turns the whole mesh).
  const yaw = panel.yaw ?? 0;
  if (!yaw) return [r0, r1];
  // Turned part (a leaning rail lies along the depth): same R_y about the box centre as panelWorldCorners.
  const cx = x + w / 2;
  const cz = z + d / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rot = (p: { x: number; y: number; z: number }) => ({ x: cx + (p.x - cx) * c + (p.z - cz) * s, y: p.y, z: cz - (p.x - cx) * s + (p.z - cz) * c });
  return [r0.map(rot), r1.map(rot)];
}
