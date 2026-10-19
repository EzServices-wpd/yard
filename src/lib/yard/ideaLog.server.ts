/**
 * Endless Ideas store (specs/004-ideas R4, R7): Upstash Redis over its REST API, no SDK.
 * - Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the Marketplace's KV_REST_API_URL + KV_REST_API_TOKEN).
 *   Missing env → every call is a no-op, so previews and CI work without the store.
 * - Budget guard: a monthly command counter in Redis; logging stops at BUDGET (90% of the 500K free tier).
 * - Never throws: a store error, timeout or quota hit drops the write and is counted in `stats`.
 */
import { EMPTY_SNAPSHOT, STATUS_RANK, logKey, safePrompt, trustedPopular, type IdeasSnapshot, type LogRecord, type LogSource, type LogStatus, type SnapshotRow } from "./ideaLog";

export const FREE_TIER = 500_000;
export const BUDGET = 450_000;
export const WRITE_CMDS = 10; // most a write sends: INCRBY budget + HSETNX meta + ZINCRBY top + ZADD GT status + ZADD recent + ZREMRANGEBYSCORE recent (time trim, #39) + HSET stamp + HINCRBY burst site + EXPIRE burst + HMGET previous burst bucket
/**
 * #39 + #83 merged: ideas:recent is trimmed by time on every write (#39's ZREMRANGEBYSCORE); #83's every-8th
 * ZREMRANGEBYRANK size trim (TRIM_EVERY) is dropped. The one command a write only sometimes sends:
 * - EXPIRE burst: on the instance's first write into each minute's bucket (TTL 120 s from then, which still covers
 *   the next minute's read of it as the previous bucket).
 * Typical write: WRITE_CMDS − 1 (+ RUN_CMDS). RECENT_MAX is how many of the newest recent rows the snapshot reads.
 */
export const RECENT_MAX = 200;
/** One more when the client sent a run id (HINCRBY burst run:<id>). */
export const RUN_CMDS = 1;
/**
 * A write inside a burst, in a second pipeline:
 * - a row's first write: INCRBY budget + HINCRBY ideas:ptest + HEXPIRE + HSET stamp "possible-test" (BURST_NEW_CMDS);
 * - a row written before: INCRBY budget + HINCRBY ideas:ptest + HEXPIRE (BURST_FIX_CMDS). If every earlier write was a
 *   possible-test write too, a third pipeline re-stamps it (BURST_STAMP_CMDS). A row that has had a live write stays
 *   live: a later possible-test write only bumps its ideas:ptest count, never its source.
 */
export const BURST_FIX_CMDS = 3;
export const BURST_NEW_CMDS = 4;
export const BURST_STAMP_CMDS = 2;
/**
 * Burst rate, counted on the server only: written builds per 60 s bucket, site-wide and per run id, in one
 * short-lived hash (EXPIRE 120 s). The window slides: the previous bucket is weighted in by how much of it still
 * falls inside the last 60 s (burstRate), so a burst spread across a minute boundary is still seen. The counter is
 * never stored with a row; only the stamp's source changes.
 */
