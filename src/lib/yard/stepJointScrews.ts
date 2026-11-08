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

/** A back part (never a drawer's back): "Back", "Upper back", "Back panel 2". */
export const BACK_PART = /^(?:upper |lower )?back(?: panel)?(?: \d+)?$/i;
const FASTEN = /\b(?:attach(?:es|ed|ing)?|fasten(?:s|ed|ing)?|screw(?:s|ed|ing)?|nail(?:s|ed|ing)?|brad(?:s|ded)?|staple[sd]?|glue[sd]?|gluing|tack(?:s|ed)?|pin(?:s|ned)?)\b/i;

/**
 * True when this step fastens the back named `name`: the back-of-the-box step, or a step that uses the back and
 * says how it goes on (its title names the back and the text fastens, or one sentence names the back and a
 * fastening verb). Driving screws through the back into wall studs mounts the build; it does not fasten the back.
 */
export function fastensBack(s: { title: string; description?: string; partsUsed?: string[] }, name: string): boolean {
  if (/^(?:Cut|Confirm)\b/i.test(s.title)) return false;
  if (/to the back of the box/.test(s.title)) return true;
  if (!(s.partsUsed ?? []).includes(name)) return false;
  const d = s.description ?? "";
  if (/\bback\b/i.test(s.title) && !/\bstuds?\b/i.test(s.title) && FASTEN.test(d)) return true;
  return d.split(/(?<=[.!?])\s+/).some((t) => /\bback\b/i.test(t) && FASTEN.test(t) && !/\bstuds?\b/i.test(t));
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
  // "both E Uprights, C Bottom and D Seat": the parts a back fastens to, by cut-list letter.
  const touchList = (ids: string[]) => {
    const byLetter = new Map<string, number>();
    for (const p of [...new Set(ids)].map((id) => project.panels.find((q) => q.id === id)!).filter(Boolean)) {
      const line = letterOf(p);
      const key = line ? `${line.label} ${line.name.replace(/\s*\d+$/, "")}` : p.name;
      byLetter.set(key, (byLetter.get(key) ?? 0) + 1);
    }
    const many = (k: string) => (/shelf$/i.test(k) ? `${k.slice(0, -1)}ves` : `${k}s`);
    const talk = [...byLetter.entries()].map(([k, n]) => (n === 2 ? `both ${many(k)}` : n > 2 ? `all ${n} ${many(k)}` : k));
    return talk.length > 1 ? `${talk.slice(0, -1).join(", ")} and ${talk[talk.length - 1]}` : talk[0];
  };
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
      // Bought hardware (a caster under the bottom) is not a back edge: it takes its own screws in its own step.
      const hw0 = new Set(project.panels.filter((p) => p.materialId === "hardware").map((p) => p.id));
      const js = joints.filter((j) => xs.some((p) => p.id === j.a || p.id === j.b) && !hw0.has(j.a) && !hw0.has(j.b));
      const n = js.reduce((s, j) => s + j.screws, 0);
      const list = touchList(js.map((j) => (xs.some((p) => p.id === j.a) ? j.b : j.a)));
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
  // Every back is fastened in a step (I46, Critic #107 row 199): a back that no step fastens, though the model
  // screws it to the parts it touches, gets the same join as any other. A thin back gets its own back-of-the-box
  // step (placed below, after every part it fastens to); a thick back is fastened in the step that sets it.
  const jointLine = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  const len = jointLine?.name.match(/#8 x ([\d/ -]+)"/)?.[1]?.replace("-", " ");
  if (len) {
    const hwIds = new Set(project.panels.filter((p) => p.materialId === "hardware").map((p) => p.id));
    for (const back of project.panels.filter((p) => !p.drawerId && BACK_PART.test(p.name))) {
      if (instructions.some((s) => fastensBack(s, back.name))) continue;
      const at = instructions.findIndex((s) => !/^(?:Cut|Confirm)\b/i.test(s.title) && !/\bstuds?\b/i.test(s.title) && (s.partsUsed ?? []).includes(back.name));
      if (at < 0) continue;
      const js = joints.filter((j) => (j.a === back.id || j.b === back.id) && j.screws > 0 && !hwIds.has(j.a) && !hwIds.has(j.b));
      if (!js.length) continue;
      const n = js.reduce((t, j) => t + j.screws, 0);
      const list = touchList(js.map((j) => (j.a === back.id ? j.b : j.a)));
      const line = letterOf(back);
      const ref = line ? `${line.label} ${line.name.replace(/\s*\d+$/, "")}` : back.name;
      const hw = `#8 × ${len}" screws`;
      if (isThin(back)) {
        const st = {
          step: 0,
          title: `Attach ${ref} to the back of the box`,
          description: `One join: attach ${ref} to the back edges of ${list} with ${n} × ${hw}, one about every 8" along each edge. Square the box first: both diagonals measure the same. Glue the mating edges. Predrill near the ends so the ply does not split.`,
          partsUsed: [back.name],
        };
        instructions = [...instructions.slice(0, at + 1), st, ...instructions.slice(at + 1)];
      } else {
        const s0 = instructions[at];
        const text = `Fasten ${ref} to ${list} with ${n} × ${hw}, glued, one about every 8" along each joint.`;
        instructions = instructions.map((s, i) => (i === at ? { ...s0, description: `${s0.description.replace(/\s*$/, "")}${/[.!?]$/.test(s0.description.trim()) ? "" : "."} ${text}` } : s));
      }
      changed = true;
    }
  }
  // A thin back goes on after every part it fastens to is in place.
  let backShelves = new Set<string>();
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
    // Fixed shelves the back screws into go in AFTER the back (F12 step order, I19): the back squares the
    // box, then each shelf slides in and is screwed through the uprights and through the back into its
    // back edge. Only the carcase the back fastens to has to stand before it.
    const fixedShelfStep = (i: number) => /\bfixed shel/i.test(instructions[i]?.title ?? "");
    const shelfIds = new Set(backTouches.filter((id) => { const at = placed.get(id); return at != null && fixedShelfStep(at) && /shelf/i.test(project.panels.find((p) => p.id === id)?.name ?? ""); }));
    for (const id of backTouches) {
      if (shelfIds.has(id)) continue;
      const at = placed.get(id);
      if (at != null && at > last && !/hinge/i.test(instructions[at].title)) last = at;
    }
    backShelves = shelfIds;
    if (shelfIds.size) {
      // `last` counted fixed-shelf steps as joins; the back needs only the carcase it fastens to.
      last = backAt;
      for (const id of backTouches) {
        if (shelfIds.has(id)) continue;
        const at = placed.get(id);
        if (at != null && at > last && !/hinge/i.test(instructions[at].title)) last = at;
      }
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
  if (backShelves.size) {
    instructions = backThenShelves(project, instructions, joints, backShelves);
    changed = true;
  }
  if (!changed) return plan;
  return { ...plan, instructions: instructions.map((s, i) => ({ ...s, step: i + 1 })) };
}

/** Screws the steps drive: a step's own "drives N" total when it states one, else every "with N × #8" join. */
export function stepScrewCount(plan: BuildPlan): number {
  let n = 0;
  for (const s of plan.instructions) {
    const all = s.description.match(/(?:Drive|drives) (\d+) × #8 /);
    if (/counted in another step's total\./.test(s.description)) continue;
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
    // The model's joints count these screws in the step that places the later part: say so, never "drives 0".
    if (t === 0) return { ...s, description: `${s.description.replace(/\s*$/, "")} These screws are counted in another step's total.` };
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

/**
 * With the back on before the fixed shelves, the back's step names only the carcase it fastens to and the
 * shelf step drives the back-into-shelf screws ("through A Back into the back edge of each shelf").
 */
function backThenShelves(project: YardProject, instructions: BuildPlan["instructions"], joints: ModelJoint[], shelfIds: Set<string>): BuildPlan["instructions"] {
  const backAt = instructions.findIndex((s) => /to the back of the box/.test(s.title));
  const shelfAt = instructions.findIndex((s) => /\bfixed shel/i.test(s.title));
  if (backAt < 0 || shelfAt < 0) return instructions;
  const thin = new Set(project.panels.filter(isThin).map((p) => p.id));
  const toShelves = joints.filter((j) => (thin.has(j.a) && shelfIds.has(j.b)) || (thin.has(j.b) && shelfIds.has(j.a)));
  const n = toShelves.reduce((t, j) => t + j.screws, 0);
  const out = instructions.map((s) => ({ ...s }));
  const back = out[backAt];
  const letter = back.title.match(/^Attach ([A-Z]{1,2}) /)?.[1] ?? "";
  const m = back.description.match(/with (\d+) × (#8 × [\d/ ]+" screws)/);
  if (m) {
    const total = Number(m[1]);
    back.description = back.description
      .replace(/(?:,\s*|\s+and\s+)(?:all \d+ |both )?[A-Z]{1,2} Shel(?:f|ves)\b/, "")
      .replace(/ and ([^,]+) with /, (all, x: string) => all) // keep the list grammar
      .replace(`with ${total} × ${m[2]}`, `with ${total - n} × ${m[2]}`);
    // A list that lost its last item keeps its "and".
    back.description = back.description.replace(/the back edges of ([^.]*?), ([^,]+?) with/, (_a, head: string, tail: string) => `the back edges of ${head} and ${tail} with`);
  }
  const shelf = out[shelfAt];
  const wordBack = letter ? `${letter} Back` : "the back";
  shelf.description = shelf.description.replace(
    /(Square every bay\.)/,
    `$1 The back is already on and square: slide each shelf in to touch it, then drive ${n} × #8 × 1 1/4" screws through ${wordBack} into the shelf back edges, one about every 8".`,
  );
  // The back goes on after the dividers, so "screw through the back" belongs to the back's own step.
  let moved = false;
  for (let i = 0; i < backAt; i++) {
    const d = out[i].description.replace(/\s*Screw through the [A-Z]{0,2} ?back[^.]*\./i, "");
    if (d !== out[i].description) { out[i].description = d; moved = true; }
  }
  if (moved) back.description = `${back.description.replace(/\s*$/, "")} Screw through ${wordBack} into each divider's back edge too.`;
  shelf.partsUsed = [...new Set([...(shelf.partsUsed ?? [])])];
  return out;
}
