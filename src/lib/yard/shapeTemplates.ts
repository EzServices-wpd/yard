/**
 * Subject-class shape templates — one registry of form classes shared by every stock.
 *
 * A form class owns named parametric parts (body, head, snout, ear, tail, leg…) and a
 * proportion profile per subject (dog ≠ horse ≠ dachshund ≠ cat). The part model is
 * stock-free and deterministic. materializeShape() turns it into the real build:
 *   • thin craft stock (popsicle / jumbo / mini sticks, skewers, straws, dowels):
 *     slatted boxes for body / head / snout, paired members for legs, whole sticks
 *     snapped to whole-stick runs (craft stock stays whole),
 *   • fat linear stock (2x4, 1x4, PVC): glue-laminated blocks, legs and ears screwed to the sides,
 *   • sheet stock (plywood, cardboard): one side profile (head, snout, ears, tail) plus four legs.
 * The same subject keeps the same silhouette signature in every stock — only stock and joinery change.
 * Steps, Voice, PDF, cut list and Buy read the materialized model (single source).
 */

import { createId } from "@/lib/utils";
import { toPrimitive } from "./geometry";
import type { StructureEdge, StructureGraph, StructureNode } from "./structureGraph";
import type { CatalogItem, Panel, Vec3, YardProject } from "./types";

export type ShapePartName = "body" | "neck" | "head" | "snout" | "ear" | "tail" | "leg" | "mane";

export type ShapePart = {
  id: string;
  name: ShapePartName;
  kind: "box" | "rod";
  /** box: center, length (along u), height (along v), width (z), pitch about z (rad, + = front up). */
  c: Vec3;
  l: number;
  h: number;
  w: number;
  pitch: number;
  /** rod: attach end → free end; t = in-plane thickness, w = z thickness. */
  a?: Vec3;
  b?: Vec3;
  t?: number;
  /** Parent part id — the part this one is glued / screwed onto. */
  attach?: string;
  /** Side-mounted parts (legs, ears) sit outboard of the parent's side faces. */
  side?: -1 | 0 | 1;
};

export type ShapeModel = {
  classId: FormClassId;
  subject: string;
  label: string;
  pose: "stand" | "sit";
  parts: ShapePart[];
  bodyLength: number;
};

export type FormClassId = "quadruped";

export type ShapeSummary = {
  classId: FormClassId;
  subject: string;
  pose: "stand" | "sit";
  bodyLength: number;
  parts: { name: ShapePartName; count: number }[];
};

type QuadProfile = {
  subject: string;
  label: string;
  /** Torso height / length (dog ≈ 1.6:1, dachshund ≈ 3:1). */
  torsoH: number;
  torsoW: number;
  legL: number;
  legT: number;
  neckL: number;
  neckDeg: number;
  neckT: number;
  headL: number;
  headH: number;
  headW: number;
  headPitch: number;
  snoutL: number;
  snoutH: number;
  snoutW: number;
  earL: number;
  /** 0 = straight up, 90 = sideways back, 160 = hanging down the side of the head. */
  earDeg: number;
  tailL: number;
  /** Angle above horizontal pointing back (negative hangs). */
  tailDeg: number;
  tailCurl?: number;
  mane?: boolean;
  /** Relative size vs a dog in the same stock. */
  scale: number;
  pose?: "stand" | "sit";
};

const DOG: QuadProfile = {
  subject: "dog", label: "Dog",
  torsoH: 0.6, torsoW: 0.34, legL: 0.46, legT: 0.1,
  neckL: 0.26, neckDeg: 32, neckT: 0.18,
  headL: 0.36, headH: 0.3, headW: 0.3, headPitch: 0,
  snoutL: 0.2, snoutH: 0.15, snoutW: 0.18,
  earL: 0.15, earDeg: 12,
  tailL: 0.36, tailDeg: 38,
  scale: 1,
};