export const BURST_WINDOW_S = 60;
export const SITE_BURST = 60; // more than 60 written builds site-wide in one minute
export const RUN_BURST = 10; // more than 10 written builds from one run id in one minute
/** Sliding 60 s rate: the previous bucket × the part of it still inside the window + the current bucket. */
export function burstRate(prev: number, cur: number, now: Date): number {
  const w = BURST_WINDOW_S * 1000;
  const elapsed = (now.getTime() % w) / w;
  return (Number.isFinite(cur) ? cur : 0) + (Number.isFinite(prev) ? prev : 0) * (1 - elapsed);
}
const RUN_ID = /^[a-z0-9]{8,32}$/i;
export const runIdOf = (v: unknown): string | null => (typeof v === "string" && RUN_ID.test(v) ? v : null);
export const READ_CMDS = 6;
const COALESCE_MS = 10_000;
export const SNAPSHOT_MS = 600_000;
const TIMEOUT_MS = 1500;
/**
 * Retention (privacy page: "We delete saved prompts and feedback notes after 90 days"; SWE's design).
 * - ideas:recent (row key → last-seen ms) is trimmed by time on every write: ZREMRANGEBYSCORE −inf (now − RETAIN).
 * - A row's last-seen is max(its recent score, its stamp's `at`); a row with neither (logged before stamps, 15–17 Oct)
 *   counts as last seen at LEGACY_SINCE. The daily cron sweep (/api/cron/retention → sweep()) drops every row whose
 *   last-seen is past RETAIN from all of ideas:meta, top, status, stamp, recent (and Critic's ideas:review mark and
 *   #83's ideas:ptest count, a no-op while that key doesn't exist)
 *   together, in one pipeline, so nothing is left orphaned.
 * - RETAIN_DAYS is 85, not 90 (Critic 10-17: every copy gone by day 90, with margin). Worst case for a row last seen
 *   at T: stale at T + 85 d; the cron runs twice a day, each within its hour (Hobby), so the next run starts ≤ 12 h 59 m
 *   59 s later and one run finishes a full pass (≤ 5 min, see SWEEP_MAX_CMDS) → gone from Redis by T + 85 d 13 h 5 m.
 *   Copies after that: the stored snapshot (≤ 1 h old when served) + the instance memo (10 min) + the CDN copy of
 *   /api/ideas and /ideas (s-maxage 1 h + stale-while-revalidate 24 h) = 26 h 10 m → T + 86 d 15 h 15 m, 3 d 8 h 45 m
 *   inside 90. Each missed, failed or short cron run adds ≤ 13 h: still inside 90 with 6 of them in a row.
 *   Feedback notes use the same RETAIN_DAYS and have no cache: gone by T + 85 d 13 h 5 m.
 */
export const RETAIN_DAYS = 85;
export const RETAIN_MS = RETAIN_DAYS * 86_400_000;
/** The ideas log first shipped in c78a268 (15 Oct 2026); the store was made that day. No row is older. */
export const LEGACY_SINCE = Date.parse("2026-10-15T00:00:00Z");
/**
 * Sweep caps: rows read per page (ZSCAN COUNT) and Upstash commands per run (a capped run saves its cursor and the
 * next run resumes). Sized so one run always finishes a full pass: writes stop at BUDGET and a new row costs ≥ 9
 * commands, so ≤ 50,000 new rows a month and ≤ 200,000 in any 88 days (4 calendar months) = ≤ 100 pages. Every row
 * stale: GET cursor 2 + 100 × 13 + DEL cursor 2 = 1,304 ≤ 1,500; all fresh: 504.
 */
export const SWEEP_BATCH = 2000;
export const SWEEP_MAX_CMDS = 1500;
/** Commands per sweep page: INCRBY + ZSCAN, INCRBY + ZMSCORE + HMGET; +8 (INCRBY + 7 deletes) when it drops rows. */
export const SWEEP_PAGE_CMDS = 5;
export const SWEEP_DROP_CMDS = 8;
// ideas:burst:<minute> lives 120 s and holds counts only (field "site" and "run:<id>"), never a prompt or row key.
/**
 * ideas:ptest counts a row's possible-test writes (row key → count, no text), for the sticky-live rule. Every count
 * write carries its expiry: HEXPIRE on that one field, PTEST_TTL_S (85 days, #39's RETAIN_DAYS), refreshed by each
 * possible-test write (Upstash hashes take a TTL per field). A field only lapses after 85 days with no possible-test
 * write; the row's ideas:top count then outweighs it, so the row reads as having had live writes and a later burst
 * only counts, never re-stamps (the safe side: a lapse can't turn a live row into test traffic).
 */
export const PTEST_TTL_S = 85 * 86_400;
const ptestCount = (key: string, n: number): Cmd[] => [["HINCRBY", K.ptest, key, n], ["HEXPIRE", K.ptest, PTEST_TTL_S, "FIELDS", 1, key]];
const bucket = (now: Date) => Math.floor(now.getTime() / (BURST_WINDOW_S * 1000));
const K = { review: "ideas:review", cursor: "ideas:sweep:cursor", snap: "ideas:snap", lock: "ideas:snap:lock", budget: (m: string) => `ideas:cmds:${m}`, meta: "ideas:meta", top: "ideas:top", status: "ideas:status", recent: "ideas:recent", stamp: "ideas:stamp", ptest: "ideas:ptest", burst: (now: Date, back = 0) => `ideas:burst:${bucket(now) - back}` };

