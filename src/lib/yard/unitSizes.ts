/**
 * Standard single-item sizes, hand-curated. One row is ONE piece (one clip, one stick, one dowel), never the
 * box, bag or pack it ships in. Each row cites where the size comes from; none comes from a UPC record or a store
 * listing's package dimensions. These sizes override any store or AI size for the same item.
 * Buy still sells the pack (unitsPerPack) and says how many pieces the build uses.
 */
import type { CatalogItem, FormFactor } from "./types";

export type UnitSize = {
  key: string;
  /** Catalog row this size belongs to (created here if the seed catalog lacks it). */
  catalogId: string;
  name: string;
  match: RegExp;
  form: FormFactor;
  dims: CatalogItem["dims"];
  /** How the item is normally sold, for the Buy line. */
  pack: { units: number; costUsd: number };
  source: string;
};

const IN = (mm: number) => Math.round((mm / 25.4) * 1000) / 1000;

const DOWEL_SRC = "Lee Valley 36\" birch dowel rods, sold by nominal diameter 1/8\"–1 1/4\" at 36\" (±1/64\")";
const dowel = (label: string, d: number, id: string, cost: number, match: RegExp): UnitSize => ({
  key: `dowel-${label}`,
  catalogId: id,
  name: `${label}" Hardwood Dowel 36"`,
  match,
  form: "dowel",
  dims: { length: 36, diameter: d },
  pack: { units: 1, costUsd: cost },
  source: DOWEL_SRC,
});
const sz = (num: string) => num.replace("/", "\\s*\\/\\s*");
// The fraction must stand alone: "1 1/4\" dowel" and "1-1/4 dowel" are 1 1/4", never the 1/4" row.
const dowelRe = (frac: string, words = "") => new RegExp(`(?:(?<![\\d.][\\s-]*)${sz(frac)}${words ? `|${words}` : ""})\\s*(?:"|in(?:ch(?:es)?)?\\.?)?\\s*(?:hardwood\\s+|wood(?:en)?\\s+|birch\\s+)?dowels?`);