const PROFILES: { re: RegExp; p: QuadProfile }[] = [
  { re: /dachshund|wiener\s*dog|weiner\s*dog|sausage\s*dog|doxie/, p: { ...DOG, subject: "dachshund", label: "Dachshund", torsoH: 0.33, torsoW: 0.24, legL: 0.16, legT: 0.08, neckL: 0.2, neckDeg: 30, neckT: 0.14, headL: 0.26, headH: 0.2, headW: 0.2, snoutL: 0.18, snoutH: 0.1, snoutW: 0.12, earL: 0.14, earDeg: 160, tailL: 0.3, tailDeg: 22, scale: 1.05 } },
  { re: /\bpupp(?:y|ies)\b|\bpup\b/, p: { ...DOG, subject: "puppy", label: "Puppy", torsoH: 0.62, legL: 0.4, headL: 0.4, headH: 0.36, headW: 0.34, snoutL: 0.14, earL: 0.16, earDeg: 150, tailL: 0.24, scale: 0.75 } },
  { re: /\bpon(?:y|ies)\b/, p: horse("pony", "Pony", { legL: 0.5, neckL: 0.4, scale: 1.1 }) },
  { re: /\bdonkeys?\b|\bburros?\b|\bmules?\b/, p: horse("donkey", "Donkey", { legL: 0.52, earL: 0.2, mane: true, scale: 1.15 }) },
  { re: /\bzebras?\b/, p: horse("zebra", "Zebra", { mane: true }) },
  { re: /\bdeer\b|\bfawn\b|\breindeer\b|\belk\b/, p: horse("deer", "Deer", { torsoH: 0.42, legL: 0.7, neckL: 0.42, mane: false, tailL: 0.12, tailDeg: 40, earDeg: 60, scale: 1.1 }) },
  { re: /\bhorses?\b|\bstallion\b|\bmare\b|\bfoal\b|\bcolt\b/, p: horse("horse", "Horse", {}) },
  { re: /\bcows?\b|\bbulls?\b|\box\b|\boxen\b|\bcattle\b|\bcalf\b/, p: { ...DOG, subject: "cow", label: "Cow", torsoH: 0.55, torsoW: 0.4, legL: 0.48, legT: 0.11, neckL: 0.24, neckDeg: 18, neckT: 0.24, headL: 0.34, headH: 0.22, headW: 0.22, headPitch: -35, snoutL: 0.1, snoutH: 0.16, snoutW: 0.2, earL: 0.12, earDeg: 95, tailL: 0.45, tailDeg: -70, scale: 1.4 } },
  { re: /\bpigs?\b|\bpiglets?\b|\bhogs?\b|\bboars?\b/, p: { ...DOG, subject: "pig", label: "Pig", torsoH: 0.58, torsoW: 0.46, legL: 0.24, legT: 0.11, neckL: 0.1, neckDeg: 15, neckT: 0.3, headL: 0.3, headH: 0.32, headW: 0.34, snoutL: 0.12, snoutH: 0.15, snoutW: 0.18, earL: 0.13, earDeg: 40, tailL: 0.14, tailDeg: 45, scale: 1 } },
  { re: /\bsheep\b|\blambs?\b|\bgoats?\b|\brams?\b/, p: { ...DOG, subject: "sheep", label: "Sheep", torsoH: 0.58, torsoW: 0.44, legL: 0.42, legT: 0.09, neckL: 0.2, neckDeg: 38, neckT: 0.2, headL: 0.3, headH: 0.22, headW: 0.2, headPitch: -20, snoutL: 0.1, snoutH: 0.14, snoutW: 0.14, earL: 0.12, earDeg: 95, tailL: 0.12, tailDeg: -40, scale: 1.05 } },
  { re: /\blions?\b|\btigers?\b|\bleopards?\b|\bcheetahs?\b|\bpanthers?\b|\bjaguars?\b/, p: { ...DOG, subject: "lion", label: "Big cat", torsoH: 0.52, torsoW: 0.34, legL: 0.44, neckL: 0.2, neckDeg: 25, neckT: 0.24, headL: 0.34, headH: 0.32, headW: 0.34, snoutL: 0.12, snoutH: 0.16, earL: 0.1, earDeg: 10, tailL: 0.6, tailDeg: -20, tailCurl: 60, scale: 1.3 } },
  { re: /\bbears?\b/, p: { ...DOG, subject: "bear", label: "Bear", torsoH: 0.62, torsoW: 0.44, legL: 0.36, legT: 0.14, neckL: 0.14, neckDeg: 18, neckT: 0.3, headL: 0.32, headH: 0.3, headW: 0.32, snoutL: 0.16, snoutH: 0.15, snoutW: 0.16, earL: 0.09, earDeg: 10, tailL: 0.08, tailDeg: 20, scale: 1.3 } },
  { re: /\bwol(?:f|ves)\b|\bfox(?:es)?\b|\bcoyotes?\b/, p: { ...DOG, subject: "wolf", label: "Wolf", torsoH: 0.52, legL: 0.5, snoutL: 0.24, snoutH: 0.13, earL: 0.17, earDeg: 5, tailL: 0.46, tailDeg: -25 } },
  { re: /\bcats?\b|\bkittens?\b|\bkitty\b|\bkitties\b/, p: { ...DOG, subject: "cat", label: "Cat", torsoH: 0.5, torsoW: 0.3, legL: 0.42, legT: 0.08, neckL: 0.12, neckDeg: 35, neckT: 0.18, headL: 0.28, headH: 0.28, headW: 0.3, snoutL: 0.07, snoutH: 0.11, snoutW: 0.14, earL: 0.13, earDeg: 0, tailL: 0.42, tailDeg: 55, tailCurl: 35, scale: 0.8 } },
  { re: /\bdogs?\b|\bdoggy\b|\bdoggie\b|\bhounds?\b|\bretrievers?\b|\blabrador\b|\bterriers?\b|\bpoodles?\b|\bbeagles?\b|\bcorgis?\b|\bshepherd\s+dog\b/, p: DOG },
  { re: /\bquadruped\b|\banimals?\b|\bcreature\b/, p: { ...DOG, subject: "animal", label: "Animal" } },
];

function horse(subject: string, label: string, over: Partial<QuadProfile>): QuadProfile {
  return {
    subject, label,
    torsoH: 0.45, torsoW: 0.3, legL: 0.64, legT: 0.08,
    neckL: 0.46, neckDeg: 48, neckT: 0.18,
    headL: 0.42, headH: 0.17, headW: 0.16, headPitch: -58,
    snoutL: 0.12, snoutH: 0.14, snoutW: 0.13,
    earL: 0.1, earDeg: 8,
    tailL: 0.42, tailDeg: -62,
    mane: true,
    scale: 1.35,
    ...over,
  };
}

/** Things that carry an animal word but are not the animal (dog house, sawhorse, cat tree…). */
const NOT_THE_ANIMAL =
  /dog\s*-?\s*(?:house|crate|kennel|bed|bowl|feeder|ramp|gate|stairs?|steps?|leash|run|door|pen|toy)|dog-?house|(?:cat|kitty)\s*-?\s*(?:tree|condo|tower|scratch\w*|shelf|shelves|bed|house|door|litter|feeder|climb\w*|perch|hammock|walk\w*)|litter\s*box|saw\s*-?\s*horses?|horse\s*-?\s*shoes?|horseshoes?|rocking\s*horse|hobby\s*horse|pommel\s*horse|clothes\s*horse|horse\s*(?:trailer|stall|barn|fence|jump)|bird\s*house|birdhouse|chicken\s*coop|rabbit\s*hutch|pig\s*pen|cow\s*shed|bear\s*box|teddy\s*bear\s*(?:shelf|chair)|lion\s*gate|(?:dog|cat|horse|pig|cow|sheep|animal)\s*(?:shaped\s+)?(?:shelf|shelves|bench|table|stool|chair|planter|sign|coat\s*rack|hook|rack)/;

const SIT = /\bsitting\b|\bsits\b|\bseated\b|\bsit\b/;

export function quadrupedProfile(prompt: string): QuadProfile | null {
  const lower = prompt.toLowerCase();
  if (NOT_THE_ANIMAL.test(lower)) return null;
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? looks[1] : lower;
  for (const { re, p } of PROFILES) {
    if (re.test(hay)) {
      const pose: "stand" | "sit" = SIT.test(lower) && /cat|kitten|kitty|dog|pupp|pup|wolf|fox|lion|tiger/.test(p.subject + " " + lower) ? "sit" : "stand";
      return { ...p, pose };
    }
  }
  return null;
}

