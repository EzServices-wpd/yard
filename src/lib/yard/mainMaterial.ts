import type { YardProject } from "./types.ts";

/** The stock most of the parts are cut from (ties go to the recorded primary), so the page names what the build is made of. */
export function mainMaterialId(project: Pick<YardProject, "panels" | "primaryMaterialId">): string {
  const count = new Map<string, number>();
  for (const p of project.panels) count.set(p.materialId, (count.get(p.materialId) ?? 0) + 1);
  let best = project.primaryMaterialId;
  let n = count.get(best) ?? 0;
  for (const [id, c] of count) if (c > n) [best, n] = [id, c];
  return best;
}