type Cmd = (string | number)[];
export type Pipe = (cmds: Cmd[]) => Promise<unknown[] | null>;
export const stats = { dropped: 0, overBudget: 0, written: 0, coalesced: 0, possibleTest: 0, stayedLive: 0, swept: 0 };

export function storeEnv(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

/** The REST pipeline, or null (no-op) when the store isn't configured. */
export function restPipe(env = storeEnv()): Pipe | null {
  if (!env) return null;
  return async (cmds) => {
    const res = await fetch(`${env.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`store ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r, i) => {
      if (!r.error) return r.result;
      warnRejected(cmds[i]);
      return null;
    });
  };
}

/**
 * A rejected command in a pipeline (e.g. HEXPIRE if the store didn't support it) is otherwise silent: Upstash
 * pipelines aren't transactions, so the rest still applies and the entry reads as null. Log one line per rejected
 * command with only its name and key prefix ("HEXPIRE ideas:ptest"); never the error text, values, fields, prompt
 * text, tokens or the URL. Anything that isn't a plain lowercase key prefix logs as "?".
 */
export function rejectedLine(cmd: Cmd | undefined): string {
  const name = typeof cmd?.[0] === "string" && /^[A-Z]{1,20}$/i.test(cmd[0]) ? cmd[0].toUpperCase() : "?";
  const prefix = typeof cmd?.[1] === "string" ? (/^[a-z][a-z0-9_-]{0,30}(:[a-z][a-z0-9_-]{0,30})?(?=:|$)/.exec(cmd[1])?.[0] ?? "?") : "?";
  return `[ideas] store rejected ${name} ${prefix}`;
}
const warnRejected = (cmd: Cmd | undefined) => console.warn(rejectedLine(cmd));

const month = (now: Date) => now.toISOString().slice(0, 7);

/** The guard: known command use this month, learned from every reply (no extra read). */
export class Budget {
  used = 0;
  month = "";
  constructor(readonly limit = BUDGET) {}
  allows(n: number, now = new Date()): boolean {
    const m = month(now);
    if (m !== this.month) { this.month = m; this.used = 0; }
    return this.used + n <= this.limit;
  }
  saw(total: number) { if (Number.isFinite(total)) this.used = Math.max(this.used, total); }
}

export class IdeaStore {
  private pending = new Map<string, { rec: LogRecord; n: number; last: number; timer?: boolean; ptest?: boolean }>();
  /**
   * F34: `hold` keeps the function alive until a held burst is written (Vercel waitUntil in prod);
   * `wait` is the timer (injectable for tests).
   */
  constructor(
    private pipe: Pipe | null,
    readonly budget = new Budget(),
    private hold: (p: Promise<unknown>) => void = defaultHold,
    private wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}
  get live() { return !!this.pipe; }
  /** Writes this instance has sent and the last burst bucket it set a TTL on. */
  private writes = 0;
  private ttlBucket = -1;

