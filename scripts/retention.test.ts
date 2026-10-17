// 90-day retention, SWE's design: ideas:recent is trimmed by time on every write; a daily cron sweep drops every row
// whose last-seen (recent score or stamp time; LEGACY_SINCE if neither) is past RETAIN_DAYS from ideas:meta, top,
// status, stamp, recent and review together (no orphans), capped by a batch size and a max-commands limit; the
// feedback store keeps its tail trim and the cron runs it too, so a quiet spell keeps nothing. /api/cron/retention and
// /api/critic-review answer 404 to a missing or wrong secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Budget, IdeaStore, LEGACY_SINCE, RETAIN_DAYS, RETAIN_MS, SWEEP_BATCH, SWEEP_MAX_CMDS, WRITE_CMDS, lastSeen, type Pipe } from "../src/lib/yard/ideaLog.server";
import { logKey, type LogRecord } from "../src/lib/yard/ideaLog";
import { ShopStore, FEEDBACK_DAYS } from "../src/lib/feedback/store.server";
import { cleanFeedback } from "../src/lib/feedback/shop";

const DAY = 86_400_000;
type Cmd = (string | number)[];

/** Redis with expiry: per key (EXPIRE/EXPIREAT/SET EX) and per hash field (HSETEX/HEXPIREAT), read lazily on a clock. */
function ttlRedis(clock: { now: number }) {
  const h = new Map<string, Map<string, { v: string; exp?: number }>>();
  const z = new Map<string, Map<string, number>>();
  const l = new Map<string, string[]>();
  const str = new Map<string, string>();
  const kexp = new Map<string, number>();
  const sent: Cmd[][] = [];
  const violations: string[] = [];
  const gone = (k: string) => { const e = kexp.get(k); if (e !== undefined && e <= clock.now) { h.delete(k); z.delete(k); l.delete(k); str.delete(k); kexp.delete(k); } };
  const hs = (k: string) => { gone(k); const m = h.get(k) ?? h.set(k, new Map()).get(k)!; for (const [f, x] of m) if (x.exp !== undefined && x.exp <= clock.now) m.delete(f); return m; };
  const zs = (k: string) => { gone(k); return z.get(k) ?? z.set(k, new Map()).get(k)!; };
  const ls = (k: string) => { gone(k); return l.get(k) ?? l.set(k, []).get(k)!; };
  const at = (secs: number) => secs * 1000;
  const exec = ([c, k0, ...a]: Cmd): unknown => {
    const k = String(k0);
    switch (c) {
      case "INCRBY": case "INCR": { gone(k); const v = Number(str.get(k) ?? 0) + (c === "INCR" ? 1 : Number(a[0])); str.set(k, String(v)); return v; }
      case "GET": gone(k); return str.get(k) ?? null;
      case "SET": { gone(k); if (a.includes("NX") && str.has(k)) return null; str.set(k, String(a[0])); const ex = a.indexOf("EX"); if (ex >= 0) kexp.set(k, clock.now + Number(a[ex + 1]) * 1000); else kexp.delete(k); return "OK"; }
      case "EXPIRE": gone(k); if (!h.has(k) && !z.has(k) && !l.has(k) && !str.has(k)) return 0; kexp.set(k, clock.now + Number(a[0]) * 1000); return 1;
      case "EXPIREAT": gone(k); if (!h.has(k) && !z.has(k) && !l.has(k) && !str.has(k)) return 0; kexp.set(k, at(Number(a[0]))); gone(k); return 1;
      case "HSET": { const m = hs(k); for (let i = 0; i < a.length; i += 2) m.set(String(a[i]), { v: String(a[i + 1]) }); return 1; }
      case "HSETNX": { const m = hs(k); if (m.has(String(a[0]))) return 0; m.set(String(a[0]), { v: String(a[1]) }); return 1; }
      case "HSETEX": {
        const m = hs(k); const i = a.indexOf("FIELDS"); const opts = a.slice(0, i).map(String); const n = Number(a[i + 1]);
        const pairs = Array.from({ length: n }, (_, j) => [String(a[i + 2 + 2 * j]), String(a[i + 3 + 2 * j])] as const);
        if (opts.includes("FNX") && pairs.some(([f]) => m.has(f))) return 0;
        const ex = opts.indexOf("EX");
        for (const [f, v] of pairs) {
          const keep = opts.includes("KEEPTTL") ? m.get(f)?.exp : undefined;
          if (opts.includes("KEEPTTL") && keep === undefined) violations.push(`HSETEX KEEPTTL on ${k}/${f} with no TTL`);
          m.set(f, { v, exp: ex >= 0 ? clock.now + Number(opts[ex + 1]) * 1000 : keep });
        }
        return 1;
      }
      case "HINCRBY": { const m = hs(k); const v = Number(m.get(String(a[0]))?.v ?? 0) + Number(a[1]); m.set(String(a[0]), { ...m.get(String(a[0])), v: String(v) }); return v; }
      case "HMGET": { const m = hs(k); return a.map((f) => m.get(String(f))?.v ?? null); }
      case "HGET": return hs(k).get(String(a[0]))?.v ?? null;
      case "HEXISTS": return hs(k).has(String(a[0])) ? 1 : 0;
      case "HKEYS": return [...hs(k).keys()];
      case "HDEL": { const m = hs(k); let n = 0; for (const f of a) if (m.delete(String(f))) n++; return n; }
      case "HRANDFIELD": return [...hs(k).keys()].slice(0, Number(a[0]));
      case "HEXPIREAT": {
        const m = hs(k); const i = a.indexOf("FIELDS"); const nx = a.slice(0, i).includes("NX"); const when = at(Number(a[0]));
        return a.slice(i + 2).map((f0) => { const f = String(f0); const x = m.get(f); if (!x) return -2; if (nx && x.exp !== undefined) return 0; if (when <= clock.now) { m.delete(f); return 2; } x.exp = when; return 1; });
      }
      case "ZINCRBY": { const m = zs(k); m.set(String(a[1]), (m.get(String(a[1])) ?? 0) + Number(a[0])); return m.get(String(a[1])); }
      case "ZADD": { const m = zs(k); const gt = a[0] === "GT"; const [s, mem] = gt ? a.slice(1) : a; const cur = m.get(String(mem)); if (!gt || cur === undefined || Number(s) > cur) m.set(String(mem), Number(s)); return 1; }
      case "ZREMRANGEBYRANK": { const asc = [...zs(k)].sort((x, y) => x[1] - y[1]); const keep = asc.slice(-(Number(a[1]) * -1 - 1)); z.set(k, new Map(keep)); return asc.length - keep.length; }
      case "ZREVRANGE": { const r = [...zs(k)].sort((x, y) => y[1] - x[1]).slice(Number(a[0]), Number(a[1]) + 1); return a.includes("WITHSCORES") ? r.flatMap(([m, s]) => [m, String(s)]) : r.map(([m]) => m); }
      case "ZRANGE": { const r = [...zs(k)].sort((x, y) => x[1] - y[1]); return a.includes("WITHSCORES") ? r.flatMap(([m, s]) => [m, String(s)]) : r.map(([m]) => m); }
      case "ZMSCORE": { const m = zs(k); return a.map((x) => (m.has(String(x)) ? String(m.get(String(x))) : null)); }
      case "ZREMRANGEBYSCORE": { const m = zs(k); const lo = a[0] === "-inf" ? -Infinity : Number(a[0]); const hi = Number(a[1]); let n = 0; for (const [x, sc] of m) if (sc >= lo && sc <= hi) { m.delete(x); n++; } return n; }
      case "ZSCAN": { const m = zs(k); const cur = String(a[0]); const count = Number(a[a.indexOf("COUNT") + 1] ?? 10); const all = [...m.keys()].sort().filter((x) => cur === "0" || x > cur); const page = all.slice(0, count); const next = all.length > count ? page[page.length - 1] : "0"; return [next, page.flatMap((x) => [x, String(m.get(x))])]; }
      case "DEL": { gone(k); const had = h.delete(k) || z.delete(k) || l.delete(k) || str.delete(k); kexp.delete(k); return had ? 1 : 0; }
      case "LTRIM": { const L = ls(k); const i = (n: number) => (n < 0 ? L.length + n : n); l.set(k, L.slice(Math.max(0, i(Number(a[0]))), Math.max(0, i(Number(a[1])) + 1))); return "OK"; }
      case "ZREM": { const m = zs(k); let n = 0; for (const x of a) if (m.delete(String(x))) n++; return n; }
      case "LPUSH": { const L = ls(k); L.unshift(...a.map(String)); return L.length; }
      case "LRANGE": { const L = ls(k); const i = (n: number) => (n < 0 ? L.length + n : n); return L.slice(Math.max(0, i(Number(a[0]))), i(Number(a[1])) + 1); }
      default: throw new Error(`fake: unknown ${c}`);
    }
  };
  const pipe: Pipe = async (list) => { sent.push(list); return list.map(exec); };
  /** Every readable value that can hold typed text right now, with where it lives. */
  const texts = () => {
    const out: { where: string; v: string }[] = [];
    for (const k of [...h.keys()]) for (const [f, x] of hs(k)) out.push({ where: `${k}/${f}`, v: x.v });
    for (const k of [...l.keys()]) for (const v of ls(k)) out.push({ where: k, v });
    for (const k of [...str.keys()]) { gone(k); if (str.has(k)) out.push({ where: k, v: str.get(k)! }); }
    return out;
  };
  return { pipe, sent, violations, hs, zs, ls, str, kexp, texts, exec };
}


