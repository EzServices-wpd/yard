/**
 * Error-row replay and recorded-behaviour rows for the grade kit (Critic's error list, rows past 311).
 *
 * Reads `yard-errors-ranked.md` (one `| N | text | … | P1 | …` line per row) and `ERROR-CLASS-TRIAGE.md` (the unmarked
 * rows), takes each row's quoted prompts, and turns kit build records (`{ full, d }`, as dumped by the kit) into:
 *  - `replayTsv`: one line per (row, prompt) with row id, prompt, reproduces, head sha, base sha, run date and a short
 *    hash of the build output; 'n/a' for an unmarked row with no replayable prompt. Critic updates open/fixed from builds;
 *    "symptom text not found" never means fixed (the symptom may live in steps, sizes or the live path).
 *  - `recordExpect` / `expectMoves`: the current behaviour of a prompt (refused, title, pieces, $, notes) recorded once,
 *    so any later change shows as a move. Moves are WARN until Critic approves the expectation.
 * Pure functions plus a small CLI; it builds nothing (the kit builds, offline, with the base tree's harness).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type Row = { row: number; text: string; p: string | null; block: boolean; prompts: string[]; evidence: string[] };
export type Rec = { full?: string; err?: string; d?: { title?: string; refused?: string | null; notes?: string[]; totals?: { pieces?: number; estCostUsd?: number }; bom?: unknown[][] } };
export type Expect = { refused: boolean; title: string; pieces: number | null; cost: number | null; notes: string };

// A quote is a prompt when it reads like something typed into Yard: starts lower-case or with a number, 2-12 words,
// no header, note or code punctuation, not a claim quoted from a PR ("is", "never", "only" …), not a fragment that only
// makes sense after another prompt ("with 12 rods", "48 wide"): a number-first quote must name a thing, not just sizes.
const FRAGMENT = /^(with|for|and|or|at|in|on|to|from|of|a|an|the|by|but|not|no|then|than|between|make it|type)\b/;
const CLAIM = /\b(is|are|never|exactly|only|whatever|unchanged|keeps|says|stays|assumed|builds? move)\b/;
const SIZEWORD = /^(wide|tall|deep|long|high|thick|inch|inches|feet|foot|shelf|shelves|drawers?|doors?|rods?|seats?|every|another|other|pair|plywood|ply|between)$/;
export const isPrompt = (q: string): boolean => {
  const w = q.trim().split(/\s+/);
  if (!/^[a-z0-9]/.test(q) || !/[a-z]{3}/.test(q) || w.length < 2 || w.length > 12) return false;
  if (/[·…→=;{}()[\]<>|]|->|\.$|: |\d" [A-Z]/.test(q) || FRAGMENT.test(q) || CLAIM.test(q)) return false; // 15/32" BC …: a stock name
  return !/^\d/.test(q) || w.some((x) => /^[a-z]{4,}$/i.test(x) && !SIZEWORD.test(x.toLowerCase()));
};

// Single-quoted spans, plus double-quoted spans that start lower-case and don't follow a number (so 12" isn't a quote).
// A quote the row says a note says, mentions, reads or leaks, a sheet is headed or Buy buys (or one inside a longer
// quoted note) is symptom text, never a prompt: rows 247, 538, 653 replayed note text as prompts.
const SQ = /(?<![A-Za-z0-9])'([^'\n]{2,160}?)'(?![A-Za-z])/g, DQ = /(?<![\d/½¼¾⅛A-Za-z])"([a-z][^"\n]{4,120})"/g;
const FROM = /\b(notes?|mentions|says|reads|leaks?( into)?|headed|buys)\s*$/i;
export const quotes = (t: string): { q: string; from: boolean }[] => [...t.matchAll(SQ), ...t.matchAll(DQ)].sort((a, b) => a.index! - b.index!)
  .map((m) => ({ q: m[1].trim(), from: FROM.test(t.slice(Math.max(0, m.index! - 40), m.index)) }));

export const parseRows = (md: string): Row[] => {
  const seen = new Set<number>(), out: Row[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^\| (\d+) \| (.*)$/); if (!m || seen.has(+m[1])) continue; seen.add(+m[1]);
    const cells = m[2].split(" | "), text = m[2], qs = quotes(text); // some rows carry an area column first, so quote the whole line
    const p = cells[1]?.trim().match(/^(P\d)\b/)?.[1] ?? null, ev = qs.filter((x) => x.from || !isPrompt(x.q)).map((x) => x.q);
    const typed = (q: string) => !ev.includes(q) && !ev.some((e) => e.replace(/\.$/, "") !== q && e.includes(q)); // a quote inside a quoted note is note text
    out.push({ row: +m[1], text, p, block: /\bBLOCK\b/.test(text), prompts: [...new Set(qs.map((x) => x.q).filter(typed))], evidence: [...new Set(ev)] });
  }
  return out;
};

/** The unmarked rows: every row number listed under a `**X class** (n): …` line of the triage. */
export const unmarkedRows = (triage: string): Set<number> =>
  new Set([...triage.matchAll(/^\*\*[A-Z] [^*]+\*\* \(\d+\): (.*)$/gm)].flatMap((m) => m[1].match(/\d+/g)!.map(Number)));

