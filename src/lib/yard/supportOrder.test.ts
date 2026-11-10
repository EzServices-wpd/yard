/**
 * Step order against part boxes. The geometry here is this file's own: it does not call the
 * engine's support graph, placement index, or plural helper. Empty stand-ins for those still
 * fail a bad order.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCatalogItem } from "./catalog.ts";
import { toPrimitive } from "./geometry.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { shopPlural } from "./shopPlural.ts";
import { supportsOf } from "./supportGraph.ts";
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
type Engine = {
  supportsOf: (project: YardProject) => Map<string, unknown>;
  shopPlural: (label: string, qty: number) => string;
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
  const disc =
    inst.round ?? (item.shape === "ball" ? (item.dims.diameter ?? prim.width) : undefined);
  const L = disc ? span : Math.max(span, inst.cutLength ?? 0);
  const half: [number, number, number] = disc
    ? [L / 2, disc / 2, disc / 2]
    : inst.section
      ? [L / 2, inst.section.width / 2, inst.section.height / 2]
      : prim.radius != null
        ? [L / 2, prim.width / 2, prim.width / 2]
        : [L / 2, prim.width / 2, prim.height / 2];
  const c = [
    (inst.from.x + inst.to.x) / 2,
    (inst.from.y + inst.to.y) / 2,
    (inst.from.z + inst.to.z) / 2,
  ];
  const axes = [d, w, f];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const signs = [sx, sy, sz];
        const p = [c[0], c[1], c[2]];
        for (let k = 0; k < 3; k++)
          for (let a = 0; a < 3; a++)
            p[a] += signs[k] * half[k] * [axes[k].x, axes[k].y, axes[k].z][a];
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
  return (
    b.min[1] <= 0.15 &&
    b.max[1] - b.min[1] <= 3.25 &&
    b.max[0] - b.min[0] <= 4 &&
    b.max[2] - b.min[2] <= 4
  );
}

const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before)\b/i;
const TEST = /\bopen\/close\b|\btest\b/i;

/** Faults read from the boxes and the step words. `engine` is ignored on purpose. */
export function boxOrderFaults(
  project: YardProject,
  steps: AssemblyStep[],
  engine?: Engine,
): string[] {
  if (engine) {
    engine.supportsOf(project);
    engine.shopPlural("shelf", 2);
  }
  const boxes = boxesOf(project);
  const known = new Set(boxes.map((b) => b.name));
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
        const edge =
          (span(upper, lower, 0) && touch(upper, lower, 2)) ||
          (span(upper, lower, 2) && touch(upper, lower, 0));
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
          return (
            (lo > host.min[hostLong] + 0.3 && hi < host.max[hostLong] - 0.3) ||
            host.min[1] <= part.min[1] - 0.4
          );
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

  const at = new Map<string, number>();
  steps.forEach((step, i) => {
    if (FROZEN.test(step.title) || TEST.test(step.title)) return;
    for (const used of step.partsUsed ?? []) {
      const name = [...known].find((n) => n.toLowerCase() === used.toLowerCase());
      if (name && !at.has(name)) at.set(name, i);
    }
  });
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
    if (/^cut\b/i.test(step.title) && [...at.values()].some((j) => j < i))
      out.push(`${step.title} cuts after a part is placed`);
    if (FROZEN.test(step.title)) return;
    if (TEST.test(step.title)) {
      for (const used of step.partsUsed ?? []) {
        const name = [...known].find((n) => n.toLowerCase() === used.toLowerCase());
        const j = name ? at.get(name) : undefined;
        if (j != null && j > i) out.push(`${step.title} tests ${name} before it is placed`);
      }
    }
    if (/^hang it\b/i.test(step.title)) {
      for (const [name, j] of at)
        if (j > i && !pads.has(name) && !boxes.find((b) => b.name === name)?.turns)
          out.push(`hangs before ${name} is placed`);
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

const realEngine: Engine = { supportsOf: (p) => supportsOf(p) as Map<string, unknown>, shopPlural };
const emptyEngine: Engine = { supportsOf: () => new Map(), shopPlural: () => "" };

describe("box order, with the engine support and plural helpers emptied", () => {
  it("a reversed stick build fails", () => {
    const { project, steps } = planOf("dog from popsicle sticks");
    const bad = reverseAssembly(steps);
    for (const engine of [realEngine, emptyEngine]) {
      const faults = boxOrderFaults(project, bad, engine);
      assert.ok(
        faults.some((f) => /body/i.test(f) && /leg/i.test(f)),
        faults.slice(0, 5).join("; "),
      );
    }
  });

  it("standing the main box after its casters fails", () => {
    const { project, steps } = planOf("rolling bookshelf");
    const stand = steps.findIndex((s) => /^Stand the main box\b/.test(s.title));
    const casters = steps.findIndex((s) => /caster/i.test(s.title));
    assert.ok(stand >= 0 && casters > stand);
    const bad = steps.slice();
    const [wheels] = bad.splice(casters, 1);
    bad.splice(stand, 0, wheels);
    for (const engine of [realEngine, emptyEngine]) {
      const faults = boxOrderFaults(project, bad, engine);
      assert.ok(
        faults.some((f) => /caster/i.test(f)),
        faults.slice(0, 8).join("; "),
      );
    }
  });

  it("a lid stay test before the hinge fails", () => {
    const { project, steps } = planOf("jewelry box");
    const stay = steps.findIndex((s) => /lid stay/i.test(s.title));
    const hang = steps.findIndex((s) => /piano hinge/i.test(s.title));
    assert.ok(hang >= 0 && stay > hang);
    const bad = steps.slice();
    const [test] = bad.splice(stay, 1);
    bad.splice(hang, 0, test);
    for (const engine of [realEngine, emptyEngine]) {
      const faults = boxOrderFaults(project, bad, engine);
      assert.ok(
        faults.some((f) => /lid stay/i.test(f) && /lid/i.test(f)),
        faults.slice(0, 6).join("; "),
      );
    }
  });

  it("a centre rail before the end rails fails", () => {
    const { project, steps } = planOf("queen platform bed");
    const centre = steps.findIndex((s) => /centre support/i.test(s.title));
    const ends = steps.findIndex((s) => /end rails/i.test(s.title));
    assert.ok(ends >= 0 && centre > ends);
    const bad = steps.slice();
    const [step] = bad.splice(centre, 1);
    bad.splice(ends, 0, step);
    for (const engine of [realEngine, emptyEngine]) {
      const faults = boxOrderFaults(project, bad, engine);
      assert.ok(
        faults.some((f) => /centre rail/i.test(f) && /rail/i.test(f)),
        faults.slice(0, 8).join("; "),
      );
    }
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
    assert.ok(
      !boxOrderFaults(project, steps).some((f) =>
        /centre rail is placed before (?:head|foot) rail/i.test(f),
      ),
    );
  });

  it("deck stairs from pvc sets tread 1 before riser 2", () => {
    const { project, steps } = planOf("deck stairs from pvc");
    assert.ok(
      !boxOrderFaults(project, steps).some((f) => /riser 2 is placed before tread 1/i.test(f)),
    );
    const tread = steps.findIndex((s) => /Tread 1/.test(s.title));
    const riser = steps.findIndex((s) => /Riser 2/.test(s.title));
    assert.ok(tread >= 0 && tread < riser);
  });

  it("floating desk from pvc hangs after both support arms", () => {
    const { project, steps } = planOf("floating desk from pvc");
    assert.ok(
      !boxOrderFaults(project, steps).some(
        (f) => /hangs before/i.test(f) && /support arm/i.test(f),
      ),
    );
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
      const [step] = bad.splice(cut, 1);
      bad.splice(legs, 0, step);
      assert.ok(
        boxOrderFaults(project, bad, emptyEngine).some((f) => /cuts after/i.test(f)),
        prompt,
      );
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
});

describe("canaries stay byte-identical", () => {
  const pinned = JSON.parse(
    readFileSync(join(here, "supportOrder.canaries.json"), "utf8"),
  ) as Record<string, { pieces: number; usd: number; steps: string }>;
  for (const [prompt, pin] of Object.entries(pinned)) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const steps = plan.instructions.map((s) => `${s.title}\n${s.description}`).join("\n");
      assert.equal(createHash("sha256").update(steps).digest("hex"), pin.steps);
      assert.equal(plan.totals.pieces, pin.pieces);
      assert.equal(plan.totals.estCostUsd, pin.usd);
      if (prompt.startsWith("linen")) {
        assert.deepEqual(
          [project.overall.width, project.overall.height, project.overall.depth],
          [31.5, 78, 16],
        );
        assert.equal(plan.bom.length, 8);
        assert.equal(plan.instructions.length, 9);
      }
    });
  }
});

it("the order module does not call the engine support, placement, or plural helpers", () => {
  const src = readFileSync(join(here, "supportOrder.ts"), "utf8");
  assert.doesNotMatch(
    src,
    /supportGraph|placeEveryPart|shopPlural|supportsOf|placementIndex|familyWord/,
  );
});
