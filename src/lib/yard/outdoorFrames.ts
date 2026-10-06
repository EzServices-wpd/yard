/**
 * Real-scale outdoor and shop frames: a ground-level deck, a garden gate, a swing set, a sawhorse.
 * Built in lumber at the size people build them, from the load path up: footings and posts,
 * beams, joists at 16" on centre and decking; a gate frame whose brace runs from the bottom
 * hinge corner up to the latch side; A-frame legs under a doubled top beam (swing set, sawhorse).
 * Craft stock or a model word keeps the stick model.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import type { Panel, YardProject } from "./types";
import { allowSpanIn } from "./spanCheck";

export type OutdoorFrame = "deck" | "gate" | "swing-set" | "sawhorse" | "picnic";

const CRAFT = /popsicle|craft\s*sticks?|toothpicks?|skewers?|cardboard|chipboard|lego|\bstraws?\b|balsa|dowels?|pipe\s*cleaners?|paper|foam|clay/;
const MODEL = /\b(?:doll|dollhouse|barbie|miniature|mini|model|toy|tiny|figurine|ornament|scale|diorama|fairy|desk\s*top|tabletop)\b/;

const L = { two4: "lumber-2x4-8", two6: "lumber-2x6-8", two8: "lumber-2x8-8", two10: "lumber-2x10-8", two12: "lumber-2x12-8", post4: "lumber-4x4-8", one6: "lumber-1x6-8" };

/** The class, when the prompt names one of these frames and no craft stock or model scale. */
export function outdoorFrameKind(prompt: string, materialOverride?: string): OutdoorFrame | null {
  const lower = prompt.toLowerCase();
  // "Mini / small sawhorse" is a real low shop sawhorse, not a model.
  const scale = lower.replace(/\b(?:mini|small|low|short)\s+(?=saw\s*horses?\b)/, "");
  if (CRAFT.test(`${lower} ${materialOverride ?? ""}`) || MODEL.test(scale)) return null;
  if (materialOverride && !/^lumber-|^plywood-/.test(materialOverride)) return null;
  if (/\bsaw\s*horses?\b/.test(lower)) return "sawhorse";
  if (/\bpicnic\s+tables?\b/.test(lower) && !/\bbench(?:es)?\b.*\bseparate\b/.test(lower)) return "picnic";
  if (/\bswing\s*sets?\b|\bswingsets?\b|\ba-?frame\s+swing\b/.test(lower)) return "swing-set";
  if (/\b(?:garden|yard|fence|wood(?:en)?|picket|privacy|side|backyard)?\s*gates?\b/.test(lower) && !/\bgate\s*(?:leg|way|house)|tailgate|baby\s*gate|pet\s*gate|stair\s*gate|golden\s*gate|gateway/.test(lower))
    return "gate";
  if (/\b(?:ground[-\s]*level\s+|floating\s+|freestanding\s+|backyard\s+|wood(?:en)?\s+|patio\s+)?deck\b/.test(lower) && !/\bdeck\s*(?:box|chair|bench|of cards|planter|railing)\b|\bdeckchair|\bboat\b|skate|\bon (?:the|a) deck\b/.test(lower))
    return "deck";
  return null;
}

function num(t: string, re: RegExp): number | null {
  const m = t.match(re);
  return m ? Number(m[1]) : null;
}

/** "10x12" on a deck is feet; a number with ft/' is feet; a bare number on a gate or swing set is inches. */
function feetPair(lower: string): [number, number] | null {
  const m = lower.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|foot|feet)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:'|ft|foot|feet)?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const feet = /\d\s*(?:'|ft|foot|feet)/.test(m[0]) || (a <= 40 && b <= 40);
  return feet ? [a * 12, b * 12] : [a, b];
}

function axis(lower: string, word: RegExp): number | null {
  const m = lower.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*('|ft|foot|feet|"|in|inch|inches)?\s*(?:${word.source})`));
  if (!m) return null;
  return /'|ft|foot|feet/.test(m[2] ?? "") ? Number(m[1]) * 12 : Number(m[1]);
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId: string, extra: Partial<Panel> = {}): Panel {
  return { id: createId(type.slice(0, 2)), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId, ...extra };
}

const ft = (n: number) => {
  const f = Math.floor(n / 12);
  const i = Math.round(n - f * 12);
  return i ? `${f}' ${i}"` : `${f}'`;
};

function project(prompt: string, name: string, panels: Panel[], W: number, H: number, D: number, notes: string[], primary: string, use: "person" | "display" = "person"): YardProject {
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "custom",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: primary,
    notes,
    historic: false,
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud", use },
  };
}

