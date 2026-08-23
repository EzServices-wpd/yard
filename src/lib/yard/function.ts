/**
 * The job of the thing, not just its silhouette.
 * A bridge gets a road you can walk. An arch keeps a portal you can pass.
 * Load is inferred from stock + size; a person does not stand on popsicle.
 *
 * Single-stock rule (hard):
 *   When the primary material is craft-scale (sticks, straws, toothpicks,
 *   thin tubes, paper cores, recycled cylinders), the entire model — including
 *   any deck / road / working surface — is built from that stock only.
 *   The only extra items on the Buy list are the recommended joiners
 *   (glue, tape, solvent, etc.). No foreign cardboard, foam, or plywood is
 *   injected. Sheet decks appear only when the primary is already sheet/board/
 *   lumber scale.
 */
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { pyramidDoorDims } from "./lattice";
import type {
  CatalogItem,
  FeasibilityIssue,
  LoadUse,
  Panel,
  TraversePath,
  Vec3,
  YardInstance,
  YardProject,
} from "./types";

/**
 * Craft / single-stock materials: everything stays on this stock.
 * Joiners (glue/tape/solvent) still come from binderBom.
 */
export function isSingleStockCraft(item: CatalogItem): boolean {
  if (item.formFactor === "sheet" || item.formFactor === "board") return false;
  if (item.category === "lumber" || item.category === "sheet_goods") return false;
  if (item.category === "pvc_plumbing" || item.formFactor === "pipe") {
    return (item.dims.diameter ?? 1) < 0.55;
  }
  return (
    item.category === "craft_wood" ||
    item.category === "plastic" ||
    item.category === "paper_tube" ||
    item.category === "recycled" ||
    item.category === "foam" ||
    item.formFactor === "stick" ||
    item.formFactor === "tube" ||
    item.formFactor === "dowel" ||
    item.formFactor === "block" ||
    (item.dims.diameter ?? 1) < 0.5
  );
}

/**
 * Deck sheet only when the primary stock is already sheet/board/lumber scale.
 * Single-stock craft queries stay pure — road is densified as primary members.
 */
export function deckStockFor(item: CatalogItem): CatalogItem | null {
  if (isSingleStockCraft(item)) return null;
  if (item.formFactor === "sheet") return item;
  if (item.category === "lumber" || item.category === "sheet_goods" || item.formFactor === "board") {
    return getCatalogItem("plywood-3-4-4x8") ?? item;
  }
  if (item.category === "foam") return getCatalogItem("foam-board-20x30") ?? item;
  if (item.formFactor === "pipe" || item.category === "pvc_plumbing") {
    if ((item.dims.diameter ?? 1) >= 0.75) return getCatalogItem("foam-board-20x30") ?? item;
    return null;
  }
  return null;
}

// PLACEHOLDER_REST_OF_FILE_SEE_LOCAL — truncated for tool size; full file is on disk
