/**
 * Honest fallback: when no dedicated builder owns a typed noun and no stock is
 * typed, the noun's head word picks the nearest simple primitive (table on legs,
 * carcase box, open box, wall shelf, slab panel) at a real size for its class.
 * Universal by word class, so any new noun with a known head word lands well.
 */
import type { YardProject } from "./types";

type Prim = { phrase: string; label: string; size: [number, number, number] };

const DESKTOP = /\b(laptop|monitor|phone|tablet|keyboard|book|speaker)\b/;
/** Animal words that make a pet context. Small animals live in hutches, cages and coops. */
export const SMALL_PET = String.raw`rabbits?|bunn(?:y|ies)|guinea\s+pigs?|hamsters?|gerbils?|ferrets?|chinchillas?|rats?|mice|chickens?|hens?|ducks?|quails?|tortoises?`;
export const PET_ANIMAL = new RegExp(String.raw`\b(?:dogs?|cats?|pets?|pupp(?:y|ies)|kittens?|kitty|goats?|${SMALL_PET})\b`);
const PET = PET_ANIMAL;
/** An animal's feeding surface ("cat feeding station", "dog bowl table") stands at the animal's scale. */
const PET_SURFACE = new RegExp(
  String.raw`${PET_ANIMAL.source}\s+(?:(?:feeding|food|water|bowls?|feeder|dish|dinner|eating|drinking)\s+)*(?:stands?|stations?|tables?|counters?|risers?|bars?)\b`,
);
/** Top height for a pet surface: about 6" for a cat or rabbit, 8" for a small dog, 12" for a dog, 18" for a large dog. */
export function petSurfaceHeight(noun: string): number | null {
  const lower = noun.toLowerCase();
  if (!PET_SURFACE.test(lower)) return null;
  if (/\b(?:large|big|giant|tall|great\s+dane|mastiff|shepherd|lab(?:rador)?)\b/.test(lower)) return 18;
  if (/\b(?:small|little|toy|mini)\s+dogs?\b|pupp/.test(lower)) return 8;
  if (/\b(?:dogs?|goats?)\b/.test(lower)) return 12;
  return 6;
}
const TOY = /\b(doll|toy|barbie|mini|miniature|fairy)\b/;
const FLOOR_RACK = /\b(firewood|wood|log|shoe|boot|wine|bike|lumber|kayak|surfboard|canoe|paddle|ski)\b/;

function prim(phrase: string, label: string, w: number, h: number, d: number): Prim {
  return { phrase, label, size: [w, h, d] };
}

/** Bed / crib / bassinet head words — furniture, never a figure armature. */
const BED_HEAD = /^(?:bed|bedframe|crib|bassinet|cot|cradle)$/;

/** Toy-scale bed-class noun: doll/toy/barbie bed, crib, bassinet, etc. */
export function isToyScaleBed(noun: string): boolean {
  const lower = noun.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const head = (words[words.length - 1] ?? "").replace(/([^si])s$/, "$1");
  const whole = lower.replace(/\s+/g, "");
  if (!BED_HEAD.test(head) && !/bedframe|bassinet/.test(whole)) return false;
  return TOY.test(lower);
}

export function pickPrimitive(noun: string): Prim | null {
  const lower = noun.toLowerCase().trim();
  // The head noun is the last word before any prepositional tail ("ramp for the couch" → ramp).
  const words = lower.split(/\s+(?:for|to|with|in|on|from|of|by|under|over|near|that|which)\s+/)[0].split(/\s+/);
  const head = (words[words.length - 1] ?? "").replace(/([^si])s$/, "$1");
  const whole = lower.replace(/\s+/g, "");
  const pet = petSurfaceHeight(lower);
  if (pet) return prim("table", "stand on legs at pet height", 24, pet, 12);
  if (/(stand|bar|counter|booth|kiosk|cart|riser|desk|station)$/.test(head)) {
    if (DESKTOP.test(lower)) return prim("table", "platform on legs", 16, 5, 10);
    return prim("table", "counter on legs", 48, 42, 24);
  }
  if (/birdhouse|bird house|nest ?box/.test(whole)) return null;
  // Bed-class head words beat figure / toy early exits: a doll bed is a small platform bed.
  if (BED_HEAD.test(head) || /bedframe|bassinet/.test(whole)) {
    // A small bed frame — legs, side rails and a slatted deck — not an open planter box of loose sticks.
    if (TOY.test(lower)) return prim("platform bed", "bed frame on legs", 4.5, 2.5, 3.5);
  }
  if (TOY.test(lower)) return null;
  // A head that names a tower (lighthouse) is that tower, not a house-shaped carcase.
  if (/lighthouse|tower|steeple|minaret|windmill/.test(head)) return null;
  if (/(hutch|coop|kennel|house|cabinet|theater|theatre|shed|cupboard|locker)$/.test(head)) {
    if (/playhouse/.test(whole)) return prim("cabinet", "carcase box", 48, 60, 48);
    if (TOY.test(lower) || /dollhouse/.test(whole)) return prim("cabinet", "carcase box", 30, 30, 14);
    if (PET.test(lower) || /doghouse|cathouse|henhouse/.test(whole)) return prim("cabinet", "carcase box", 48, 36, 24);
    if (/theat/.test(head)) return prim("cabinet", "carcase box", 36, 48, 12);
    return prim("cabinet", "carcase box", 36, 36, 18);
  }
  if (/(box|chest|crate|bin|feeder|trough|bed|tub|crib|bassinet|cot|cradle)$/.test(head)) {
    if (/sandbox|bed$/.test(whole)) return prim("planter box", "open box", 48, 10, 48);
    if (/feeder|mailbox/.test(whole)) return prim("planter box", "open box", 10, 10, 8);
    if (/toolbox/.test(whole)) return prim("planter box", "open box", 20, 8, 10);
    if (/crate/.test(head)) return prim("planter box", "open box", 14, 12, 14);
    if (BED_HEAD.test(head)) return prim("planter box", "open box", 48, 10, 48);
    return prim("planter box", "open box", 24, 16, 16);
  }
  if (/(tray|mat)$/.test(head)) return prim("planter box", "shallow tray", 30, 2, 15);
  // A coaster or trivet is a small shallow tray: a floor of sticks side by side inside a low rim.
  if (/^(?:coaster|trivet)$/.test(head)) return head === "coaster" ? prim("planter box", "shallow tray", 4, 0.5, 4) : prim("planter box", "shallow tray", 7, 0.75, 7);
  if (/(rack|ladder|rail|holder|hanger|organizer)$/.test(head)) {
    if (FLOOR_RACK.test(lower) || /ladder/.test(head)) return prim("storage unit", "open frame", 48, 48, 16);
    return prim("wall shelf", "wall-hung shelf", 24, 12, 6);
  }
  if (/(board|game)$/.test(head)) return prim("table", "platform on legs", 24, 4, 48);
  if (/(sign|trellis|panel|backboard|target)$/.test(head)) {
    if (/trellis/.test(head)) return prim("sign", "panel", 24, 48, 1);
    return prim("sign", "panel", 24, 48, 1);
  }
  return null;
}

