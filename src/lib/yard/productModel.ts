/**
 * A named product becomes one whole piece at a real size, drawn as that thing.
 * A brand we have a package spec for uses that spec. Anything else in the same
 * family uses the usual size of that family, and the note says so.
 */
import type { CatalogItem, StockShape } from "./types";

type Envelope = {
  shape: StockShape;
  name: string;
  id: string;
  length: number;
  diameter?: number;
  width?: number;
  height?: number;
  color: string;
  roughness: number;
  metalness: number;
  note: string;
  sourced: boolean;
};

const SPECS: (Envelope & { match: (q: string) => boolean })[] = [
  {
    id: "dasani-20",
    name: "Dasani 20 oz bottle",
    shape: "bottle",
    length: 8.95,
    diameter: 2.89,
    color: "#c5dff0",
    roughness: 0.16,
    metalness: 0.05,
    sourced: true,
    note: "20 oz Dasani PET. 8.95″ tall, 2.89″ across.",
    match: (q) => /dasani/.test(q) && (/\b20\b/.test(q) || /\b591\b/.test(q)),
  },
  {
    id: "dasani-169",
    name: "Dasani 16.9 oz bottle",
    shape: "bottle",
    length: 8.86,
    diameter: 2.58,
    color: "#c5dff0",
    roughness: 0.16,
    metalness: 0.05,
    sourced: true,
    note: "16.9 oz Dasani PET. 8.86″ tall, 2.58″ across.",
    match: (q) => /dasani/.test(q),
  },
];

const USUAL: Record<StockShape, Omit<Envelope, "name" | "id">> = {
  bottle: {
    shape: "bottle",
    length: 8.02,
    diameter: 2.57,
    color: "#d5e7f2",
    roughness: 0.16,
    metalness: 0.05,
    sourced: false,
    note: "Usual 16.9 oz PET bottle, 8.02″ × 2.57″. Not this brand’s drawing.",
  },
  can: {
    shape: "can",
    length: 4.83,
    diameter: 2.6,
    color: "#d8dbe0",
    roughness: 0.32,
    metalness: 0.72,
    sourced: false,
    note: "Usual 12 oz can, 4.83″ × 2.60″. Not this brand’s drawing.",
  },
  jar: {
    shape: "jar",
    length: 5.5,
    diameter: 3,
    color: "#efe6d4",
    roughness: 0.4,
    metalness: 0.04,
    sourced: false,
    note: "Usual jar, about 5.5″ × 3″. Not a checked drawing.",
  },
  tank: {
    shape: "tank",
    length: 26,
    diameter: 7.25,
    width: 7.25,
    color: "#c5d0d6",
    roughness: 0.32,
    metalness: 0.62,
    sourced: false,
    note: "Usual tank, about 26″ tall and 7.25″ across. Not this one’s drawing.",
  },
  tool: {
    shape: "tool",
    length: 8,
    diameter: 1.1,
    width: 2.4,
    color: "#b7b1a8",
    roughness: 0.45,
    metalness: 0.35,
    sourced: false,
    note: "Usual hand tool, about 8″ long. Not this tool’s drawing.",
  },
  eyewear: {
    shape: "eyewear",
    length: 7,
    width: 3.2,
    height: 2.2,
    color: "#243044",
    roughness: 0.28,
    metalness: 0.08,
    sourced: false,
    note: "Usual goggles, about 7″ × 3″. Not this pair’s drawing.",
  },
  object: {
    shape: "object",
    length: 6,
    width: 4,
    height: 3,
    color: "#d9d3c7",
    roughness: 0.55,
    metalness: 0.04,
    sourced: false,
    note: "No drawing on file. About 6″ × 4″ × 3″. A listing photo replaces this when one comes back.",
  },
  ball: {
    shape: "ball",
    length: 8.5,
    diameter: 8.5,
    color: "#e07a3d",
    roughness: 0.55,
    metalness: 0.02,
    sourced: false,
    note: "Usual ball, about 8.5″ across. Not this ball’s stamp.",
  },
  cup: {
    shape: "cup",
    length: 4,
    diameter: 3.2,
    color: "#f4f1ea",
    roughness: 0.35,
    metalness: 0.04,
    sourced: false,
    note: "Usual cup, about 4″ × 3.2″. Not this cup’s drawing.",
  },
  bucket: {
    shape: "bucket",
    length: 12,
    diameter: 10,
    color: "#d8dde3",
    roughness: 0.42,
    metalness: 0.08,
    sourced: false,
    note: "Usual bucket, about 12″ × 10″. Not this bucket’s drawing.",
  },
  roll: {
    shape: "roll",
    length: 4.5,
    diameter: 4.2,
    color: "#f7f4ee",
    roughness: 0.7,
    metalness: 0.02,
    sourced: false,
    note: "Usual roll, about 4.5″ wide. Not this roll’s drawing.",
  },
  block: {
    shape: "block",
    length: 16,
    width: 8,
    height: 8,
    color: "#b7b1a6",
    roughness: 0.85,
    metalness: 0.02,
    sourced: false,
    note: "Usual block, about 16″ × 8″ × 8″. Not this block’s drawing.",
  },
};

