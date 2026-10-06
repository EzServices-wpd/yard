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
import { purposeOf, type Purpose } from "./purpose";
import { panelWorldCorners } from "./geometry";

export type OutdoorFrame = "deck" | "gate" | "swing-set" | "sawhorse" | "picnic" | "enclosure" | "shed";

/** Outdoor shed words: firewood shed / log store / wood store / tool or garden shed / lean-to. */
const SHED = /\b(?:wood|tool|log)sheds?\b|\bsheds?\b(?!\s*(?:shel\w*|doors?|ramps?|workbench\w*|bench\w*|windows?|organi[sz]\w*|racks?|cabinets?|storage|base|foundation|floor|roof|kit|plans?|hooks?|lights?))|\b(?:log|wood|firewood)\s+(?:stores?|shelters?)\b|\blean[-\s]?to\b(?!\s*(?:shel\w*|ladders?|desks?|bookcases?|mirrors?|racks?))/;
/** Shed words that store firewood: an open front, slatted sides and floor for airflow. */
const WOOD_SHED = /\b(?:fire)?wood\s*(?:sheds?|stores?|shelters?)\b|\blogs?\b|\bfirewood\b/;

const CRAFT = /popsicle|craft\s*sticks?|toothpicks?|skewers?|cardboard|chipboard|lego|\bstraws?\b|balsa|dowels?|pipe\s*cleaners?|paper|foam|clay/;
const MODEL = /\b(?:doll|dollhouse|barbie|miniature|mini|model|toy|tiny|figurine|ornament|scale|diorama|fairy|desk\s*top|tabletop)\b/;

const L = { one4: "lumber-1x4-8", two4: "lumber-2x4-8", two6: "lumber-2x6-8", two8: "lumber-2x8-8", two10: "lumber-2x10-8", two12: "lumber-2x12-8", post4: "lumber-4x4-8", one6: "lumber-1x6-8" };

