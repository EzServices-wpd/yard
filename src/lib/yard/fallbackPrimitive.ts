/**
 * Honest fallback: when no dedicated builder owns a typed noun and no stock is
 * typed, the noun's head word picks the nearest simple primitive (table on legs,
 * carcase box, open box, wall shelf, slab panel) at a real size for its class.
 * Universal by word class, so any new noun with a known head word lands well.
 */
import type { YardProject } from "./types";

type Prim = { phrase: string; label: string; size: [number, number, number] };

const DESKTOP = /\b(laptop|monitor|phone|tablet|keyboard|book|speaker)\b/;
const PET = /\b(dog|cat|rabbit|bunny|guinea|chicken|hen|duck|goat|pet|puppy)\b/;
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
  const words = lower.split(/\s+/);
  const head = (words[words.length - 1] ?? "").replace(/([^si])s$/, "$1");
  const whole = lower.replace(/\s+/g, "");
  if (/(stand|bar|counter|booth|kiosk|cart|riser|desk|station)$/.test(head)) {
    if (DESKTOP.test(lower)) return prim("table", "platform on legs", 16, 5, 10);
    return prim("table", "counter on legs", 48, 42, 24);
  }
  if (/birdhouse|bird house|nest ?box/.test(whole)) return null;
  // Bed-class head words beat figure / toy early exits: a doll bed is a small platform bed.
  if (BED_HEAD.test(head) || /bedframe|bassinet/.test(whole)) {
    if (TOY.test(lower)) return prim("planter box", "open box", 14, 5, 10);
  }
  if (TOY.test(lower)) return null;
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
  const name = (project.name ?? "").toLowerCase().replace(/\s+/g, "");
  const words = lower.split(/\s+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ""));
  if (/^storageunit/.test(name) || /^(figure|bird|frame)$/.test(name)) return true;
  return !words.some((w) => name.includes(w));
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
