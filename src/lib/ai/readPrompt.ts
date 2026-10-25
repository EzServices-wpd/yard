/**
 * AI prompt reader server function (I49). Ships OFF: it calls xAI only when the server has YARD_AI_READER=on (any other
 * value is the kill switch), the existing server-side xAI key (read only in xai.server.ts), and the Upstash store. The key never
 * leaves the server: the only door is xaiFetch, which also applies the per-IP daily cap (YARD_DAILY_READER_CAP, 20).
 * The $1/day counter is Upstash (atomic, shared by every instance and region); Runtime Cache holds only the 30-day
 * result cache, keyed by a SHA-256 of the normalized prompt. Wiring: readPrompt.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { serverDeps } from "./readPrompt.server";
import { readPrompt } from "@/lib/yard/aiReader/core";

export const readPromptSpec = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; test?: boolean }) => ({ prompt: String(input?.prompt ?? "").slice(0, 400), test: input?.test === true }))
  .handler(async ({ data }) => readPrompt(data.prompt, data.test, serverDeps()));
