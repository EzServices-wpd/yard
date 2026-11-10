/**
 * Step order against this file's own part boxes and its own step words.
 * It does not import the engine support graph, the plural helper, or step-text hashes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCatalogItem } from "./catalog.ts";
import { toPrimitive } from "./geometry.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { orderStepsBySupport, unresolvedFaults } from "./supportOrder.ts";
import { SUPPORT_ORDER_NAMED, supportPromptSet } from "../../../scripts/support-order-prompts.ts";
import type { AssemblyStep, Panel, Vec3, YardInstance, YardProject } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const GAP = 1 / 16;
const STACK = 0.08;
const BEAR = 0.25;

type Box = {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  turns: boolean;
};

const overlap = (a: Box, b: Box, k: number) =>
  Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
const gapOf = (a: Box, b: Box, k: number) =>
  Math.max(a.min[k], b.min[k]) - Math.min(a.max[k], b.max[k]);
const longest = (b: Box) =>
  [0, 1, 2].reduce((m, k) => (b.max[k] - b.min[k] > b.max[m] - b.min[m] ? k : m), 0);

function panelBox(p: Panel): Box | null {
  if (p.type === "drawer" || p.polygon || p.strut || Math.abs(p.yaw ?? 0) > 1e-3) return null;
  const { x, y, z } = p.position;
  const { width: w, height: h, depth: d } = p.size;
  return { name: p.name, min: [x, y, z], max: [x + w, y + h, z + d], turns: !!p.turns };
}

function stickBox(project: YardProject, inst: YardInstance): Box | null {
  if (!inst.from || !inst.to) return null;
  const item = getCatalogItem(inst.catalogId) ?? getCatalogItem(project.primaryMaterialId);
  if (!item) return null;
  const prim = toPrimitive(item, inst.cutLength);
  const dx = inst.to.x - inst.from.x,
    dy = inst.to.y - inst.from.y,
    dz = inst.to.z - inst.from.z;
  const span = Math.hypot(dx, dy, dz) || 0.01;
  const d = { x: dx / span, y: dy / span, z: dz / span };
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  let f: Vec3 = inst.face ?? (Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 });
  const along = dot(f, d);
  f = { x: f.x - d.x * along, y: f.y - d.y * along, z: f.z - d.z * along };
  const fl = Math.hypot(f.x, f.y, f.z) || 1;
  f = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
  const w = { x: d.y * f.z - d.z * f.y, y: d.z * f.x - d.x * f.z, z: d.x * f.y - d.y * f.x };
  const disc = inst.round ?? (item.shape === "ball" ? (item.dims.diameter ?? prim.width) : undefined);
  const L = disc ? span : Math.max(span, inst.cutLength ?? 0);
  const half: [number, number, number] = disc
    ? [L / 2, disc / 2, disc / 2]
    : inst.section
      ? [L / 2, inst.section.width / 2, inst.section.height / 2]
      : prim.radius != null
        ? [L / 2, prim.width / 2, prim.width / 2]
        : [L / 2, prim.width / 2, prim.height / 2];
  const c = [(inst.from.x + inst.to.x) / 2, (inst.from.y + inst.to.y) / 2, (inst.from.z + inst.to.z) / 2];
  const axes = [d, w, f];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const signs = [sx, sy, sz];
        const p = [c[0], c[1], c[2]];
        for (let k = 0; k < 3; k++)
          for (let a = 0; a < 3; a++) p[a] += signs[k] * half[k] * [axes[k].x, axes[k].y, axes[k].z][a];
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], p[a]);
          max[a] = Math.max(max[a], p[a]);
        }
      }
  return { name: inst.role || "member", min, max, turns: false };
}

function boxesOf(project: YardProject): Box[] {
  if (project.panels.length) return project.panels.map(panelBox).filter((b): b is Box => !!b);
  return project.instances.map((i) => stickBox(project, i)).filter((b): b is Box => !!b);
}

function isPad(b: Box): boolean {
  return b.min[1] <= 0.15 && b.max[1] - b.min[1] <= 3.25 && b.max[0] - b.min[0] <= 4 && b.max[2] - b.min[2] <= 4;
}

/** Anything a part sits on or butts into, including a 3/4" cleat or rail. */
function dependencies(boxes: Box[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  const add = (part: string, on: string) => {
    if (!part || part === on) return;
    if (!deps.has(part)) deps.set(part, new Set());
    deps.get(part)!.add(on);
  };
  const span = (a: Box, b: Box, k: number) => overlap(a, b, k) >= BEAR;
  const touch = (a: Box, b: Box, k: number) => overlap(a, b, k) >= -STACK;
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i].turns) continue;
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[j].turns) continue;
      const a = boxes[i],
        b = boxes[j];
      const stack = (upper: Box, lower: Box) => {
        const y = upper.min[1] - lower.max[1];
        if (y > STACK || y < -STACK) return false;
        const full = span(upper, lower, 0) && span(upper, lower, 2);
        const edge = (span(upper, lower, 0) && touch(upper, lower, 2)) || (span(upper, lower, 2) && touch(upper, lower, 0));
        return full || edge;
      };
      if (stack(a, b)) {
        if (isPad(b)) add(b.name, a.name);
        else add(a.name, b.name);
        continue;
      }
      if (stack(b, a)) {
        if (isPad(a)) add(a.name, b.name);
        else add(b.name, a.name);
        continue;
      }
      for (const axis of [0, 2] as const) {
        const g = gapOf(a, b, axis);
        if (g > GAP || g < -GAP) continue;
        const other = axis === 0 ? 2 : 0;
        if (overlap(a, b, other) < BEAR || overlap(a, b, 1) < BEAR) continue;
        const hostOf = (part: Box, host: Box) => {
          const hostLong = longest(host);
          if (hostLong === 1) return host.min[1] <= part.min[1] - 0.4;
          const lo = Math.max(host.min[hostLong], part.min[hostLong]);
          const hi = Math.min(host.max[hostLong], part.max[hostLong]);
          return (lo > host.min[hostLong] + 0.3 && hi < host.max[hostLong] - 0.3) || host.min[1] <= part.min[1] - 0.4;
        };
        if (longest(a) === axis && longest(b) !== axis && hostOf(a, b)) add(a.name, b.name);
        else if (longest(b) === axis && longest(a) !== axis && hostOf(b, a)) add(b.name, a.name);
      }
    }
  }
  for (const [name, ons] of deps)
    for (const on of [...ons])
      if (deps.get(on)?.has(name)) {
        ons.delete(on);
        deps.get(on)!.delete(name);
      }
  return deps;
}

