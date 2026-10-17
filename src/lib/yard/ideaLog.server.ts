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
export const WRITE_CMDS = 10; // INCRBY budget + HSETNX meta + ZINCRBY top + ZADD GT status + ZADD recent + ZREMRANGEBYRANK + HSET stamp + HINCRBY burst site + EXPIRE burst + HMGET previous burst bucket
/** One more when the client sent a run id (HINCRBY burst run:<id>). */
export const RUN_CMDS = 1;
/**
 * A write inside a burst, in a second pipeline:
 * - a row's first write: INCRBY budget + HINCRBY ideas:ptest + HSET stamp "possible-test" (BURST_NEW_CMDS);
 * - a row written before: INCRBY budget + HINCRBY ideas:ptest (BURST_FIX_CMDS). If every earlier write was a
 *   possible-test write too, a third pipeline re-stamps it (BURST_STAMP_CMDS). A row that has had a live write stays
 *   live: a later possible-test write only bumps its ideas:ptest count, never its source.
 */
export const BURST_FIX_CMDS = 2;
export const BURST_NEW_CMDS = 3;
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
// ideas:stamp is covered by the coming 90-day retention sweep (/workspace/wt/retention-plan.md), the same as ideas:meta.
// ideas:burst:<minute> lives 120 s and holds counts only (field "site" and "run:<id>"), never a prompt or row key.
// ideas:ptest counts a row's possible-test writes (key → count), for the sticky-live rule; same retention as ideas:meta.
const bucket = (now: Date) => Math.floor(now.getTime() / (BURST_WINDOW_S * 1000));
const K = { snap: "ideas:snap", lock: "ideas:snap:lock", budget: (m: string) => `ideas:cmds:${m}`, meta: "ideas:meta", top: "ideas:top", status: "ideas:status", recent: "ideas:recent", stamp: "ideas:stamp", ptest: "ideas:ptest", burst: (now: Date, back = 0) => `ideas:burst:${bucket(now) - back}` };

type Cmd = (string | number)[];
export type Pipe = (cmds: Cmd[]) => Promise<unknown[] | null>;
export const stats = { dropped: 0, overBudget: 0, written: 0, coalesced: 0, possibleTest: 0, stayedLive: 0 };

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
        ["ZREMRANGEBYRANK", K.recent, 0, -201],
        ["HSET", K.stamp, rec.key, stamp(source)], // request time + gate source
        ["HINCRBY", burst, "site", 1],
        ["EXPIRE", burst, BURST_WINDOW_S * 2],
        ...(run ? [["HINCRBY", burst, `run:${run}`, 1] as Cmd] : []),
        ["HMGET", K.burst(now, 1), "site", ...(run ? [`run:${run}`] : [])], // the previous minute, for the sliding window
      ]);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
      // Burst: this write's own count says so (no lag), so its stamp is settled in the same request.
      const prev = (out?.[run ? 10 : 9] as (string | null)[] | null) ?? [];
      const site = burstRate(Number(prev[0] ?? 0), Number(out?.[7]), now);
      const perRun = run ? burstRate(Number(prev[1] ?? 0), Number(out?.[9]), now) : 0;
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
        const fix = await this.pipe!([["INCRBY", K.budget(month(now)), BURST_NEW_CMDS], ["HINCRBY", K.ptest, key, n], ["HSET", K.stamp, key, stamp]]);
        this.budget.saw(Number(fix?.[0]));
        return;
      }
      if (!this.budget.allows(BURST_FIX_CMDS, now)) { stats.overBudget++; return; }
      const fix = await this.pipe!([["INCRBY", K.budget(month(now)), BURST_FIX_CMDS], ["HINCRBY", K.ptest, key, n]]);
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
    const cmds = p.ptest ? 4 : 3; // held repeats of a possible-test write add to its possible-test count
    if (!this.budget.allows(cmds, now)) { stats.overBudget++; return; }
    p.n = 0;
    p.last = now.getTime();
    try {
      const out = await this.pipe([["INCRBY", K.budget(month(now)), cmds], ["ZINCRBY", K.top, n, key], ["ZADD", K.status, "GT", STATUS_RANK[p.rec.status], key], ...(p.ptest ? [["HINCRBY", K.ptest, key, n] as Cmd] : [])]);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
    } catch { stats.dropped++; }
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
        ["ZREVRANGE", K.recent, 0, 199, "WITHSCORES"], // the whole recent log (it holds 200): lastSeen per key
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
