/**
 * PVC rack frames. The census below clusters pipe ends by distance and classifies
 * each direction set itself. It does not call the engine's joint labeller, so a
 * labeller that calls every side-outlet a cross fails this file.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { emptyProject, generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { headerSize } from "./headerSize.ts";
import type { Vec3, YardInstance } from "./types.ts";

const NODE = 0.05;
const STRAIGHT = -0.82;
const OBTUSE = -0.35;
const SQUARE = 0.05;
const RIGHT = 0.08;
const OD = 1.05;
const BODY = 1.375;

type Kind = "ground" | "cap" | "coupling" | "elbow45" | "elbow90" | "tee" | "corner" | "cross" | "tee4" | "cross5" | "cross6" | "other";

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const hypot = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function norm(a: Vec3, b: Vec3): Vec3 {
  const L = hypot(a, b) || 1;
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L, z: (b.z - a.z) / L };
}

function tiltDeg(a: Vec3, b: Vec3): number {
  const d = norm(a, b);
  const along = Math.max(Math.abs(d.x), Math.abs(d.y), Math.abs(d.z));
  return (Math.atan2(Math.sqrt(Math.max(0, 1 - along * along)), along) * 180) / Math.PI;
}

type Node = { p: Vec3; dirs: Vec3[] };

/** Union pipe ends that sit within 0.05" of each other. One physical point, one node. */
function clusterNodes(members: YardInstance[]): Node[] {
  const ends: { p: Vec3; dir: Vec3 }[] = [];
  for (const m of members) {
    if (!m.from || !m.to) continue;
    ends.push({ p: m.from, dir: norm(m.from, m.to) }, { p: m.to, dir: norm(m.to, m.from) });
  }
  const parent = ends.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) if (hypot(ends[i].p, ends[j].p) <= NODE) parent[find(j)] = find(i);
  }
  const groups = new Map<number, typeof ends>();
  ends.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));
  return [...groups.values()].map((group) => {
    const dirs: Vec3[] = [];
    for (const e of group) if (!dirs.some((d) => dot(d, e.dir) > 0.97)) dirs.push(e.dir);
    return {
      p: {
        x: group.reduce((s, e) => s + e.p.x, 0) / group.length,
        y: group.reduce((s, e) => s + e.p.y, 0) / group.length,
        z: group.reduce((s, e) => s + e.p.z, 0) / group.length,
      },
      dirs,
    };
  });
}

function sharePlane(dirs: Vec3[]): boolean {
  let n: Vec3 | null = null;
  for (let i = 0; i < dirs.length && !n; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const c = {
        x: dirs[i].y * dirs[j].z - dirs[i].z * dirs[j].y,
        y: dirs[i].z * dirs[j].x - dirs[i].x * dirs[j].z,
        z: dirs[i].x * dirs[j].y - dirs[i].y * dirs[j].x,
      };
      if (Math.hypot(c.x, c.y, c.z) > 0.2) {
        n = c;
        break;
      }
    }
  }
  if (!n) return true;
  const L = Math.hypot(n.x, n.y, n.z);
  return dirs.every((d) => Math.abs(dot(d, n!)) / L <= RIGHT);
}

/** A post straight through, plus two rails square to the post and to each other. Not a flat cross. */
function sideOutlet(dirs: Vec3[]): boolean {
  const straight: [number, number][] = [];
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) if (dot(dirs[i], dirs[j]) < STRAIGHT) straight.push([i, j]);
  if (straight.length !== 1) return false;
  const [a, b] = straight[0];
  const rest = [0, 1, 2, 3].filter((k) => k !== a && k !== b);
  if (Math.abs(dot(dirs[rest[0]], dirs[rest[1]])) > RIGHT) return false;
  return rest.every((k) => Math.abs(dot(dirs[k], dirs[a])) <= RIGHT && Math.abs(dot(dirs[k], dirs[b])) <= RIGHT);
}

