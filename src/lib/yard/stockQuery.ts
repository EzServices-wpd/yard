/**
 * Stock you can name without a store page.
 * A 2×4 scrap is the real dressed section at the length you have.
 * A bottle or anything else is the size you measured — never a guessed SKU.
 */
import { getCatalogItem, searchCatalog } from "./catalog.ts";
import { namedLumberFromPrompt } from "./namedLumberSpecies.ts";
import { modeledProduct, pieceFromEnvelope, productEnvelope } from "./productModel.ts";
import type { CatalogItem, FormFactor } from "./types";
import { INCH_NUM, parseInchNum, stripTypedSizes } from "./inchText";

type Nominal = {
  key: string;
  id: string;
  /** Actual width, inches. */
  width: number;
  /** Actual thickness, inches. */
  thick: number;
  /** Sold length of the seed row, inches. */
  sold: number;
  label: string;
};

const NOMINALS: Nominal[] = [
  { key: "5/4x6", id: "lumber-1x6-8", width: 5.5, thick: 1, sold: 96, label: "5/4×6" },
  { key: "1x2", id: "lumber-1x2-8", width: 1.5, thick: 0.75, sold: 96, label: "1×2" },
  { key: "1x3", id: "lumber-1x3-8", width: 2.5, thick: 0.75, sold: 96, label: "1×3" },
  { key: "1x4", id: "lumber-1x4-8", width: 3.5, thick: 0.75, sold: 96, label: "1×4" },
  { key: "1x6", id: "lumber-1x6-8", width: 5.5, thick: 0.75, sold: 96, label: "1×6" },
  { key: "1x8", id: "lumber-1x8-8", width: 7.25, thick: 0.75, sold: 96, label: "1×8" },
  { key: "2x2", id: "lumber-2x2-8", width: 1.5, thick: 1.5, sold: 96, label: "2×2" },
  { key: "2x4", id: "lumber-2x4-8", width: 3.5, thick: 1.5, sold: 96, label: "2×4" },
  { key: "2x6", id: "lumber-2x6-8", width: 5.5, thick: 1.5, sold: 96, label: "2×6" },
  { key: "2x8", id: "lumber-2x8-8", width: 7.25, thick: 1.5, sold: 96, label: "2×8" },
  { key: "2x10", id: "lumber-2x10-8", width: 9.25, thick: 1.5, sold: 96, label: "2×10" },
  { key: "2x12", id: "lumber-2x12-8", width: 11.25, thick: 1.5, sold: 96, label: "2×12" },
  { key: "4x4", id: "lumber-4x4-8", width: 3.5, thick: 3.5, sold: 96, label: "4×4" },
];

const OWNED = /\b(i have|i own|already own|already owns|pile of|piles of|scraps?|leftovers?|on hand|already have)\b/i;

function frac(n: number): string {
  const known: [number, string][] = [
    [0.75, "3/4"],
    [1.5, "1 1/2"],
    [2.5, "2 1/2"],
    [3.5, "3 1/2"],
    [5.5, "5 1/2"],
    [7.25, "7 1/4"],
    [9.25, "9 1/4"],
    [11.25, "11 1/4"],
  ];
  for (const [v, s] of known) if (Math.abs(n - v) < 0.03) return s;
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function findNominal(q: string): { nom: Nominal; rest: string } | null {
  const deck = q.match(/\b5\s*\/\s*4\s*[x×]\s*6(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\b/i);
  if (deck) {
    const nom = NOMINALS.find((n) => n.key === "5/4x6");
    if (!nom) return null;
    const rest = `${q.slice(0, deck.index)} ${deck[1] ? deck[1] + " in " : ""} ${q.slice((deck.index ?? 0) + deck[0].length)}`;
    return { nom, rest };
  }
  const m = q.match(/\b([124])\s*[x×]\s*(2|3|4|6|8|10|12)\b/i);
  if (!m) return null;
  const key = `${m[1]}x${m[2]}`;
  const nom = NOMINALS.find((n) => n.key === key);
  if (!nom) return null;
  const rest = `${q.slice(0, m.index)} ${q.slice((m.index ?? 0) + m[0].length)}`;
  return { nom, rest };
}

/** Length in inches named beside a nominal, or null when they didn't name one. */
export function namedPieceLength(text: string): number | null {
  const triple = text.match(/\b[124]\s*[x×]\s*\d+\s*[x×]\s*(\d+(?:\.\d+)?)\b/i);
  if (triple) {
    const n = parseFloat(triple[1]);
    return n <= 16 ? n * 12 : n;
  }
  const bare = text.replace(/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/gi, " ");
  const feet = bare.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\b/i);
  if (feet) return parseFloat(feet[1]) * 12;
  const inches = bare.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")\b/i);
  if (inches) return parseFloat(inches[1]);
  const pair = bare.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?/i);
  if (pair) return parseFloat(pair[1]);
  return null;
}

