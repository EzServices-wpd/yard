#!/usr/bin/env -S npx tsx
/**
 * Stale-scorecard check: the stored scorecards must say what this tree scores today, not a high mark from before.
 *
 *   npx tsx scripts/eval-gate-stale.ts --fresh <gate.json>   compare evals/gate.json with a fresh grade of this tree
 *                                                           (CI passes the head grade it already made)
 *   npx tsx scripts/eval-gate-stale.ts                       grade this tree now, then compare
 *
 * Fails (exit 1) when evals/gate.json's totals, or any prompt's grade or classes, differ from the fresh grade, or
 * when evals/score.json's score, max or failing list differ from scripts/eval-score.ts now. The fix is to re-record
 * in the same PR: `npm run eval:gate -- --write` and `npx tsx scripts/eval-score.ts --write`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEAD_ROOT } from "./eval-gate-lib.ts";

type Row = { prompt: string; grade: string; classes: string[] };
type Gate = { totals: Record<string, number>; prompts: Row[] };

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };

export function staleGate(stored: Gate, fresh: Gate): string[] {
  const out: string[] = [];
  for (const k of ["prompts", "pass", "partial", "fail", "points"]) {
    if (stored.totals[k] !== fresh.totals[k]) out.push(`totals.${k}: stored ${stored.totals[k]}, today ${fresh.totals[k]}`);
  }
  const was = new Map(stored.prompts.map((r) => [r.prompt, r]));
  const now = new Map(fresh.prompts.map((r) => [r.prompt, r]));
  for (const [q, r] of now) {
    const s = was.get(q);
    if (!s) out.push(`new prompt not recorded: ${q} (${r.grade})`);
    else if (s.grade !== r.grade || s.classes.join(",") !== r.classes.join(",")) out.push(`${q}: stored ${s.grade} [${s.classes.join(" ")}], today ${r.grade} [${r.classes.join(" ")}]`);
  }
  for (const q of was.keys()) if (!now.has(q)) out.push(`recorded prompt no longer graded: ${q}`);
  return out;
}

export function staleScore(stored: { score: number; max: number; failing: string[] }, now: { score: number; max: number; failing: string[] }): string[] {
  const out: string[] = [];
  if (stored.score !== now.score || stored.max !== now.max) out.push(`evals/score.json: stored ${stored.score}/${stored.max}, today ${now.score}/${now.max}`);
  const a = [...stored.failing].sort().join("\n"), b = [...now.failing].sort().join("\n");
  if (a !== b) out.push(`evals/score.json failing list differs from today (${stored.failing.length} stored, ${now.failing.length} today)`);
  return out;
}

async function main() {
  let freshFile = arg("--fresh");
  if (!freshFile) {
    freshFile = join(mkdtempSync(join(tmpdir(), "gate-stale-")), "gate.json");
    execFileSync("npx", ["-y", "tsx", join(HEAD_ROOT, "scripts/eval-gate.ts"), "--jobs", String(arg("--jobs") ?? 2), "--out", freshFile], { stdio: ["ignore", "ignore", "inherit"] });
  }
  const problems = staleGate(JSON.parse(readFileSync(join(HEAD_ROOT, "evals/gate.json"), "utf8")), JSON.parse(readFileSync(freshFile, "utf8")));
  if (!argv.includes("--gate-only")) {
    const { evalScore } = await import("./eval-lib.ts");
    const { EVAL_PROMPTS } = await import("./invariants-corpus.ts");
    problems.push(...staleScore(JSON.parse(readFileSync(join(HEAD_ROOT, "evals/score.json"), "utf8")), evalScore(EVAL_PROMPTS)));
  }
  if (!problems.length) { console.log("scorecards are current: evals/gate.json and evals/score.json match today"); return; }
  console.log(`stale scorecard: ${problems.length} difference(s). Re-record in this PR: npm run eval:gate -- --write && npx tsx scripts/eval-score.ts --write`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
  if (problems.length > 40) console.log(`  … ${problems.length - 40} more`);
  process.exitCode = 1;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) await main();
