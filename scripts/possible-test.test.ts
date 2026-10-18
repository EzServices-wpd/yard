// 'possible-test' source + ?test=1 for the whole session.
// Server: a burst rate counted by the server alone (site-wide, or from one run id, per minute) re-stamps a write
// 'possible-test'. The counter is a short-lived hash (EXPIRE 120 s) and never touches the row. No UA, webdriver, IP,
// cookie or browser detail anywhere. Client: ?test=1 holds for the tab, rides every navigation, tags every API call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BURST_FIX_CMDS, BURST_NEW_CMDS, BURST_STAMP_CMDS, PTEST_TTL_S, IdeaStore, RECENT_MAX, RUN_BURST, RUN_CMDS, SITE_BURST, TRIM_EVERY, WRITE_CMDS, burstRate, toStamp, type Pipe } from "../src/lib/yard/ideaLog.server";
import { handleIdeasLog } from "../src/lib/yard/ideaLogHandler";
import type { LogRecord } from "../src/lib/yard/ideaLog";

function fakeRedis() {
  const h = new Map<string, Map<string, string>>(), z = new Map<string, Map<string, number>>(), ttl = new Map<string, number>();
  const hs = (k: string) => (h.get(k) ?? h.set(k, new Map()).get(k)!);
  const zs = (k: string) => (z.get(k) ?? z.set(k, new Map()).get(k)!);
  const log: { calls: number; cmds: number; perCall: number[]; billed: number; names: string[][]; reads: (string | number)[][]; sent: (string | number)[][][] } = { calls: 0, cmds: 0, perCall: [], billed: 0, names: [], reads: [], sent: [] };
  const pipe: Pipe = async (list) => {
    log.calls++; log.sent.push(list); log.cmds += list.length; log.perCall.push(list.length); log.names.push(list.map((c) => String(c[0])));
    return list.map(([c, k, ...a]) => {
      const key = String(k);
      switch (c) {
        case "INCRBY": log.billed += Number(a[0]); return log.billed;
        case "HSET": hs(key).set(String(a[0]), String(a[1])); return 1;
        case "HSETNX": if (hs(key).has(String(a[0]))) return 0; hs(key).set(String(a[0]), String(a[1])); return 1;
        case "HINCRBY": { const v = Number(hs(key).get(String(a[0])) ?? 0) + Number(a[1]); hs(key).set(String(a[0]), String(v)); return v; }
        case "EXPIRE": ttl.set(key, Number(a[0])); return 1;
        case "HEXPIRE": { const i = a.indexOf("FIELDS"); return a.slice(i + 2).map((f) => (hs(key).has(String(f)) ? (ttl.set(`${key}/${f}`, Number(a[0])), 1) : -2)); }
        case "ZINCRBY": zs(key).set(String(a[1]), (zs(key).get(String(a[1])) ?? 0) + Number(a[0])); return String(zs(key).get(String(a[1])));
        case "ZADD": { const gt = a[0] === "GT"; const [s, m] = gt ? a.slice(1) : a; const cur = zs(key).get(String(m)); if (!gt || cur === undefined || Number(s) > cur) zs(key).set(String(m), Number(s)); return 1; }
        case "ZREMRANGEBYRANK": { const asc = [...zs(key)].sort((x, y) => x[1] - y[1]); const stop = Number(a[1]) < 0 ? asc.length + Number(a[1]) : Number(a[1]); const gone = stop < 0 ? [] : asc.slice(Number(a[0]), stop + 1); /* like Redis: a stop before the start removes nothing */ for (const [m] of gone) zs(key).delete(m); return gone.length; }
        case "ZREVRANGE": { log.reads.push([key, ...a.map((x) => (typeof x === "number" ? x : String(x)))]); const r = [...zs(key)].sort((x, y) => y[1] - x[1]).slice(Number(a[0]), Number(a[1]) + 1); return r.flatMap(([m, s]) => [m, String(s)]); }
        case "HMGET": return a.map((f) => h.get(key)?.get(String(f)) ?? null); // a read never creates the key
        case "ZMSCORE": return a.map((m) => { const v = zs(key).get(String(m)); return v === undefined ? null : String(v); });
        default: throw new Error(`unknown ${c}`);
      }
    });
  };
  return { pipe, h, hs, zs, ttl, log };
}

