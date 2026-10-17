// Ideas log rows are stamped at write time: the request time and a source flag from the offline/local/test gate
// only (never IP, user agent or cookie). Rows written before stamps read "unknown"; the serve path passes them through.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IdeaStore, WRITE_CMDS, type Pipe } from "../src/lib/yard/ideaLog.server";
import { handleIdeasLog } from "../src/lib/yard/ideaLogHandler";
import type { LogRecord } from "../src/lib/yard/ideaLog";

/** Just enough Redis for the store's pipelines. */
function fakeRedis() {
  const h = new Map<string, Map<string, string>>(), z = new Map<string, Map<string, number>>();
  const hs = (k: string) => (h.get(k) ?? h.set(k, new Map()).get(k)!);
  const zs = (k: string) => (z.get(k) ?? z.set(k, new Map()).get(k)!);
  const pipe: Pipe = async (list) => list.map(([c, k, ...a]) => {
    const key = String(k);
    switch (c) {
      case "INCRBY": return 1;
      case "HSET": hs(key).set(String(a[0]), String(a[1])); return 1;
      case "HSETNX": if (hs(key).has(String(a[0]))) return 0; hs(key).set(String(a[0]), String(a[1])); return 1;
      case "ZINCRBY": zs(key).set(String(a[1]), (zs(key).get(String(a[1])) ?? 0) + Number(a[0])); return 1;
      case "ZADD": { const gt = a[0] === "GT"; const [s, m] = gt ? a.slice(1) : a; const cur = zs(key).get(String(m)); if (!gt || cur === undefined || Number(s) > cur) zs(key).set(String(m), Number(s)); return 1; }
      case "ZREMRANGEBYRANK": return 0;
      case "ZREVRANGE": { const r = [...zs(key)].sort((x, y) => y[1] - x[1]).slice(Number(a[0]), Number(a[1]) + 1); return r.flatMap(([m, s]) => [m, String(s)]); }
      case "HMGET": return a.map((f) => hs(key).get(String(f)) ?? null);
      case "ZMSCORE": return a.map((m) => { const v = zs(key).get(String(m)); return v === undefined ? null : String(v); });
      default: throw new Error(`unknown ${c}`);
    }
  });
  return { pipe, h, z, hs, zs };
}

const T = new Date("2026-10-17T09:15:00.000Z");
const rec = (prompt: string): LogRecord => ({ key: `k-${prompt}`, prompt, size: "36×12×72", resultKey: "builtin:bookcase", status: "Trusted" });
function setup() {
  const r = fakeRedis();
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const deps = { recordFromPrompt: async (p: string) => rec(p), store: () => store, env: {}, now: () => T };
  const post = (url: string, headers: Record<string, string> = {}, env: Record<string, string> = {}, prompt = "bookcase 36 wide") =>
    handleIdeasLog(new Request(url, { method: "POST", body: JSON.stringify({ prompt }), headers }), { ...deps, env });
  return { r, store, post };
}

test("a real write stores the request time and source 'live'; the snapshot passes them through", async () => {
  const { r, store, post } = setup();
  assert.equal((await post("https://yard.wiki/api/ideas-log")).status, 204);
  assert.deepEqual(JSON.parse(r.hs("ideas:stamp").get("k-bookcase 36 wide")!), { at: T.toISOString(), source: "live" });
  const row = (await store.snapshot(T)).rows.find((x) => x.key === "k-bookcase 36 wide")!;
  assert.equal(row.at, T.toISOString());
  assert.equal(row.source, "live");
});

test("test traffic (offline/local/test query, x-yard-test, test referer, preview env) is still never written", async () => {
  const { r, post } = setup();
  await post("https://yard.wiki/api/ideas-log?offline=1");
  await post("https://yard.wiki/api/ideas-log?test=1");
  await post("https://yard.wiki/api/ideas-log", { "x-yard-test": "1" });
  await post("https://yard.wiki/api/ideas-log", { referer: "https://yard.wiki/?local=1" });
  await post("https://yard.wiki/api/ideas-log", {}, { VERCEL_ENV: "preview" });
  assert.equal(r.hs("ideas:stamp").size, 0);
  assert.equal(r.hs("ideas:meta").size, 0);
});

test("the stamp is the latest write's request time", async () => {
  const { r, store } = setup();
  await store.record({ ...rec("shoe rack"), source: "live" }, new Date("2026-10-17T08:00:00Z"));
  await store.record({ ...rec("shoe rack"), source: "live" }, new Date("2026-10-17T08:30:00Z")); // past the 10 s coalesce window
  assert.equal(JSON.parse(r.hs("ideas:stamp").get("k-shoe rack")!).at, "2026-10-17T08:30:00.000Z");
});

test("rows written before stamps, or with an unreadable stamp, show 'unknown' with no time", async () => {
  const { r, store } = setup();
  // An old row: meta, status and count, but no stamp (as written before this change).
  r.hs("ideas:meta").set("old", JSON.stringify({ prompt: "plant stand", size: "12×12×30", resultKey: "builtin:plant-stand" }));
  r.zs("ideas:status").set("old", 2); r.zs("ideas:top").set("old", 4);
  r.hs("ideas:meta").set("bad", JSON.stringify({ prompt: "tool tote", size: "18×8×10", resultKey: "builtin:tote" }));
  r.zs("ideas:status").set("bad", 2); r.zs("ideas:top").set("bad", 1);
  r.hs("ideas:stamp").set("bad", "{not json");
  r.hs("ideas:meta").set("odd", JSON.stringify({ prompt: "step stool", size: "16×12×9", resultKey: "builtin:stool" }));
  r.zs("ideas:status").set("odd", 2); r.zs("ideas:top").set("odd", 1);
  r.hs("ideas:stamp").set("odd", JSON.stringify({ at: "yesterday", source: "admin" }));
  const rows = (await store.snapshot(T)).rows;
  for (const k of ["old", "bad", "odd"]) {
    const row = rows.find((x) => x.key === k)!;
    assert.equal(row.source, "unknown", k);
    assert.equal(row.at, null, k);
  }
});

test("write budget counts the stamp command", () => {
  assert.equal(WRITE_CMDS, 7);
});

test("no visitor identity: the write and serve paths read no IP, user agent or cookie; the serve route adds nothing", () => {
  const strip = (f: string) => fs.readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  for (const f of ["src/lib/yard/ideaLogHandler.ts", "src/lib/yard/ideaLog.server.ts", "src/routes/api/ideas-snapshot.ts", "src/routes/api/ideas-log.ts"])
    assert.doesNotMatch(strip(f), /user-?agent|x-forwarded|x-real-ip|cf-connecting|\bip\b|cookie/i, f);
  assert.match(strip("src/routes/api/ideas-snapshot.ts"), /Response\.json\(snap,/, "serve path passes the stored snapshot through");
});