export type FormClass = {
  id: FormClassId;
  label: string;
  required: ShapePartName[];
  /** Standing side view must be longer than tall. */
  sideLongerThanTall: (m: ShapeModel) => boolean;
  detect: (prompt: string) => QuadProfile | null;
  build: (profile: QuadProfile, bodyLength: number) => ShapeModel;
};

export const FORM_CLASSES: FormClass[] = [
  {
    id: "quadruped",
    label: "Four-legged animal",
    required: ["body", "head", "snout", "ear", "tail", "leg"],
    sideLongerThanTall: (m) => m.pose === "stand",
    detect: quadrupedProfile,
    build: buildQuadruped,
  },
];

export function detectShapeClass(prompt: string): { cls: FormClass; profile: QuadProfile } | null {
  for (const cls of FORM_CLASSES) {
    const profile = cls.detect(prompt);
    if (profile) return { cls, profile };
  }
  return null;
}

// ---------------------------------------------------------------- geometry helpers

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const rad = (d: number) => (d * Math.PI) / 180;
const dirXY = (deg: number) => v3(Math.cos(rad(deg)), Math.sin(rad(deg)), 0);

export function boxFrame(p: Pick<ShapePart, "pitch">) {
  const c = Math.cos(p.pitch);
  const s = Math.sin(p.pitch);
  return { u: v3(c, s, 0), v: v3(-s, c, 0), z: v3(0, 0, 1) };
}

function boxPoint(p: ShapePart, a: number, b: number, zz = 0): Vec3 {
  const { u, v } = boxFrame(p);
  return add(add(add(p.c, mul(u, a)), mul(v, b)), v3(0, 0, zz));
}

function box(name: ShapePartName, c: Vec3, l: number, h: number, w: number, pitchDeg: number, attach?: string): ShapePart {
  return { id: createId(name), name, kind: "box", c, l, h, w, pitch: rad(pitchDeg), attach };
}

function rod(name: ShapePartName, a: Vec3, b: Vec3, t: number, w: number, attach?: string, side: -1 | 0 | 1 = 0): ShapePart {
  const c = mul(add(a, b), 0.5);
  const d = sub(b, a);
  return { id: createId(name), name, kind: "rod", c, l: len(d), h: t, w, pitch: Math.atan2(d.y, d.x), a, b, t, attach, side };
}

// ---------------------------------------------------------------- quadruped

export function buildQuadruped(pr: QuadProfile, BL: number): ShapeModel {
  const k = (f: number) => f * BL;
  const H = k(pr.torsoH);
  const W = k(pr.torsoW);
  const legL = k(pr.legL);
  const legT = k(pr.legT);
  const sit = pr.pose === "sit";
  const parts: ShapePart[] = [];
  // Torso: standing = level on four legs; sitting = pitched up on the haunches.
  const torsoPitch = sit ? 38 : 0;
  const lift = sit ? legT * 1.2 : legL;
  let torso: ShapePart;
  if (!sit) {
    torso = box("body", v3(0, lift + H / 2, 0), BL, H, W, 0);
  } else {
    const p = rad(torsoPitch);
    // Rear-bottom corner rests on the folded hind legs.
    const rear = v3(-BL * 0.35, lift, 0);
    const c = add(rear, add(mul(v3(Math.cos(p), Math.sin(p), 0), BL / 2), mul(v3(-Math.sin(p), Math.cos(p), 0), H / 2)));
    torso = box("body", c, BL, H, W, torsoPitch);
  }
  parts.push(torso);

  // Legs: glued / screwed to the outside of the body sides; the upper half is the glue lap.
  const inset = legT * 0.5 + BL * 0.06;
  const legW = Math.min(legT, W * 0.6);
  for (const zs of [-1, 1] as const) {
    const zz = zs * W / 2;
    if (!sit) {
      for (const xf of [BL / 2 - inset, -BL / 2 + inset]) {
        const top = boxPoint(torso, xf, 0, zz);
        parts.push(rod("leg", top, v3(top.x, 0, zz), legT, legW, torso.id, zs));
      }
    } else {
      // Front legs straight down from the chest; hind legs folded along the ground (haunch).
      const chest = boxPoint(torso, BL / 2 - inset, -H / 2 + legT, zz);
      parts.push(rod("leg", chest, v3(chest.x, 0, zz), legT, legW, torso.id, zs));
      const hip = boxPoint(torso, -BL / 2 + inset * 1.4, -H / 2 + legT, zz);
      parts.push(rod("leg", v3(hip.x, legT / 2, zz), v3(hip.x + legL * 0.9, legT / 2, zz), legT, legW, torso.id, zs));
    }
  }

  // Neck from the front-top of the body, about 30° up for a dog, steeper and longer for a horse.
  const neckT = k(pr.neckT);
  const neckDeg = pr.neckDeg + (sit ? torsoPitch * 0.6 : 0);
  const n0 = boxPoint(torso, BL / 2 - neckT * 0.55, H / 2 - neckT * 0.45);
  const nd = dirXY(neckDeg);
  const n1 = add(n0, mul(nd, k(pr.neckL)));
  const neck = rod("neck", n0, n1, neckT, Math.min(W, k(pr.headW)) * 0.92, torso.id);
  parts.push(neck);

  // Head sits on the end of the neck; snout projects forward from the lower front.
  const hL = k(pr.headL);
  const hH = k(pr.headH);
  const hW = k(pr.headW);
  const hp = rad(pr.headPitch);
  const hu = v3(Math.cos(hp), Math.sin(hp), 0);
  const hv = v3(-Math.sin(hp), Math.cos(hp), 0);
  const hc = add(n1, add(mul(hu, hL / 2 - neckT * 0.45), mul(hv, hH / 2 - neckT * 0.35)));
  const head = box("head", hc, hL, hH, hW, pr.headPitch, neck.id);
  parts.push(head);
  const sL = k(pr.snoutL);
  const sH = k(pr.snoutH);
  const snout = box("snout", add(hc, add(mul(hu, hL / 2 + sL / 2), mul(hv, -(hH / 2 - sH / 2)))), sL, sH, k(pr.snoutW), pr.headPitch, head.id);
  parts.push(snout);

  // Two ears on the back of the head: up, swept back, or hanging down the sides.
  const earL = k(pr.earL);
  const earT = Math.max(hL * 0.22, legT * 0.7);
  for (const zs of [-1, 1] as const) {
    const hang = pr.earDeg > 90;
    const base = boxPoint(head, -hL * 0.18, hang ? hH * 0.42 : hH / 2 - earT * 0.2, zs * hW / 2);
    const e = rad(pr.earDeg);
    const d = add(mul(hv, Math.cos(e)), mul(hu, -Math.sin(e)));
    parts.push(rod("ear", base, add(base, mul(d, earL)), earT, earT * 0.35, head.id, zs));
  }

  // Tail from the back-top of the body.
  const tailT = Math.max(legT * 0.7, BL * 0.05);
  const t0 = boxPoint(torso, -BL / 2 + tailT * 0.5, H / 2 - tailT * 0.6);
  const tDeg = 180 - pr.tailDeg - (sit ? -torsoPitch : 0);
  let tEnd = add(t0, mul(dirXY(sit ? 190 : tDeg), k(pr.tailL) * (pr.tailCurl ? 0.55 : 1)));
  if (sit) tEnd = v3(tEnd.x, Math.max(tailT / 2, tEnd.y), 0);
  const tail = rod("tail", t0, tEnd, tailT, tailT, torso.id);
  parts.push(tail);
  if (pr.tailCurl) {
    const d2 = dirXY(sit ? 150 : 180 - pr.tailDeg - pr.tailCurl);
    parts.push(rod("tail", tEnd, add(tEnd, mul(d2, k(pr.tailL) * 0.45)), tailT, tailT, tail.id));
  }

  // Mane along the top edge of the neck (horse class).
  if (pr.mane) {
    const nn = v3(-nd.y, nd.x, 0);
    const off = mul(nn, neckT * 0.5 + neckT * 0.15);
    parts.push(rod("mane", add(add(n0, mul(nd, k(pr.neckL) * 0.12)), off), add(n1, off), neckT * 0.3, neck.w, neck.id));
  }

  return { classId: "quadruped", subject: pr.subject, label: pr.label, pose: sit ? "sit" : "stand", parts, bodyLength: BL };
}