const recOf = (prompt: string): LogRecord => {
  const size = "36×12×72", resultKey = "builtin:bookcase";
  return { key: logKey(prompt, resultKey, size), prompt, size, resultKey, status: "Trusted", source: "live" };
};
const quiet = () => new IdeaStore(null);
const mk = (r: ReturnType<typeof ttlRedis>) => new IdeaStore(r.pipe, undefined, () => {}, async () => {});
/** Every row key in any of the six keys, and in which. */
function rows(r: ReturnType<typeof ttlRedis>) {
  const where = new Map<string, Set<string>>();
  const add = (k: string, name: string) => (where.get(k) ?? where.set(k, new Set()).get(k)!).add(name);
  for (const n of ["ideas:meta", "ideas:stamp", "ideas:review"]) for (const k of r.hs(n).keys()) add(k, n);
  for (const n of ["ideas:top", "ideas:status", "ideas:recent"]) for (const k of r.zs(n).keys()) add(k, n);
  return where;
}
/** No orphans: a row is in meta, top, status and stamp together, or in none of the six. */
function orphans(r: ReturnType<typeof ttlRedis>): string[] {
  const bad: string[] = [];
  for (const [k, s] of rows(r)) for (const n of ["ideas:meta", "ideas:top", "ideas:status", "ideas:stamp"]) if (!s.has(n)) bad.push(`${k} in ${[...s]} but not ${n}`);
  return bad;
}

