/**
 * A named product becomes one whole piece at a real size, drawn as that thing.
 * A brand we have a package spec for uses that spec. Anything else in the same
 * family uses the usual size of that family, and the note says so.
 */
import type { CatalogItem, StockShape } from "./types";
import { INCH_NUM, inchFrac, parseInchNum, stripTypedSizes } from "./inchText";

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
    note: "20 oz Dasani PET. 8 15/16″ tall, 2 7/8″ across.",
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
    note: "16.9 oz Dasani PET. 8 7/8″ tall, 2 9/16″ across.",
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
    note: "Usual 16.9 oz PET bottle, 8″ × 2 9/16″. Type a size to match yours.",
  },
  can: {
    shape: "can",
    length: 4.83,
    diameter: 2.6,
    color: "#d8dbe0",
    roughness: 0.32,
    metalness: 0.72,
    sourced: false,
    note: "Usual 12 oz can, 4 13/16″ × 2 5/8″. Type a size to match yours.",
  },
  jar: {
    shape: "jar",
    length: 5.5,
    diameter: 3,
    color: "#efe6d4",
    roughness: 0.4,
    metalness: 0.04,
    sourced: false,
    note: "Usual jar, about 5 1/2″ × 3″. Type a size to match yours.",
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
    note: "Usual tank, about 26″ tall and 7 1/4″ across. Type a size to match yours.",
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
    note: "Usual hand tool, about 8″ long. Type a size to match yours.",
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
    note: "Usual goggles, about 7″ × 3″. Type a size to match yours.",
  },
  // Unknown object: a stated tabletop-size assumption the user can type over — never a tiny placeholder.
  object: {
    shape: "object",
    length: 10,
    width: 8,
    height: 8,
    color: "#d9d3c7",
    roughness: 0.55,
    metalness: 0.04,
    sourced: false,
    note: "Assumed a tabletop-size piece, about 10″ × 8″ × 8″ — type a size to fit yours. A listing photo replaces this when one comes back.",
  },
  ball: {
    shape: "ball",
    length: 8.5,
    diameter: 8.5,
    color: "#e07a3d",
    roughness: 0.55,
    metalness: 0.02,
    sourced: false,
    note: "Usual ball, about 8 1/2″ across. Type a size to match yours.",
  },
  cup: {
    shape: "cup",
    length: 4,
    diameter: 3.2,
    color: "#f4f1ea",
    roughness: 0.35,
    metalness: 0.04,
    sourced: false,
    note: "Usual cup, about 4″ × 3 3/16″. Type a size to match yours.",
  },
  bucket: {
    shape: "bucket",
    length: 12,
    diameter: 10,
    color: "#d8dde3",
    roughness: 0.42,
    metalness: 0.08,
    sourced: false,
    note: "Usual bucket, about 12″ × 10″. Type a size to match yours.",
  },
  roll: {
    shape: "roll",
    length: 4.5,
    diameter: 4.2,
    color: "#f7f4ee",
    roughness: 0.7,
    metalness: 0.02,
    sourced: false,
    note: "Usual roll, about 4 1/2″ wide. Type a size to match yours.",
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
    note: "Usual block, about 16″ × 8″ × 8″. Type a size to match yours.",
  },
};

