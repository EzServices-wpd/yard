/**
 * Dollhouse: built the way wooden dollhouse kits are (Ana White, 1:12 farmhouse plans). Two side walls run in one
 * piece from the base to the eaves, the base floor and every upper floor sit between them, a room divider with a
 * doorway stands in each storey, the attic floor ties the wall tops, a gable-shaped back wall with windows squares
 * the house, and two roof panels meet at the ridge. The front stays open so every room can be played in.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { typedMeasures } from "./measureText";
import type { CatalogItem, Panel, YardProject } from "./types";
import type { TemplateBuild } from "./formTemplates";

/** The least floor-to-ceiling height a storey keeps (a 1:24 room); a room divider needs a room this wide each side. */
export const MIN_STOREY_IN = 3;
const MIN_ROOM_IN = 4;
const WORDS: Record<string, number> = { one: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUM = "(one|single|two|double|three|triple|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)";

/** The head noun is a dollhouse ("two story dollhouse", "dollhouse 2 floors", "dollhouse kit 1:12 scale"), never a dollhouse bed. */
export function isDollhouse(prompt: string): boolean {
  const head = prompt.toLowerCase().split(/\s+(?:with|for|from|having|made|out\s+of|in)\s+/)[0]
    .replace(new RegExp(`\\b${NUM}[\\s-]*(?:stor(?:e?ys?|ies)|levels?|floors?|rooms?)\\b|\\b(?:1\\s*[:/]\\s*\\d+\\s+)?scale\\b|\\bkits?\\b|\\b(?:plywood|ply|mdf|hardboard|osb)\\b`, "g"), " ")
    .replace(/[\d./]+\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?\s*(?:[x×]|by|wide|tall|high|deep|long)?/g, " ").replace(/\s+/g, " ").trim();
  return /\bdoll\s*-?\s*houses?$|\bbarbie\s+dream\s*-?\s*houses?$/.test(head);
}

/** Stock the dollhouse route leaves to its own builds (row 583: everything else builds the house in plywood). */
const CRAFT = /popsicle|craft\s*sticks?|\bsticks?\b|cardboard|card\s*board|foam|balsa|lumber|\b2\s*x\s*\d|pvc|lego|paper|straws?|toothpicks?|dowels?|skewers?/;
/** The plywood dollhouse: built for indoors, so outdoor words never switch on the exterior package (row 580). */
export const plyDollhouse = (prompt: string) => isDollhouse(prompt) && !CRAFT.test(prompt.toLowerCase());
/** Features often typed on a dollhouse that this one doesn't build; each is named in a note (row 581). */
const EXTRAS = /\b(?:(an?|the)\s+)?(stairs|staircases?|stairways?|chimneys?|garages?|porch(?:es)?|balcon(?:y|ies)|elevators?|furniture|shutters|shingles|wallpaper|lights|lighting|fireplaces?|pools?|flat\s+roofs?|fences?|(?<!back\s)yards?)\b/g;
const MASS = /^(?:furniture|wallpaper|lighting|shingles|shutters|lights|stairs)$/;
const SHEETLESS = /\b(mdf|hardboard|particle\s*board|osb|melamine)\b/;
const OUTDOOR = /\b(?:outdoors?|outside|garden|patio|backyard|back\s*yard|exterior)\b/;
/** Fashion dolls (11 1/2", 1:6) need 12"+ storeys: the house is sized for them unless a size is typed. */
const FASHION = /\bbarbies?\b|\bfashion\s+dolls?\b|\b1\s*[:/]\s*6\b/;

/** A typed storey count ("two story", "3-storey", "2 floors"), else null. */
export function typedStoreys(prompt: string): number | null {
  // Any typed count is read (never only 1-4): a count the house can't hold is refused, not shrunk.
  const m = prompt.toLowerCase().match(new RegExp(`\\b${NUM}[\\s-]*(?:stor(?:e?ys?|ies)|levels?|floors?)\\b`));
  return m ? (WORDS[m[1]] ?? Number(m[1])) : null;
}

/** A typed room count ("with 6 rooms", "three-room"), else null. */
export function typedRooms(prompt: string): number | null {
  const m = prompt.toLowerCase().match(new RegExp(`\\b${NUM}[\\s-]*rooms?\\b`));
  return m ? (WORDS[m[1]] ?? Number(m[1])) : null;
}

/**
 * A typed plywood thickness: a fraction, decimal or mixed number ("3/4", ".5", "1 1/2", I35), or a whole 1" or 2" with its
 * unit. A larger whole inch count ("21 inch plywood", "36\" plywood dollhouse") is the house's size, never a thickness:
 * plywood isn't sold over 1 1/8", and every other Yard build reads a bare length as a size.
 */
export const PLY_THICKNESS = /(?<![\d./])(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d*\.\d+|[12](?=\s*(?:"|-?\s*in(?:ch(?:es)?)?\b)))\s*(?:"|-?\s*in(?:ch(?:es)?)?)?\s*(?:thick\s+)?(?:plywood|ply)\b/;
const UNIT_LEN = /\d\s*(?:"|''|'|-?\s*(?:in\b|inch|ft\b|feet|foot))/;

/**
 * Only the axes the prompt types (axis words or a W x D x H string); the rest take the dollhouse's own defaults. A bare
 * length with no axis word ("36 inch dollhouse", "4 ft dollhouse") is the height, as the shared size reader takes it;
 * a plywood thickness and a doll's own size ("for 18 inch dolls") size nothing.
 */
export function dollhouseTyped(prompt: string): { width?: number; height?: number; depth?: number } {
  const m = typedMeasures(prompt);
  const s = prompt.toLowerCase().replace(/[″”]/g, '"').replace(new RegExp(PLY_THICKNESS.source, "g"), " ")
    .replace(/\d+(?:\.\d+)?\s*-?\s*(?:"|in(?:ch(?:es)?)?\b\.?)\s*(?:[a-z]+\s+){0,2}?(?:dolls?|barbies?|figures?|figurines?)\b/g, " ");
  // A mixed number is one length ("30 1/2 inch", "1 1/2 ft"), as the thickness reader takes it (I35).
  const b = m.height ?? m.tuple ? null : s.match(/(?<![\d./x×:-])(\d+\s+\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*-?\s*(ft\b\.?|feet\b|foot\b|'|"|in\b\.?|inch(?:es)?\b)(?!\s*-?\s*(?:wide|width|deep|depth|tall|high|height|long|length|thick|x|×|by)\b)/);
  const len = (t: string) => t.replace(/\s*\/\s*/g, "/").trim().split(/\s+/).reduce((a, w) => a + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
  const bare = b ? len(b[1]) * (/^(?:f|')/.test(b[2]) ? 12 : 1) : undefined;
  return { width: m.width ?? m.tuple?.[0], depth: m.depth ?? m.tuple?.[1], height: m.height ?? m.tuple?.[2] ?? bare };
}

const r16 = (n: number) => Math.round(n * 16) / 16;
/** Plain boards snap to 1/8" in the solve, so every edge they meet is on that grid. */
const r8 = (n: number) => Math.round(n * 8) / 8;
const f = (n: number) => inchFrac(r16(n));

export function buildDollhouse(prompt: string, item: CatalogItem, typed: { width?: number; height?: number; depth?: number }): TemplateBuild {
  const T = item.dims.thickness ?? item.dims.height ?? 0.5;
  const lower = prompt.toLowerCase(), doll = FASHION.test(lower);
  const W = typed.width ?? (doll ? 36 : 24), D = typed.depth ?? (doll ? 14 : 12), H = typed.height ?? (doll ? 48 : 30);
  // The title keeps the typed spelling ("doll house" → "Doll house").
  // The title keeps the typed head noun ("Doll house", "Dreamhouse", "Dream house").
  const head = prompt.toLowerCase().match(/\b(doll\s+house|dream\s*-?\s*house)s?\b/)?.[1].replace(/\s+/g, " ");
  const label = head ? head[0].toUpperCase() + head.slice(1) : "Dollhouse";
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
  // The least height for s storeys, or null when even a 96" house can't hold them.
  const minH = (s: number): number | null => { let h = Math.ceil(H * 8) / 8; while (h <= 96 && fit(W, h).clear(s) < MIN_STOREY_IN - 1e-9) h += 1 / 8; return h <= 96 ? h : null; };
  const maxS = (h: number) => { let s = 0; while (fit(W, h).clear(s + 1) >= MIN_STOREY_IN - 1e-9) s++; return s; };
  const no = (why: string): TemplateBuild => ({ ...base, panels: [], params: {}, notes: [], refused: why });
  if (W > 96 || H > 96 || D > 48) return no(`A dollhouse needs every wall to fit a 4×8 sheet: at most 96" wide, 96" tall and 48" deep. Nothing is built at ${f(W)}" × ${f(D)}" × ${f(H)}".`);
  if (g.Wb - 2 * T < MIN_STOREY_IN || D - T < MIN_STOREY_IN) {
    const ax = g.Wb - 2 * T < MIN_STOREY_IN ? `${f(MIN_STOREY_IN + 2 * T + 2 * g.exX)}" wide` : `${f(MIN_STOREY_IN + T)}" deep`;
    return no(`A dollhouse needs at least ${ax} for a ${f(MIN_STOREY_IN)}" room inside its ${f(T)}" walls. Nothing is built at ${f(W)}" × ${f(D)}".`);
  }
  if (asked !== null && asked < 1) return no(`A dollhouse has at least one storey, ${f(minH(1) ?? H)}" tall at ${f(W)}" wide. Nothing is built at ${asked} storeys.`);
  let S = asked ?? 2;
  const notes: string[] = [];
  if (g.clear(S) < MIN_STOREY_IN) {
    const need = minH(S);
    if (asked && need === null) return no(`A ${S}-storey dollhouse doesn't fit: at ${f(W)}" wide, at most ${maxS(96)} storeys fit under the roof of a 96" tall house (${maxS(H)} at ${f(H)}"). Nothing is built at ${S} storeys.`);
    if (asked || g.clear(1) < MIN_STOREY_IN) return no(`A ${S === 1 ? "one" : S}-storey dollhouse needs at least ${f(need ?? minH(1) ?? 96)}" tall for ${f(MIN_STOREY_IN)}" rooms under its roof. Nothing is built at ${f(H)}".`);
    notes.push(`At ${f(H)}" tall the house has room for one storey; type ${f(minH(2) ?? 96)}" tall for two.`);
    S = 1;
  }
  // Rooms: a typed count is spread over the storeys (extra rooms low); untyped, two per storey where they fit.
  const n = typedRooms(prompt);
  const roomW = (r: number, wb: number) => (wb - 2 * T - (r - 1) * T) / r;
  if (n !== null && n < 1) return no(`A dollhouse has at least one room, ${f(W)}" wide. Nothing is built at ${n} rooms.`);
  if (n !== null && n < S) {
    if (asked) return no(`A ${S}-storey dollhouse has a room on every storey. Nothing is built with ${n} room${n === 1 ? "" : "s"}: type ${n} or fewer storeys, or ${S} rooms or more.`);
    notes.push(`${n} room${n === 1 ? "" : "s"} typed, so the house is ${n === 1 ? "one storey" : `${n} storeys`} (one room each).`);
    S = n;
  }
  const per = n === null ? Array.from({ length: S }, () => (roomW(2, g.Wb) >= MIN_ROOM_IN ? 2 : 1)) : Array.from({ length: S }, (_, k) => Math.floor(n / S) + (k < n % S ? 1 : 0));
  const most = Math.max(...per);
  if (roomW(most, g.Wb) < MIN_ROOM_IN - 1e-9) {
    let w = Math.ceil(W * 8) / 8; while (w <= 96 && roomW(most, fit(w, H).Wb) < MIN_ROOM_IN - 1e-9) w += 1 / 8;
    return no(w <= 96 ? `${most} rooms side by side need at least ${f(w)}" wide for ${f(MIN_ROOM_IN)}" rooms. Nothing is built at ${f(W)}" with ${n} rooms.` : `${n} rooms don't fit in ${S} storeys of a dollhouse at most 96" wide. Nothing is built.`);
  }
  const { p, exX, exY, Wb, rise, lift, He } = g;
  const c = g.clear(S), X0 = exX, Hr = He + rise, half = Wb / 2, deg = Math.round((p * 180) / Math.PI);
  const rooms = most;
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
  let dividers = 0;
  for (let k = 0; k < S; k++) for (let j = 1; j < per[k]; j++) {
    const y0 = bottoms[k] + T, h = r16(bottoms[k + 1] - y0), dh = r16(Math.min(h * 0.75, h - 1)), z0 = r16((D - T - dw) / 2);
    const door = dw >= 1.5 && dh >= 2;
    doors += door ? 1 : 0;
    dividers++;
    const pts: [number, number][] = door ? [[0, 0], [z0, 0], [z0, dh], [z0 + dw, dh], [z0 + dw, 0], [r16(D - T), 0], [r16(D - T), h], [0, h]] : [[0, 0], [r16(D - T), 0], [r16(D - T), h], [0, h]];
    panels.push(mk("divider", "Room divider", X0 + T + j * roomW(per[k], Wb) + (j - 1) * T, y0, T, T, h, D - T, { polygon: { plane: "zy", pts }, ...(door ? { cutNote: `Jigsaw a ${f(dw)}" wide × ${f(dh)}" tall doorway up from the bottom edge, centred along its depth.` } : {}) }));
  }
  // Back wall: the gable end. A window centred in each room of each storey, a round window in the attic gable.
  const cut: NonNullable<Panel["cutouts"]> = [];
  const ww = r16(Math.min(3, roomW(rooms, Wb) * 0.35)), wh = r16(Math.min(4.5, c * 0.5));
  if (ww >= 1.5 && wh >= 1.5) for (let k = 0; k < S; k++) for (let j = 0; j < per[k]; j++) {
    const rw = roomW(per[k], Wb), cx = T + (j + 0.5) * rw + j * T;
    cut.push({ id: `dh-win-${k}-${j}`, x: r16(cx - ww / 2), y: r16(bottoms[k] + T + c * 0.3), width: ww, height: wh, label: "Window" });
  }
  const ar = r16(Math.min(1.5, rise * 0.2));
  const attic = ar >= 0.5 ? [{ x: r16(half), y: r16(He + rise * 0.4), r: ar }] : [];
  const gable: [number, number][] = [[0, 0], [r16(Wb), 0], [r16(Wb), r16(He)], [r16(half), r16(Hr)], [0, r16(He)]];
  const holes = `${cut.length ? ` Cut the ${cut.length} window${cut.length === 1 ? "" : "s"} ${f(ww)}" × ${f(wh)}" (drill a 3/8" hole inside each corner and jigsaw between).` : ""}${attic.length ? ` Drill the ${f(2 * ar)}" round attic window centred ${f(attic[0].y)}" up.` : ""}`;
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
  const same = per.every((r) => r === per[0]);
  const rm = same ? (per[0] === 1 ? "" : ` of ${per[0] === 2 ? "two" : per[0]} rooms each`) : ` with ${per.reduce((a, b) => a + b, 0)} rooms (${per.join(", ")} from the bottom up)`;
  notes.unshift(
    `${label} in ${item.name}: ${S === 1 ? "one storey" : `${S} storeys`}${rm} and an attic under a ${deg}° gable roof, open at the front so every room can be played in.`,
    `Each storey is ${f(c)}" floor to ceiling${doors ? (dividers === S ? `; the room divider in each storey has a ${f(dw)}" wide doorway` : `; every room divider has a ${f(dw)}" wide doorway`) : ""}. The side walls run in one piece from the base to the eaves, and the gable-shaped back wall${cut.length ? ` with ${cut.length} window${cut.length === 1 ? "" : "s"}` : ""} squares the house.`,
  );
  const lab = label.toLowerCase(), said = new Set<string>();
  // A fashion doll stands 11 1/2": a typed height whose storeys are lower says so and names the height that fits one.
  if (doll && c >= 12 - 1e-9) notes.push(`Sized for 11 1/2" fashion dolls like Barbie (1:6 scale): each storey is ${f(c)}" floor to ceiling.`);
  else if (doll) { let h = Math.ceil(H * 8) / 8; while (h <= 96 && fit(W, h).clear(S) < 12 - 1e-9) h += 1 / 8; notes.push(`Each storey is ${f(c)}" floor to ceiling, short of the 12" an 11 1/2" fashion doll like Barbie needs${h <= 96 ? `; type ${f(h)}" tall for ${S === 1 ? "one storey" : `${S} storeys`} she stands up in` : ""}.`); }
  const sheet = lower.match(SHEETLESS)?.[1];
  if (sheet) notes.push(`${/^(?:mdf|osb)$/.test(sheet) ? sheet.toUpperCase() : sheet[0].toUpperCase() + sheet.slice(1)} isn't on the stock list, so this ${lab} is cut from ${item.name}, the sheet dollhouse kits use.`);
  // The note names the place typed ("for the back yard"), so every word of the ask is answered.
  const place = lower.match(OUTDOOR)?.[0].replace(/\s+/g, " ");
  if (place) notes.push(`You asked for ${/^(?:outdoors?|outside|exterior)$/.test(place) ? `an outdoor ${lab}` : `a ${lab} for the ${place}`}; this one is built for indoors, in interior plywood with an open front, so keep it under cover.`);
  for (const [, a, w] of lower.matchAll(EXTRAS)) if (!said.has(w) && said.add(w)) {
    const many = MASS.test(w) || /s$/.test(w);
    if (/^flat/.test(w)) { notes.push(`You asked for a flat roof; this ${lab} has a ${deg}° gable roof instead.`); continue; }
    notes.push(`You asked for ${a ? `${a} ` : many ? "" : /^[aeiou]/.test(w) ? "an " : "a "}${w}; this ${lab} is built without ${many ? (/s$/.test(w) ? "them" : "it") : "one"} for now.`);
  }
  // A typed length the header can't place on an axis ("36 inch", "1/2 inch plywood") leaves the untyped axes to these notes.
  if (UNIT_LEN.test(lower)) for (const [a, v, w, n] of [["width", W, "wide", "width"], ["depth", D, "deep", "depth"], ["height", H, "tall", "height"]] as const)
    if (typed[a] === undefined) notes.push(`Assumed ${f(v)}" ${w} (${lab} default) — type a ${n} to lock it.`);
  return { ...base, panels, notes, params: { storeys: S, rooms, dividers, doors, windows: cut.length, width: W, depth: D, height: H, eave: He, ridge: Hr, pitchDeg: deg, clear: c, thickness: T } };
}

/** Read a built dollhouse back: every part there, the front open, a pitched roof, a floor per storey, a doorway per divider. */
export function dollhouseIssues(project: YardProject): { code: string; detail: string }[] {
  const P = project.shape?.params ?? {}, S = Number(P.storeys ?? 0), ps = project.panels, out: { code: string; detail: string }[] = [];
  const n = (name: string) => ps.filter((q) => q.name === name).length;
  const need: [string, number][] = [["Base floor", 1], ["Side wall", 2], ["Back wall", 1], ["Attic floor", 1], ["Roof panel", 2], ["Upper floor", S - 1], ["Room divider", Number(P.dividers ?? (P.rooms === 2 ? S : 0))]];
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
  { match: /^Roof panel$/, title: "Fit the two roof panels on the gable slopes", why: "They meet at the ridge over the back wall's peak, rest on the outer edge of each side-wall top and overhang it at the eaves. Glue and screw each panel into the back wall's sloped edge, and glue it along the side-wall tops." },
];