test("time trim: every write sends ZREMRANGEBYSCORE recent −inf (now − 87 d) in place of the rank trim; 9 commands, unchanged", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const s = mk(r);
  for (let d = 0; d < 120; d++) { clock.now += DAY; await s.record(recOf(`shelf ${d}`), new Date(clock.now)); }
  for (const list of r.sent) {
    const t = list.find((c) => c[0] === "ZREMRANGEBYSCORE");
    assert.ok(t && t[1] === "ideas:recent" && t[2] === "-inf", "each write trims recent by time");
    assert.equal(list.length, WRITE_CMDS);
    assert.ok(!list.some((c) => c[0] === "ZREMRANGEBYRANK"));
  }
  assert.ok(Math.min(...r.zs("ideas:recent").values()) >= clock.now - RETAIN_MS, "nothing in recent is older than 87 days");
  assert.equal(r.zs("ideas:recent").size, RETAIN_DAYS, "one a day, the one exactly 87 days old trimmed");
  assert.equal(WRITE_CMDS, 9);
  assert.deepEqual(r.sent[0].map((c) => c[0]), ["INCRBY", "HSETNX", "ZINCRBY", "ZADD", "ZADD", "ZREMRANGEBYSCORE", "HSET", "HINCRBY", "EXPIRE"]);
});

