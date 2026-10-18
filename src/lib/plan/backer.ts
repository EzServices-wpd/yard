/**
 * Which cut-list rows are a 1/4" backer panel (plan drawer note). Not an engine file: it reads the plan's own
 * backer nest by import. A row is a backer only when it is sheet stock (plywood, hardboard…) under 1/2" AND its
 * pieces are on the plan's backer sheets (by partIds, else by letter). A 1/4" dowel, a craft stick or a thin
 * strip of board is never a backer, even when it is thin.
 */
import type { CutLine } from "@/lib/yard/types";
import { isSheetStockCut, type PlanSheetNest } from "@/lib/yard/nesting";

type PlanLike = { cutList: CutLine[]; partsKind?: string; sheetNest?: PlanSheetNest | null };

/** Part ids and letters placed on the plan's backer sheets. */
function backerPlaced(plan: PlanLike): { ids: Set<string>; labels: Set<string> } {
  const ids = new Set<string>(), labels = new Set<string>();
  for (const s of plan.sheetNest?.backer?.sheets ?? []) for (const p of s.parts) {
    for (const id of p.partIds ?? []) ids.add(id);
    if (p.label) labels.add(p.label);
  }
  return { ids, labels };
}

export function backerRowIds(plan: PlanLike): Set<string> {
  const out = new Set<string>();
  if (plan.partsKind === "whole") return out;
  const placed = backerPlaced(plan);
  for (const c of plan.cutList) {
    if (c.whole || (c.thicknessIn ?? 0.75) >= 0.5 || !isSheetStockCut(c) || /dowel|stick|skewer|straw|pvc|pipe/i.test(`${c.material} ${c.id}`)) continue;
    const onBacker = c.partIds?.length ? c.partIds.some((id) => placed.ids.has(id)) : !!c.label && placed.labels.has(c.label);
    if (onBacker) out.add(c.id);
  }
  return out;
}
