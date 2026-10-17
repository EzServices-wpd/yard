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
export const WRITE_CMDS = 9; // INCRBY budget + HSETNX meta + ZINCRBY top + ZADD GT status + ZADD recent + ZREMRANGEBYSCORE recent (time trim) + HSET stamp + HINCRBY burst site + EXPIRE burst
/** One more when the client sent a run id (HINCRBY burst run:<id>). */
export const RUN_CMDS = 1;
/** A write inside a burst re-stamps its row "possible-test": INCRBY budget + HSET stamp, in a second pipeline. */
export const BURST_FIX_CMDS = 2;
/**
 * Burst rate, counted on the server only: written builds per fixed 60 s bucket, site-wide and per run id, in one
 * short-lived hash (EXPIRE 120 s). The counter is never stored with a row; only the stamp's source changes.
 */
export const BURST_WINDOW_S = 60;
export const SITE_BURST = 60; // more than 60 written builds site-wide in one minute
export const RUN_BURST = 10; // more than 10 written builds from one run id in one minute
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
 * - RETAIN_DAYS is 87, not 90: a row last seen at T goes at the first sweep after T + 87 d (≤ 1 d later), and a prompt
 *   can still sit in the stored snapshot (1 h) and the CDN copy of /api/ideas (s-maxage 1 h + stale-while-revalidate
 *   24 h) after that: T + 87 d + about 2 d stays inside 90.
 */
export const RETAIN_DAYS = 87;
export const RETAIN_MS = RETAIN_DAYS * 86_400_000;
/** The ideas log first shipped in c78a268 (15 Oct 2026); the store was made that day. No row is older. */
export const LEGACY_SINCE = Date.parse("2026-10-15T00:00:00Z");
/** Sweep caps: rows read per page (ZSCAN COUNT) and Upstash commands per run (the run stops and resumes next day). */
export const SWEEP_BATCH = 500;
export const SWEEP_MAX_CMDS = 200;
/**
 * Commands per sweep page: INCRBY + ZSCAN, INCRBY + ZMSCORE + HMGET; +8 (INCRBY + 7 deletes) when it drops rows.
 * Worst case at the defaults (every row stale): GET cursor 2 + 15 pages × 13 + SET cursor 2 = 199 ≤ 200, 7,500 rows.
 */
export const SWEEP_PAGE_CMDS = 5;
export const SWEEP_DROP_CMDS = 8;
// ideas:burst:<minute> lives 120 s and holds counts only (field "site" and "run:<id>"), never a prompt or row key.
const K = { review: "ideas:review", cursor: "ideas:sweep:cursor", ptest: "ideas:ptest", snap: "ideas:snap", lock: "ideas:snap:lock", budget: (m: string) => `ideas:cmds:${m}`, meta: "ideas:meta", top: "ideas:top", status: "ideas:status", recent: "ideas:recent", stamp: "ideas:stamp", burst: (now: Date) => `ideas:burst:${Math.floor(now.getTime() / (BURST_WINDOW_S * 1000))}` };

