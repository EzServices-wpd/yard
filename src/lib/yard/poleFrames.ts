/**
 * Pole frames and trellises, built in whatever stock is typed.
 *
 * Cone family (tepee / teepee / tipi, bean pole tower, cone or obelisk trellis, tripod): straight poles
 * from a splayed ring on the ground to one top tie where they are lashed; garden towers add horizontal
 * ties up the cone for vines to climb. Trellis: two stiles and a grid of slats, 6–8' tall at full size.
 * With no craft stock typed these are full-size garden builds; craft stock or a model word scales them
 * to the bench.
 */
import type { FormOp, Size3 } from "./formTypes";

type P = { x: number; y: number; z: number };
const poly = (points: P[], role: string): FormOp => ({ op: "poly", points, role });

const CRAFT = /popsicle|craft\s*sticks?|toothpicks?|skewers?|cardboard|chipboard|lego|\bstraws?\b|balsa|dowels?|pipe\s*cleaners?|paper|foam|clay|pencils?|chopsticks?/;
const MODEL = /\b(?:doll|dollhouse|barbie|miniature|mini|model|toy|tiny|figurine|ornament|scale|diorama|fairy|desk\s*top|tabletop)\b/;

export type PoleKind = "tepee" | "bean" | "obelisk" | "tripod" | "cone";

const POLE_NOUN =
  /\b(?:tee?\s*-?pees?|tipis?|wigwams?)\b|\bbean\s*poles?\b|\bpole\s*(?:towers?|tents?|frames?)\b|\b(?:cone|obelisk|pyramid|tower)\s+trellis(?:es)?\b|\btrellis\s+(?:cone|obelisk|tower)s?\b|\bgarden\s+obelisks?\b|\btomato\s+(?:cone|tower|cage)s?\b|\btripods?\b|\bcones?\b/;

/** Which pole frame the prompt names, or null. A bare "cone" is the nearest family: a ring of poles to a top tie. */
export function poleFrameKind(prompt: string): PoleKind | null {
  const lower = prompt.toLowerCase();
  if (!POLE_NOUN.test(lower)) return null;
  // Ice cream / pine / traffic cones and camera tripods are not pole frames.
  if (/ice\s*cream|pine\s*cone|traffic\s*cone|waffle\s*cone|snow\s*cone|camera\s*tripod|tripod\s*(?:mount|head)/.test(lower)) return null;
  if (/\btee?\s*-?pees?\b|\btipis?\b|\bwigwams?\b|\bpole\s*tents?\b/.test(lower)) return "tepee";
  if (/\bbean\s*poles?\b|\bpole\s*towers?\b|\btomato\s+(?:tower|cage)s?\b|\btower\s+trellis|\btrellis\s+tower/.test(lower)) return "bean";
  if (/obelisk|pyramid\s+trellis/.test(lower)) return "obelisk";
  if (/\btripods?\b/.test(lower)) return "tripod";
  return "cone";
}

const SPEC: Record<PoleKind, { poles: number; base: number; H: number; ties: number[]; name: string }> = {
  // Kids' teepee: about 5' across the floor, 6' to the tie.
  tepee: { poles: 5, base: 0.8, H: 72, ties: [], name: "Teepee" },
  // Bean pole tower: 7' poles in a 3' ring, string or slat ties a third and two thirds up.
  bean: { poles: 6, base: 0.45, H: 84, ties: [0.3, 0.6], name: "Bean pole tower" },
  obelisk: { poles: 4, base: 0.35, H: 72, ties: [0.25, 0.5, 0.75], name: "Garden obelisk" },
  tripod: { poles: 3, base: 0.6, H: 60, ties: [], name: "Tripod" },
  cone: { poles: 6, base: 0.45, H: 60, ties: [0.33, 0.66], name: "Pole cone" },
};

/** Full size unless craft stock or a model word is typed. */
export function wantsFullSizeFrame(prompt: string, materialOverride?: string): boolean {
  const lower = `${prompt} ${materialOverride ?? ""}`.toLowerCase();
  return !CRAFT.test(lower) && !MODEL.test(prompt.toLowerCase()) && !/^(?:popsicle|craft|dowel|straw|skewer|toothpick|cardboard)/.test(materialOverride ?? "");
}