// ---------------------------------------------------------------- stock scale

export function shapeLap(item: CatalogItem): number {
  const prim = toPrimitive(item);
  const stock = Math.max(0.5, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.08);
  return Math.min(stock * 0.08, Math.max(thick * 2.2, 0.18));
}

type StockClass = "thin" | "fat" | "sheet";

export function shapeStockClass(item: CatalogItem): StockClass {
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") return "sheet";
  const prim = toPrimitive(item);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2);
  if (thick >= 1.35 || item.formFactor === "pipe" || item.category === "lumber") return "fat";
  return "thin";
}

/** Body length in inches for this stock — a stick dog is tabletop, a 2x4 dog is porch size. */
export function defaultBodyLength(item: CatalogItem, profile: QuadProfile, whole: boolean): number {
  const cls = shapeStockClass(item);
  const prim = toPrimitive(item);
  const S = Math.max(0.5, prim.length);
  if (cls === "sheet") return 20 * profile.scale;
  if (cls === "fat") return 24 * profile.scale;
  if (whole) {
    // Whole craft sticks: the torso height lands on whole-stick runs (1–3 sticks tall).
    const lap = shapeLap(item);
    const run = (n: number) => n * S - (n - 1) * lap;
    // Long whole stock (skewers ≥ 12"): size to about 3 sticks of body length; short
    // parts (ears, snout) still get one whole stick that laps into their parent.
    const target = Math.min(S > 8 ? S * 3.4 : 24, Math.max(7, S * 3.2)) * profile.scale;
    // Every box must survive whole-stick snapping without swelling past ~35% (a cat's head stays a head).
    const swell = (bl: number) => {
      const m = buildQuadruped(profile, bl);
      let worst = 1;
      for (const p of m.parts) {
        if (p.kind !== "box" || p.name === "snout") continue;
        const vertical = p.h >= S * 0.8 || p.h >= p.l;
        const dim = vertical ? p.h : p.l;
        const r = runNearest(dim, S, lap) / dim;
        worst = Math.max(worst, r, 1 / r);
      }
      return worst;
    };
    let best = -1;
    let bestScore = Infinity;
    for (let n = 1; n <= 4; n++) {
      const bl = run(n) / profile.torsoH;
      // Long craft stock (12" skewers) cannot quantize small parts; the target size wins there.
      const sw = S > 8 ? 1 : swell(bl);
      // Too-big bodies are refused (> 2× target); past that, the target size wins over swelling.
      const score = Math.abs(bl - target) / target + (sw > 1.5 && bl < target * 2 ? 1.5 : 0) + (bl > target * 2 ? 10 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = bl;
      }
    }
    return best;
  }
  return Math.min(24, Math.max(8, S * 0.4)) * profile.scale;
}

// ---------------------------------------------------------------- materialize (linear stock)

export type ShapeBuild = {
  model: ShapeModel;
  graph?: StructureGraph;
  panels?: Panel[];
  overall: { width: number; height: number; depth: number };
  notes: string[];
};

type Seg = { a: Vec3; b: Vec3; role: ShapePartName; critical?: boolean };

function stockFace(item: CatalogItem) {
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  // Face = the stock dimension seen side-on; thick = how far it stands off a face.
  const face = round ? prim.width : prim.width;
  const thick = round ? prim.width : prim.height;
  return { face, thick, round, S: Math.max(0.5, prim.length), layer: round ? prim.width : prim.height };
}

/** Longest whole-stick run that stays inside `room` (never proud of the silhouette). */
function runWithin(room: number, S: number, lap: number): number {
  const n = Math.max(1, Math.floor((room - lap) / (S - lap) + 1e-6));
  return Math.min(room, n * S - (n - 1) * lap) >= S ? n * S - (n - 1) * lap : S;
}

