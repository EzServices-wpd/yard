#!/usr/bin/env -S npx tsx
/**
 * Eval gate (PR 1): engine-direct, no browser, no network, no xAI. Grades every corpus prompt pass/partial/fail
 * from the deterministic invariants plus typed-word honor, tags the failure classes it trips, and hard-fails
 * the canaries separately from the totals.
 *
 *   npm run eval:gate                         full corpus → prints totals (exit 1 only if a canary fails)
 *   npm run eval:gate -- --write              …and records evals/gate.json (the reference snapshot)
 *   npm run eval:gate -- --check              …and diffs against evals/gate.json with the CI rules (scripts/eval-gate-diff.ts),
 *                                             including corpus removals (a prompt in evals/gate.json no longer in the corpus)
 *   npm run eval:gate -- --class F1           only prompts that trip F1 in evals/gate.json (+ canaries): a per-class target
 *   npm run eval:gate -- --shard my.json      only these prompts (a corpus file or a JSON array of strings)
 *   options: --out <file> --root <checkout> --ref <gate.json> --jobs <n> --no-answer-keys
 *
 * Answer keys (evals/corpus/answer-keys.json, or YARD_ANSWER_KEYS=<file>) are scored into gate.json "answerKeys"
 * as a REPORT ONLY: they never change the totals, the canaries or the merge rule.
 *
 * Classes: F#/C# from src/lib/yard/invariants.ts INVARIANT_CLASS; T-noun/T-size/T-count/T-feature/T-material/
 * T-budget/T-key for a typed word not honored; X-build for no build. Invariant ids (I1…) also work with --class.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { diffGates, renderComment } from "./eval-gate-diff.ts";
import { HEAD_ROOT, byClass, bySource, corpusRemovals, gradeCanary, gradeOne, loadCanaries, loadCorpus, loadEngine, norm, stable, totalsOf, type CanaryResult, type Entry, type PromptResult } from "./eval-gate-lib.ts";
import { typedDemands } from "./eval-gate-typed.ts";
import { scoreAnswerKeys, type KeyReport } from "./eval-gate-keys.ts";

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (k: string) => argv.includes(k);
const root = resolve(arg("--root") ?? HEAD_ROOT);
const refFile = resolve(arg("--ref") ?? join(HEAD_ROOT, "evals/gate.json"));
const cls = arg("--class");
const shard = arg("--shard");
const jobs = Math.max(1, Number(arg("--jobs") ?? 1));
const worker = arg("--worker");

export type GateFile = { note: string; totals: ReturnType<typeof totalsOf>; canaries: { ok: boolean; results: CanaryResult[] }; answerKeys: KeyReport | null; bySource: ReturnType<typeof bySource>; byClass: Record<string, number>; prompts: PromptResult[] };

function select(all: Entry[]): Entry[] {
  if (shard) {
    const j = JSON.parse(readFileSync(resolve(shard), "utf8"));
    const want = (Array.isArray(j) ? j : j.prompts).map((x: string | { prompt: string }) => norm(typeof x === "string" ? x : x.prompt));
    const known = new Map(all.map((e) => [e.prompt, e]));
    return want.map((q: string) => known.get(q) ?? { prompt: q, sources: ["shard"], ids: [], demands: typedDemands(q), demandsFrom: "typed-rules" });
  }
  if (cls) {
    if (!existsSync(refFile)) throw new Error(`--class needs a reference gate (${refFile}); run --write first`);
    const ref: GateFile = JSON.parse(readFileSync(refFile, "utf8"));
    const hit = new Set(ref.prompts.filter((r) => r.classes.includes(cls) || r.invariants.some((v) => v.id === cls)).map((r) => r.prompt));
    return all.filter((e) => hit.has(e.prompt));
  }
  return all;
}

async function gradeSlice(entries: Entry[], withCanaries: boolean) {
  const E = await loadEngine(root);
  const rows = entries.map((e) => gradeOne(E, e));
  const canaries = withCanaries ? loadCanaries().map((c) => gradeCanary(E, c)) : [];
  const keys = withCanaries && !flag("--no-answer-keys") && !cls && !shard ? await scoreAnswerKeys(E) : null;
  return { rows, canaries, keys };
}

async function runParallel(entries: Entry[]): Promise<{ rows: PromptResult[]; canaries: CanaryResult[]; keys: KeyReport | null }> {
  if (jobs === 1) return gradeSlice(entries, true);
  const dir = mkdtempSync(join(tmpdir(), "eval-gate-"));
  writeFileSync(join(dir, "entries.json"), JSON.stringify(entries));
  const script = new URL(import.meta.url).pathname;
  await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise<void>((ok, bad) => {
    const extra = ["--root", root, "--worker", `${i}/${jobs}`, "--worker-dir", dir];
    const c = spawn("npx", ["-y", "tsx", script, ...extra], { stdio: ["ignore", "inherit", "inherit"], cwd: process.cwd() });
    c.on("exit", (code) => (code === 0 ? ok() : bad(new Error(`eval-gate worker ${i} exited ${code}`))));
  })));
  const rows: PromptResult[] = [], canaries: CanaryResult[] = [];
  let keys: KeyReport | null = null;
  for (let i = 0; i < jobs; i++) { const j = JSON.parse(readFileSync(join(dir, `w${i}.json`), "utf8")); rows.push(...j.rows); canaries.push(...j.canaries); keys ??= j.keys; }
  rmSync(dir, { recursive: true, force: true });
  return { rows: rows.sort((a, b) => (a.prompt < b.prompt ? -1 : a.prompt > b.prompt ? 1 : 0)), canaries, keys };
}

async function main() {
  if (worker) {
    const [i, n] = worker.split("/").map(Number);
    const dir = arg("--worker-dir")!;
    const entries: Entry[] = JSON.parse(readFileSync(join(dir, "entries.json"), "utf8"));
    const out = await gradeSlice(entries.filter((_, k) => k % n === i), i === 0);
    writeFileSync(join(dir, `w${i}.json`), JSON.stringify(out));
    return;
  }
  const t0 = Date.now();
  const entries = select(loadCorpus());
  const { rows, canaries, keys } = await runParallel(entries);
  const gate: GateFile = {
    note: "Eval gate (scripts/eval-gate.ts): engine-direct, no xAI. grade: fail = no build, head noun not honored, or a floats/miscount/missing-hardware/outdoor-ply invariant (I1/I3/I9/I13); partial = any other invariant or a typed word not honored; pass = clean. points = 2·pass + partial. Canaries are a hard fail, outside the totals.",
    totals: totalsOf(rows),
    canaries: { ok: canaries.every((c) => c.ok), results: canaries },
    answerKeys: keys,
    bySource: bySource(rows),
    byClass: byClass(rows),
    prompts: rows,
  };
  const t = gate.totals;
  console.log(`eval gate: ${t.prompts} prompts · pass ${t.pass} / partial ${t.partial} / fail ${t.fail} · points ${t.points}/${t.maxPoints} · honor ${t.honored}/${t.checkable} (${t.honorPct}%) · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const c of canaries) console.log(`${c.ok ? "PASS" : "FAIL"} canary ${c.id}: ${c.ok ? `${c.got.header} · ${c.got.pieces} parts · $${c.got.usd?.toFixed(2)}` : c.failures.join("; ")}`);
  if (keys) console.log(`answer keys (report only): ${keys.score.ok}/${keys.score.total} checks, ${keys.score.clean}/${keys.score.keys} keys clean; top misses: ${keys.patterns.slice(0, 5).map((p) => `${p.type} ${p.check} ${p.misses}/${p.of}`).join(", ")}`);
  console.log(`top classes: ${Object.entries(gate.byClass).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  const out = arg("--out");
  if (out) writeFileSync(resolve(out), stable(gate));
  if (flag("--write")) {
    if (cls || shard) throw new Error("--write records the full corpus only (drop --class/--shard)");
    writeFileSync(join(HEAD_ROOT, "evals/gate.json"), stable(gate));
    console.log("wrote evals/gate.json");
  }
  let bad = !gate.canaries.ok;
  if (cls) {
    const ref: GateFile = JSON.parse(readFileSync(refFile, "utf8"));
    const trips = (r: PromptResult) => r.classes.includes(cls) || r.invariants.some((v) => v.id === cls);
    const before = ref.prompts.filter(trips).length, now = rows.filter(trips).length;
    const refBy = new Map(ref.prompts.map((r) => [r.prompt, r]));
    const rank = { pass: 2, partial: 1, fail: 0 } as const;
    const worse = rows.filter((r) => refBy.has(r.prompt) && rank[r.grade] < rank[refBy.get(r.prompt)!.grade]);
    console.log(`class ${cls}: ${before} prompts in the reference → ${now} still trip it; ${worse.length} got worse`);
    for (const r of rows.filter(trips)) console.log(`  still ${cls}: ${r.prompt} — ${[...r.invariants.filter((v) => v.cls === cls || v.id === cls).map((v) => v.msg), ...r.honor.items.filter((i) => i.ok !== true && `T-${i.kind}` === cls).map((i) => `${i.demand} → ${i.shows}`)].slice(0, 2).join("; ")}`);
    for (const r of worse) console.log(`  WORSE ${r.prompt}: ${refBy.get(r.prompt)!.grade} → ${r.grade}`);
    if (now > before || worse.length) bad = true;
  }
  if (flag("--check")) {
    const ref: GateFile = JSON.parse(readFileSync(refFile, "utf8"));
    // A prompt recorded in the reference that this tree's corpus no longer has is a removal (full corpus only).
    const rf = join(HEAD_ROOT, "evals/corpus-removals.json");
    const removals = cls || shard ? [] : corpusRemovals(new Map(ref.prompts.map((r) => [r.prompt, ["evals/gate.json"]])), new Set(entries.map((e) => e.prompt)), existsSync(rf) ? JSON.parse(readFileSync(rf, "utf8")) : {});
    const d = diffGates(ref, gate, JSON.parse(readFileSync(join(HEAD_ROOT, "evals/gate-allow.json"), "utf8")), undefined, removals);
    console.log(renderComment(d, { headLabel: "this tree", baseLabel: "evals/gate.json" }));
    if (!d.ok) bad = true;
  }
  if (bad) process.exitCode = 1;
}
await main();
