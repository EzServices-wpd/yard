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
export const WRITE_CMDS = 9; // INCRBY budget + HSETEX FNX meta + ZINCRBY top + ZADD GT status + ZADD recent + ZREMRANGEBYRANK + HSETEX stamp + HINCRBY burst site + EXPIRE burst
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
 * Retention (privacy page: "We delete saved prompts and feedback notes after 90 days"). Enforced by Redis itself,
 * not by traffic: Upstash hashes take a TTL per field (HSETEX / HEXPIREAT), so every field that can hold typed text
 * expires on its own.
 * - ideas:meta (the scrubbed prompt, the only typed text on the ideas side): HSETEX FNX EX RETAIN_S, so the TTL is
 *   set by the field's first save and a re-type never extends it. Once it lapses the next write saves it afresh.
 * - ideas:stamp (request time + source, no text): HSETEX EX RETAIN_S on every write (latest wins, so does its TTL).
 * - ideas:top / ideas:status / ideas:recent hold only the 8-hex row key and a number (no text). recent is trimmed to
 *   200 on every write; the daily sweep removes members of all three whose meta is gone.
 * - RETAIN_DAYS is 88, not 90: a prompt can outlive its field in the stored snapshot (EX 1 h), an instance memo
 *   (10 min) and the CDN copy of /api/ideas (s-maxage 1 h + stale-while-revalidate 24 h), about 27 h in all; 88 days
 *   keeps every copy inside 90.
 * - Fields saved with no TTL (before this change, or by an old preview build, which shares the store) are caught by
 *   the daily sweep: HEXPIREAT NX to LEGACY_DEADLINE (nothing was written before LEGACY_SINCE), or deleted at once
 *   when that deadline has passed (so such a field can only be as old as the gap since the last sweep).
 * ideas:burst:<minute> lives 120 s and holds counts only (field "site" and "run:<id>"), never a prompt or row key.
 */
export const RETAIN_DAYS = 88;
export const RETAIN_S = RETAIN_DAYS * 86_400;
/** The ideas log first shipped in c78a268 (15 Oct 2026, 11:32 EDT) and the store was made that day: no field is older. */
export const LEGACY_SINCE = Date.parse("2026-10-15T00:00:00Z");
export const LEGACY_DEADLINE_S = Math.floor(LEGACY_SINCE / 1000) + RETAIN_S;
/** The sweep runs at most once per SWEEP_MS, from the snapshot rebuild (which already holds the store lock). */
export const SWEEP_MS = 86_400_000;
/** Sweep reads: INCRBY + HKEYS meta, stamp, review + ZRANGE top, status, recent (recent WITHSCORES). */
export const SWEEP_READ_CMDS = 7;
/** Fields or members per sweep command, so one request stays small. */
const SWEEP_CHUNK = 1000;
/** A member written in the last minute is never treated as an orphan (its meta may have been saved after HKEYS). */
const SWEEP_GRACE_MS = 60_000;
/** Feedback keys the engine's sweep also ages (feedback:list is the old single list, written by old preview builds). */
const LEGACY_LISTS = ["feedback:list"];
const K = { snap: "ideas:snap", lock: "ideas:snap:lock", budget: (m: string) => `ideas:cmds:${m}`, meta: "ideas:meta", top: "ideas:top", status: "ideas:status", recent: "ideas:recent", stamp: "ideas:stamp", review: "ideas:review", burst: (now: Date) => `ideas:burst:${Math.floor(now.getTime() / (BURST_WINDOW_S * 1000))}` };
/** A hash field write that carries its TTL (the only way the engine writes ideas:meta, ideas:stamp). */
export const hsetex = (key: string, field: string, value: string, opts: { fnx?: boolean } = {}): Cmd => ["HSETEX", key, ...(opts.fnx ? ["FNX"] : []), "EX", RETAIN_S, "FIELDS", 1, field, value];