const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before)\b/i;
const TEST = /\bopen\/close\b|\btest\b/i;

function placement(boxes: Box[], steps: AssemblyStep[]): Map<string, number> {
  const known = new Set(boxes.map((b) => b.name));
  const at = new Map<string, number>();
  steps.forEach((step, i) => {
    if (FROZEN.test(step.title) || TEST.test(step.title)) return;
    for (const used of step.partsUsed ?? []) {
      const name = [...known].find((n) => n.toLowerCase() === used.toLowerCase());
      if (name && !at.has(name)) at.set(name, i);
    }
  });
  return at;
}

/** Faults read from these boxes and these step words. */
function boxOrderFaults(project: YardProject, steps: AssemblyStep[]): string[] {
  const boxes = boxesOf(project);
  const deps = dependencies(boxes);
  const at = placement(boxes, steps);
  const out: string[] = [];
  for (const [part, ons] of deps) {
    const i = at.get(part);
    if (i == null) continue;
    for (const on of ons) {
      const j = at.get(on);
      if (j != null && j > i) out.push(`${part} is placed before ${on}`);
    }
  }
  const pads = new Set(boxes.filter(isPad).map((b) => b.name));
  steps.forEach((step, i) => {
    if (/^cut\b/i.test(step.title) && [...at.values()].some((j) => j < i)) out.push(`${step.title} cuts after a part is placed`);
    if (FROZEN.test(step.title)) return;
    if (TEST.test(step.title)) {
      for (const used of step.partsUsed ?? []) {
        const name = knownName(boxes, used);
        const j = at.get(name);
        if (name && j != null && j > i) out.push(`${step.title} tests ${name} before it is placed`);
      }
    }
    if (/^hang it\b/i.test(step.title)) {
      for (const [name, j] of at) if (j > i && !pads.has(name) && !boxes.find((b) => b.name === name)?.turns) out.push(`hangs before ${name} is placed`);
    }
  });
  return out;
}

