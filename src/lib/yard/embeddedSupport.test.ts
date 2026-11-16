/**
 * A rail or stretcher buried in a leg is a support, the same as a face joint.
 * The contact test used to keep only a near-face (let in up to an inch) and drop a
 * deeper overlap, so a step fastened the rail before the second leg was placed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelWorldCorners } from "./geometry.ts";
import { unplacedFastening } from "./placedName.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { panelSupports, supportsOf } from "./supportGraph.ts";
import type { Panel } from "./types.ts";

function part(name: string, type: Panel["type"], x: number, y: number, z: number, w: number, h: number, d: number): Panel {
  return { id: name, name, type, materialId: "lumber-2x4-8", position: { x, y, z }, size: { width: w, height: h, depth: d } };
}

function boxOf(p: Panel) {
  const c = panelWorldCorners(p);
  return {
    min: [Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.min(...c.map((q) => q.z))],
    max: [Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), Math.max(...c.map((q) => q.z))],
  };
}

/** Overlap deeper than an inch on every axis: the rail sits inside the leg, not on a face. */
function buriedIn(rail: Panel, leg: Panel): boolean {
  const A = boxOf(rail), B = boxOf(leg);
  const gaps = [0, 1, 2].map((k) => Math.max(A.min[k], B.min[k]) - Math.min(A.max[k], B.max[k]));
  return gaps.every((g) => -g > 1);
}

/** Four slab legs and one stick passing through all of them, more than an inch inside each. */
function buriedFrame(railName: string, legName: string): Panel[] {
  const legs = [
    part(`${legName} A`, "upright", 0, 0, 0, 2.16, 30, 18),
    part(`${legName} B`, "upright", 2.16, 0, 0, 2.16, 30, 18),
    part(`${legName} C`, "upright", 40, 0, 0, 2.16, 30, 18),
    part(`${legName} D`, "upright", 42.16, 0, 0, 2.16, 30, 18),
  ];
  const rail = part(railName, "rail", 0, 8, 3, 44.32, 3.5, 1.5);
  assert.ok(legs.every((leg) => buriedIn(rail, leg)), railName);
  return [...legs, rail];
}

describe("a rail buried in a leg is a support", () => {
  const frames: [string, string, string][] = [
    ["Trestle stretcher", "Trestle leg", "trestle"],
    ["Bench apron", "Bench leg", "bench"],
    ["Table stretcher", "Table leg", "table"],
    ["Stool rung", "Stool leg", "stool"],
  ];

  for (const [railName, legName] of frames) {
    it(`${railName} lists every leg it passes through`, () => {
      const panels = buriedFrame(railName, legName);
      const sup = panelSupports(panels);
      const on = new Set(sup.get(railName)?.on ?? []);
      assert.deepEqual(
        [...on].sort(),
        panels.filter((p) => p.name.startsWith(legName)).map((p) => p.id).sort(),
      );
    });
  }

  it("a shaped leg's box is not a buried joint", () => {
    const panels = buriedFrame("Brace", "Post").map((p) =>
      p.type === "upright" ? { ...p, polygon: { plane: "xy" as const, pts: [[0, 0], [2, 0], [0, 30]] } } : p,
    );
    const on = panelSupports(panels).get("Brace")?.on ?? [];
    assert.ok(on.length < 4, on.join(","));
  });

  it("a face let in under an inch still counts", () => {
    const leg = part("Leg", "upright", 0, 0, 0, 3.5, 28, 3.5);
    const letIn = part("Apron", "rail", 0, 10, 1, 24, 3.5, 0.75);
    assert.equal(buriedIn(letIn, leg), false);
    const sup = panelSupports([leg, letIn]);
    assert.ok(sup.get("Apron")?.on.includes("Leg"));
  });
});

const NOVEL = [
  "log buck 36 tall",
  "sawing buck from 1/2 plywood",
  "trestle table 72 long",
  "trestle bench 60 long",
  "garden bench with stretchers",
  "stool with stretchers",
  "table with stretchers",
  "picnic table",
];

const REPORTED = ["36 inch tall sawbuck", "sawbuck from plywood", "sawbuck from 1/4 plywood", "thin plywood sawbuck"];

describe("a step fastens a part only to parts already placed", () => {
  for (const prompt of [...NOVEL, ...REPORTED, "sawbuck", "sawbuck 30x40", "sawbuck from 2x4"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const name = new Map(project.panels.map((p) => [p.id, p.name]));
      const plain = (p: Panel) => !p.polygon && !p.strut && !p.form;
      const legs = project.panels.filter((p) => plain(p) && /leg|post|trestle/i.test(p.name));
      for (const rail of project.panels.filter((p) => plain(p) && /rail|stretcher|apron|rung/i.test(p.name))) {
        const on = new Set(sup.get(rail.id)?.on ?? []);
        for (const leg of legs.filter((leg) => buriedIn(rail, leg))) assert.ok(on.has(leg.id), `${prompt}: ${rail.name} dropped ${leg.name}`);
      }
      for (const [id, info] of sup) {
        const i = at.get(id);
        if (i == null) continue;
        for (const support of info.on) {
          const j = at.get(support);
          assert.ok(j == null || j <= i, `${prompt}: ${name.get(id)} before ${name.get(support)}`);
        }
      }
      assert.deepEqual(unplacedFastening(project, plan.instructions), []);
    });
  }

  for (const prompt of REPORTED) {
    it(`${prompt}: both long rails wait until every leg is standing`, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const legs = project.panels.filter((p) => /leg/i.test(p.name));
      assert.equal(legs.length, 4);
      for (const rail of project.panels.filter((p) => /long rail/i.test(p.name))) {
        assert.equal(sup.get(rail.id)?.on.length, 4, rail.name);
        const i = at.get(rail.id)!;
        for (const leg of legs) assert.ok((at.get(leg.id) ?? 99) <= i, `${rail.name} before ${leg.name}`);
      }
    });
  }

  it("sawbuck 30x40 keeps a start on each leg", () => {
    const project = generateFromPrompt("sawbuck 30x40");
    const floors = [...supportsOf(project).values()].filter((info) => info.how === "floor");
    assert.equal(floors.length, 4);
  });
});
