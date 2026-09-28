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

export type TemplateClassId = "small-house" | "flat-frame" | "launcher" | "humanoid";
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

export type TemplateStep = { role: string; title: string; why: string; /** Count noun for the step title ("12 wall slats"). */ word?: string };

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
  "flat-frame": [],
  launcher: [],
  humanoid: [],
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
  return null;
}

export function detectTemplate(prompt: string): TemplateClassId | null {
  if (isSmallHouse(prompt)) return "small-house";
  return null;
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
  if (ys.length && Math.min(...ys) > 0.3) issues.push({ code: "floating", detail: `lowest piece ${Math.min(...ys).toFixed(2)}" above the bench` });
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
  return issues;
}

/** Template panel names keep their own words on the cut list (not the carcase type alias). */
export function templateCutName(name: string): string | null {
  return /^(?:Front gable|Back gable|Side wall|Roof panel|Perch|Body profile|Frame (?:rail|stile)|Backer|Easel stand|Launcher (?:base|upright|arm)|Cup)$/.test(name) ? name : null;
}

type PanelStepSpec = { match: RegExp; title: string; why: string };
const TEMPLATE_PANEL_STEPS: Partial<Record<TemplateClassId, PanelStepSpec[]>> = {
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
