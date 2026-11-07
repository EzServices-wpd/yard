/**
 * Shadow stock compile. Realizes cuttable pieces from graph parts, then buys
 * sheet and lumber packs from that allocation.
 *
 * The sheet count is planSheetNest. The board count is packLengths. Both are the
 * same allocators the live plan uses, called on these pieces. This file does not
 * read a prompt, a cut list, or a Buy quantity. report.ts is not a caller and is
 * not called: its closet Bom mixes family rules and the live Buy, and copying
 * that quantity would not be an allocation.
 *
 * Whole craft stock (popsicle sticks, toothpicks) is not cut. Those parts produce
 * no sheet or lumber pack, and the disclosure says so.
 */
import { isBoughtHardwareName } from "./boughtHardware";
import { getCatalogItem } from "./catalog";
import { isWholeStock } from "./geometry";
import { packLengths } from "./linearPack";
import { fitsOnSheet, nestSheetsByStock, planSheetNest, SHEET_4X8, spliceCutListToSheet } from "./nesting";
import { sheetCutDims } from "./shopPlural";
import type { CutLine } from "./types";
import type { GraphPart, YardBuildGraph } from "./buildContract";

export type CutKind = "sheet" | "lumber";

export type CuttablePiece = {
  id: string;
  partId: string;
  name: string;
  materialId: string;
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  kind: CutKind;
};

export type StockPack = {
  kind: CutKind;
  catalogId: string;
  name: string;
  quantity: number;
  unit: string;
  partIds: string[];
  notes: string;
  estimatedCost?: number;
};

export type SkippedPart = {
  partId: string;
  name: string;
  materialId: string;
  reason: "hardware" | "unknown" | "whole" | "not-sheet-or-lumber" | "no-size";
};

export type StockDerivation = {
  packs: StockPack[];
  /** Sheet pieces the nest did not place. */
  unpackedPartIds: string[];
  /** Nested sheets the catalog does not sell. */
  unsold: { family: string; size: "4x8" | "4x10"; sheets: number }[];
};

const round8 = (n: number) => Math.round(n * 8) / 8;

function partName(part: GraphPart): string {
  return part.source === "panel" ? part.name : part.role;
}

function classify(materialId: string, name: string): SkippedPart["reason"] | CutKind {
  if (materialId === "hardware" || isBoughtHardwareName(name)) return "hardware";
  const item = getCatalogItem(materialId);
  if (!item) return "unknown";
  if (isWholeStock(item)) return "whole";
  if (item.canCut === false) return "not-sheet-or-lumber";
  if (item.category === "sheet_goods" || item.formFactor === "sheet") return "sheet";
  if (item.category === "lumber" || item.formFactor === "board") return "lumber";
  return "not-sheet-or-lumber";
}