function knownName(boxes: Box[], used: string): string {
  return boxes.find((b) => b.name.toLowerCase() === used.toLowerCase())?.name ?? "";
}

/** A step word that names a part a later step places. "shelves" counts. */
function forwardWords(steps: AssemblyStep[], names: string[]): string[] {
  const at = new Map<string, number>();
  steps.forEach((step, i) => {
    if (FROZEN.test(step.title)) return;
    for (const used of step.partsUsed ?? []) {
      const name = names.find((n) => n.toLowerCase() === used.toLowerCase());
      if (name && !at.has(name)) at.set(name, i);
    }
  });
  const out: string[] = [];
  steps.forEach((step, i) => {
    const text = `${step.title}. ${step.description ?? ""}`.toLowerCase();
    for (const name of names) {
      const j = at.get(name);
      if (j == null || j <= i) continue;
      if ((step.partsUsed ?? []).some((u) => u.toLowerCase() === name.toLowerCase())) continue;
      const last = name.toLowerCase().replace(/\s+\d+$/, "").split(/\s+/).pop() ?? "";
      const body = last === "shelf" ? "shel(?:f|ves)" : `${last}s?`;
      if (new RegExp(`\\b${body}\\b`, "i").test(text)) out.push(`${step.title} names ${name} before it is placed`);
    }
  });
  return out;
}

function planOf(prompt: string) {
  const project = generateFromPrompt(prompt);
  return { project, steps: buildPlan(project).instructions };
}

function reverseAssembly(steps: AssemblyStep[]): AssemblyStep[] {
  const head = steps.filter((s) => FROZEN.test(s.title));
  const body = steps.filter((s) => !FROZEN.test(s.title)).reverse();
  return [...head, ...body].map((s, i) => ({ ...s, step: i + 1 }));
}

function board(name: string, x: number, y: number, z: number, w: number, h: number, d: number): Panel {
  return {
    id: name,
    name,
    type: "side",
    materialId: "m",
    size: { width: w, height: h, depth: d },
    position: { x, y, z },
    rotation: { x: 0, y: 0, z: 0 },
  } as Panel;
}

function projectOf(panels: Panel[]): YardProject {
  return {
    id: "t",
    name: "t",
    prompt: "t",
    kind: "frame",
    overall: { width: 40, height: 40, depth: 20 },
    instances: [],
    panels,
    primaryMaterialId: "m",
    notes: [],
  } as unknown as YardProject;
}

function step(title: string, parts: string[], description = ""): AssemblyStep {
  return { step: 0, title, description, partsUsed: parts };
}

describe("box order", () => {
  it("a reversed stick build fails", () => {
    const { project, steps } = planOf("dog from popsicle sticks");
    const faults = boxOrderFaults(project, reverseAssembly(steps));
    assert.ok(faults.some((f) => /body/i.test(f) && /leg/i.test(f)), faults.slice(0, 5).join("; "));
  });

  it("standing the main box after its casters fails", () => {
    const { project, steps } = planOf("rolling bookshelf");
    const stand = steps.findIndex((s) => /^Stand the main box\b/.test(s.title));
    const casters = steps.findIndex((s) => /caster/i.test(s.title));
    assert.ok(stand >= 0 && casters > stand);
    const bad = steps.slice();
    const [wheels] = bad.splice(casters, 1);
    bad.splice(stand, 0, wheels);
    const faults = boxOrderFaults(project, bad);
    assert.ok(faults.some((f) => /caster/i.test(f)), faults.slice(0, 8).join("; "));
  });

  it("a lid stay test before the hinge fails", () => {
    const { project, steps } = planOf("jewelry box");
    const stay = steps.findIndex((s) => /lid stay/i.test(s.title));
    const hang = steps.findIndex((s) => /piano hinge/i.test(s.title));
    assert.ok(hang >= 0 && stay > hang);
    const bad = steps.slice();
    const [test] = bad.splice(stay, 1);
    bad.splice(hang, 0, test);
    const faults = boxOrderFaults(project, bad);
    assert.ok(faults.some((f) => /lid stay/i.test(f) && /lid/i.test(f)), faults.slice(0, 6).join("; "));
  });

  it("a centre rail before the end rails fails", () => {
    const { project, steps } = planOf("queen platform bed");
    const centre = steps.findIndex((s) => /centre support/i.test(s.title));
    const ends = steps.findIndex((s) => /end rails/i.test(s.title));
    assert.ok(ends >= 0 && centre > ends);
    const bad = steps.slice();
    const [moved] = bad.splice(centre, 1);
    bad.splice(ends, 0, moved);
    const faults = boxOrderFaults(project, bad);
    assert.ok(faults.some((f) => /centre rail/i.test(f) && /rail/i.test(f)), faults.slice(0, 8).join("; "));
  });
});