/** True when the built model is a fallback: popsicle with no stock typed, or a name sharing no word with the noun. */
export function looksLikeFallback(project: YardProject, noun: string): boolean {
  const lower = noun.toLowerCase();
  // Toy-scale beds remap when figure/humanoid stole them, or when the build is full-size mattress geography.
  if (isToyScaleBed(noun)) {
    const o = project.overall;
    const figure =
      project.kind === "figure" ||
      project.shape?.classId === "humanoid" ||
      /^(figure|animal)$/i.test(project.name ?? "");
    if (figure) return true;
    const roleBlob = [
      ...project.panels.map((p) => p.name),
      ...(project.instances ?? []).map((i) => i.role ?? ""),
    ].join(" ");
    if (/\b(?:arm|torso|head|shin|thigh|forearm)\b/i.test(roleBlob)) return true;
    const smallBed =
      o.height <= 12 &&
      Math.max(o.width, o.depth) <= 24 &&
      o.height <= Math.max(o.width, o.depth) * 0.75;
    return !smallBed;
  }
  // Toy-scale nouns keep craft stock; remapping them to plywood is the honesty bug.
  if (TOY.test(lower)) return false;
  if (/popsicle/.test(project.primaryMaterialId ?? "")) return true;
  // A body with no class (lies along its long axis) is the fallback a known head noun replaces.
  if (project.unmatched) return true;
  const name = (project.name ?? "").toLowerCase().replace(/\s+/g, "");
  // The head noun counts at any length ("queen bed" built as a Platform bed is the bed asked for).
  const all = lower.split(/\s+/);
  const words = all.filter((w, i) => w.length >= 4 || (i === all.length - 1 && w.length >= 3)).map((w) => w.replace(/s$/, ""));
  if (/^storageunit/.test(name) || /^(figure|bird|frame)$/.test(name)) return true;
  return !words.some((w) => name.includes(w));
}

/**
 * Notes of a build remapped to a primitive speak for the typed noun: the primitive's own name becomes the
 * title, and what only that primitive does (soil, drainage, a liner) is dropped unless the noun is a planter.
 */
export function primitiveNotes(notes: string[], p: Prim, title: string, noun: string): string[] {
  const keepSoil = /plant|garden|soil|flower/i.test(noun);
  const name = p.phrase.charAt(0).toUpperCase() + p.phrase.slice(1);
  return notes
    .map((n) =>
      n
        .replace(new RegExp(`^${name}\\b`), title)
        .split(/(?<=\.)\s+/)
        .filter((s) => keepSoil || !/\bsoil\b|planting|drainage|landscape-fabric|\bliner\b|planter box|\bcedar\b|exterior screws/i.test(s))
        .join(" ")
        .trim(),
    )
    .filter((n) => n.trim());
}

/**
 * Every build's notes say what it is: a "not a skeleton, not a cube" sentence or clause argues with a recipe
 * the person never asked for, so it is dropped, and the spacing left behind is closed up.
 */
export function tidyNotes(notes: string[]): string[] {
  return notes
    .map((n) =>
      n
        .split(/(?<=\.)\s+/)
        .filter((s) => !/^Not an? [\w-]+(?: [\w-]+)* skeleton\b/i.test(s.trim()))
        .join(" ")
        .replace(/,\s*not an? [^,.]*?\bskeleton\b(?:\s+and not [^.]*?)?(?=\.)/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export function fallbackNote(noun: string, label: string): string {
  return `Yard built a ${noun} as a simple ${label} sized for it. Change any size in Measure.`;
}

export function primitivePrompt(p: Prim, prompt: string): string {
  const pick = (re: RegExp, d: number) => {
    const m = prompt.match(re);
    return m ? Number(m[1]) : d;
  };
  const w = pick(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*wide/i, p.size[0]);
  const h = pick(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:tall|high)/i, p.size[1]);
  const d = pick(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*deep/i, p.size[2]);
  return `${p.phrase} ${w} wide ${h} tall ${d} deep`;
}
