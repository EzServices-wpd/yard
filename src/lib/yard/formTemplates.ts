/**
 * Object form templates — the non-animal classes of the shape-template registry.
 *
 * Each class owns named parts and parametric proportions, and materializes per stock:
 *   • thin craft stock (popsicle / jumbo / mini sticks, skewers, straws): whole sticks laid
 *     flat against the face they belong to (slatted walls, slatted roof decks, lapped frames),
 *   • sheet / board / lumber: real cut panels (gable ends, drilled holes, rabbeted frames).
 * The model is deterministic. Steps, cut list, Buy and PDF read the materialized parts.
 */
import { createId } from "@/lib/utils";
import { toPrimitive, isWholeStock } from "./geometry";
import type { CatalogItem, Panel, Vec3, YardProject } from "./types";

export type TemplateClassId = "small-house" | "flat-frame" | "launcher" | "humanoid" | "platform-tower";
export type TemplatePartName =
  | "wall"
  | "floor"
  | "roof"
  | "rafter"
  | "perch"
  | "batten"
  | "stile"
  | "backer"
  | "stand"
  | "base"
  | "upright"
  | "axle"
  | "arm"
  | "cup"
  | "torso"
  | "hip"
  | "shoulder"
  | "hand"
  | "foot";

export type TSeg = { a: Vec3; b: Vec3; role: string; face?: Vec3 };

export type TemplateBuild = {
  classId: TemplateClassId;
  subject: string;
  label: string;
  kind: YardProject["kind"];
  segs?: TSeg[];
  panels?: Panel[];
  /** Named measurements the guard reads back (hole diameter, opening size…). */
  params: Record<string, number>;
  notes: string[];
};

export type TemplateStep = { role: string; title: string; why: string; /** Count noun for the step title ("12 wall slats"). */ word?: string; /** Replaces the stock join text (a pivot is not glued). */ hold?: string };

const PIVOT_HOLD = "No glue at this joint: pierce both overlapping ends with an awl (or a 3/32\" bit), push a paper fastener through from the front and spread its prongs behind. Snug, so the limb holds a pose.";

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export type StockKind = "thin" | "panel" | "other";
export function templateStock(item: CatalogItem): StockKind {
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") return "panel";
  if (item.formFactor === "board" || item.category === "lumber") return "panel";
  if (item.formFactor === "pipe") return "other";
  const prim = toPrimitive(item);
  if (Math.max(prim.width, prim.height) < 1.2) return "thin";
  return "other";
}

/** Parse a typed length like 1.5, 1-1/4, 1 1/4, 3/4 (inches). */
export function parseInches(s: string): number | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)?(?:[\s-]+)?(?:(\d+)\/(\d+))?$/);
  if (!m) return null;
  const whole = m[1] ? parseFloat(m[1]) : 0;
  const frac = m[2] && m[3] ? parseInt(m[2]) / parseInt(m[3]) : 0;
  const v = whole + frac;
  return v > 0 ? v : null;
}

const NUM = String.raw`(\d+(?:\.\d+)?(?:[\s-]+\d+\/\d+)?|\d+\/\d+)`;

