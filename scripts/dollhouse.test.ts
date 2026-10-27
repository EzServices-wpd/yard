/**
 * Dollhouse family (Chief 10-26, Ezra: real structure, the full object, a stock switch keeps the form). Seam: the prompt
 * through the engine to the plan (parts, cut list, steps, Buy), offline. Expected sizes are hand-worked from the typed size:
 * 24" wide at 45° with a 1" eave = a 22 1/2" house, 11 1/4" rise, eaves at 18", two 8 1/4" storeys in 1/2" plywood.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt, ignoredTypedWords } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { dollhouseIssues, plyDollhouse } from "../src/lib/yard/dollhouse";
import { checkBuild } from "../src/lib/yard/invariants";
import { offline } from "./eval-gate-lib";
import type { YardProject } from "../src/lib/yard/types";

const build = (q: string, mat?: string) => offline(() => generateFromPrompt(q, mat));
const count = (p: YardProject, name: string) => p.panels.filter((x) => x.name === name).length;
const shape = (p: YardProject) => ["Side wall", "Base floor", "Upper floor", "Attic floor", "Room divider", "Back wall", "Roof panel"].map((n) => `${n}:${count(p, n)}`).join(" ");
const TWO = "Side wall:2 Base floor:1 Upper floor:1 Attic floor:1 Room divider:2 Back wall:1 Roof panel:2";

test("a bare dollhouse is the real house: walls, two storeys with doorways, an attic, a gable roof, open front", () => {
  const p = build("dollhouse");
  assert.equal(p.name, "Dollhouse");
  assert.deepEqual(p.overall, { width: 24, height: 30, depth: 12 });
  assert.equal(shape(p), TWO);
  assert.deepEqual(dollhouseIssues(p), []);
  assert.match(p.notes[1], /^Each storey is 8 1\/4" floor to ceiling; the room divider in each storey has a 3" wide doorway/);
  // Open front: no panel stands across the front half of the house.
  assert.ok(!p.panels.some((x) => x.position.z + x.size.depth > 6 && x.size.depth <= 1 && x.size.width > 12), "front is closed");
  // Gable: the back wall peaks above its eaves and both roof panels reach the ridge at the full height.
  const back = p.panels.find((x) => x.name === "Back wall")!;
  assert.deepEqual(back.polygon!.pts.map((q) => q[1]), [0, 0, 18, 29.25, 18]);
  for (const r of p.panels.filter((x) => x.name === "Roof panel")) assert.equal(r.position.y + r.size.height, 30);
  // Each divider has its doorway notched up from the floor, under the next floor.
  for (const d of p.panels.filter((x) => x.name === "Room divider")) {
    const ys = d.polygon!.pts.map((q) => q[1]);
    assert.equal(ys.filter((y) => y === 0).length, 4, "doorway notch");
    const top = d.polygon!.pts[2][1];
    assert.ok(top >= 2 && top <= d.size.height - 1, `doorway ${top} of ${d.size.height}: a lintel stays above it`);
  }
  assert.equal(back.cutouts?.length, 4);
  assert.equal(back.polygon!.holes?.length, 1, "round attic window");
});

test("the plan: every part cut and used in a step, steps in build order, one sheet and its screws on Buy, fractions only", () => {
  const p = build("dollhouse");
  const plan = offline(() => buildPlan(p));
  const used = new Set(plan.instructions.flatMap((s) => s.partsUsed ?? []));
  for (const c of plan.cutList) assert.ok(used.has(c.name), `${c.name} in no step`);
  const at = (re: RegExp) => plan.instructions.findIndex((s) => re.test(s.title));
  const order = [/side walls to the base/, /Build up the storeys/, /back wall/, /roof panels/].map(at);
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `order ${order}`);
  // After the cut step, each part is first used in its own step, in build order: walls on the base, storeys, the back, the roof last.
  const first = (n: string) => plan.instructions.findIndex((s, i) => i > 0 && s.partsUsed?.includes(n));
  assert.deepEqual(["Side wall", "Room divider", "Back wall", "Roof panel"].map(first), order);
  // Square side-wall tops carry the pitched roof on their outer edge only: the step says so (row 582).
  assert.match(plan.instructions[order[3]].description, /rest on the outer edge of each side-wall top/);
  assert.deepEqual(plan.bom.filter((b) => /plywood/i.test(b.name)).map((b) => [b.catalogId, b.quantity]), [["plywood-1-2-4x8", 1]]);
  assert.ok(plan.bom.some((b) => /screws/.test(b.name)) && !plan.bom.some((b) => /shelf pins/.test(b.name)));
  const text = [...p.notes, ...plan.instructions.map((s) => s.description), ...plan.cutList.map((c) => c.notes ?? "")].join(" ");
  assert.ok(!/\d\.\d/.test(text), "a decimal in the words");
});

test("typed size is built exactly; typed storeys are built; the storey word is read", () => {
  const p = build("dollhouse 24 wide 30 tall 12 deep");
  assert.deepEqual(p.overall, { width: 24, height: 30, depth: 12 });
  assert.ok(!p.notes.some((n) => /^Assumed/.test(n)));
  // One typed axis: the others keep the dollhouse's own 12" deep and 30" tall.
  assert.deepEqual(build("dollhouse 20 wide").overall, { width: 20, height: 30, depth: 12 });
  assert.deepEqual(build("dollhouse 30x14x36").overall, { width: 30, height: 36, depth: 14 });
  const card = build("dollhouse 12 wide 16 tall 12.375 deep");
  assert.deepEqual(card.overall, { width: 12, height: 16, depth: 12.375 });
  assert.deepEqual(dollhouseIssues(card), []);
  const two = build("two story dollhouse");
  assert.equal(shape(two), TWO);
  assert.deepEqual(offline(() => ignoredTypedWords(two, "two story dollhouse")), []);
  const three = build("three story dollhouse");
  assert.equal(count(three, "Upper floor"), 2);
  assert.equal(count(three, "Room divider"), 3);
  assert.deepEqual(dollhouseIssues(three), []);
});

test("a stock switch keeps the form: same parts, same size, every panel in the new sheet", () => {
  const half = build("dollhouse from 1/2 plywood");
  const ply = build("dollhouse from plywood");
  const sw = build("dollhouse from 1/2 plywood", "plywood-3-4-4x8");
  assert.ok(half.panels.every((x) => x.materialId === "plywood-1-2-4x8"));
  for (const q of [ply, sw]) {
    assert.equal(shape(q), TWO);
    assert.deepEqual(q.overall, half.overall);
    assert.ok(q.panels.every((x) => x.materialId === "plywood-3-4-4x8"));
    assert.deepEqual(dollhouseIssues(q), []);
    assert.ok(q.panels.filter((x) => x.name === "Side wall").every((x) => x.size.width === 0.75));
  }
  // A stock it can't use keeps the house and says so.
  const pop = build("dollhouse", "popsicle-standard");
  assert.equal(shape(pop), TWO);
  assert.ok(pop.notes.some((n) => /Popsicle Stick can't build this dollhouse, so it stays 1\/2" Plywood/.test(n)));
  // 1/4" plywood is too thin to screw: the house stays 1/2" and names the sheets it takes.
  const thin = build("dollhouse from 1/4 plywood");
  assert.equal(shape(thin), TWO);
  assert.ok(thin.panels.every((x) => x.materialId === "plywood-1-2-4x8"));
  assert.ok(thin.notes.some((n) => /^1\/4" Plywood .* stays 1\/2" Plywood .* Pick 1\/2" or 3\/4" plywood to switch it\.$/.test(n)));
});

test("sizes it can't hold are refused or said plainly, never dropped", () => {
  const low = build("three story dollhouse 12 tall");
  assert.match(low.refused ?? "", /^A 3-storey dollhouse needs at least \d+(?: \d\/\d)?" tall .* Nothing is built at 12"\.$/);
  assert.equal(low.panels.length, 0);
  const one = build("dollhouse 8 tall");
  assert.equal(count(one, "Upper floor"), 0);
  assert.equal(count(one, "Room divider"), 1);
  assert.ok(one.notes.some((n) => /^At 8" tall the house has room for one storey; type \d+(?: \d\/\d)?" tall for two\.$/.test(n)));
  assert.match(build("dollhouse 3 wide").refused ?? "", /needs at least .* wide/);
  assert.match(build("dollhouse 100 wide").refused ?? "", /at most 96" wide/);
});

test("only the dollhouse moved: a dollhouse bed and a craft-stock dollhouse keep their own builds", () => {
  for (const q of ["dollhouse bed", "dollhouse furniture", "dollhouse storage box"]) assert.notEqual(build(q).shape?.classId, "dollhouse", q);
  assert.match(build("cardboard dollhouse").primaryMaterialId, /cardboard/);
  assert.notEqual(build("popsicle stick dollhouse").shape?.classId, "dollhouse");
});

test("the guard reads a broken dollhouse back: a closed front, a missing roof, floor or doorway", () => {
  const p = build("dollhouse");
  const side = p.panels.find((x) => x.name === "Side wall")!;
  const front = { ...side, id: "front", name: "Front wall", position: { ...side.position, z: 11.5 }, size: { width: 22.5, height: 18, depth: 0.5 } };
  assert.match(JSON.stringify(dollhouseIssues({ ...p, panels: [...p.panels, front] })), /closes the front/);
  assert.match(JSON.stringify(dollhouseIssues({ ...p, panels: p.panels.filter((x) => x.name !== "Roof panel") })), /Roof panel: 0 of 2/);
  assert.match(JSON.stringify(dollhouseIssues({ ...p, panels: p.panels.filter((x) => x.name !== "Upper floor") })), /Upper floor: 0 of 1/);
  const shut = p.panels.map((x) => (x.name === "Room divider" ? { ...x, polygon: { plane: "zy" as const, pts: [[0, 0], [11.5, 0], [11.5, 8], [0, 8]] as [number, number][] } } : x));
  assert.match(JSON.stringify(dollhouseIssues({ ...p, panels: shut })), /no doorway/);
});

test("count rule: any typed storey or room count is built as typed or refused with a usable minimum, never shrunk", () => {
  for (const [q, s] of [["5 story dollhouse", 5], ["8 story dollhouse 96 tall", 8], ["ten story dollhouse 96 tall", 10]] as const) {
    const p = build(q);
    if (p.refused) assert.match(p.refused, /at least [\d /]+" tall|\d+ storeys fit/, q);
    else { assert.equal(p.shape?.params?.storeys, s, q); assert.equal(count(p, "Upper floor"), s - 1, q); assert.deepEqual(dollhouseIssues(p), [], q); }
  }
  assert.match(build("10 story dollhouse").refused ?? "", /needs at least 47 1\/2" tall/);
  assert.match(build("30 story dollhouse 96 tall").refused ?? "", /at most \d+ storeys fit/);
  const six = build("dollhouse with 6 rooms");
  assert.equal(count(six, "Room divider"), 4);
  assert.equal(six.panels.find((x) => x.name === "Back wall")!.cutouts?.length, 6, "a window per room");
  assert.deepEqual(dollhouseIssues(six), []);
  assert.equal(count(build("dollhouse with 5 rooms"), "Room divider"), 3);
  assert.match(build("dollhouse 12 wide with 6 rooms").refused ?? "", /at least 15 1\/2" wide/);
  assert.match(build("two story dollhouse with 1 room").refused ?? "", /1 or fewer storeys/);
});

test("every variant prices every Buy line and passes the invariants; outdoor words keep the indoor plywood form; unbuilt features are named", () => {
  const variants = ["dollhouse", "dollhouse from plywood", "dollhouse from 1/4 plywood", "dollhouse with a porch", "outdoor dollhouse", "garden dollhouse", "mdf dollhouse", "barbie dollhouse", "dollhouse with stairs", "dollhouse with a chimney and a garage", "dollhouse 2 floors", "dollhouse kit 1:12 scale", "three story dollhouse", "dollhouse 36x14x40"];
  for (const q of variants) {
    const p = build(q);
    const plan = offline(() => buildPlan(p));
    assert.equal(p.shape?.classId, "dollhouse", q);
    assert.equal(plyDollhouse(q), true, q);
    assert.deepEqual(plan.bom.filter((b) => !((b.estimatedCost ?? 0) > 0)).map((b) => b.name), [], `${q}: unpriced Buy line`);
    assert.deepEqual(offline(() => checkBuild(p, q, plan)).map((v) => v.id), [], q);
    assert.ok(p.panels.every((x) => /^plywood-(?:1-2|3-4)-/.test(x.materialId)), `${q}: a panel left the plywood form`);
    assert.equal(shape(p).replace(/Upper floor:\d|Room divider:\d/g, ""), TWO.replace(/Upper floor:\d|Room divider:\d/g, ""), q);
  }
  const notes = (q: string) => build(q).notes.join(" ");
  assert.match(notes("dollhouse with a porch"), /You asked for a porch; this dollhouse is built without one for now\./);
  assert.ok(!/exterior/i.test(notes("dollhouse with a porch")));
  assert.match(notes("outdoor dollhouse"), /built for indoors, in interior plywood .* keep it under cover/);
  assert.match(notes("dollhouse with stairs"), /You asked for stairs; this dollhouse is built without them for now\./);
  assert.match(notes("dollhouse with a chimney and a garage"), /a chimney; .* without one.*a garage; .* without one/);
  assert.match(notes("mdf dollhouse"), /^.*MDF isn't on the stock list, so this dollhouse is cut from 1\/2" Plywood/);
  const barbie = build("barbie dollhouse");
  assert.deepEqual(barbie.overall, { width: 36, height: 48, depth: 14 });
  assert.ok(Number(barbie.shape?.params?.clear) >= 12, "a fashion doll stands in each storey");
  assert.equal(build("dollhouse 2 floors").shape?.params?.storeys, 2);
  // Craft stock keeps its own build, and its outdoor words still switch on the exterior package.
  assert.equal(plyDollhouse("outdoor popsicle stick dollhouse"), false);
});
