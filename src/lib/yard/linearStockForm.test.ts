/**
 * Stock changes what a part is made of. It does not choose a different shape.
 * Every Ideas prompt and every recipe (learned included) is built in sheet/board
 * and in pipe, dowel, and 2×2. A build that cannot use that stock has to say so.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { isLoadSurface } from "./memberStock.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { RECIPES } from "./recipes.ts";
import { recipePrompt } from "./recipeIdeas.ts";
import { IDEAS } from "./ideas.ts";
import { spokenTierCount } from "./fittedShared.ts";
import { getCatalogItem } from "./catalog.ts";
import { binderKind, highWay } from "./joints.ts";
import type { CatalogItem, Panel, Vec3, YardProject } from "./types.ts";

const PVC = "pvc-3-4-sch40";
const DOWEL = "dowel-1-2-36";
const TWO = "lumber-2x2-8";
const PLY = "plywood-3-4-4x8";

type Seg = { a: Vec3; b: Vec3; role: string; name: string; section: number };

function isFace(item: CatalogItem | undefined): boolean {
  if (!item) return false;
  return item.formFactor === "sheet" || item.formFactor === "board" || item.category === "sheet_goods" || item.category === "cardboard";
}

function sectionOf(id: string | undefined, fallback: number): number {
  const item = id ? getCatalogItem(id) : undefined;
  if (!item) return fallback;
  return Math.max(item.dims.diameter ?? 0, item.dims.thickness ?? 0, item.dims.width ?? 0, item.dims.height ?? 0, 0.25);
}

function skipPanel(panel: Panel): boolean {
  return panel.type === "glass_panel" || panel.type === "mirror" || panel.materialId === "window-unit" || panel.materialId === "prehung-door" || panel.materialId === "hardware" || panel.materialId === "coat-hooks";
}

function centerline(panel: Panel): Seg {
  const dims = (
    [
      ["x", panel.size.width],
      ["y", panel.size.height],
      ["z", panel.size.depth],
    ] as const
  ).sort((a, b) => a[1] - b[1]);
  const long = dims[2][0];
  const a = {
    x: panel.position.x + panel.size.width / 2,
    y: panel.position.y + panel.size.height / 2,
    z: panel.position.z + panel.size.depth / 2,
  };
  const b = { ...a };
  if (long === "x") {
    a.x = panel.position.x;
    b.x = panel.position.x + panel.size.width;
  } else if (long === "y") {
    a.y = panel.position.y;
    b.y = panel.position.y + panel.size.height;
  } else {
    a.z = panel.position.z;
    b.z = panel.position.z + panel.size.depth;
  }
  const thin = Math.min(panel.size.width, panel.size.height, panel.size.depth);
  return { a, b, role: panel.type, name: panel.name, section: Math.max(thin, 0.25) };
}

/** Stick frames use their cut members. A board build's members are the panels themselves. */
function segs(project: YardProject): Seg[] {
  const sticks = project.instances
    .filter((inst) => inst.from && inst.to)
    .map((inst) => ({ a: inst.from!, b: inst.to!, role: inst.role ?? "", name: inst.role ?? "", section: sectionOf(inst.catalogId, 1) }));
  const panels = project.panels.filter((panel) => !skipPanel(panel)).map(centerline);
  return sticks.length ? [...sticks, ...panels] : panels;
}

function isStickPanel(panel: Panel): boolean {
  const dims = [panel.size.width, panel.size.height, panel.size.depth].sort((a, b) => a - b);
  return dims[1] <= 4 && dims[2] >= dims[1] * 2.5;
}

type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

function boxOfPanel(panel: Panel): Box {
  return {
    minX: panel.position.x,
    maxX: panel.position.x + panel.size.width,
    minY: panel.position.y,
    maxY: panel.position.y + panel.size.height,
    minZ: panel.position.z,
    maxZ: panel.position.z + panel.size.depth,
  };
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return a.minX <= b.maxX + gap && b.minX <= a.maxX + gap && a.minY <= b.maxY + gap && b.minY <= a.maxY + gap && a.minZ <= b.maxZ + gap && b.minZ <= a.maxZ + gap;
}