/** Break a run into pieces no longer than a board, each joint on a support centre. */
function splitRun(start: number, end: number, supports: number[], max = 96): [number, number][] {
  const out: [number, number][] = [];
  let at = start;
  while (end - at > max) {
    const next = supports.filter((c) => c > at + 1 && c <= at + max).pop();
    if (next == null) break;
    out.push([at, next]);
    at = next;
  }
  out.push([at, end]);
  return out;
}

/** Where a piece sits in its run: left / middle / right along the width, back / middle / front along the depth. */
function placeWord(n: number, k: number, along: "x" | "z"): string {
  if (n === 1) return "";
  const [a, b] = along === "x" ? ["left", "right"] : ["back", "front"];
  if (n === 2) return k ? b : a;
  if (n === 3) return [a, "middle", b][k];
  return `${a} ${k + 1}`;
}
const sp = (w: string) => (w ? ` ${w}` : "");

/**
 * Freestanding ground-level deck. Precast pier blocks carry 4×4 posts no more than 6' apart; a doubled beam
 * runs across on the posts; joists span between beams at 16" on centre, capped by rim joists; decking runs
 * across the joists with a 1/8" gap. Every piece fits an 8' board: beam plies break over a post, joists over
 * a middle beam, rims and decking over a joist, decking joints staggered row to row.
 * Joist size from the clear span (No. 2 southern pine / Douglas fir at 16" o.c.): 2×6 to 9' 11", 2×8 to 13' 1",
 * 2×10 to 16' 2", 2×12 to 18'.
 */
