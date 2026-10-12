/**
 * Build and validate a recipe (spec 001 R3/R4): every part is a box placed by its shares of the overall
 * size, a typed count repeats the counted parts, and the build passes the standard checks (load path,
 * no closed shell, typed size and count honored, defining roles present) before it is used. A lookup
 * recipe that fails is retried once with the failures fed back; a second failure is a labelled rough shape.
 */
import { CATALOG_BY_ID, getCatalogItem } from "./catalog";
import { boxGap, projectBoxes, CONTACT_GAP } from "./contact";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { findRecipe, lastParseProblem, parseRecipe, rememberRecipe, type Recipe, type RecipePart } from "./recipes";
import type { Panel, PanelType, YardProject } from "./types";

type Size = { width: number; height: number; depth: number };
const CRAFT = new Set(["craft_wood", "cardboard", "paper_tube", "dowel_rod"]);
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

/** Typed sizes: "48 wide", "6 ft tall", and a bare "10x10" read as a plan in feet when the recipe says so. */
export function typedSize(prompt: string, recipe: Recipe): Partial<Size> {
  const lower = prompt.toLowerCase();
  const out: Partial<Size> = {};
  const axis = { wide: "width", long: "width", tall: "height", high: "height", deep: "depth" } as const;
  for (const m of lower.matchAll(/(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|in|inch|inches|")?\s*(wide|long|tall|high|deep)\b/g)) {
    out[axis[m[3] as keyof typeof axis]] = Number(m[1]) * (m[2] && /^(ft|feet|foot|')$/.test(m[2]) ? 12 : 1);
  }
  const pair = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\b(?!\s*x)/);
  if (pair && !/^[124]$/.test(pair[1]) && out.width == null && out.depth == null) {
    const k = recipe.feet ? 12 : 1;
    out.width = Number(pair[1]) * k;
    out.depth = Number(pair[2]) * k;
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
  const typed = override ? getCatalogItem(override) : STOCK_WORD.test(prompt) ? detectMaterial(prompt) : undefined;
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
const PIN = /\b(?:axle|pivot|shaft|pin|spindle|hinge pin|rod|dowel)s?\b/i;
function pinDowel(memberId: string): string {
  const it = getCatalogItem(memberId);
  const t = Math.min(it?.dims.thickness ?? it?.dims.height ?? 1.5, it?.dims.width ?? 1.5, it?.dims.diameter ?? 9);
  return t >= 1.4 ? "dowel-1-36" : t >= 0.7 ? "dowel-1-2-36" : "dowel-1-4-36";
}

/**
 * A member is one stick of its stock: its cross-section is the stock's section (centred in the recipe box),
 * so an arm reads as one member, not an edge-glued cluster. Parts resting on (or hanging from) a member
 * then settle onto its new face, so every load path still touches.
 */
function snapMembers(recipe: Recipe, panels: Panel[], memberId: string): Panel[] {
  const it = getCatalogItem(memberId);
  const th = it?.dims.thickness ?? it?.dims.height ?? it?.dims.diameter;
  const fw = it?.dims.width ?? it?.dims.diameter;
  if (!it || it.category !== "lumber" || !th || !fw) return panels;
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
  const order = out.map((_, i) => i).sort((a, b) => out[a].position.y - out[b].position.y);
  for (const i of order) {
    const p = out[i];
    if (base(p.name)?.kind !== "member" || p.materialId !== memberId) continue;
    const [thin, wide] = AX.map(([a, k]) => ({ a, k, v: p.size[k] })).sort((m, n) => m.v - n.v);
    // Only a member a little fatter than one stick snaps; a deliberately big block keeps its box.
    if (thin.v > Math.max(th * 2.2, fw * 1.1) + 0.01 || wide.v > fw * 2.2 + 0.01) continue;
    const next = out.map((q) => ({ ...q, position: { ...q.position }, size: { ...q.size } }));
    const top0 = p.position.y + p.size.height;
    for (const [m, to] of [[thin, Math.min(th, thin.v)], [wide, Math.min(fw, wide.v)]] as const) {
      // Width and depth centre; height keeps the bottom on what it stands on.
      if (m.a !== "y") next[i].position[m.a] += (next[i].size[m.k] - to) / 2;
      next[i].size[m.k] = to;
    }
    // Parts resting on its top follow it down.
    const drop = top0 - (next[i].position.y + next[i].size.height);
    if (drop > 0.001) for (const [a, b] of pairs) if (b === i && Math.abs(out[a].position.y - top0) < CONTACT_GAP) next[a].position.y -= drop;
    if (pairs.every(([a, b]) => gap(next[a], next[b]) <= CONTACT_GAP)) out = next;
  }
  return out;
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
function roundParts(recipe: Recipe, panels: Panel[]): void {
  const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
  const pins = panels.filter((p) => /^dowel-/.test(p.materialId) && PIN.test(p.name));
  for (const p of panels) {
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (!part?.shape) continue;
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
function hingedLids(recipe: Recipe, panels: Panel[], H: number): void {
  const lids = new Set([...(recipe.moving ?? []).filter((m) => m.motion === "hinge").map((m) => m.part), ...recipe.parts.filter((p) => p.role === "lid").map((p) => p.name)]);
  for (const lid of panels.filter((p) => lids.has(p.name) || lids.has(p.name.replace(/ \d+$/, "")))) {
    lid.turns = true;
    const under = panels.filter((w) => !lids.has(w.name) && !lids.has(w.name.replace(/ \d+$/, "")) && w.size.height > 1 && Math.min(w.size.width, w.size.depth) >= 0.2 &&
      w.position.x < lid.position.x + lid.size.width && lid.position.x < w.position.x + w.size.width &&
      w.position.z < lid.position.z + lid.size.depth && lid.position.z < w.position.z + w.size.depth);
    if (!under.length) continue;
    const top = (w: Panel) => w.position.y + w.size.height;
    const hi = under.reduce((m, w) => (top(w) > top(m) ? w : m)), lo = under.reduce((m, w) => (top(w) < top(m) ? w : m));
    // A lid floating above the walls is left for the load-path check; one sunk into them is seated.
    if (lid.position.y > top(hi) + 0.1) continue;
    const t = Math.min(lid.size.height, 1);
    // The lid stays inside the overall height: walls reaching above H - t are trimmed to carry it.
    for (const w of under) if (top(w) > H - t) w.size = { ...w.size, height: Math.max(H - t - w.position.y, 0.5) };
    const rise = top(hi) - top(lo), D = lid.size.depth;
    if (rise <= 1) { lid.position = { ...lid.position, y: top(hi) }; lid.size = { ...lid.size, height: t }; continue; }
    lid.position = { ...lid.position, y: top(lo) };
    lid.size = { ...lid.size, height: rise + t };
    const backHigh = hi.position.z + hi.size.depth / 2 < lo.position.z + lo.size.depth / 2;
    const [y0, yD] = backHigh ? [rise, 0] : [0, rise];
    lid.polygon = { plane: "zy", pts: [[0, y0], [0, y0 + t], [D, yD + t], [D, yD]] };
  }
}

type Ax = "x" | "y" | "z";
const SZ = { x: "width", y: "height", z: "depth" } as const;
const meets3 = (p: Panel, q: Panel) => (["x", "y", "z"] as const).every((a) => p.position[a] <= q.position[a] + q.size[SZ[a]] + 0.05 && q.position[a] <= p.position[a] + p.size[SZ[a]] + 0.05);

/**
 * A spinning wheel is a rotor: its round parts sit centred on the axle, a rim (ring) is joined to the hub by
 * crossed spokes, paddles stand on the rim at the quarter points, and every fixed part the axle passes is
 * drilled for it.
 */
function rotors(recipe: Recipe, panels: Panel[], pins: Panel[]): void {
  // Every dowel sits in drilled holes: each fixed part it meets is drilled for it.
  for (const pin of pins) {
    const L = (["x", "y", "z"] as const).reduce((m, a) => (pin.size[SZ[a]] > pin.size[SZ[m]] ? a : m), "x" as Ax);
    const dia = Math.min(...(["x", "y", "z"] as const).filter((x) => x !== L).map((x) => pin.size[SZ[x]]));
    const name = pin.name.replace(/ \d+$/, "").toLowerCase();
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
      const n = `Drill a ${fmtIn(dia)} hole for each ${name}${through ? " right through" : `, ${fmtIn(deep)} deep`}.${pin.turns && panels.some((r) => r.turns && r.polygon && r !== pin && meets3(r, pin)) ? ` A snug fixed bore: glue the ${name} here.` : ""}`;
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
    // Only the glued-up rotor turns: each part bored for the axle clears it by 1/16".
    for (const p of riders) {
      p.position = { ...p.position, [a]: ca - p.size[SZ[a]] / 2, [b]: cb - p.size[SZ[b]] / 2 };
      const h = p.polygon?.holes?.[0];
      if (h && h.r < d) h.r = Math.max(h.r, d / 2 + 1 / 32);
      if (h) p.cutNote = (p.cutNote ?? "").replace(/(bored) [\d./]+"?/, `$1 ${fmtIn(h.r * 2)} (running clearance on the ${fmtIn(d)} ${pin.name.replace(/ \d+$/, "").toLowerCase()})`);
    }
    for (const rim of riders.filter((p) => recipe.parts.some((q) => q.shape === "ring" && q.name === p.name.replace(/ \d+$/, "")))) {
      const r = rim.size[SZ[a]] / 2, inner = rim.polygon?.holes?.[0]?.r ?? r * 0.8, band = Math.max(r - inner, 1.5);
      const t = rim.size[SZ[long]];
      for (const [i, along] of [a, b].entries()) {
        const across = along === a ? b : a;
        panels.push({
          id: `${rim.id}-spoke-${i}`, type: "rail", name: `Spoke ${i + 1}`, materialId: rim.materialId, turns: true,
          position: { ...rim.position, [along]: (along === a ? ca : cb) - r + band / 2, [across]: (across === a ? ca : cb) - band / 2 } as Panel["position"],
          size: { ...rim.size, [SZ[along]]: 2 * r - band, [SZ[across]]: band, [SZ[long]]: t } as Panel["size"],
          cutNote: `Half-lap the two spokes where they cross and bore ${fmtIn(d + 1 / 16)} there for the axle.`,
        });
      }
      for (const hub of riders.filter((p) => p !== rim && p.size[SZ[a]] < r)) {
        // The spokes lie in the rim's plane; the hub's face sits flush with it so they seat in its face slot.
        hub.position = { ...hub.position, [long]: rim.position[long] };
        const n = `Cut a ${fmtIn(band)} wide, ${fmtIn(Math.min(t, hub.size[SZ[long]]))} deep slot across the hub face for each spoke.`;
        if (!(hub.cutNote ?? "").includes(n)) hub.cutNote = `${hub.cutNote ? `${hub.cutNote} ` : ""}${n}`;
      }
      const paddle = recipe.parts.find((q) => q.role === "paddle");
      const tmpl = paddle && panels.find((p) => p.name === paddle.name || p.name.replace(/ \d+$/, "") === paddle.name);
      if (tmpl) {
        const pl = Math.max(tmpl.size[SZ[long]], t * 4), ph = Math.max(Math.min(tmpl.size[SZ[a]], tmpl.size[SZ[b]], r / 3), 2), pt = 0.75;
        const keep = panels.filter((p) => p.name.replace(/ \d+$/, "") !== paddle.name);
        panels.splice(0, panels.length, ...keep);
        const mid = rim.position[long] + t / 2;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([u, v], i) => {
          // A paddle straddles the rim's outer edge so half of it stands out past the rim to catch water.
          const pa = ca + u * r, pb = cb + v * r;
          const sa = u ? ph : pt, sb = v ? ph : pt;
          panels.push({
            id: `${rim.id}-paddle-${i}`, type: "rail", name: `${paddle.name} ${i + 1}`, materialId: tmpl.materialId, turns: true,
            position: { [a]: pa - sa / 2, [b]: pb - sb / 2, [long]: mid - pl / 2 } as Panel["position"],
            size: { [SZ[a]]: sa, [SZ[b]]: sb, [SZ[long]]: pl } as Panel["size"],
            cutNote: "Glue and screw to the rim, square to it.",
          });
        });
      }
    }
  }
}

export type RecipeBuild = { project: YardProject; count: number; size: Size };

/** The model a recipe names at the typed size, count and stock. Pure: same inputs, same model. */
export function buildRecipe(recipe: Recipe, prompt: string, materialOverride?: string, sizeOverride?: Size): RecipeBuild {
  const stock = stockFor(prompt, recipe, materialOverride);
  const base = (stock.craft && recipe.craftSize) || recipe.size;
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
      const n = (seen.get(part.name) ?? 0) + 1;
      seen.set(part.name, n);
      // A stair step i sits one rise up and one run back from the step below it (z = 1 is the front).
      const st = part.repeat === "stair";
      const py = st ? (i + y) / count : y, ph = st ? h / count : h;
      const pz = st ? (count - 1 - i + z) / count : z, pd = st ? d / count : d;
      const sz = { width: pw * size.width, height: ph * size.height, depth: pd * size.depth };
      panels.push({
        id: `recipe-${recipe.key}-${panels.length}`,
        type: panelType(part),
        name: reps * (part.per ?? 1) > 1 || part.kind === "hardware" ? `${part.name} ${n}` : part.name,
        position: { x: px * size.width, y: py * size.height, z: pz * size.depth },
        size: sz,
        materialId: part.kind === "hardware" && !part.catalogId && PIN.test(part.name) ? pinDowel(stock.member) : part.kind === "hardware" || (part.kind === "cover" && !getCatalogItem(stock.sheet)) ? part.catalogId ?? "hardware" : (stock.all ? undefined : part.stock) ?? (part.kind === "member" ? stock.member : stock.sheet),
      });
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
  const fitted = snapMembers(recipe, panels, stock.member);
  panels.splice(0, panels.length, ...fitted);
  const footed = addFeet(recipe, panels, size, stock.member);
  hingedLids(recipe, panels, size.height);
  const wide = new Set<string>();
  // A panel wider than its board stock is cut from the sheet (or flagged when the board was typed); one thicker than the sheet stays a glue-up.
  for (const p of panels) {
    const c = getCatalogItem(p.materialId);
    if (c?.formFactor !== "board" || !c.dims.width) continue;
    const [, mid] = [p.size.width, p.size.height, p.size.depth].sort((x, y) => x - y);
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    if (part?.kind !== "panel" || mid <= c.dims.width + 0.05) continue;
    if (!stock.typed) p.materialId = getCatalogItem(stock.sheet)?.formFactor === "sheet" ? stock.sheet : "plywood-3-4-4x8";
    else wide.add(`${p.name.replace(/ \d+$/, "")} is ${fmtIn(mid)} wide, more than one ${c.name}: edge-glue boards to width.`);
  }
  roundParts(recipe, panels);
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
  const sized = dowelSizes(panels);
  const moving = (recipe.moving ?? []).map((m) => {
    const pin = pins[0];
    const pinName = pin ? `${pin.name.replace(/ \d+$/, "").toLowerCase()} (${getCatalogItem(pin.materialId)?.name ?? "dowel"})` : null;
    return m.motion === "pivot" || m.motion === "spin" || m.motion === "hinge"
      ? `${m.part} ${m.motion === "spin" ? "spins" : m.motion === "hinge" ? "swings" : "pivots"}${pinName ? ` on the ${pinName}: drill it 1/16" over the dowel so it turns, and glue the dowel only in its carriers` : ""}.`
      : `${m.part} ${m.motion === "fold" ? "folds" : "slides"}.`;
  });
  const counted = recipe.count ? [`${count} ${recipe.count.word}`] : [];
  const project: YardProject = {
    id: `recipe-${recipe.key}`,
    name: recipe.title,
    prompt,
    kind: "custom",
    overall: size,
    instances: [],
    panels,
    primaryMaterialId: stock.member,
    notes: [...sized, ...wide, ...(footed ? [`Feet run the full ${fmtIn(size.depth)} depth under each upright so it can't tip.`] : []), `${recipe.title}${counted.length ? `, ${counted.join(", ")}` : ""}: built from its defining parts (${[...new Set(recipe.parts.map((p) => p.role))].join(", ")}).`, ...recipe.notes, ...moving, ...(stock.craft ? ["Glue the joints."] : []), ...(stock.refused ? [stock.refused] : []), ...(recipe.outdoor ? ["Outdoors: cedar or pressure-treated stock and exterior screws."] : [])],
    sizedByBuilder: true,
    assumptions: { load: "light", units: "inches", installMode: recipe.wall ? "wall" : "freestanding", wallType: "wood_stud" },
  };
  return { project, count, size };
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
export function validateRecipe(recipe: Recipe, built: RecipeBuild, prompt: string): string[] {
  const fail: string[] = [];
  const { project, count } = built;
  const want = typedSize(prompt, recipe);
  const typed = typedSize(prompt, recipe);
  for (const a of ["width", "height", "depth"] as const) {
    if (typed[a] != null && Math.abs(project.overall[a] - (want[a] ?? 0)) > 0.01) fail.push(`typed ${a} ${want[a]} not honored`);
  }
  const boxes = projectBoxes(project);
  if (boxes.length < 3) fail.push("closed shell: fewer than 3 parts");
  // The parts reach the overall box on every axis (nothing outside it; a real build fills its envelope).
  const ext = (a: "x" | "y" | "z", s: "width" | "height" | "depth") => {
    const lo = Math.min(...project.panels.map((p) => p.position[a]));
    const hi = Math.max(...project.panels.map((p) => p.position[a] + p.size[s]));
    if (lo < -0.01 || hi > project.overall[s] + 0.01) fail.push(`parts leave the ${s}`);
  };
  ext("x", "width"); ext("y", "height"); ext("z", "depth");
  // One box filling the envelope is the closed-shell fallback.
  const vol = project.overall.width * project.overall.height * project.overall.depth;
  if (project.panels.some((p) => p.size.width * p.size.height * p.size.depth > 0.6 * vol)) fail.push("closed shell: one part fills the envelope");
  for (const role of recipe.defining ?? []) {
    const names = recipe.parts.filter((p) => p.role === role).map((p) => p.name);
    if (!project.panels.some((p) => names.includes(p.name) || names.includes(p.name.replace(/ \d+$/, "")))) fail.push(`missing ${role}`);
  }
  const reps = recipe.parts.filter((p) => p.repeat === "each" || p.repeat === "stair");
  if (recipe.count && reps.length && project.panels.filter((p) => p.name.replace(/ \d+$/, "") === reps[0].name).length !== count) fail.push(`count ${count} not built`);
  // Load path: each part touches what carries it; a part on nothing stands on the floor (or the wall).
  const byName = (name: string) => boxes.filter((b) => b.role === name || b.role.replace(/ \d+$/, "") === name);
  for (const part of recipe.parts) {
    for (const b of byName(part.name)) {
      if (part.on?.length) {
        const carriers = part.on.flatMap(byName);
        if (!carriers.some((c) => c !== b && boxGap(b, c) <= CONTACT_GAP)) fail.push(`${b.role} does not touch ${part.on.join(" or ")}`);
      } else if (!recipe.wall && b.c.y - b.h[1] > 0.01 && !boxes.some((f) => f.role === `Foot under ${b.role}` && boxGap(b, f) <= CONTACT_GAP)) fail.push(`${b.role} floats: it stands on nothing`);
    }
  }
  if (!recipe.wall && uprights(project.panels)) {
    const f = footprint(project.panels);
    if (tippy(f, project.overall)) fail.push(`tips: floor footprint ${fmtIn(f.z[1] - f.z[0])} deep under a ${fmtIn(project.overall.height)} build`);
    if (f.com.x < f.x[0] || f.com.x > f.x[1] || f.com.z < f.z[0] || f.com.z > f.z[1]) fail.push("tips: center of mass outside the footprint");
  }
  return [...new Set(fail)];
}

export type LookupOutcome = { project: YardProject; recipe: Recipe | null; rough: boolean; calls: number; unavailable?: boolean };
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
  for (let call = 1; call <= 2; call++) {
    let raw: unknown = null;
    try {
      raw = await lookup(prompt, call > 1 ? feedback : undefined);
    } catch (e) {
      // No AI here: the engine's own build stays, with no rough label and no second call.
      if ((e as Error).message === UNAVAILABLE) return { project: rough(), recipe: null, rough: false, calls: call, unavailable: true };
    }
    const recipe = parseRecipe(raw);
    if (!recipe) { feedback = [lastParseProblem || "the reply had no usable recipe"]; continue; }
    const built = buildRecipe(recipe, prompt, materialOverride);
    feedback = validateRecipe(recipe, built, prompt);
    if (!feedback.length) {
      rememberRecipe(recipe);
      return { project: built.project, recipe, rough: false, calls: call };
    }
  }
  const shape = rough();
  return { project: { ...shape, notes: [roughNote(shape.name, feedback), ...(shape.notes ?? [])] }, recipe: null, rough: true, calls: 2 };
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
export function timedLookup(call: (feedback?: string[]) => Promise<{ ok: boolean; recipeJson?: string; error?: string }>, ms = 75_000): Lookup {
  return async (_prompt, feedback) => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => (id = setTimeout(() => reject(new Error("timeout")), ms)));
    const r = await Promise.race([call(feedback), timer]).finally(() => clearTimeout(id));
    if (!r.ok) throw new Error(/not available/i.test(r.error ?? "") ? UNAVAILABLE : r.error ?? "lookup failed");
    return r.recipeJson ? JSON.parse(r.recipeJson) : null;
  };
}