export function shapeOf(text: string): StockShape {
  const q = text.toLowerCase();
  if (/\b(scuba|scubba|propane|oxygen)\b/.test(q) || /\btanks?\b/.test(q)) return "tank";
  if (/\b(mason|jars?)\b/.test(q)) return "jar";
  if (/\b(watering|trash|garbage|oil|gas|jerry|milk)\s+cans?\b/.test(q)) return "bucket";
  if (/\bcans?\b/.test(q) && !/\bcanvas\b/.test(q)) return "can";
  if (/\b(bottles?|dasani|aquafina|evian|fiji|smartwater|pellegrino|poland|hydro\s*flask|ketchup|mustard)\b/.test(q)) return "bottle";
  if (/\b(screw\s*drivers?|hammers?|wrenches?|pliers|drills?|saws?|chisels?|ratchets?|flashlights?|torches|lanterns?)\b/.test(q)) return "tool";
  if (/\b(goggles|glasses|sunglasses)\b/.test(q)) return "eyewear";
  if (/\bfootballs?\b/.test(q)) return "ball";
  if (/\b(basketballs?|soccer\s*balls?|tennis\s*balls?|balls?)\b/.test(q)) return "ball";
  if (/\b(mugs?|cups?|tumblers?|ramblers?|quenchers?)\b/.test(q)) return "cup";
  if (/\btape\s*measures?\b/.test(q)) return "roll";
  if (/\b(door\s*knobs?|knobs?|deadbolts?|locksets?)\b/.test(q)) return "block";
  if (/\brubik|puzzle\s*cubes?/.test(q)) return "block";
  if (/\b(buckets?|pails?)\b/.test(q)) return "bucket";
  if (/\btraffic\s*cones?\b/.test(q)) return "bucket";
  if (/\b(padlocks?)\b/.test(q)) return "block";
  if (/\b(totes?|storage\s+bins?|storage\s+box(?:es)?|latching\s+box(?:es)?)\b/.test(q)) return "block";
  if (/sterilite/.test(q) && /\b(box(?:es)?|bins?|totes?)\b/.test(q)) return "block";
  if (/\b(toilet\s*paper|paper\s*towels?|duct\s*tape|masking\s*tape|extension\s*cords?|cords?|ropes?|hoses?)\b/.test(q)) return "roll";
  if (/\b(crates?|cinder|cmu|pavers?|bricks?)\b/.test(q) || /\bconcrete\s+blocks?\b/.test(q)) return "block";
  if (/\b(wd-?\s*40|aerosol|spray\s*paint)\b/.test(q)) return "can";
  if (/\b(sharpies?|markers?|pens?|pencils?|crayons?)\b/.test(q)) return "tool";
  // A cooler is the chest, not an igloo dome and not a closet.
  if (/\bcoolers?\b/.test(q) && !/\bwine\b/.test(q)) return "block";
  return "object";
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function niceName(query: string, shape: StockShape): string {
  const cleaned = query
    .replace(/\b\d+(?:\.\d+)?\s*(?:in|inch|inches|ft|foot|feet|"|')\b/gi, " ")
    .replace(/\b(?:tall|high|long|wide|width|thick|diameter|dia|across)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 3) return cleaned;
  if (shape === "can") return "Can";
  if (shape === "jar") return "Jar";
  if (shape === "bottle") return "Water bottle";
  if (shape === "tank") return "Tank";
  if (shape === "tool") return "Tool";
  if (shape === "eyewear") return "Goggles";
  if (shape === "ball") return "Ball";
  if (shape === "cup") return "Cup";
  if (shape === "bucket") return "Bucket";
  if (shape === "roll") return "Roll";
  if (shape === "block") return "Block";
  return "Piece";
}

const NAMED: { match: (q: string) => boolean; over: Partial<Envelope> }[] = [
  { match: (q) => /yeti/.test(q) && /rambler|tumbler|20/.test(q), over: { shape: "cup", length: 6.6, diameter: 3.5, color: "#d7dde2", metalness: 0.55, roughness: 0.28, note: "YETI Rambler 20 oz, 6.6″ tall and 3.5″ across. Listing size, not a drawing." } },
  { match: (q) => /quencher/.test(q) && /40/.test(q), over: { shape: "cup", length: 12.3, diameter: 3.86, width: 5.82, color: "#d7e4ee", metalness: 0.45, roughness: 0.35, note: "Stanley Quencher H2.0 40 oz, 12.3″ tall, 3.86″ × 5.82″ with the handle. Listing size." } },
  { match: (q) => /stanley/.test(q) && /tape\s*measures?/.test(q), over: { shape: "roll", length: 3.13, diameter: 3, width: 1.75, color: "#c5c8cc", metalness: 0.55, roughness: 0.35, note: "Stanley PowerLock 25 ft case, 3.13″ × 1.75″ × 3″. Listing housing, not the blade." } },
  { match: (q) => /schlage/.test(q) && /knob/.test(q), over: { shape: "block", length: 2.31, width: 2.09, height: 2.09, color: "#c5c9ce", metalness: 0.72, roughness: 0.32, note: "Schlage Plymouth knob, 2.09″ across and 2.31″ projection. Maker size." } },
  { match: (q) => /rubik/.test(q), over: { shape: "block", length: 2.24, width: 2.24, height: 2.24, color: "#1c1c1c", roughness: 0.4, metalness: 0.05, note: "Rubik's Cube, 57 mm (2.24″) on a side. Official size." } },
  { match: (q) => /hydro\s*flask/.test(q) && /32/.test(q), over: { shape: "bottle", length: 11, diameter: 3.55, color: "#d5dde3", metalness: 0.55, roughness: 0.28, note: "Hydro Flask 32 oz wide mouth, 11″ tall and 3.55″ across. Maker size, not a PET bottle." } },
  { match: (q) => /estwing/.test(q) && /hammer/.test(q) && /12/.test(q), over: { shape: "tool", length: 11, diameter: 1.15, width: 5, color: "#3d5f8a", note: "Estwing 12 oz claw hammer, 11″ overall. Maker length." } },
  { match: (q) => /estwing/.test(q) && /hammer/.test(q), over: { shape: "tool", length: 13, diameter: 1.25, width: 5.5, color: "#3d5f8a", note: "Estwing 16 oz claw hammer, 13″ overall. Maker length, not an 8″ hand-tool guess." } },
  { match: (q) => /lineman|klein/.test(q) && /pliers/.test(q), over: { shape: "tool", length: 9.35, diameter: 0.75, width: 2.06, color: "#1d3f73", note: "Klein D213-9NE lineman pliers, 9.35″ × 2.06″. Maker size." } },
  { match: (q) => /rubbermaid/.test(q) && /tote|18/.test(q), over: { shape: "block", length: 23.875, width: 15.875, height: 16.375, color: "#6d737c", note: "Rubbermaid Roughneck 18 gal tote, 23.875″ × 15.875″ × 16.375″. Listing outside size." } },
  { match: (q) => /footballs?/.test(q), over: { shape: "ball", length: 11.125, diameter: 6.73, width: 6.73, color: "#8a5a32", note: "Official football, 11 to 11.25″ long, short way about 6.73″. Rule size, not this ball’s stamp." } },
  { match: (q) => /master\s*lock/.test(q) && /3\s*d|padlock/.test(q), over: { shape: "block", length: 2.6, width: 1.57, height: 0.98, color: "#b7bec6", metalness: 0.7, roughness: 0.35, note: "Master Lock 3D, about 1.57″ wide and 2.6″ tall. Listing size." } },
  { match: (q) => /padlocks?/.test(q), over: { shape: "block", length: 2.6, width: 1.57, height: 0.98, color: "#b7bec6", metalness: 0.7, roughness: 0.35, note: "Usual laminated padlock, about 1.57″ × 2.6″. Not this lock’s drawing." } },
  { match: (q) => /traffic\s*cones?/.test(q), over: { shape: "bucket", length: 18, diameter: 10.5, width: 10.5, color: "#e35b12", note: "Usual 18″ traffic cone, 10.5″ base. Not this cone’s drawing." } },
  { match: (q) => /soccer/.test(q) && /ball/.test(q), over: { shape: "ball", length: 8.65, diameter: 8.65, note: "Size 5 soccer ball, 8.65″ across. Not this ball’s stamp." } },
  { match: (q) => /tennis/.test(q) && /ball/.test(q), over: { shape: "ball", length: 2.57, diameter: 2.57, note: "Tennis ball, 2.57″ across. Not this ball’s stamp." } },
  { match: (q) => /\b5\s*gal/.test(q) && /bucket|pail/.test(q), over: { shape: "bucket", length: 14.5, diameter: 11.9, note: "Usual 5 gallon bucket, 14.5″ × 11.9″. Not this bucket’s drawing." } },
  { match: (q) => /cinder|cmu|concrete\s+block/.test(q), over: { shape: "block", length: 16, width: 8, height: 8, note: "Usual cinder block, 16″ × 8″ × 8″. Not this block’s drawing." } },
  { match: (q) => /milk\s*crate|\bcrates?\b/.test(q), over: { shape: "block", length: 13, width: 13, height: 11, note: "Usual milk crate, 13″ × 13″ × 11″. Not this crate’s drawing." } },
  { match: (q) => /toilet\s*paper/.test(q), over: { shape: "roll", length: 4.5, diameter: 4.2, note: "Usual toilet paper roll, 4.5″ wide. Not this roll’s drawing." } },
  { match: (q) => /paper\s*towels?/.test(q), over: { shape: "roll", length: 11, diameter: 5.5, note: "Usual paper towel roll, 11″ wide. Not this roll’s drawing." } },
  { match: (q) => /yoga\s*mat/.test(q), over: { shape: "object", length: 68, width: 24, height: 0.2, note: "Usual yoga mat, 68″ × 24″. Not this mat’s drawing." } },
  { match: (q) => /bowling\s*pins?/.test(q), over: { shape: "object", length: 15, width: 4.7, height: 4.7, note: "Usual bowling pin, 15″ tall. Not this pin’s drawing." } },
  { match: (q) => /watering\s+can/.test(q), over: { shape: "bucket", length: 11, diameter: 8, note: "Usual watering can, about 11″ × 8″. Not a drink can, and not this one’s drawing." } },
  { match: (q) => /ketchup|mustard/.test(q), over: { shape: "bottle", length: 8, diameter: 2.5, note: "Usual squeeze bottle, about 8″ × 2.5″. Not this bottle’s drawing." } },
  { match: (q) => /\bbricks?\b/.test(q) && !/lego/.test(q), over: { shape: "block", length: 8, width: 3.75, height: 2.25, note: "Usual brick, 8″ × 3.75″ × 2.25″. Not a Lego, and not this brick’s drawing." } },
  { match: (q) => /wd-?\s*40|aerosol|spray\s*paint/.test(q), over: { shape: "can", length: 7.75, diameter: 2.6, color: "#f2d23a", note: "Usual aerosol can, 7.75″ × 2.6″. Not this can’s drawing." } },
  { match: (q) => /sharpies?|markers?|pens?|pencils?/.test(q), over: { shape: "tool", length: 5.5, diameter: 0.6, color: "#1a1a1a", note: "Usual marker, 5.5″ × 0.6″. Not this one’s drawing." } },
  { match: (q) => /flashlights?|\btorches\b|lanterns?/.test(q), over: { shape: "tool", length: 6.5, diameter: 1.5, color: "#2a2e33", note: "Usual flashlight, 6.5″ × 1.5″. Not this light’s drawing." } },
  { match: (q) => /tape\s*measures?/.test(q), over: { shape: "roll", length: 1.5, diameter: 3.2, color: "#e0a106", note: "Usual tape measure, 3.2″ across and 1.5″ thick. Not this tape’s drawing." } },
  { match: (q) => /extension\s*cords?|\bcords?\b|\bropes?\b|\bhoses?\b/.test(q), over: { shape: "roll", length: 2.5, diameter: 8, color: "#f07a1a", note: "Usual 25 ft coil, about 8″ across. Not this cord’s drawing." } },
  { match: (q) => /drop\s*cloth|tarp|\bcanvas\b/.test(q), over: { shape: "object", length: 108, width: 144, height: 0.08, color: "#efe8d4", note: "Usual 9×12 ft cloth. Not this cloth’s drawing." } },
  { match: (q) => /saw\s*horses?|sawhorses?/.test(q), over: { shape: "object", length: 36, width: 24, height: 29, color: "#c4a36a", note: "Usual sawhorse, 36″ long and 29″ tall. Not this one’s drawing." } },
  { match: (q) => /cat\s*trees?/.test(q), over: { shape: "object", length: 60, width: 20, height: 20, color: "#c8bfb0", note: "Usual cat tree, about 60″ tall. Not this tree’s drawing." } },
  { match: (q) => /rubber\s*ducks?|\bducks?\b/.test(q), over: { shape: "object", length: 4.2, width: 3.5, height: 3.5, color: "#f2c14e", note: "Usual rubber duck, about 4.2″ long. Not this duck’s drawing." } },
  { match: (q) => /gnomes?/.test(q), over: { shape: "object", length: 12, width: 5, height: 4, color: "#c23b3b", note: "Usual garden gnome, about 12″ tall. Not this gnome’s drawing." } },
  { match: (q) => /sterilite/.test(q) && /\b6\b/.test(q) && /box|bin/.test(q), over: { shape: "block", length: 13.5, width: 8, height: 4.625, color: "#e7eef2", note: "Sterilite 6 qt storage box, 13.5″ × 8″ × 4.625″. Listing outside size." } },
  { match: (q) => /\b(storage\s+box(?:es)?|storage\s+bins?|latching\s+box(?:es)?)\b/.test(q), over: { shape: "block", length: 13.5, width: 8, height: 4.625, color: "#e7eef2", note: "Usual small storage box, about 13.5″ × 8″ × 4.6″. Not this box’s drawing." } },
  { match: (q) => /igloo/.test(q) && /cooler/.test(q), over: { shape: "block", length: 14.5, width: 10.9, height: 13.91, color: "#d7e4ee", note: "Igloo Latitude 16 qt cooler, 14.5″ × 10.9″ × 13.91″. Listing outside size." } },
  { match: (q) => /\bcoolers?\b/.test(q) && !/wine/.test(q), over: { shape: "block", length: 16, width: 12, height: 13, color: "#d7e4ee", note: "Usual picnic cooler, about 16″ × 12″ × 13″. Not this cooler’s drawing." } },
];

const BUILD_NOUN = /\b(racks?|shel(?:f|ves|ving)|holders?|stands?|cabinets?|closets?|crates?|organizers?|storage|houses?|frames?|benches|tables?|desks?|vanit(?:y|ies)|drawers?|cubb(?:y|ies)|bookcases?|wardrobes?|built-?ins?|alcoves?|towers?)\b/;

/**
 * A sentence that names a product and not a thing to build for it.
 * "Dasani bottle" is the bottle. "bottle shelf" and "wine rack" are builds.
 */
/** A sold box is the piece. "Storage" alone still means a unit to build. */
function isSoldStorageBox(q: string): boolean {
  if (/\b(shel(?:f|ves)|racks?|stands?|holders?|cabinets?|closets?)\b/.test(q)) return false;
  return /\b(storage\s+box(?:es)?|storage\s+bins?|latching\s+box(?:es)?)\b/.test(q)
    || (/sterilite/.test(q) && /\b(box(?:es)?|bins?|totes?)\b/.test(q));
}

export function isBareProductPrompt(prompt: string): boolean {
  const q = prompt.trim().toLowerCase();
  if (q.length < 3 || (BUILD_NOUN.test(q) && !isSoldStorageBox(q))) return false;
  if (/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/.test(q)) return false;
  if (SPECS.some((row) => row.match(q))) return true;
  return shapeOf(q) !== "object";
}

/** The piece this name is, at a published size or the usual size of its family. */
export function productEnvelope(query: string): Envelope | null {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  if (/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/i.test(q)) return null;
  const spec = SPECS.find((row) => row.match(q));
  if (spec) {
    const { match: _match, ...env } = spec;
    return env;
  }
  const shape = shapeOf(q);
  const usual = USUAL[shape];
  const named = NAMED.find((row) => row.match(q));
  const name = niceName(query, named?.over.shape ?? shape);
  const env: Envelope = {
    ...usual,
    ...named?.over,
    name,
    id: `${named?.over.shape ?? shape}-${hash(name.toLowerCase())}`,
  };
  // A 20 lb grill cylinder is a published size, not the skinny usual tank.
  if (shape === "tank" && /20\s*-?\s*lb/.test(q) && /propane/.test(q)) {
    env.length = 18;
    env.diameter = 12.2;
    env.width = 12.2;
    env.note = "20 lb propane tank, about 18\u2033 tall and 12.2\u2033 across. Usual cylinder, not this tank\u2019s stamp.";
  }
  return env;
}

export function modeledProduct(query: string): CatalogItem | null {
  const env = productEnvelope(query);
  if (!env) return null;
  return pieceFromEnvelope(env, env.length, env.diameter, env.note, [query.trim(), env.name]);
}

export function pieceFromEnvelope(
  env: Envelope,
  length: number,
  diameter: number | undefined,
  note: string,
  aliases: string[],
): CatalogItem {
  const dims: CatalogItem["dims"] = diameter
    ? { length, diameter, width: env.width ?? diameter, height: env.height }
    : { length, width: env.width ?? 4, height: env.height ?? 3 };
  const category =
    env.shape === "can" || env.shape === "tank" || env.shape === "tool"
      ? "metal"
      : env.shape === "bottle" || env.shape === "jar" || env.shape === "cup" || env.shape === "bucket"
        ? "plastic"
        : "other";
  return {
    id: `piece-model-${env.id}`,
    name: env.name,
    category,
    formFactor: "custom",
    shape: env.shape,
    dims,
    unitsPerPack: 1,
    aliases,
    tags: ["model", env.shape, env.sourced ? "spec" : "usual"],
    preferredJoins: ["glue", "tape", "none"],
    canCut: false,
    color: env.color,
    roughness: env.roughness,
    metalness: env.metalness,
    searchQuery: env.name,
    notes: note,
  };
}
