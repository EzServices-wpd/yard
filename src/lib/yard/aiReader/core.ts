/**
 * Network-free core of the AI prompt reader (I49). Every guard runs before any spend; every failure returns ok:false so
 * the typed words build exactly as today. Server wiring (key, Upstash counter, cache, per-IP cap): src/lib/ai/readPrompt.ts.
 */
import { READER_SCHEMA, READER_SYSTEM, type ReaderSpec } from "./spec";
import { norm, validateSpec } from "./validate";

/** Cheapest general text model with no reasoning tokens (docs.x.ai/developers/pricing, fetched 2026-10-23). */
export const READER_MODEL = "grok-4.20-0309-non-reasoning";
const PRICE = { in: 1.25e-6, cached: 0.2e-6, out: 2.5e-6 };
const MAX_TOKENS = 600;
export const READER_TIMEOUT_MS = 3500; // recorded A/B latency: median 1,479 ms, p95 3,175 ms
export const CACHE_TTL_S = 30 * 86_400;
export const HARD_CAP_USD = 1; // Ezra's hard cap; YARD_AI_READER_DAILY_USD may lower it, never raise it

export const readerRequest = (prompt: string) => ({
  model: READER_MODEL,
  temperature: 0,
  max_tokens: MAX_TOKENS,
  messages: [{ role: "system" as const, content: READER_SYSTEM }, { role: "user" as const, content: `Request: ${prompt}` }],
  response_format: { type: "json_schema", json_schema: READER_SCHEMA },
});
type Usage = { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number }; cost_in_usd_ticks?: number };
const count = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : NaN);
/** The billed price from usage; NaN (→ the caller bills the reserved worst case) when usage is missing, zero, negative or not a number. Cached tokens never exceed the prompt's. */
export function costUsd(u: Usage): number {
  const ticks = u.cost_in_usd_ticks;
  const prompt = count(u.prompt_tokens), out = count(u.completion_tokens);
  const cached = Math.min(count(u.prompt_tokens_details?.cached_tokens ?? 0) || 0, prompt);
  const usd = typeof ticks === "number" && Number.isFinite(ticks) ? ticks / 1e10 : (prompt - cached) * PRICE.in + cached * PRICE.cached + out * PRICE.out;
  // A real call always costs something: zero or negative (ticks or tokens) bills the reserved worst case, so a refund can never leave the counter below 0 (row 480).
  return usd > 0 ? usd : NaN;
}
/** Reserved before each call: chars/3 tokens in (above any tokenizer's count for this text), max_tokens out. */
export const worstCaseUsd = (prompt: string) => Math.ceil((READER_SYSTEM.length + JSON.stringify(READER_SCHEMA).length + prompt.length + 64) / 3) * PRICE.in + MAX_TOKENS * PRICE.out;
const capUsd = (raw: string | undefined) => { const v = Number(raw ?? HARD_CAP_USD); return Number.isFinite(v) ? Math.min(HARD_CAP_USD, Math.max(0, v)) : HARD_CAP_USD; };
/** On only with YARD_AI_READER exactly "on" (anything else is the kill switch), the key, and the Upstash store for the counter. */
export const readerEnv = (env: Record<string, string | undefined>, hasStore: boolean, hasKey: boolean) => ({ on: env.YARD_AI_READER === "on" && hasStore, key: hasKey, capUsd: capUsd(env.YARD_AI_READER_DAILY_USD) });

/**
 * The persistent global counter: Upstash (the Ideas store's REST pipe), one pipelined request of INCRBYFLOAT + EXPIRE
 * 2 days on yard:reader:usd:<UTC day>, only for a call that will reach the model. The worst case is added first; a
 * total over the cap is taken back and refused. No reply → no call. ?test=1 calls are told apart in the log line.
 */
type Pipe = (cmds: (string | number)[][]) => Promise<unknown[] | null>;
export const usdKey = (day: string) => `yard:reader:usd:${day}`;
/** Once this instance sees the cap reached, it stops asking Upstash for the day: spam past the cap costs no commands. */
let fullDay = "";
export async function reserveUsd(pipe: Pipe, day: string, usd: number, cap: number): Promise<boolean> {
  if (!(usd > 0 && usd <= cap) || fullDay === day) return false;
  const out = await pipe([["INCRBYFLOAT", usdKey(day), usd], ["EXPIRE", usdKey(day), 172_800]]);
  const total = out?.[0] == null ? NaN : Number(out[0]);
  if (!Number.isFinite(total)) return false;
  if (total <= cap + 1e-9) return true;
  fullDay = day;
  await pipe([["INCRBYFLOAT", usdKey(day), -usd]]);
  return false;
}
/** Settle to the billed price, clamped to [0, reserved]: a bad usage figure can never give back more than this call reserved. */
export async function settleUsd(pipe: Pipe, day: string, reserved: number, billed: number): Promise<void> {
  const b = Number.isFinite(billed) ? Math.min(Math.max(billed, 0), reserved) : reserved;
  if (b !== reserved) await pipe([["INCRBYFLOAT", usdKey(day), b - reserved]]);
}
export const utcDay = () => new Date().toISOString().slice(0, 10);

export function parseReply(prompt: string, body: unknown): ReaderSpec | null {
  const text = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  if (typeof text !== "string") return null;
  try { return validateSpec(prompt, JSON.parse(text)).spec; } catch { return null; }
}

