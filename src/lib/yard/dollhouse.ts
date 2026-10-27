/**
 * Dollhouse: built the way wooden dollhouse kits are (Ana White, 1:12 farmhouse plans). Two side walls run in one
 * piece from the base to the eaves, the base floor and every upper floor sit between them, a room divider with a
 * doorway stands in each storey, the attic floor ties the wall tops, a gable-shaped back wall with windows squares
 * the house, and two roof panels meet at the ridge. The front stays open so every room can be played in.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import type { CatalogItem, Panel, YardProject } from "./types";
import type { TemplateBuild } from "./formTemplates";

/** The least floor-to-ceiling height a storey keeps (a 1:24 room); a room divider needs a room this wide each side. */
export const MIN_STOREY_IN = 3;
const MIN_ROOM_IN = 4;
const WORDS: Record<string, number> = { one: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4 };

/** The head noun is a dollhouse ("two story dollhouse", "doll house from plywood"), never a dollhouse bed. */
export function isDollhouse(prompt: string): boolean {
  const head = prompt.toLowerCase().split(/\s+(?:with|for|from|having|made|out\s+of|in)\s+/)[0].replace(/\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?\s*(?:wide|tall|high|deep|long)?|\b(?:x|by)\b/g, " ").trim();
  return /\bdoll\s*-?\s*houses?$/.test(head);
}

/** A typed storey count ("two story", "3-storey", "2 floors"), else null. */
export function typedStoreys(prompt: string): number | null {
  const m = prompt.toLowerCase().match(/\b(one|single|two|double|three|triple|four|[1-4])[\s-]*(?:stor(?:e?ys?|ies)|levels?|floors?)\b/);
  return m ? (WORDS[m[1]] ?? Number(m[1])) : null;
}

const r16 = (n: number) => Math.round(n * 16) / 16;
/** Plain boards snap to 1/8" in the solve, so every edge they meet is on that grid. */
const r8 = (n: number) => Math.round(n * 8) / 8;
const f = (n: number) => inchFrac(r16(n));