const T0 = Date.parse("2026-10-17T09:15:00.000Z"); // a minute boundary
const rec = (i: number): LogRecord => ({ key: `k${i}`, prompt: `shelf ${i}`, size: "36×12×72", resultKey: "builtin:bookcase", status: "Trusted", source: "live" });
const src = (r: ReturnType<typeof fakeRedis>, key: string) => JSON.parse(r.hs("ideas:stamp").get(key)!).source as string;
const RUN = "a1b2c3d4e5f60718";

test("site-wide burst: past SITE_BURST written builds in one minute, the rest are stamped 'possible-test'", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  for (let i = 0; i < SITE_BURST + 5; i++) await s.record(rec(i), new Date(T0 + i * 100));
  for (let i = 0; i < SITE_BURST; i++) assert.equal(src(r, `k${i}`), "live", `k${i}`);
  for (let i = SITE_BURST; i < SITE_BURST + 5; i++) assert.equal(src(r, `k${i}`), "possible-test", `k${i}`);
  // The window slides: just past the boundary the last minute still counts, so this is still a burst...
  await s.record(rec(998), new Date(T0 + 60_000));
  assert.equal(src(r, "k998"), "possible-test", "sliding: the previous minute still weighs in");
  // ...two minutes on, both buckets are quiet: back to live.
  await s.record(rec(999), new Date(T0 + 120_000));
  assert.equal(src(r, "k999"), "live");
});

test("one run id: past RUN_BURST builds in one minute are 'possible-test'; another run and the next minute are live", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  for (let i = 0; i < RUN_BURST + 2; i++) await s.record(rec(i), new Date(T0 + i * 1000), { run: RUN });
  for (let i = 0; i < RUN_BURST; i++) assert.equal(src(r, `k${i}`), "live");
  assert.equal(src(r, `k${RUN_BURST}`), "possible-test");
  assert.equal(src(r, `k${RUN_BURST + 1}`), "possible-test");
  await s.record(rec(500), new Date(T0 + 30_000), { run: "ffffeeee00001111" });
  assert.equal(src(r, "k500"), "live", "a different run in the same minute");
  await s.record(rec(501), new Date(T0 + 61_000), { run: RUN });
  assert.equal(src(r, "k501"), "possible-test", "same run, just past the boundary: the window slides");
  await s.record(rec(502), new Date(T0 + 180_000), { run: RUN });
  assert.equal(src(r, "k502"), "live", "same run, after a quiet minute");
});

test("the counter is short-lived and never stored with a row (no run id in meta, stamp, top or recent)", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  await s.record(rec(1), new Date(T0), { run: RUN });
  const burstKeys = [...r.h.keys()].filter((k) => k.startsWith("ideas:burst:"));
  assert.equal(burstKeys.length, 1);
  assert.equal(r.ttl.get(burstKeys[0]), 120, "EXPIRE 120 s");
  assert.deepEqual([...r.hs(burstKeys[0]).keys()].sort(), ["run:" + RUN, "site"], "counts only");
  for (const k of ["ideas:meta", "ideas:stamp"]) assert.doesNotMatch(JSON.stringify([...r.hs(k)]), new RegExp(RUN), k);
  assert.deepEqual(Object.keys(JSON.parse(r.hs("ideas:stamp").get("k1")!)).sort(), ["at", "source"]);
  const row = (await s.snapshot(new Date(T0 + 1000))).rows[0];
  assert.doesNotMatch(JSON.stringify(row), new RegExp(RUN));
});

