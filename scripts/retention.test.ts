// 90-day retention, SWE's design: ideas:recent is trimmed by time on every write; a daily cron sweep drops every row
// whose last-seen (recent score or stamp time; LEGACY_SINCE if neither) is past RETAIN_DAYS from ideas:meta, top,
// status, stamp, recent and review together (no orphans), capped by a batch size and a max-commands limit; the
// feedback store keeps its tail trim and the cron runs it too, so a quiet spell keeps nothing. /api/cron/retention and
// /api/critic-review are request middleware: without the right secret they go to the app like any unknown path.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Budget, FREE_TIER, IdeaStore, LEGACY_SINCE, RETAIN_DAYS, RETAIN_MS, SWEEP_BATCH, SWEEP_DROP_CMDS, SWEEP_MAX_CMDS, SWEEP_PAGE_CMDS, WRITE_CMDS, lastSeen, type Pipe } from "../src/lib/yard/ideaLog.server";
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
  /** Every live key name (expired ones dropped first) and every sorted-set member, for "nothing left" checks. */
  const keys = () => {
    for (const k of [...kexp.keys()]) gone(k);
    for (const k of [...h.keys()]) if (!hs(k).size) h.delete(k); // like Redis: an empty hash, set or list is no key
    return [...new Set([...h.keys(), ...[...z.keys()].filter((k) => z.get(k)!.size), ...[...l.keys()].filter((k) => l.get(k)!.length), ...str.keys()])];
  };
  const members = () => [...z.entries()].flatMap(([k, m]) => [...m.keys()].map((x) => ({ where: k, v: x })));
  return { pipe, sent, violations, hs, zs, ls, str, kexp, texts, exec, keys, members };
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
  for (const n of ["ideas:meta", "ideas:stamp", "ideas:review", "ideas:ptest"]) for (const k of r.hs(n).keys()) add(k, n);
  for (const n of ["ideas:top", "ideas:status", "ideas:recent"]) for (const k of r.zs(n).keys()) add(k, n);
  return where;
}
/** No orphans: a row is in meta, top, status and stamp together, or in none of the six. */
function orphans(r: ReturnType<typeof ttlRedis>): string[] {
  const bad: string[] = [];
  for (const [k, s] of rows(r)) for (const n of ["ideas:meta", "ideas:top", "ideas:status", "ideas:stamp"]) if (!s.has(n)) bad.push(`${k} in ${[...s]} but not ${n}`);
  return bad;
}

test("time trim: every write sends ZREMRANGEBYSCORE recent −inf (now − RETAIN_DAYS) in place of the rank trim; 10 commands with #83 merged (+ HMGET previous burst bucket)", async () => {
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
  assert.ok(Math.min(...r.zs("ideas:recent").values()) >= clock.now - RETAIN_MS, "nothing in recent is older than RETAIN_DAYS");
  assert.equal(r.zs("ideas:recent").size, RETAIN_DAYS, "one a day, the one exactly RETAIN_DAYS old trimmed");
  assert.equal(WRITE_CMDS, 10);
  assert.deepEqual(r.sent[0].map((c) => c[0]), ["INCRBY", "HSETNX", "ZINCRBY", "ZADD", "ZADD", "ZREMRANGEBYSCORE", "HSET", "HINCRBY", "EXPIRE", "HMGET"]);
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
  clock.now += 78 * DAY; // before LEGACY_SINCE + RETAIN_DAYS too
  await s.record(fresh, new Date(clock.now));
  let res = await s.sweep(new Date(clock.now));
  assert.equal(res.dropped, 0, "nothing past RETAIN_DAYS yet");
  clock.now = Date.UTC(2026, 9, 21, 12) + RETAIN_MS + DAY;
  res = await s.sweep(new Date(clock.now));
  assert.ok(res.done);
  assert.ok(!rows(r).has(old.key), "the stale row is gone from every key, review mark included");
  assert.ok(rows(r).has(fresh.key) && rows(r).has(kept.key));
  assert.ok(!rows(r).has("11111111"), "legacy row: LEGACY_SINCE + RETAIN_DAYS has passed");
  assert.ok(LEGACY_SINCE + RETAIN_MS < clock.now);
  // Before the legacy deadline it stays.
  const r2 = ttlRedis({ now: LEGACY_SINCE + RETAIN_MS - DAY });
  r2.exec(["HSETNX", "ideas:meta", "22222222", "{}"]); r2.exec(["ZINCRBY", "ideas:top", 1, "22222222"]);
  assert.equal((await mk(r2).sweep(new Date(LEGACY_SINCE + RETAIN_MS - DAY))).dropped, 0);
});

