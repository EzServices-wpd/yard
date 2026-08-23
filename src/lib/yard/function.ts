/**
 * Single-stock craft + deck helpers for Yard.
 * Keep craft pure; only sheet/board/lumber scale gets a foreign deck.
 */

import { getCatalogItem } from "./catalog";
import type { CatalogItem } from "./types";

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