test("last-seen: the later of the recent score and the stamp; LEGACY_SINCE for a row with neither", () => {
  const st = (at: string) => JSON.stringify({ at, source: "live" });
  assert.equal(lastSeen("1000", null), 1000);
  assert.equal(lastSeen(null, st("2026-11-01T00:00:00.000Z")), Date.parse("2026-11-01T00:00:00.000Z"));
  assert.equal(lastSeen(String(Date.parse("2026-12-01T00:00:00Z")), st("2026-11-01T00:00:00.000Z")), Date.parse("2026-12-01T00:00:00Z"));
  assert.equal(lastSeen(null, null), LEGACY_SINCE);
  assert.equal(lastSeen("x", "{bad"), LEGACY_SINCE);
});

test("sweep: stale rows go from all six keys together; fresh rows, rows kept alive by their stamp, and young legacy rows stay", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const s = mk(r);
  const old = recOf("old bench"), fresh = recOf("fresh bench");
  await s.record(old, new Date(clock.now));
  r.exec(["HSET", "ideas:review", old.key, "{}"]);
  // A legacy row: logged before stamps and rank-trimmed out of recent (no last-seen at all) → LEGACY_SINCE.
  r.exec(["HSETNX", "ideas:meta", "11111111", JSON.stringify({ prompt: "legacy" })]); r.exec(["ZINCRBY", "ideas:top", 2, "11111111"]); r.exec(["ZADD", "ideas:status", 1, "11111111"]);
  // A row rank-trimmed out of recent but stamped recently: kept by its stamp.
  const kept = recOf("kept by stamp");
  await s.record(kept, new Date(clock.now + 50 * DAY));
  r.zs("ideas:recent").delete(kept.key);
  clock.now += 80 * DAY;
  await s.record(fresh, new Date(clock.now));
  let res = await s.sweep(new Date(clock.now));
  assert.equal(res.dropped, 0, "nothing past 87 days yet");
  clock.now = Date.UTC(2026, 9, 21, 12) + RETAIN_MS + DAY;
  res = await s.sweep(new Date(clock.now));
  assert.ok(res.done);
  assert.ok(!rows(r).has(old.key), "the stale row is gone from every key, review mark included");
  assert.ok(rows(r).has(fresh.key) && rows(r).has(kept.key));
  assert.ok(!rows(r).has("11111111"), "legacy row: LEGACY_SINCE + 87 d has passed");
  assert.ok(LEGACY_SINCE + RETAIN_MS < clock.now);
  // Before the legacy deadline it stays.
  const r2 = ttlRedis({ now: LEGACY_SINCE + RETAIN_MS - DAY });
  r2.exec(["HSETNX", "ideas:meta", "22222222", "{}"]); r2.exec(["ZINCRBY", "ideas:top", 1, "22222222"]);
  assert.equal((await mk(r2).sweep(new Date(LEGACY_SINCE + RETAIN_MS - DAY))).dropped, 0);
});