test("sweep: a swept row leaves no ideas:ptest field (#83's counts go with their row); a fresh row keeps its count", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const s = mk(r);
  const old = recOf("old test bench"), fresh = recOf("fresh test bench");
  await s.record(old, new Date(clock.now));
  r.exec(["HINCRBY", "ideas:ptest", old.key, 3]);
  clock.now += RETAIN_MS + DAY;
  await s.record(fresh, new Date(clock.now));
  r.exec(["HINCRBY", "ideas:ptest", fresh.key, 1]);
  const before = r.sent.length;
  const res = await s.sweep(new Date(clock.now));
  assert.equal(res.dropped, 1);
  assert.ok(!r.hs("ideas:ptest").has(old.key), "no ptest field left for the swept row");
  assert.equal(r.hs("ideas:ptest").get(fresh.key)?.v, "1");
  const drop = r.sent.slice(before).find((l) => l.some((c) => c[0] === "ZREM"))!;
  assert.deepEqual(drop.map((c) => `${c[0]} ${c[1]}`), ["INCRBY ideas:cmds:2027-01", "HDEL ideas:meta", "ZREM ideas:top", "ZREM ideas:status", "HDEL ideas:stamp", "ZREM ideas:recent", "HDEL ideas:review", "HDEL ideas:ptest"]);
  assert.equal(drop.length, SWEEP_DROP_CMDS);
  // Harmless with no ideas:ptest key at all (before #83): the row still goes from everywhere.
  const r2 = ttlRedis({ now: Date.UTC(2026, 9, 21, 12) });
  const s2 = mk(r2);
  await s2.record(old, new Date(Date.UTC(2026, 9, 21, 12)));
  const res2 = await s2.sweep(new Date(Date.UTC(2026, 9, 21, 12) + RETAIN_MS + DAY));
  assert.equal(res2.dropped, 1);
  assert.deepEqual([...rows(r2).keys()], []);
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
  assert.equal(SWEEP_BATCH, 2000); assert.equal(SWEEP_MAX_CMDS, 1500); assert.equal(RETAIN_DAYS, 85);
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
  // Defaults: a 5,000-row store that's all fresh costs GET cursor 2 + 3 pages × 5 + DEL cursor 2 = 19 commands.
  const r2 = ttlRedis({ now: Date.UTC(2026, 10, 1) });
  for (let i = 0; i < 5000; i++) { const k = i.toString(16).padStart(8, "0"); r2.exec(["ZINCRBY", "ideas:top", 1, k]); r2.exec(["ZADD", "ideas:recent", Date.UTC(2026, 9, 30), k]); }
  const fresh = await mk(r2).sweep(new Date(Date.UTC(2026, 10, 1)));
  assert.ok(fresh.done && fresh.dropped === 0 && fresh.cmds === 19, `${fresh.cmds}`);
  // The most rows the store can hold: writes stop at BUDGET and a new row costs ≥ WRITE_CMDS − 1 (9: no bucket TTL, no run id), so ≤ 50,000 new rows a
  // month and ≤ 200,000 in any 88 days (4 calendar months) = 100 pages of SWEEP_BATCH. Every one stale, one run still
  // finishes the pass: GET 2 + 100 × (5 + 8) + DEL cursor 2 = 1,304 ≤ 1,500. (Scaled here: 100 pages of 200 rows.)
  const maxRows = 4 * Math.floor(450_000 / (WRITE_CMDS - 1));
  assert.equal(maxRows, 200_000);
  assert.equal(Math.ceil(maxRows / SWEEP_BATCH), 100);
  const r4 = ttlRedis({ now: Date.UTC(2027, 2, 1, 8) });
  const meta4 = r4.hs("ideas:meta"), ptest4 = r4.hs("ideas:ptest"), top4 = r4.zs("ideas:top");
  for (let i = 0; i < 20_000; i++) { const k = i.toString(16).padStart(8, "0"); meta4.set(k, { v: "{}" }); ptest4.set(k, { v: "1" }); top4.set(k, 1); }
  const worst = await new IdeaStore(r4.pipe, new Budget(FREE_TIER)).sweep(new Date(Date.UTC(2027, 2, 1, 8)), { batch: 200 });
  assert.equal(SWEEP_PAGE_CMDS + SWEEP_DROP_CMDS, 13);
  assert.ok(worst.done, "one run finishes the pass");
  assert.equal(worst.cmds, 1304); assert.equal(worst.dropped, 20_000);
  assert.ok(worst.cmds <= SWEEP_MAX_CMDS);
  // All fresh at the maximum: 2 + 100 × 5 + 2 = 504 a run, twice a day ≈ 31K a month, inside the 50K between
  // BUDGET and the free tier that the cron's own Budget(FREE_TIER) may use.
  assert.ok(2 * (2 + 100 * SWEEP_PAGE_CMDS + 2) * 31 + 2 * 62 * 31 < FREE_TIER - 450_000);
  // A month whose writes reached BUDGET still sweeps (the cron's Budget is the free tier, not BUDGET).
  const r5 = ttlRedis({ now: Date.UTC(2027, 2, 1, 8) });
  r5.str.set("ideas:cmds:2027-03", "450000");
  r5.exec(["HSETNX", "ideas:meta", "bbbbbbbb", "{}"]); r5.exec(["ZINCRBY", "ideas:top", 1, "bbbbbbbb"]);
  const writesStopped = new Budget(); writesStopped.allows(1, new Date(Date.UTC(2027, 2, 1, 8))); writesStopped.saw(450_000);
  assert.equal((await new IdeaStore(r5.pipe, writesStopped).sweep(new Date(Date.UTC(2027, 2, 1, 8)))).dropped, 0, "BUDGET alone would stop it");
  const reserve = new Budget(FREE_TIER); reserve.allows(1, new Date(Date.UTC(2027, 2, 1, 8))); reserve.saw(450_000);
  assert.equal((await new IdeaStore(r5.pipe, reserve).sweep(new Date(Date.UTC(2027, 2, 1, 8)))).dropped, 1);
  // The shared monthly budget stops it too.
  const b = new Budget(10);
  const r3 = ttlRedis({ now: Date.UTC(2026, 10, 1) });
  r3.exec(["ZINCRBY", "ideas:top", 1, "aaaaaaaa"]);
  const capped = await new IdeaStore(r3.pipe, b).sweep(new Date(Date.UTC(2026, 10, 1)));
  assert.ok(capped.cmds <= 10);
  assert.equal((await quiet().sweep()).done, true, "no store: a no-op");
});

