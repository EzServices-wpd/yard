import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { lengthIn, typedCounts, typedDemands, typedSizes } from "./eval-gate-typed.ts";
import { HEAD_ROOT, REPORT_ONLY_IDS, TYPED_RULE_IDS, corpusPrompts, corpusRemovals, gradeCanary, gradeOf, gradeOne, isTestTraffic, keepCorpusRows, loadCanaries, loadCorpus, loadEngine, totalsOf } from "./eval-gate-lib.ts";
import { INVARIANT_CLASS, PER_BUILD } from "../src/lib/yard/invariants.ts";
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
});
test("test traffic is decided by the logged record (test=1, x-yard-test), never the prompt text", () => {
  const rec = (q: string, extra = "", headers?: Record<string, string>) => ({ url: `https://yard.wiki/workspace?q=${encodeURIComponent(q)}&offline=1${extra}`, headers });
  assert.equal(isTestTraffic(rec("test tube rack")), false);
  assert.equal(isTestTraffic(null), false);
  assert.equal(isTestTraffic(rec("bookcase", "&test=1")), true);
  assert.equal(isTestTraffic({ u: "https://yard.wiki/api/run-prompt?test=1" }), true);
  assert.equal(isTestTraffic(rec("bookcase", "", { "X-Yard-Test": "1" })), true);
  assert.equal(isTestTraffic(rec("bookcase", "&test=0", { "x-yard-test": "0" })), false);
  const kept = keepCorpusRows([
    { id: "a", prompt: "test tube rack", rec: rec("test tube rack") },
    { id: "b", prompt: "test tube rack for 12 tubes" },
    { id: "c", prompt: "bookcase 30 wide", rec: rec("bookcase 30 wide", "&test=1") },
    { id: "d", prompt: "shoe rack", rec: rec("shoe rack", "", { "x-yard-test": "1" }) },
    { id: "e", prompt: "Test Tube Rack", rec: rec("Test Tube Rack") },
  ]);
  assert.deepEqual(kept.map((r) => r.id), ["a", "b"]);
  assert.ok(kept.every((r) => !("rec" in r)));
});
test("canaries hold (hard fail, separate from the totals)", async () => {
  const E = await loadEngine();
  for (const c of loadCanaries()) { const r = gradeCanary(E, c); assert.ok(r.ok, `${c.id}: ${r.failures.join("; ")}`); }
});
test("linen canary is a full hard fail: moving one shelf 2\" fails even when header, parts, price and size hold", async () => {
  const E = await loadEngine();
  const linen = loadCanaries().find((c) => c.id === "linen")!;
  assert.equal(linen.baseline, "scripts/baselines/linen-closet.txt");
  assert.ok(gradeCanary(E, linen).ok);
  // Shelf 1 up 2": its marked height in the shelf step moves, nothing else does.
  const moved = { ...E, buildPlan: (p: unknown) => {
    const plan = E.buildPlan(p);
    return { ...plan, instructions: plan.instructions.map((s: { title: string; description: string }) => /adjustable shelves/.test(s.title) ? { ...s, description: s.description.replace('sit 16 1/16"', 'sit 18 1/16"').replace('(16 13/16"', '(18 13/16"') } : s) };
  } };
  const r = gradeCanary(moved, linen);
  assert.equal(r.ok, false);
  assert.equal(r.failures.length, 1, r.failures.join("; "));
  assert.match(r.failures[0], /plan differs from the baseline at line 8: .*18 1\/16/);
  assert.deepEqual(r.got, gradeCanary(E, linen).got);
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
test("corpus deletion fails the gate: a prompt in main's corpus missing from the PR's corpus needs evals/corpus-removals.json with a reason", () => {
  // The PR side: a copy of this checkout's corpus with one grok100 prompt deleted (the way a PR would hide a regression).
  const pr = mkdtempSync(join(tmpdir(), "eval-gate-drop-"));
  try {
    cpSync(join(HEAD_ROOT, "evals/corpus"), join(pr, "evals/corpus"), { recursive: true });
    cpSync(join(HEAD_ROOT, "evals/prompts.json"), join(pr, "evals/prompts.json"));
    const g100 = JSON.parse(readFileSync(join(pr, "evals/corpus/grok100.json"), "utf8"));
    const main = corpusPrompts(HEAD_ROOT);
    // Pick a grok100 prompt that no other corpus file also holds, so deleting it really removes it.
    const i = g100.prompts.findIndex((p: { prompt: string }) => (main.get(p.prompt.replace(/\s+/g, " ").trim()) ?? []).length === 1);
    const [gone] = g100.prompts.splice(i, 1);
    writeFileSync(join(pr, "evals/corpus/grok100.json"), JSON.stringify(g100, null, 1));
    const q = gone.prompt.replace(/\s+/g, " ").trim();
    const rm = corpusRemovals(main, corpusPrompts(pr));
    assert.deepEqual(rm.map((r) => [r.prompt, r.files, r.allowed]), [[q, ["evals/corpus/grok100.json"], null]]);
    assert.deepEqual(corpusRemovals(main, corpusPrompts(HEAD_ROOT)), []);
    // Both sides graded on the PR's corpus look identical: only the removal rule can catch it.
    const row = { prompt: "x", sources: ["t"], ids: [], grade: "pass" as const, classes: [], header: null, overall: null, pieces: null, usd: null, honor: { honored: 1, checkable: 1, demandsFrom: "typed-rules", items: [] }, invariants: [] };
    const gate = { totals: totalsOf([row]), canaries: { ok: true, results: [] }, prompts: [row] };
    assert.equal(diffGates(gate, gate, {}).ok, true);
    const d = diffGates(gate, gate, {}, undefined, rm);
    assert.equal(d.ok, false);
    assert.match(d.why.join("; "), /1 prompt\(s\) in main's corpus missing/);
    assert.match(renderComment(d), /Removed from main's corpus \(1\)/);
    assert.equal(diffGates(gate, gate, {}, undefined, corpusRemovals(main, corpusPrompts(pr), { removals: [{ prompt: q, reason: "   " }] })).ok, false);
    assert.equal(diffGates(gate, gate, {}, undefined, corpusRemovals(main, corpusPrompts(pr), { removals: [{ prompt: q, reason: "duplicate of review18 #4, Critic OK" }] })).ok, true);
    // The CI step itself (scripts/eval-gate-diff.ts, whose exit code is the job verdict): main = this checkout, PR = the copy.
    const gf = join(pr, "gate.json");
    writeFileSync(gf, JSON.stringify(gate));
    const cli = (headRoot: string) => spawnSync(process.execPath, [...process.execArgv, join(HEAD_ROOT, "scripts/eval-gate-diff.ts"), "--base", gf, "--head", gf, "--base-root", HEAD_ROOT, "--head-root", headRoot], { encoding: "utf8" });
    const bad = cli(pr);
    assert.equal(bad.status, 1, bad.stderr);
    assert.match(bad.stdout, /Eval gate ❌ fail/);
    assert.equal(cli(HEAD_ROOT).status, 0);
    // Fail closed: the CI step without main's checkout does not pass.
    const noBase = spawnSync(process.execPath, [...process.execArgv, join(HEAD_ROOT, "scripts/eval-gate-diff.ts"), "--base", gf, "--head", gf], { encoding: "utf8" });
    assert.notEqual(noBase.status, 0);
    assert.match(noBase.stderr, /--base-root <main checkout> is required/);
  } finally { rmSync(pr, { recursive: true, force: true }); }
});
test("recipe-bot auto-merge waits for the eval gate too, on the exact commit", () => {
  const y = readFileSync(join(HEAD_ROOT, ".github/workflows/recipe-automerge.yml"), "utf8");
  assert.match(y, /workflows: \[guards, eval-gate\]/);
  assert.match(y, /for wf in guards\.yml eval-gate\.yml; do/);
  assert.match(y, /\[ "\$got" = "completed\/success" \] \|\| \{[^}]*exit 0; \}/);
  // The merge comes after both checks.
  assert.ok(y.indexOf("eval-gate.yml; do") < y.indexOf("gh pr merge"));
  assert.match(readFileSync(join(HEAD_ROOT, ".github/workflows/eval-gate.yml"), "utf8"), /^name: eval-gate$/m);
});

test("a geometry report-only invariant ID never moves a prompt from pass to partial; PER_BUILD and typed-word rules still grade (row 181, #110 B1)", async () => {
  // Exactly the geometry report-only IDs Critic allowed (#110 B1); nothing else is dropped.
  const reportOnly = [...REPORT_ONLY_IDS].sort();
  assert.deepEqual(reportOnly, ["I26", "I27", "I28", "I30", "I32", "I37"]);
  const E = await loadEngine();
  // Every PER_BUILD ID (the set eval-score counts, imported from invariants.ts) and every typed-word rule grades.
  for (const id of [...PER_BUILD, ...TYPED_RULE_IDS, "I25", "I29"]) assert.ok(E.graded(id), `${id} grades`);
  assert.match(readFileSync("scripts/eval-lib.ts", "utf8"), /PER_BUILD[^\n]*from "\.\.\/src\/lib\/yard\/invariants\.ts"/);
  const entry = loadCorpus().find((e) => gradeOne(E, e).grade === "pass");
  assert.ok(entry, "the corpus has a passing prompt");
  const base = gradeOne(E, entry!);
  const withHit = (id: string) => ({ ...E, checkBuild: (p: any, q: string, plan?: any) => [...E.checkBuild(p, q, plan), { id, cls: INVARIANT_CLASS[id as keyof typeof INVARIANT_CLASS] ?? "F99", msg: `injected ${id}` }] });
  for (const id of reportOnly) {
    const r = gradeOne(withHit(id), entry!);
    assert.equal(r.grade, "pass", `${id} (report-only) moved "${entry!.prompt}" to ${r.grade}`);
    assert.ok(r.invariants.some((v) => v.id === id && !v.scored), `${id} is still listed, marked not scored`);
    assert.deepEqual(r.classes, base.classes, `${id} adds no class`);
  }
  // General case (B1): a new typed-word rule hit (I31, I35, I36, I38) still moves a prompt off pass.
  for (const id of TYPED_RULE_IDS) {
    const r = gradeOne(withHit(id), entry!);
    assert.notEqual(r.grade, "pass", `${id} (typed-word rule) left "${entry!.prompt}" at pass`);
    assert.ok(r.classes.includes(INVARIANT_CLASS[id]), `${id} tags ${INVARIANT_CLASS[id]}`);
  }
  // A scored ID still grades: I4 → partial, I1 → fail.
  assert.equal(gradeOne(withHit("I4"), entry!).grade, "partial");
  assert.equal(gradeOne(withHit("I1"), entry!).grade, "fail");
  assert.equal(gradeOf({ empty: false, nounOk: true, scoredIds: [], honored: 3, checkable: 3 }), "pass");
  assert.equal(gradeOf({ empty: false, nounOk: true, scoredIds: [], honored: 2, checkable: 3 }), "partial");
});

test("#110 B1: 'queen platform bed with drawers' that builds 0 drawers with no note is not a pass (I31 grades)", async () => {
  const E = await loadEngine();
  const q = "queen platform bed with drawers";
  const e = loadCorpus().find((x) => x.prompt === q);
  assert.ok(e, `${q} is in the corpus`);
  const p = E.generateFromPrompt(q);
  const drawers = p.panels.filter((x: any) => /drawer/i.test(x.name)).length;
  const r = gradeOne(E, e!);
  if (drawers === 0) {
    assert.notEqual(r.grade, "pass", "0 drawers, no note: must not pass");
    assert.ok(r.invariants.some((v) => v.id === "I31" && v.scored), "I31 is the graded reason");
  }
  // Whatever the engine builds, a stub with the drawers stripped and no note is never a pass.
  const stripped = { ...E, generateFromPrompt: (x: string) => { const b = E.generateFromPrompt(x); return x === q ? { ...b, panels: b.panels.filter((y: any) => !/drawer/i.test(y.name)), notes: [] } : b; } };
  assert.notEqual(gradeOne(stripped, e!).grade, "pass");
});
