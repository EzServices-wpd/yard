/**
 * Buried contact is a joint. The screws a step states are the joints that step closes,
 * and the Buy screw count is that same sum, boxed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelWorldCorners } from "./geometry.ts";
import { panelJoints } from "./modelJoints.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { BUY_JOINTS, stepScrewCount } from "./stepJointScrews.ts";
import type { Panel } from "./types.ts";

const SAWBUCKS = [
  "36 inch tall sawbuck",
  "sawbuck from plywood",
  "sawbuck from 1/4 plywood",
  "thin plywood sawbuck",
  "sawbuck from 2x2",
  "sawbuck",
  "sawbuck from 2x4",
];

const CASES = ["walnut TV stand 60 inch", "bookcase", "dresser", "media console"];

const NOVEL = [
  "firewood rack",
  "garden bench with stretchers 60 long",
  "stool with four stretchers",
  "potting bench 48 wide",
  "sawbuck from 2x6",
  "trestle coffee table",
  "workbench with stretchers",
  "storage bench 48 wide",
];

function boxOf(p: Panel) {
  const c = panelWorldCorners(p);
  return {
    min: [Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.min(...c.map((q) => q.z))],
    max: [Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), Math.max(...c.map((q) => q.z))],
  };
}

function buried(a: Panel, b: Panel): boolean {
  const A = boxOf(a), B = boxOf(b);
  const gaps = [0, 1, 2].map((k) => Math.max(A.min[k], B.min[k]) - Math.min(A.max[k], B.max[k]));
  return gaps.every((g) => g < -1);
}

function plain(p: Panel): boolean {
  return !p.polygon && !p.strut && !p.form;
}

function buyScrews(plan: ReturnType<typeof buildPlan>): { total: number; boxes: number } | null {
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  if (!line) return null;
  const total = Number(line.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
  return { total, boxes: line.quantity };
}

describe("buried contact buys the screws the step drives", () => {
  for (const prompt of [...SAWBUCKS, ...CASES, ...NOVEL]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const bought = buyScrews(plan);
      assert.ok(bought, `${prompt}: no joint screw line`);
      assert.equal(stepScrewCount(plan), bought.total, `${prompt}: steps ${stepScrewCount(plan)} Buy ${bought.total}`);
      assert.equal(bought.boxes, Math.ceil(bought.total / 50));
      const joints = BUY_JOINTS.get(project) ?? panelJoints(project.panels);
      assert.equal(joints.reduce((n, j) => n + j.screws, 0), bought.total);
      const legs = project.panels.filter((p) => plain(p) && /leg|post/i.test(p.name));
      for (const rail of project.panels.filter((p) => plain(p) && /rail|stretcher|apron|rung/i.test(p.name))) {
        const hosts = legs.filter((leg) => buried(rail, leg));
        for (const leg of hosts) {
          const joint = joints.find((j) => (j.a === rail.id && j.b === leg.id) || (j.b === rail.id && j.a === leg.id));
          assert.ok(joint && joint.screws > 0, `${prompt}: ${rail.name} buried in ${leg.name} has no screws`);
        }
        if (/long rail/i.test(rail.name) && hosts.length === 4) {
          const n = joints
            .filter((j) => hosts.some((leg) => (j.a === rail.id && j.b === leg.id) || (j.b === rail.id && j.a === leg.id)))
            .reduce((s, j) => s + j.screws, 0);
          assert.equal(n, 8, `${prompt}: ${rail.name} should drive 8 screws into 4 legs, drove ${n}`);
          const named = rail.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const step = plan.instructions.find((s) => new RegExp(`^Fasten the (?:[A-Z]{1,2} )?${named}\\b`, "i").test(s.title));
          assert.match(step?.description ?? "", /(?:Drive|drives|with) 8 × #8 /, `${prompt}: ${step?.title ?? rail.name} does not state 8 screws`);
        }
      }
    });
  }
});
