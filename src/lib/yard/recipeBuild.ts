/**
 * Build and validate a recipe (spec 001 R3/R4): every part is a box placed by its shares of the overall
 * size, a typed count repeats the counted parts, and the build passes the standard checks (load path,
 * no closed shell, typed size and count honored, defining roles present) before it is used. A lookup
 * recipe that fails is retried once with the failures fed back; a second failure is a labelled rough shape.
 */
import { learnedRecipeFailures } from "./learnedGate";
import { UNVERIFIED } from "./promptMain";
import { CATALOG_BY_ID, FORGE_CATALOG, getCatalogItem } from "./catalog";
import { boxGap, projectBoxes, CONTACT_GAP } from "./contact";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { findRecipe, lastParseProblem, normalizeNoun, parseRecipe, rememberRecipe, type Recipe, type RecipePart } from "./recipes";
import type { Panel, PanelType, YardProject } from "./types";
import { isOutdoorPrompt } from "./outdoor";
import { CONTACT } from "./materialForUse";

type Size = { width: number; height: number; depth: number };
const CRAFT = new Set(["craft_wood", "cardboard", "paper_tube", "dowel_rod"]);
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

/** Typed sizes: "48 wide", "6 ft tall", and a bare "10x10" read as a plan in feet when the recipe says so. */
export function typedSize(prompt: string, recipe: Recipe): Partial<Size> {
  const lower = prompt.toLowerCase();
  const out: Partial<Size> = {};
  const axis = { wide: "width", long: "width", tall: "height", high: "height", deep: "depth" } as const;
  for (const m of lower.matchAll(/(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|in|inch|inches|")?\s*(wide|long|tall|high|deep)\b/g)) {
    // "48 wide 96 long": with a width typed too, "long" is the other plan side.
    const k = m[3] === "long" && /\d\s*(?:ft|feet|foot|'|in|inch|inches|")?\s*wide\b/.test(lower) ? "depth" : axis[m[3] as keyof typeof axis];
    out[k] = Number(m[1]) * (m[2] && /^(ft|feet|foot|')$/.test(m[2]) ? 12 : 1);
  }
  const pair = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\b(?!\s*x)/);
  if (pair && !/^[124]$/.test(pair[1]) && out.width == null && out.depth == null) {
    const k = recipe.feet ? 12 : 1;
    out.width = Number(pair[1]) * k;
    out.depth = Number(pair[2]) * k;
  }
  // A bare size with no axis word ("window box 30 inches", "12 inch clock") is the object's longest side.
  const bare = !Object.keys(out).length && !pair && lower.match(/\b(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|in|inch|inches|")(?![a-z])/);
  if (bare) {
    const s = recipe.size ?? { width: 1, height: 0, depth: 0 };
    const longest = (["width", "height", "depth"] as const).reduce((a, k) => (s[k] > s[a] ? k : a), "width" as "width" | "height" | "depth");
    out[longest] = Number(bare[1]) * (/^(ft|feet|foot|')$/.test(bare[2]) ? 12 : 1);
  }
  return out;
}

export function typedCount(prompt: string, recipe: Recipe): number {
  if (!recipe.count) return 1;
  const m = prompt.toLowerCase().match(new RegExp(String.raw`\b(\d+|${Object.keys(NUM).join("|")})\s+${recipe.count.word.replace(/s$/, "")}s?\b`));
  const n = m ? (NUM[m[1]] ?? Number(m[1])) : recipe.count.default;
  return Math.max(1, Math.min(12, Math.round(n)));
}

/** Words that name a stock (a size or a material), not only a species ("cedar", "pine"). */
const STOCK_WORD = /\b\d+\s*x\s*\d+\b|plywood|\bply\b|cardboard|popsicle|craft\s+sticks?|dowels?|pvc|\bmdf\b|\bosb\b|bamboo|skewers?|pipe/i;

/**
 * The stock the build is cut from (stockForm rule). A typed stock or a stock switch replaces the skin and
 * board parts; structural parts that name their own section (4x4 posts, 2x12 stringers) keep it. A species
 * alone ("cedar") keeps every recipe stock. Craft stock on a full-size recipe with no craft size is refused:
 * the recipe's own stock builds it and a note says why.
 */
function stockFor(prompt: string, recipe: Recipe, override?: string) {
  const said = override ? getCatalogItem(override) : STOCK_WORD.test(prompt) ? detectMaterial(prompt) : undefined;
  // C15: a size that names a part's own section ("with 4x4 posts" on a bed whose posts are 4x4) is that part's stock,
  // not the whole build's: the boards stay the recipe's (the raised bed's 2x6 courses, as its note says).
  // A species with a footprint ("cedar raised garden bed 4x8") is the species alone: the 4x8 is the bed's size, not a 1x4.
  const speciesOnly = !override && said?.id === "lumber-1x4-8" && !/\b1\s*x\s*4\b/i.test(prompt);
  const typed = !override && said && (speciesOnly || recipe.parts.some((p) => p.stock === said.id)) ? undefined : said;
  let ok = typed && !isWireStock(typed) ? typed : null;
  const craft = !!ok && CRAFT.has(ok.category);
  const big = Math.max(recipe.size.width, recipe.size.height, recipe.size.depth) > 48;
  const refused = craft && !recipe.craftSize && big ? ok : null;
  if (refused) ok = null;
  return {
    member: ok?.id ?? recipe.stock ?? "lumber-2x4-8",
    sheet: ok?.id ?? recipe.sheet ?? recipe.stock ?? "plywood-3-4-4x8",
    craft: !!ok && craft,
    typed: !!ok,
    // Craft stock builds every part; real stock leaves structural sections alone.
    all: !!ok && craft,
    refused: refused ? `${refused.name} can't carry a ${recipe.title.toLowerCase()} this size; it is built in its real stock.` : null,
  };
}

/**
 * Panel types that keep the recipe's own part names on the cut list, steps and Buy (a "Throwing arm",
 * "Counterweight box"), instead of the generic Upright / Top a carcase type would print.
 */
function panelType(p: RecipePart): PanelType {
  if (p.kind === "hardware") return "cleat";
  return p.kind === "member" ? "rail" : "side";
}

/** A moving part's pin (axle, pivot, shaft) is real hardware: a hardwood dowel through its carriers. */
/** A pivot that is a bought mechanism (a Murphy bed's fold bracket, a lift kit) is hardware, never a cut dowel. */
const BOUGHT_MECHANISM = /\b(?:bracket|mechanism|kit|lift|piston|spring)s?\b/i;
const PIN = /\b(?:axle|pivot|shaft|pin|spindle|hinge pin|rod|dowel|peg)s?\b/i;
function pinDowel(memberId: string, section = 9): string {
  const it = getCatalogItem(memberId);
  // A peg no thicker than a 1/4" dowel's section is that dowel, never the member's 1" pin.
  const t = Math.min(it?.dims.thickness ?? it?.dims.height ?? 1.5, it?.dims.width ?? 1.5, it?.dims.diameter ?? 9, section < 0.4 ? section : 9);
  return t >= 1.4 ? "dowel-1-36" : t >= 0.7 ? "dowel-1-2-36" : "dowel-1-4-36";
}

/**
 * A member is one stick of its stock: its cross-section is the stock's section (centred in the recipe box),
 * so an arm reads as one member, not an edge-glued cluster. Parts resting on (or hanging from) a member
 * then settle onto its new face, so every load path still touches.
 */
function snapMembers(recipe: Recipe, panels: Panel[], _memberId: string): Panel[] {
  const byName = new Map(recipe.parts.map((p) => [p.name, p]));
  const base = (n: string) => byName.get(n) ?? byName.get(n.replace(/ \d+$/, ""));
  const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
  const gap = (a: Panel, b: Panel) => Math.max(...AX.map(([x, k]) => Math.max(a.position[x] - (b.position[x] + b.size[k]), b.position[x] - (a.position[x] + a.size[k]))));
  // Load-path pairs that touch now must still touch after every snap.
  const pairs: [number, number][] = [];
  panels.forEach((p, i) => panels.forEach((q, j) => {
    if (i !== j && base(p.name)?.on?.includes(base(q.name)?.name ?? "") && gap(p, q) <= CONTACT_GAP) pairs.push([i, j]);
  }));
  let out = panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  // Members of one role at one height (front and back beam) snap together, so what spans them stays on both.
  const groups = new Map<string, number[]>();
  out.forEach((p, i) => {
    if (base(p.name)?.kind !== "member" || p.polygon || !boardSection(p.materialId, p.size)) return;
    const key = `${base(p.name)?.role}|${p.materialId}|${Math.round(p.position.y * 8)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const order = [...groups.values()].sort((a, b) => out[a[0]].position.y - out[b[0]].position.y);
  for (const group of order) {
    const next = out.map((q) => ({ ...q, position: { ...q.position }, size: { ...q.size } }));
    for (const i of group) {
      const p = out[i];
      // Every lumber member snaps to its own board (the recipe's member stock or a part's named 2x6), never a scaled section.
      const best = closestBoards(p.materialId, p.size, !!base(p.name)?.stock)[0];
      const to = best?.to ?? p.size;
      if (best) next[i].materialId = best.id;
      const top0 = p.position.y + p.size.height;
      for (const [a, k] of AX) {
        // Width and depth centre; height keeps the bottom on what it stands on.
        if (a !== "y") next[i].position[a] += (next[i].size[k] - to[k]) / 2;
        next[i].size[k] = to[k];
      }
      // Parts resting on its top follow it (down when it shrank, up when it grew to the full board).
      const drop = top0 - (next[i].position.y + next[i].size.height);
      // Everything standing above it in its footprint follows (a post on a rail, the top rail, the beads on the rods), and every part resting on it.
      const over = (q: Panel) => q.position.x < p.position.x + p.size.width - 0.01 && q.position.x + q.size.width > p.position.x + 0.01 && q.position.z < p.position.z + p.size.depth - 0.01 && q.position.z + q.size.depth > p.position.z + 0.01;
      if (Math.abs(drop) > 0.001) out.forEach((q, a) => { if (!group.includes(a) && ((q.position.y > p.position.y + p.size.height / 2 && over(q)) || pairs.some(([x, y]) => x === a && y === i && q.position.y > top0 - 0.25 && q.position.y < top0 + CONTACT_GAP))) next[a].position.y = q.position.y - drop; });
    }
    // A part fastened to a member that narrowed by a hair (a 3.6" post to 3 1/2") reaches the hair to stay on it.
    for (const [a, b] of pairs) {
      const g = gap(next[a], next[b]);
      if (group.includes(a) || g <= CONTACT_GAP || g > 0.25) continue;
      for (const [x, k] of AX) {
        const lo = next[b].position[x] - (next[a].position[x] + next[a].size[k]), hi = next[a].position[x] - (next[b].position[x] + next[b].size[k]);
        // Stretch the hair, so a wall between two posts stays on both.
        if (lo > CONTACT_GAP) next[a].size[k] += lo;
        else if (hi > CONTACT_GAP) { next[a].position[x] -= hi; next[a].size[k] += hi; }
      }
    }
    if (pairs.every(([a, b]) => gap(next[a], next[b]) <= CONTACT_GAP)) out = next;
  }
  return out;
}

/**
 * Last word on lumber members placed after the snap (paddles, deck boards): one that is still not a real
 * section is rebound to the catalogue board closest to it and cut to that board's real section, centred.
 */
function realBoards(recipe: Recipe, panels: Panel[]) {
  const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
  const touches = (a: Panel, b: Panel) => Math.max(...AX.map(([x, k]) => Math.max(a.position[x] - (b.position[x] + b.size[k]), b.position[x] - (a.position[x] + a.size[k])))) <= CONTACT_GAP;
  for (const p of panels) {
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (part?.kind !== "member" || p.polygon || !boardSection(p.materialId, p.size)) continue;
    const was = { position: { ...p.position }, size: { ...p.size } };
    const touching = panels.filter((q) => q !== p && touches(p, q));
    for (const o of closestBoards(p.materialId, p.size, !!part.stock)) {
      for (const [a, k] of [["x", "width"], ["z", "depth"]] as const) p.position[a] = was.position[a] + (was.size[k] - o.to[k]) / 2;
      p.size = { ...o.to };
      // Every joint it had stays a joint, or it keeps its box (and the gate says so).
      if (touching.every((q) => touches(p, q))) { p.materialId = o.id; break; }
      Object.assign(p, { position: { ...was.position }, size: { ...was.size } });
    }
  }
}

/**
 * Real boards a lumber member could be cut as, closest first: its own board, or (unless the recipe names
 * the board) another board of the same length as one board thick (a 1.4×0.96 rail is a 1×2, never a 3 1/2" 2×4 face; a 1×4 is never a glued post).
 */
export function closestBoards(materialId: string, size: Panel["size"], named = false): { id: string; to: Panel["size"] }[] {
  // A named board binds when the part is about its face (a 3.6" post is a 4×4); a 5" deck board named "2×4" is re-picked.
  const face = getCatalogItem(materialId)?.dims.width ?? 0;
  if (named && [size.width, size.height, size.depth].sort((a, b) => a - b)[1] > face * 1.1 + 0.05) named = false;
  const len = getCatalogItem(materialId)?.dims.length ?? 96;
  const one = (id: string, to: Panel["size"]) => Math.min(to.width, to.height, to.depth) <= (getCatalogItem(id)?.dims.height ?? 0) + 0.01;
  return FORGE_CATALOG.filter((c) => c.category === "lumber" && c.formFactor === "board" && c.dims.width && c.dims.height && c.dims.length === len)
    .map((b) => ({ id: b.id, to: boardSection(b.id, size) }))
    // A board the recipe names for the part (rafters from 2×6) is kept; only the default member stock is re-picked.
    .filter((o): o is { id: string; to: Panel["size"] } => !!o.to && (o.id === materialId || (!named && one(o.id, o.to))))
    .map((o) => ({ ...o, cost: (["width", "height", "depth"] as const).reduce((n, k) => n + Math.abs(o.to[k] - size[k]), 0), face: getCatalogItem(o.id)!.dims.width! }))
    .sort((x, y) => x.cost - y.cost || y.face - x.face);
}

/**
 * The real section a lumber member is cut to: one board thick (or a deliberate face glue-up of
 * 2+ boards), the board's full face. A big block (more than ~2 boards) is not a member.
 * Returns null when the part is not dimensional lumber or is already a real section.
 */
export function boardSection(materialId: string, size: Panel["size"]): Panel["size"] | null {
  const it = getCatalogItem(materialId);
  const th = it?.dims.height;
  const fw = it?.dims.width;
  if (!it || it.category !== "lumber" || it.formFactor !== "board" || !th || !fw) return null;
  const axes = (["width", "height", "depth"] as const).map((k) => ({ k, v: size[k] })).sort((m, n) => m.v - n.v);
  const [thin, wide] = axes;
  if (thin.v > Math.max(th * 2.2, fw * 1.1) + 0.01 || wide.v > fw * 2.2 + 0.01) return null;
  const out = { ...size };
  // A square stick (4x4 post, 2x2) is the same board both ways.
  if (Math.abs(th - fw) < 0.01) {
    for (const m of [thin, wide]) out[m.k] = th;
  } else {
    // Under 2 boards thick is one board (a 1.8" rafter is a 1 1/2" 2×6); thicker is a glue-up on purpose and keeps its thickness.
    if (thin.v < th * 2) out[thin.k] = th;
    out[wide.k] = fw;
  }
  return axes.every((m) => Math.abs(out[m.k] - size[m.k]) < 0.01) ? null : out;
}

/** Floor footprint (x and z reach of the parts on the floor) and the volume-weighted center of mass. */
export function footprint(panels: Panel[]) {
  const floor = panels.filter((p) => p.position.y < 0.01);
  const ext = (a: "x" | "z", k: "width" | "depth") => floor.length ? [Math.min(...floor.map((p) => p.position[a])), Math.max(...floor.map((p) => p.position[a] + p.size[k]))] : [0, 0];
  let v = 0, cx = 0, cz = 0;
  for (const p of panels) { const w = p.size.width * p.size.height * p.size.depth; v += w; cx += w * (p.position.x + p.size.width / 2); cz += w * (p.position.z + p.size.depth / 2); }
  return { x: ext("x", "width"), z: ext("z", "depth"), com: { x: cx / (v || 1), z: cz / (v || 1) } };
}
/** A build on floor uprights tips when they reach less than half its depth front to back. */
const tippy = (f: ReturnType<typeof footprint>, size: Size) => f.z[1] - f.z[0] < size.depth / 2 - 0.01;
/** Uprights: parts on the floor taller than two stock thicknesses (a low toy on wheels just settles). */
const uprights = (panels: Panel[]) => panels.some((p) => p.position.y < 0.01 && (p.size.height > 3 || /^Foot under /.test(p.name)));
const fmtIn = (n: number) => `${Math.round(n * 8) / 8}"`;

/** Free-standing uprights on a too-narrow footprint get a foot each, the full depth, cut from the member stock. */
function addFeet(recipe: Recipe, panels: Panel[], size: Size, member: string): boolean {
  if (recipe.wall || !uprights(panels) || !tippy(footprint(panels), size)) return false;
  const fh = getCatalogItem(member)?.dims.height ?? 1.5;
  for (const p of panels.filter((q) => q.position.y < 0.01 && q.size.height > fh * 2)) {
    p.position = { ...p.position, y: fh };
    p.size = { ...p.size, height: p.size.height - fh };
    panels.push({ id: `${p.id}-foot`, type: "rail", name: `Foot under ${p.name}`, position: { x: p.position.x, y: 0, z: 0 }, size: { width: p.size.width, height: fh, depth: size.depth }, materialId: member });
  }
  return true;
}

/** Words that name a round part; a learned recipe may not draw one as a plain box. */
export const ROUND_WORD = /\b(?:wheels?|beads?|discs?|disks?|pulleys?|gears?|drums?|rims?|rollers?)\b/i;

/**
 * Round recipe parts become real outlines: a disc or ring faces across its thinnest side, a cylinder or bead
 * runs along its longest; the two cross sides close to one diameter, centred. A bore cuts a centred hole
 * (a ring's rim is its bore width; a bead takes a 3/8 of its diameter bore unless it names one).
 */
/** A part's hole array is drilled in its largest face: an even grid of round holes, rows along the short side. */
function holeArrays(recipe: Recipe, panels: Panel[]): void {
  for (const p of panels) {
    const h = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))?.holes;
    if (!h || p.polygon) continue;
    const { width: w, height: ht, depth: d } = p.size;
    const plane = ht <= w && ht <= d ? "xz" : d <= w ? "xy" : "zy";
    const [a, b] = plane === "xz" ? [w, d] : plane === "xy" ? [w, ht] : [d, ht];
    const [long, short, flip] = a >= b ? [a, b, false] : [b, a, true];
    const rows = Math.max(1, h.rows ?? 1), cols = Math.ceil(h.count / rows), r = Math.min(h.dia, short / (rows + 1), long / (cols + 1)) / 2;
    const holes: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < h.count; i++) {
      const u = (long * ((i % cols) + 1)) / (cols + 1), v = (short * (Math.floor(i / cols) + 1)) / (rows + 1);
      holes.push(flip ? { x: v, y: u, r } : { x: u, y: v, r });
    }
    p.polygon = { plane, pts: [[0, 0], [a, 0], [a, b], [0, b]], holes };
    p.cutNote = `${p.cutNote ? `${p.cutNote} ` : ""}Drill ${h.count} holes, ${fmtIn(r * 2)} diameter, in ${rows} row${rows > 1 ? "s" : ""}.`;
  }
}

/**
 * Curved and stick forms are never solid boxes: a dome or cone part is drawn as one; a leaning pole is a rod
 * from its foot to the top centre (a tipi); a spoke part fans round the wheel centre as rods across the wheel.
 * Each rod keeps its bounding box (so contact checks still hold) and cuts from a blank of its true length.
 */
function curvedParts(recipe: Recipe, panels: Panel[], size: { width: number; height: number; depth: number }): Panel[] {
  const out: Panel[] = [];
  for (const p of panels) {
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (part?.shape === "dome" || part?.shape === "cone") { out.push({ ...p, form: part.shape }); continue; }
    const r = Math.min(p.size.width, p.size.depth, p.size.height) / 2;
    if (part?.lean === "apex") {
      const foot = [p.position.x + p.size.width / 2, p.position.y, p.position.z + p.size.depth / 2];
      const top = [size.width / 2, p.position.y + p.size.height, size.depth / 2];
      const x0 = Math.min(foot[0], top[0]) - r, z0 = Math.min(foot[2], top[2]) - r;
      const len = Math.hypot(top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]);
      out.push({ ...p, position: { x: x0, y: p.position.y, z: z0 }, size: { width: Math.abs(top[0] - foot[0]) + 2 * r, height: p.size.height, depth: Math.abs(top[2] - foot[2]) + 2 * r },
        strut: { a: [foot[0] - x0, 0, foot[2] - z0], b: [top[0] - x0, p.size.height, top[2] - z0], r },
        blank: { lengthIn: len, widthIn: 2 * r, thicknessIn: 2 * r }, cutNote: `Cut ${fmtIn(len)} long; it leans from its foot to meet the others at the top.` });
      continue;
    }
    if (part?.spokes && part.spokes > 1) {
      const n = Math.round(part.spokes), D = Math.max(p.size.width, p.size.height), t = p.size.depth;
      const c = { x: p.position.x + p.size.width / 2, y: p.position.y + p.size.height / 2 };
      const base = p.name.replace(/ \d+$/, "");
      for (let k = 0; k < n; k++) {
        const th = (k * Math.PI) / n, hx = (Math.sin(th) * D) / 2, hy = (Math.cos(th) * D) / 2;
        const w = Math.abs(hx) * 2 + 2 * r, h = Math.abs(hy) * 2 + 2 * r;
        out.push({ ...p, id: `${p.id}-s${k}`, name: `${base} ${k + 1}`, position: { x: c.x - w / 2, y: c.y - h / 2, z: p.position.z }, size: { width: w, height: h, depth: t },
          strut: { a: [w / 2 - hx, h / 2 - hy, t / 2], b: [w / 2 + hx, h / 2 + hy, t / 2], r: Math.min(r, t / 2) },
          blank: { lengthIn: D, widthIn: 2 * r, thicknessIn: t }, cutNote: `Cut ${fmtIn(D)} long; spokes cross at the centre, ${n} round the wheel.` });
      }
      continue;
    }
    out.push(p);
  }
  return out;
}

function roundParts(recipe: Recipe, panels: Panel[]): void {
  const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
  const pins = panels.filter((p) => /^dowel-/.test(p.materialId) && PIN.test(p.name));
  for (const p of panels) {
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (!part?.shape || part.shape === "dome" || part.shape === "cone") continue;
    const by = [...AX].sort((a, b) => p.size[a[1]] - p.size[b[1]]);
    // A bored part on a pin turns about the pin: its bore runs along the pin's length.
    const pin = part.bore || part.shape === "bead" || part.shape === "ring" ? pins.find((q) => q !== p && meets3(p, q)) : undefined;
    const pinAxis = pin && [...AX].sort((a, b) => pin.size[b[1]] - pin.size[a[1]])[0];
    const axis = pinAxis ?? (part.shape === "disc" || part.shape === "ring" ? by[0] : by[2]);
    const cross = AX.filter((a) => a !== axis);
    const dia = Math.min(...cross.map(([, k]) => p.size[k]));
    for (const [a, k] of cross) { p.position = { ...p.position, [a]: p.position[a] + (p.size[k] - dia) / 2 }; p.size = { ...p.size, [k]: dia }; }
    const r = dia / 2, pts: [number, number][] = [];
    for (let i = 0; i < 32; i++) pts.push([r + r * Math.cos((i / 32) * 2 * Math.PI), r + r * Math.sin((i / 32) * 2 * Math.PI)]);
    const hole = part.shape === "ring" ? r - (part.bore ?? dia * 0.12) : part.shape === "bead" ? (part.bore ?? dia * 0.375) / 2 : part.bore ? part.bore / 2 : 0;
    const plane = axis[0] === "y" ? "xz" : axis[0] === "z" ? "xy" : "zy";
    p.polygon = { plane, pts, ...(hole > 0 ? { holes: [{ x: r, y: r, r: hole }] } : {}) };
    p.cutNote = `Cut round, ${fmtIn(dia)} diameter${hole > 0 ? `, ${part.shape === "ring" ? "open centre" : "bored"} ${fmtIn(hole * 2)}` : ""}.`;
  }
}

/**
 * A hinged lid rides free (no screws) on top of the walls under it: its hinge edge sits on the tallest wall, and
 * over walls of two heights (a cold frame) it slopes from the low wall's top up to the tall one's.
 */
/**
 * A hollow vessel (churn, barrel, bucket, tub) is a staved shell, never a solid glue-up: a round body that
 * other parts sit in (a dasher, a lid) becomes a bottom and four ¾" staves around an open cavity.
 */
function hollowVessels(recipe: Recipe): Recipe {
  const VESSEL = /^(?:body|barrel|bucket|tub|vessel|churn|keg|drum|pail|cask|shell)$/;
  let parts = recipe.parts;
  for (const body of recipe.parts.filter((p) => VESSEL.test(p.role) && (p.shape === "cylinder" || p.shape === "ring"))) {
    const [x, y, z, w, h, d] = body.box;
    const inside = recipe.parts.some((q) => q !== body && q.box[0] >= x - 0.01 && q.box[0] + q.box[3] <= x + w + 0.01 && q.box[2] >= z - 0.01 && q.box[2] + q.box[5] <= z + d + 0.01 && q.box[1] < y + h && q.box[1] + q.box[4] > y);
    if (!inside) continue;
    const S = recipe.size, tw = 0.75 / S.width, td = 0.75 / S.depth, th = 0.75 / S.height;
    const n = body.name, on = body.on;
    const shell: Recipe["parts"] = [
      { ...body, name: `${n} bottom`, box: [x, y, z, w, th, d], kind: "panel", shape: undefined, on },
      { ...body, name: `${n} front stave`, box: [x, y + th, z, w, h - th, td], kind: "panel", shape: undefined, on: [`${n} bottom`] },
      { ...body, name: `${n} back stave`, box: [x, y + th, z + d - td, w, h - th, td], kind: "panel", shape: undefined, on: [`${n} bottom`] },
      { ...body, name: `${n} left stave`, box: [x, y + th, z + td, tw, h - th, d - 2 * td], kind: "panel", shape: undefined, on: [`${n} bottom`] },
      { ...body, name: `${n} right stave`, box: [x + w - tw, y + th, z + td, tw, h - th, d - 2 * td], kind: "panel", shape: undefined, on: [`${n} bottom`] },
    ];
    const walls = shell.slice(1).map((p) => p.name);
    parts = parts.flatMap((p) => (p === body ? shell : [{ ...p, on: p.on?.flatMap((o) => (o === n ? walls : [o])) }]));
  }
  return parts === recipe.parts ? recipe : { ...recipe, parts };
}

/**
 * Two legs standing in the same plane and overlapping (a sawbuck's a/b legs drawn as parallel slabs) are an
 * X: each becomes a board running corner to corner, the pair crossing at a half-lap so they sit flush.
 */
function crossLegs(recipe: Recipe, panels: Panel[]): void {
  const legRoles = new Set(recipe.parts.filter((p) => /^(?:leg|x ?leg|trestle)$/.test(p.role)).map((p) => p.name));
  const legs = panels.filter((p) => (legRoles.has(p.name) || legRoles.has(p.name.replace(/ \d+$/, ""))) && !p.polygon && p.position.y < 0.05);
  const over = (a: Panel, b: Panel, ax: "x" | "z", k: "width" | "depth") => a.position[ax] < b.position[ax] + b.size[k] - 0.05 && b.position[ax] < a.position[ax] + a.size[k] - 0.05;
  const used = new Set<Panel>();
  for (const a of legs) {
    if (used.has(a)) continue;
    const b = legs.find((q) => q !== a && !used.has(q) && over(a, q, "x", "width") && over(a, q, "z", "depth"));
    if (!b) continue;
    used.add(a); used.add(b);
    // The X runs along the pair's longer plan side.
    const alongZ = Math.max(a.position.z + a.size.depth, b.position.z + b.size.depth) - Math.min(a.position.z, b.position.z) >= Math.max(a.position.x + a.size.width, b.position.x + b.size.width) - Math.min(a.position.x, b.position.x);
    const [ax, k, cx, ck] = alongZ ? (["z", "depth", "x", "width"] as const) : (["x", "width", "z", "depth"] as const);
    const lo = Math.min(a.position[ax], b.position[ax]), D = Math.max(a.position[ax] + a.size[k], b.position[ax] + b.size[k]) - lo;
    const H = Math.max(a.size.height, b.size.height), w = Math.min(3.5, D / 3), t = 1.5;
    const c = Math.min(a.position[cx], b.position[cx]);
    const plane = alongZ ? "zy" : "xy";
    [a, b].forEach((p, i) => {
      p.position = { ...p.position, [ax]: lo, [cx]: c, y: 0 } as Panel["position"];
      p.size = { ...p.size, [k]: D, [ck]: t, height: H } as Panel["size"];
      p.polygon = { plane, pts: i ? [[D - w, 0], [D, 0], [w, H], [0, H]] : [[0, 0], [w, 0], [D, H], [D - w, H]] };
      p.blank = { lengthIn: Math.round(Math.hypot(D - w, H) * 8) / 8, widthIn: w, thicknessIn: t };
      p.joints = [{ with: (i ? a : b).name, kind: "lap" }];
      p.cutNote = `Cut the ends to the X's angle; half-lap the crossing with the ${(i ? a : b).name} (half the thickness from each) so the pair sits flush.`;
    });
  }
}

/**
 * A tall single pedestal stands on a foot spreading both ways: when every floor part is one strip much
 * narrower than the build is tall, a crossing strip of the same stock is added under the pedestal.
 */
function steadyPedestal(panels: Panel[], size: Size): void {
  const floor = panels.filter((p) => p.position.y < 0.05);
  if (floor.length !== 1 || size.height < 24) return;
  const f = floor[0], narrow = Math.min(f.size.width, f.size.depth), long = Math.max(f.size.width, f.size.depth);
  if (narrow * 3 > size.height || long < narrow * 2) return;
  // Only a single column standing on the strip (a sundial or birdbath pedestal), not a frame on runners.
  const cols = panels.filter((p) => p !== f && Math.abs(p.position.y - (f.position.y + f.size.height)) < 0.1 && p.size.height > size.height / 2);
  if (cols.length !== 1 || Math.max(cols[0].size.width, cols[0].size.depth) > narrow * 1.5) return;
  const cx = f.position.x + f.size.width / 2, cz = f.position.z + f.size.depth / 2;
  const w = f.size.depth, d = f.size.width;
  panels.push({ ...f, id: `${f.id}-cross`, name: `${f.name.replace(/ \d+$/, "")} cross`, position: { x: cx - w / 2, y: f.position.y, z: cz - d / 2 }, size: { width: w, height: f.size.height, depth: d } });
}

/** A gnomon is a right triangle standing on its dial, never a rectangle. */
/**
 * The shapes that define the object are modelled, not left as boxes:
 * - a stringer is notched to the treads it carries (a sawtooth cut from one board, not a solid rectangle);
 * - a part the notes tilt ("Tilt each ramp about 5°") is drawn at that slope, down toward the drop it feeds;
 * - a slatted wall (notes: slatted, breathes, airflow) is separate boards with gaps, not one solid sheet.
 */
export function definingShapes(recipe: Recipe, panels: Panel[]): void {
  const roleOf = (p: Panel) => recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))?.role ?? "";
  const notes = recipe.notes.join(" ");
  // Stringers: the profile steps up under each tread (z, y in the stringer's own frame), underside parallel to the pitch.
  const treads = panels.filter((p) => roleOf(p) === "tread").sort((a, b) => a.position.y - b.position.y);
  for (const s of panels.filter((p) => roleOf(p) === "stringer" && !p.polygon)) {
    const mine = treads.filter((t) => t.position.x < s.position.x + s.size.width && t.position.x + t.size.width > s.position.x);
    if (mine.length < 2) continue;
    const D = s.size.depth, z0 = s.position.z, y0 = s.position.y;
    // Ascending treads: each sits at its own height; the stair climbs toward the end the top tread is at.
    const up = mine[mine.length - 1].position.z < mine[0].position.z ? -1 : 1;
    const loc = (z: number) => (up < 0 ? z - z0 : D - (z - z0));
    const steps = mine.map((t) => {
      const a = loc(t.position.z), b = loc(t.position.z + t.size.depth);
      return { near: Math.max(a, b), far: Math.min(a, b), y: t.position.y - y0 };
    });
    const run = Math.max(...steps.map((q) => q.near - q.far));
    const rise = (steps[steps.length - 1].y - steps[0].y) / (steps.length - 1);
    const tan = rise / Math.max(1, run);
    const top = steps[steps.length - 1].y;
    // Throat: 5" of board left square to the pitch under every notch; the underside runs parallel to the pitch.
    const back = Math.max(0, top - 5 * Math.hypot(1, tan));
    const pts: [number, number][] = [[Math.min(steps[0].near, back / tan), 0], [steps[0].near, 0]];
    for (const q of steps) pts.push([q.near, q.y], [q.far, q.y]);
    if (steps[steps.length - 1].far > 0.01) pts.push([0, top]);
    pts.push([0, back]);
    const poly = up < 0 ? pts : pts.map(([z, y]) => [D - z, y] as [number, number]);
    s.polygon = { plane: "zy", pts: poly };
    const th = getCatalogItem(s.materialId)?.dims.height;
    if (th) s.size = { ...s.size, width: th };
    s.size = { ...s.size, height: Math.max(...poly.map((q) => q[1])) };
    const len = Math.hypot(D, top);
    s.blank = { lengthIn: Math.ceil(len) + 1, widthIn: getCatalogItem(s.materialId)?.dims.width ?? 11.25, thicknessIn: s.size.width };
    s.cutNote = `Notch ${mine.length} steps: ${fmtIn(run)} run and ${fmtIn(mine[1].position.y - mine[0].position.y)} rise each, leaving a 5" throat under every notch.`;
  }
  // Tilt: "Tilt each ramp about 5°" slopes every part of that role down toward the lower part it feeds.
  for (const m of notes.matchAll(/\btilt (?:each|the|every) ([a-z]+?)s? (?:about |by )?(\d+(?:\.\d+)?)\s*°/gi)) {
    const role = m[1].toLowerCase(), t = Math.tan((Number(m[2]) * Math.PI) / 180);
    const lows = panels.filter((p) => !["", role].includes(roleOf(p)) && p.materialId !== "hardware");
    const decks = panels.filter((p) => roleOf(p) === role && !p.polygon && p.size.width > p.size.height * 3);
    const owner = (p: Panel) => decks.find((d) => p !== d && p.name.startsWith(d.name)) ?? p;
    // Each runs down toward the highest part below it that it can feed (a drop, the catch tray); a rail follows its ramp.
    const downRight = new Map(decks.map((d) => {
      const below = lows.filter((q) => q.position.y + q.size.height <= d.position.y + 1).sort((a, b) => b.position.y + b.size.height - (a.position.y + a.size.height))[0];
      return [d, below ? below.position.x + below.size.width / 2 > d.position.x + d.size.width / 2 : true] as const;
    }));
    for (const p of decks) {
      const right = downRight.get(owner(p))!;
      const W = p.size.width, h = p.size.height, fall = W * t;
      p.polygon = { plane: "xy", pts: right ? [[0, fall], [W, 0], [W, h], [0, fall + h]] : [[0, 0], [W, fall], [W, fall + h], [0, h]] };
      p.position = { ...p.position, y: p.position.y - fall };
      p.size = { ...p.size, height: h + fall };
      p.blank = { lengthIn: Math.round(Math.hypot(W, fall) * 8) / 8, widthIn: p.size.depth, thicknessIn: h };
      p.cutNote = `Set it at ${m[2]}°: the ${right ? "right" : "left"} end ${fmtIn(fall)} lower.`;
    }
  }
  // Slatted walls breathe: each solid slat or divider sheet becomes 1×6 boards with 1" gaps.
  if (/slatted|breathes?|airflow|air gaps?/i.test(notes)) {
    const gap = 1;
    const out: Panel[] = [];
    const slatNo = new Map<string, number>();
    for (const p of panels) {
      const role = roleOf(p);
      const own = getCatalogItem(p.materialId);
      // A sheet stays that sheet, ripped into 5 1/2" strips (a plywood skin switch keeps its plywood).
      const sheet = own?.formFactor === "sheet";
      // The wall's own board when it is about the wall's thickness (a 2×6 is never a 1" slat), else 1×6.
      const thin = Math.min(p.size.width, p.size.depth);
      const board = sheet || (own?.category === "lumber" && own.formFactor === "board" && (own.dims.width ?? 0) >= 3.5 && (own.dims.height ?? 9) <= thin + 0.25) ? own! : getCatalogItem("lumber-1x6-8")!;
      const face = sheet ? 5.5 : board.dims.width!, t = sheet ? (board.dims.thickness ?? board.dims.height ?? 0.75) : board.dims.height!;
      if (!(role === "slat" || (role === "divider" && /slatted/i.test(notes))) || p.size.height < face * 2) { out.push(p); continue; }
      const n = Math.max(2, Math.floor((p.size.height + gap) / (face + gap)));
      const thinX = p.size.width < p.size.depth;
      const fam = p.name.replace(/ \d+$/, "");
      for (let i = 0; i < n; i++) out.push({ ...p, id: `${p.id}-s${i}`, name: `${fam} ${(slatNo.get(fam) ?? 0) + i + 1}`, materialId: board.id,
        // Inside the wall's own box: a thicker board never pushes past the outside face.
        position: { ...p.position, y: p.position.y + i * (face + gap), ...(thinX ? { x: Math.min(p.position.x, p.position.x + p.size.width - t) } : { z: Math.min(p.position.z, p.position.z + p.size.depth - t) }) },
        size: thinX ? { width: t, height: face, depth: p.size.depth } : { width: p.size.width, height: face, depth: t } });
      slatNo.set(fam, (slatNo.get(fam) ?? 0) + n);
    }
    panels.splice(0, panels.length, ...out);
  }
}

/**
 * Outdoors, flat parts are exterior boards, never plywood: each plywood tread, riser, wall or slat becomes
 * 5 1/2" boards (2×6 when the part is over 1" thick, else 1×6) inside its own box. Flat (horizontal) boards
 * keep a 1/4" drain gap; upright walls stack tight.
 */
export function exteriorBoards(panels: Panel[]): void {
  const out: Panel[] = [];
  for (const p of panels) {
    const own = getCatalogItem(p.materialId);
    if (!/^plywood/.test(p.materialId) || own?.formFactor !== "sheet" || p.polygon || p.turns || !/\b(?:tread|riser|wall|slats?|seat|deck|step)\b/i.test(p.name)) { out.push(p); continue; }
    const dims = [p.size.width, p.size.height, p.size.depth];
    const thin = Math.min(...dims);
    const sorted = [...dims].sort((m, n) => m - n);
    // Flat parts only: a post or block cut from glued-up sheet is not a board.
    if (thin > 1.6 || (sorted[1] < thin * 2 && sorted[1] > 1.6)) { out.push(p); continue; }
    // A plywood stick (a laminated slat) is a 2×2 outdoors, its underside where it was.
    if (sorted[1] < thin * 2) {
      const sq = getCatalogItem("lumber-2x2-8")!, w = sq.dims.width!;
      const size = { ...p.size };
      for (const k of ["width", "height", "depth"] as const) if (p.size[k] < 1.7) size[k] = w;
      out.push({ ...p, materialId: sq.id, size });
      continue;
    }
    const board = getCatalogItem(thin > 1.1 ? "lumber-2x6-8" : "lumber-1x6-8")!;
    const face = board.dims.width!, t = board.dims.height!;
    const flat = p.size.height === thin;
    // A flat board keeps its underside on its support; an upright one keeps its inner face and grows outward.
    const cx = panels.reduce((m, q) => m + q.position.x + q.size.width / 2, 0) / panels.length;
    const cz = panels.reduce((m, q) => m + q.position.z + q.size.depth / 2, 0) / panels.length;
    // Split across the part's width: the axis that is neither its thickness nor its length.
    const axes = (["x", "y", "z"] as const).map((a, i) => ({ a, k: (["width", "height", "depth"] as const)[i], v: dims[i] }));
    const thick = axes.find((x) => x.v === thin)!;
    const rest = axes.filter((x) => x !== thick).sort((m, n) => m.v - n.v);
    const across = rest[0];
    const gap = flat ? 0.25 : 0;
    const n = Math.max(1, Math.ceil((across.v + gap - 0.01) / (face + gap)));
    const w = n === 1 ? across.v : face;
    for (let i = 0; i < n; i++) {
      const start = i * (w + gap);
      const span = Math.min(w, across.v - start);
      if (span <= 0.25) break;
      // Inside the part's box: a thicker board never pushes past its outer face.
      const mid = thick.a === "x" ? cx : cz;
      const low = !flat && p.position[thick.a] + thin / 2 < mid;
      out.push({ ...p, id: n === 1 ? p.id : `${p.id}-s${i}`, materialId: board.id,
        position: { ...p.position, [across.a]: p.position[across.a] + start, [thick.a]: p.position[thick.a] + (low ? thin - t : 0) },
        size: { ...p.size, [across.k]: span, [thick.k]: t } });
    }
  }
  panels.splice(0, panels.length, ...out);
}

/** The notes ask for this part laminated ("glue two plies for the top"). */
const laminated = (recipe: Recipe, name: string) => recipe.notes.some((n) => /lamin|glue[- ]up|layers|plies/i.test(n) && n.toLowerCase().includes(name.replace(/ \d+$/, "").toLowerCase()));
/** A work or table top doubled to two plies is a real design (a 1 1/2" ply top), not an accidental glue-up. */
const doubledTop = (name: string, thin: number, t: number) => /\b(?:top|tabletop|desktop|counter|worktop|work surface|bench ?top)\b/i.test(name) && Math.abs(thin - 2 * t) < 0.15;
const BLOCK_ROLE = /post|leg|plinth|kick|base|block|beam|foot|feet|toe|stand|gnomon|pedestal|hub|axle|rim/i;

/**
 * A sheet part is one sheet thick: a side, shelf, rail or top modelled thicker than the sheet (a 2" Murphy side,
 * 1 1/2" locker shelves) is cut from one sheet, never glued up in layers. It keeps the face on the build's outside
 * (or its centre when it stands inside), and parts that met its other face stretch to keep meeting it.
 */
export function oneSheetThick(recipe: Recipe, panels: Panel[]): void {
  const env = { x: [Math.min(...panels.map((p) => p.position.x)), Math.max(...panels.map((p) => p.position.x + p.size.width))], y: [Math.min(...panels.map((p) => p.position.y)), Math.max(...panels.map((p) => p.position.y + p.size.height))], z: [Math.min(...panels.map((p) => p.position.z)), Math.max(...panels.map((p) => p.position.z + p.size.depth))] } as Record<"x" | "y" | "z", number[]>;
  const K = { x: "width", y: "height", z: "depth" } as const;
  for (const p of panels) {
    const item = getCatalogItem(p.materialId);
    if (item?.formFactor !== "sheet" || !/^plywood|^mdf|^osb/.test(p.materialId) || p.polygon) continue;
    const role = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))?.role ?? "";
    if (BLOCK_ROLE.test(`${role} ${p.name}`) || laminated(recipe, p.name)) continue;
    const t = item.dims.thickness ?? item.dims.height ?? 0.75;
    const a = (["x", "y", "z"] as const).reduce((m, k) => (p.size[K[k]] < p.size[K[m]] ? k : m), "x" as "x" | "y" | "z");
    const thin = p.size[K[a]];
    const sorted = [p.size.width, p.size.height, p.size.depth].sort((m, n) => m - n);
    if (thin <= t * 1.25 || sorted[1] < thin * 4 || doubledTop(p.name, thin, t)) continue;
    const o0 = p.position[a], o1 = o0 + thin;
    const others = panels.filter((q) => q !== p);
    const across = (q: Panel) => (["x", "y", "z"] as const).filter((k) => k !== a).every((k) => Math.min(q.position[k] + q.size[K[k]], p.position[k] + p.size[K[k]]) - Math.max(q.position[k], p.position[k]) > 0.05);
    // The face on what carries it wins (a bed rail stays on its cabinet side); else any face that meets a part.
    const onNames = new Set(recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))?.on ?? []);
    const carried = others.filter((q) => onNames.has(q.name) || onNames.has(q.name.replace(/ \d+$/, "")));
    const pool = carried.some((q) => across(q) && (Math.abs(q.position[a] + q.size[K[a]] - o0) < 0.03 || Math.abs(q.position[a] - o1) < 0.03)) ? carried : others;
    const touchLo = pool.some((q) => across(q) && Math.abs(q.position[a] + q.size[K[a]] - o0) < 0.03);
    const touchHi = pool.some((q) => across(q) && Math.abs(q.position[a] - o1) < 0.03);
    const atLo = Math.abs(o0 - env[a][0]) < 0.02, atHi = Math.abs(o1 - env[a][1]) < 0.02;
    // Keep the face that meets something (or the outside face); a free-standing inner part keeps its centre.
    const n0 = atLo ? o0 : atHi ? o1 - t : touchLo && !touchHi ? o0 : touchHi && !touchLo ? o1 - t : (o0 + o1 - t) / 2, n1 = n0 + t;
    // A face moved from `from` to `to`: parts that met it follow. One that runs that way stretches to the new face;
    // a panel lying flat against it slides over, and what met its far face follows in turn.
    const follow = (src: Panel, from: number, to: number, seen: Set<Panel>) => {
      const meets = (q: Panel) => (["x", "y", "z"] as const).filter((k) => k !== a).every((k) => Math.min(q.position[k] + q.size[K[k]], src.position[k] + src.size[K[k]]) - Math.max(q.position[k], src.position[k]) > 0.05);
      for (const q of panels) {
        if (q === p || seen.has(q) || !meets(q)) continue;
        const q0 = q.position[a], q1 = q0 + q.size[K[a]];
        const grow = to > from ? Math.abs(q1 - from) < 0.03 : Math.abs(q0 - from) < 0.03;
        // The outside of the build never moves: exact W×D×H.
        if (!grow || Math.abs(q0 - env[a][0]) < 0.02 || Math.abs(q1 - env[a][1]) < 0.02) continue;
        seen.add(q);
        const thinQ = Math.min(q.size.width, q.size.height, q.size.depth) === q.size[K[a]];
        if (!thinQ) {
          if (to < from) q.position = { ...q.position, [a]: to }, q.size = { ...q.size, [K[a]]: q1 - to };
          else q.size = { ...q.size, [K[a]]: to - q0 };
        } else {
          const d = to - from;
          const far = to < from ? q1 : q0;
          q.position = { ...q.position, [a]: q0 + d };
          follow(q, far, far + d, seen);
        }
      }
    };
    if (n1 < o1) follow(p, o1, n1, new Set());
    if (n0 > o0) follow(p, o0, n0, new Set());
    p.position = { ...p.position, [a]: n0 };
    p.size = { ...p.size, [K[a]]: t };
  }
}

/** Gate: sheet parts modelled thicker than one sheet (a glue-up nobody asked for). */
export function glueUpFailures(recipe: Recipe, panels: Panel[]): string[] {
  const out: string[] = [];
  for (const p of panels) {
    const item = getCatalogItem(p.materialId);
    if (item?.formFactor !== "sheet" || !/^plywood|^mdf|^osb/.test(p.materialId) || p.polygon) continue;
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (BLOCK_ROLE.test(`${part?.role ?? ""} ${p.name}`) || laminated(recipe, p.name)) continue;
    const t = item.dims.thickness ?? item.dims.height ?? 0.75;
    const d = [p.size.width, p.size.height, p.size.depth].sort((m, n) => m - n);
    if (d[0] > t * 1.25 && d[1] >= d[0] * 4 && !doubledTop(p.name, d[0], t)) out.push(`${p.name} is ${Math.round(d[0] * 100) / 100}" thick: one ${item.name}, not a glue-up`);
  }
  return out;
}

const LOAD_ROLE = /^(?:deck|shelf|tread|seat|slat|floor|platform|top)$/;

/** Carriers a load-bearing board rests on: its "on" parts whose top meets its underside. */
function bearers(recipe: Recipe, panels: Panel[], p: Panel): Panel[] {
  const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
  if (!part || !LOAD_ROLE.test(part.role ?? "") || !part.on?.length) return [];
  const on = new Set(part.on);
  // Rails, cleats and joists that run across the board's length (a parallel rail along its edge is a fascia, a leg is a corner).
  const pLong = p.size.width >= p.size.depth ? "x" : "z";
  return panels.filter((c) => {
    if (c === p || !(on.has(c.name) || on.has(c.name.replace(/ \d+$/, ""))) || Math.abs(c.position.y + c.size.height - p.position.y) >= 0.15) return false;
    const role = recipe.parts.find((q) => q.name === c.name || q.name === c.name.replace(/ \d+$/, ""))?.role ?? "";
    // (A notched stringer carries its treads in the notch.)
    if (!/rail|cleat|joist|apron|bearer|ledger|frame/i.test(`${role} ${c.name}`) || /stringer/i.test(`${role} ${c.name}`)) return false;
    const cLong = c.size.width >= c.size.depth ? "x" : "z";
    return cLong !== pLong;
  });
}

const span = (p: Panel, a: "x" | "z") => [p.position[a], p.position[a] + (a === "x" ? p.size.width : p.size.depth)] as const;
/** How far a board bears on a carrier, measured along the axis the carrier runs across (its narrow plan side). */
function bearing(p: Panel, c: Panel): { a: "x" | "z"; got: number; need: number } | null {
  const a = c.size.width <= c.size.depth ? "x" : "z", o = a === "x" ? "z" : "x";
  const [p0, p1] = span(p, a), [c0, c1] = span(c, a), [q0, q1] = span(p, o), [d0, d1] = span(c, o);
  if (Math.min(q1, d1) - Math.max(q0, d0) <= 0.05) return null;
  return { a, got: Math.min(p1, c1) - Math.max(p0, c0), need: Math.min(1.5, c1 - c0) - 0.01 };
}

/**
 * Load-bearing boards sit ON their rails or cleats: a deck board, shelf or tread that only meets a carrier's
 * edge (held by end screws) is lengthened to run across the carrier's full width.
 */
export function bearOnCarriers(recipe: Recipe, panels: Panel[]): void {
  for (const p of panels) {
    for (const c of bearers(recipe, panels, p)) {
      const b = bearing(p, c);
      if (!b || b.got >= b.need) continue;
      const k = b.a === "x" ? "width" : "depth";
      const [p0, p1] = span(p, b.a), [c0, c1] = span(c, b.a);
      const long = p.size[k] >= Math.max(p.size.width, p.size.depth) - 0.01;
      if (long) {
        // Along its length the board runs on across the carrier.
        const lo = Math.min(p0, c0), hi = Math.max(p1, c1);
        p.position = { ...p.position, [b.a]: lo };
        p.size = { ...p.size, [k]: hi - lo };
      }
    }
  }
  // A post that rises through a board it now carries stops under it: the deck sits on the post tops.
  for (const p of panels) {
    if (!bearers(recipe, panels, p).length) continue;
    for (const post of panels.filter((q) => /\bpost\b/i.test(q.name) && q.position.y < p.position.y && q.position.y + q.size.height > p.position.y + 0.01)) {
      const ox = Math.min(span(p, "x")[1], span(post, "x")[1]) - Math.max(span(p, "x")[0], span(post, "x")[0]);
      const oz = Math.min(span(p, "z")[1], span(post, "z")[1]) - Math.max(span(p, "z")[0], span(post, "z")[0]);
      if (ox > 0.05 && oz > 0.05) post.size = { ...post.size, height: p.position.y - post.position.y };
    }
  }
}

/** Gate: load-bearing boards that bear on a carrier by less than its width (up to 1 1/2"). */
export function bearingFailures(recipe: Recipe, panels: Panel[]): string[] {
  const out: string[] = [];
  for (const p of panels) for (const c of bearers(recipe, panels, p)) {
    const b = bearing(p, c);
    if (b && b.got < b.need) out.push(`${p.name} bears ${Math.max(0, Math.round(b.got * 16) / 16)}" on ${c.name}: sit it on the rail, not end screws`);
  }
  return out;
}

function gnomonTriangles(panels: Panel[]): void {
  for (const g of panels.filter((p) => /\bgnomon\b/i.test(p.name) && !p.polygon)) {
    const H = g.size.height;
    g.polygon = g.size.width <= g.size.depth
      ? { plane: "zy", pts: [[0, 0], [g.size.depth, 0], [0, H]] }
      : { plane: "xy", pts: [[0, 0], [g.size.width, 0], [0, H]] };
  }
}

/**
 * A trestle's leg is a wide upright, not a single 2x4 post: each tall leg under the top is at least a
 * fifth of the table's depth across and 3" thick (boards glued face to face), centred where it stood.
 */
function trestleLegs(recipe: Recipe, panels: Panel[], size: Size): void {
  const legs = new Set(recipe.parts.filter((p) => /^(?:leg|post|trestle|upright|pedestal)$/.test(p.role)).map((p) => p.name));
  for (const p of panels.filter((q) => (legs.has(q.name) || legs.has(q.name.replace(/ \d+$/, ""))) && q.size.height > size.height / 2)) {
    const across = size.depth / 5, thick = 3;
    const cx = p.position.x + p.size.width / 2, cz = p.position.z + p.size.depth / 2;
    // The widest 2x board that covers the face (2x6, 2x8, 2x10), so the cut list never asks a 2x4 for 7".
    const board = [["lumber-2x6-8", 5.5], ["lumber-2x8-8", 7.25], ["lumber-2x10-8", 9.25]].find(([, f]) => (f as number) >= Math.max(p.size.depth, across)) ?? ["lumber-2x10-8", 9.25];
    const w = Math.max(p.size.width, thick), d = board[1] as number;
    if (/^lumber-2x/.test(p.materialId)) p.materialId = board[0] as string;
    p.size = { ...p.size, width: w, depth: d };
    p.position = { ...p.position, x: cx - w / 2, z: cz - d / 2 };
  }
}

/** True where two plain boxes share more than 1/16" of space on every axis. */
const sharesSpace = (a: Panel, b: Panel) => (["x", "y", "z"] as const).every((k, n) => {
  const s = (["width", "height", "depth"] as const)[n];
  return Math.min(a.position[k] + a.size[s], b.position[k] + b.size[s]) - Math.max(a.position[k], b.position[k]) > 1 / 16;
});

/**
 * Real joints where recipe parts meet inside each other: a butt hinge's leaf is mortised flush into the lid and the
 * board it hangs on; a shelf that runs to the corner posts (a utility cart) is notched around each post.
 */
function seatHardwareAndNotches(panels: Panel[]): void {
  for (const h of panels.filter((p) => /\bhinge \d+$/i.test(p.name))) {
    for (const o of panels) if (o !== h && !/\bhinge \d+$/i.test(o.name) && sharesSpace(h, o)) h.joints = [...(h.joints ?? []), { with: o.id, kind: "mortise" }];
  }
  const posts = panels.filter((p) => /\bpost$/i.test(p.name));
  for (const sh of panels.filter((p) => /\bshelf$/i.test(p.name))) {
    const hit = posts.filter((q) => sharesSpace(sh, q));
    if (!hit.length) continue;
    sh.joints = [...(sh.joints ?? []), ...hit.map((q) => ({ with: q.id, kind: "notch" as const }))];
    const q = hit[0];
    sh.cutNote = `${sh.cutNote ? sh.cutNote + " " : ""}Notch ${hit.length === 4 ? "each corner" : `${hit.length} corners`} ${fmtIn(q.size.width)} × ${fmtIn(q.size.depth)} so it fits around the posts.`;
  }
}

function hingedLids(recipe: Recipe, panels: Panel[], H: number): void {
  // Only a hinged lid is seated (a hinged gate or door swings sideways and is never a lid) and sloped; a loose lid (a churn's) stays where the recipe put it.
  const lids = new Set((recipe.moving ?? []).filter((m) => m.motion === "hinge" && !/\b(?:gates?|doors?)\b/i.test(m.part)).map((m) => m.part));
  for (const lid of panels.filter((p) => lids.has(p.name) || lids.has(p.name.replace(/ \d+$/, "")))) {
    lid.turns = true;
    const under = panels.filter((w) => !lids.has(w.name) && !lids.has(w.name.replace(/ \d+$/, "")) && !/\bhinges?\b/i.test(w.name) && w.size.height > 1 && Math.min(w.size.width, w.size.depth) >= 0.2 &&
      w.position.x < lid.position.x + lid.size.width && lid.position.x < w.position.x + w.size.width &&
      w.position.z < lid.position.z + lid.size.depth && lid.position.z < w.position.z + w.size.depth);
    // C13: a part with another part on top of it (a lower course of a stacked wall, a floor cleat) carries that part, not the lid.
    const covered = (w: Panel) => panels.some((q) => q !== w && q !== lid && q.position.y >= w.position.y + w.size.height - 0.1 && q.position.y <= w.position.y + w.size.height + 1 &&
      q.position.x < w.position.x + w.size.width && w.position.x < q.position.x + q.size.width && q.position.z < w.position.z + w.size.depth && w.position.z < q.position.z + q.size.depth);
    // An inside divider (a jewelry box's ring row) sits below the lid and never seats or slopes it.
    under.splice(0, under.length, ...under.filter((w) => !covered(w) && !/\b(?:divider|partition)s?\b/i.test(w.name)));
    if (!under.length) continue;
    const top = (w: Panel) => w.position.y + w.size.height;
    const hi = under.reduce((m, w) => (top(w) > top(m) ? w : m)), lo = under.reduce((m, w) => (top(w) < top(m) ? w : m));
    // A lid floating above the walls is left for the load-path check; one sunk into them is seated.
    if (lid.position.y > top(hi) + 0.1) continue;
    const t = Math.min(lid.size.height, 1);
    // The lid stays inside the overall height: walls reaching above H - t are trimmed to carry it.
    for (const w of under) if (top(w) > H - t) w.size = { ...w.size, height: Math.max(H - t - w.position.y, 0.5) };
    const rise = top(hi) - top(lo), D = lid.size.depth;
    // Any rise slopes the lid so it rests on the low wall too (a lap desk's front never floats).
    // A growing frame's lid is glazed (clear acrylic or polycarbonate), never a solid board.
    if (/\b(?:cold\s*frame|green\s*house|hot\s*bed|cloche|propagator)\b/i.test(recipe.title) && getCatalogItem("acrylic-sheet")) {
      lid.materialId = "acrylic-sheet";
      lid.cutNote = "Clear glazing: acrylic or twin-wall polycarbonate, cut to the lid size.";
    }
    if (rise <= 0.1) { lid.position = { ...lid.position, y: top(hi) }; lid.size = { ...lid.size, height: t }; continue; }
    lid.position = { ...lid.position, y: top(lo) };
    lid.size = { ...lid.size, height: rise + t };
    const backHigh = hi.position.z + hi.size.depth / 2 < lo.position.z + lo.size.depth / 2;
    const [y0, yD] = backHigh ? [rise, 0] : [0, rise];
    lid.polygon = { plane: "zy", pts: [[0, y0], [0, y0 + t], [D, yD + t], [D, yD]] };
    // Cut from a flat blank as long as the slope: never a glue-up of the sloped bounding box.
    lid.blank = { lengthIn: Math.round(lid.size.width * 8) / 8, widthIn: Math.round(Math.hypot(D, rise) * 8) / 8, thicknessIn: t };
    // The other walls clamp under the slope: their tops follow the lid's underside, never through it.
    const under0 = top(lo), z0 = lid.position.z;
    const yAt = (z: number) => under0 + y0 + ((yD - y0) * Math.min(Math.max((z - z0) / D, 0), 1));
    for (const w of under.filter((q) => q !== hi && q !== lo)) {
      const ya = yAt(w.position.z) - w.position.y, yb = yAt(w.position.z + w.size.depth) - w.position.y;
      if (top(w) <= Math.min(ya, yb) + w.position.y + 0.01) continue;
      w.size = { ...w.size, height: Math.max(ya, yb) };
      w.polygon = { plane: "zy", pts: [[0, 0], [w.size.depth, 0], [w.size.depth, yb], [0, ya]] };
      w.blank = { lengthIn: Math.round(w.size.depth * 8) / 8, widthIn: Math.round(w.size.height * 8) / 8, thicknessIn: Math.round(w.size.width * 8) / 8 };
    }
  }
}

type Ax = "x" | "y" | "z";
const SZ = { x: "width", y: "height", z: "depth" } as const;
const meets3 = (p: Panel, q: Panel) => (["x", "y", "z"] as const).every((a) => p.position[a] <= q.position[a] + q.size[SZ[a]] + 0.05 && q.position[a] <= p.position[a] + p.size[SZ[a]] + 0.05);

/**
 * A spinning wheel is a rotor, built the way a real one is (a garden water wheel, a mill wheel):
 * - every fixed part the axle passes is drilled for it; the axle is glued in those snug bores and the rotor
 *   turns on it, each of its bores 1/16" over the axle;
 * - each rim (a ring) has a hub disc in its open centre, sandwiched between two crossed spokes, one on each
 *   face of the rim, so every spoke lies on the rim's face (never in its plane) and meets the hub face to face;
 * - paddles run between the two rims (or stand on a lone rim's face), butted to the rims' inner faces across
 *   the band and standing out past the rim edge, spaced round the wheel clear of the spokes;
 * - the rotor sits centred between the parts that carry the axle, held there by collars glued to the axle
 *   a card's thickness (1/32") off its faces, so it turns but can't slide along the axle.
 * Every joint is a real contact (the step text and the support graph read the same geometry).
 */
function rotors(recipe: Recipe, panels: Panel[], pins: Panel[]): void {
  // Every dowel sits in drilled holes: each fixed part it meets is drilled for it.
  for (const pin of pins) {
    const L = (["x", "y", "z"] as const).reduce((m, a) => (pin.size[SZ[a]] > pin.size[SZ[m]] ? a : m), "x" as Ax);
    const dia = Math.min(...(["x", "y", "z"] as const).filter((x) => x !== L).map((x) => pin.size[SZ[x]]));
    const name = pin.name.replace(/ \d+$/, "").toLowerCase();
    // One axle is "the axle"; a family of rods is "each rod".
    const many = pins.filter((q) => q.name.replace(/ \d+$/, "").toLowerCase() === name).length > 1;
    for (const q of panels.filter((p) => !p.turns && p !== pin && !/^dowel-/.test(p.materialId) && meets3(p, pin))) {
      const deep = Math.round(Math.min(0.75, q.size[SZ[L]] * 0.6) * 16) / 16;
      const through = pin.position[L] < q.position[L] - 0.05 && pin.position[L] + pin.size[SZ[L]] > q.position[L] + q.size[SZ[L]] + 0.05;
      // A hole keeps at least half its diameter of wood on every side across the pin.
      for (const x of (["x", "y", "z"] as const).filter((x) => x !== L)) {
        const c = pin.position[x] + pin.size[SZ[x]] / 2, lo0 = Math.min(q.position[x], c - dia), hi0 = Math.max(q.position[x] + q.size[SZ[x]], c + dia);
        q.position = { ...q.position, [x]: lo0 };
        q.size = { ...q.size, [SZ[x]]: hi0 - lo0 };
      }
      // A fixed bore is named: the axle a rotor spins on is glued snug here, only the rotor's bores clear it.
      const n = `Drill a ${fmtIn(dia)} hole for ${many ? `each ${name}` : `the ${name}`}${through ? ", right through" : `, ${fmtIn(deep)} deep`}.${pin.turns && panels.some((r) => r.turns && r.polygon && r !== pin && meets3(r, pin)) ? ` A snug fixed bore: glue the ${name} here.` : ""}`;
      // The dowel runs into its hole: it reaches into a part at either end by the hole depth.
      const lo = pin.position[L], hi = lo + pin.size[SZ[L]];
      if (!(q.cutNote ?? "").includes(n)) q.cutNote = `${q.cutNote ? `${q.cutNote} ` : ""}${n}`;
      if (through) continue;
      if (q.position[L] >= hi - 0.05) pin.size = { ...pin.size, [SZ[L]]: pin.size[SZ[L]] + deep };
      else if (q.position[L] + q.size[SZ[L]] <= lo + 0.05) { pin.position = { ...pin.position, [L]: lo - deep }; pin.size = { ...pin.size, [SZ[L]]: pin.size[SZ[L]] + deep }; }
    }
  }
  for (const pin of pins.filter((p) => p.turns)) {
    const long = (["x", "y", "z"] as const).reduce((m, a) => (pin.size[SZ[a]] > pin.size[SZ[m]] ? a : m), "x" as Ax);
    const [a, b] = (["x", "y", "z"] as const).filter((x) => x !== long);
    const ca = pin.position[a] + pin.size[SZ[a]] / 2, cb = pin.position[b] + pin.size[SZ[b]] / 2;
    const riders = panels.filter((p) => p.turns && p !== pin && p.polygon && meets3(p, pin));
    const d = pin.size[SZ[a]];
    const bore = d / 2 + 1 / 32;
    // Only the glued-up rotor turns: each part bored for the axle clears it by 1/16".
    for (const p of riders) {
      p.position = { ...p.position, [a]: ca - p.size[SZ[a]] / 2, [b]: cb - p.size[SZ[b]] / 2 };
      const h = p.polygon?.holes?.[0];
      if (h && h.r < d) h.r = Math.max(h.r, bore);
      if (h) p.cutNote = (p.cutNote ?? "").replace(/(bored) [\d./]+"?/, `$1 ${fmtIn(h.r * 2)} (running clearance on the ${fmtIn(d)} ${pin.name.replace(/ \d+$/, "").toLowerCase()})`);
    }
    const isRim = (p: Panel) => recipe.parts.some((q) => q.shape === "ring" && (q.name === p.name || q.name === p.name.replace(/ \d+$/, "")));
    const rims = riders.filter(isRim).sort((p, q) => p.position[long] - q.position[long]);
    if (!rims.length) continue;
    const axleWord = pin.name.replace(/ \d+$/, "").toLowerCase();
    const plane = rims[0].polygon!.plane;
    // The rim's face plane: (u, v) are its outline coordinates, the axle runs along `long`.
    const [ua, va] = plane === "xz" ? (["x", "z"] as const) : plane === "xy" ? (["x", "y"] as const) : (["z", "y"] as const);
    const cu = ua === a ? ca : cb, cv = va === a ? ca : cb;
    // The wheel turns clear of the fixed parts under it (a cross rail between the posts): its paddles sweep
    // 1 1/2" past the rim, so a rim too big for the room under the axle is cut smaller.
    if (a === "y" || b === "y") {
      const cy = a === "y" ? ca : cb;
      const span0 = [Math.min(...rims.map((p) => p.position[long])), Math.max(...rims.map((p) => p.position[long] + p.size[SZ[long]]))];
      const under = panels.filter((p) => !p.turns && p !== pin && !/^dowel-/.test(p.materialId) && !meets3(p, pin) && p.position.y + p.size.height < cy && p.position[long] < span0[1] && p.position[long] + p.size[SZ[long]] > span0[0]);
      const room = cy - Math.max(0, ...under.map((p) => p.position.y + p.size.height)) - 0.5 - 1.5;
      const r0 = rims[0].size[SZ[a]] / 2;
      if (room > 2 && r0 > room) {
        const k = room / r0;
        for (const rim of rims) {
          const pl = rim.polygon!, [pu, pv] = pl.plane === "xz" ? (["x", "z"] as const) : pl.plane === "xy" ? (["x", "y"] as const) : (["z", "y"] as const);
          const su = rim.size[SZ[pu]], sv = rim.size[SZ[pv]];
          rim.polygon = { ...pl, pts: pl.pts.map(([u, v]) => [su / 2 + (u - su / 2) * k, sv / 2 + (v - sv / 2) * k] as [number, number]), holes: pl.holes?.map((h) => ({ x: su / 2 + (h.x - su / 2) * k, y: sv / 2 + (h.y - sv / 2) * k, r: h.r * k })).map((h) => ({ ...h, x: h.x - (su - su * k) / 2, y: h.y - (sv - sv * k) / 2 })) };
          rim.polygon = { ...rim.polygon, pts: rim.polygon.pts.map(([u, v]) => [u - (su - su * k) / 2, v - (sv - sv * k) / 2] as [number, number]) };
          rim.position = { ...rim.position, [pu]: rim.position[pu] + (su - su * k) / 2, [pv]: rim.position[pv] + (sv - sv * k) / 2 };
          rim.size = { ...rim.size, [SZ[pu]]: su * k, [SZ[pv]]: sv * k };
          rim.cutNote = (rim.cutNote ?? "").replace(/^Cut round, [^.]*(?:\.\d+[^.]*)*\./, `Cut round, ${fmtIn(su * k)} diameter, open centre ${fmtIn(2 * (rim.polygon!.holes?.[0]?.r ?? 0))}.`);
        }
      }
    }
    const r = rims[0].size[SZ[a]] / 2, inner = rims[0].polygon?.holes?.[0]?.r ?? r * 0.8;
    const t = rims[0].size[SZ[long]];
    const band = Math.min(Math.max(r - inner, 1.5), 3.5);
    const sheet = rims[0].materialId;
    const ply = getCatalogItem(sheet)?.dims.thickness ?? t;
    const clear = 1 / 16;
    // The parts that carry the axle (posts, frame sides), nearest the rotor on each side.
    const mid0 = (rims[0].position[long] + rims[rims.length - 1].position[long] + t) / 2;
    const carriers = panels.filter((p) => !p.turns && p !== pin && !/^dowel-/.test(p.materialId) && meets3(p, pin));
    const stopLo = carriers.filter((p) => p.position[long] + p.size[SZ[long]] <= mid0).sort((p, q) => q.position[long] + q.size[SZ[long]] - (p.position[long] + p.size[SZ[long]]))[0];
    const stopHi = carriers.filter((p) => p.position[long] >= mid0).sort((p, q) => p.position[long] - q.position[long])[0];
    const faceLo = stopLo ? stopLo.position[long] + stopLo.size[SZ[long]] : undefined, faceHi = stopHi?.position[long];
    const mid = faceLo != null && faceHi != null ? (faceLo + faceHi) / 2 : mid0;
    const paddle = recipe.parts.find((q) => q.role === "paddle");
    const tmpl = paddle && panels.find((p) => p.name === paddle.name || p.name.replace(/ \d+$/, "") === paddle.name);
    // Rotor width along the axle: spoke, rim, paddles, rim, spoke. With carriers both sides it fills the span
    // less a one-ply collar and 1/16" running clearance at each end.
    const two = rims.length >= 2;
    const span = faceLo != null && faceHi != null ? faceHi - faceLo : undefined;
    const fixedPaddle = tmpl ? Math.max(tmpl.size[SZ[long]], t * 4) : 0;
    const between = two ? Math.max(3, span != null ? span - 2 * (ply + clear) - 2 * (2 * t) : Math.max(fixedPaddle, rims[rims.length - 1].position[long] - rims[0].position[long] - t)) : 0;
    const width = two ? 2 * (2 * t) + between : 3 * t;
    const lo = mid - width / 2;
    // Rims: the first and last bound the paddles; any between are spaced evenly.
    const rimLo = rims.map((_, i) => (rims.length === 1 ? lo + t : lo + t + (i * (width - 3 * t)) / (rims.length - 1)));
    rims.forEach((rim, i) => { rim.position = { ...rim.position, [long]: rimLo[i] }; });
    // Hubs: the recipe's hub, one per rim, in the rim's open centre and as thick as the rim.
    const hubs0 = riders.filter((p) => !isRim(p) && p.size[SZ[a]] < r);
    const hubDia = Math.min(Math.max(hubs0[0]?.size[SZ[a]] ?? 4 * d, 3 * d, band + 0.5), 2 * inner - 1);
    const hubName = (hubs0[0]?.name ?? "Hub").replace(/ \d+$/, "");
    const keep0 = new Set(hubs0);
    panels.splice(0, panels.length, ...panels.filter((p) => !keep0.has(p) || p === hubs0[0]));
    const disc = (dia: number, hole: number): Panel["polygon"] => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 32; i++) pts.push([dia / 2 + (dia / 2) * Math.cos((i / 32) * 2 * Math.PI), dia / 2 + (dia / 2) * Math.sin((i / 32) * 2 * Math.PI)]);
      return { plane, pts, holes: [{ x: dia / 2, y: dia / 2, r: hole }] };
    };
    const box = (alongLong: [number, number], u: [number, number], v: [number, number]) => {
      const pos = { x: 0, y: 0, z: 0 }, size = { width: 0, height: 0, depth: 0 };
      pos[long] = alongLong[0]; size[SZ[long]] = alongLong[1];
      pos[ua] = u[0]; size[SZ[ua]] = u[1];
      pos[va] = v[0]; size[SZ[va]] = v[1];
      return { position: pos, size };
    };
    const hubBits = rims.map((rim, i) => {
      const h: Panel = {
        ...(i === 0 && hubs0[0] ? hubs0[0] : {}), id: i === 0 && hubs0[0] ? hubs0[0].id : `${rim.id}-hub-${i}`, type: "rail", name: rims.length > 1 ? `${hubName} ${i + 1}` : hubName,
        materialId: sheet, turns: true, polygon: disc(hubDia, bore),
        ...box([rim.position[long], t], [cu - hubDia / 2, hubDia], [cv - hubDia / 2, hubDia]),
        cutNote: `Cut round, ${fmtIn(hubDia)} diameter, bored ${fmtIn(bore * 2)} (running clearance on the ${fmtIn(d)} ${axleWord}). It sits in the rim's open centre, as thick as the rim, between the two spokes.`,
      };
      return h;
    });
    const hubIds = new Set(hubBits.map((h) => h.id));
    panels.splice(0, panels.length, ...panels.filter((p) => !hubIds.has(p.id)), ...hubBits);
    // Spokes: two crossed spokes per rim, one on each face, the hub between them. They stop 1/4" inside the rim's edge.
    const sl = 2 * r - 0.5;
    let k = 0;
    rims.forEach((rim, i) => {
      const outerLo = rims.length === 1 || i === 0;
      const faces: [number, "u" | "v"][] = [[rim.position[long] - t, outerLo ? "v" : "u"], [rim.position[long] + t, outerLo ? "u" : "v"]];
      for (const [at, along] of faces) {
        k += 1;
        const u: [number, number] = along === "u" ? [cu - sl / 2, sl] : [cu - band / 2, band];
        const v: [number, number] = along === "v" ? [cv - sl / 2, sl] : [cv - band / 2, band];
        panels.push({
          id: `${rim.id}-spoke-${k}`, type: "rail", name: `Spoke ${k}`, materialId: sheet, turns: true, ...box([at, t], u, v),
          // The board with its axle bore modelled, so the axle runs through a real hole.
          polygon: { plane, pts: [[0, 0], [u[1], 0], [u[1], v[1]], [0, v[1]]], holes: [{ x: cu - u[0], y: cv - v[0], r: bore }] },
          cutNote: `Bore ${fmtIn(bore * 2)} at the centre for the ${axleWord} (running clearance). It lies on the rim's face: glue and screw it to the rim at both ends and to the ${hubName.toLowerCase()} at the centre.`,
        });
      }
    });
    // Paddles: real boards between the rims (or on a lone rim's face), butted to the rim faces across the band and
    // standing out past the rim edge to catch the water. Spaced evenly, half a step off the spokes.
    if (tmpl) {
      const D = 2 * r;
      const n = Math.max(8, 2 * Math.round((Math.PI * D) / 18));
      const boardId = getCatalogItem("lumber-1x4-8") ? "lumber-1x4-8" : tmpl.materialId;
      const bd = getCatalogItem(boardId)?.dims;
      const pt = bd?.height ?? 0.75;
      const out = Math.min(1.5, (bd?.width ?? 3.5) / 2);
      const rho1 = r + out, rho0 = Math.max(inner + 0.25, rho1 - (bd?.width ?? 3.5));
      const ph = rho1 - rho0;
      const pl = two ? between : fixedPaddle;
      const at = two ? rims[0].position[long] + t : rims[0].position[long] + t;
      const keep = panels.filter((p) => p.name.replace(/ \d+$/, "") !== paddle!.name);
      panels.splice(0, panels.length, ...keep);
      for (let i = 0; i < n; i++) {
        const th = Math.PI / n + (i * 2 * Math.PI) / n;
        const rad = [Math.cos(th), Math.sin(th)], tan = [-Math.sin(th), Math.cos(th)];
        const corners = [[rho0, -pt / 2], [rho1, -pt / 2], [rho1, pt / 2], [rho0, pt / 2]].map(([p, q]) => [cu + rad[0] * p + tan[0] * q, cv + rad[1] * p + tan[1] * q]);
        const u0 = Math.min(...corners.map((c) => c[0])), v0 = Math.min(...corners.map((c) => c[1]));
        const u1 = Math.max(...corners.map((c) => c[0])), v1 = Math.max(...corners.map((c) => c[1]));
        panels.push({
          id: `${rims[0].id}-paddle-${i}`, type: "rail", name: `${paddle!.name} ${i + 1}`, materialId: boardId, turns: true,
          ...box([at, pl], [u0, u1 - u0], [v0, v1 - v0]),
          polygon: { plane, pts: corners.map(([u, v]) => [u - u0, v - v0] as [number, number]) },
          blank: { lengthIn: Math.round(pl * 8) / 8, widthIn: Math.round(ph * 8) / 8, thicknessIn: pt },
          cutNote: two ? `Screw through each rim into its ends, ${fmtIn(rho1 - r)} standing out past the rim.` : `Screw through the rim into its end, ${fmtIn(rho1 - r)} standing out past the rim.`,
        });
      }
    }
    // Collars: glued to the axle a card's thickness (1/32") off the rotor's end faces, filling to the carrier
    // (or capping the axle's end). 1/16" of end play in all: it turns free but can't wander.
    const gap = 1 / 32;
    const pierced = (p: Panel) => (["x", "y", "z"] as const).filter((x) => x !== long).every((x) => {
      const c = x === a ? ca : cb;
      return p.position[x] < c && c < p.position[x] + p.size[SZ[x]];
    });
    const ends = panels.filter((p) => p.turns && p !== pin && pierced(p));
    const rLo = Math.min(...ends.map((p) => p.position[long])), rHi = Math.max(...ends.map((p) => p.position[long] + p.size[SZ[long]]));
    const cd = Math.min(Math.max(2.5 * d, d + 1.5), hubDia);
    const collar = (from: number, to: number, i: number, end: boolean): Panel => ({
      id: `${pin.id}-collar-${i}`, type: "rail", name: `Collar ${i}`, materialId: sheet, polygon: disc(cd, d / 2),
      ...box([from, to - from], [cu - cd / 2, cd], [cv - cd / 2, cd]),
      cutNote: `Cut round, ${fmtIn(cd)} diameter, bored ${fmtIn(d)} snug on the ${axleWord}. Glue it to the ${axleWord} ${end ? "at its end" : "against the carrier"}, a card's thickness (1/32") off the wheel, so the wheel turns but can't slide.`,
    });
    const lowFace = faceLo ?? rLo - gap - ply, highFace = faceHi ?? rHi + gap + ply;
    // A collar is whole plies (I28): the fill to the carrier rounds down to plies; the sliver left is on the carrier side.
    const plies = (fill: number) => ply * Math.max(1, Math.floor((fill + 1 / 32) / ply));
    if (rLo - gap - lowFace > 0.1) panels.push(collar(rLo - gap - plies(rLo - gap - lowFace), rLo - gap, 1, faceLo == null));
    if (highFace - (rHi + gap) > 0.1) panels.push(collar(rHi + gap, rHi + gap + plies(highFace - (rHi + gap)), 2, faceHi == null));
    // A capped end: the axle stops at the cap's outer face.
    if (faceLo == null) { const end = pin.position[long] + pin.size[SZ[long]]; pin.position = { ...pin.position, [long]: lowFace }; pin.size = { ...pin.size, [SZ[long]]: end - lowFace }; }
    if (faceHi == null) pin.size = { ...pin.size, [SZ[long]]: highFace - pin.position[long] };
  }
}