/** Typed overall size in inches: "12 inches long", "18 in tall", "5 feet tall", "2-foot", "30\" long". */
export function typedSizeIn(prompt: string): { length?: number; height?: number } {
  const l = prompt.toLowerCase();
  const unit = String.raw`(?:\s*-?\s*)(inches|inch|in\b|"|''|feet|foot|ft\b|')`;
  const toIn = (n: string, u: string) => parseFloat(n) * (/^(?:feet|foot|ft|')$/.test(u.trim()) ? 12 : 1);
  const out: { length?: number; height?: number } = {};
  for (const m of l.matchAll(new RegExp(String.raw`(\d+(?:\.\d+)?)` + unit + String.raw`\s*(long|tall|high|length|height|in length|in height)?`, "g"))) {
    const v = toIn(m[1], m[2]);
    if (!(v > 1 && v < 400)) continue;
    // Skip stock names (2x4, 1/4" plywood, 12" skewers) and hole/photo sizes.
    const before = l.slice(Math.max(0, (m.index ?? 0) - 2), m.index);
    const after = l.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14);
    if (/[x×\/]\s*$/.test(before) || /^\s*(?:x|×|plywood|ply|skewer|dowel|stick|board|hole|diameter|dia|photo|picture|print|opening|entrance)/.test(after)) continue;
    const ax = m[3];
    if (ax && /tall|high|height/.test(ax)) out.height ??= v;
    else if (ax) out.length ??= v;
    else if (out.length == null && out.height == null) out.length = v;
  }
  return out;
}

// ============================================================== small house (birdhouse)

export function isSmallHouse(prompt: string): boolean {
  const l = prompt.toLowerCase();
  return /\bbird\s*-?\s*house\b|\bbirdhouse\b|\bnest(?:ing)?\s*box\b|\bwren\s*house\b|\bbluebird\s*(?:house|box)\b|\bmartin\s*house\b/.test(l) && !/feeder\b/.test(l);
}

export function smallHouseHoleIn(prompt: string): number | null {
  const l = prompt.toLowerCase().replace(/[″”]/g, '"');
  const re = new RegExp(`${NUM}\\s*(?:"|in(?:ch(?:es)?)?\\.?)?\\s*(?:-\\s*)?(?:diameter\\s+|dia\\.?\\s+|wide\\s+|round\\s+)?(?:entry|entrance|door|access)?\\s*hole`);
  const m = l.match(re) ?? l.match(new RegExp(`hole\\s*(?:of|at|is|:)?\\s*${NUM}\\s*(?:"|in)`));
  if (!m) return null;
  const v = parseInches(m[1]);
  return v && v >= 0.5 && v <= 4 ? v : null;
}

export function wantsPerch(prompt: string): boolean {
  const l = prompt.toLowerCase();
  return /\bperch\b/.test(l) && !/\b(?:no|without(?:\s+a)?)\s+perch\b/.test(l);
}

function smallHouseThin(item: CatalogItem, whole: boolean, hole: number, perch: boolean, typedW?: number): TemplateBuild {
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  const wire = item.id === "wire-frame" || !!item.tags?.includes("wire");
  const stick = Math.max(2, prim.length);
  // Whole sticks: the box is exactly one stick each way (walls, battens and floor are whole sticks).
  const S = whole ? stick : Math.min(stick, Math.max(4, typedW ?? 6));
  // Unnamed stock draws as a wire study at a readable pitch, not hundreds of hairlines.
  const f = wire ? S / 10 : prim.width; // face width seen in the wall
  const t = round || wire ? prim.width : prim.height; // stands off the wall by this
  const fr = wire ? prim.width : f; // real width of one stick (offsets across it)
  const n = Math.max(4, Math.floor(S / f + 1e-6));
  const C = n * f;
  const H = S;
  const segs: TSeg[] = [];
  const Z = v3(0, 0, 1);
  const X = v3(1, 0, 0);
  const Y = v3(0, 1, 0);
  const wallOut = S / 2 + t / 2;
  const wallIn = S / 2 - t / 2;
  // Entrance: leave out the slats in the hole column; the opening is square, k slats wide.
  let k = Math.max(2, Math.round(Math.min(hole, S * 0.45) / f));
  const n0 = Math.max(4, Math.floor(S / f + 1e-6));
  if ((n0 - k) % 2) k = k + 1 <= n0 - 2 && Math.abs((k + 1) * f - hole) <= Math.abs((k - 1) * f - hole) ? k + 1 : Math.max(1, k - 1);
  const openW = k * f;
  const open0 = Math.max(f * 3, Math.round((H * 0.6 - openW / 2) / f) * f);
  const open1 = Math.min(H - f * 2, open0 + openW);
  const xs = Array.from({ length: n }, (_, i) => -C / 2 + f / 2 + i * f);
  const firstGap = Math.floor((n - k) / 2);
  for (const zs of [1, -1]) {
    xs.forEach((x, i) => {
      if (zs > 0 && i >= firstGap && i < firstGap + k) return;
      segs.push({ a: v3(x, 0, zs * wallOut), b: v3(x, H, zs * wallOut), role: "wall", face: Z });
    });
  }
  const gapX0 = xs[firstGap] - f / 2;
  const gapX1 = xs[firstGap + k - 1] + f / 2;
  // Side walls: slats across the depth, flat against the side face.
  const zsl = Array.from({ length: n }, (_, i) => -C / 2 + f / 2 + i * f);
  for (const xsd of [1, -1]) for (const z of zsl) segs.push({ a: v3(xsd * wallOut, 0, z), b: v3(xsd * wallOut, H, z), role: "wall", face: X });
  // Front: flat sticks glued across the back of the slats below and above the entrance (they close the gap).
  for (let y = f / 2; y + f / 2 <= H + 1e-6; y += f) {
    if (y > open0 && y < open1) continue;
    segs.push({ a: v3(-S / 2, y, wallIn), b: v3(S / 2, y, wallIn), role: "batten", face: Z });
  }
  // Back wall battens, low and high.
  for (const y of [f * 1.5, H - f * 1.5]) segs.push({ a: v3(-S / 2, y, -wallIn), b: v3(S / 2, y, -wallIn), role: "batten", face: Z });
  // Side battens ride in the entrance band (the front has no battens there).
  for (const xsd of [1, -1]) for (const y of [open0 + f / 2, open1 - f / 2]) segs.push({ a: v3(xsd * wallIn, y, -S / 2), b: v3(xsd * wallIn, y, S / 2), role: "batten", face: X });
  // Floor: sticks laid flat inside the walls.
  const nf = Math.max(3, Math.floor((S - 2 * t) / f + 1e-6));
  for (let i = 0; i < nf; i++) {
    const z = -((nf - 1) * f) / 2 + i * f;
    segs.push({ a: v3(-S / 2, t / 2, z), b: v3(S / 2, t / 2, z), role: "floor", face: Y });
  }
  // Gable rafters on the front and back faces: one whole stick from eave to ridge each side.
  // 38° pitch: each rafter bears on the wall top corner and runs on past it as the eave overhang.
  const wallEdge = S / 2 + t;
  const th = (38 * Math.PI) / 180;
  const rafterL = whole ? stick : wallEdge / Math.cos(th) + Math.max(0.75, S * 0.15);
  const run = rafterL * Math.cos(th);
  const lift = fr / 2 / Math.cos(th);
  const ridgeY = H + lift + wallEdge * Math.tan(th);
  const eaveY = ridgeY - rafterL * Math.sin(th);
  for (const zs of [1, -1]) {
    for (const side of [-1, 1]) {
      const z = zs * (wallOut + (side > 0 ? t : 0));
      segs.push({ a: v3(side * run, eaveY, z), b: v3(0, ridgeY, z), role: "rafter", face: Z });
    }
  }
  // Roof decks: slats laid down each slope on top of the rafters, overhanging front and back.
  const ov = f;
  const zSpan = S + 4 * t + 2 * ov;
  const nr = Math.ceil(zSpan / f);
  for (const side of [-1, 1]) {
    const nrm = v3(side * Math.sin(th), Math.cos(th), 0);
    const off = fr / 2 + t / 2 + (side > 0 ? t : 0);
    const top = v3(0 + nrm.x * off, ridgeY + nrm.y * off, 0);
    const eave = v3(side * run + nrm.x * off, eaveY + nrm.y * off, 0);
    for (let i = 0; i < nr; i++) {
      const z = -((nr - 1) * f) / 2 + i * f;
      segs.push({ a: v3(top.x, top.y, z), b: v3(eave.x, eave.y, z), role: "roof", face: nrm });
    }
  }
  if (perch) {
    const out = Math.min(2, S * 0.45);
    const z1 = wallOut + t / 2 + out;
    segs.push({ a: v3(0, open0 + t / 2, z1 - Math.min(stick, S)), b: v3(0, open0 + t / 2, z1), role: "perch", face: Y });
  }
  const name = item.name.replace(/\s*\(.*\)$/, "");
  return {
    classId: "small-house",
    subject: "birdhouse",
    label: "Birdhouse",
    kind: "house",
    segs,
    params: { hole: openW, holeTypedDia: hole, openBottom: open0, openTop: Math.min(open1, open0 + openW), openX0: gapX0, openX1: gapX1, eave: H, ridge: ridgeY, width: S + 2 * t, depth: S + 2 * t, perch: perch ? 1 : 0 },
    notes: [
      `Birdhouse · ${name} walls laid flat side by side, a floor, a slatted gable roof on two rafters each end.`,
      `Entrance ${fmt(openW)}" square — leave out ${k} front slats and close the gap above and below with flat sticks glued behind (whole sticks, no cutting).`,
      `Gable ends stay open under the roof — that is the vent.${perch ? " Perch stick glued on the entrance sill, sticking out in front." : ""}`,
    ],
  };
}

function fmt(n: number): string {
  const r = Math.round(n * 8) / 8;
  const w = Math.floor(r);
  const e = Math.round((r - w) * 8);
  if (!e) return `${w}`;
  const g = e % 2 === 0 ? (e % 4 === 0 ? [e / 4, 2] : [e / 2, 4]) : [e, 8];
  return `${w ? `${w} ` : ""}${g[0]}/${g[1]}`;
}

function smallHousePanels(item: CatalogItem, hole: number, perch: boolean, typed: { width?: number; height?: number; depth?: number }): TemplateBuild {
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.5, 0.12);
  const board = item.formFactor === "board" || item.category === "lumber";
  const bw = item.dims.width ?? 5.5;
  // Boards: one board wide when it is wide enough, else two edge-glued.
  const boardW = bw >= 5 ? bw : Math.min(2 * bw, 7.25);
  const W = board ? boardW : Math.max(6, Math.min(16, typed.width ?? 7));
  const D = board ? boardW : Math.max(6, Math.min(16, typed.depth ?? W));
  const He = Math.max(6, Math.min(24, typed.height ? typed.height * 0.68 : board ? 8 : 8));
  const pitch = Math.PI / 4;
  const rise = (W / 2) * Math.tan(pitch);
  const Hr = He + rise;
  const ov = board ? 1 : 1.25;
  const r = (n: number) => Math.round(n * 16) / 16;
  const x0 = -W / 2;
  const z0 = -D / 2;
  const holeY = Math.min(He - hole / 2 - 1, Math.max(hole / 2 + 2.5, He * 0.7));
  const panels: Panel[] = [];
  const mk = (p: Omit<Panel, "id" | "materialId">): Panel => ({ id: createId("bh"), materialId: item.id, ...p });
  const gable: [number, number][] = [
    [0, 0],
    [r(W), 0],
    [r(W), r(He)],
    [r(W / 2), r(Hr)],
    [0, r(He)],
  ];
  const front = mk({
    type: "back",
    name: "Front gable",
    position: { x: r(x0), y: 0, z: r(D / 2 - T) },
    size: { width: r(W), height: r(Hr), depth: r(T) },
    polygon: { plane: "xy", pts: gable, holes: [{ x: r(W / 2), y: r(holeY), r: r(hole / 2) }] },
    cutNote: `Gable end: ${fmt(W)}" wide, ${fmt(He)}" to the eaves, 45° to a peak at ${fmt(Hr)}". Drill the ${fmt(hole)}" entrance hole centered ${fmt(holeY)}" up (spade or Forstner bit).`,
  });
  panels.push(front);
  panels.push(
    mk({
      type: "back",
      name: "Back gable",
      position: { x: r(x0), y: 0, z: r(z0) },
      size: { width: r(W), height: r(Hr), depth: r(T) },
      polygon: { plane: "xy", pts: gable },
      cutNote: `Gable end: ${fmt(W)}" wide, ${fmt(He)}" to the eaves, 45° to a peak at ${fmt(Hr)}".`,
    }),
  );
  for (const [nm, x] of [
    ["Side wall", x0],
    ["Side wall", W / 2 - T],
  ] as const) {
    panels.push(mk({ type: "upright", name: nm, position: { x: r(x), y: 0, z: r(z0 + T) }, size: { width: r(T), height: r(He), depth: r(D - 2 * T) } }));
  }
  panels.push(mk({ type: "bottom", name: "Floor", position: { x: r(x0 + T), y: 0, z: r(z0 + T) }, size: { width: r(W - 2 * T), height: r(T), depth: r(D - 2 * T) }, cutNote: "Trim the corners ⅜\" for drainage." }));
  // Roof: two slabs on the 45° gable edges, meeting at the ridge, overhanging eaves and ends.
  const lift = T / Math.cos(pitch);
  const exX = ov * Math.cos(pitch);
  const exY = ov * Math.sin(pitch);
  const slope = Math.hypot(W / 2, rise) + ov;
  for (const side of [-1, 1] as const) {
    const eaveX = side * (W / 2 + exX);
    const eaveY = He - exY;
    const pts: [number, number][] = side < 0
      ? [[eaveX, eaveY], [0, Hr], [0, Hr + lift], [eaveX, eaveY + lift]]
      : [[0, Hr], [eaveX, eaveY], [eaveX, eaveY + lift], [0, Hr + lift]];
    const minX = Math.min(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    panels.push(
      mk({
        type: "top",
        name: "Roof panel",
        position: { x: r(minX), y: r(minY), z: r(z0 - ov) },
        size: { width: r(Math.max(...pts.map((p) => p[0])) - minX), height: r(Math.max(...pts.map((p) => p[1])) - minY), depth: r(D + 2 * ov) },
        polygon: { plane: "xy", pts: pts.map(([x, y]) => [r(x - minX), r(y - minY)] as [number, number]) },
        blank: { lengthIn: Math.round((D + 2 * ov) * 8) / 8, widthIn: Math.round(slope * 8) / 8, thicknessIn: T },
        cutNote: `Roof panel ${fmt(slope)}" down the slope × ${fmt(D + 2 * ov)}" long; bevel the ridge edge 45°.`,
      }),
    );
  }
  if (perch) {
    const p = Math.min(0.75, T);
    panels.push(
      mk({
        type: "rail",
        name: "Perch",
        position: { x: r(-p / 2), y: r(holeY - hole / 2 - 1.25 - p / 2), z: r(D / 2 - T) },
        size: { width: r(p), height: r(p), depth: r(T + 2.5) },
        joints: [{ with: front.id, kind: "mortise" }],
        cutNote: `Perch ${fmt(T + 2.5)}" long, glued into a ${fmt(p)}" hole ${fmt(1.25)}" below the entrance.`,
      }),
    );
  }
  return {
    classId: "small-house",
    subject: "birdhouse",
    label: "Birdhouse",
    kind: "house",
    panels,
    params: { hole, holeTypedDia: hole, holeY, eave: He, ridge: Hr + lift, width: W, depth: D, perch: perch ? 1 : 0 },
    notes: [
      `Birdhouse · ${item.name}: two gable ends, two side walls, a floor and a 45° gable roof overhanging ${fmt(ov)}".`,
      `Entrance: ${fmt(hole)}" hole drilled ${fmt(holeY)}" up the front${perch ? ", perch below it" : ""}.`,
    ],
  };
}

export function buildSmallHouse(prompt: string, item: CatalogItem, typed: { width?: number; height?: number; depth?: number }, whole: boolean): TemplateBuild | null {
  const kind = templateStock(item);
  const hole = smallHouseHoleIn(prompt) ?? 1.5;
  const perch = wantsPerch(prompt);
  if (kind === "thin") return smallHouseThin(item, whole && isWholeStock(item), hole, perch, typed.width);
  if (kind === "panel") return smallHousePanels(item, hole, perch, typed);
  return null;
}


// ============================================================== flat frame (picture frame)

export function isFlatFrame(prompt: string): boolean {
  const l = prompt.toLowerCase();
  if (/\b(?:bed|door|window|mirror\s+door|tent|truck|bike|bicycle|loom|swing|climbing|a-)\s*frame|\bframe\s*(?:tent|house|swing)|ledge|\brail\b|\btip(?:ped|ping)?\b|\blean(?:s|ing)?\b|\beasel\s+stand\b/.test(l)) return false;
  return /\b(?:picture|photo|poster|art|print|selfie)\s*frame\b|\bframe\s+for\s+(?:an?\s+|my\s+|the\s+)?(?:\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?)?\s*)?(?:photo|picture|print|poster|pic)\b|\bframe\b[^.]*\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:photo|picture|print|pic)/.test(l);
}

/** Typed photo size (portrait: w ≤ h). Default 5×7. */
export function framePhotoIn(prompt: string): { w: number; h: number; typed: boolean } {
  const l = prompt.toLowerCase();
  const ctx = l.match(/(\d+(?:\.\d+)?)\s*(?:"|in)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:photo|picture|print|pic|poster|frame)/);
  // Any other A×B that is not a lumber nominal (1x2, 2x4…). "8 by 10" is a photo; "1 by 2" is not.
  const any = [...l.matchAll(/(\d+(?:\.\d+)?)\s*(?:"|in)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/g)].find((q) => !(parseFloat(q[1]) <= 2 && [2, 3, 4, 6, 8, 10, 12].includes(parseFloat(q[2]))));
  const m = ctx ?? any;
  if (m) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (a >= 2 && b >= 2 && a <= 36 && b <= 48) return { w: Math.min(a, b), h: Math.max(a, b), typed: true };
  }
  const wide = l.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:wide|width)\b/);
  const tall = l.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:tall|high|height)\b/);
  if (wide && tall) {
    const a = parseFloat(wide[1]);
    const b = parseFloat(tall[1]);
    if (a >= 4 && b >= 4 && a <= 120 && b <= 120) return { w: a, h: b, typed: true };
  }
  const opening = l.match(
    /(?:opening|hole)\s+is\s+(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/,
  );
  if (opening) {
    const a = parseFloat(opening[1]);
    const b = parseFloat(opening[2]);
    if (a >= 4 && b >= 4 && a <= 120 && b <= 120) return { w: Math.min(a, b), h: Math.max(a, b), typed: true };
  }
  return { w: 5, h: 7, typed: false };
}

/** Whole-stick run of length L in lapped sub-layers: stick i at offset, alternate layer. */
function lappedRun(L: number, S: number, lap: number): { a: number; b: number; layer: 0 | 1 }[] {
  if (S >= L - 1e-6) return [{ a: -S / 2, b: S / 2, layer: 0 }];
  let n = 2;
  while ((L - S) / (n - 1) > S - lap && n < 30) n++;
  const step = (L - S) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ a: -L / 2 + i * step, b: -L / 2 + i * step + S, layer: (i % 2) as 0 | 1 }));
}

