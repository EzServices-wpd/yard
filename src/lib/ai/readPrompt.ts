/**
 * AI prompt reader server function (I49). Ships OFF: it calls xAI only when the server has YARD_AI_READER=on (any other
 * value is the kill switch), the existing server-side xAI key (read only in xai.server.ts), and the Upstash store. The key never
 * leaves the server: the only door is xaiFetch, which also applies the per-IP daily cap (YARD_DAILY_READER_CAP, 20).
 * The $1/day counter is Upstash (atomic, shared by every instance and region); Runtime Cache holds only the 30-day
 * result cache, keyed by the normalized prompt.
 */
import { createServerFn } from "@tanstack/react-start";
import { cacheGet, cacheSet, dailyCapReached } from "./dailyCap.server";
import { hasXaiKey, xaiFetch } from "./xai.server";
import { restPipe } from "@/lib/yard/ideaLog.server";
import { readPrompt, readerEnv, reserveUsd, settleUsd, utcDay, type ReaderDeps } from "@/lib/yard/aiReader/core";

function serverDeps(): ReaderDeps {
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

export const readPromptSpec = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; test?: boolean }) => ({ prompt: String(input?.prompt ?? "").slice(0, 400), test: input?.test === true }))
  .handler(async ({ data }) => readPrompt(data.prompt, data.test, serverDeps()));
