import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { it } from "node:test";
import { drawerBoxes } from "./hollowDrawers.ts";
import { checkBuild } from "./invariants.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import type { YardProject } from "./types.ts";

/** The vanity probes. The upload is used when this workspace has it; the list is the same 19. */
const VANITY_PROMPTS = [
  "bathroom vanity",
  "bathroom vanity 36 wide 21 deep 34 tall",
  "bathroom vanity 42x23x28",
  "bathroom vanity 32 wide",
  "bathroom vanity 38 tall",
  "bathroom vanity 23 deep",
  "bathroom vanity 36 1/2 wide",
  "bathroom vanity 12.5 deep",
  "bathroom vanity 2ft 10in tall",
  "bathroom vanity 3'6\" wide",
  "bathroom vanity from 1/4 plywood",
  "bathroom vanity from pine boards",
  "bathroom vanity 36 wide 34 tall",
  "bathroom vanity with 2 doors",
  "bathroom vanity with 3 drawers",
  "vanity with drawers",
  "bathroom vanity 48 wide with 2 doors and 4 drawers",
  "bathroom vanity 6 tall",
  "30 inch bathroom vanity with a door and a drawer",
];

function prompts(): string[] {
  for (const path of ["uploads/probes.jsonl", "/home/ubuntu/.cursor/projects/workspace/uploads/probes_c74d.jsonl"]) {
    if (!existsSync(path)) continue;
    const rows = readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { family?: string; prompt: string })
      .filter((row) => row.family === "vanity");
    if (rows.length) return rows.map((row) => row.prompt);
  }
  return VANITY_PROMPTS;
}

function faces(project: YardProject) {
  const doors = project.panels.filter((p) => p.type === "door").length;
  const drawers = drawerBoxes(project.panels).length;
  const knee = (project.fitted?.unit?.kneeW ?? 0) > 0 || project.panels.some((p) => /knee/i.test(p.name));
  const woodMirror = project.panels.some((p) => (p.type === "mirror" || /\bmirror\b/i.test(p.name)) && /plywood/i.test(p.materialId ?? ""));
  const fullBack = project.panels.some((p) => p.type === "back" && p.size.width > project.overall.width - 3);
  const shelfThru = project.panels.some((p) => p.type === "shelf" && p.position.x < -1 && p.position.x + p.size.width > 1);
  const kick = project.panels.some((p) => p.type === "kick");
  return { doors, drawers, knee, woodMirror, fullBack, shelfThru, kick };
}

it("a bathroom vanity is a sink base: a door or a drawer, no knee, no wood mirror", () => {
  for (const prompt of prompts()) {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const got = faces(project);
    assert.equal(got.knee, false, prompt);
    assert.ok(got.doors + got.drawers >= 1, `${prompt}: no door or drawer`);
    assert.equal(got.woodMirror, false, prompt);
    assert.equal(got.fullBack, false, `${prompt}: back closes the plumbing`);
    assert.equal(got.shelfThru, false, `${prompt}: shelf crosses the plumbing`);
    if (project.overall.height >= 16) assert.equal(got.kick, true, `${prompt}: no toe kick`);
    assert.deepEqual(checkBuild(project, prompt, plan).map((v) => v.msg), [], prompt);
  }
});

it("typed door and drawer counts on a bathroom vanity are the counts built", () => {
  const cases: [string, number, number][] = [
    ["bathroom vanity with 2 doors", 2, 0],
    ["bathroom vanity with 3 drawers", 0, 3],
    ["vanity with drawers", 0, 2],
    ["bathroom vanity 48 wide with 2 doors and 4 drawers", 2, 4],
    ["30 inch bathroom vanity with a door and a drawer", 1, 1],
  ];
  for (const [prompt, doors, drawers] of cases) {
    const got = faces(generateFromPrompt(prompt));
    assert.equal(got.doors, doors, prompt);
    assert.equal(got.drawers, drawers, prompt);
  }
});

it("makeup, dressing, and knee space stay a knee-hole desk", () => {
  for (const prompt of ["makeup vanity", "dressing vanity with knee space", "vanity with knee space"]) {
    const project = generateFromPrompt(prompt);
    assert.ok((project.fitted?.unit?.kneeW ?? 0) > 0, prompt);
    assert.equal(faces(project).woodMirror, false, prompt);
  }
});

it("the linen closet canary is unchanged", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const plan = buildPlan(project);
  assert.equal(project.overall.width, 31.5);
  assert.equal(project.overall.depth, 16);
  assert.equal(project.overall.height, 78);
  assert.equal(project.panels.length, 11);
  assert.equal(plan.totals.estCostUsd, 183.7);
});