export function buildDeck(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const pair = feetPair(lower);
  const W = size?.width ?? axis(lower, /wide|width|long|length/) ?? pair?.[0] ?? 144;
  const D = size?.depth ?? axis(lower, /deep|depth|out/) ?? pair?.[1] ?? 120;
  const setback = Math.min(18, D / 8);
  const inner = D - 2 * setback;
  let spans = Math.max(1, Math.ceil(D / 96));
  while (setback + inner / spans - 1.5 > 96 || inner / spans > 216) spans++;
  const clear = inner / spans;
  const [joist, jd, joistName] = clear <= 119 ? [L.two6, 5.5, "2×6"] : clear <= 157 ? [L.two8, 7.25, "2×8"] : clear <= 194 ? [L.two10, 9.25, "2×10"] : [L.two12, 11.25, "2×12"];
  const [beam, bd, beamName] = jd < 7.25 ? [L.two8, 7.25, "2×8"] : [joist, jd, joistName];
  const deckT = 1.5;
  const beamY = 12;
  const joistY = beamY + bd;
  const deckY = joistY + jd;
  const H = deckY + deckT;
  const x0 = -W / 2;
  const x1 = W / 2;
  const z0 = 0;
  const panels: Panel[] = [];
  // Beams across the width on posts no more than 6' apart, the end posts a foot in from each end.
  const beamCs = Array.from({ length: spans + 1 }, (_, i) => z0 + setback + (inner * i) / spans);
  const inset = Math.min(12, W / 8);
  const runIn = W - 2 * inset;
  const nPosts = Math.max(2, Math.ceil(runIn / 72) + 1);
  const postCs = Array.from({ length: nPosts }, (_, i) => x0 + inset + (runIn * i) / (nPosts - 1));
  let posts = 0;
  for (const [b, bc] of beamCs.entries()) {
    for (const [p, pc] of postCs.entries()) {
      posts++;
      panels.push(panel("upright", `Post ${b + 1}${String.fromCharCode(65 + p)}`, pc - 1.75, 0, bc - 1.75, 3.5, beamY, 3.5, L.post4));
    }
    // Two plies face to face, on edge; each ply breaks over a post.
    for (const [k, ply] of (["outer", "inner"] as const).entries()) {
      const pieces = splitRun(x0, x1, postCs);
      pieces.forEach(([a, e], i) => panels.push(panel("rail", `Beam ${b + 1}${sp(placeWord(pieces.length, i, "x"))} ${ply}`, a, beamY, bc - 1.5 + 1.5 * k, e - a, bd, 1.5, beam)));
    }
  }
  // Joists at 16" on centre, the outer joists flush with the ends; each breaks over a middle beam.
  const nJ = Math.ceil((W - 1.5) / 16) + 1;
  const joistXs = Array.from({ length: nJ }, (_, i) => Math.min(x0 + i * 16, x1 - 1.5));
  const joistCs = joistXs.map((x) => x + 0.75);
  const joistPieces = splitRun(z0 + 1.5, z0 + D - 1.5, beamCs.slice(1, -1));
  joistXs.forEach((x, i) => joistPieces.forEach(([a, e], k) => panels.push(panel("rail", `Joist ${i + 1}${sp(placeWord(joistPieces.length, k, "z"))}`, x, joistY, a, 1.5, jd, e - a, joist))));
  // Rim joists front and back, broken over a joist.
  for (const [side, z] of [["back", z0], ["front", z0 + D - 1.5]] as const) {
    const pieces = splitRun(x0, x1, joistCs);
    pieces.forEach(([a, e], i) => panels.push(panel("rail", `Rim joist ${side}${sp(placeWord(pieces.length, i, "x"))}`, a, joistY, z, e - a, jd, 1.5, joist)));
  }
  // Decking across the joists, 1/8" gaps; butt joints over a joist, alternate rows broken at a different joist.
  const boardW = 5.5;
  const gap = 0.125;
  const rows = Math.floor((D + gap) / (boardW + gap));
  const lead = (D - (rows * boardW + (rows - 1) * gap)) / 2;
  for (let r = 0; r < rows; r++) {
    const z = z0 + lead + r * (boardW + gap);
    const pieces = splitRun(x0, x1, r % 2 ? joistCs.filter((c) => c <= x0 + 66 || c > x0 + 98) : joistCs);
    pieces.forEach(([a, e], k) => panels.push(panel("deck", `Deck board ${r + 1}${sp(placeWord(pieces.length, k, "x"))}`, a, deckY, z, e - a, deckT, boardW, L.two6)));
  }
  const name = `Deck ${ft(W)} × ${ft(D)}`;
  const notes = [
    `${name}, freestanding at ground level, deck surface ${inchFrac(H)}" up. ${posts} precast concrete deck pier blocks, set on compacted gravel with their tops at grade, carry 4×4 posts no more than 6' apart; a doubled ${beamName} beam runs across on each row of posts (${spans + 1} beams), each ply breaking over a post.`,
    `${joistName} joists at 16" on centre span ${ft(clear)} between beams (inside the ${joistName} limit for that span)${spans > 1 ? " and break over the middle beam" : ""}, capped by rim joists front and back; ${rows} rows of 2×6 decking run across the joists with 1/8" gaps, ends butted over a joist and staggered row to row.`,
    `Pressure-treated lumber rated for ground contact on posts and beams, coated deck screws, and ${nJ * (spans + 1)} hurricane ties where joists cross beams. Guidance only — check your local code and frost depth; a deck attached to the house or higher than 30" needs a permit, footings below frost and a guard.`,
  ];
  return project(prompt, name, panels, W, H, D, notes, joist);
}

/**
 * Garden gate leaf: a 2×4 frame (stiles and rails laid flat), a diagonal 2×4 brace running from the bottom
 * hinge corner up to the top latch corner so it pushes the latch side up, and 1×6 boards on the face.
 * It hangs on strap hinges from a 4×4 post set in concrete, 2" above the ground, with a 1/2" latch gap.
 */
