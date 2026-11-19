#!/usr/bin/env -S npx tsx
/**
 * Reader eval harness (5c groundwork): runs a list of prompts with and without the AI prompt reader, saves both
 * builds, and diffs them with the gate's grader, the honest checks included (H-standin, H-craft, H-unpriced).
 * The reader is the real one (src/lib/yard/aiReader: readPrompt, then chooseBuildPrompt), with local deps: a spend
 * budget kept here, a reply cache in the output folder, and no Upstash.
 *
 *   npx tsx scripts/reader-eval.ts --prompts evals/corpus/everyday150.json --out .reader-eval/e150
 *       dry run (the default): no network, no key. Replays replies saved by an earlier live run (replies.json in
 *       --out, or --replies <file>); prompts with no saved reply build from the typed words, and the projected
 *       worst-case spend of a live run is reported.
 *   npx tsx scripts/reader-eval.ts --prompts … --out … --live --cap-usd 2
 *       real xAI calls (XAI_API_KEY). Each call reserves its worst case first; the run stops calling once the next
 *       call could pass --cap-usd. --cap-usd is required with --live and can never exceed MAX_CAP_USD.
 *   options: --max <n> (first n prompts), --only-reader (only prompts the reader would be asked about)
 *
 * Writes into --out: without.json, with.json (graded rows), builds.jsonl (both builds per prompt), replies.json
 * (raw reader replies, replayable), diff.md (what the reader changed, worst first) and summary.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HEAD_ROOT, gradeBuild, loadCorpus, loadEngine, norm, type Entry, type PromptResult } from "./eval-gate-lib.ts";
import { typedDemands } from "./eval-gate-typed.ts";

export const MAX_CAP_USD = 5;

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (k: string) => argv.includes(k);

type Replies = Record<string, string>; // normalized prompt → the reader's raw message content
export type Side = { buildFrom: string; used: boolean; reason: string; replied: "saved" | "live" | "none" | "skipped" | "error"; usd: number };

/** A local spend budget with the server's reserve-then-settle shape: a call reserves its worst case first. */
export class Spend {
  reserved = 0; billed = 0; calls = 0;
  constructor(readonly cap: number) {
    if (!(cap > 0) || cap > MAX_CAP_USD) throw new Error(`--cap-usd must be > 0 and at most ${MAX_CAP_USD}`);
  }
  reserve(worst: number): boolean { if (this.billed + this.reserved + worst > this.cap) return false; this.reserved += worst; this.calls++; return true; }
  settle(worst: number, billed: number) { this.reserved -= worst; this.billed += billed; }
}

const RANK = { pass: 2, partial: 1, fail: 0 } as const;
export function diffRows(without: PromptResult[], withR: PromptResult[], sides: Record<string, Side>) {
  const by = new Map(withR.map((r) => [r.prompt, r]));
  const rows = without.map((a) => {
    const b = by.get(a.prompt)!;
    const s = sides[a.prompt];
    const moved = a.grade !== b.grade || a.header !== b.header || a.overall !== b.overall;
    return { prompt: a.prompt, from: s.buildFrom, used: s.used, reason: s.reason, before: a, after: b, delta: RANK[b.grade] - RANK[a.grade], moved };
  });
  const t = (rs: PromptResult[]) => ({ pass: rs.filter((r) => r.grade === "pass").length, partial: rs.filter((r) => r.grade === "partial").length, fail: rs.filter((r) => r.grade === "fail").length });
  return { rows, without: t(without), with: t(withR), better: rows.filter((r) => r.delta > 0).length, worse: rows.filter((r) => r.delta < 0).length, movedSameGrade: rows.filter((r) => r.moved && r.delta === 0).length };
}

export function diffMarkdown(d: ReturnType<typeof diffRows>, meta: { mode: string; prompts: number; asked: number; spent: number; projected: number }): string {
  const L: string[] = [];
  L.push(`# Reader eval · ${meta.mode}`, "");
  L.push(`- Prompts: ${meta.prompts} · the reader would be asked about ${meta.asked}`);
  L.push(`- Spend: $${meta.spent.toFixed(4)} billed${meta.mode === "dry run" ? ` · a live run would reserve at most $${meta.projected.toFixed(4)}` : ""}`);
  L.push(`- Without the reader: ${d.without.pass} pass / ${d.without.partial} partial / ${d.without.fail} fail`);
  L.push(`- With the reader: ${d.with.pass} pass / ${d.with.partial} partial / ${d.with.fail} fail`);
  L.push(`- Better ${d.better} · worse ${d.worse} · changed with the same grade ${d.movedSameGrade}`, "");
  const show = d.rows.filter((r) => r.moved).sort((a, b) => a.delta - b.delta || (a.prompt < b.prompt ? -1 : 1));
  L.push(`## What the reader changed (${show.length}), worst first`, "");
  if (!show.length) L.push("Nothing changed.", "");
  L.push("| prompt | built from | without | with |", "|---|---|---|---|");
  for (const r of show) {
    const cell = (x: PromptResult) => `${x.grade} [${x.classes.join(" ")}] ${(x.header ?? "").replace(/\|/g, "/").slice(0, 60)} · ${x.overall ?? ""}`;
    L.push(`| ${r.prompt.replace(/\|/g, "/")} | ${r.from === r.prompt ? "(typed)" : r.from.replace(/\|/g, "/")} | ${cell(r.before)} | ${cell(r.after)} |`);
  }
  L.push("");
  return L.join("\n");
}

