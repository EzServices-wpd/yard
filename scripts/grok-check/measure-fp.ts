#!/usr/bin/env -S npx tsx
/**
 * False-positive rate of arm B before and after the deterministic filter, on RECORDED outputs only
 * (fixtures/ab-2026-10-19.json: Grok's 2026-10-19 responses + hand labels). No network, no xAI.
 *
 *   npx tsx scripts/grok-check/measure-fp.ts [--write]   # --write updates scripts/grok-check/fp-report.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { filterMismatches, type Mismatch } from "./filter.ts";

type Row = { id: string; prompt: string; spec: any; summary: string; recorded: { json: { mismatches: Mismatch[] } | null }; labels: ("R" | "F" | "U")[] };
export const FIXTURE = new URL("./fixtures/ab-2026-10-19.json", import.meta.url);
export const loadFixture = (): Row[] => JSON.parse(readFileSync(FIXTURE, "utf8")).rows;

const rate = (c: Record<"R" | "F" | "U", number>) => {
  const n = c.R + c.F + c.U;
  return { flagged: n, real: c.R, false_positive: c.F, unclear: c.U, fp_rate_of_flagged: n ? +(c.F / n).toFixed(4) : 0, fp_rate_of_decided: c.R + c.F ? +(c.F / (c.R + c.F)).toFixed(4) : 0, precision_of_decided: c.R + c.F ? +(c.R / (c.R + c.F)).toFixed(4) : 0 };
};
export function measure(rows = loadFixture()) {
  const before = { R: 0, F: 0, U: 0 }, after = { R: 0, F: 0, U: 0 };
  const byRule: Record<string, { R: number; F: number; U: number }> = {};
  const dropped: { id: string; label: string; rule: string; kind: string; quote: string; why: string }[] = [];
  const remainingF: { id: string; kind: string; quote: string; shows: string }[] = [];
  let buildsFlaggedBefore = 0, buildsFlaggedAfter = 0, realBuildsBefore = 0, realBuildsAfter = 0;
  for (const r of rows) {
    const ms = r.recorded.json?.mismatches ?? [];
    if (ms.length !== r.labels.length) throw new Error(`${r.id}: ${ms.length} mismatches, ${r.labels.length} labels`);
    const { dropped: d } = filterMismatches(ms, r.spec, r.summary);
    const keptReal = ms.some((m, i) => r.labels[i] === "R" && !d.some((x) => x.kind === m.kind && x.spec_quote === m.spec_quote && x.build_shows === m.build_shows));
    ms.forEach((m, i) => {
      const l = r.labels[i];
      before[l]++;
      const hit = d.find((x) => x.kind === m.kind && x.spec_quote === m.spec_quote && x.build_shows === m.build_shows);
      if (hit) { (byRule[hit.droppedAs] ??= { R: 0, F: 0, U: 0 })[l]++; dropped.push({ id: r.id, label: l, rule: hit.droppedAs, kind: m.kind, quote: m.spec_quote, why: hit.why }); }
      else { after[l]++; if (l === "F") remainingF.push({ id: r.id, kind: m.kind, quote: m.spec_quote, shows: m.build_shows.slice(0, 100) }); }
    });
    if (ms.length) buildsFlaggedBefore++;
    if (ms.length > d.length) buildsFlaggedAfter++;
    if (r.labels.includes("R")) { realBuildsBefore++; if (keptReal) realBuildsAfter++; }
  }
  return {
    note: "Arm B false positives on recorded outputs only (no calls). Labels: grok-intake-ab RESULTS.md §5 hand read (R real, F false positive, U unclear). fp_rate_of_decided = F/(R+F).",
    builds: rows.length,
    before: { ...rate(before), builds_flagged: buildsFlaggedBefore, builds_with_a_real_flag: realBuildsBefore },
    after: { ...rate(after), builds_flagged: buildsFlaggedAfter, builds_with_a_real_flag: realBuildsAfter },
    dropped_by_rule: byRule,
    dropped,
    remaining_false_positives: remainingF,
  };
}

if (process.argv[1]?.endsWith("measure-fp.ts")) {
  const m = measure();
  const f = (x: typeof m.before) => `${x.flagged} flagged: ${x.real} R / ${x.false_positive} F / ${x.unclear} U · FP ${(100 * x.fp_rate_of_flagged).toFixed(1)}% of flagged, ${(100 * x.fp_rate_of_decided).toFixed(1)}% of decided (precision ${(100 * x.precision_of_decided).toFixed(1)}%) · ${x.builds_flagged} builds flagged, ${x.builds_with_a_real_flag} with a real flag`;
  console.log(`before: ${f(m.before)}\nafter:  ${f(m.after)}\nby rule: ${JSON.stringify(m.dropped_by_rule)}`);
  for (const d of m.dropped) console.log(`  drop ${d.label} ${d.id} ${d.rule} ${d.kind} "${d.quote}" — ${d.why}`);
  for (const d of m.remaining_false_positives) console.log(`  still F ${d.id} ${d.kind} "${d.quote}" — ${d.shows}`);
  if (process.argv.includes("--write")) writeFileSync(new URL("./fp-report.json", import.meta.url), JSON.stringify(m, null, 1) + "\n");
}
