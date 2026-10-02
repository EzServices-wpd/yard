/**
 * One stand / riser builder for every held object. Framing scales with the load the object puts on
 * it; anything holding water or heavy weight gets a solid deck, a load note and more legs.
 * Geometry is deterministic: the same held object and typed sizes always give the same stand.
 */
import { createId } from "@/lib/utils";
import { rememberCatalogItem } from "./foundStock";
import { inchFrac } from "./inchText";
import type { HeldObject } from "./heldObjects";
import type { CatalogItem, Panel, YardProject } from "./types";

const r16 = (n: number) => Math.round(n * 16) / 16;

/** Typed "N in/inches/ft tall|high" → inches. */
function typedTall(lower: string): number | null {
  const m = lower.match(/(\d+(?:\.\d+)?)\s*(?:-|\s)?\s*(in|inch|inches|"|″|ft|feet|foot)\s*(?:tall|high)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /ft|feet|foot/.test(m[2]) ? n * 12 : n;
}
function typedAxis(lower: string, axis: "wide|long" | "deep"): number | null {
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|\\s)?\\s*(in|inch|inches|"|″|ft|feet|foot)\\s*(?:${axis})\\b`);
  const m = lower.match(re);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /ft|feet|foot/.test(m[2]) ? n * 12 : n;
}

export type StandFrame = {
  tier: "light" | "medium" | "heavy";
  legs: number;
  ratedLb: number;
  legId: string;
  legW: number;
  legD: number;
  apronId: string;
  apronH: number;
  apronT: number;
};

/** Frame tier from the working load. Light: 2×2. Medium: 2×4 aprons. Heavy / water: 2×4 legs, top and bottom frames. */
export function frameForLoad(pounds: number, water: boolean, width: number): StandFrame {
  const heavy = water ? pounds >= 60 : pounds >= 150;
  if (heavy) {
    const perLeg = 100;
    let legs = Math.max(4, Math.ceil((pounds * 1.25) / perLeg));
    if (width > 36) legs = Math.max(legs, 6);
    if (legs % 2) legs += 1;
    legs = Math.min(8, legs);
    return { tier: "heavy", legs, ratedLb: legs * perLeg, legId: "lumber-2x4-8", legW: 3.5, legD: 1.5, apronId: "lumber-2x4-8", apronH: 3.5, apronT: 1.5 };
  }
  if (pounds >= 40) {
    return { tier: "medium", legs: 4, ratedLb: 160, legId: "lumber-2x2-8", legW: 1.5, legD: 1.5, apronId: "lumber-2x4-8", apronH: 3.5, apronT: 1.5 };
  }
  return { tier: "light", legs: 4, ratedLb: 80, legId: "lumber-2x2-8", legW: 1.5, legD: 1.5, apronId: "lumber-2x2-8", apronH: 1.5, apronT: 1.5 };
}

function proxyItem(held: HeldObject): CatalogItem {
  const slug = held.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `piece-held-${slug}`,
    name: held.label.charAt(0).toUpperCase() + held.label.slice(1),
    category: "plastic",
    formFactor: "custom",
    shape: "block",
    dims: { length: held.width, width: held.depth, height: held.height },
    unitsPerPack: 1,
    aliases: [held.label],
    tags: ["model", "held", "proxy"],
    preferredJoins: ["none"],
    canCut: false,
    color: held.water ? "#b9d3e0" : "#c9ced4",
    roughness: 0.6,
    metalness: 0.04,
    searchQuery: held.label,
    notes: held.note,
  } as CatalogItem;
}

/**
 * Stand under a held object. "stand"/"cart"/"table" → the class stand height; "shelf"/"riser" → a
 * countertop riser that keeps a usable clear space (≥ 7″) underneath.
 */
export function buildHeldStand(prompt: string, held: HeldObject, title: string): YardProject {
  const lower = prompt.toLowerCase();
  const n = Math.max(1, held.count);
  const gap = n > 1 ? 3 : 0;
  const objW = n * held.width + (n - 1) * gap;
  const objD = held.depth;
  const margin = 0.5;
  const wantW = r16(objW + 2 * margin);
  const wantD = r16(objD + 2 * margin);
  const typedW = typedAxis(lower, "wide|long");
  const typedD = typedAxis(lower, "deep");
  const W = r16(typedW ?? wantW);
  const D = r16(typedD ?? wantD);
  const standWord = /\b(stands?|carts?|tables?|bases?)\b/.test(lower);
  const tall = typedTall(lower);
  const deckT = 0.75;
  const frame = frameForLoad(held.pounds, held.water, W);
  // A riser keeps a usable clear space (≥ 7″) under its aprons.
  const riserH = Math.max(7 + frame.apronH + deckT, Math.min(14, Math.round(held.height * 0.6)));
  const deckTop = r16(tall ?? (standWord ? held.standHeight : riserH));
  const ply = "plywood-3-4-4x8";
  const legH = r16(deckTop - deckT);
  const panels: Panel[] = [];
  const mk = (p: Omit<Panel, "id">) => panels.push({ id: createId("panel"), ...p });

  // Legs: corners, plus evenly spaced pairs along front and back for heavy loads.
  const perSide = frame.legs / 2;
  const x0 = 0;
  const xs: number[] = [];
  for (let i = 0; i < perSide; i++) xs.push(r16(x0 + (i * (W - frame.legW)) / Math.max(1, perSide - 1)));
  let k = 1;
  for (const z of [0, r16(D - frame.legD)]) {
    for (const x of xs) {
      mk({
        type: "upright",
        name: `Leg ${k++}`,
        position: { x, y: 0, z },
        size: { width: frame.legW, height: legH, depth: frame.legD },
        materialId: frame.legId,
        cutNote: `${inchFrac(legH)}" leg, square ends. It stands under the deck.`,
      });
    }
  }
  // Top frame (aprons) under the deck, between the legs.
  const apronY = r16(legH - frame.apronH);
  const innerD = r16(D - 2 * frame.legD);
  mk({ type: "rail", name: "Front apron", position: { x: 0, y: apronY, z: frame.legD }, size: { width: W, height: frame.apronH, depth: frame.apronT }, materialId: frame.apronId, cutNote: "Runs the full width behind the front legs; the deck screws down into it." });
  mk({ type: "rail", name: "Back apron", position: { x: 0, y: apronY, z: r16(D - frame.legD - frame.apronT) }, size: { width: W, height: frame.apronH, depth: frame.apronT }, materialId: frame.apronId, cutNote: "Runs the full width in front of the back legs." });
  const sideLen = r16(innerD - 2 * frame.apronT);
  for (const [name, x] of [["Left apron", 0], ["Right apron", r16(W - frame.apronT)]] as const) {
    mk({ type: "rail", name, position: { x, y: apronY, z: r16(frame.legD + frame.apronT) }, size: { width: frame.apronT, height: frame.apronH, depth: sideLen }, materialId: frame.apronId, cutNote: "Fits between the front and back aprons." });
  }
  // Tall stands get a bottom frame and a lower shelf: it stiffens the legs and gives usable storage.
  const lower3 = deckTop >= 20;
  if (lower3) {
    const sy = 4;
    mk({ type: "rail", name: "Front stretcher", position: { x: 0, y: sy, z: frame.legD }, size: { width: W, height: frame.apronH, depth: frame.apronT }, materialId: frame.apronId, cutNote: `Bottom frame, ${inchFrac(sy)}" off the floor.` });
    mk({ type: "rail", name: "Back stretcher", position: { x: 0, y: sy, z: r16(D - frame.legD - frame.apronT) }, size: { width: W, height: frame.apronH, depth: frame.apronT }, materialId: frame.apronId, cutNote: "Bottom frame, matches the front stretcher." });
    mk({ type: "shelf", name: "Lower shelf", position: { x: 0, y: r16(sy + frame.apronH), z: frame.legD }, size: { width: W, height: deckT, depth: innerD }, materialId: ply, cutNote: "Sits on the stretchers between the legs; notch the corners around the legs." });
  }
  mk({ type: "top", name: "Deck", position: { x: 0, y: legH, z: 0 }, size: { width: W, height: deckT, depth: D }, materialId: ply, cutNote: `Solid 3/4" plywood deck; the ${held.label} sits on it.` });

  // The held object, drawn as a plain proxy box at its real size (not a cut part).
  const item = held.item ?? proxyItem(held);
  rememberCatalogItem(item);
  const instances = Array.from({ length: n }, (_, i) => {
    const cx = (W - objW) / 2 + held.width / 2 + i * (held.width + gap);
    const pos = { x: r16(cx), y: r16(deckTop + held.height / 2), z: r16(D / 2) };
    return { id: createId("inst"), catalogId: item.id, position: pos, rotation: { x: 0, y: 0, z: 0 }, cutLength: held.width, role: "held", home: pos };
  });

  const notes: string[] = [held.note];
  const sits = n > 1 ? "sit" : "sits";
  const is = n > 1 ? "are" : "is";
  notes.push(`The ${held.label} ${sits} on a solid 3/4" plywood deck, ${inchFrac(W)}" × ${inchFrac(D)}", sized to its footprint with ${inchFrac(margin)}" to spare on each side. Legs and aprons stand under the deck.`);
  if (typedW != null && typedW < objW) notes.push(`The typed ${inchFrac(typedW)}" width wins; the ${held.label} ${is} ${inchFrac(objW - typedW)}" wider than the deck, so it overhangs.`);
  if (!standWord && !tall) notes.push(`Riser: the deck sits at ${inchFrac(deckTop)}", leaving ${inchFrac(legH - frame.apronH)}" of clear space underneath for storage.`);
  const loadTalk = held.water ? `about ${held.pounds} lb filled` : `about ${held.pounds} lb`;
  if (frame.tier !== "light" || held.water) {
    notes.push(`Load rating: framed for about ${frame.ratedLb} lb on ${frame.legs} ${frame.legId === "lumber-2x4-8" ? "2×4" : "2×2"} legs with ${frame.apronH >= 3 ? "2×4 aprons on edge" : "2×2 aprons"}; the ${held.label} ${is} ${loadTalk}.`);
  }
  if (held.water && held.pounds >= 60) {
    notes.push("Water weighs about 8.3 lb a gallon. Set the stand level on a solid floor and shim under the legs so the deck sits dead flat before you fill.");
  }
  const overallH = r16(deckTop + held.height);
  return {
    id: createId("proj"),
    name: title,
    prompt,
    kind: "custom",
    overall: { width: W, height: overallH, depth: D },
    instances,
    panels,
    primaryMaterialId: frame.legId,
    notes,
    assumptions: {
      load: frame.tier === "heavy" ? "heavy" : "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  } as YardProject;
}

const TIER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Spoken tier count on a plant / flower stand: "three tiers", "3-tier", "4 levels", "with 3 shelves". Null when none. */
export function plantStandTiers(lower: string): number | null {
  if (!/\b(?:plant|flower|pot(?:ted)?|succulent|orchid|herb)s?\s*(?:stands?|shel(?:f|ves)|racks?|towers?|holders?)\b|\btiered\s+(?:plant|flower)\b/.test(lower)) return null;
  const m = lower.match(/\b(\d|two|three|four|five|six)\s*-?\s*(?:tiers?|tiered|levels?|steps?|shel(?:f|ves)|rows?)\b/);
  if (m) {
    const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : TIER_WORDS[m[1]];
    return n >= 2 && n <= 6 ? n : null;
  }
  return /\btiered\b|\bstepped\b|\btiers\b/.test(lower) ? 3 : null;
}

/**
 * Stepped plant stand: N decks that climb front to back, so every pot gets light and no tier sits
 * under another. Two side frames of 2×2 posts, rails under every deck, 3/4" plywood decks.
 */
export function buildTieredPlantStand(prompt: string, tiers: number): YardProject {
  const lower = prompt.toLowerCase();
  const N = Math.max(2, Math.min(6, tiers));
  const typedW = typedAxis(lower, "wide|long");
  const typedD = typedAxis(lower, "deep");
  const tall = typedTall(lower);
  const W = r16(typedW ?? 30);
  const Td = r16(typedD ? typedD / N : 9);
  const D = r16(Td * N);
  const deckT = 0.75;
  const post = 1.5;
  const rail = 1.5;
  const firstTop = 12;
  const topTop = r16(tall ?? firstTop + (N - 1) * 10);
  const rise = N > 1 ? (topTop - firstTop) / (N - 1) : 0;
  // Tier i: 0 = front / lowest. Its deck spans z from (N-1-i)·Td (back edge) to (N-i)·Td (front edge).
  const tierTop = (i: number) => r16(N > 1 ? firstTop + i * rise : topTop);
  const panels: Panel[] = [];
  const mk = (p: Omit<Panel, "id">) => panels.push({ id: createId("panel"), ...p });
  const leg = "lumber-2x2-8";
  const ply = "plywood-3-4-4x8";
  // Posts at every tier boundary on both sides; each carries the tier whose front edge it marks
  // (the back post carries the top tier).
  for (const [side, x] of [["Left", 0], ["Right", r16(W - post)]] as const) {
    for (let k = 0; k <= N; k++) {
      const i = k === 0 ? N - 1 : N - k;
      const h = r16(tierTop(i) - deckT);
      const z = r16(Math.min(Math.max(0, k * Td - (k === N ? post : k === 0 ? 0 : post / 2)), D - post));
      mk({ type: "upright", name: `${side} post ${k + 1}`, position: { x, y: 0, z }, size: { width: post, height: h, depth: post }, materialId: leg, cutNote: `${inchFrac(h)}" post, square ends.` });
    }
    // Floor rail ties the posts of one side together.
    mk({ type: "rail", name: `${side} floor rail`, position: { x: side === "Left" ? r16(post) : r16(W - post - rail), y: 3, z: 0 }, size: { width: rail, height: rail, depth: D }, materialId: leg, cutNote: "Screws to the inside face of every post on this side, 3\" off the floor." });
  }
  for (let i = 0; i < N; i++) {
    const top = tierTop(i);
    const zBack = r16((N - 1 - i) * Td);
    const zFront = r16((N - i) * Td);
    const ry = r16(top - deckT - rail);
    mk({ type: "rail", name: `Tier ${i + 1} front rail`, position: { x: post, y: ry, z: r16(zFront - rail - (i === 0 ? 0 : 0)) }, size: { width: r16(W - 2 * post), height: rail, depth: rail }, materialId: leg, cutNote: "Fits between the left and right posts; the deck screws down into it." });
    mk({ type: "rail", name: `Tier ${i + 1} back rail`, position: { x: post, y: ry, z: zBack }, size: { width: r16(W - 2 * post), height: rail, depth: rail }, materialId: leg, cutNote: "Fits between the posts at the back edge of this tier." });
    mk({ type: "top", name: `Tier ${i + 1} deck`, position: { x: 0, y: r16(top - deckT), z: zBack }, size: { width: W, height: deckT, depth: Td }, materialId: ply, cutNote: `Tier ${i + 1}: ${inchFrac(W)}" × ${inchFrac(Td)}" plywood deck; notch the back corners around the posts.` });
  }
  const pot = Math.floor(Td - 1);
  const name = `${N}-tier plant stand`;
  const notes = [
    `${name}: ${N} decks that step up front to back, so every pot gets light and no tier sits under another. Deck tops at ${Array.from({ length: N }, (_, i) => `${inchFrac(tierTop(i))}"`).join(", ")}.`,
    `Each deck is ${inchFrac(W)}" wide × ${inchFrac(Td)}" deep — room for pots up to about ${pot}" across, about ${Math.max(1, Math.floor(W / (pot + 1)))} per tier.`,
    "2×2 posts at every tier edge on both sides, rails under every deck, a floor rail on each side. Glue and screw; finish with exterior poly or paint if it goes outside, and set saucers under the pots.",
    ...(typedW == null ? [`Assumed ${inchFrac(W)}" wide — type a width to lock it.`] : []),
    ...(tall == null ? [`Assumed ${inchFrac(topTop)}" to the top deck — type a height to lock it.`] : []),
  ];
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "custom",
    overall: { width: W, height: topTop, depth: D },
    instances: [],
    panels,
    primaryMaterialId: leg,
    notes,
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  } as YardProject;
}
