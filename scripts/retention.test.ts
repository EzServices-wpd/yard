// 90-day retention (privacy page: "We delete saved prompts and feedback notes after 90 days"), enforced by Redis TTLs:
// - every write to a key that can hold typed text (ideas:meta, the feedback lists) carries its expiry in the same
//   command or pipeline, and ideas:review / ideas:stamp too; the count keys hold no text and are trimmed/swept;
// - against a Redis fake with real per-field and per-key expiry on a clock: through 200 days of traffic and then a
//   long quiet spell, no prompt or note older than RETAIN_DAYS (88) is ever readable;
// - fields saved with no TTL (old code, old previews sharing the store) are caught by the daily sweep;
// - /api/critic-review answers 404 to a missing or wrong secret, never 401.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IdeaStore, LEGACY_DEADLINE_S, LEGACY_SINCE, RETAIN_DAYS, RETAIN_S, SWEEP_MS, WRITE_CMDS, type Pipe } from "../src/lib/yard/ideaLog.server";
import { logKey, type LogRecord } from "../src/lib/yard/ideaLog";
import { ShopStore, dayExpiry } from "../src/lib/feedback/store.server";
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

/** The write rule, checked on every pipeline the stores sent. */
function checkWrites(sent: Cmd[][]): string[] {
  const bad: string[] = [];
  const WRITES = /^(HSET|HSETNX|HSETEX|HINCRBY|HMSET|LPUSH|RPUSH|LSET|SET|ZADD|ZINCRBY|INCR|INCRBY|APPEND)$/;
  const HEX = /^[0-9a-f]{8}$/;
  for (const list of sent) {
    const has = (pred: (c: Cmd) => boolean) => list.some(pred);
    for (const c of list) {
      const [op, key] = [String(c[0]), String(c[1])];
      if (!WRITES.test(op)) continue;
      const ttlInSamePipe = has((x) => (x[0] === "EXPIRE" || x[0] === "EXPIREAT") && x[1] === key);
      if (key === "ideas:meta" || key === "ideas:stamp" || key === "ideas:review") {
        const opts = c.slice(2, c.indexOf("FIELDS")).map(String);
        if (op !== "HSETEX" || !(opts.includes("EX") || opts.includes("KEEPTTL"))) bad.push(`${op} ${key} without a field TTL`);
        if (key === "ideas:meta" && !(opts.includes("FNX") && opts.includes("EX"))) bad.push("meta must be HSETEX FNX EX (TTL from first save)");
        if (opts.includes("EX") && Number(opts[opts.indexOf("EX") + 1]) > RETAIN_S) bad.push(`${key} TTL over ${RETAIN_DAYS} days`);
      } else if (key.startsWith("feedback:list")) {
        if (!/^feedback:list:\d{4}-\d{2}-\d{2}$/.test(key) || !ttlInSamePipe) bad.push(`${op} ${key} without its day list's expiry`);
      } else if (key === "ideas:top" || key === "ideas:status" || key === "ideas:recent") {
        const member = String(op === "ZINCRBY" ? c[3] : c[c.length - 1]);
        if (!HEX.test(member)) bad.push(`${key} member ${member} is not a row key`);
        if (key === "ideas:recent" && !has((x) => x[0] === "ZREMRANGEBYRANK" && x[1] === key)) bad.push("recent written without its trim");
      } else if (/^ideas:cmds:\d{4}-\d{2}$/.test(key)) {
        // the monthly command counter: a number
      } else if (key === "ideas:snap" || key === "ideas:snap:lock") {
        if (!c.includes("EX")) bad.push(`${key} without EX`);
      } else if (/^ideas:burst:|^feedback:(day|cid):/.test(key)) {
        if (!ttlInSamePipe) bad.push(`${op} ${key} without EXPIRE in the same pipeline`);
      } else bad.push(`write to an unlisted key ${key} (${op}); give it a retention rule here`);
    }
  }
  return bad;
}

const recOf = (prompt: string, source: LogRecord["source"] = "live"): LogRecord => {
  const size = "36×12×72", resultKey = "builtin:bookcase";
  return { key: logKey(prompt, resultKey, size), prompt, size, resultKey, status: "Trusted", source };
};