/**
 * A member carried by two parts at its ends (a cross rail between two posts) runs face to face between them:
 * when the carriers' faces moved (stock thickness kept while the width grew or shrank), its ends follow them.
 */
function buttBetween(recipe: Recipe, panels: Panel[]): Panel[] {
  const K = { x: "width", y: "height", z: "depth" } as const;
  for (const part of recipe.parts.filter((q) => q.kind === "member" && (q.on ?? []).length === 2)) {
    const ends = part.on!.map((n) => panels.find((p) => p.name === n || p.name.replace(/ \d+$/, "") === n));
    if (ends.some((e) => !e)) continue;
    for (const p of panels.filter((q) => q.name === part.name || q.name.replace(/ \d+$/, "") === part.name)) {
      const L = (["x", "y", "z"] as const).reduce((m, a) => (p.size[K[a]] > p.size[K[m]] ? a : m), "x" as "x" | "y" | "z");
      const [a, b] = [...ends].sort((u, v) => u!.position[L] - v!.position[L]) as Panel[];
      const lo = a.position[L] + a.size[K[L]], hi = b.position[L];
      // Only a member that already spans the gap between them (within a sliver either way).
      if (hi - lo < 1 || Math.abs(p.position[L] - lo) > 0.75 || Math.abs(p.position[L] + p.size[K[L]] - hi) > 0.75) continue;
      p.position = { ...p.position, [L]: lo };
      p.size = { ...p.size, [K[L]]: hi - lo };
    }
  }
  return panels;
}