type Cmd = (string | number)[];
export type Pipe = (cmds: Cmd[]) => Promise<unknown[] | null>;
export const stats = { dropped: 0, overBudget: 0, written: 0, coalesced: 0, possibleTest: 0, swept: 0 };

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
    return out.map((r) => (r.error ? null : r.result));
  };
}

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
  private pending = new Map<string, { rec: LogRecord; n: number; last: number; timer?: boolean }>();
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
    const cmds = WRITE_CMDS + (run ? RUN_CMDS : 0);
    if (!this.budget.allows(cmds, now)) { stats.overBudget++; return "over-budget"; }
    this.pending.set(rec.key, { rec, n: 0, last: now.getTime() });
    if (this.pending.size > 5000) this.pending.clear();
    try {
      const meta = JSON.stringify({ prompt: rec.prompt, size: rec.size, resultKey: rec.resultKey });
      const source = rec.source ?? "unknown";
      const stamp = (s: string) => JSON.stringify({ at: now.toISOString(), source: s });
      const burst = K.burst(now);
      const out = await this.pipe([
        ["INCRBY", K.budget(month(now)), cmds],
        ["HSETNX", K.meta, rec.key, meta],
        ["ZINCRBY", K.top, n, rec.key],
        ["ZADD", K.status, "GT", STATUS_RANK[rec.status], rec.key], // R5: status only moves up
        ["ZADD", K.recent, now.getTime(), rec.key],
        ["ZREMRANGEBYSCORE", K.recent, "-inf", now.getTime() - RETAIN_MS], // time trim: last-seen older than RETAIN
        ["HSET", K.stamp, rec.key, stamp(source)], // request time + gate source
        ["HINCRBY", burst, "site", 1],
        ["EXPIRE", burst, BURST_WINDOW_S * 2],
        ...(run ? [["HINCRBY", burst, `run:${run}`, 1] as Cmd] : []),
      ]);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
      // Burst: this write's own count says so (no lag), so its stamp is corrected in the same request. Rare: +2 commands.
      const site = Number(out?.[7]), perRun = run ? Number(out?.[9]) : 0;
      if (source === "live" && (site > SITE_BURST || perRun > RUN_BURST) && this.budget.allows(BURST_FIX_CMDS, now)) {
        stats.possibleTest++;
        try {
          const fix = await this.pipe([["INCRBY", K.budget(month(now)), BURST_FIX_CMDS], ["HSET", K.stamp, rec.key, stamp("possible-test")]]);
          this.budget.saw(Number(fix?.[0]));
        } catch { stats.dropped++; }
      }
      return "written";
    } catch {
      stats.dropped++;
      return "dropped";
    }
  }

  /** F34: write a key's held repeats (if any) as one increment. Never throws. */
  async flush(key: string, now = new Date()): Promise<void> {
    const p = this.pending.get(key);
    if (!p || !this.pipe) return;
    p.timer = false;
    const n = p.n;
    if (!n) return;
    if (!this.budget.allows(3, now)) { stats.overBudget++; return; }
    p.n = 0;
    p.last = now.getTime();
    try {
      const out = await this.pipe([["INCRBY", K.budget(month(now)), 3], ["ZINCRBY", K.top, n, key], ["ZADD", K.status, "GT", STATUS_RANK[p.rec.status], key]]);
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
      snap = this.memo?.snap ?? { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
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
        ["ZREVRANGE", K.recent, 0, 199, "WITHSCORES"], // the newest 200 of the recent log (trimmed by time, not size): lastSeen per key
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
  const [{ generateFromPrompt }, { buildInfo }] = await Promise.all([import("./promptMain"), import("./buildInfo")]);
  let status: LogStatus = "Failed";
  let size = "";
  let resultKey = "failed";
  let unknown = false;
  try {
    const p = generateFromPrompt(prompt);
    const info = buildInfo(p);
    // A noun nothing owns (generic body / stand-in) is Unverified here and still goes to the 002 queue client-side (R6).
    unknown = !!(p.unmatched || p.displayOnly || (p as { standIn?: boolean }).standIn);
    status = clientFailed ? "Failed" : unknown ? "Unverified" : info.trust;
    const r = (n: number) => Math.round(n);
    size = `${r(p.overall.width)}×${r(p.overall.depth)}×${r(p.overall.height)}`;
    const base = p.name.replace(/[\d'"″′×x./\s]+$/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // F35: an unknown noun is checked first, so it never gets a builtin: key.
    resultKey = `${unknown || info.source === "Placeholder" ? "unknown" : info.source === "Built-in shape" ? "builtin" : "recipe"}:${base || "thing"}`;
  } catch { /* engine threw: Failed */ }
  return { key: logKey(prompt, resultKey, size), prompt, size, resultKey, status };
}

/** Vercel's waitUntil when present; otherwise the promise just runs (local, tests). */
function defaultHold(p: Promise<unknown>): void {
  const safe = p.catch(() => {});
  void import("@vercel/functions").then((m) => m.waitUntil(safe)).catch(() => {});
}

let shared: IdeaStore | null = null;
export const ideaStore = () => (shared ??= new IdeaStore(restPipe()));
