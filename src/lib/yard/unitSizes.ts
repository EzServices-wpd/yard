/**
 * Standard single-item sizes, hand-curated. One row is ONE piece (one clip, one stick, one dowel), never the
 * box, bag or pack it ships in. Each row cites where the size comes from; none comes from a UPC record or a store
 * listing's package dimensions. These sizes override any store or AI size for the same item.
 * Buy still sells the pack (unitsPerPack) and says how many pieces the build uses.
 */
import type { CatalogItem, FormFactor } from "./types";
import { mmToInches } from "./inchText";

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
    // F47: before the standard stick, so "jumbo craft stick" never reads as the 4 1/2" one.
    key: "jumbo-craft-stick",
    catalogId: "popsicle-jumbo",
    name: "Jumbo craft stick",
    match: /\bjumbo\s+(?:craft|popsicle)\s+sticks?\b|\b(?:large|big)\s+craft\s+sticks?\b|\btongue\s+depressors?\b/,
    form: "stick",
    dims: { length: 6, width: 0.75, thickness: 0.08 },
    pack: { units: 50, costUsd: 0.06 },
    source: "6\" × 3/4\" × 2 mm jumbo craft stick (CraftySticks size guide: jumbo 6\" × 3/4\")",
  },
  {
    key: "craft-stick",
    catalogId: "popsicle-standard",
    name: "Standard craft stick",
    match: /popsicle\s+sticks?|popsicles?|craft\s+sticks?/,
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


/**
 * Spec 007 C2 · size-table fallback for countable bought items: one row per standard piece, same rules as above
 * (one piece, never the pack; a cited trade size). Builds that name one of these on its own are purchased items (I20).
 */
const bought = (key: string, name: string, match: RegExp, dims: CatalogItem["dims"], units: number, costUsd: number, source: string, form: FormFactor = "custom"): UnitSize =>
  ({ key, catalogId: `piece-${key}`, name, match, form, dims, pack: { units, costUsd }, source });

export const BOUGHT_SIZES: UnitSize[] = [
  bought("zip-tie", "8\" cable tie", /\b(?:zip|cable)\s*-?\s*ties?\b/, { length: 8, width: 0.19, thickness: 0.05 }, 100, 0.04, "Standard 8\" 50 lb nylon cable tie, 4.8 mm × 1.3 mm strap (UL 62275 standard size)", "stick"),
  bought("marble", "Glass marble 5/8\"", /\bmarbles?\b/, { length: 0.625, width: 0.625, thickness: 0.625, diameter: 0.625 }, 50, 0.1, "Standard 16 mm (5/8\") toy glass marble (marble maker size chart: 'regular' 5/8\")"),
  bought("clothespin", "Wooden spring clothespin", /\bcloth(?:es)?\s*-?\s*pins?\b|\bclothes\s*pegs?\b/, { length: 2.875, width: 0.375, thickness: 0.5 }, 50, 0.06, "Standard wooden spring clothespin 2 7/8\" × 3/8\" × 1/2\" (US household clothespin size)", "stick"),
  bought("nail-16d", "16d common nail", /\b(?:16\s*d|sixteen[\s-]*penny)?\s*(?:common\s+)?nails?\b/, { length: 3.5, diameter: 0.162 }, 50, 0.06, "ASTM F1667 16d common nail: 3 1/2\" long, 0.162\" shank", "stick"),
  bought("rubber-band", "#33 rubber band", /\brubber\s*-?\s*bands?\b/, { length: 3.5, width: 0.125, thickness: 0.03 }, 160, 0.02, "#33 rubber band: 3 1/2\" × 1/8\" flat (Alliance rubber band size chart)", "stick"),
  bought("button", "4-hole button 5/8\"", /\bbuttons?\b/, { length: 0.625, width: 0.625, thickness: 0.08, diameter: 0.625 }, 50, 0.05, "Line 24 button = 15 mm (5/8\") across (button 'ligne' size standard)"),
  bought("binder-clip", "Medium binder clip 1 1/4\"", /\bbinder\s*-?\s*clips?\b/, { length: 1.25, width: 1, thickness: 0.625 }, 24, 0.15, "Medium binder clip: 1 1/4\" wide, 5/8\" capacity (ACCO medium size)"),
  bought("golf-tee", "Wooden golf tee 2 1/8\"", /\bgolf\s*-?\s*tees?\b/, { length: 2.125, diameter: 0.17 }, 100, 0.03, "Regulation 2 1/8\" wooden golf tee (USGA Rule: tee at most 4\")", "stick"),
  bought("straw", "Drinking straw 7 3/4\"", /\b(?:drinking\s+)?straws?\b/, { length: 7.75, diameter: 0.24 }, 100, 0.02, "Standard 7 3/4\" × 6 mm drinking straw (foodservice 'jumbo' straw size)", "tube"),
  bought("pipe-cleaner", "Chenille stem 12\"", /\bpipe\s*-?\s*cleaners?\b|\bchenille\s+stems?\b/, { length: 12, diameter: 0.24 }, 100, 0.03, "Standard 12\" × 6 mm chenille stem (craft supplier size)", "stick"),
  bought("cork", "#9 wine cork", /\b(?:wine\s+|bottle\s+)?corks?\b(?!\s*board)/, { length: 1.75, diameter: 0.9375 }, 25, 0.2, "#9 straight wine cork: 1 3/4\" × 15/16\" (24 mm) (winemaking cork size chart)"),
  bought("shoelace", "Flat shoelace 45\"", /\bshoe\s*-?\s*laces?\b/, { length: 45, width: 0.3125, thickness: 0.06 }, 2, 1.5, "45\" flat lace for 5–6 eyelet shoes, 5/16\" wide (shoelace length chart)", "stick"),
  bought("bottle-cap", "Crown bottle cap", /\bbottle\s*-?\s*caps?\b/, { length: 1.02, width: 1.02, thickness: 0.24, diameter: 1.02 }, 100, 0.03, "Crown cork 26 mm across, 6 mm tall (crown cap standard 26 mm)"),
  bought("cotton-ball", "Cotton ball", /\bcotton\s*-?\s*balls?\b/, { length: 1, width: 1, thickness: 1, diameter: 1 }, 200, 0.01, "Regular cotton ball about 1\" across (personal-care 'regular' size)"),
];

// Spec 008: names and cited sources read in inches only (the citation's metric figures are converted).
for (const u of [...UNIT_SIZES, ...BOUGHT_SIZES]) {
  u.name = mmToInches(u.name);
  u.source = mmToInches(u.source);
}

/** The curated single-item size for this text, most specific row first (a 3/8 dowel before a bare dowel). */
export function unitSizeFor(text: string): UnitSize | null {
  const t = text.toLowerCase();
  return UNIT_SIZES.find((u) => u.match.test(t)) ?? BOUGHT_SIZES.find((u) => u.match.test(t)) ?? null;
}

export function unitSizeById(catalogId: string): UnitSize | null {
  return UNIT_SIZES.find((u) => u.catalogId === catalogId) ?? BOUGHT_SIZES.find((u) => u.catalogId === catalogId) ?? null;
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
  return [...UNIT_SIZES, ...BOUGHT_SIZES].filter((u) => !have.has(u.catalogId)).map((u) => ({
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