function endBox(panel: Panel, end: 0 | 1): Box {
  const dims = (
    [
      ["x", panel.size.width, panel.position.x],
      ["y", panel.size.height, panel.position.y],
      ["z", panel.size.depth, panel.position.z],
    ] as const
  ).sort((a, b) => a[1] - b[1]);
  const long = dims[2];
  const cap = Math.min(0.35, long[1] / 2);
  const box = boxOfPanel(panel);
  const at = end === 0 ? long[2] : long[2] + long[1] - cap;
  if (long[0] === "x") return { ...box, minX: at, maxX: at + cap };
  if (long[0] === "y") return { ...box, minY: at, maxY: at + cap };
  return { ...box, minZ: at, maxZ: at + cap };
}

/** A board or sheet build: a long stick's end has to land on another part, unless it is a foot or a designed arm. */
function panelFreeEnds(project: YardProject): string[] {
  const panels = project.panels.filter((panel) => !skipPanel(panel));
  const sticks = panels.filter(isStickPanel);
  const vertical = sticks.filter((panel) => panel.size.height >= panel.size.width && panel.size.height >= panel.size.depth && panel.size.height > 6);
  // A frame is posts and rails. A single board, a slat field, or a loose tip is not one.
  if (vertical.length < 2 || sticks.length < vertical.length + 2) return [];
  const floor = Math.min(...panels.map((p) => p.position.y));
  const problems: string[] = [];
  for (const panel of sticks) {
    const loose = ([0, 1] as const).filter((end) => {
      const cap = endBox(panel, end);
      const hits = panels.some((other) => other !== panel && overlaps(cap, boxOfPanel(other), 0.45));
      const vertical = panel.size.height >= panel.size.width && panel.size.height >= panel.size.depth;
      const foot = vertical && (end === 0 ? panel.position.y : panel.position.y + panel.size.height) <= floor + 0.5 && panel.size.height === Math.max(panel.size.width, panel.size.height, panel.size.depth);
      return !hits && !foot;
    });
    if (!loose.length) continue;
    if (designedArm({ role: panel.type, name: panel.name } as Seg) && loose.length === 1) continue;
    problems.push(`${panel.name} free end`);
    if (problems.length >= 3) break;
  }
  return problems;
}

function len(s: Seg): number {
  return Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y, s.b.z - s.a.z);
}

function distPointSeg(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = ab2 < 1e-8 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t), p.z - (a.z + abz * t));
}

/** A load surface is spanned when members running its long way cover most of that length and sit on the surface. */
function spans(panel: Panel, mem: Seg[]): boolean {
  const axes = (
    [
      ["x", panel.position.x, panel.size.width],
      ["y", panel.position.y, panel.size.height],
      ["z", panel.position.z, panel.size.depth],
    ] as const
  ).sort((a, b) => a[2] - b[2]);
  const long = axes[2];
  const rest = axes.slice(0, 2);
  if (long[2] < 1) return true;
  const along = mem.filter((s) => {
    const travel = Math.abs(s.b[long[0]] - s.a[long[0]]);
    if (travel < len(s) * 0.65) return false;
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2, z: (s.a.z + s.b.z) / 2 };
    const tol = Math.max(s.section, 1.5);
    return rest.every((ax) => mid[ax[0]] >= ax[1] - tol && mid[ax[0]] <= ax[1] + ax[2] + tol);
  });
  if (!along.length) return false;
  const iv = along
    .map((s) => [Math.min(s.a[long[0]], s.b[long[0]]), Math.max(s.a[long[0]], s.b[long[0]])] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = long[1];
  const end = long[1] + long[2];
  for (const [a, b] of iv) {
    const lo = Math.max(a, cursor);
    const hi = Math.min(b, end);
    if (hi > lo) covered += hi - lo;
    cursor = Math.max(cursor, b);
  }
  return covered >= long[2] * 0.55;
}

function designedArm(s: Seg): boolean {
  // A tip that is the part: a wing, tine, prong, ear, finial, or a cantilever arm / rung.
  return /\barm\b|\brung\b|\bwing\b|\btine\b|\bear\b|\bfinial\b|\bprong\b|\btail\b|\bhorn\b|\bantler\b|\bhook\b|\bpeg\b/i.test(`${s.role} ${s.name}`);
}

