/**
 * Upstash keys for build feedback and Critic's review marks. Outside src/lib/yard on purpose: it reuses the
 * engine's REST pipe and Budget by import, and changes none of the ideas log.
 * Feedback and review still count against `ideas:cmds:<month>`. Build events do not: they have their own
 * monthly counter (`ev:cmds:<month>`) so a flood of events cannot spend the Ideas or Tell-the-shop budget.
 * Missing env → every call is a no-op. Never throws.
 */
import { restPipe, Budget, RETAIN_DAYS, type Pipe } from "@/lib/yard/ideaLog.server";
import type { FeedbackRecord } from "./shop";
import type { EventRecord } from "./events";
import type { DigestBuild, DigestInput } from "./digest";

export const K = {
  budget: (m: string) => `ideas:cmds:${m}`,
  meta: "ideas:meta",
  recent: "ideas:recent",
  top: "ideas:top",
  review: "ideas:review", // field = query-log key → JSON ReviewMark; no field = not reviewed
  feedback: "feedback:list",
  day: (d: string) => `feedback:day:${d}`,
  client: (d: string, cid: string) => `feedback:cid:${d}:${cid}`, // a counter only, gone after a day
  ev: (d: string) => `ev:${d}`, // hash: field "<bid>|<event>|<detail>" → count, kept 3 days (the digest reads yesterday's)
  evCount: (d: string) => `ev:n:${d}`, // the day's event counter, for the hard cap
  evCmds: (m: string) => `ev:cmds:${m}`, // events' own monthly command counter. Not ideas:cmds.
  build: (bid: string, scope = "") => `bld:${scope}${bid}`, // JSON: scrubbed words and the server tip. First write wins, 85 days. Preview passes "preview:".
};
/**
 * Hard daily cap and the events month budget. Both are decided by one Redis EVAL (eventGateLua), not by
 * this process's memory, so a new instance and a burst of concurrent requests see the same counters.
 * At the month budget the script writes nothing and the counter stays put. The instance that saw that
 * remembers the month and answers later refusals with no command until the month rolls over.
 * A day-cap refusal does not increment ev:cmds.
 * 40,000 leaves the 50,000 gap between the shared 450K ideas guard and the 500K free tier.
 * Preview (VERCEL_ENV=preview) uses a separate key prefix so it cannot spend the production counters.
 */
export const EV_DAY_CAP = 1200;
export const EV_MONTH_BUDGET = 40_000;
export const EV_INSTANCE_PER_MIN = 60;
export const EV_KEEP_SECONDS = 3 * 86_400;
/** Builds the digest looks up per run (one MGET). */
export const DIGEST_BUILDS = 200;
export const FEEDBACK_KEEP = 2000;
/**
 * Feedback older than this is deleted on the next write and by the twice-daily cron. The same RETAIN_DAYS (85) as the
 * ideas log, so with the cron's worst gap (≤ 13 h) and run (≤ 5 min) a note is gone by 85 d 13 h 5 m (privacy page: 90).
 */
export const FEEDBACK_DAYS = RETAIN_DAYS;
/** Tail entries read per pass when ageing out; passes per write are capped so one write stays bounded. */
export const AGE_PAGE = 100;
export const AGE_PASSES = Math.ceil(FEEDBACK_KEEP / AGE_PAGE); // a fully stale list clears in one write
/** Review marks checked for a missing query-log entry per unreviewed read. */
export const ORPHAN_SWEEP = 20;
export const DAY_CAP = 300; // ≤ 300 × 11 cmds × 31 days ≈ 102K/month (9 per write, +2 when the tail ages out), inside the shared 450K budget
export const CLIENT_DAY_CAP = 10; // per anonymous browser id, so one noisy client can't spend the day's 300
export const INSTANCE_PER_MIN = 12;

const month = (now: Date) => now.toISOString().slice(0, 7);
const day = (now: Date) => now.toISOString().slice(0, 10);
/** Preview deploys share the store. Their events must not spend the production month. */
export const eventKeyScope = (env: Record<string, string | undefined> = process.env) => (env.VERCEL_ENV === "preview" ? "preview:" : "");

/**
 * One Redis command. Keys: ev:cmds month, ev:n day. Args: budget, day cap, spend if accepted, month ttl, day ttl.
 * Returns {ok, cmdsAfter, dayAfter}. ok is 1 only when a day slot was taken. At the month budget, cmds is unchanged.
 * Tests run this script with Lua 5.4. applyEventGate is the same decision for anything that cannot spawn Lua.
 */
