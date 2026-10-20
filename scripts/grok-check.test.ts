import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Budget, CAP_USD, CapReached, countTokens, usageUsd } from "./grok-check/budget.ts";
import { SCHEMA, SYSTEM, grokCheckGate, liveTransport, replayTransport } from "./grok-check/client.ts";
import { classify, filterMismatches, titleHonorsNoun } from "./grok-check/filter.ts";
import { loadFixture, measure } from "./grok-check/measure-fp.ts";
import { runCheck } from "./grok-check/run.ts";
import { buildSummary, userMessage } from "./grok-check/summary.ts";

// ZERO paid calls: every test below uses recorded fixtures or an in-memory fake. fetch itself is poisoned.
const realFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (async () => { fetchCalls++; throw new Error("no network in tests"); }) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; assert.equal(fetchCalls, 0, "a test touched fetch"); });

const rows = loadFixture();

test("calls are off by default: on only with YARD_GROK_CHECK=on AND an XAI_API_KEY", () => {
  assert.equal(grokCheckGate({}).on, false);
  assert.equal(grokCheckGate({ YARD_GROK_CHECK: "on" }).on, false);
  assert.equal(grokCheckGate({ XAI_API_KEY: "k" }).on, false);
  for (const v of ["On", "ON", "true", "1", "yes", " on"]) assert.equal(grokCheckGate({ YARD_GROK_CHECK: v, XAI_API_KEY: "k" }).on, false, v);
  assert.equal(grokCheckGate({ YARD_GROK_CHECK: "on", XAI_API_KEY: "   " }).on, false);
  assert.equal(grokCheckGate({ YARD_GROK_CHECK: "on", XAI_API_KEY: "k" }).on, true);
  assert.throws(() => liveTransport({ XAI_API_KEY: "k" }, realFetch), /calls are off/);
  assert.throws(() => liveTransport({}, realFetch), /calls are off/);
});

test("off mode builds and prices the run but sends nothing", async () => {
  const fake = { generateFromPrompt: (q: string) => ({ q, overall: { width: 30, depth: 12, height: 60 }, primaryMaterialId: "plywood-3-4-4x8", kind: "closet" }), buildPlan: () => ({ cutList: [{ label: "A", name: "Shelf", quantity: 2, lengthIn: 28.5, widthIn: 11.25, thicknessIn: 0.75, material: "3/4\" Plywood" }], bom: [], totals: { pieces: 2, estCostUsd: 40 }, feasibility: { status: "ok", summary: "fine", issues: [] }, instructions: [{ title: "Cut" }] }), headerTitle: () => "Bookcase" };
  const r = await runCheck({ corpus: rows.slice(0, 5).map(({ id, prompt, spec }) => ({ id, prompt, spec })), mode: "off", reason: "calls are off", engine: fake });
  assert.equal(r.calls, 0);
  assert.equal(r.spent_usd, 0);
  assert.ok(r.rows.every((x) => x.status === "not-checked-off"));
  assert.ok(r.projected.worst_case_usd > 0);
  // The summary B is sent no longer carries the internal Kind (false-positive class 1).
  const s = buildSummary(fake, "bookcase 30 wide");
  assert.doesNotMatch(s.summary, /Kind:|closet/);
  assert.match(s.summary, /^Title: Bookcase$/m);
});

test("the pre-call token count is never below xAI's real prompt_tokens (all 118 recorded B calls)", () => {
  for (const r of rows) {
    const est = countTokens([{ role: "system", content: SYSTEM }, { role: "user", content: userMessage(r.spec, r.summary) }], JSON.stringify(SCHEMA));
    assert.ok(est >= r.recorded.usage.prompt_tokens, `${r.id}: est ${est} < real ${r.recorded.usage.prompt_tokens}`);
  }
});

