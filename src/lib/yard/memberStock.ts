/**
 * Any catalog unit can be a member of a form.
 * A sheet is not a 48" thick stick — it is ripped into battens.
 * A brick, a toothpick, and a 2×4 are already members.
 * Buy still names the unit you purchase (the sheet, the brick pack).
 */
import type { CatalogItem } from "./types";

export type MemberSection = { width: number; height: number };

export type MemberView = {
  /** The unit the shopper buys. */
  stock: CatalogItem;
  /** Cross-section + a short pitch length for density, weld, and bay. */
  density: CatalogItem;
  /** Real purchasable length for cutting members. */
  cut: CatalogItem;
  /** Drawn cross-section when it is not the raw catalog face. Null = draw the catalog unit. */
  section: MemberSection | null;
  note: string | null;
};

function isSheetStock(item: CatalogItem): boolean {
  return item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard";
}

function inchTalk(n: number): string {
  const q = Math.round(n * 8) / 8;
  const whole = Math.floor(q + 1e-6);
  const eighths = Math.round((q - whole) * 8);
  const names = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"];
  const f = names[eighths] ?? "";
  if (!f) return `${whole}"`;
  if (!whole) return `${f}"`;
  return `${whole} ${f}"`;
}

/** Linear-member view of a catalog unit. Identity for sticks, pipe, and boards. */
export function memberView(item: CatalogItem): MemberView {
  if (!isSheetStock(item)) {
    return { stock: item, density: item, cut: item, section: null, note: null };
  }
  const thick = Math.max(0.12, item.dims.thickness ?? item.dims.height ?? 0.25);
  // A batten ripped off the sheet. Never the 48" face — that weld-collapses the form.
  const stripW = thick >= 0.6 ? 1 : 0.75;
  const sheetL = item.dims.length ?? 96;
  const section: MemberSection = {
    width: stripW,
    height: Math.round(thick * 1000) / 1000,
  };
  const cut: CatalogItem = {
    ...item,
    formFactor: "board",
    dims: { length: sheetL, width: section.width, thickness: section.height },
    canCut: true,
  };
  const density: CatalogItem = {
    ...cut,
    dims: { ...cut.dims, length: Math.min(sheetL, 18) },
  };
  return {
    stock: item,
    density,
    cut,
    section,
    note: `Ripped into ${inchTalk(section.width)} × ${inchTalk(section.height)} strips from ${item.name}. Buy whole sheets — the drawing is the strips, not the full sheet face.`,
  };
}
