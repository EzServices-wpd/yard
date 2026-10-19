import assert from "node:assert/strict";
import test from "node:test";
import { isOffensive, logKey, safePrompt, searchLog, stripPii, trustedPopular, type SnapshotRow } from "./ideaLog.ts";
import { BUDGET, Budget, FREE_TIER, IdeaStore, WRITE_CMDS, recordFromPrompt, rejectedLine, restPipe, storeEnv, toStamp, type Pipe } from "./ideaLog.server.ts";
import { handleIdeasLog } from "./ideaLogHandler.ts";

/** In-memory Redis enough for the pipeline the store sends. Counts every command like Upstash bills them. */
function fakeRedis() {
  const h = new Map<string, Map<string, string>>(), z = new Map<string, Map<string, number>>(), kv = new Map<string, number>();
  let cmds = 0, calls = 0;
  const zs = (k: string) => (z.get(k) ?? z.set(k, new Map()).get(k)!);
  const hs = (k: string) => (h.get(k) ?? h.set(k, new Map()).get(k)!);
  const rev = (k: string) => [...zs(k)].sort((a, b) => b[1] - a[1]);
  const pipe: Pipe = async (list) => {
    calls++;
    return list.map(([c, k, ...a]) => {
      cmds++;
      const key = String(k);
      switch (c) {
        case "INCRBY": kv.set(key, (kv.get(key) ?? 0) + Number(a[0])); return kv.get(key);
        case "HSET": hs(key).set(String(a[0]), String(a[1])); return 1;
        case "HINCRBY": { const v = Number(hs(key).get(String(a[0])) ?? 0) + Number(a[1]); hs(key).set(String(a[0]), String(v)); return v; }
        case "EXPIRE": return 1;
        case "HSETNX": if (hs(key).has(String(a[0]))) return 0; hs(key).set(String(a[0]), String(a[1])); return 1;
        case "ZINCRBY": zs(key).set(String(a[1]), (zs(key).get(String(a[1])) ?? 0) + Number(a[0])); return String(zs(key).get(String(a[1])));
        case "ZADD": { const gt = a[0] === "GT"; const [s, m] = gt ? a.slice(1) : a; const cur = zs(key).get(String(m)); if (!gt || cur === undefined || Number(s) > cur) zs(key).set(String(m), Number(s)); return 1; }
        case "ZREMRANGEBYRANK": { const asc = [...zs(key)].sort((x, y) => x[1] - y[1]); const keep = asc.slice(-200); z.set(key, new Map(keep)); return 0; }
        case "ZREVRANGE": { const r = rev(key).slice(Number(a[0]), Number(a[1]) + 1); return a[2] ? r.flatMap(([m, s]) => [m, String(s)]) : r.map(([m]) => m); }
        case "HMGET": return a.map((f) => hs(key).get(String(f)) ?? null);
        case "ZMSCORE": return a.map((m) => { const v = zs(key).get(String(m)); return v === undefined ? null : String(v); });
        default: throw new Error(`unknown ${c}`);
      }
    });
  };
  return { pipe, z, h, get cmds() { return cmds; }, get calls() { return calls; } };
}

test("R10 strips emails, phones, addresses, URLs and handles (drops the prompt)", () => {
  for (const bad of ["bookshelf for jane@example.com", "call 555-123-4567 desk", "desk +1 (212) 555 0199", "shelf for 1600 Pennsylvania Ave", "bench at 42 Oak Street", "PO Box 123 birdhouse", "see https://x.co/a shelf", "planter yard.wiki/xyz", "desk for @someone", "crate 12345-6789"])
    assert.equal(stripPii(bad), null, bad);
  for (const ok of ["bookshelf 36 wide 72 tall", "corner shelf, 24 inches along each wall, 60 tall", "2x4 workbench 60 x 24 x 36", "lemonade stand 60 wide 36 deep"])
    assert.equal(stripPii(ok), ok, ok);
});

test("F33 standalone 5-digit numbers (ZIP codes) are dropped; sizes and 4-digit years are kept", () => {
  for (const bad of ["planter 90210", "90210 planter", "bench for 10001-1234", "shelf in zip 02139"]) assert.equal(safePrompt(bad), null, bad);
  for (const ok of ["planter 24 x 12 x 10", "bookshelf 1950s style", "desk 2026", "shelf 36 1/2 wide", "box 12.5 x 10"]) assert.equal(safePrompt(ok), ok, ok);
});

