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
  const before = await gradeOf(prompt, engine);
  const raw = replies[prompt];
  if (!raw) return { prompt, before, after: before, kept: false };
  const recipe = parseRecipe(raw);
  if (!recipe) return { prompt, before, after: before, kept: false };
  let learned;
  try { learned = buildRecipe(recipe, prompt).project; } catch { return { prompt, before, after: before, kept: false }; }
  const kept = await mayKeepLearned(prompt, learned);
  const after = kept ? await gradeOf(prompt, learned) : before;
  return { prompt, before, after, kept };
}

const sets = [
  { id: "grok100", prompts: grok },
  { id: "everyday150", prompts: everyday.length ? everyday : corpus.filter((e) => e.sources.includes("everyday150")).map((e) => e.prompt) },
  { id: "corpus511", prompts: rest },
];

let any = false;
for (const set of sets) {
  let better = 0, worse = 0, kept = 0;
  const worsePrompts: string[] = [];
  const betterPrompts: string[] = [];
  for (const prompt of set.prompts) {
    if (replies[prompt]) any = true;
    const row = await one(prompt);
    const delta = GRADE_RANK[row.after] - GRADE_RANK[row.before];
    if (row.kept) kept++;
    if (delta > 0) { better++; betterPrompts.push(prompt); }
    if (delta < 0) { worse++; worsePrompts.push(prompt); }
  }
  console.log(`${set.id}: ${set.prompts.length} prompts · kept ${kept} · better ${better} · worse ${worse}`);
  if (betterPrompts.length) console.log(`  better: ${betterPrompts.join("; ")}`);
  if (worsePrompts.length) console.log(`  worse: ${worsePrompts.join("; ")}`);
}
if (!any) console.log(`no saved learner replies at ${repliesPath} (dry; every prompt stays on the deterministic build)`);