type Cmd = (string | number)[];
export type Pipe = (cmds: Cmd[]) => Promise<unknown[] | null>;
export const stats = { dropped: 0, overBudget: 0, written: 0, coalesced: 0, possibleTest: 0, sweeps: 0, sweptLegacy: 0, sweptOrphans: 0 };

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
        hsetex(K.meta, rec.key, meta, { fnx: true }), // TTL from the first save; a re-type never extends it
        ["ZINCRBY", K.top, n, rec.key],
        ["ZADD", K.status, "GT", STATUS_RANK[rec.status], rec.key], // R5: status only moves up
        ["ZADD", K.recent, now.getTime(), rec.key],
        ["ZREMRANGEBYRANK", K.recent, 0, -201],
        hsetex(K.stamp, rec.key, stamp(source)), // request time + gate source
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
          const fix = await this.pipe([["INCRBY", K.budget(month(now)), BURST_FIX_CMDS], hsetex(K.stamp, rec.key, stamp("possible-test"))]);
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
      const parsed = typeof got === "string" ? (JSON.parse(got) as IdeasSnapshot & { swept?: string }) : null;
      const swept = parsed?.swept;
      if (parsed) delete parsed.swept; // bookkeeping only, never served
      const stored: IdeasSnapshot | null = parsed;
      if (lock === "OK" || !stored) {
        if (lock === "OK") {
          this.rebuilds++;
          // Retention sweep, at most once a day: the time of the last one rides in the stored snapshot (no extra read).
          let last = Date.parse(String(swept ?? ""));
          if (!(t - last < SWEEP_MS) && (await this.sweep(now))) last = t;
          snap = await this.snapshot(now);
          const tag = Number.isFinite(last) ? { swept: new Date(last).toISOString() } : {};
          await this.pipe([["SET", K.snap, JSON.stringify({ ...snap, ...tag }), "EX", (SNAPSHOT_MS / 1000) * 6]]);
        } else snap = { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
      } else snap = stored;
    } catch {
      snap = this.memo?.snap ?? { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
    }
    this.memo = { at: t, snap };
    return snap;
  }

  /**
   * Daily retention sweep (see RETAIN_DAYS). Budgeted; never throws; true when it ran.
   * 1. Fields with no TTL in ideas:meta, ideas:stamp, ideas:review: HEXPIREAT LEGACY_DEADLINE_S NX (a past deadline
   *    deletes them at once). NX leaves every field that already has its own TTL alone.
   * 2. The old single feedback list: EXPIREAT LEGACY_DEADLINE_S (the same rule, whole key).
   * 3. Orphans (row key with no meta field any more): ZREM from top, status, recent and HDEL from stamp, so counts
   *    of deleted prompts don't pile up or crowd the snapshot's top 1,000.
   * Cost: SWEEP_READ_CMDS + 1 + one command per non-empty chunk, about 10 a day.
   */
  async sweep(now = new Date()): Promise<boolean> {
    if (!this.pipe || !this.budget.allows(SWEEP_READ_CMDS, now)) return false;
    try {
      const head = await this.pipe([
        ["INCRBY", K.budget(month(now)), SWEEP_READ_CMDS],
        ["HKEYS", K.meta], ["HKEYS", K.stamp], ["HKEYS", K.review],
        ["ZRANGE", K.top, 0, -1], ["ZRANGE", K.status, 0, -1], ["ZRANGE", K.recent, 0, -1, "WITHSCORES"],
      ]);
      if (!head) return false;
      this.budget.saw(Number(head[0]));
      const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
      const [metaF, stampF, reviewF, topM, statusM] = [1, 2, 3, 4, 5].map((i) => list(head[i]));
      const recentFlat = list(head[6]);
      const fresh = new Set<string>();
      const recentM: string[] = [];
      for (let i = 0; i < recentFlat.length; i += 2) {
        recentM.push(recentFlat[i]);
        if (now.getTime() - Number(recentFlat[i + 1]) < SWEEP_GRACE_MS) fresh.add(recentFlat[i]);
      }
      const live = new Set(metaF);
      const orphan = (m: string) => !live.has(m) && !fresh.has(m);
      const chunks = (xs: string[]) => Array.from({ length: Math.ceil(xs.length / SWEEP_CHUNK) }, (_, i) => xs.slice(i * SWEEP_CHUNK, (i + 1) * SWEEP_CHUNK));
      const cmds: Cmd[] = [];
      for (const [key, fields] of [[K.meta, metaF], [K.stamp, stampF], [K.review, reviewF]] as const)
        for (const c of chunks(fields)) cmds.push(["HEXPIREAT", key, LEGACY_DEADLINE_S, "NX", "FIELDS", c.length, ...c]);
      for (const key of LEGACY_LISTS) cmds.push(["EXPIREAT", key, LEGACY_DEADLINE_S]);
      let orphans = 0;
      for (const [key, members] of [[K.top, topM], [K.status, statusM], [K.recent, recentM]] as const)
        for (const c of chunks(members.filter(orphan))) { cmds.push(["ZREM", key, ...c]); orphans += c.length; }
      for (const c of chunks(stampF.filter(orphan))) cmds.push(["HDEL", K.stamp, ...c]);
      const n = cmds.length + 1;
      if (!this.budget.allows(n, now)) return false;
      const out = await this.pipe([["INCRBY", K.budget(month(now)), n], ...cmds]);
      this.budget.saw(Number(out?.[0]));
      // HEXPIREAT replies per field: 1 = TTL set, 2 = deleted (deadline passed), -2 none, 0 = had a TTL (NX).
      const legacy = (out ?? []).slice(1).flatMap((r) => (Array.isArray(r) ? r : [])).filter((r) => Number(r) === 1 || Number(r) === 2).length;
      stats.sweeps++;
      stats.sweptLegacy += legacy;
      stats.sweptOrphans += orphans;
      return true;
    } catch {
      stats.dropped++;
      return false;
    }
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