/** Runs the request middleware the way src/start.ts does; `next` stands for the app (a real not-found here). */
async function viaMiddleware(req: Request, env: Record<string, string | undefined>) {
  const { secretRoute } = await import("../src/lib/server/secretRoutes");
  const nf = new Response("<!DOCTYPE html>app not-found", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  let nextCalls = 0;
  const out = (await secretRoute(req, new URL(req.url).pathname, env)) ?? (nextCalls++, nf);
  return { out, wentToApp: out === nf && nextCalls === 1 };
}

test("cron: two daily jobs in vercel.json; /api/cron/retention without the right Bearer CRON_SECRET goes to the app like an unknown path", async () => {
  const v = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.deepEqual(v.crons, [{ path: "/api/cron/retention", schedule: "17 8 * * *" }, { path: "/api/cron/retention", schedule: "17 20 * * *" }], "two daily jobs (each once a day: free plan)");
  assert.ok(!fs.existsSync("src/routes/api/cron/retention.ts") && !fs.readFileSync("src/routeTree.gen.ts", "utf8").includes("/api/cron/retention"), "not a router route");
  const req = (auth?: string, extra: Record<string, string> = {}) => new Request("https://yard.test/api/cron/retention", { headers: { ...(auth ? { authorization: auth } : {}), ...extra } });
  const sec = "c".repeat(32);
  for (const auth of [undefined, "", "Bearer ", "Bearer wrong", sec, `Bearer ${sec}x`, `Basic ${sec}`, `bearer ${sec}`])
    assert.ok((await viaMiddleware(req(auth, { "x-vercel-cron": "1", "user-agent": "vercel-cron/1.0" }), { CRON_SECRET: sec })).wentToApp, `auth=${auth}`);
  // CRON_SECRET missing or short: requests that don't look like the cron still go to the app (the fail-loud test below).
  const quiet = console.error; console.error = () => {};
  try {
    for (const env of [undefined, "short"]) for (const auth of [undefined, "", sec, `Basic ${sec}`])
      assert.ok((await viaMiddleware(req(auth, { "x-vercel-cron": "1", "user-agent": "vercel-cron/1.0" }), { CRON_SECRET: env })).wentToApp, `env=${env} auth=${auth}`);
  } finally { console.error = quiet; }
  assert.ok((await viaMiddleware(new Request("https://yard.test/api/cron/retention", { method: "POST", headers: { authorization: `Bearer ${sec}` } }), { CRON_SECRET: sec })).wentToApp, "other methods too");
  const ok = (await viaMiddleware(req(`Bearer ${sec}`), { CRON_SECRET: sec })).out;
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(((await ok.json()) as { ideas: object }).ideas).sort(), ["cmds", "done", "dropped", "scanned"], "counts only");
});

