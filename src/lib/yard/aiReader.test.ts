/**
 * I49 AI prompt reader: the guards (no key / kill switch / cap hit / failure / timeout / cache hit → no call or the
 * parser path), the persistent $1/day counter (Upstash INCRBYFLOAT), the validator, the rewrite, and the seven
 * canaries byte-identical through the reader path. No network: fetch throws for the whole file, the model is a mock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { POCKET_DREAM } from "./pocket";
import { validateSpec } from "./aiReader/validate";
import { chooseBuildPrompt, specToPrompt } from "./aiReader/rewrite";
import { needsReader, reserveUsd, settleUsd, usdKey, readPrompt, readerEnv, worstCaseUsd, type ReaderDeps } from "./aiReader/core";
import type { ReaderSpec } from "./aiReader/spec";

globalThis.fetch = (async () => { throw new Error("network is off in this test"); }) as typeof fetch;
const S = (axis: string, inches: number, quote: string, of = "overall", unit = "none", confidence = 1) => ({ axis, value: inches, unit, inches, of, quote, confidence, assumed: false });
const spec = (sizes: unknown[] = [], counts: unknown[] = []) => ({ sizes, counts }) as ReaderSpec;
const reply = (s: unknown, usage = { prompt_tokens: 800, completion_tokens: 90 }) => ({ choices: [{ message: { content: JSON.stringify(s) } }], usage });
const noIds = (k: string, v: unknown) => (k === "id" || k === "partIds" ? undefined : v);
/** Everything a person sees: header, size, pieces, total, cut list, Buy and steps. */
const plan = (q: string) => { const p = generateFromPrompt(q); const pl = buildPlan(p); return JSON.stringify({ name: p.name, overall: p.overall, refused: p.refused ?? null, pieces: pl.totals.pieces, usd: pl.totals.estCostUsd, cut: pl.cutList, bom: pl.bom, steps: pl.instructions.map((s) => s.title + s.description) }, noIds); };

function mock(over: Partial<ReaderDeps> = {}, body: unknown = reply({ sizes: [S("W", 30, "30x18x72"), S("D", 18, "30x18x72"), S("H", 72, "30x18x72")], counts: [] })) {
  const calls: string[] = []; const logs: string[] = []; const cache = new Map<string, string>(); const spend = { reserved: 0, settled: [] as number[][] };
  const d: ReaderDeps = {
    env: { on: true, key: true, capUsd: 1 },
    cacheGet: async (k) => cache.get(k), cacheSet: async (k, v) => { cache.set(k, v); },
    reserve: async (usd) => { spend.reserved += usd; return true; }, settle: async (r, b) => { spend.settled.push([r, b]); },
    call: async () => { calls.push("call"); return { ok: true, status: 200, body }; },
    log: (l) => logs.push(l), ...over,
  };
  return { d, calls, logs, cache, spend };
}
const Q = "linen closet 30x18x72";

test("I49 off by default: no key, no flag, a kill-switch value or no store → parser only, no call, no spend", async () => {
  for (const [env, db] of [[{}, true], [{ YARD_AI_READER: "on" }, true], [{ XAI_API_KEY: "k" }, true], [{ XAI_API_KEY: "k", YARD_AI_READER: "off" }, true], [{ XAI_API_KEY: "k", YARD_AI_READER: "true" }, true], [{ XAI_API_KEY: "k", YARD_AI_READER: "on" }, false]] as const) {
    const m = mock({ env: readerEnv(env, db) });
    const r = await readPrompt(Q, false, m.d);
    assert.deepEqual([r.ok, m.calls.length, m.spend.reserved], [false, 0, 0], JSON.stringify(env));
    assert.equal(chooseBuildPrompt(Q, null).buildPrompt, Q);
  }
  assert.equal(readerEnv({ YARD_AI_READER_DAILY_USD: "5" }, true).capUsd, 1, "the env may lower the $1 cap, never raise it");
});