test("a coalesced write (same key within 10 s) does not touch the burst hash", async () => {
  const r = fakeRedis();
  const held: Promise<unknown>[] = [];
  const s = new IdeaStore(r.pipe, undefined, (p) => held.push(p), async () => {});
  assert.equal(await s.record(rec(1), new Date(T0), { run: RUN }), "written");
  const burst = [...r.h.keys()].find((k) => k.startsWith("ideas:burst:"))!;
  const before = JSON.stringify([...r.hs(burst)]);
  const calls = r.log.calls;
  for (let i = 1; i <= 5; i++) assert.equal(await s.record(rec(1), new Date(T0 + i * 1000), { run: RUN }), "coalesced");
  await Promise.all(held); // the held repeats are flushed as one increment (3 commands, no burst count)
  assert.equal(JSON.stringify([...r.hs(burst)]), before, "site and run counts unchanged");
  const after = r.log.perCall.slice(calls);
  assert.ok(after.length >= 1 && after.every((n) => n === 3), `only flush pipelines (INCRBY + ZINCRBY + ZADD) ran: ${after}`);
});

test("a bad run id is ignored (only 8-32 letters/digits count); it costs no extra command", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const bad = ["short", "has space here!!", "x".repeat(40), "../../ideas:meta"];
  for (const [i, run] of bad.entries()) await s.record(rec(i), new Date(T0 + i * 1000), { run });
  for (const k of [...r.h.keys()].filter((k) => k.startsWith("ideas:burst:"))) assert.deepEqual([...r.hs(k).keys()], ["site"]);
  assert.ok(r.log.perCall.every((n) => n <= WRITE_CMDS), `no run-id command: ${r.log.perCall}`);
});

test("Upstash commands per write: at most 10 (+1 with a run id); the trim and the TTL are deterministic per instance; in a burst +4 for a new row, +3 for a live row, +5 for a possible-test-only row; the budget bills exactly what is sent", async () => {
  assert.equal(WRITE_CMDS, 10);
  assert.equal(RUN_CMDS, 1);
  assert.equal(TRIM_EVERY, 8);
  assert.equal(BURST_NEW_CMDS, 4); // + HEXPIRE on the ideas:ptest field
  assert.equal(BURST_FIX_CMDS, 3);
  assert.equal(BURST_STAMP_CMDS, 2);
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  await s.record(rec(1), new Date(T0), { run: RUN }); // 1st write: trims, sets the bucket TTL
  assert.deepEqual(r.log.perCall, [11]);
  await s.record(rec(2), new Date(T0 + 1), { run: RUN }); // same minute: no trim, no TTL
  assert.deepEqual(r.log.perCall, [11, 9]);
  assert.ok(!r.log.names[1].includes("ZREMRANGEBYRANK") && !r.log.names[1].includes("EXPIRE"));
  await s.record(rec(3), new Date(T0 + 60_000), { run: RUN }); // a new minute: TTL again, still no trim
  assert.deepEqual(r.log.perCall, [11, 9, 10]);
  for (let i = 4; i <= 8; i++) await s.record(rec(i), new Date(T0 + 60_000 + i), { run: RUN });
  await s.record(rec(9), new Date(T0 + 60_100), { run: RUN }); // the 9th write: trims
  assert.ok(r.log.names.at(-1)!.includes("ZREMRANGEBYRANK"));
  assert.equal(r.log.names.filter((n) => n.includes("ZREMRANGEBYRANK")).length, 2, "writes 1 and 9");
  assert.equal(r.log.billed, r.log.cmds, "INCRBY budget counts every command sent");
  // Net per write with a run id, one write per minute per instance (the worst case): 11 − 7/8 = 10.125;
  // with 2+ writes a minute on an instance it is ≤ 9.625. Without a run id, one less.
  const net = (perMinute: number) => 9 + (1 / TRIM_EVERY) + 1 / perMinute;
  assert.equal(net(1), 10.125);
  assert.ok(net(2) <= 9.625 && net(8) <= 10);
  // In a burst (all one minute): new row +4, live row +3, possible-test-only row +3+2.
  const b = fakeRedis();
  const sb = new IdeaStore(b.pipe, undefined, () => {}, async () => {});
  for (let i = 1; i <= SITE_BURST + 1; i++) await sb.record(rec(i), new Date(T0 + i));
  assert.equal(b.log.perCall.at(-1), BURST_NEW_CMDS, "a new row over the line: one 4-command pipeline (count + its TTL + stamp)");
  await sb.record(rec(1), new Date(T0 + 20_000)); // k1 was written live before the line
  assert.equal(b.log.perCall.at(-1), BURST_FIX_CMDS, "a live row: count (+ its TTL) only, no stamp");
  await sb.record(rec(SITE_BURST + 1), new Date(T0 + 20_001));
  assert.deepEqual(b.log.perCall.slice(-2), [BURST_FIX_CMDS, BURST_STAMP_CMDS], "a possible-test-only row: count, then re-stamp");
  assert.equal(b.log.billed, b.log.cmds);
});

