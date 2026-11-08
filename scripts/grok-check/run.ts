#!/usr/bin/env -S npx tsx
/**
 * Nightly arm-B after-build check (REPORT ONLY). For each corpus prompt: build it with the engine of a release
 * checkout, summarise the build, ask Grok for mismatches against the frozen intake spec, drop the known false
 * positives (filter.ts), and write a report. It never changes a build and never fails a run on a mismatch.
 *
 * Modes (picked automatically):
 *   off     default. No call is made, no network. Builds every summary and prices the run it would make.
 *   live    only when the repo variable AND the key secret are both set (the gate is in client.ts). $2/run hard cap (budget.ts).
 *   replay  --replay <fixture.json>: recorded responses and their recorded summaries; no engine, no network.
 *
 *   cd <release checkout> && npx tsx <main>/scripts/grok-check/run.ts --root . --out /tmp/grok-check [--ref release/x] [--limit N] [--cap 2]
 *   npx tsx scripts/grok-check/run.ts --replay scripts/grok-check/fixtures/ab-2026-10-19.json --out /tmp/gc
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Budget, CAP_USD, CapReached, MODEL, PRICE, countTokens, worstCaseUsd } from "./budget.ts";
import { SCHEMA as SCHEMA_FOR_COUNT, SYSTEM, grokCheckGate, liveTransport, replayTransport, type Msg, type Transport } from "./client.ts";
import { filterMismatches, type Dropped, type Mismatch } from "./filter.ts";
import { buildSummary, userMessage, type Engine } from "./summary.ts";

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };

export type Row = { id: string; prompt: string; title: string; status: "checked" | "no-build" | "error" | "not-checked-cap" | "not-checked-time" | "not-checked-off"; est_input_tokens?: number; reserved_usd?: number; cost_usd?: number; kept: Mismatch[]; dropped: Dropped[]; err?: string };
export type Report = { kind: "yard-grok-check"; mode: "off" | "live" | "replay"; reason?: string; ref: string | null; model: string; price_per_1m: { in: number; cached: number; out: number }; cap_usd: number; prompts: number; calls: number; spent_usd: number; stopped_for_cap: boolean; projected: { worst_case_usd: number; expected_usd: number; mean_input_tokens: number }; flagged_builds: number; mismatches_kept: number; mismatches_dropped: Record<string, number>; rows: Row[] };

/** Stop sending calls after 20 minutes so the report is always written inside the 30-minute job timeout. */
export const DEADLINE_MS = 20 * 60_000;
type CorpusRow = { id: string; prompt: string; spec: any; summary?: string; recorded?: any };

export async function runCheck(o: { corpus: CorpusRow[]; mode: "off" | "live" | "replay"; reason?: string; engine?: Engine; transport?: Transport; cap?: number; ref?: string | null; limit?: number; deadlineMs?: number; now?: () => number }): Promise<Report> {
  const budget = new Budget(o.cap ?? CAP_USD);
  const now = o.now ?? Date.now;
  const stopAt = now() + (o.deadlineMs ?? DEADLINE_MS);
  const rows: Row[] = [];
  let worst = 0, expected = 0, tokSum = 0, tokN = 0;
  for (const c of o.corpus.slice(0, o.limit ?? o.corpus.length)) {
    const s = c.summary != null ? { summary: c.summary, title: (c.summary.match(/^Title: (.*)$/m)?.[1] ?? "") } : o.engine ? buildSummary(o.engine, c.prompt) : { summary: "", title: "", error: "no engine" };
    if (!s.summary) { rows.push({ id: c.id, prompt: c.prompt, title: "", status: "no-build", kept: [], dropped: [], err: (s as any).error }); continue; }
    const messages: Msg[] = [{ role: "system", content: SYSTEM }, { role: "user", content: userMessage(c.spec, s.summary) }];
    const tokens = countTokens(messages, JSON.stringify(SCHEMA_FOR_COUNT));
    const wc = worstCaseUsd(tokens);
    worst += wc; tokSum += tokens; tokN++;
    expected += tokens * 0.77 * PRICE.in + 37 * PRICE.out; // mean case, no cache: real prompt tokens ≈ 0.77 × the count, 37 output (recorded B calls, fixtures)
    const base = { id: c.id, prompt: c.prompt, title: s.title.split(" · ")[0], est_input_tokens: tokens, kept: [] as Mismatch[], dropped: [] as Dropped[] };
    if (o.mode === "off" || !o.transport) { rows.push({ ...base, status: "not-checked-off" }); continue; }
    if (now() > stopAt) { rows.push({ ...base, status: "not-checked-time", err: "run deadline (job timeout guard)" }); continue; }
    let reserved: number;
    try { reserved = budget.reserve(tokens); }
    catch (e) { if (e instanceof CapReached) { rows.push({ ...base, status: "not-checked-cap", err: e.message }); continue; } throw e; }
    const reply = await o.transport.send(c.id, messages);
    const cost = budget.charge(reserved, reply.usage);
    if (reply.err || !reply.json) { rows.push({ ...base, status: "error", reserved_usd: reserved, cost_usd: cost, err: reply.err ?? "empty" }); continue; }
    const { kept, dropped } = filterMismatches(reply.json.mismatches ?? [], c.spec, s.summary);
    rows.push({ ...base, status: "checked", reserved_usd: +reserved.toFixed(6), cost_usd: +cost.toFixed(6), kept, dropped });
  }
  const droppedBy: Record<string, number> = {};
  for (const r of rows) for (const d of r.dropped) droppedBy[d.droppedAs] = (droppedBy[d.droppedAs] ?? 0) + 1;
  return {
    kind: "yard-grok-check", mode: o.mode, reason: o.reason, ref: o.ref ?? null, model: MODEL,
    price_per_1m: { in: +(PRICE.in * 1e6).toFixed(4), cached: +(PRICE.cached * 1e6).toFixed(4), out: +(PRICE.out * 1e6).toFixed(4) }, cap_usd: budget.cap,
    prompts: rows.length, calls: budget.calls, spent_usd: +budget.spent.toFixed(6), stopped_for_cap: budget.stopped && rows.some((r) => r.status === "not-checked-cap"),
    projected: { worst_case_usd: +worst.toFixed(4), expected_usd: +expected.toFixed(4), mean_input_tokens: tokN ? Math.round(tokSum / tokN) : 0 },
    flagged_builds: rows.filter((r) => r.kept.length).length, mismatches_kept: rows.reduce((s, r) => s + r.kept.length, 0), mismatches_dropped: droppedBy, rows,
  };
}


