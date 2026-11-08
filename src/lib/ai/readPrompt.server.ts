/**
 * Server wiring for the AI prompt reader (I49): the key check, the Upstash $1/day counter, the Runtime Cache result
 * cache and the per-visitor limit. Server only (imported by readPrompt.ts's handler and by the wiring test).
 */
import { cacheGet, cacheSet, dailyCapReached } from "./dailyCap.server";
import { hasXaiKey, xaiFetch } from "./xai.server";
import { restPipe } from "@/lib/yard/ideaLog.server";
import { readerEnv, reserveUsd, settleUsd, utcDay, type ReaderDeps } from "@/lib/yard/aiReader/core";

export function serverDeps(): ReaderDeps {
  const day = utcDay();
  const pipe = restPipe();
  return {
    env: readerEnv(process.env, !!pipe, hasXaiKey()),
    cacheGet: (k) => cacheGet<string>(k),
    cacheSet: (k, v, ttl) => cacheSet(k, v, ttl),
    ipCapped: () => dailyCapReached("reader"),
    reserve: async (usd, cap) => !!pipe && reserveUsd(pipe, day, usd, cap),
    settle: async (reserved, billed) => { if (pipe) await settleUsd(pipe, day, reserved, billed); },
    async call(body, signal) {
      const r = await xaiFetch("chat/completions", body, "reader", { signal });
      return r.ok ? { ok: true, status: r.res.status, body: await r.res.json().catch(() => null) } : r;
    },
    log: (line) => console.log(line),
  };
}
