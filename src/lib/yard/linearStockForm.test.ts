/**
 * PVC rack frames. The census below clusters pipe ends by distance and classifies
 * each direction set itself. It does not call the engine's joint labeller.
 * Every check runs on a real sweep build. A mutated Buy count, HUD, title, or
 * role fails that same check.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { headerSize } from "./headerSize.ts";
import type { Vec3, YardInstance } from "./types.ts";
import { readFileSync } from "node:fs";
import { DECLARED_RACK_TYPES } from "./memberStock.ts";
import { railsMissUprights, uprightHeights } from "./pipeRackFrame.ts";
import { corpusRackPrompts, currentRows, sweepPrompts, type SweepPrompt } from "../../../scripts/pvcRackMovers.ts";

const NODE = 0.05;
const STRAIGHT = -0.82;
const OBTUSE = -0.35;
const SQUARE = 0.05;
const RIGHT = 0.08;
const OD = 1.05;
const HUD_TOL = 0.21;

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
  let best = Infinity;
  for (const s of [a, b]) {
    for (const p of [s.from!, s.to!]) {
      const o = s === a ? b : a;
      best = Math.min(best, pointSeg(p, o.from!, o.to!));
    }
  }
  return best;
}

const BOUGHT: Kind[] = ["corner", "tee", "tee4", "cross", "cross5", "cross6", "elbow90", "elbow45", "coupling", "cap"];

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

function buyMatches(geo: Record<string, number>, buy: Record<string, number>): boolean {
  return BOUGHT.every((key) => (buy[key] ?? 0) === (geo[key] ?? 0));
}

const SET_RAILS = /Set the \d+ rails on the \d+ uprights/;
const PLUMB = /stand plumb,/;

function frameBox(members: YardInstance[]): { width: number; depth: number; height: number } {
  const r = OD / 2;
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

function hudOnFrame(hud: { width: number; depth: number; height: number }, box: { width: number; depth: number; height: number }): boolean {
  return Math.abs(hud.width - box.width) < HUD_TOL && Math.abs(hud.depth - box.depth) < HUD_TOL && Math.abs(hud.height - box.height) < HUD_TOL;
}

function postsCalledRails(members: YardInstance[]): boolean {
  return members.some((inst) => {
    if (!inst.from || !inst.to) return false;
    const dx = Math.abs(inst.to.x - inst.from.x);
    const dy = Math.abs(inst.to.y - inst.from.y);
    const dz = Math.abs(inst.to.z - inst.from.z);
    return dy >= dx && dy >= dz && dy > 0.2 && inst.role === "rail";
  });
}

function build(row: SweepPrompt) {
  const project = row.material ? generateFromPrompt(row.prompt, row.material) : generateFromPrompt(row.prompt);
  const plan = buildPlan(project);
  const members = project.instances.filter((i) => i.from && i.to);
  const nodes = clusterNodes(members);
  const geo: Record<string, number> = {};
  for (const node of nodes) geo[kindOf(node)] = (geo[kindOf(node)] ?? 0) + 1;
  const parent = members.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const shares = (a: YardInstance, b: YardInstance) => [a.from!, a.to!].some((p) => [b.from!, b.to!].some((q) => hypot(p, q) <= NODE));
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) if (shares(members[i], members[j])) parent[find(j)] = find(i);
  let clashes = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (segDist(members[i], members[j]) < OD - 0.02 && !shares(members[i], members[j])) clashes += 1;
    }
  }
  const tilt = members.length ? Math.max(0, ...members.map((m) => tiltDeg(m.from!, m.to!))) : 0;
  const seated = (project.notes ?? []).some((n) => /outline of that stock/.test(n)) && members.length > 2 && members.every((m) => m.role === "upright" || m.role === "rail");
  return { project, plan, members, nodes, geo, buy: buyCounts(plan.bom), pieces: members.length ? new Set(members.map((_, i) => find(i))).size : 0, clashes, tilt, seated, label: row.material ? `${row.prompt} [${row.material}]` : row.prompt };
}

function minPitch(nodes: Node[]): number {
  let pitch = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = hypot(nodes[i].p, nodes[j].p);
      if (d > NODE) pitch = Math.min(pitch, d);
    }
  }
  return pitch;
}

const CRITIC: { row: SweepPrompt; cost: number }[] = [
  { row: { prompt: "pvc bike rack" }, cost: 107.73 },
  { row: { prompt: "PVC shoe rack 36 wide 12 deep 30 tall" }, cost: 159.47 },
  { row: { prompt: "pvc shoe racks rail" }, cost: 124.96 },
  { row: { prompt: "pvc dowel drying rack 12 wide" }, cost: 66.08 },
];

test("every seated sweep build is one square frame and Buy matches its own geometry", { timeout: 300_000 }, () => {
  const seated: ReturnType<typeof build>[] = [];
  for (const row of sweepPrompts()) {
    const frame = build(row);
    if (!frame.seated) continue;
    seated.push(frame);
    const tag = frame.label;
    assert.equal(frame.pieces, 1, `${tag} pieces ${frame.pieces}`);
    assert.equal(frame.clashes, 0, `${tag} clashes`);
    assert.ok(frame.tilt <= 1, `${tag} tilt ${frame.tilt}`);
    assert.equal(frame.geo.other ?? 0, 0, `${tag} uncatalogued`);
    assert.ok(minPitch(frame.nodes) >= 2.75 - 1e-6, `${tag} pitch`);
    assert.equal(buyMatches(frame.geo, frame.buy), true, `${tag} buy ${JSON.stringify(frame.buy)} geo ${JSON.stringify(frame.geo)}`);
    const box = frameBox(frame.members);
    const hud = headerSize(frame.project);
    assert.equal(hudOnFrame(hud, box), true, `${tag} HUD ${hud.width},${hud.depth},${hud.height} frame ${box.width},${box.depth},${box.height}`);
    const text = frame.plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
    const titles = frame.plan.instructions.map((s) => s.title);
    assert.ok(titles.some((t) => /^Read this /.test(t)), `${tag} read step`);
    assert.ok(titles.some((t) => t === "Cut every marked length"), `${tag} cut step`);
    assert.ok(titles.some((t) => /^Stand the sides —/.test(t) || /^Run the rails —/.test(t)), `${tag} member step`);
    assert.match(text, /Solvent cement\. Twist a quarter turn and hold until it grabs\./, tag);
    if (uprightHeights(frame.members).length > 1) assert.equal(PLUMB.test(text), false, `${tag} one plumb height`);
    if (railsMissUprights(frame.members)) assert.equal(SET_RAILS.test(text), false, `${tag} rails on uprights`);
    assert.equal(/Stand the posts in the slip fittings/.test(text), false, tag);
    assert.equal(postsCalledRails(frame.members), false, `${tag} posts called rails`);
    for (const id of ["pvc-cross", "pvc-4-way-tee", "pvc-5-way-cross", "pvc-6-way-cross", "pvc-cap"]) {
      const line = frame.plan.bom.find((b) => b.catalogId === id);
      if (!line) continue;
      const titles = (line.offers ?? []).map((o) => o.title);
      assert.ok(titles.length > 0 && titles.every((t) => t.length > 0), `${tag} ${id} label`);
      assert.equal(new Set(titles).size, titles.length, `${tag} ${id} labels collide: ${titles.join(" | ")}`);
    }
  }
  assert.ok(seated.length >= 40, `only ${seated.length} seated builds in the sweep`);
  const caps = seated.filter((f) => (f.geo.cap ?? 0) > 0);
  const fives = seated.filter((f) => (f.geo.cross5 ?? 0) > 0);
  assert.ok(caps.length > 0, "no seated build buys a cap, so dropping caps would not be caught");
  assert.ok(fives.length > 0, "no seated build buys a 5-way cross");
});

test("critic examples buy the prices their frames cost, including two caps", () => {
  for (const { row, cost } of CRITIC) {
    const frame = build(row);
    assert.equal(frame.seated, true, row.prompt);
    assert.equal(Math.round(frame.plan.totals.estCostUsd * 100) / 100, cost, row.prompt);
    assert.equal(buyMatches(frame.geo, frame.buy), true, row.prompt);
  }
  const drying = build({ prompt: "pvc dowel drying rack 12 wide" });
  assert.equal(drying.geo.cap, 2);
  assert.equal(drying.buy.cap, 2);
  const shoe = build({ prompt: "pvc shoe rack" });
  const cross = shoe.plan.bom.find((b) => b.catalogId === "pvc-cross");
  const titles = (cross?.offers ?? []).map((o) => o.title);
  assert.ok(titles.some((t) => /Charlotte/.test(t) && /Sch 40/.test(t)), titles.join(" | "));
  assert.ok(titles.some((t) => /FORMUFIT/.test(t) && /furniture-grade/.test(t) && /8 pack/.test(t)), titles.join(" | "));
  const tee4 = shoe.plan.bom.find((b) => b.catalogId === "pvc-4-way-tee");
  assert.match(tee4?.offers?.[0]?.title ?? "", /FORMUFIT/);
  assert.match(tee4?.offers?.[0]?.title ?? "", /furniture-grade/);
  assert.match(tee4?.offers?.[0]?.title ?? "", /8 pack/);
});

test("dropping caps on a build that buys caps fails the Buy check", () => {
  const frame = build({ prompt: "pvc dowel drying rack 12 wide" });
  assert.ok((frame.buy.cap ?? 0) > 0 && frame.buy.cap === frame.geo.cap);
  assert.equal(buyMatches(frame.geo, frame.buy), true);
  assert.equal(buyMatches(frame.geo, { ...frame.buy, cap: 0 }), false);
});

test("dropping 5-way crosses on a build that buys them fails the Buy check", () => {
  const frame = build({ prompt: "firewood rack 96 wide 48 tall", material: "pvc-3-4-sch40" });
  assert.ok((frame.geo.cross5 ?? 0) > 0);
  assert.equal(frame.buy.cross5, frame.geo.cross5);
  assert.equal(buyMatches(frame.geo, { ...frame.buy, cross5: (frame.buy.cross5 ?? 0) - 1 }), false);
});

test("moving the HUD off the frame fails the frame check", () => {
  const frame = build({ prompt: "pvc shoe rack" });
  const box = frameBox(frame.members);
  const hud = headerSize(frame.project);
  assert.equal(hudOnFrame(hud, box), true);
  assert.equal(hudOnFrame({ ...hud, width: hud.width + 1 }, box), false);
});

test("a seated shoe rack keeps the release step structure and true numbers", () => {
  const frame = build({ prompt: "pvc shoe rack" });
  const titles = frame.plan.instructions.map((s) => s.title);
  assert.match(titles[0], /^Read this Shoe rack before you cut$/);
  assert.ok(titles.includes("Cut every marked length"));
  assert.ok(titles.some((t) => /^Stand the sides — \d+ pieces$/.test(t)));
  assert.ok(titles.some((t) => /^Run the rails — \d+ pieces$/.test(t)));
  const cut = frame.plan.instructions.find((s) => s.title === "Cut every marked length")!.description;
  const said = [...cut.matchAll(/(\d+) ×/g)].reduce((n, m) => n + Number(m[1]), 0);
  assert.equal(said, frame.members.length);
  assert.match(frame.plan.instructions.map((s) => s.description).join(" "), /Solvent cement\. Twist a quarter turn/);
});

test("calling uprights rails fails the role check", () => {
  const frame = build({ prompt: "pvc shoe rack" });
  assert.equal(postsCalledRails(frame.members), false);
  assert.ok(frame.members.some((m) => m.role === "upright"));
  const called = frame.members.map((m) => (m.role === "upright" ? { ...m, role: "rail" } : m));
  assert.equal(postsCalledRails(called), true);
});

test("a rack type outside the declared list stays unseated, and adding boot seats it", () => {
  assert.equal(DECLARED_RACK_TYPES.includes("boot" as (typeof DECLARED_RACK_TYPES)[number]), false);
  const words = new Set<string>();
  for (const prompt of corpusRackPrompts()) {
    for (const m of prompt.toLowerCase().matchAll(/\b([a-z]+)\s+racks?\b/g)) words.add(m[1]);
  }
  words.add("boot");
  for (const word of words) {
    if ((DECLARED_RACK_TYPES as readonly string[]).includes(word)) continue;
    const frame = build({ prompt: `${word} rack`, material: "pvc-3-4-sch40" });
    assert.equal(frame.seated, false, word);
  }
  const boot = build({ prompt: "boot rack", material: "pvc-3-4-sch40" });
  assert.equal(Math.round(boot.plan.totals.estCostUsd * 100) / 100, 19);
  assert.notEqual(boot.project.name, "Shoe rack");
});

test("a fence cross is the tee listing at $1.18, not a separate $2.40 cross", () => {
  const plan = buildPlan(generateFromPrompt("pvc fence 20 ft long"));
  const cross = plan.bom.find((b) => /PVC cross$/.test(b.name));
  assert.ok(cross && cross.quantity > 0);
  assert.equal(cross!.catalogId, "pvc-tee");
  assert.equal(Math.round((cross!.estimatedCost ?? 0) / cross!.quantity * 100) / 100, 1.18);
});

test("every corpus rack prompt, and its 3/4\" PVC override, is in the committed set", () => {
  const file = JSON.parse(readFileSync(new URL("../../../evals/pvcRackMovers.prompts.json", import.meta.url), "utf8")) as {
    prompts: { prompt: string; material?: string }[];
  };
  const set = new Set(file.prompts.map((p) => `${p.prompt}\0${p.material ?? ""}`));
  const live = sweepPrompts().map((p) => `${p.prompt}\0${p.material ?? ""}`);
  assert.deepEqual(live, [...set], "the committed prompt set is not the generated rack-type list");
  const missing: string[] = [];
  for (const prompt of corpusRackPrompts()) {
    if (!set.has(`${prompt}\0`)) missing.push(prompt);
    if (!set.has(`${prompt}\0pvc-3-4-sch40`)) missing.push(`${prompt} [pvc]`);
  }
  for (const prompt of ["wine rack 12 bottles from pvc", "pvc pipe shoe rack", "pvc shoe racks", "3 tier pvc shoe rack"]) {
    if (!set.has(`${prompt}\0`)) missing.push(prompt);
  }
  assert.deepEqual(missing, []);
});

test("the committed results match a fresh sweep, so a edited cost or a hidden mover fails", { timeout: 300_000 }, () => {
  const file = JSON.parse(readFileSync(new URL("../../../evals/pvcRackMovers.results.json", import.meta.url), "utf8")) as {
    prompts: number;
    movers: number;
    rows: { prompt: string; material: string | null; after: { name: string; cost: number; pieces: number; hud: number[]; buy: string; titles: string[] }; omitted: string[] }[];
  };
  const fresh = currentRows();
  assert.equal(fresh.length, file.rows.length);
  const key = (r: { prompt: string; material: string | null }) => `${r.prompt}\0${r.material ?? ""}`;
  const got = new Map(fresh.map((r) => [key(r), r]));
  for (const row of file.rows) {
    const now = got.get(key(row));
    assert.ok(now, row.prompt);
    assert.equal(now!.name, row.after.name, row.prompt);
    assert.equal(now!.cost, row.after.cost, row.prompt);
    assert.equal(now!.pieces, row.after.pieces, row.prompt);
    assert.deepEqual(now!.hud, row.after.hud, row.prompt);
    assert.equal(now!.buy, row.after.buy, row.prompt);
    assert.deepEqual(now!.titles, row.after.titles, row.prompt);
    assert.deepEqual(now!.omitted, row.omitted, row.prompt);
  }
  const movers = file.rows.filter((r) => {
    const now = got.get(key(r))!;
    return now.cost !== r.after.cost;
  });
  assert.equal(movers.length, 0);
  assert.equal(file.prompts, file.rows.length);
});

test("straw, paper, and dowel racks stay off the PVC fitting Buy", () => {
  for (const prompt of ["drinking straw spice rack", "dowel shoe rack", "dowel drying rack 12 wide"]) {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    assert.notEqual(project.primaryMaterialId, "pvc-3-4-sch40", prompt);
    assert.equal(plan.bom.some((b) => /4-way tee|5-way cross|PVC cap/.test(b.name)), false, prompt);
  }
});

test("a coat rack and a one-plane spice rack stay the open frame", () => {
  for (const row of [{ prompt: "coat rack", material: "pvc-3-4-sch40" }, { prompt: "pvc spice rack" }] as SweepPrompt[]) {
    const frame = build(row);
    assert.equal(frame.seated, false, row.prompt);
    assert.ok(frame.project.notes?.some((n) => /Open frame of/.test(n)), row.prompt);
  }
});

test("named non-racks keep the release price", () => {
  const expect: [SweepPrompt, number][] = [
    [{ prompt: "daybed", material: "pvc-3-4-sch40" }, 76.6],
    [{ prompt: "boot stand", material: "pvc-3-4-sch40" }, 65.08],
    [{ prompt: "linen closet 31.5 wide 78 tall 16 deep" }, 193.68],
  ];
  for (const [row, cost] of expect) {
    const frame = build(row);
    assert.equal(frame.seated, false, row.prompt);
    assert.equal(Math.round(frame.plan.totals.estCostUsd * 100) / 100, cost, row.prompt);
  }
  const linen = build({ prompt: "linen closet 31.5 wide 78 tall 16 deep" });
  assert.equal(linen.project.instances.length + linen.project.panels.length, 11);
  assert.equal(linen.plan.bom.length, 8);
  assert.equal(linen.plan.instructions.length, 9);
});
