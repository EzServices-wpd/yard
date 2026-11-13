/**
 * Open PVC frames buy a fitting at every meeting of pipes.
 * The census clusters pipe ends and classifies direction sets itself.
 * It does not call the engine's joint labeller. A mutant that leaves a rung
 * passing through a rail, or that drops the tee off Buy, fails the same check.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import type { Vec3, YardInstance } from "./types.ts";

const NODE = 0.05;
const STRAIGHT = -0.82;
const RIGHT = 0.08;
const OD = 1.05;

const hypot = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

function norm(a: Vec3, b: Vec3): Vec3 {
  const L = hypot(a, b) || 1;
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L, z: (b.z - a.z) / L };
}

function members(project: { instances: YardInstance[] }): YardInstance[] {
  return project.instances.filter((m) => m.from && m.to);
}

/** An end that lands on another pipe, or two pipes that cross, with no shared end. */
function passThroughs(list: YardInstance[]): number {
  const seg = (p: Vec3, a: Vec3, b: Vec3) => {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const L2 = dot(ab, ab) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L2));
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t };
    return { t, d: hypot(p, q), q };
  };
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i];
      const B = list[j];
      const ends = [
        { p: A.from!, host: B, own: A },
        { p: A.to!, host: B, own: A },
        { p: B.from!, host: A, own: B },
        { p: B.to!, host: A, own: B },
      ];
      for (const e of ends) {
        const hit = seg(e.p, e.host.from!, e.host.to!);
        if (hit.d > NODE) continue;
        const onEnd = hypot(hit.q, e.host.from!) <= NODE || hypot(hit.q, e.host.to!) <= NODE;
        if (!onEnd) n += 1;
      }
    }
  }
  return n;
}

function clashes(list: YardInstance[]): number {
  const share = (a: YardInstance, b: YardInstance) => [a.from!, a.to!].some((p) => [b.from!, b.to!].some((q) => hypot(p, q) <= NODE));
  const distSeg = (a: YardInstance, b: YardInstance) => {
    let best = Infinity;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = {
        x: a.from!.x + (a.to!.x - a.from!.x) * t,
        y: a.from!.y + (a.to!.y - a.from!.y) * t,
        z: a.from!.z + (a.to!.z - a.from!.z) * t,
      };
      const ab = { x: b.to!.x - b.from!.x, y: b.to!.y - b.from!.y, z: b.to!.z - b.from!.z };
      const L2 = dot(ab, ab) || 1;
      const u = Math.max(0, Math.min(1, ((p.x - b.from!.x) * ab.x + (p.y - b.from!.y) * ab.y + (p.z - b.from!.z) * ab.z) / L2));
      const q = { x: b.from!.x + ab.x * u, y: b.from!.y + ab.y * u, z: b.from!.z + ab.z * u };
      best = Math.min(best, hypot(p, q));
    }
    return best;
  };
  let n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (!share(list[i], list[j]) && distSeg(list[i], list[j]) < OD - 0.02) n += 1;
  return n;
}

/** Tees read off the direction set: one straight pair and two square branches. */
function geometryTees(list: YardInstance[]): number {
  const ends: { p: Vec3; dir: Vec3 }[] = [];
  for (const m of list) {
    ends.push({ p: m.from!, dir: norm(m.from!, m.to!) }, { p: m.to!, dir: norm(m.to!, m.from!) });
  }
  const parent = ends.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) if (hypot(ends[i].p, ends[j].p) <= NODE) parent[find(j)] = find(i);
  const groups = new Map<number, typeof ends>();
  ends.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));
  let tees = 0;
  for (const group of groups.values()) {
    const dirs: Vec3[] = [];
    for (const e of group) if (!dirs.some((d) => dot(d, e.dir) > 0.97)) dirs.push(e.dir);
    if (dirs.length !== 3) continue;
    const dots: number[] = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) dots.push(dot(dirs[i], dirs[j]));
    if (dots.filter((d) => d < STRAIGHT).length === 1 && dots.filter((d) => Math.abs(d) <= RIGHT).length === 2) tees += 1;
  }
  return tees;
}

function teeLine(plan: ReturnType<typeof buildPlan>) {
  return plan.bom.find((b) => /PVC tee$/.test(b.name));
}

