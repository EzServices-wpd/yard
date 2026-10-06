/**
 * The interference solve — the one place a built model becomes the solved model.
 *
 * Builders place parts by rule of thumb; a few of those rules let parts run into
 * each other (a counter through the uprights, a divider through the shelves, a
 * shelf into the ¼" back, a door drawn inside the box). This pass fixes the MODEL,
 * so the 3D bench, cut list, sheet nesting, Buy, steps, Where: measurements, PDF
 * pictures and cover size — all read from project.panels — follow automatically.
 *
 * Shop rules, in order:
 *  1. Faces (doors, glass doors, drawer fronts) are overlay: they sit on the front
 *     of the box, never inside it.
 *  2. A thin back is fitted first; shelves, tops, bottoms, dividers and drawer
 *     boxes stop at its front face (depth = box depth − back − setback).
 *  3. A part that butts into another is cut to meet it. Who is cut: the part whose
 *     END runs into the other. When both ends meet (a corner), a top or lid sits on
 *     its sides; otherwise sides win over dividers, dividers over tops/bottoms,
 *     those over shelves, those over rails and kicks, and drawer boxes give way
 *     to everything. Same kind: the shorter piece is cut.
 *  4. Drawer boxes are the opening minus 1" (½" per side-mount slide).
 * Sizes and trims snap to 1/8" — the same grid the cut list prints, so a cut size IS the model size.
 */
import { fractionizeInches } from "./inchText";
import type { Panel, YardProject } from "./types";
import { findInterference, panelPrisms, INTERFERENCE_TOL } from "./interference";
import { isBoundingDrawerPanel } from "./shopPlural";

type V = { x: number; y: number; z: number };
const SNAP = 1 / 8; // the cut list reads sizes to the 1/8" — the model is solved on the same grid
export const SLIDE_CLEARANCE = 1; // total, ½" each side — side-mount slides

export function isFacePanel(p: Panel): boolean {
  return p.type === "door" || p.type === "glass_panel" || /drawer\s*front/i.test(p.name);
}
export function isThinBack(p: Panel): boolean {
  return p.type === "back" && Math.min(p.size.width, p.size.height, p.size.depth) <= 0.26;
}
const shaped = (p: Panel) => !!(p.polygon || p.outline);

function worldBox(p: Panel) {
  const vs = panelPrisms(p).flatMap((q) => q.verts);
  return {
    x0: Math.min(...vs.map((v) => v.x)), x1: Math.max(...vs.map((v) => v.x)),
    y0: Math.min(...vs.map((v) => v.y)), y1: Math.max(...vs.map((v) => v.y)),
    z0: Math.min(...vs.map((v) => v.z)), z1: Math.max(...vs.map((v) => v.z)),
  };
}

/** Local frame of a panel (yaw about Y through its center). */
function frame(p: Panel) {
  const yaw = p.yaw ?? 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const ax: V = { x: c, y: 0, z: -s };
  const az: V = { x: s, y: 0, z: c };
  const origin = panelPrisms({ ...p, polygon: undefined, outline: undefined })[0].verts[0];
  return { ax, ay: { x: 0, y: 1, z: 0 } as V, az, origin };
}

const RANK: Record<string, number> = { upright: 6, back: 6, divider: 5, top: 4, counter: 4, bottom: 4, shelf: 3, deck: 3, rail: 2, kick: 2, mirror: 1, drawer: 0 };

type Cut = { axis: 0 | 1 | 2; end: "lo" | "hi"; amount: number };

