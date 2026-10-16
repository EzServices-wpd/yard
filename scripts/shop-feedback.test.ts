import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFeedback } from "../src/lib/feedback/shop";
import { ShopStore, DAY_CAP, INSTANCE_PER_MIN } from "../src/lib/feedback/store.server";

// A tiny in-memory Redis for the commands the store uses.
function fakeRedis() {
  const kv = new Map<string, any>();
  const calls: any[][] = [];
  const pipe = async (cmds: (string | number)[][]) => cmds.map((c) => { calls.push(c); const [op, k, ...a] = c as any[];
    switch (op) {
      case "INCRBY": kv.set(k, (kv.get(k) ?? 0) + Number(a[0])); return kv.get(k);
      case "INCR": kv.set(k, (kv.get(k) ?? 0) + 1); return kv.get(k);
      case "EXPIRE": return 1;
      case "LPUSH": { const l = kv.get(k) ?? []; l.unshift(a[0]); kv.set(k, l); return l.length; }
      case "LTRIM": return "OK";
      case "ZREVRANGE": return kv.get(k) ?? [];
      case "HMGET": { const h = kv.get(k) ?? {}; return a.map((f: string) => h[f] ?? null); }
      case "HGET": return (kv.get(k) ?? {})[a[0]] ?? null;
      case "HEXISTS": return (kv.get(k) ?? {})[a[0]] ? 1 : 0;
      case "HSET": { const h = kv.get(k) ?? {}; for (let i = 0; i < a.length; i += 2) h[a[i]] = a[i + 1]; kv.set(k, h); return 1; }
      case "HRANDFIELD": return Object.keys(kv.get(k) ?? {}).slice(0, a[0]);
    } return null; });
  return { kv, calls, pipe };
}

test("cleanFeedback keeps chips, scrubs PII, stores no identity", () => {
  const r = cleanFeedback({ prompt: "bookshelf 36x12x72", size: "36x12x72", partCount: 6, chips: ["wrong-size", "bogus", "wrong-size"], note: "email me at a@b.com", email: "x@y.z", name: "Ezra" }, "abcdef1234");
  assert.ok(r);
  assert.deepEqual(r.chips, ["wrong-size"]);
  assert.equal(r.note, null); // PII → dropped, not stored
  assert.equal(r.tip, "abcdef1");
  assert.deepEqual(Object.keys(r).sort(), ["at", "chips", "note", "partCount", "prompt", "size", "tip"]);
  assert.equal(cleanFeedback({ chips: [], note: "  " }, ""), null);
  assert.equal(cleanFeedback({ chips: ["other"], size: "<script>" }, "")!.size, "");
});

test("feedback is saved, then rate-limited per instance and per day", async () => {
  const f = fakeRedis();
  const s = new ShopStore(f.pipe);
  const rec = cleanFeedback({ chips: ["floating"], prompt: "linen cabinet" }, "")!;
  assert.equal(await s.addFeedback(rec, new Date("2026-10-16T10:00:00Z")), "saved");
  for (let i = 1; i < INSTANCE_PER_MIN; i++) await s.addFeedback(rec, new Date("2026-10-16T10:00:01Z"));
  assert.equal(await s.addFeedback(rec, new Date("2026-10-16T10:00:02Z")), "limited");
  f.kv.set("feedback:day:2026-10-16", DAY_CAP);
  assert.equal(await s.addFeedback(rec, new Date("2026-10-16T10:05:00Z")), "limited");
  assert.ok(f.kv.get("ideas:cmds:2026-10") > 0, "counts against the shared monthly budget");
});

test("review: list unreviewed, mark with a grade, sample stamps lastSampledAt", async () => {
  const f = fakeRedis();
  f.kv.set("ideas:recent", ["aaaaaaaa", "bbbbbbbb"]);
  f.kv.set("ideas:meta", { aaaaaaaa: JSON.stringify({ prompt: "bench", size: "48x16x18", resultKey: "bench" }), bbbbbbbb: JSON.stringify({ prompt: "shelf", size: "", resultKey: "shelf" }) });
  const s = new ShopStore(f.pipe);
  assert.deepEqual((await s.unreviewed()).map((r) => r.key), ["aaaaaaaa", "bbbbbbbb"]);
  assert.equal(await s.mark("aaaaaaaa", "B+"), "marked");
  assert.equal(await s.mark("cccccccc", "A"), "unknown");
  assert.deepEqual((await s.unreviewed()).map((r) => r.key), ["bbbbbbbb"]);
  const [row] = await s.sample(3, new Date("2026-10-16T12:00:00Z"));
  assert.equal(row.grade, "B+");
  assert.equal(row.reviewed, true);
  assert.equal(row.lastSampledAt, "2026-10-16T12:00:00.000Z");
});

test("budget exhausted → nothing is written", async () => {
  const f = fakeRedis();
  const s = new ShopStore(f.pipe);
  s.budget.allows(0); s.budget.saw(10_000_000);
  assert.equal(await s.addFeedback(cleanFeedback({ chips: ["other"] }, "")!), "dropped");
  assert.equal(f.calls.length, 0);
});