test("F33 offensive filter matches whole words: cockatoo, Dickens, Scunthorpe, skill, cocktail pass", () => {
  for (const ok of ["cockatoo perch", "Dickens bookshelf", "Scunthorpe bench", "skill saw table", "cocktail cabinet", "spice rack", "kiln shelf", "shitake log rack", "bass guitar stand", "sussex chicken coop"]) {
    assert.equal(isOffensive(ok), false, ok);
    assert.equal(safePrompt(ok), ok, ok);
  }
  for (const bad of ["shits box", "fucking shelf", "cocks rack"]) assert.ok(isOffensive(bad), bad);
});

test("R11 offensive filter folds leetspeak and keeps woodworking words", () => {
  for (const bad of ["fuck shelf", "sh1t box", "f.u.c.k bench", "N4zi stand", "b!tch rack"]) assert.ok(isOffensive(bad) || safePrompt(bad) === null, bad);
  for (const ok of ["cocktail cabinet", "spice rack", "skill saw bench", "cockpit desk", "kiln shelf"]) assert.equal(isOffensive(ok), false, ok);
});

test("R4 1,000 repeats (concurrent) are one row with count 1000, within 10 s coalescing", async () => {
  const r = fakeRedis();
  const held: Promise<unknown>[] = [];
  const s = new IdeaStore(r.pipe, undefined, (p) => held.push(p), async () => {});
  const rec = { key: logKey("bookshelf", "builtin:bookshelf", "36×12×72"), prompt: "bookshelf", size: "36×12×72", resultKey: "builtin:bookshelf", status: "Trusted" as const };
  const t0 = Date.parse("2026-10-15T12:00:00Z");
  await Promise.all(Array.from({ length: 1000 }, (_, i) => s.record(rec, new Date(t0 + i * 25))));
  await Promise.all(held);
  await s.record(rec, new Date(t0 + 60_000));
  await Promise.all(held);
  assert.equal(r.h.get("ideas:meta")!.size, 1);
  assert.equal(r.z.get("ideas:top")!.get(rec.key), 1001);
  assert.ok(r.calls < 10, `coalesced into few writes (got ${r.calls})`);
});

test("R5 status only moves up; Failed never shows; Popular is Trusted only", async () => {
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe);
  const mk = (p: string, st: "Trusted" | "Unverified" | "Failed") => ({ key: logKey(p, "k", ""), prompt: p, size: "", resultKey: `x:${p}`, status: st });
  const t = Date.parse("2026-10-15T12:00:00Z");
  await s.record(mk("beehive box", "Unverified"), new Date(t));
  await s.record(mk("beehive box", "Failed"), new Date(t + 20_000));
  await s.record(mk("broken thing", "Failed"), new Date(t + 40_000));
  for (let i = 0; i < 3; i++) await s.record(mk("bookshelf", "Trusted"), new Date(t + 60_000 + i * 20_000));
  const snap = await s.snapshot(new Date(t + 200_000));
  assert.deepEqual(snap.rows.map((x) => [x.prompt, x.status]).sort(), [["beehive box", "Unverified"], ["bookshelf", "Trusted"]]);
  assert.deepEqual(snap.popular.map((x) => x.prompt), ["bookshelf"]);
  assert.ok(snap.recent.every((x) => x.prompt !== "broken thing"));
});

test("budget guard stops before the 500K free tier and never throws", async () => {
  assert.ok(BUDGET < FREE_TIER);
  const r = fakeRedis();
  const s = new IdeaStore(r.pipe, new Budget(WRITE_CMDS * 3));
  const t = Date.parse("2026-10-15T12:00:00Z");
  const out = [];
  for (let i = 0; i < 6; i++) out.push(await s.record({ key: `k${i}`, prompt: `p${i}`, size: "", resultKey: "x", status: "Trusted" }, new Date(t + i)));
  assert.deepEqual(out, ["written", "written", "written", "over-budget", "over-budget", "over-budget"]);
  assert.ok(r.cmds <= WRITE_CMDS * 3);
  // The counter lives in Redis, so a fresh instance learns the month's total from the first reply.
  const b = new Budget(BUDGET); b.allows(1, new Date(t)); b.saw(BUDGET); assert.equal(b.allows(WRITE_CMDS, new Date(t)), false);
  assert.equal(b.allows(WRITE_CMDS, new Date("2026-11-01T00:00:00Z")), true, "resets next month");
  // A failing store drops the write.
  const boom = new IdeaStore(async () => { throw new Error("down"); });
  assert.equal(await boom.record({ key: "a", prompt: "a b", size: "", resultKey: "x", status: "Trusted" }), "dropped");
  assert.equal((await boom.snapshot()).rows.length, 0);
});