export function buildGate(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const W = size?.width ?? axis(lower, /wide|width/) ?? 36;
  const H = size?.height ?? axis(lower, /tall|high|height/) ?? 48;
  const panels: Panel[] = [];
  // Hinge side on the left (x = 0). Frame laid flat behind the boards.
  panels.push(panel("upright", "Hinge stile", 0, 0, 0, 3.5, H, 1.5, L.two4));
  panels.push(panel("upright", "Latch stile", W - 3.5, 0, 0, 3.5, H, 1.5, L.two4));
  const railW = W - 7;
  panels.push(panel("rail", "Bottom rail", 3.5, 0, 0, railW, 3.5, 1.5, L.two4));
  panels.push(panel("rail", "Top rail", 3.5, H - 3.5, 0, railW, 3.5, 1.5, L.two4));
  // Brace: a 3 1/2" band from the bottom hinge corner to the top latch corner, clipped square to the rails and stiles.
  const bw = railW;
  const bh = H - 7;
  const len = Math.hypot(bw, bh);
  const dx = Math.min(bw, (3.5 * len) / bh);
  const dy = Math.min(bh, (3.5 * len) / bw);
  const angle = Math.round((Math.atan2(bh, bw) * 180) / Math.PI);
  panels.push(
    panel("rail", "Diagonal brace", 3.5, 3.5, 0, bw, bh, 1.5, L.two4, {
      polygon: { plane: "xy", pts: [[0, 0], [dx, 0], [bw, bh - dy], [bw, bh], [bw - dx, bh], [0, dy]] },
      blank: { lengthIn: Math.ceil((len + 3.5) * 8) / 8, widthIn: 3.5, thicknessIn: 1.5 },
      cutNote: `Cut ${inchFrac(len)}" long point to point, both ends at ${angle}° so it sits tight in the corners; the low end goes at the hinge side.`,
    }),
  );
  // Boards on the face, 1/4" gaps, each no wider than a 1×6, ending 1/2" above the frame bottom to keep end grain dry.
  const n = Math.max(2, Math.ceil((W + 0.25) / 5.75));
  const bwid = (W - 0.25 * (n - 1)) / n;
  for (let i = 0; i < n; i++) panels.push(panel("side", `Board ${i + 1}`, i * (bwid + 0.25), 0.5, 1.5, bwid, H - 0.5, 0.75, L.one6));
  const name = `Garden gate ${inchFrac(W)}" × ${inchFrac(H)}"`;
  const notes = [
    `${name}: a 2×4 frame laid flat — stiles full height, top and bottom rails between them — with a diagonal 2×4 brace from the bottom hinge corner up to the top latch corner, and ${n} 1×6 boards screwed to the frame face.`,
    `The brace pushes the latch corner up and keeps the gate square. Hang the hinge stile from a 4×4 post with two 8" strap hinges, 2" above the ground, with a 1/2" gap at the latch post for a gate latch: an opening of ${inchFrac(W + 0.5)}" between posts.`,
    "Set both 4×4 posts in concrete, about 2' deep. Exterior screws, pressure-treated or cedar lumber. Guidance only.",
  ];
  return project(prompt, name, panels, W, H, 2.25, notes, L.two4);
}

type AFrame = { beamL: number; Hb: number; spread: number; beamId: string; bd: number; legId: string; legW: number; inset: number };

/** Doubled beam on edge riding on an A of two splayed legs at each end, a cross brace across each A at 40% height. */
function aFramePanels({ beamL, Hb, spread, beamId, bd, legId, legW, inset }: AFrame): Panel[] {
  const beamY = Hb - bd;
  const panels: Panel[] = [];
  panels.push(panel("rail", "Top beam outer", -1.5, beamY, 0, 1.5, bd, beamL, beamId));
  panels.push(panel("rail", "Top beam inner", 0, beamY, 0, 1.5, bd, beamL, beamId));
  const legRun = spread / 2; // horizontal run from the apex to the foot
  const legLen = Math.hypot(legRun, beamY);
  const angle = Math.round((Math.atan2(beamY, legRun) * 180) / Math.PI);
  const across = legW * (legLen / beamY); // horizontal width of the sloped leg
  for (const [e, z] of [[1, inset], [2, beamL - inset - 1.5]] as const) {
    for (const side of [-1, 1]) {
      // Legs meet at the apex under the beam centre, so the beam bears on both leg tops.
      const footX = side < 0 ? -spread / 2 : spread / 2 - across;
      const topX = side < 0 ? -across : 0;
      const minX = Math.min(footX, topX);
      const w = Math.max(footX, topX) + across - minX;
      const pts: [number, number][] = [[footX - minX, 0], [footX - minX + across, 0], [topX - minX + across, beamY], [topX - minX, beamY]];
      panels.push(
        panel("upright", `A-frame ${e} leg ${side < 0 ? "left" : "right"}`, minX, 0, z, w, beamY, 1.5, legId, {
          polygon: { plane: "xy", pts },
          blank: { lengthIn: Math.ceil((legLen + legW * (legRun / beamY)) * 8) / 8, widthIn: legW, thicknessIn: 1.5 },
          cutNote: `Cut ${inchFrac(legLen)}" long with both ends at ${angle}° — level on the ground, tight under the beam.`,
        }),
      );
    }
    // Cross brace across the A at 40% of the height, on the inside face of the legs.
    const by = beamY * 0.4;
    const halfAt = (spread / 2) * (1 - by / beamY);
    panels.push(panel("rail", `A-frame ${e} cross brace`, -halfAt, by, e === 1 ? z + 1.5 : z - 1.5, halfAt * 2, legW, 1.5, legId));
  }
  return panels;
}

