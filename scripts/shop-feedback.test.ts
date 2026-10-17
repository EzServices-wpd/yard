import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFeedback, cleanCid, scrubNote } from "../src/lib/feedback/shop";
import { ShopStore, DAY_CAP, CLIENT_DAY_CAP, INSTANCE_PER_MIN } from "../src/lib/feedback/store.server";

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
      case "LTRIM": { const l = kv.get(k) ?? []; const at = (i: number) => (i < 0 ? l.length + i : i); kv.set(k, l.slice(Math.max(0, at(Number(a[0]))), Math.max(0, at(Number(a[1])) + 1))); return "OK"; }
      case "LRANGE": { const l = kv.get(k) ?? []; const at = (i: number) => Math.max(0, i < 0 ? l.length + i : i); return l.slice(at(Number(a[0])), at(Number(a[1])) + 1); }
      case "HDEL": { const h = kv.get(k) ?? {}; let n = 0; for (const f of a) if (f in h) { delete h[f]; n++; } return n; }
      case "ZREVRANGE": return kv.get(k) ?? [];
      case "HMGET": { const h = kv.get(k) ?? {}; return a.map((f: string) => h[f] ?? null); }
      case "HGET": return (kv.get(k) ?? {})[a[0]] ?? null;
      case "HEXISTS": return (kv.get(k) ?? {})[a[0]] ? 1 : 0;
      case "HSET": { const h = kv.get(k) ?? {}; for (let i = 0; i < a.length; i += 2) h[a[i]] = a[i + 1]; kv.set(k, h); return 1; }
      case "HSETEX": { const h = kv.get(k) ?? {}; const i = a.indexOf("FIELDS"); const n = Number(a[i + 1]); for (let j = 0; j < n; j++) h[a[i + 2 + 2 * j]] = a[i + 3 + 2 * j]; kv.set(k, h); return 1; }
      case "EXPIREAT": return 1;
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
  assert.equal(await s.addFeedback(rec, "none", new Date("2026-10-16T10:00:00Z")), "saved");
  for (let i = 1; i < INSTANCE_PER_MIN; i++) await s.addFeedback(rec, `c${i}`.padEnd(16, "0"), new Date("2026-10-16T10:00:01Z"));
  assert.equal(await s.addFeedback(rec, "none", new Date("2026-10-16T10:00:02Z")), "limited");
  f.kv.set("feedback:day:2026-10-16", DAY_CAP);
  assert.equal(await s.addFeedback(rec, "none", new Date("2026-10-16T10:05:00Z")), "limited");
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

test("browser scrub matches the server's: PII notes are refused, clean ones pass", () => {
  assert.deepEqual(scrubNote(""), { ok: true, note: null });
  assert.equal(scrubNote("call me 555-123-4567").ok, false);
  assert.equal(scrubNote("see https://x.co").ok, false);
  assert.deepEqual(scrubNote("  shelf sits low "), { ok: true, note: "shelf sits low" });
  const server = cleanFeedback({ chips: ["other"], note: "call me 555-123-4567" }, "")!;
  assert.equal(server.note, null, "the server scrub still runs");
});

test("per-client soft cap: 10 a day per anonymous id, others unaffected, id never stored", async () => {
  const f = fakeRedis();
  const rec = cleanFeedback({ chips: ["price"] }, "")!;
  const noisy = "a".repeat(24), quiet = "b".repeat(24);
  const t = (i: number) => new Date(Date.UTC(2026, 9, 16, 9, i * 2));
  const s = new ShopStore(f.pipe);
  for (let i = 0; i < CLIENT_DAY_CAP; i++) assert.equal(await s.addFeedback(rec, noisy, t(i)), "saved");
  assert.equal(await s.addFeedback(rec, noisy, t(20)), "limited");
  assert.equal(await s.addFeedback(rec, quiet, t(21)), "saved");
  assert.equal(await s.addFeedback(rec, noisy, new Date("2026-10-17T09:00:00Z")), "saved", "a new day resets it");
  assert.ok(f.calls.some((c) => c[0] === "EXPIRE" && String(c[1]).startsWith("feedback:cid:")), "the counter expires");
  const lists = [...f.kv.keys()].filter((k) => k.startsWith("feedback:list:"));
  assert.ok(lists.length === 2, `one list per day: ${lists}`);
  for (const k of lists) assert.ok(!(f.kv.get(k) as string[]).some((r) => r.includes(noisy)), "the id is never in a record");
  assert.equal(cleanCid("x; DROP"), "none");
  assert.equal(cleanCid(noisy), noisy);
});

test("the feedback request sends no referrer, cookies or identity (the page URL carries ?q=)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/components/workspace/shop-feedback.tsx", import.meta.url), "utf8");
  const call = src.slice(src.indexOf('fetch("/api/feedback"'), src.indexOf("});", src.indexOf('fetch("/api/feedback"')));
  assert.match(call, /referrerPolicy:\s*"no-referrer"/);
  assert.match(call, /credentials:\s*"omit"/);
  assert.doesNotMatch(call, /email|name:|location\.href|document\.referrer/);
});

// --- orphaned review marks (90-day retention itself: scripts/retention.test.ts) ---
test("orphaned review marks (query-log entry gone) are removed on unreviewed and sample reads", async () => {
  const f = fakeRedis();
  f.kv.set("ideas:recent", ["aaaaaaaa"]);
  f.kv.set("ideas:meta", { aaaaaaaa: JSON.stringify({ prompt: "bench", size: "", resultKey: "bench" }), bbbbbbbb: JSON.stringify({ prompt: "shelf", size: "", resultKey: "shelf" }) });
  const mark = JSON.stringify({ reviewed: true, grade: "A", reviewedAt: "2026-10-01T00:00:00.000Z", lastSampledAt: null });
  f.kv.set("ideas:review", { bbbbbbbb: mark, dead0001: mark, dead0002: mark });
  const s = new ShopStore(f.pipe);
  await s.unreviewed();
  assert.deepEqual(Object.keys(f.kv.get("ideas:review")).sort(), ["bbbbbbbb"], "unreviewed read drops marks with no log entry");
  f.kv.get("ideas:review").dead0003 = mark;
  const rows = await s.sample(5);
  assert.deepEqual(rows.map((r) => r.key), ["bbbbbbbb"]);
  assert.deepEqual(Object.keys(f.kv.get("ideas:review")).sort(), ["bbbbbbbb"], "sample read drops them too");
  assert.ok(f.calls.some((c) => c[0] === "HDEL" && c[1] === "ideas:review"), "deleted with HDEL on the review hash");
});