describe("the shipped order keeps the supports the boxes require", () => {
  it("rolling bookshelf stands the box before the casters", () => {
    const { project, steps } = planOf("rolling bookshelf");
    assert.ok(!boxOrderFaults(project, steps).some((f) => /caster/i.test(f)));
    const stand = steps.findIndex((s) => /^Stand the main box\b/.test(s.title));
    const casters = steps.findIndex((s) => /caster/i.test(s.title));
    assert.ok(stand < casters);
  });

  it("jewelry box hinges the lid before the stay test", () => {
    const { project, steps } = planOf("jewelry box");
    const hang = steps.findIndex((s) => /piano hinge/i.test(s.title));
    const stay = steps.findIndex((s) => /lid stay/i.test(s.title));
    assert.ok(hang < stay);
    assert.ok(!boxOrderFaults(project, steps).some((f) => /lid stay/i.test(f)));
  });

  it("platform bed sets the end rails before the centre rail", () => {
    const { project, steps } = planOf("queen platform bed");
    const ends = steps.findIndex((s) => /end rails/i.test(s.title));
    const centre = steps.findIndex((s) => /centre support/i.test(s.title));
    assert.ok(ends < centre);
    assert.ok(!boxOrderFaults(project, steps).some((f) => /centre rail is placed before (?:head|foot) rail/i.test(f)));
  });

  it("deck stairs from pvc sets tread 1 before riser 2", () => {
    const { project, steps } = planOf("deck stairs from pvc");
    assert.ok(!boxOrderFaults(project, steps).some((f) => /riser 2 is placed before tread 1/i.test(f)));
    const tread = steps.findIndex((s) => /Tread 1/.test(s.title));
    const riser = steps.findIndex((s) => /Riser 2/.test(s.title));
    assert.ok(tread >= 0 && tread < riser);
  });

  it("floating desk from pvc hangs after both support arms", () => {
    const { project, steps } = planOf("floating desk from pvc");
    assert.ok(!boxOrderFaults(project, steps).some((f) => /hangs before/i.test(f) && /support arm/i.test(f)));
    const hang = steps.findIndex((s) => /^Hang it on studs\b/.test(s.title));
    const arms = steps.map((s, i) => (/support arm/i.test(s.title) ? i : -1)).filter((i) => i >= 0);
    assert.equal(arms.length, 2);
    assert.ok(arms.every((i) => i < hang));
  });

  it("a cut step after the legs fails", () => {
    for (const prompt of ["workbench", "potting bench"]) {
      const { project, steps } = planOf(prompt);
      const cut = steps.findIndex((s) => /^Cut\b/.test(s.title));
      const legs = steps.findIndex((s) => /Stand the legs/.test(s.title));
      const bad = steps.slice();
      const [moved] = bad.splice(cut, 1);
      bad.splice(legs, 0, moved);
      assert.ok(boxOrderFaults(project, bad).some((f) => /cuts after/i.test(f)), prompt);
    }
  });

  it("workbench and potting bench cut before the legs are stood", () => {
    for (const prompt of ["workbench", "potting bench"]) {
      const { project, steps } = planOf(prompt);
      assert.ok(!boxOrderFaults(project, steps).some((f) => /cuts after/i.test(f)), prompt);
      const cut = steps.findIndex((s) => /^Cut\b/.test(s.title));
      const legs = steps.findIndex((s) => /legs/i.test(s.title));
      assert.ok(cut >= 0 && cut < legs, prompt);
    }
  });

  it("the miter-saw dowel station fastens the bottom shelf after the rails it sits on", () => {
    const { project, steps } = planOf("miter saw station from 3/4 inch dowel");
    const boxes = boxesOf(project);
    const ons = dependencies(boxes).get("Bottom shelf");
    assert.ok(ons && [...ons].some((n) => /lower rail/i.test(n)), [...(ons ?? [])].join(", "));
    assert.ok(!boxOrderFaults(project, steps).some((f) => /bottom shelf is placed before/i.test(f) && /rail/i.test(f)));
    const shelf = steps.findIndex((s) => /Bottom shelf/.test(s.title));
    for (const rail of ["Left lower rail", "Front lower rail"]) {
      const at = steps.findIndex((s) => s.title.includes(rail));
      assert.ok(at >= 0 && at < shelf, rail);
    }
  });

  it("the kitchen island keeps the shelf step ahead of the back step", () => {
    const { project, steps } = planOf("kitchen island 48 wide 36 tall 24 deep with 2 drawers and 2 doors");
    const shelf = steps.findIndex((s) => /middle shelf/i.test(s.title));
    const back = steps.findIndex((s) => s.title === "Set the Back");
    assert.ok(shelf >= 0 && shelf < back);
    const swapped = steps.slice();
    const [backStep] = swapped.splice(back, 1);
    swapped.splice(shelf, 0, backStep);
    const names = [...new Set(boxesOf(project).map((b) => b.name))];
    const refs = forwardWords(swapped, names);
    assert.ok(refs.some((f) => /set the back/i.test(f) && /shelf/i.test(f)), refs.slice(0, 6).join("; "));
    assert.ok(!forwardWords(steps, names).some((f) => /set the back/i.test(f) && /shelf/i.test(f)));
  });
});