/** Where b runs into a's END along one of a's own axes (the cut that would clear it). */
function endCut(a: Panel, b: Panel): Cut | null {
  const f = frame(a);
  const L = [a.size.width, a.size.height, a.size.depth];
  const axes = [f.ax, f.ay, f.az];
  const bv = panelPrisms(b).flatMap((q) => q.verts);
  let best: Cut | null = null;
  // A board's thickness (≤ 1¾") is never planed down; boxes (drawers) have no such axis.
  const thin = Math.min(...L) <= 1.75 ? L.indexOf(Math.min(...L)) : -1;
  for (const k of [0, 1, 2] as const) {
    if (k === thin) continue; // never plane a board thinner — cut its length or width
    const ts = bv.map((v) => (v.x - f.origin.x) * axes[k].x + (v.y - f.origin.y) * axes[k].y + (v.z - f.origin.z) * axes[k].z);
    const b0 = Math.min(...ts);
    const b1 = Math.max(...ts);
    const lo = b0 <= INTERFERENCE_TOL;
    const hi = b1 >= L[k] - INTERFERENCE_TOL;
    if (lo && hi) continue; // b covers the whole run — not an end
    let cut: Cut | null = null;
    if (lo && b1 > INTERFERENCE_TOL) cut = { axis: k, end: "lo", amount: b1 };
    else if (hi && b0 < L[k] - INTERFERENCE_TOL) cut = { axis: k, end: "hi", amount: L[k] - b0 };
    if (!cut || cut.amount >= L[k] * 0.5) continue;
    if (!best || cut.amount < best.amount) best = cut;
  }
  return best;
}

function applyCut(p: Panel, cut: Cut) {
  const amt = Math.ceil(cut.amount / SNAP - 1e-6) * SNAP;
  const f = frame(p);
  const key = (["width", "height", "depth"] as const)[cut.axis];
  const dir = [f.ax, f.ay, f.az][cut.axis];
  // Keep the far end where it is: the center moves half the cut toward it.
  const sign = cut.end === "lo" ? 1 : -1;
  const shift = (sign * amt) / 2;
  const w = p.size.width, h = p.size.height, d = p.size.depth;
  const cx = p.position.x + w / 2 + dir.x * shift;
  const cy = p.position.y + h / 2 + dir.y * shift;
  const cz = p.position.z + d / 2 + dir.z * shift;
  p.size = { ...p.size, [key]: p.size[key] - amt };
  p.position = { x: cx - p.size.width / 2, y: cy - p.size.height / 2, z: cz - p.size.depth / 2 };
}

/** Top/lid sitting on the top end of a side: the side is the one cut. */
function sitsOn(top: Panel, side: Panel, sideCut: Cut): boolean {
  if (!["top", "counter", "deck"].includes(top.type)) return false;
  if (sideCut.axis !== 1 || sideCut.end !== "hi") return false;
  const t = worldBox(top);
  const s = worldBox(side);
  return t.x0 <= s.x0 + INTERFERENCE_TOL && t.x1 >= s.x1 - INTERFERENCE_TOL && t.z0 <= s.z0 + INTERFERENCE_TOL && t.z1 >= s.z1 - INTERFERENCE_TOL;
}

/**
 * Angled members (legs and aprons turned on a triangle or hexagon): the square end of one
 * runs into the side of the other. Shorten the long axis from the end that touches until
 * the two just meet (searched, then snapped to 1/16").
 */
function searchCut(a: Panel, b: Panel): Cut | null {
  if (!a.yaw && !b.yaw) return null;
  if (isThinBack(a) || isFacePanel(a) || shaped(a)) return null;
  const L = [a.size.width, a.size.height, a.size.depth];
  const k = (L.indexOf(Math.max(...L)) as 0 | 1 | 2);
  const f = frame(a);
  const ax = [f.ax, f.ay, f.az][k];
  const bv = panelPrisms(b).flatMap((q) => q.verts);
  const ts = bv.map((v) => (v.x - f.origin.x) * ax.x + (v.y - f.origin.y) * ax.y + (v.z - f.origin.z) * ax.z);
  const end: "lo" | "hi" = Math.min(...ts.map((t) => Math.abs(t))) <= Math.min(...ts.map((t) => Math.abs(L[k] - t))) ? "lo" : "hi";
  const clear = (amt: number) => {
    const t: Panel = { ...a, position: { ...a.position }, size: { ...a.size } };
    applyCut(t, { axis: k, end, amount: amt });
    return findInterference({ panels: [t, b] }).length === 0;
  };
  let hi = L[k] / 3;
  if (!clear(hi)) return null;
  let lo = 0;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (clear(mid)) hi = mid;
    else lo = mid;
  }
  return { axis: k, end, amount: hi };
}

