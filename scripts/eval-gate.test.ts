import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { lengthIn, typedCounts, typedDemands, typedSizes } from "./eval-gate-typed.ts";
import { gradeCanary, loadCanaries, loadCorpus, loadEngine, totalsOf } from "./eval-gate-lib.ts";
import { diffGates, renderComment } from "./eval-gate-diff.ts";

// Expected values are hand-worked inches (independent of the engine's parser).
test("typed lengths: every way a woodworker writes 24 1/2 is 24.5", () => {
  for (const q of ["24 1/2", "24-1/2", "24½", "24.5", "24 1/2\"", "24 1/2 in", "24½″", "2' 1/2\"", "2 ft 1/2 in", "2'1/2\""]) assert.equal(lengthIn(q), 24.5, q);
  assert.equal(lengthIn("2' 6\""), 30);
  assert.equal(lengthIn("2 ft 6 in"), 30);
  assert.equal(lengthIn("3 ft"), 36);
  assert.equal(lengthIn("6 foot"), 72);
  assert.equal(lengthIn("31.5"), 31.5);
  assert.equal(lengthIn("3/4"), 0.75);
});
test("typed sizes land on their axis, W×D×H in order, fit targets and lumber skipped", () => {
  const ax = (q: string) => typedSizes(q).map((s) => `${s.axis}=${s.value_in}`).join(",");
  assert.equal(ax("shelf 24 1/2\" wide"), "W=24.5");
  assert.equal(ax("bookcase 2' 6\" wide 60 tall 12 deep"), "W=30,H=60,D=12");
  assert.equal(ax("bookcase 30 1/2x12x60"), "W=30.5,D=12,H=60");
  assert.equal(ax("bookshelf 36x12x72 that fits in a 40 inch alcove"), "W=36,D=12,H=72");
  assert.equal(ax("TV stand for 65 inch screen"), "");
  assert.equal(ax("coffee table made from 2x4s"), "");
  assert.equal(ax("cheap raised garden bed 4x8"), "unknown=48,unknown=96");
  assert.equal(ax("16d nail"), "");
  assert.equal(ax("dining table 8 ft long"), "L=96");
});
test("typed counts and the head noun", () => {
  assert.deepEqual(typedCounts("walnut dresser 6 drawers 60 wide").map((c) => [c.thing, c.n]), [["drawers", 6]]);
  assert.deepEqual(typedCounts("2-step stool").map((c) => [c.thing, c.n]), [["steps", 2]]);
  assert.deepEqual(typedCounts("2x4 legs"), []);
  assert.equal(typedDemands("walnut dresser 6 drawers 60 wide").head_noun?.value, "dresser");
  assert.equal(typedDemands("3 foot Eiffel Tower from popsicle sticks").head_noun?.value, "eiffel tower");
  assert.equal(typedDemands("something to hang my keys").head_noun, null);
  assert.equal(typedDemands("2x4 bench under $40").budget?.max_usd, 40);
});
test("corpus: sorted, deduped, no test traffic, every file has a source", () => {
  for (const f of readdirSync(new URL("../evals/corpus/", import.meta.url)).filter((x) => x.endsWith(".json"))) {
    const j = JSON.parse(readFileSync(new URL(`../evals/corpus/${f}`, import.meta.url), "utf8"));
    assert.ok(j.source || j.canaries || j.keys, f);
  }
  const c = loadCorpus();
  const qs = c.map((e) => e.prompt);
  assert.deepEqual(qs, [...qs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  assert.equal(new Set(qs).size, qs.length);
  assert.ok(!qs.some((q) => /critic[\s_-]*probe|\btest\b/i.test(q)));
});
test("canaries hold (hard fail, separate from the totals)", async () => {
  const E = await loadEngine();
  for (const c of loadCanaries()) { const r = gradeCanary(E, c); assert.ok(r.ok, `${c.id}: ${r.failures.join("; ")}`); }
});
test("diff: a newly failing prompt fails the gate unless allowed with a reason; a total drop fails", () => {
  const row = (prompt: string, grade: "pass" | "partial" | "fail") => ({ prompt, sources: ["t"], ids: [], grade, classes: grade === "pass" ? [] : ["F1"], header: null, overall: null, pieces: null, usd: null, honor: { honored: 1, checkable: 1, demandsFrom: "typed-rules", items: [] }, invariants: [] });
  const g = (rows: ReturnType<typeof row>[]) => ({ totals: totalsOf(rows), canaries: { ok: true, results: [] }, prompts: rows });
  const base = g([row("a", "pass"), row("b", "partial")]);
  const worse = g([row("a", "partial"), row("b", "pass")]);
  assert.equal(diffGates(base, worse, {}).ok, false);
  assert.equal(diffGates(base, worse, { newlyFailing: [{ prompt: "a", reason: "owned by #90" }] }).ok, true);
  assert.equal(diffGates(base, worse, { newlyFailing: [{ prompt: "a", reason: "" }] }).ok, false);
  assert.equal(diffGates(base, g([row("a", "partial"), row("b", "partial")]), { newlyFailing: [{ prompt: "a", reason: "x" }] }).ok, false);
  // A PR that edits the gate's own files is called out in the comment (head's grader grades both sides).
  const md = renderComment(diffGates(base, base, {}), { gateFiles: ["evals/gate-allow.json", "src/lib/yard/fitted.ts"] });
  assert.match(md, /changes the gate itself.*evals\/gate-allow\.json/);
  assert.doesNotMatch(md, /fitted\.ts/);
});
