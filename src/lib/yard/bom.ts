import type { BomLine, YardInstance } from "./types";
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";

export type ForgeBomLine = {
  catalogId: string;
  name: string;
  formFactor: string;
  quantityPieces: number;
  packsNeeded: number;
  unitsPerPack: number;
  unitCostUsd?: number;
  estCostUsd?: number;
  searchQuery?: string;
  asin?: string;
  cutLengths: number[];
  notes?: string;
};

export type ForgeBomResult = {
  lines: ForgeBomLine[];
  totalPieces: number;
  totalEstCostUsd: number;
  primaryMaterialId: string | null;
};

export function buildForgeBom(
  instances: YardInstance[],
  primaryMaterialId?: string | null,
): ForgeBomResult {
  const byId = new Map<string, { count: number; cuts: number[] }>();

  for (const inst of instances) {
    const entry = byId.get(inst.catalogId) ?? { count: 0, cuts: [] };
    entry.count += 1;
    if (inst.cutLength != null) entry.cuts.push(inst.cutLength);
    byId.set(inst.catalogId, entry);
  }

  if (primaryMaterialId && !byId.has(primaryMaterialId)) {
    byId.set(primaryMaterialId, { count: 0, cuts: [] });
  }

  const lines: ForgeBomLine[] = [];
  let totalPieces = 0;
  let totalEstCostUsd = 0;

  for (const [catalogId, data] of byId) {
    const item = getCatalogItem(catalogId);
    if (!item) continue;

    const unitsPerPack = item.unitsPerPack ?? 1;
    const packsNeeded =
      data.count === 0 ? 0 : Math.ceil(data.count / Math.max(1, unitsPerPack));
    const unitCost = item.unitCostUsd;
    const estCost =
      unitCost != null ? packsNeeded * unitsPerPack * unitCost : undefined;

    const uniqueCuts = [
      ...new Set(data.cuts.map((c) => Math.round(c * 100) / 100).filter((c) => c > 0)),
    ].sort((a, b) => b - a);

    lines.push({
      catalogId,
      name: item.name,
      formFactor: item.formFactor,
      quantityPieces: data.count,
      packsNeeded,
      unitsPerPack,
      unitCostUsd: unitCost,
      estCostUsd: estCost,
      searchQuery: item.searchQuery,
      asin: item.asin,
      cutLengths: uniqueCuts,
      notes:
        (item.canCut ?? true) && uniqueCuts.length
          ? `Cut to: ${uniqueCuts.map((c) => `${c}"`).join(", ")}`
          : item.notes,
    });

    totalPieces += data.count;
    if (estCost != null) totalEstCostUsd += estCost;
  }

  lines.sort((a, b) => {
    if (a.catalogId === primaryMaterialId) return -1;
    if (b.catalogId === primaryMaterialId) return 1;
    return b.quantityPieces - a.quantityPieces;
  });

  return {
    lines,
    totalPieces,
    totalEstCostUsd,
    primaryMaterialId: primaryMaterialId ?? null,
  };
}

export function bomLinesFromForge(result: ForgeBomResult): BomLine[] {
  return result.lines
    .filter((l) => l.quantityPieces > 0)
    .map((l) => ({
      name: l.name,
      quantity: l.packsNeeded,
      unit: l.unitsPerPack > 1 ? `pack of ${l.unitsPerPack}` : "ea",
      searchQuery: l.searchQuery,
      asin: l.asin,
      catalogId: l.catalogId,
      estimatedCost: l.estCostUsd,
      notes: `${l.quantityPieces} pieces${l.notes ? ` · ${l.notes}` : ""}`,
    }));
}

export function defaultPlaceLength(catalogId: string): number {
  const item = getCatalogItem(catalogId);
  if (!item) return 12;
  return toPrimitive(item).length;
}