function near(a: number, b: number) {
  return Math.abs(a - b) < 0.75;
}

/**
 * A construction piece at a size that isn't the 8 ft seed row.
 * "2x4 scraps all 5x5 inches" → 1½″ × 3½″ × 5″, price $0.
 */
export function localStockQuery(query: string): CatalogItem | null {
  const q = query.trim();
  if (q.length < 3) return null;
  const found = findNominal(q);
  if (!found) return null;
  const { nom, rest } = found;
  const length = namedPieceLength(rest) ?? namedPieceLength(q);
  if (length == null || length < 0.5 || length > 240) return null;
  if (near(length, nom.sold)) return null;

  const base = getCatalogItem(nom.id);
  const owned = OWNED.test(q);
  const species = namedLumberFromPrompt(q);
  const pair = rest.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/i);
  const notes: string[] = [];
  if (pair) {
    const a = parseFloat(pair[1]);
    const b = parseFloat(pair[2]);
    const isNominal = near(a, Number(nom.key[0])) && near(b, Number(nom.key.slice(2)));
    const isActual = (near(a, nom.width) && near(b, nom.thick)) || (near(a, nom.thick) && near(b, nom.width));
    if (!isNominal && !isActual) {
      notes.push(
        `A ${nom.label} is actually ${frac(nom.thick)}″ × ${frac(nom.width)}″, not ${frac(a)}×${frac(b)}. Length used is ${frac(length)}″.`,
      );
    }
  }
  if (owned) notes.push("You already have these, so the price stays $0.");
  else notes.push(`Price is not a checked store price for this length. The seed ${nom.label} is the ${nom.sold / 12} ft board.`);

  const title = `${species ? `${species.display} ` : ""}${nom.label}${owned ? " scrap" : ""}, ${frac(length)}″`;
  return {
    id: `piece-${nom.key}-${String(length).replace(".", "p")}${species ? `-${species.id}` : ""}`,
    name: title,
    brand: species?.display,
    category: "lumber",
    formFactor: "board",
    dims: { length, width: nom.width, height: nom.thick },
    unitsPerPack: 1,
    unitCostUsd: owned ? 0 : undefined,
    aliases: [q, nom.key, title],
    tags: ["lumber", owned ? "scrap" : "cut"],
    preferredJoins: base?.preferredJoins ?? ["screw", "nail", "glue"],
    canCut: true,
    color: base?.color ?? "#d8c4a0",
    roughness: base?.roughness ?? 0.75,
    searchQuery: `${species ? `${species.display} ` : ""}${nom.key} lumber`,
    notes: notes.join(" "),
  };
}

export function stockHint(query: string): string | null {
  const q = query.trim();
  if (!findNominal(q)) return null;
  if (localStockQuery(q)) return null;
  if (OWNED.test(q)) return "Say how long each scrap is — for example, 5 inches.";
  return null;
}

type Measures = { length?: number; width?: number; thick?: number; diameter?: number };