test("200 days of traffic with the daily cron, then a quiet spell: no prompt or note past retention survives, and no orphans ever", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const s = mk(r);
  const shop = new ShopStore(r.pipe);
  const lastAt = new Map<string, number>(); // row key → last write
  const noteAt = new Map<string, number>();
  const start = clock.now;
  const check = (label: string) => {
    for (const k of r.hs("ideas:meta").keys()) assert.ok(clock.now - (lastAt.get(k) ?? LEGACY_SINCE) <= RETAIN_MS + DAY, `${label}: row ${k} last seen ${((clock.now - lastAt.get(k)!) / DAY).toFixed(1)} days ago`);
    for (const v of r.ls("feedback:list")) { const n = JSON.parse(v).note as string; assert.ok(clock.now - noteAt.get(n)! <= FEEDBACK_DAYS * DAY, `${label}: note ${n}`); }
    assert.deepEqual(orphans(r), [], label);
  };
  for (let d = 0; d < 200; d++) {
    for (let i = 0; i < 3; i++) {
      clock.now = start + d * DAY + i * 3 * 3_600_000;
      const rec = recOf(`shelf ${d} ${i}`);
      await s.record(rec, new Date(clock.now)); lastAt.set(rec.key, clock.now);
      const every = recOf("bookcase every day");
      await s.record(every, new Date(clock.now + 20_000 + i)); lastAt.set(every.key, clock.now + 20_000 + i);
      if (d < 120) {
        const note = `note-${d}-${i}`;
        (shop as unknown as { hits: number[] }).hits = [];
        await shop.addFeedback(cleanFeedback({ chips: ["other"], note }, "", new Date(clock.now))!, `c${i}`.padEnd(16, "0"), new Date(clock.now));
        noteAt.set(note, clock.now);
        if (i === 0) await shop.mark(rec.key, "B", new Date(clock.now));
      }
    }
    // The cron, once a day at 08:17 UTC.
    clock.now = start + d * DAY + 20 * 3_600_000;
    await s.sweep(new Date(clock.now));
    await shop.sweep(new Date(clock.now));
    check(`day ${d}`);
  }
  assert.ok(r.hs("ideas:meta").size >= RETAIN_DAYS * 3 - 3, `everything inside retention is kept (${r.hs("ideas:meta").size})`);
  // Quiet spell: no writes at all, the cron keeps running.
  for (let d = 0; d < 95; d++) { clock.now += DAY; await s.sweep(new Date(clock.now)); await shop.sweep(new Date(clock.now)); }
  assert.equal(r.hs("ideas:meta").size, 0, "no prompt survives the quiet spell");
  assert.equal(r.ls("feedback:list").length, 0, "no note survives the quiet spell");
  assert.deepEqual([...rows(r).keys()], [], "and nothing is left in any of the six keys");
});

test("cost cap: a run never sends more than maxCmds (budget counter agrees); a capped run resumes from its cursor the next day", async () => {
  const clock = { now: Date.UTC(2027, 2, 1, 8) };
  const r = ttlRedis(clock);
  for (let i = 0; i < 5000; i++) { const k = i.toString(16).padStart(8, "0"); r.exec(["HSETNX", "ideas:meta", k, "{}"]); r.exec(["ZINCRBY", "ideas:top", 1, k]); r.exec(["ZADD", "ideas:status", 1, k]); }
  assert.equal(SWEEP_BATCH, 500); assert.equal(SWEEP_MAX_CMDS, 200);
  const runs: { cmds: number; dropped: number; done: boolean }[] = [];
  const billed = () => Number(r.str.get("ideas:cmds:2027-03") ?? 0);
  for (let d = 0; d < 10; d++) {
    const before = billed();
    const res = await mk(r).sweep(new Date(clock.now + d * DAY), { maxCmds: 40, batch: 500 });
    assert.ok(res.cmds <= 40, `run ${d}: ${res.cmds}`);
    assert.equal(billed() - before, res.cmds, "INCRBY bills exactly what the run sent");
    runs.push(res);
    if (res.done) break;
  }
  assert.ok(runs.length > 1, "5,000 stale rows with a 40-command cap take more than one run");
  assert.ok(runs.at(-1)!.done && r.hs("ideas:meta").size === 0 && r.zs("ideas:top").size === 0, "resumed until done");
  assert.equal(runs.reduce((n, x) => n + x.dropped, 0), 5000);
  // Defaults: a 5,000-row store that's all fresh costs GET cursor 2 + 10 pages × 5 + DEL cursor 2 = 54 commands.
  const r2 = ttlRedis({ now: Date.UTC(2026, 10, 1) });
  for (let i = 0; i < 5000; i++) { const k = i.toString(16).padStart(8, "0"); r2.exec(["ZINCRBY", "ideas:top", 1, k]); r2.exec(["ZADD", "ideas:recent", Date.UTC(2026, 9, 30), k]); }
  const fresh = await mk(r2).sweep(new Date(Date.UTC(2026, 10, 1)));
  assert.ok(fresh.done && fresh.dropped === 0 && fresh.cmds <= 54, `${fresh.cmds}`);
  // The shared monthly budget stops it too.
  const b = new Budget(10);
  const r3 = ttlRedis({ now: Date.UTC(2026, 10, 1) });
  r3.exec(["ZINCRBY", "ideas:top", 1, "aaaaaaaa"]);
  const capped = await new IdeaStore(r3.pipe, b).sweep(new Date(Date.UTC(2026, 10, 1)));
  assert.ok(capped.cmds <= 10);
  assert.equal((await quiet().sweep()).done, true, "no store: a no-op");
});

