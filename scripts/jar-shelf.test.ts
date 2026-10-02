import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { uniqueSteps } from "../src/lib/yard/steps.ts";

test("wall shelf for jars stays a hung rack at the typed width", () => {
  const prompt = "wall shelf for jars 24 wide";
  const project = generateFromPrompt(prompt);
  assert.equal(project.overall.width, 24);
  assert.equal(project.overall.depth, 4, "jar rack depth is the shallow wall shelf, not one jar");
  assert.ok(project.overall.height >= 16, "a jar shelf is a wall rack, not a 6 inch stand");
  assert.equal(project.assumptions?.installMode, "wall");
  const lips = project.panels.filter((p) => /jar lip/i.test(p.name));
  const shelves = project.panels.filter((p) => p.type === "shelf");
  assert.ok(shelves.length >= 2, "jars need shelves");
  assert.equal(lips.length, shelves.length, "every shelf gets a lip");
  assert.equal(project.panels.some((p) => /stand post/i.test(p.name)), false);
  const steps = uniqueSteps(project);
  const text = steps.map((s) => `${s.title} ${s.description}`).join("\n");
  assert.match(text, /stud/i);
  assert.match(text, /lip/i);
  const plan = buildPlan(project);
  const buy = plan.bom ?? [];
  const names = buy.map((b) => b.name).join(" ");
  assert.match(names, /plywood/i);
  assert.doesNotMatch(names, /2x2/i);
});