export type RecipeBuild = { project: YardProject; count: number; size: Size };

/** The model a recipe names at the typed size, count and stock. Pure: same inputs, same model. */
/** A note that names a lumber section for some parts ("Posts are cut from 4x4 stock") sets those parts' stock. */
function noteStock(recipe: Recipe): Recipe {
  const said = recipe.notes.flatMap((n) => [...n.toLowerCase().matchAll(/\b(\d)\s*x\s*(\d+)\b/g)].map((m) => ({ n: n.toLowerCase(), id: `lumber-${m[1]}x${m[2]}-8` }))).filter((x) => getCatalogItem(x.id));
  if (!said.length) return recipe;
  const word = (p: RecipePart) => [p.role, ...p.name.toLowerCase().split(/[\s-]+/)].map((w) => w.replace(/s$/, ""));
  return { ...recipe, parts: recipe.parts.map((p) => {
    if (p.stock || p.kind !== "member") return p;
    const hit = said.find((x) => word(p).some((w) => w.length > 2 && new RegExp(`\\b${w}s?\\b`).test(x.n)));
    return hit ? { ...p, stock: hit.id } : p;
  }) };
}

export function buildRecipe(recipe0: Recipe, prompt: string, materialOverride?: string, sizeOverride?: Size): RecipeBuild {
  const recipe = noteStock(hollowVessels(recipe0));
  const stock = stockFor(prompt, recipe, materialOverride);
  const base = (stock.craft && recipe.craftSize) || recipe.size;
  const own: Size = base;
  // Flat parts (a base, a bottom board) whose kept thickness moved their top: the parts that sat on them follow.
  const seats: { top0: number; top: number; x: [number, number]; z: [number, number] }[] = [];
  const count = typedCount(prompt, recipe);
  // A counted unit has its own real size: 3 bays are three bays wide, 3 steps three rises tall.
  const unit = recipe.count?.unit ?? {};
  const perUnit = Object.fromEntries((["width", "height", "depth"] as const).filter((a) => unit[a]).map((a) => [a, unit[a]! * count]));
  const size: Size = { ...base, ...perUnit, ...typedSize(prompt, recipe), ...(sizeOverride ?? {}) };
  const panels: Panel[] = [];
  const seen = new Map<string, number>();
  // Repeats fill the clear span between the side members (posts, sides at the width's edges), not the full width.
  const sides = recipe.parts.filter((p) => !p.repeat && p.box[3] < 0.25);
  const L = Math.max(0, ...sides.filter((p) => p.box[0] < 0.01).map((p) => p.box[0] + p.box[3]));
  const R = Math.min(1, ...sides.filter((p) => p.box[0] + p.box[3] > 0.99).map((p) => p.box[0]));
  for (const part of recipe.parts) {
    const reps = part.repeat === "each" || part.repeat === "stair" ? count : part.repeat === "between" ? count + 1 : 1;
    for (let r = 0; r < reps * (part.per ?? 1); r++) {
      const i = Math.floor(r / (part.per ?? 1)), k = r % (part.per ?? 1);
      const [x, y0, z, w, h, d] = part.box;
      const y = y0 + k * h;
      const cell = part.repeat === "each" ? 1 / count : 1;
      const span = part.repeat === "each" || part.repeat === "between" ? R - L : 1, at = span === 1 ? 0 : L;
      const px = at + span * (part.repeat === "between" ? Math.min(Math.max(i / count - w / 2, 0), 1 - w) : part.repeat === "each" ? (i + x) * cell : x / span);
      const pw = part.repeat === "each" ? w * cell * span : w;
      // Numbered slugs (Peg1…Peg4) are one family: "Peg 1…4", batched on the cut list as 4 Pegs.
      const base = part.name.replace(/(?<=[a-z])\d+$/i, "");
      const fam = base !== part.name;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      // A stair step i sits one rise up and one run back from the step below it (z = 1 is the front).
      const st = part.repeat === "stair";
      const py = st ? (i + y) / count : y, ph = st ? h / count : h;
      const pz = st ? (count - 1 - i + z) / count : z, pd = st ? d / count : d;
      const sz = { width: pw * size.width, height: ph * size.height, depth: pd * size.depth };
      // A divider repeated between the sides stands on edge: its thin side runs along the repeat (x), never
      // a flat slat spanning the width (the knife block's slots).
      if (part.repeat === "between" && part.kind !== "member" && sz.width > Math.min(sz.height, sz.depth) + 0.01) {
        const span = sz.width;
        if (sz.height <= sz.depth) [sz.width, sz.height] = [sz.height, Math.min(span, size.height * (1 - py))];
        else [sz.width, sz.depth] = [sz.depth, Math.min(span, size.depth * (1 - pz))];
      }
      // Stock thickness never scales (I28): a resized build stretches its parts' lengths and widths, but each
      // part keeps the thickness it has at the recipe's own size — the board or sheet it is cut from.
      const pos0 = { x: px * size.width, y: py * size.height, z: pz * size.depth };
      {
        const K = { x: "width", y: "height", z: "depth" } as const;
        const frac = { x: pw, y: ph, z: pd };
        const thin = (["x", "y", "z"] as const).reduce((m, a) => (frac[a] * own[K[a]] < frac[m] * own[K[m]] ? a : m), "x" as "x" | "y" | "z");
        const t0 = frac[thin] * own[K[thin]];
        if (part.kind !== "hardware" && Math.abs(sz[K[thin]] - t0) > 1e-6 && t0 < Math.min(...(["x", "y", "z"] as const).filter((a) => a !== thin).map((a) => sz[K[a]]))) {
          if (thin !== "y") pos0[thin] += (sz[K[thin]] - t0) / 2;
          else seats.push({ top0: pos0.y + sz.height, top: pos0.y + t0, x: [pos0.x, pos0.x + sz.width], z: [pos0.z, pos0.z + sz.depth] });
          sz[K[thin]] = t0;
        }
      }
      panels.push({
        id: `recipe-${recipe.key}-${panels.length}`,
        type: panelType(part),
        name: fam || reps * (part.per ?? 1) > 1 || part.kind === "hardware" ? `${base} ${n}` : part.name,
        position: pos0,
        size: sz,
        materialId: part.kind === "hardware" && !part.catalogId && PIN.test(`${part.role} ${base}`) && !BOUGHT_MECHANISM.test(base) ? pinDowel(stock.member, Math.min(...[pw * size.width, ph * size.height, pd * size.depth].sort((a, b) => a - b).slice(1, 2))) : part.kind === "hardware" || (part.kind === "cover" && !getCatalogItem(stock.sheet)) ? part.catalogId ?? "hardware" : (stock.all ? undefined : part.stock) ?? (part.kind === "member" ? stock.member : stock.sheet),
      });
    }
  }
  // A part standing on a seat whose top moved keeps its own top and meets the seat's new top (a post on a base).
  for (const st of seats) {
    for (const p of panels) {
      if (Math.abs(p.position.y - st.top0) > 0.05 || p.position.x >= st.x[1] - 0.01 || p.position.x + p.size.width <= st.x[0] + 0.01 || p.position.z >= st.z[1] - 0.01 || p.position.z + p.size.depth <= st.z[0] + 0.01) continue;
      const d = st.top - st.top0;
      if (p.size.height <= Math.min(p.size.width, p.size.depth) || p.size.height - d < 1) p.position = { ...p.position, y: p.position.y + d };
      else { p.position = { ...p.position, y: st.top }; p.size = { ...p.size, height: p.size.height - d }; }
    }
  }
  // A pin is round stock: its two short sides are the dowel's diameter, centred where the recipe put it.
  for (const p of panels) {
    const d = /^dowel-/.test(p.materialId) && PIN.test(p.name) && p.type === "cleat" ? getCatalogItem(p.materialId)?.dims.diameter : undefined;
    if (!d) continue;
    const ax = (["width", "height", "depth"] as const).slice().sort((a, b) => p.size[a] - p.size[b]).slice(0, 2);
    for (const k of ax) {
      const a = k === "width" ? "x" : k === "height" ? "y" : "z";
      p.position = { ...p.position, [a]: p.position[a] + (p.size[k] - d) / 2 };
      p.size = { ...p.size, [k]: d };
    }
  }
  definingShapes(recipe, panels);
  const fitted = buttBetween(recipe, snapMembers(recipe, panels, stock.member));
  // Learned hardware with no catalogue item (a clock's hanger) can't be bought or cut: unless it defines the object it is dropped, never a priceless line.
  panels.splice(0, panels.length, ...fitted.filter((p) => !(recipe.learned && p.type === "cleat" && p.materialId === "hardware" && !/hinge|latch|hook|knob|pull|handle|caster|bolt|axle|slide/i.test(p.name) && !(recipe.defining ?? []).includes(recipe.parts.find((q) => q.name === p.name.replace(/ \d+$/, ""))?.role ?? ""))));
  const footed = addFeet(recipe, panels, size, stock.member);
  hingedLids(recipe, panels, size.height);
  seatHardwareAndNotches(panels);
  crossLegs(recipe, panels);
  steadyPedestal(panels, size);
  if (/\btrestle\b/i.test(`${recipe.title} ${prompt}`)) trestleLegs(recipe, panels, size);
  gnomonTriangles(panels);
  const wide = new Set<string>();
  // A panel wider than its board stock is cut from the sheet (or flagged when the board was typed); one thicker than the sheet stays a glue-up.
  for (const p of panels) {
    const c = getCatalogItem(p.materialId);
    const [thin, mid] = [p.size.width, p.size.height, p.size.depth].sort((x, y) => x - y);
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    // A member wider than one stick both ways (a sawbuck's 21" leg, a 1.8×4.3 apron) is never one 2x4: it is cut from the sheet, glued up in layers when thick.
    if (c?.category === "lumber" && p.materialId === stock.member && c.dims.width && c.dims.height && part?.kind === "member" && !stock.typed && thin > c.dims.height + 0.01 && mid > c.dims.width + 0.01) { p.materialId = getCatalogItem(stock.sheet)?.formFactor === "sheet" ? stock.sheet : "plywood-3-4-4x8"; continue; }
    if (c?.formFactor !== "board" || !c.dims.width) continue;
    if (part?.kind !== "panel" || mid <= c.dims.width + 0.05) continue;
    // An outdoor part named for boards (a bench seat lid) stays edge-glued boards: interior-style plywood never sits out in the rain.
    if (!stock.typed && !(recipe.outdoor && part.stock)) p.materialId = getCatalogItem(stock.sheet)?.formFactor === "sheet" ? stock.sheet : "plywood-3-4-4x8";
    else wide.add(`${p.name.replace(/ \d+$/, "")} is ${fmtIn(mid)} wide, more than one ${c.name}: edge-glue boards to width.`);
  }
  roundParts(recipe, panels);
  holeArrays(recipe, panels);
  panels.splice(0, panels.length, ...curvedParts(recipe, panels, size));
  const pins = panels.filter((p) => /^dowel-/.test(p.materialId) && PIN.test(p.name));
  // Moving parts and their pins ride free: no screws at the joint, and a bored moving part clears its pin by 1/16".
  const movers = new Set((recipe.moving ?? []).map((m) => m.part));
  for (const p of panels) {
    if (!movers.has(p.name) && !movers.has(p.name.replace(/ \d+$/, "")) && !(movers.size && pins.includes(p))) continue;
    p.turns = true;
    const hole = p.polygon?.holes?.[0];
    if (hole && !pins.includes(p)) hole.r += 1 / 32;
  }
  rotors(recipe, panels, pins);
  realBoards(recipe, panels);
  // Outdoors the flat parts become exterior boards instead (exteriorBoards).
  if (!((recipe.outdoor || isOutdoorPrompt(prompt)) && !/plywood/i.test(prompt) && !materialOverride)) oneSheetThick(recipe, panels);
  bearOnCarriers(recipe, panels);
  if ((recipe.outdoor || isOutdoorPrompt(prompt)) && !/plywood/i.test(prompt) && !materialOverride) { exteriorBoards(panels); oneSheetThick(recipe, panels); }
  const sized = dowelSizes(panels);
  // Ground contacts are real: a part below the floor (a wheel recentred on its axle) lifts with its axle
  // and the parts that turn on it, so it stands on the floor, never through it.
  for (const pin of pins) {
    const group = [pin, ...panels.filter((p) => p !== pin && p.turns && !pins.includes(p))];
    const sink = -Math.min(0, ...group.map((p) => p.position.y));
    if (sink > 0.001) for (const p of group) p.position = { ...p.position, y: p.position.y + sink };
  }
  // The box is the real build: a builder snap that reaches past the recipe size grows that (untyped) side.
  const typedAxes = typedSize(prompt, recipe);
  const real = { ...size };
  for (const [a, k] of [["x", "width"], ["y", "height"], ["z", "depth"]] as const) {
    const lo = Math.min(...panels.map((p) => p.position[a]));
    if (a !== "y" && typedAxes[k] == null && lo < 0 && lo >= -1.5) for (const p of panels) p.position = { ...p.position, [a]: p.position[a] - lo };
    const hi = Math.max(...panels.map((p) => p.position[a] + p.size[k]));
    // An untyped side is the model's own extent, grown or shrunk: the header never names a size the model isn't.
    const from = a === "y" ? 0 : Math.min(...panels.map((p) => p.position[a]));
    if (typedAxes[k] != null) continue;
    if (from > 0) for (const p of panels) p.position = { ...p.position, [a]: p.position[a] - from };
    real[k] = Math.ceil((hi - from) * 8 - 1e-6) / 8;
  }
  // The header height is the body's: pegs standing in their holes (a cribbage board's) don't count.
  const peg = (p: Panel) => p.type === "cleat" && /^dowel-/.test(p.materialId) && /\bpegs?\b/i.test(p.name);
  const bodyTop = Math.max(0, ...panels.filter((p) => !peg(p)).map((p) => p.position.y + p.size.height));
  if (typedAxes.height == null && panels.some(peg) && bodyTop > 0 && bodyTop < real.height - 0.01 && panels.every((p) => !peg(p) || p.position.y <= bodyTop + 0.01)) real.height = Math.ceil(bodyTop * 8 - 1e-6) / 8;
  const moving = (recipe.moving ?? []).map((m) => {
    const pin = pins[0];
    const pinName = pin ? `${pin.name.replace(/ \d+$/, "").toLowerCase()} (${getCatalogItem(pin.materialId)?.name ?? "dowel"})` : null;
    return m.motion === "pivot" || m.motion === "spin" || m.motion === "hinge"
      ? `${m.part} ${m.motion === "spin" ? "spins" : m.motion === "hinge" ? "swings" : "pivots"}${pinName ? ` on the ${pinName}: drill it 1/16" over the dowel so it turns, and glue the dowel only in its carriers` : ""}.`
      : `${m.part} ${m.motion === "fold" ? "folds" : "slides"}.`;
  });
  const counted = recipe.count ? [`${count} ${recipe.count.word}`] : [];
  // The title never names a species the build isn't cut from ("Cedar Window Box" built in pine plywood).
  const woods = panels.map((p) => getCatalogItem(p.materialId)?.name ?? "").join(" ").toLowerCase();
  const title = recipe.title.replace(/\b(cedar|redwood|maple|oak|walnut|cherry|pine|birch|poplar|ash|teak)\s+/gi, (m, w: string) => (woods.includes(w.toLowerCase()) ? m : "")).replace(/^\w/, (c) => c.toUpperCase());
  const project: YardProject = {
    id: `recipe-${recipe.key}`,
    name: title,
    prompt,
    kind: "custom",
    overall: real,
    instances: [],
    panels,
    // The stock it is mostly made of (by cut volume), so a plywood wheel on 2x4 posts never reads "2x4".
    primaryMaterialId: mainStock(panels) ?? stock.member,
    notes: [...sized, ...wide, ...(footed ? [`Feet run the full ${fmtIn(size.depth)} depth under each upright so it can't tip.`] : []), `${recipe.title}${counted.length ? `, ${counted.join(", ")}` : ""}: built from its defining parts (${[...new Set(recipe.parts.map((p) => p.role))].join(", ")}).`, ...(recipe.wall ? recipe.notes : recipe.notes.map((n) => n.replace(/\bfootprint\b/gi, "base size"))), ...moving, ...(stock.craft ? ["Glue the joints."] : []), ...(stock.refused ? [stock.refused] : []), ...(recipe.outdoor ? [CONTACT.test(`${prompt} ${recipe.title}`) ? `Outdoors: untreated cedar (it touches food, skin or a nest) and exterior screws.` : "Outdoors: cedar or pressure-treated stock and exterior screws."] : [])],
    sizedByBuilder: true,
    assumptions: { load: "light", units: "inches", installMode: recipe.wall ? "wall" : "freestanding", wallType: "wood_stud" },
  };
  return { project, count, size };
}

