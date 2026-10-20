/**
 * The only door from scripts/ to api.x.ai (scripts/security.test.ts enforces it). OFF BY DEFAULT: a live call is
 * possible only when BOTH the repo variable YARD_GROK_CHECK is exactly "on" AND an XAI_API_KEY secret is present.
 * Otherwise there is no live transport at all. The key is read from the environment, sent only in the
 * Authorization header, and never printed, logged or written.
 */
import { readFileSync } from "node:fs";
import { MAX_OUTPUT_TOKENS, MODEL, type Usage } from "./budget.ts";

export type Gate = { on: true } | { on: false; reason: string };
export function grokCheckGate(env: Record<string, string | undefined> = process.env): Gate {
  const flag = env.YARD_GROK_CHECK === "on";
  const key = !!env.XAI_API_KEY?.trim();
  if (flag && key) return { on: true };
  const why = [flag ? null : "repo variable YARD_GROK_CHECK is not \"on\"", key ? null : "no XAI_API_KEY secret"].filter(Boolean).join(" and ");
  return { on: false, reason: `calls are off: ${why}` };
}

export type Msg = { role: "system" | "user"; content: string };
export type Reply = { json: { ok: boolean; mismatches: { kind: string; spec_quote: string; build_shows: string; severity: string }[] } | null; usage: Usage | null; err: string | null; ms: number };
export type Transport = { kind: "live" | "replay"; send: (id: string, messages: Msg[]) => Promise<Reply> };

export const SYSTEM = readFileSync(new URL("./check-system.md", import.meta.url), "utf8");
export const SCHEMA = JSON.parse(readFileSync(new URL("./check-schema.json", import.meta.url), "utf8"));

/** Live transport. Refuses to exist unless the gate is on; `fetchImpl` is the real fetch captured before the run disables network. */
export function liveTransport(env: Record<string, string | undefined>, fetchImpl: typeof fetch, timeoutMs = 30_000): Transport {
  const g = grokCheckGate(env);
  if (!g.on) throw new Error(g.reason);
  const key = env.XAI_API_KEY!.trim();
  return {
    kind: "live",
    async send(_id, messages) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const t0 = Date.now();
      try {
        const res = await fetchImpl("https://api.x.ai/v1/chat/completions", {
          method: "POST", signal: ctl.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-grok-conv-id": "yard-grok-check-nightly" },
          body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: MAX_OUTPUT_TOKENS, messages, response_format: { type: "json_schema", json_schema: SCHEMA } }),
        });
        const body: any = await res.json().catch(() => null);
        const usage = body?.usage ?? null;
        if (!res.ok) return { json: null, usage, err: `HTTP ${res.status}`, ms: Date.now() - t0 };
        try { return { json: JSON.parse(body?.choices?.[0]?.message?.content ?? ""), usage, err: null, ms: Date.now() - t0 }; }
        catch { return { json: null, usage, err: "bad JSON", ms: Date.now() - t0 }; }
      } catch (e: any) {
        return { json: null, usage: null, err: e?.name === "AbortError" ? `timeout>${timeoutMs}ms` : "network error", ms: Date.now() - t0 };
      } finally { clearTimeout(t); }
    },
  };
}

/** Replay transport: recorded responses by id (fixtures/*.json). Never touches the network. */
export function replayTransport(rows: { id: string; recorded: { json: Reply["json"]; err?: string | null; usage?: { prompt_tokens: number; completion_tokens: number; cached_tokens?: number } } }[]): Transport {
  const by = new Map(rows.map((r) => [r.id, r]));
  return {
    kind: "replay",
    async send(id) {
      const r = by.get(id);
      if (!r) return { json: null, usage: null, err: "no recording", ms: 0 };
      const u = r.recorded.usage;
      return { json: r.recorded.json, usage: u ? { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, prompt_tokens_details: { cached_tokens: u.cached_tokens ?? 0 } } : null, err: r.recorded.err ?? null, ms: 0 };
    },
  };
}