/**
 * A-frame swing set: a doubled 2×10 top beam on edge, an A of two 2×6 legs at each end splayed to a base
 * about 0.75 of the beam height, a 2×6 cross brace across each A, ground anchors at each foot. Swings hang
 * from swing hangers through the beam (bought hardware).
 */
export function buildSwingSet(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  // Beam one 10' 2×10, legs one 8' 2×6 each.
  const beamL = Math.min(120, size?.depth ?? axis(lower, /long|length|wide|width/) ?? 120);
  const Hb = Math.min(94, size?.height ?? axis(lower, /tall|high|height/) ?? 92);
  const spread = size?.width ?? Math.round(Hb * 0.75);
  const swings = Math.max(1, Math.min(4, num(lower, /(\d)\s*swings?/) ?? (beamL >= 96 ? 2 : 1)));
  const panels = aFramePanels({ beamL, Hb, spread, beamId: "lumber-2x10-10", bd: 9.25, legId: L.two6, legW: 5.5, inset: 0.5 });
  const name = `Swing set ${ft(beamL)} beam × ${ft(Hb)} tall`;
  const notes = [
    `${name}: a doubled 2×10 top beam on edge rides on an A-frame at each end — two 2×6 legs splayed ${ft(spread)} apart at the ground, joined by a 2×6 cross brace at 40% of the height.`,
    `Hang ${swings} swing${swings > 1 ? "s" : ""} from heavy-duty swing hangers bolted through the beam, at least 8" from the A-frames and 16"–24" apart. Leave 6' of clear space front and back of the swings.`,
    "Bolt the legs to the beam with a steel A-frame bracket at each end and anchor each foot with a ground anchor; pressure-treated lumber and galvanized through-bolts. Guidance only — check the swing hardware rating.",
  ];
  return project(prompt, name, panels, spread, Hb, beamL, notes, L.two6);
}

/** Sawhorse: the same A-frame at shop scale — a doubled 2×4 top on edge, splayed 2×4 legs, a 2×4 brace across each A. */
export function buildSawhorse(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const small = /\b(?:mini|small|low|short)\s+saw\s*horses?\b/.test(lower);
  const beamL = Math.min(96, size?.depth ?? axis(lower, /long|length|wide|width/) ?? (small ? 24 : 36));
  const Hb = Math.min(40, size?.height ?? axis(lower, /tall|high|height/) ?? (small ? 18 : 30));
  const spread = size?.width ?? Math.round(Hb * 0.7);
  const panels = aFramePanels({ beamL, Hb, spread, beamId: L.two4, bd: 3.5, legId: L.two4, legW: 3.5, inset: 3 });
  const name = `Sawhorse ${inchFrac(beamL)}" × ${inchFrac(Hb)}"`;
  const notes = [
    `${name}: a doubled 2×4 top on edge rides on an A of two splayed 2×4 legs at each end, ${inchFrac(spread)}" apart at the floor, with a 2×4 brace across each A at 40% of the height.`,
    "Screw each leg to both top boards and each brace across its pair of legs. Build two, lay a sheet or a 2×10 across them for a work surface. Guidance only.",
  ];
  return project(prompt, name, panels, spread, Hb, beamL, notes, L.two4);
}