test("no env → no-op store; previews and CI work without it", async () => {
  assert.equal(storeEnv({}), null);
  assert.equal(restPipe(null), null);
  assert.deepEqual(storeEnv({ KV_REST_API_URL: "https://x.upstash.io/", KV_REST_API_TOKEN: "t" }), { url: "https://x.upstash.io", token: "t" });
  const s = new IdeaStore(null);
  assert.equal(await s.record({ key: "a", prompt: "a", size: "", resultKey: "x", status: "Trusted" }), "off");
  assert.equal((await s.snapshot()).live, false);
});

test("a rejected pipeline command logs one warning with only its name and key prefix", async () => {
  const realFetch = globalThis.fetch, realWarn = console.warn;
  const warned: unknown[][] = [];
  const secretUrl = "https://secret-host-zz.upstash.io", token = "tok_SECRET_zz";
  globalThis.fetch = (async () => new Response(JSON.stringify([{ result: 1 }, { error: "ERR unknown command 'HEXPIRE' secret-value prompt text" }, { result: 3 }]), { status: 200 })) as typeof fetch;
  console.warn = (...a: unknown[]) => { warned.push(a); };
  try {
    const pipe = restPipe({ url: secretUrl, token })!;
    const out = await pipe([["HINCRBY", "ideas:ptest", "kitchen-island-48", 1], ["HEXPIRE", "ideas:ptest", 7344000, "FIELDS", 1, "kitchen-island-48"], ["HGET", "ideas:meta", "kitchen-island-48"]]);
    assert.deepEqual(out, [1, null, 3], "the rest of the pipeline still applies");
    assert.equal(warned.length, 1, "exactly one warning");
    assert.deepEqual(warned[0], ["[ideas] store rejected HEXPIRE ideas:ptest"]);
    const line = String(warned[0][0]);
    for (const leak of ["kitchen", "7344000", "FIELDS", "secret", "SECRET", "tok_", "upstash", "unknown command", "prompt"]) assert.ok(!line.includes(leak), `no ${leak}`);
    // No warning when nothing is rejected.
    globalThis.fetch = (async () => new Response(JSON.stringify([{ result: 1 }]), { status: 200 })) as typeof fetch;
    await pipe([["GET", "ideas:snap"]]);
    assert.equal(warned.length, 1);
  } finally { globalThis.fetch = realFetch; console.warn = realWarn; }
  // Keys keep at most two plain segments; anything else is "?".
  assert.equal(rejectedLine(["ZREM", "ideas:burst:29512345", "x"]), "[ideas] store rejected ZREM ideas:burst");
  assert.equal(rejectedLine(["HSET", "User Prompt: 48 wide", "x"]), "[ideas] store rejected HSET ?");
  assert.equal(rejectedLine(["evil cmd; rm", "ideas:meta"]), "[ideas] store rejected ? ideas:meta");
  assert.equal(rejectedLine(undefined), "[ideas] store rejected ? ?");
});

test("server decides status from the engine (no client Trusted), unknown noun is Unverified, no xAI", async () => {
  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async () => { fetches++; throw new Error("no network in this test"); }) as typeof fetch;
  try {
    const shelf = await recordFromPrompt("bookshelf 36 wide 72 tall");
    assert.equal(shelf?.status, "Trusted");
    assert.match(shelf!.resultKey, /^builtin:/);
    assert.match(shelf!.size, /^36×\d+×72$/);
    const odd = await recordFromPrompt("zorbleflap");
    assert.notEqual(odd?.status, "Trusted");
    assert.equal(await recordFromPrompt("desk for bob@example.com"), null);
    assert.equal(fetches, 0, "no network (xAI) call");
  } finally { globalThis.fetch = realFetch; }
});

test("R8 search spans prompt and result key, Trusted first; trustedPopular drops Unverified", () => {
  const rows: SnapshotRow[] = [
    { key: "1", prompt: "garden bench", size: "", resultKey: "recipe:garden-bench", status: "Unverified", count: 50 },
    { key: "2", prompt: "2x4 bench 48 wide", size: "", resultKey: "builtin:bench", status: "Trusted", count: 3 },
    { key: "3", prompt: "bookshelf", size: "", resultKey: "builtin:bookshelf", status: "Trusted", count: 9 },
  ];
  assert.deepEqual(searchLog(rows, "bench").map((r) => r.key), ["2", "1"]);
  assert.deepEqual(trustedPopular(rows).map((r) => r.key), ["3", "2"]);
});