test(`200 days of traffic, then a quiet spell: no prompt or note older than ${RETAIN_DAYS} days is ever readable`, async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const shop = new ShopStore(r.pipe);
  const firstSaved = new Map<string, number>(); // prompt text → when the stored copy was saved
  const noteAt = new Map<string, number>();
  const start = clock.now;
  const check = (label: string) => {
    for (const { where, v } of r.texts()) {
      for (const [p, t] of firstSaved) if (v.includes(`"${p}"`) || v.includes(`"prompt":"${p}"`)) {
        // a stored copy can only be as old as its save (or, in the snapshot, its save + the snapshot's hour)
        assert.ok(clock.now - t <= RETAIN_DAYS * DAY + 3_600_000 || !v.includes(p), `${label}: "${p}" in ${where} is ${((clock.now - t) / DAY).toFixed(2)} days old`);
      }
      for (const [n, t] of noteAt) if (v.includes(n)) assert.ok(clock.now - t <= RETAIN_DAYS * DAY, `${label}: note ${n} in ${where} is ${((clock.now - t) / DAY).toFixed(2)} days old`);
    }
  };
  for (let d = 0; d < 200; d++) {
    for (let i = 0; i < 3; i++) {
      clock.now = start + d * DAY + i * 3 * 3_600_000;
      const p = `shelf day ${d} n ${i}`;
      const rec = recOf(p);
      if (!r.hs("ideas:meta").has(rec.key)) firstSaved.set(p, clock.now);
      assert.equal(await store.record(rec, new Date(clock.now)), "written");
      // The same prompt typed again every day: its stored copy still goes 88 days after it was first saved.
      const again = recOf("bookcase every day");
      if (!r.hs("ideas:meta").has(again.key)) firstSaved.set("bookcase every day", clock.now);
      await store.record(again, new Date(clock.now + 20_000 + i));
      const note = `note-${d}-${i}`;
      const fb = cleanFeedback({ chips: ["other"], note, prompt: p }, "", new Date(clock.now))!;
      (shop as unknown as { hits: number[] }).hits = [];
      assert.equal(await shop.addFeedback(fb, `c${i}`.padEnd(16, "0"), new Date(clock.now)), "saved");
      noteAt.set(note, clock.now);
      if (i === 0 && d % 3 === 0) await shop.mark(rec.key, "B");
      if (i === 0) await store.served(new Date(clock.now + 60_000));
    }
    if (d % 4 === 3 || d >= RETAIN_DAYS - 2) check(`day ${d}`);
  }
  // Everything inside the window is still there (the TTLs don't over-delete): the last 88 days' prompts.
  const kept = [...firstSaved].filter(([, t]) => clock.now - t < (RETAIN_DAYS - 1) * DAY).length;
  assert.ok(r.hs("ideas:meta").size >= kept - 1, `kept ${r.hs("ideas:meta").size} of ${kept}`);
  // The quiet spell: no traffic at all. Redis alone empties every text-bearing key.
  clock.now += (RETAIN_DAYS + 2) * DAY;
  check("after the quiet spell");
  const left = r.texts().filter(({ where }) => /^ideas:meta|^feedback:list|^ideas:snap$/.test(where));
  assert.deepEqual(left, [], "no prompt or note survives with no traffic");
  assert.deepEqual(r.violations, []);
  assert.deepEqual(checkWrites(r.sent), [], "every write carries its expiry or trim");
});

test("every write the stores send carries an expiry or trim (record, burst, flush, snapshot, sweep, feedback, marks)", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 9, 15) };
  const r = ttlRedis(clock);
  const held: Promise<unknown>[] = [];
  const store = new IdeaStore(r.pipe, undefined, (p) => held.push(p), async () => {});
  const shop = new ShopStore(r.pipe);
  // a burst (possible-test re-stamps), coalesced repeats (flush), a run id, snapshots, feedback, marks and samples
  for (let i = 0; i < 70; i++) await store.record(recOf(`desk ${i}`), new Date(clock.now + i * 200), { run: "a1b2c3d4e5f60718" });
  for (let i = 0; i < 5; i++) await store.record(recOf("desk 1"), new Date(clock.now + 15_000 + i));
  await Promise.all(held);
  await store.served(new Date(clock.now + 30_000));
  await shop.addFeedback(cleanFeedback({ chips: ["price"], note: "too dear" }, "", new Date(clock.now))!, "none", new Date(clock.now));
  await shop.mark(recOf("desk 2").key, "A");
  await shop.sample(5, new Date(clock.now + 60_000));
  await shop.unreviewed(20, new Date(clock.now + 60_000));
  assert.deepEqual(checkWrites(r.sent), []);
  assert.deepEqual(r.violations, []);
  // The checker itself catches what the old code did.
  assert.equal(checkWrites([[["HSETNX", "ideas:meta", "aaaaaaaa", "{}"]]]).length, 2);
  assert.equal(checkWrites([[["HSET", "ideas:stamp", "aaaaaaaa", "{}"]]]).length, 1);
  assert.equal(checkWrites([[["LPUSH", "feedback:list", "{}"], ["LTRIM", "feedback:list", 0, 1999]]]).length, 1);
  assert.equal(checkWrites([[["ZADD", "ideas:recent", 1, "aaaaaaaa"]]]).length, 1);
  assert.equal(checkWrites([[["HSET", "ideas:new", "x", "y"]]]).length, 1, "a new key needs a rule");
  // And nothing in the source writes those keys the old way.
  const code = (f: string) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const f of ["src/lib/yard/ideaLog.server.ts", "src/lib/feedback/store.server.ts"]) {
    assert.doesNotMatch(code(f), /"HSETNX"|\["HSET",|"LTRIM"/, f);
  }
});