/** Typed 2× board for a picnic table's top and seats; 2×6 when none is typed. */
function picnicBoard(lower: string): { id: string; face: number; label: string } {
  if (/\b2\s*[x×]\s*4\b/.test(lower)) return { id: L.two4, face: 3.5, label: "2×4" };
  if (/\b2\s*[x×]\s*8\b/.test(lower)) return { id: L.two8, face: 7.25, label: "2×8" };
  return { id: L.two6, face: 5.5, label: "2×6" };
}

/**
 * Picnic table with attached benches (the common A-frame pattern): top and seat boards of 2× stock with ¼"
 * gaps, carried by A-frames of two splayed 2×6 legs, each with a 2×4 top cleat under the top and a 2×6 seat
 * support under both seats bolted through the legs; a 2×4 center brace on edge under the middle of the top
 * from cleat to cleat. Frames are added along the length until no seat board spans past what 1 1/2" stock
 * holds for a person.
 */
export function buildPicnicTable(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const board = picnicBoard(lower);
  const Lraw = size?.depth ?? axis(lower, /long|length|wide|width/) ?? axis(lower, /picnic|table/) ?? (() => {
    // A bare typed length ("6 ft", "96 inch") is the table's length unless it names the height.
    const m = lower.match(/(\d+(?:\.\d+)?)\s*('|ft\b|foot\b|feet\b|"|in\b|inch(?:es)?\b)(?!\s*(?:tall|high|height))/);
    return m ? Number(m[1]) * (/'|ft|foot|feet/.test(m[2]) ? 12 : 1) : null;
  })() ?? 72;
  const len = Math.max(48, Math.min(96, Lraw));
  const H = Math.min(32, Math.max(26, size?.height ?? axis(lower, /tall|high|height/) ?? 29));
  const bt = 1.5;
  const gap = 0.25;
  const seatTop = 17;
  const nTop = Math.max(3, Math.round(28 / (board.face + gap)));
  const topW = nTop * board.face + (nTop - 1) * gap;
  const nSeat = Math.max(2, Math.round(10.5 / (board.face + gap)));
  const seatW = nSeat * board.face + (nSeat - 1) * gap;
  const stepIn = 6;
  const W = topW + 2 * (stepIn + seatW);
  const inset = Math.round(Math.min(12, len * 0.15));
  const reach = allowSpanIn(bt, "person");
  let frames = 2;
  while ((len - 2 * inset - 3 * frames) / (frames - 1) > reach && frames < 5) frames++;
  const frameZ = Array.from({ length: frames }, (_, i) => inset + ((len - 2 * inset - 3) * i) / (frames - 1));
  const legW = 5.5;
  const h = H - bt;
  const topOuter = topW / 2 - 1;
  const footOuter = topW / 2 + stepIn + seatW * 0.65;
  const run = footOuter - topOuter;
  const legLen = Math.hypot(run, h);
  const across = legW * (legLen / h);
  const angle = Math.round((Math.atan2(h, run) * 180) / Math.PI);
  const panels: Panel[] = [];
  frameZ.forEach((z0, k) => {
    const end = frames === 2 ? (k ? "far end" : "near end") : k === 0 ? "near end" : k === frames - 1 ? "far end" : frames === 3 ? "middle" : `middle ${k}`;
    // Legs on the frame's outer face, cleat and seat support on the face toward the middle of the table.
    const legZ = k === frames - 1 ? z0 + 1.5 : z0;
    const railZ = k === frames - 1 ? z0 : z0 + 1.5;
    for (const side of [-1, 1] as const) {
      const outerTop = side * topOuter;
      const outerFoot = side * footOuter;
      const innerTop = outerTop - side * across;
      const innerFoot = outerFoot - side * across;
      const minX = Math.min(innerTop, outerFoot, innerFoot, outerTop);
      const maxX = Math.max(innerTop, outerFoot, innerFoot, outerTop);
      const pts: [number, number][] = side > 0
        ? [[innerFoot - minX, 0], [outerFoot - minX, 0], [outerTop - minX, h], [innerTop - minX, h]]
        : [[outerFoot - minX, 0], [innerFoot - minX, 0], [innerTop - minX, h], [outerTop - minX, h]];
      panels.push(
        panel("upright", `Leg ${end} ${side < 0 ? "left" : "right"}`, minX, 0, legZ, maxX - minX, h, 1.5, L.two6, {
          polygon: { plane: "xy", pts },
          blank: { lengthIn: Math.ceil((legLen + legW * (run / h)) * 8) / 8, widthIn: legW, thicknessIn: 1.5 },
          cutNote: `Cut ${inchFrac(legLen)}" long with both ends at ${angle}° — flat on the ground, flat under the top.`,
        }),
      );
    }
    panels.push(panel("rail", `Top cleat ${end}`, -(topW / 2 - 0.5), h - 3.5, railZ, topW - 1, 3.5, 1.5, L.two4));
    panels.push(panel("rail", `Seat support ${end}`, -W / 2, seatTop - bt - 5.5, railZ, W, 5.5, 1.5, L.two6));
  });
  // Center brace: on edge under the middle of the top, cleat to cleat.
  for (let k = 0; k < frames - 1; k++) {
    // From this frame's cleat to the next one's (the far frame's cleat faces in, on its near face).
    const a = frameZ[k] + 3;
    const b = frameZ[k + 1] + (k + 1 === frames - 1 ? 0 : 1.5);
    panels.push(panel("rail", "Center brace", -0.75, h - 3.5, a, 1.5, 3.5, b - a, L.two4));
  }
  for (let i = 0; i < nTop; i++) {
    panels.push(panel("deck", `Tabletop board ${i + 1}`, -topW / 2 + i * (board.face + gap), h, 0, board.face, bt, len, board.id));
  }
  for (const side of [-1, 1] as const) {
    const label = side < 0 ? "Left seat board" : "Right seat board";
    for (let i = 0; i < nSeat; i++) {
      const x = side < 0 ? -W / 2 + i * (board.face + gap) : topW / 2 + stepIn + i * (board.face + gap);
      panels.push(panel("deck", `${label} ${i + 1}`, x, seatTop - bt, 0, board.face, bt, len, board.id));
    }
  }
  const name = `Picnic table ${ft(len)} × ${inchFrac(H)}" tall`;
  const notTyped = board.id !== L.two6 ? ` Not ${board.label}: the A-frame legs and seat supports stay 2×6 and the cleats and center brace 2×4 — the legs and supports carry the whole load.` : "";
  const notes = [
    `${name}: ${nTop} ${board.label} top boards (${inchFrac(topW)}" wide) and ${nSeat} ${board.label} seat boards per side, ¼" gaps, top ${inchFrac(H)}" and seats ${seatTop}" high, the seats ${stepIn}" out from the top's edge so you can step in and sit.`,
    `Each of the ${frames} A-frames: two 2×6 legs splayed ${inchFrac(footOuter * 2)}" apart at the floor and meeting under the top, a 2×4 top cleat under the top boards and a 2×6 seat support under both seats, held to both legs with ${frames * 6} 3/8" carriage bolts in all — two through each leg at the seat support and one at the top cleat.${frames > 2 ? ` The ${frames - 2 === 1 ? "middle frame keeps" : "middle frames keep"} every seat span within ${inchFrac(reach)}", what 1 1/2" stock holds for a person.` : ""}`,
    `A 2×4 center brace on edge runs under the middle of the top from cleat to cleat and keeps the frames from racking.${notTyped}`,
    "Screw each board down to every cleat and seat support it crosses, 2 exterior screws per crossing. Pressure-treated or cedar lumber. Guidance only.",
  ];
  return project(prompt, name, panels, W, H, len, notes, board.id);
}

export function buildOutdoorFrame(prompt: string, kind: OutdoorFrame, size?: { width: number; height: number; depth: number }): YardProject {
  if (kind === "picnic") return buildPicnicTable(prompt, size);
  return kind === "deck" ? buildDeck(prompt, size) : kind === "gate" ? buildGate(prompt, size) : kind === "sawhorse" ? buildSawhorse(prompt, size) : buildSwingSet(prompt, size);
}