test("cron: daily in vercel.json; /api/cron/retention is 404 without the right Bearer CRON_SECRET", async () => {
  const v = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.deepEqual(v.crons, [{ path: "/api/cron/retention", schedule: "17 8 * * *" }], "once a day (free plan)");
  const { Route } = await import("../src/routes/api/cron/retention");
  const h = (Route as unknown as { options: { server: { handlers: { GET: (a: { request: Request }) => Promise<Response> } } } }).options.server.handlers;
  const req = (auth?: string, extra: Record<string, string> = {}) => new Request("https://yard.test/api/cron/retention", { headers: { ...(auth ? { authorization: auth } : {}), ...extra } });
  const prev = process.env.CRON_SECRET;
  try {
    const sec = "c".repeat(32);
    for (const env of [undefined, "short", sec]) {
      if (env === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = env;
      for (const auth of [undefined, "", "Bearer ", "Bearer wrong", sec, `Bearer ${sec}x`, `Basic ${sec}`]) assert.equal((await h.GET({ request: req(auth, { "x-vercel-cron": "1", "user-agent": "vercel-cron/1.0" }) })).status, 404, `env=${env} auth=${auth}`);
    }
    process.env.CRON_SECRET = sec;
    const ok = await h.GET({ request: req(`Bearer ${sec}`) });
    assert.equal(ok.status, 200);
    assert.deepEqual(Object.keys(((await ok.json()) as { ideas: object }).ideas).sort(), ["cmds", "done", "dropped", "scanned"], "counts only");
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
  }
});

test("/api/critic-review: a missing or wrong secret is 404, never 401", async () => {
  const { Route } = await import("../src/routes/api/critic-review");
  const h = (Route as unknown as { options: { server: { handlers: Record<"GET" | "POST", (a: { request: Request }) => Promise<Response>> } } }).options.server.handlers;
  const req = (method: string, auth?: string) => new Request("https://yard.test/api/critic-review?op=unreviewed", { method, headers: auth ? { authorization: auth } : {}, body: method === "POST" ? JSON.stringify({ key: "aaaaaaaa", grade: "A" }) : undefined });
  const prev = process.env.CRITIC_REVIEW_SECRET;
  try {
    for (const env of [undefined, "short", "s".repeat(24)]) {
      if (env === undefined) delete process.env.CRITIC_REVIEW_SECRET; else process.env.CRITIC_REVIEW_SECRET = env;
      for (const m of ["GET", "POST"] as const) for (const auth of [undefined, "", "Bearer ", "Bearer wrong", `Bearer ${"s".repeat(23)}`, "s".repeat(24) + "x", `Basic ${"s".repeat(24)}`])
        assert.equal((await h[m]({ request: req(m, auth) })).status, 404, `${m} env=${env} auth=${auth}`);
    }
    process.env.CRITIC_REVIEW_SECRET = "s".repeat(24);
    assert.equal((await h.GET({ request: req("GET", `Bearer ${"s".repeat(24)}`) })).status, 200, "the right secret still works");
  } finally {
    if (prev === undefined) delete process.env.CRITIC_REVIEW_SECRET; else process.env.CRITIC_REVIEW_SECRET = prev;
  }
  assert.doesNotMatch(fs.readFileSync("src/routes/api/critic-review.ts", "utf8"), /,\s*401\s*\)|status:\s*401/);
});