/** Whole-stick run nearest to `need` (at least one stick) — box sizes quantize to whole sticks. */
function runNearest(need: number, S: number, lap: number): number {
  const n = Math.max(1, Math.round((need - lap) / (S - lap)));
  return n * S - (n - 1) * lap;
}

/** Whole-stick run that covers `need` (n sticks lapped end to end). */
function runFor(need: number, S: number, lap: number): { n: number; len: number } {
  let n = 1;
  while (n * S - (n - 1) * lap < need - 0.05 && n < 40) n++;
  return { n, len: n * S - (n - 1) * lap };
}

function materializeLinear(model: ShapeModel, item: CatalogItem, whole: boolean): Seg[] {
  const cls = shapeStockClass(item);
  const { face, thick, S, layer } = stockFace(item);
  const lap = shapeLap(item);
  const segs: Seg[] = [];
  const byId = new Map(model.parts.map((p) => [p.id, p]));
  const snap = (need: number) => (whole ? runFor(need, S, lap).len : need);
  const wire = item.id === "wire-frame" || !!item.tags?.includes("wire");

  // Boxes first (they may be resized to whole-stick runs), then rods that hang on them.
  for (const p of model.parts) {
    if (p.kind !== "box") continue;
    const { u, v } = boxFrame(p);
    if (cls === "fat") {
      // Glue-laminated block: full-length pieces stacked up the height, one stock wide.
      const nLayers = Math.max(1, Math.round(p.h / layer));
      p.h = nLayers * layer;
      p.w = face;
      for (let i = 0; i < nLayers; i++) {
        const b = -p.h / 2 + layer * (i + 0.5);
        segs.push({ a: boxPoint(p, -p.l / 2, b), b: boxPoint(p, p.l / 2, b), role: p.name, critical: true });
      }
      continue;
    }
    // Thin stock: slatted side walls, closed end walls, a top deck and two bottom rails.
    // Slats run up the height; whole craft sticks snap the height to whole-stick runs.
    const vertical = !whole || p.h >= S * 0.8 || p.h >= p.l;
    // Long whole stock: short boxes stay their typed length (one cut stick) so the silhouette
    // stays tabletop; long runs still quantize. Short craft sticks always snap to whole.
    if (whole && vertical) p.h = S > 8 && p.h < S * 0.85 ? p.h : runNearest(p.h, S, lap);
    // Short deep parts (snout) keep their visible length; whole sticks lap back into the parent box.
    const parentBox = p.attach ? byId.get(p.attach)?.kind === "box" : false;
    const courseL = whole && !vertical ? (S > 8 && p.l < S * 0.85 ? p.l : snap(p.l)) : p.l;
    // Short deep parts always lap into their parent (snout into head); free-standing boxes center.
    const c0 = whole && !vertical ? (parentBox || p.attach ? p.l / 2 - courseL : -courseL / 2) : -p.l / 2;
    const c1 = c0 + courseL;
    const pitch = Math.max(face * 2.5, 0.5, wire ? model.bodyLength / 12 : 0);
    const zs = [-p.w / 2, p.w / 2];
    if (vertical) {
      // Whole sticks: the length quantizes to the nearest whole-stick run too; slats stay on the rails.
      const spanL = whole ? (S > 8 && p.l < S * 0.85 ? p.l : runNearest(p.l, S, lap)) : p.l;
      p.l = spanL;
      const nSl = Math.max(2, Math.round(p.l / pitch) + 1);
      for (const zz of zs) {
        for (let i = 0; i < nSl; i++) {
          const a = -p.l / 2 + face / 2 + ((p.l - face) * i) / (nSl - 1);
          segs.push({ a: boxPoint(p, a, -p.h / 2, zz), b: boxPoint(p, a, p.h / 2, zz), role: p.name, critical: true });
        }
      }
      // Top deck and bottom rails run the length (lapped whole sticks when long).
      const deckL = p.l;
      // Cross rails at both ends tie the two side walls together; whole sticks only when they fit inside.
      const xr = whole ? (p.w >= S ? runWithin(p.w, S, lap) : 0) : p.w;
      for (const zz of zs) {
        segs.push({ a: boxPoint(p, -deckL / 2, p.h / 2, zz), b: boxPoint(p, deckL / 2, p.h / 2, zz), role: p.name, critical: true });
        segs.push({ a: boxPoint(p, -deckL / 2, -p.h / 2, zz), b: boxPoint(p, deckL / 2, -p.h / 2, zz), role: p.name, critical: true });
      }
      if (xr > 0) {
        const nDeck = Math.max(3, Math.round(p.w / pitch) + 1);
        for (const ea of [-deckL / 2, deckL / 2]) {
          for (const eb of [-p.h / 2, p.h / 2]) segs.push({ a: boxPoint(p, ea, eb, -xr / 2), b: boxPoint(p, ea, eb, xr / 2), role: p.name, critical: true });
        }
        for (let i = 1; i < nDeck - 1; i++) {
          const zz = -p.w / 2 + (p.w * i) / (nDeck - 1);
          // Inner deck row on top, and an end-wall slat under it at each end.
          segs.push({ a: boxPoint(p, -deckL / 2, p.h / 2, zz), b: boxPoint(p, deckL / 2, p.h / 2, zz), role: p.name, critical: true });
          for (const ea of [-deckL / 2, deckL / 2]) segs.push({ a: boxPoint(p, ea, -p.h / 2, zz), b: boxPoint(p, ea, p.h / 2, zz), role: p.name, critical: true });
        }
      } else {
        // Narrow box in whole sticks: one diagonal brace across each end, exactly one stick long.
        const dy = Math.min(p.h, Math.sqrt(Math.max(0.01, S * S - p.w * p.w)));
        for (const ea of [-deckL / 2, deckL / 2]) {
          segs.push({ a: boxPoint(p, ea, -dy / 2, -p.w / 2), b: boxPoint(p, ea, dy / 2, p.w / 2), role: p.name, critical: true });
        }
      }
    } else {
      // Short, deep part (snout): courses run the length, stacked up the height, both faces.
      const nCourse = Math.max(2, Math.round(p.h / pitch) + 1);
      for (const zz of zs) {
        for (let i = 0; i < nCourse; i++) {
          const b = -p.h / 2 + face / 2 + ((p.h - face) * i) / (nCourse - 1);
          segs.push({ a: boxPoint(p, c0, b, zz), b: boxPoint(p, c1, b, zz), role: p.name, critical: true });
        }
      }
      // Tie the two faces together at both ends: cross rails when a whole stick fits, else one diagonal.
      const xr2 = whole ? (p.w >= S ? runWithin(p.w, S, lap) : 0) : p.w;
      for (const ea of [c0 + face / 2, c1 - face / 2]) {
        if (xr2 > 0) {
          for (const eb of [-p.h / 2, p.h / 2]) segs.push({ a: boxPoint(p, ea, eb, -xr2 / 2), b: boxPoint(p, ea, eb, xr2 / 2), role: p.name, critical: true });
        } else {
          const dy = Math.min(p.h, Math.sqrt(Math.max(0.01, S * S - p.w * p.w)));
          segs.push({ a: boxPoint(p, ea, -dy / 2, -p.w / 2), b: boxPoint(p, ea, dy / 2, p.w / 2), role: p.name, critical: true });
        }
      }
      const nTop = Math.max(1, Math.round((p.w - face) / pitch));
      for (let i = 1; i <= nTop; i++) {
        const zz = -p.w / 2 + (p.w * i) / (nTop + 1);
        segs.push({ a: boxPoint(p, c0, p.h / 2, zz), b: boxPoint(p, c1, p.h / 2, zz), role: p.name, critical: true });
      }
    }
    void u;
    void v;
  }

  // Re-seat parts after boxes snapped: head rides the neck end, snout rides the head front.
  reseat(model);

  for (const p of model.parts) {
    if (p.kind !== "rod" || !p.a || !p.b) continue;
    const parent = p.attach ? byId.get(p.attach) : undefined;
    const d = sub(p.b, p.a);
    const L = len(d) || 1;
    const dn = mul(d, 1 / L);
    // Side-mounted rods (legs, ears) stand outboard of the parent's side face.
    let off = v3(0, 0, 0);
    if (p.side && parent) off = v3(0, 0, p.side * (cls === "fat" ? face / 2 + (parent.kind === "box" ? 0 : 0) : thick * 1.5));
    if (p.side && cls === "fat" && parent?.kind === "box") off = v3(0, 0, p.side * (parent.w / 2 - Math.abs(p.a.z) + face / 2));
    // End-mounted rods (neck, tail, mane) lap into the parent; a neck also runs on into the head it carries.
    const child = model.parts.find((q) => q.attach === p.id && q.kind === "box");
    const lapIn = !p.side && parent?.kind === "box" ? Math.min(parent.h, parent.l) * (p.name === "tail" || p.name === "mane" ? 0.55 : 0.3) : 0;
    const lapOut = child ? Math.min(child.h, child.l) * 0.45 : 0;
    const bEnd = add(p.b, mul(dn, lapOut));
    // Whole sticks: the free end stays put; the extra length laps back into the parent.
    const reach = L + lapIn + lapOut;
    const need = whole ? runFor(reach, S, lap).len : reach;
    const a = sub(bEnd, mul(dn, need));
    const t = p.t ?? face;
    const cross = cls === "fat" ? layer : face;
    const n = wire ? 1 : Math.min(3, Math.max(1, Math.round(t / cross)));
    const nrm = v3(-dn.y, dn.x, 0);
    // Thin stock: a neck is two side plates that sandwich onto the head and body walls.
    const zLayers = cls !== "fat" && (p.name === "neck" || p.name === "mane") ? [-(p.w / 2), p.w / 2] : [0];
    for (const zl of zLayers) {
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * cross;
        const shift = add(add(off, mul(nrm, o)), v3(0, 0, zl));
        segs.push({ a: add(a, shift), b: add(bEnd, shift), role: p.name, critical: true });
      }
    }
    if (whole) {
      p.a = a;
      p.l = need;
    }
    p.t = n * cross;
  }
  return segs;
}

