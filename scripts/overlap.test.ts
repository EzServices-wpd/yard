import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { overlaps } from "../src/lib/yard/overlaps.ts";
import { offline } from "./eval-lib.ts";
import { corpus } from "./invariants-corpus.ts";

/**
 * I16 no interpenetration (F30): no two parts share more than 1/16" of space on all three axes unless the
 * overlap is a modelled joint (dado, rabbet, lap, mortise, mitre, notch declared on either part).
 * Shaped parts (struts, cones, polygons, rotated or curved outlines) are judged by their drawn shape elsewhere
 * (I5), so only plain boxes are compared here. Known violations live in evals/overlap-baseline.json.
 */
const base: Record<string, number> = JSON.parse(readFileSync(new URL("../evals/overlap-baseline.json", import.meta.url), "utf8")).known;

test("I16 coop: the floor is notched around the legs and nothing else interpenetrates", () => {
  for (const q of ["chicken coop", "rabbit hutch", "hamster cage", "chicken coop 60 wide 48 deep 72 tall"]) assert.deepEqual(overlaps(generateFromPrompt(q)), [], q);
});

test("I16 ratchet over the corpus: no new overlap, no stale baseline entry", () => {
  const now = new Map<string, number>();
  offline(() => { for (const q of corpus()) { try { const n = overlaps(generateFromPrompt(q)).length; if (n) now.set(q, n); } catch { /* I1 reports builds that throw */ } } });
  const fresh = [...now].filter(([q, n]) => !(q in base) || n > base[q]).map(([q, n]) => `NEW ${q}: ${n} overlaps (baseline ${base[q] ?? 0})`);
  const stale = Object.entries(base).filter(([q, n]) => (now.get(q) ?? 0) < n).map(([q, n]) => `STALE ${q}: ${now.get(q) ?? 0} < ${n}, lower or delete it in evals/overlap-baseline.json`);
  assert.deepEqual([...fresh, ...stale], []);
});
