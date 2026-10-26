// PR 14a (plan concept 8, L600/L602): the scale figure and props never reach the Buy list, the part count, the
// cut list, the steps, the price or any export. They are bench-only drawings on their own layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { FIGURES, PROP_LAYER, PROP_SIZES, figureBox, propSpots } from "../src/components/workspace/scale-props";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
/** The plan as JSON, less its clock stamp (generatedAt is the only field that moves between two builds). */
const planJson = (p: object) => JSON.stringify({ ...p, generatedAt: undefined });
const deepFreeze = <T,>(o: T): T => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};

test("linen canary: props sit on its shelves, and the plan (Buy, parts, cuts, steps, price) is byte-identical", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const before = planJson(buildPlan(project));
  const projectJson = JSON.stringify(project);
  const spots = propSpots(deepFreeze(project).panels, project.name); // frozen: a write would throw
  assert.ok(spots.length > 0, "linen shelves get towels");
  assert.ok(spots.every((s) => s.kind === "towel"), "a linen closet holds towels");
  assert.equal(JSON.stringify(project), projectJson, "the project is untouched");
  const after = buildPlan(project);
  assert.equal(planJson(after), before, "the plan is untouched");
  assert.equal(after.totals.pieces, 11, "part count stays the canary's 11");
  const names = [...after.bom.map((b) => b.name), ...after.cutList.map((c) => c.name)].join("|");
  assert.doesNotMatch(names, /towel|mug|book|person|kid|figure/i, "no prop on the Buy list or the cut list");
  const ids = new Set([...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)]);
  for (const s of spots) assert.ok(!("id" in s) || !ids.has((s as { id?: string }).id!), "a prop carries no part id");
});

test("props fit: each one sits on a shelf top and under the shelf above, inside the shelf's depth", () => {
  const project = generateFromPrompt("bookshelf 36 wide 72 tall 12 deep");
  const spots = propSpots(project.panels, "bookshelf");
  assert.ok(spots.length > 0, "a bookshelf gets books");
  const flats = project.panels.filter((p) => p.size.height <= 1.5);
  for (const s of spots) {
    const under = flats.find((p) => Math.abs(p.position.y + p.size.height - s.y) < 1e-6 && s.x > p.position.x && s.x < p.position.x + p.size.width);
    assert.ok(under, `${s.kind} at y ${s.y} sits on a top`);
    assert.ok(s.d <= under!.size.depth, `${s.kind} fits the shelf depth`);
    const above = flats.filter((p) => p !== under && p.position.y >= s.y && s.x > p.position.x && s.x < p.position.x + p.size.width).map((p) => p.position.y);
    if (above.length) assert.ok(s.y + s.h <= Math.min(...above) + 1e-6, `${s.kind} clears the shelf above`);
  }
});

test("real-world sizes in inches: 5′9″ person, 3′6″ kid, towel, hardcover, mug", () => {
  assert.equal(FIGURES.person.height, 69);
  assert.equal(FIGURES.kid.height, 42);
  assert.deepEqual(PROP_SIZES.towel, { w: 13, d: 10, h: 2.25 });
  assert.deepEqual(PROP_SIZES.book, { w: 1.25, d: 6.5, h: 9.5 });
  assert.deepEqual(PROP_SIZES.mug, { w: 3.25, d: 3.25, h: 3.75 });
  const b = { minX: -10, maxX: 10, minY: 0, maxY: 30, minZ: -6, maxZ: 6 };
  assert.deepEqual(figureBox(b, "off"), b);
  assert.ok(figureBox(b, "person").maxY >= 69 && figureBox(b, "person").minX < -10);
});

test("guard: no engine, Buy, plan, PDF or server file imports the scale layer", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(e.name) && /scale-(props|ghost)/.test(read(f))) hits.push(f);
    }
  };
  walk("src");
  if (fs.existsSync(path.join(root, "server"))) walk("server");
  assert.deepEqual(hits.sort(), [
    "src/components/workspace/bench-options.tsx",
    "src/components/workspace/canvas.tsx",
    "src/components/workspace/scale-ghost.tsx",
  ]);
});

test("guard: the scale layer draws on PROP_LAYER only, tags no part, writes no store, and step photos leave it out", () => {
  const ghost = read("src/components/workspace/scale-ghost.tsx");
  const props = read("src/components/workspace/scale-props.ts");
  for (const src of [ghost, props]) {
    assert.doesNotMatch(src, /yardPart/, "no part tag");
    assert.doesNotMatch(src, /useYard|lib\/yard\/store/, "no project store");
    assert.doesNotMatch(src, /onClick|onPointer/, "no handlers, so no picking");
  }
  const meshes = ghost.match(/<(mesh|Line)\b[^>]*>/g) ?? [];
  assert.ok(meshes.length >= 4);
  for (const m of meshes) assert.match(m, /layers=\{PROP_LAYER\}/, `on its own layer: ${m.slice(0, 60)}`);
  assert.equal(PROP_LAYER, 2);
  const canvas = read("src/components/workspace/canvas.tsx");
  const cap = canvas.slice(canvas.indexOf("function StepCapture"), canvas.indexOf("export function WorkspaceCanvas"));
  assert.ok(cap.indexOf("cam.layers.disable(PROP_LAYER)") > 0 && cap.indexOf("cam.layers.disable(PROP_LAYER)") < cap.indexOf("toDataURL"), "step photo renders without props");
});