export function shapeOf(text: string): StockShape {
  const q = text.toLowerCase();
  if (/\b(scuba|scubba|propane|oxygen)\b/.test(q) || /\btanks?\b/.test(q)) return "tank";
  if (/\b(mason|jars?)\b/.test(q)) return "jar";
  if (/\b(watering|trash|garbage|oil|gas|jerry|milk)\s+cans?\b/.test(q)) return "bucket";
  if (/\bcans?\b/.test(q) && !/\bcanvas\b/.test(q)) return "can";
  if (/\b(bottles?|dasani|aquafina|evian|fiji|smartwater|pellegrino|poland|hydro\s*flask|camelbak|contigo|owala|ketchup|mustard)\b/.test(q)) return "bottle";
  if (/\b(screw\s*drivers?|hammers?|wrench(?:es)?|pliers|drills?|saws?|chisels?|ratchets?|flashlights?|torch(?:es)?|lanterns?|scissors|shears|snips)\b/.test(q)) return "tool";
  if (/\b(goggles|glasses|sunglasses)\b/.test(q)) return "eyewear";
  if (/\bfootballs?\b/.test(q)) return "ball";
  if (/\b(basketballs?|soccer\s*balls?|tennis\s*balls?|balls?)\b/.test(q)) return "ball";
  if (/\b(frisbees?|flying\s+discs?)\b/.test(q) || (/\bdiscs?\b/.test(q) && !/\b(sander|brake|disc\s*golf)\b/.test(q))) return "ball";
  if (/\b(mugs?|cups?|tumblers?|ramblers?|quenchers?)\b/.test(q)) return "cup";
  if (/\btape\s*measures?\b/.test(q)) return "roll";
  if (/\b(door\s*knobs?|knobs?|deadbolts?|locksets?)\b/.test(q)) return "block";
  if (/\brubik|puzzle\s*cubes?/.test(q)) return "block";
  if (/\b(buckets?|pails?)\b/.test(q)) return "bucket";
  if (/\btraffic\s*cones?\b/.test(q)) return "bucket";
  if (/\b(padlocks?)\b/.test(q)) return "block";
  if (/\b(totes?|storage\s+bins?|storage\s+box(?:es)?|latching\s+box(?:es)?)\b/.test(q)) return "block";
  if (/sterilite/.test(q) && /\b(box(?:es)?|bins?|totes?)\b/.test(q)) return "block";
  if (/\bbatter(?:y|ies)\b/.test(q)) return "block";
  if (/\b(flamingos?|lawn\s+ornaments?|gnomes?)\b/.test(q)) return "object";
  if (/\b(utility\s+knives|knives|knife|box\s*cutters?|fastbacks?)\b/.test(q)) return "tool";
  if (/\b(tennis\s+)?rackets?\b/.test(q)) return "tool";
  if (/\bbaseballs?\b/.test(q)) return "ball";
  if (/\b(duplex\s+)?outlets?\b/.test(q) || /\breceptacles?\b/.test(q)) return "block";
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
  const cleaned = stripTypedSizes(query)
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
  { match: (q) => /yeti/.test(q) && /rambler|tumbler|20/.test(q), over: { shape: "cup", length: 6.6, diameter: 3.5, color: "#d7dde2", metalness: 0.55, roughness: 0.28, note: "YETI Rambler 20 oz, 6 5/8″ tall and 3 1/2″ across. Listing size." } },
  { match: (q) => /quencher/.test(q) && /40/.test(q), over: { shape: "cup", length: 12.3, diameter: 3.86, width: 5.82, color: "#d7e4ee", metalness: 0.45, roughness: 0.35, note: "Stanley Quencher H2.0 40 oz, 12 5/16″ tall, 3 7/8″ × 5 13/16″ with the handle. Listing size." } },
  { match: (q) => /stanley/.test(q) && /tape\s*measures?/.test(q), over: { shape: "roll", length: 3.13, diameter: 3, width: 1.75, color: "#c5c8cc", metalness: 0.55, roughness: 0.35, note: "Stanley PowerLock 25 ft case, 3 1/8″ × 1 3/4″ × 3″. Listing housing, not the blade." } },
  { match: (q) => /schlage/.test(q) && /knob/.test(q), over: { shape: "block", length: 2.31, width: 2.09, height: 2.09, color: "#c5c9ce", metalness: 0.72, roughness: 0.32, note: "Schlage Plymouth knob, 2 1/16″ across and 2 5/16″ projection. Maker size." } },
  { match: (q) => /rubik/.test(q), over: { shape: "block", length: 2.24, width: 2.24, height: 2.24, color: "#1c1c1c", roughness: 0.4, metalness: 0.05, note: "Rubik's Cube, 57 mm (2 1/4″) on a side. Official size." } },
  { match: (q) => /hydro\s*flask/.test(q) && /32/.test(q), over: { shape: "bottle", length: 11, diameter: 3.55, color: "#d5dde3", metalness: 0.55, roughness: 0.28, note: "Hydro Flask 32 oz wide mouth, 11″ tall and 3 9/16″ across. Maker size." } },
  { match: (q) => /estwing/.test(q) && /hammer/.test(q) && /12/.test(q), over: { shape: "tool", length: 11, diameter: 1.15, width: 5, color: "#3d5f8a", note: "Estwing 12 oz claw hammer, 11″ overall. Maker length." } },
  { match: (q) => /estwing/.test(q) && /hammer/.test(q), over: { shape: "tool", length: 13, diameter: 1.25, width: 5.5, color: "#3d5f8a", note: "Estwing 16 oz claw hammer, 13″ overall. Maker length, not an 8″ hand-tool guess." } },
  { match: (q) => /lineman|klein/.test(q) && /pliers/.test(q), over: { shape: "tool", length: 9.35, diameter: 0.75, width: 2.06, color: "#1d3f73", note: "Klein D213-9NE lineman pliers, 9 3/8″ × 2 1/16″. Maker size." } },
  { match: (q) => /rubbermaid/.test(q) && /tote|18/.test(q), over: { shape: "block", length: 23.875, width: 15.875, height: 16.375, color: "#6d737c", note: "Rubbermaid Roughneck 18 gal tote, 23 7/8″ × 15 7/8″ × 16 3/8″. Listing outside size." } },
  { match: (q) => /footballs?/.test(q), over: { shape: "ball", length: 11.125, diameter: 6.73, width: 6.73, color: "#8a5a32", note: "Official football, 11 to 11 1/4″ long, short way about 6 3/4″. Rule size." } },
  { match: (q) => /master\s*lock/.test(q) && /3\s*d|padlock/.test(q), over: { shape: "block", length: 2.6, width: 1.57, height: 0.98, color: "#b7bec6", metalness: 0.7, roughness: 0.35, note: "Master Lock 3D, about 1 9/16″ wide and 2 5/8″ tall. Listing size." } },
  { match: (q) => /padlocks?/.test(q), over: { shape: "block", length: 2.6, width: 1.57, height: 0.98, color: "#b7bec6", metalness: 0.7, roughness: 0.35, note: "Usual laminated padlock, about 1 9/16″ × 2 5/8″. Type a size to match yours." } },
  { match: (q) => /traffic\s*cones?/.test(q), over: { shape: "bucket", length: 18, diameter: 10.5, width: 10.5, color: "#e35b12", note: "Usual 18″ traffic cone, 10 1/2″ base. Type a size to match yours." } },
  { match: (q) => /basket\s*balls?/.test(q), over: { shape: "ball", length: 9.43, diameter: 9.43, note: "Size 7 basketball, 9 7/16″ across. Type a size to match yours." } },
  { match: (q) => /soccer/.test(q) && /ball/.test(q), over: { shape: "ball", length: 8.65, diameter: 8.65, note: "Size 5 soccer ball, 8 5/8″ across. Type a size to match yours." } },
  { match: (q) => /tennis/.test(q) && /ball/.test(q), over: { shape: "ball", length: 2.57, diameter: 2.57, note: "Tennis ball, 2 9/16″ across. Type a size to match yours." } },
  { match: (q) => /\b5\s*gal/.test(q) && /bucket|pail/.test(q), over: { shape: "bucket", length: 14.5, diameter: 11.9, note: "Usual 5 gallon bucket, 14 1/2″ × 11 7/8″. Type a size to match yours." } },
  { match: (q) => /cinder|cmu|concrete\s+block/.test(q), over: { shape: "block", length: 16, width: 8, height: 8, note: "Usual cinder block, 16″ × 8″ × 8″. Type a size to match yours." } },
  { match: (q) => /milk\s*crate|\bcrates?\b/.test(q), over: { shape: "block", length: 13, width: 13, height: 11, note: "Usual milk crate, 13″ × 13″ × 11″. Type a size to match yours." } },
  { match: (q) => /toilet\s*paper/.test(q), over: { shape: "roll", length: 4.5, diameter: 4.2, note: "Usual toilet paper roll, 4 1/2″ wide. Type a size to match yours." } },
  { match: (q) => /paper\s*towels?/.test(q), over: { shape: "roll", length: 11, diameter: 5.5, note: "Usual paper towel roll, 11″ wide. Type a size to match yours." } },
  { match: (q) => /yoga\s*mat/.test(q), over: { shape: "object", length: 68, width: 24, height: 0.2, note: "Usual yoga mat, 68″ × 24″. Type a size to match yours." } },
  { match: (q) => /bowling\s*pins?/.test(q), over: { shape: "object", length: 15, width: 4.7, height: 4.7, note: "Usual bowling pin, 15″ tall. Type a size to match yours." } },
  { match: (q) => /watering\s+can/.test(q), over: { shape: "bucket", length: 11, diameter: 8, note: "Usual watering can, about 11″ × 8″. Type a size to match yours." } },
  { match: (q) => /ketchup|mustard/.test(q), over: { shape: "bottle", length: 8, diameter: 2.5, note: "Usual squeeze bottle, about 8″ × 2 1/2″. Type a size to match yours." } },
  { match: (q) => /\bbricks?\b/.test(q) && !/lego/.test(q), over: { shape: "block", length: 8, width: 3.75, height: 2.25, note: "Usual brick, 8″ × 3 3/4″ × 2 1/4″. Type a size to match yours." } },
  { match: (q) => /wd-?\s*40|aerosol|spray\s*paint/.test(q), over: { shape: "can", length: 7.75, diameter: 2.6, color: "#f2d23a", note: "Usual aerosol can, 7 3/4″ × 2 5/8″. Type a size to match yours." } },
  { match: (q) => /\b(?:sharpies?|markers?|pens?|pencils?)\b/.test(q), over: { shape: "tool", length: 5.5, diameter: 0.6, color: "#1a1a1a", note: "Usual marker, 5 1/2″ × 5/8″. Type a size to match yours." } },
  { match: (q) => /flashlights?|\btorches\b|lanterns?/.test(q), over: { shape: "tool", length: 6.5, diameter: 1.5, color: "#2a2e33", note: "Usual flashlight, 6 1/2″ × 1 1/2″. Type a size to match yours." } },
  { match: (q) => /tape\s*measures?/.test(q), over: { shape: "roll", length: 1.5, diameter: 3.2, color: "#e0a106", note: "Usual tape measure, 3 3/16″ across and 1 1/2″ thick. Type a size to match yours." } },
  { match: (q) => /extension\s*cords?|\bcords?\b|\bropes?\b|\bhoses?\b/.test(q), over: { shape: "roll", length: 2.5, diameter: 8, color: "#f07a1a", note: "Usual 25 ft coil, about 8″ across. Type a size to match yours." } },
  { match: (q) => /drop\s*cloth|tarp|\bcanvas\b/.test(q), over: { shape: "object", length: 108, width: 144, height: 0.08, color: "#efe8d4", note: "Usual 9×12 ft cloth. Type a size to match yours." } },
  { match: (q) => /saw\s*horses?|sawhorses?/.test(q), over: { shape: "object", length: 36, width: 24, height: 29, color: "#c4a36a", note: "Usual sawhorse, 36″ long and 29″ tall. Type a size to match yours." } },
  { match: (q) => /cat\s*trees?/.test(q), over: { shape: "object", length: 60, width: 20, height: 20, color: "#c8bfb0", note: "Usual cat tree, about 60″ tall. Type a size to match yours." } },
  { match: (q) => /rubber\s*ducks?|\bducks?\b/.test(q), over: { shape: "object", length: 4.2, width: 3.5, height: 3.5, color: "#f2c14e", note: "Usual rubber duck, about 4 3/16″ long. Type a size to match yours." } },
  { match: (q) => /gnomes?/.test(q), over: { shape: "object", length: 12, width: 5, height: 4, color: "#c23b3b", note: "Usual garden gnome, about 12″ tall. Type a size to match yours." } },
  { match: (q) => /sterilite/.test(q) && /\b6\b/.test(q) && /box|bin/.test(q), over: { shape: "block", length: 13.5, width: 8, height: 4.625, color: "#e7eef2", note: "Sterilite 6 qt storage box, 13 1/2″ × 8″ × 4 5/8″. Listing outside size." } },
  { match: (q) => /\b(storage\s+box(?:es)?|storage\s+bins?|latching\s+box(?:es)?)\b/.test(q), over: { shape: "block", length: 13.5, width: 8, height: 4.625, color: "#e7eef2", note: "Usual small storage box, about 13 1/2″ × 8″ × 4 5/8″. Type a size to match yours." } },
  { match: (q) => /igloo/.test(q) && /cooler/.test(q), over: { shape: "block", length: 14.5, width: 10.9, height: 13.91, color: "#d7e4ee", note: "Igloo Latitude 16 qt cooler, 14 1/2″ × 10 7/8″ × 13 15/16″. Listing outside size." } },
  { match: (q) => /\bcoolers?\b/.test(q) && !/wine/.test(q), over: { shape: "block", length: 16, width: 12, height: 13, color: "#d7e4ee", note: "Usual picnic cooler, about 16″ × 12″ × 13″. Type a size to match yours." } },
  { match: (q) => /camelbak/.test(q) && /32/.test(q), over: { shape: "bottle", length: 10.83, diameter: 3.74, color: "#d7e4ee", metalness: 0.45, roughness: 0.28, note: "CamelBak Chute Mag 32 oz stainless, 10 13/16″ × 3 3/4″. Maker size (27.5 × 9.5 cm)." } },
  { match: (q) => /camelbak/.test(q), over: { shape: "bottle", length: 10.83, diameter: 3.74, color: "#d7e4ee", metalness: 0.45, roughness: 0.28, note: "CamelBak Chute Mag, about 10 13/16″ × 3 3/4″. Usual of that bottle, not every CamelBak." } },
  { match: (q) => /channellock/.test(q) && /430/.test(q), over: { shape: "tool", length: 10, width: 2.13, diameter: 0.44, color: "#1d4e89", note: "Channellock 430, 10″ × 2 1/8″ × 7/16″. Maker size." } },
  { match: (q) => /fiskars/.test(q) && /scissors|shears/.test(q), over: { shape: "tool", length: 8, width: 3.2, diameter: 0.4, color: "#f04e23", note: "Fiskars 8″ scissors, 8″ overall. Maker length." } },
  { match: (q) => /\b(scissors|shears)\b/.test(q), over: { shape: "tool", length: 8, width: 3.2, diameter: 0.4, color: "#c45c26", note: "Usual scissors, about 8″ long. Type a size to match yours." } },
  { match: (q) => /iris/.test(q) && /tote|weatherpro/.test(q), over: { shape: "block", length: 17.5, width: 11.75, height: 7.88, color: "#e7eef2", note: "IRIS WeatherPro 19 qt tote, 17 1/2″ × 11 3/4″ × 7 7/8″. Listing outside size." } },
  { match: (q) => /dewalt/.test(q) && /batter/.test(q), over: { shape: "block", length: 9.25, width: 7, height: 3.625, color: "#f5c400", note: "DeWalt DCB205 20V 5.0Ah, 9 1/4″ × 7″ × 3 5/8″. Listing size of one pack." } },
  { match: (q) => /\bbatter(?:y|ies)\b/.test(q), over: { shape: "block", length: 5.2, width: 3.4, height: 2.4, color: "#f5c400", note: "Usual slide battery, about 5 3/16″ × 3 3/8″ × 2 3/8″. Type a size to match yours." } },
  { match: (q) => /ultra-star|discraft/.test(q), over: { shape: "ball", length: 10.75, diameter: 10.75, width: 10.75, height: 1.1, color: "#f4f4f4", note: "Discraft Ultra-Star, 10 3/4″ across. Listing diameter." } },
  { match: (q) => /\b(frisbees?|flying\s+discs?)\b/.test(q) || (/\bdiscs?\b/.test(q) && !/sander|brake/.test(q)), over: { shape: "ball", length: 10.75, diameter: 10.75, width: 10.75, height: 1.1, color: "#f4f4f4", note: "Usual flying disc, about 10 3/4″ across. Type a size to match yours." } },
  { match: (q) => /kwikset/.test(q) && /deadbolt/.test(q), over: { shape: "block", length: 2.5, width: 2.5, height: 1.06, color: "#c5c8cc", metalness: 0.7, roughness: 0.3, note: "Kwikset 660 deadbolt, 2 1/2″ rose and 1 1/16″ projection. Listing size." } },
  { match: (q) => /\bdeadbolts?\b/.test(q), over: { shape: "block", length: 2.5, width: 2.5, height: 1.06, color: "#c5c8cc", metalness: 0.7, roughness: 0.3, note: "Usual deadbolt rose, about 2 1/2″ across and 1″ projection. Type a size to match yours." } },
  { match: (q) => /flamingos?/.test(q), over: { shape: "object", length: 24, width: 16, height: 4, color: "#f4a4c0", note: "Usual lawn flamingo, about 24″ tall and 16″ wide. Type a size to match yours." } },
  { match: (q) => /fastback/.test(q), over: { shape: "tool", length: 7.25, width: 1.3, diameter: 0.9, color: "#c0392b", note: "Milwaukee Fastback utility knife, 7 1/4″ overall. Listing length of the standard press-and-flip." } },
  { match: (q) => /\bknives?\b/.test(q), over: { shape: "tool", length: 7.25, width: 1.3, diameter: 0.9, color: "#c45c26", note: "Usual utility knife, about 7 1/4″ long. Type a size to match yours." } },
  { match: (q) => /clash/.test(q) && /racket/.test(q), over: { shape: "tool", length: 27, width: 10.6, height: 1, diameter: 1, color: "#2c2c2c", note: "Wilson Clash 100, 27″ long, 100 sq in head. Listing length." } },
  { match: (q) => /\brackets?\b/.test(q), over: { shape: "tool", length: 27, width: 10.6, height: 1, diameter: 1, color: "#2c2c2c", note: "Usual adult tennis racket, 27″ long. Type a size to match yours." } },
  { match: (q) => /\bbaseballs?\b/.test(q), over: { shape: "ball", length: 2.9, diameter: 2.9, width: 2.9, color: "#f4f1ea", note: "Official baseball, 9–9¼″ around (about 2 7/8″ across). Type a size to match yours." } },
  { match: (q) => /duplex|receptacle|\boutlets?\b/.test(q), over: { shape: "block", length: 4.5, width: 2.75, height: 1.1, color: "#ece7dc", note: "Usual standard duplex plate, 4 1/2″ × 2 3/4″. Type a size to match yours." } },
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

/**
 * The prompt names build stock ("from 1/4 inch dowels", "popsicle stick", "plywood", "out of scrap"):
 * it is something to make, never a product to buy.
 */
export function namesBuildStock(q: string): boolean {
  const s = q.toLowerCase();
  if (/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/.test(s)) return true;
  if (/\b(?:dowels?|popsicle|craft\s*sticks?|lolly\s*sticks?|tongue\s*depressors?|plywood|lumber|scrap\s*wood|wood\s*scraps?|pvc|cardboard|balsa|toothpicks?|straws?|paper\s*straws?|pallets?|mdf)\b/.test(s)) return true;
  return /\b(?:from|out\s+of|made\s+(?:of|from)|built\s+(?:of|from))\s+(?:\S+\s+){0,3}?(?:wood|boards?|sticks?|stock|scraps?|planks?|slats?)\b/.test(s);
}

/** A listed spec (brand / model row: Dasani, CamelBak, YETI…) — the product itself, whatever else the words suggest. */
export function isSpecProduct(prompt: string): boolean {
  const q = prompt.trim().toLowerCase();
  return SPECS.some((row) => row.match(q));
}

export function isBareProductPrompt(prompt: string): boolean {
  const q = prompt.trim().toLowerCase();
  if (q.length < 3 || (BUILD_NOUN.test(q) && !isSoldStorageBox(q))) return false;
  if (namesBuildStock(q)) return false;
  if (SPECS.some((row) => row.match(q))) return true;
  if (NAMED.some((row) => row.match(q))) return true;
  return shapeOf(q) !== "object";
}

/** A product we have a listing or usual-family size for (cooler, bottle, tote). Unknown nouns are not. */
export function hasProductDrawing(phrase: string): boolean {
  const q = phrase.trim().toLowerCase();
  if (q.length < 3) return false;
  if (/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/.test(q)) return false;
  if (SPECS.some((row) => row.match(q))) return true;
  if (NAMED.some((row) => row.match(q))) return true;
  return shapeOf(q) !== "object";
}

/** An inch length they already own beats the listing and the usual size. */
function applyTypedLength(query: string, env: Envelope): Envelope {
  // A size naming the stock ("from 1/4 inch dowels", "3/4 in plywood") is the stock, not the piece.
  const hay = query.replace(new RegExp(String.raw`(?<![\w/])${INCH_NUM}\s*-?\s*(?:in|inch|inches|"|″)?\s*(?:dowels?|plywood|ply|boards?|sticks?|rods?|pipes?|lumber|mdf|skewers?)\b`, "gi"), " ");
  const said = hay.match(new RegExp(String.raw`(?<![\w/.])(${INCH_NUM})\s*-?\s*(?:in|inch|inches|"|″)(?=\W|$)`, "i"));
  if (!said) return env;
  const n = parseInchNum(said[1]);
  if (!Number.isFinite(n) || n < 0.5 || n > 120) return env;
  if (Math.abs(n - env.length) < 0.05) return env;
  return { ...env, length: n, note: `Size you typed, ${n}″. The piece stays this shape.` };
}

/** The piece this name is, at a published size or the usual size of its family. */
export function productEnvelope(query: string): Envelope | null {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  if (/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b/i.test(q)) return null;
  const spec = SPECS.find((row) => row.match(q));
  if (spec) {
    const { match: _match, ...env } = spec;
    return applyTypedLength(q, env);
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
    env.note = "20 lb propane tank, about 18\u2033 tall and 12 3/16\u2033 across. Usual cylinder — type a size to match yours.";
  }
  return applyTypedLength(q, env);
}

export function modeledProduct(query: string): CatalogItem | null {
  const env = productEnvelope(query);
  if (!env) return null;
  return pieceFromEnvelope(env, env.length, env.diameter, env.note, [query.trim(), env.name]);
}

/**
 * Product notes read like the rest of the plan: shop fractions, positive wording. "10.83″" → "10 13/16″";
 * "Not this tool’s drawing." → what the size is instead.
 */
export function plainProductNote(note: string): string {
  return note
    .replace(/(\d+\.\d+)\s*(″|"|-?inch(?:es)?\b|in\b)/g, (_m, n: string, u: string) => `${inchFrac(parseFloat(n))}${u}`)
    .replace(/\s*Not this [^.]*?(?:drawing|stamp)\./g, " Usual size for its kind — type a size to match yours.")
    .replace(/\s*Rule size, not this [^.]*?(?:drawing|stamp)\./g, " Rule size.")
    .replace(/,?\s*not a drawing\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
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
    notes: plainProductNote(note),
  };
}
