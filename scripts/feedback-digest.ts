#!/usr/bin/env -S npx tsx
/**
 * Daily feedback digest: reads the feedback queue and the day's build events from Upstash and writes one markdown
 * summary (src/lib/feedback/digest.ts). Read-only: it never deletes, marks or rewrites anything in the store.
 *
 *   npx tsx scripts/feedback-digest.ts                      yesterday (UTC), printed to stdout
 *   npx tsx scripts/feedback-digest.ts --day 2026-11-19 --out /tmp/2026-11-19.md
 *   npx tsx scripts/feedback-digest.ts --input fixture.json  render a saved DigestInput, no store (tests, dry runs)
 *
 * The page quotes typed words, so it stays on stdout or a path outside this repo. The repo is public: --out inside
 * the repo is refused, and this script never opens a GitHub issue. With no store env it says so and exits 2.
 * Reads count against the events command budget (ev:cmds), not the Ideas log.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { digestMarkdown, type DigestInput } from "../src/lib/feedback/digest";
import { ShopStore } from "../src/lib/feedback/store.server";

/** Repo root. A digest path inside it would be one commit away from the public repo. */
export const DIGEST_REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * True when `out` is outside the repo after symlinks are followed. A path inside the repo, the repo
 * itself, or a symlink whose target is inside the repo, is refused.
 */
/** A symlink whose target does not exist. lstat sees the link; realpath throws. */
function danglingSymlink(p: string): boolean {
  let link = false;
  try { link = lstatSync(p).isSymbolicLink(); } catch { return false; }
  if (!link) return false;
  try { realpathSync(p); return false; } catch { return true; }
}

export function digestOutAllowed(out: string, repoRoot = DIGEST_REPO_ROOT): boolean {
  const abs = resolve(out);
  let root: string;
  try { root = realpathSync(resolve(repoRoot)); } catch { root = resolve(repoRoot); }
  let walk = abs;
  for (;;) {
    if (danglingSymlink(walk)) return false;
    const parent = dirname(walk);
    if (parent === walk) break;
    walk = parent;
  }
  const missing: string[] = [];
  let cursor = abs;
  while (!existsSync(cursor)) {
    missing.push(basename(cursor));
    const parent = dirname(cursor);
    if (parent === cursor) return false;
    cursor = parent;
  }
  let real: string;
  try { real = realpathSync(cursor); } catch { return false; }
  for (const part of missing.reverse()) real = join(real, part);
  if (real === root) return false;
  const prefix = root.endsWith(sep) ? root : root + sep;
  return !real.startsWith(prefix);
}

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function main() {
  const day = arg("--day") ?? yesterday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day wants YYYY-MM-DD, got ${day}`);
  let input: DigestInput | null;
  if (arg("--input")) input = { ...(JSON.parse(readFileSync(resolve(arg("--input")!), "utf8")) as DigestInput), day };
  else {
    const store = new ShopStore();
    if (!store.live) { console.error("feedback-digest: no store env (KV_REST_API_URL / KV_REST_API_TOKEN); nothing read"); process.exitCode = 2; return; }
    input = await store.digestInput(day);
    if (!input) { console.error("feedback-digest: the store did not answer, or the monthly budget is spent"); process.exitCode = 1; return; }
  }
  const page = digestMarkdown(input);
  const out = arg("--out");
  if (out) {
    if (!digestOutAllowed(out)) {
      console.error("feedback-digest: --out must be outside the repo (the repo is public, and this page quotes typed words). Nothing written.");
      process.exitCode = 2;
      return;
    }
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), page + "\n");
    console.error(`wrote ${out}`);
  } else process.stdout.write(page + "\n");
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
