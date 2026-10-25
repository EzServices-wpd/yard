import { getRequest } from "@tanstack/react-start/server";
import { getCache } from "@vercel/functions";

/**
 * Per-visitor daily caps on AI calls, keyed by IP, bucket and UTC day, counted in Vercel Runtime Cache
 * (shared across instances in a region; free). Off Vercel it falls back to this instance's memory.
 * ponytail: get-then-set is not atomic; a burst can overshoot by a call or two.
 */
const CAPS = { ai: () => Number(process.env.YARD_DAILY_AI_CAP ?? 40), image: () => Number(process.env.YARD_DAILY_IMAGE_CAP ?? 3), reader: () => Number(process.env.YARD_DAILY_READER_CAP ?? 20) };
export type CapBucket = keyof typeof CAPS;
const local = new Map<string, unknown>();

/** Vercel Runtime Cache, or this instance's memory off Vercel. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try { return ((await getCache().get(key)) ?? undefined) as T | undefined; } catch { return local.get(key) as T | undefined; }
}
export async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  try { await getCache().set(key, value, { ttl }); } catch { if (local.size > 50_000) local.clear(); local.set(key, value); }
}

export async function underDailyCap(bucket: CapBucket = "ai", ip = visitorIp()): Promise<boolean> {
  const key = `yard-cap:${bucket}:${ip}:${new Date().toISOString().slice(0, 10)}`;
  const n = (Number(await cacheGet(key)) || 0) + 1;
  await cacheSet(key, n, 86_400);
  return n <= CAPS[bucket]();
}
function visitorIp(): string {
  try {
    const h = getRequest()?.headers;
    return h?.get("x-real-ip") || h?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  } catch { return "unknown"; }
}