function mainStock(panels: Panel[]): string | undefined {
  const vol = new Map<string, number>();
  for (const p of panels) if (p.materialId && p.materialId !== "hardware") vol.set(p.materialId, (vol.get(p.materialId) ?? 0) + p.size.width * p.size.height * p.size.depth);
  return [...vol].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * A part cut from dowel uses the smallest dowel its round section fits; when no dowel matches that section
 * within 1/16", the note says to turn it down from the next size up.
 */
function dowelSizes(panels: Panel[]): string[] {
  const dowels = Object.values(CATALOG_BY_ID)
    .filter((c) => c.formFactor === "dowel" && /^dowel-/.test(c.id) && (c.dims.diameter ?? 0) > 0)
    .sort((a, b) => (a.dims.diameter ?? 0) - (b.dims.diameter ?? 0) || (a.dims.length ?? 0) - (b.dims.length ?? 0));
  const notes = new Set<string>();
  for (const p of panels) {
    if (!/^dowel-/.test(p.materialId)) continue;
    const [a, b] = [p.size.width, p.size.height, p.size.depth].sort((x, y) => x - y);
    const across = Math.max(a, b);
    const fit = dowels.find((d) => (d.dims.diameter ?? 0) >= across - 0.01);
    if (!fit) continue;
    p.materialId = fit.id;
    if ((fit.dims.diameter ?? 0) > across + 1 / 16) notes.add(`${p.name.replace(/ \d+$/, "").replace(/^\w/, (c) => c.toUpperCase())} is ${fmtIn(across)} across: no ${fmtIn(across)} dowel is sold, so cut it from ${fit.name} and turn or sand it to ${fmtIn(across)}.`);
  }
  return [...notes];
}

/** The standard checks for a recipe build; an empty list passes. */
export function validateRecipe(recipe0: Recipe, built: RecipeBuild, prompt: string): string[] {
  const recipe = hollowVessels(recipe0);
  const fail: string[] = [];
  const { project, count } = built;
  const want = typedSize(prompt, recipe);
  const typed = typedSize(prompt, recipe);
  for (const a of ["width", "height", "depth"] as const) {
    if (typed[a] != null && Math.abs(project.overall[a] - (want[a] ?? 0)) > 0.01) fail.push(`typed ${a} ${want[a]} not honored`);
  }
  const boxes = projectBoxes(project);
  // A flat object (a cutting board, a tray: at most 2" thick) may be one slab; the closed-shell checks are for 3D bodies.
  const flat = Math.min(project.overall.width, project.overall.height, project.overall.depth) <= 2;
  if (boxes.length < 3 && !flat) fail.push("closed shell: fewer than 3 parts");
  // Curved and stick forms are never solid boxes: a dome or cone is drawn curved, tipi poles lean to the top,
  // and a spoked wheel has at least 3 spokes round its centre.
  for (const part of recipe.parts) {
    const words = `${part.role} ${part.name}`.toLowerCase();
    if (/\b(?:dome|cupola|chhatri)s?\b/.test(words) && part.shape !== "dome") fail.push(`${part.name}: a dome drawn as a box`);
    if (/\bcones?\b/.test(words) && part.shape !== "cone") fail.push(`${part.name}: a cone drawn as a box`);
    if (/\b(?:tipi|teepee|tepee)\b/i.test(`${recipe.key} ${recipe.title}`) && /\bpole\b/.test(words) && part.lean !== "apex") fail.push(`${part.name}: a tipi pole stands upright, not leaning to the top`);
  }
  for (const wheelRole of ["wheel", "rim"]) {
    if (!recipe.parts.some((q) => q.role === wheelRole || new RegExp(`\\b${wheelRole}\\b`, "i").test(q.name))) continue;
    const spokes = recipe.parts.filter((q) => /\bspokes?\b/i.test(`${q.role} ${q.name}`));
    if (spokes.length && project.panels.filter((p) => /\bspoke\b/i.test(p.name)).length < 3) fail.push("a spoked wheel has fewer than 3 spokes");
    break;
  }
  // The parts reach the overall box on every axis (nothing outside it; a real build fills its envelope).
  const ext = (a: "x" | "y" | "z", s: "width" | "height" | "depth") => {
    const lo = Math.min(...project.panels.map((p) => p.position[a]));
    const hi = Math.max(...project.panels.filter((p) => a !== "y" || !/\bpegs?\b/i.test(p.name)).map((p) => p.position[a] + p.size[s]));
    // A builder snap (a wheel recentred on its axle) may spill up to 1"; a recipe part outside the box fails.
    // Geometry is real: nothing below the floor and nothing outside the box.
    if (a === "y" && lo < -0.01) fail.push(`a part goes below the floor (${fmtIn(-lo)})`);
    else if (lo < -0.01 || hi > project.overall[s] + 0.01) fail.push(`parts leave the ${s}`);
  };
  ext("x", "width"); ext("y", "height"); ext("z", "depth");
  // One box filling the envelope is the closed-shell fallback.
  const vol = project.overall.width * project.overall.height * project.overall.depth;
  // A round body (a churn's barrel, a drum) is a real defining part, not the closed-shell box.
  const round = new Set(recipe.parts.filter((p) => p.shape).map((p) => p.name));
  if (!flat && project.panels.some((p) => !round.has(p.name.replace(/ \d+$/, "")) && p.size.width * p.size.height * p.size.depth > 0.6 * vol)) fail.push("closed shell: one part fills the envelope");
  for (const role of recipe.defining ?? []) {
    const names = recipe.parts.filter((p) => p.role === role).map((p) => p.name);
    if (!project.panels.some((p) => names.includes(p.name) || names.includes(p.name.replace(/ \d+$/, "")))) fail.push(`missing ${role}`);
  }
  const reps = recipe.parts.filter((p) => p.repeat === "each" || p.repeat === "stair");
  // A slatted wall split into boards is still one built part (ids share the wall's id).
  if (recipe.count && reps.length && new Set(project.panels.filter((p) => p.name.replace(/ \d+$/, "") === reps[0].name).map((p) => p.id.replace(/-s\d+$/, ""))).size !== count) fail.push(`count ${count} not built`);
  // Load path: each part touches what carries it; a part on nothing stands on the floor (or the wall).
  const byName = (name: string) => boxes.filter((b) => b.role === name || b.role.replace(/ \d+$/, "") === name);
  for (const part of recipe.parts) {
    for (const b of byName(part.name)) {
      if (part.on?.length) {
        const carriers = part.on.flatMap(byName);
        if (!carriers.some((c) => c !== b && boxGap(b, c) <= CONTACT_GAP)) fail.push(`${b.role} does not touch ${part.on.join(" or ")}`);
      } else if (!recipe.wall && b.c.y - b.h[1] > 0.01 && !boxes.some((f) => f.role === `Foot under ${b.role}` && boxGap(b, f) <= CONTACT_GAP) && !boxes.some((f) => f !== b && f.role === b.role && f.c.y < b.c.y && boxGap(b, f) <= CONTACT_GAP)) fail.push(`${b.role} floats: it stands on nothing`);
      // (A wall stacked from boards stands on its own lower board.)
    }
  }
  if (!recipe.wall && uprights(project.panels)) {
    const f = footprint(project.panels);
    if (tippy(f, project.overall)) fail.push(`tips: floor footprint ${fmtIn(f.z[1] - f.z[0])} deep under a ${fmtIn(project.overall.height)} build`);
    if (f.com.x < f.x[0] || f.com.x > f.x[1] || f.com.z < f.z[0] || f.com.z > f.z[1]) fail.push("tips: center of mass outside the footprint");
  }
  return [...new Set(fail)];
}

export type LookupOutcome = { project: YardProject; recipe: Recipe | null; rough: boolean; calls: number; unavailable?: boolean; reasons?: string[] };
export type Lookup = (prompt: string, feedback?: string[]) => Promise<unknown>;

/**
 * The rough shape for a compound noun its builder only half matched ("chicken tractor" built as a toy
 * tractor): never the last word's build. One plain block at that build's size, named for the whole noun.
 */
const PLY = "plywood-3-4-4x8";
export function roughBlock(prompt: string, like: YardProject): YardProject {
  const noun = prompt.trim().replace(/^\w/, (c) => c.toUpperCase());
  // With no craft cue typed, a craft-stock build (stick cloud, toy) never sets the scale: full-size default, typed sizes win.
  const craftLike = /popsicle|craft|cardboard|skewer|paper|stick/i.test(like.primaryMaterialId ?? "") && !/popsicle|craft|cardboard|skewer|\btoy\b|model|miniature/i.test(prompt);
  // A kitchen board's block is board scale (18x1.5x12), never furniture scale.
  const board = /\b(?:cutting|chopping|bread|serving|charcuterie|cheese|butcher)\s+board\b/i.test(prompt);
  // A tabletop object sits on a table: its block is never bigger than 24x18x18.
  const top = /\b(?:table-?top|desk-?top|counter-?top)\b/i.test(prompt);
  const base = board ? { width: 18, height: 1.5, depth: 12 } : craftLike ? { width: 36, height: 30, depth: 24 } : like.overall;
  const o = { ...(top ? { width: Math.min(base.width, 24), height: Math.min(base.height, 18), depth: Math.min(base.depth, 18) } : base), ...typedSize(prompt, {} as Recipe) };
  return {
    ...like,
    overall: o,
    // Only the size carries over: no fitted brief, opening, closet label or craft stock from the half-read build.
    id: `recipe-rough-${noun.toLowerCase().replace(/\W+/g, "-")}`,
    kind: "frame",
    fitted: undefined,
    opening: undefined,
    primaryMaterialId: PLY,
    name: noun,
    instances: [],
    panels: [{ id: "rough-block", type: "rail", name: noun, position: { x: -o.width / 2, y: 0, z: 0 }, size: { ...o }, materialId: PLY }],
    notes: [],
    standIn: true,
    displayOnly: true,
  };
}

/** The plain label a rough shape carries, in positive words. */
export function roughNote(title: string, failures: string[]): string {
  return `Yard couldn't learn this yet. Shown as a rough shape: the real ${title.toLowerCase()} parts come next${failures.length ? ` (${failures.slice(0, 3).join("; ")})` : ""}.`;
}

/**
 * The build-and-validate loop: ask the lookup for a recipe, build it, check it; on a failure ask once
 * more with the failures fed back; a second failure keeps the engine's own build, labelled as a rough
 * shape under the typed name. A passing recipe comes back as a candidate for the store.
 */
export async function lookupAndBuild(prompt: string, lookup: Lookup, rough: () => YardProject, materialOverride?: string): Promise<LookupOutcome> {
  let feedback: string[] = [];
  // Why each call failed (timeout, error, parse, or the gate checks), logged so a miss is diagnosable.
  const reasons: string[] = [];
  const why = (call: number, r: string) => { reasons.push(`call ${call}: ${r}`); console.info(`[recipe-lookup] ${prompt} call ${call}: ${r}`); };
  for (let call = 1; call <= 2; call++) {
    let raw: unknown = null;
    try {
      raw = await lookup(prompt, call > 1 ? feedback : undefined);
    } catch (e) {
      // No AI here: the engine's own build stays, with no rough label and no second call.
      if ((e as Error).message === UNAVAILABLE) return { project: rough(), recipe: null, rough: false, calls: call, unavailable: true };
      why(call, (e as Error).message === "timeout" ? "timeout" : `error: ${(e as Error).message}`);
      // A timed-out or failed call has nothing to fix: the retry asks afresh, not with a parse complaint.
      feedback = [];
      continue;
    }
    const parsed = parseRecipe(raw);
    // A learned recipe is keyed by the noun the maker typed, never the model's head noun ("lap desk", not
    // "desk"): a generic key would take over a noun the engine already builds. Shorter synonyms go too.
    const noun = normalizeNoun(prompt), n = noun.split(" ").length;
    // The title names what was typed: the AI's own noun ("Table" for a dog feeder stand) is dropped.
    const title = parsed && (parsed.title.toLowerCase().includes(noun) ? parsed.title : noun.replace(/(^|\s)\w/g, (c) => c.toUpperCase()));
    const recipe = parsed && title && { ...parsed, title, key: noun.replace(/\s+/g, "-"), synonyms: (parsed.synonyms ?? []).filter((w) => w.trim().split(/[\s-]+/).length >= n) };
    if (!recipe) { feedback = [lastParseProblem || "the reply had no usable recipe"]; why(call, `parse: ${feedback[0]}`); continue; }
    const built = buildRecipe(recipe, prompt, materialOverride);
    const hard = validateRecipe(recipe, built, prompt);
    // The learned-recipe gate runs here too: its failures go back in the retry; still failing on the
    // second call, the recipe builds held (Unverified) instead of passing silently.
    const soft = hard.length ? [] : learnedRecipeFailures(recipe, prompt);
    feedback = [...hard, ...soft];
    if (!hard.length && (!soft.length || call === 2)) {
      const kept = soft.length ? { ...recipe, held: `Flagged by the learned-recipe checks: ${soft.slice(0, 3).join("; ")}` } : recipe;
      rememberRecipe(kept);
      return { project: soft.length ? { ...built.project, notes: [UNVERIFIED, ...built.project.notes] } : built.project, recipe: kept, rough: false, calls: call, reasons };
    }
    why(call, `gate: ${feedback.join("; ")}`);
  }
  const shape = rough();
  return { project: { ...shape, notes: [roughNote(shape.name, feedback), ...(shape.notes ?? [])] }, recipe: null, rough: true, calls: 2, reasons };
}

/**
 * The live page asks the recipe lookup only when nothing owns the noun: no saved recipe, and the engine
 * built a generic body or a build whose name shares no word with what was typed (a silent template swap),
 * or the build ignores a word of the typed object (weakMatch, see ignoredTypedWords).
 */
export function needsRecipeLookup(project: YardProject, prompt: string, engineOwns: boolean, weakMatch = false): boolean {
  if (findRecipe(prompt)) return false;
  if (weakMatch) return true;
  if (engineOwns) return false;
  if (project.unmatched || project.standIn) return true;
  const name = (project.name ?? "").toLowerCase();
  const typed = prompt.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ""));
  return typed.length > 0 && !typed.some((w) => name.includes(w));
}