export const EVENT_GATE_LUA = `
local budget = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
local spend = tonumber(ARGV[3])
local monthTtl = tonumber(ARGV[4])
local dayTtl = tonumber(ARGV[5])
local cmds = tonumber(redis.call('GET', KEYS[1]) or '0')
if cmds >= budget then
  return {0, cmds, 0}
end
local day = tonumber(redis.call('GET', KEYS[2]) or '0')
if day >= cap then
  return {0, cmds, day}
end
if (cmds + spend) > budget then
  cmds = redis.call('INCRBY', KEYS[1], 1)
  if monthTtl > 0 then redis.call('EXPIRE', KEYS[1], monthTtl) end
  return {0, cmds, day}
end
local slot = redis.call('INCR', KEYS[2])
if slot > cap then
  redis.call('DECR', KEYS[2])
  return {0, cmds, cap}
end
if dayTtl > 0 then redis.call('EXPIRE', KEYS[2], dayTtl) end
cmds = redis.call('INCRBY', KEYS[1], spend)
if monthTtl > 0 then redis.call('EXPIRE', KEYS[1], monthTtl) end
return {1, cmds, slot}
`;

/** Digest and other event reads reserve budget only. They do not take a day slot. */
export const EVENT_BUDGET_LUA = `
local budget = tonumber(ARGV[1])
local spend = tonumber(ARGV[2])
local monthTtl = tonumber(ARGV[3])
local cmds = tonumber(redis.call('GET', KEYS[1]) or '0')
if cmds >= budget then
  return {0, cmds}
end
if (cmds + spend) > budget then
  cmds = redis.call('INCRBY', KEYS[1], 1)
  if monthTtl > 0 then redis.call('EXPIRE', KEYS[1], monthTtl) end
  return {0, cmds}
end
cmds = redis.call('INCRBY', KEYS[1], spend)
if monthTtl > 0 then redis.call('EXPIRE', KEYS[1], monthTtl) end
return {1, cmds}
`;

/** The same decision as EVENT_GATE_LUA, for the test double. Mutates kv the way the script mutates Redis. */
export function applyEventGate(
  kv: { get(k: string): unknown; set(k: string, v: number): void },
  cmdsKey: string,
  dayKey: string,
  budget: number,
  cap: number,
  spend: number,
): [number, number, number] {
  const cmds = Number(kv.get(cmdsKey) ?? 0);
  if (cmds >= budget) return [0, cmds, 0];
  const dayn = Number(kv.get(dayKey) ?? 0);
  if (dayn >= cap) return [0, cmds, dayn];
  if (cmds + spend > budget) {
    const n = cmds + 1;
    kv.set(cmdsKey, n);
    return [0, n, dayn];
  }
  const slot = dayn + 1;
  if (slot > cap) return [0, cmds, cap];
  kv.set(dayKey, slot);
  const n = cmds + spend;
  kv.set(cmdsKey, n);
  return [1, n, slot];
}

export type ReviewMark = { reviewed: boolean; grade: string | null; reviewedAt: string | null; lastSampledAt: string | null };
export type ReviewRow = { key: string; prompt: string; size: string; resultKey: string } & ReviewMark;
export const GRADE = /^[A-Za-z0-9+-]{1,8}$/;

export class ShopStore {
  private hits: number[] = [];
  constructor(private pipe: Pipe | null = restPipe(), readonly budget = new Budget()) {}
  get live() { return !!this.pipe; }

  private async run(n: number, cmds: (string | number)[][], now: Date): Promise<unknown[] | null> {
    if (!this.pipe || !this.budget.allows(n, now)) return null;
    try {
      const out = await this.pipe([["INCRBY", K.budget(month(now)), n], ...cmds]);
      this.budget.saw(Number(out?.[0]));
      return out ? out.slice(1) : null;
    } catch { return null; }
  }

  private evHits: number[] = [];
  /** Month (YYYY-MM) this instance has seen with ev:cmds already spent. Later refusals send nothing until it rolls over. */
  private evMonthSpent = "";
  /** UTC day (YYYY-MM-DD) this instance has seen at the day cap. Later refusals send nothing until the next day. */
  private evDaySpent = "";

  /** Month and day keys. Preview is a separate pair so it cannot spend production. */
  private evKeys(now: Date) {
    const scope = eventKeyScope();
    const d = day(now);
    return { cmds: `ev:cmds:${scope}${month(now)}`, day: `ev:n:${scope}${d}`, hash: `ev:${scope}${d}` };
  }

