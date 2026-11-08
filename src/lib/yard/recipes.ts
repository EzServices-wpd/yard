/**
 * The recipe library: a named object with no family or template is built from a structured recipe of its
 * defining parts (role, place as a share of the overall, what carries it), never a closed shape or the
 * nearest template. Recipes are committed in recipes.json, keyed by the normalized noun plus modifiers with
 * synonyms, versioned, and carry a trust state that Critic grades promote or demote.
 */
import store from "./recipes.json";

export type Trust = "candidate" | "trusted";
export type PartKind = "member" | "panel" | "cover" | "hardware";

export type RecipePart = {
  role: string;
  name: string;
  /** x, y, z, width, height, depth as shares of the overall W, H, D (0..1). */
  box: [number, number, number, number, number, number];
  kind: PartKind;
  /** Names of the parts that carry this one; empty means it stands on the floor or hangs on the wall. */
  on?: string[];
  /** "each" repeats the part once per counted unit, "between" once per boundary (count + 1). */
  repeat?: "each" | "between" | "stair";
  /** Copies on each carrier (beads per rod), stacked one box-height apart along the carrier; its own count. */
  per?: number;
  /** Catalog stock for this part when no stock is typed (4x4 posts under 2x6 beams). */
  stock?: string;
  /** A catalog id for a hardware part. */
  catalogId?: string;
  /** Round parts: a disc (solid wheel), ring (rim), cylinder (axle, drum) or bead (bored). Default box. */
  shape?: "disc" | "ring" | "cylinder" | "bead" | "dome" | "cone";
  /** "apex": a pole leans from its foot to the top centre of the build (a tipi's poles). */
  lean?: "apex";
  /** A spoke part fans this many copies round the wheel's centre, each a rod across the wheel. */
  spokes?: number;
  /** Through-bore diameter in inches (bead on a rod, wheel on an axle); a ring's rim width when shape is ring. */
  bore?: number;
  /** A drilled hole array in its largest face (a cribbage board's peg tracks): count holes of dia inches in rows. */
  holes?: { count: number; dia: number; rows?: number };
  /** Stands proud of the stated size on purpose (pegs set in a board's holes), like a proud door: the height guard skips it. */
  proud?: boolean;
};

export type Recipe = {
  key: string;
  synonyms: string[];
  /** Words that must appear with the noun ("propeller"); the key already names the head noun. */
  modifiers?: string[];
  version: number;
  trust: Trust;
  title: string;
  /** Typical real size in inches; craftSize when it is built from craft stock. */
  size: { width: number; height: number; depth: number };
  craftSize?: { width: number; height: number; depth: number };
  /** Read a bare "10x10" as feet. */
  feet?: boolean;
  outdoor?: boolean;
  /** Hangs on the wall: parts with nothing under them hang there instead of standing on the floor. */
  wall?: boolean;
  /** Default catalog stock for members and for sheet parts; typed stock replaces them. */
  stock?: string;
  sheet?: string;
  /** Roles that make the thing what it is; each must be built. */
  defining?: string[];
  /** A typed count that repeats parts along the width ("3 bays"). */
  count?: { word: string; default: number; unit?: { width?: number; height?: number; depth?: number } };
  parts: RecipePart[];
  moving?: { part: string; motion: "fold" | "hinge" | "pivot" | "spin" | "slide" }[];
  notes: string[];
  /** Learned on the live site (recipe bot), not a seed recipe: it must pass the learned-recipe checks. */
  learned?: boolean;
  /** Why the recipe is held off the Ideas library (a Critic fail); cleared only when it passes again. */
  held?: string;
};

export type RecipeStore = { schema: number; recipes: Recipe[] };

export const RECIPES: RecipeStore = store as RecipeStore;

/** Lookup recipes that passed on this instance, until they are committed to recipes.json. */
// Kept in this browser too, so a reload or rerun shows a passed recipe at once instead of learning it again.
const LEARNED_KEY = "yard.learnedRecipes.v1";
const local = () => (typeof localStorage !== "undefined" ? localStorage : null);
const learned: Recipe[] = (() => { try { return JSON.parse(local()?.getItem(LEARNED_KEY) ?? "[]") as Recipe[]; } catch { return []; } })();
export function rememberRecipe(recipe: Recipe): void {
  const i = learned.findIndex((r) => r.key === recipe.key);
  if (i >= 0) learned.splice(i, 1);
  learned.push(recipe);
  try { local()?.setItem(LEARNED_KEY, JSON.stringify(learned.slice(-40))); } catch { /* storage full or blocked: memory only */ }
}
const withLearned = (): RecipeStore => (learned.length ? { ...RECIPES, recipes: [...RECIPES.recipes, ...learned] } : RECIPES);