function chooseCut(a: Panel, b: Panel): { p: Panel; cut: Cut } | null {
  if (a.yaw || b.yaw) {
    const ra = RANK[a.type] ?? 2;
    const rb = RANK[b.type] ?? 2;
    const la = Math.max(a.size.width, a.size.height, a.size.depth);
    const lb = Math.max(b.size.width, b.size.height, b.size.depth);
    const first = ra < rb || (ra === rb && la <= lb) ? [a, b] : [b, a];
    for (const [p, q] of [first, [first[1], first[0]]]) {
      const c = endCut(p, q) ?? searchCut(p, q);
      if (c) return { p, cut: c };
    }
    return null;
  }
  const ca = isThinBack(a) || isFacePanel(a) || shaped(a) ? null : endCut(a, b);
  const cb = isThinBack(b) || isFacePanel(b) || shaped(b) ? null : endCut(b, a);
  if (ca && !cb) return { p: a, cut: ca };
  if (cb && !ca) return { p: b, cut: cb };
  if (!ca || !cb) return null;
  if (sitsOn(b, a, ca)) return { p: a, cut: ca };
  if (sitsOn(a, b, cb)) return { p: b, cut: cb };
  const ra = RANK[a.type] ?? 2;
  const rb = RANK[b.type] ?? 2;
  if (ra !== rb) return ra < rb ? { p: a, cut: ca } : { p: b, cut: cb };
  const la = Math.max(a.size.width, a.size.height, a.size.depth);
  const lb = Math.max(b.size.width, b.size.height, b.size.depth);
  return la <= lb ? { p: a, cut: ca } : { p: b, cut: cb };
}

function containedIn(a: Panel, b: Panel): boolean {
  if (isFacePanel(a) || a.type === "drawer" || a.type === "mirror" || isThinBack(a) || shaped(a) || shaped(b)) return false;
  const A = worldBox(a);
  const B = worldBox(b);
  const t = INTERFERENCE_TOL;
  return A.x0 >= B.x0 - t && A.x1 <= B.x1 + t && A.y0 >= B.y0 - t && A.y1 <= B.y1 + t && A.z0 >= B.z0 - t && A.z1 <= B.z1 + t;
}

/**
 * v (divider) passes clean through h (fixed shelf): the shop answer is an egg-crate
 * half-lap — a ¾" notch halfway into each board so they slot together. The model
 * declares the joint on both parts and each cut line says where the notch goes.
 */
/** Notch stations per lapped panel for the current solve. */
const lapStations = new WeakMap<Panel, number[]>();

