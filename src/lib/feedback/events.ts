/**
 * Build events (launch plan A2): what happened to a build, keyed by its build id. Shared by the browser sender
 * (sendEvent.ts) and POST /api/ev. No identity anywhere: no IP, user agent, cookie or client id is read or kept.
 * Only the build event carries the build's words, size and family, scrubbed like the query log (safePrompt), so
 * the digest can say which build a thumbs-down or a Buy click was about.
 */
import { safePrompt } from "@/lib/yard/ideaLog";
import { BID } from "./buildId";

export const EVENTS = ["build", "buy", "export", "thumb"] as const;
export type EventName = (typeof EVENTS)[number];
export const STORES = ["homedepot", "lowes", "amazon", "rockler", "woodcraft", "other"] as const;
export const EXPORTS = ["pdf", "md", "copy"] as const;

export type EventIn = { bid: string; ev: EventName; store?: string; kind?: string; up?: boolean; prompt?: string | null; size?: string; family?: string; parts?: number; usd?: number };
export type EventRecord = {
  bid: string;
  ev: EventName;
  /** buy: which store; export: which kind; thumb: up or down. */
  detail: string;
  /** Only on a build event: what the digest shows for this build. */
  build?: { prompt: string | null; size: string; family: string; parts: number; usd: number; tip: string };
  at: string;
};

const SIZE = /^[0-9 x×."'/-]{1,40}$/i;
const FAMILY = /^[a-z][a-z0-9-]{0,31}$/;

/** Liberal in what it accepts, strict in what it keeps. Null when it is not an event about a build. */
export function cleanEvent(raw: unknown, tip: string, now = new Date()): EventRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const bid = typeof b.bid === "string" && BID.test(b.bid) ? b.bid : null;
  const ev = typeof b.ev === "string" && (EVENTS as readonly string[]).includes(b.ev) ? (b.ev as EventName) : null;
  if (!bid || !ev) return null;
  let detail = "";
  if (ev === "buy") detail = typeof b.store === "string" && (STORES as readonly string[]).includes(b.store) ? b.store : "other";
  if (ev === "export") detail = typeof b.kind === "string" && (EXPORTS as readonly string[]).includes(b.kind) ? b.kind : "pdf";
  if (ev === "thumb") { if (typeof b.up !== "boolean") return null; detail = b.up ? "up" : "down"; }
  const rec: EventRecord = { bid, ev, detail, at: now.toISOString() };
  if (ev === "build") {
    const n = Number(b.parts), usd = Number(b.usd);
    rec.build = {
      prompt: typeof b.prompt === "string" ? safePrompt(b.prompt) : null,
      size: typeof b.size === "string" && SIZE.test(b.size.trim()) ? b.size.trim() : "",
      family: typeof b.family === "string" && FAMILY.test(b.family) ? b.family : "",
      parts: Number.isInteger(n) && n >= 0 && n < 10_000 ? n : 0,
      usd: Number.isFinite(usd) && usd >= 0 && usd < 1_000_000 ? Math.round(usd * 100) / 100 : 0,
      tip: /^[0-9a-f]{7,40}$/i.test(tip) ? tip.slice(0, 7) : "local",
    };
  }
  return rec;
}
