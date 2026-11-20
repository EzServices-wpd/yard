/**
 * Build events (launch plan A2): what happened to a build, keyed by its build id. Shared by the browser sender
 * (sendEvent.ts) and POST /api/ev. No identity anywhere: no IP, user agent, cookie or client id is read or kept.
 * Only the build event carries the scrubbed words (safePrompt) and the server tip. Client price, part count,
 * size and family are not stored, so a forged event cannot plant a number the digest would print as fact.
 */
import { safePrompt } from "@/lib/yard/ideaLog";
import { BID } from "./buildId";

export const EVENTS = ["build", "buy", "export", "thumb"] as const;
export type EventName = (typeof EVENTS)[number];
export const STORES = ["homedepot", "lowes", "amazon", "rockler", "woodcraft", "other"] as const;
export const EXPORTS = ["pdf", "md", "copy"] as const;

export type EventIn = { bid: string; ev: EventName; store?: string; kind?: string; up?: boolean; prompt?: string | null; size?: string; family?: string; parts?: number; usd?: number };
/**
 * What a build event may keep. Price, part count, size and family arrive from the browser and are not trusted,
 * so they are not stored. `unverified` marks the record: the digest may quote the scrubbed words, never a number.
 */
export type EventBuild = { prompt: string | null; tip: string; unverified: true };
export type EventRecord = {
  bid: string;
  ev: EventName;
  /** buy: which store; export: which kind; thumb: up or down. */
  detail: string;
  /** Only on a build event. */
  build?: EventBuild;
  at: string;
};

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
    // Client price, parts, size and family are dropped here. The first write must not be able to plant them.
    rec.build = {
      prompt: typeof b.prompt === "string" ? safePrompt(b.prompt) : null,
      tip: /^[0-9a-f]{7,40}$/i.test(tip) ? tip.slice(0, 7) : "local",
      unverified: true,
    };
  }
  return rec;
}
