/**
 * Spend cap for the nightly arm-B check. Every call is priced BEFORE it is sent, from a conservative token count
 * of the exact request, at the no-cache input rate plus the full max_tokens of output. A call that would take the
 * run past the cap is not sent and the run stops. After a call the real usage (xAI's cost_in_usd_ticks when
 * present, else usage × price) is charged, so the ledger is exact.
 */
/** xAI's published price for the arm-B model, USD per token (docs.x.ai/developers/pricing, "Last updated: October 10, 2026", fetched 2026-10-19). */
export const MODEL = "grok-4.20-0309-non-reasoning";
export const PRICE = { in: 1.25e-6, cached: 0.2e-6, out: 2.5e-6 } as const;
/** Requests at or over this many prompt tokens bill every token at the long-context rate (2×); B never comes close, but the estimate honours it. */
export const LONG_CONTEXT_TOKENS = 200_000;
export const LONG_PRICE = { in: 2.5e-6, cached: 0.4e-6, out: 5e-6 } as const;
export const CAP_USD = 2.0;
export const MAX_OUTPUT_TOKENS = 600;

/**
 * Conservative token count: one token per 2.5 UTF-8 bytes plus 4 framing tokens per message. Calibrated against
 * xAI's own prompt_tokens on all 118 recorded B calls (fixtures/ab-2026-10-19.json): it is never below the real
 * count (test: scripts/grok-check.test.ts), so the pre-call price is an upper bound.
 */
export function countTokens(messages: { role: string; content: string }[], extra = ""): number {
  const bytes = messages.reduce((s, m) => s + Buffer.byteLength(m.content, "utf8"), 0) + Buffer.byteLength(extra, "utf8");
  return Math.ceil(bytes / 2.5) + 4 * messages.length + 3;
}
export function worstCaseUsd(inputTokens: number, maxOut = MAX_OUTPUT_TOKENS): number {
  const p = inputTokens >= LONG_CONTEXT_TOKENS ? LONG_PRICE : PRICE;
  return inputTokens * p.in + maxOut * p.out;
}
export type Usage = { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number }; cost_in_usd_ticks?: number };
export function usageUsd(u: Usage): number {
  if (typeof u.cost_in_usd_ticks === "number") return u.cost_in_usd_ticks / 1e10; // 1 tick = 1e-10 USD
  const p = u.prompt_tokens >= LONG_CONTEXT_TOKENS ? LONG_PRICE : PRICE;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  return (u.prompt_tokens - cached) * p.in + cached * p.cached + u.completion_tokens * p.out;
}

export class CapReached extends Error { constructor(public spent: number, public next: number, public cap: number) { super(`cap: $${spent.toFixed(4)} spent + $${next.toFixed(4)} next call > $${cap.toFixed(2)}`); } }

export class Budget {
  spent = 0;
  calls = 0;
  stopped = false;
  constructor(readonly cap = CAP_USD) {
    if (!(cap > 0 && cap <= CAP_USD)) throw new Error(`cap must be in (0, ${CAP_USD}]`); // the $2/run ceiling is not configurable upward
  }
  /** Price the call before sending it; throws CapReached (and latches stopped) if it could take the run past the cap. */
  reserve(inputTokens: number, maxOut = MAX_OUTPUT_TOKENS): number {
    const wc = worstCaseUsd(inputTokens, maxOut);
    if (this.stopped || this.spent + wc > this.cap) { this.stopped = true; throw new CapReached(this.spent, wc, this.cap); }
    return wc;
  }
  /** Charge what the call really cost; a call with no usage (error/abort) is charged its reserved worst case. */
  charge(reserved: number, usage: Usage | null | undefined): number {
    const u = usage ? usageUsd(usage) : NaN;
    const c = Number.isFinite(u) && u >= 0 ? u : reserved; // missing or malformed usage → the reserved worst case
    this.spent = +(this.spent + c).toFixed(10);
    this.calls++;
    if (this.spent >= this.cap) this.stopped = true;
    return c;
  }
}