test(`ideas:meta: the TTL is set by the first save (a daily re-type never extends it); the next write saves it afresh`, async () => {
  const clock = { now: Date.UTC(2026, 10, 1, 12) };
  const r = ttlRedis(clock);
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  const rec = recOf("garden bench");
  const t0 = clock.now;
  for (let d = 0; d < RETAIN_DAYS; d++) { clock.now = t0 + d * DAY; await store.record(rec, new Date(clock.now)); }
  clock.now = t0 + RETAIN_S * 1000 - 1;
  assert.ok(r.hs("ideas:meta").has(rec.key), "kept for 88 days");
  clock.now = t0 + RETAIN_S * 1000;
  assert.ok(!r.hs("ideas:meta").has(rec.key), "gone at 88 days, retyped daily or not");
  assert.ok(r.hs("ideas:stamp").has(rec.key), "the stamp (no text) follows the latest write");
  await store.record(rec, new Date(clock.now + 20_000));
  assert.ok(r.hs("ideas:meta").has(rec.key), "the next write saves it afresh, with a fresh 88 days");
  assert.equal(r.zs("ideas:top").get(rec.key), RETAIN_DAYS + 1, "its count (no text) carries on");
});

test("legacy fields with no TTL (old code, old previews on the shared store): the daily sweep sets the deadline, then deletes", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  // What the old code left: HSETNX meta, HSET stamp, an HSET review mark, the old single feedback list.
  const old = recOf("old shelf");
  r.exec(["HSETNX", "ideas:meta", old.key, JSON.stringify({ prompt: "old shelf", size: old.size, resultKey: old.resultKey })]);
  r.exec(["HSET", "ideas:stamp", old.key, JSON.stringify({ at: "2026-10-16T00:00:00.000Z", source: "live" })]);
  r.exec(["ZINCRBY", "ideas:top", 3, old.key]); r.exec(["ZADD", "ideas:status", 2, old.key]); r.exec(["ZADD", "ideas:recent", clock.now - DAY, old.key]);
  r.exec(["HSET", "ideas:review", old.key, "{}"]);
  r.exec(["LPUSH", "feedback:list", JSON.stringify({ note: "old note", at: "2026-10-16T00:00:00.000Z" })]);
  await store.served(new Date(clock.now));
  assert.equal(r.kexp.get("feedback:list"), LEGACY_DEADLINE_S * 1000, "the old list goes at the deadline");
  clock.now = LEGACY_DEADLINE_S * 1000 - 1;
  assert.ok(r.hs("ideas:meta").has(old.key), "kept until the deadline");
  clock.now = LEGACY_DEADLINE_S * 1000;
  assert.ok(!r.hs("ideas:meta").has(old.key) && !r.hs("ideas:review").has(old.key) && !r.hs("ideas:stamp").has(old.key));
  assert.equal(r.ls("feedback:list").length, 0);
  assert.ok(LEGACY_DEADLINE_S * 1000 - LEGACY_SINCE <= RETAIN_S * 1000, "nothing written since the log shipped outlives 88 days");
  // The next sweep drops the counts of the deleted row (no meta any more).
  clock.now += SWEEP_MS + 1;
  r.exec(["SET", "ideas:snap:lock", "x", "EX", 1]); clock.now += 2000;
  await store.served(new Date(clock.now));
  assert.ok(!r.zs("ideas:top").has(old.key) && !r.zs("ideas:status").has(old.key) && !r.zs("ideas:recent").has(old.key), "orphan counts swept");
  // After the deadline an old preview writes again with no TTL: the next daily sweep deletes it outright.
  const late = recOf("late shelf");
  r.exec(["HSETNX", "ideas:meta", late.key, JSON.stringify({ prompt: "late shelf" })]);
  clock.now += SWEEP_MS + 1;
  const ran = await store.sweep(new Date(clock.now));
  assert.ok(ran && !r.hs("ideas:meta").has(late.key), "deleted at once (HEXPIREAT in the past)");
});