/**
 * Only prompts the regex parser cannot already read go to the model: some number is not a plain "N wide/deep/tall/
 * long", or a count is typed as a word or hyphen compound. Fully labelled prompts (the linen canary), prompts with no
 * numbers, and long briefs (the pocket vanity, the fitted parser's job) never call.
 */
export function needsReader(prompt: string): boolean {
  if (prompt.length > 300) return false;
  const p = prompt.toLowerCase();
  if (/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|pair|dual)[\s-]+(?:[a-z]+\s+)?(?:drawers?|doors?|shelf|shelves|steps?|bins?|tiers?|bays?|cubbies|legs?|seats?)\b|\d-(?:drawer|door|shelf|step|bin|tier|bay)/.test(p)) return true;
  if (!/\d/.test(p)) return false;
  const rest = p.replace(/(\d+(?:\.\d+)?)\s*(?:"|″|in\b|inch(?:es)?)?\s*(?:wide|deep|tall|high|long)\b/g, " ").replace(/\b\d+\s+(?:drawers?|doors?|shelf|shelves|steps?|bins?|tiers?|bays?|cubbies|legs?|hooks?)\b/g, " ");
  return /\d/.test(rest);
}

/** A short, non-reversible tag for logs: the counter and logs never carry the prompt itself. */
export const promptTag = (p: string) => { let h = 0x811c9dc5; for (const ch of norm(p)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return h.toString(16).padStart(8, "0"); };

/** The 30-day cache key: a SHA-256 of the normalized prompt, never the prompt itself (Web Crypto, on the server). */
export async function cacheKey(prompt: string): Promise<string> {
  const h = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm(prompt)));
  return `yard-reader:v2:${READER_MODEL}:${Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export type ReaderResult = { ok: true; spec: ReaderSpec; cached: boolean } | { ok: false; error: string; off?: true };
export type ReaderDeps = {
  /** Enable flag (YARD_AI_READER=on; anything else is the kill switch), key present, today's cap. */
  env: { on: boolean; key: boolean; capUsd: number };
  cacheGet: (k: string) => Promise<string | undefined>;
  cacheSet: (k: string, v: string, ttlS: number) => Promise<void>;
  /** Per-IP rate limit, read only, checked before the counter: a visitor past it costs no Upstash command. */
  ipCapped: () => Promise<boolean>;
  /** Persistent daily counter: reserve the worst case under the cap (false = cap hit), then settle at the billed price. */
  reserve: (usd: number, capUsd: number) => Promise<boolean>;
  settle: (reservedUsd: number, billedUsd: number) => Promise<void>;
  /** The one network door (xaiFetch, with the per-IP cap). */
  call: (body: unknown, signal: AbortSignal) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; error: string }>;
  log: (line: string) => void;
};

export async function readPrompt(prompt: string, test: boolean, d: ReaderDeps, timeoutMs = READER_TIMEOUT_MS): Promise<ReaderResult> {
  if (!d.env.on || !d.env.key) return { ok: false, error: "reader is off", off: true };
  if (!needsReader(prompt)) return { ok: false, error: "the parser reads these words: no call" };
  const tag = `tag=${promptTag(prompt)} test=${test ? 1 : 0}`;
  const ck = await cacheKey(prompt);
  const hit = await d.cacheGet(ck).catch(() => undefined);
  const fromCache = hit ? parseReply(prompt, { choices: [{ message: { content: hit } }] }) : null;
  if (fromCache) { d.log(`[ai-reader] cache ${tag}`); return { ok: true, spec: fromCache, cached: true }; }
  if (await d.ipCapped().catch(() => true)) { d.log(`[ai-reader] ip-cap ${tag}`); return { ok: false, error: "visitor reader limit reached", off: true }; }
  const worst = worstCaseUsd(prompt);
  if (!(await d.reserve(worst, d.env.capUsd).catch(() => false))) { d.log(`[ai-reader] cap ${tag}`); return { ok: false, error: "daily reader budget reached", off: true }; }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await d.call(readerRequest(prompt), ctl.signal);
    if (!r.ok) { await d.settle(worst, 0).catch(() => {}); d.log(`[ai-reader] refused ${tag}`); return { ok: false, error: r.error }; }
    const usage = (r.body as { usage?: Usage } | null)?.usage;
    const billed = usage ? costUsd(usage) : worst;
    const usd = Number.isFinite(billed) ? Math.min(Math.max(billed, 0), worst) : worst;
    await d.settle(worst, usd).catch(() => {});
    const spec = r.status === 200 ? parseReply(prompt, r.body) : null;
    d.log(`[ai-reader] call ${tag} status=${r.status} usd=${usd.toFixed(5)} ok=${!!spec}`);
    if (!spec) return { ok: false, error: `reader reply unusable (${r.status})` };
    await d.cacheSet(ck, (r.body as { choices: { message: { content: string } }[] }).choices[0].message.content, CACHE_TTL_S).catch(() => {});
    return { ok: true, spec, cached: false };
  } catch {
    // An aborted call may still bill: the worst case stays reserved.
    d.log(`[ai-reader] timeout ${tag}`);
    return { ok: false, error: "reader timed out" };
  } finally { clearTimeout(timer); }
}