function kindOf(node: Node): Kind {
  const n = node.dirs.length;
  if (n <= 1) return node.p.y < 0.45 ? "ground" : "cap";
  if (n === 2) {
    const d = dot(node.dirs[0], node.dirs[1]);
    if (d < STRAIGHT) return "coupling";
    if (d < OBTUSE) return "elbow45";
    return "elbow90";
  }
  if (n === 3) {
    const dots: number[] = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) dots.push(dot(node.dirs[i], node.dirs[j]));
    if (dots.every((d) => Math.abs(d) <= SQUARE)) return "corner";
    if (dots.filter((d) => d < STRAIGHT).length === 1 && dots.filter((d) => Math.abs(d) <= RIGHT).length === 2) return "tee";
    return "other";
  }
  if (n === 4 && sharePlane(node.dirs)) return "cross";
  if (n === 4 && sideOutlet(node.dirs)) return "tee4";
  if (n === 5) {
    for (let i = 0; i < 5; i++) {
      const rest = node.dirs.filter((_, k) => k !== i);
      if (!sharePlane(rest)) continue;
      let normal: Vec3 | null = null;
      for (let a = 0; a < rest.length && !normal; a++) {
        for (let b = a + 1; b < rest.length; b++) {
          const c = {
            x: rest[a].y * rest[b].z - rest[a].z * rest[b].y,
            y: rest[a].z * rest[b].x - rest[a].x * rest[b].z,
            z: rest[a].x * rest[b].y - rest[a].y * rest[b].x,
          };
          if (Math.hypot(c.x, c.y, c.z) > 0.2) normal = c;
        }
      }
      if (normal && Math.abs(dot(node.dirs[i], normal)) / Math.hypot(normal.x, normal.y, normal.z) >= 0.96) return "cross5";
    }
  }
  if (n === 6) {
    const used = new Set<number>();
    const axes: Vec3[] = [];
    let ok = true;
    for (let i = 0; i < 6; i++) {
      if (used.has(i)) continue;
      let mate = -1;
      for (let j = i + 1; j < 6; j++) if (!used.has(j) && dot(node.dirs[i], node.dirs[j]) < STRAIGHT) mate = j;
      if (mate < 0) {
        ok = false;
        break;
      }
      used.add(i);
      used.add(mate);
      axes.push(node.dirs[i]);
    }
    if (ok && axes.length === 3 && [0, 1, 2].every((i) => Math.abs(dot(axes[i], axes[(i + 1) % 3])) <= RIGHT)) return "cross6";
  }
  return "other";
}

function pointSeg(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  if (L2 < 1e-8) return hypot(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L2));
  return hypot(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t });
}

function segDist(a: YardInstance, b: YardInstance): number {
  const segs = [a, b];
  let best = Infinity;
  for (const s of segs) {
    for (const p of [s.from!, s.to!]) {
      const o = s === a ? b : a;
      best = Math.min(best, pointSeg(p, o.from!, o.to!));
    }
  }
  return best;
}

function buyCounts(bom: { name: string; quantity: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  const take = (re: RegExp, key: string) => {
    const line = bom.find((b) => re.test(b.name));
    if (line) out[key] = line.quantity;
  };
  take(/3-way corner/, "corner");
  take(/4-way tee/, "tee4");
  take(/5-way cross/, "cross5");
  take(/6-way cross/, "cross6");
  take(/PVC cross$/, "cross");
  take(/PVC tee$/, "tee");
  take(/90° elbow/, "elbow90");
  take(/45° elbow/, "elbow45");
  take(/coupling/, "coupling");
  take(/PVC cap$/, "cap");
  return out;
}

const BOUGHT: Kind[] = ["corner", "tee", "tee4", "cross", "cross5", "cross6", "elbow90", "elbow45", "coupling", "cap"];

function frameOf(prompt: string, material?: string) {
  const project = material ? generateFromPrompt(prompt, material) : generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const members = project.instances.filter((i) => i.from && i.to);
  const nodes = clusterNodes(members);
  const geo: Record<string, number> = {};
  for (const node of nodes) {
    const k = kindOf(node);
    geo[k] = (geo[k] ?? 0) + 1;
  }
  const parent = members.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const shares = (a: YardInstance, b: YardInstance) => [a.from!, a.to!].some((p) => [b.from!, b.to!].some((q) => hypot(p, q) <= NODE));
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (shares(members[i], members[j])) parent[find(j)] = find(i);
  let clashes = 0;
  let gaps = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (segDist(members[i], members[j]) < OD - 0.02 && !shares(members[i], members[j])) clashes += 1;
    }
    for (const p of [members[i].from!, members[i].to!]) {
      const joined = members.some((m, k) => k !== i && [m.from!, m.to!].some((q) => hypot(p, q) <= NODE));
      if (joined) continue;
      const near = Math.min(...members.filter((_, k) => k !== i).map((m) => pointSeg(p, m.from!, m.to!)));
      if (near <= BODY) gaps += 1;
    }
  }
  const tilt = Math.max(0, ...members.map((m) => tiltDeg(m.from!, m.to!)));
  return {
    project,
    plan,
    members,
    geo,
    buy: buyCounts(plan.bom),
    pieces: new Set(members.map((_, i) => find(i))).size,
    clashes,
    gaps,
    tilt,
    refused: (project.notes ?? []).some((n) => /can't build this/.test(n)),
  };
}