describe("must-fail mutations", () => {
  const cleat = board("Cleat", 0, 0, 0, 36, 0.75, 2);
  const shelf = board("Shelf", 0, 0.75, 0, 36, 0.75, 10);
  const sign = board("Sign", 80, 0, 0, 8, 8, 0.5);

  it("an inverted support direction fails", () => {
    const boxes = [panelBox(cleat)!, panelBox(shelf)!];
    const ons = dependencies(boxes).get("Shelf");
    assert.ok(ons?.has("Cleat"));
    assert.equal(dependencies(boxes).get("Cleat")?.has("Shelf") ?? false, false);
    const bad = [step("Set the shelf", ["Shelf"]), step("Screw the cleat", ["Cleat"])];
    const faults = boxOrderFaults(projectOf([cleat, shelf]), bad);
    assert.ok(faults.some((f) => /shelf is placed before cleat/i.test(f)), faults.join("; "));
    const good = [step("Screw the cleat", ["Cleat"]), step("Set the shelf", ["Shelf"])];
    assert.deepEqual(boxOrderFaults(projectOf([cleat, shelf]), good), []);
  });

  it("a swap with a non-supporting neighbour fails", () => {
    const project = projectOf([cleat, shelf, sign]);
    const written = [step("Set the shelf", ["Shelf"]), step("Set the sign", ["Sign"]), step("Screw the cleat", ["Cleat"])];
    const swapped = [written[1], written[0], written[2]];
    const faults = boxOrderFaults(project, swapped);
    assert.ok(faults.some((f) => /shelf is placed before cleat/i.test(f)), faults.join("; "));
    assert.deepEqual(
      orderStepsBySupport(project, written).map((s) => s.title),
      written.map((s) => s.title),
    );
  });

  it("a 2-step jump fails", () => {
    const bracket = board("Bracket", 0.75, 8, 0, 12, 1.5, 2);
    const upright = board("Upright", 0, 0, 0, 0.75, 20, 10);
    const project = projectOf([upright, bracket, cleat]);
    const good = [step("Set the upright", ["Upright"]), step("Set the bracket", ["Bracket"]), step("Screw the cleat", ["Cleat"])];
    assert.ok(dependencies([panelBox(upright)!, panelBox(bracket)!]).get("Bracket")?.has("Upright"));
    assert.deepEqual(boxOrderFaults(project, good), []);
    const jumped = [good[1], good[2], good[0]];
    const faults = boxOrderFaults(project, jumped);
    assert.ok(faults.some((f) => /bracket is placed before upright/i.test(f)), faults.join("; "));
    const wrong = [step("Set the shelf", ["Shelf"]), step("Set the sign", ["Sign"]), step("Screw the cleat", ["Cleat"])];
    assert.deepEqual(
      orderStepsBySupport(projectOf([cleat, shelf, sign]), wrong).map((s) => s.title),
      wrong.map((s) => s.title),
    );
  });

  it("re-adding the thickness cutoff fails", () => {
    const project = projectOf([cleat, shelf]);
    const boxes = [panelBox(cleat)!, panelBox(shelf)!];
    assert.ok(cleat.size.height < 1.25);
    assert.ok(dependencies(boxes).get("Shelf")?.has("Cleat"));
    const written = [step("Set the shelf", ["Shelf"]), step("Screw the cleat", ["Cleat"])];
    const faults = unresolvedFaults(project, written);
    assert.ok(faults.some((f) => f.part === "Shelf" && f.on === "Cleat"), JSON.stringify(faults));
    const ordered = orderStepsBySupport(project, written);
    assert.deepEqual(
      ordered.map((s) => s.title),
      ["Screw the cleat", "Set the shelf"],
    );
  });

  it("re-adding the hang skip fails", () => {
    const plaque = board("Plaque", 100, 10, 0, 6, 4, 0.5);
    const project = projectOf([cleat, shelf, plaque]);
    const written = [
      step("Screw the cleat", ["Cleat"]),
      step("Hang it on studs", ["Plaque"]),
      step("Set the shelf", ["Shelf"]),
    ];
    const ordered = orderStepsBySupport(project, written);
    assert.deepEqual(
      ordered.map((s) => s.title),
      ["Screw the cleat", "Set the shelf", "Hang it on studs"],
    );
  });

  it("a forward reference created by a swap fails", () => {
    const back = board("Back", 0, 0, 0, 36, 0.75, 10);
    const onBack = board("Shelf", 0, 0.75, 0, 36, 0.75, 10);
    const project = projectOf([back, onBack]);
    const written = [
      step("Glue the shelf", ["Shelf"]),
      step("Set the back", ["Back"], "Fasten the Back to both shelves."),
    ];
    const swapped = [written[1], written[0]];
    const refs = forwardWords(swapped, ["Shelf", "Back"]);
    assert.ok(refs.some((f) => /set the back/i.test(f) && /shelf/i.test(f)), refs.join("; "));
    assert.deepEqual(
      orderStepsBySupport(project, written).map((s) => s.title),
      written.map((s) => s.title),
    );
    assert.ok(unresolvedFaults(project, written).some((f) => f.part === "Shelf" && f.on === "Back"));
  });
});

