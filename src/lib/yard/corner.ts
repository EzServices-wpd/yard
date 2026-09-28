/**
 * Corner-unit class — shelves that tuck into an inside 90° corner where two walls meet.
 *
 * Engine-wide rule (not one noun): any shelf / bookcase / shelving prompt that speaks a
 * corner (corner shelf, right-angle, triangle / triangular shelves, quarter-round,
 * "N inches along each wall") builds right-triangle (or quarter-round) shelf plates with
 * both legs against the walls. Floor units stand on two wall panels that meet at 90°;
 * floating / wall-hung units sit on a pair of wall cleats per shelf (one on each wall).
 * Legs honor the typed along-wall size; untyped legs default to 12" with an Assumed note.
 * Tiers come from the spoken shelf / tier count or the typed height.
 */

import { createId } from "@/lib/utils";
import type { AssemblyStep, CornerUnit, FittedSpec, Panel, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";
const T = 0.75;
const DEFAULT_LEG = 12;
const DEFAULT_FLOOR_H = 60;
const SHELF_GAP = 12;

const WORD_NUM: Record<string, number> = {
  one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const SHELF_NOUN =
  /\b(?:book\s*shel(?:f|ves)|bookcases?|shel(?:f|ves|ving)|etageres?|étagères?|what-?nots?)\b/;
const STRONG_CORNER =
  /\bcorner\s+(?:(?:floating|wall|book|wood(?:en)?|plywood|open|display|pine|oak|small|tall|kids?|tier(?:ed)?|\d+\s*-?\s*tier)\s+){0,3}(?:book\s*shel(?:f|ves)|bookcases?|shel(?:f|ves|ving)|units?|etageres?|étagères?|stand)\b|\bright[- ]?angle(?:d)?\b|\btriangle\b|\btriangular\b|\bquarter[- ]?(?:round|circle)\b|\balong\s+(?:each|both)\s+walls?\b|\bwhere\s+(?:the\s+)?(?:two\s+)?walls\s+meet\b|\binside\s+corner\b|\b90\s*(?:°|deg(?:ree)?s?)\s+corner\b/;
const WEAK_CORNER = /\b(?:in|into|for)\s+(?:the|a|my)\s+corner\b|\bcorner\b/;
const CORNER_HARDWARE = /\bcorner\s+(?:brace|bracket|block|post|guard|bead|clamp)s?\b|\brounded\s+corners?\b/;

/** Corner shelf intent — shelf family noun + a corner cue. Tables, desks, cabinets stay their own class. */
export function isCornerUnitPrompt(prompt: string): boolean {
  const lower = (prompt || "").toLowerCase();
  if (!SHELF_NOUN.test(lower)) return false;
  if (/\b(?:desk|table|vanity|cabinet|closet|wardrobe|pantry|dresser|bench|climb(?:ing)?|pikler|catapult|popsicle)\b/.test(lower)) {
    return false;
  }
  const scrubbed = lower.replace(CORNER_HARDWARE, " ");
  if (STRONG_CORNER.test(scrubbed)) {
    // "triangle" alone needs to describe the shelf, not a climbing triangle.
    return true;
  }
  // "bookcase 36 wide in the corner" is a rectangle placed in a corner — keep the typed width.
  if (WEAK_CORNER.test(scrubbed) && !/\b\d+(?:\.\d+)?\s*(?:in|inch|inches|["″])?\s*(?:wide|width)\b/.test(scrubbed)) {
    return true;
  }
  return false;
}

function num(s: string | undefined): number | null {
  if (s == null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const U = `\\s*(?:in|inch|inches|["″])?`;

export type CornerParse = {
  legA: number;
  legB: number;
  height: number;
  tiers: number;
  shape: "triangle" | "quarter";
  wallHung: boolean;
  typed: { legs: boolean; height: boolean; tiers: boolean };
  stem: string;
};

export function spokenCornerTierCount(lower: string): number | null {
  const adj = "(?:(?:triangle|triangular|corner|quarter[- ]?round|floating|wall|open|fixed|wood(?:en)?)\\s+){0,3}";
  const re = new RegExp(`\\b(\\d+|one|single|two|three|four|five|six|seven|eight|nine|ten)\\s*[- ]?\\s*${adj}(?:tiers?|shel(?:f|ves)|levels?)\\b`);
  const m = lower.match(re);
  if (!m) return null;
  const raw = m[1];
  const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : WORD_NUM[raw] ?? null;
  if (n == null || n < 1 || n > 14) return null;
  return n;
}

export function parseCornerPrompt(prompt: string): CornerParse {
  const lower = (prompt || "").toLowerCase().replace(/×/g, "x").replace(/[″”]/g, '"');
  const quarter = /\bquarter[- ]?(?:round|circle)\b|\bradius\b|\bcurved\s+front\b|\bround(?:ed)?\s+front\b/.test(lower);
  const wallHung = /\bfloating\b|\bwall[- ]?(?:mounted|hung|mount)\b|\bhanging\b|\bhang(?:s)?\s+on\s+the\s+wall\b|\bon\s+cleats?\b/.test(lower);

  let a: number | null = null;
  let b: number | null = null;
  // "6 inches along each wall"
  let m = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:along|on|down)\\s+(?:each|both|either)\\s+(?:side|wall)s?`));
  if (m) a = b = num(m[1]);
  // "10 inch radius" / "radius 10"
  if (a == null && quarter) {
    m = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*-?\\s*radius`)) || lower.match(/radius\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
    if (m) a = b = num(m[1]);
  }
  // "6x6" / "6 by 6" (a bare pair — not W×H×D)
  if (a == null) {
    m = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:x|by)\\s*(\\d+(?:\\.\\d+)?)(?!${U}\\s*(?:x|by)\\s*\\d)`));
    if (m && !new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:x|by)\\s*(\\d+(?:\\.\\d+)?)${U}\\s*(?:x|by)\\s*\\d`).test(lower)) {
      a = num(m[1]);
      b = num(m[2]);
    }
  }
  // "12 wide 12 deep" — width runs along one wall, depth along the other.
  if (a == null) {
    const w = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:wide|width)`));
    const d = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:deep|depth)`));
    if (w || d) {
      a = num((w ?? d)![1]);
      b = num((d ?? w)![1]);
    }
  }
  // "6 inch triangle shelves" / "6-inch corner shelf"
  if (a == null) {
    m = lower.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:in|inch|inches|")\s*(?:(?:triangle|triangular|corner|quarter[- ]?round|floating|wall|deep|wide|square)\s+){0,3}(?:shel(?:f|ves)|legs?|sides?)/);
    if (m) a = b = num(m[1]);
  }
  // "corner floating shelves 6 inch"
  if (a == null) {
    m = lower.match(/shel(?:f|ves)\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")(?!\s*(?:tall|high))/);
    if (m) a = b = num(m[1]);
  }
  const typedLegs = a != null && b != null;
  const legA = Math.min(48, Math.max(4, a ?? DEFAULT_LEG));
  const legB = Math.min(48, Math.max(4, b ?? a ?? DEFAULT_LEG));

  const hm = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)${U}\\s*(?:tall|high|height)\\b`)) || lower.match(/\b(?:height|tall)\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
  const typedH = hm ? num(hm[1]) : null;
  const spokenTiers = spokenCornerTierCount(lower);

  let tiers: number;
  let height: number;
  if (wallHung) {
    tiers = spokenTiers ?? 3;
    const gap = typedH && tiers > 1 ? Math.max(6, (typedH - 2.25) / (tiers - 1)) : SHELF_GAP;
    height = typedH ?? Math.round(((tiers - 1) * gap + 1.5 + T) * 100) / 100;
  } else if (typedH) {
    height = typedH;
    tiers = spokenTiers ?? Math.max(2, Math.round(typedH / SHELF_GAP) + 1);
  } else if (spokenTiers) {
    tiers = Math.max(2, spokenTiers);
    height = Math.ceil((tiers - 1) * SHELF_GAP + T);
  } else {
    height = DEFAULT_FLOOR_H;
    tiers = Math.round(DEFAULT_FLOOR_H / SHELF_GAP) + 1;
  }
  tiers = Math.max(wallHung ? 1 : 2, Math.min(14, tiers));
  height = Math.max(wallHung ? 2.25 : 12, Math.min(96, height));

  const bookish = /book\s*shel|bookcase|bookshelf/.test(lower);
  const noun = bookish ? (/bookcase/.test(lower) ? "bookcase" : "bookshelf") : /shelves/.test(lower) ? "shelves" : "shelf";
  const stem = quarter
    ? `Quarter-round corner ${noun}`
    : wallHung
      ? `Corner floating ${noun === "shelf" ? "shelf" : noun === "shelves" ? "shelves" : noun}`
      : `Corner ${noun}`;
  return {
    legA,
    legB,
    height,
    tiers,
    shape: quarter ? "quarter" : "triangle",
    wallHung,
    typed: { legs: typedLegs, height: typedH != null, tiers: spokenTiers != null },
    stem,
  };
}

function fmt(n: number): string {
  return Math.abs(n - Math.round(n)) < 0.01 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
}

/** Title speaks typed axes only (legs along the walls, height). */
export function cornerTitle(c: CornerParse | CornerUnit & { stem?: string }, stem: string): string {
  const bits: string[] = [];
  if (c.typed.legs) {
    bits.push(
      c.shape === "quarter" ? `${fmt(c.legA)}" radius` : `${fmt(c.legA)}" × ${fmt(c.legB)}" along the walls`,
    );
  }
  if (c.typed.height) bits.push(`${fmt(c.height)}" tall`);
  return bits.length ? `${stem} ${bits.join(" · ")}` : stem;
}