test("I49 cap hit, model failure, malformed reply and timeout all fall back with no reading; cache hit makes no call", async () => {
  const cap = mock({ reserve: async () => false });
  assert.deepEqual([(await readPrompt(Q, false, cap.d)).ok, cap.calls.length], [false, 0]);
  for (const call of [async () => ({ ok: false as const, error: "capped" }), async () => { throw new Error("boom"); }, async () => ({ ok: true as const, status: 500, body: null }), async () => ({ ok: true as const, status: 200, body: { choices: [{ message: { content: "{not json" } }] } })]) {
    const m = mock({ call });
    assert.equal((await readPrompt(Q, false, m.d)).ok, false);
    assert.equal(m.cache.size, 0, "a failed reading is never cached");
  }
  const slow = mock({ call: (_b, signal) => new Promise((_, no) => signal.addEventListener("abort", () => no(new Error("abort")))) });
  assert.equal((await readPrompt(Q, false, slow.d, 20)).ok, false);
  const m = mock();
  const first = await readPrompt(Q, true, m.d);
  const again = await readPrompt("Linen  closet 30X18X72", false, m.d);
  assert.deepEqual([first.ok, again.ok && again.cached, m.calls.length], [true, true, 1]);
  assert.ok(m.spend.settled[0][1] > 0 && m.spend.settled[0][1] < m.spend.settled[0][0], "settled at the billed price, under the reserve");
  assert.ok(m.logs.some((l) => l.includes("test=1")) && m.logs.every((l) => !/linen|30x18/i.test(l)), "test calls are tagged; logs never carry the prompt");
  const plain = mock();
  assert.equal((await readPrompt("linen closet 31.5 wide 78 tall 16 deep", false, plain.d)).ok, false);
  assert.equal(plain.calls.length, 0, "words the parser reads never call");
});

test("I49 the persistent counter (Upstash INCRBYFLOAT) refuses the call that would pass $1, counts test calls, settles, and fails closed", async () => {
  const kv = new Map<string, number>(); const sent: string[] = [];
  const pipe = async (cmds: (string | number)[][]) => cmds.map(([c, k, v]) => { sent.push(`${c} ${k}`); if (c === "EXPIRE") return 1; kv.set(String(k), (kv.get(String(k)) ?? 0) + (c === "INCR" ? 1 : Number(v))); return String(kv.get(String(k))); });
  const day = "2026-10-24";
  assert.equal(await reserveUsd(pipe, day, 2, 1, false), false, "one call over the cap never reserves");
  assert.equal(await reserveUsd(pipe, day, 0.6, 1, true), true);
  assert.equal(await reserveUsd(pipe, day, 0.6, 1, false), false, "over the cap: taken back and refused");
  assert.equal(kv.get(usdKey(day)), 0.6);
  await settleUsd(pipe, day, 0.6, 0.003);
  assert.equal(await reserveUsd(pipe, day, 0.9, 1, false), true);
  assert.deepEqual([+kv.get(usdKey(day))!.toFixed(6), kv.get(`yard:reader:test:${day}`)], [0.903, 1]);
  assert.ok(sent.includes(`EXPIRE ${usdKey(day)}`));
  assert.equal(await reserveUsd(async () => null, day, 0.01, 1, false), false, "store down → no reservation → parser");
  assert.equal(await reserveUsd(async () => { throw new Error("down"); }, day, 0.01, 1, false).catch(() => false), false);
  assert.ok(worstCaseUsd("bookcase 6 ft") > 0.0021, "the reserve is above a real uncached call");
});

test("I49 validator: unquoted, invented, assumed and age entries are dropped; fractions, feet and metric are kept", () => {
  const q = "bookcase 90cm wide 6 ft tall 11 1/2 deep for a 5 year old";
  const { spec: s, dropped } = validateSpec(q, { sizes: [S("W", 35.43307, "90cm wide", "overall", "cm"), S("H", 72, "6 ft tall", "overall", "ft"), S("D", 11.5, "11 1/2 deep"), S("W", 30, "30 wide"), S("H", 5, "5 year old"), { ...S("D", 12, "deep"), assumed: true }, S("D", 14, "11 1/2 deep"), S("H", 11.5, "11 1/2 deep")], counts: [{ thing: "shelves", n: 4, quote: "bookcase", confidence: 1, assumed: false }] });
  assert.deepEqual(s.sizes.map((x) => [x.axis, +x.inches.toFixed(3)]), [["W", 35.433], ["H", 72], ["D", 11.5]]);
  assert.deepEqual([s.counts.length, dropped.length], [0, 6]);
});

