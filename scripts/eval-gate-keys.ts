/**
 * Answer-key score for the eval gate: real-world plans (evals/corpus/answer-keys.json, 85 keys from free public plans;
 * facts only, see answer-keys-SOURCES.md) scored with the logic of /workspace/yard-evals/answer-keys/score-answer-keys.ts:
 * footprint, height, cut-part count, key counts, stock family and hardware, each with the key's tolerance.
 *
 * Tolerances: scoring.per_type[build_type] (dims_in, part_count_rel) when the key file sets one, else by the key's
 * confidence (scoring.dims_tolerance_in / part_count_tolerance_rel). REPORT ONLY: never part of the merge rule.
 * Known limits (from the scorer): the leg counter is approximate (distinct leg/post names), and the footprint is
 * compared as a sorted pair, so it ignores which axis Yard calls width.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { HEAD_ROOT, offline, type Engine } from "./eval-gate-lib.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type KeyRow = { id: string; type: string; prompt: string; built: string; ok: number; total: number; fails: string[] };
export type KeyReport = {
  note: string; file: string; score: { ok: number; total: number; clean: number; keys: number };
  byType: Record<string, { ok: number; total: number; keys: number; clean: number }>;
  byCheck: Record<string, number>;
  patterns: { type: string; check: string; misses: number; of: number; examples: string[] }[];
  rows: KeyRow[];
};
export const keysFile = () => process.env.YARD_ANSWER_KEYS && existsSync(process.env.YARD_ANSWER_KEYS) ? process.env.YARD_ANSWER_KEYS : join(HEAD_ROOT, "evals/corpus/answer-keys.json");

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-6;
const famOf = (s: string) => {
  const t = s.toLowerCase();
  if (/ply|osb|mdf|panel/.test(t)) return "sheet";
  if (/picket/.test(t)) return "picket";
  if (/(^|[^0-9])2x|2×|4x4|4×4|3x3|lumber-2|lumber-4|stud/.test(t)) return "2x";
  if (/(^|[^0-9])1x|1×|board|lumber-1|hardwood|dowel/.test(t)) return "1x";
  return "other";
};

export async function scoreAnswerKeys(E: Engine, file = keysFile()): Promise<KeyReport | null> {
  if (!existsSync(file)) return null;
  const y = (f: string) => pathToFileURL(join(E.root, "src/lib/yard", f)).href;
  const [cs, cp] = await Promise.all([import(y("closedStorage.ts")).catch(() => ({})), import(y("casterParts.ts")).catch(() => ({}))]);
  const modelInteriorCounts: (p: any) => Record<string, number> = (cs as any).modelInteriorCounts ?? (() => ({}));
  const isCasterPart: (x: any) => boolean = (cp as any).isCasterPart ?? (() => false);
  const AK = JSON.parse(readFileSync(file, "utf8"));
  const S = AK.scoring;
  const rows: KeyRow[] = offline(() => AK.keys.map((k: any): KeyRow => {
    const fails: string[] = []; let ok = 0, total = 0;
    let p: any, plan: any;
    try { p = E.generateFromPrompt(k.prompt); plan = E.buildPlan(p); } catch (e) { return { id: k.id, type: k.build_type, prompt: k.prompt, built: "THREW", ok: 0, total: 1, fails: [`build: threw ${String(e).slice(0, 80)}`] }; }
    const per = S.per_type?.[k.build_type] ?? {};
    const tol: number = per.dims_in ?? S.dims_tolerance_in[k.confidence];
    const o = p.overall;
    const check = (name: string, pass: boolean, msg: string) => { total++; if (pass) ok++; else fails.push(`${name}: ${msg}`); };
    const kw = k.overall_in.w, kd = k.overall_in.d, kh = k.overall_in.h;
    if (kw != null && kd != null) {
      const want = [kw, kd].sort((a, b) => b - a), got = [o.width, o.depth].sort((a: number, b: number) => b - a);
      check("footprint", near(want[0], got[0], tol) && near(want[1], got[1], tol), `want ${want.join("×")} got ${got.join("×")} (±${tol})`);
    } else if (kw != null || kd != null) {
      const want = (kw ?? kd) as number;
      check("footprint", [o.width, o.depth].some((g: number) => near(want, g, tol)), `want one axis ${want} got ${o.width}×${o.depth}`);
    }
    if (kh != null) check("height", near(kh, o.height, tol), `want ${kh} got ${o.height} (±${tol})`);
    const cutN = plan.cutList.reduce((a: number, c: any) => a + (c.quantity ?? 1), 0);
    if (k.part_count != null) {
      const rel: number = per.part_count_rel ?? S.part_count_tolerance_rel[k.confidence];
      check("parts", Math.abs(cutN - k.part_count) <= rel * k.part_count, `want ${k.part_count} got ${cutN} (±${Math.round(rel * 100)}%)`);
    }
    const names: string[] = p.panels.filter((x: any) => !isCasterPart(x)).map((x: any) => String(x.name ?? ""));
    const inter = modelInteriorCounts(p);
    const distinct = (re: RegExp) => new Set(names.filter((n) => re.test(n)).map((n) => n.replace(/\s+[AB]$/, ""))).size;
    const got: Record<string, number> = {
      drawers: inter.drawer ?? 0, doors: inter.door ?? 0, shelves: inter.shelf ?? 0,
      legs: distinct(/\b(?:legs?|posts?)\b(?!\s*(?:brace|block|support|rail|stretcher|cap|trim))/i),
      casters: p.panels.filter((x: any) => isCasterPart(x)).length,
      ladder_rungs: names.filter((n) => /\brung/i.test(n)).length,
      stair_treads: names.filter((n) => /\bstair|tread/i.test(n)).length,
      steps: names.filter((n) => /\bstep|tread\b/i.test(n)).length,
      slats: names.filter((n) => /\bslat/i.test(n)).length,
      bunks: names.filter((n) => /\bdeck\b/i.test(n) && /(lower|upper|top|bottom|bed|sleep)/i.test(n)).length,
      lids: names.filter((n) => /\blid\b/i.test(n)).length,
      cubbies: names.filter((n) => /cubb/i.test(n)).length,
    };
    for (const [c, want] of Object.entries(k.counts as Record<string, number>)) {
      if (!(c in got)) continue;
      const g = got[c];
      const pass = S.counts_rule.exact.includes(c) ? g === want : S.counts_rule.plus_minus_1.includes(c) ? Math.abs(g - want) <= 1 : Math.abs(g - want) <= 0.3 * Math.max(1, want);
      check(c, pass, `want ${want} got ${g}`);
    }
    const fams = new Set((k.primary_stock as string[]).map(famOf));
    check("stock", fams.has(famOf(String(p.primaryMaterialId ?? ""))), `want ${[...fams].join("/")} got ${p.primaryMaterialId}`);
    const bom: string[] = plan.bom.map((b: any) => `${b.quantity}x ${String(b.name).toLowerCase()}`);
    for (const h of k.hardware) {
      if (/^(screw|nail|staple)/.test(h.kind)) continue;
      if (h.kind === "none-slides") { check("hw:none-slides", !bom.some((b) => /slide|glide/.test(b)), "Buy has drawer slides; plan uses wood guides"); continue; }
      const words: string[] = S.hardware_kinds[h.kind] ?? [h.kind];
      check(`hw:${h.kind}`, plan.bom.some((b: any) => words.some((w) => String(b.name).toLowerCase().includes(w))), `Buy has no ${h.kind}`);
    }
    return { id: k.id, type: k.build_type, prompt: k.prompt, built: `${p.name} ${Math.round(o.width * 16) / 16}×${Math.round(o.depth * 16) / 16}×${Math.round(o.height * 16) / 16}`, ok, total, fails };
  }));
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));
  const byType: KeyReport["byType"] = {};
  for (const r of rows) { const t = (byType[r.type] ??= { ok: 0, total: 0, keys: 0, clean: 0 }); t.ok += r.ok; t.total += r.total; t.keys++; if (!r.fails.length) t.clean++; }
  // Miss patterns: build type × check type, with how many keys of that type ran the check.
  const pat = new Map<string, { type: string; check: string; misses: number; of: number; examples: string[] }>();
  for (const r of rows) {
    const checks = new Set(r.fails.map((f) => f.slice(0, f.indexOf(": "))));
    for (const c of checks) {
      const k = `${r.type}|${c}`;
      const e = pat.get(k) ?? { type: r.type, check: c, misses: 0, of: rows.filter((x) => x.type === r.type).length, examples: [] };
      e.misses++;
      if (e.examples.length < 2) e.examples.push(`${r.prompt} → ${r.fails.find((f) => f.startsWith(c + ":"))!.slice(c.length + 2)}`);
      pat.set(k, e);
    }
  }
  const patterns = [...pat.values()].sort((a, b) => b.misses - a.misses || (a.type + a.check < b.type + b.check ? -1 : 1));
  const byCheck: KeyReport["byCheck"] = {};
  for (const r of rows) for (const f of r.fails) { const c = f.slice(0, f.indexOf(": ")); byCheck[c] = (byCheck[c] ?? 0) + 1; }
  const all = rows.reduce((a, r) => ({ ok: a.ok + r.ok, total: a.total + r.total }), { ok: 0, total: 0 });
  return {
    note: "REPORT ONLY (not in the merge rule). Logic of yard-evals/answer-keys/score-answer-keys.ts. Leg counter is approximate; footprint is a sorted pair (ignores which axis is called width).",
    file: file.startsWith(HEAD_ROOT) ? file.slice(HEAD_ROOT.length + 1) : file,
    score: { ...all, clean: rows.filter((r) => !r.fails.length).length, keys: rows.length }, byType: Object.fromEntries(Object.entries(byType).sort()),
    byCheck: Object.fromEntries(Object.entries(byCheck).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))), patterns, rows,
  };
}