test("a PVC ladder buys one tee per rung meeting and the steps name that tee", () => {
  const project = generateFromPrompt("pvc ladder 20x60");
  const list = members(project);
  const plan = buildPlan(project);
  const tees = geometryTees(list);
  assert.equal(passThroughs(list), 0);
  assert.equal(clashes(list), 0);
  assert.equal(tees, 10);
  const bought = teeLine(plan);
  assert.ok(bought);
  assert.equal(bought!.quantity, tees);
  assert.equal(Math.round(((bought!.estimatedCost ?? 0) / bought!.quantity) * 100) / 100, 1.18);
  const text = plan.instructions.map((s) => s.description ?? "").join("\n");
  assert.equal(text.match(/The fittings are 10 3\/4" PVC tees, the same fittings on the Buy list\./g)?.length, 1);
  assert.equal(bought!.quantity === tees, true);
  assert.equal(0 === tees, false);
});

test("dropping the ladder tees fails the geometry check", () => {
  const project = generateFromPrompt("pvc ladder 20x60");
  const tees = geometryTees(members(project));
  const bought = teeLine(buildPlan(project))!.quantity;
  assert.equal(bought, tees);
  assert.notEqual(0, tees);
});

test("an easel rung meeting is a tee, and a plain frame's corners stay corners", () => {
  const easel = generateFromPrompt("pvc easel");
  const easelList = members(easel);
  assert.equal(passThroughs(easelList), 0);
  assert.equal(clashes(easelList), 0);
  const easelTees = geometryTees(easelList);
  assert.ok(easelTees >= 1);
  assert.ok(teeLine(buildPlan(easel))!.quantity >= easelTees);
  const frame = generateFromPrompt("pvc frame 24x36");
  assert.equal(passThroughs(members(frame)), 0);
  assert.equal(clashes(members(frame)), 0);
  const plan = buildPlan(frame);
  assert.equal(plan.bom.find((b) => /3-way corner/.test(b.name))!.quantity, 8);
  assert.equal(teeLine(plan), undefined);
  assert.equal(Math.round(plan.totals.estCostUsd * 100) / 100, 49.51);
  const text = plan.instructions.map((s) => s.description ?? "").join("\n");
  assert.match(text, /The fittings are 8 3\/4" PVC 3-way corners, the same fittings on the Buy list\./);
});

test("a dowel ladder stays glue, and racks, fences, and canaries stay put", () => {
  const dowel = buildPlan(generateFromPrompt("dowel ladder 20x60"));
  assert.equal(dowel.bom.some((b) => /PVC (?:tee|elbow|cross|cap)/.test(b.name)), false);
  const shoe = buildPlan(generateFromPrompt("pvc shoe rack"));
  assert.equal(Math.round(shoe.totals.estCostUsd * 100) / 100, 124.96);
  assert.equal(shoe.instructions.some((s) => /The fittings are/.test(s.description ?? "")), false);
  const fence = buildPlan(generateFromPrompt("pvc fence 20 ft long"));
  const cross = fence.bom.find((b) => /PVC cross$/.test(b.name))!;
  assert.equal(cross.catalogId, "pvc-tee");
  assert.equal(Math.round(((cross.estimatedCost ?? 0) / cross.quantity) * 100) / 100, 1.18);
  const daybed = buildPlan(generateFromPrompt("daybed", "pvc-3-4-sch40"));
  assert.equal(Math.round(daybed.totals.estCostUsd * 100) / 100, 76.6);
  const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const linenPlan = buildPlan(linen);
  assert.equal(Math.round(linenPlan.totals.estCostUsd * 100) / 100, 193.68);
  assert.equal(linen.instances.length + linen.panels.length, 11);
  assert.equal(linenPlan.bom.length, 8);
  assert.equal(linenPlan.instructions.length, 9);
  for (const [q, cost, pieces] of [
    ["eiffel tower", 19.96, 446],
    ["water wheel", 137.16, 24],
    ["big ben", 19.96, 385],
    ["brooklyn bridge", 19.96, 802],
    ["submarine", 19.96, 278],
    ["trebuchet", 19.96, 191],
  ] as const) {
    const project = generateFromPrompt(q);
    const plan = buildPlan(project);
    assert.equal(Math.round(plan.totals.estCostUsd * 100) / 100, cost, q);
    assert.equal(project.instances.length + project.panels.length, pieces, q);
  }
});
