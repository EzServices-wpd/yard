/**
 * I49 AI prompt reader guards: no key / kill switch / cap hit / failure / timeout / cache hit / per-IP rate limit →
 * no call or the parser path, and the persistent $1/day counter (Upstash INCRBYFLOAT). The validator, rewrite and
 * canaries are in aiReaderRules.test.ts. No network: fetch throws for the whole file, the model is a mock.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { POCKET_DREAM } from "./pocket";
import { chooseBuildPrompt } from "./aiReader/rewrite";
import { needsReader, reserveUsd, settleUsd, usdKey, readPrompt, readerEnv, worstCaseUsd, type ReaderDeps } from "./aiReader/core";
import { underDailyCap } from "../ai/dailyCap.server";

globalThis.fetch = (async () => { throw new Error("network is off in this test"); }) as typeof fetch;
const S = (axis: string, inches: number, quote: string, of = "overall", unit = "none", confidence = 1) => ({ axis, value: inches, unit, inches, of, quote, confidence, assumed: false });
const reply = (s: unknown, usage = { prompt_tokens: 800, completion_tokens: 90 }) => ({ choices: [{ message: { content: JSON.stringify(s) } }], usage });

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

test("I49 the persistent counter (Upstash INCRBYFLOAT + EXPIRE, 2 commands) refuses the call that would pass $1, settles, and fails closed", async () => {
  const kv = new Map<string, number>(); const sent: string[] = [];
  const pipe = async (cmds: (string | number)[][]) => cmds.map(([c, k, v]) => { sent.push(`${c} ${k}`); if (c === "EXPIRE") return 1; kv.set(String(k), (kv.get(String(k)) ?? 0) + Number(v)); return String(kv.get(String(k))); });
  const day = "2026-10-24";
  assert.equal(await reserveUsd(pipe, day, 2, 1), false, "one call over the cap never reserves");
  assert.equal(sent.length, 0);
  assert.equal(await reserveUsd(pipe, day, 0.6, 1), true);
  assert.deepEqual(sent, [`INCRBYFLOAT ${usdKey(day)}`, `EXPIRE ${usdKey(day)}`]);
  await settleUsd(pipe, day, 0.6, 0.003);
  assert.equal(await reserveUsd(pipe, day, 0.9, 1), true);
  assert.equal(+kv.get(usdKey(day))!.toFixed(6), 0.903);
  assert.equal(await reserveUsd(pipe, day, 0.6, 1), false, "over the cap: taken back and refused");
  assert.equal(+kv.get(usdKey(day))!.toFixed(6), 0.903);
  const n = sent.length;
  assert.equal(await reserveUsd(pipe, day, 0.001, 1), false, "after the cap, this instance stops asking for the day");
  assert.equal(sent.length, n, "no Upstash command once the day is full");
  assert.equal(await reserveUsd(async () => null, day, 0.01, 1), false, "store down → no reservation → parser");
  assert.ok(worstCaseUsd("bookcase 6 ft") > 0.0021, "the reserve is above a real uncached call");
});

test("I49 the gate: the linen canary, cat tree, step stool and the pocket brief never reach the model", () => {
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "cat tree", "step stool", POCKET_DREAM]) assert.equal(needsReader(q), false, q.slice(0, 40));
  for (const q of ["shoe rack by the door 36 inches", Q, "bookcase 90cm wide", "two-step kitchen stool", "deck box 4 ft"]) assert.equal(needsReader(q), true, q);
});

test("I49 per-IP rate limit: the reader bucket allows 20 calls a day per visitor, then refuses; a refused call gives back its reserve", async () => {
  const seen: boolean[] = [];
  for (let i = 0; i < 21; i++) seen.push(await underDailyCap("reader", "203.0.113.7"));
  assert.deepEqual([seen.filter(Boolean).length, seen[20], await underDailyCap("reader", "203.0.113.8")], [20, false, true]);
  const m = mock({ call: async () => ({ ok: false as const, error: "capped" }) });
  assert.equal((await readPrompt(Q, false, m.d)).ok, false);
  assert.equal(chooseBuildPrompt(Q, null).buildPrompt, Q, "rate-limited → the typed words build");
  assert.deepEqual(m.spend.settled.map(([, b]) => b), [0], "nothing billed for a refused call");
});