function pieceDims(part: GraphPart): { lengthIn: number; widthIn: number; thicknessIn: number } | null {
  if (part.source === "panel") {
    if (part.blank) {
      const { lengthIn, widthIn, thicknessIn } = part.blank;
      if (!(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) return null;
      return { lengthIn: round8(lengthIn), widthIn: round8(widthIn), thicknessIn: round8(thicknessIn) };
    }
    const dims = sheetCutDims(part.size.width, part.size.height, part.size.depth);
    if (!(dims.lengthIn > 0) || !(dims.widthIn > 0) || !(dims.thicknessIn > 0)) return null;
    return dims;
  }
  const item = getCatalogItem(part.materialId);
  const span = part.cutLength ?? (part.from && part.to
    ? Math.hypot(part.to.x - part.from.x, part.to.y - part.from.y, part.to.z - part.from.z)
    : undefined);
  const length = span ?? item?.dims.length;
  if (!(length && length > 0)) return null;
  const width = part.section?.width ?? item?.dims.width ?? item?.dims.diameter ?? 0;
  const thick = part.section?.height ?? item?.dims.thickness ?? item?.dims.height ?? item?.dims.diameter ?? 0;
  if (!(width > 0) || !(thick > 0)) return null;
  return sheetCutDims(length, width, thick);
}

function boardCross(materialId: string): { face: number; thick: number } | null {
  const item = getCatalogItem(materialId);
  if (!item) return null;
  const a = item.dims.width ?? 0;
  const b = item.dims.height ?? item.dims.thickness ?? 0;
  const face = Math.max(a, b);
  const thick = Math.min(a, b) || b || a;
  if (!(face > 0) || !(thick > 0)) return null;
  return { face, thick };
}

/**
 * How many pieces of `stock` cover `finished`.
 * Ceil past 0.01", the same count a rip uses. Round stops short when the
 * thickness sits between n and n+0.5 stock thicknesses (1-3/4" on 3/4" is 2.33,
 * and round yields 1-1/2").
 */
function stockPieces(finished: number, stock: number): number {
  if (!(stock > 0) || !(finished > stock + 0.05)) return 1;
  return Math.max(2, Math.ceil((finished - 0.01) / stock));
}

/** One finished part may be several rips or layers of the sold stock. */
function expandPart(part: GraphPart, kind: CutKind, dims: { lengthIn: number; widthIn: number; thicknessIn: number }): CuttablePiece[] {
  const name = partName(part);
  const item = getCatalogItem(part.materialId);
  if (kind === "sheet") {
    const thick = item?.dims.thickness ?? dims.thicknessIn;
    const layers = stockPieces(dims.thicknessIn, thick);
    return Array.from({ length: layers }, (_, layer) => ({
      id: layers === 1 ? part.id : `${part.id}#layer${layer + 1}`,
      partId: part.id,
      name,
      materialId: part.materialId,
      lengthIn: dims.lengthIn,
      widthIn: dims.widthIn,
      thicknessIn: thick > 0 ? thick : dims.thicknessIn,
      kind,
    }));
  }
  const cross = boardCross(part.materialId);
  const thick = cross?.thick ?? dims.thicknessIn;
  const face = cross?.face ?? dims.widthIn;
  const layers = stockPieces(dims.thicknessIn, thick);
  const strips = stockPieces(dims.widthIn, face);
  const pieces: CuttablePiece[] = [];
  for (let layer = 0; layer < layers; layer++) {
    let left = dims.widthIn;
    for (let strip = 0; strip < strips; strip++) {
      const widthIn = strips === 1 ? dims.widthIn : Math.min(face, Math.max(round8(left), 0));
      left -= widthIn;
      const many = layers * strips > 1;
      pieces.push({
        id: many ? `${part.id}#${layer + 1}.${strip + 1}` : part.id,
        partId: part.id,
        name,
        materialId: part.materialId,
        lengthIn: dims.lengthIn,
        widthIn: widthIn > 0 ? widthIn : dims.widthIn,
        thicknessIn: thick,
        kind,
      });
    }
  }
  return pieces;
}

function pieceCut(piece: CuttablePiece, id = piece.id): CutLine {
  return {
    id,
    name: piece.name,
    quantity: 1,
    lengthIn: piece.lengthIn,
    widthIn: piece.widthIn,
    thicknessIn: piece.thicknessIn,
    material: getCatalogItem(piece.materialId)?.name ?? piece.materialId,
    label: piece.id,
    partIds: [piece.partId],
  };
}

/** A face that fits neither 4×8 nor 4×10 becomes the segments the sheet splitter already cuts. */
function spliceSheets(pieces: CuttablePiece[]): CuttablePiece[] {
  const sheets = pieces.filter((piece) => piece.kind === "sheet");
  const lumber = pieces.filter((piece) => piece.kind === "lumber");
  if (sheets.length === 0) return pieces;
  const byId = new Map(sheets.map((piece) => [piece.id, piece]));
  const spliced = spliceCutListToSheet(sheets.map((piece) => pieceCut(piece)));
  const out: CuttablePiece[] = [];
  for (const line of spliced) {
    const parentId = [...byId.keys()].find((id) => line.id === id || line.id.startsWith(`${id}|`));
    const parent = parentId ? byId.get(parentId) : undefined;
    if (!parent) continue;
    out.push({
      ...parent,
      id: line.id,
      name: line.name,
      lengthIn: line.lengthIn,
      widthIn: line.widthIn,
    });
  }
  return [...out, ...lumber];
}

/** Cuts from the parts. Hardware, unknown stock, and whole craft sticks are skipped, not invented. */
export function realizeCuttablePieces(graph: YardBuildGraph): { cuts: CuttablePiece[]; skipped: SkippedPart[] } {
  const cuts: CuttablePiece[] = [];
  const skipped: SkippedPart[] = [];
  for (const part of graph.parts) {
    const name = partName(part);
    const kind = classify(part.materialId, name);
    if (kind !== "sheet" && kind !== "lumber") {
      skipped.push({ partId: part.id, name, materialId: part.materialId, reason: kind });
      continue;
    }
    const dims = pieceDims(part);
    if (!dims) {
      skipped.push({ partId: part.id, name, materialId: part.materialId, reason: "no-size" });
      continue;
    }
    cuts.push(...expandPart(part, kind, dims));
  }
  return { cuts: spliceSheets(cuts), skipped };
}

function sheetFamily(materialId: string): string {
  return /^(?:plywood|mdf|chipboard|hardboard|osb)-.+-\d+x\d+$/.test(materialId)
    ? materialId.replace(/-\d+x\d+$/, "")
    : materialId;
}

function sheetSize(piece: CuttablePiece): "4x8" | "4x10" {
  return fitsOnSheet(piece.lengthIn, piece.widthIn, SHEET_4X8) ? "4x8" : "4x10";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function sheetPacks(cuts: CuttablePiece[]): StockDerivation {
  const sheets = cuts.filter((piece) => piece.kind === "sheet");
  const unpacked = new Set<string>();
  const unsold: StockDerivation["unsold"] = [];
  const packs: StockPack[] = [];
  if (sheets.length === 0) return { packs, unpackedPartIds: [], unsold };
  const lines = sheets.map((piece) => pieceCut(piece, `${piece.materialId}|${piece.id}`));
  const nest = planSheetNest(lines);
  const placed = new Set<string>();
  const missed = new Set<string>();
  for (const result of [nest.sheets, nest.backer]) {
    for (const sheet of result?.sheets ?? []) {
      for (const part of sheet.parts) if (part.label) placed.add(part.label);
    }
    for (const part of result?.unplaced ?? []) if (part.label) missed.add(part.label);
    for (const group of nestSheetsByStock(result)) {
      for (const size of ["4x8", "4x10"] as const) {
        const count = size === "4x8" ? group.on8 : group.on10;
        if (count <= 0) continue;
        const catalogId = `${group.stock}-${size}`;
        const item = getCatalogItem(catalogId);
        const ofSize = sheets.filter((piece) => sheetFamily(piece.materialId) === group.stock && sheetSize(piece) === size);
        const mine = ofSize.filter((piece) => placed.has(piece.id));
        if (!item) {
          unsold.push({ family: group.stock, size, sheets: count });
          for (const piece of ofSize) unpacked.add(piece.partId);
          continue;
        }
        const partIds = [...new Set(mine.map((piece) => piece.partId))].sort();
        const unit = count === 1 ? "sheet" : "sheets";
        packs.push({
          kind: "sheet",
          catalogId,
          name: item.name,
          quantity: count,
          unit,
          partIds,
          notes: `${plural(count, `${size} sheet`)} for ${plural(partIds.length, "part")} (${plural(mine.length, "cut")}). 1/8" kerf.`,
          ...(item.unitCostUsd != null ? { estimatedCost: item.unitCostUsd * count } : {}),
        });
      }
    }
  }
  for (const piece of sheets) {
    if (placed.has(piece.id) || missed.has(piece.id)) {
      if (!placed.has(piece.id)) unpacked.add(piece.partId);
      continue;
    }
    unpacked.add(piece.partId);
  }
  return { packs, unpackedPartIds: [...unpacked].sort(), unsold };
}

function lumberPacks(cuts: CuttablePiece[]): StockPack[] {
  const byId = new Map<string, CuttablePiece[]>();
  for (const piece of cuts) {
    if (piece.kind !== "lumber") continue;
    const list = byId.get(piece.materialId) ?? [];
    list.push(piece);
    byId.set(piece.materialId, list);
  }
  const packs: StockPack[] = [];
  for (const [catalogId, pieces] of byId) {
    const item = getCatalogItem(catalogId);
    if (!item) continue;
    const stockLen = item.dims.length ?? 96;
    const lengths = pieces.map((piece) => Math.max(piece.lengthIn, piece.widthIn));
    const packed = packLengths(lengths, stockLen, 0.125);
    if (packed.sticks <= 0) continue;
    const partIds = [...new Set(pieces.map((piece) => piece.partId))].sort();
    const feet = Math.round(stockLen / 12);
    const overlong = lengths.filter((length) => length > stockLen + 0.01).length;
    const spare = packed.spare ? ` ${packed.spare}` : "";
    const splice = overlong ? ` ${plural(overlong, "cut")} longer than the board, spliced by the packer.` : "";
    packs.push({
      kind: "lumber",
      catalogId,
      name: item.name,
      quantity: packed.sticks,
      unit: packed.sticks === 1 ? "pc" : "pcs",
      partIds,
      notes: `${plural(pieces.length, "cut")} from ${packed.sticks} × ${feet} ft. 1/8" kerf.${spare}${splice}`,
      ...(item.unitCostUsd != null ? { estimatedCost: item.unitCostUsd * packed.sticks } : {}),
    });
  }
  return packs;
}

/** Purchase packs for an already realized cut list. Sheet counts follow the nest. Board counts follow the packer. */
export function deriveStockPacks(cuts: readonly CuttablePiece[]): StockDerivation {
  const list = [...cuts];
  const sheets = sheetPacks(list);
  const lumber = lumberPacks(list);
  const packs = [...sheets.packs, ...lumber].sort((a, b) => a.kind === b.kind
    ? a.catalogId.localeCompare(b.catalogId)
    : a.kind === "sheet" ? -1 : 1);
  return { packs, unpackedPartIds: sheets.unpackedPartIds, unsold: sheets.unsold };
}

function tally(rows: SkippedPart[]): string {
  const by = new Map<string, number>();
  for (const row of rows) by.set(row.materialId || "unknown", (by.get(row.materialId || "unknown") ?? 0) + 1);
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, n]) => `${n} ${id}`).join(", ");
}

