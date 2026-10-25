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

const capKey = (bucket: CapBucket, ip: string) => `yard-cap:${bucket}:${ip}:${new Date().toISOString().slice(0, 10)}`;
export async function underDailyCap(bucket: CapBucket = "ai", ip = visitorIp()): Promise<boolean> {
  const key = capKey(bucket, ip);
  const n = (Number(await cacheGet(key)) || 0) + 1;
  await cacheSet(key, n, 86_400);
  return n <= CAPS[bucket]();
}
/** Read-only: has this visitor already used the bucket's day? (Checked before any other paid or metered step.) A Runtime Cache error counts as reached (closed, not per-instance memory). */
export async function dailyCapReached(bucket: CapBucket, ip = visitorIp(), cache: () => Pick<ReturnType<typeof getCache>, "get"> = getCache): Promise<boolean> {
  try { return (Number(await cache().get(capKey(bucket, ip))) || 0) >= CAPS[bucket](); } catch { return true; }
}
function visitorIp(): string {
  try {
    const h = getRequest()?.headers;
    return h?.get("x-real-ip") || h?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  } catch { return "unknown"; }
}