describe("linen closet keeps its canary counts", () => {
  it("31.5 by 78 by 16, 11 parts, 8 Buy lines, 9 steps, $193.68", () => {
    const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const plan = buildPlan(project);
    assert.deepEqual([project.overall.width, project.overall.height, project.overall.depth], [31.5, 78, 16]);
    assert.equal(plan.totals.pieces, 11);
    assert.equal(plan.totals.estCostUsd, 193.68);
    assert.equal(plan.bom.length, 8);
    assert.equal(plan.instructions.length, 9);
  });
});

describe("the prompt set is the committed file", () => {
  it("matches supportOrder.prompts.json and contains the named wordings", () => {
    const file = JSON.parse(readFileSync(join(here, "supportOrder.prompts.json"), "utf8")) as string[];
    assert.deepEqual(file, supportPromptSet());
    for (const prompt of SUPPORT_ORDER_NAMED) assert.ok(file.includes(prompt), prompt);
  });
});

it("the order module does not call the engine support, placement, or plural helpers, and does not restore the cutoff or the hang skip", () => {
  const src = readFileSync(join(here, "supportOrder.ts"), "utf8");
  assert.doesNotMatch(src, /supportGraph|placeEveryPart|shopPlural|supportsOf|placementIndex|familyWord/);
  assert.doesNotMatch(src, /1\.25/);
  assert.doesNotMatch(src, /kind === "hang" &&/);
});
