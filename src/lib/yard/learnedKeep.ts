/**
 * Save/use decision for a learned recipe. The grade is projectGrade, the same function the eval gate uses.
 * A recipe may be remembered, proposed, and shown only when that grade ranks strictly above the
 * deterministic build for the same prompt, and the honest checks do not mark it as a stand-in (closed shell,
 * unmatched body, lattice, fallback box, craft-stick, or any other honest-gate stand-in). A tie stays
 * on the engine.
 */
import { honestChecks } from "../../../scripts/eval-gate-honest";
import { typedDemands, validateSpec, type Demands } from "../../../scripts/eval-gate-typed";
import refusalsFile from "../../../evals/expected-refusals.json";
import { genericBoxOverAsk } from "./genericBox";
import { genericFormMark } from "./formOwnership";
import { GRADE_RANK, REPORT_ONLY_IDS, projectGrade, type GradeEngine } from "./gateGrade";
import { checkBuild } from "./invariants";
import { headerTitle } from "./pdf";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { buildPlan } from "./report";
import type { BuildPlan, YardProject } from "./types";

const norm = (q: string) => q.replace(/\s+/g, " ").trim();

const CORPUS = [
  () => import("../../../evals/corpus/grok100.json"),
  () => import("../../../evals/corpus/live-walk.json"),
  () => import("../../../evals/corpus/nightly-sweep.json"),
  () => import("../../../evals/corpus/props-regressions.json"),
  () => import("../../../evals/corpus/review18.json"),
  () => import("../../../evals/corpus/sheet-stocks.json"),
  () => import("../../../evals/corpus/shelf-levels.json"),
];

let specs: Promise<Map<string, Demands>> | null = null;
/** Stored intake specs, where the gate has them. Otherwise the typed-word rules, which is what the gate uses too. */
export function demandsFor(prompt: string): Promise<Demands> {
  const q = norm(prompt);
  specs ??= (async () => {
    const map = new Map<string, Demands>();
    for (const load of CORPUS) {
      const mod = (await load()) as { default?: { prompts?: unknown[] }; prompts?: unknown[] };
      const file = mod.default ?? mod;
      for (const it of file.prompts ?? []) {
        if (!it || typeof it !== "object") continue;
        const row = it as { prompt?: string; spec?: unknown };
        if (typeof row.prompt !== "string") continue;
        const key = norm(row.prompt);
        const spec = row.spec ? validateSpec(row.spec, key) : null;
        if (spec?.head_noun && !map.has(key)) map.set(key, spec);
      }
    }
    return map;
  })();
  return specs.then((map) => map.get(q) ?? typedDemands(q)).catch(() => typedDemands(q));
}

const refusals = (refusalsFile as { refusals: GradeEngine["refusals"] }).refusals;

function engine(): GradeEngine {
  return {
    ignoredTypedWords,
    checkBuild,
    buildPlan,
    headerTitle,
    generateFromPrompt,
    graded: (id) => !REPORT_ONLY_IDS.has(id),
    baseline: {},
    refusals,
    genericFormMark,
    genericBoxOverAsk,
  };
}

/** Honest-gate stand-in marks. Any hit means the build is not the asked-for object. */
export function standInHits(prompt: string, project: YardProject, plan: BuildPlan) {
  return honestChecks(engine(), prompt, project, plan);
}

/**
 * True only when the learned build is not a stand-in and its gate grade ranks strictly above the
 * deterministic build. A tie stays on the engine: the catalog grows only when the recipe helps.
 */
export async function mayKeepLearned(prompt: string, learned: YardProject, learnedPlan: BuildPlan = buildPlan(learned)): Promise<boolean> {
  if (standInHits(prompt, learned, learnedPlan).length) return false;
  const demands = await demandsFor(prompt);
  const E = engine();
  const row = { prompt, demands, demandsFrom: "corpus-or-typed" };
  const learnedGrade = projectGrade(E, row, learned, learnedPlan, prompt).grade;
  let base: YardProject;
  try { base = generateFromPrompt(prompt); } catch { return false; }
  const baseGrade = projectGrade(E, row, base, buildPlan(base), prompt).grade;
  return GRADE_RANK[learnedGrade] > GRADE_RANK[baseGrade];
}