const BUILT = [
  "pvc shoe rack",
  "pvc bike rack",
  "pvc towel rack",
  "pvc wine rack",
  "drying rack",
  "magazine rack",
  "dish rack",
  "plate rack",
  "3 tier shoe rack",
  "kayak rack",
  "firewood rack 96 wide 48 tall",
];

const CARCASE_TITLE = /^(?:Skin the back|Stand the sides|Stand the dividers|Close the top|Hang the doors|Set the shelves|Set the kick|Set the counter|Build the drawers|Lay the deck) —/;

/** Outside of the pipes, measured here. Not the engine's extent. */
function frameBox(members: YardInstance[]): { width: number; depth: number; height: number } {
  const r = 1.05 / 2;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const m of members) {
    const a = m.from!;
    const b = m.to!;
    const L = hypot(a, b) || 1;
    const u = { x: (b.x - a.x) / L, y: (b.y - a.y) / L, z: (b.z - a.z) / L };
    const pad = {
      x: r * Math.sqrt(Math.max(0, 1 - u.x * u.x)),
      y: r * Math.sqrt(Math.max(0, 1 - u.y * u.y)),
      z: r * Math.sqrt(Math.max(0, 1 - u.z * u.z)),
    };
    for (const p of [a, b]) {
      minX = Math.min(minX, p.x - pad.x); maxX = Math.max(maxX, p.x + pad.x);
      minY = Math.min(minY, p.y - pad.y); maxY = Math.max(maxY, p.y + pad.y);
      minZ = Math.min(minZ, p.z - pad.z); maxZ = Math.max(maxZ, p.z + pad.z);
    }
  }
  return { width: maxX - minX, depth: maxZ - minZ, height: maxY - Math.min(0, minY) };
}

function buyAgrees(geo: Record<string, number>, buy: Record<string, number>, key: "cap" | "cross5"): boolean {
  return (buy[key] ?? 0) === (geo[key] ?? 0);
}

test("a seated PVC rack is one square frame and Buy matches the geometry", () => {
  for (const prompt of BUILT) {
    const material = /pvc/i.test(prompt) ? undefined : "pvc-3-4-sch40";
    const frame = frameOf(prompt, material);
    assert.equal(frame.refused, false, prompt);
    assert.equal(frame.project.primaryMaterialId, "pvc-3-4-sch40", prompt);
    assert.ok(frame.members.length >= 2, prompt);
    assert.equal(frame.pieces, 1, `${prompt} pieces ${frame.pieces}`);
    assert.equal(frame.clashes, 0, `${prompt} clashes ${frame.clashes}`);
    assert.equal(frame.gaps, 0, `${prompt} gaps ${frame.gaps}`);
    assert.ok(frame.tilt <= 1, `${prompt} tilt ${frame.tilt}`);
    assert.equal(frame.geo.other ?? 0, 0, `${prompt} uncatalogued ${frame.geo.other}`);
    const centres = clusterNodes(frame.members);
    let pitch = Infinity;
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const d = hypot(centres[i].p, centres[j].p);
        if (d > NODE) pitch = Math.min(pitch, d);
      }
    }
    assert.ok(pitch >= 2.75 - 1e-6, `${prompt} fitting pitch ${pitch.toFixed(3)}`);
    for (const key of BOUGHT) {
      assert.equal(frame.buy[key] ?? 0, frame.geo[key] ?? 0, `${prompt} ${key} buy ${frame.buy[key] ?? 0} geometry ${frame.geo[key] ?? 0}`);
    }
    const tee = frame.plan.bom.find((b) => /PVC tee$/.test(b.name));
    if (tee) assert.ok((tee.offers ?? []).some((o) => o.href), `${prompt} plain tee lost its listing`);
    for (const id of ["pvc-cross", "pvc-4-way-tee", "pvc-5-way-cross", "pvc-6-way-cross", "pvc-cap"]) {
      const line = frame.plan.bom.find((b) => b.catalogId === id);
      if (!line) continue;
      assert.ok((line.offers ?? []).some((o) => o.href), `${prompt} ${id} has no store link`);
      assert.ok((line.estimatedCost ?? 0) > 0, `${prompt} ${id} unpriced`);
    }
    const box = frameBox(frame.members);
    const hud = headerSize(frame.project);
    assert.ok(Math.abs(hud.width - box.width) < 0.05, `${prompt} HUD width ${hud.width} frame ${box.width}`);
    assert.ok(Math.abs(hud.depth - box.depth) < 0.05, `${prompt} HUD depth ${hud.depth} frame ${box.depth}`);
    assert.ok(Math.abs(hud.height - box.height) < 0.05, `${prompt} HUD height ${hud.height} frame ${box.height}`);
    assert.equal(frame.plan.instructions.some((s) => CARCASE_TITLE.test(s.title)), false, `${prompt} carcase title`);
    assert.equal(buyAgrees(frame.geo, frame.buy, "cap"), true, `${prompt} caps`);
    assert.equal(buyAgrees(frame.geo, frame.buy, "cross5"), true, `${prompt} 5-way`);
  }
});