test("cron fail-loud: CRON_SECRET missing or under 16 → console.error on every hit, a cron-looking call gets 500, a public probe still gets the app's not-found; never the user agent", async () => {
  const { CRON_MIN_SECRET } = await import("../src/lib/server/secretRoutes");
  assert.equal(CRON_MIN_SECRET, 16);
  const src = fs.readFileSync("src/lib/server/secretRoutes.ts", "utf8");
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /user-agent|userAgent|navigator|cookie/i, "no user agent, cookie or browser detail is read");
  const req = (h: Record<string, string>) => new Request("https://yard.test/api/cron/retention", { headers: h });
  const errs: unknown[][] = [];
  const quiet = console.error; console.error = (...a: unknown[]) => { errs.push(a); };
  try {
    const short15 = "c".repeat(15);
    for (const env of [undefined, "", "short", short15]) {
      // What Vercel sends: x-vercel-cron-schedule always; Authorization: Bearer <CRON_SECRET> once the var exists.
      for (const h of [{ "x-vercel-cron-schedule": "17 8 * * *" }, { authorization: `Bearer ${env || "x"}`, "x-vercel-cron-schedule": "17 20 * * *" }, { authorization: "Bearer anything" }]) {
        const n = errs.length;
        const { out, wentToApp } = await viaMiddleware(req(h), { CRON_SECRET: env });
        assert.ok(!wentToApp && out.status === 500, `env=${JSON.stringify(env)} ${JSON.stringify(h)}: 500`);
        assert.equal(out.headers.get("cache-control"), "no-store");
        assert.doesNotMatch(await out.text(), /c{8}|short/, "the reply never carries the (short) value");
        assert.deepEqual(errs.slice(n), [["[retention] CRON_SECRET missing or too short"]]);
      }
      // A public probe (no cron header, no Bearer): the app's real not-found, but the error is still logged.
      for (const h of [{}, { accept: "text/html", "user-agent": "vercel-cron/1.0" }, { authorization: "Basic abc" }]) {
        const n = errs.length;
        assert.ok((await viaMiddleware(req(h), { CRON_SECRET: env })).wentToApp, `env=${JSON.stringify(env)} ${JSON.stringify(h)}: not-found`);
        assert.equal(errs.length, n + 1);
      }
    }
    // Set and ≥ 16 (exactly 16 and 32): no error, a wrong or missing Bearer is a not-found even with the cron header; the right one sweeps.
    const n = errs.length;
    for (const sec of ["c".repeat(16), "c".repeat(32)]) {
      for (const h of [{ "x-vercel-cron-schedule": "17 8 * * *" }, { authorization: "Bearer wrong", "x-vercel-cron-schedule": "17 8 * * *" }, { authorization: `Bearer ${sec.slice(1)}`, "x-vercel-cron-schedule": "17 8 * * *" }, {}])
        assert.ok((await viaMiddleware(req(h), { CRON_SECRET: sec })).wentToApp, `len ${sec.length} ${JSON.stringify(h)}: not-found`);
      assert.equal((await viaMiddleware(req({ authorization: `Bearer ${sec}`, "x-vercel-cron-schedule": "17 8 * * *" }), { CRON_SECRET: sec })).out.status, 200, `len ${sec.length}: sweeps`);
    }
    assert.equal(errs.length, n, "no error when CRON_SECRET is fine");
    // The other secret path is unchanged: a missing CRITIC_REVIEW_SECRET is a quiet not-found.
    assert.ok((await viaMiddleware(new Request("https://yard.test/api/critic-review", { headers: { authorization: "Bearer x", "x-vercel-cron-schedule": "1" } }), {})).wentToApp);
    assert.equal(errs.length, n);
  } finally { console.error = quiet; }
});

