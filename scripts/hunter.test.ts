import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hunterCorpus, hunterHits } from "./hunter-lib.ts";
import { HUNTER_CHECKS } from "../src/lib/yard/hunter.ts";

// I37 silent-fallback hunter, non-blocking ratchet: the known hits (evals/hunter-baseline.json, each with a reason)
// pass; only a NEW hit fails, and a known hit that no longer fires (STALE) fails until its entry is deleted.
const base: Record<string, string> = JSON.parse(readFileSync(new URL("../evals/hunter-baseline.json", import.meta.url), "utf8")).known;

test("hunter ratchet over the eval corpus: no new hit, no stale baseline entry", () => {
  const rows = hunterCorpus();
  assert.ok(rows.length >= 500, `corpus has ${rows.length} prompts`);
  const now = hunterHits(rows);
  const fresh = [...now.keys()].filter((k) => !(k in base)).map((k) => `NEW ${k} [${now.get(k)!.where}: ${now.get(k)!.match}]`);
  const stale = Object.keys(base).filter((k) => !now.has(k)).map((k) => `STALE ${k} (fixed: delete it from evals/hunter-baseline.json)`);
  assert.deepEqual([...fresh, ...stale], []);
});

test("every known hunter hit names a sub-check and a reason", () => {
  for (const [k, why] of Object.entries(base)) {
    assert.ok(HUNTER_CHECKS.some((c) => k.startsWith(`${c}: `)), k);
    assert.ok(why.length > 20, `${k} has no reason`);
    // Each hit carries its own true reason (rows 179/183): a wrong build points at the backlog row that owns it, a right
    // build says why it is right, and the reason names its own prompt so boilerplate can't stand in for it.
    const prompt = k.slice(k.indexOf("|") + 1);
    assert.match(why, /^(?:WRONG (?:BUILD|TEXT) \(row \d+\)|COSMETIC \(build right\)|DEFENSIBLE \([^)]*\)):/, `${k}: reason opens with its verdict`);
    assert.ok(why.includes(`'${prompt}'`), `${k}: reason names its own prompt`);
  }
});
