/** Eval scoreboard: `npx tsx scripts/eval-score.ts` prints; `--write` records a new high mark in evals/score.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { evalScore } from "./eval-lib.ts";
import { EVAL_PROMPTS } from "./invariants-corpus.ts";
const file = new URL("../evals/score.json", import.meta.url);
const now = evalScore(EVAL_PROMPTS);
const prev = JSON.parse(readFileSync(file, "utf8"));
console.log(`eval score ${now.score}/${now.max} (tracked ${prev.score}/${prev.max})`);
if (process.argv.includes("--write")) {
  if (now.score < prev.score) { console.error("score dropped: not writing"); process.exit(1); }
  writeFileSync(file, JSON.stringify({ score: now.score, max: now.max, prompts: EVAL_PROMPTS.length, failing: now.failing }, null, 1) + "\n");
}