function labeled(text: string, axis: RegExp): number | undefined {
  const m = text.match(new RegExp(String.raw`(?<![\w/])(${INCH_NUM})\s*(?:in|inch|inches|")?\s*(?:${axis.source})`, "i"));
  if (!m) return undefined;
  const n = parseInchNum(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function measuresFromQuery(query: string): Measures {
  const stripped = query.replace(/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/gi, " ");
  const length = labeled(stripped, /tall|high|long|length/);
  const width = labeled(stripped, /wide|width/);
  const thick = labeled(stripped, /thick|thickness|deep|depth/);
  const diameter = labeled(stripped, /diameter|dia/);
  if (length != null || width != null || thick != null || diameter != null) {
    return { length, width, thick, diameter };
  }
  const pair = stripped.match(new RegExp(String.raw`(?<![\w/])(${INCH_NUM})\s*(?:x|×|by)\s*(${INCH_NUM})\s*(?:in|inch|inches|")?`, "i"));
  if (pair) return { length: parseInchNum(pair[1]), width: parseInchNum(pair[2]) };
  // A size that names the stock ("from 1/4 inch dowels") is the material, not the piece.
  const one = stripped.match(new RegExp(String.raw`(?<![\w/])(${INCH_NUM})\s*(?:in|inch|inches|")(?!\w)(?!\s*(?:dowels?|rods?|ply(?:wood)?|boards?|sticks?|stock|pipe|tubing|wire)\b)`, "i"));
  if (one) return { length: parseInchNum(one[1]) };
  return {};
}

function titleFrom(query: string): string {
  const N = INCH_NUM;
  return stripTypedSizes(
    query
      // "12 x 18 in", "3 1/2 by 4": the whole pair goes, fractions and all.
      .replace(new RegExp(String.raw`(?<![\w/])${N}\s*(?:x|×|by)\s*${N}(?:\s*(?:x|×|by)\s*${N})?\s*(?:in\b|inch(?:es)?\b|"|″)?`, "gi"), " ")
      // "24 long", "3/4 diameter": a number that a size word labels.
      .replace(new RegExp(String.raw`(?<![\w/])${N}\s*(?:in\b|inch(?:es)?\b|"|″)?\s*(?=(?:tall|high|long|length|wide|width|thick|thickness|deep|depth|diameter|dia|across)\b)`, "gi"), " "),
  )
    .replace(/\b(?:tall|high|long|length|wide|width|thick|thickness|deep|depth|diameter|dia|across)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productNameFromQuery(query: string): string {
  return titleFrom(query);
}

/**
 * Anything that isn't a lumber nominal, once they name inches.
 * A bottle stays a bottle at the inches they typed. The width falls back
 * to that product's real size when they only named the height.
 */
export function typedStockQuery(query: string): CatalogItem | null {
  const q = query.trim();
  if (q.length < 3 || findNominal(q)) return null;
  const m = measuresFromQuery(q);
  const name = titleFrom(q);
  if (name.length < 3) return null;
  if (m.length == null) return null;

  const env = productEnvelope(q);
  if (env && m.width == null) {
    const diameter = m.diameter ?? env.diameter;
    const same =
      Math.abs(m.length - env.length) < 0.2 &&
      (m.diameter == null || (env.diameter != null && Math.abs(m.diameter - env.diameter) < 0.08));
    const used = same ? env : { ...env, name, id: `${env.shape}-${hash(name.toLowerCase())}-typed` };
    const note = same
      ? env.note
      : m.diameter != null
        ? "Size you typed. The piece stays this shape, not a pipe."
        : `Height is what you typed. Width stays ${env.diameter ?? env.width ?? ""}″, the usual ${env.shape}.`;
    return pieceFromEnvelope(used, m.length, diameter, note, [q, name, env.name]);
  }

  let form: FormFactor = "custom";
  const dims: CatalogItem["dims"] = { length: m.length };
  const notes: string[] = ["Size you typed. Not a checked store page."];
  if (m.diameter != null) {
    form = "tube";
    dims.diameter = m.diameter;
  } else if (m.width != null) {
    form = "block";
    dims.width = m.width;
    dims.height = m.thick ?? 0.75;
    if (m.thick == null) notes.push("Thickness wasn’t named. Assumed 3/4″ until you type one.");
  } else {
    notes.push("Only one dimension was named. Add a diameter or a width if the piece needs it.");
  }

  return {
    id: `piece-${hash(`${name}|${m.length}|${m.width ?? ""}|${m.diameter ?? ""}|${m.thick ?? ""}`)}`,
    name,
    category: m.diameter != null ? "plastic" : "other",
    formFactor: form,
    dims,
    unitsPerPack: 1,
    aliases: [q, name],
    tags: ["typed"],
    preferredJoins: ["glue", "tape", "none"],
    canCut: false,
    color: "#d7dde0",
    roughness: 0.45,
    searchQuery: name,
    notes: notes.join(" "),
  };
}

/** A nominal the seed library doesn’t sell, at the ordinary 8 ft length. */
function gapNominal(query: string): CatalogItem | null {
  const found = findNominal(query);
  if (!found) return null;
  const { nom } = found;
  const length = namedPieceLength(found.rest) ?? namedPieceLength(query);
  if (length != null && (length < 0.5 || length > 240 || !near(length, nom.sold))) return null;
  if (getCatalogItem(nom.id)) return null;
  const species = namedLumberFromPrompt(query);
  const title = `${species ? `${species.display} ` : ""}${nom.label}, ${nom.sold / 12} ft`;
  return {
    id: `piece-${nom.key}-${nom.sold}${species ? `-${species.id}` : ""}`,
    name: title,
    brand: species?.display,
    category: "lumber",
    formFactor: "board",
    dims: { length: nom.sold, width: nom.width, height: nom.thick },
    unitsPerPack: 1,
    aliases: [query, nom.key, title],
    tags: ["lumber", "cut"],
    preferredJoins: ["screw", "nail", "glue"],
    canCut: true,
    color: "#d8c4a0",
    roughness: 0.75,
    searchQuery: `${species ? `${species.display} ` : ""}${nom.key} lumber`,
    notes: `A ${nom.label} is actually ${frac(nom.thick)}″ × ${frac(nom.width)}″. No checked price — the store links search for this board.`,
  };
}

/** A seed-library piece already answers this. Don’t invent a second one. */
function libraryOwns(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  const owns = (label: string) =>
    label === q || label.startsWith(`${q} `) || (label.length >= 4 && (q.startsWith(`${label} `) || q.includes(label)));
  return searchCatalog(q, 6)
    .filter((item) => !item.id.startsWith("piece-"))
    .some((item) => owns(item.name.toLowerCase()) || (item.aliases ?? []).some((alias) => owns(alias.toLowerCase())));
}
export function stockOffer(query: string): CatalogItem | null {
  const local = localStockQuery(query);
  if (local) return local;
  const typed = typedStockQuery(query);
  if (typed) return typed;
  if (libraryOwns(query)) return null;
  const modeled = modeledProduct(query);
  if (modeled) return modeled;
  if (stockHint(query)) return null;
  return gapNominal(query);
}

export type StockListing = {
  title: string;
  brand?: string;
  merchant?: string;
  priceUsd?: number;
  image?: string;
};

/** Keep a real merchant and price. Never a made-up product page. */
export function withStoreHit(item: CatalogItem, hit: StockListing | null | undefined): CatalogItem {
  if (!hit?.title) return item;
  const price = hit.priceUsd != null && hit.priceUsd > 0 ? ` $${hit.priceUsd.toFixed(2)}` : "";
  const where = hit.merchant ? `One listing: ${hit.merchant}${price}. Not every store.` : "";
  const keepName = item.tags?.includes("spec") || !hit.merchant;
  const fromTitle = item.tags?.includes("spec") || !hit.merchant ? {} : measuresFromQuery(hit.title);
  const dims = { ...item.dims };
  if (fromTitle.length) dims.length = fromTitle.length;
  if (fromTitle.diameter) dims.diameter = fromTitle.diameter;
  if (fromTitle.width && !fromTitle.diameter) dims.width = fromTitle.width;
  const photo = hit.image
    ? hit.merchant
      ? "The picture is that listing."
      : "The picture is a reference photo, not a store listing."
    : "";
  return {
    ...item,
    name: keepName ? item.name : hit.title,
    brand: hit.brand || item.brand,
    // Only a real, finite price replaces ours — a listing with no price never becomes $NaN.
    unitCostUsd: hit.priceUsd != null && Number.isFinite(hit.priceUsd) && hit.priceUsd > 0 ? hit.priceUsd : item.unitCostUsd,
    dims,
    image: hit.image || item.image,
    searchQuery: item.searchQuery || hit.title,
    notes: [item.notes, where, photo].filter(Boolean).join(" "),
    aliases: [...new Set([...(item.aliases ?? []), hit.title])],
  };
}

/**
 * A product used at a size the person typed, optionally named from a real listing.
 */
export function measuredProduct(
  query: string,
  length: number,
  across: number | null,
  round: boolean,
  hit?: StockListing | null,
): CatalogItem | null {
  if (!Number.isFinite(length) || length < 0.25 || length > 240) return null;
  const name = (hit?.title || productNameFromQuery(query)).trim();
  if (name.length < 3) return null;
  const env = productEnvelope(query) ?? productEnvelope(name);
  const dims: CatalogItem["dims"] = { length };
  const notes = [
    hit?.title ? "Size you typed. The listing didn’t include inches." : "Size you typed. Not a checked store page.",
  ];
  let form: FormFactor = "custom";
  if (env && (round || env.shape !== "bottle")) {
    const diameter = across != null && across > 0 ? across : env.diameter;
    const same =
      diameter != null &&
      env.diameter != null &&
      Math.abs(length - env.length) < 0.2 &&
      Math.abs(diameter - env.diameter) < 0.08;
    const used = same ? env : { ...env, name, id: `${env.shape}-${hash(name.toLowerCase())}-typed` };
    return withStoreHit(
      pieceFromEnvelope(used, length, diameter, `${notes[0]} The piece stays this shape.`, [query.trim(), name, env.name]),
      hit,
    );
  }
  if (round && across != null && across > 0) {
    form = "tube";
    dims.diameter = across;
  } else if (!round && across != null && across > 0) {
    form = "block";
    dims.width = across;
    dims.height = 0.75;
    notes.push("Thickness wasn’t named. Assumed 3/4″ until you type one.");
  } else {
    notes.push("Only a length was named.");
  }
  const acrossKey = across != null && across > 0 ? String(across) : "";
  return withStoreHit(
    {
      id: `piece-${hash(`${name}|${length}|${acrossKey}|${round}`)}`,
      name,
      category: round ? "plastic" : "other",
      formFactor: form,
      dims,
      unitsPerPack: 1,
      aliases: [query.trim(), name],
      tags: ["typed"],
      preferredJoins: ["glue", "tape", "none"],
      canCut: false,
      color: "#d7dde0",
      roughness: 0.45,
      searchQuery: productNameFromQuery(query) || name,
      notes: notes.join(" "),
    },
    hit,
  );
}