  /** R4/R7: one pipelined write; repeats of a key within 10 s on this instance fold into one increment. Never throws. */
  async record(rec: LogRecord, now = new Date(), opts: { run?: string | null } = {}): Promise<"written" | "coalesced" | "off" | "over-budget" | "dropped"> {
    if (!this.pipe) return "off";
    const p = this.pending.get(rec.key);
    if (p && now.getTime() - p.last < COALESCE_MS) {
      p.n++;
      if (STATUS_RANK[rec.status] > STATUS_RANK[p.rec.status]) p.rec = rec;
      stats.coalesced++;
      // F34: the held count is written when its window ends, even if no request follows.
      if (!p.timer) {
        p.timer = true;
        const end = p.last + COALESCE_MS;
        this.hold(this.wait(Math.max(0, end - now.getTime())).then(() => this.flush(rec.key, new Date(end))));
      }
      return "coalesced";
    }
    const n = (p?.n ?? 0) + 1;
    const run = runIdOf(opts.run);
    const ttl = this.ttlBucket !== bucket(now);
    const cmds = WRITE_CMDS - (ttl ? 0 : 1) + (run ? RUN_CMDS : 0);
    if (!this.budget.allows(cmds, now)) { stats.overBudget++; return "over-budget"; }
    this.pending.set(rec.key, { rec, n: 0, last: now.getTime() });
    if (this.pending.size > 5000) this.pending.clear();
    try {
      const meta = JSON.stringify({ prompt: rec.prompt, size: rec.size, resultKey: rec.resultKey });
      const source = rec.source ?? "unknown";
      const stamp = (s: string) => JSON.stringify({ at: now.toISOString(), source: s });
      const burst = K.burst(now);
      const list: Cmd[] = [
        ["INCRBY", K.budget(month(now)), cmds],
        // Latest wins: a row logged at an older size says the size built now. A test-source write never touches meta
        // (a read in its slot keeps the command count and every reply's position).
        source === "test" ? ["HEXISTS", K.meta, rec.key] : ["HSET", K.meta, rec.key, meta],
        ["ZINCRBY", K.top, n, rec.key],
        ["ZADD", K.status, "GT", STATUS_RANK[rec.status], rec.key], // R5: status only moves up
        ["ZADD", K.recent, now.getTime(), rec.key],
        ["ZREMRANGEBYSCORE", K.recent, "-inf", now.getTime() - RETAIN_MS], // time trim: last-seen older than RETAIN
        ["HSET", K.stamp, rec.key, stamp(source)], // request time + gate source
      ];
      const at = (c: Cmd) => list.push(c) - 1;
      const iSite = at(["HINCRBY", burst, "site", 1]);
      if (ttl) list.push(["EXPIRE", burst, BURST_WINDOW_S * 2]);
      const iRun = run ? at(["HINCRBY", burst, `run:${run}`, 1]) : -1;
      const iPrev = at(["HMGET", K.burst(now, 1), "site", ...(run ? [`run:${run}`] : [])]); // the previous minute, for the sliding window
      const out = await this.pipe(list);
      this.writes++;
      if (ttl) this.ttlBucket = bucket(now);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
      // Burst: this write's own count says so (no lag), so its stamp is settled in the same request.
      const prev = (out?.[iPrev] as (string | null)[] | null) ?? [];
      const site = burstRate(Number(prev[0] ?? 0), Number(out?.[iSite]), now);
      const perRun = run ? burstRate(Number(prev[1] ?? 0), Number(out?.[iRun]), now) : 0;
      if (source === "live" && (site > SITE_BURST || perRun > RUN_BURST)) await this.possibleTest(rec.key, n, Number(out?.[2]), stamp("possible-test"), now);
      return "written";
    } catch {
      stats.dropped++;
      return "dropped";
    }
  }

  /**
   * A live-gated write inside a burst. Sticky live: a row that has had a live write keeps its source, and the write
   * only adds to the row's possible-test count. `total` is the row's count after this write (ZINCRBY's reply);
   * total − possible-test count > 0 means some earlier write was live. Never throws.
   */
  private async possibleTest(key: string, n: number, total: number, stamp: string, now: Date): Promise<void> {
    const p = this.pending.get(key);
    if (p) p.ptest = true; // its held repeats count as possible-test too
    try {
      if (Number.isFinite(total) && total <= n) { // the row's first write: count and stamp in one pipeline
        if (!this.budget.allows(BURST_NEW_CMDS, now)) { stats.overBudget++; return; }
        stats.possibleTest++;
        const fix = await this.pipe!([["INCRBY", K.budget(month(now)), BURST_NEW_CMDS], ...ptestCount(key, n), ["HSET", K.stamp, key, stamp]]);
        this.budget.saw(Number(fix?.[0]));
        return;
      }
      if (!this.budget.allows(BURST_FIX_CMDS, now)) { stats.overBudget++; return; }
      const fix = await this.pipe!([["INCRBY", K.budget(month(now)), BURST_FIX_CMDS], ...ptestCount(key, n)]);
      this.budget.saw(Number(fix?.[0]));
      const ptest = Number(fix?.[1]);
      // An unreadable count keeps the row as it is (never flips on doubt).
      if (!Number.isFinite(total) || !Number.isFinite(ptest) || total - ptest > 0) { stats.stayedLive++; return; }
      if (!this.budget.allows(BURST_STAMP_CMDS, now)) { stats.overBudget++; return; }
      stats.possibleTest++;
      const st = await this.pipe!([["INCRBY", K.budget(month(now)), BURST_STAMP_CMDS], ["HSET", K.stamp, key, stamp]]);
      this.budget.saw(Number(st?.[0]));
    } catch { stats.dropped++; }
  }