function explain(cuts: number, skipped: SkippedPart[], derived: StockDerivation, names: Map<string, string>): string | undefined {
  const lines: string[] = [];
  if (cuts === 0) lines.push("No cuttable sheet or lumber parts.");
  const whole = skipped.filter((row) => row.reason === "whole");
  const unknown = skipped.filter((row) => row.reason === "unknown");
  const other = skipped.filter((row) => row.reason === "not-sheet-or-lumber" || row.reason === "no-size");
  const hardware = skipped.filter((row) => row.reason === "hardware");
  if (whole.length) {
    lines.push(`Whole craft stock, not sheet or lumber: ${tally(whole)}. No sheet or lumber pack is derived for ${whole.length === 1 ? "that part" : "those parts"}.`);
  }
  if (unknown.length) {
    lines.push(`No catalog stock: ${tally(unknown)}. No pack is derived for ${unknown.length === 1 ? "that part" : "those parts"}.`);
  }
  if (other.length) {
    lines.push(`Not sheet or lumber: ${tally(other)}. No sheet or lumber pack is derived for ${other.length === 1 ? "that part" : "those parts"}.`);
  }
  if (cuts === 0 && hardware.length && !whole.length && !unknown.length && !other.length) {
    lines.push(`${plural(hardware.length, "bought hardware part")} ${hardware.length === 1 ? "is" : "are"} not cut, so no purchase pack is derived.`);
  }
  if (derived.unpackedPartIds.length) {
    const listed = derived.unpackedPartIds.map((id) => names.get(id) ?? id).join(", ");
    lines.push(`Unplaced on the sheet nest, and not packed: ${listed}.`);
  }
  for (const row of derived.unsold) {
    lines.push(`Nested ${plural(row.sheets, "sheet")} of ${row.family} at ${row.size}, which the catalog does not sell, so that pack is not derived.`);
  }
  if (cuts === 0 && lines.length === 1) lines.push("No purchase pack is derived.");
  return lines.length ? lines.join(" ") : undefined;
}

export function compileStock(graph: YardBuildGraph): { cuts: CuttablePiece[]; packs: StockPack[]; disclosure?: string } {
  const realized = realizeCuttablePieces(graph);
  const derived = deriveStockPacks(realized.cuts);
  const names = new Map(graph.parts.map((part) => [part.id, partName(part)]));
  const disclosure = explain(realized.cuts.length, realized.skipped, derived, names);
  return { cuts: realized.cuts, packs: derived.packs, ...(disclosure ? { disclosure } : {}) };
}
