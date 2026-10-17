import { generateFromPrompt } from "@/lib/yard/prompt";
import { buildPlan } from "@/lib/yard/report";
import type { BuildPlan, YardProject } from "@/lib/yard/types";

/**
 * Chief's item: when this build costs more (or less) than the plain build of the same thing at the
 * same size, say why in one line, from the plans' own Buy lines. No links, no hardcoded reasons.
 * The plain build is re-derived from a size-only prompt and only trusted when it is the same build
 * (same kind, size and cut list); otherwise there is no line. Runs at idle, never before the model.
 */
export type PriceReason = { delta: number; base: number; text: string };

/** Same build: the same rows and counts, sizes within an inch (a fitted alcove trims depth a little). */
const sameCuts = (a: BuildPlan, b: BuildPlan) =>
  a.cutList.length === b.cutList.length &&
  a.cutList.every((c, i) => { const d = b.cutList[i]; return c.label === d.label && c.quantity === d.quantity && Math.abs(c.lengthIn - d.lengthIn) <= 1 && Math.abs(c.widthIn - d.widthIn) <= 1; });
const r2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${Math.abs(n).toFixed(2)}`;
/** "GRK RSS #9 x 3-1/8 structural screws" → "structural screws": drop brand caps and sizes. */
export function shortName(name: string): string {
  const t = name.replace(/\([^)]*\)/g, "").replace(/(^|\s)([A-Z]{2,}|#\d+|[\d/.-]+(?:"|in|mm)?|x)(?=\s)/g, " ").replace(/\s+/g, " ").trim();
  return (t || name).toLowerCase();
}

export function diffReason(plan: BuildPlan, base: BuildPlan): PriceReason | null {
  const delta = r2(plan.totals.estCostUsd - base.totals.estCostUsd);
  if (Math.abs(delta) < 0.5) return null;
  const key = (b: { catalogId?: string; name: string }) => b.catalogId || b.name;
  const was = new Map(base.bom.map((b) => [key(b), b.estimatedCost ?? 0]));
  const now = new Map(plan.bom.map((b) => [key(b), b] as const));
  const changes: { name: string; d: number }[] = [];
  for (const [k, b] of now) { const d = r2((b.estimatedCost ?? 0) - (was.get(k) ?? 0)); if (Math.abs(d) >= 0.5) changes.push({ name: b.name, d }); }
  for (const b of base.bom) if (!now.has(key(b)) && (b.estimatedCost ?? 0) >= 0.5) changes.push({ name: b.name, d: -r2(b.estimatedCost ?? 0) });
  if (!changes.length) return null;
  changes.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const [top, ...rest] = changes;
  const verb = top.d > 0 ? (was.has(key({ name: top.name, catalogId: plan.bom.find((b) => b.name === top.name)?.catalogId })) ? "more" : "adds") : "drops";
  const amount = rest.length || Math.abs(top.d - delta) >= 0.01 ? ` (${top.d > 0 ? "+" : "−"}${usd(top.d)})` : "";
  const what = `${verb === "more" ? "more " : verb === "adds" ? "adds " : "drops "}${shortName(top.name)}${amount}`;
  const text = `${delta > 0 ? "+" : "−"}${usd(delta)} vs the plain build: ${what}${rest.length ? ` and ${rest.length} more` : ""}`;
  return { delta, base: base.totals.estCostUsd, text };
}

/** The same thing, plain, at the same size: candidate size-only prompts. */
export function plainPrompts(p: YardProject): string[] {
  const noun = (p.name || "").split(/\s+/)[0]?.toLowerCase().replace(/[^a-z-]/g, "") ?? "";
  const { width: w, height: h, depth: d } = p.overall;
  const size = `${w} wide ${h} tall ${d} deep`;
  return [...new Set([`${noun} ${p.kind} ${size}`, `${noun} ${size}`].filter((s) => /^[a-z]/.test(s)))];
}

export function priceReason(p: YardProject, plan: BuildPlan): PriceReason | null {
  if (!plan || plan.partsKind === "whole" || p.displayOnly) return null;
  for (const q of plainPrompts(p)) {
    if (q.trim().toLowerCase() === (p.prompt ?? "").trim().toLowerCase()) return null; // it is the plain build
    try {
      const bp = generateFromPrompt(q);
      if (bp.kind !== p.kind || bp.displayOnly) continue;
      const same = ["width", "height", "depth"].every((k) => Math.abs(bp.overall[k as "width"] - p.overall[k as "width"]) < 0.01);
      if (!same) continue;
      const base = buildPlan(bp);
      if (!sameCuts(base, plan)) continue;
      return diffReason(plan, base);
    } catch { /* no line */ }
  }
  return null;
}
