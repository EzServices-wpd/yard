/**
 * Odd-shape class pack — house builds whose footprint or face is not a plain rectangle.
 *
 * Engine-wide rule (Ezra 2026-09-28): a typed shape is never silently collapsed to a box.
 * One shared vocabulary covers every shape here:
 *   - Panel.polygon: a flat plate whose real outline is a polygon (in plan = "xz", or in
 *     front view = "xy"), extruded by the panel's thickness. Cut list uses the bounding blank
 *     plus a plain cut note (angle, legs, heights) so a stranger can mark it with a tape.
 *   - Panel.yaw: straight boards set at an angle (angled walls, diagonal fronts, polygon rings).
 *
 * Classes (each a shared standard, not one noun):
 *   l-footprint     desk / bench / banquette / window seat / counter that turns a 90° corner
 *   corner-diagonal corner cabinet / cupboard / TV stand with an angled (45°) front
 *   sloped          bookcase / storage under a sloped ceiling, knee wall, or stairs (raked tops)
 *   wrap-opening    shelves that frame a window or doorway (two towers + a bridge)
 *   angled-corner   corner shelves for an inside corner that is not 90°
 *   outside-corner  shelves that wrap an outside (convex) wall corner
 *   polygon         N-sided planter / plant stand (miter = 180/N), honeycomb hexagon shelves
 */

