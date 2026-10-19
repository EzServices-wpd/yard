#!/usr/bin/env -S npx tsx
/**
 * Eval gate diff: PR head vs its merge-base main (or a tree vs evals/gate.json with `eval:gate -- --check`).
 * Fails when a canary fails, a prompt is newly failing (grade went down) and is not in evals/gate-allow.json
 * with a reason, the total points drop, or a property fails that is not expected-fail in evals/props-allow.json.
 *
 *   npx tsx scripts/eval-gate-diff.ts --base base.json --head head.json [--base-props bp.json --head-props hp.json] [--out comment.md] [--runtime "3m 10s"]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { KeyReport } from "./eval-gate-keys.ts";
import type { CanaryResult, PromptResult, Totals } from "./eval-gate-lib.ts";

type Gate = { totals: Totals; canaries: { ok: boolean; results: CanaryResult[] }; prompts: PromptResult[]; answerKeys?: KeyReport | null };
export type Allow = { newlyFailing?: { prompt: string; reason: string }[] };
export type PropRow = { name: string; status: "pass" | "fail" | "expected-fail" | "stale-expected-fail"; runs: number; counterexample?: string; reason?: string };
export type Props = { seed: number; properties: PropRow[] };
const rank = { pass: 2, partial: 1, fail: 0 } as const;

export function diffGates(base: Gate, head: Gate, allow: Allow, props?: { base?: Props; head?: Props }) {
  const B = new Map(base.prompts.map((r) => [r.prompt, r]));
  const H = new Map(head.prompts.map((r) => [r.prompt, r]));
  const common = [...H.keys()].filter((q) => B.has(q)).sort();
  const pts = (m: Map<string, PromptResult>) => common.reduce((t, q) => t + rank[m.get(q)!.grade], 0);
  const hon = (m: Map<string, PromptResult>) => common.reduce((t, q) => t + m.get(q)!.honor.honored, 0);
  const reasons = new Map((allow.newlyFailing ?? []).filter((a) => a.reason?.trim()).map((a) => [a.prompt, a.reason]));
  const newlyFailing = common.filter((q) => rank[H.get(q)!.grade] < rank[B.get(q)!.grade]).map((q) => ({ prompt: q, from: B.get(q)!.grade, to: H.get(q)!.grade, classes: H.get(q)!.classes.filter((c) => !B.get(q)!.classes.includes(c)), allowed: reasons.get(q) ?? null }));
  const newlyPassing = common.filter((q) => rank[H.get(q)!.grade] > rank[B.get(q)!.grade]).map((q) => ({ prompt: q, from: B.get(q)!.grade, to: H.get(q)!.grade, fixed: B.get(q)!.classes.filter((c) => !H.get(q)!.classes.includes(c)) }));
  const cnt = (m: Map<string, PromptResult>) => { const o: Record<string, number> = {}; for (const q of common) for (const c of m.get(q)!.classes) o[c] = (o[c] ?? 0) + 1; return o; };
  const cb = cnt(B), ch = cnt(H);
  const classMoves = [...new Set([...Object.keys(cb), ...Object.keys(ch)])].map((c) => ({ cls: c, base: cb[c] ?? 0, head: ch[c] ?? 0 })).filter((x) => x.base !== x.head).sort((a, b) => Math.abs(b.head - b.base) - Math.abs(a.head - a.base) || (a.cls < b.cls ? -1 : 1));
  const basePoints = pts(B), headPoints = pts(H);
  const propsBad = (props?.head?.properties ?? []).filter((p) => p.status === "fail");
  const propsNew = (props?.head?.properties ?? []).filter((p) => p.status !== "pass" && props?.base?.properties.find((b) => b.name === p.name)?.status === "pass");
  const unallowed = newlyFailing.filter((x) => !x.allowed);
  const why: string[] = [];
  if (!head.canaries.ok) why.push(`canary failed: ${head.canaries.results.filter((c) => !c.ok).map((c) => c.id).join(", ")}`);
  if (unallowed.length) why.push(`${unallowed.length} newly failing prompt(s) not in evals/gate-allow.json`);
  if (headPoints < basePoints) why.push(`total dropped ${basePoints} → ${headPoints}`);
  if (propsBad.length) why.push(`${propsBad.length} property(ies) failing and not expected-fail`);
  return {
    ok: !why.length, why, common: common.length, base: base.totals, head: head.totals, basePoints, headPoints,
    baseHonor: hon(B), headHonor: hon(H), newlyFailing, newlyPassing, classMoves,
    added: [...H.keys()].filter((q) => !B.has(q)).length, removed: [...B.keys()].filter((q) => !H.has(q)).length,
    canaries: head.canaries.results, baseCanaries: base.canaries.results, props, propsBad, propsNew,
    // Report only: answer keys never enter `ok`.
    keys: { head: head.answerKeys ?? null, base: base.answerKeys ?? null },
  };
}
type Diff = ReturnType<typeof diffGates>;
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const pct = (n: number) => `${Math.round(n * 10) / 10}`;
export const MARKER = "<!-- yard-eval-gate -->";
export function renderComment(d: Diff, o: { headLabel?: string; baseLabel?: string; runtime?: string; run?: string } = {}): string {
  const L: string[] = [MARKER, `## Eval gate ${d.ok ? "✅ pass" : "❌ fail"}`, ""];
  if (!d.ok) L.push(`**Why:** ${d.why.join("; ")}`, "");
  const h = d.head, b = d.base;
  L.push(`| | pass | partial | fail | points | honor |`, `|---|---|---|---|---|---|`);
  L.push(`| ${o.baseLabel ?? "main (merge-base)"} | ${b.pass} | ${b.partial} | ${b.fail} | ${b.points}/${b.maxPoints} | ${b.honored}/${b.checkable} (${b.honorPct}%) |`);
  L.push(`| ${o.headLabel ?? "PR head"} | ${h.pass} | ${h.partial} | ${h.fail} | ${h.points}/${h.maxPoints} | ${h.honored}/${h.checkable} (${h.honorPct}%) |`);
  L.push(`| **Δ** | ${sgn(h.pass - b.pass)} | ${sgn(h.partial - b.partial)} | ${sgn(h.fail - b.fail)} | ${sgn(d.headPoints - d.basePoints)} (on ${d.common} shared prompts) | ${sgn(d.headHonor - d.baseHonor)} (${sgn(Math.round((h.honorPct - b.honorPct) * 10) / 10)} pts) |`, "");
  if (d.added || d.removed) L.push(`Corpus: ${d.added} prompt(s) only on head, ${d.removed} only on base (not scored in Δ).`, "");
  const cf = d.canaries.filter((c) => !c.ok);
  L.push(`**Canaries:** ${cf.length ? `❌ ${cf.length} failing` : `✅ ${d.canaries.length}/${d.canaries.length}`} — ${d.canaries.map((c) => `${c.ok ? "✅" : "❌"} ${c.id}`).join(" · ")}`);
  for (const c of cf) L.push(`- ❌ **${c.id}** (${c.prompt.slice(0, 60)}): ${c.failures.join("; ")}`);
  L.push("");
  L.push(`**Newly failing (${d.newlyFailing.length}):**${d.newlyFailing.length ? "" : " none"}`);
  for (const x of d.newlyFailing.slice(0, 40)) L.push(`- ${x.allowed ? "⚠️ allowed" : "❌"} \`${x.prompt}\` ${x.from} → ${x.to}${x.classes.length ? ` (new: ${x.classes.join(", ")})` : ""}${x.allowed ? ` — ${x.allowed}` : ""}`);
  if (d.newlyFailing.length > 40) L.push(`- … ${d.newlyFailing.length - 40} more (see the gate artifact)`);
  L.push("", `**Newly passing (${d.newlyPassing.length}):**${d.newlyPassing.length ? "" : " none"}`);
  for (const x of d.newlyPassing.slice(0, 40)) L.push(`- ✅ \`${x.prompt}\` ${x.from} → ${x.to}${x.fixed.length ? ` (cleared: ${x.fixed.join(", ")})` : ""}`);
  if (d.newlyPassing.length > 40) L.push(`- … ${d.newlyPassing.length - 40} more`);
  L.push("", `**Failure classes that moved:**${d.classMoves.length ? "" : " none"}`);
  if (d.classMoves.length) { L.push("| class | main | head | Δ |", "|---|---|---|---|"); for (const c of d.classMoves.slice(0, 25)) L.push(`| ${c.cls} | ${c.base} | ${c.head} | ${sgn(c.head - c.base)} |`); }
  const hp = d.props?.head;
  if (hp) {
    const by = (s: string) => hp.properties.filter((p) => p.status === s);
    L.push("", `**Properties (fast-check, seed ${hp.seed}):** ${by("pass").length} pass · ${by("expected-fail").length} expected-fail · ${by("fail").length} fail${by("stale-expected-fail").length ? ` · ${by("stale-expected-fail").length} now pass (drop from evals/props-allow.json)` : ""}`);
    for (const p of hp.properties) L.push(`- ${p.status === "pass" ? "✅" : p.status === "expected-fail" ? "⚠️ expected-fail" : p.status === "fail" ? "❌" : "🎉 now passes"} ${p.name}${p.counterexample ? ` — e.g. \`${p.counterexample}\`` : ""}${p.reason && p.status !== "pass" ? ` (${p.reason})` : ""}`);
  }
  const kh = d.keys.head, kb = d.keys.base;
  if (kh) {
    const ks = kh.score;
    L.push("", `**Answer keys (report only — not in the merge rule):** ${ks.ok}/${ks.total} checks (${Math.round((1000 * ks.ok) / ks.total) / 10}%), ${ks.clean}/${ks.keys} keys fully passing${kb ? ` · main ${kb.score.ok}/${kb.score.total}, ${kb.score.clean}/${kb.score.keys} (Δ ${sgn(ks.ok - kb.score.ok)} checks, ${sgn(ks.clean - kb.score.clean)} keys)` : ""}`);
    if (kb) {
      const KB = new Map(kb.rows.map((r) => [r.id, r]));
      const moved = kh.rows.filter((r) => KB.has(r.id) && KB.get(r.id)!.ok !== r.ok).map((r) => `${r.id} ${KB.get(r.id)!.ok}→${r.ok}/${r.total}`);
      if (moved.length) L.push(`- keys that moved: ${moved.slice(0, 15).join(" · ")}${moved.length > 15 ? ` · … ${moved.length - 15} more` : ""}`);
    }
    L.push(`- misses by check: ${Object.entries(kh.byCheck).slice(0, 10).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
    L.push("", "<details><summary>Top miss patterns (build type × check)</summary>", "", "| build type | check | keys missing | e.g. |", "|---|---|---|---|");
    for (const p of kh.patterns.slice(0, 15)) L.push(`| ${p.type} | ${p.check} | ${p.misses}/${p.of} | ${p.examples[0].replace(/\|/g, "/").slice(0, 90)} |`);
    L.push("", "Leg counter is approximate; footprint is a sorted pair (ignores which axis Yard calls width).", "</details>");
  }
  L.push("", `<sub>${[o.runtime ? `runtime ${o.runtime}` : "", o.run ? `[run](${o.run})` : "", "per-class target: `npm run eval:gate -- --class <id>`"].filter(Boolean).join(" · ")}</sub>`);
  return L.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("eval-gate-diff.ts")) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const rd = (f?: string) => (f ? JSON.parse(readFileSync(resolve(f), "utf8")) : undefined);
  if (arg("--base") && arg("--head")) {
    const allow = rd(arg("--allow") ?? new URL("../evals/gate-allow.json", import.meta.url).pathname);
    const d = diffGates(rd(arg("--base")), rd(arg("--head")), allow, { base: rd(arg("--base-props")), head: rd(arg("--head-props")) });
    const md = renderComment(d, { runtime: arg("--runtime"), run: arg("--run") });
    if (arg("--out")) writeFileSync(resolve(arg("--out")!), md);
    console.log(md);
    if (!d.ok) process.exitCode = 1;
  }
}