/** Keep head on the neck end and snout on the head front after stock snapping resized boxes. */
function reseat(model: ShapeModel) {
  const byName = (n: ShapePartName) => model.parts.filter((p) => p.name === n);
  const neck = byName("neck")[0];
  const head = byName("head")[0];
  const snout = byName("snout")[0];
  if (!neck?.b || !head) return;
  const { u, v } = boxFrame(head);
  const nT = neck.t ?? 0;
  const oldC = head.c;
  head.c = add(neck.b, add(mul(u, head.l / 2 - nT * 0.45), mul(v, head.h / 2 - nT * 0.35)));
  const shift = sub(head.c, oldC);
  for (const p of model.parts) {
    if (p.attach !== head.id) continue;
    p.c = add(p.c, shift);
    if (p.a) p.a = add(p.a, shift);
    if (p.b) p.b = add(p.b, shift);
  }
  if (snout) {
    const old = snout.c;
    snout.c = add(head.c, add(mul(u, head.l / 2 + snout.l / 2), mul(v, -(head.h / 2 - snout.h / 2))));
    void old;
  }
}

function segsToGraph(segs: Seg[], item: CatalogItem, model: ShapeModel): StructureGraph {
  const join = (item.preferredJoins && item.preferredJoins[0]) || "glue";
  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];
  for (const s of segs) {
    const a = createId("n");
    const b = createId("n");
    nodes.push({ id: a, position: s.a, role: s.role === "leg" ? "base" : "support" }, { id: b, position: s.b, role: "support" });
    edges.push({ id: createId("e"), from: a, to: b, join, role: s.role, critical: !!s.critical });
  }
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const zs = nodes.map((n) => n.position.z);
  return {
    id: createId("graph"),
    name: model.label,
    envelope: { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), depth: Math.max(...zs) - Math.min(...zs) },
    materialId: item.id,
    nodes,
    edges,
    assumptions: [],
    notes: [],
    structureClass: "generic",
  };
}

// ---------------------------------------------------------------- materialize (sheet stock)

type P2 = [number, number];