  /**
   * A build event, counted per build and detail for the day. The month budget and the day cap are one
   * atomic Redis script, shared by every instance. A build event stores the scrubbed words only (first write wins).
   * No address is read.
   */
  async addEvent(rec: EventRecord, now = new Date()): Promise<"saved" | "off" | "limited" | "dropped"> {
    if (!this.pipe) return "off";
    const m = month(now);
    const d = day(now);
    if (this.evMonthSpent === m || this.evDaySpent === d) return "limited";
    const t = now.getTime();
    this.evHits = this.evHits.filter((x) => t - x < 60_000);
    if (this.evHits.length >= EV_INSTANCE_PER_MIN) return "limited";
    this.evHits.push(t);
    const keys = this.evKeys(now);
    const field = `${rec.bid}|${rec.ev}|${rec.detail}`;
    const follow: (string | number)[][] = [["HINCRBY", keys.hash, field, 1], ["EXPIRE", keys.hash, EV_KEEP_SECONDS]];
    if (rec.build) follow.push(["SET", K.build(rec.bid, eventKeyScope()), JSON.stringify({ ...rec.build, first: rec.at }), "NX", "EX", FEEDBACK_DAYS * 86_400]);
    const spend = 1 + follow.length;
    let gate: unknown[] | null;
    try {
      gate = await this.pipe([["EVAL", EVENT_GATE_LUA, 2, keys.cmds, keys.day, EV_MONTH_BUDGET, EV_DAY_CAP, spend, 40 * 86_400, EV_KEEP_SECONDS]]);
    } catch { return "dropped"; }
    if (!gate) return "dropped";
    const row = gate[0];
    const ok = Array.isArray(row) ? Number(row[0]) : Number(row);
    if (ok !== 1) {
      const cmdsAfter = Array.isArray(row) ? Number(row[1] ?? 0) : 0;
      const dayAfter = Array.isArray(row) ? Number(row[2] ?? 0) : 0;
      if (cmdsAfter >= EV_MONTH_BUDGET) this.evMonthSpent = m;
      else if (dayAfter >= EV_DAY_CAP) this.evDaySpent = d;
      return "limited";
    }
    try {
      const wrote = await this.pipe(follow);
      return wrote ? "saved" : "dropped";
    } catch { return "dropped"; }
  }

  /** Reserve n event-budget commands, or null when the month is spent. Does not touch the day cap or ideas:cmds. */
  private async evSpend(n: number, cmds: (string | number)[][], now: Date): Promise<unknown[] | null> {
    if (!this.pipe) return null;
    const m = month(now);
    if (this.evMonthSpent === m) return null;
    const keys = this.evKeys(now);
    let gate: unknown[] | null;
    try {
      gate = await this.pipe([["EVAL", EVENT_BUDGET_LUA, 1, keys.cmds, EV_MONTH_BUDGET, n, 40 * 86_400]]);
    } catch { return null; }
    if (!gate) return null;
    const row = gate[0];
    const ok = Array.isArray(row) ? Number(row[0]) : Number(row);
    if (ok !== 1) {
      const cmdsAfter = Array.isArray(row) ? Number(row[1] ?? 0) : 0;
      if (cmdsAfter >= EV_MONTH_BUDGET) this.evMonthSpent = m;
      return null;
    }
    try { return await this.pipe(cmds); } catch { return null; }
  }

