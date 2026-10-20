/**
 * Honest refusals (YARD-SPEC "Honest refusals"). A refusal ("nothing built") is graded against evals/expected-refusals.json:
 *   pass  only when the prompt is listed there AND the refusal (1) says nothing is built and shows no parts, price or size,
 *         (2) names the listed usable minimum, (3) that minimum is above what was asked, and (4) the minimum, typed back
 *         into the prompt, builds cleanly (parts, no graded invariant, not refused);
 *   fail  (class X-refusal) for a refusal of a prompt that is not listed (a build was expected), a listed prompt that
 *         builds instead of refusing, or a listed refusal that misses any of (1)-(4).
 * The gate only grades: the engine is untouched.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lengthIn, type Demands } from "./eval-gate-typed.ts";

type Axis = "W" | "D" | "H";
export type Minimum = { axis: Axis; value_in: number; quote: string };
export type Refusal = { honest: boolean; why: string };
export type ExpectedRefusals = Record<string, { minimum: string; why: string }>;
type Grader = {
  generateFromPrompt: (q: string) => any;
  buildPlan: (p: any) => any;
  headerTitle: (p: any) => string;
  checkBuild: (p: any, q: string, plan?: any) => { id: string }[];
  graded: (id: string) => boolean;
};

export function loadExpectedRefusals(root: string): ExpectedRefusals {
  const f = join(root, "evals/expected-refusals.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).refusals : {};
}

const AXIS: Record<string, Axis> = { wide: "W", long: "W", deep: "D", tall: "H", high: "H" };
const LEN = String.raw`(\d+\s+\d+\/\d+|\d+(?:\.\d+)?|\d+\/\d+)\s*(?:"|in(?:ches)?\b)?`;
const MIN_RE = new RegExp(String.raw`(?:make it|needs(?: at least)?|at least)\s+${LEN}\s*(wide|long|deep|tall|high)\b`, "i");

/** The first usable minimum a refusal (or an expected-refusal entry) names, or null. */
export function namedMinimum(text: string): Minimum | null {
  const m = MIN_RE.exec(/^\s*\d/.test(text) ? `needs ${text}` : text);
  return m ? { axis: AXIS[m[2].toLowerCase()], value_in: lengthIn(m[1]), quote: `${m[1]} ${m[2].toLowerCase()}` } : null;
}

/** null when the build is neither a refusal nor an expected one; otherwise whether the refusal is right, and why not. */
export function judgeRefusal(E: Grader, prompt: string, d: Demands, p: any, plan: any, expected: ExpectedRefusals): Refusal | null {
  const text = typeof p?.refused === "string" ? p.refused : "";
  const want = expected[prompt];
  if (!text && !want) return null;
  const wrong = (why: string): Refusal => ({ honest: false, why });
  if (!text) return wrong(`expected a refusal naming ${want.minimum}, but it built`);
  if (!want) return wrong(`refused where a build was expected: ${text.slice(0, 80)}`);
  if (!/nothing (?:is )?built/i.test(text)) return wrong("refusal does not say nothing is built");
  if ((p.panels?.length ?? 0) || (p.instances?.length ?? 0) || (plan?.totals?.pieces ?? 0) > 0) return wrong("refused but still shows parts");
  if ((plan?.totals?.estCostUsd ?? 0) > 0) return wrong("refused but still shows a price");
  let header = "";
  try { header = E.headerTitle(p); } catch { /* no header is no size */ }
  if (/\d\s*(?:"|×)/.test(header)) return wrong(`refused but the header shows a size: ${header}`);
  const min = namedMinimum(text), exp = namedMinimum(want.minimum);
  if (!min) return wrong("refusal names no usable minimum");
  if (!exp || exp.axis !== min.axis || Math.abs(exp.value_in - min.value_in) > 1 / 64) return wrong(`refusal names ${min.quote}, expected ${want.minimum}`);
  const typed = d.sizes.find((z) => z.axis === min.axis);
  const asked = typed?.value_in ?? (min.axis === "W" ? p.overall?.width : min.axis === "D" ? p.overall?.depth : p.overall?.height);
  if (typeof asked === "number" && asked >= min.value_in - 1e-6) return wrong(`refused at ${asked}" but the minimum is ${min.value_in}"`);
  const retry = typed ? prompt.replace(typed.quote, min.quote) : `${prompt} ${min.quote}`;
  try {
    const q: any = E.generateFromPrompt(retry);
    if (q.refused || !(q.panels?.length || q.instances?.length)) return wrong(`the named minimum does not build: "${retry}"`);
    const hits = E.checkBuild(q, retry, E.buildPlan(q)).filter((v) => E.graded(v.id));
    if (hits.length) return wrong(`the named minimum builds with ${hits.map((v) => v.id).join(", ")}: "${retry}"`);
  } catch (err) {
    return wrong(`the named minimum threw: ${String(err).slice(0, 80)}`);
  }
  return { honest: true, why: `refused below the ${min.quote} minimum, which builds cleanly` };
}