function typedHeight(lower: string): number | null {
  const s = lower.replace(/\b[1-4]\s*[x×]\s*\d+(?:\.\d+)?\b/g, " ");
  const ft = s.match(/(\d+(?:\.\d+)?)\s*(?:'|ft\b|foot\b|feet\b)/);
  if (ft) return parseFloat(ft[1]) * 12;
  const inch = s.match(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b)/);
  return inch ? parseFloat(inch[1]) : null;
}

export function poleCount(prompt: string, kind: PoleKind): number {
  const m = prompt.toLowerCase().match(/(\d+)\s*(?:poles?|legs?|sticks?|stakes?|canes?)/);
  return Math.max(3, Math.min(16, m ? Number(m[1]) : SPEC[kind].poles));
}

export function poleFrameName(kind: PoleKind): string {
  return SPEC[kind].name;
}

/** Height from the typed size, else the family's full size, else bench size for a craft model. */
export function fitPoleFrame(s: Size3, prompt: string): Size3 {
  const kind = poleFrameKind(prompt) ?? "cone";
  const lower = prompt.toLowerCase();
  const H = typedHeight(lower) ?? (wantsFullSizeFrame(prompt) ? SPEC[kind].H : Math.min(s.height || 12, 12));
  const D = H * SPEC[kind].base;
  return { ...s, width: D, height: H, depth: D };
}

/** Poles from a ring on the ground to one top tie; garden towers add ties up the cone. */
export function poleFrameOps(prompt: string) {
  return (s: Size3): FormOp[] => {
    const kind = poleFrameKind(prompt) ?? "cone";
    const n = poleCount(prompt, kind);
    const H = s.height;
    const R = Math.min(s.width, s.depth) / 2;
    const top: P = { x: 0, y: H, z: 0 };
    const at = (i: number, f: number): P => {
      const a = (i / n) * Math.PI * 2 + (kind === "obelisk" ? Math.PI / 4 : 0);
      return { x: R * (1 - f) * Math.cos(a), y: H * f, z: R * (1 - f) * Math.sin(a) };
    };
    const ops: FormOp[] = [];
    for (let i = 0; i < n; i++) ops.push(poly([at(i, 0), top], "leg"));
    for (const f of SPEC[kind].ties) {
      for (let i = 0; i < n; i++) ops.push(poly([at(i, f), at((i + 1) % n, f)], "rail"));
    }
    return ops;
  };
}

// ── Trellis ───────────────────────────────────────────────────────────────────────────────────────
export function isTrellis(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /\btrellis(?:es)?\b/.test(lower) && !poleFrameKind(prompt) && !/\barch|arbou?r|pergola/.test(lower);
}

/** A garden trellis is 6' tall and 2' wide at full size; a typed height or width wins. */
export function fitTrellis(s: Size3, prompt: string): Size3 {
  const lower = prompt.toLowerCase();
  const full = wantsFullSizeFrame(prompt);
  const H = typedHeight(lower) ?? (full ? 72 : Math.min(s.height || 12, 12));
  const wide = lower.replace(/\b[1-4]\s*[x×]\s*\d+(?:\.\d+)?\b/g, " ").match(/(\d+(?:\.\d+)?)\s*(?:'|ft|foot|feet|"|in|inch(?:es)?)?\s*(?:wide|width)/);
  const W = wide ? parseFloat(wide[1]) * (/'|ft|foot|feet/.test(wide[0]) ? 12 : 1) : H / 3;
  return { ...s, width: W, height: H, depth: 0 };
}

/**
 * Two stiles full height and a grid of slats between them: verticals and horizontals about 6" apart at
 * full size (the same 1:12 grid on a model), horizontals on the front face of the verticals so they lap.
 */
export function trellisOps(s: Size3): FormOp[] {
  const H = s.height;
  const W = s.width;
  const pitch = Math.max(H / 12, Math.min(6, W / 3));
  const nx = Math.max(2, Math.round(W / pitch));
  const ny = Math.max(3, Math.round(H / pitch));
  const x0 = -W / 2;
  const ops: FormOp[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (W * i) / nx;
    ops.push({ op: "column", x, z: 0, y0: 0, y1: H, role: i === 0 || i === nx ? "leg" : "rail" });
  }
  // Horizontals start a pitch off the ground; the bottom one ties the stiles above the soil.
  for (let j = 1; j <= ny; j++) {
    const y = Math.min(H, (H * j) / ny);
    ops.push(poly([{ x: x0, y, z: 0 }, { x: x0 + W, y, z: 0 }], "brace"));
  }
  return ops;
}

/**
 * A-frame trestle (a sawhorse at model scale): a top beam on an A of two splayed legs at each end, one
 * brace across each A. The real-scale lumber sawhorse lives in outdoorFrames; this is the same frame in sticks.
 */
export function fitAFrame(s: Size3, prompt: string): Size3 {
  const L = Math.min(typedHeight(prompt.toLowerCase().replace(/(?:tall|high)\b.*$/, "")) ?? 9, 24);
  const H = L * 0.75;
  return { ...s, width: L, height: H, depth: H * 0.7 };
}
export function aFrameOps(s: Size3): FormOp[] {
  const { width: L, height: H, depth: spread } = s;
  const ops: FormOp[] = [poly([{ x: -L / 2, y: H, z: 0 }, { x: L / 2, y: H, z: 0 }], "rail")];
  for (const x of [-L / 2 + L * 0.12, L / 2 - L * 0.12]) {
    for (const z of [-spread / 2, spread / 2]) ops.push(poly([{ x, y: 0, z }, { x, y: H, z: 0 }], "leg"));
    ops.push(poly([{ x, y: H * 0.4, z: -spread * 0.3 }, { x, y: H * 0.4, z: spread * 0.3 }], "brace"));
  }
  return ops;
}
