/**
 * Steps drive the same joints Buy counts.
 *
 * Every "One join: attach X to Y with N × screws" step gets N from the model's joints between X and Y
 * (modelJoints.panelJoints, the same joints the Buy screw line sums). A thin back is fastened last,
 * once the box stands square, along every edge it touches, so its step names each real support.
 */
import { panelJoints, type ModelJoint } from "./modelJoints";
import { placementIndex } from "./placeEveryPart";
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
      const many = (k: string) => (/shelf$/i.test(k) ? `${k.slice(0, -1)}ves` : `${k}s`);
      const talk = [...byLetter.entries()].map(([k, n]) => (n === 2 ? `both ${many(k)}` : n > 2 ? `all ${n} ${many(k)}` : k));
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
    // Every part the back fastens to (dividers, shelves, aprons) is in place before the back goes on.
    const thinIds = new Set(project.panels.filter(isThin).map((p) => p.id));
    const backTouches = joints.filter((j) => thinIds.has(j.a) !== thinIds.has(j.b)).map((j) => (thinIds.has(j.a) ? j.b : j.a));
    const placed = placementIndex(project, instructions);
    for (const id of backTouches) {
      const at = placed.get(id);
      if (at != null && at > last && !/hinge/i.test(instructions[at].title)) last = at;
    }
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

/** Screws the steps drive: a step's own "drives N" total when it states one, else every "with N × #8" join. */
export function stepScrewCount(plan: BuildPlan): number {
  let n = 0;
  for (const s of plan.instructions) {
    const all = s.description.match(/(?:Drive|drives) (\d+) × #8 /);
    if (all) {
      n += Number(all[1]);
      continue;
    }
    for (const m of s.description.matchAll(/with (\d+) × #8 /g)) n += Number(m[1]);
  }
  return n;
}

/** The joints the Buy screw line summed, kept per project so the steps read the very same joints. */
export const BUY_JOINTS = new WeakMap<YardProject, ModelJoint[]>();

/**
 * Every step that fastens parts states its screws: each model joint belongs to the step that places
 * the later of its two parts, so the steps add up to the Buy screw line exactly.
 */
export function stepsStateJointScrews(project: YardProject, plan: BuildPlan): BuildPlan {
  const joints = BUY_JOINTS.get(project);
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  if (!joints || !line || !project.panels.length) return plan;
  const total = Number(line.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
  const screwed = joints.filter((j) => j.screws > 0);
  if (screwed.reduce((n, j) => n + j.screws, 0) !== total) return plan;
  const where = placementIndex(project, plan.instructions);
  const perStep = new Map<number, number>();
  for (const j of screwed) {
    const a = where.get(j.a), b = where.get(j.b);
    if (a == null || b == null) return plan; // a part outside every step: leave the plan as Buy wrote it
    const at = Math.max(a, b);
    perStep.set(at, (perStep.get(at) ?? 0) + j.screws);
  }
  const len = line.name.match(/#8 x ([\d/ -]+)"/)?.[1]?.replace("-", " ") ?? "1 1/4";
  const instructions = plan.instructions.map((s, i) => {
    const t = perStep.get(i) ?? 0;
    const stated = [...s.description.matchAll(/with (\d+) × #8 /g)].reduce((n, m) => n + Number(m[1]), 0);
    if (t === stated) return s;
    const sentence = stated
      ? `In all, this step drives ${t} × #8 × ${len}" screws, from the model's joints.`
      : `Drive ${t} × #8 × ${len}" screws in this step, from the model's joints: one about every 8" along each joint (at least 2).`;
    return { ...s, description: `${s.description.replace(/\s*$/, "")}${/[.!?]$/.test(s.description.trim()) ? "" : "."} ${sentence}` };
  });
  // The last screw step sums the build, in the Buy line's own words.
  const last = Math.max(...perStep.keys());
  if (last >= 0 && instructions[last]) {
    const s = instructions[last];
    instructions[last] = { ...s, description: `${s.description.replace(/\s*$/, "")} That brings the build to ${total} screws from the model's joints, the count on the Buy list.` };
  }
  return { ...plan, instructions };
}