export function renderReport(r: Report): string {
  const L = [`# Yard Grok after-build check (arm B, report only)`, ""];
  L.push(`- mode: **${r.mode}**${r.reason ? ` (${r.reason})` : ""}${r.ref ? ` · engine: \`${r.ref}\`` : ""}`);
  L.push(`- model \`${r.model}\` at $${r.price_per_1m.in}/$${r.price_per_1m.cached}/$${r.price_per_1m.out} per 1M (input/cached/output) · cap $${r.cap_usd.toFixed(2)}/run`);
  L.push(`- ${r.prompts} prompts · ${r.calls} calls · spent $${r.spent_usd.toFixed(4)}${r.stopped_for_cap ? " · **stopped at the cap**" : ""} · projected full run: expected ~$${r.projected.expected_usd.toFixed(2)}, worst case $${r.projected.worst_case_usd.toFixed(2)} (mean ${r.projected.mean_input_tokens} input tokens, counted before each call)`);
  if (r.mode !== "off") {
    L.push(`- ${r.flagged_builds} builds flagged · ${r.mismatches_kept} mismatches kept · dropped as known false positives: ${Object.entries(r.mismatches_dropped).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`, "");
    L.push(`| id | prompt | build | mismatches (kept) |`, `|---|---|---|---|`);
    for (const x of r.rows.filter((x) => x.kept.length || x.status === "error" || x.status === "not-checked-cap" || x.status === "not-checked-time"))
      L.push(`| ${x.id} | ${x.prompt.replace(/\|/g, "\\|")} | ${x.title.replace(/\|/g, "\\|")} | ${x.status !== "checked" ? x.status + (x.err ? `: ${x.err}` : "") : x.kept.map((m) => `${m.severity} ${m.kind}: "${m.spec_quote}" → ${m.build_shows}`.replace(/\|/g, "\\|")).join("<br>")} |`);
  }
  return L.join("\n") + "\n";
}

if (process.argv[1]?.endsWith("run.ts")) {
  const realFetch = globalThis.fetch;
  // Nothing in this run may touch the network except the live transport, which holds the real fetch.
  globalThis.fetch = (async () => { throw new Error("grok-check: network is disabled outside the live transport"); }) as typeof fetch;
  const out = resolve(arg("--out") ?? "/tmp/grok-check");
  mkdirSync(out, { recursive: true });
  const replay = arg("--replay");
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
  const cap = arg("--cap") ? Number(arg("--cap")) : CAP_USD;
  let report: Report;
  if (replay) {
    const rows = JSON.parse(readFileSync(resolve(replay), "utf8")).rows;
    report = await runCheck({ corpus: rows, mode: "replay", transport: replayTransport(rows), cap, limit, ref: `replay:${replay}` });
  } else {
    const root = resolve(arg("--root") ?? ".");
    const imp = (p: string) => import(pathToFileURL(join(root, p)).href);
    const [pm, rp, pdf] = await Promise.all([imp("src/lib/yard/promptMain.ts"), imp("src/lib/yard/report.ts"), imp("src/lib/yard/pdf.ts")]);
    const engine: Engine = { generateFromPrompt: pm.generateFromPrompt, buildPlan: rp.buildPlan, headerTitle: pdf.headerTitle };
    const corpus = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8")).prompts;
    const gate = grokCheckGate();
    report = gate.on
      ? await runCheck({ corpus, mode: "live", engine, transport: liveTransport(process.env, realFetch), cap, limit, ref: arg("--ref") ?? null })
      : await runCheck({ corpus, mode: "off", reason: gate.reason, engine, cap, limit, ref: arg("--ref") ?? null });
  }
  writeFileSync(join(out, "grok-check.json"), JSON.stringify(report, null, 1) + "\n");
  writeFileSync(join(out, "grok-check.md"), renderReport(report));
  console.log(renderReport(report).split("\n").slice(0, 6).join("\n"));
}