export function cornerSpecFromPrompt(prompt: string): FittedSpec {
  const c = parseCornerPrompt(prompt);
  const program = /book\s*shel|bookcase|bookshelf/.test(prompt.toLowerCase()) ? "bookcase" : "storage";
  const corner: CornerUnit = {
    shape: c.shape,
    legA: c.legA,
    legB: c.legB,
    height: c.height,
    tiers: c.tiers,
    wallHung: c.wallHung,
    typed: c.typed,
    stem: c.stem,
  };
  return {
    program,
    name: cornerTitle(c, c.stem),
    opening: { width: c.legA, height: c.height, depth: c.legB, kind: "room" },
    unit: {
      width: c.legA,
      depth: c.legB,
      height: c.height,
      shelfCount: c.tiers,
      doors: false,
      corner,
    },
    typedAxes: { width: c.typed.legs, height: c.typed.height, depth: c.typed.legs },
  };
}

function plate(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, outline?: Panel["outline"]): Panel {
  const p: Panel = {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: PLY,
  };
  if (outline) p.outline = outline;
  return p;
}

function r8(n: number) {
  return Math.round(n * 8) / 8;
}

export function buildCornerUnit(spec: FittedSpec, prompt: string): YardProject {
  // Measure refits keep the corner class — unit W/D/H win over the prompt parse.
  const fromPrompt = parseCornerPrompt(prompt);
  const prior = spec.unit.corner;
  const c: CornerUnit = prior
    ? {
        ...prior,
        legA: spec.unit.width || prior.legA,
        legB: spec.unit.depth || prior.legB,
        height: spec.unit.height || prior.height,
        tiers: prior.tiers,
      }
    : {
        shape: fromPrompt.shape,
        legA: fromPrompt.legA,
        legB: fromPrompt.legB,
        height: fromPrompt.height,
        tiers: fromPrompt.tiers,
        wallHung: fromPrompt.wallHung,
        typed: fromPrompt.typed,
        stem: fromPrompt.stem,
      };
  if (c.shape === "quarter") c.legB = c.legA;
  const a = c.legA;
  const b = c.legB;
  const H = c.height;
  const N = c.tiers;
  const x0 = -a / 2;
  const panels: Panel[] = [];
  const shapeWord = c.shape === "quarter" ? "Quarter-round shelf" : "Triangle shelf";
  const outline: Panel["outline"] = c.shape === "quarter" ? "quarter-round" : "right-triangle";

  if (!c.wallHung) {
    // Two wall panels meet at 90°: A runs along the back wall, B butts into A along the side wall.
    panels.push(plate("upright", "Wall panel A", x0, 0, 0, a, H, T));
    panels.push(plate("upright", "Wall panel B", x0, 0, T, T, H, b - T));
    const sa = r8(a - T);
    const sb = c.shape === "quarter" ? sa : r8(b - T);
    const step = N > 1 ? (H - T) / (N - 1) : 0;
    for (let i = 0; i < N; i++) {
      const y = i === N - 1 ? H - T : r8(i * step);
      panels.push(plate("shelf", `${shapeWord} ${i + 1}`, x0 + T, y, T, sa, T, sb, outline));
    }
  } else {
    const cleatH = 1.5;
    const gap = N > 1 ? (H - cleatH - T) / (N - 1) : 0;
    // Cleats stay hidden inside the shelf silhouette (a triangle narrows toward its tip).
    const inset = c.shape === "quarter" ? 0 : 1;
    const cleatA = r8(Math.max(2, (c.shape === "quarter" ? a : a * (1 - T / b)) - 0.25 * inset - (c.shape === "quarter" ? 0.5 : 0)));
    const cleatB = r8(Math.max(2, (c.shape === "quarter" ? b : b * (1 - T / a)) - T - 0.25 * inset - (c.shape === "quarter" ? 0.5 : 0)));
    for (let i = 0; i < N; i++) {
      const y = r8(i * gap);
      panels.push(plate("rail", `Wall cleat A ${i + 1}`, x0, y, 0, cleatA, cleatH, T));
      panels.push(plate("rail", `Wall cleat B ${i + 1}`, x0, y, T, T, cleatH, cleatB));
      panels.push(plate("shelf", `${shapeWord} ${i + 1}`, x0, y + cleatH, 0, a, T, b, outline));
    }
  }

  const stem = c.stem || fromPrompt.stem;
  const name = cornerTitle(c, stem);
  const notes: string[] = [];
  if (c.shape === "quarter") {
    notes.push(
      `${name}. Quarter-round shelves (${fmt(a)}" radius) tuck into a 90° inside corner — both straight edges sit against the walls.`,
    );
  } else {
    notes.push(
      `${name}. Right-triangle shelves (${fmt(a)}" × ${fmt(b)}" along the walls) tuck into a 90° inside corner — both short edges sit against the walls.`,
    );
  }
  notes.push(
    c.wallHung
      ? `${N} shel${N === 1 ? "f" : "ves"}, each on two wall cleats that meet in the corner (one cleat on each wall). Screw every cleat into both walls.`
      : `${N} fixed shelves between two wall panels that meet at 90° (Wall panel A on one wall, Wall panel B on the other). Screw both panels into the walls so it cannot tip.`,
  );
  if (c.shape === "triangle") {
    notes.push(
      `Cutting tip: one straight diagonal cut through a ${fmt(c.wallHung ? a : r8(a - T))}" × ${fmt(c.wallHung ? b : r8(b - T))}" square gives two triangle shelves.`,
    );
  } else {
    notes.push(
      `Cutting tip: draw each arc with a pencil on a ${fmt(c.wallHung ? a : r8(a - T))}" string pinned at the square's corner, then cut on the line with a jigsaw.`,
    );
  }
  if (!c.typed.legs) {
    notes.push(`Assumed ${fmt(a)}" along each wall (corner shelf default) — type a size like "8 inches along each wall" to lock it.`);
  }
  if (!c.typed.height && !c.wallHung) {
    notes.push(`Assumed ${fmt(H)}" tall (corner shelf default) — type a height like "48 tall" to lock it.`);
  }
  if (!c.typed.tiers) {
    notes.push(
      c.wallHung && !c.typed.height
        ? `Assumed ${N} shel${N === 1 ? "f" : "ves"}, 12" apart (floating corner default) — type a count like "four shelves" to lock it.`
        : `Assumed ${N} shel${N === 1 ? "f" : "ves"} (from the height) — type a count like "five shelves" to lock it.`,
    );
  }
  notes.push("Walls are rarely a perfect 90°. Dry-fit one shelf in the corner first and shave the edge that touches if it rocks.");

  const spec2: FittedSpec = {
    ...spec,
    program: /book/i.test(stem) ? "bookcase" : "storage",
    name,
    family: c.wallHung ? "hung-open" : spec.family,
    opening: { width: a, height: H, depth: b, kind: "room" },
    unit: {
      ...spec.unit,
      width: a,
      depth: b,
      height: H,
      shelfCount: N,
      doors: false,
      drawersPerBank: undefined,
      rod: false,
      kneeW: undefined,
      counterH: undefined,
      mirror: false,
      bays: undefined,
      cubbies: undefined,
      corner: { ...c, stem },
    },
    typedAxes: { width: c.typed.legs, height: c.typed.height, depth: c.typed.legs },
  };
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: a, height: H, depth: b },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: { width: a, height: H, depth: b, kind: "room" },
    fitted: spec2,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

