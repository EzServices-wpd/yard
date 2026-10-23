import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { it } from "node:test";
import { drawerBoxes } from "./hollowDrawers.ts";
import { checkBuild } from "./invariants.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import type { YardProject } from "./types.ts";

const VANITY_PROMPTS = [
  "bathroom vanity", "bathroom vanity 36 wide 21 deep 34 tall", "bathroom vanity 42x23x28",
  "bathroom vanity 32 wide", "bathroom vanity 38 tall", "bathroom vanity 23 deep",
  "bathroom vanity 36 1/2 wide", "bathroom vanity 12.5 deep", "bathroom vanity 2ft 10in tall",
  "bathroom vanity 3'6\" wide", "bathroom vanity from 1/4 plywood", "bathroom vanity from pine boards",
  "bathroom vanity 36 wide 34 tall", "bathroom vanity with 2 doors", "bathroom vanity with 3 drawers",
  "vanity with drawers", "bathroom vanity 48 wide with 2 doors and 4 drawers", "bathroom vanity 6 tall",
  "30 inch bathroom vanity with a door and a drawer",
];

function prompts(): string[] {
  for (const path of ["uploads/probes.jsonl", "/home/ubuntu/.cursor/projects/workspace/uploads/probes_c74d.jsonl"]) {
    if (!existsSync(path)) continue;
    const rows = readFileSync(path, "utf8").trim().split("\n")
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
  const mirror = project.panels.some((p) => p.type === "mirror" || /^mirror$/i.test(p.name));
  const plumbY = Math.min(10, project.overall.height * 0.35);
  const fullBack = project.panels.some((p) => p.type === "back" && p.position.x < -1 && p.position.x + p.size.width > 1 && p.position.y <= plumbY && p.position.y + p.size.height >= plumbY);
  const shelfThru = project.panels.some((p) => p.type === "shelf" && p.position.x < -1 && p.position.x + p.size.width > 1);
  return { doors, drawers, knee, woodMirror, mirror, fullBack, shelfThru, kick: project.panels.some((p) => p.type === "kick") };
}

function inPlumbingBay(project: YardProject) {
  const counter = project.panels.find((p) => p.type === "top" || p.type === "counter");
  if (!counter) return [];
  const span = (ps: YardProject["panels"]) => [Math.min(...ps.map((d) => d.position.x)), Math.max(...ps.map((d) => d.position.x + d.size.width))] as const;
  const doors = project.panels.filter((p) => p.type === "door");
  const drawers = project.panels.filter((p) => p.type === "drawer");
  let x0 = counter.position.x;
  let x1 = x0 + counter.size.width;
  if (doors.length) [x0, x1] = span(doors);
  else if (drawers.length) {
    const [left, right] = span(drawers);
    [x0, x1] = x1 - right > left - x0 ? [right, x1] : [x0, left];
  }
  const bayW = Math.min(14, x1 - x0);
  const bayX = x0 + (x1 - x0 - bayW) / 2;
  const y1 = counter.position.y;
  const over = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
  return project.panels.filter((p) => {
    if (p.type === "back" || p.type === "bottom" || p.type === "top" || p.type === "counter" || p.type === "door" || p.type === "kick" || p.type === "mirror") return false;
    if (/false front|toekick/i.test(p.name)) return false;
    const a = p.position, s = p.size;
    return over(a.x, a.x + s.width, bayX, bayX + bayW) > 0.05 && over(a.y, a.y + s.height, 0, y1) > 0.05 && over(a.z, a.z + s.depth, 0, project.overall.depth + 1) > 0.05;
  });
}

it("a bathroom vanity is a sink base: a door or a drawer, no knee, no unasked mirror, clear plumbing", () => {
  for (const prompt of prompts()) {
    if (!/\b(?:bathroom|sink|bath|plumbing)\b/i.test(prompt)) continue;
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const got = faces(project);
    const askedMirror = /\bmirror\b/i.test(prompt) && !/\bno\s+mirror\b/i.test(prompt);
    assert.equal(got.knee, false, prompt);
    assert.ok(got.doors + got.drawers >= 1, `${prompt}: no door or drawer`);
    assert.equal(got.woodMirror, false, prompt);
    assert.equal(got.mirror, askedMirror, `${prompt}: mirror`);
    assert.equal(plan.bom.some((b) => /mirror/i.test(b.name)), askedMirror, `${prompt}: mirror on Buy`);
    assert.equal(plan.instructions.some((s) => /mirror/i.test(`${s.title} ${s.description}`)), askedMirror, `${prompt}: mirror step`);
    assert.equal(got.fullBack, false, `${prompt}: back closes the plumbing`);
    assert.equal(got.shelfThru, false, `${prompt}: shelf crosses the plumbing`);
    assert.deepEqual(inPlumbingBay(project).map((p) => p.name), [], `${prompt}: part in the plumbing bay`);
    assert.equal(plan.instructions.some((s) => /through the back and the nearest/i.test(s.description)), false, `${prompt}: joint the parts do not share`);
    if (project.overall.height >= 16) assert.equal(got.kick, true, `${prompt}: no toe kick`);
    assert.deepEqual(checkBuild(project, prompt, plan).map((v) => v.msg), [], prompt);
  }
});

it("a sink base hangs a mirror only when one was asked for", () => {
  for (const [prompt, mirror] of [["bathroom vanity no mirror", false], ["bathroom vanity with a mirror", true]] as [string, boolean][]) {
    const project = generateFromPrompt(prompt);
    assert.equal(project.panels.some((p) => p.type === "mirror" || /mirror glass|backer/i.test(p.name)), mirror, prompt);
    assert.deepEqual(checkBuild(project, prompt, buildPlan(project)).map((v) => v.msg), [], prompt);
  }
});

it("typed door and drawer counts on a bathroom vanity are the counts built", () => {
  const cases: [string, number, number][] = [
    ["bathroom vanity with 2 doors", 2, 0],
    ["bathroom vanity with 3 drawers", 0, 3],
    ["bathroom vanity 48 wide with 2 doors and 4 drawers", 2, 4],
    ["30 inch bathroom vanity with a door and a drawer", 1, 1],
  ];
  for (const [prompt, doors, drawers] of cases) {
    const got = faces(generateFromPrompt(prompt));
    assert.equal(got.doors, doors, prompt);
    assert.equal(got.drawers, drawers, prompt);
  }
});

it("bedroom, makeup, seating, stool, table, and mirror cues stay a knee-hole desk", () => {
  for (const prompt of [
    "vanity table", "vanity table with mirror", "bedroom vanity", "sit down vanity", "vanity with a stool",
    "makeup vanity", "knee space", "vanity with knee space", "dressing vanity", "vanity with drawers",
  ]) {
    const project = generateFromPrompt(prompt);
    assert.ok((project.fitted?.unit?.kneeW ?? 0) > 0 || project.panels.some((p) => /knee/i.test(p.name)) || /knee/i.test(project.name), prompt);
    assert.equal(faces(project).woodMirror, false, prompt);
    assert.ok(project.overall.height < 40, `${prompt}: ${project.overall.height} tall`);
    assert.equal(project.panels.some((p) => /sink bay/i.test(p.name)), false, prompt);
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