  /** F34: write a key's held repeats (if any) as one increment. Never throws. */
  async flush(key: string, now = new Date()): Promise<void> {
    const p = this.pending.get(key);
    if (!p || !this.pipe) return;
    p.timer = false;
    const n = p.n;
    if (!n) return;
    const cmds = p.ptest ? 5 : 3; // held repeats of a possible-test write add to its possible-test count (+ its TTL)
    if (!this.budget.allows(cmds, now)) { stats.overBudget++; return; }
    p.n = 0;
    p.last = now.getTime();
    try {
      const out = await this.pipe([["INCRBY", K.budget(month(now)), cmds], ["ZINCRBY", K.top, n, key], ["ZADD", K.status, "GT", STATUS_RANK[p.rec.status], key], ...(p.ptest ? ptestCount(key, n) : [])]);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
    } catch { stats.dropped++; }
  }

  /**
   * The daily retention sweep (cron). Walks ideas:top (every row is in it) with ZSCAN, SWEEP_BATCH at a time, reads
   * each row's last-seen (recent score, stamp `at`) and drops the stale rows from all eight keys in one pipeline.
   * Stops before `maxCmds` (budgeted like every write) and keeps its cursor in ideas:sweep:cursor (EX 2 d), so a
   * capped run resumes where it stopped the next day. Never throws.
   */
  async sweep(now = new Date(), opts: { batch?: number; maxCmds?: number } = {}): Promise<{ scanned: number; dropped: number; cmds: number; done: boolean }> {
    const batch = opts.batch ?? SWEEP_BATCH, maxCmds = opts.maxCmds ?? SWEEP_MAX_CMDS;
    const res = { scanned: 0, dropped: 0, cmds: 0, done: false };
    if (!this.pipe) return { ...res, done: true };
    const b = K.budget(month(now));
    const run = async (cmds: Cmd[]) => {
      const n = cmds.length + 1;
      if (res.cmds + n > maxCmds || !this.budget.allows(n, now)) return null;
      res.cmds += n;
      const out = await this.pipe!([["INCRBY", b, n], ...cmds]);
      this.budget.saw(Number(out?.[0]));
      return out ? out.slice(1) : null;
    };
    try {
      const start = await run([["GET", K.cursor]]);
      if (!start) return res;
      let cursor = typeof start[0] === "string" && start[0] ? start[0] : "0";
      const cutoff = now.getTime() - RETAIN_MS;
      do {
        // A page and its drop must both fit; otherwise stop here and resume tomorrow.
        if (res.cmds + SWEEP_PAGE_CMDS + SWEEP_DROP_CMDS + 2 > maxCmds) break;
        const page = await run([["ZSCAN", K.top, cursor, "COUNT", batch]]);
        if (!page) break;
        const [next, flat] = (page[0] as [string, string[]]) ?? ["0", []];
        const keys = [...new Set((flat ?? []).filter((_, i) => i % 2 === 0))];
        res.scanned += keys.length;
        if (keys.length) {
          const seen = await run([["ZMSCORE", K.recent, ...keys], ["HMGET", K.stamp, ...keys]]);
          if (!seen) break;
          const scores = (seen[0] as (string | null)[]) ?? [], stamps = (seen[1] as (string | null)[]) ?? [];
          const stale = keys.filter((_, i) => lastSeen(scores[i], stamps[i]) < cutoff);
          if (stale.length) {
            const del = await run([["HDEL", K.meta, ...stale], ["ZREM", K.top, ...stale], ["ZREM", K.status, ...stale], ["HDEL", K.stamp, ...stale], ["ZREM", K.recent, ...stale], ["HDEL", K.review, ...stale], ["HDEL", K.ptest, ...stale]]);
            if (!del) break;
            res.dropped += stale.length;
          }
        }
        cursor = String(next ?? "0");
      } while (cursor !== "0");
      res.done = cursor === "0";
      // Remember where a capped run stopped (one SET; skipped if even that won't fit: the next run starts over).
      await run(res.done ? [["DEL", K.cursor]] : [["SET", K.cursor, cursor, "EX", 172_800]]);
      stats.swept += res.dropped;
      return res;
    } catch {
      stats.dropped++;
      return res;
    }
  }