function inch(n: number) {
  return `${fmt(n)}"`;
}

/** 11.875 → 11⅞ style talk a tape measure reads (nearest 1/8"). */
function tape(n: number): string {
  const e = Math.round(n * 8);
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (!rem) return `${whole}"`;
  const g = rem % 4 === 0 ? 4 : rem % 2 === 0 ? 2 : 1;
  const frac = `${rem / g}/${8 / g}`;
  return whole ? `${whole} ${frac}"` : `${frac}"`;
}

function cutTalk(p: Panel): string {
  const { width: w, height: h, depth: d } = p.size;
  if (p.outline === "right-triangle") return `${p.name} — ${inch(w)} × ${inch(d)} legs, ¾" thick`;
  if (p.outline === "quarter-round") return `${p.name} — ${inch(w)} radius, ¾" thick`;
  const dims = [w, h, d].sort((x, y) => y - x);
  return `${p.name} — ${dims.map((n) => fmt(n)).join(" × ")}"`;
}

/** Build steps for the corner class — cut list, Buy, and steps speak the same pieces. */
export function cornerSteps(project: YardProject): AssemblyStep[] {
  const c = project.fitted?.unit?.corner;
  if (!c) return [];
  const panels = project.panels;
  const shelves = panels.filter((p) => p.type === "shelf");
  const wallPanels = panels.filter((p) => /^Wall panel/i.test(p.name));
  const cleatsA = panels.filter((p) => /^Wall cleat A/i.test(p.name));
  const cleatsB = panels.filter((p) => /^Wall cleat B/i.test(p.name));
  const s0 = shelves[0];
  const sa = s0?.size.width ?? c.legA;
  const sb = s0?.size.depth ?? c.legB;
  const tri = c.shape === "triangle";
  const squares = Math.ceil(shelves.length / 2);
  const sorted = [...shelves].sort((p, q) => p.position.y - q.position.y);
  const heights = sorted.map((p, i) => `shelf ${i + 1} at ${tape(p.position.y)}`).join(", ");
  const lowestCleat = cleatsA.length ? Math.min(...cleatsA.map((p) => p.position.y)) : 0;
  const cleatMarks = [...cleatsA]
    .sort((p, q) => p.position.y - q.position.y)
    .map((p, i) => `cleat pair ${i + 1} at ${tape(p.position.y - lowestCleat)}`)
    .join(", ");
  const steps: AssemblyStep[] = [];
  let n = 1;
  steps.push({
    step: n++,
    title: "Check the corner — do not cut yet",
    description: `${project.name}. This tucks into an inside corner where two walls meet. Hold a framing square (or a big book) in the corner: if the walls meet at 90°, the shelves sit flat against both walls. Measure ${inch(c.legA)} out along one wall and ${inch(c.legB)} along the other and mark both. ${c.wallHung ? "Find the studs or corner framing on both walls with a stud finder." : `The unit stands ${inch(c.height)} tall on the floor; check nothing (outlet, baseboard heater, vent) is in the way.`} ${shelves.length} ${tri ? "triangle" : "quarter-round"} shelves${c.wallHung ? `, ${cleatsA.length + cleatsB.length} wall cleats` : ", 2 wall panels"} on this list.`,
    tips: "Baseboard in the corner? Measure above it, or notch the bottom of the wall panels to clear it. If a number here disagrees with the cut list, trust the cut list.",
    partsUsed: ["*"],
  });
  if (tri) {
    steps.push({
      step: n++,
      title: "Cut the triangle shelves — one diagonal cut makes two",
      description: `Cut ${squares} square${squares === 1 ? "" : "s"} ${inch(sa)} × ${inch(sb)} from the ¾" plywood. Draw a straight line from one corner of each square to the opposite corner (the diagonal). Clamp the square down, and cut on that line with a circular saw or jigsaw. Each square becomes two matching triangle shelves — you need ${shelves.length}.${shelves.length % 2 ? " One half is a spare." : ""} The two short, square edges go against the walls; the long cut edge faces the room. Sand the long edge smooth.`,
      tips: "Lumber-aisle staff can cut the squares; the diagonal is easy at home. Label each shelf on the underside.",
      partsUsed: shelves.map((p) => p.name),
    });
  } else {
    steps.push({
      step: n++,
      title: "Cut the quarter-round shelves",
      description: `Cut ${shelves.length} square${shelves.length === 1 ? "" : "s"} ${inch(sa)} × ${inch(sa)} from the ¾" plywood. On each square, tie a pencil to a string, pin the string at one corner so the pencil reaches ${inch(sa)}, and swing an arc across the square. Cut on the arc with a jigsaw. The two straight edges go against the walls; the curve faces the room. Sand the curve smooth.`,
      tips: "Cut just outside the line, then sand to it — a jigsaw blade wanders on curves.",
      partsUsed: shelves.map((p) => p.name),
    });
  }
  if (!c.wallHung) {
    steps.push({
      step: n++,
      title: "Cut the two wall panels",
      description: `${wallPanels.map(cutTalk).join("; ")}. Panel B is ¾" narrower than A because it butts into the back face of A — together they measure ${inch(c.legA)} and ${inch(c.legB)} along the walls.`,
      tips: "Circular saw and a straightedge, or have the lumber aisle rip them. Label each piece.",
      partsUsed: wallPanels.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: "Join the wall panels into an L (90° corner)",
      description: `Stand Wall panel A on its long edge. Set Wall panel B against the face of A at one end so they make an L. Glue the joint and drive #8 × 1¼" screws through A into the edge of B, one every 8" from top to bottom. Check the L with a framing square before the glue sets.`,
      tips: "Predrill so the plywood edge does not split.",
      partsUsed: wallPanels.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: `Fix the ${shelves.length} shelves inside the L`,
      description: `Mark the shelf heights on both panels: ${heights} (measured from the floor to the bottom of each shelf). Set each shelf so its two short edges sit tight inside the L. Glue the edges and drive 2 #8 × 1¼" screws through Wall panel A and 2 through Wall panel B into each shelf edge (4 screws per shelf). The bottom shelf sits on the floor; the top shelf caps the unit.`,
      tips: "Start with the bottom and top shelves — they square up the L. Predrill every screw.",
      partsUsed: shelves.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: "Screw it into both walls",
      description: `Push the unit into the corner. Find a stud (or the corner framing) behind each wall panel with a stud finder. Drive 2 structural screws (3") through Wall panel A into the wall and 2 through Wall panel B into the other wall — one pair near the top, one near the middle. A tall narrow shelf will tip forward if it is only standing on the floor.`,
      tips: "Guidance only — hit wood behind the drywall. Confirm there are no wires or pipes in the corner before you drive a screw.",
      partsUsed: wallPanels.map((p) => p.name),
    });
  } else {
    const allCleats = [...cleatsA, ...cleatsB];
    steps.push({
      step: n++,
      title: "Cut the wall cleats",
      description: `Rip 1½"-wide strips from the ¾" plywood and cut ${cleatsA.length} cleats ${inch(cleatsA[0]?.size.width ?? 0)} long (wall A) and ${cleatsB.length} cleats ${inch(cleatsB[0]?.size.depth ?? 0)} long (wall B). The cleats are shorter than the shelf edges so they hide under the shelf.`,
      tips: "Label cleats A and B so the pairs stay together.",
      partsUsed: allCleats.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: "Screw a pair of cleats into both walls for each shelf",
      description: `Pick the height of the lowest shelf. Mark the bottom of every cleat pair on both walls with a level, measured up from the lowest cleat: ${cleatMarks}. For each shelf, screw cleat A to one wall and cleat B to the other so they meet in the corner at the same height. Drive 3" structural screws through each cleat into a stud or the corner framing (2 per cleat).`,
      tips: "Guidance only — hit wood behind the drywall. Keep each pair level so the shelf sits flat.",
      partsUsed: allCleats.map((p) => p.name),
    });
    steps.push({
      step: n++,
      title: "Set each shelf on its cleats and screw down",
      description: `Drop each shelf onto its pair of cleats with the two short edges against the walls. Drive 2 #8 × 1¼" screws down through the shelf into each cleat (4 per shelf).`,
      tips: "Predrill near the edges so the plywood does not split.",
      partsUsed: shelves.map((p) => p.name),
    });
  }
  steps.push({
    step: n++,
    title: "Load it and check",
    description: `Press down on the front point of each shelf. It should feel solid on both walls. Put the heaviest books on the lowest shelves.`,
    tips: "If a shelf rocks, the walls are not quite 90° — shim behind the loose side or sand the edge that touches.",
    partsUsed: shelves.map((p) => p.name),
  });
  return steps;
}
