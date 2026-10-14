import { getRequest } from "@tanstack/react-start/server";

/** Per-visitor daily cap on AI calls (YARD_DAILY_AI_CAP, default 40), keyed by IP and UTC day.
 * ponytail: per server instance memory, so it is approximate; move to the DB if abuse shows up. */
const aiCalls = new Map<string, number>();
export function underDailyCap(ip = visitorIp(), cap = Number(process.env.YARD_DAILY_AI_CAP ?? 40)): boolean {
  const key = `${ip}:${new Date().toISOString().slice(0, 10)}`;
  if (aiCalls.size > 50_000) aiCalls.clear();
  const n = (aiCalls.get(key) ?? 0) + 1;
  aiCalls.set(key, n);
  return n <= cap;
}
function visitorIp(): string {
  try {
    const h = getRequest()?.headers;
    return h?.get("x-real-ip") || h?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  } catch { return "unknown"; }
}