test("/api/critic-review: a missing or wrong secret goes to the app like an unknown path, never 401", async () => {
  assert.ok(!fs.existsSync("src/routes/api/critic-review.ts") && !fs.readFileSync("src/routeTree.gen.ts", "utf8").includes("/api/critic-review"), "not a router route");
  const req = (method: string, auth?: string) => new Request("https://yard.test/api/critic-review?op=unreviewed", { method, headers: auth ? { authorization: auth } : {}, body: method === "POST" ? JSON.stringify({ key: "aaaaaaaa", grade: "A" }) : undefined });
  const good = "s".repeat(24);
  for (const env of [undefined, "short", good]) {
    for (const m of ["GET", "POST", "HEAD", "PUT"] as const) for (const auth of [undefined, "", "Bearer ", "Bearer wrong", `Bearer ${"s".repeat(23)}`, good, good + "x", `Basic ${good}`])
      assert.ok((await viaMiddleware(req(m, auth), { CRITIC_REVIEW_SECRET: env })).wentToApp, `${m} env=${env} auth=${auth}`);
  }
  assert.equal((await viaMiddleware(req("GET", `Bearer ${good}`), { CRITIC_REVIEW_SECRET: good })).out.status, 200, "the right secret still works");
  assert.doesNotMatch(fs.readFileSync("src/lib/server/criticReviewHandler.ts", "utf8") + fs.readFileSync("src/lib/server/secretRoutes.ts", "utf8"), /\b401\b/);
});

test("secret check: constant-time compare and the same work for every path, secret or not (timing)", async () => {
  const { authorised, secretRoute } = await import("../src/lib/server/secretRoutes");
  const src = fs.readFileSync("src/lib/server/secretRoutes.ts", "utf8");
  assert.match(src, /timingSafeEqual\(got, want\) && valid/, "the digest compare runs even when the secret is unset");
  assert.ok(src.indexOf("authorised(request.headers.get") < src.indexOf("entry.load()"), "nothing is loaded before the check");
  assert.equal(authorised("Bearer " + "k".repeat(32), "k".repeat(32)), true);
  assert.equal(authorised("Bearer " + "k".repeat(32), undefined), false);
  assert.equal(authorised("Bearer short", "short"), false);
  // Median time per decision: an unknown path, the cron path with a wrong secret, with no env, and a near-miss secret.
  const env = { CRON_SECRET: "k".repeat(64) };
  const cases: [string, string, Record<string, string | undefined>][] = [
    ["/api/zq7x3k9m", "Bearer " + "x".repeat(64), env],
    ["/api/cron/retention", "Bearer " + "x".repeat(64), env],
    ["/api/cron/retention", "", {}], // no env, no Bearer (a public probe): still null, after one console.error (stubbed)
    ["/api/cron/retention", "Bearer " + "k".repeat(63) + "x", env],
  ];
  const median = async ([path, auth, e]: (typeof cases)[number]) => {
    const req = new Request(`https://yard.test${path}`, { headers: { authorization: auth } });
    const ts: number[] = [];
    for (let i = 0; i < 4000; i++) { const t = process.hrtime.bigint(); const r = await secretRoute(req, path, e); ts.push(Number(process.hrtime.bigint() - t)); assert.equal(r, null); }
    ts.sort((a, b) => a - b);
    return ts[ts.length >> 1];
  };
  const quiet = console.error; console.error = () => {};
  const m = [];
  try {
    for (const c of cases) await median(c); // warm up
    for (const c of cases) m.push(await median(c));
  } finally { console.error = quiet; }
  const spread = Math.max(...m) - Math.min(...m);
  console.log(`# secret check medians (ns): ${m.join(", ")}; spread ${spread} ns`);
  assert.ok(spread < 20_000, `decisions within 20 µs of each other: ${m}`);
});

