/**
 * Build and validate a recipe (spec 001 R3/R4): every part is a box placed by its shares of the overall
 * size, a typed count repeats the counted parts, and the build passes the standard checks (load path,
 * no closed shell, typed size and count honored, defining roles present) before it is used. A lookup
 * recipe that fails is retried once with the failures fed back; a second failure is a labelled rough shape.
 */
import { getCatalogItem } from "./catalog";
import { boxGap, projectBoxes, CONTACT_GAP } from "./contact";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { parseRecipe, rememberRecipe, type Recipe, type RecipePart } from "./recipes";
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

function panelType(p: RecipePart, s: Size): PanelType {
  if (p.kind === "cover") return "back";
  if (p.kind === "hardware") return "cleat";
  const tall = s.height >= Math.max(s.width, s.depth);
  if (p.kind === "member") return tall ? "upright" : "rail";
  return s.height <= Math.min(s.width, s.depth) ? "shelf" : "side";
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
        type: panelType(part, sz),
        name: reps > 1 || part.kind === "hardware" ? `${part.name} ${n}` : part.name,
        position: { x: px * size.width, y: py * size.height, z: pz * size.depth },
        size: sz,
        materialId: part.kind === "hardware" ? part.catalogId ?? "hardware" : (stock.all ? undefined : part.stock) ?? (part.kind === "member" ? stock.member : stock.sheet),
      });
    }
  }
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
    notes: [`${recipe.title}${counted.length ? `, ${counted.join(", ")}` : ""}: built from its defining parts (${[...new Set(recipe.parts.map((p) => p.role))].join(", ")}).`, ...recipe.notes, ...(stock.craft ? ["Glue the joints."] : []), ...(stock.refused ? [stock.refused] : []), ...(recipe.outdoor ? ["Outdoors: cedar or pressure-treated stock and exterior screws."] : [])],
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

export type LookupOutcome = { project: YardProject; recipe: Recipe | null; rough: boolean; calls: number };
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
    const recipe = parseRecipe(await lookup(prompt, call > 1 ? feedback : undefined).catch(() => null));
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