test("recent log: trimmed on every 8th write per instance, it never holds more than 200 + 8; the snapshot reads only its newest 200", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  let most = 0;
  for (let i = 0; i < 1000; i++) {
    await s.record({ ...rec(i), source: undefined }, new Date(T0 + i * 5_000)); // 5 s apart: no burst, no coalescing
    most = Math.max(most, r.zs("ideas:recent").size);
  }
  assert.ok(most < RECENT_MAX + TRIM_EVERY, `recent log peaked at ${most}`);
  assert.ok(r.zs("ideas:recent").size >= RECENT_MAX, `the newest 200 are always kept: ${r.zs("ideas:recent").size}`);
  const snap = await s.snapshot(new Date(T0 + 5_000_000));
  assert.deepEqual(r.log.reads.find((x) => x[0] === "ideas:recent")!.slice(1, 3), [0, RECENT_MAX - 1], "ZREVRANGE recent 0 199");
  const seen = snap.rows.filter((x) => x.lastSeen);
  assert.ok(seen.length <= RECENT_MAX, `rows from the recent log: ${seen.length}`);
  assert.equal(seen.length, RECENT_MAX);
  assert.ok(snap.recent.length <= 20);
  // The newest 200 are the ones read: the oldest of them is write 800.
  assert.equal(Math.min(...seen.map((x) => Date.parse(x.lastSeen!))), T0 + 800 * 5_000);
});

test("sliding window: burstRate weights the previous minute by the part still inside the last 60 s", () => {
  const at = (s: number) => new Date(T0 + s * 1000);
  assert.equal(burstRate(60, 0, at(0)), 60, "at the boundary the whole last minute counts");
  assert.equal(burstRate(60, 10, at(30)), 40, "half-way: half of it");
  assert.ok(Math.abs(burstRate(60, 0, at(59)) - 1) < 1e-9);
  assert.equal(burstRate(Number.NaN, 5, at(10)), 5, "a missing bucket counts 0");
});

test("sliding window: 120 builds spread across a minute boundary are stamped 'possible-test' (a fixed bucket missed them)", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  // 60 in the last 30 s of one minute, 60 in the first 30 s of the next: never more than 60 in one fixed bucket.
  for (let i = 0; i < 120; i++) await s.record(rec(i), new Date(T0 + 30_000 + i * 500));
  const flagged = Array.from({ length: 120 }, (_, i) => src(r, `k${i}`) === "possible-test").filter(Boolean).length;
  for (let i = 0; i < SITE_BURST; i++) assert.equal(src(r, `k${i}`), "live", `k${i}: under the line before the boundary`);
  assert.ok(flagged >= 55, `most of the second minute is flagged: ${flagged}`);
  assert.equal(src(r, "k60"), "possible-test", "the first build past the boundary already sees the last minute");
  assert.equal(src(r, "k119"), "possible-test");
  // The same spread with a fixed bucket (no previous minute) would flag none.
  assert.equal(Math.max(...[...r.h.keys()].filter((k) => k.startsWith("ideas:burst:")).map((k) => Number(r.hs(k).get("site")))), 60);
});