  /**
   * The digest's read: the feedback list, the day's events, and what the digest shows for each build that has a
   * thumbs-down, a note, an export or a Buy click (at most DIGEST_BUILDS). Budgeted like every other call; read-only.
   */
  async digestInput(dayStr: string, now = new Date()): Promise<DigestInput | null> {
    if (!this.pipe) return null;
    const scope = eventKeyScope();
    const got = await this.evSpend(3, [["LRANGE", K.feedback, 0, FEEDBACK_KEEP - 1], ["HGETALL", `ev:${scope}${dayStr}`]], now);
    if (!got) return null;
    const feedback = ((got[0] as string[] | null) ?? []).flatMap((x) => { try { return [JSON.parse(x)]; } catch { return []; } });
    const flat = (got[1] as string[] | null) ?? [];
    const events: Record<string, number> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) events[flat[i]] = Number(flat[i + 1]) || 0;
    const want = new Set<string>();
    for (const f of Object.keys(events)) if (!/\|build\|/.test(f)) want.add(f.split("|")[0]);
    for (const f of feedback) if (f.bid && String(f.at).slice(0, 10) === dayStr) want.add(f.bid);
    const bids = [...want].slice(0, DIGEST_BUILDS);
    const builds: Record<string, DigestBuild | null> = {};
    if (bids.length) {
      const b = await this.evSpend(2, [["MGET", ...bids.map((bid) => K.build(bid, scope))]], now);
      const vals = (b?.[0] as (string | null)[] | null) ?? [];
      bids.forEach((bid, i) => { try { builds[bid] = vals[i] ? (JSON.parse(vals[i]!) as DigestBuild) : null; } catch { builds[bid] = null; } });
    }
    return { day: dayStr, feedback, events, builds };
  }

  /** Per-instance limiter (no IP: a plain sliding minute over all callers). */
  allowLocal(now = Date.now()): boolean {
    this.hits = this.hits.filter((t) => now - t < 60_000);
    if (this.hits.length >= INSTANCE_PER_MIN) return false;
    this.hits.push(now);
    return true;
  }

  async addFeedback(rec: FeedbackRecord, cid = "none", now = new Date()): Promise<"saved" | "off" | "limited" | "dropped"> {
    if (!this.pipe) return "off";
    if (!this.allowLocal(now.getTime())) return "limited";
    const d = day(now);
    const gate = await this.run(5, [["INCR", K.client(d, cid)], ["EXPIRE", K.client(d, cid), 86_400], ["INCR", K.day(d)], ["EXPIRE", K.day(d), 172_800]], now);
    if (!gate) return "dropped";
    if (Number(gate[0]) > CLIENT_DAY_CAP || Number(gate[2]) > DAY_CAP) return "limited";
    // The write, the 2,000 cap, and a look at the oldest entries (the list is newest-first, so the tail is the oldest).
    const out = await this.run(4, [["LPUSH", K.feedback, JSON.stringify(rec)], ["LTRIM", K.feedback, 0, FEEDBACK_KEEP - 1], ["LRANGE", K.feedback, -AGE_PAGE, -1]], now);
    if (!out) return "dropped";
    await this.ageOut(out[2] as string[] | null, now);
    return "saved";
  }

  /**
   * Retention: trims tail entries older than FEEDBACK_DAYS. Normally the tail read rode along with the
   * write and at most one LTRIM follows; after a long quiet spell it pages through (≤ AGE_PASSES), all budgeted.
   */
  private async ageOut(tail: string[] | null, now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - FEEDBACK_DAYS * 86_400_000).toISOString();
    for (let pass = 0; pass < AGE_PASSES && tail?.length; pass++) {
      const old = staleTail(tail, cutoff);
      if (!old) return;
      if (old < tail.length || tail.length < AGE_PAGE) {
        await this.run(2, [["LTRIM", K.feedback, 0, -(old + 1)]], now);
        return;
      }
      // The whole page was stale: drop it and look at the next one in the same pipeline.
      const next = await this.run(3, [["LTRIM", K.feedback, 0, -(old + 1)], ["LRANGE", K.feedback, -AGE_PAGE, -1]], now);
      tail = (next?.[1] as string[] | null) ?? null;
    }
  }

  /**
   * The daily cron's half for feedback: the same 90-day tail trim, without waiting for a new note (so a quiet spell
   * can't keep old notes). One tail read, then ageOut as on a write; budgeted. Returns the commands it was allowed.
   */
  async sweep(now = new Date()): Promise<void> {
    const tail = await this.run(2, [["LRANGE", K.feedback, -AGE_PAGE, -1]], now);
    if (tail) await this.ageOut(tail[0] as string[] | null, now);
  }

  /** Review marks whose query-log entry is gone (no field in ideas:meta) are deleted. Budgeted; never throws. */
  private async dropOrphans(keys: string[], metas: (string | null)[], now: Date): Promise<number> {
    const gone = keys.filter((_, i) => !metas[i]);
    if (gone.length) await this.run(2, [["HDEL", K.review, ...gone]], now);
    return gone.length;
  }

  /** A random handful of review marks, checked against the query log (the unreviewed read's housekeeping). */
  async sweepOrphans(n = ORPHAN_SWEEP, now = new Date()): Promise<number> {
    const pick = await this.run(2, [["HRANDFIELD", K.review, n]], now);
    const keys = ((pick?.[0] as string[]) ?? []).filter(Boolean);
    if (!keys.length) return 0;
    const got = await this.run(2, [["HMGET", K.meta, ...keys]], now);
    if (!got) return 0;
    return this.dropOrphans(keys, (got[0] as (string | null)[]) ?? [], now);
  }

  /** Query-log entries (recent first, then most-built) with no review mark yet. */
  async unreviewed(limit = 20, now = new Date()): Promise<ReviewRow[]> {
    const ids = await this.run(3, [["ZREVRANGE", K.recent, 0, 199], ["ZREVRANGE", K.top, 0, 499]], now);
    if (!ids) return [];
    const keys = [...new Set([...((ids[0] as string[]) ?? []), ...((ids[1] as string[]) ?? [])])];
    if (!keys.length) return [];
    const got = await this.run(3, [["HMGET", K.review, ...keys], ["HMGET", K.meta, ...keys]], now);
    if (!got) return [];
    const marks = (got[0] as (string | null)[]) ?? [];
    const metas = (got[1] as (string | null)[]) ?? [];
    const rows: ReviewRow[] = [];
    keys.forEach((key, i) => {
      if (marks[i] || !metas[i] || rows.length >= limit) return;
      const m = parseMeta(metas[i]);
      if (m) rows.push({ key, ...m, reviewed: false, grade: null, reviewedAt: null, lastSampledAt: null });
    });
    await this.sweepOrphans(ORPHAN_SWEEP, now);
    return rows;
  }

  async mark(key: string, grade: string, now = new Date()): Promise<"marked" | "unknown" | "off"> {
    if (!this.pipe) return "off";
    const has = await this.run(2, [["HEXISTS", K.meta, key]], now);
    if (!has || Number(has[0]) !== 1) return "unknown";
    const prev = await this.run(2, [["HGET", K.review, key]], now);
    const old = prev?.[0] ? (JSON.parse(String(prev[0])) as ReviewMark) : null;
    const mark: ReviewMark = { reviewed: true, grade, reviewedAt: now.toISOString(), lastSampledAt: old?.lastSampledAt ?? null };
    return (await this.run(2, [["HSET", K.review, key, JSON.stringify(mark)]], now)) ? "marked" : "off";
  }

  /** A random sample of reviewed entries; stamps lastSampledAt on each. */
  async sample(n = 5, now = new Date()): Promise<ReviewRow[]> {
    const pick = await this.run(2, [["HRANDFIELD", K.review, Math.min(Math.max(1, n), 25)]], now);
    const keys = ((pick?.[0] as string[]) ?? []).filter(Boolean);
    if (!keys.length) return [];
    const got = await this.run(3, [["HMGET", K.review, ...keys], ["HMGET", K.meta, ...keys]], now);
    if (!got) return [];
    await this.dropOrphans(keys, (got[1] as (string | null)[]) ?? [], now); // marks whose log entry is gone
    const at = now.toISOString();
    const rows: ReviewRow[] = [];
    const sets: (string | number)[] = [];
    keys.forEach((key, i) => {
      const meta = parseMeta((got[1] as (string | null)[])[i]);
      const raw = (got[0] as (string | null)[])[i];
      if (!meta || !raw) return;
      const mark = { ...(JSON.parse(raw) as ReviewMark), lastSampledAt: at };
      rows.push({ key, ...meta, ...mark });
      sets.push(key, JSON.stringify(mark));
    });
    if (sets.length) await this.run(2, [["HSET", K.review, ...sets]], now);
    return rows;
  }
}

/** How many entries at the end of a newest-first tail are older than `cutoff` (unreadable entries count as stale). */
export function staleTail(tail: string[], cutoff: string): number {
  let n = 0;
  for (let i = tail.length - 1; i >= 0; i--) {
    let at = "";
    try { at = String((JSON.parse(tail[i]) as { at?: unknown }).at ?? ""); } catch { /* unreadable → stale */ }
    if (at && at >= cutoff) break;
    n++;
  }
  return n;
}

function parseMeta(s: string | null): { prompt: string; size: string; resultKey: string } | null {
  if (!s) return null;
  try {
    const m = JSON.parse(s) as { prompt?: string; size?: string; resultKey?: string };
    return typeof m.prompt === "string" ? { prompt: m.prompt, size: m.size ?? "", resultKey: m.resultKey ?? "" } : null;
  } catch { return null; }
}

let shared: ShopStore | undefined;
export const shopStore = () => (shared ??= new ShopStore());