function flatFrameThin(item: CatalogItem, whole: boolean, photo: { w: number; h: number }): TemplateBuild {
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  const wire = item.id === "wire-frame" || !!item.tags?.includes("wire");
  const f = wire ? 0.5 : prim.width;
  const fr = prim.width;
  const t = round || wire ? prim.width : prim.height;
  const S = whole ? Math.max(1, prim.length) : Math.max(photo.w, photo.h) + 4 * f;
  const lap = Math.min(S * 0.3, Math.max(f * 2, 0.75));
  const { w, h } = photo;
  // Universal border standard: a frame's border must read as a band, not a line. Stock thinner than
  // 0.3" (skewers, wire) lays several sticks side by side per side until the band is ≥ 0.35" wide.
  const band = f < 0.3 ? Math.ceil(0.35 / f) : 1;
  const Fb = band * f;
  const Wo = w + 2 * Fb;
  const Ho = h + 2 * Fb;
  const segs: TSeg[] = [];
  const Z = v3(0, 0, 1);
  // Layers from the front face back: rails, stiles, backer bars.
  const railRun = lappedRun(Wo, S, lap);
  const stileRun = lappedRun(Ho, S, lap);
  const railLayers = Math.max(...railRun.map((r) => r.layer)) + 1;
  const stileLayers = Math.max(...stileRun.map((r) => r.layer)) + 1;
  let z = 0;
  const zOf = (layer: number) => -(layer + 0.5) * t;
  for (let k = 0; k < band; k++) for (const ys of [1, -1]) for (const r of railRun) segs.push({ a: v3(r.a, ys * (h / 2 + f / 2 + k * f), zOf(z + r.layer)), b: v3(r.b, ys * (h / 2 + f / 2 + k * f), zOf(z + r.layer)), role: "rail", face: Z });
  z += railLayers;
  for (let k = 0; k < band; k++) for (const xs of [1, -1]) for (const r of stileRun) segs.push({ a: v3(xs * (w / 2 + f / 2 + k * f), r.a, zOf(z + r.layer)), b: v3(xs * (w / 2 + f / 2 + k * f), r.b, zOf(z + r.layer)), role: "stile", face: Z });
  z += stileLayers;
  // Backer bars across the back: they hold the photo in the opening and tie the stiles.
  const barRun = lappedRun(Wo, S, lap);
  const barLayers = Math.max(...barRun.map((r) => r.layer)) + 1;
  // Bars sit inside the opening's height, evenly spaced (not doubled against the rails).
  const nb = Math.max(2, Math.ceil(h / 3.5));
  for (let i = 0; i < nb; i++) {
    const y = -h / 2 + (h * (i + 1)) / (nb + 1);
    for (const r of barRun) segs.push({ a: v3(r.a, y, zOf(z + r.layer)), b: v3(r.b, y, zOf(z + r.layer)), role: "backer", face: Z });
  }
  z += barLayers;
  const zBack = -z * t;
  // Easel stand: one stick from high on the backer down to the bench behind — it stands the frame up.
  // A stick much longer than the frame would sprawl; that frame hangs or leans instead.
  const standL = whole ? S : Math.max(3, Ho * 0.8);

  // The lowest stick end sits on the bench (crossing ends of long sticks stand the frame).
  const lift = -Math.min(...segs.flatMap((q) => [q.a.y, q.b.y])) + (round || wire ? t / 2 : f / 2);
  const all: TSeg[] = segs.map((s0) => ({ ...s0, a: v3(s0.a.x, s0.a.y + lift, s0.a.z), b: v3(s0.b.x, s0.b.y + lift, s0.b.z) }));
  // Stand only when it reaches a backer bar at a steep lean (foot no more than ~0.6 of its length back).
  const ay = all.filter((q) => q.role === "backer").map((q) => q.a.y).sort((m, n) => n - m).find((y) => y <= standL * 0.97 && y >= standL * 0.8);
  const withStand = ay != null;
  if (ay != null) {
    all.push({ a: v3(0, ay, zBack - t / 2), b: v3(0, 0, zBack - t / 2 - Math.sqrt(Math.max(0.25, standL * standL - ay * ay))), role: "stand" });
  }
  void fr;
  return {
    classId: "flat-frame",
    subject: "picture frame",
    label: "Picture frame",
    kind: "figure",
    segs: all,
    params: { openW: w, openH: h, outerW: Wo, outerH: Ho, frontZ: 0, backZ: zBack },
    notes: [
      `Picture frame · opening ${fmt(w)}" × ${fmt(h)}" (the photo size) · outer ${fmt(Wo)}" × ${fmt(Ho)}".`,
      railRun.length > 1 || stileRun.length > 1
        ? `Each side is whole ${item.name}s lapped face to face (no cutting); rails in front, stiles behind, lapped at the corners.`
        : `Rails in front, stiles behind, lapped and glued at the four corners.`,
      `${nb} backer bars across the back hold the photo in the opening.${withStand ? " One stand stick behind makes it stand on a shelf." : " Hang it, or lean it on a shelf."}`,
      ...(band > 1 ? [`Each side is ${band} ${item.name}s glued side by side so the border reads as a band.`] : []),
    ],
  };
}

function flatFramePanels(item: CatalogItem, photo: { w: number; h: number }): TemplateBuild {
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.75, 0.25);
  const bw = item.formFactor === "board" || item.category === "lumber" ? Math.min(item.dims.width ?? 1.5, 2.5) : 1.5;
  const { w, h } = photo;
  const Wo = w + 2 * bw;
  const Ho = h + 2 * bw;
  const r = (n: number) => Math.round(n * 16) / 16;
  const rab = 0.375;
  const backT = Math.min(0.25, T / 3);
  const panels: Panel[] = [];
  const mk = (p: Omit<Panel, "id" | "materialId"> & { materialId?: string }): Panel => ({ id: createId("fr"), materialId: item.id, ...p });
  const x0 = -Wo / 2;
  // Mitered members: trapezoids in the face plane, long edge outside.
  const top = mk({ type: "rail", name: "Frame rail", position: { x: r(x0), y: r(h + bw), z: 0 }, size: { width: r(Wo), height: r(bw), depth: r(T) }, polygon: { plane: "xy", pts: [[0, r(bw)], [r(Wo), r(bw)], [r(Wo - bw), 0], [r(bw), 0]] } });
  const bot = mk({ type: "rail", name: "Frame rail", position: { x: r(x0), y: 0, z: 0 }, size: { width: r(Wo), height: r(bw), depth: r(T) }, polygon: { plane: "xy", pts: [[0, 0], [r(Wo), 0], [r(Wo - bw), r(bw)], [r(bw), r(bw)]] } });
  const left = mk({ type: "upright", name: "Frame stile", position: { x: r(x0), y: 0, z: 0 }, size: { width: r(bw), height: r(Ho), depth: r(T) }, polygon: { plane: "xy", pts: [[0, 0], [r(bw), r(bw)], [r(bw), r(Ho - bw)], [0, r(Ho)]] } });
  const right = mk({ type: "upright", name: "Frame stile", position: { x: r(Wo / 2 - bw), y: 0, z: 0 }, size: { width: r(bw), height: r(Ho), depth: r(T) }, polygon: { plane: "xy", pts: [[r(bw), 0], [r(bw), r(Ho)], [0, r(Ho - bw)], [0, r(bw)]] } });
  const members = [top, bot, left, right];
  const railNote = `45° miters both ends; ${fmt(rab)}" × ${fmt(backT + 0.125)}" rabbet on the back inside edge for the photo, glass and backer.`;
  for (const m of members) m.cutNote = railNote;
  top.blank = bot.blank = { lengthIn: Math.round(Wo * 8) / 8, widthIn: Math.round(bw * 8) / 8, thicknessIn: T };
  left.blank = right.blank = { lengthIn: Math.round(Ho * 8) / 8, widthIn: Math.round(bw * 8) / 8, thicknessIn: T };
  panels.push(...members);
  const backer = mk({
    materialId: "plywood-1-4-4x8",
    type: "back",
    name: "Backer",
    position: { x: r(-w / 2 - rab), y: r(bw - rab), z: 0 },
    size: { width: r(w + 2 * rab), height: r(h + 2 * rab), depth: r(backT) },
    joints: members.map((m) => ({ with: m.id, kind: "rabbet" as const })),
    cutNote: `Backer ${fmt(w + 2 * rab)}" × ${fmt(h + 2 * rab)}" drops into the rabbet behind the photo; hold with glazier points.`,
  });
  panels.push(backer);
  return {
    classId: "flat-frame",
    subject: "picture frame",
    label: "Picture frame",
    kind: "figure",
    panels,
    params: { openW: w, openH: h, outerW: Wo, outerH: Ho, rabbet: rab, glueOnly: 1 },
    notes: [
      `Picture frame · ${item.name}: four mitered members, opening ${fmt(w)}" × ${fmt(h)}" (the photo size), outer ${fmt(Wo)}" × ${fmt(Ho)}".`,
      `A ${fmt(rab)}" rabbet on the back carries the photo and a backer. Hang it on a sawtooth hanger.`,
    ],
  };
}

export function buildFlatFrame(prompt: string, item: CatalogItem, whole: boolean): TemplateBuild | null {
  const kind = templateStock(item);
  let photo = framePhotoIn(prompt);
  // Untyped photo: long whole sticks frame an 8×10 (short crossing ends) instead of a 5×7 with long ones.
  if (!photo.typed && kind === "thin" && whole && isWholeStock(item)) {
    const pr = toPrimitive(item);
    if (pr.length >= 10 + 2 * pr.width + 1) photo = { w: 8, h: 10, typed: false };
  }
  if (kind === "thin" || kind === "other") return flatFrameThin(item, whole && isWholeStock(item), photo);
  if (kind === "panel") return flatFramePanels(item, photo);
  return null;
}


// ============================================================== launcher (catapult)

export function isLauncher(prompt: string): boolean {
  const l = prompt.toLowerCase();
  if (/trebuchet|ballista|slingshot|sling\s*shot|soft-?launch|\bramp\b|trough|marble\s*run/.test(l)) return false;
  return /\bcatapults?\b|\bmangonels?\b|\bonager\b/.test(l);
}