test("sliding window per run id: 20 builds from one run across a boundary (10 + 10) are caught", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  for (let i = 0; i < 20; i++) await s.record(rec(i), new Date(T0 + 50_000 + i * 1000), { run: RUN });
  for (let i = 0; i < 10; i++) assert.equal(src(r, `k${i}`), "live");
  for (let i = 10; i < 20; i++) assert.equal(src(r, `k${i}`), "possible-test", `k${i}`);
});

test("sticky live: once a row has had a live write, burst writes only add to its possible-test count, never flip it", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  await s.record(rec(7), new Date(T0 - 600_000)); // a popular row, written live ten minutes earlier
  assert.equal(src(r, "k7"), "live");
  for (let i = 100; i < 100 + SITE_BURST + 5; i++) await s.record(rec(i), new Date(T0 + (i - 100) * 100)); // a spike
  for (let j = 0; j < 3; j++) await s.record(rec(7), new Date(T0 + 7_000 + j * 11_000)); // the spike hits the popular row
  assert.equal(src(r, "k7"), "live", "the spike writes never flip it");
  assert.equal(r.hs("ideas:ptest").get("k7"), "3", "they are counted instead");
  assert.equal(r.zs("ideas:top").get("k7"), 4, "and still add to its count");
  assert.equal(JSON.parse(r.hs("ideas:stamp").get("k7")!).at, new Date(T0 + 29_000).toISOString(), "the stamp time still moves");
  // A row that only ever saw spike writes is possible-test, and stays so while the spike lasts...
  const spike = `k${100 + SITE_BURST + 1}`;
  assert.equal(src(r, spike), "possible-test");
  await s.record(rec(100 + SITE_BURST + 1), new Date(T0 + 20_000));
  assert.equal(src(r, spike), "possible-test", "a second spike write keeps it possible-test");
  // ...until a live write outside a burst: then it is live for good.
  await s.record(rec(100 + SITE_BURST + 1), new Date(T0 + 300_000));
  assert.equal(src(r, spike), "live");
  await s.record(rec(100 + SITE_BURST + 1), new Date(T0 + 300_000 + 15_000)); // T0+5 min is quiet; make it a spike again
  for (let i = 500; i < 500 + SITE_BURST + 2; i++) await s.record(rec(i), new Date(T0 + 330_000 + (i - 500) * 100));
  await s.record(rec(100 + SITE_BURST + 1), new Date(T0 + 340_000));
  assert.equal(src(r, spike), "live", "a live row stays live through a later spike");
});

test("sticky live: held repeats of a possible-test write count as possible-test, so they don't make the row look live", async () => {
  const r = fakeRedis();
  const held: Promise<unknown>[] = [];
  const s = new IdeaStore(r.pipe, undefined, (p) => held.push(p), async () => {});
  for (let i = 0; i < SITE_BURST; i++) await s.record(rec(i), new Date(T0 + i * 100));
  await s.record(rec(900), new Date(T0 + 7_000)); // over the line: possible-test
  for (let j = 1; j <= 3; j++) await s.record(rec(900), new Date(T0 + 7_000 + j * 1000)); // coalesced repeats
  await Promise.all(held);
  assert.equal(r.zs("ideas:top").get("k900"), 4);
  assert.equal(r.hs("ideas:ptest").get("k900"), "4", "the flush adds the repeats to the possible-test count");
  await s.record(rec(900), new Date(T0 + 20_000)); // still in the spike
  assert.equal(src(r, "k900"), "possible-test", "no live history, so the spike write re-stamps it");
});

