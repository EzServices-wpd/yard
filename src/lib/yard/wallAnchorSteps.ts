/**
 * Wall-anchor hardware on Buy is installed by a step (Critic row 231: the Murphy bed bought 4 lag screws into studs
 * and no step drove them). A build that hangs or anchors to the wall does it in the steps, never only in a note:
 * lag screws get a "Lag … to the wall studs" step, an anti-tip kit a strap step, rated wall anchors a step that sets
 * them. The step goes where the note puts it ("before the bed is mounted": right after the back is on), otherwise
 * last, once the unit stands level where it lives.
 */
import { BACK_PART, fastensBack } from "./stepJointScrews";
import type { BuildPlan, YardProject } from "./types";

type Step = BuildPlan["instructions"][number];
type Row = BuildPlan["bom"][number];

/** Buy rows that fasten the build to the wall, and the word a step installing each one names. */
export const WALL_ANCHOR: { row: RegExp; step: RegExp }[] = [
  { row: /\blag (?:screws?|bolts?)\b/i, step: /\blag(?:s|ged|ging)?\b/i },
  { row: /\banti-tip\b/i, step: /\banti-tip\b/i },
  { row: /\b(?:wall anchors?|toggle bolts?)\b/i, step: /\b(?:wall )?anchors?\b|\btoggle/i },
];

export const anchorKind = (b: Row) => WALL_ANCHOR.find((k) => k.row.test(b.name));
const body = (s: Step) => `${s.title}. ${s.description ?? ""}`;
const working = (s: Step) => !/^(?:Cut|Confirm)\b/i.test(s.title);

/** Whether some step installs this wall-anchor Buy row. */
export function anchorInstalled(plan: BuildPlan, b: Row): boolean {
  const k = anchorKind(b);
  return !k || plan.instructions.some((s) => working(s) && k.step.test(body(s)));
}

function anchorStep(project: YardProject, b: Row, note: string | undefined): Step {
  const back = project.panels.find((p) => !p.drawerId && BACK_PART.test(p.name));
  const through = back ? `through the ${back.name.replace(/\s*\d+$/, "")}` : "through the back rail";
  const said = note ? ` ${note.replace(/\s*$/, "").replace(/([^.!?])$/, "$1.")}` : "";
  if (/\blag\b/i.test(b.name)) {
    const n = Math.max(2, b.quantity || 4);
    return {
      step: 0,
      title: "Lag the cabinet to the wall studs",
      description: `Stand the cabinet against the wall where it lives and find two studs behind it with a stud finder; mark their centers.${said} Predrill ${through} into each stud and drive the ${n} × ${b.name} (${Math.ceil(n / 2)} per stud, high and low), snug the washers to the face, and stop before they strip. Load nothing onto it until every lag is in a stud.`,
      partsUsed: back ? [back.name] : [],
    };
  }
  if (/anti-tip/i.test(b.name)) {
    return {
      step: 0,
      title: "Strap the top to a wall stud with the anti-tip kit",
      description: `With the unit standing where it lives, find a stud behind its top with a stud finder. Screw the anti-tip kit's bracket to the top back edge and its wall bracket into the stud, then connect the strap snug, so the unit cannot tip forward.${said}`,
      partsUsed: [],
    };
  }
  return {
    step: 0,
    title: "Set the rated wall anchors",
    description: `Hold the unit level on the wall and mark its screw holes. Drive a screw into a stud wherever a hole lands on one, and set a rated wall anchor at each hole that misses a stud before driving its screw.${said}`,
    partsUsed: [],
  };
}

/** Every wall-anchor Buy row that no step installs gets the step that installs it. */
export function stepsInstallWallAnchors(project: YardProject, plan: BuildPlan): BuildPlan {
  let instructions = plan.instructions;
  for (const b of plan.bom) {
    if (!anchorKind(b) || anchorInstalled({ ...plan, instructions }, b)) continue;
    const kind = anchorKind(b)!;
    // Only the note's sentence about this anchor rides along ("Kids bookcase: 42" tall …" stays in the notes).
    const note = (project.notes ?? []).flatMap((n) => n.split(/(?<=[.!?])\s+/)).find((n) => kind.step.test(n));
    const st = anchorStep(project, b, note);
    // "… before the bed is mounted": anchor the box as soon as its back is on, before anything hangs from it.
    const before = note && /\bbefore\b/i.test(note);
    const backAt = before ? instructions.findIndex((s) => working(s) && project.panels.some((p) => !p.drawerId && BACK_PART.test(p.name) && fastensBack(s, p.name))) : -1;
    const at = backAt >= 0 ? backAt + 1 : instructions.length;
    instructions = [...instructions.slice(0, at), st, ...instructions.slice(at)];
  }
  if (instructions === plan.instructions) return plan;
  return { ...plan, instructions: instructions.map((s, i) => ({ ...s, step: i + 1 })) };
}
