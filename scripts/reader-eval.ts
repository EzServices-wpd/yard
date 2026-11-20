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
 *   options: --max <n> (first n prompts), --only-reader (only prompts the reader would be asked about),
 *   --learner (stand-ins also go to the recipe learner, same reserve-then-settle cap; dry run makes no call)
 *
 * Writes into --out: without.json, with.json (graded rows), builds.jsonl (both builds per prompt), replies.json
 * (raw reader replies, replayable), diff.md (what the reader changed, worst first) and summary.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HEAD_ROOT, gradeBuild, gradeBuilt, loadCorpus, loadEngine, norm, type Entry, type PromptResult } from "./eval-gate-lib.ts";
import { typedDemands } from "./eval-gate-typed.ts";

export const MAX_CAP_USD = 5;

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (k: string) => argv.includes(k);

type Replies = Record<string, string>; // normalized prompt → the reader's raw message content
export type Side = { buildFrom: string; used: boolean; reason: string; replied: "saved" | "live" | "none" | "skipped" | "error"; usd: number };
export type CallQuote = { prompt: string; kind: "reader" | "learner"; seq: number; worst: number };

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

export type RunResult = {
  mode: string; prompts: number; asked: number; spent: number; projected: number; out: string;
  learnerAsked: number; learnerProjected: number; learnerRefused: number; learnerLive: number;
  calls: CallQuote[];
  without: { pass: number; partial: number; fail: number };
  with: { pass: number; partial: number; fail: number };
  learner: { pass: number; partial: number; fail: number };
  better: number; worse: number; movedSameGrade: number;
  learnerBetter: number; learnerWorse: number; learnerMoved: number;
  worsePrompts: string[]; learnerWorsePrompts: string[];
  changed: number; learnerChanged: number;
};