test("a side-outlet is not a cross: the shoe rack buys 4-way tees the geometry counts", () => {
  const frame = frameOf("pvc shoe rack");
  assert.ok((frame.geo.tee4 ?? 0) > 0, "the covered shoe rack has no side-outlet, so a bad labeller would not be caught");
  assert.equal(frame.buy.tee4 ?? 0, frame.geo.tee4);
  assert.equal(frame.buy.cross ?? 0, frame.geo.cross ?? 0);
});

test("a coupling 2 inches from a corner fails the fitting pitch", () => {
  const frame = frameOf("pvc shoe rack");
  const nodes = clusterNodes(frame.members);
  const corner = nodes.find((node) => kindOf(node) === "corner");
  assert.ok(corner, "shoe rack has no corner to move a coupling toward");
  const moved = [
    ...nodes,
    { p: { x: corner!.p.x + 2, y: corner!.p.y, z: corner!.p.z }, dirs: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }] },
  ];
  let pitch = Infinity;
  for (let i = 0; i < moved.length; i++) {
    for (let j = i + 1; j < moved.length; j++) {
      const d = hypot(moved[i].p, moved[j].p);
      if (d > NODE) pitch = Math.min(pitch, d);
    }
  }
  assert.ok(pitch < 2.75, `mutation pitch ${pitch} should fail the 2.75 inch check`);
});

test("a free pipe end is a cap on Buy, so dropping the cap fails", () => {
  const upright = { x: 0, y: 0, z: 0 };
  const joint = { x: 0, y: 24, z: 0 };
  const tip = { x: 12, y: 24, z: 0 };
  const member = (role: string, from: Vec3, to: Vec3): YardInstance => ({
    id: `${role}-${from.y}-${to.x}`,
    catalogId: "pvc-3-4-sch40",
    position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
    rotation: { x: 0, y: 0, z: 0 },
    cutLength: hypot(from, to),
    role,
    from,
    to,
  });
  const project = {
    ...emptyProject(),
    name: "Cap check",
    prompt: "pvc shoe rack",
    kind: "closet" as const,
    primaryMaterialId: "pvc-3-4-sch40",
    notes: ["Same Cap check in 3/4\" Schedule 40 PVC Pipe. Each face is the outline of that stock, not a solid tile."],
    instances: [member("upright", upright, joint), member("rail", joint, tip)],
  };
  const plan = buildPlan(project);
  const nodes = clusterNodes(project.instances);
  const caps = nodes.filter((node) => kindOf(node) === "cap").length;
  const buy = buyCounts(plan.bom).cap ?? 0;
  assert.ok(caps > 0, "the fixture has no cap, so a dropped cap would not be caught");
  assert.equal(buy, caps, `cap buy ${buy} geometry ${caps}`);
  const frame = frameOf("firewood rack 96 wide 48 tall", "pvc-3-4-sch40");
  assert.ok((frame.geo.cross5 ?? 0) > 0, "this rack has no 5-way cross, so dropping one would not be caught");
  assert.equal(frame.buy.cross5 ?? 0, frame.geo.cross5 ?? 0);
});

test("a one-plane spice rack stays the release open frame", () => {
  const frame = frameOf("pvc spice rack");
  assert.equal(frame.refused, false);
  assert.equal(frame.project.primaryMaterialId, "pvc-3-4-sch40");
  assert.ok(frame.project.notes?.some((n) => /Open frame of/.test(n)));
  assert.equal(frame.project.notes?.some((n) => /can't build this/.test(n)), false);
});

test("a coat rack stays the release open frame", () => {
  const frame = frameOf("coat rack", "pvc-3-4-sch40");
  assert.equal(frame.refused, false);
  assert.equal(frame.project.primaryMaterialId, "pvc-3-4-sch40");
  assert.ok(frame.project.notes?.some((n) => /Open frame of/.test(n)));
  assert.equal(frame.plan.bom.some((b) => /4-way tee|5-way|6-way/.test(b.name)), false);
});

test("a drinking straw rack is not seated as pipe", () => {
  const frame = frameOf("drinking straw spice rack");
  assert.equal(frame.project.primaryMaterialId, "straw-plastic");
  assert.equal(frame.plan.bom.some((b) => /PVC/.test(b.name)), false);
});