function crossLap(v: Panel, h: Panel): boolean {
  if (v.type !== "divider" || !["shelf", "deck"].includes(h.type)) return false;
  if (v.yaw || shaped(v) || h.yaw || shaped(h)) return false;
  const V = worldBox(v);
  const H = worldBox(h);
  const t = INTERFERENCE_TOL;
  if (!(H.y0 > V.y0 + t && H.y1 < V.y1 - t && V.x0 > H.x0 + t && V.x1 < H.x1 - t)) return false;
  const depth = Math.min(V.z1, H.z1) - Math.max(V.z0, H.z0);
  const half = fmt16(depth / 2);
  if (!(v.joints ?? []).some((j) => j.with === h.id && j.kind === "lap")) {
    v.joints = [...(v.joints ?? []), { with: h.id, kind: "lap" }];
  }
  if (!(h.joints ?? []).some((j) => j.with === v.id && j.kind === "lap")) {
    h.joints = [...(h.joints ?? []), { with: v.id, kind: "lap" }];
  }
  // One notch per crossing: the divider lists every shelf height it crosses,
  // the shelf lists every divider position along its length.
  const addAt = (p: Panel, at: number) => {
    const list = lapStations.get(p) ?? [];
    if (!list.some((x) => Math.abs(x - at) < 1 / 32)) list.push(at);
    list.sort((a, b) => a - b);
    lapStations.set(p, list);
    return list;
  };
  const vAt = addAt(v, H.y0 - V.y0);
  const hAt = addAt(h, V.x0 - H.x0);
  const list = (xs: number[]) =>
    xs.length === 1 ? `${fmt16(xs[0])}"` : `${xs.slice(0, -1).map((x) => `${fmt16(x)}"`).join(", ")} and ${fmt16(xs[xs.length - 1])}"`;
  const vNote = `Egg-crate half-lap: cut ${vAt.length === 1 ? "a notch" : `${vAt.length} notches`} ${fmt16(H.y1 - H.y0)}" wide × ${half}" deep from the front edge, one where each shelf crosses, at ${list(vAt)} up from the bottom end.`;
  const hNote = `Egg-crate half-lap: cut ${hAt.length === 1 ? "a notch" : `${hAt.length} notches`} ${fmt16(V.x1 - V.x0)}" wide × ${half}" deep from the back edge, one at each divider crossing, at ${list(hAt)} from the left end.`;
  const setNote = (p: Panel, note: string) => {
    const base = (p.cutNote ?? "").replace(/\s*Egg-crate half-lap:[^]*?(?:bottom end|left end|divider crossing)\./, "").trim();
    p.cutNote = base ? `${base} ${note}` : note;
  };
  setNote(v, vNote);
  setNote(h, hNote);
  return true;
}

/**
 * A leg/post (both plan sides ≤ 3½") that runs clean through a flat board (seat, shelf,
 * top) inside its outline, touching its edge: the board is notched around the post.
 * Declared on both parts; the cut line says the notch size.
 */
function notchAround(board: Panel, post: Panel): boolean {
  if (!["deck", "shelf", "top", "bottom"].includes(board.type) || post.type !== "upright") return false;
  if (board.yaw || post.yaw || shaped(board) || shaped(post)) return false;
  if (post.size.width > 3.5 || post.size.depth > 3.5) return false;
  const B = worldBox(board);
  const P0 = worldBox(post);
  const t = INTERFERENCE_TOL;
  if (!(P0.y0 < B.y0 - t && P0.y1 > B.y1 + t)) return false; // post must pass through
  if (!(P0.x0 >= B.x0 - t && P0.x1 <= B.x1 + t && P0.z0 >= B.z0 - t && P0.z1 <= B.z1 + t)) return false;
  const onEdge = Math.abs(P0.x0 - B.x0) < t || Math.abs(P0.x1 - B.x1) < t || Math.abs(P0.z0 - B.z0) < t || Math.abs(P0.z1 - B.z1) < t;
  if (!onEdge) return false;
  board.joints = [...(board.joints ?? []), { with: post.id, kind: "notch" }];
  post.joints = [...(post.joints ?? []), { with: board.id, kind: "notch" }];
  const note = `Notch the corners ${fmt16(P0.x1 - P0.x0)}" × ${fmt16(P0.z1 - P0.z0)}" so the board fits around the legs.`;
  if (!board.cutNote?.includes("Notch the corners")) board.cutNote = board.cutNote ? `${board.cutNote} ${note}` : note;
  return true;
}

/** Inches to the nearest 1/16 in shop fractions (e.g. 5 7/8). */
function fmt16(n: number): string {
  const sixteenths = Math.round(n * 16);
  const whole = Math.floor(sixteenths / 16);
  let num = sixteenths % 16;
  let den = 16;
  while (num && num % 2 === 0) { num /= 2; den /= 2; }
  return num ? (whole ? `${whole} ${num}/${den}` : `${num}/${den}`) : `${whole}`;
}

/** Rule 1: faces overlay the front of the box. */
function overlayFaces(panels: Panel[]) {
  const body = panels.filter((p) => !isFacePanel(p) && p.type !== "mirror");
  for (const f of panels.filter(isFacePanel)) {
    if (f.yaw || Math.min(f.size.width, f.size.height, f.size.depth) !== f.size.depth) continue;
    const hits = findInterference({ panels: [f, ...body] }).filter((h) => h.a === f || h.b === f);
    if (!hits.length) continue;
    // The overlay plane is the face of the box behind this door/front, not just the part it hit.
    const fb = worldBox(f);
    const behind = body.filter((q) => BODY.has(q.type) && !q.yaw).map(worldBox).filter((w) => w.x1 > fb.x0 - 1 && w.x0 < fb.x1 + 1 && w.y1 > fb.y0 - 1 && w.y0 < fb.y1 + 1 && w.z0 <= fb.z0 + 1);
    const front = Math.max(...hits.map((h) => worldBox(h.a === f ? h.b : h.a).z1), ...behind.map((w) => w.z1));
    f.position = { ...f.position, z: front };
  }
}

/** Rule 1a: a false front screws onto its drawer box, so the box runs forward to meet it. */
function seatDrawerBoxes(panels: Panel[]) {
  for (const f of panels.filter((p) => /drawer\s*front/i.test(p.name) && !p.yaw)) {
    const fb = worldBox(f);
    for (const d of panels.filter((p) => p.type === "drawer" && !p.yaw)) {
      const b = worldBox(d);
      const gap = fb.z0 - b.z1;
      if (gap > 1e-6 && gap <= 1 && b.x1 > fb.x0 + 0.5 && b.x0 < fb.x1 - 0.5 && b.y1 > fb.y0 + 0.5 && b.y0 < fb.y1 - 0.5) d.position = { ...d.position, z: d.position.z + gap };
    }
  }
}

/**
 * Rule 1b: a unit that goes INTO a space (alcove, nook, recess, pocket) keeps its faces inside that
 * space: the box gives up the face thickness at the front so the door face lands on the opening depth.
 */
function insetToOpening(panels: Panel[], depth: number) {
  const faces = panels.filter(isFacePanel).filter((f) => !f.yaw);
  if (!faces.length) return;
  const body = panels.filter((p) => !isFacePanel(p) && !p.yaw);
  if (!body.length) return;
  const back = Math.min(...body.map((p) => p.position.z));
  const front = Math.max(...faces.map((f) => f.position.z + f.size.depth));
  const over = Math.round((front - back - depth) * 16) / 16;
  if (!(over > 1 / 16)) return;
  const limit = back + depth - over;
  for (const p of body) {
    const z1 = p.position.z + p.size.depth;
    if (z1 <= limit + 1e-6) continue;
    const cut = z1 - limit;
    // A part deep enough loses the overrun at its front; a thin front strip (kick, rail) moves back.
    if (p.size.depth - cut >= 0.5 && p.size.depth > 1) p.size = { ...p.size, depth: Math.round((p.size.depth - cut) / SNAP) * SNAP };
    else p.position = { ...p.position, z: p.position.z - cut };
  }
  for (const f of faces) f.position = { ...f.position, z: f.position.z - over };
}

/** Rule 4: drawer box = clear opening − slide clearance, centered. */
function fitDrawerBoxes(panels: Panel[]) {
  for (const d of panels.filter((p) => isBoundingDrawerPanel(p.name, p.type) && !p.yaw)) {
    const b = worldBox(d);
    const walls = panels.filter((q) => {
      if (q === d || isFacePanel(q) || q.type === "drawer" || isThinBack(q)) return false;
      const w = worldBox(q);
      return w.y1 > b.y0 + 0.5 && w.y0 < b.y1 - 0.5 && w.z1 > b.z0 + 0.5 && w.z0 < b.z1 - 0.5;
    });
    const cx = (b.x0 + b.x1) / 2;
    const left = walls.map(worldBox).filter((w) => w.x1 <= cx).sort((p, q) => q.x1 - p.x1)[0];
    const right = walls.map(worldBox).filter((w) => w.x0 >= cx).sort((p, q) => p.x0 - q.x0)[0];
    if (!left || !right) continue;
    const opening = right.x0 - left.x1;
    const want = Math.floor((opening - SLIDE_CLEARANCE) * 8 + 1e-6) / 8;
    if (want <= 2 || d.size.width <= want + INTERFERENCE_TOL) continue;
    d.size = { ...d.size, width: want };
    d.position = { ...d.position, x: left.x1 + SLIDE_CLEARANCE / 2 };
  }
}

export const KICK_SETBACK = 3.5; // toe space: kick face sits 3½" back from the face of the box
export const FRONT_REVEAL = 1 / 16; // gap each side between neighbouring fronts

const BODY = new Set(["upright", "divider", "bottom", "top", "counter", "shelf"]);

/** Recessed kick strips, as the words say: face 3½" back from the box face it sits under. */
function recessKicks(panels: Panel[]) {
  const body = panels.filter((p) => BODY.has(p.type) && !p.yaw);
  if (!body.length) return;
  for (const k of panels.filter((p) => p.type === "kick" && !p.yaw && !shaped(p))) {
    const kb = worldBox(k);
    const over = body.map(worldBox).filter((b) => b.x1 > kb.x0 + 0.1 && b.x0 < kb.x1 - 0.1);
    if (!over.length) continue;
    const front = Math.max(...over.map((b) => b.z1));
    const back = Math.min(...over.map((b) => b.z0));
    const mid = (front + back) / 2;
    if (kb.z1 > mid && front - kb.z1 < KICK_SETBACK - INTERFERENCE_TOL) k.position = { ...k.position, z: front - KICK_SETBACK - k.size.depth };
    else if (kb.z0 < mid && kb.z0 - back < KICK_SETBACK - INTERFERENCE_TOL) k.position = { ...k.position, z: back + KICK_SETBACK };
  }
}

/**
 * Every drawer box gets a front you can see and pull — same overlay style as the doors:
 * it covers the opening and half of each wall beside it, less a 1/16" reveal each side,
 * as tall as the box. Builders that already drew a front keep theirs.
 */
function addDrawerFronts(panels: Panel[]) {
  const boxes = panels.filter((p) => isBoundingDrawerPanel(p.name, p.type) && !p.yaw);
  for (const d of boxes) {
    const b = worldBox(d);
    const has = panels.some((q) => {
      if (!/drawer\s*front/i.test(q.name) && q.type !== "door") return false;
      const w = worldBox(q);
      return w.x1 > b.x0 + 0.5 && w.x0 < b.x1 - 0.5 && w.y1 > b.y0 + 0.5 && w.y0 < b.y1 - 0.5 && w.z1 >= b.z1 - 1;
    });
    if (has) continue;
    const walls = panels.filter((q) => {
      if (q === d || isFacePanel(q) || q.type === "drawer" || isThinBack(q) || !["upright", "divider"].includes(q.type)) return false;
      const w = worldBox(q);
      return w.y1 > b.y0 + 0.5 && w.y0 < b.y1 - 0.5 && w.z1 > b.z0 + 0.5 && w.z0 < b.z1 - 0.5;
    }).map(worldBox);
    const cx = (b.x0 + b.x1) / 2;
    const left = walls.filter((w) => w.x1 <= cx + 0.01).sort((p, q) => q.x1 - p.x1)[0];
    const right = walls.filter((w) => w.x0 >= cx - 0.01).sort((p, q) => p.x0 - q.x0)[0];
    const x0 = left ? left.x1 - (left.x1 - left.x0) / 2 + FRONT_REVEAL : b.x0;
    const x1 = right ? right.x0 + (right.x1 - right.x0) / 2 - FRONT_REVEAL : b.x1;
    const front = Math.max(b.z1, ...walls.map((w) => w.z1));
    const name = /drawer/i.test(d.name) ? d.name.replace(/drawer/i, (m) => `${m} front`) : `${d.name} front`;
    panels.push({
      id: `${d.id}-front`,
      type: "rail",
      name,
      position: { x: x0, y: b.y0, z: front },
      size: { width: Math.floor((x1 - x0) * 8 + 1e-6) / 8, height: d.size.height, depth: 0.75 },
      materialId: d.materialId,
    });
  }
}

/** Put every plain board on the 1/8" grid (the cut list's grid); a turned board keeps its center. */
function snapSizes(panels: Panel[]) {
  for (const p of panels) {
    if (shaped(p) || p.blank) continue;
    const r = (v: number) => (Math.abs(v * 8 - Math.round(v * 8)) < 1e-6 ? v : Math.round(v * 8) / 8);
    const size = { width: r(p.size.width), height: r(p.size.height), depth: r(p.size.depth) };
    if (p.yaw) {
      const c = { x: p.position.x + p.size.width / 2, z: p.position.z + p.size.depth / 2 };
      p.position = { x: c.x - size.width / 2, y: p.position.y, z: c.z - size.depth / 2 };
    }
    p.size = size;
  }
}

export type SolveLog = { part: string; change: string }[];

/** Solve the model in place-safe copy. Returns the solved project (same object shape). */
/** Every solved model speaks shop fractions in its title and notes — never raw floats. */
export function solveModel<T extends YardProject>(project: T): T {
  const solved = solveModelCore(project);
  return {
    ...solved,
    name: fractionizeInches(solved.name),
    notes: solved.notes?.map((n) => fractionizeInches(n)),
  };
}

function solveModelCore<T extends YardProject>(project: T): T {
  if (!project.panels?.length) return project;
  const panels = project.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  snapSizes(panels);
  recessKicks(panels);
  addDrawerFronts(panels);
  overlayFaces(panels);
  seatDrawerBoxes(panels);
  const room = project.fitted?.opening;
  if (room && (room.kind === "alcove" || room.kind === "pocket") && room.depth > 0) insetToOpening(panels, room.depth);
  for (let pass = 0; pass < 12; pass++) {
    const hits = findInterference({ panels });
    if (!hits.length) break;
    const touched = new Set<string>();
    let moved = false;
    for (const h of hits) {
      if (touched.has(h.a.id) || touched.has(h.b.id)) continue;
      // A post running up through a seat/shelf/top at its edge: notch the board around it.
      if (notchAround(h.a, h.b) || notchAround(h.b, h.a)) {
        touched.add(h.a.id);
        touched.add(h.b.id);
        moved = true;
        continue;
      }
      const pick = chooseCut(h.a, h.b);
      if (!pick) {
        // Same board drawn twice (a carcase top buried inside a thicker desktop): keep the outer one.
        const inner = containedIn(h.a, h.b) ? h.a : containedIn(h.b, h.a) ? h.b : null;
        if (inner) {
          panels.splice(panels.indexOf(inner), 1);
          touched.add(inner.id);
          moved = true;
          continue;
        }
        // A divider crossing a fixed shelf: egg-crate half-lap, declared on both parts.
        if (crossLap(h.a, h.b) || crossLap(h.b, h.a)) {
          touched.add(h.a.id);
          touched.add(h.b.id);
          moved = true;
        }
        continue;
      }
      applyCut(pick.p, pick.cut);
      touched.add(pick.p.id);
      moved = true;
    }
    if (!moved) break;
  }
  fitDrawerBoxes(panels);
  return { ...project, panels };
}