import { createId } from "@/lib/utils";
import { panelWorldCorners } from "./geometry";
import type { AssemblyStep, FittedProgram, FittedSpec, OddShape, Panel, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";
const BACKER = "plywood-1-4-4x8";
const T = 0.75;

const WORD_NUM: Record<string, number> = {
  one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};
const U = String.raw`\s*(?:in|inch|inches|["″])?`;
const N = String.raw`(\d+(?:\.\d+)?)`;

function num(s: string | undefined | null): number | null {
  if (s == null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function r8(n: number) {
  return Math.round(n * 8) / 8;
}
export function fmtIn(n: number): string {
  return Math.abs(n - Math.round(n)) < 0.01 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}
/** Nearest 1/8" in tape talk. */
export function tape(n: number): string {
  const e = Math.round(n * 8);
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (!rem) return `${whole}"`;
  const g = rem % 4 === 0 ? 4 : rem % 2 === 0 ? 2 : 1;
  const frac = `${rem / g}/${8 / g}`;
  return whole ? `${whole} ${frac}"` : `${frac}"`;
}
function pr(n: number) {
  return tape(n);
}
function deg(n: number) {
  return `${Math.round(n * 10) / 10}°`;
}

// ───────────────────────────── detection ─────────────────────────────

const POLY_WORDS: Record<string, number> = {
  triangle: 3, triangular: 3, pentagon: 5, pentagonal: 5, hexagon: 6, hexagonal: 6, hex: 6,
  heptagon: 7, octagon: 8, octagonal: 8,
};
const POLY_RE = /\b(triangle|triangular|pentagon(?:al)?|hexagon(?:al)?|hex(?=\s+(?:shel|planter|cell|wall))|heptagon|octagon(?:al)?)\b/;
const CRAFT = /\b(?:popsicle|craft\s*sticks?|toothpicks?|lego|paper|cardboard|catapult|climb(?:ing)?|pikler)\b/;

export type OddKind = OddShape["kind"];

export function oddShapeKind(prompt: string): OddKind | null {
  const lower = (prompt || "").toLowerCase();
  if (!lower.trim() || CRAFT.test(lower)) return null;
  const shelfy = /\b(?:book\s*shel(?:f|ves)|bookcases?|shel(?:f|ves|ving)|storage|cubb(?:y|ies)|cabinet|cupboard|built-?ins?)\b/;
  // Polygon ring / stand / honeycomb.
  const poly = lower.match(POLY_RE);
  if (poly) {
    if (/\bhoneycomb\b/.test(lower) || (/\bhex(?:agon(?:al)?)?\b/.test(lower) && /\b(?:wall\s+)?shel(?:f|ves)\b/.test(lower) && !/\bplanter|stand\b/.test(lower))) return "honeycomb";
    if (/\bplanters?\b|\bplanter\s+box|\bgarden\s+bed|\braised\s+bed\b/.test(lower)) return "polygon-planter";
    if (/\bplant\s+stand|\bpedestal\b|\bside\s+table\b|\bstand\b/.test(lower) && !/\bcorner\b/.test(lower)) return "polygon-stand";
  }
  if (/\bhoneycomb\b/.test(lower) && /\bshel/.test(lower)) return "honeycomb";
  // Outside (convex) corner wrap.
  if (/\boutside\s+(?:wall\s+)?corner\b|\bouter\s+corner\b|\bconvex\s+corner\b|\bwraps?\s+(?:around\s+)?(?:an?\s+|the\s+)?(?:outside\s+)?(?:wall\s+)?corner\b|\bwrapping\s+(?:around\s+)?(?:an?\s+|the\s+)?(?:outside\s+)?(?:wall\s+)?corner\b/.test(lower) && /\bshel|\bledge/.test(lower)) {
    return "outside-corner";
  }
  // Non-90 inside corner.
  const angle = lower.match(/\b(\d{2,3})\s*(?:°|deg(?:ree)?s?)\b/);
  if (angle && /\bcorner|\bangled\s+wall|\bwall\b/.test(lower) && /\bshel/.test(lower)) {
    const a = parseFloat(angle[1]);
    if (a !== 90 && a > 20 && a < 170) return "angled-corner";
  }
  // Sloped / raked top: sloped ceiling, attic, knee wall, under stairs.
  if (/\bunder\s+(?:the\s+|a\s+)?(?:stairs?|staircase|stairway|steps)\b|\bstair(?:case)?\s+(?:storage|shel|cabinet|bookcase|cupboard)|\bsloped?\s+(?:ceiling|roof|top)|\bslanted\s+(?:ceiling|roof|top)|\bangled\s+ceiling|\bslope\b|\bknee\s*-?\s*wall|\battic\b|\beaves?\b|\bhigh\s+side\b.*\blow\s+side\b|\blow\s+side\b.*\bhigh\s+side\b/.test(lower) && (shelfy.test(lower) || /\bstorage|\bcloset\b/.test(lower))) {
    return "sloped";
  }
  // Wrap a window or doorway.
  if (/\b(?:around|surround(?:ing)?|frame|framing|over\s+and\s+around|flank(?:ing)?|either\s+side\s+of|both\s+sides\s+of)\s+(?:(?:a|the|my|an)\s+)?(?:\d+\S*\s+(?:wide\s+)?)?(?:window|doorway|door|entry|opening)s?\b/.test(lower) && (shelfy.test(lower) || /\bbuilt-?ins?\b/.test(lower))) {
    return "wrap-opening";
  }
  const cornerCue = /\bcorner\b|\bl[- ]?shaped\b|\bl[- ]shape\b|\bright[- ]angle\b|\bwrap[- ]?around\b/;
  // L-footprint seating / work surfaces.
  if (cornerCue.test(lower) && /\b(?:desks?|workstation|work\s*surface|benches|bench|banquettes?|window\s+seats?|settees?|counters?|countertops?|workbench)\b/.test(lower)) {
    if (/\bl[- ]?shaped\b|\bl[- ]shape\b|\bcorner\b|\bright[- ]angle\b|\bwrap[- ]?around\b/.test(lower)) return "l-footprint";
  }
  // Diagonal-front corner carcase (cabinet / cupboard / TV stand / media console / hutch).
  if (/\bcorner\b/.test(lower) && /\b(?:cabinet|cupboard|hutch|tv\s+stand|tv\s+console|television\s+stand|media\s+(?:console|stand|cabinet|center|unit)|entertainment\s+(?:center|unit)|console|armoire|pantry)\b/.test(lower)) {
    if (!/\bcorner\s+(?:brace|bracket|block|post|guard|bead|clamp)s?\b/.test(lower)) return "corner-diagonal";
  }
  if (/\b(?:diagonal|angled|slanted|45)\s*(?:°|degree)?\s*(?:-|\s)?(?:front(?:ed)?\s+)?corner\b|\bcorner\s+\w*\s*with\s+(?:an?\s+)?(?:angled|diagonal|slanted)\s+front\b/.test(lower)) {
    return "corner-diagonal";
  }
  return null;
}

// ───────────────────────────── parsing helpers ─────────────────────────────

function typedAxis(lower: string, words: string): number | null {
  const m = lower.match(new RegExp(`${N}${U}\\s*(?:-\\s*)?(?:${words})\\b`)) ||
    lower.match(new RegExp(`\\b(?:${words})\\s*(?:of|is|=|:)?\\s*${N}${U}`));
  return m ? num(m[1]) : null;
}
function byPair(lower: string): [number, number] | null {
  const m = lower.match(new RegExp(`${N}${U}\\s*(?:x|×|by)\\s*${N}${U}(?!\\s*(?:x|×|by)\\s*\\d)`));
  return m ? [num(m[1])!, num(m[2])!] : null;
}
function byTriple(lower: string): [number, number, number] | null {
  const m = lower.match(new RegExp(`${N}${U}\\s*(?:x|×|by)\\s*${N}${U}\\s*(?:x|×|by)\\s*${N}${U}`));
  return m ? [num(m[1])!, num(m[2])!, num(m[3])!] : null;
}
function alongEach(lower: string): number | null {
  const m = lower.match(new RegExp(`${N}${U}\\s*(?:along|on|down)?\\s*(?:each|both|either)\\s+(?:wall|side|leg)s?\\b`)) ||
    lower.match(new RegExp(`(?:each|both)\\s+(?:wall|side|leg)s?\\s*(?:of|is|=|:)?\\s*${N}${U}`));
  return m ? num(m[1]) : null;
}
function countOf(lower: string, noun: string): number | null {
  const m = lower.match(new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\\s*(?:-\\s*)?(?:${noun})\\b`));
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUM[m[1]];
  return n && n > 0 && n < 40 ? n : null;
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, extra: Partial<Panel> = {}, mat = PLY): Panel {
  return { id: createId(type.slice(0, 2)), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId: mat, ...extra };
}

/** Plan-view (xz) plate from absolute points; thickness along y. */
function planPlate(type: Panel["type"], name: string, y: number, thick: number, pts: [number, number][], cutNote: string): Panel {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const z0 = Math.min(...zs);
  return panel(type, name, x0, y, z0, Math.max(...xs) - x0, thick, Math.max(...zs) - z0, {
    polygon: { plane: "xz", pts: pts.map(([x, z]) => [x - x0, z - z0] as [number, number]) },
    cutNote,
  });
}
/** Front-view (xy) plate from absolute points; thickness along z. */
function facePlate(type: Panel["type"], name: string, z: number, thick: number, pts: [number, number][], cutNote: string, mat = PLY): Panel {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return panel(type, name, x0, y0, z, Math.max(...xs) - x0, Math.max(...ys) - y0, thick, {
    polygon: { plane: "xy", pts: pts.map(([x, y]) => [x - x0, y - y0] as [number, number]) },
    cutNote,
  }, mat);
}
/** Straight board of length L (along its own x), height h, thickness t, center (cx, cz), running in plan direction angle a (radians from +x toward +z). */
function angledBoard(type: Panel["type"], name: string, cx: number, y: number, cz: number, L: number, h: number, t: number, a: number, cutNote?: string): Panel {
  // Three.js R_y(yaw) maps local +x to (cos yaw, −sin yaw); want (cos a, sin a) → yaw = −a.
  const p = panel(type, name, cx - L / 2, y, cz - t / 2, L, h, t, { yaw: -a });
  if (cutNote) p.cutNote = cutNote;
  return p;
}

type Build = {
  kind: OddKind;
  stem: string;
  program: FittedProgram;
  titleBits: string[];
  panels: Panel[];
  notes: string[];
  overall: { width: number; height: number; depth: number };
  typed: { width: boolean; height: boolean; depth: boolean };
  install: "wall" | "freestanding";
  params: Record<string, number | string | boolean>;
  approx?: string;
};

// ───────────────────────────── L-footprint ─────────────────────────────

function buildL(lower: string): Build {
  const desk = /\bdesk|workstation|work\s*surface|workbench|counter/.test(lower);
  const counter = /\bcounter/.test(lower) && !/\bdesk/.test(lower);
  const seat = !desk;
  const stem = desk
    ? counter ? "L-shaped corner counter" : "L-shaped corner desk"
    : /\bbanquette/.test(lower) ? "L-shaped corner banquette"
    : /\bwindow\s+seat/.test(lower) ? "L-shaped corner window seat"
    : "L-shaped corner bench";
  const tri = byTriple(lower);
  const pair = tri ? ([tri[0], tri[1]] as [number, number]) : byPair(lower);
  const typedH = typedAxis(lower, "tall|high|height") ?? (tri ? tri[2] : null);
  const typedD = typedAxis(lower, "deep|depth");
  const each = alongEach(lower);
  const A = pair ? Math.max(pair[0], pair[1]) : each ?? (desk ? 60 : 60);
  const B = pair ? Math.min(pair[0], pair[1]) : each ?? (desk ? 48 : 48);
  const H = typedH ?? (counter ? 36 : desk ? 30 : 18);
  let D = typedD ?? (counter ? 24 : desk ? 24 : 18);
  D = Math.min(D, Math.min(A, B) - 6);
  const panels: Panel[] = [];
  const topY = H - T;
  const topWord = desk ? (counter ? "Counter top" : "Desk top") : "Seat top";
  // Room corner at (0,0); run A along the back wall (x), run B along the left wall (z).
  const topA = planPlate("top", `${topWord} A`, topY, T, [[0, 0], [A, 0], [A, D], [0, D]], `Rectangle ${tape(A)} × ${tape(D)} — runs the full length of the long wall.`);
  const topB = planPlate("top", `${topWord} B`, topY, T, [[0, D], [D, D], [D, B], [0, B]], `Rectangle ${tape(D)} × ${tape(B - D)} — butts into the front edge of ${topWord} A.`);
  panels.push(topA, topB);
  // End panels at the two open ends.
  panels.push(panel("upright", "End panel A", A - T, 0, 0, T, topY, D));
  panels.push(panel("upright", "End panel B", 0, 0, B - T, D, topY, T));
  // Wall cleats under the back edges.
  panels.push(panel("rail", "Wall cleat A", T, topY - 3.5, 0, A - 2 * T, 3.5, T));
  panels.push(panel("rail", "Wall cleat B", 0, topY - 3.5, T, T, 3.5, B - 2 * T));
  // Seam batten under the joint between the two tops.
  panels.push(panel("rail", "Seam batten", T, topY - T, D - 1.75, D - T - 1.5, T, 3.5));
  if (desk) {
    // Inside-corner leg carries the front corner where the two tops meet.
    panels.push(panel("upright", "Corner leg", D - 1.5, 0, D - 1.5, 1.5, topY, 1.5, {}, "lumber-2x2-8"));
  } else {
    // Box seat: face panels along both fronts (they meet at the inside corner) + a mid support per long run.
    panels.push(panel("upright", "Face panel A", D - T, 0, D - T, A - D, topY, T));
    panels.push(panel("upright", "Face panel B", D - T, 0, D, T, topY, B - D - T));
    if (A - D > 30) panels.push(panel("divider", "Seat support A", D + (A - D) / 2, 0, T, T, topY, D - 2 * T));
    if (B - D > 30) panels.push(panel("divider", "Seat support B", T, 0, D + (B - D) / 2, D - 2 * T, topY, T));
  }
  const notes: string[] = [];
  notes.push(`${stem}: two runs meet at a 90° inside corner — ${fmtIn(A)}" along one wall and ${fmtIn(B)}" along the other, ${fmtIn(D)}" deep.`);
  if (!pair && each == null) notes.push(`Assumed ${fmtIn(A)}" × ${fmtIn(B)}" along the walls (L default) — type "60 by 48" to lock the two runs.`);
  if (typedD == null) notes.push(`Assumed ${fmtIn(D)}" deep (${desk ? "desk" : "seat"} default) — type "20 deep" to lock it.`);
  if (typedH == null) notes.push(`Assumed ${fmtIn(H)}" tall (${counter ? "counter" : desk ? "desk" : "seat"} height) — type "${desk ? 29 : 17} tall" to lock it.`);
  if (/\bbanquette|window\s+seat/.test(lower)) notes.push("Seat box only — lean cushions against the wall for the back, or add a backrest later.");
  return {
    kind: "l-footprint",
    stem,
    program: desk ? "desk" : "bench",
    titleBits: [pair || each != null ? `${fmtIn(A)}" × ${fmtIn(B)}"` : "", typedD != null ? `${fmtIn(D)}" deep` : "", typedH != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: { width: A, height: H, depth: B },
    typed: { width: !!pair || each != null, height: typedH != null, depth: !!pair || each != null },
    install: "wall",
    params: { A, B, D, H, desk, seat },
  };
}

// ───────────────────────────── corner-diagonal ─────────────────────────────

function buildCornerDiagonal(lower: string): Build {
  const tv = /\btv|television|media|entertainment/.test(lower);
  const stem = tv ? (/\bconsole/.test(lower) ? "Corner media console" : "Corner TV stand")
    : /\bcupboard/.test(lower) ? "Diagonal corner cupboard" : /\bhutch/.test(lower) ? "Diagonal corner hutch" : "Diagonal corner cabinet";
  const each = alongEach(lower);
  const typedW = typedAxis(lower, "wide|width|long");
  const typedH = typedAxis(lower, "tall|high|height");
  const typedD = typedAxis(lower, "deep|depth");
  // "40 wide" on a corner unit = the diagonal front span; convert to along-wall legs.
  let L = each ?? 0;
  let D = typedD ?? (tv ? 16 : 12);
  if (!L && typedW) L = r8(typedW / Math.SQRT2 + D);
  if (!L) L = tv ? 36 : 24;
  D = Math.min(D, L - 6);
  const H = typedH ?? (tv ? 24 : 36);
  const wantsDoor = !tv && !/\bopen\b/.test(lower);
  const doors = /\b(?:two|2|double|pair of)\s+doors\b/.test(lower) ? 2 : wantsDoor ? 1 : 0;
  const shelves = countOf(lower, "shel(?:f|ves)") ?? (H >= 60 ? 3 : 1);
  const panels: Panel[] = [];
  const fx = L; // diagonal front runs from (L, D) to (D, L)
  panels.push(panel("back", "Back panel A", 0, 0, 0, L, H, T));
  panels.push(panel("back", "Back panel B", 0, 0, T, T, H, L - T));
  panels.push(panel("upright", "Side panel A", L - T, 0, T, T, H, D - T, { cutNote: `Front edge beveled 45° so the diagonal front lands flat.` }));
  panels.push(panel("upright", "Side panel B", T, 0, L - T, D - T, H, T, { cutNote: `Front edge beveled 45° so the diagonal front lands flat.` }));
  const inset = doors ? T : 0;
  const d2 = inset * Math.SQRT2;
  const pent: [number, number][] = [[T, T], [L - T, T], [L - T, D - d2], [D - d2, L - T], [T, L - T]];
  const clip = r8(L - D + d2 - T);
  const pentNote = `Start from a ${tape(L - 2 * T)} square, measure ${tape(clip)} from one corner along both edges, and cut that corner off in one straight 45° line.`;
  panels.push(planPlate("bottom", "Diagonal bottom", 0, T, pent, pentNote));
  panels.push(planPlate("top", "Diagonal top", H - T, T, pent, pentNote));
  for (let i = 0; i < shelves; i++) {
    const y = r8(((i + 1) * (H - T)) / (shelves + 1));
    panels.push(planPlate("shelf", `Diagonal shelf ${i + 1}`, y, T, pent, pentNote));
  }
  const span = Math.SQRT2 * (fx - D);
  if (doors) {
    const dw = r8((span - 0.25) / doors);
    const dh = r8(H - 0.25);
    for (let i = 0; i < doors; i++) {
      // Door plane on the diagonal, centered along it.
      const t0 = (i + 0.5) / doors;
      const px = L + (D - L) * t0 - (T / 2) / Math.SQRT2;
      const pz = D + (L - D) * t0 - (T / 2) / Math.SQRT2;
      const p = angledBoard("door", doors === 1 ? "Diagonal door" : `Diagonal door ${i + 1}`, px, 0.125, pz, dw, dh, T, (3 * Math.PI) / 4, `Rectangle ${tape(dw)} × ${tape(dh)} — hangs on the 45° front.`);
      panels.push(p);
    }
  }
  const notes: string[] = [];
  notes.push(`${stem}: fits a 90° inside corner — ${fmtIn(L)}" along each wall, ${fmtIn(D)}" deep sides, and a ${tape(span)} front on a 45° diagonal.`);
  if (each == null && !typedW) notes.push(`Assumed ${fmtIn(L)}" along each wall (${tv ? "corner TV stand" : "corner cabinet"} default) — type "24 along each wall" to lock it.`);
  if (each == null && typedW) notes.push(`Your ${fmtIn(typedW)}" width is the diagonal front; that works out to ${fmtIn(L)}" along each wall.`);
  if (typedD == null) notes.push(`Assumed ${fmtIn(D)}" deep side panels — type "14 deep" to lock it.`);
  if (typedH == null) notes.push(`Assumed ${fmtIn(H)}" tall (${tv ? "TV stand" : "base cabinet"} height) — type "30 tall" to lock it.`);
  if (tv) notes.push(`Open front for components. The ${tape(span)} front edge is the widest spot for a TV base — check your TV's feet or stand fit on the top.`);
  return {
    kind: "corner-diagonal",
    stem,
    program: tv ? "media" : "storage",
    titleBits: [each != null ? `${fmtIn(L)}" along each wall` : typedW ? `${fmtIn(typedW)}" front` : "", typedH != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: { width: L, height: H, depth: L },
    typed: { width: each != null, height: typedH != null, depth: each != null },
    install: "wall",
    params: { L, D, H, doors, shelves, span: r8(span) },
  };
}

// ───────────────────────────── sloped ─────────────────────────────

function buildSloped(lower: string): Build {
  const stairs = /\bstair|steps\b/.test(lower);
  const knee = /\bknee\s*-?\s*wall|\battic|\beaves?\b/.test(lower);
  const book = /\bbook/.test(lower);
  const stem = stairs ? (book ? "Under-stairs bookcase" : "Under-stairs shelves")
    : knee ? (book ? "Knee-wall bookcase" : "Knee-wall shelves")
    : book ? "Sloped-ceiling bookcase" : "Sloped-ceiling shelves";
  const W0 = typedAxis(lower, "wide|width|long");
  const D0 = typedAxis(lower, "deep|depth");
  const hi = lower.match(new RegExp(`${N}${U}\\s*(?:tall|high)?\\s*(?:at|on)?\\s*(?:the\\s+)?(?:high|tall)(?:est)?\\s+(?:side|end)`)) ||
    lower.match(new RegExp(`(?:high|tall)(?:est)?\\s+(?:side|end)\\s*(?:of|is|=|:|at)?\\s*${N}`));
  const lo = lower.match(new RegExp(`${N}${U}\\s*(?:tall|high)?\\s*(?:at|on)?\\s*(?:the\\s+)?(?:low|short)(?:est)?\\s+(?:side|end)`)) ||
    lower.match(new RegExp(`(?:low|short)(?:est)?\\s+(?:side|end)\\s*(?:of|is|=|:|at)?\\s*${N}`));
  let hiH = hi ? num(hi[1]) : null;
  let loH = lo ? num(lo[1]) : null;
  const plainH = !hi && !lo ? typedAxis(lower, "tall|high|height") : null;
  const pitch = lower.match(/\b(\d{1,2})\s*(?:°|deg(?:ree)?s?)\s*(?:slope|pitch|angle)?/);
  const W = W0 ?? (stairs ? 72 : 48);
  const D = D0 ?? (stairs ? 24 : 12);
  const notes: string[] = [];
  if (hiH == null && loH == null) {
    if (plainH != null && knee) {
      loH = plainH; // a knee wall's height is the low side
      hiH = pitch ? loH + W * Math.tan((parseFloat(pitch[1]) * Math.PI) / 180) : loH + 24;
      notes.push(`Your ${fmtIn(plainH)}" is the knee-wall (low) side. Assumed ${fmtIn(hiH)}" at the high side — type "60 at the high side" to lock it.`);
    } else if (plainH != null) {
      hiH = plainH;
      loH = Math.max(12, plainH - (pitch ? W * Math.tan((parseFloat(pitch[1]) * Math.PI) / 180) : stairs ? W * 0.72 : 30));
      notes.push(`Your ${fmtIn(plainH)}" is the high side. Assumed ${fmtIn(loH)}" at the low side — type "30 at the low side" to lock it.`);
    } else if (stairs) {
      hiH = 72;
      loH = 18;
      notes.push(`Assumed a stair that climbs from ${fmtIn(loH)}" to ${fmtIn(hiH)}" over ${fmtIn(W)}" (typical stair pitch). Measure under your stair and type "72 at the high side 18 at the low side" to lock it.`);
    } else {
      hiH = 60;
      loH = 30;
      notes.push(`Assumed ${fmtIn(hiH)}" at the high side and ${fmtIn(loH)}" at the low side — type both to lock the slope.`);
    }
  } else if (hiH == null) {
    hiH = loH! + 30;
    notes.push(`Assumed ${fmtIn(hiH)}" at the high side — type it to lock the slope.`);
  } else if (loH == null) {
    loH = Math.max(12, hiH - 30);
    notes.push(`Assumed ${fmtIn(loH)}" at the low side — type it to lock the slope.`);
  }
  if (loH! > hiH!) [hiH, loH] = [loH, hiH];
  const highLeft = /\bhigh\s+(?:side|end)\s+(?:is\s+)?(?:on\s+)?(?:the\s+)?left|left\s+(?:side\s+)?(?:is\s+)?(?:the\s+)?high/.test(lower) || !/\bhigh\s+(?:side|end)\s+(?:is\s+)?(?:on\s+)?(?:the\s+)?right|right\s+(?:side\s+)?(?:is\s+)?(?:the\s+)?high/.test(lower) && !stairs;
  const hL = highLeft ? hiH! : loH!;
  const hR = highLeft ? loH! : hiH!;
  if (!/\b(?:left|right)\b/.test(lower)) notes.push(`High side drawn on the ${highLeft ? "left" : "right"} — type "high side on the ${highLeft ? "right" : "left"}" to flip it.`);
  if (W0 == null) notes.push(`Assumed ${fmtIn(W)}" wide — type "48 wide" to lock it.`);
  if (D0 == null) notes.push(`Assumed ${fmtIn(D)}" deep — type "12 deep" to lock it.`);
  const slope = (hR - hL) / W;
  const ang = (Math.atan(Math.abs(slope)) * 180) / Math.PI;
  const tv = T / Math.cos(Math.atan(Math.abs(slope)));
  const yTop = (x: number) => hL + slope * x;
  const under = (x: number) => yTop(x) - tv;
  const panels: Panel[] = [];
  const zb = 0.25;
  panels.push(facePlate("back", "Sloped back", 0, 0.25, [[0, 0], [W, 0], [W, yTop(W)], [0, yTop(0)]], `Trapezoid: ${tape(W)} wide, ${tape(hL)} tall on the left edge, ${tape(hR)} on the right. Mark both heights and snap a straight line.`, BACKER));
  const bays = Math.max(1, Math.round((W - 2 * T) / 24));
  const xs: number[] = [];
  for (let i = 0; i <= bays; i++) xs.push(i === 0 ? 0 : i === bays ? W - T : r8((i * (W - T)) / bays));
  xs.forEach((x, i) => {
    const name = i === 0 ? "Left upright" : i === bays ? "Right upright" : `Divider ${i}`;
    const a = r8(under(x));
    const b = r8(under(x + T));
    panels.push(facePlate(i === 0 || i === bays ? "upright" : "divider", name, zb, D - zb, [[x, 0], [x + T, 0], [x + T, b], [x, a]], `${tape(D - zb)} deep board. Top end cut at ${deg(ang)}: ${tape(Math.max(a, b))} on the tall edge, ${tape(Math.min(a, b))} on the short edge.`));
  });
  const topP = facePlate("top", "Sloped top", zb, D - zb, [[0, under(0)], [W, under(W)], [W, yTop(W)], [0, yTop(0)]], `${tape(Math.hypot(W, hR - hL))} long along the slope, ${tape(D - zb)} deep. Both ends cut at ${deg(ang)} so they sit plumb on the uprights.`);
  topP.blank = { lengthIn: r8(Math.hypot(W, hR - hL)), widthIn: r8(D - zb), thicknessIn: T };
  panels.push(topP);
  // Bottom + shelves per bay, 12" apart, only where they clear the slope.
  let shelfN = 0;
  for (let i = 0; i < bays; i++) {
    const x0 = xs[i] + T;
    const x1 = xs[i + 1];
    const w = r8(x1 - x0);
    panels.push(panel("bottom", `Bottom ${i + 1}`, x0, 0, zb, w, T, D - zb));
    const lowUnder = Math.min(under(x0), under(x1));
    for (let y = 12; y + T + 6 <= lowUnder; y += 12) {
      shelfN++;
      panels.push(panel("shelf", `Shelf ${shelfN}`, x0, r8(y), zb, w, T, D - zb));
    }
  }
  return {
    kind: "sloped",
    stem,
    program: book ? "bookcase" : "storage",
    titleBits: [
      W0 != null ? `${fmtIn(W)}" wide` : "",
      hi && lo ? `${fmtIn(hiH!)}" to ${fmtIn(loH!)}" tall`
        : hi ? `${fmtIn(hiH!)}" at the high side`
        : lo ? `${fmtIn(loH!)}" at the low side`
        : plainH != null ? (knee ? `${fmtIn(plainH)}" knee wall` : `${fmtIn(plainH)}" tall`) : "",
    ],
    panels,
    notes: [`${stem}: the top follows a ${deg(ang)} slope from ${fmtIn(hiH!)}" down to ${fmtIn(loH!)}" over ${fmtIn(W)}" — uprights and dividers get angled tops, shelves stop below the slope.`, ...notes],
    overall: { width: W, height: hiH!, depth: D },
    typed: { width: W0 != null, height: !!hi || (plainH != null && !knee), depth: D0 != null },
    install: "wall",
    params: { W, D, hiH: hiH!, loH: loH!, angle: Math.round(ang * 10) / 10, highLeft, bays },
  };
}

// ───────────────────────────── wrap-opening ─────────────────────────────

function buildWrap(lower: string): Build {
  const door = /\bdoor(?:way)?|entry\b/.test(lower) && !/\bwindow/.test(lower);
  const stem = door ? "Bookshelves around a doorway" : "Shelves around a window";
  const openM = lower.match(new RegExp(`${N}${U}\\s*(?:wide|width)?\\s*(?:window|door(?:way)?|opening)`)) ||
    lower.match(new RegExp(`(?:window|door(?:way)?|opening)\\s*(?:is\\s*)?${N}${U}\\s*(?:wide)?`));
  const Wo = openM ? num(openM[1])! : door ? 36 : 36;
  const allW = /\b(?:overall|total|whole\s+thing)\s+/.test(lower) ? typedAxis(lower, "wide|width") : null;
  const H0 = typedAxis(lower, "tall|high|height");
  const H = H0 ?? 96;
  const D0 = typedAxis(lower, "deep|depth");
  const D = D0 ?? (door ? 12 : 10);
  const towerW = allW ? Math.max(10, (allW - Wo) / 2) : 18;
  const bridgeBottom = door ? 84 : 82;
  const Wt = towerW;
  const Wall = 2 * Wt + Wo;
  const panels: Panel[] = [];
  const zb = 0.25;
  const tower = (side: "Left" | "Right", x0: number) => {
    panels.push(panel("back", `${side} tower back`, x0, 0, 0, Wt, H, 0.25, {}, BACKER));
    panels.push(panel("upright", `${side} tower outer upright`, side === "Left" ? x0 : x0 + Wt - T, 0, zb, T, H, D - zb));
    panels.push(panel("upright", `${side} tower inner upright`, side === "Left" ? x0 + Wt - T : x0, 0, zb, T, H, D - zb));
    const iw = r8(Wt - 2 * T);
    panels.push(panel("bottom", `${side} tower bottom`, x0 + T, 3.5, zb, iw, T, D - zb));
    panels.push(panel("top", `${side} tower top`, x0 + T, H - T, zb, iw, T, D - zb));
    panels.push(panel("kick", `${side} tower kick`, x0 + T, 0, D - T - 0.5, iw, 3.5, T));
    for (let y = 3.5 + 12; y < H - T - 8; y += 12) panels.push(panel("shelf", `${side} tower shelf`, x0 + T, r8(y), zb, iw, T, D - zb));
  };
  tower("Left", 0);
  tower("Right", Wt + Wo);
  // Bridge spans the opening between the towers' inner uprights, screwed into them.
  const bx = Wt;
  const bh = H - bridgeBottom;
  panels.push(panel("back", "Bridge back", bx, bridgeBottom, 0, Wo, bh, 0.25, {}, BACKER));
  panels.push(panel("shelf", "Bridge bottom", bx, bridgeBottom, zb, Wo, T, D - zb, { cutNote: `Spans the ${pr(Wo)} opening — cut it to the measured gap between the two towers' inner uprights.` }));
  panels.push(panel("shelf", "Bridge top", bx, H - T, zb, Wo, T, D - zb));
  if (bh >= 20) panels.push(panel("shelf", "Bridge shelf", bx, r8(bridgeBottom + bh / 2), zb, Wo, T, D - zb));
  const notes: string[] = [];
  notes.push(`${stem}: two ${fmtIn(Wt)}" towers stand either side of a ${fmtIn(Wo)}" ${door ? "doorway" : "window"}, with a bridge of shelves over it from ${fmtIn(bridgeBottom)}" to ${fmtIn(H)}". Overall ${fmtIn(Wall)}" wide.`);
  if (!openM) notes.push(`Assumed a ${fmtIn(Wo)}" wide ${door ? "doorway" : "window"} (trim to trim) — type "36 wide ${door ? "doorway" : "window"}" to lock it.`);
  notes.push(`Assumed the ${door ? "door" : "window"} trim tops out below ${fmtIn(bridgeBottom)}" — measure yours; the bridge bottom must clear the trim.`);
  if (H0 == null) notes.push(`Assumed ${fmtIn(H)}" tall (8 ft ceiling) — type "90 tall" to lock it.`);
  if (D0 == null) notes.push(`Assumed ${fmtIn(D)}" deep — type "12 deep" to lock it.`);
  return {
    kind: "wrap-opening",
    stem,
    program: "bookcase",
    titleBits: [openM ? `${fmtIn(Wo)}" ${door ? "doorway" : "window"}` : "", H0 != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: { width: Wall, height: H, depth: D },
    typed: { width: !!allW, height: H0 != null, depth: D0 != null },
    install: "wall",
    params: { Wo, Wt, H, D, bridgeBottom, door },
  };
}

// ───────────────────────────── angled-corner ─────────────────────────────

function buildAngled(lower: string): Build {
  const m = lower.match(/\b(\d{2,3})\s*(?:°|deg(?:ree)?s?)\b/)!;
  const typedA = parseFloat(m[1]);
  const wallAngled = /\bangled\s+wall|\bdegree\s+(?:angled\s+)?wall|\bwall\s+at\b/.test(lower) && !/\b(?:degree|°)\s+corner\b/.test(lower);
  const theta = wallAngled ? 180 - typedA : typedA;
  const each = alongEach(lower) ?? typedAxis(lower, "inch|inches") ?? null;
  const L = each ?? 12;
  const H0 = typedAxis(lower, "tall|high|height");
  const tiers0 = countOf(lower, "shel(?:f|ves)|tiers?|levels?");
  const H = H0 ?? (tiers0 ? (tiers0 - 1) * 12 + T : 48);
  const tiers = tiers0 ?? Math.max(2, Math.floor((H - T) / 12) + 1);
  const th = (theta * Math.PI) / 180;
  const u: [number, number] = [Math.cos(th), Math.sin(th)];
  const n: [number, number] = [Math.sin(th), -Math.cos(th)];
  const panels: Panel[] = [];
  // Wall panel A along +x from the corner; Wall panel B along direction θ.
  panels.push(panel("upright", "Wall panel A", 0, 0, 0, L, H, T));
  panels.push(angledBoard("upright", "Wall panel B", (L / 2) * u[0] + (T / 2) * n[0], 0, (L / 2) * u[1] + (T / 2) * n[1], L, H, T, th, `Board ${tape(L)} × ${tape(H)}. Bevel the edge that meets Wall panel A at ${deg((180 - theta) / 2)} (both panels get the same bevel).`));
  const apex: [number, number] = [(T * (1 + Math.cos(th))) / Math.sin(th), T];
  const pA: [number, number] = [L, T];
  const pB: [number, number] = [L * u[0] + T * n[0], L * u[1] + T * n[1]];
  const legA = Math.hypot(pA[0] - apex[0], pA[1] - apex[1]);
  const legB = Math.hypot(pB[0] - apex[0], pB[1] - apex[1]);
  const front = Math.hypot(pA[0] - pB[0], pA[1] - pB[1]);
  const note = `Wedge: two edges ${tape(legA)} and ${tape(legB)} meeting at ${deg(theta)} (set a bevel gauge to ${deg(theta)} and mark), then one straight cut ${tape(front)} across the front.`;
  const step = tiers > 1 ? (H - T) / (tiers - 1) : 0;
  for (let i = 0; i < tiers; i++) {
    const y = i === tiers - 1 ? H - T : r8(i * step);
    panels.push(planPlate("shelf", `Wedge shelf ${i + 1}`, y, T, [apex, pA, pB], note));
  }
  panels[0].cutNote = `Board ${tape(L)} × ${tape(H)}. Bevel the edge that meets Wall panel B at ${deg((180 - theta) / 2)}.`;
  const notes: string[] = [];
  notes.push(`Corner shelf for a ${deg(theta)} inside corner: wedge shelves with ${fmtIn(L)}" edges along each wall, between two wall panels that meet at ${deg(theta)}.`);
  if (wallAngled) notes.push(`Read "${fmtIn(typedA)} degree angled wall" as a wall turned ${fmtIn(typedA)}° off straight, so the corner you fill is ${deg(theta)}. If the corner itself measures ${fmtIn(typedA)}°, type "${fmtIn(typedA)} degree corner shelf".`);
  if (each == null) notes.push(`Assumed ${fmtIn(L)}" along each wall — type "10 inches along each wall" to lock it.`);
  if (H0 == null) notes.push(tiers0 ? `Assumed ${fmtIn(H)}" tall — ${tiers} shelves 12" apart; type a height to lock it.` : `Assumed ${fmtIn(H)}" tall — type "48 tall" to lock it.`);
  if (tiers0 == null) notes.push(`Assumed ${tiers} shelves (from the height) — type "four shelves" to lock it.`);
  notes.push(`Measure your real corner with a bevel gauge first; walls are rarely exact. Recut the wedge angle to match.`);
  const xs = [0, L, L * u[0], pB[0]];
  const zs = [0, T, L * u[1], pB[1]];
  return {
    kind: "angled-corner",
    stem: `${fmtIn(theta)}° corner shelf`,
    program: "storage",
    titleBits: [each != null ? `${fmtIn(L)}" along the walls` : "", H0 != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: { width: r8(Math.max(...xs) - Math.min(...xs)), height: H, depth: r8(Math.max(...zs) - Math.min(...zs)) },
    typed: { width: false, height: H0 != null, depth: false },
    install: "wall",
    params: { theta, L, H, tiers, bevel: (180 - theta) / 2 },
  };
}

// ───────────────────────────── outside-corner ─────────────────────────────

function buildOutside(lower: string): Build {
  const each = alongEach(lower);
  const pair = byPair(lower);
  const a = pair ? pair[0] : each ?? 18;
  const b = pair ? pair[1] : each ?? 18;
  const D0 = typedAxis(lower, "deep|depth");
  const D = D0 ?? Math.min(6, Math.max(3.5, Math.min(a, b) - 2));
  const tiers0 = countOf(lower, "shel(?:f|ves)|tiers?|levels?");
  const tiers = tiers0 ?? 3;
  const gap = typedAxis(lower, "apart|spacing") ?? 12;
  const panels: Panel[] = [];
  // Building mass fills x<0, z<0. Face A: plane z=0 (x ≤ 0). Face B: plane x=0 (z ≤ 0).
  for (let i = 0; i < tiers; i++) {
    const y = r8(i * gap) + 1.5;
    panels.push(panel("rail", `Wall cleat A ${i + 1}`, -a + 0.5, y - 1.5, 0, a - 0.5, 1.5, T));
    panels.push(panel("rail", `Wall cleat B ${i + 1}`, 0, y - 1.5, -b + 0.5, T, 1.5, b - 0.5 - 0));
    panels.push(panel("shelf", `Wrap shelf A ${i + 1}`, -a, y, 0, a + D, T, D, { cutNote: `Rectangle ${tape(a + D)} × ${tape(D)} — runs ${tape(D)} past the corner so board B butts into it.` }));
    panels.push(panel("shelf", `Wrap shelf B ${i + 1}`, 0, y, -b, D, T, b, { cutNote: `Rectangle ${tape(b)} × ${tape(D)} — its end butts the back edge of board A at the corner.` }));
  }
  const H = r8((tiers - 1) * gap) + 1.5 + T;
  const notes: string[] = [];
  notes.push(`Outside-corner shelves: each shelf is two boards that wrap around the corner — ${fmtIn(a)}" along one wall, ${fmtIn(b)}" along the other, ${fmtIn(D)}" deep — on a wall cleat under each board.`);
  if (each == null && !pair) notes.push(`Assumed ${fmtIn(a)}" along each wall — type "12 inches each side" to lock it.`);
  if (D0 == null) notes.push(`Assumed ${fmtIn(D)}" deep — type "5 deep" to lock it.`);
  if (tiers0 == null) notes.push(`Assumed ${tiers} shelves, ${fmtIn(gap)}" apart — type "four shelves" to lock it.`);
  notes.push("Outside corners stick out into walkways — keep the lowest shelf above hip height or round the outer corner with sandpaper.");
  return {
    kind: "outside-corner",
    stem: "Outside-corner wrap shelves",
    program: "storage",
    titleBits: [each != null || pair ? `${fmtIn(a)}" × ${fmtIn(b)}" each side` : ""],
    panels,
    notes,
    overall: { width: a + D, height: H, depth: b + D },
    typed: { width: each != null || !!pair, height: false, depth: each != null || !!pair },
    install: "wall",
    params: { a, b, D, tiers, gap },
  };
}

// ───────────────────────────── polygon ─────────────────────────────

function polySides(lower: string): number {
  const m = lower.match(POLY_RE);
  if (m) return POLY_WORDS[m[1]] ?? 6;
  const s = countOf(lower, "sided|sides");
  return s && s >= 3 && s <= 12 ? s : 6;
}
const POLY_NAME: Record<number, string> = { 3: "Triangle", 4: "Square", 5: "Pentagon", 6: "Hexagon", 7: "Heptagon", 8: "Octagon" };

function ngon(nSides: number, acrossFlats: number, cx: number, cz: number, rot = 0): [number, number][] {
  const R = acrossFlats / 2 / Math.cos(Math.PI / nSides);
  const pts: [number, number][] = [];
  for (let k = 0; k < nSides; k++) {
    const a = rot + Math.PI / nSides + (2 * Math.PI * k) / nSides;
    pts.push([cx + R * Math.cos(a), cz + R * Math.sin(a)]);
  }
  return pts;
}

function buildPolyPlanter(lower: string): Build {
  const n = polySides(lower);
  const shapeWord = POLY_NAME[n] ?? `${n}-sided`;
  const W0 = typedAxis(lower, "wide|width|across|diameter");
  const H0 = typedAxis(lower, "tall|high|height");
  const W = W0 ?? 24;
  const H = H0 ?? 16;
  const side = r8(W * Math.tan(Math.PI / n));
  const bevel = 180 / n;
  const panels: Panel[] = [];
  const apothem = W / 2;
  for (let k = 0; k < n; k++) {
    const phi = (2 * Math.PI * k) / n; // outward normal of side k
    const r = apothem - T / 2;
    const cx = r * Math.cos(phi);
    const cz = r * Math.sin(phi);
    // Board runs along the tangent (perpendicular to phi).
    panels.push(angledBoard("upright", `Planter side ${k + 1}`, cx, 0, cz, side, H, T, phi + Math.PI / 2, `${tape(side)} on the outside face × ${tape(H)} tall. Bevel both long edges at ${deg(bevel)} so ${n} sides close into ${/^[aeiou]/i.test(shapeWord) ? "an" : "a"} ${shapeWord.toLowerCase()}.`));
  }
  const inner = ngon(n, W - 2 * T, 0, 0);
  panels.push(planPlate("bottom", "Planter bottom", 2, T, inner, `${shapeWord}: ${tape(W - 2 * T)} across the flats. Trace it inside the assembled ring, cut on the line, drill 5 drainage holes.`));
  const cleatL = r8(Math.max(3, (W - 2 * T) * Math.tan(Math.PI / n) - 2));
  for (let k = 0; k < n; k++) {
    const phi = (2 * Math.PI * k) / n;
    const r = apothem - T - 0.375;
    panels.push(angledBoard("rail", `Bottom cleat ${k + 1}`, r * Math.cos(phi), 0.5, r * Math.sin(phi), cleatL, 1.5, T, phi + Math.PI / 2));
  }
  const stem = `${shapeWord} planter box`;
  const notes: string[] = [];
  notes.push(`${stem}: ${n} sides, each ${tape(side)} wide on the outside, beveled ${deg(bevel)} on both edges (miter = 180 ÷ ${n}), ${fmtIn(W)}" across the flats.`);
  if (W0 == null) notes.push(`Assumed ${fmtIn(W)}" across the flats — type "24 wide" to lock it.`);
  if (H0 == null) notes.push(`Assumed ${fmtIn(H)}" tall — type "18 tall" to lock it.`);
  notes.push("Outdoors: use cedar or exterior plywood and exterior screws; line the inside with landscape fabric.");
  return {
    kind: "polygon-planter",
    stem,
    program: "storage",
    titleBits: [W0 != null ? `${fmtIn(W)}" across` : "", H0 != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: (() => {
      const o = ngon(n, W, 0, 0);
      const xs = o.map((p) => p[0]);
      const zs = o.map((p) => p[1]);
      return { width: r8(Math.max(...xs) - Math.min(...xs)), height: H, depth: r8(Math.max(...zs) - Math.min(...zs)) };
    })(),
    typed: { width: W0 != null, height: H0 != null, depth: W0 != null && n % 4 === 0 },
    install: "freestanding",
    params: { n, W, H, side, bevel },
  };
}

function buildPolyStand(lower: string): Build {
  const n = polySides(lower);
  const shapeWord = POLY_NAME[n] ?? `${n}-sided`;
  const W0 = typedAxis(lower, "wide|width|across|diameter");
  const H0 = typedAxis(lower, "tall|high|height");
  // Triangles are spoken by side length; other polygons across the flats.
  const S = n === 3 ? W0 ?? 16 : null;
  const W = n === 3 ? S! / Math.sqrt(3) : W0 ?? 14;
  const H = H0 ?? 24;
  const panels: Panel[] = [];
  const top = ngon(n, W, 0, 0, -Math.PI / 2);
  const Rv = W / 2 / Math.cos(Math.PI / n);
  const legInset = n === 3 ? 0.42 : 0.3;
  const sideLen = 2 * Rv * Math.sin(Math.PI / n);
  const noteTop = n === 3
    ? `Triangle: ${tape(sideLen)} each side, every corner 60°. Mark one edge, swing a tape ${tape(sideLen)} from both ends to find the third corner, connect, cut.`
    : `${shapeWord}: ${tape(W)} across the flats (${tape(sideLen)} each side). Mark the corners, connect with a straight edge, cut; each corner is ${deg(180 - 360 / n)}.`;
  panels.push(planPlate("top", `${shapeWord} top`, H - T, T, top, noteTop));
  const shelfY = Math.min(8, H / 3);
  const shelfPts = ngon(n, W * 0.92, 0, 0, -Math.PI / 2);
  const shelfSide = sideLen * 0.92;
  panels.push(planPlate("shelf", `${shapeWord} lower shelf`, shelfY, T, shelfPts, n === 3
    ? `Triangle: ${tape(shelfSide)} each side, every corner 60°. Trim the three tips so it slips between the legs.`
    : `${shapeWord}: ${tape(W * 0.92)} across the flats (${tape(shelfSide)} each side). Trim the corners so it slips between the legs.`));
  top.forEach(([x, z], i) => {
    const lx = x * (1 - legInset * (1.5 / Rv) * 2.2);
    const lz = z * (1 - legInset * (1.5 / Rv) * 2.2);
    panels.push(panel("upright", `Leg ${i + 1}`, lx - 0.75, 0, lz - 0.75, 1.5, H - T, 1.5, {}, "lumber-2x2-8"));
  });
  const stem = `${shapeWord} plant stand`;
  const notes = [`${stem}: ${shapeWord.toLowerCase()} top and lower shelf on ${n} legs, ${n === 3 ? `${fmtIn(sideLen)}" each side` : `${fmtIn(W)}" across`}.`];
  if (W0 == null) notes.push(n === 3 ? `Assumed ${fmtIn(sideLen)}" each side — type "18 wide" to lock it.` : `Assumed ${fmtIn(W)}" across — type "16 wide" to lock it.`);
  if (H0 == null) notes.push(`Assumed ${fmtIn(H)}" tall — type "30 tall" to lock it.`);
  return {
    kind: "polygon-stand",
    stem,
    program: "storage",
    titleBits: [W0 != null ? (n === 3 ? `${fmtIn(W0)}" sides` : `${fmtIn(W)}" across`) : "", H0 != null ? `${fmtIn(H)}" tall` : ""],
    panels,
    notes,
    overall: (() => {
      const xs = top.map((p) => p[0]);
      const zs = top.map((p) => p[1]);
      return { width: r8(Math.max(...xs) - Math.min(...xs)), height: H, depth: r8(Math.max(...zs) - Math.min(...zs)) };
    })(),
    typed: { width: W0 != null, height: H0 != null, depth: false },
    install: "freestanding",
    params: { n, W, H },
  };
}

function buildHoneycomb(lower: string): Build {
  const cells = countOf(lower, "cells?|hexagons?|hexes|shelves|pieces") ?? 3;
  const W0 = typedAxis(lower, "wide|width|across");
  const D0 = typedAxis(lower, "deep|depth");
  const W = W0 ?? 12; // across the flats (flat top and bottom)
  const D = D0 ?? 6;
  const R = W / Math.sqrt(3);
  const Ri = (W - 2 * T) / Math.sqrt(3);
  const side = r8(R);
  const panels: Panel[] = [];
  const baseY = W / 2 + 0.01;
  for (let c = 0; c < cells; c++) {
    const cx = c * 1.5 * R;
    const cy = baseY + (c % 2 ? W / 2 : 0);
    for (let k = 0; k < 6; k++) {
      const a0 = (Math.PI / 3) * k;
      const a1 = (Math.PI / 3) * (k + 1);
      const pts: [number, number][] = [
        [cx + R * Math.cos(a0), cy + R * Math.sin(a0)],
        [cx + R * Math.cos(a1), cy + R * Math.sin(a1)],
        [cx + Ri * Math.cos(a1), cy + Ri * Math.sin(a1)],
        [cx + Ri * Math.cos(a0), cy + Ri * Math.sin(a0)],
      ];
      const hp = facePlate(k === 4 ? "shelf" : "upright", `Hex side ${c + 1}-${k + 1}`, 0, D, pts, `${tape(side)} long on the outside edge, ${tape(D)} deep. Both ends mitered 30° (six pieces close a hexagon).`);
      hp.blank = { lengthIn: side, widthIn: D, thicknessIn: T };
      panels.push(hp);
    }
    // Hanging cleat inside the top board.
    panels.push(panel("rail", `Hanging cleat ${c + 1}`, cx - R / 2 + 0.5, cy + (W / 2 - T) - 1.5, 0, R - 1, 1.5, T));
  }
  const stem = "Hexagon honeycomb shelves";
  const notes = [`${stem}: ${cells} hexagon cells, ${fmtIn(W)}" across the flats, ${fmtIn(D)}" deep — six ${tape(side)} boards per cell, every end mitered 30°. Flat side down so the bottom board is a shelf.`];
  if (W0 == null) notes.push(`Assumed ${fmtIn(W)}" across each hexagon — type "14 wide" to lock it.`);
  if (D0 == null) notes.push(`Assumed ${fmtIn(D)}" deep — type "8 deep" to lock it.`);
  if (!countOf(lower, "cells?|hexagons?|hexes|shelves|pieces")) notes.push(`Assumed ${cells} cells — type "five hexagons" to lock the count.`);
  const totalW = r8((cells - 1) * 1.5 * R + 2 * R);
  return {
    kind: "honeycomb",
    stem,
    program: "storage",
    titleBits: [W0 != null ? `${fmtIn(W)}" cells` : ""],
    panels,
    notes,
    overall: { width: totalW, height: r8(cells > 1 ? W * 1.5 : W), depth: D },
    typed: { width: false, height: false, depth: D0 != null },
    install: "wall",
    params: { cells, W, D, side },
  };
}

// ───────────────────────────── entry points ─────────────────────────────

function build(kind: OddKind, prompt: string): Build {
  const lower = prompt.toLowerCase();
  switch (kind) {
    case "l-footprint": return buildL(lower);
    case "corner-diagonal": return buildCornerDiagonal(lower);
    case "sloped": return buildSloped(lower);
    case "wrap-opening": return buildWrap(lower);
    case "angled-corner": return buildAngled(lower);
    case "outside-corner": return buildOutside(lower);
    case "polygon-planter": return buildPolyPlanter(lower);
    case "polygon-stand": return buildPolyStand(lower);
    case "honeycomb": return buildHoneycomb(lower);
  }
}

function title(b: Build): string {
  const bits = b.titleBits.filter(Boolean);
  return bits.length ? `${b.stem} ${bits.join(" · ")}` : b.stem;
}

/** Center x on 0, sit on y = 0, start z at 0 — the bench camera frames every class the same way. */
function normalize(panels: Panel[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity;
  for (const p of panels) {
    for (const c of panelWorldCorners(p)) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      minZ = Math.min(minZ, c.z);
    }
  }
  const dx = -(minX + maxX) / 2;
  for (const p of panels) {
    p.position = { x: p.position.x + dx, y: p.position.y - minY, z: p.position.z - minZ };
  }
}

export function isOddShapePrompt(prompt: string): boolean {
  return !!oddShapeKind(prompt);
}

export function oddSpecFromPrompt(prompt: string): FittedSpec | null {
  const kind = oddShapeKind(prompt);
  if (!kind) return null;
  const b = build(kind, prompt);
  return specOf(b);
}

function specOf(b: Build): FittedSpec {
  return {
    program: b.program,
    name: title(b),
    opening: { width: b.overall.width, height: b.overall.height, depth: b.overall.depth, kind: "room" },
    unit: {
      width: b.overall.width,
      depth: b.overall.depth,
      height: b.overall.height,
      doors: b.panels.some((p) => p.type === "door"),
      odd: { kind: b.kind, params: b.params, stem: b.stem },
    },
    typedAxes: b.typed,
  };
}

export function buildOddShape(spec: FittedSpec | null, prompt: string): YardProject {
  const kind = spec?.unit?.odd?.kind ?? oddShapeKind(prompt) ?? "l-footprint";
  const b = build(kind, prompt);
  normalize(b.panels);
  const name = title(b);
  const spec2 = specOf(b);
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: b.overall,
    instances: [],
    panels: b.panels,
    primaryMaterialId: PLY,
    notes: b.notes,
    historic: false,
    opening: { ...spec2.opening },
    fitted: spec2,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: b.install === "wall" ? "wall" : "freestanding",
      wallType: "wood_stud",
    },
  };
}

// ───────────────────────────── steps ─────────────────────────────

function ids(panels: Panel[], re: RegExp) {
  return panels.filter((p) => re.test(p.name)).map((p) => p.id);
}

export function oddSteps(project: YardProject): AssemblyStep[] {
  const odd = project.fitted?.unit?.odd;
  if (!odd) return [];
  const P = project.panels;
  const pr = odd.params as Record<string, number & string & boolean>;
  const all = P.map((p) => p.id);
  const cutNotes = [...new Map(P.filter((p) => p.cutNote).map((p) => [p.name.replace(/\s*\d+(?:-\d+)?$/, ""), p.cutNote!])).entries()]
    .map(([n, c]) => `${n}: ${c}`)
    .join(" ");
  const steps: Omit<AssemblyStep, "step">[] = [];
  const add = (title: string, description: string, panelIds: string[], tips?: string) =>
    steps.push({ title, description, panelIds, instanceIds: [], tips } as Omit<AssemblyStep, "step">);
  const studs = "Find the studs with a stud finder and mark them with painter's tape.";
  switch (odd.kind) {
    case "l-footprint": {
      const desk = !!pr.desk;
      add("Measure the corner", `Check the corner is square: mark 36" along one wall and 48" along the other from the corner; the diagonal between marks should read 60". ${studs}`, []);
      add("Cut the parts", `Cut every part on the cut list. ${cutNotes} Keep the factory edges at the front.`, all);
      add("Screw the wall cleats into studs", `Level a line ${tape(pr.H - T)} up on both walls. Screw Wall cleat A along the long wall and Wall cleat B along the short wall, 2 structural screws into every stud — both walls.`, ids(P, /^Wall cleat/));
      add("Stand the end panels", `Set End panel A at the far end of the long run and End panel B at the far end of the short run. Check each is plumb and screw it to the wall cleat's end.`, ids(P, /^End panel/));
      if (desk) add("Set the corner leg", `Cut the 2x2 Leg to ${tape(pr.H - T)} and stand it under the inside corner where the two tops will meet, ${tape(pr.D)} out from both walls.`, ids(P, /^Corner leg/));
      else add("Build the seat box", `Screw Face panel A along the front of the long run and Face panel B along the short run so they meet at the inside corner. Add the seat supports mid-run. Glue and screw every joint.`, ids(P, /^Face panel|^Seat support/));
      add("Lay the two tops", `Set the long top on the cleat and end panel, then butt the short top into its front edge. Screw the Seam batten across the joint from underneath so the two tops stay flush.`, ids(P, /top|^Seam batten/i), "Clamp the seam flush before driving the batten screws.");
      add("Fasten and finish", `Screw the tops down into the cleats, end panels${desk ? ", and corner leg" : ", and face panels"} every 8". Sand the seam flush and finish.`, all);
      break;
    }
    case "corner-diagonal": {
      add("Measure the corner", `${studs} Check the corner is square (3-4-5). This cabinet is ${fmtIn(pr.L)}" along each wall.`, []);
      add("Cut the parts", `Cut every part on the cut list. ${cutNotes}`, all, "Cut one diagonal plate first and dry-fit it against both back panels before cutting the rest.");
      add("Join the two back panels at 90°", `Glue and screw Back panel B into the edge of Back panel A so they make an L that fits the corner.`, ids(P, /^Back panel/));
      add("Add the side panels", `Screw Side panel A to the end of Back panel A and Side panel B to the end of Back panel B, beveled edges facing out toward the diagonal front.`, ids(P, /^Side panel/));
      add("Fit the diagonal bottom, top, and shelves", `Set the Diagonal bottom on the floor inside the L, the Diagonal top at the top, and each Diagonal shelf between — screw through the back and side panels into each plate (4 screws per plate edge).`, ids(P, /^Diagonal (?:bottom|top|shelf)/));
      if (pr.doors) add("Hang the diagonal door", `Hang the door on the 45° front with concealed hinges into the side panel edge. Adjust so the gaps are even.`, ids(P, /door/i));
      add("Screw it into both walls", `Push it into the corner and screw through both back panels into studs on both walls, 2 structural screws per stud.`, all);
      break;
    }
    case "sloped": {
      add("Measure the slope", `Measure the height at the high side and at the low side, and the width between. This plan is ${fmtIn(pr.hiH)}" to ${fmtIn(pr.loH)}" over ${fmtIn(pr.W)}" — a ${fmtIn(pr.angle)}° slope. ${studs}`, []);
      add("Cut the angled parts", `${cutNotes} To mark an angle cut: measure the two heights on the board edges and connect them with a straight edge — no protractor needed.`, ids(P, /upright|Divider|Sloped/i));
      add("Cut the bottoms and shelves", `Cut the bottoms and shelves to the bay widths on the cut list — they are plain rectangles.`, ids(P, /^Bottom|^Shelf/));
      add("Assemble the uprights and bottoms", `Stand the uprights and dividers on edge, angled tops all sloping the same way. Glue and screw each bottom between them.`, ids(P, /upright|Divider|^Bottom/i));
      add("Fit the shelves", `Glue and screw each shelf between its uprights at the heights on the model (12" apart). Short bays near the low side get fewer shelves.`, ids(P, /^Shelf/));
      add("Add the sloped top and back", `Screw the Sloped top onto the angled upright ends, then nail the Sloped back on, squaring the case as you go.`, ids(P, /^Sloped/));
      add("Screw it into studs", `Slide it under the slope and screw through the back into studs (2 structural screws per stud) so it cannot tip.`, all);
      break;
    }
    case "wrap-opening": {
      add("Measure the opening", `Measure the ${pr.door ? "doorway" : "window"} trim to trim (${fmtIn(pr.Wo)}" here) and how high the trim reaches — the bridge starts at ${fmtIn(pr.bridgeBottom)}". ${studs}`, []);
      add("Cut the parts", "Cut every part on the cut list.", all);
      add("Build the left tower", "Glue and screw the uprights to the bottom and top, add the kick at the base, then the shelves 12\" apart. Nail on the back.", ids(P, /^Left tower/));
      add("Build the right tower", "Same as the left tower, mirrored.", ids(P, /^Right tower/));
      add("Stand the towers", `Set each tower tight to the trim on its side of the ${pr.door ? "doorway" : "window"}, plumb, and screw through the back into studs.`, ids(P, /tower/));
      add("Bridge the opening", `Screw the Bridge bottom and Bridge top between the two towers' inner uprights (4 screws per end), then the bridge shelf and back.`, ids(P, /^Bridge/), "Have a helper hold the bridge bottom level while you screw it.");
      break;
    }
    case "angled-corner": {
      add("Measure the corner angle", `Set a bevel gauge in your corner. This plan is ${fmtIn(pr.theta)}°. ${studs}`, []);
      add("Cut the wall panels", `Cut Wall panel A and Wall panel B. Set your circular saw bevel to ${fmtIn(Math.round(pr.bevel * 10) / 10)}° and rip the meeting edge of each so they close at ${fmtIn(pr.theta)}°.`, ids(P, /^Wall panel/));
      add("Cut the wedge shelves", `${cutNotes}`, ids(P, /^Wedge shelf/));
      add("Join the wall panels", `Glue the beveled edges together and screw through one into the other so they hold the ${fmtIn(pr.theta)}° angle.`, ids(P, /^Wall panel/));
      add("Fit the shelves", `Screw each wedge shelf through both wall panels (2 screws each side), bottom to top.`, ids(P, /^Wedge shelf/));
      add("Screw into both walls", `Push the unit into the corner and screw through both panels into studs on both walls.`, all);
      break;
    }
    case "outside-corner": {
      add("Mark the shelf lines", `Level a line on both walls for each shelf (12" apart), wrapping around the corner. ${studs}`, []);
      add("Cut the boards", `${cutNotes}`, ids(P, /^Wrap shelf/));
      add("Screw the cleats into both walls", `Screw a wall cleat under each line on both walls, into studs or with wall anchors rated for the load.`, ids(P, /^Wall cleat/));
      add("Set the wrap shelves", `Lay board A on its cleat so it runs past the corner, then butt board B into its back edge on the other wall. Glue the joint and drive 2 screws through A into B's end.`, ids(P, /^Wrap shelf/));
      add("Screw down and ease the corner", "Screw each board down into its cleat. Sand the outside corner round so it will not catch a hip.", all);
      break;
    }
    case "polygon-planter": {
      add("Cut the sides", `${cutNotes.split(" Planter bottom:")[0]} Tilt your saw blade to ${fmtIn(pr.bevel)}° for the bevels.`, ids(P, /^Planter side/), "Cut one test pair from scrap first and check they meet at the right angle.");
      add("Close the ring", `Tape the ${pr.n} sides together face-down on a flat surface, roll them up into the ring, then glue and brad-nail or screw each corner.`, ids(P, /^Planter side/), "A band clamp or ratchet strap pulls all corners tight at once.");
      add("Add the bottom", `Screw the bottom cleats inside the ring 2" up, trace the bottom shape inside the ring, cut it, drill drainage holes, and drop it onto the cleats.`, ids(P, /^Planter bottom|^Bottom cleat/));
      add("Finish", "Seal with exterior finish and line with landscape fabric.", all);
      break;
    }
    case "polygon-stand": {
      add("Cut the top and shelf", `${cutNotes}`, ids(P, /top|shelf/i));
      add("Cut the legs", `Cut ${pr.n} legs to ${tape(pr.H - T)} from 2x2.`, ids(P, /^Leg/));
      add("Attach the legs to the top", "Flip the top over, set each leg in from a corner, and screw down through the top into each leg (2 screws).", ids(P, /^Leg|top/i));
      add("Add the lower shelf", "Slide the lower shelf up to its line and screw through each leg into the shelf edge.", ids(P, /shelf/i));
      break;
    }
    case "honeycomb": {
      add("Cut the hexagon sides", `${cutNotes} Set a miter saw to 30° and flip the board between cuts so each piece is a trapezoid.`, ids(P, /^Hex side/), "Cut one full hexagon first and test-close it before cutting the rest.");
      add("Glue each hexagon", "Tape six sides end to end face-down, roll into a hexagon, glue every joint and strap it tight. Pin with brad nails once dry.", ids(P, /^Hex side/));
      add("Add the hanging cleats", "Glue and screw a hanging cleat under the top board at the back of each hexagon.", ids(P, /^Hanging cleat/));
      add("Hang the cells", `${studs} Screw each hanging cleat into a stud (or anchors rated for the load), nesting the cells like a honeycomb.`, all);
      break;
    }
  }
  return steps.map((s, i) => ({ ...s, step: i + 1 }) as AssemblyStep);
}

/** Shop-name family for cut lists (keeps shape words). */
export function oddCutName(name: string): string | null {
  if (/^(?:Desk|Counter|Seat) top [AB]$/.test(name)) return name;
  if (/^(?:End panel|Face panel|Seat support|Back panel|Side panel|Wall panel) [AB]$/.test(name)) return name;
  if (/^Wall cleat [AB]$/.test(name)) return name;
  if (name === "Corner leg") return "Leg";
  if (/^(?:Seam batten|Sloped top|Sloped back|Left upright|Right upright|Diagonal (?:bottom|top|door))$/.test(name)) return name;
  const m = name.match(/^(Diagonal shelf|Diagonal door|Wedge shelf|Wrap shelf [AB]|Wall cleat [AB]|Planter side|Bottom cleat|Hex side|Hanging cleat|Divider|Bottom|Shelf)\s+\d+(?:-\d+)?$/);
  if (m) return m[1];
  if (/^(?:Left|Right) tower /.test(name)) return name.replace(/^(?:Left|Right) tower /, "Tower ").replace(/^Tower (\w)/, (_x, c: string) => `Tower ${c}`);
  if (/^Bridge /.test(name)) return name;
  if (/^(?:Triangle|Square|Pentagon|Hexagon|Heptagon|Octagon|\d+-sided) (?:top|lower shelf)$/.test(name)) return name;
  if (/^Planter bottom$/.test(name)) return name;
  return null;
}