/** The class, when the prompt names one of these frames and no craft stock or model scale. */
export function outdoorFrameKind(prompt: string, materialOverride?: string): OutdoorFrame | null {
  const lower = prompt.toLowerCase();
  // "Mini / small sawhorse" is a real low shop sawhorse, not a model.
  const scale = lower.replace(/\b(?:mini|small|low|short)\s+(?=saw\s*horses?\b)/, "");
  if (CRAFT.test(`${lower} ${materialOverride ?? ""}`) || MODEL.test(scale)) return null;
  if (materialOverride && !/^lumber-|^plywood-/.test(materialOverride)) return null;
  if (/\bsaw\s*horses?\b/.test(lower)) return "sawhorse";
  if (/\bpicnic\s+tables?\b/.test(lower) && !/\bbench(?:es)?\b.*\bseparate\b/.test(lower)) return "picnic";
  // An enclosure for an outdoor item one bay each (garbage bins, bikes): posts, slatted walls, a lid and doors.
  const forItem = purposeOf(lower);
  if (forItem?.item.outdoor && forItem.item.perBay && /\b(?:enclosures?|corrals?|surrounds?|hideaways?)\b/.test(lower)) return "enclosure";
  if (SHED.test(lower)) return "shed";
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

/** Typed board for the enclosure ("from 2x4", "1x6 slats"); null when none was typed. */
function typedBoard(lower: string): { id: string; t: number; face: number; label: string } | null {
  const m = lower.match(/\b([12])\s*x\s*(4|6)\b/);
  if (!m) return null;
  const t = m[1] === "1" ? 0.75 : 1.5;
  const face = m[2] === "4" ? 3.5 : 5.5;
  const id = `lumber-${m[1]}x${m[2]}-8`;
  return { id, t, face, label: `${m[1]}×${m[2]}` };
}

/**
 * An enclosure with one bay per stored item: a post at every bay line front and back, top and
 * bottom rails between them, slats on the back and both ends, an overlay slat door on the front
 * of each bay and a slat lid on top of each bay, hinged at the back. The bay is the item plus
 * working room (2" a side, 4" over the top), so a 24×28×46 bin rolls in and its lid opens.
 */
export function buildEnclosure(prompt: string, purpose: Purpose, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const n = purpose.count;
  const item = purpose.item;
  const typed = typedBoard(lower);
  const frameId = typed?.t === 1.5 ? typed.id : L.two4;
  const postId = typed?.t === 1.5 ? typed.id : L.post4;
  const slat = typed ?? { id: L.one6, t: 0.75, face: 5.5, label: "1×6" };
  const pw = postId === L.post4 ? 3.5 : 1.5;
  const pd = 3.5;
  const st = slat.t;
  const g = 0.5;
  const bayW = (item.clear.w ?? 24) + 4;
  const bayD = item.clear.d + 4;
  const H = Math.max(item.clear.h + 4, size?.height ?? 0);
  const innerW = n * bayW + (n + 1) * pw;
  const x0 = st;
  const zB = st;
  const zF = zB + pd + bayD;
  const W = innerW + 2 * st;
  const D = zF + pd + st;
  const rail = 3.5;
  const panels: Panel[] = [];
  const postX = Array.from({ length: n + 1 }, (_, k) => x0 + k * (bayW + pw));
  const sideName = (k: number) => (k === 0 ? "left" : k === n ? "right" : `${k}`);
  for (let k = 0; k <= n; k++) {
    panels.push(panel("upright", `Back post ${sideName(k)}`, postX[k], 0, zB, pw, H, pd, postId));
    panels.push(panel("upright", `Front post ${sideName(k)}`, postX[k], 0, zF, pw, H, pd, postId));
  }
  for (let b = 0; b < n; b++) {
    const xa = postX[b] + pw;
    const tag = n === 1 ? "" : ` ${b + 1}`;
    panels.push(panel("rail", `Back bottom rail${tag}`, xa, 4, zB, bayW, rail, 1.5, frameId));
    panels.push(panel("rail", `Back top rail${tag}`, xa, H - rail, zB, bayW, rail, 1.5, frameId));
    panels.push(panel("rail", `Front top rail${tag}`, xa, H - rail, zF + pd - 1.5, bayW, rail, 1.5, frameId));
  }
  for (let k = 0; k <= n; k++) {
    const x = k === 0 ? postX[0] : k === n ? postX[n] + pw - 1.5 : postX[k] + pw / 2 - 0.75;
    const what = k === 0 ? "Left" : k === n ? "Right" : "Divider";
    const tag = k > 0 && k < n && n > 2 ? ` ${k}` : "";
    panels.push(panel("rail", `${what} bottom rail${tag}`, x, 4, zB + pd, 1.5, rail, bayD, frameId));
    panels.push(panel("rail", `${what} top rail${tag}`, x, H - rail, zB + pd, 1.5, rail, bayD, frameId));
  }
  // Slats spread evenly over a run, about a 1/2" apart.
  const spread = (len: number) => {
    const c = Math.max(2, Math.floor((len + g) / (slat.face + g)));
    const gap = (len - c * slat.face) / (c - 1);
    return Array.from({ length: c }, (_, i) => i * (slat.face + gap));
  };
  // Slats stop 1/4" under the top, so the lid closes on the posts and rails.
  const slatH = H - 2.25;
  spread(innerW).forEach((at, i) => panels.push(panel("side", `Back slat ${i + 1}`, x0 + at, 2, 0, slat.face, slatH, st, slat.id)));
  const sideRun = zF + pd - zB;
  for (const [side, x] of [["Left", 0], ["Right", x0 + innerW]] as const)
    spread(sideRun).forEach((at, i) => panels.push(panel("side", `${side} end slat ${i + 1}`, x, 2, zB + at, st, slatH, slat.face, slat.id)));
  // Doors overlay the front posts, half a post each side less 1/16"; lids sit on the posts and top rails.
  const doorH = H - rail - 0.25 - 2;
  for (let b = 0; b < n; b++) {
    const xa = postX[b] + pw / 2 + 1 / 16;
    const dw = postX[b + 1] + pw / 2 - 1 / 16 - xa;
    const tag = n === 1 ? "" : ` ${b + 1}`;
    spread(dw).forEach((at, i) => panels.push(panel("side", `Door${tag} slat ${i + 1}`, xa + at, 2, zF + pd, slat.face, doorH, st, slat.id)));
    for (const [nm, y] of [["bottom", 6], ["top", 2 + doorH - 4 - slat.face]] as const)
      panels.push(panel("cleat", `Door${tag} ${nm} batten`, postX[b] + pw + 0.25, y, zF + pd - st, bayW - 0.5, slat.face, st, slat.id));
    const lw = dw;
    spread(lw).forEach((at, i) => panels.push(panel("side", `Lid${tag} board ${i + 1}`, xa + at, H, -1, slat.face, st, D + 2, slat.id)));
    // Lid battens sit just inside the back and front top rails, so the closed lid bears on the rails.
    for (const [nm, z] of [["back", zB + 1.5], ["front", zF + pd - 1.5 - slat.face]] as const)
      panels.push(panel("cleat", `Lid${tag} ${nm} batten`, postX[b] + pw + 0.25, H - st, z, bayW - 0.5, st, slat.face, slat.id));
  }
  const hinges = 2 * n + 2 * n;
  const one = purpose.word.split(" ").pop()!;
  const name = `${purpose.word.charAt(0).toUpperCase()}${purpose.word.slice(1)} enclosure for ${n} ${n === 1 ? one : `${one}s`} ${inchFrac(W)}" × ${inchFrac(H)}"`;
  const notes = [
    `${name}: one bay per ${purpose.word}, ${inchFrac(bayW)}" wide × ${inchFrac(bayD)}" deep × ${inchFrac(H)}" tall inside — a ${item.clear.w ?? 24}×${item.clear.d}×${item.clear.h}" ${purpose.word} plus 2" each side and 4" over the top so it rolls in and its own lid opens.`,
    `Frame: ${pw === 3.5 ? "4×4" : (typed?.label ?? "2×4")} posts at every bay line front and back, ${typed?.t === 1.5 ? typed.label : "2×4"} top and bottom rails between them; ${slat.label} slats ${inchFrac(g)}" apart on the back and both ends, screwed to the rails.`,
    `Each bay gets an overlay door of ${slat.label} slats on two battens and a slat lid on two battens: ${hinges} 6" T-hinges in all, two on each door at the post and two on each lid at the back top rail, and ${n} gravity latches, one per door.`,
    "Set the posts on pavers or a slab, level. Exterior screws, pressure-treated or cedar lumber. Guidance only.",
  ];
  return project(prompt, name, panels, W, H + st, D, notes, slat.id, "display");
}

/** A typed size on a shed: a bare number under 20 is feet ("6 wide"), otherwise inches unless marked ft. */
function shedAxis(lower: string, word: RegExp): number | null {
  const m = lower.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*('|ft|foot|feet|"|in|inch|inches)?\s*(?:${word.source})`));
  if (!m) return null;
  const v = Number(m[1]);
  return /'|ft|foot|feet/.test(m[2] ?? "") || (!m[2] && v < 20) ? v * 12 : v;
}

/** A board standing in a side plane (z along the ground, y up), x from xa to xa + t: an xy outline turned 90° about Y. */
function yzPanel(type: Panel["type"], name: string, xa: number, t: number, pts: [number, number][], materialId: string, extra: Partial<Panel> = {}): Panel {
  const zs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const [zMin, zMax, yMin, yMax] = [Math.min(...zs), Math.max(...zs), Math.min(...ys), Math.max(...ys)];
  const w = zMax - zMin;
  const cx = xa + t / 2;
  const cz = (zMin + zMax) / 2;
  return panel(type, name, cx - w / 2, yMin, cz - t / 2, w, yMax - yMin, t, materialId, {
    yaw: Math.PI / 2,
    polygon: { plane: "xy", pts: pts.map(([z, y]) => [zMax - z, y - yMin] as [number, number]) },
    ...extra,
  });
}

const lumber = (n: string) => `lumber-${n}-8`;
const faceOf = (n: string) => ({ 2: 1.5, 3: 2.5, 4: 3.5, 6: 5.5, 8: 7.25 })[Number(n.split("x")[1]) as 2] ?? 3.5;
const label = (n: string) => n.replace("x", "×");

/**
 * Outdoor shed with a single-slope (lean-to) roof, built the way sheds are: skids on pavers, posts standing
 * on the skids at every corner, floor joists across the skids with floor boards on top, girts between the
 * posts carrying the wall boards, doubled headers on the post tops, rafters notched over both headers and
 * roof boards on the rafters. A firewood shed (wood shed, log store) keeps its front open and spaces every
 * board 1" apart so the wood dries; a tool or garden shed boards in tight with a hinged board door.
 * Typed stock drives the members: a 2× board frames it (posts doubled), a 1× board makes the slats.
 */
export function buildShed(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const open = WOOD_SHED.test(lower) && !/\bwooden\s+sheds?\b/.test(lower.replace(/\b(?:fire|log)\w*/g, ""));
  const typed = [...lower.matchAll(/\b([124])\s*[x×]\s*(2|3|4|6|8)\b(?!\s*(?:'|ft\b|foot|feet|sheds?\b))/g)].map((m) => `${m[1]}x${m[2]}`);
  const two = typed.find((t) => /^2x[46]$/.test(t));
  const one = typed.find((t) => /^1x[46]$/.test(t));
  const post4 = typed.includes("4x4") || !two;
  const frameN = two ?? "2x4";
  const fd = faceOf(frameN);
  const frameId = lumber(frameN);
  const slatN = one ?? (two && !typed.includes("4x4") ? two : "1x6");
  const slatId = lumber(slatN);
  const st = slatN.startsWith("1") ? 0.75 : 1.5;
  const sf = faceOf(slatN);
  const floorN = one ?? frameN;
  const floorId = lumber(floorN);
  const ft_ = floorN.startsWith("1") ? 0.75 : 1.5;
  const ff = faceOf(floorN);
  const roofN = one ?? "1x6";
  const roofId = lumber(roofN);
  const bt = 0.75;
  const rf = faceOf(roofN);
  // Posts: one 4×4, or two 2× plies face to face.
  const pw = post4 ? 3.5 : 3;
  const pd = post4 ? 3.5 : fd;
  const postId = post4 ? L.post4 : frameId;
  const sk = post4 ? 3.5 : fd;
  const skidId = post4 ? L.post4 : frameId;
  // Size: typed width and depth are the floor footprint; typed height is the overall height at the front.
  const clean = lower.replace(/\b[124]\s*[x×]\s*(?:2|3|4|6|8|10|12)s?\b(?!\s*(?:'|ft\b|foot|feet|sheds?\b))/g, " ");
  const pair = feetPair(clean);
  const ovF = open ? 8 : 6;
  const ovS = 3;
  const ovB = 2;
  const W = Math.max(36, Math.min(144, size ? size.width - 2 * ovS : shedAxis(clean, /wide|width|long|length/) ?? pair?.[0] ?? 72));
  const D = Math.max(24, Math.min(96, size ? size.depth - ovF - ovB : shedAxis(clean, /deep|depth/) ?? pair?.[1] ?? (open ? 40 : 48)));
  const H = Math.max(48, Math.min(100, size?.height ?? shedAxis(clean, /tall|high|height/) ?? (open ? 72 : 90)));
  const s = 0.25; // 3-in-12 slope, high at the front, shedding rain to the back
  const cos = 1 / Math.hypot(1, s);
  const sin = s * cos;
  const rv = fd / cos;
  const zB = st;
  const zF = D - pd - (open ? 0 : st);
  const zFace = zF + pd;
  const zE = zFace + ovF;
  const hfTop = H - s * ovF - (fd + bt) / cos;
  const hbTop = hfTop - s * (zFace - zB - 3);
  const Lr = (z: number) => hfTop + s * (z - zFace); // rafter underside line
  const T = (z: number) => Lr(z) + rv; // rafter top = underside of the roof boards
  const floorY = sk + fd;
  const floorTop = floorY + ft_;
  const panels: Panel[] = [];
  // Posts: corners, plus middle posts so no header or skid runs more than 6' between posts; a tool shed adds door posts.
  const nX = Math.max(2, Math.ceil((W - 2 * st - pw) / 72) + 1);
  const cols = Array.from({ length: nX }, (_, k) => st + (k * (W - 2 * st - pw)) / (nX - 1));
  const doorW = open ? 0 : Math.min(32, W - 2 * (st + pw) - 2 * pw - 12);
  const doorCols = open || doorW < 20 ? [] : [W / 2 - doorW / 2 - pw, W / 2 + doorW / 2];
  type Post = { name: string; x: number; z: number };
  const posts: Post[] = [];
  const colName = (k: number) => (k === 0 ? "left" : k === nX - 1 ? "right" : nX === 3 ? "middle" : `middle ${k}`);
  cols.forEach((x, k) => {
    posts.push({ name: `Back post ${colName(k)}`, x, z: zB });
    if (!doorCols.some((d) => Math.abs(d - x) < pw + 2)) posts.push({ name: `Front post ${colName(k)}`, x, z: zF });
  });
  doorCols.forEach((x, k) => posts.push({ name: `Door post ${k ? "right" : "left"}`, x, z: zF }));
  const postH = (p: Post) => (p.z === zB ? hbTop - fd : hfTop - fd) - sk;
  for (const p of posts) {
    if (post4) panels.push(panel("upright", p.name, p.x, sk, p.z, pw, postH(p), pd, postId));
    else for (const [i, ply] of (["outer", "inner"] as const).entries()) panels.push(panel("upright", `${p.name} ${ply}`, p.x + 1.5 * i, sk, p.z, 1.5, postH(p), pd, postId));
  }
  // Skids on pavers under each row of posts (a middle skid when the joists would run past 4').
  const centres = cols.map((x) => x + pw / 2);
  const skidZs: [string, number][] = [["Back", zB], ...(zFace - zB > 60 ? [["Middle", (zB + zFace) / 2 - 1.75] as [string, number]] : []), ["Front", zFace - (post4 ? 3.5 : 3)]];
  for (const [nm, z] of skidZs) {
    const pieces = splitRun(st, W - st, centres);
    pieces.forEach(([a, e], i) => {
      const tag = sp(placeWord(pieces.length, i, "x"));
      if (post4) panels.push(panel("rail", `${nm} skid${tag}`, a, 0, z, e - a, sk, 3.5, skidId));
      else for (const [k, ply] of (["outer", "inner"] as const).entries()) panels.push(panel("rail", `${nm} skid${tag} ${ply}`, a, 0, z + 1.5 * k, e - a, sk, 1.5, skidId));
    });
  }
  // Floor joists across the skids, front to back, at 16" on centre under 1× boards or 24" under 2×, one beside every post.
  const oc = ft_ < 1 ? 16 : 24;
  const blocks = posts.map((p) => [p.x, p.x + pw] as [number, number]).sort((a, b) => a[0] - b[0]);
  const bays: [number, number][] = [];
  let at = st;
  for (const [a, b] of blocks) {
    if (a - at >= 1.5) bays.push([at, a]);
    at = Math.max(at, b);
  }
  if (W - st - at >= 1.5) bays.push([at, W - st]);
  const joistXs: number[] = [];
  for (const [a, b] of bays) {
    const n = b - a < 3 ? 1 : Math.max(2, Math.ceil((b - a - 1.5) / oc) + 1);
    for (let i = 0; i < n; i++) joistXs.push(n === 1 ? a : a + ((b - a - 1.5) * i) / (n - 1));
  }
  joistXs.forEach((x, i) => panels.push(panel("rail", `Floor joist ${i + 1}`, x, sk, zB, 1.5, fd, zFace - zB, frameId)));
  // Side girts between the back and front posts carry the end boards: one at floor level, one halfway up.
  const midY = (floorTop + hbTop - fd) / 2 - 1.75;
  for (const [side, x] of [["Left", st], ["Right", W - st - 1.5]] as const) {
    panels.push(panel("rail", `${side} bottom girt`, x, sk, zB + pd, 1.5, fd, zF - zB - pd, frameId));
    panels.push(panel("rail", `${side} middle girt`, x, midY, zB + pd, 1.5, 3.5, zF - zB - pd, frameId));
  }
  const between = (z: number) => posts.filter((p) => p.z === z).map((p) => p.x).sort((a, b) => a - b);
  const backXs = between(zB);
  backXs.slice(0, -1).forEach((x, k) => panels.push(panel("rail", `Back middle girt${backXs.length > 2 ? ` ${k + 1}` : ""}`, x + pw, midY, zB, backXs[k + 1] - x - pw, 3.5, 1.5, frameId)));
  if (!open) {
    const frontXs = between(zF);
    frontXs.slice(0, -1).forEach((x, k) => {
      if (doorCols.length && Math.abs(x - doorCols[0]) < 0.01) return; // the door opening
      panels.push(panel("rail", `Front middle girt${frontXs.length > 2 ? ` ${k + 1}` : ""}`, x + pw, midY, zFace - 1.5, frontXs[k + 1] - x - pw, 3.5, 1.5, frameId));
    });
  }
  // Floor boards across the joists, 1" apart in a firewood shed for airflow, 1/4" in a tool shed; each row stops at the posts it meets.
  const fg = open ? 1 : 0.25;
  const rows = Math.max(1, Math.floor((zFace - zB + fg) / (ff + fg)));
  const rowGap = rows > 1 ? (zFace - zB - rows * ff) / (rows - 1) : 0;
  const joistCs = joistXs.map((x) => x + 0.75);
  for (let r = 0; r < rows; r++) {
    const z = zB + r * (ff + rowGap);
    const hit = posts.filter((p) => p.z < z + ff - 0.01 && p.z + pd > z + 0.01).map((p) => [p.x, p.x + pw] as [number, number]).sort((a, b) => a[0] - b[0]);
    // Rows clear of the posts stop 1/4" shy of the end boards so water drains past them.
    const runs: [number, number][] = [];
    let x0 = st + 0.25;
    for (const [a, b] of hit) {
      if (a - x0 >= 2) runs.push([x0, a]);
      x0 = Math.max(x0, b);
    }
    if (W - st - 0.25 - x0 >= 2) runs.push([x0, W - st - (x0 > W - st - pw - 0.01 ? 0 : 0.25)]);
    const pieces = runs.flatMap(([a, b]) => splitRun(a, b, joistCs));
    pieces.forEach(([a, e], i) => panels.push(panel("deck", `Floor board ${r + 1}${sp(placeWord(pieces.length, i, "x"))}`, a, floorY, z, e - a, ft_, ff, floorId)));
  }
  // Doubled headers on the post tops, front and back, flush with the outside face; each ply breaks over a post.
  for (const [nm, top, z] of [["Front", hfTop, zFace - 3], ["Back", hbTop, zB]] as const) {
    for (const [k, ply] of (["inner", "outer"] as const).entries()) {
      const pieces = splitRun(st, W - st, centres);
      const zz = nm === "Front" ? z + 1.5 * k : z + 1.5 * (1 - k);
      pieces.forEach(([a, e], i) => panels.push(panel("rail", `${nm} header${sp(placeWord(pieces.length, i, "x"))} ${ply}`, a, top - fd, zz, e - a, fd, 1.5, frameId)));
    }
  }
  // Rafters front to back at 24" on centre, notched over both headers, overhanging the front.
  const nR = Math.max(2, Math.ceil((W - 2 * st - 1.5) / 24) + 1);
  const rafterXs = Array.from({ length: nR }, (_, i) => st + ((W - 2 * st - 1.5) * i) / (nR - 1));
  const rafterPts: [number, number][] = [
    [zB, T(zB)], [zB, hbTop], [zB + 3, hbTop], [zFace - 3, Lr(zFace - 3)], [zFace - 3, hfTop], [zFace, hfTop], [zE, Lr(zE)], [zE, T(zE)],
  ];
  const angle = Math.round((Math.atan(s) * 180) / Math.PI);
  const rafterLen = Math.ceil(((zE - zB) / cos + fd * sin) * 8) / 8;
  rafterXs.forEach((x, i) =>
    panels.push(yzPanel("rail", `Rafter ${i + 1}`, x, 1.5, rafterPts, frameId, {
      blank: { lengthIn: rafterLen, widthIn: fd, thicknessIn: 1.5 },
      cutNote: `Cut ${inchFrac(rafterLen)}" long, both ends plumb at ${angle}°, with a 3" seat notched where it sits on each header.`,
    })),
  );
  // Roof boards side by side down the slope, from a 2" back overhang to the front overhang, 3" past each end.
  const z0 = -ovB;
  const slopeLen = (zE - z0) / cos;
  const nB = Math.ceil(slopeLen / rf - 0.05);
  const rafterCs = rafterXs.map((x) => x + 0.75);
  for (let i = 0; i < nB; i++) {
    const w = Math.min(rf, slopeLen - i * rf);
    if (w < 1) break;
    const pz = z0 + i * rf * cos;
    const py = T(z0) + i * rf * sin;
    const pts: [number, number][] = [[pz, py], [pz + w * cos, py + w * sin], [pz + w * cos - bt * sin, py + w * sin + bt * cos], [pz - bt * sin, py + bt * cos]];
    const pieces = splitRun(-ovS, W + ovS, rafterCs);
    pieces.forEach(([a, e], k) =>
      panels.push({
        ...yzPanel("top", `Roof board ${i + 1}${sp(placeWord(pieces.length, k, "x"))}`, a, e - a, pts, roofId, {
          blank: { lengthIn: Math.ceil((e - a) * 8) / 8, widthIn: Math.round(w * 8) / 8, thicknessIn: bt },
          ...(w < rf - 0.1 ? { cutNote: `Rip to ${inchFrac(w)}" wide for the last course at the ridge.` } : {}),
        }),
      }),
    );
  }
  // Wall boards: the back across the full width, the ends from the back boards to the front face (to the front boards on a tool shed).
  const g = open ? 1 : 0.125;
  const spread = (len: number) => {
    const c = Math.max(1, Math.floor((len + g) / (sf + g)));
    const gap = c > 1 ? (len - c * sf) / (c - 1) : 0;
    return Array.from({ length: c }, (_, i) => i * (sf + gap));
  };
  const backTop = T(0);
  spread(W).forEach((x, i) => panels.push(panel("side", `Back board ${i + 1}`, x, 1, 0, sf, backTop - 1, st, slatId)));
  for (const [side, x] of [["Left", 0], ["Right", W - st]] as const)
    spread(zFace - zB).forEach((z, i) => {
      const a = zB + z;
      const b = a + sf;
      panels.push(yzPanel("side", `${side} end board ${i + 1}`, x, st, [[a, 1], [b, 1], [b, T(b)], [a, T(a)]], slatId, {
        blank: { lengthIn: Math.ceil((T(b) - 1) * 8) / 8, widthIn: sf, thicknessIn: st },
        cutNote: `Cut the top at ${angle}° to follow the roof.`,
      }));
    });
  if (!open) {
    const dl = doorCols.length ? doorCols[0] + pw / 2 + 1 / 16 : W;
    const dr = doorCols.length ? doorCols[1] + pw / 2 - 1 / 16 : W;
    for (const [nm, a, b] of [["Front board", 0, dl], ["Front board right", dr, W]] as const) {
      if (b - a < sf) continue;
      spread(b - a).forEach((x, i) => panels.push(panel("side", `${nm} ${i + 1}`, a + x, 1, zFace, sf, hfTop - 1, st, slatId)));
    }
    if (doorCols.length) {
      const doorTop = hfTop - fd - 0.25;
      const dw = dr - dl;
      const c = Math.max(2, Math.round(dw / sf));
      const bw = dw / c;
      for (let i = 0; i < c; i++) panels.push(panel("side", `Door board ${i + 1}`, dl + i * bw, floorY, zFace, bw, doorTop - floorY, st, slatId));
      for (const [nm, y] of [["bottom", floorTop + 4], ["top", doorTop - 4 - sf]] as const)
        panels.push(panel("cleat", `Door ${nm} batten`, doorCols[0] + pw + 0.25, y, zFace - st, doorW - 0.5, sf, st, slatId));
    }
  }
  // Overall: the real extents, roof overhangs included.
  const bb = panels.flatMap((p) => panelWorldCorners(p));
  const minX = Math.min(...bb.map((q) => q.x));
  const minZ = Math.min(...bb.map((q) => q.z));
  for (const p of panels) {
    p.position.x -= minX;
    p.position.z -= minZ;
  }
  const r16 = (n: number) => Math.round(n * 16) / 16;
  const OW = r16(Math.max(...bb.map((q) => q.x)) - minX);
  const OD = r16(Math.max(...bb.map((q) => q.z)) - minZ);
  const OH = r16(Math.max(...bb.map((q) => q.y)));
  const head = (lower.match(/\b(?:firewood|wood|log|tool|garden|storage|bike|potting)\s*(?:sheds?|stores?|shelters?)\b|\b(?:wood|tool|log)sheds?\b|\blean[-\s]?to(?:\s+sheds?)?\b/)?.[0] ?? "shed").replace(/s$/, "").replace(/\s+/g, " ");
  const title = head.charAt(0).toUpperCase() + head.slice(1);
  const name = `${title} ${ft(W)} × ${ft(D)}`;
  const postTalk = post4 ? "4×4" : `doubled ${label(frameN)}`;
  const nPosts = posts.length;
  const stackW = W - 2 * (st + pw);
  const logRows = Math.max(1, Math.floor((zFace - zB) / 16));
  const stackH = hbTop - fd - floorTop;
  const cuFt = (stackW * logRows * 16 * stackH) / 1728;
  const faceCords = Math.round((cuFt / 42.67) * 4) / 4;
  const cord = Math.round((cuFt / 128) * 100) / 100;
  const notes = [
    open
      ? `${name}: a single-slope roof over a raised slatted floor, open at the front for loading. ${nPosts} ${postTalk} posts stand on ${post4 ? "4×4" : `doubled ${label(frameN)}`} skids laid on concrete pavers, ${label(frameN)} floor joists run front to back across the skids at ${oc}" on centre, and ${label(floorN)} floor boards sit 1" apart on top, ${inchFrac(floorTop)}" off the ground so air moves under the wood.`
      : `${name}: a single-slope roof over a raised board floor. ${nPosts} ${postTalk} posts stand on ${post4 ? "4×4" : `doubled ${label(frameN)}`} skids laid on concrete pavers, ${label(frameN)} floor joists run front to back across the skids at ${oc}" on centre, and ${label(floorN)} floor boards sit on top, ${inchFrac(floorTop)}" off the ground.`,
    `Walls: ${label(frameN)} girts between the posts carry ${label(slatN)} boards on the back and both ends${open ? `, spaced 1" apart so the stack dries` : " and across the front"}; the end boards are cut along the roof slope.${!open && doorCols.length ? ` A ${inchFrac(doorW)}" door of ${label(slatN)} boards on two battens hangs on two 8" T-hinges from the door post, with a hasp on the other side.` : ""}`,
    `Roof: ${nR} ${label(frameN)} rafters at 24" on centre sit notched over doubled ${label(frameN)} headers, ${inchFrac(hfTop)}" up at the front and ${inchFrac(hbTop)}" at the back (a 3-in-12 slope that sheds rain to the back), with ${label(roofN)} roof boards under corrugated metal or asphalt roofing, overhanging ${ovF}" at the front, ${ovB}" at the back and ${ovS}" at each end.`,
    ...(open ? [`Holds two rows of 16" logs stacked ${inchFrac(Math.max(0, stackH))}" high across ${inchFrac(stackW)}": about ${faceCords} face cords (4' × 8' rows of 16" logs), ${cord} of a full cord.`] : []),
    `Set each paver level on compacted gravel. Pressure-treated lumber rated for ground contact on the skids and posts, exterior screws, and a hurricane tie where each rafter crosses a header. Guidance only.`,
  ];
  return project(prompt, name, panels, OW, OH, OD, notes, frameId);
}

export function buildOutdoorFrame(prompt: string, kind: OutdoorFrame, size?: { width: number; height: number; depth: number }): YardProject {
  if (kind === "shed") return buildShed(prompt, size);
  if (kind === "picnic") return buildPicnicTable(prompt, size);
  if (kind === "enclosure") return buildEnclosure(prompt, purposeOf(prompt.toLowerCase())!, size);
  return kind === "deck" ? buildDeck(prompt, size) : kind === "gate" ? buildGate(prompt, size) : kind === "sawhorse" ? buildSawhorse(prompt, size) : buildSwingSet(prompt, size);
}
