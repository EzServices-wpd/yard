/**
 * Build cache for the eval gate: one graded row per prompt, keyed by everything the row can depend on.
 *
 * Every build is deterministic (the same prompt on the same tree builds the same model), so a row graded once for a
 * tree is the row it would grade again. The cache stores the gate's own JSON row (PromptResult), never a live project,
 * so no caller can see a shared or JSON-round-tripped build.
 *
 * Key = sha256 of
 *   - SCHEMA (bump it when PromptResult changes shape),
 *   - the Node version,
 *   - every file under <root>/src, plus <root>/package-lock.json, <root>/tsconfig.json and
 *     <root>/evals/invariants-baseline.json (the row's "known" flags read it),
 *   - the grader that writes the row: GRADER_FILES from the head checkout (both sides are graded with the head's
 *     grader and expected refusals),
 *   - the entry itself (prompt, sources, ids, demands, expect).
 * A change to any of those is a miss. Canaries and answer keys are never cached: they always build fresh.
 *
 * Off with YARD_BUILD_CACHE=0 or --no-cache. Lives in .cache/yard-gate (gitignored); CI restores it with actions/cache.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const SCHEMA = "gate-row-v1";

/** The head's grading code and data a row is written by (eval-gate-lib.ts and what it reads). */
export const GRADER_FILES = [
  "scripts/build-cache.ts",
  "scripts/eval-gate-lib.ts",
  "scripts/eval-gate-typed.ts",
  "scripts/eval-gate-refusal.ts",
  "evals/expected-refusals.json",
] as const;

/** Files of the checkout under test that a row reads, besides src/. */
export const ROOT_FILES = ["package-lock.json", "tsconfig.json", "evals/invariants-baseline.json"] as const;

/** Every file under dir, as sorted paths relative to base (POSIX separators, so the key is the same on any OS). */
export function walk(base: string, dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const go = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules" || name === ".git") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) go(p);
      else out.push(relative(base, p).split("\\").join("/"));
    }
  };
  go(dir);
  return out.sort();
}

/** Hash of the tree a row depends on (everything but the entry). Same tree, same key; any byte changed, new key. */
export function treeKey(root: string, graderRoot: string, node = process.version): string {
  const h = createHash("sha256");
  const add = (label: string, base: string, rel: string) => {
    const f = join(base, rel);
    h.update(`${label}:${rel}\0`);
    h.update(existsSync(f) ? readFileSync(f) : "<missing>");
    h.update("\0");
  };
  h.update(`${SCHEMA}\0node ${node}\0`);
  for (const rel of walk(root, join(root, "src"))) add("root", root, rel);
  for (const rel of ROOT_FILES) add("root", root, rel);
  for (const rel of GRADER_FILES) add("grader", graderRoot, rel);
  return h.digest("hex");
}

/** Hash of one corpus entry: every field of it, in a fixed key order. */
export function entryKey(entry: unknown): string {
  return createHash("sha256").update(stableJson(entry)).digest("hex");
}

function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(",")}}`;
}

export type RowCache<Row> = { get: (entry: unknown) => Row | undefined; put: (entry: unknown, row: Row) => void; hits: () => number; misses: () => number; dir: string | null };

export function cacheEnabled(argv: string[] = process.argv): boolean {
  return process.env.YARD_BUILD_CACHE !== "0" && !argv.includes("--no-cache");
}

/** A row cache for one tree. dir null (cache off) gives a cache that never hits and never writes. */
export function rowCache<Row>(root: string, graderRoot: string, cacheRoot: string | null = defaultCacheRoot(graderRoot)): RowCache<Row> {
  let hits = 0, misses = 0;
  if (!cacheRoot) {
    return {
      get: () => {
        misses++;
        return undefined;
      },
      put: () => {},
      hits: () => hits,
      misses: () => misses,
      dir: null,
    };
  }
  const dir = join(resolve(cacheRoot), treeKey(root, graderRoot));
  // Mark the tree used now, so CI can drop every tree directory this run did not touch before it saves the cache.
  if (existsSync(dir)) { const now = new Date(); utimesSync(dir, now, now); }
  return {
    dir,
    get(entry) {
      const f = join(dir, `${entryKey(entry)}.json`);
      if (!existsSync(f)) { misses++; return undefined; }
      try { const row = JSON.parse(readFileSync(f, "utf8")) as Row; hits++; return row; } catch { misses++; return undefined; }
    },
    put(entry, row) {
      mkdirSync(dir, { recursive: true });
      const f = join(dir, `${entryKey(entry)}.json`);
      // Write then rename: parallel gate workers never read a half-written row.
      const tmp = `${f}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(row));
      renameSync(tmp, f);
    },
    hits: () => hits,
    misses: () => misses,
  };
}

export function defaultCacheRoot(graderRoot: string): string | null {
  return cacheEnabled() ? (process.env.YARD_BUILD_CACHE_DIR ?? join(graderRoot, ".cache/yard-gate")) : null;
}
