/**
 * Critic #79: every label that names the build's overall size agrees. The card title (the build's name) and plan step
 * 01 said 38" (the carcase without its casters) while the header and finished size said 41". Over the corpus, the size
 * in the title and the overall size stated in step 01 equal the header's overall size on every build.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { headerTitle } from "./pdf";
import { buildPlan } from "./report";
import { refineProject } from "./refine";
import { modelFinishedDepth } from "./modelSize";

const { corpus, EVAL_PROMPTS } = await import("../../../scripts/invariants-corpus");
const { SWEEPS } = await import("../../../scripts/class-sweep-prompts");
const ROLLING = ["rolling kitchen island", "kitchen island on casters", "mobile workbench", "rolling kitchen cart", "rolling bookshelf", "dresser on casters", "rolling toy chest", "rolling shoe rack", "rolling desk", "rolling tv stand"];

const N = String.raw`(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)`;
const num = (s: string) => s.trim().split(/\s+/).reduce((t, w) => t + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
const near = (a: number, b: number) => Math.abs(a - b) < 0.07;
/** The header's overall size: W × D × H. */
function header(p: ReturnType<typeof generateFromPrompt>) {
  const m = headerTitle(p).match(new RegExp(`${N}"? W × ${N}"? D × ${N}"? H`));
  return m ? { w: num(m[1]), d: num(m[2]), h: num(m[3]) } : null;
}
/** A stated overall size: "36" wide × 16" deep × 39" high", "82" long × 44" wide × 65" tall". */
function labeled(text: string) {
  const m = text.match(new RegExp(`${N}"\\s*(wide|long)\\s*[×x]\\s*${N}"\\s*(deep|long|wide)\\s*[×x]\\s*${N}"\\s*(?:high|tall)\\b`));
  return m ? { a: num(m[1]), b: num(m[3]), h: num(m[5]) } : null;
}
/** The title's size: 'Kitchen island 36" × 39" × 16"' (W × H × D) or a labeled one. */
function titleSize(name: string) {
  const l = labeled(name);
  if (l) return l;
  const m = name.match(new RegExp(`${N}"\\s*[×x]\\s*${N}"\\s*[×x]\\s*${N}"\\s*$`));
  return m ? { a: num(m[1]), b: num(m[3]), h: num(m[2]) } : null;
}
function disagree(p: ReturnType<typeof generateFromPrompt>): string[] {
  const hd = header(p);
  if (!hd) return [];
  const out: string[] = [];
  // Depth: the header says a typed depth back and notes doors standing proud (linen's 16"), so the box depth and the
  // model's finished depth (fronts included) both name the same build. Width and height have one value.
  const depths = [hd.d, p.overall.depth, modelFinishedDepth(p.panels, p.overall.depth)];
  const isD = (x: number) => depths.some((d) => near(x, d));
  const same = (s: { a: number; b: number; h: number }) => near(s.h, hd.h) && ((near(s.a, hd.w) && isD(s.b)) || (isD(s.a) && near(s.b, hd.w)));
  const t = titleSize(p.name ?? "");
  if (t && !same(t)) out.push(`title '${p.name}'`);
  const s1 = (buildPlan(p).instructions?.[0]?.description ?? "") as string;
  const s = labeled(s1);
  if (s && !same(s)) out.push(`step 01 '${s1.match(new RegExp(`${N}"\\s*(?:wide|long)[^.]*`))?.[0]}'`);
  return out.length ? [`${p.prompt}: header ${hd.w} W × ${hd.d} D × ${hd.h} H; ${out.join("; ")}`] : [];
}

describe("size labels: title, step 01 and header name one overall size", () => {
  it("every corpus build and every rolling build", () => {
    const all = [...new Set([...corpus(), ...EVAL_PROMPTS, ...Object.values(SWEEPS).flatMap((x) => x.prompts), ...ROLLING])];
    const bad: string[] = [];
    let checked = 0;
    for (const q of all) {
      const p = generateFromPrompt(q);
      if (!p.panels.length && !(p.instances ?? []).length) continue;
      checked++;
      bad.push(...disagree(p));
    }
    assert.ok(checked > 300, `only ${checked} builds checked`);
    assert.deepEqual(bad, [], `${bad.length} builds disagree:\n${bad.join("\n")}`);
  });
  it("after Taller and Wider on a caster build, the labels still agree (Critic: 38\" vs 41\")", () => {
    for (const q of ["rolling kitchen island", "mobile workbench"]) {
      for (const step of ["2 inches taller", "2 inches wider"]) {
        const r = refineProject(generateFromPrompt(q), step);
        assert.ok(r.project, `${q} · ${step} refused`);
        assert.deepEqual(disagree(r.project!), [], `${q} · ${step}`);
      }
    }
  });
});
