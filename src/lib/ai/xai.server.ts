import { underDailyCap, type CapBucket } from "./dailyCap.server";

export const CAP_MESSAGE = "That's today's free AI lookups for this visitor. Built-in shapes and saved recipes still work; lookups reset tomorrow.";

/** The only door to api.x.ai: no key → unavailable; over the visitor's daily cap → refused before any spend. */
export async function xaiFetch(path: "chat/completions" | "images/generations", body: unknown, bucket: CapBucket = path === "images/generations" ? "image" : "ai"): Promise<{ ok: true; res: Response } | { ok: false; error: string; capped?: boolean }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not available in this environment" };
  if (!(await underDailyCap(bucket))) return { ok: false, error: CAP_MESSAGE, capped: true };
  const res = await fetch(`https://api.x.ai/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  return { ok: true, res };
}
