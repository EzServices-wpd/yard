import type { Panel, YardProject } from "./types";

/**
 * "Folding" is built or said plainly: a build with legs gets a locking folding-leg bracket at the top of
 * each leg (bought, drawn, mounted); a build without legs says it stays fixed.
 */
export function withFoldingLegs(project: YardProject, prompt: string): YardProject {
  if (!/\bfold(?:ing|able|s)?\b/i.test(prompt) || project.instances?.length || /fold(?:ing)? (?:door|chair)/i.test(prompt)) return project;
  if (project.panels.some((p) => /^Fold bracket \d+$/.test(p.name))) return project;
  const legs = project.panels.filter((p) => /\blegs?\b/i.test(p.name) && p.type !== "rail" && !p.polygon);
  if (!legs.length) {
    return { ...project, notes: [...(project.notes ?? []), "This one is built fixed: it does not fold."] };
  }
  const brackets: Panel[] = legs.map((l, i) => ({
    id: `${l.id}-fold`,
    type: "side",
    name: `Fold bracket ${i + 1}`,
    materialId: "folding-leg-bracket",
    position: { x: l.position.x + l.size.width, y: l.position.y + l.size.height - 3, z: l.position.z },
    size: { width: 0.25, height: 3, depth: Math.max(1, l.size.depth) },
  }));
  const note = `Each leg folds flat under the top on a locking folding-leg bracket (${legs.length} brackets); lift the lock to fold it.`;
  return { ...project, panels: [...project.panels, ...brackets], notes: [...(project.notes ?? []), note] };
}