function partPolygon(p: ShapePart): P2[] {
  if (p.kind === "box") {
    return [
      boxPoint(p, -p.l / 2, -p.h / 2), boxPoint(p, p.l / 2, -p.h / 2), boxPoint(p, p.l / 2, p.h / 2), boxPoint(p, -p.l / 2, p.h / 2),
    ].map((q) => [q.x, q.y] as P2);
  }
  const a = p.a!;
  const b = p.b!;
  const d = sub(b, a);
  const L = len(d) || 1;
  const n = v3(-d.y / L, d.x / L, 0);
  const t = (p.t ?? 1) / 2;
  if (p.name === "ear") {
    // Ears taper to a point.
    return [add(a, mul(n, t)), add(a, mul(n, -t)), b].map((q) => [q.x, q.y] as P2);
  }
  return [add(a, mul(n, t)), add(b, mul(n, t)), add(b, mul(n, -t)), add(a, mul(n, -t))].map((q) => [q.x, q.y] as P2);
}

function inPoly(x: number, y: number, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Outer outline of the union of part polygons (raster trace, deterministic, 1/8" grid). */
export function unionOutline(polys: P2[][], cell = 0.125): P2[] {
  const all = polys.flat();
  const minX = Math.min(...all.map((p) => p[0])) - cell;
  const minY = Math.min(...all.map((p) => p[1])) - cell;
  const maxX = Math.max(...all.map((p) => p[0])) + cell;
  const maxY = Math.max(...all.map((p) => p[1])) + cell;
  const nx = Math.ceil((maxX - minX) / cell) + 1;
  const ny = Math.ceil((maxY - minY) / cell) + 1;
  const grid = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = minX + (i + 0.5) * cell;
      const y = minY + (j + 0.5) * cell;
      if (polys.some((poly) => inPoly(x, y, poly))) grid[j * nx + i] = 1;
    }
  }
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < ny ? grid[j * nx + i] : 0);
  // Directed boundary edges (filled cell on the left), chained into loops.
  const next = new Map<string, string>();
  const key = (i: number, j: number) => `${i},${j}`;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!at(i, j)) continue;
      if (!at(i, j - 1)) next.set(key(i, j), key(i + 1, j));
      if (!at(i + 1, j)) next.set(key(i + 1, j), key(i + 1, j + 1));
      if (!at(i, j + 1)) next.set(key(i + 1, j + 1), key(i, j + 1));
      if (!at(i - 1, j)) next.set(key(i, j + 1), key(i, j));
    }
  }
  let best: string[] = [];
  const seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: string[] = [];
    let cur = start;
    while (!seen.has(cur) && next.has(cur)) {
      seen.add(cur);
      loop.push(cur);
      cur = next.get(cur)!;
    }
    if (loop.length > best.length) best = loop;
  }
  let pts: P2[] = best.map((s) => {
    const [i, j] = s.split(",").map(Number);
    return [minX + i * cell, minY + j * cell];
  });
  pts = simplify(pts, cell * 1.2);
  return pts;
}

function simplify(pts: P2[], tol: number): P2[] {
  if (pts.length < 4) return pts;
  const dp = (a: number, b: number, out: boolean[]) => {
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b % pts.length];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i];
      const d = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / L;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      out[idx] = true;
      dp(a, idx, out);
      dp(idx, b, out);
    }
  };
  const half = Math.floor(pts.length / 2);
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[half] = true;
  dp(0, half, keep);
  dp(half, pts.length, keep);
  return pts.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x * 16) / 16, Math.round(y * 16) / 16] as P2);
}

function materializeSheet(model: ShapeModel, item: CatalogItem): Panel[] {
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.25, 0.1);
  const profileParts = model.parts.filter((p) => p.name !== "leg");
  const outline = unionOutline(profileParts.map(partPolygon));
  const minX = Math.min(...outline.map((p) => p[0]));
  const minY = Math.min(...outline.map((p) => p[1]));
  const maxX = Math.max(...outline.map((p) => p[0]));
  const maxY = Math.max(...outline.map((p) => p[1]));
  const r = (n: number) => Math.round(n * 8) / 8;
  const panels: Panel[] = [
    {
      id: createId("profile"),
      type: "upright",
      name: "Body profile",
      position: { x: r(minX), y: r(minY), z: -T / 2 },
      size: { width: r(maxX - minX), height: r(maxY - minY), depth: T },
      materialId: item.id,
      polygon: { plane: "xy", pts: outline.map(([x, y]) => [Math.round((x - r(minX)) * 16) / 16, Math.round((y - r(minY)) * 16) / 16] as P2) },
      cutNote: `Side profile: ${profileParts.map((p) => p.name).filter((n, i, a) => a.indexOf(n) === i).join(", ")} in one piece. Trace the outline, cut with a jigsaw.`,
    },
  ];
  // Four legs screwed to the faces of the profile, two each side.
  for (const p of model.parts.filter((q) => q.name === "leg" && q.a && q.b)) {
    const a = p.a!;
    const b = p.b!;
    const legW = r(Math.max(p.t ?? 1.5, T * 2.5));
    const x0 = Math.min(a.x, b.x) - legW / 2;
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x) + legW / 2;
    const y1 = Math.max(a.y, b.y);
    const side = p.side ?? 1;
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    panels.push({
      id: createId("leg"),
      type: "upright",
      name: "Leg",
      position: { x: r(x0), y: r(horizontal ? y0 - legW / 2 + legW / 2 : y0), z: side > 0 ? T / 2 : -T / 2 - T },
      size: { width: r(horizontal ? x1 - x0 - legW : legW), height: r(horizontal ? legW : y1 - y0), depth: T },
      materialId: item.id,
    });
  }
  return panels;
}

// ---------------------------------------------------------------- entry

export function shapeSummary(model: ShapeModel): ShapeSummary {
  const counts = new Map<ShapePartName, number>();
  for (const p of model.parts) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  return { classId: model.classId, subject: model.subject, pose: model.pose, bodyLength: Math.round(model.bodyLength * 10) / 10, parts: [...counts].map(([name, count]) => ({ name, count })) };
}