function freeEndProblems(mem: Seg[]): string[] {
  if (mem.length < 2) return [];
  const minY = Math.min(...mem.flatMap((s) => [s.a.y, s.b.y]));
  const problems: string[] = [];
  for (const s of mem) {
    const vertical = Math.abs(s.b.y - s.a.y) > len(s) * 0.7;
    const ends = [s.a, s.b].map((p) => {
      let near = Infinity;
      for (const o of mem) {
        if (o === s) continue;
        near = Math.min(near, distPointSeg(p, o.a, o.b));
      }
      const foot = vertical && p.y <= minY + 1.25;
      const tol = Math.max(s.section, 2);
      return { p, near, loose: !foot && near > tol };
    });
    const loose = ends.filter((e) => e.loose);
    if (!loose.length) continue;
    if (designedArm(s) && loose.length === 1) continue;
    const where = loose.map((e) => `${e.p.x.toFixed(0)},${e.p.y.toFixed(0)},${e.p.z.toFixed(0)}`).join(" & ");
    problems.push(`${s.role || s.name} free at ${where}`);
    if (problems.length >= 3) break;
  }
  return problems;
}

function boxOf(mem: Seg[]) {
  const xs = mem.flatMap((s) => [s.a.x, s.b.x]);
  const ys = mem.flatMap((s) => [s.a.y, s.b.y]);
  const zs = mem.flatMap((s) => [s.a.z, s.b.z]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function faceBox(project: YardProject) {
  const panels = project.panels.filter((p) => p.type !== "glass_panel" && p.type !== "mirror" && p.materialId !== "window-unit" && p.materialId !== "prehung-door");
  const use = panels.length ? panels : project.panels;
  return {
    minX: Math.min(...use.map((p) => p.position.x)),
    maxX: Math.max(...use.map((p) => p.position.x + p.size.width)),
    minY: Math.min(...use.map((p) => p.position.y)),
    maxY: Math.max(...use.map((p) => p.position.y + p.size.height)),
    minZ: Math.min(...use.map((p) => p.position.z)),
    maxZ: Math.max(...use.map((p) => p.position.z + p.size.depth)),
  };
}

function postsOk(face: YardProject, mem: Seg[]): boolean {
  const uprights = face.panels.filter((p) => p.type === "upright" || /upright|post|standard/i.test(p.name));
  if (uprights.length < 2) return true;
  const z0 = Math.min(...uprights.map((p) => p.position.z));
  const z1 = Math.max(...uprights.map((p) => p.position.z + p.size.depth));
  if (z1 - z0 < face.overall.depth * 0.5) return true;
  const vertical = mem.filter((s) => Math.abs(s.b.y - s.a.y) > len(s) * 0.7);
  const near = (z: number) => vertical.some((s) => Math.abs((s.a.z + s.b.z) / 2 - z) <= Math.max(s.section, 1.5));
  return near(z0 + 0.75) && near(z1 - 0.75);
}

function honestReason(project: YardProject, asked: string): string | null {
  if (project.refused) return project.refused;
  const name = getCatalogItem(asked)?.name;
  if (!name) return null;
  if (project.primaryMaterialId === asked) return null;
  const note = (project.notes ?? []).find((n) => n.includes(name) && /can't|stays|not on the stock|isn't on the stock/i.test(n));
  return note ?? null;
}

function check(prompt: string, face: YardProject, linear: YardProject, asked: string): string | null {
  const why = honestReason(linear, asked);
  if (why) return null;
  const mem = segs(linear);
  if (!mem.length) return "no members";
  const loads = face.panels.filter(isLoadSurface);
  const missed = loads.filter((panel) => !spans(panel, mem)).map((panel) => panel.name.replace(/ \d+$/, ""));
  if (missed.length) return `load not spanned: ${[...new Set(missed)].slice(0, 4).join(", ")}`;
  const sticks = linear.instances.some((inst) => inst.from && inst.to);
  const free = sticks ? freeEndProblems(mem.filter((s) => linear.instances.some((inst) => inst.role === s.role && inst.from === s.a))) : panelFreeEnds(linear);
  if (free.length) return `free end: ${free[0]}`;
  if (sticks && !postsOk(face, mem)) return "missing a front or back post";
  const fb = face.panels.length ? faceBox(face) : boxOf(segs(face));
  const lb = sticks ? boxOf(mem) : faceBox(linear);
  const tol = 2.5;
  const cx = (b: typeof fb) => (b.minX + b.maxX) / 2;
  const cy = (b: typeof fb) => (b.minY + b.maxY) / 2;
  const cz = (b: typeof fb) => (b.minZ + b.maxZ) / 2;
  if (Math.abs(cx(lb) - cx(fb)) > tol || Math.abs(cy(lb) - cy(fb)) > tol || Math.abs(cz(lb) - cz(fb)) > tol) {
    return `off the size box (center ${cx(lb).toFixed(1)},${cy(lb).toFixed(1)},${cz(lb).toFixed(1)} vs ${cx(fb).toFixed(1)},${cy(fb).toFixed(1)},${cz(fb).toFixed(1)})`;
  }
  const span = (b: typeof fb) => [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ];
  const [fw, fh, fd] = span(fb);
  const [lw, lh, ld] = span(lb);
  if (Math.abs(lw - fw) > tol || Math.abs(lh - fh) > tol || Math.abs(ld - fd) > tol) {
    return `bbox ${lw.toFixed(1)}×${lh.toFixed(1)}×${ld.toFixed(1)} vs size ${fw.toFixed(1)}×${fh.toFixed(1)}×${fd.toFixed(1)}`;
  }
  const askedTiers = spokenTierCount(prompt);
  if (askedTiers != null) {
    const ys = new Set(loads.map((p) => Math.round(p.position.y)));
    if (ys.size < askedTiers) return `face build has ${ys.size} load levels, asked ${askedTiers}`;
  }
  return fittingIssue(linear, prompt);
}

const FITTING_PITCH = 2.75;

function rackPrompt(prompt: string): boolean {
  return /\bracks?\b/i.test(prompt) && !/rail|peg|hook/i.test(prompt);
}

/** Fittings read off the pipe ends themselves, not off the list Buy counted. */
function fittingsFromEnds(members: { from?: Vec3; to?: Vec3 }[], rack: boolean) {
  const key = (p: Vec3) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
  const ends = new Map<string, Vec3[]>();
  let minL = Infinity;
  for (const member of members) {
    if (!member.from || !member.to) continue;
    const L = Math.hypot(member.to.x - member.from.x, member.to.y - member.from.y, member.to.z - member.from.z);
    if (L < minL) minL = L;
    for (const [at, other] of [[member.from, member.to], [member.to, member.from]] as const) {
      const dir = { x: other.x - at.x, y: other.y - at.y, z: other.z - at.z };
      const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
      const unit = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
      const list = ends.get(key(at)) ?? [];
      if (!list.some((d) => d.x * unit.x + d.y * unit.y + d.z * unit.z > 0.97)) list.push(unit);
      ends.set(key(at), list);
    }
  }
  const counts = { corners: 0, tees: 0, crosses: 0, elbows90: 0, elbows45: 0, couplings: 0, tee4: 0, cross5: 0, cross6: 0, miss: 0 };
  for (const dirs of ends.values()) {
    const n = dirs.length;
    if (n <= 1) continue;
    if (n >= 4) {
      const kind = highWay(dirs);
      if (kind === "cross") counts.crosses += 1;
      else if (kind === "tee4") counts.tee4 += 1;
      else if (kind === "cross5") counts.cross5 += 1;
      else if (kind === "cross6") counts.cross6 += 1;
      else counts.miss += 1;
      continue;
    }
    if (n === 3) {
      const dots: number[] = [];
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) dots.push(dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z);
      if (dots.every((d) => Math.abs(d) <= 0.05)) counts.corners += 1;
      else counts.tees += 1;
      continue;
    }
    const dot = dirs[0].x * dirs[1].x + dirs[0].y * dirs[1].y + dirs[0].z * dirs[1].z;
    if (dot < -0.82) counts.couplings += 1;
    else if (dot < -0.35) counts.elbows45 += 1;
    else counts.elbows90 += 1;
  }
  return { counts, minL, rack };
}

function pipeClashes(project: YardProject): { mid: number; cap: number } {
  const inst = project.instances.filter((i) => i.from && i.to);
  const od = 1.05;
  const body = 1.375;
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  let mid = 0;
  let cap = 0;
  const ends = new Map<string, number>();
  const key = (p: Vec3) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
  for (const member of inst) {
    ends.set(key(member.from!), (ends.get(key(member.from!)) ?? 0) + 1);
    ends.set(key(member.to!), (ends.get(key(member.to!)) ?? 0) + 1);
  }
  for (let a = 0; a < inst.length; a++) {
    for (let b = a + 1; b < inst.length; b++) {
      const A = inst[a];
      const B = inst[b];
      if ([A.from!, A.to!].some((p) => [B.from!, B.to!].some((q) => dist(p, q) <= 0.05))) continue;
      const u = { x: A.to!.x - A.from!.x, y: A.to!.y - A.from!.y, z: A.to!.z - A.from!.z };
      const v = { x: B.to!.x - B.from!.x, y: B.to!.y - B.from!.y, z: B.to!.z - B.from!.z };
      const w0 = { x: A.from!.x - B.from!.x, y: A.from!.y - B.from!.y, z: A.from!.z - B.from!.z };
      const aa = u.x * u.x + u.y * u.y + u.z * u.z;
      const bb = u.x * v.x + u.y * v.y + u.z * v.z;
      const cc = v.x * v.x + v.y * v.y + v.z * v.z;
      const dd = u.x * w0.x + u.y * w0.y + u.z * w0.z;
      const ee = v.x * w0.x + v.y * w0.y + v.z * w0.z;
      const den = aa * cc - bb * bb;
      if (Math.abs(den) < 1e-4) continue;
      const ti = Math.max(0, Math.min(1, (bb * ee - cc * dd) / den));
      const tj = Math.max(0, Math.min(1, (aa * ee - bb * dd) / den));
      const qi = { x: A.from!.x + u.x * ti, y: A.from!.y + u.y * ti, z: A.from!.z + u.z * ti };
      const qj = { x: B.from!.x + v.x * tj, y: B.from!.y + v.y * tj, z: B.from!.z + v.z * tj };
      const gap = dist(qi, qj);
      const La = Math.sqrt(aa);
      const Lb = Math.sqrt(cc);
      if (gap < od && ti * La > 0.15 && ti * La < La - 0.15 && tj * Lb > 0.15 && tj * Lb < Lb - 0.15) mid += 1;
    }
  }
  for (const member of inst) {
    for (const p of [member.from!, member.to!]) {
      if ((ends.get(key(p)) ?? 0) !== 1) continue;
      let best = Infinity;
      for (const other of inst) {
        if (other === member) continue;
        if (dist(p, other.from!) <= 0.05 || dist(p, other.to!) <= 0.05) continue;
        const ab = { x: other.to!.x - other.from!.x, y: other.to!.y - other.from!.y, z: other.to!.z - other.from!.z };
        const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
        if (L2 < 1e-8) continue;
        const t = Math.max(0, Math.min(1, ((p.x - other.from!.x) * ab.x + (p.y - other.from!.y) * ab.y + (p.z - other.from!.z) * ab.z) / L2));
        const q = { x: other.from!.x + ab.x * t, y: other.from!.y + ab.y * t, z: other.from!.z + ab.z * t };
        best = Math.min(best, dist(p, q));
      }
      if (best < body) cap += 1;
    }
  }
  return { mid, cap };
}

function fittingIssue(project: YardProject, prompt: string): string | null {
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item || binderKind(item) !== "slip") return null;
  const rack = rackPrompt(prompt);
  const outlined = project.instances.some((inst) => inst.from && inst.to);
  if (!(rack && outlined)) return null;
  const members = project.instances;
  const read = fittingsFromEnds(members, rack);
  if (read.minL < FITTING_PITCH - 0.01) return `pitch ${read.minL.toFixed(2)}" under ${FITTING_PITCH}"`;
  const clash = pipeClashes(project);
  if (clash.mid || clash.cap) return `clash mid ${clash.mid} cap ${clash.cap}`;
  const plan = buildPlan(project);
  const bought = { corners: 0, tees: 0, crosses: 0, elbows90: 0, elbows45: 0, couplings: 0, tee4: 0, cross5: 0, cross6: 0 };
  for (const line of plan.bom) {
    const qty = line.quantity ?? 0;
    if (/3-way corner/.test(line.name)) bought.corners += qty;
    else if (/PVC 4-way tee/.test(line.name)) bought.tee4 += qty;
    else if (/PVC 5-way cross/.test(line.name)) bought.cross5 += qty;
    else if (/PVC 6-way cross/.test(line.name)) bought.cross6 += qty;
    else if (/PVC cross/.test(line.name)) bought.crosses += qty;
    else if (/PVC tee/.test(line.name)) bought.tees += qty;
    else if (/90° elbow/.test(line.name)) bought.elbows90 += qty;
    else if (/45° elbow/.test(line.name)) bought.elbows45 += qty;
    else if (/PVC coupling/.test(line.name)) bought.couplings += qty;
  }
  const couplingExpect = read.counts.couplings;
  const crossExpect = read.counts.crosses;
  const fit = (c: typeof bought) => c.corners + c.tees + c.crosses + c.elbows90 + c.elbows45 + c.couplings + c.tee4 + c.cross5 + c.cross6;
  const expectFit = fit({ ...bought, corners: read.counts.corners, tees: read.counts.tees, crosses: crossExpect, elbows90: read.counts.elbows90, elbows45: read.counts.elbows45, couplings: couplingExpect, tee4: read.counts.tee4, cross5: read.counts.cross5, cross6: read.counts.cross6 });
  if (fit(bought) !== expectFit) return `unbought ${expectFit - fit(bought)}`;
  if (
    bought.corners !== read.counts.corners ||
    bought.tees !== read.counts.tees ||
    bought.crosses !== crossExpect ||
    bought.elbows90 !== read.counts.elbows90 ||
    bought.elbows45 !== read.counts.elbows45 ||
    bought.couplings !== couplingExpect ||
    bought.tee4 !== read.counts.tee4 ||
    bought.cross5 !== read.counts.cross5 ||
    bought.cross6 !== read.counts.cross6
  ) {
    return `fittings buy ${bought.corners} corners, ${bought.tees} tees, ${bought.crosses} crosses, ${bought.tee4} 4-way, ${bought.cross5} 5-way, ${bought.cross6} 6-way, ${bought.elbows90}+${bought.elbows45} elbows, ${bought.couplings} couplings; read ${read.counts.corners}/${read.counts.tees}/${crossExpect}/${read.counts.tee4}/${read.counts.cross5}/${read.counts.cross6}/${read.counts.elbows90}+${read.counts.elbows45}/${couplingExpect} miss ${read.counts.miss}`;
  }
  const joints = fit(bought);
  if (rack && read.counts.corners + read.counts.tees + read.counts.crosses + read.counts.elbows90 > 0 && joints === 0) return "rack buys no fittings";
  return null;
}