test("gate test traffic is still never written, even in a burst; 'possible-test' only re-stamps live writes", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const deps = { recordFromPrompt: async (p: string) => ({ ...rec(Number(p.split(" ")[1])), source: undefined }), store: () => s, env: {}, now: () => new Date(T0) };
  for (let i = 0; i < SITE_BURST + 3; i++)
    await handleIdeasLog(new Request("https://yard.wiki/api/ideas-log", { method: "POST", body: JSON.stringify({ prompt: `shelf ${i}`, run: RUN }), headers: { "x-yard-test": "1" } }), deps);
  assert.equal(r.hs("ideas:stamp").size, 0);
  assert.equal(r.log.calls, 0, "no Upstash command at all for test traffic");
  for (let i = 0; i < RUN_BURST + 1; i++)
    await handleIdeasLog(new Request("https://yard.wiki/api/ideas-log", { method: "POST", body: JSON.stringify({ prompt: `shelf ${i}`, run: RUN }) }), deps);
  assert.equal(src(r, `k${RUN_BURST}`), "possible-test", "the handler passes the body's run id to the counter");
  assert.equal(src(r, "k0"), "live");
});

test("the snapshot passes 'possible-test' through; old rows still read 'unknown'", () => {
  assert.equal(toStamp(JSON.stringify({ at: "2026-10-17T09:15:00.000Z", source: "possible-test" })).source, "possible-test");
  assert.equal(toStamp(null).source, "unknown");
  assert.equal(toStamp(JSON.stringify({ source: "bot" })).source, "unknown");
});

test("no browser detail: no user agent, navigator.webdriver, IP or cookie on the write, serve or session paths", () => {
  const strip = (f: string) => fs.readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  for (const f of ["src/lib/yard/ideaLogHandler.ts", "src/lib/yard/ideaLog.server.ts", "src/lib/yard/ideaLogClient.ts", "src/lib/ideas/testSession.ts", "src/lib/ideas/testFlags.ts", "src/routes/api/ideas-log.ts"])
    assert.doesNotMatch(strip(f), /user-?agent|webdriver|navigator\.(?!sendBeacon)|x-forwarded|x-real-ip|cf-connecting|\bip\b|cookie|fingerprint|screen\.|devicePixelRatio|hardwareConcurrency|languages?\b|timezone/i, f);
});

// ---- client: ?test=1 for the whole session ----

function fakeWindow(search: string) {
  const store = new Map<string, string>();
  const sent: { url: string; headers: Record<string, string>; body?: string }[] = [];
  const win = {
    location: { search, href: `https://yard.wiki/${search}`, origin: "https://yard.wiki" },
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => { sent.push({ url: String(input), headers: Object.fromEntries(new Headers(init?.headers).entries()), body: typeof init?.body === "string" ? init.body : undefined }); return new Response(null, { status: 204 }); },
    requestIdleCallback: (cb: () => void) => cb(),
  };
  return { win, store, sent, go: (s: string) => { win.location.search = s; win.location.href = `https://yard.wiki/x${s}`; } };
}