test("F36: snapshot reads are memoised and a rebuild happens at most once per 10 min across instances", async () => {
  const r = fakeRedisWithStrings();
  const t = Date.parse("2026-10-15T12:00:00Z");
  const a = new IdeaStore(r.pipe), b = new IdeaStore(r.pipe), c = new IdeaStore(r.pipe);
  await a.record({ key: "k1", prompt: "bookshelf", size: "", resultKey: "builtin:bookshelf", status: "Trusted" }, new Date(t));
  const before = r.calls;
  // 300 hits in the window, spread over three cold instances (any query string: the handler never reads it).
  for (let i = 0; i < 300; i++) await [a, b, c][i % 3].served(new Date(t + i * 1000));
  assert.equal(a.rebuilds + b.rebuilds + c.rebuilds, 1, "one rebuild");
  assert.ok(r.calls - before <= 3 * 1 + 3, `store calls ${r.calls - before}`);
  const s1 = await b.served(new Date(t + 299_000));
  assert.deepEqual(s1.rows.map((x) => x.prompt), ["bookshelf"]);
  // After the window a new rebuild is allowed, still only one.
  r.expire();
  for (let i = 0; i < 30; i++) await [a, b, c][i % 3].served(new Date(t + 601_000 + i * 1000));
  assert.equal(a.rebuilds + b.rebuilds + c.rebuilds, 2);
  assert.equal((await new IdeaStore(null).served()).live, false);
});

/** fakeRedis plus GET/SET (NX, EX) for the snapshot cache and lock. */
function fakeRedisWithStrings() {
  const base = fakeRedis();
  const str = new Map<string, string>();
  let calls = 0;
  const pipe: Pipe = async (list) => {
    calls++;
    const out: unknown[] = [];
    for (const cmd of list) {
      const [c, k, v, ...rest] = cmd;
      if (c === "GET") out.push(str.get(String(k)) ?? null);
      else if (c === "SET") { if (rest.includes("NX") && str.has(String(k))) out.push(null); else { str.set(String(k), String(v)); out.push("OK"); } }
      else out.push(...((await base.pipe([cmd])) ?? []));
    }
    return out;
  };
  return { pipe, get calls() { return calls; }, expire: () => { str.delete("ideas:snap:lock"); } };
}

test("F34: a burst's held count is written when its 10 s window ends, with no trailing request", async () => {
  const r = fakeRedis();
  const held: Promise<unknown>[] = [];
  let fire: () => void = () => {};
  const s = new IdeaStore(r.pipe, undefined, (p) => held.push(p), () => new Promise<void>((res) => { fire = res; }));
  const rec = { key: "burst", prompt: "critic probe bench", size: "", resultKey: "builtin:bench", status: "Trusted" as const };
  const t = Date.parse("2026-10-15T12:00:00Z");
  for (let i = 0; i < 50; i++) await s.record(rec, new Date(t + i * 100));
  assert.equal(held.length, 1, "one flush scheduled per window");
  assert.equal(r.z.get("ideas:top")!.get("burst"), 1, "only the first write so far");
  fire(); // the window ends
  await Promise.all(held);
  assert.equal(r.z.get("ideas:top")!.get("burst"), 50);
  // A later request after the window does not double count.
  await s.record(rec, new Date(t + 30_000));
  await Promise.all(held);
  assert.equal(r.z.get("ideas:top")!.get("burst"), 51);
});

test("F35: an unknown noun gets an unknown:<noun> key, never builtin:", async () => {
  const z = await recordFromPrompt("zorbleflap");
  assert.match(z!.resultKey, /^unknown:/);
  assert.equal(z!.status, "Unverified");
  assert.match((await recordFromPrompt("bookshelf 36 wide 72 tall"))!.resultKey, /^builtin:/);
});

test("loosened filter: harmless numbers and words pass, real PII still drops", () => {
  for (const ok of ["6 place settings", "table for 6 place settings", "36 72 12 16", "10000 btu cabinet", "shelf 24 36 48 60", "12 pl shelf"]) assert.equal(safePrompt(ok), ok, ok);
  for (const bad of ["call 555-1234", "212.555.0199 desk", "2125550199 shelf", "+44 20 7946 0958 bench", "12 Elm Place bench", "planter 90210"]) assert.equal(safePrompt(bad), null, bad);
});

