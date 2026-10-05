/**
 * Steps drive the same joints Buy counts.
 *
 * Every "One join: attach X to Y with N × screws" step gets N from the model's joints between X and Y
 * (modelJoints.panelJoints, the same joints the Buy screw line sums). A thin back is fastened last,
 * once the box stands square, along every edge it touches, so its step names each real support.
 */
import { panelJoints, type ModelJoint } from "./modelJoints";
import type { BuildPlan, CutLine, Panel, YardProject } from "./types";

const sorted3 = (a: number, b: number, c: number) => [a, b, c].sort((x, y) => y - x);
const near = (a: number, b: number) => Math.abs(a - b) < 0.07;

/** The model panels that a lettered cut-list row stands for (same size, same family word). */
export function panelsForLetter(project: YardProject, cutList: CutLine[], letter: string): Panel[] {
  const line = cutList.find((c) => c.label === letter);
  if (!line) return [];
  const want = sorted3(line.lengthIn, line.widthIn, line.thicknessIn);
  const word = line.name.toLowerCase().replace(/\s*\d+$/, "").split(/\s+/).pop() ?? "";
  const sameSize = project.panels.filter((p) => {
    const have = sorted3(p.size.width, p.size.height, p.size.depth);
    return have.every((v, i) => near(v, want[i]));
  });
  const named = sameSize.filter((p) => p.name.toLowerCase().includes(word));
  return named.length ? named : sameSize;
}

function isThin(p: Panel) {
  return Math.min(p.size.width, p.size.height, p.size.depth) < 0.5;
}

const JOIN =
  /attach ([A-Z]{1,2}) ([A-Za-z][A-Za-z ]*?) to ((?:both |the )?(?:[A-Z]{1,2}(?: and [A-Z]{1,2})? )?[A-Za-z ]+?) with (\d+) × (#8 × [\d/ ]+" screws)(?: \((\d+) per (\w+)\))?/;

export function stepsDriveJointScrews(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!project.panels.length) return plan;
  const joints: ModelJoint[] = panelJoints(project.panels);
  const between = (xs: Panel[], ys: Panel[]) =>
    joints.filter(
      (j) =>
        (xs.some((p) => p.id === j.a) && ys.some((p) => p.id === j.b)) ||
        (xs.some((p) => p.id === j.b) && ys.some((p) => p.id === j.a)),
    );
  const letterOf = (p: Panel) =>
    plan.cutList.find((c) => c.label && panelsForLetter(project, plan.cutList, c.label).some((q) => q.id === p.id));
  let changed = false;
  let instructions = plan.instructions.map((step) => {
    const m = step.description.match(JOIN);
    if (!m) return step;
    const [whole, xl, xName, ontoText, , hw, , perWord] = m;
    const xs = panelsForLetter(project, plan.cutList, xl);
    const yLetters = (ontoText.match(/\b[A-Z]{1,2}\b/g) ?? []).filter((t) => t !== "A" || /\bA\b/.test(ontoText));
    const ys = yLetters.flatMap((l) => panelsForLetter(project, plan.cutList, l));
    if (!xs.length || !ys.length) return step;
    if (xs.every(isThin)) {
      // A thin back: every edge it touches, in one step, after those parts stand.
      const js = joints.filter((j) => xs.some((p) => p.id === j.a || p.id === j.b));
      const n = js.reduce((s, j) => s + j.screws, 0);
      const others = [...new Set(js.map((j) => (xs.some((p) => p.id === j.a) ? j.b : j.a)))]
        .map((id) => project.panels.find((p) => p.id === id)!)
        .filter(Boolean);
      const byLetter = new Map<string, number>();
      for (const p of others) {
        const line = letterOf(p);
        const key = line ? `${line.label} ${line.name.replace(/\s*\d+$/, "")}` : p.name;
        byLetter.set(key, (byLetter.get(key) ?? 0) + 1);
      }
      const talk = [...byLetter.entries()].map(([k, n]) => (n === 2 ? `both ${k}s` : n > 2 ? `all ${n} ${k}s` : k));
      const list = talk.length > 1 ? `${talk.slice(0, -1).join(", ")} and ${talk[talk.length - 1]}` : talk[0];
      const text = `attach ${xl} ${xName} to the back edges of ${list} with ${n} × ${hw}, one about every 8" along each edge. Square the box first: both diagonals measure the same`;
      changed = true;
      return { ...step, title: `Attach ${xl} ${xName} to the back of the box`, description: step.description.replace(whole, text), partsUsed: step.partsUsed };
    }
    const js = between(xs, ys);
    if (!js.length) return step;
    const n = js.reduce((s, j) => s + j.screws, 0);
    const per = perWord && ys.length > 1 && n % ys.length === 0 ? ` (${n / ys.length} per ${perWord})` : "";
    const text = `attach ${xl} ${xName} to ${ontoText} with ${n} × ${hw}${per}`;
    if (text === whole) return step;
    changed = true;
    return { ...step, description: step.description.replace(whole, text) };
  });
  // A thin back goes on after every part it fastens to is in place.
  const backAt = instructions.findIndex((s) => /to the back of the box/.test(s.title));
  if (backAt >= 0) {
    const back = instructions[backAt];
    const touches = (s: (typeof instructions)[number]) => /One join: attach [A-Z]{1,2} /.test(s.description);
    let last = backAt;
    instructions.forEach((s, i) => {
      if (i > backAt && touches(s) && !/hinge/i.test(s.title)) last = i;
    });
    if (last > backAt) {
      const lead = back.description.slice(0, back.description.indexOf("One join:")).trim();
      const rest = instructions.filter((_, i) => i !== backAt);
      const insertAt = last; // after removal, index `last` sits right after the old `last` step
      const moved = { ...back, description: back.description.slice(back.description.indexOf("One join:")) };
      const was = plan.instructions[backAt];
      rest[backAt] = {
        ...rest[backAt],
        title: /stand the main box/i.test(was.title) ? was.title : rest[backAt].title,
        description: lead ? `${lead} ${rest[backAt].description}` : rest[backAt].description,
        tips: /stand the main box/i.test(was.title) ? was.tips : rest[backAt].tips,
      };
      rest.splice(insertAt, 0, moved);
      instructions = rest;
      changed = true;
    }
  }
  if (!changed) return plan;
  return { ...plan, instructions: instructions.map((s, i) => ({ ...s, step: i + 1 })) };
}

/** Screws the steps drive: the sum of every "with N × #8" join. */
export function stepScrewCount(plan: BuildPlan): number {
  let n = 0;
  for (const s of plan.instructions) {
    for (const m of s.description.matchAll(/with (\d+) × #8 /g)) n += Number(m[1]);
  }
  return n;
}
