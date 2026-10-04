import type { BomLine, YardInstance } from "./types";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { kerfFor, packLengths } from "./linearPack";

/** Stock bought by length. */
const LINEAR_FORMS = new Set(["stick", "dowel", "tube", "pipe", "board"]);

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

/** What one stock piece is called on Buy, read from the stock's own name ("Bamboo Skewer 12\"" → skewer). */
function stockNoun(name: string): string {
  const m = name.toLowerCase().match(/\b(skewer|dowel|stick|pipe|tube|rod|board|straw|stud)s?\b/);
  return m ? m[1] : "stick";
}

function isCutLinear(catalogId: string): boolean {
  const item = getCatalogItem(catalogId);
  return !!item && item.canCut !== false && !isWholeStock(item) && LINEAR_FORMS.has(item.formFactor);
}

export function buildForgeBom(
  instances: YardInstance[],
  primaryMaterialId?: string | null,
): ForgeBomResult {
  const byId = new Map<string, { count: number; cuts: number[] }>();

  for (const inst of instances) {
    const entry = byId.get(inst.catalogId) ?? { count: 0, cuts: [] };
    entry.count += 1;
    if (inst.cutLength != null) entry.cuts.push(inst.cutLength);
    else if (inst.from && inst.to && isCutLinear(inst.catalogId)) {
      // A drawn member on cut-to-length stock is a cut at its span, not a whole stick.
      entry.cuts.push(Math.hypot(inst.to.x - inst.from.x, inst.to.y - inst.from.y, inst.to.z - inst.from.z));
    }
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
    let packsNeeded =
      data.count === 0 ? 0 : Math.ceil(data.count / Math.max(1, unitsPerPack));
    const unitCost = item.unitCostUsd;

    const whole = isWholeStock(item) && data.cuts.length === 0;
    // Anything bought by length and cut (craft sticks, dowels, tube, pipe, boards): cuts share a stock
    // length through the one linear packer, so Buy follows the sticks actually used, not one per piece.
    const linearCut =
      data.cuts.length > 0 &&
      item.canCut !== false &&
      (isWholeStock(item) || LINEAR_FORMS.has(item.formFactor));
    let sticksUsed = 0;
    let spare = "";
    if (linearCut) {
      const pack = packLengths(data.cuts, toPrimitive(item).length, kerfFor(item, isWholeStock(item)));
      sticksUsed = pack.sticks + (data.count - data.cuts.length);
      packsNeeded = Math.ceil(sticksUsed / Math.max(1, unitsPerPack));
      spare = pack.spare ? ` ${pack.spare}` : "";
    }
    const uniqueCuts = [
      ...new Set(data.cuts.map((c) => Math.round(c * 100) / 100).filter((c) => c > 0)),
    ].sort((a, b) => b - a);

    const ripped = instances.find((i) => i.catalogId === catalogId && i.section)?.section;
    const cutParts = instances.filter((i) => i.catalogId === catalogId && i.section);
    const partsVary = cutParts.some((i) => Math.abs(i.section!.width - ripped!.width) > 0.01 || i.section!.width > 6);
    let notes: string | undefined;
    if (item.formFactor === "sheet" && ripped && data.count > 0 && partsVary) {
      // Cut parts of different sizes (panels, discs, strips) nest on whole sheets, shelf by shelf.
      const sheetL = Math.max(1, item.dims.length ?? 96);
      const sheetW = Math.max(1, item.dims.width ?? 48);
      const rects = instances
        .filter((i) => i.catalogId === catalogId)
        .map((i) => {
          const len = i.cutLength ?? (i.from && i.to ? Math.hypot(i.to.x - i.from.x, i.to.y - i.from.y, i.to.z - i.from.z) : sheetL);
          const w = i.section?.width ?? 1;
          return [Math.max(len, w), Math.min(len, w)] as [number, number];
        });
      packsNeeded = Math.max(1, Math.ceil(nestSheets(rects, sheetL, sheetW) / Math.max(1, unitsPerPack)));
      const sheets = nestSheets(rects, sheetL, sheetW);
      notes = `${data.count} cut parts nested on ${sheets} sheet${sheets === 1 ? "" : "s"} ${sheetW}×${sheetL}.`;
    } else if (item.formFactor === "sheet" && ripped && data.count > 0) {
      const sheetL = Math.max(1, item.dims.length ?? 96);
      const sheetW = Math.max(1, item.dims.width ?? 48);
      const kerf = 0.125;
      const across = Math.max(1, Math.floor((sheetW + kerf) / (ripped.width + kerf)));
      let inches = 0;
      for (const inst of instances) {
        if (inst.catalogId !== catalogId) continue;
        const len =
          inst.cutLength ??
          (inst.from && inst.to
            ? Math.hypot(inst.to.x - inst.from.x, inst.to.y - inst.from.y, inst.to.z - inst.from.z)
            : sheetL);
        inches += Math.max(0, len);
      }
      const strips = Math.max(1, Math.ceil(inches / sheetL));
      packsNeeded = Math.max(1, Math.ceil(strips / across));
      notes = `${data.count} strips, ${ripped.width}" × ${ripped.height}", ripped from ${packsNeeded} sheet${packsNeeded === 1 ? "" : "s"}.`;
    } else {
      notes = whole
        ? `${data.count} full pieces. Glue. Do not cut.`
        : (item.canCut ?? true) && uniqueCuts.length
          ? `Cut to: ${uniqueCuts.map((c) => `${c}"`).join(", ")}${sticksUsed ? ` · from ${sticksUsed} whole ${stockNoun(item.name)}${sticksUsed === 1 ? "" : "s"}` : ""}${spare}`
          : item.notes;
    }

    const estCost =
      unitCost != null ? packsNeeded * unitsPerPack * unitCost : undefined;

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
      notes,
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

/** Shelf nest: parts (long × short, inches) on sheets L × W with a 1/8" kerf. Returns sheets used. */
export function nestSheets(parts: [number, number][], L: number, W: number): number {
  const kerf = 0.125;
  const sorted = parts
    .map(([a, b]) => (a <= L && b <= W ? [a, b] : b <= L && a <= W ? [b, a] : [Math.min(a, L), Math.min(b, W)]) as [number, number])
    .sort((p, q) => q[1] - p[1] || q[0] - p[0]);
  type Shelf = { h: number; used: number };
  const sheets: { shelves: Shelf[]; height: number }[] = [];
  for (const [len, h] of sorted) {
    let placed = false;
    for (const sh of sheets) {
      const fit = sh.shelves.find((s) => s.h + 1e-6 >= h && s.used + len <= L + 1e-6);
      if (fit) { fit.used += len + kerf; placed = true; break; }
      if (sh.height + h <= W + 1e-6) { sh.shelves.push({ h, used: len + kerf }); sh.height += h + kerf; placed = true; break; }
    }
    if (!placed) sheets.push({ shelves: [{ h, used: len + kerf }], height: h + kerf });
  }
  return Math.max(1, sheets.length);
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