export function materializeShape(
  prompt: string,
  item: CatalogItem,
  whole: boolean,
  typed: { length?: number; height?: number } = {},
): ShapeBuild | null {
  const hit = detectShapeClass(prompt);
  if (!hit) return null;
  let BL = defaultBodyLength(item, hit.profile, whole && shapeStockClass(item) === "thin");
  // A typed size scales the whole silhouette (length for a standing animal, else height).
  if (typed.length || typed.height) {
    const probe = hit.cls.build(hit.profile, 10);
    const ext = extents(probe.parts);
    const k = typed.height ? typed.height / (ext.maxY - ext.minY) : typed.length! / (ext.maxX - ext.minX);
    BL = Math.max(4, Math.min(120, 10 * k));
  }
  const model = hit.cls.build(hit.profile, BL);
  const cls = shapeStockClass(item);
  const notes: string[] = [];
  let graph: StructureGraph | undefined;
  let panels: Panel[] | undefined;
  if (cls === "sheet") {
    panels = materializeSheet(model, item);
    notes.push(`${model.label} · side profile (head, snout, ears, tail in one piece) with four legs screwed to its faces.`);
  } else {
    const segs = materializeLinear(model, item, whole && cls === "thin");
    graph = segsToGraph(segs, item, model);
    notes.push(
      cls === "fat"
        ? `${model.label} · glue-laminated body and head, legs and ears screwed to the sides.`
        : `${model.label} · slatted body and head boxes, snout, two ears, a tail, four legs glued to the body sides.`,
    );
  }
  const segPts: Vec3[] = graph ? graph.nodes.map((n) => n.position) : [];
  const panelPts: Vec3[] = (panels ?? []).flatMap((p) => [p.position, { x: p.position.x + p.size.width, y: p.position.y + p.size.height, z: p.position.z + p.size.depth }]);
  const pts = [...segPts, ...panelPts];
  const pad = graph ? Math.max(toPrimitive(item).width, 0.2) : 0;
  const span = (f: (p: Vec3) => number) => Math.max(...pts.map(f)) - Math.min(...pts.map(f));
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const overall = { width: r1(span((p) => p.x) + pad), height: r1(Math.max(...pts.map((p) => p.y)) + pad / 2), depth: r1(span((p) => p.z) + pad) };
  notes.push(`${model.label} · ${hit.profile.torsoH ? `body ${(1 / hit.profile.torsoH).toFixed(1)}:1 long to tall` : ""}, legs ${Math.round(hit.profile.legL * 100)}% of the body length${model.pose === "sit" ? ", sitting on its haunches" : ""}.`);
  return { model, graph, panels, overall, notes };
}

function extents(parts: ShapePart[]) {
  const pts = parts.flatMap((p) => (p.kind === "box" ? partPolygon(p) : partPolygon(p))).map(([x, y]) => ({ x, y }));
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(0, ...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

// ---------------------------------------------------------------- silhouette guard

export type ShapeIssue = { code: string; detail: string };

/** Side view, required named parts, connected, nothing floating — read from the built project. */
export function inspectShape(project: YardProject): ShapeIssue[] {
  const issues: ShapeIssue[] = [];
  const shape = project.shape;
  if (!shape) return [{ code: "no-shape", detail: `${project.name} has no shape class` }];
  const cls = FORM_CLASSES.find((c) => c.id === shape.classId);
  if (!cls) return [{ code: "unknown-class", detail: shape.classId }];
  const names = new Set<string>();
  for (const i of project.instances) if (i.role) names.add(i.role);
  const profile = project.panels.find((p) => /profile/i.test(p.name));
  if (profile) {
    for (const n of shape.parts.map((p) => p.name)) if (n !== "leg") names.add(n);
    if (project.panels.some((p) => /^leg$/i.test(p.name))) names.add("leg");
  }
  for (const req of cls.required) if (!names.has(req)) issues.push({ code: "missing-part", detail: req });
  const legs = project.instances.length
    ? new Set(project.instances.filter((i) => i.role === "leg").map((i) => `${Math.round((i.to?.x ?? 0) * 2)}|${Math.sign(i.to?.z ?? 0)}`)).size
    : project.panels.filter((p) => /^leg$/i.test(p.name)).length;
  if (legs < 4) issues.push({ code: "legs", detail: `${legs} leg stations` });
  // Side view: x extent vs y extent of the solid model.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const i of project.instances) for (const q of [i.from, i.to]) if (q) { xs.push(q.x); ys.push(q.y); }
  for (const p of project.panels) { xs.push(p.position.x, p.position.x + p.size.width); ys.push(p.position.y, p.position.y + p.size.height); }
  const sideW = Math.max(...xs) - Math.min(...xs);
  const sideH = Math.max(...ys) - Math.min(0, Math.min(...ys));
  if (shape.pose === "stand" && !(sideW > sideH)) issues.push({ code: "side-view", detail: `side view ${sideW.toFixed(1)} long × ${sideH.toFixed(1)} tall` });
  if (Math.min(...ys) > 0.3) issues.push({ code: "floating", detail: `lowest piece ${Math.min(...ys).toFixed(2)}" above the bench` });
  if (project.instances.length) {
    const st = project.buildStats;
    if (!st || st.components !== 1 || st.loose !== 0) issues.push({ code: "connected", detail: JSON.stringify(st) });
  } else {
    // Panels: every leg touches the profile face; profile touches the ground only through legs.
    const prof = profile;
    for (const leg of project.panels.filter((p) => /^leg$/i.test(p.name))) {
      if (!prof) break;
      const overlapX = Math.min(leg.position.x + leg.size.width, prof.position.x + prof.size.width) - Math.max(leg.position.x, prof.position.x);
      const overlapY = Math.min(leg.position.y + leg.size.height, prof.position.y + prof.size.height) - Math.max(leg.position.y, prof.position.y);
      const faceGap = Math.min(Math.abs(leg.position.z - (prof.position.z + prof.size.depth)), Math.abs(leg.position.z + leg.size.depth - prof.position.z));
      if (overlapX <= 0.2 || overlapY <= 0.2 || faceGap > 0.02) issues.push({ code: "floating", detail: `leg at x ${leg.position.x}` });
    }
  }
  return issues;
}