export const UNIT_SIZES: UnitSize[] = [
  {
    key: "paper-clip",
    catalogId: "paper-clip-no1",
    name: "No. 1 paper clip",
    match: /\bpaper\s*-?\s*clips?\b|\bpaperclips?\b/,
    form: "stick",
    // A No. 1 (standard) gem clip: 1 3/8" long, about 3/8" across, from .033" wire.
    dims: { length: 1.375, width: 0.375, thickness: 0.033, diameter: 0.033 },
    pack: { units: 100, costUsd: 0.02 },
    source: "Trade size No. 1 gem clip = 1 3/8\" (Universal/Officemate No. 1 spec); .033\" wire gauge (Business Source Size 1 spec)",
  },
  {
    key: "craft-stick",
    catalogId: "popsicle-standard",
    name: "Standard craft stick",
    match: /popsicle|craft sticks?/,
    form: "stick",
    dims: { length: 4.5, width: 0.375, thickness: 0.08 },
    pack: { units: 100, costUsd: 0.03 },
    source: "4 1/2\" × 3/8\" × 2 mm standard craft stick (CraftySticks size guide; Midwest Dowel 4 1/2\" × 3/8\")",
  },
  {
    key: "toothpick",
    catalogId: "toothpick",
    name: "Round wooden toothpick",
    match: /toothpicks?/,
    form: "stick",
    dims: { length: 2.5, width: 0.08, thickness: 0.08 },
    pack: { units: 250, costUsd: 0.005 },
    source: "US round toothpick 2 1/2\"–2 3/4\" long, 2.0–2.2 mm across (US standard round pick range)",
  },
  {
    key: "cotton-swab",
    catalogId: "cotton-swab",
    name: "Cotton swab",
    match: /cotton\s*swabs?|q-?\s*tips?/,
    form: "stick",
    // 3" overall, 2.5 mm shaft; the cotton heads are about 5 mm across.
    dims: { length: 3, diameter: IN(2.5) },
    pack: { units: 375, costUsd: 0.015 },
    source: "Q-tips 3\" swab (Unilever spec: 3 inch length); 3\" × Φ2.5 mm shaft, 5 mm tip (swab maker spec sheet)",
  },
  dowel("1/8", 0.125, "dowel-1-8-36", 0.3, dowelRe("1/8", "eighth(?:\\s|-)?inch")),
  dowel("3/16", 0.1875, "dowel-3-16-36", 0.4, dowelRe("3/16")),
  dowel("1/4", 0.25, "dowel-1-4-36", 1.2, dowelRe("1/4", "quarter(?:\\s|-)?inch")),
  dowel("5/16", 0.3125, "dowel-5-16-36", 0.8, dowelRe("5/16")),
  dowel("3/8", 0.375, "dowel-3-8-36", 0.9, dowelRe("3/8")),
  dowel("1/2", 0.5, "dowel-1-2-36", 1.6, dowelRe("1/2", "half(?:\\s|-)?inch")),
  dowel("5/8", 0.625, "dowel-5-8-36", 2.5, dowelRe("5/8")),
  dowel("3/4", 0.75, "dowel-3-4-36", 4.0, dowelRe("3/4")),
  {
    key: "washer-8",
    catalogId: "washer-no8",
    name: "#8 flat washer",
    // F17: a bare "washer(s)" is the hardware washer, never the laundry machine.
    match: /(?:#\s*8|no\.?\s*8)\s+(?:flat\s+)?washers?|\bflat\s+washers?\b|(?<!(?:dryer|laundry|pressure|dish)\s*(?:and\s+|&\s*)?)\bwashers?\b(?!\s*(?:and|&|\/)?\s*(?:dryer|machine|pedestal|stand|cabinet|box))/,
    form: "custom",
    dims: { length: 0.438, width: 0.438, thickness: 0.049, diameter: 0.438 },
    pack: { units: 100, costUsd: 0.04 },
    source: "ASME B18.22.1 Type A plain washer No. 8: 0.188\" ID, 0.438\" OD, 0.049\" thick",
  },
  {
    key: "pony-bead",
    catalogId: "pony-bead",
    name: "Pony bead 9 × 6 mm",
    match: /\bpony\s*beads?\b/,
    form: "custom",
    dims: { length: IN(6), width: IN(9), thickness: IN(9), diameter: IN(9) },
    pack: { units: 900, costUsd: 0.009 },
    source: "The Beadery bead catalog: pony bead 9 × 6 mm, 4 mm hole",
  },
];

/** The curated single-item size for this text, most specific row first (a 3/8 dowel before a bare dowel). */
export function unitSizeFor(text: string): UnitSize | null {
  const t = text.toLowerCase();
  return UNIT_SIZES.find((u) => u.match.test(t)) ?? null;
}

export function unitSizeById(catalogId: string): UnitSize | null {
  return UNIT_SIZES.find((u) => u.catalogId === catalogId) ?? null;
}

/** Words that mark a size as the box, bag or pack, not the piece. */
const PACK_WORDS = /\b(box|boxes|pack|packs|package|bag|bags|tub|carton|case|count|ct|pcs|pieces|bulk|set of|assorted|per box|per pack)\b|\d+\s*(?:ct|pk|pcs)\b/i;

/** A title or note that gives packaging, so any inches in it describe the box, not one item. */
export function isPackagingText(text: string): boolean {
  return PACK_WORDS.test(text);
}

/**
 * Sizes that cannot be one small item: when the curated row knows the piece, any candidate more than
 * twice its largest side (a 4 × 3 × 1" clip box against a 1 3/8" clip) is packaging and is rejected.
 */
export function isPackagingDims(unit: UnitSize, dims: CatalogItem["dims"]): boolean {
  const big = Math.max(unit.dims.length ?? 0, unit.dims.width ?? 0, unit.dims.diameter ?? 0);
  const got = Math.max(dims.length ?? 0, dims.width ?? 0, dims.height ?? 0, dims.thickness ?? 0, dims.diameter ?? 0);
  return big > 0 && got > big * 2;
}

/** A catalog row with the curated piece size laid over whatever size it had. */
export function withUnitSize(item: CatalogItem): CatalogItem {
  const u = unitSizeById(item.id);
  if (!u) return item;
  return { ...item, dims: { ...u.dims }, notes: [item.notes, `Piece size: ${u.source}.`].filter(Boolean).join(" ") };
}

/** Seed rows for curated items the catalog does not carry yet. */
export function unitSizeRows(have: Set<string>): CatalogItem[] {
  return UNIT_SIZES.filter((u) => !have.has(u.catalogId)).map((u) => ({
    id: u.catalogId,
    name: u.name,
    category: u.key === "paper-clip" || u.key.startsWith("washer") ? "metal" : u.key.endsWith("bead") ? "plastic" : u.form === "dowel" ? "dowel_rod" : u.form === "stick" ? "craft_wood" : "other",
    formFactor: u.form,
    dims: { ...u.dims },
    unitsPerPack: u.pack.units,
    unitCostUsd: u.pack.costUsd,
    aliases: [u.name.toLowerCase(), u.key.replace(/-/g, " ")],
    tags: ["unit-size", "small"],
    preferredJoins: u.key === "paper-clip" ? ["friction", "glue"] : ["glue"],
    canCut: u.form === "dowel",
    color: u.key === "paper-clip" || u.key.startsWith("washer") ? "#b8bec4" : u.form === "dowel" ? "#d4b896" : "#eeeeee",
    roughness: u.key === "paper-clip" ? 0.3 : 0.6,
    searchQuery: u.form === "dowel" ? `${u.name.replace(/"/g, " inch")}` : `${u.name} pack`,
    notes: `Piece size: ${u.source}. Sold in packs of ${u.pack.units}.`,
  })) as CatalogItem[];
}
