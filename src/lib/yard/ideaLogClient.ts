import { isTestPage } from "./ideaLogGate";
import { EMPTY_SNAPSHOT, safePrompt, type IdeasSnapshot } from "./ideaLog";

/** Fire-and-forget log of a build (R7): at idle, via sendBeacon; the server decides status. No xAI, no identity. */
export function logIdea(prompt: string, failed = false): void {
  if (typeof window === "undefined") return;
  if (isTestPage(window.location.search)) return; // offline=1 / local=1: test traffic, never logged
  const clean = safePrompt(prompt);
  if (!clean) return;
  const send = () => {
    try {
      const body = JSON.stringify({ prompt: clean, failed });
      if (!navigator.sendBeacon?.("/api/ideas-log", new Blob([body], { type: "application/json" })))
        void fetch("/api/ideas-log", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch { /* never surfaces */ }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(send, { timeout: 5000 });
  else setTimeout(send, 1500);
}

let cached: Promise<IdeasSnapshot> | null = null;
export function loadSnapshot(): Promise<IdeasSnapshot> {
  return (cached ??= fetch("/api/ideas-snapshot").then((r) => (r.ok ? (r.json() as Promise<IdeasSnapshot>) : EMPTY_SNAPSHOT)).catch(() => EMPTY_SNAPSHOT));
}