const DEG = Math.PI / 180;

/**
 * Catapult (mangonel): low base, two A-frames, a crossbar across the apexes that stops the arm,
 * a pivot axle across the front legs, the throwing arm cocked back onto the rear tie, cup at the tip.
 * A rubber band from the arm to the crossbar is the spring. Front legs lean at the arm's stop angle,
 * so the arm stops leaning back (115°) and throws the payload forward and up.
 */
function launcherSticks(item: CatalogItem, whole: boolean, typedH?: number): TemplateBuild {
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  const f = prim.width;
  const t = round ? prim.width : prim.height;
  const S0 = Math.max(1, prim.length);
  const lap = Math.min(S0 * 0.45, Math.max(2 * f, 0.3 * S0));
  const lapLen = (m: number) => m * S0 - (m - 1) * lap;
  // Member length: one whole stick, or whole sticks lapped end to end to reach a typed height; cut stock scales freely.
  let S: number;
  if (whole) {
    let m = 1;
    if (typedH) while (lapLen(m) * 0.93 < typedH - lap / 2 && m < 12) m++;
    S = lapLen(m);
  } else S = Math.max(6, (typedH ?? 12) / 0.95, typedH ? 0 : 10 * f);
  let L2 = S * 1.7;
  if (whole) { let m = 2; while (lapLen(m) < 1.6 * S && m < 20) m++; L2 = lapLen(m); }
  const zr = S / 2 - f; // A-frames and rails, inside the tie ends
  const W = whole ? S : 2 * zr + 2 * f; // tie / crossbar / axle length
  const Y = v3(0, 1, 0), Zf = v3(0, 0, 1);
  const segs: TSeg[] = [];
  /** One member from a to b: whole sticks lapped face to face (sublayer along +face) when longer than a stick. */
  const put = (a: Vec3, b: Vec3, role: string, face: Vec3, sub = 1) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!whole || L <= S0 + 1e-6) { segs.push({ a, b, role, face }); return; }
    const u = v3((b.x - a.x) / L, (b.y - a.y) / L, (b.z - a.z) / L);
    for (const q of lappedRun(L, S0, lap)) {
      const o = q.layer * t * sub;
      const at = (d: number) => v3(a.x + u.x * (d + L / 2) + face.x * o, a.y + u.y * (d + L / 2) + face.y * o, a.z + u.z * (d + L / 2) + face.z * o);
      segs.push({ a: at(q.a), b: at(q.b), role, face });
    }
  };
  const ta = t; // axle lies flat
  const oLead = whole ? ta / 2 + 2 * t : ta / 2 + t; // axle centre to the arm's leading face
  const railLayers = whole && (S > S0 + 1e-6 || S0 < 12) ? 2 : 1;
  const railTop = t * railLayers;
  const e = Math.max(f, 0.08 * S); // arm tail past the pivot
  // Axle height: the arm tail swings down past the front tie without touching it.
  const yp = railTop + Math.max(t + f, 0.1 * S, t + e + t);
  // A-frame: pick the leg spread (and, for cut stock, leg length) so the arm's leading face meets the
  // crossbar's rear edge nearest 115° (leaning back), with feet spread at least half the rise.
  const geom = (sp: number, Lg: number) => {
    const R = Math.sqrt(Math.max(0.01, Lg * Lg - sp * sp));
    const yA = railTop + R;
    const xp = sp * (1 - (yp - railTop) / R);
    const dx = -f / 2 - xp, dy = yA - yp;
    const h = (th: number) => dx * Math.sin(th) - dy * Math.cos(th) - oLead;
    let lo = 90 * DEG, hi = 180 * DEG, th: number | null = null;
    if (Math.sign(h(lo)) !== Math.sign(h(hi))) {
      for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (Math.sign(h(m)) === Math.sign(h(lo))) lo = m; else hi = m; }
      th = (lo + hi) / 2;
    }
    return { R, yA, xp, th };
  };
  let best: { sp: number; Lg: number; g: ReturnType<typeof geom> } | null = null;
  for (const Lg of whole ? [S] : Array.from({ length: 21 }, (_, k) => S * (1 + k * 0.05))) {
    for (let k = 0; k <= 70; k++) {
      const sp = Lg * (0.2 + k * 0.006);
      const g = geom(sp, Lg);
      if (g.th == null || sp / g.R < 0.25) continue;
      if (!best || Math.abs(g.th - 115 * DEG) < Math.abs(best.g.th! - 115 * DEG)) best = { sp, Lg, g };
    }
  }
  if (!best) best = { sp: 0.42 * S, Lg: S, g: { ...geom(0.42 * S, S), th: 115 * DEG } };
  const sA = best.sp;
  const { R, yA, xp } = best.g;
  const thS = best.g.th!;
  // A-frames: two legs per side meeting at the apex, flat against the side plane, standing on the rails.
  for (const zs of [1, -1]) {
    put(v3(sA, railTop, zs * (zr + t / 2)), v3(0, yA, zs * (zr + t / 2)), "leg", v3(0, 0, zs));
    put(v3(-sA, railTop, zs * (zr - t / 2)), v3(0, yA, zs * (zr - t / 2)), "leg", v3(0, 0, -zs));
  }
  // Crossbar across the apexes: the arm stops against it.
  put(v3(0, yA + t / 2, -W / 2), v3(0, yA + t / 2, W / 2), "stop", Y);
  // Pivot axle across the front legs.
  put(v3(xp, yp, -W / 2), v3(xp, yp, W / 2), "support", v3(0, -1, 0));
  // Arm, cocked: rests on the rear tie just inboard of the cup.
  const rRest = L2 - e - 3.5 * f;
  const tieTop = railTop + t;
  const thC = Math.PI + Math.asin(Math.min(0.9, Math.max(-0.9, (yp + (whole ? ta / 2 + t : ta / 2) - tieTop) / rRest)));
  const dC = { x: Math.cos(thC), y: Math.sin(thC) };
  const nC = { x: Math.sin(thC), y: -Math.cos(thC) };
  const along = (r: number, off: number) => v3(xp + dC.x * r + nC.x * off, yp + dC.y * r + nC.y * off, 0);
  const face = v3(nC.x, nC.y, 0);
  const o1 = ta / 2 + t / 2;
  put(along(-e, o1), along(L2 - e, o1), "arm", face);
  const topOff = whole ? o1 + t : o1;
  // Cup: three pad sticks across the tip, two rims on top (front and back lips).
  // Cut stock: the cup is cut to fit between the A-frames so it swings clear of the legs.
  const Wc = whole ? W : 2 * (zr - 1.5 * t) - 0.25;
  const cupLayers = whole && Wc > S0 + 1e-6 ? 2 : 1;
  const cupR: number[] = [];
  for (let k = 0; k < 3; k++) {
    const r = L2 - e - f / 2 - k * f;
    cupR.push(r);
    const c = along(r, topOff + t);
    put(v3(c.x, c.y, -Wc / 2), v3(c.x, c.y, Wc / 2), "cup", face);
  }
  for (const k of [0, 2]) {
    const c = along(cupR[k], topOff + (1 + cupLayers) * t);
    put(v3(c.x, c.y, -Wc / 2), v3(c.x, c.y, Wc / 2), "cup", face);
  }
  const xRest = xp + dC.x * rRest + nC.x * (topOff - t / 2);
  // Base: rails from behind the rest tie to past the front feet; ties on top.
  const xFront = sA + 2 * f;
  const xRear = Math.min(xRest - f, -sA - 2 * f);
  const L = xFront - xRear + f;
  const mid0 = (xFront + xRear) / 2;
  const rr = whole ? lappedRun(L, S0, lap) : [{ a: -L / 2, b: L / 2, layer: 0 as 0 | 1 }];
  for (const zs of [1, -1]) for (const q of rr) segs.push({ a: v3(mid0 + q.a, t / 2 + q.layer * t, zs * zr), b: v3(mid0 + q.b, t / 2 + q.layer * t, zs * zr), role: "rail", face: Y });
  for (const x of [xRest, 0, xFront - f / 2]) put(v3(x, tieTop - t / 2, -W / 2), v3(x, tieTop - t / 2, W / 2), "tie", v3(0, -1, 0));
  const cupMid = L2 - e - 1.5 * f;
  return {
    classId: "launcher",
    subject: "catapult",
    label: "Catapult",
    kind: "frame",
    segs,
    params: {
      pivotX: xp, pivotY: yp, armLen: L2 - e, armTail: e, cockedDeg: thC / DEG, stopDeg: thS / DEG, stickT: t, stickW: f, crossbarX: 0, crossbarY: yA + t / 2,
      cupR: cupMid, cupInnerR: cupR[2] - f / 2, apexY: yA, legSpread: sA, legRise: R, zr, leadOffset: oLead, baseTop: tieTop, rubberBands: 2,
    },
    notes: [
      `Catapult · base ${fmt(L)}" long, A-frames ${fmt(yA)}" tall, arm ${fmt(L2)}" with a cup at the tip.`,
      `The arm pivots on the axle across the front legs, cocks back onto the rear tie, and stops against the crossbar leaning back ${Math.round(thS / DEG - 90)}° so the payload flies forward and up.`,
      `Spring: loop a rubber band from the arm (just below the crossbar) up over the crossbar. Pull the cup back to the rear tie, load a pom-pom or marble, let go.`,
    ],
  };
}

export function buildLauncher(prompt: string, item: CatalogItem, typed0: { width?: number; height?: number; depth?: number }, whole: boolean): TemplateBuild | null {
  const kind = templateStock(item);
  // A single typed size on a catapult is its height.
  const typed = { height: typed0.height ?? (typed0.width && !typed0.depth ? typed0.width : undefined) };
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") return null;
  if (kind === "thin") return launcherSticks(item, whole && isWholeStock(item), typed.height);
  // Boards / dowels: same silhouette from cut members.
  return launcherSticks(item, false, typed.height);
}


// ============================================================== platform tower (cat tree)

export function isPlatformTower(prompt: string): boolean {
  return /\bcat\s*-?\s*(?:tree|tower|condo|climber|climbing\s*tower)\b|\bkitty\s*(?:tree|tower|condo)\b/.test(prompt.toLowerCase());
}