test("client: ?test=1 holds for the tab session and every same-origin API call carries x-yard-test", async () => {
  const w = fakeWindow("?test=1");
  (globalThis as { window?: unknown }).window = w.win;
  try {
    const ts = await import("../src/lib/ideas/testSession");
    const { currentTestFlags } = await import("../src/lib/ideas/testFlags");
    ts.installTestHeader();
    ts.installTestHeader(); // idempotent
    w.go(""); // a link that dropped the flag, or a full reload elsewhere in the tab
    assert.equal(ts.sessionTest(), true);
    assert.deepEqual(currentTestFlags(), { test: 1 }, "every build URL made from currentTestFlags keeps test=1");
    await w.win.fetch("/api/ideas-snapshot");
    await w.win.fetch("/_serverFn/abc", { method: "POST", headers: { "content-type": "application/json" } });
    await w.win.fetch(new URL("https://yard.wiki/api/rtc"));
    await w.win.fetch("https://fonts.googleapis.com/css2");
    assert.deepEqual(w.sent.map((x) => x.headers["x-yard-test"] ?? null), ["1", "1", "1", null], "same-origin only");
    assert.equal(w.sent[1].headers["content-type"], "application/json", "other headers kept");
    const run = ts.runId();
    assert.match(run, /^[a-f0-9]{16}$/);
    assert.equal(ts.runId(), run, "one run id per tab");
    // The Ideas log: a beacon can't carry the header, so a test session sends it with fetch + header.
    const { logIdea } = await import("../src/lib/yard/ideaLogClient");
    const realFetch = globalThis.fetch;
    globalThis.fetch = w.win.fetch as typeof fetch; // in a browser, fetch is window.fetch
    (globalThis as { navigator?: unknown }).navigator ??= {};
    w.sent.length = 0;
    logIdea("bookshelf 36 wide");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].url, "/api/ideas-log");
    assert.equal(w.sent[0].headers["x-yard-test"], "1");
    assert.deepEqual(JSON.parse(w.sent[0].body!), { prompt: "bookshelf 36 wide", failed: false, run }, "the body carries the run id, nothing else about the browser");
    globalThis.fetch = realFetch;
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("client: no test flag, no header and no session flag", async () => {
  const w = fakeWindow("?q=bench");
  (globalThis as { window?: unknown }).window = w.win;
  try {
    const ts = await import("../src/lib/ideas/testSession");
    ts.rememberTestFromUrl();
    assert.equal(w.store.get("yard:test"), undefined);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("router: the root route keeps the test flags (offline, local, test) on every navigation, and getRouter installs the header", () => {
  const root = fs.readFileSync("src/routes/__root.tsx", "utf8");
  assert.match(root, /validateSearch: \(s: Record<string, unknown>\): TestFlags => pickTestFlags\(s\)/);
  assert.match(root, /search: \{ middlewares: \[retainSearchParams\(\[\.\.\.TEST_FLAGS\]\)\] \}/);
  assert.match(fs.readFileSync("src/router.tsx", "utf8"), /installTestHeader\(\);/);
});

test("ideas:ptest: every count write carries its own field TTL (85 days) in the same pipeline: new row, live row, test-only row, held repeats", async () => {
  const r = fakeRedis();
  const held: Promise<unknown>[] = [];
  const s = new IdeaStore(r.pipe, undefined, (p) => held.push(p), async () => {});
  for (let i = 0; i < SITE_BURST + 3; i++) await s.record(rec(i), new Date(T0 + i * 100)); // new rows over the line
  await s.record(rec(0), new Date(T0 + 20_000)); // a live row in the spike
  await s.record(rec(SITE_BURST + 1), new Date(T0 + 20_001)); // a possible-test-only row again
  for (let j = 1; j <= 3; j++) await s.record(rec(SITE_BURST + 2), new Date(T0 + 7_000 + j * 1000)); // held repeats → flush
  await Promise.all(held);
  const writes = r.log.sent.flatMap((list) => list.filter((c) => c[1] === "ideas:ptest" && c[0] !== "HEXPIRE").map((c) => ({ c, list })));
  assert.ok(writes.length >= 4, `ptest writes seen: ${writes.length}`);
  for (const { c, list } of writes) {
    assert.equal(c[0], "HINCRBY", `only counts are written: ${c}`);
    const ex = list.find((x) => x[0] === "HEXPIRE" && x[1] === "ideas:ptest" && x[x.length - 1] === c[2]);
    assert.ok(ex, `HINCRBY ideas:ptest ${c[2]} without its HEXPIRE`);
    assert.equal(Number(ex![2]), PTEST_TTL_S);
  }
  assert.equal(PTEST_TTL_S, 85 * 86_400, "85 days: #39's RETAIN_DAYS, so every copy is gone well inside the privacy page's 90 days");
  for (const k of r.hs("ideas:ptest").keys()) assert.equal(r.ttl.get(`ideas:ptest/${k}`), PTEST_TTL_S, k);
  for (const [, v] of r.hs("ideas:ptest")) assert.match(v, /^\d+$/, "counts only, no text");
  assert.equal(r.log.billed, r.log.cmds, "the budget bills the HEXPIREs too");
});
