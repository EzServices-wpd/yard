#!/usr/bin/env -S npx tsx
/**
 * Daily feedback digest: reads the feedback queue and the day's build events from Upstash and writes one markdown
 * summary (src/lib/feedback/digest.ts). Read-only: it never deletes, marks or rewrites anything in the store.
 *
 *   npx tsx scripts/feedback-digest.ts                      yesterday (UTC), printed
 *   npx tsx scripts/feedback-digest.ts --day 2026-11-19 --out digests/2026-11-19.md
 *   npx tsx scripts/feedback-digest.ts --input fixture.json  render a saved DigestInput, no store (tests, dry runs)
 *
 * Env: KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN), the same as the site. With no store
 * env it says so and exits 2. Reads count against the shared monthly command budget like every other call.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { digestMarkdown, type DigestInput } from "../src/lib/feedback/digest";
import { ShopStore } from "../src/lib/feedback/store.server";

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
  if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(resolve(out), page + "\n"); console.error(`wrote ${out}`); }
  else process.stdout.write(page + "\n");
}
await main();
