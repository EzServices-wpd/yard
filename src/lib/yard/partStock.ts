/**
 * Part stock — the one answer to "what is this part made of?".
 * The cut list names each part's stock with it, and the 3D bench paints each part from it,
 * so walnut legs on an oak table cut as Walnut 1×4 and render walnut.
 */
import { getCatalogItem } from "./catalog";
import {
  CATALOG_LUMBER_BIND,
  NAMED_LUMBER_SPECIES,
  namedLegLumberFromPrompt,
  namedLumberFromPrompt,
} from "./namedLumberSpecies";
import { namedStockDisplayName } from "./weekendStockHonesty";
import type { Panel } from "./types";

/** Finished (oiled) face tone of each named species, as seen on the bench. */
export const SPECIES_TONE: Record<string, string> = {
  cedar: "#b8734a",
  pine: "#e3c58e",
  redwood: "#a5553a",
  spruce: "#e8d3a8",
  fir: "#d8ae7a",
  hemlock: "#d9bb8c",
  cypress: "#d6b37e",
  balsa: "#eedfc0",
  basswood: "#ecdcb8",
  maple: "#e8cfa0",
  oak: "#c9a06a",
  walnut: "#6e4a33",
  cherry: "#a9603e",
  birch: "#e6cfa2",
  poplar: "#d9cc9a",
  ash: "#dcc59a",
  alder: "#c9925f",
  beech: "#d9ad7c",
  hickory: "#c79a66",
  aspen: "#eadcbc",
  sycamore: "#dcc29a",
  elm: "#b98b5c",
  butternut: "#c69a63",
  cottonwood: "#e0cfa8",
  mahogany: "#8a4a32",
  teak: "#a8743f",
  sapele: "#8f4f33",
  padauk: "#b0452a",
  purpleheart: "#6e3552",
  ipe: "#6a4a30",
  ebony: "#2e2620",
  rosewood: "#5a3424",
  wenge: "#4a3528",
  zebrawood: "#c4a578",
  bamboo: "#d9c08a",
  mesquite: "#8c5a3a",
  osage: "#c99a2e",
  locust: "#b59a52",
  sweetgum: "#b88a62",
};

/** Base tone of the shared wood-grain texture (stockLook paints it at this colour). */
export const GRAIN_BASE = "#e2c48a";
/** Neutral tint the bench uses on textured stock with no named species. */
export const NEUTRAL_GRAIN_TINT = "#e9d6b4";

export type PartStock = {
  /** Catalog row the part is bought as (lumber-1x4-8 for named species boards). */
  catalogId: string;
  /** Stock label the cut list prints ("Walnut 1×4", '3/4" Plywood 4×8', "2x2 …"). */
  label: string;
  /** Named species id when the stock is a named species ("walnut"), else null. */
  speciesId: string | null;
};

/** Species named at the start of a stock label ("Walnut 1×4" → walnut), else null. */
export function speciesOfStockLabel(label?: string | null): string | null {
  const head = (label ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!head) return null;
  const row = NAMED_LUMBER_SPECIES.find((s) => s.display.toLowerCase() === head || s.densifyLabel.split(/\s+/)[0].toLowerCase() === head);
  return row ? row.id : null;
}

/**
 * What one panel is cut from. The cut list (closetCuts) and the bench render both call this.
 * - Named wood drives legs too: a 2x2 leg on a named-wood build is laminated from the leg species
 *   (the species typed for the legs, else the body species).
 * - Board rows and the named-species bind print the species label ("Oak 1×4").
 * - Everything else prints its catalog name.
 */
export function panelStock(prompt: string, panel: Pick<Panel, "name" | "materialId">): PartStock {
  const item = getCatalogItem(panel.materialId);
  const named = namedLumberFromPrompt(prompt);
  // Every 2×2 part on a named-wood build (table legs, bench legs, posts) is laminated from the species
  // boards, unless 2×2 itself was typed — then it is that species' 2×2.
  const typed2x2 = /\b2\s*[x×]\s*2\b|\btwo[\s-]+by[\s-]+two\b/i.test(prompt);
  if (named && panel.materialId === "lumber-2x2-8" && (/^leg\b/i.test(panel.name) || !typed2x2)) {
    const leg = (/\bleg\b/i.test(panel.name) ? namedLegLumberFromPrompt(prompt) : null) ?? named;
    return { catalogId: CATALOG_LUMBER_BIND, label: leg.densifyLabel, speciesId: leg.id };
  }
  const boardRow = !!item && item.category === "lumber" && item.formFactor === "board";
  const label =
    (panel.materialId === CATALOG_LUMBER_BIND && named) ||
    (boardRow && panel.materialId !== "lumber-2x2-8" && panel.materialId !== "lumber-4x4-8") ||
    // A typed species rides on every lumber part, posts and 2×2 included ("Cedar 4×4").
    (named && item?.category === "lumber")
      ? namedStockDisplayName(prompt, item)
      : (item?.name ?? panel.materialId);
  return { catalogId: panel.materialId, label, speciesId: speciesOfStockLabel(label) };
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(c: [number, number, number]): string {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Multiplier that turns the shared grain texture into the wanted face tone. */
export function grainTintFor(tone: string): string {
  const base = hexRgb(GRAIN_BASE);
  const want = hexRgb(tone);
  return rgbHex(want.map((v, i) => Math.min(255, (v / base[i]) * 255)) as [number, number, number]);
}

export type PartRenderLook = PartStock & {
  /** Face tone the part should read as on the bench (species tone, else catalog colour). */
  tone: string;
  /** Material colour for a grain-textured mesh (tone ÷ grain base), or the tone on untextured stock. */
  color: (textured: boolean) => string;
};

/** Bench material for one panel — from the same stock the cut list prints for it. */
export function panelRenderLook(prompt: string, panel: Pick<Panel, "name" | "materialId" | "size">): PartRenderLook {
  const stock = panelStock(prompt, panel);
  const thin = Math.min(panel.size.width, panel.size.height, panel.size.depth) <= 0.26;
  // A ¼" part on a ply or named-board build is cut from ¼" plywood (the cut list says so too).
  if (thin && (/plywood/i.test(stock.catalogId) || stock.catalogId === CATALOG_LUMBER_BIND)) {
    const ply = getCatalogItem("plywood-1-4-4x8");
    const tone = ply?.color ?? "#e6d0a4";
    return { catalogId: "plywood-1-4-4x8", label: ply?.name ?? '1/4" Plywood 4×8', speciesId: null, tone, color: (t) => (t ? NEUTRAL_GRAIN_TINT : tone) };
  }
  if (stock.speciesId && SPECIES_TONE[stock.speciesId]) {
    const tone = SPECIES_TONE[stock.speciesId];
    return { ...stock, tone, color: (t) => (t ? grainTintFor(tone) : tone) };
  }
  const tone = getCatalogItem(stock.catalogId)?.color ?? "#c4a06a";
  return { ...stock, tone, color: (t) => (t ? NEUTRAL_GRAIN_TINT : tone) };
}