async function main() {
  const live = flag("--live");
  const cap = arg("--cap-usd");
  if (live && !cap) throw new Error("--live needs --cap-usd (at most $" + MAX_CAP_USD + ")");
  if (live && !process.env.XAI_API_KEY) throw new Error("--live needs XAI_API_KEY in the environment");
  const spend = new Spend(live ? Number(cap) : MAX_CAP_USD);
  // A dry run cannot reach the network at all: any fetch throws, as in the gate (offline()).
  if (!live) globalThis.fetch = (() => { throw new Error("dry run: no network"); }) as typeof fetch;
  const out = resolve(arg("--out") ?? join(HEAD_ROOT, ".reader-eval"));
  mkdirSync(out, { recursive: true });
  const file = arg("--prompts");
  if (!file) throw new Error("--prompts <corpus file or JSON array> is required");
  const j = JSON.parse(readFileSync(resolve(file), "utf8"));
  const known = new Map(loadCorpus().map((e) => [e.prompt, e]));
  let entries: Entry[] = (Array.isArray(j) ? j : j.prompts).map((x: string | { prompt: string }) => norm(typeof x === "string" ? x : x.prompt))
    .map((q: string) => known.get(q) ?? { prompt: q, sources: ["reader-eval"], ids: [], demands: typedDemands(q), demandsFrom: "typed-rules" });
  const E = await loadEngine(HEAD_ROOT);
  const R = await import(join(HEAD_ROOT, "src/lib/yard/aiReader/core.ts"));
  const W = await import(join(HEAD_ROOT, "src/lib/yard/aiReader/rewrite.ts"));
  if (flag("--only-reader")) entries = entries.filter((e) => R.needsReader(e.prompt));
  if (arg("--max")) entries = entries.slice(0, Number(arg("--max")));

  const rf = resolve(arg("--replies") ?? join(out, "replies.json"));
  const replies: Replies = existsSync(rf) ? JSON.parse(readFileSync(rf, "utf8")) : {};
  const sides: Record<string, Side> = {};
  let projected = 0;
  for (const e of entries) {
    const q = e.prompt;
    if (!R.needsReader(q)) { sides[q] = { buildFrom: q, used: false, reason: "the parser reads these words: no call", replied: "skipped", usd: 0 }; continue; }
    projected += R.worstCaseUsd(q);
    let content: string | undefined = replies[q];
    let replied: Side["replied"] = content ? "saved" : "none";
    let usd = 0;
    if (!content && live) {
      const worst = R.worstCaseUsd(q);
      if (!spend.reserve(worst)) { sides[q] = { buildFrom: q, used: false, reason: `spend cap $${spend.cap} reached: not called`, replied: "none", usd: 0 }; continue; }
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 15_000);
        const res = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` }, body: JSON.stringify(R.readerRequest(q)), signal: ctl.signal });
        clearTimeout(timer);
        const body = await res.json().catch(() => null);
        const billed = body?.usage ? R.costUsd(body.usage) : worst;
        usd = Number.isFinite(billed) ? Math.min(Math.max(billed, 0), worst) : worst;
        spend.settle(worst, usd);
        content = res.ok ? body?.choices?.[0]?.message?.content : undefined;
        replied = content ? "live" : "error";
        if (content) { replies[q] = content; writeFileSync(rf, JSON.stringify(replies, null, 1)); }
      } catch { spend.settle(worst, worst); replied = "error"; usd = worst; } // an aborted call may still bill: count the worst case
    }
    const spec = content ? R.parseReply(q, { choices: [{ message: { content } }] }) : null;
    const choice = W.chooseBuildPrompt(q, spec, (x: string) => E.generateFromPrompt(x));
    sides[q] = { buildFrom: choice.buildPrompt, used: choice.used, reason: choice.reason, replied, usd };
  }
  const without = entries.map((e) => gradeBuild(E, e, e.prompt));
  const withR = entries.map((e) => gradeBuild(E, e, sides[e.prompt].buildFrom));
  const d = diffRows(without, withR, sides);
  const mode = live ? "live" : "dry run";
  const meta = { mode, prompts: entries.length, asked: entries.filter((e) => R.needsReader(e.prompt)).length, spent: spend.billed, projected };
  writeFileSync(join(out, "without.json"), JSON.stringify(without, null, 1));
  writeFileSync(join(out, "with.json"), JSON.stringify(withR, null, 1));
  writeFileSync(join(out, "builds.jsonl"), entries.map((e) => JSON.stringify({ prompt: e.prompt, ...sides[e.prompt] })).join("\n") + "\n");
  writeFileSync(join(out, "diff.md"), diffMarkdown(d, meta));
  writeFileSync(join(out, "summary.json"), JSON.stringify({ ...meta, without: d.without, with: d.with, better: d.better, worse: d.worse, movedSameGrade: d.movedSameGrade, replies: { saved: Object.values(sides).filter((s) => s.replied === "saved").length, live: Object.values(sides).filter((s) => s.replied === "live").length, none: Object.values(sides).filter((s) => s.replied === "none").length, error: Object.values(sides).filter((s) => s.replied === "error").length } }, null, 1));
  console.log(`reader eval (${mode}): ${entries.length} prompts, ${meta.asked} for the reader · without ${d.without.pass}/${d.without.partial}/${d.without.fail} · with ${d.with.pass}/${d.with.partial}/${d.with.fail} · better ${d.better}, worse ${d.worse} · spent $${spend.billed.toFixed(4)}${live ? "" : `, a live run would reserve ≤ $${projected.toFixed(4)}`} → ${out}`);
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) await main();