test("the sweep runs at most once a day (its time rides in the stored snapshot), and costs about 10 commands", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  for (let i = 0; i < 5; i++) await store.record(recOf(`crate ${i}`), new Date(clock.now + i * 30_000));
  const sweeps = () => r.sent.filter((l) => l.some((c) => c[0] === "HKEYS")).length;
  for (let m = 0; m < 48 * 6; m++) { // every 10 min for two days, fresh instance each time
    clock.now += 600_000;
    await new IdeaStore(r.pipe, undefined, () => {}, async () => {}).served(new Date(clock.now));
  }
  assert.ok(sweeps() >= 2 && sweeps() <= 3, `sweeps in two days: ${sweeps()}`);
  const before = Number(r.str.get(`ideas:cmds:${new Date(clock.now).toISOString().slice(0, 7)}`));
  clock.now += SWEEP_MS;
  await new IdeaStore(r.pipe, undefined, () => {}, async () => {}).served(new Date(clock.now));
  const cost = Number(r.str.get(`ideas:cmds:${new Date(clock.now).toISOString().slice(0, 7)}`)) - before;
  assert.ok(cost <= 3 + 6 + 7 + 4, `one rebuild with its sweep: ${cost} commands`);
  const snap = JSON.parse(r.str.get("ideas:snap")!);
  assert.ok(typeof snap.swept === "string");
  const served = await new IdeaStore(r.pipe, undefined, () => {}, async () => {}).served(new Date(clock.now + 1000));
  assert.ok(!("swept" in served), "bookkeeping never served");
});

test("command cost per write is unchanged: WRITE_CMDS 9, the same commands with the TTL inside them", async () => {
  const clock = { now: Date.UTC(2026, 9, 21, 12) };
  const r = ttlRedis(clock);
  const store = new IdeaStore(r.pipe, undefined, () => {}, async () => {});
  await store.record(recOf("plain write"), new Date(clock.now));
  assert.equal(WRITE_CMDS, 9);
  assert.equal(r.sent[0].length, 9);
  assert.equal(Number(r.str.get("ideas:cmds:2026-10")), 9);
  assert.deepEqual(r.sent[0].map((c) => c[0]), ["INCRBY", "HSETEX", "ZINCRBY", "ZADD", "ZADD", "ZREMRANGEBYRANK", "HSETEX", "HINCRBY", "EXPIRE"]);
  // Feedback: gate 5 + write 3 = 8 per saved note (was 9, and 11 when the tail aged out).
  const shop = new ShopStore(r.pipe);
  const n0 = r.sent.flat().length;
  await shop.addFeedback(cleanFeedback({ chips: ["other"] }, "", new Date(clock.now))!, "none", new Date(clock.now));
  assert.equal(r.sent.flat().length - n0, 8);
  assert.equal(dayExpiry(new Date("2026-10-21T23:59:59Z")), Date.UTC(2026, 9, 21) / 1000 + RETAIN_S);
});

test("/api/critic-review: a missing or wrong secret is 404, never 401", async () => {
  const { Route } = await import("../src/routes/api/critic-review");
  const h = (Route as unknown as { options: { server: { handlers: Record<"GET" | "POST", (a: { request: Request }) => Promise<Response>> } } }).options.server.handlers;
  const req = (method: string, auth?: string) => new Request("https://yard.test/api/critic-review?op=unreviewed", { method, headers: auth ? { authorization: auth } : {}, body: method === "POST" ? JSON.stringify({ key: "aaaaaaaa", grade: "A" }) : undefined });
  const prev = process.env.CRITIC_REVIEW_SECRET;
  try {
    for (const env of [undefined, "short", "s".repeat(24)]) {
      if (env === undefined) delete process.env.CRITIC_REVIEW_SECRET; else process.env.CRITIC_REVIEW_SECRET = env;
      for (const m of ["GET", "POST"] as const) for (const auth of [undefined, "", "Bearer ", "Bearer wrong", `Bearer ${"s".repeat(23)}`, "s".repeat(24) + "x", `Basic ${"s".repeat(24)}`]) {
        const res = await h[m]({ request: req(m, auth) });
        assert.equal(res.status, 404, `${m} env=${env} auth=${auth}`);
      }
    }
    process.env.CRITIC_REVIEW_SECRET = "s".repeat(24);
    assert.equal((await h.GET({ request: req("GET", `Bearer ${"s".repeat(24)}`) })).status, 200, "the right secret still works");
  } finally {
    if (prev === undefined) delete process.env.CRITIC_REVIEW_SECRET; else process.env.CRITIC_REVIEW_SECRET = prev;
  }
  assert.doesNotMatch(fs.readFileSync("src/routes/api/critic-review.ts", "utf8"), /,\s*401\s*\)|status:\s*401/);
});