/**
 * A lookup call that gives up after `ms`; an unavailable AI answers "unavailable" so the page keeps its build.
 * A live recipe answer takes 30-60 s (measured on yard.wiki); a 9 s cut timed out every call, so no recipe
 * ever passed and the recipe bot never proposed one.
 */
export const UNAVAILABLE = "unavailable";
/** What the bench says when no lookup can run: never an error, always a way forward. */
export const TRY_SAMPLE = "Yard can't look this one up right now. Try a sample from Ideas: built-in shapes and saved recipes always build.";
export function timedLookup(call: (feedback?: string[]) => Promise<{ ok: boolean; recipeJson?: string; error?: string }>, firstMs = 145_000, totalMs = 155_000): Lookup {
  let start = 0;
  return async (_prompt, feedback) => {
    // The first reply gets up to 145s (live replies that pass land at 20-140s; a 105s cut timed out cornhole,
    // miter saw station and rain barrel stand both times); a retry gets whatever is left of the bound.
    // (a fixed 50s retry timed out the common fix-the-checks retry that used to land at ~130s).
    const ms = start ? Math.max(totalMs - (Date.now() - start), 1) : Math.min(firstMs, totalMs);
    if (!start) start = Date.now();
    let id: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => (id = setTimeout(() => reject(new Error("timeout")), ms)));
    const r = await Promise.race([call(feedback), timer]).finally(() => clearTimeout(id));
    // No key, the visitor's daily cap, or an xAI error: no second call; the page offers samples instead.
    if (!r.ok) throw new Error(/not available|free AI lookups|xAI API error/i.test(r.error ?? "") ? UNAVAILABLE : r.error ?? "lookup failed");
    return r.recipeJson ? JSON.parse(r.recipeJson) : null;
  };
}
