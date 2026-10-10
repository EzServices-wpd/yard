/**
 * Real objects people name by their head noun: a framed mirror, a baby gate, a firewood rack, a board
 * cover for a sandbox, an open-top crate for a stored item. With no craft stock or model word typed they
 * build in lumber at the size people use them; the modifier ("vanity", "baby", "firewood", "sandbox",
 * "record") picks the variant and never the class.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import type { Purpose } from "./purpose";
import type { Panel, YardProject } from "./types";

export type RealObject = "mirror" | "baby-gate" | "firewood-rack" | "cover" | "rung-ladder";

const CRAFT = /popsicle|craft\s*sticks?|toothpicks?|skewers?|cardboard|chipboard|lego|\bstraws?\b|balsa|dowels?|pipe\s*cleaners?|paper|foam|clay/;
const MODEL = /\b(?:doll|dollhouse|barbie|miniature|mini|model|toy|tiny|figurine|ornament|scale|diorama|fairy)\b/;
const SIZE = /(\d+(?:\.\d+)?)\s*(?:'|ft|foot|feet|"|in(?:ch(?:es)?)?)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:'|ft|foot|feet|"|in(?:ch(?:es)?)?)?|\d+(?:\.\d+)?\s*(?:'|ft|foot|feet|"|in(?:ch(?:es)?)?)?\s*(?:wide|tall|high|deep|long)?/g;

/** The words that name the thing: before any feature / purpose / stock tail, sizes removed. */
export function headPhrase(lower: string): string {
  return lower
    .split(/\s+(?:with|for|from|having|including|plus|made|out\s+of|that|which)\s+/)[0]
    .replace(SIZE, " ")
    .replace(/\b(?:a|an|the|wide|tall|high|deep|long)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function realObjectKind(prompt: string, materialOverride?: string): RealObject | null {
  const lower = prompt.toLowerCase();
  if (CRAFT.test(`${lower} ${materialOverride ?? ""}`) || MODEL.test(lower)) return null;
  if (materialOverride && !/^lumber-|^plywood-/.test(materialOverride)) return null;
  const head = headPhrase(lower);
  if (/\bmirrors?(?:\s+frames?)?$|\bframed\s+mirrors?$/.test(head)) return "mirror";
  if (/\b(?:baby|child|kid|toddler|safety|stair|pet|dog|puppy)\s+gates?$/.test(head)) return "baby-gate";
  if (/\b(?:fire\s*wood|log|wood)\s+(?:racks?|holders?|stands?)$/.test(head)) return "firewood-rack";
  if (/\b(?:blanket|quilt|towel)\s+ladders?\b/.test(head)) return "rung-ladder";
  if (/\b(?:sand\s*box|sand\s*pit|well|(?:raised\s+)?(?:garden\s+)?bed|fire\s*pit|hot\s*tub)\s+(?:covers?|lids?)$/.test(head)) return "cover";
  return null;
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId: string, extra: Partial<Panel> = {}): Panel {
  return { id: createId(type.slice(0, 2)), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId, ...extra };
}

function project(prompt: string, name: string, panels: Panel[], W: number, H: number, D: number, notes: string[], primary: string, installMode: "freestanding" | "wall" = "freestanding"): YardProject {
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
    assumptions: { load: "medium", units: "inches", installMode, wallType: "wood_stud", use: "person" },
  };
}

const r16 = (n: number) => Math.round(n * 16) / 16;
const ft = (n: number) => {
  const f = Math.floor(n / 12);
  const i = Math.round(n - f * 12);
  return f ? (i ? `${f}' ${i}"` : `${f}'`) : `${i}"`;
};

/** A typed number on an axis word, inches unless feet are said. */
function axis(lower: string, word: string): number | null {
  const m = lower.match(new RegExp(String.raw`(\d+(?:\.\d+)?)\s*('|ft|foot|feet|"|in|inch|inches)?\s*(?:${word})\b`));
  return m ? (/'|ft|foot|feet/.test(m[2] ?? "") ? Number(m[1]) * 12 : Number(m[1])) : null;
}

/** "24 by 36" / "4x4" / "4 ft by 4 ft": the first number across, the second along. Small bare pairs on yard objects are feet. */
function pair(lower: string, feetUnder = 0): [number, number] | null {
  const m = lower.match(/(\d+(?:\.\d+)?)\s*('|ft|foot|feet|"|in(?:ch(?:es)?)?)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*('|ft|foot|feet|"|in(?:ch(?:es)?)?)?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const feet = /'|ft|foot|feet/.test(`${m[2] ?? ""}${m[4] ?? ""}`) || (!m[2] && !m[4] && a <= feetUnder && b <= feetUnder);
  return feet ? [a * 12, b * 12] : [a, b];
}

/**
 * Framed mirror: a 1×3 face frame (stiles full height, rails between, glued and pocket-screwed), the glass
 * behind it lapping 3/8" under the frame all round, a 1×2 spacer ring around the glass and a 1/4" plywood
 * backer. It hangs on a French cleat, so the backer is the face against the wall.
 */
function buildMirror(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const p = pair(lower);
  const gw = size ? size.width - 4.25 : (axis(lower, "wide|width|across") ?? p?.[0] ?? 24);
  const gh = size ? size.height - 4.25 : (axis(lower, "tall|high|height") ?? p?.[1] ?? Math.round(gw * 1.25));
  const face = 2.5;
  const lip = 0.375;
  const W = r16(gw - 2 * lip + 2 * face);
  const H = r16(gh - 2 * lip + 2 * face);
  const ring = r16(gw + 0.125 + 3);
  const ringH = r16(gh + 0.125 + 3);
  const ox = (W - ring) / 2;
  const oy = (H - ringH) / 2;
  const panels: Panel[] = [];
  // Back to front: backer (on the wall), spacer ring + glass, face frame.
  panels.push(panel("back", "Backer", ox, oy, 0, ring, ringH, 0.25, "plywood-1-4-4x8"));
  const zr = 0.25;
  panels.push(panel("rail", "Spacer bottom", ox, oy, zr, ring, 1.5, 0.75, "lumber-1x2-8"));
  panels.push(panel("rail", "Spacer top", ox, oy + ringH - 1.5, zr, ring, 1.5, 0.75, "lumber-1x2-8"));
  panels.push(panel("upright", "Spacer left", ox, oy + 1.5, zr, 1.5, ringH - 3, 0.75, "lumber-1x2-8"));
  panels.push(panel("upright", "Spacer right", ox + ring - 1.5, oy + 1.5, zr, 1.5, ringH - 3, 0.75, "lumber-1x2-8"));
  panels.push(panel("mirror", "Mirror glass", (W - gw) / 2, (H - gh) / 2, zr + 0.5, gw, gh, 0.25, "mirror-glass", { cutNote: `1/4" mirror glass cut to ${inchFrac(gw)}" × ${inchFrac(gh)}" (have the glass shop cut and edge it).` }));
  const zf = zr + 0.75;
  panels.push(panel("upright", "Left stile", 0, 0, zf, face, H, 0.75, "lumber-1x3-8"));
  panels.push(panel("upright", "Right stile", W - face, 0, zf, face, H, 0.75, "lumber-1x3-8"));
  panels.push(panel("rail", "Bottom rail", face, 0, zf, W - 2 * face, face, 0.75, "lumber-1x3-8"));
  panels.push(panel("rail", "Top rail", face, H - face, zf, W - 2 * face, face, 0.75, "lumber-1x3-8"));
  const D = zf + 0.75;
  const title = /\bvanity\b/.test(lower) ? "Vanity mirror" : /\bbathroom\b/.test(lower) ? "Bathroom mirror" : /\bmirror\s+frame/.test(lower) ? "Mirror frame" : "Framed mirror";
  const name = `${title} ${inchFrac(gw)}" × ${inchFrac(gh)}"`;
  const notes = [
    `${name}: a ${inchFrac(gw)}" × ${inchFrac(gh)}" mirror in a 1×3 frame, ${inchFrac(W)}" × ${inchFrac(H)}" outside, the frame lapping ${lip * 8}/8" over the glass on every side so the visible mirror is ${inchFrac(gw - 2 * lip)}" × ${inchFrac(gh - 2 * lip)}".`,
    `Glue and pocket-screw the rails between the stiles. Face down, set the glass behind the frame, ring it with the 1×2 spacers glued to the frame back, and screw the 1/4" plywood backer to the spacers.`,
    `Hang it on a French cleat screwed into two wall studs; mirror glass is heavy, so keep the cleat as wide as the backer allows.`,
  ];
  return project(prompt, name, panels, W, H, r16(D), notes, "lumber-1x3-8", "wall");
}

/**
 * Baby / stair gate: a 1×3 frame with 1×2 pickets on its face, the gaps between pickets under 2 3/8"
 * (the crib-slat spacing a child's head cannot pass). Hardware-mounted to the wall: two hinges and a latch
 * into studs, which is the mount for the top of a stair.
 */
function buildBabyGate(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const W = size?.width ?? axis(lower, "wide|width|across") ?? 36;
  const H = size?.height ?? axis(lower, "tall|high|height") ?? 30;
  const face = 2.5;
  const picket = 1.5;
  const maxGap = 2.25;
  const inner = W - 2 * face;
  const n = Math.max(1, Math.ceil((inner - maxGap) / (picket + maxGap)));
  const gap = (inner - n * picket) / (n + 1);
  const panels: Panel[] = [];
  panels.push(panel("upright", "Hinge stile", 0, 0, 0, face, H, 0.75, "lumber-1x3-8"));
  panels.push(panel("upright", "Latch stile", W - face, 0, 0, face, H, 0.75, "lumber-1x3-8"));
  panels.push(panel("rail", "Bottom rail", face, 0, 0, inner, face, 0.75, "lumber-1x3-8"));
  panels.push(panel("rail", "Top rail", face, H - face, 0, inner, face, 0.75, "lumber-1x3-8"));
  for (let i = 0; i < n; i++) panels.push(panel("side", `Picket ${i + 1}`, face + gap + i * (picket + gap), 0, 0.75, picket, H, 0.75, "lumber-1x2-8"));
  const who = lower.match(/\b(baby|child|kid|toddler|safety|stair|pet|dog|puppy)\s+gate/)?.[1] ?? "baby";
  const title = `${who.charAt(0).toUpperCase()}${who.slice(1)} gate`;
  const name = `${title} ${inchFrac(W)}" × ${inchFrac(H)}"`;
  const notes = [
    `${name}: a 1×3 frame (stiles full height, rails between) with ${n} 1×2 pickets on its face, ${inchFrac(r16(gap))}" apart — under the 2 3/8" a child's head can pass.`,
    `Hang the hinge stile on two hinges screwed into a wall stud and latch the other stile to a stud on the far side, 1" above the floor. A hardware-mounted gate like this is the one for the top of a stair.`,
    `Round every edge and sand smooth; paint or finish with a child-safe finish.`,
  ];
  return project(prompt, name, panels, W, H, 1.5, notes, "lumber-1x3-8");
}

/**
 * Firewood rack: two 2×4 base rails on edge, off the ground on 2×4 sleepers, with 2×4 uprights at each end
 * tied across the top. Open on every face so the stack dries; 16" logs sit across the rails.
 */
function buildFirewoodRack(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const W = Math.min(192, size?.width ?? axis(lower, "wide|width|long|length") ?? 96);
  const H = size?.height ?? axis(lower, "tall|high|height") ?? 48;
  const log = 16;
  const id = "lumber-2x4-8";
  const panels: Panel[] = [];
  const D = log + 2.5;
  const nS = Math.max(2, Math.ceil(W / 48) + 1);
  for (let i = 0; i < nS; i++) {
    const x = i === 0 ? 0 : i === nS - 1 ? W - 3.5 : (W * i) / (nS - 1) - 1.75;
    panels.push(panel("rail", `Sleeper ${i + 1}`, x, 0, 0, 3.5, 1.5, D, id));
  }
  const rails = W > 96 ? [[0, W / 2], [W / 2, W]] : [[0, W]];
  for (const [side, z] of [["back", 1.5], ["front", D - 3]] as const) {
    rails.forEach(([a, b], k) => panels.push(panel("rail", `Base rail ${side}${rails.length > 1 ? ` ${k + 1}` : ""}`, a, 1.5, z, b - a, 3.5, 1.5, id)));
  }
  for (const [end, x] of [["left", 0], ["right", W - 3.5]] as const) {
    for (const [side, z] of [["back", 0], ["front", D - 1.5]] as const) panels.push(panel("upright", `Upright ${end} ${side}`, x, 1.5, z, 3.5, H - 1.5, 1.5, id));
    panels.push(panel("rail", `Top tie ${end}`, x, H - 3.5, 1.5, 3.5, 3.5, D - 3, id));
  }
  const name = `Firewood rack ${ft(W)} × ${ft(H)}`;
  const stackH = H - 5;
  const faceCord = Math.round(((W - 7) * stackH * log) / 1728 / 42.67 * 4) / 4;
  const notes = [
    `${name}: two 2×4 base rails on edge sit on ${nS} 2×4 sleepers, 5" off the ground, with doubled 2×4 uprights at each end screwed to the rail ends and tied across the top. Open front, back and top so the wood dries.`,
    `Stack 16" logs across the rails between the uprights: ${inchFrac(W - 7)}" long by ${inchFrac(stackH)}" high, about ${faceCord} face cord.`,
    `Pressure-treated lumber rated for ground contact on the sleepers, exterior screws. Set the sleepers on pavers or gravel to keep them dry.`,
  ];
  return project(prompt, name, panels, W, H, D, notes, id);
}

/**
 * Blanket / quilt / towel ladder: two 1×4 rails on edge with 2×2 rungs screwed between them, leaned against
 * the wall. The floor carries the rail feet and the wall the rail tops; each rung hangs between the rails.
 */
function buildRungLadder(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const W = size?.width ?? axis(lower, "wide|width|across") ?? 20;
  const H = size?.height ?? axis(lower, "tall|high|height") ?? 72;
  const words: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const said = lower.match(/\b(\d+|three|four|five|six|seven)\s+rungs?\b/)?.[1];
  const n = said ? (words[said] ?? Math.max(2, Math.min(10, parseInt(said, 10)))) : Math.max(3, Math.round((H - 12) / 12));
  const rail = 0.75, D = 3.5, rung = 1.5;
  const step = (H - 12) / n;
  const panels: Panel[] = [
    panel("upright", "Left rail", 0, 0, 0, rail, H, D, "lumber-1x4-8"),
    panel("upright", "Right rail", W - rail, 0, 0, rail, H, D, "lumber-1x4-8"),
  ];
  for (let i = 0; i < n; i++) panels.push(panel("rail", `Rung ${i + 1}`, rail, r16(12 + i * step), (D - rung) / 2, W - 2 * rail, rung, rung, "lumber-2x2-8"));
  const title = `${(lower.match(/\b(blanket|quilt|towel)\b/)?.[1] ?? "blanket").replace(/^\w/, (c) => c.toUpperCase())} ladder`;
  const name = `${title} ${inchFrac(W)}" × ${ft(H)}`;
  const notes = [
    `${name}: two 1×4 rails on edge with ${n} 2×2 rungs, ${inchFrac(r16(step))}" apart, the first 12" up. Two screws through each rail into every rung end.`,
    `Lean it against the wall with the feet about 8" out; a felt pad on each foot keeps it from sliding.`,
  ];
  return project(prompt, name, panels, W, H, D, notes, "lumber-1x4-8");
}

/** Board cover for a sandbox / raised bed / well: 1×6 boards with 1/4" gaps screwed to 2×4 cleats underneath. */
function buildCover(prompt: string, size?: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  const p = pair(lower, 16);
  const W = size?.width ?? axis(lower, "wide|width|long|length") ?? p?.[0] ?? 48;
  const D = size?.depth ?? axis(lower, "deep|depth") ?? p?.[1] ?? W;
  const id = "lumber-1x6-8";
  const panels: Panel[] = [];
  const nC = Math.max(2, Math.ceil((W - 6) / 24) + 1);
  for (let i = 0; i < nC; i++) panels.push(panel("rail", `Cleat ${i + 1}`, 3 + ((W - 9.5) * i) / (nC - 1), 0, 2, 3.5, 1.5, D - 4, "lumber-2x4-8"));
  const n = Math.max(2, Math.round((D + 0.25) / 5.75));
  const bw = (D - 0.25 * (n - 1)) / n;
  for (let i = 0; i < n; i++) panels.push(panel("top", `Board ${i + 1}`, 0, 1.5, i * (bw + 0.25), W, 0.75, r16(bw), id));
  const what = lower.match(/\b(sand\s*box|sand\s*pit|well|raised\s+(?:garden\s+)?bed|garden\s+bed|bed|fire\s*pit|hot\s*tub)\s+(cover|lid)/);
  const title = what ? `${what[1].charAt(0).toUpperCase()}${what[1].slice(1)} ${what[2]}` : "Cover";
  const name = `${title} ${ft(W)} × ${ft(D)}`;
  const notes = [
    `${name}: ${n} 1×6 boards with 1/4" gaps, screwed to ${nC} 2×4 cleats underneath. The cleats sit 2" in from the edges so the cover drops inside the frame and cannot slide off.`,
    `Two exterior handles on top, one near each end, make it a one-person lift. Cedar or pressure-treated boards and exterior screws.`,
  ];
  return project(prompt, name, panels, W, 2.25, D, notes, id);
}

export function buildRealObject(prompt: string, kind: RealObject, size?: { width: number; height: number; depth: number }): YardProject {
  if (kind === "mirror") return buildMirror(prompt, size);
  if (kind === "baby-gate") return buildBabyGate(prompt, size);
  if (kind === "firewood-rack") return buildFirewoodRack(prompt, size);
  if (kind === "rung-ladder") return buildRungLadder(prompt, size);
  return buildCover(prompt, size);
}

/**
 * Open-top crate for a stored item (LP records, books): the item sizes the inside (its depth plus 1" across),
 * walls of 1× board tall enough to hold the item upright with a grip above, hand holds in the ends.
 */
export function buildItemCrate(prompt: string, purpose: Purpose): YardProject {
  const lower = prompt.toLowerCase();
  const { h, d } = purpose.item.clear;
  const across = d + 1;
  const run = axis(lower, "long|length") ?? 14;
  const boards: [string, number][] = [["lumber-1x8-8", 7.25], ["lumber-1x10-8", 9.25], ["lumber-1x12-8", 11.25]];
  const [id, wall] = boards.find(([, f]) => f >= h * 0.85) ?? boards[2];
  const t = 0.75;
  const W = run + 2 * t;
  const D = across + 2 * t;
  const panels: Panel[] = [];
  const hold = `Cut a 1" × 4" hand hold centred across it, 1 1/2" down from the top edge (drill two 1" holes and jigsaw between).`;
  panels.push(panel("side", "Left end", 0, 0, 0, t, wall, D, id, { cutNote: hold }));
  panels.push(panel("side", "Right end", W - t, 0, 0, t, wall, D, id, { cutNote: hold }));
  panels.push(panel("side", "Back side", t, 0, 0, run, wall, t, id));
  panels.push(panel("side", "Front side", t, 0, D - t, run, wall, t, id));
  panels.push(panel("bottom", "Bottom", t, 0, t, run, 0.5, across, "plywood-1-2-4x8"));
  const word = purpose.word.charAt(0).toUpperCase() + purpose.word.slice(1);
  const name = `${word} crate ${inchFrac(W)}" × ${inchFrac(wall)}" × ${inchFrac(D)}"`;
  const notes = [
    `${name}: open top, ${inchFrac(across)}" inside across for ${purpose.item.label} (${inchFrac(d)}" deep) and ${inchFrac(run)}" inside along the row; ${inchFrac(wall)}" walls hold them upright with the tops standing clear to flip through.`,
    `Glue and screw the sides between the ends, then screw the 1/2" plywood bottom in from the sides and ends. A hand hold in each end makes it a carry crate.`,
  ];
  return project(prompt, name, panels, W, wall, D, notes, id);
}