export function buildDollhouse(prompt: string, item: CatalogItem, typed: { width?: number; height?: number; depth?: number }): TemplateBuild {
  const T = item.dims.thickness ?? item.dims.height ?? 0.5;
  const W = typed.width ?? 24, D = typed.depth ?? 12, H = typed.height ?? 30;
  // The title keeps the typed spelling ("doll house" → "Doll house").
  const label = /\bdoll\s+house/i.test(prompt) ? "Doll house" : "Dollhouse";
  const base = { classId: "dollhouse" as const, subject: "dollhouse", label, kind: "house" as const, sized: true };
  const asked = typedStoreys(prompt);
  // Roof: 45° unless that would take over 2/5 of the height; 1" eave overhang along the slope, inside the typed width.
  const fit = (w: number, h: number) => {
    const p = Math.atan(Math.min(1, (0.4 * h) / (w / 2)));
    const exX = r8(Math.cos(p)), exY = exX * Math.tan(p), Wb = w - 2 * exX, rise = (Wb / 2) * Math.tan(p), lift = T / Math.cos(p);
    const He = Math.floor((h - rise - lift) * 8) / 8;
    return { p, exX, exY, Wb, rise, lift, He, clear: (s: number) => (He - (s + 1) * T) / s };
  };
  const g = fit(W, H);
  const minH = (s: number) => { let h = Math.ceil(H * 8) / 8; while (h < 96 && fit(W, h).clear(s) < MIN_STOREY_IN - 1e-9) h += 1 / 8; return h; };
  const no = (why: string): TemplateBuild => ({ ...base, panels: [], params: {}, notes: [], refused: why });
  if (W > 96 || H > 96 || D > 48) return no(`A dollhouse needs every wall to fit a 4×8 sheet: at most 96" wide, 96" tall and 48" deep. Nothing is built at ${f(W)}" × ${f(D)}" × ${f(H)}".`);
  if (g.Wb - 2 * T < MIN_STOREY_IN || D - T < MIN_STOREY_IN) {
    const ax = g.Wb - 2 * T < MIN_STOREY_IN ? `${f(MIN_STOREY_IN + 2 * T + 2 * g.exX)}" wide` : `${f(MIN_STOREY_IN + T)}" deep`;
    return no(`A dollhouse needs at least ${ax} for a ${f(MIN_STOREY_IN)}" room inside its ${f(T)}" walls. Nothing is built at ${f(W)}" × ${f(D)}".`);
  }
  let S = asked ?? 2;
  const notes: string[] = [];
  if (g.clear(S) < MIN_STOREY_IN) {
    if (asked || g.clear(1) < MIN_STOREY_IN) return no(`A ${S === 1 ? "one" : S}-storey dollhouse needs at least ${f(minH(S))}" tall for ${f(MIN_STOREY_IN)}" rooms under its roof. Nothing is built at ${f(H)}".`);
    notes.push(`At ${f(H)}" tall the house has room for one storey; type ${f(minH(2))}" tall for two.`);
    S = 1;
  }
  const { p, exX, exY, Wb, rise, lift, He } = g;
  const c = g.clear(S), X0 = exX, Hr = He + rise, half = Wb / 2, deg = Math.round((p * 180) / Math.PI);
  const rooms = (Wb - 3 * T) / 2 >= MIN_ROOM_IN ? 2 : 1;
  const panels: Panel[] = [];
  const mk = (type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, extra: Partial<Panel> = {}): Panel =>
    ({ id: createId("dh"), type, name, position: { x: r16(x), y: r16(y), z: r16(z) }, size: { width: r16(w), height: r16(h), depth: r16(d) }, materialId: item.id, ...extra });
  // Floor levels: the base at the bottom, S - 1 upper floors, the attic floor flush with the wall tops.
  const bottoms = [0, ...Array.from({ length: S - 1 }, (_, k) => r8(T + (k + 1) * c + k * T)), He - T];
  panels.push(mk("upright", "Side wall", X0, 0, T, T, He, D - T), mk("upright", "Side wall", X0 + Wb - T, 0, T, T, He, D - T));
  panels.push(mk("bottom", "Base floor", X0 + T, 0, T, Wb - 2 * T, T, D - T));
  for (let k = 1; k < S; k++) panels.push(mk("bottom", "Upper floor", X0 + T, bottoms[k], T, Wb - 2 * T, T, D - T));
  panels.push(mk("bottom", "Attic floor", X0 + T, bottoms[S], T, Wb - 2 * T, T, D - T));
  // Room dividers: one per storey, a doorway notched up from the bottom edge, centred along the depth.
  const dw = r16(Math.min(3, (D - T) * 0.4));
  let doors = 0;
  if (rooms === 2) for (let k = 0; k < S; k++) {
    const y0 = bottoms[k] + T, h = r16(bottoms[k + 1] - y0), dh = r16(Math.min(h * 0.75, h - 1)), z0 = r16((D - T - dw) / 2);
    const door = dw >= 1.5 && dh >= 2;
    doors += door ? 1 : 0;
    const pts: [number, number][] = door ? [[0, 0], [z0, 0], [z0, dh], [z0 + dw, dh], [z0 + dw, 0], [r16(D - T), 0], [r16(D - T), h], [0, h]] : [[0, 0], [r16(D - T), 0], [r16(D - T), h], [0, h]];
    panels.push(mk("divider", "Room divider", X0 + half - T / 2, y0, T, T, h, D - T, { polygon: { plane: "zy", pts }, ...(door ? { cutNote: `Jigsaw a ${f(dw)}" wide × ${f(dh)}" tall doorway up from the bottom edge, centred along its depth.` } : {}) }));
  }
  // Back wall: the gable end. A window centred in each room of each storey, a round window in the attic gable.
  const cut: NonNullable<Panel["cutouts"]> = [];
  const ww = r16(Math.min(3, ((rooms === 2 ? Wb - 3 * T : Wb - 2 * T) / rooms) * 0.35)), wh = r16(Math.min(4.5, c * 0.5));
  if (ww >= 1.5 && wh >= 1.5) for (let k = 0; k < S; k++) for (let j = 0; j < rooms; j++) {
    const cx = rooms === 2 ? (j ? (half + T / 2 + Wb - T) / 2 : (T + half - T / 2) / 2) : half;
    cut.push({ id: `dh-win-${k}-${j}`, x: r16(cx - ww / 2), y: r16(bottoms[k] + T + c * 0.3), width: ww, height: wh, label: "Window" });
  }
  const ar = r16(Math.min(1.5, rise * 0.2));
  const attic = ar >= 0.5 ? [{ x: r16(half), y: r16(He + rise * 0.4), r: ar }] : [];
  const gable: [number, number][] = [[0, 0], [r16(Wb), 0], [r16(Wb), r16(He)], [r16(half), r16(Hr)], [0, r16(He)]];
  const holes = `${cut.length ? ` Cut the ${cut.length} windows ${f(ww)}" × ${f(wh)}" (drill a 3/8" hole inside each corner and jigsaw between).` : ""}${attic.length ? ` Drill the ${f(2 * ar)}" round attic window centred ${f(attic[0].y)}" up.` : ""}`;
  panels.push(mk("back", "Back wall", X0, 0, 0, Wb, Hr, T, { polygon: { plane: "xy", pts: gable, holes: attic }, ...(cut.length ? { cutouts: cut } : {}), cutNote: `Gable end: ${f(Wb)}" wide, ${f(He)}" to the eaves, ${deg}° to a peak at ${f(Hr)}".${holes}` }));
  // Roof: two panels on the gable slopes, meeting over the peak, the eave 1" past each side wall; the ridge is at H.
  const slope = Math.hypot(half, rise) + Math.hypot(exX, exY);
  for (const side of [-1, 1] as const) {
    const eave = X0 + half + side * (half + exX);
    const abs: [number, number][] = [[eave, He - exY], [X0 + half, Hr], [X0 + half, Hr + lift], [eave, He - exY + lift]];
    const x = Math.min(eave, X0 + half), y = r16(He - exY);
    panels.push(mk("top", "Roof panel", x, y, 0, Math.abs(X0 + half - eave), H - y, D, {
      polygon: { plane: "xy", pts: abs.map(([a, b]) => [r16(a - x), Math.min(r16(b - y), r16(H - y))] as [number, number]) },
      blank: { lengthIn: r16(D), widthIn: r16(slope), thicknessIn: T },
      cutNote: `Roof panel ${f(slope)}" down the slope × ${f(D)}" long; bevel the ridge and eave edges ${deg}° so they stand plumb.`,
    }));
  }
  const rm = rooms === 2 ? " of two rooms each" : "";
  notes.unshift(
    `${label} in ${item.name}: ${S === 1 ? "one storey" : `${S} storeys`}${rm} and an attic under a ${deg}° gable roof, open at the front so every room can be played in.`,
    `Each storey is ${f(c)}" floor to ceiling${doors ? `; the room divider in each storey has a ${f(dw)}" wide doorway` : ""}. The side walls run in one piece from the base to the eaves, and the gable-shaped back wall${cut.length ? ` with ${cut.length} windows` : ""} squares the house.`,
  );
  return { ...base, panels, notes, params: { storeys: S, rooms, doors, windows: cut.length, width: W, depth: D, height: H, eave: He, ridge: Hr, pitchDeg: deg, clear: c, thickness: T } };
}

/** Read a built dollhouse back: every part there, the front open, a pitched roof, a floor per storey, a doorway per divider. */
export function dollhouseIssues(project: YardProject): { code: string; detail: string }[] {
  const P = project.shape?.params ?? {}, S = Number(P.storeys ?? 0), ps = project.panels, out: { code: string; detail: string }[] = [];
  const n = (name: string) => ps.filter((q) => q.name === name).length;
  const need: [string, number][] = [["Base floor", 1], ["Side wall", 2], ["Back wall", 1], ["Attic floor", 1], ["Roof panel", 2], ["Upper floor", S - 1], ["Room divider", P.rooms === 2 ? S : 0]];
  for (const [name, k] of need) if (n(name) !== k) out.push({ code: "missing-part", detail: `${name}: ${n(name)} of ${k}` });
  const { width: W, depth: D } = project.overall;
  for (const q of ps) if (q.size.depth <= 1 && q.position.z > D / 2 && q.size.width > W / 2 && q.size.height > 2 && !/roof/i.test(q.name)) out.push({ code: "front", detail: `${q.name} closes the front` });
  const back = ps.find((q) => q.name === "Back wall");
  const peak = back?.polygon ? Math.max(...back.polygon.pts.map((q) => q[1])) : 0;
  const eave = Number(P.eave ?? 0);
  if (!(peak > eave + 1)) out.push({ code: "roof", detail: "back wall is not a gable" });
  for (const r of ps.filter((q) => q.name === "Roof panel")) if (!r.polygon || r.position.y + r.size.height < peak - 1e-6) out.push({ code: "roof", detail: "roof panel below the ridge" });
  for (const q of ps.filter((x) => x.name === "Room divider")) if ((q.polygon?.pts.filter((pt) => pt[1] === 0).length ?? 0) < 4 && Number(P.doors ?? 0) > 0) out.push({ code: "doorway", detail: "a room divider has no doorway" });
  const floors = ps.filter((q) => /floor$/i.test(q.name)).map((q) => q.position.y).sort((a, b) => a - b);
  for (let k = 1; k < floors.length; k++) if (floors[k] - floors[k - 1] - Number(P.thickness ?? 0) < MIN_STOREY_IN - 1e-6) out.push({ code: "storey", detail: `storey ${k} under ${MIN_STOREY_IN}"` });
  return out;
}

/** Real build order: walls on the base, then storey by storey, the back squares it, the roof last. */
export const DOLLHOUSE_STEPS = [
  { match: /^(Side wall|Base floor)$/, title: "Glue and screw the side walls to the base floor", why: "The base floor sits between the side walls, flush at the bottom and the front. Predrill so the plywood edges stay whole." },
  { match: /^(Room divider|Upper floor|Attic floor)$/, title: "Build up the storeys: a room divider, then the floor above it", why: "Stand each storey's divider at the middle of the floor below, doorway at the bottom, then lay the next floor on it and screw through the side walls into its ends. The attic floor finishes flush with the tops of the side walls." },
  { match: /^Back wall$/, title: "Glue and screw the back wall over the back edges", why: "The gable-shaped back covers the back edges of the side walls and every floor and squares the house; the front stays open for play." },
  { match: /^Roof panel$/, title: "Fit the two roof panels on the gable slopes", why: "They meet at the ridge over the back wall's peak and overhang each side wall at the eaves. Glue and screw them into the back wall and the side-wall tops." },
];