test("a bare w or k after a 5-digit number is not a unit: the ZIP is never stored", async () => {
  for (const bad of ["planter 10001 w", "planter 10001 W", "bench 90210 k", "shelf 10001 wide"]) assert.equal(safePrompt(bad), null, bad);
  assert.equal(safePrompt("10000 btu cabinet"), "10000 btu cabinet");
  assert.equal(await recordFromPrompt("planter 10001 w"), null);
});

// ---- Write-time stamp (ideas:stamp): request time + source from the offline/local/test gate only ------------------
const STAMP_T = new Date("2026-10-17T09:15:00.000Z");
function stampSetup() {
  const r = fakeRedis();
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const rec = (p: string) => ({ key: `k-${p}`, prompt: p, size: "36×12×72", resultKey: "builtin:bookcase", status: "Trusted" as const });
  const post = (url: string, headers: Record<string, string> = {}, env: Record<string, string> = {}) =>
    handleIdeasLog(new Request(url, { method: "POST", body: JSON.stringify({ prompt: "bookcase 36 wide" }), headers }),
      { recordFromPrompt: async (p: string) => rec(p), store: () => store, env, now: () => STAMP_T });
  return { r, store, post, stamps: () => r.h.get("ideas:stamp") ?? new Map<string, string>() };
}

test("stamp: a live write HSETs ideas:stamp with {at: request time, source: 'live'}", async () => {
  const { post, stamps } = stampSetup();
  assert.equal((await post("https://yard.wiki/api/ideas-log")).status, 204);
  assert.equal(stamps().size, 1);
  assert.deepEqual(JSON.parse(stamps().get("k-bookcase 36 wide")!), { at: STAMP_T.toISOString(), source: "live" });
});

test("stamp: test traffic writes nothing, no stamp either (offline/local/test query, x-yard-test, referer, preview env)", async () => {
  const { r, post, stamps } = stampSetup();
  await post("https://yard.wiki/api/ideas-log?offline=1");
  await post("https://yard.wiki/api/ideas-log?local=1");
  await post("https://yard.wiki/api/ideas-log?test=1");
  await post("https://yard.wiki/api/ideas-log", { "x-yard-test": "1" });
  await post("https://yard.wiki/api/ideas-log", { referer: "https://yard.wiki/ideas?offline=1" });
  await post("https://yard.wiki/api/ideas-log", {}, { VERCEL_ENV: "preview" });
  assert.equal(stamps().size, 0, "no stamp");
  assert.equal(r.h.get("ideas:meta")?.size ?? 0, 0, "no meta");
  assert.equal(r.z.get("ideas:top")?.size ?? 0, 0, "no count");
});

test("stamp: toStamp maps missing, broken and wrong-source values to {at: null, source: 'unknown'}", () => {
  const unknown = { at: null, source: "unknown" };
  for (const raw of [null, undefined, "", "{not json", "null", "42", JSON.stringify({ at: "yesterday", source: "admin" }), JSON.stringify({ source: "admin" }), JSON.stringify({ at: 5, source: 7 })])
    assert.deepEqual(toStamp(raw), unknown, String(raw));
  assert.deepEqual(toStamp(JSON.stringify({ at: "2026-10-17T09:15:00.000Z", source: "live" })), { at: "2026-10-17T09:15:00.000Z", source: "live" });
  assert.deepEqual(toStamp(JSON.stringify({ at: "2026-10-17T09:15:00.000Z", source: "admin" })), { at: "2026-10-17T09:15:00.000Z", source: "unknown" });
});

test("stamp: snapshot rows carry at and source (stamped rows pass through, old rows read unknown)", async () => {
  const { r, store, post } = stampSetup();
  await post("https://yard.wiki/api/ideas-log");
  // A row written before stamps existed: meta, status and count, no stamp.
  r.h.get("ideas:meta")!.set("old", JSON.stringify({ prompt: "plant stand", size: "12×12×30", resultKey: "builtin:plant-stand" }));
  r.z.get("ideas:status")!.set("old", 2);
  r.z.get("ideas:top")!.set("old", 3);
  const snap = await store.snapshot(STAMP_T);
  const live = snap.rows.find((x) => x.key === "k-bookcase 36 wide")!;
  const old = snap.rows.find((x) => x.key === "old")!;
  assert.deepEqual([live.at, live.source], [STAMP_T.toISOString(), "live"]);
  assert.deepEqual([old.at, old.source], [null, "unknown"]);
  for (const row of [...snap.rows, ...snap.recent, ...snap.popular]) assert.ok("at" in row && "source" in row, row.key);
});
