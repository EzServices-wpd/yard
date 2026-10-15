/**
 * Endless Ideas store (specs/004-ideas R4, R7): Upstash Redis over its REST API, no SDK.
 * - Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the Marketplace's KV_REST_API_URL + KV_REST_API_TOKEN).
 *   Missing env → every call is a no-op, so previews and CI work without the store.
 * - Budget guard: a monthly command counter in Redis; logging stops at BUDGET (90% of the 500K free tier).
 * - Never throws: a store error, timeout or quota hit drops the write and is counted in `stats`.
 */
import { EMPTY_SNAPSHOT, STATUS_RANK, logKey, safePrompt, trustedPopular, type IdeasSnapshot, type LogRecord, type LogStatus, type SnapshotRow } from "./ideaLog";

export const FREE_TIER = 500_000;
export const BUDGET = 450_000;
export const WRITE_CMDS = 6; // INCRBY budget + HSETNX meta + ZINCRBY top + ZADD GT status + ZADD recent + ZREMRANGEBYRANK
export const READ_CMDS = 5;
const COALESCE_MS = 10_000;
const TIMEOUT_MS = 1500;
const K = { budget: (m: string) => `ideas:cmds:${m}`, meta: "ideas:meta", top: "ideas:top", status: "ideas:status", recent: "ideas:recent" };

type Cmd = (string | number)[];
export type Pipe = (cmds: Cmd[]) => Promise<unknown[] | null>;
export const stats = { dropped: 0, overBudget: 0, written: 0, coalesced: 0 };

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
  private pending = new Map<string, { rec: LogRecord; n: number; last: number }>();
  constructor(private pipe: Pipe | null, readonly budget = new Budget()) {}
  get live() { return !!this.pipe; }

  /** R4/R7: one pipelined write; repeats of a key within 10 s on this instance fold into one increment. Never throws. */
  async record(rec: LogRecord, now = new Date()): Promise<"written" | "coalesced" | "off" | "over-budget" | "dropped"> {
    if (!this.pipe) return "off";
    const p = this.pending.get(rec.key);
    if (p && now.getTime() - p.last < COALESCE_MS) { p.n++; if (STATUS_RANK[rec.status] > STATUS_RANK[p.rec.status]) p.rec = rec; stats.coalesced++; return "coalesced"; }
    const n = (p?.n ?? 0) + 1;
    if (!this.budget.allows(WRITE_CMDS, now)) { stats.overBudget++; return "over-budget"; }
    this.pending.set(rec.key, { rec, n: 0, last: now.getTime() });
    if (this.pending.size > 5000) this.pending.clear();
    try {
      const meta = JSON.stringify({ prompt: rec.prompt, size: rec.size, resultKey: rec.resultKey });
      const out = await this.pipe([
        ["INCRBY", K.budget(month(now)), WRITE_CMDS],
        ["HSETNX", K.meta, rec.key, meta],
        ["ZINCRBY", K.top, n, rec.key],
        ["ZADD", K.status, "GT", STATUS_RANK[rec.status], rec.key], // R5: status only moves up
        ["ZADD", K.recent, now.getTime(), rec.key],
        ["ZREMRANGEBYRANK", K.recent, 0, -201],
      ]);
      this.budget.saw(Number(out?.[0]));
      stats.written++;
      return "written";
    } catch {
      stats.dropped++;
      return "dropped";
    }
  }

  /** The snapshot the CDN caches (R8, R12). Failed and unsafe rows never leave the store. Never throws. */
  async snapshot(now = new Date()): Promise<IdeasSnapshot> {
    if (!this.pipe || !this.budget.allows(READ_CMDS + 2, now)) return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: !!this.pipe };
    try {
      const head = await this.pipe([
        ["INCRBY", K.budget(month(now)), READ_CMDS],
        ["ZREVRANGE", K.top, 0, 999, "WITHSCORES"],
        ["ZREVRANGE", K.recent, 0, 19],
      ]);
      this.budget.saw(Number(head?.[0]));
      const flat = (head?.[1] as string[]) ?? [];
      const counts = new Map<string, number>();
      for (let i = 0; i < flat.length; i += 2) counts.set(flat[i], Number(flat[i + 1]));
      const recentKeys = ((head?.[2] as string[]) ?? []);
      const keys = [...new Set([...counts.keys(), ...recentKeys])];
      if (!keys.length) return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
      const body = await this.pipe([["HMGET", K.meta, ...keys], ["ZMSCORE", K.status, ...keys]]);
      const metas = (body?.[0] as (string | null)[]) ?? [];
      const ranks = (body?.[1] as (string | null)[]) ?? [];
      const byKey = new Map<string, SnapshotRow>();
      keys.forEach((key, i) => {
        const row = toRow(key, metas[i], Number(ranks[i] ?? 0), counts.get(key) ?? 1);
        if (row) byKey.set(key, row);
      });
      const rows = [...byKey.values()];
      return { at: now.toISOString(), live: true, rows, popular: trustedPopular(rows), recent: recentKeys.map((k) => byKey.get(k)).filter((r): r is SnapshotRow => !!r) };
    } catch {
      stats.dropped++;
      return { ...EMPTY_SNAPSHOT, at: now.toISOString(), live: true };
    }
  }
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
    resultKey = `${info.source === "Built-in shape" ? "builtin" : info.source === "Placeholder" || unknown ? "unknown" : "recipe"}:${base || "thing"}`;
  } catch { /* engine threw: Failed */ }
  return { key: logKey(prompt, resultKey, size), prompt, size, resultKey, status };
}

let shared: IdeaStore | null = null;
export const ideaStore = () => (shared ??= new IdeaStore(restPipe()));
