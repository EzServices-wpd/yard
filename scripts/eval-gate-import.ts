#!/usr/bin/env -S npx tsx
/**
 * Rebuilds evals/corpus/{grok100,review18,live-walk,nightly-sweep}.json from the box's raw sources (run on the
 * Yard box only; CI reads the committed JSON). No network, no xAI: Grok specs are the ones already paid for in the
 * 2026-10-19 intake A/B and are re-validated (verbatim quotes) every time the gate loads them.
 *
 *   npx tsx scripts/eval-gate-import.ts [--ab /workspace/grok-intake-ab] [--walk /workspace/live-walk-1021] [--ranked /workspace/yard-errors-ranked.md] [--nightly /workspace/nightly-2026-10-16,/workspace/nightly-2026-10-17]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stable } from "./eval-gate-lib.ts";

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const AB = arg("--ab", "/workspace/grok-intake-ab");
const WALK = arg("--walk", "/workspace/live-walk-1021");
const RANKED = arg("--ranked", "/workspace/yard-errors-ranked.md");
const NIGHTLY = arg("--nightly", "/workspace/nightly-2026-10-16,/workspace/nightly-2026-10-17").split(",");
const OUT = new URL("../evals/corpus/", import.meta.url).pathname;
const SWEEPS = new URL("../evals/sweeps/", import.meta.url).pathname;
/** Test traffic never enters the corpus: Critic probes, QA strings, smoke tests. */
export const isTestTraffic = (q: string) => /critic[\s_-]*probe|\bprobe\b|\btest(?:ing)?\b|\bqa\b|lorem|asdf|qwer|^x+$/i.test(q);
const clean = (s: string) => s.replace(/\\\|/g, "|").replace(/`/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim());

// grok100 + review18
const ps: { id: string; prompt: string }[] = JSON.parse(readFileSync(join(AB, "prompts118.json"), "utf8"));
const specs = JSON.parse(readFileSync(join(AB, "run/specs.json"), "utf8"));
const specOf = (id: string) => {
  const j = specs[id]?.err ? null : specs[id]?.json;
  if (!j) return undefined;
  const { head_noun, sizes, counts, features, budget, material, finish } = j;
  return { head_noun, sizes, counts, features, budget, material, finish };
};
const ab = (pred: (id: string) => boolean) => ps.filter((p) => pred(p.id)).map((p) => ({ id: p.id, prompt: p.prompt, demandsFrom: "grok-spec-2026-10-19", spec: specOf(p.id) }));
writeFileSync(join(OUT, "grok100.json"), stable({ source: "grok100", note: "Grok's 100 (verify-grok100-2026-10-17b), from grok-intake-ab/prompts118.json. spec = the validated Grok intake demand checklist from that paid run (no new calls); quotes are re-validated against the prompt on load.", prompts: ab((id) => /^g\d+$/.test(id)) }));
writeFileSync(join(OUT, "review18.json"), stable({ source: "review18", note: "The 18 yard-review persona prompts (P1.1–P6.3), from grok-intake-ab/prompts118.json, with the same frozen specs.", prompts: ab((id) => /^P\d/.test(id)) }));

// live-walk: the 30-row prompt table in RESULTS.md, quoted prompts from ranked rows 76–84, and Critic's regrade follow-ups.
const walk: { id: string; prompt: string; walkGrade?: string; note?: string }[] = [];
const res = readFileSync(join(WALK, "RESULTS.md"), "utf8").split("\n");
let inTable = false;
for (const line of res) {
  if (/^## Prompt table/.test(line)) { inTable = true; continue; }
  if (inTable && /^## /.test(line)) break;
  if (!inTable || !/^\|\s*\d+\s*\|/.test(line)) continue;
  const c = cells(line);
  walk.push({ id: `lw${c[0].padStart(2, "0")}`, prompt: clean(c[1]), walkGrade: clean(c[c.length - 1]).replace(/\s*\(.*\)$/, "").toLowerCase() });
}
if (existsSync(RANKED)) {
  for (const line of readFileSync(RANKED, "utf8").split("\n")) {
    const m = line.match(/^\|\s*(7[6-9]|8[0-4])\s*\|(.*)$/);
    if (!m) continue;
    for (const q of m[2].matchAll(/[“"]([a-z][^”"]{6,80})[”"]/gi)) if (!/couldn't|→|=|\d\/\d+"$/.test(q[1]) && /^[a-z][a-z0-9 '-]+$/.test(q[1])) walk.push({ id: `rank${m[1]}`, prompt: clean(q[1]), note: `yard-errors-ranked.md row ${m[1]}` });
  }
}
// Critic's 10-19 regrade and backlog prompts (relayed by Chief): the typed-count and array classes.
for (const q of ["abacus 2 wide", "abacus 3 wide 3 rods", "abacus 10 wide 15 rods", "abacus 8 wide 12 rods", "water wheel 24 inches wide", "water wheel 30 inches wide", "peg rack", "dowel drying rack", "drying rack 6 wide", "coat peg rail", "towel bar set", "3 drawer dresser from 1/2 plywood", "shelf 24 1/2\" wide"])
  walk.push({ id: "critic-1019", prompt: q, note: "Critic regrade / backlog 2026-10-19" });
const seen = new Set<string>();
writeFileSync(join(OUT, "live-walk.json"), stable({ source: "live-walk", note: "Live walk 2026-10-21 release (prod 49aa20f): live-walk-1021/RESULTS.md prompt table (walkGrade = Critic's live grade), quoted prompts in yard-errors-ranked.md rows 76–84, and Critic's 10-19 regrade/backlog prompts.", prompts: walk.filter((w) => !seen.has(w.prompt.toLowerCase()) && seen.add(w.prompt.toLowerCase())) }));

// nightly-sweep: fresh real requests from the nightly live sweeps + the engine sweep tables in evals/sweeps (test traffic excluded).
const nightly: { id: string; prompt: string; walkGrade?: string; note?: string }[] = [];
for (const dir of NIGHTLY) {
  const f = join(dir, "RESULTS.md");
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\|\s*([nfr]\d{2})\s*\|/);
    if (!m) continue;
    const c = cells(line);
    nightly.push({ id: `${dir.split("-").slice(-2).join("-")}:${m[1]}`, prompt: clean(c[1]), walkGrade: clean(c[2]).toLowerCase().split(" ")[0] });
  }
}
for (const f of readdirSync(SWEEPS).filter((x) => x.endsWith(".md")).sort()) {
  let hdr: string[] | null = null;
  for (const line of readFileSync(join(SWEEPS, f), "utf8").split("\n")) {
    if (!line.startsWith("|")) { hdr = null; continue; }
    const c = cells(line);
    if (c.some((x) => x.toLowerCase() === "prompt")) { hdr = c.map((x) => x.toLowerCase()); continue; }
    if (!hdr || /^[-:| ]+$/.test(line) || c.length !== hdr.length) continue;
    nightly.push({ id: `sweep:${f.replace(/\.md$/, "")}`, prompt: clean(c[hdr.indexOf("prompt")]) });
  }
}
const f17 = join(SWEEPS, "f17-prompts.json");
if (existsSync(f17)) for (const q of JSON.parse(readFileSync(f17, "utf8"))) nightly.push({ id: "sweep:f17-prompts", prompt: clean(q) });
const seenN = new Set<string>();
const kept = nightly.filter((w) => w.prompt && !isTestTraffic(w.prompt) && !seenN.has(w.prompt.toLowerCase()) && seenN.add(w.prompt.toLowerCase()));
writeFileSync(join(OUT, "nightly-sweep.json"), stable({ source: "nightly-sweep", note: `Fresh requests from the nightly live sweeps (2026-10-16 n01–n20, 2026-10-17 f01–f20 + r rechecks; walkGrade = that night's strict grade) and every prompt in the evals/sweeps/*.md tables. Test traffic (critic probes, test/QA strings) excluded: ${nightly.length - kept.length} rows dropped as test traffic or duplicates. Live Ideas user rows are deliberately NOT copied into this public repo.`, prompts: kept }));
console.log(`grok100 ${ab((id) => /^g\d+$/.test(id)).length} · review18 ${ab((id) => /^P\d/.test(id)).length} · live-walk ${seen.size} · nightly-sweep ${kept.length}`);