test("day 90 − 1 s: every copy of a day-0 prompt and note is gone (row, indexes, stamp, ptest, review, feedback, rate-limit keys, snapshot, memo, CDN), with the cron's worst timing, a missed run, a cursor needing three runs and a store outage", async () => {
  const H = 3_600_000;
  const T0 = Date.UTC(2026, 10, 2, 8) + 1; // written 1 ms after a run at 08:00:00, so it turns stale just after one
  const clock = { now: T0 };
  const r = ttlRedis(clock);
  let outage: [number, number] = [0, 0];
  const pipe: Pipe = async (list) => { if (clock.now >= outage[0] && clock.now < outage[1]) throw new Error("store down"); return r.pipe(list); };
  // 3,000 fresh rows ahead of ours in scan order, and a per-run cap of 27 commands: 3 pages a run, so a full pass
  // takes 3 runs and the cursor carries across them (ideas:sweep:cursor).
  // (Kept fresh by a far-future stamp, outside the snapshot's top 1,000 and newest 200 so our row stays visible.)
  const top = r.zs("ideas:top"), stamps = r.hs("ideas:stamp");
  for (let i = 0; i < 3000; i++) { const k = `0${i.toString(16).padStart(7, "0")}`; top.set(k, 0.5); stamps.set(k, { v: JSON.stringify({ at: "2030-01-01T00:00:00.000Z", source: "live" }) }); }
  let prompt = "", rec!: LogRecord;
  for (let i = 0; ; i++) { prompt = `bookcase for the hall ${i}`; rec = recOf(prompt); if (rec.key > "8") break; }
  const note = "day0 note about the hall bookcase";
  const web = new IdeaStore(pipe, undefined, () => {}, async () => {}); // a warm instance: its 10-minute memo
  const shop = new ShopStore(pipe);
  // Day 0: every key type.
  assert.equal(await web.record(rec, new Date(T0)), "written"); // meta, top, status, recent, stamp, burst
  r.exec(["HINCRBY", "ideas:ptest", rec.key, 1]); // #83's possible-test count
  assert.equal(await shop.mark(rec.key, "B", new Date(T0)), "marked"); // Critic's review mark
  assert.equal(await shop.addFeedback(cleanFeedback({ chips: ["other"], note, prompt }, "", new Date(T0))!, "a".repeat(16), new Date(T0)), "saved"); // list, day and client counters
  await web.served(new Date(T0)); // ideas:snap + lock + memo
  const has = (v: string) => v.includes(rec.key) || v.includes(prompt) || v.includes(note);
  assert.ok(r.texts().some((x) => has(x.v)) && r.keys().some((k) => k.startsWith("feedback:cid:")) && r.keys().some((k) => k.startsWith("ideas:burst:")) && r.keys().includes("ideas:snap"), "day 0 wrote every key type");
  assert.ok(r.hs("ideas:ptest").has(rec.key) && r.hs("ideas:review").has(rec.key), "ptest and review mark written");
  assert.ok(has(JSON.stringify(await web.served(new Date(T0)))), "the row is in the served snapshot");
  // The cron: two daily jobs, each anywhere in its hour; worst gaps alternate 12 h 59 m 59 s / 11 h 0 m 1 s.
  const runs: number[] = [];
  for (let d = 0; d <= 91; d++) runs.push(Date.UTC(2026, 10, 2 + d, 8), Date.UTC(2026, 10, 2 + d, 20, 59, 59));
  const missed = Date.UTC(2026, 10, 2 + 85, 20, 59, 59); // the first run after it turns stale never happens
  const deadline = T0 + 90 * DAY - 1000;
  const fills: { at: number; body: string }[] = []; // every CDN fill of /api/ideas and /ideas (served from the memo)
  let goneAt = 0, cursorSeen = false;
  for (let t = T0; t <= deadline; ) {
    const nextRun = runs.find((x) => x > t && x !== missed) ?? Infinity;
    const nextReq = t + 15 * 60_000; // a page or API request every 15 minutes refreshes the memo, snapshot and CDN
    t = Math.min(nextRun, nextReq, deadline);
    clock.now = t;
    if (t === nextRun) {
      fills.push({ at: t, body: JSON.stringify(await web.served(new Date(t))) }); // a request lands just before the run: a fresh memo
      await new IdeaStore(pipe, new Budget(FREE_TIER)).sweep(new Date(t), { maxCmds: 27, batch: 500 });
      await new ShopStore(pipe, new Budget(FREE_TIER)).sweep(new Date(t));
      cursorSeen ||= r.str.has("ideas:sweep:cursor");
      if (!goneAt && !r.hs("ideas:meta").has(rec.key)) {
        goneAt = t;
        outage = [t + 1, deadline + 1]; // the store goes down right after, to the end: the warm memo must not outlive its hour
      }
    }
    const snap = await web.served(new Date(t));
    fills.push({ at: t, body: JSON.stringify(snap) });
    if (t === deadline) break;
  }
  assert.ok(cursorSeen, "a pass took several runs (cursor saved between them)");
  assert.ok(goneAt > 0, "the row was swept");
  console.log(`# day-90 test: row swept at day ${((goneAt - T0) / DAY).toFixed(3)} after its last write`);
  // Worst case, as in ideaLog.server.ts: stale at T0 + 85 d, then ≤ 6 more runs (1 missed + 2 passes of 3) of ≤ 13 h.
  assert.ok(goneAt <= T0 + RETAIN_MS + 6 * 13 * H, `swept at day ${((goneAt - T0) / DAY).toFixed(2)}`);
  // At day 90 − 1 s: nothing in Redis holds the row key, prompt or note; the rate-limit and burst keys have expired.
  clock.now = deadline;
  assert.deepEqual(r.texts().filter((x) => has(x.v) || x.where.includes(rec.key)), [], "no hash field, list entry or string");
  assert.deepEqual(r.members().filter((x) => x.v === rec.key), [], "no index (top, status, recent)");
  for (const k of ["ideas:meta", "ideas:stamp", "ideas:ptest", "ideas:review"]) assert.ok(!r.hs(k).has(rec.key), k);
  assert.ok(!r.ls("feedback:list").some(has), "feedback note");
  assert.deepEqual(r.keys().filter((k) => /^feedback:(cid|day):2026-11-02|^ideas:burst:/.test(k)), [], "day-0 counters expired");
  const left = r.keys().filter((k) => !/^ideas:(top|status|recent|stamp|cmds:\d{4}-\d{2}|sweep:cursor|snap|snap:lock)$|^feedback:(list|day:.*|cid:.*)$/.test(k));
  assert.deepEqual(left, [], "no other key exists");
  // Caches: a CDN copy is served at most s-maxage 1 h + stale-while-revalidate 24 h after its fill (browser max-age
  // 60 s + SWR 24 h is shorter), so every fill after deadline − 25 h must be clean, and so must the memo now.
  const cdnLife = (3600 + 86_400) * 1000;
  const live = fills.filter((f) => f.at > deadline - cdnLife);
  assert.ok(live.length > 90, `${live.length} CDN fills in the last 25 h`);
  assert.deepEqual(live.filter((f) => has(f.body)).map((f) => new Date(f.at).toISOString()), [], "no CDN copy still servable");
  assert.ok(!has(JSON.stringify(await web.served(new Date(deadline)))), "the warm instance's memo");
  // And the copies did exist until the sweep: the check above is not vacuous.
  assert.ok(fills.some((f) => f.at < goneAt && has(f.body)), "the snapshot, memo and CDN did hold the row before");
  // Worst case in days and hours with the production schedule (no missed run, one-run passes): 85 d + 12 h 59 m 59 s
  // + 5 min run + 26 h 10 m of caches = 86 d 15 h 15 m.
  const worst = RETAIN_MS + (12 * H + 59 * 60_000 + 59_000) + 5 * 60_000 + (H + 10 * 60_000 + cdnLife);
  assert.ok(worst < 86 * DAY + 15 * H + 15 * 60_000 && 90 * DAY - worst > 3 * DAY + 8 * H, `worst ${worst}`);
});

