"use client";
/**
 * The browser half of build events: fire and forget, never blocks the page, never retries, and sends each event
 * about a build at most once per tab (a reload of the same build is not a second build). No cookie, no referrer
 * (the page URL carries the prompt), no identity.
 */
import type { EventIn } from "./events";

const SENT = "yard.ev.v1:";
const onceKey = (e: EventIn) => `${SENT}${e.bid}|${e.ev}|${e.store ?? e.kind ?? (e.up == null ? "" : e.up ? "up" : "down")}`;

export function sendEvent(e: EventIn): void {
  try {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(onceKey(e)) === "1") return;
      sessionStorage.setItem(onceKey(e), "1");
    } catch { /* private mode: send anyway; the server caps the day */ }
    const body = JSON.stringify(e);
    void fetch("/api/ev", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "omit", referrerPolicy: "no-referrer", keepalive: true }).catch(() => undefined);
  } catch { /* never throws into the page */ }
}