test("$2/run cap: priced before each call, stops once reached, cannot be raised", async () => {
  assert.throws(() => new Budget(2.01), /cap must be/);
  assert.throws(() => new Budget(0), /cap must be/);
  const b = new Budget(0.006); // one 2000-token call reserves $0.004 and costs $0.00275; a second would need $0.004 more
  b.charge(b.reserve(2000), { prompt_tokens: 2000, completion_tokens: 100 });
  assert.throws(() => b.reserve(2000), CapReached);
  assert.equal(b.stopped, true);
  assert.throws(() => b.reserve(1), CapReached, "latched");
  assert.equal(usageUsd({ prompt_tokens: 1000, completion_tokens: 100, cost_in_usd_ticks: 25081000 }), 0.0025081);
  const m = new Budget(1);
  assert.equal(m.charge(0.004, { foo: 1 } as any), 0.004, "malformed usage is charged the reserved worst case");
  assert.equal(m.charge(0.004, null), 0.004);
  // Replay the 118 recorded calls under a 5-cent cap: it stops, never overspends, and says so.
  let sent = 0;
  const t = replayTransport(rows);
  const counting = { kind: t.kind, send: (id: string, m: any) => { sent++; return t.send(id, m); } } as typeof t;
  const r = await runCheck({ corpus: rows, mode: "replay", transport: counting, cap: 0.05 });
  assert.ok(r.spent_usd <= 0.05, `spent ${r.spent_usd}`);
  assert.equal(r.stopped_for_cap, true);
  assert.equal(r.calls, sent);
  assert.ok(r.rows.some((x) => x.status === "not-checked-cap"));
  let clock = 0;
  const late = await runCheck({ corpus: rows.slice(0, 3), mode: "replay", transport: replayTransport(rows), deadlineMs: 10, now: () => (clock += 6) });
  assert.deepEqual(late.rows.map((x) => x.status), ["checked", "not-checked-time", "not-checked-time"]);
  const full = await runCheck({ corpus: rows, mode: "replay", transport: replayTransport(rows) });
  assert.equal(full.calls, 118);
  assert.equal(full.stopped_for_cap, false);
  assert.ok(full.spent_usd < CAP_USD && Math.abs(full.spent_usd - 0.1541) < 0.001, `replayed spend ${full.spent_usd}`);
});

test("live transport (with a fake fetch, never the network) sends the arm-B request and only the key in the header", async () => {
  let seen: any = null;
  const fake = (async (url: string, init: any) => { seen = { url, init }; return new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true,\"mismatches\":[]}" } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 }); }) as unknown as typeof fetch;
  const t = liveTransport({ YARD_GROK_CHECK: "on", XAI_API_KEY: "test-key" }, fake);
  const r = await t.send("x", [{ role: "user", content: "hi" }]);
  assert.equal(r.err, null);
  assert.equal(seen.url, "https://api.x.ai/v1/chat/completions");
  const body = JSON.parse(seen.init.body);
  assert.equal(body.model, "grok-4.20-0309-non-reasoning");
  assert.equal(body.response_format.json_schema.name, "yard_build_check");
  assert.equal(seen.init.headers.authorization, "Bearer test-key");
  assert.doesNotMatch(seen.init.body, /test-key/);
});

test("false positives fixed on recorded outputs: kind noun, present features, drawer parts — no real flag dropped", () => {
  const m = measure(rows);
  assert.equal(m.before.flagged, 83);
  assert.equal(m.before.false_positive, 31);
  assert.equal(m.before.real, 39);
  assert.equal(m.after.real, 39, "a real mismatch was dropped");
  assert.ok(m.after.false_positive <= 8, `after: ${m.after.false_positive} F`);
  assert.equal(m.after.builds_with_a_real_flag, m.before.builds_with_a_real_flag);
  for (const rule of ["kind-noun", "present", "drawer-parts"]) assert.equal(m.dropped_by_rule[rule]?.R ?? 0, 0, rule);
  // Named cases.
  const row = (id: string) => rows.find((r) => r.id === id)!;
  const ms = (id: string) => row(id).recorded.json!.mismatches;
  assert.equal(classify(ms("g1")[2], row("g1").spec, row("g1").summary)?.droppedAs, "kind-noun");
  assert.equal(classify(ms("g4")[0], row("g4").spec, row("g4").summary), null, "bar cart → Storage unit is real");
  assert.equal(classify(ms("g4")[1], row("g4").spec, row("g4").summary)?.droppedAs, "present", "casters = rolling");
  assert.equal(classify(ms("g10")[0], row("g10").spec, row("g10").summary)?.droppedAs, "drawer-parts");
  assert.equal(filterMismatches(ms("g76"), row("g76").spec, row("g76").summary).dropped.length, 0, "a title that says Doors is not a door part");
  assert.equal(filterMismatches(ms("g29"), row("g29").spec, row("g29").summary).dropped.length, 0, "filing cabinet with doors stays flagged");
  assert.ok(titleHonorsNoun("Platform bed 87\" long", "queen platform bed"));
  assert.ok(!titleHonorsNoun("Platform bed", "bunk bed"));
  assert.ok(!titleHonorsNoun("Butcher block cart", "butcher block countertop"));
});

test("the nightly workflow is scheduled only, hands over the key only when the variable is on, and never on a PR", () => {
  const y = readFileSync(new URL("../.github/workflows/grok-check-nightly.yml", import.meta.url), "utf8");
  assert.doesNotMatch(y, /^\s*pull_request/m);
  assert.match(y, /schedule:/);
  assert.match(y, /XAI_API_KEY: \$\{\{ vars\.YARD_GROK_CHECK == 'on' && secrets\.XAI_API_KEY \|\| '' \}\}/);
  assert.equal((y.match(/secrets\./g) ?? []).length, 1, "the key is referenced exactly once");
  assert.match(y, /permissions:\s*\n\s*contents: read/);
});