test("I49 rewrite: only misreadable measurements change, in fractions; a size the reader read is built or the typed words build", () => {
  assert.equal(specToPrompt(Q, spec([S("W", 30, "30x18x72"), S("D", 18, "30x18x72"), S("H", 72, "30x18x72")])).prompt, "linen closet 30 wide 18 deep 72 tall");
  assert.equal(specToPrompt("bookcase 90cm wide", spec([S("W", 90 / 2.54, "90cm wide", "overall", "cm")])).prompt, "bookcase 35 7/16 wide");
  const plain = "bookcase 30 wide 12 deep 72 tall";
  assert.equal(specToPrompt(plain, spec([S("W", 30, "30 wide"), S("D", 12, "12 deep"), S("H", 72, "72 tall")])).prompt, plain);
  for (const [q, s] of [["shelf 6 foot", spec([S("W", 72, "6 foot", "overall", "ft", 0.5)])], ["desk with 24 inch knee space", spec([S("W", 24, "24 inch knee space", "part", "in")])], ["desk 60 inches wide 24 inch knee", spec([S("W", 60, "60 inches wide", "overall", "in"), S("W", 24, "24 inch knee", "overall", "in")])]] as const) assert.equal(specToPrompt(q, s).edits.length, 0, q);
  assert.equal(specToPrompt("two-step kitchen stool", spec([], [{ thing: "steps", n: 2, quote: "two-step", confidence: 1, assumed: false }])).prompt, "2 steps kitchen stool");
  const c = chooseBuildPrompt("bookcase 90cm wide", spec([S("W", 90 / 2.54, "90cm wide", "overall", "cm")]));
  assert.equal(generateFromPrompt(c.buildPrompt).overall.width, 35.4375, c.reason);
  const fake = (q: string) => ({ ...generateFromPrompt("bookcase"), kind: q.includes("wide") ? "table" : "closet" }) as ReturnType<typeof generateFromPrompt>;
  assert.match(chooseBuildPrompt("bookcase 90cm", spec([S("W", 90 / 2.54, "90cm", "overall", "cm")]), fake).reason, /changes the object/);
  const narrow = () => ({ ...generateFromPrompt("bookcase"), overall: { width: 20, height: 72, depth: 12 } }) as ReturnType<typeof generateFromPrompt>;
  assert.match(chooseBuildPrompt("bookcase 90cm", spec([S("W", 90 / 2.54, "90cm", "overall", "cm")]), narrow).reason, /every size/);
});

const CANARIES: [string, ReaderSpec, ReaderSpec][] = [
  ["linen closet 31.5 wide 78 tall 16 deep", spec([S("W", 31.5, "31.5 wide"), S("H", 78, "78 tall"), S("D", 16, "16 deep")]), spec([S("W", 31.5, "31.5 wide", "overall", "none", 0.99), S("H", 31.5, "31.5 wide")])],
  [POCKET_DREAM, spec(), spec()],
  ["Andersen 100 Series 36 by 48 double hung window, frame the rough opening", spec([S("W", 36, "36 by 48", "product"), S("H", 48, "36 by 48", "product")]), spec([S("W", 36, "36 by 48"), S("H", 48, "36 by 48")])],
  ["desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", spec([S("W", 60, "60 inches wide", "overall", "in"), S("D", 30, "30 deep"), S("H", 29, "29 high"), S("W", 24, "24 inch knee space", "part", "in")]), spec([S("W", 60, "60 inches wide", "overall", "in"), S("W", 24, "24 inch knee space", "overall", "in")])],
  ["3 foot Eiffel Tower from popsicle sticks", spec([{ ...S("H", 36, "3 foot", "overall", "ft"), value: 3 }]), spec([S("H", 36, "3 foot", "overall", "in")])],
  ["cat tree", spec(), spec()],
  ["step stool", spec(), spec()],
];
for (const [q, right, wrong] of CANARIES) {
  test(`I49 canary byte-identical through the reader, read right or wrong: ${q.slice(0, 40)}`, () => {
    const want = plan(q);
    for (const s of [right, wrong]) {
      const c = chooseBuildPrompt(q, validateSpec(q, s).spec);
      assert.equal(plan(c.buildPrompt), want, `${c.reason} ${JSON.stringify(c.edits)}`);
    }
  });
}

test("I49 the gate: the linen canary, cat tree, step stool and the pocket brief never reach the model", () => {
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "cat tree", "step stool", POCKET_DREAM]) assert.equal(needsReader(q), false, q.slice(0, 40));
  for (const q of ["shoe rack by the door 36 inches", Q, "bookcase 90cm wide", "two-step kitchen stool", "deck box 4 ft"]) assert.equal(needsReader(q), true, q);
});