  private memo: { at: number; snap: IdeasSnapshot } | null = null;
  rebuilds = 0;

  /**
   * F36: what the endpoint serves. Per instance it is memoised for 10 min; across instances the built snapshot
   * lives in the store and a rebuild needs the store lock (SET NX EX 600), so at most one rebuild per 10 min
   * whatever the traffic or query string. A cold instance costs one GET (+1 SET NX when stale).
   */
  async served(now = new Date()): Promise<IdeasSnapshot> {
    const t = now.getTime();
    if (this.memo && t - this.memo.at < SNAPSHOT_MS) return this.memo.snap;
    if (!this.pipe) return (this.memo = { at: t, snap: { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: false } }).snap;
    let snap: IdeasSnapshot | null = null;
    try {
      if (!this.budget.allows(3, now)) throw new Error("budget");
      const [got, lock, used] = (await this.pipe([["GET", K.snap], ["SET", K.lock, "1", "NX", "EX", SNAPSHOT_MS / 1000], ["INCRBY", K.budget(month(now)), 3]])) ?? [];
      this.budget.saw(Number(used));
      const stored = typeof got === "string" ? (JSON.parse(got) as IdeasSnapshot) : null;
      if (lock === "OK" || !stored) {
        if (lock === "OK") {
          this.rebuilds++;
          snap = await this.snapshot(now);
          await this.pipe([["SET", K.snap, JSON.stringify(snap), "EX", (SNAPSHOT_MS / 1000) * 6]]);
        } else snap = { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
      } else snap = stored;
    } catch {
      // A store error keeps the old memo only while its snapshot is under an hour old (the stored copy's own EX), so a
      // long outage can't keep serving rows the sweep has since deleted.
      const old = this.memo?.snap;
      snap = old && t - Date.parse(old.at) < SNAPSHOT_MS * 6 ? old : { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
    }
    this.memo = { at: t, snap };
    return snap;
  }

  /** The snapshot the CDN caches (R8, R12). Failed and unsafe rows never leave the store. Never throws. */
  async snapshot(now = new Date()): Promise<IdeasSnapshot> {
    if (!this.pipe || !this.budget.allows(READ_CMDS + 2, now)) return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: !!this.pipe };
    try {
      const head = await this.pipe([
        ["INCRBY", K.budget(month(now)), READ_CMDS],
        ["ZREVRANGE", K.top, 0, 999, "WITHSCORES"],
        ["ZREVRANGE", K.recent, 0, RECENT_MAX - 1, "WITHSCORES"], // the newest 200 of the recent log (trimmed by time, not size): lastSeen per key
      ]);
      this.budget.saw(Number(head?.[0]));
      const flat = (head?.[1] as string[]) ?? [];
      const counts = new Map<string, number>();
      for (let i = 0; i < flat.length; i += 2) counts.set(flat[i], Number(flat[i + 1]));
      const recentFlat = ((head?.[2] as string[]) ?? []);
      const seen = new Map<string, string>();
      for (let i = 0; i < recentFlat.length; i += 2) { const t = Number(recentFlat[i + 1]); if (Number.isFinite(t)) seen.set(recentFlat[i], new Date(t).toISOString()); }
      const allRecent = [...seen.keys()];
      const recentKeys = allRecent.slice(0, 20);
      const keys = [...new Set([...counts.keys(), ...allRecent])];
      if (!keys.length) return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
      const body = await this.pipe([["HMGET", K.meta, ...keys], ["ZMSCORE", K.status, ...keys], ["HMGET", K.stamp, ...keys]]);
      const metas = (body?.[0] as (string | null)[]) ?? [];
      const ranks = (body?.[1] as (string | null)[]) ?? [];
      const stamps = (body?.[2] as (string | null)[]) ?? [];
      const byKey = new Map<string, SnapshotRow>();
      keys.forEach((key, i) => {
        const row = toRow(key, metas[i], Number(ranks[i] ?? 0), counts.get(key) ?? 1);
        if (row) byKey.set(key, { ...row, lastSeen: seen.get(key) ?? null, ...toStamp(stamps[i]) });
      });
      const rows = [...byKey.values()];
      return { at: now.toISOString(), live: true, rows, popular: trustedPopular(rows), recent: recentKeys.map((k) => byKey.get(k)).filter((r): r is SnapshotRow => !!r) };
    } catch {
      stats.dropped++;
      return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
    }
  }
}

/** A row's last-seen ms: its recent score or its stamp's time, whichever is later; LEGACY_SINCE when it has neither. */
export function lastSeen(score: string | null | undefined, stamp: string | null | undefined): number {
  const r = Number(score ?? NaN);
  const at = toStamp(stamp).at;
  const s = at ? Date.parse(at) : NaN;
  const best = Math.max(Number.isFinite(r) ? r : -Infinity, Number.isFinite(s) ? s : -Infinity);
  return Number.isFinite(best) ? best : LEGACY_SINCE;
}

/** The stored write stamp, passed through; a row written before stamps (or unreadable) is "unknown". */
export function toStamp(raw: string | null | undefined): { at: string | null; source: LogSource | "unknown" } {
  try {
    const s = JSON.parse(String(raw)) as { at?: unknown; source?: unknown };
    const at = typeof s.at === "string" && Number.isFinite(Date.parse(s.at)) ? s.at : null;
    return { at, source: s.source === "live" || s.source === "test" || s.source === "possible-test" ? s.source : "unknown" };
  } catch { return { at: null, source: "unknown" }; }
}

function toRow(key: string, meta: string | null, rank: number, count: number): SnapshotRow | null {
  if (!meta || rank < 1) return null; // Failed is never shown
  try {
    const m = JSON.parse(meta) as { prompt: string; size: string; resultKey: string };
    const prompt = safePrompt(m.prompt); // re-checked on show (R10, R11)
    if (!prompt) return null;
    return { key, prompt, size: String(m.size).slice(0, 40), resultKey: String(m.resultKey).slice(0, 80), status: rank >= 2 ? "Trusted" : "Unverified", count };
  } catch { return null; }
}

/** Builds the record on the server from the prompt alone: status comes from the engine, never from the client (no spoofed Trusted). */
export async function recordFromPrompt(raw: string, clientFailed = false): Promise<LogRecord | null> {
  const prompt = safePrompt(raw);
  if (!prompt) return null;
  const [{ generateFromPrompt }, { buildInfo }, { headerSize }] = await Promise.all([import("./promptMain"), import("./buildInfo"), import("./headerSize")]);
  let status: LogStatus = "Failed";
  let size = "";
  let keySize = "";
  let resultKey = "failed";
  let unknown = false;
  try {
    const p = generateFromPrompt(prompt);
    const info = buildInfo(p);
    // A noun nothing owns (generic body / stand-in) is Unverified here and still goes to the 002 queue client-side (R6).
    unknown = !!(p.unmatched || p.displayOnly || (p as { standIn?: boolean }).standIn);
    status = clientFailed ? "Failed" : unknown ? "Unverified" : info.trust;
    // Logged to the nearest 1/16 (the card prints it with the shared formatter); the key keeps whole inches so
    // a build's count carries on across this change.
    const r16 = (n: number) => Math.round(n * 16) / 16;
    const r = (n: number) => Math.round(n);
    const hs = headerSize(p); // the header's own W × D × H (a pocket build's unit, an assumed axis's real extent)
    size = `${r16(hs.width)}×${r16(hs.depth)}×${r16(hs.height)}`;
    keySize = `${r(p.overall.width)}×${r(p.overall.depth)}×${r(p.overall.height)}`;
    const base = p.name.replace(/[\d'"″′×x./\s]+$/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // F35: an unknown noun is checked first, so it never gets a builtin: key.
    resultKey = `${unknown || info.source === "Placeholder" ? "unknown" : info.source === "Built-in shape" ? "builtin" : "recipe"}:${base || "thing"}`;
  } catch { /* engine threw: Failed */ }
  return { key: logKey(prompt, resultKey, keySize), prompt, size, resultKey, status };
}

/** Vercel's waitUntil when present; otherwise the promise just runs (local, tests). */
function defaultHold(p: Promise<unknown>): void {
  const safe = p.catch(() => {});
  void import("@vercel/functions").then((m) => m.waitUntil(safe)).catch(() => {});
}

let shared: IdeaStore | null = null;
export const ideaStore = () => (shared ??= new IdeaStore(restPipe()));
