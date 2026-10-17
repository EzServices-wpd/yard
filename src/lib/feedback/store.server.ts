/**
 * Upstash keys for build feedback and Critic's review marks. Outside src/lib/yard on purpose: it reuses the
 * engine's REST pipe, Budget and monthly command counter (`ideas:cmds:<month>`) by import, and changes none of it.
 * Missing env → every call is a no-op. Never throws.
 */
import { restPipe, Budget, RETAIN_S, type Pipe } from "@/lib/yard/ideaLog.server";
import type { FeedbackRecord } from "./shop";

export const K = {
  budget: (m: string) => `ideas:cmds:${m}`,
  meta: "ideas:meta",
  recent: "ideas:recent",
  top: "ideas:top",
  review: "ideas:review", // field = query-log key → JSON ReviewMark (no text); each field has its own TTL
  /** One list per UTC day, newest first; the whole key expires RETAIN_DAYS after that day began. */
  feedback: (d: string) => `feedback:list:${d}`,
  day: (d: string) => `feedback:day:${d}`,
  client: (d: string, cid: string) => `feedback:cid:${d}:${cid}`, // a counter only, gone after a day
};
/**
 * 90-day retention (privacy page), enforced by Redis: a note goes into its UTC day's list, and that list expires
 * RETAIN_DAYS (88) after the day began, so no note is ever older than 88 days, with or without later traffic.
 * The old single list (feedback:list, only ever written by preview builds) is aged by the engine's daily sweep.
 * Size: DAY_CAP notes a day × 88 days at most (the old 2,000 cap and the tail paging are gone).
 */
export const FEEDBACK_DAYS = 90;
/** When a day's list goes: midnight UTC that day + RETAIN_S (unix seconds). */
export const dayExpiry = (now: Date) => Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000) + RETAIN_S;
/** Review marks checked for a missing query-log entry per unreviewed read. */
export const ORPHAN_SWEEP = 20;
export const DAY_CAP = 300; // ≤ 300 × 8 cmds × 31 days ≈ 74K/month (5 for the gate + 3 for the write), inside the shared 450K budget
export const CLIENT_DAY_CAP = 10; // per anonymous browser id, so one noisy client can't spend the day's 300
export const INSTANCE_PER_MIN = 12;

const month = (now: Date) => now.toISOString().slice(0, 7);
const day = (now: Date) => now.toISOString().slice(0, 10);

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
    // The write and its day list's expiry, in one pipeline (EXPIREAT is idempotent: the same deadline every time).
    const out = await this.run(3, [["LPUSH", K.feedback(d), JSON.stringify(rec)], ["EXPIREAT", K.feedback(d), dayExpiry(now)]], now);
    return out ? "saved" : "dropped";
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
    return (await this.run(2, [["HSETEX", K.review, "EX", RETAIN_S, "FIELDS", 1, key, JSON.stringify(mark)]], now)) ? "marked" : "off";
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
    const sets: string[] = [];
    keys.forEach((key, i) => {
      const meta = parseMeta((got[1] as (string | null)[])[i]);
      const raw = (got[0] as (string | null)[])[i];
      if (!meta || !raw) return;
      const mark = { ...(JSON.parse(raw) as ReviewMark), lastSampledAt: at };
      rows.push({ key, ...meta, ...mark });
      sets.push(key, JSON.stringify(mark));
    });
    // KEEPTTL: being sampled doesn't extend a mark's life.
    if (sets.length) await this.run(2, [["HSETEX", K.review, "KEEPTTL", "FIELDS", sets.length / 2, ...sets]], now);
    return rows;
  }
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
