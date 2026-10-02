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
  const item = proxyItem(held);
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