const CASES: { prompt: string; learned: boolean }[] = [
  ...IDEAS.map((idea) => ({ prompt: idea.prompt, learned: false })),
  ...RECIPES.recipes.map((recipe) => ({ prompt: recipePrompt(recipe), learned: !!recipe.learned })),
];

function faceBuild(prompt: string): YardProject {
  const natural = generateFromPrompt(prompt);
  const item = getCatalogItem(natural.primaryMaterialId);
  if (isFace(item) || natural.refused) return natural;
  return generateFromPrompt(prompt, PLY);
}

it("linear stock keeps the form of every Ideas prompt and every recipe", () => {
  const failed: string[] = [];
  const passed: string[] = [];
  for (const { prompt, learned } of CASES) {
    let face: YardProject;
    try {
      face = faceBuild(prompt);
    } catch (e) {
      failed.push(`${prompt}: face build threw ${String(e).slice(0, 80)}`);
      continue;
    }
    for (const id of [PVC, DOWEL, TWO]) {
      let linear: YardProject;
      try {
        linear = generateFromPrompt(prompt, id);
      } catch (e) {
        failed.push(`${prompt} [${id}]: threw ${String(e).slice(0, 80)}`);
        continue;
      }
      const why = honestReason(linear, id);
      const problem = why ? null : check(prompt, face, linear, id);
      const tag = `${learned ? "learned " : ""}${prompt} [${id}]`;
      if (problem) failed.push(`${tag}: ${problem}`);
      else passed.push(why ? `${tag}: HONEST ${why}` : tag);
    }
  }
  // These still miss the rule. Each one is a stock-class template or a board-thickness
  // refit, not the word "rack" throwing the recipe away. A new miss fails; a fixed one must leave this list.
  const still: [string, string][] = [
    ["twin bunk bed [lumber-2x2-8]", "Upper head guard"],
    ["40 inch round 3-leg table [lumber-2x2-8]", "Apron 1"],
    ["30 inch range hood [lumber-2x2-8]", "Chimney top"],
    ["nightstand 18 wide [lumber-2x2-8]", "Top, Bottom, Shelf"],
    ["catapult from popsicle sticks [pvc-3-4-sch40]", "Top"],
    ["catapult from popsicle sticks [dowel-1-2-36]", "Top"],
    ["catapult from popsicle sticks [lumber-2x2-8]", "Top"],
    ["dog from popsicle sticks [pvc-3-4-sch40]", "off the size box"],
    ["dog from popsicle sticks [dowel-1-2-36]", "off the size box"],
    ["dog from popsicle sticks [lumber-2x2-8]", "off the size box"],
    ["6 foot ladder from 2x4 [pvc-3-4-sch40]", "leg free"],
    ["6 foot ladder from 2x4 [dowel-1-2-36]", "leg free"],
    ["6 foot ladder from 2x4 [lumber-2x2-8]", "leg free"],
    ["4 foot bridge from plastic drinking straws [pvc-3-4-sch40]", "off the size box"],
    ["4 foot bridge from plastic drinking straws [dowel-1-2-36]", "off the size box"],
    ["4 foot bridge from plastic drinking straws [lumber-2x2-8]", "off the size box"],
    ["picture frame from bamboo skewers [pvc-3-4-sch40]", "stand free"],
    ["picture frame from bamboo skewers [dowel-1-2-36]", "stand free"],
    ["workbench 60 wide 24 deep 36 tall [lumber-2x2-8]", "Back apron"],
    ["birdhouse [pvc-3-4-sch40]", "Floor"],
    ["birdhouse [dowel-1-2-36]", "Floor"],
    ["birdhouse [lumber-2x2-8]", "Floor"],
    ["ferris wheel [dowel-1-2-36]", "Left front leg"],
    // Release geometry: the spoke does not meet the rim, and closing it would shorten a member.
    ["ferris wheel [pvc-3-4-sch40]", "Front spoke"],
    ["reindeer [pvc-3-4-sch40]", "Neck"],
    ["learned sawbuck [pvc-3-4-sch40]", "Left leg A"],
    ["learned compost tumbler frame [pvc-3-4-sch40]", "Left front post"],
    ["learned sundial [pvc-3-4-sch40]", "bbox"],
    // Restored release builds. A dowel rack is the cantilever, and a pipe opening is the release frame.
    ["Andersen 100 Series 36 by 48 double hung window, frame the rough opening [pvc-3-4-sch40]", "Bottom plate"],
    ["Andersen 100 Series 36 by 48 double hung window, frame the rough opening [dowel-1-2-36]", "Bottom plate"],
    ["coat rack 36 wide 12 high 4 deep [dowel-1-2-36]", "Hat shelf"],
    ["coat rack with bench 48 wide [dowel-1-2-36]", "Shoe shelf"],
    ["spice rack 18 wide 24 high 4 deep [dowel-1-2-36]", "Shelf"],
    ["wine rack 24 wide 36 high 12 deep [dowel-1-2-36]", "Shelf"],
    ["shoe rack with cubbies [dowel-1-2-36]", "Shoe shelf"],
    // The fitted pegs stand past the hat shelf on purpose. The plywood face is the shorter hardware hook.
    ["coat rack 36 wide 12 high 4 deep [pvc-3-4-sch40]", "bbox"],
    ["learned water wheel [pvc-3-4-sch40]", "left base"],
    ["learned water wheel [dowel-1-2-36]", "left base"],
    ["learned water wheel [lumber-2x2-8]", "left base"],
    ["learned abacus [dowel-1-2-36]", "bottom rail"],
    ["learned goal [dowel-1-2-36]", "Rear bottom rail"],
  ];
  const keyOf = (line: string) => line.match(/^(.*) \[([^\]]+)\]: /);
  const got = failed.map((line) => {
    const m = keyOf(line);
    return m ? `${m[1]} [${m[2]}]` : line;
  });
  assert.deepEqual(got.sort(), still.map(([key]) => key).sort(), failed.join("\n"));
  // Joints the catalog cannot fit (not a right angle) stay named here and are not bought.
  const lockedMisses: [string, number][] = [];
  for (const { prompt } of CASES) {
    if (!rackPrompt(prompt)) continue;
    const built = generateFromPrompt(prompt, PVC);
    if (!built.instances.some((inst) => inst.from && inst.to)) continue;
    const n = fittingsFromEnds(built.instances, true).counts.miss;
    if (n) lockedMisses.push([prompt, n]);
  }
  assert.deepEqual(lockedMisses, [
    ["coat rack with bench 48 wide", 8],
    ["wine rack 24 wide 36 high 12 deep", 10],
    ["shoe rack with cubbies", 4],
  ]);
  for (const [key, bit] of still) {
    const line = failed.find((row) => row.startsWith(`${key}: `));
    assert.ok(line?.includes(bit), line ?? key);
  }
  assert.ok(passed.length >= CASES.length * 3 - still.length);
});

