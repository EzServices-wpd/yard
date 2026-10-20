#!/usr/bin/env -S npx tsx
/**
 * Cost estimate for the nightly arm-B check. No calls: inputs are the A/B token counts (grok-intake-ab tokens.json,
 * tiktoken o200k, copied below), the recorded usage of the 118 real B calls (fixtures/ab-2026-10-19.json) and
 * xAI's published price (budget.ts). Formula as grok-intake-ab cost_calc.py:
 *   cost_call = (I − h·P)·p_in + h·P·p_cache + O·p_out
 *
 *   npx tsx scripts/grok-check/cost.ts
 */
import { readFileSync } from "node:fs";
import { CAP_USD, MODEL, PRICE, countTokens, worstCaseUsd } from "./budget.ts";
import { SCHEMA, SYSTEM } from "./client.ts";
import { userMessage } from "./summary.ts";

/** grok-intake-ab/tokens.json (2026-10-19), B rows. */
export const TOKENS = { B_prefix_system_plus_schema: 525, B_input_mean: 1124.94, B_input_p95: 1541, B_out_mean: 66.83, B_out_p95: 121, B_summaries_built: 118 };
export const RUN_PROMPTS = 118; // corpus.json = the per-run corpus
export const NIGHTS_PER_MONTH = 365.25 / 12;

const call = (I: number, P: number, O: number, h: number) => (I - h * P) * PRICE.in + h * P * PRICE.cached + O * PRICE.out;
export function estimate() {
  const rows = JSON.parse(readFileSync(new URL("./fixtures/ab-2026-10-19.json", import.meta.url), "utf8")).rows as any[];
  const N = RUN_PROMPTS, T = TOKENS, P = T.B_prefix_system_plus_schema;
  const mean0 = call(T.B_input_mean, P, T.B_out_mean, 0), p950 = call(T.B_input_p95, P, T.B_out_p95, 0), mean1 = call(T.B_input_mean, P, T.B_out_mean, 1);
  const tok = { no_cache_mean: N * mean0, no_cache_p95: N * p950, cached_mean: mean0 + (N - 1) * mean1 };
  const recorded = rows.reduce((s, r) => s + r.recorded.cost_usd, 0);
  const recordedNoCache = rows.reduce((s, r) => s + r.recorded.usage.prompt_tokens * PRICE.in + r.recorded.usage.completion_tokens * PRICE.out, 0);
  const reserve = rows.reduce((s, r) => s + worstCaseUsd(countTokens([{ role: "system", content: SYSTEM }, { role: "user", content: userMessage(r.spec, r.summary) }], JSON.stringify(SCHEMA))), 0);
  const perRun = { "o200k mean, no cache": tok.no_cache_mean, "o200k mean, prefix cached": tok.cached_mean, "o200k p95, no cache": tok.no_cache_p95, "recorded 2026-10-19 (billed)": recorded, "recorded tokens, no cache": recordedNoCache, "pre-call reservation (cap check)": reserve };
  return { model: MODEL, price_per_1m: { in: PRICE.in * 1e6, cached: PRICE.cached * 1e6, out: PRICE.out * 1e6 }, prompts_per_run: N, cap_usd: CAP_USD, perRun, perMonth: Object.fromEntries(Object.entries(perRun).map(([k, v]) => [k, v * NIGHTS_PER_MONTH])), capVsRun: Object.fromEntries(Object.entries(perRun).map(([k, v]) => [k, CAP_USD / v])) };
}
if (process.argv[1]?.endsWith("cost.ts")) {
  const e = estimate();
  console.log(`${e.model} at $${e.price_per_1m.in.toFixed(2)}/$${e.price_per_1m.cached.toFixed(2)}/$${e.price_per_1m.out.toFixed(2)} per 1M · ${e.prompts_per_run} B calls per run · cap $${e.cap_usd.toFixed(2)}/run`);
  console.log(`| basis | per run | per month (nightly, ${NIGHTS_PER_MONTH.toFixed(2)} runs) | cap ÷ run |`);
  for (const k of Object.keys(e.perRun)) console.log(`| ${k} | $${e.perRun[k as keyof typeof e.perRun].toFixed(4)} | $${e.perMonth[k].toFixed(2)} | ${e.capVsRun[k].toFixed(1)}× |`);
}