/** Cat tree: four corner posts, a platform at the base, two in the middle, one on top; decks glued across rails. */
export function buildPlatformTower(prompt: string, item: CatalogItem, typed: { width?: number; height?: number; depth?: number }, whole0: boolean): TemplateBuild | null {
  const said = typedSizeIn(prompt);
  const H = said.height ?? said.length ?? typed.height ?? 48;
  const W = Math.round(Math.max(12, Math.min(24, H * 0.3)) * 4) / 4;
  const levels = [0, H * 0.34, H * 0.67, H];
  const kind = templateStock(item);
  const sheet = item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard";
  const params = { height: H, width: W, platforms: levels.length };
  const notes = [
    `Cat tree · ${fmt(H)}" tall on a ${fmt(W)}" square base: four corner posts and ${levels.length} platforms (base, two perches, top).`,
    `Wrap the posts in sisal rope where the cat scratches.`,
  ];
  if (sheet) {
    const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.75, 0.25);
    const pw = 3.5;
    const r = (n: number) => Math.round(n * 16) / 16;
    const panels: Panel[] = [];
    const mk = (p: Omit<Panel, "id" | "materialId">): Panel => ({ id: createId("ct"), materialId: item.id, ...p });
    for (let i = 0; i < levels.length; i++) {
      const y = i === 0 ? 0 : i === levels.length - 1 ? H - T : levels[i];
      panels.push(mk({ type: "shelf", name: i === 0 ? "Base platform" : i === levels.length - 1 ? "Top platform" : "Platform", position: { x: r(-W / 2), y: r(y), z: r(-W / 2) }, size: { width: r(W), height: T, depth: r(W) } }));
    }
    for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
      panels.push(mk({ type: "upright", name: "Post", position: { x: r(xs > 0 ? W / 2 - pw : -W / 2), y: r(T), z: r(zs > 0 ? W / 2 - T : -W / 2) }, size: { width: pw, height: r(H - 2 * T), depth: T }, cutNote: "Screw each platform into the post edges; predrill." }));
    }
    return { classId: "platform-tower", subject: "cat tree", label: "Cat tree", kind: "figure", panels, params, notes };
  }
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  const whole = whole0 && kind === "thin" && isWholeStock(item);
  const f = prim.width;
  const t = round ? prim.width : prim.height;
  const S = Math.max(0.5, prim.length);
  const lap = Math.min(S * 0.45, Math.max(2 * f, 0.3 * S));
  const segs: TSeg[] = [];
  const put = (a: Vec3, b: Vec3, role: string, face: Vec3, sub: Vec3) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!whole || L <= S + 1e-6) { segs.push({ a, b, role, face }); return; }
    const u = v3((b.x - a.x) / L, (b.y - a.y) / L, (b.z - a.z) / L);
    for (const q of lappedRun(L, S, lap)) {
      const o = q.layer * t;
      const at = (d: number) => v3(a.x + u.x * (d + L / 2) + sub.x * o, a.y + u.y * (d + L / 2) + sub.y * o, a.z + u.z * (d + L / 2) + sub.z * o);
      segs.push({ a: at(q.a), b: at(q.b), role, face });
    }
  };
  const Y = v3(0, 1, 0);
  const deckT = t;
  const railH = f; // rails on edge
  const zr = W / 2 - 2.5 * t; // rails just inside the posts (posts + their lap sublayer)
  // Posts: on the front and back faces at the corners, flat against the face, sublayer outward.
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    put(v3(xs * (W / 2 - f / 2), 0, zs * (W / 2 - t / 2)), v3(xs * (W / 2 - f / 2), H - deckT, zs * (W / 2 - t / 2)), "post", v3(0, 0, zs), v3(0, 0, -zs));
  }
  // Each platform: two rails along x glued inside the posts, decking across the rails.
  const pitch = whole && S < W ? 2 * f : f * 1.6;
  for (let i = 0; i < levels.length; i++) {
    const top = i === 0 ? railH : i === levels.length - 1 ? H - deckT : levels[i];
    for (const zs of [-1, 1]) put(v3(-W / 2, top - railH / 2, zs * zr), v3(W / 2, top - railH / 2, zs * zr), "rail", v3(0, 0, 1), Y);
    const n = Math.max(3, Math.floor((W - f) / pitch) + 1);
    for (let k = 0; k < n; k++) {
      const x = -W / 2 + f / 2 + ((W - f) * k) / (n - 1);
      put(v3(x, top + deckT / 2 + (whole && W > S ? 0 : 0), -W / 2), v3(x, top + deckT / 2, W / 2), "deck", Y, Y);
    }
  }
  return { classId: "platform-tower", subject: "cat tree", label: "Cat tree", kind: "figure", segs, params, notes };
}

// ============================================================== humanoid (articulated figure)

export function isHumanoid(prompt: string): boolean {
  const l = prompt.toLowerCase();
  if (/figure\s*-?\s*(?:8|eight)|\b(?:shelf|shelves|stand|display|rack|case|cabinet|holder|box|house|cave|hole)\b|robot|android|snow\s*man|iron\s*man|liberty|statue/.test(l)) return false;
  return /\b(?:stick\s*)?figures?\b|\bhumanoids?\b|\bperson\b|\bhuman\b|\bman\b|\bwoman\b|\bboy\b|\bgirl\b|\bdoll\b|\bpuppet\b|\bgingerbread\s+man\b|\bscarecrow\b|\bmannequin\b/.test(l);
}

/**
 * Articulated figure: head, torso, two arms (upper arm + forearm) and two legs (thigh + shin),
 * each limb segment one member pivoting on a paper fastener at the shoulder, elbow, hip and knee.
 * Proportions: head ≈ 1/7.5 of the height, legs ≈ half, torso ≈ 0.29. A stand post behind the
 * torso holds it upright on a crossed base, so the limbs stay free to pose.
 */
function humanoidLinear(item: CatalogItem, whole: boolean, typedH?: number): TemplateBuild {
  const prim = toPrimitive(item);
  const round = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  const f = prim.width;
  const t = round ? prim.width : prim.height;
  const S0 = Math.max(1, prim.length);
  const lap = Math.min(S0 * 0.45, Math.max(2 * f, 0.3 * S0));
  const lapLen = (m: number) => m * S0 - (m - 1) * lap;
  // Limb member: one whole stick (lapped whole sticks to reach a typed height); cut stock sizes to the height.
  let S: number;
  if (whole) {
    let m = 1;
    if (typedH) while (m < 8 && Math.abs((lapLen(m + 1) - f) / 0.245 - typedH) < Math.abs((lapLen(m) - f) / 0.245 - typedH)) m++;
    S = lapLen(m);
  } else S = 0.245 * (typedH ?? Math.max(18, Math.round(25 * f))) + f; // default: the stock reads as a limb, not a slab
  const d = S - f; // pivot to pivot
  const Hn = d / 0.245;
  const Wt = whole && S <= S0 + 1e-6 ? S : Math.max(4 * f, 0.26 * Hn); // shoulder width
  const segs: TSeg[] = [];
  const Z = v3(0, 0, 1), Y = v3(0, 1, 0);
  const put = (a: Vec3, b: Vec3, role: string, face: Vec3, sub: Vec3) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!whole || L <= S0 + 1e-6) { segs.push({ a, b, role, face }); return; }
    const u = v3((b.x - a.x) / L, (b.y - a.y) / L, (b.z - a.z) / L);
    for (const q of lappedRun(L, S0, lap)) {
      const o = q.layer * t;
      const at = (dd: number) => v3(a.x + u.x * (dd + L / 2) + sub.x * o, a.y + u.y * (dd + L / 2) + sub.y * o, a.z + u.z * (dd + L / 2) + sub.z * o);
      segs.push({ a: at(q.a), b: at(q.b), role, face });
    }
  };
  const lay = whole && S > S0 + 1e-6 ? 2 : 1; // sublayers a lapped member takes
  // Layers (z): torso and head 0; arms in front; battens, neck, post, thighs behind; shins behind those.
  const zArm = (lay - 0.5) * t + t / 2, zFore = zArm + lay * t;
  const zBack = -(t / 2 + t / 2), zShin = zBack - lay * t;
  const hipX = Math.max(f * 1.2, Wt * 0.28);
  // Base: two sticks front-to-back on the bench, three across on top.
  const Wb = Math.max(Wt, 2 * hipX + 3 * f, whole ? Math.min(S0, 2 * hipX + 3 * f) : 0);
  const zc = (zBack + zShin) / 2;
  const Db = Math.max(Wb, 0.25 * Hn);
  for (const xs of [-1, 1]) put(v3(xs * (Wb / 2 - f / 2), t / 2, zc - Db / 2), v3(xs * (Wb / 2 - f / 2), t / 2, zc + Db / 2), "base", Y, Y);
  const nBase = Math.max(3, Math.ceil((Math.abs(zShin - zBack) + 2 * t) / f) + 1);
  for (let k = 0; k < nBase; k++) {
    const z = zc + (k - (nBase - 1) / 2) * f;
    put(v3(-Wb / 2, 1.5 * t, z), v3(Wb / 2, 1.5 * t, z), "base", Y, Y);
  }
  const yb = 2 * t;
  // Legs: shin from the base up to the knee, thigh from the knee up into the torso's bottom row.
  const kneeY = yb + S - f / 2;
  const hipY = kneeY + d;
  for (const xs of [-1, 1]) {
    put(v3(xs * hipX, yb, zShin), v3(xs * hipX, yb + S, zShin), "shin", Z, v3(0, 0, -1));
    put(v3(xs * hipX, kneeY - f / 2, zBack), v3(xs * hipX, kneeY - f / 2 + S, zBack), "thigh", Z, v3(0, 0, -1));
  }
  // Torso: rows across, bottom row carries the hip pivots, top row the shoulders.
  const tb = hipY - f / 2;
  const Th = 0.58 * 2 * d;
  const nRows = Math.max(3, Math.min(14, Math.round(Th / f)));
  const pitch = nRows > 1 ? (Th - f) / (nRows - 1) : 0;
  const rowY: number[] = [];
  for (let k = 0; k < nRows; k++) {
    const y = tb + f / 2 + k * pitch;
    rowY.push(y);
    put(v3(-Wt / 2, y, 0), v3(Wt / 2, y, 0), "torso", Z, Z);
  }
  const tt = tb + Th;
  const shoulderY = tt - f / 2;
  // Two battens behind the torso tie every row.
  const bl = whole ? Math.min(S0, Th) : Th;
  for (const xs of [-1, 1]) put(v3(xs * (Wt / 2 - f / 2), tb + (Th - bl) / 2, zBack), v3(xs * (Wt / 2 - f / 2), tb + (Th + bl) / 2, zBack), "batten", Z, v3(0, 0, -1));
  // Arms: upper arm angled out from the shoulder, forearm continuing from the elbow.
  const a1 = 20 * DEG, a2 = 10 * DEG;
  const armEnds: Vec3[] = [];
  for (const xs of [-1, 1]) {
    const sh = v3(xs * (Wt / 2 - f / 2), shoulderY, zArm);
    const u1 = v3(xs * Math.sin(a1), -Math.cos(a1), 0);
    put(v3(sh.x - u1.x * f / 2, sh.y - u1.y * f / 2, zArm), v3(sh.x + u1.x * (S - f / 2), sh.y + u1.y * (S - f / 2), zArm), "arm", Z, Z);
    const el = v3(sh.x + u1.x * d, sh.y + u1.y * d, zFore);
    const u2 = v3(xs * Math.sin(a2), -Math.cos(a2), 0);
    put(v3(el.x - u2.x * f / 2, el.y - u2.y * f / 2, zFore), v3(el.x + u2.x * (S - f / 2), el.y + u2.y * (S - f / 2), zFore), "forearm", Z, Z);
    armEnds.push(v3(el.x + u2.x * d, el.y + u2.y * d, zFore));
  }
  // Head: short rows across above the torso, every row glued to the neck stick behind.
  const gap = Math.max(f * 0.6, 0.02 * Hn);
  const headH = (tt + gap - yb) / 6.5;
  const hb = tt + gap;
  let hw: number;
  if (round) {
    // Round stock: short rows across, every row crosses the neck stick behind.
    hw = headH * 0.78;
    const nh = Math.max(3, Math.min(8, Math.round(headH / f)));
    const hp = (headH - f) / (nh - 1);
    for (let k = 0; k < nh; k++) put(v3(-hw / 2, hb + f / 2 + k * hp, 0), v3(hw / 2, hb + f / 2 + k * hp, 0), "head", Z, Z);
  } else {
    // Flat stock: pieces stood edge to edge make a solid face block; an odd count centres one on the neck.
    let nh = Math.max(3, Math.round((headH * 0.78) / f));
    if (nh % 2 === 0) nh += 1;
    hw = nh * f;
    for (let k = 0; k < nh; k++) { const x = -hw / 2 + f / 2 + k * f; put(v3(x, hb, 0), v3(x, hb + headH, 0), "head", Z, Z); }
    // A mouth bar across the front ties the face pieces together (the neck behind carries the middle one).
    put(v3(-hw / 2, hb + headH * 0.3, t), v3(hw / 2, hb + headH * 0.3, t), "head", Z, Z);
  }
  const neckTop = hb + headH - f / 2;
  const neckL = whole ? Math.min(S0, neckTop - tb - f) : headH * 0.8 + gap + Th * 0.35;
  put(v3(0, neckTop - neckL, zBack), v3(0, neckTop, zBack), "neck", Z, v3(0, 0, -1));
  // Stand post: from the base up behind the torso, stopping short of the neck.
  const postTop = Math.min(tb + Th * 0.45, neckTop - neckL - Math.max(f, 0.2));
  put(v3(0, yb, zBack), v3(0, postTop, zBack), "post", Z, v3(0, 0, -1));
  const H = hb + headH;
  return {
    classId: "humanoid",
    subject: "figure",
    label: "Figure",
    kind: "figure",
    segs,
    params: {
      height: H, headH, torsoH: Th, legLen: hipY - yb + f / 2, armLen: 2 * d + f / 2, shoulderW: Wt, hipX, pivots: 8,
      shoulderY, hipY, kneeY, headBottom: hb, torsoTop: tt, stickW: f, stickT: t, reachL: armEnds[0].x, reachR: armEnds[1].x,
    },
    notes: [
      `Figure · ${fmt(H)}" tall: head, torso, two arms and two legs in human proportion (head about 1/7 of the height, legs about half).`,
      `Shoulders, elbows, hips and knees pivot on paper fasteners (8) pushed through a hole drilled where the two members overlap, so the figure poses.`,
      `A stand post glued behind the torso holds it upright on the crossed base; the limbs stay free.`,
    ],
  };
}