/** Lower case, sizes, stock words and articles out: the words that name the thing. */
export function normalizeNoun(prompt: string): string {
  return ` ${prompt.toLowerCase()} `
    .replace(/[^a-z0-9\s'-]/g, " ")
    // "from maple", "made of cedar", "out of 2x4": the stock it is made from, not its name.
    .replace(/\b(?:from|made (?:of|from)|out of)\b.*$/, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:x|by)\s*\d+(?:\.\d+)?\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:'|ft|foot|feet|in|inch|inches)?\b/g, " ")
    .replace(/\b(?:a|an|the|for|kids?|from|of|made|out|with|and|wide|tall|high|deep|long)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => new RegExp(String.raw`(?:^|\s)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}s?(?:\s|$)`);

/** The recipe a prompt names: the longest key or synonym found in it, with every modifier present. */
export function findRecipe(prompt: string, lib: RecipeStore = withLearned()): Recipe | null {
  const noun = normalizeNoun(prompt).replace(/-/g, " ");
  const lower = prompt.toLowerCase();
  let best: { r: Recipe; len: number } | null = null;
  for (const r of lib.recipes) {
    if (r.modifiers?.some((m) => !lower.includes(m))) continue;
    // A learned recipe answers only to its typed noun: an AI synonym ("planter box" on window box) would take
    // over a noun the engine builds.
    for (const name of [r.key.replace(/-/g, " "), ...(r.learned ? [] : r.synonyms)]) {
      if (words(name.replace(/-/g, " ")).test(noun) && (!best || name.length > best.len)) best = { r, len: name.length };
    }
  }
  return best?.r ?? null;
}

/** A Critic grade moves a recipe's trust: a pass promotes a candidate, a fail demotes a trusted one. */
export function gradeRecipe(lib: RecipeStore, key: string, grade: "pass" | "fail"): RecipeStore {
  return {
    ...lib,
    recipes: lib.recipes.map((r) =>
      r.key !== key ? r : { ...r, trust: grade === "pass" ? "trusted" : "candidate", version: grade === "fail" && r.trust === "trusted" ? r.version + 1 : r.version },
    ),
  };
}

/** Add or replace a recipe; a replaced recipe gets the next version and starts as a candidate. */
export function saveRecipe(lib: RecipeStore, recipe: Recipe): RecipeStore {
  const old = lib.recipes.find((r) => r.key === recipe.key);
  const next = { ...recipe, version: old ? old.version + 1 : 1, trust: "candidate" as Trust };
  return { ...lib, recipes: [...lib.recipes.filter((r) => r.key !== recipe.key), next] };
}

/** A recipe from the lookup is accepted only when every field the build reads is there and in range. */
/** One spelling per part: "paddle-wheel" and "Paddle_Wheel" are "Paddle wheel"; roles are lower case and singular. */
// camelCase and snake_case names read as words ("leftLegA" is "Left leg A"), never "Leftlega".
export const partName = (n: string) => n.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase()).replace(/ ([a-z])$/, (_m, c: string) => ` ${c.toUpperCase()}`);
export const partRole = (n: string) => n.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/(?<=[^s])s$/, "");

/** Why the last lookup reply could not be used, for the one retry's feedback. */
export let lastParseProblem = "";

/**
 * A recipe from the lookup is repaired before it is judged: a JSON string or fenced text is parsed,
 * numbers given as strings are read, names and roles get one spelling, optional fields are filled,
 * a support or defining role that names no part is dropped, a box is clamped into the envelope and
 * an unknown kind reads as a member. Only a reply with no title, size or parts is refused.
 */
export function parseRecipe(raw: unknown): Recipe | null {
  lastParseProblem = "";
  let r0 = raw as Record<string, any> | null;
  if (typeof raw === "string") {
    try { r0 = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "")); } catch { lastParseProblem = "the reply was not JSON"; return null; }
  }
  if (r0 && typeof r0 === "object" && !Array.isArray(r0.parts) && r0.recipe && typeof r0.recipe === "object") r0 = r0.recipe;
  if (!r0 || typeof r0 !== "object") { lastParseProblem = "the reply was empty"; return null; }
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN);
  const sizeOf = (s: any) => (s && typeof s === "object" ? { width: num(s.width), height: num(s.height), depth: num(s.depth) } : null);
  const okSize = (s: { width: number; height: number; depth: number } | null) => !!s && [s.width, s.height, s.depth].every((v) => Number.isFinite(v) && v > 0);
  const size = sizeOf(r0.size), craft = sizeOf(r0.craftSize);
  const title = typeof r0.title === "string" && r0.title.trim() ? r0.title.trim() : typeof r0.key === "string" ? r0.key.replace(/-/g, " ") : "";
  const rawParts: any[] = Array.isArray(r0.parts) ? r0.parts : [];
  if (!title || !okSize(size) || !rawParts.length) {
    lastParseProblem = `the recipe was missing ${[!title && "title", !okSize(size) && "size (width, height, depth in inches)", !rawParts.length && "parts"].filter(Boolean).join(", ")}`;
    return null;
  }
  const parts = rawParts
    .filter((p) => p && typeof p === "object" && (typeof p.name === "string" || typeof p.role === "string") && Array.isArray(p.box) && p.box.length === 6)
    .map((p) => {
      const box = (p.box as unknown[]).map(num);
      if (box.some((v) => !Number.isFinite(v))) return null;
      const [x, y, z] = box.slice(0, 3).map((v) => Math.min(Math.max(v, 0), 1));
      const [w, h, d] = box.slice(3).map((v, k) => Math.min(Math.max(v, 0.005), 1 - [x, y, z][k]));
      const name = partName(String(p.name ?? p.role));
      return {
        ...p,
        name,
        role: partRole(String(p.role ?? p.name)),
        kind: ["member", "panel", "cover", "hardware"].includes(p.kind) ? p.kind : "member",
        box: [x, y, z, w, h, d] as RecipePart["box"],
        on: Array.isArray(p.on) ? p.on.filter((n: unknown) => typeof n === "string").map((n: string) => partName(n)) : undefined,
        ...(p.bore != null && Number.isFinite(num(p.bore)) ? { bore: num(p.bore) } : {}),
        ...(p.holes && num(p.holes.count) >= 1 && num(p.holes.dia) > 0 ? { holes: { count: Math.min(Math.round(num(p.holes.count)), 500), dia: num(p.holes.dia), ...(num(p.holes.rows) >= 1 ? { rows: Math.round(num(p.holes.rows)) } : {}) } } : {}),
      } as RecipePart;
    })
    .filter((p): p is RecipePart => !!p);
  if (!parts.length) { lastParseProblem = "no part had a name and a six-number box"; return null; }
  const names = new Set(parts.map((p) => p.name));
  for (const p of parts) if (p.on) p.on = p.on.filter((n) => names.has(n) && n !== p.name);
  const roles = new Set(parts.map((p) => p.role));
  const r = {
    ...r0,
    key: typeof r0.key === "string" && r0.key.trim() ? r0.key.trim().toLowerCase().replace(/\s+/g, "-") : title.toLowerCase().replace(/\s+/g, "-"),
    title,
    size: size!,
    craftSize: okSize(craft) ? craft! : undefined,
    defining: Array.isArray(r0.defining) ? r0.defining.filter((d: unknown) => typeof d === "string").map((d: string) => partRole(d)).filter((d: string) => roles.has(d)) : undefined,
    moving: Array.isArray(r0.moving) ? r0.moving.filter((m: any) => m && typeof m.part === "string").map((m: any) => ({ ...m, part: partName(m.part) })).filter((m: any) => names.has(m.part)) : undefined,
    parts,
  } as Partial<Recipe> & { parts: RecipePart[]; key: string; title: string; size: Recipe["size"] };
  return {
    key: r.key,
    synonyms: Array.isArray(r.synonyms) ? r.synonyms.filter((s) => typeof s === "string") : [],
    modifiers: r.modifiers,
    version: 1,
    trust: "candidate",
    title: r.title,
    size: r.size,
    craftSize: r.craftSize,
    feet: !!r.feet,
    outdoor: !!r.outdoor,
    wall: !!r.wall,
    stock: typeof r.stock === "string" ? r.stock : undefined,
    sheet: typeof r.sheet === "string" ? r.sheet : undefined,
    defining: r.defining,
    count: r.count && typeof r.count.word === "string" && Number.isFinite(num(r.count.default)) ? { ...r.count, default: num(r.count.default) } : undefined,
    parts: r.parts,
    moving: r.moving,
    notes: Array.isArray(r.notes) ? r.notes.filter((n) => typeof n === "string") : [],
  };
}
