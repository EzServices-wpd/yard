/**
 * The stock picker may only put a priced board on Buy.
 *
 * A nominal section (a 1×6, a 2×10) can be sold in more than one length. When the
 * length the words landed on has no price, the nearest priced length of that same
 * section is the one that is built and bought. Cuts keep that section, and the
 * packer counts boards of the length that was chosen. A section with no priced
 * length stays the unpriced row: no price is guessed from a wider or thicker board.
 */
import { FORGE_CATALOG, getCatalogItem } from "./catalog";
import { CEDAR } from "./checkedStock";
import { LISTINGS } from "./listings";
import type { CatalogItem } from "./types";

const SECTION = 0.05;

export type BoardPick = {
  id: string;
  length: number;
  width: number;
  thick: number;
  /** Dollars for one board, or null when this row has no real price. */
  price: number | null;
};

/** A positive catalog price, or the cheapest checked listing for this id. Never an estimate. */
export function boardPriceUsd(item: CatalogItem | undefined | null): number | null {
  if (!item) return null;
  if (item.unitCostUsd != null && item.unitCostUsd > 0) return item.unitCostUsd;
  const listed = LISTINGS.filter((o) => o.catalogId === item.id && o.packPrice > 0).map((o) => o.packPrice);
  return listed.length ? Math.min(...listed) : null;
}

export function boardPickOf(item: CatalogItem | undefined | null): BoardPick | null {
  if (!item || item.category !== "lumber" || item.formFactor !== "board") return null;
  const width = item.dims.width ?? 0;
  const thick = item.dims.height ?? item.dims.thickness ?? 0;
  const length = item.dims.length ?? 0;
  if (!(width > 0) || !(thick > 0) || !(length > 0)) return null;
  return { id: item.id, length, width, thick, price: boardPriceUsd(item) };
}

function sameSection(a: Pick<BoardPick, "width" | "thick">, b: Pick<BoardPick, "width" | "thick">): boolean {
  return Math.abs(a.width - b.width) < SECTION && Math.abs(a.thick - b.thick) < SECTION;
}

/**
 * The priced board of the same section whose length is closest to `want`.
 * Null when `want` is already priced, or when no priced length of that section exists.
 * A tie takes the shorter board, then the id, so the choice does not depend on catalog order.
 */
export function pickNearestPricedLength(want: BoardPick, boards: readonly BoardPick[]): BoardPick | null {
  if (want.price != null && want.price > 0) return null;
  const alts = boards.filter((b) => b.id !== want.id && b.price != null && b.price > 0 && sameSection(b, want));
  alts.sort(
    (a, b) =>
      Math.abs(a.length - want.length) - Math.abs(b.length - want.length) ||
      a.length - b.length ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return alts[0] ?? null;
}

/** Catalog id the picker puts on the build: this id when it is priced or has no priced sibling length. */
export function pricedBoardId(id: string): string {
  const item = getCatalogItem(id);
  const want = boardPickOf(item);
  if (!want) return id;
  const boards = FORGE_CATALOG.map(boardPickOf).filter((b): b is BoardPick => !!b);
  return pickNearestPricedLength(want, boards)?.id ?? id;
}

/**
 * Checked store price for one board of this species and catalog id.
 * Only a listing read off the store (checkedStock) counts. Species estimates do not.
 */
export function checkedSpeciesBoardUsd(catalogId: string, speciesId: string | null | undefined): number | null {
  if (speciesId !== "cedar") return null;
  const row = CEDAR[catalogId];
  return row && row.packPrice > 0 ? row.packPrice : null;
}