function planOf(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const mem = segs(project);
  const box = mem.length ? boxOf(mem) : null;
  return {
    project,
    parts: plan.totals.pieces,
    buyLines: plan.bom.length,
    steps: plan.instructions.length,
    cost: Math.round(plan.totals.estCostUsd * 100) / 100,
    buy: plan.bom.map((b) => `${b.quantity} ${b.name} $${(b.estimatedCost ?? 0).toFixed(2)}`).join(" | "),
    center: box ? (box.minX + box.maxX) / 2 : null,
    roles: project.instances.map((i) => i.role),
  };
}

it("typed rack prompts build the recipe frame, centred, with the asked tiers", () => {
  const shoe = generateFromPrompt("shoe rack");
  const pvc = generateFromPrompt("pvc shoe rack");
  const problem = check("shoe rack", shoe, pvc, PVC);
  assert.equal(problem, null, problem ?? "");
  assert.ok(pvc.instances.length > 8, `pvc shoe rack still the 8-piece arm stub (${pvc.instances.length})`);
  assert.equal(pvc.instances.some((i) => /arm/.test(i.role ?? "")), false);
  const sizedFace = generateFromPrompt("shoe rack 36 wide 12 deep 30 tall");
  const sized = generateFromPrompt("PVC shoe rack 36 wide 12 deep 30 tall");
  assert.equal(check("shoe rack 36 wide 12 deep 30 tall", sizedFace, sized, PVC), null);
  assert.equal(sized.overall.height, 30);
  const tierFace = generateFromPrompt("3 tier shoe rack");
  const tier = generateFromPrompt("3 tier pvc shoe rack");
  assert.equal(check("3 tier shoe rack", tierFace, tier, PVC), null);
  assert.match(tier.notes.join(" "), /3 open shoe tiers/);
  for (const [q, face] of [
    ["pvc spice rack", "spice rack"],
    ["pvc wine rack", "wine rack"],
  ] as const) {
    const built = generateFromPrompt(q);
    const base = generateFromPrompt(face);
    assert.equal(check(face, base, built, PVC), null, q);
  }
  // Dowel stays the release cantilever. Pipe is the only stock that leaves it.
  const dowelShoe = generateFromPrompt("dowel shoe rack");
  assert.equal(dowelShoe.instances.length, 8);
  assert.equal(dowelShoe.instances.filter((i) => /arm/.test(i.role ?? "")).length, 4);
  // A lumber rack is the wall-arm cantilever, the same build release makes.
  const pipeLumber = generateFromPrompt("pvc lumber rack");
  assert.equal(pipeLumber.instances.length, 8);
  const arms = pipeLumber.instances.filter((i) => /arm/.test(i.role ?? "") && i.from && i.to);
  assert.equal(arms.length, 4);
  assert.ok(arms.every((arm) => Math.abs(arm.to!.z - arm.from!.z) > 8));
  assert.equal(buildPlan(pipeLumber).bom.some((b) => /elbow|tee|cross|4-way/.test(b.name)), false);
  // Reported prompts stay buildable: parts, buy lines, steps, and price agree with the model.
  for (const q of ["pvc shoe rack", "PVC shoe rack 36 wide 12 deep 30 tall", "3 tier pvc shoe rack", "pvc spice rack", "pvc wine rack", "dowel shoe rack", "pvc lumber rack"]) {
    const row = planOf(q);
    assert.equal(row.parts, row.project.instances.length || row.project.panels.length, q);
    assert.ok(row.buyLines >= 1 && row.steps >= 1, q);
    assert.ok(row.cost > 0, q);
  }
});
