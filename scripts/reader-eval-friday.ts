#!/usr/bin/env -S npx tsx
/**
 * Friday shadow run of the AI prompt reader. In order: everyday-100 (grok100), everyday150, and the
 * 511-prompt corpus (every graded prompt except everyday150). The reader runs on each, and --learner is
 * always on. One --cap-usd is shared across every set and both modes, and it cannot exceed MAX_CAP_USD.
 * Dry run is the default: no key, no network. Saved replies in the output folder are replayed, so a
 * prompt a previous set already reserved is not reserved again.
 *
 *   npm run eval:reader:friday -- --cap-usd 4
 *   npm run eval:reader:friday -- --live --cap-usd 4
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HEAD_ROOT, loadCorpus } from "./eval-gate-lib.ts";
import { MAX_CAP_USD, Spend, runEval, type RunResult } from "./reader-eval.ts";

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const live = argv.includes("--live");
const capRaw = arg("--cap-usd");
if (!capRaw) throw new Error(`--cap-usd is required and can never exceed ${MAX_CAP_USD}`);
if (live && !process.env.XAI_API_KEY) throw new Error("--live needs XAI_API_KEY in the environment");
const spend = new Spend(Number(capRaw));
const root = resolve(arg("--out") ?? join(HEAD_ROOT, ".reader-eval/friday"));
mkdirSync(root, { recursive: true });

const corpus = loadCorpus();
const rest = corpus.filter((e) => !e.sources.includes("everyday150")).map((e) => e.prompt);
if (rest.length !== 511) throw new Error(`the corpus besides everyday150 is ${rest.length} prompts, not 511`);
writeFileSync(join(root, "corpus511.json"), JSON.stringify(rest, null, 1));

const sets = [
  { id: "grok100", file: join(HEAD_ROOT, "evals/corpus/grok100.json") },
  { id: "everyday150", file: join(HEAD_ROOT, "evals/corpus/everyday150.json") },
  { id: "corpus511", file: join(root, "corpus511.json") },
];
const replies = join(root, "replies.json");
const learnerReplies = join(root, "learner-replies.json");
const results: { id: string; result: RunResult }[] = [];
for (const s of sets) {
  results.push({ id: s.id, result: await runEval({ promptsFile: s.file, outDir: join(root, s.id), live, learner: true, repliesFile: replies, learnerRepliesFile: learnerReplies, spend }) });
}

const done = new Set<string>();
let reserved = 0;
let stopped = false;
const perSet = results.map(({ id, result }) => {
  const alone = result.calls.reduce((s, c) => s + c.worst, 0);
  let reservedUsd = 0;
  for (const c of result.calls) {
    const key = `${c.kind}:${c.prompt}:${c.seq}`;
    if (done.has(key) || stopped) continue;
    if (reserved + c.worst > spend.cap + 1e-9) { stopped = true; continue; }
    reserved += c.worst;
    reservedUsd += c.worst;
    done.add(key);
  }
  return {
    id,
    reader: result.calls.filter((c) => c.kind === "reader").length,
    learner: result.calls.filter((c) => c.kind === "learner" && c.seq === 1).length,
    aloneUsd: alone,
    reservedUsd,
    without: result.without,
    with: result.with,
    learnerGrades: result.learner,
    better: result.better,
    worse: result.worse,
    worsePrompts: result.worsePrompts,
    learnerBetter: result.learnerBetter,
    learnerWorse: result.learnerWorse,
    learnerWorsePrompts: result.learnerWorsePrompts,
    changed: result.changed,
    learnerChanged: result.learnerChanged,
  };
});

const grades = (g: { pass: number; partial: number; fail: number }) => `${g.pass} pass / ${g.partial} partial / ${g.fail} fail`;
const lines = [`# Friday reader shadow · ${live ? "live" : "dry run"}`, "", `Cap $${spend.cap.toFixed(2)} · billed $${spend.billed.toFixed(4)} · reserved worst case $${reserved.toFixed(4)}${stopped ? " · later calls would pass the cap and are not reserved" : ""}`, ""];
for (const row of perSet) {
  lines.push(`## ${row.id}`, "");
  lines.push(`- Reader calls: ${row.reader} · learner prompts: ${row.learner} (up to 2 calls each)`);
  lines.push(`- Worst case if this set ran alone: $${row.aloneUsd.toFixed(4)} · newly reserved under the shared cap: $${row.reservedUsd.toFixed(4)}`);
  lines.push(`- Without: ${grades(row.without)}`);
  lines.push(`- With the reader: ${grades(row.with)} · better ${row.better} · worse ${row.worse} · builds changed ${row.changed}`);
  lines.push(`- With the learner: ${grades(row.learnerGrades)} · better ${row.learnerBetter} · worse ${row.learnerWorse} · builds changed ${row.learnerChanged}`);
  if (row.worsePrompts.length) lines.push(`- Worse with the reader: ${row.worsePrompts.join("; ")}`);
  if (row.learnerWorsePrompts.length) lines.push(`- Worse with the learner: ${row.learnerWorsePrompts.join("; ")}`);
  lines.push("");
}
const seen = new Set<string>();
let uniqueWorst = 0;
let uniqueReader = 0;
let uniqueLearner = 0;
for (const { result } of results) for (const c of result.calls) {
  const key = `${c.kind}:${c.prompt}:${c.seq}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniqueWorst += c.worst;
  if (c.kind === "reader") uniqueReader++;
  else if (c.seq === 1) uniqueLearner++;
}
lines.push("## Total", "", `- Reserved under this cap: $${reserved.toFixed(4)} · billed $${spend.billed.toFixed(4)}`, `- Unique worst case if every call billed its reserve: $${uniqueWorst.toFixed(4)} (${uniqueReader} reader calls, ${uniqueLearner} learner prompts, up to 2 calls each). Overlapping prompts are counted once.`, `- A prompt an earlier set already reserved is not reserved again.`, "");
writeFileSync(join(root, "summary.md"), lines.join("\n"));
writeFileSync(join(root, "summary.json"), JSON.stringify({ cap: spend.cap, live, billed: spend.billed, reserved, stopped, perSet }, null, 1));
console.log(lines.join("\n"));
