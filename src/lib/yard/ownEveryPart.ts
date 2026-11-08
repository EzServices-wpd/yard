/**
 * F12 part ownership: every model part is installed by one build step. The last pass on a plan: a part no
 * build step installs joins the step that installs its twin ("Fasten the Left support arm" → "Fasten the
 * Left and Right support arms", "Fasten the 3 gondolas" → "the 4 gondolas"), or the step named for it
 * ("Glue up the board"), or gets its own step before the finishing steps. Checked by invariant I18.
 */
import { partLetters } from "./pdfDraw";
import { planStepParts } from "./stepParts";
import { familyWord } from "./placeEveryPart";
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types";

const FINISH = /^(?:seal|finish|sand|check|level|hang it|shim|oil|paint|flatten)/i;
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function unownedParts(project: YardProject, plan: BuildPlan): Panel[] {
  if (!project.panels?.length || !plan.instructions.length) return [];
  const sp = planStepParts(project, plan.instructions, partLetters(project, plan.cutList));
  const owned = new Set(sp.flatMap((s) => s.fresh));
  return project.panels.filter((p) => p.type !== "drawer" && !owned.has(p.id));
}

function joinTwin(step: AssemblyStep, part: Panel, twin: string): AssemblyStep {
  const fam = familyWord(part.name);
  const used = [...(step.partsUsed ?? []), part.name];
  let title = step.title;
  const counted = title.match(new RegExp(`\\b(\\d+) (${esc(fam)}s|${esc(fam)}es)\\b`, "i"));
  if (counted) title = title.replace(counted[0], `${Number(counted[1]) + 1} ${counted[2]}`);
  else if (new RegExp(`\\b${esc(twin)}\\b`).test(title)) title = title.replace(twin, `${twin} and ${part.name}`);
  else title = `${title} and the ${part.name}`;
  return { ...step, title, partsUsed: used, description: `${step.description} The ${part.name} goes on in this step too, the same way.` };
}

export function ownEveryPart(project: YardProject, plan: BuildPlan): BuildPlan {
  let out = plan;
  for (let guard = 0; guard < 8; guard++) {
    const loose = unownedParts(project, out);
    if (!loose.length) return out;
    const part = loose[0];
    const steps = out.instructions.map((s) => ({ ...s }));
    const fam = familyWord(part.name);
    const twinAt = steps.findIndex((s) => !FINISH.test(s.title) && (s.partsUsed ?? []).some((n) => n !== part.name && n !== "*" && familyWord(n) === fam));
    const namedAt = steps.findIndex((s) => !(s.partsUsed ?? []).includes("*") && new RegExp(`\\b${esc(part.name.toLowerCase())}s?\\b`).test(s.title.toLowerCase()));
    if (twinAt >= 0) {
      const twin = (steps[twinAt].partsUsed ?? []).find((n) => familyWord(n) === fam)!;
      steps[twinAt] = joinTwin(steps[twinAt], part, twin);
    } else if (namedAt >= 0) {
      steps[namedAt] = { ...steps[namedAt], partsUsed: [...(steps[namedAt].partsUsed ?? []), part.name] };
    } else {
      const at = (() => { const i = steps.findIndex((s, k) => k > 1 && FINISH.test(s.title)); return i >= 0 ? i : steps.length; })();
      steps.splice(at, 0, { step: at + 1, title: `Fasten the ${part.name}`, description: `Set the ${part.name} in place on the parts it meets and fasten it the same way as the step before.`, partsUsed: [part.name] });
    }
    const next = { ...out, instructions: steps.map((s, i) => ({ ...s, step: i + 1 })) };
    // A change that owns nothing new stops here (the invariant reports the rest).
    if (unownedParts(project, next).length >= loose.length) return out;
    out = next;
  }
  return out;
}
