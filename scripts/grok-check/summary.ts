/**
 * The build summary arm B is sent: title, overall size, material, pieces/total, cut list, Buy, feasibility notes and
 * step titles — engine output only (no network). Unlike the 2026-10-19 A/B summaries it carries no internal
 * `Kind:` line: B read "Kind: closet" as the build's noun (false-positive class 1).
 */
export type Engine = { generateFromPrompt: (q: string) => any; buildPlan: (p: any) => any; headerTitle: (p: any) => string };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildSummary(E: Engine, prompt: string): { summary: string; title: string; error?: string } {
  try {
    const p = E.generateFromPrompt(prompt);
    const plan = E.buildPlan(p);
    const title = E.headerTitle(p);
    const parts = plan.cutList.map((c: any) => `${c.label ? c.label + " " : ""}${c.name} ×${c.quantity} — ${r2(c.lengthIn)} × ${r2(c.widthIn)} × ${r2(c.thicknessIn)} in ${c.material}`);
    const buy = plan.bom.map((b: any) => `${b.name} ×${b.quantity} ${b.unit}${b.estimatedCost != null ? ` $${r2(b.estimatedCost)}` : ""}`);
    const summary = [
      `Title: ${title}`,
      `Overall (in): W ${r2(p.overall.width)} × D ${r2(p.overall.depth)} × H ${r2(p.overall.height)}`,
      `Material: ${p.primaryMaterialId}${p.joinMethod ? `; join: ${p.joinMethod}` : ""}`,
      `Pieces: ${plan.totals.pieces}; est. total $${r2(plan.totals.estCostUsd)}`,
      `Parts:`, ...parts.map((x: string) => `- ${x}`),
      `Buy:`, ...buy.map((x: string) => `- ${x}`),
      `Feasibility: ${plan.feasibility.status}: ${plan.feasibility.summary}`,
      ...(plan.feasibility.issues ?? []).slice(0, 6).map((i: any) => `- note: ${i.message ?? i.title ?? JSON.stringify(i)}`),
      `Steps: ${plan.instructions.map((s: any) => s.title).join(" → ")}`,
    ].join("\n");
    return { summary, title };
  } catch (e: any) {
    return { summary: "", title: "", error: String(e?.message ?? e).slice(0, 200) };
  }
}

export const userMessage = (spec: unknown, summary: string) => `Intake spec:\n${JSON.stringify(spec)}\n\nBuild summary:\n${summary}`;
