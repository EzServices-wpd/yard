import { getCatalogItem } from "./catalog";
import type { YardProject } from "./types.ts";

/**
 * The stock the build is mostly made of, by wood volume: the stock family (lumber, sheet) with the most
 * volume wins, then its stock with the most volume. Ties go to the recorded primary.
 */
export function mainMaterialId(project: Pick<YardProject, "panels" | "primaryMaterialId">): string {
  const vol = new Map<string, number>();
  for (const p of project.panels) vol.set(p.materialId, (vol.get(p.materialId) ?? 0) + Math.abs(p.size.width * p.size.height * p.size.depth));
  if (!vol.size) return project.primaryMaterialId;
  const family = (id: string) => getCatalogItem(id)?.formFactor ?? id;
  const famVol = new Map<string, number>();
  for (const [id, v] of vol) famVol.set(family(id), (famVol.get(family(id)) ?? 0) + v);
  const primaryFam = family(project.primaryMaterialId);
  let fam = primaryFam;
  for (const [f, v] of famVol) if (v > (famVol.get(fam) ?? 0)) fam = f;
  let best = project.primaryMaterialId;
  let n = family(best) === fam ? (vol.get(best) ?? 0) : -1;
  for (const [id, v] of vol) if (family(id) === fam && v > n) [best, n] = [id, v];
  return best;
}
