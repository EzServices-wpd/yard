/**
 * Replay saved learner replies through the keep decision. No network.
 *
 *   npx tsx scripts/learner-replay.ts [.reader-eval/friday/learner-replies.json]
 *
 * Each prompt is graded with projectGrade (the eval gate's grade). A saved recipe is used only when
 * mayKeepLearned says so. Prints better / worse against the deterministic build for grok100,
 * everyday150 and the graded corpus.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRecipe } from "../src/lib/yard/recipeBuild.ts";
import { mayKeepLearned, demandsFor } from "../src/lib/yard/learnedKeep.ts";
import { GRADE_RANK, projectGrade, type GradeEngine } from "../src/lib/yard/gateGrade.ts";
import { generateFromPrompt, ignoredTypedWords } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { checkBuild } from "../src/lib/yard/invariants.ts";
import { headerTitle } from "../src/lib/yard/pdf.ts";
import { genericFormMark } from "../src/lib/yard/formOwnership.ts";
import { genericBoxOverAsk } from "../src/lib/yard/genericBox.ts";
import { REPORT_ONLY_IDS } from "../src/lib/yard/gateGrade.ts";
import { HEAD_ROOT, loadCorpus, loadExpectedRefusals } from "./eval-gate-lib.ts";
import { parseRecipe } from "../src/lib/yard/recipes.ts";

const repliesPath = process.argv[2] ?? join(HEAD_ROOT, ".reader-eval/friday/learner-replies.json");
const replies: Record<string, unknown> = existsSync(repliesPath) ? JSON.parse(readFileSync(repliesPath, "utf8")) : {};

const everydayPath = join(HEAD_ROOT, "plan-baselines/everyday150.json");
const everyday: string[] = existsSync(everydayPath)
  ? (JSON.parse(readFileSync(everydayPath, "utf8")).prompts as { prompt: string }[]).map((p) => p.prompt)
  : [];
const corpus = loadCorpus();
const byPrompt = new Map(corpus.map((e) => [e.prompt, e]));
const grok = corpus.filter((e) => e.sources.includes("grok100")).map((e) => e.prompt);
const rest = corpus.filter((e) => !everyday.includes(e.prompt)).map((e) => e.prompt);

const E: GradeEngine = {
  ignoredTypedWords,
  checkBuild,
  buildPlan,
  headerTitle,
  generateFromPrompt,
  graded: (id) => !REPORT_ONLY_IDS.has(id),
  baseline: {},
  refusals: loadExpectedRefusals(HEAD_ROOT),
  genericFormMark,
  genericBoxOverAsk,
};

async function gradeOf(prompt: string, project: ReturnType<typeof generateFromPrompt>) {
  const known = byPrompt.get(prompt);
  const demands = known?.demands ?? await demandsFor(prompt);
  return projectGrade(E, { prompt, demands, demandsFrom: known?.demandsFrom ?? "typed-rules" }, project, buildPlan(project), prompt).grade;
}

async function one(prompt: string) {
  const engine = generateFromPrompt(prompt);
  const engineGrade = await gradeOf(prompt, engine);
  const raw = replies[prompt];
  if (!raw) return { prompt, engineGrade, ungated: engineGrade, after: engineGrade, kept: false, hasReply: false };
  const recipe = parseRecipe(raw);
  if (!recipe) return { prompt, engineGrade, ungated: engineGrade, after: engineGrade, kept: false, hasReply: true };
  let learned;
  try { learned = buildRecipe(recipe, prompt).project; } catch { return { prompt, engineGrade, ungated: engineGrade, after: engineGrade, kept: false, hasReply: true }; }
  const ungated = await gradeOf(prompt, learned);
  const kept = await mayKeepLearned(prompt, learned);
  const after = kept ? ungated : engineGrade;
  return { prompt, engineGrade, ungated, after, kept, hasReply: true };
}

const sets = [
  { id: "grok100", prompts: grok },
  { id: "everyday150", prompts: everyday.length ? everyday : corpus.filter((e) => e.sources.includes("everyday150")).map((e) => e.prompt) },
  { id: "corpus511", prompts: rest },
];

const summaryPath = join(HEAD_ROOT, ".reader-eval/friday/summary.json");
const liveWorse = new Map<string, string[]>();
if (existsSync(summaryPath)) {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as { perSet: { id: string; learnerWorsePrompts?: string[] }[] };
  for (const row of summary.perSet) liveWorse.set(row.id, row.learnerWorsePrompts ?? []);
}

let any = false;
for (const set of sets) {
  let beforeBetter = 0, beforeWorse = 0, afterBetter = 0, afterWorse = 0, kept = 0;
  const betterLines: string[] = [];
  const beforeWorseLines: string[] = [];
  for (const prompt of set.prompts) {
    if (replies[prompt]) any = true;
    const row = await one(prompt);
    const beforeDelta = GRADE_RANK[row.ungated] - GRADE_RANK[row.engineGrade];
    const afterDelta = GRADE_RANK[row.after] - GRADE_RANK[row.engineGrade];
    if (row.kept) kept++;
    if (beforeDelta > 0) { beforeBetter++; betterLines.push(`${prompt} · kept ${row.kept} · ${row.engineGrade} → ${row.ungated}`); }
    if (beforeDelta < 0) { beforeWorse++; beforeWorseLines.push(`${prompt} · kept ${row.kept} · stays ${row.after === row.engineGrade ? "on the engine" : "OFF the engine"}`); }
    if (afterDelta > 0) afterBetter++;
    if (afterDelta < 0) afterWorse++;
  }
  console.log(`${set.id}: before better ${beforeBetter} worse ${beforeWorse} · after better ${afterBetter} worse ${afterWorse} · kept ${kept}`);
  for (const line of betterLines) console.log(`  better: ${line}`);
  for (const line of beforeWorseLines) console.log(`  was worse: ${line}`);
  const named = liveWorse.get(set.id) ?? [];
  for (const prompt of named) {
    const row = await one(prompt);
    const stayed = !row.kept && row.after === row.engineGrade;
    console.log(`  live worse: ${prompt} · reply ${row.hasReply} · kept ${row.kept} · ${stayed ? "stays on the engine" : "STILL USED"}`);
  }
}
if (!any) console.log(`no saved learner replies at ${repliesPath} (dry; every prompt stays on the deterministic build)`);
