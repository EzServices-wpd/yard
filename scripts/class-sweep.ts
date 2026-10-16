/**
 * Spec 006 class sweeps for Critic: 20 prompts per class, each with its build, header, the class invariant's result and
 * the first steps. No xAI (engine only). Usage: npx tsx scripts/class-sweep.ts c3|c2|c1 [--out evals/sweeps/x.md]
 */
import { writeFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { headerTitle } from "../src/lib/yard/pdf";
import { checkBuild, i25 } from "../src/lib/yard/invariants";
import { SWEEPS } from "./class-sweep-prompts";

const cls = (process.argv[2] ?? "c3") as keyof typeof SWEEPS;
const outAt = process.argv.indexOf("--out");
const out = outAt > 0 ? process.argv[outAt + 1] : `evals/sweeps/${SWEEPS[cls].file}`;
const sweep = SWEEPS[cls];
const rows: string[] = [`# Sweep ${cls.toUpperCase()}: ${sweep.title}`, "", `Invariant: ${sweep.inv}. Engine only, no xAI.`, "", "| # | Prompt | Header | Buy | " + sweep.inv + " | Steps (first 3) |", "|---|---|---|---|---|---|"];
let fails = 0;
sweep.prompts.forEach((q, i) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const v = (sweep.inv === "I25" ? i25(q) : checkBuild(p, q, plan)).filter((x) => x.id === sweep.inv).map((x) => x.msg);
  if (v.length) fails++;
  const cell = (t: string) => t.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 220);
  rows.push(`| ${i + 1} | ${cell(q)} | ${cell(headerTitle(p))} | ${cell(plan.bom.map((b) => `${b.name} ×${b.quantity}`).join("; "))} | ${v.length ? "FAIL: " + cell(v.join("; ")) : "pass"} | ${cell(plan.instructions.slice(0, 3).map((s) => s.title).join(" → "))} |`);
});
rows.push("", `${sweep.prompts.length - fails}/${sweep.prompts.length} pass ${sweep.inv}.`);
writeFileSync(out, rows.join("\n") + "\n");
console.log(`${cls}: ${sweep.prompts.length - fails}/${sweep.prompts.length} pass ${sweep.inv} → ${out}`);
