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
  repeat?: "each" | "between";
  /** A catalog id for a hardware part. */
  catalogId?: string;
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
  /** A typed count that repeats parts along the width ("3 bays"). */
  count?: { word: string; default: number };
  parts: RecipePart[];
  moving?: { part: string; motion: "fold" | "hinge" | "pivot" | "spin" | "slide" }[];
  notes: string[];
};

export type RecipeStore = { schema: number; recipes: Recipe[] };

export const RECIPES: RecipeStore = store as RecipeStore;

/** Lower case, sizes, stock words and articles out: the words that name the thing. */
export function normalizeNoun(prompt: string): string {
  return ` ${prompt.toLowerCase()} `
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:x|by)\s*\d+(?:\.\d+)?\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:'|ft|foot|feet|in|inch|inches)?\b/g, " ")
    .replace(/\b(?:a|an|the|for|kids?|from|of|made|out|with|and|wide|tall|high|deep|long)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => new RegExp(String.raw`(?:^|\s)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}s?(?:\s|$)`);

/** The recipe a prompt names: the longest key or synonym found in it, with every modifier present. */
export function findRecipe(prompt: string, lib: RecipeStore = RECIPES): Recipe | null {
  const noun = normalizeNoun(prompt);
  const lower = prompt.toLowerCase();
  let best: { r: Recipe; len: number } | null = null;
  for (const r of lib.recipes) {
    if (r.modifiers?.some((m) => !lower.includes(m))) continue;
    for (const name of [r.key.replace(/-/g, " "), ...r.synonyms]) {
      if (words(name).test(noun) && (!best || name.length > best.len)) best = { r, len: name.length };
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
export function parseRecipe(raw: unknown): Recipe | null {
  const r = raw as Partial<Recipe> | null;
  if (!r || typeof r.key !== "string" || typeof r.title !== "string" || !r.size || !Array.isArray(r.parts) || !r.parts.length) return null;
  const okSize = (s: unknown) => !!s && ["width", "height", "depth"].every((a) => Number((s as Record<string, unknown>)[a]) > 0);
  if (!okSize(r.size) || (r.craftSize && !okSize(r.craftSize))) return null;
  const names = new Set(r.parts.map((p) => p?.name));
  for (const p of r.parts) {
    if (!p || typeof p.role !== "string" || typeof p.name !== "string" || !["member", "panel", "cover", "hardware"].includes(p.kind)) return null;
    if (!Array.isArray(p.box) || p.box.length !== 6 || p.box.some((v) => typeof v !== "number" || v < -0.5 || v > 1.5)) return null;
    if (p.on?.some((n) => !names.has(n))) return null;
  }
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
    count: r.count,
    parts: r.parts,
    moving: r.moving,
    notes: Array.isArray(r.notes) ? r.notes.filter((n) => typeof n === "string") : [],
  };
}