const text = (r: Rec): string => r.err ? `error: ${r.err}` : [r.d?.title, r.d?.refused, ...(r.d?.notes ?? []), ...(r.d?.bom ?? []).map((b) => `${b[0]} ${b[2]}`)].filter(Boolean).join("\n");
const sha8 = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 8);

/** yes: a quoted symptom (header, note, Buy text) still shows in the build; "symptom text not found": the row quotes
 *  symptoms and none shows in title, notes or Buy (NOT fixed: steps, sizes and the live path aren't read);
 *  unknown: the row quotes no symptom, so only Critic can tell. A quote ending in "…" matches on its start. */
export const NOT_FOUND = "symptom text not found";
export const reproduces = (row: Row, r: Rec): "yes" | typeof NOT_FOUND | "unknown" => {
  const ev = row.evidence.map((e) => e.replace(/…$/, "").trim()).filter((e) => e.length >= 4);
  if (!ev.length) return "unknown";
  const t = text(r); return ev.some((e) => t.includes(e)) ? "yes" : NOT_FOUND;
};

export const COLS = ["row", "P", "prompt", "reproduces", "head_sha", "base_sha", "run_date", "head_hash", "same_as_base", "built"];
const clean = (s: string) => s.replace(/[\t\n]/g, " ");
const built = (r?: Rec) => !r ? "missing" : r.err ? "error" : r.d?.refused ? "refused" : "built";

export const replayTsv = (rows: Row[], unmarked: Set<number>, head: Record<string, Rec>, base: Record<string, Rec>, headSha: string, baseSha: string, date: string): string => {
  const out = [COLS.join("\t")];
  for (const row of rows.filter((x) => unmarked.has(x.row))) {
    const meta = [headSha.slice(0, 12), baseSha.slice(0, 12), date];
    if (!row.prompts.length) { out.push([row.row, row.p ?? "", "n/a", "n/a", ...meta, "n/a", "n/a", "n/a"].join("\t")); continue; }
    for (const q of row.prompts) {
      const h = head[q], b = base[q], hh = h ? (h.full ?? sha8(text(h))) : "missing";
      out.push([row.row, row.p ?? "", clean(q), h ? reproduces(row, h) : "n/a", ...meta, hh, h && b ? (hh === (b.full ?? sha8(text(b))) ? "yes" : "no") : "n/a", built(h)].join("\t"));
    }
  }
  return out.join("\n") + "\n";
};

/** The current behaviour of one build, recorded as the expectation (refused, header, pieces, $, notes hash). */
export const recordExpect = (r: Rec): Expect => ({
  refused: !!(r.err || r.d?.refused), title: r.err ? `error: ${r.err}` : (r.d?.refused ?? r.d?.title ?? ""),
  pieces: r.d?.totals?.pieces ?? null, cost: r.d?.totals?.estCostUsd ?? null, notes: sha8((r.d?.notes ?? []).join("\n")),
});

/** Which recorded facets moved, e.g. ["title", "cost"]; [] when the build still behaves as recorded. */
export const expectMoves = (want: Expect, r: Rec): string[] => {
  const got = recordExpect(r);
  return (Object.keys(want) as (keyof Expect)[]).filter((k) => want[k] !== got[k]);
};

// CLI (kit use; reads kit dump files `{ builds: { [prompt]: Rec } }`):
//   prompts <errors.md> <triage.md> [row,row…]   → [{ q }] for the unmarked rows (or the listed rows)
//   tsv <errors.md> <triage.md> <head.json> <base.json> <head sha> <base sha>   → the replay TSV
//   record <errors.md> <row,row…> <builds.json>   → [{ row, prompt, expect }]   ·   expect <recorded.json> <builds.json> → moves, one per line
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...a] = process.argv.slice(2), rd = (f: string) => readFileSync(f, "utf8");
  const builds = (f: string): Record<string, Rec> => JSON.parse(rd(f)).builds;
  if (cmd === "prompts" || cmd === "record") {
    const rows = parseRows(rd(a[0])), only = cmd === "record" ? a[1] : a[2];
    const keep = only ? new Set(only.split(",").map(Number)) : unmarkedRows(rd(a[1])), pick = rows.filter((r) => keep.has(r.row));
    if (cmd === "prompts") console.log(JSON.stringify([...new Set(pick.flatMap((r) => r.prompts))].map((q) => ({ q }))));
    else { const b = builds(a[2]); console.log(JSON.stringify(pick.flatMap((r) => r.prompts.filter((q) => b[q]).map((q) => ({ row: r.row, prompt: q, expect: recordExpect(b[q]) }))), null, 1)); }
  } else if (cmd === "tsv") process.stdout.write(replayTsv(parseRows(rd(a[0])), unmarkedRows(rd(a[1])), builds(a[2]), builds(a[3]), a[4], a[5], new Date().toISOString().slice(0, 10)));
  else if (cmd === "expect") {
    const b = builds(a[1]);
    for (const e of JSON.parse(rd(a[0])) as { row: number; prompt: string; expect: Expect }[]) {
      const m = b[e.prompt] ? expectMoves(e.expect, b[e.prompt]) : ["missing"]; if (m.length) console.log(`row ${e.row} '${e.prompt}': ${m.join(", ")}`);
    }
  } else { console.error("usage: probe-rows.ts prompts|tsv|record|expect …"); process.exit(2); }
}