export function buildHumanoid(prompt: string, item: CatalogItem, typed0: { width?: number; height?: number; depth?: number }, whole: boolean): TemplateBuild | null {
  const said = typedSizeIn(prompt);
  // Only a typed overall size (stock sizes like "1/4 inch dowel" are not the figure's height).
  const h = said.height ?? said.length;
  void typed0;
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") return null;
  const kind = templateStock(item);
  return humanoidLinear(item, kind === "thin" && whole && isWholeStock(item), h);
}

// ============================================================== registry

export const TEMPLATE_STEPS: Record<TemplateClassId, TemplateStep[]> = {
  "small-house": [
    { role: "wall", word: "wall slat", title: "Build the four walls", why: "Slats side by side, flat against the wall face. Front wall leaves the entrance gap." },
    { role: "batten", word: "batten", title: "Glue the battens across the backs of the walls", why: "They hold each wall together; on the front they close the gap above and below the entrance." },
    { role: "floor", word: "floor stick", title: "Lay the floor inside the walls", why: "The floor squares the box." },
    { role: "rafter", word: "rafter", title: "Set the gable rafters on the front and back walls", why: "Two per end, meeting at the ridge — they set the roof pitch." },
    { role: "roof", word: "roof slat", title: "Lay the roof slats down each slope", why: "Slats run from the ridge to the eave and overhang front and back to keep rain off the entrance." },
    { role: "perch", title: "Glue the perch on the entrance sill", why: "It sticks out in front, just under the entrance." },
    { role: "member", title: "Place remaining members", why: "No floating pieces." },
  ],
  "flat-frame": [
    { role: "rail", word: "rail stick", title: "Glue the top and bottom rails", why: "Rails set the opening width; lapped sticks overlap face to face." },
    { role: "stile", word: "stile stick", title: "Glue the stiles behind the rails", why: "Stiles set the opening height; they lap over the rails at the four corners." },
    { role: "backer", word: "backer bar", title: "Glue the backer bars across the back", why: "They close the back and hold the photo in the opening." },
    { role: "stand", word: "stand stick", title: "Glue the stand behind", why: "One stick from the backer down to the shelf stands the frame up." },
    { role: "member", title: "Place remaining members", why: "No floating pieces." },
  ],
  launcher: [
    { role: "rail", word: "base rail stick", title: "Glue the two base rails", why: "Flat on the bench; whole sticks lap face to face where a rail runs longer than one stick." },
    { role: "tie", word: "tie", title: "Glue the ties across the rails", why: "Front, middle and rear ties square the base. The rear tie is where the cocked arm rests." },
    { role: "leg", word: "A-frame leg", title: "Stand the two A-frames on the rails", why: "Two legs per side meet at the apex. The front leg leans back at the arm's stop angle." },
    { role: "stop", word: "crossbar", title: "Glue the crossbar across the apexes", why: "It ties the A-frames and stops the arm." },
    { role: "support", word: "axle", title: "Glue the pivot axle across the front legs", why: "The arm pivots here." },
    { role: "arm", word: "arm stick", title: "Build the throwing arm and hinge it on the axle", why: "Lap the arm sticks face to face. Hinge the arm over the axle with a rubber band loop so it swings freely." },
    { role: "cup", word: "cup stick", title: "Glue the cup at the arm tip", why: "Three sticks across the tip, two lips on top: the payload cup. Then loop the spring band from the arm over the crossbar." },
    { role: "member", title: "Place remaining members", why: "No floating pieces." },
  ],
  humanoid: [
    { role: "base", word: "base stick", title: "Glue the crossed base", why: "Two sticks front to back on the bench, the rest across on top: the figure stands on it." },
    { role: "shin", word: "shin", title: "Set the two shins on the base", why: "Lower legs, feet on the base." },
    { role: "thigh", word: "thigh", title: "Pivot the thighs on the shins at the knees", why: "The thigh overlaps the top of the shin; the knee bends here.", hold: PIVOT_HOLD },
    { role: "torso", word: "torso row", title: "Glue the torso rows side by side, then pivot the hips", why: "Rows across make the body. The bottom row overlaps the top of each thigh: fasten each hip with a paper fastener (no glue there)." },
    { role: "batten", word: "batten", title: "Glue the two battens down the back of the torso", why: "They tie every row together." },
    { role: "post", word: "stand post", title: "Glue the stand post from the base up behind the torso", why: "It holds the figure upright so the limbs stay free to pose." },
    { role: "arm", word: "upper arm", title: "Pivot the upper arms at the shoulders", why: "The arm end overlaps the top torso row at the corner.", hold: PIVOT_HOLD },
    { role: "forearm", word: "forearm", title: "Pivot the forearms at the elbows", why: "The forearm overlaps the lower end of the upper arm.", hold: PIVOT_HOLD },
    { role: "neck", word: "neck stick", title: "Glue the neck stick behind the torso top", why: "It reaches up past the shoulders and carries the head." },
    { role: "head", word: "head piece", title: "Glue the head pieces side by side on the neck", why: "The head sits just above the shoulders." },
    { role: "member", title: "Place remaining members", why: "No floating pieces." },
  ],
  "platform-tower": [
    { role: "post", word: "post stick", title: "Build the four corner posts", why: "Whole sticks lapped face to face up to the full height." },
    { role: "rail", word: "rail", title: "Glue two rails inside the posts at each platform height", why: "Base, two perches and the top: level rails on both faces." },
    { role: "deck", word: "deck stick", title: "Lay the decking across each pair of rails", why: "Sticks side by side make the platforms the cat stands on." },
    { role: "member", title: "Place remaining members", why: "No floating pieces." },
  ],
};

export function templateSteps(classId: string): TemplateStep[] | null {
  return (TEMPLATE_STEPS as Record<string, TemplateStep[]>)[classId] ?? null;
}

export function buildTemplate(
  id: TemplateClassId,
  prompt: string,
  item: CatalogItem,
  typed: { width?: number; height?: number; depth?: number },
  whole: boolean,
): TemplateBuild | null {
  if (id === "small-house") return buildSmallHouse(prompt, item, typed, whole);
  if (id === "flat-frame") return buildFlatFrame(prompt, item, whole);
  if (id === "launcher") return buildLauncher(prompt, item, typed, whole);
  if (id === "platform-tower") return buildPlatformTower(prompt, item, typed, whole);
  if (id === "humanoid") return buildHumanoid(prompt, item, typed, whole);
  return null;
}

export function detectTemplate(prompt: string): TemplateClassId | null {
  if (isSmallHouse(prompt)) return "small-house";
  if (isFlatFrame(prompt)) return "flat-frame";
  if (isLauncher(prompt)) return "launcher";
  if (isPlatformTower(prompt)) return "platform-tower";
  if (isHumanoid(prompt)) return "humanoid";
  return null;
}


