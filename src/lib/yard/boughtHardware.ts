/**
 * Hardware on Buy shows in the model, and the model holds no phantom parts.
 * A rack that buys coat hooks draws those hooks on its rail (bought, kept off the cut list),
 * in place of wooden pegs cut from the sheet.
 */
import type { Panel, YardProject } from "./types";
import { hookCount } from "./hookCount";

/** Bought hardware drawn in the model (coat hooks, coat pegs, deck pier blocks): on Buy, never on the cut list. */
export function isBoughtHardwareName(name: string): boolean {
  return /^(?:Coat (?:hook|peg)|Footing) \d+$/.test(name);
}

/** The same test Buy uses to add the coat-hook line. */
export function buysCoatHooks(project: Pick<YardProject, "name" | "prompt">): boolean {
  const prompt = (project.prompt ?? "").toLowerCase();
  return (
    /coat/i.test(project.name) ||
    /\bcoat hook board\b/.test(prompt) ||
    (/coat/.test(prompt) && /rack|hook|rail|peg|tree/.test(prompt)) ||
    /\b(?:coat|hat|key|leash)\s+(?:rack|holder)\b/i.test(project.name)
  );
}

const HOOK_W = 1.25;
const HOOK_H = 2.75;
/** Depth into the room: plate on the rail face, stem+curl past the front (≥1.5″ past rail). */
const HOOK_D = 3.5;

/** Wooden "Peg N" sticks (and their stops) become the bought hooks, one for one, at the same spots. */
export function hooksShowInModel(project: YardProject): YardProject {
  if (!project.panels.length || !buysCoatHooks(project) || project.panels.some((p) => /^Coat hook \d+$/.test(p.name))) return project;
  const pegs = project.panels.filter((p) => /^Peg \d+$/.test(p.name));
  const noun = "hook"; // Buy sells coat hooks, so the model draws hooks whatever the rack calls them
  // Hooks screw to the peg rail, else to the front board of a wall-hung piece (a key holder's fascia).
  const rail = project.panels.find((p) => /peg rail/i.test(p.name)) ?? (pegs.length ? undefined : project.panels.find((p) => /fascia|wall cleat/i.test(p.name)));
  if (!pegs.length && !rail) return project;
  const front = rail ? rail.position.z + rail.size.depth : pegs[0].position.z;
  const base = pegs[0] ?? rail!;
  // The count Buy and the steps read (typed count, else one every 6"), spread evenly along the rail.
  const n = hookCount({ prompt: project.prompt, name: project.name, railWidth: project.overall.width });
  const left = rail ? rail.position.x : Math.min(...pegs.map((p) => p.position.x));
  const span = rail ? rail.size.width : Math.max(...pegs.map((p) => p.position.x + p.size.width)) - left;
  const y = rail ? rail.position.y + Math.min(1.5, rail.size.height / 2) : pegs[0].position.y; // screw holes 1 1/2" up from the rail's bottom edge, as the step marks
  const hooks: Panel[] = Array.from({ length: n }, (_, i) => ({
    id: `${base.id}-hook-${i + 1}`,
    type: pegs[0]?.type ?? "side",
    name: `Coat ${noun} ${i + 1}`,
    materialId: "coat-hooks",
    position: { x: left + (span * (i + 0.5)) / n - HOOK_W / 2, y, z: front },
    size: { width: HOOK_W, height: HOOK_H, depth: HOOK_D },
  }));
  const drop = new Set(project.panels.filter((p) => /^Peg \d+$|^Peg stop$/.test(p.name)).map((p) => p.id));
  const kept = project.panels.filter((p) => !drop.has(p.id));
  return { ...project, panels: [...kept, ...hooks] };
}