export async function runEval(opts: { promptsFile: string; outDir: string; live: boolean; learner: boolean; repliesFile?: string; learnerRepliesFile?: string; max?: number; onlyReader?: boolean; spend: Spend }): Promise<RunResult> {
  const live = opts.live;
  const spend = opts.spend;
  // A dry run cannot reach the network at all: any fetch throws, as in the gate (offline()).
  if (!live) globalThis.fetch = (() => { throw new Error("dry run: no network"); }) as typeof fetch;
  const out = resolve(opts.outDir);
  mkdirSync(out, { recursive: true });
  const file = opts.promptsFile;
  const j = JSON.parse(readFileSync(resolve(file), "utf8"));
  const known = new Map(loadCorpus().map((e) => [e.prompt, e]));
  let entries: Entry[] = (Array.isArray(j) ? j : j.prompts).map((x: string | { prompt: string }) => norm(typeof x === "string" ? x : x.prompt))
    .map((q: string) => known.get(q) ?? { prompt: q, sources: ["reader-eval"], ids: [], demands: typedDemands(q), demandsFrom: "typed-rules" });
  const E = await loadEngine(HEAD_ROOT);
  const R = await import(join(HEAD_ROOT, "src/lib/yard/aiReader/core.ts"));
  const W = await import(join(HEAD_ROOT, "src/lib/yard/aiReader/rewrite.ts"));
  if (opts.onlyReader) entries = entries.filter((e) => R.needsReader(e.prompt));
  if (opts.max) entries = entries.slice(0, opts.max);

  const rf = resolve(opts.repliesFile ?? join(out, "replies.json"));
  const replies: Replies = existsSync(rf) ? JSON.parse(readFileSync(rf, "utf8")) : {};
  const sides: Record<string, Side> = {};
  const calls: CallQuote[] = [];
  let projected = 0;
  let learnerAsked = 0, learnerProjected = 0, learnerRefused = 0, learnerLive = 0;
  const learnerProjects: Record<string, unknown> = {};
  const learn = opts.learner ? await import("../src/lib/yard/recipeBuild.ts") : null;
  const own = opts.learner ? await import("../src/lib/yard/formOwnership.ts") : null;
  const pocket = opts.learner ? await import("../src/lib/yard/pocket.ts") : null;
  const grok = opts.learner ? await import("../src/lib/ai/grok.ts") : null;
  const lrf = resolve(opts.learnerRepliesFile ?? join(out, "learner-replies.json"));
  const learnerReplies: Record<string, unknown> = opts.learner && existsSync(lrf) ? JSON.parse(readFileSync(lrf, "utf8")) : {};
  for (const e of entries) {
    const q = e.prompt;
    if (!R.needsReader(q)) { sides[q] = { buildFrom: q, used: false, reason: "the parser reads these words: no call", replied: "skipped", usd: 0 }; }
    else {
    const worstReader = R.worstCaseUsd(q);
    calls.push({ prompt: q, kind: "reader", seq: 1, worst: worstReader });
    projected += worstReader;
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
    if (learn && own && pocket && grok && !pocket.looksLikePocket(sides[q].buildFrom)) {
      const project = E.generateFromPrompt(sides[q].buildFrom);
      const half = E.ignoredTypedWords(project, sides[q].buildFrom).length > 0;
      if (own.routesToLearner(sides[q].buildFrom, project, half)) {
        learnerAsked++;
        const w1 = grok.recipeWorstCaseUsd(q);
        const w2 = grok.recipeWorstCaseUsd(q, ["x".repeat(2000)]);
        calls.push({ prompt: q, kind: "learner", seq: 1, worst: w1 }, { prompt: q, kind: "learner", seq: 2, worst: w2 });
        learnerProjected += w1 + w2;
        const saved = learnerReplies[q];
        if (!live && !saved) continue;
        const lookup = async (prompt: string, feedback?: string[]) => {
          if (!live) return saved;
          const worst = grok.recipeWorstCaseUsd(prompt, feedback);
          if (!spend.reserve(worst)) { learnerRefused++; throw new Error(learn.UNAVAILABLE); }
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 150_000);
          let settled = false;
          try {
            const res = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` }, body: JSON.stringify(grok.recipeRequest(prompt, feedback)), signal: ctl.signal });
            const body = await res.json().catch(() => null);
            const billed = body?.usage ? grok.recipeBilledUsd(body.usage) : worst;
            const usd = Number.isFinite(billed) ? Math.min(Math.max(billed, 0), worst) : worst;
            spend.settle(worst, usd);
            settled = true;
            const text = body?.choices?.[0]?.message?.content;
            if (!res.ok || typeof text !== "string") throw new Error(learn.UNAVAILABLE);
            const { parseModelJson } = await import("../src/lib/yard/parseJson.ts");
            const recipe = parseModelJson(text);
            learnerLive++;
            return recipe;
          } catch (err) {
            if (!settled) spend.settle(worst, worst);
            throw new Error(learn.UNAVAILABLE);
          } finally { clearTimeout(timer); }
        };
        const out = await learn.lookupAndBuild(q, lookup, () => learn.roughBlock(q, project));
        if (!out.unavailable) {
          learnerProjects[q] = out.project;
          if (out.recipe) { learnerReplies[q] = out.recipe; writeFileSync(lrf, JSON.stringify(learnerReplies)); }
        }
      }
    }
  }
  const without = entries.map((e) => gradeBuild(E, e, e.prompt));
  const withR = entries.map((e) => gradeBuild(E, e, sides[e.prompt].buildFrom));
  const learnerRows = entries.map((e, i) => {
    const p = learnerProjects[e.prompt];
    if (!p) return withR[i];
    try { return gradeBuilt(E, e, p, E.buildPlan(p), e.prompt); } catch { return withR[i]; }
  });
  const d = diffRows(without, withR, sides);
  const dL = diffRows(without, learnerRows, sides);
  const mode = live ? "live" : "dry run";
  const meta = { mode, prompts: entries.length, asked: entries.filter((e) => R.needsReader(e.prompt)).length, spent: spend.billed, projected };
  const worsePrompts = d.rows.filter((r) => r.delta < 0).map((r) => r.prompt);
  const learnerWorsePrompts = dL.rows.filter((r) => r.delta < 0).map((r) => r.prompt);
  const result: RunResult = {
    ...meta, out, learnerAsked, learnerProjected, learnerRefused, learnerLive, calls,
    without: d.without, with: d.with, learner: dL.with,
    better: d.better, worse: d.worse, movedSameGrade: d.movedSameGrade,
    learnerBetter: dL.better, learnerWorse: dL.worse, learnerMoved: dL.rows.filter((r) => r.moved).length,
    worsePrompts, learnerWorsePrompts,
    changed: d.rows.filter((r) => r.moved).length, learnerChanged: dL.rows.filter((r) => r.moved).length,
  };
  writeFileSync(join(out, "without.json"), JSON.stringify(without, null, 1));
  writeFileSync(join(out, "with.json"), JSON.stringify(withR, null, 1));
  writeFileSync(join(out, "learner.json"), JSON.stringify(learnerRows, null, 1));
  writeFileSync(join(out, "builds.jsonl"), entries.map((e) => JSON.stringify({ prompt: e.prompt, ...sides[e.prompt] })).join("\n") + "\n");
  writeFileSync(join(out, "diff.md"), diffMarkdown(d, meta));
  writeFileSync(join(out, "summary.json"), JSON.stringify({ ...result, replies: { saved: Object.values(sides).filter((s) => s.replied === "saved").length, live: Object.values(sides).filter((s) => s.replied === "live").length, none: Object.values(sides).filter((s) => s.replied === "none").length, error: Object.values(sides).filter((s) => s.replied === "error").length } }, null, 1));
  console.log(`reader eval (${mode}): ${entries.length} prompts, ${meta.asked} for the reader${opts.learner ? `, ${learnerAsked} for the learner` : ""} · without ${d.without.pass}/${d.without.partial}/${d.without.fail} · with ${d.with.pass}/${d.with.partial}/${d.with.fail} · better ${d.better}, worse ${d.worse} · spent $${spend.billed.toFixed(4)}${live ? "" : `, a live run would reserve ≤ $${(projected + learnerProjected).toFixed(4)}`} → ${out}`);
  return result;
}

async function main() {
  const live = flag("--live");
  const cap = arg("--cap-usd");
  if (live && !cap) throw new Error("--live needs --cap-usd (at most $" + MAX_CAP_USD + ")");
  if (live && !process.env.XAI_API_KEY) throw new Error("--live needs XAI_API_KEY in the environment");
  const file = arg("--prompts");
  if (!file) throw new Error("--prompts <corpus file or JSON array> is required");
  const spend = new Spend(live ? Number(cap) : MAX_CAP_USD);
  await runEval({
    promptsFile: file,
    outDir: arg("--out") ?? join(HEAD_ROOT, ".reader-eval"),
    live,
    learner: flag("--learner"),
    repliesFile: arg("--replies"),
    learnerRepliesFile: arg("--learner-replies"),
    max: arg("--max") ? Number(arg("--max")) : undefined,
    onlyReader: flag("--only-reader"),
    spend,
  });
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) await main();