type P3 = { x: number; y: number; z: number };
/** Closest distance between segments p1q1 and p2q2 (3D). */
export function segSegDist(p1: P3, q1: P3, p2: P3, q2: P3): number {
  const sub = (a: P3, b: P3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  if (a <= 1e-9 && e <= 1e-9) return Math.sqrt(dot(r, r));
  if (a <= 1e-9) t = clamp(f / e);
  else {
    const c = dot(d1, r);
    if (e <= 1e-9) s = clamp(-c / a);
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  const c1 = { x: p1.x + d1.x * s, y: p1.y + d1.y * s, z: p1.z + d1.z * s };
  const c2 = { x: p2.x + d2.x * t, y: p2.y + d2.y * t, z: p2.z + d2.z * t };
  const w = sub(c1, c2);
  return Math.sqrt(dot(w, w));
}

export type LaunchSim = { hitRole: string | null; hitDeg: number | null; cockedDeg: number; releaseDir: { x: number; y: number } | null; blockedBy: string | null };

/**
 * Swing the arm + cup rigidly about the axle from the cocked pose toward the front.
 * A real launch: the first thing the moving parts meet is the crossbar (stop), past vertical-back
 * (100°–130°), so the cup's release direction is forward and up. Anything else first = jammed.
 */
export function simulateLaunch(project: YardProject, halfT: number): LaunchSim {
  const P = project.shape?.params ?? {};
  const px = P.pivotX ?? 0, py = P.pivotY ?? 0;
  const moving = project.instances.filter((i) => i.role === "arm" || i.role === "cup");
  const still = project.instances.filter((i) => i.role !== "arm" && i.role !== "cup" && i.role !== "support");
  const rot = (q: P3, d: number) => {
    const c = Math.cos(d), sn = Math.sin(d), x = q.x - px, y = q.y - py;
    return { x: px + x * c - y * sn, y: py + x * sn + y * c, z: q.z };
  };
  const cocked = P.cockedDeg ?? 180;
  for (let deg = -1; deg >= -(cocked - 60); deg -= 0.25) {
    const d = deg * DEG;
    for (const m of moving) {
      const a = rot(m.from!, d), b = rot(m.to!, d);
      for (const st of still) {
        if (segSegDist(a, b, st.from!, st.to!) < 2 * halfT - 0.002) {
          const th = cocked + deg;
          const release = { x: Math.sin(th * DEG), y: -Math.cos(th * DEG) };
          return { hitRole: st.role ?? "?", hitDeg: th, cockedDeg: cocked, releaseDir: release, blockedBy: m.role === "arm" ? null : `${m.role} hit ${st.role}` };
        }
      }
    }
  }
  return { hitRole: null, hitDeg: null, cockedDeg: cocked, releaseDir: null, blockedBy: "nothing stops the arm" };
}

// ============================================================== guard

export type TemplateIssue = { code: string; detail: string };

/** Read the built project back: required parts, class-specific geometry, connected, nothing floating. */
export function inspectTemplate(project: YardProject, prompt = project.prompt ?? ""): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const shape = project.shape;
  if (!shape) return [{ code: "no-shape", detail: `${project.name} has no template class` }];
  const P = shape.params ?? {};
  const roles = new Map<string, YardProject["instances"]>();
  for (const i of project.instances) {
    const r = i.role ?? "member";
    if (!roles.has(r)) roles.set(r, []);
    roles.get(r)!.push(i);
  }
  const ys: number[] = [];
  for (const i of project.instances) for (const q of [i.from, i.to]) if (q) ys.push(q.y);
  for (const p of project.panels) ys.push(p.position.y);
  if (ys.length && Math.min(...ys) > Math.max(0.3, (P.stickT ?? 0) / 2 + 0.05)) issues.push({ code: "floating", detail: `lowest piece ${Math.min(...ys).toFixed(2)}" above the bench` });
  if (project.instances.length) {
    const st = project.buildStats;
    if (!st || st.components !== 1 || st.loose !== 0) issues.push({ code: "connected", detail: JSON.stringify(st) });
  }
  if (shape.classId === "small-house") {
    const typedHole = smallHouseHoleIn(prompt) ?? 1.5;
    if (project.instances.length) {
      const need: [string, number][] = [["wall", 8], ["floor", 3], ["roof", 4], ["rafter", 4], ["batten", 3]];
      for (const [r, n] of need) if ((roles.get(r)?.length ?? 0) < n) issues.push({ code: "missing-part", detail: `${r} ×${roles.get(r)?.length ?? 0}` });
      const walls = roles.get("wall") ?? [];
      const frontZ = Math.max(...walls.map((w) => w.from!.z));
      const front = walls.filter((w) => Math.abs(w.from!.z - frontZ) < 0.01);
      const inGap = front.filter((w) => w.from!.x > (P.openX0 ?? 0) + 0.01 && w.from!.x < (P.openX1 ?? 0) - 0.01);
      if (inGap.length) issues.push({ code: "entrance", detail: `${inGap.length} front slats cross the entrance` });
      const bat = (roles.get("batten") ?? []).filter((b) => b.from!.z > 0 && Math.abs(b.from!.z - b.to!.z) < 0.01);
      if (!bat.some((b) => b.from!.y < (P.openBottom ?? 0)) || !bat.some((b) => b.from!.y > (P.openTop ?? 0))) issues.push({ code: "entrance", detail: "gap not closed above and below the entrance" });
      if (bat.some((b) => b.from!.y > (P.openBottom ?? 0) + 0.01 && b.from!.y < (P.openTop ?? 0) - 0.01)) issues.push({ code: "entrance", detail: "a batten crosses the entrance" });
      const slat = (P.openX1 ?? 0) - (P.openX0 ?? 0);
      const pitch = front.length > 1 ? Math.abs(front[1].from!.x - front[0].from!.x) : 0.5;
      if (Math.abs(slat - typedHole) > pitch * 1.01) issues.push({ code: "entrance", detail: `opening ${slat.toFixed(2)}" vs typed ${typedHole}"` });
      const roofTop = Math.max(...(roles.get("roof") ?? []).flatMap((r) => [r.from!.y, r.to!.y]));
      const wallTop = Math.max(...walls.flatMap((w) => [w.from!.y, w.to!.y]));
      if (!(roofTop > wallTop + 1)) issues.push({ code: "roof", detail: `roof top ${roofTop.toFixed(2)} vs wall top ${wallTop.toFixed(2)}` });
    } else {
      const names = project.panels.map((p) => p.name);
      const need: [string, number][] = [["Front gable", 1], ["Back gable", 1], ["Side wall", 2], ["Floor", 1], ["Roof panel", 2]];
      for (const [n, c] of need) if (names.filter((x) => x === n).length < c) issues.push({ code: "missing-part", detail: n });
      const front = project.panels.find((p) => p.name === "Front gable");
      const hole = front?.polygon?.holes?.[0];
      if (!hole || Math.abs(hole.r * 2 - typedHole) > 1 / 16 + 1e-6) issues.push({ code: "entrance", detail: `hole ${hole ? hole.r * 2 : "none"} vs typed ${typedHole}` });
      const peak = front?.polygon ? Math.max(...front.polygon.pts.map((q) => q[1])) : 0;
      const eave = front?.polygon ? front.polygon.pts.filter((q) => q[0] === 0).reduce((m, q) => Math.max(m, q[1]), 0) : 0;
      if (!(peak > eave + 1)) issues.push({ code: "roof", detail: "front is not a gable" });
      for (const r of project.panels.filter((p) => /roof/i.test(p.name))) if (r.position.y + r.size.height < eave) issues.push({ code: "roof", detail: `${r.name} below the eaves` });
    }
    if (wantsPerch(prompt) && !roles.get("perch")?.length && !project.panels.some((p) => p.name === "Perch")) issues.push({ code: "missing-part", detail: "perch" });
  }
  if (shape.classId === "humanoid") {
    // Every body part present, in human proportion, symmetric, pivots bought, head on top.
    const need: [string, number][] = [["head", 3], ["torso", 3], ["arm", 2], ["forearm", 2], ["thigh", 2], ["shin", 2], ["neck", 1], ["post", 1], ["base", 3]];
    for (const [r, n] of need) if ((roles.get(r)?.length ?? 0) < n) issues.push({ code: "missing-part", detail: `${r} ×${roles.get(r)?.length ?? 0}` });
    const H = P.height ?? 0;
    const ratio = (k: string, lo: number, hi: number) => {
      const v = (P[k] ?? 0) / H;
      if (!(v >= lo && v <= hi)) issues.push({ code: "proportion", detail: `${k}/height ${v.toFixed(2)} outside ${lo}–${hi}` });
    };
    ratio("headH", 0.11, 0.17);
    ratio("legLen", 0.42, 0.58);
    ratio("torsoH", 0.24, 0.34);
    ratio("armLen", 0.35, 0.56);
    ratio("shoulderW", 0.2, 0.34);
    if (!((P.headBottom ?? 0) > (P.torsoTop ?? 0) && (P.torsoTop ?? 0) > (P.hipY ?? 0) && (P.hipY ?? 0) > (P.kneeY ?? 0))) issues.push({ code: "order", detail: "head / torso / hips / knees out of order" });
    if (Math.abs((P.reachL ?? 0) + (P.reachR ?? 0)) > 0.01) issues.push({ code: "symmetry", detail: "arms not mirrored" });
    if ((P.pivots ?? 0) !== 8) issues.push({ code: "pivots", detail: `pivots ${P.pivots}` });
    if (project.instances.length) {
      const topY = Math.max(...project.instances.flatMap((i) => [i.from!.y, i.to!.y]));
      const headTop = Math.max(...(roles.get("head") ?? []).flatMap((i) => [i.from!.y, i.to!.y]));
      if (headTop < topY - 0.01) issues.push({ code: "order", detail: "something sits above the head" });
    }
  }
  if (shape.classId === "platform-tower") {
    const H = P.height ?? 0;
    if (Math.abs((project.overall?.height ?? 0) - H) > 1.5) issues.push({ code: "height", detail: `${project.overall?.height} vs typed ${H}` });
    if (project.instances.length) {
      const levels = new Set((roles.get("deck") ?? []).map((i) => Math.round(i.from!.y)));
      if (levels.size < 4) issues.push({ code: "platforms", detail: `${levels.size} platform levels` });
      if ((roles.get("post") ?? []).length < 4) issues.push({ code: "missing-part", detail: "posts" });
      const postTop = Math.max(...(roles.get("post") ?? []).flatMap((i) => [i.from!.y, i.to!.y]));
      if (postTop < H - 1.5) issues.push({ code: "posts", detail: `posts stop at ${postTop.toFixed(1)}` });
    } else {
      if (project.panels.filter((p) => /platform/i.test(p.name)).length < 4) issues.push({ code: "platforms", detail: "fewer than 4 platforms" });
      if (project.panels.filter((p) => p.name === "Post").length < 4) issues.push({ code: "missing-part", detail: "posts" });
    }
  }
  if (shape.classId === "launcher") {
    const need: [string, number][] = [["rail", 2], ["tie", 3], ["leg", 4], ["stop", 1], ["support", 1], ["arm", 1], ["cup", 3]];
    for (const [r, n] of need) if ((roles.get(r)?.length ?? 0) < n) issues.push({ code: "missing-part", detail: `${r} ×${roles.get(r)?.length ?? 0}` });
    const topOf = (r: string) => Math.max(...(roles.get(r) ?? []).flatMap((i) => [i.from!.y, i.to!.y]));
    const H = Math.max(...project.instances.flatMap((i) => [i.from!.y, i.to!.y]));
    if (!(topOf("tie") < 0.15 * H)) issues.push({ code: "base", detail: `base top ${topOf("tie").toFixed(2)} vs height ${H.toFixed(2)} — not low` });
    // A-frames: each side's two legs meet at the apex and spread at the feet.
    const legs = roles.get("leg") ?? [];
    for (const zs of [1, -1]) {
      const pts = legs.filter((l) => Math.sign(l.from!.z) === zs).flatMap((l) => [l.from!, l.to!]);
      const front = pts.filter((q) => q.x > 0.01), rear = pts.filter((q) => q.x < -0.01), apex = pts.filter((q) => Math.abs(q.x) <= 0.01);
      const topY = Math.max(...pts.map((q) => q.y));
      const lowF = front.reduce((m, q) => (q.y < m.y ? q : m), front[0] ?? { x: 0, y: 0, z: 0 });
      const lowR = rear.reduce((m, q) => (q.y < m.y ? q : m), rear[0] ?? { x: 0, y: 0, z: 0 });
      if (!front.length || !rear.length || apex.length < 2 || Math.abs(Math.max(...apex.map((q) => q.y)) - topY) > 0.01 || lowF.x - lowR.x < 0.5 * (topY - lowF.y)) issues.push({ code: "a-frame", detail: `side ${zs}` });
    }
    const P0 = { x: P.pivotX ?? 0, y: P.pivotY ?? 0 };
    const axle = (roles.get("support") ?? [])[0];
    if (!axle || Math.hypot(axle.from!.x - P0.x, axle.from!.y - P0.y) > 0.01 || Math.abs(axle.from!.z - axle.to!.z) < 1) issues.push({ code: "pivot", detail: "axle not across the frame at the pivot" });
    const cockedDeg = P.cockedDeg ?? 0;
    if (!(cockedDeg > 150 && cockedDeg < 200)) issues.push({ code: "cocked", detail: `arm at ${cockedDeg.toFixed(1)}°` });
    const cups = roles.get("cup") ?? [];
    const armLen = P.armLen ?? 0;
    for (const c of cups) {
      const r = Math.hypot(c.from!.x - P0.x, c.from!.y - P0.y);
      if (r < armLen - 3.6 * (P.stickW ?? 0)) issues.push({ code: "cup", detail: `cup stick at r=${r.toFixed(2)} not at the tip (${armLen.toFixed(2)})` });
    }
    if (!P.rubberBands) issues.push({ code: "spring", detail: "no rubber band spring" });
    const sim = simulateLaunch(project, (P.stickT ?? 0.1) / 2);
    if (sim.hitRole !== "stop" || sim.blockedBy) issues.push({ code: "launch", detail: `arm first meets ${sim.hitRole ?? "nothing"} at ${sim.hitDeg?.toFixed(1)}° ${sim.blockedBy ?? ""}` });
    else if (!(sim.hitDeg! >= 100 && sim.hitDeg! <= 130) || !(sim.releaseDir!.x > 0.5 && sim.releaseDir!.y > 0.1)) issues.push({ code: "launch", detail: `stops at ${sim.hitDeg!.toFixed(1)}°, release ${JSON.stringify(sim.releaseDir)}` });
  }
  if (shape.classId === "flat-frame") {
    const typed = framePhotoIn(prompt);
    const photo = typed.typed ? typed : { w: P.openW ?? 0, h: P.openH ?? 0 };
    if (!typed.typed && !["5x7", "8x10"].includes(`${photo.w}x${photo.h}`)) issues.push({ code: "opening", detail: `untyped photo ${photo.w}×${photo.h} is not a standard print` });
    const near = (a: number, b: number, tol = 0.07) => Math.abs(a - b) <= tol;
    if (project.instances.length) {
      const rails = roles.get("rail") ?? [];
      const stiles = roles.get("stile") ?? [];
      const bars = roles.get("backer") ?? [];
      if (rails.length < 2 || stiles.length < 2) issues.push({ code: "missing-part", detail: `rails ${rails.length} stiles ${stiles.length}` });
      if (bars.length < 2) issues.push({ code: "backer", detail: `backer bars ${bars.length}` });
      for (const i of [...rails, ...stiles, ...bars]) if (!near(i.from!.z, i.to!.z, 0.01) || !i.face) issues.push({ code: "flat", detail: `${i.role} not lying flat in the frame face` });
      const f = ((P.outerW ?? 0) - (P.openW ?? 0)) / 2;
      const sx = stiles.map((i) => i.from!.x);
      const ry = rails.map((i) => i.from!.y);
      // Inner edges: the stick rows nearest the opening (a border may be several sticks side by side).
      const cx = (Math.max(...sx) + Math.min(...sx)) / 2;
      const cy = (Math.max(...ry) + Math.min(...ry)) / 2;
      const rows = (v: number[], c: number) => new Set(v.filter((x) => x > c).map((x) => x.toFixed(3))).size || 1;
      const inner = (v: number[], c: number) => Math.min(...v.filter((x) => x > c)) - Math.max(...v.filter((x) => x < c));
      const gapW = inner(sx, cx) - f / rows(sx, cx);
      const gapH = inner(ry, cy) - f / rows(ry, cy);
      if (!near(gapW, photo.w) || !near(gapH, photo.h)) issues.push({ code: "opening", detail: `opening ${gapW.toFixed(2)}×${gapH.toFixed(2)} vs photo ${photo.w}×${photo.h}` });
      // Corners meet: rails reach across both stiles, stiles reach across both rails.
      const xs = rails.flatMap((i) => [i.from!.x, i.to!.x]);
      const ys2 = stiles.flatMap((i) => [i.from!.y, i.to!.y]);
      if (Math.min(...xs) > Math.min(...sx) + 0.01 || Math.max(...xs) < Math.max(...sx) - 0.01) issues.push({ code: "corner", detail: "rails stop short of the stiles" });
      if (Math.min(...ys2) > Math.min(...ry) + 0.01 || Math.max(...ys2) < Math.max(...ry) - 0.01) issues.push({ code: "corner", detail: "stiles stop short of the rails" });
    } else {
      const rails = project.panels.filter((p) => p.name === "Frame rail");
      const stiles = project.panels.filter((p) => p.name === "Frame stile");
      if (rails.length !== 2 || stiles.length !== 2) issues.push({ code: "missing-part", detail: `rails ${rails.length} stiles ${stiles.length}` });
      if (!project.panels.some((p) => p.name === "Backer")) issues.push({ code: "backer", detail: "no backer" });
      if (stiles.length === 2 && rails.length === 2) {
        const [l, r] = [...stiles].sort((a, b) => a.position.x - b.position.x);
        const [b, t] = [...rails].sort((a, b2) => a.position.y - b2.position.y);
        const gapW = r.position.x - (l.position.x + l.size.width);
        const gapH = t.position.y - (b.position.y + b.size.height);
        if (!near(gapW, photo.w) || !near(gapH, photo.h)) issues.push({ code: "opening", detail: `opening ${gapW}×${gapH} vs photo ${photo.w}×${photo.h}` });
        if (!near(t.size.width, r.position.x + r.size.width - l.position.x) || !near(l.size.height, t.position.y + t.size.height - b.position.y)) issues.push({ code: "corner", detail: "miters do not meet" });
      }
    }
  }
  return issues;
}

/** Template panel names keep their own words on the cut list (not the carcase type alias). */
export function templateCutName(name: string): string | null {
  return /^(?:Front gable|Back gable|Side wall|Roof panel|Perch|Body profile|Frame (?:rail|stile)|Backer|Easel stand|Launcher (?:base|upright|arm)|Cup|Base platform|Top platform|Platform|Post)$/.test(name) ? name : null;
}

type PanelStepSpec = { match: RegExp; title: string; why: string };
const TEMPLATE_PANEL_STEPS: Partial<Record<TemplateClassId, PanelStepSpec[]>> = {
  "flat-frame": [
    { match: /^Frame (rail|stile)$/, title: "Glue and clamp the four mitered members", why: "Dry-fit, then glue the miters and band-clamp; check the diagonals match." },
    { match: /^Backer$/, title: "Drop the photo and backer into the rabbet", why: "Photo, then backer, held with glazier points." },
  ],
  "platform-tower": [
    { match: /^(Base platform|Platform|Top platform)$/, title: "Cut the platforms", why: "Square platforms, one at the base, two perches, one on top." },
    { match: /^Post$/, title: "Screw the four corner posts to the base and platforms", why: "Posts stand at the corners; predrill each screw." },
  ],
  "small-house": [
    { match: /^Front gable$/, title: "Drill the entrance hole in the front gable", why: "Drill before assembly with a spade or Forstner bit, from the face side, backed by scrap so it does not tear out." },
    { match: /^(Side wall|Floor)$/, title: "Screw the side walls to the floor", why: "Floor sits between the side walls, flush at the bottom. Predrill near the ends." },
    { match: /^(Front gable|Back gable)$/, title: "Screw the front and back gables over the ends", why: "The gables cover the side-wall and floor edges; the peaks line up." },
    { match: /^Roof panel$/, title: "Fit the two roof panels on the gable slopes", why: "They meet at the ridge and overhang the front, back and eaves. Leave one side on screws only so it lifts off for cleaning." },
    { match: /^Perch$/, title: "Glue the perch below the entrance", why: "Drill a snug hole below the entrance and glue the perch in." },
  ],
};

export function templatePanelSteps(project: YardProject): { step: number; title: string; description: string; tips?: string; partsUsed?: string[] }[] {
  const spec = project.shape ? TEMPLATE_PANEL_STEPS[project.shape.classId as TemplateClassId] : undefined;
  if (!spec) return [];
  const out: { step: number; title: string; description: string; tips?: string; partsUsed?: string[] }[] = [];
  let n = 1;
  const panels = project.panels;
  const line = (p: Panel) => {
    const b = p.blank;
    const dims = b ? `${fmt(b.lengthIn)}" × ${fmt(b.widthIn)}"` : `${fmt(Math.max(p.size.width, p.size.depth))}" × ${fmt(p.size.height)}"`;
    return `${p.name} ${dims}${p.cutNote ? ` — ${p.cutNote}` : ""}`;
  };
  const seen = new Set<string>();
  out.push({
    step: n++,
    title: `Cut the ${project.name.toLowerCase()} parts`,
    description: panels.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true))).map(line).join(" "),
    tips: "Mark each part with its name as you cut it.",
    partsUsed: [...new Set(panels.map((p) => p.name))],
  });
  for (const s of spec) {
    const used = panels.filter((p) => s.match.test(p.name));
    if (!used.length) continue;
    out.push({ step: n++, title: s.title, description: `${used.map((p) => p.name).filter((x, i, a) => a.indexOf(x) === i).join(", ")}. ${s.why}`, tips: s.why, partsUsed: [...new Set(used.map((p) => p.name))] });
  }
  out.push({ step: n++, title: "Check it square and sand the edges", description: "Sight the corners, ease every edge, and leave it unfinished inside.", tips: "Birds do not like paint inside." });
  return out;
}
