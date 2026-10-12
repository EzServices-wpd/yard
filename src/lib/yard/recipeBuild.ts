/**
 * Build and validate a recipe (spec 001 R3/R4): every part is a box placed by its shares of the overall
 * size, a typed count repeats the counted parts, and the build passes the standard checks (load path,
 * no closed shell, typed size and count honored, defining roles present) before it is used. A lookup
 * recipe that fails is retried once with the failures fed back; a second failure is a labelled rough shape.
 */
import { getCatalogItem } from "./catalog";
import { boxGap, projectBoxes, CONTACT_GAP } from "./contact";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { findRecipe, parseRecipe, rememberRecipe, type Recipe, type RecipePart } from "./recipes";
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
const PIN = /\b(?:axle|pivot|shaft|pin|spindle|hinge pin)s?\b/i;
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
  for (const part of recipe.parts) {
    const reps = part.repeat === "each" || part.repeat === "stair" ? count : part.repeat === "between" ? count + 1 : 1;
    for (let i = 0; i < reps; i++) {
      const [x, y, z, w, h, d] = part.box;
      const cell = part.repeat === "each" ? 1 / count : 1;
      const px = part.repeat === "between" ? Math.min(Math.max(i / count - w / 2, 0), 1 - w) : part.repeat === "each" ? (i + x) * cell : x;
      const pw = part.repeat === "each" ? w * cell : w;
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
        name: reps > 1 || part.kind === "hardware" ? `${part.name} ${n}` : part.name,
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
  const pins = panels.filter((p) => /^dowel-/.test(p.materialId) && PIN.test(p.name));
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
    notes: [`${recipe.title}${counted.length ? `, ${counted.join(", ")}` : ""}: built from its defining parts (${[...new Set(recipe.parts.map((p) => p.role))].join(", ")}).`, ...recipe.notes, ...moving, ...(stock.craft ? ["Glue the joints."] : []), ...(stock.refused ? [stock.refused] : []), ...(recipe.outdoor ? ["Outdoors: cedar or pressure-treated stock and exterior screws."] : [])],
    sizedByBuilder: true,
    assumptions: { load: "light", units: "inches", installMode: recipe.wall ? "wall" : "freestanding", wallType: "wood_stud" },
  };
  return { project, count, size };
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
      } else if (!recipe.wall && b.c.y - b.h[1] > 0.01) fail.push(`${b.role} floats: it stands on nothing`);
    }
  }
  return [...new Set(fail)];
}

export type LookupOutcome = { project: YardProject; recipe: Recipe | null; rough: boolean; calls: number; unavailable?: boolean };
export type Lookup = (prompt: string, feedback?: string[]) => Promise<unknown>;

/** The plain label a rough shape carries, in positive words. */
export function roughNote(title: string, failures: string[]): string {
  return `Shown as a rough shape: the real ${title.toLowerCase()} parts come next${failures.length ? ` (${failures.slice(0, 3).join("; ")})` : ""}.`;
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
    if (!recipe) { feedback = ["the recipe was missing fields or had a part on an unknown support"]; continue; }
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
 * built a generic body or a build whose name shares no word with what was typed (a silent template swap).
 */
export function needsRecipeLookup(project: YardProject, prompt: string, engineOwns: boolean): boolean {
  if (engineOwns || findRecipe(prompt)) return false;
  if (project.unmatched) return true;
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
    const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    const r = await Promise.race([call(feedback), timer]);
    if (!r.ok) throw new Error(/not available/i.test(r.error ?? "") ? UNAVAILABLE : r.error ?? "lookup failed");
    return r.recipeJson ? JSON.parse(r.recipeJson) : null;
  };
}
