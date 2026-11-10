/**
 * A size the engine refuses built nothing. recordFromPrompt used to log it as a Trusted idea
 * at the typed size ("bookcase 2 wide" → Trusted 2×12×84). A refusal is Failed with no size,
 * and Failed never appears in the Ideas log. A size that builds is still logged.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { handleIdeasLog } from "./ideaLogHandler.ts";
import { IdeaStore, recordFromPrompt, type Pipe } from "./ideaLog.server.ts";

function memory(): { pipe: Pipe } {
  const h = new Map<string, Map<string, string>>(),
    z = new Map<string, Map<string, number>>(),
    kv = new Map<string, number>();
  const zs = (k: string) => z.get(k) ?? z.set(k, new Map()).get(k)!;
  const hs = (k: string) => h.get(k) ?? h.set(k, new Map()).get(k)!;
  const rev = (k: string) => [...zs(k)].sort((a, b) => b[1] - a[1]);
  const pipe: Pipe = async (list) =>
    list.map(([c, k, ...a]) => {
      const key = String(k);
      switch (c) {
        case "INCRBY":
          kv.set(key, (kv.get(key) ?? 0) + Number(a[0]));
          return kv.get(key);
        case "HSET":
          hs(key).set(String(a[0]), String(a[1]));
          return 1;
        case "HINCRBY": {
          const v = Number(hs(key).get(String(a[0])) ?? 0) + Number(a[1]);
          hs(key).set(String(a[0]), String(v));
          return v;
        }
        case "EXPIRE":
          return 1;
        case "ZINCRBY":
          zs(key).set(String(a[1]), (zs(key).get(String(a[1])) ?? 0) + Number(a[0]));
          return String(zs(key).get(String(a[1])));
        case "ZADD": {
          const gt = a[0] === "GT";
          const [s, m] = gt ? a.slice(1) : a;
          const cur = zs(key).get(String(m));
          if (!gt || cur === undefined || Number(s) > cur) zs(key).set(String(m), Number(s));
          return 1;
        }
        case "ZREMRANGEBYSCORE": {
          const hi = Number(a[1]);
          for (const [m, sc] of zs(key)) if (sc <= hi) zs(key).delete(m);
          return 0;
        }
        case "ZREVRANGE": {
          const r = rev(key).slice(Number(a[0]), Number(a[1]) + 1);
          return a[2] ? r.flatMap(([m, s]) => [m, String(s)]) : r.map(([m]) => m);
        }
        case "HMGET":
          return a.map((f) => hs(key).get(String(f)) ?? null);
        case "ZMSCORE":
          return a.map((m) => {
            const v = zs(key).get(String(m));
            return v === undefined ? null : String(v);
          });
        default:
          throw new Error(`unknown ${c}`);
      }
    });
  return { pipe };
}

test("a refused prompt is not logged; a bookcase that builds still is", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  try {
    const refused = await recordFromPrompt("bookcase 2 wide");
    assert.equal(refused?.status, "Failed");
    assert.equal(refused?.size, "");
    assert.equal(refused?.resultKey, "refused");

    const built = await recordFromPrompt("bookcase 36 wide 12 deep 72 tall");
    assert.equal(built?.status, "Trusted");
    assert.equal(built?.size, "36×12×72");
    assert.match(built?.resultKey ?? "", /^builtin:/);

    const store = new IdeaStore(
      memory().pipe,
      undefined,
      () => {},
      async () => {},
    );
    const now = new Date("2026-11-10T12:00:00.000Z");
    const post = (prompt: string) =>
      handleIdeasLog(
        new Request("https://yard.wiki/api/ideas-log", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        }),
        { recordFromPrompt, store: () => store, env: {}, now: () => now },
      );
    assert.equal((await post("bookcase 2 wide")).status, 204);
    assert.equal((await post("bookcase 36 wide 12 deep 72 tall")).status, 204);
    const snap = await store.snapshot(now);
    const prompts = [...snap.rows, ...snap.recent, ...snap.popular].map((r) => r.prompt);
    assert.equal(prompts.includes("bookcase 2 wide"), false);
    assert.deepEqual(
      snap.rows.map((r) => [r.prompt, r.size, r.status]),
      [["bookcase 36 wide 12 deep 72 tall", "36×12×72", "Trusted"]],
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
