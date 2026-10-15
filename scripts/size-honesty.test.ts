import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { headerTitle } from "../src/lib/yard/pdf.ts";
import { modelFinishedDepth, modelProudNote } from "../src/lib/yard/modelSize.ts";
import { offline } from "./eval-lib.ts";
import { corpus } from "./invariants-corpus.ts";

/**
 * I15 size honesty (F2 class, lemonade stand): the title, step 1 and the model say one depth.
 * - The header's D, step 1's "N\" deep" and the model's finished depth are equal (±1/8").
 * Builds whose doors or fronts stand proud (labelled in step 1) are exempt: that is the linen rule.
 * - Step 1 restates the title as written: no axis of the title is re-stamped to another number.
 */
const num = (s: string) => s.trim().split(/\s+/).reduce((t, p) => t + (p.includes("/") ? Number(p.split("/")[0]) / Number(p.split("/")[1]) : Number(p)), 0);
const near = (a: number, b: number) => Math.abs(a - b) <= 0.13;

export function sizeHonesty(q: string): string[] {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const out: string[] = [];
  const hd = headerTitle(p).match(/× ([\d\s/]+)" D/)?.[1];
  const s1 = plan.instructions.find((s) => /^Confirm/.test(s.title))?.description ?? "";
  const sd = s1.match(/([\d\s/]+)" deep/)?.[1];
  // Doors and drawer fronts standing proud of a typed box depth are a labelled note (I2), not a second size.
  const proud = !!modelProudNote(p.panels, p.overall.depth);
  const md = modelFinishedDepth(p.panels, p.overall.depth);
  if (proud) return out;
  if (hd && !near(num(hd), md)) out.push(`header D ${hd}" vs model ${md}"`);
  if (sd && !near(num(sd), md)) out.push(`step 1 ${sd}" deep vs model ${md}"`);
  const base = p.name.replace(/\s+[\d\s./'"″′]*\d[\d\s./'"″′]*(?:[×x]\s*[\d\s./'"″′]+)+$/, "");
  if (s1.startsWith(base) && /\d/.test(p.name) && !s1.startsWith(p.name)) out.push(`step 1 restates the title as "${s1.split(".")[0]}" (title "${p.name}")`);
  return out;
}

test("I15 lemonade stand: title, header, step 1 and model agree on depth (default and typed)", () => {
  for (const q of ["lemonade stand", "lemonade stand 60 wide 36 deep", "snack stand 40 wide 24 deep 80 tall"]) assert.deepEqual(sizeHonesty(q), [], q);
  const p = generateFromPrompt("lemonade stand 60 wide 36 deep");
  assert.equal(p.overall.depth, 36);
  assert.equal(modelFinishedDepth(p.panels, 36), 36);
  assert.match(p.name, /5' × 3'$/);
});

/** Known at the start (tracked, not excluded): a fix must delete its line here, and a new one fails. */
const KNOWN: Record<string, string> = {
  "pocket vanity": "F2: header reads the pocket unit's 17\" while the model with the trapezoid uppers is 35 1/2\" deep",
  "coat rack 36 wide 12 high 4 deep": "F2: header 4\" vs model 4 1/4\" (hooks stand proud with no proud note)",
};

test("I15 over the whole corpus: no new build re-stamps its title or disagrees on depth; no stale known entry", () => {
  const bad = new Set(offline(() => corpus().filter((q) => { try { return sizeHonesty(q).length > 0; } catch { return false; } })));
  assert.deepEqual([...bad].filter((q) => !(q in KNOWN)), [], "new I15 violations");
  assert.deepEqual(Object.keys(KNOWN).filter((q) => !bad.has(q)), [], "stale I15 entries: delete them to close the class");
});
