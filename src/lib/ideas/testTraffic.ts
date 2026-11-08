/**
 * Test traffic, decided only by the real signals the request carried, never by the prompt text (a real
 * "test tube rack" or "canary yellow birdhouse" is a visitor's build):
 *   - the `test=1` query flag on the logged URL, or the `x-yard-test: 1` request header (src/lib/ideas/testSession.ts);
 *   - for an Ideas log row, the source the log gate stamped from those signals (ideaLogGate.testTrafficReason → "test").
 * Pure: no store, no engine, no node APIs. Shared by the Ideas live feed and the eval gate's corpus import.
 */
export type LoggedRecord = { url?: string; u?: string; headers?: Record<string, string | string[] | undefined> };

/** A logged request record is test traffic when its URL has test=1 or it carried x-yard-test: 1. No record → not test. */
export function isTestTraffic(rec: LoggedRecord | null | undefined): boolean {
  if (!rec) return false;
  const url = rec.url ?? rec.u ?? "";
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  if (new URLSearchParams(q).getAll("test").includes("1")) return true;
  for (const [k, v] of Object.entries(rec.headers ?? {})) if (k.toLowerCase() === "x-yard-test" && [v].flat().some((x) => String(x).trim() === "1")) return true;
  return false;
}

/** An Ideas log row the gate stamped as test traffic (test=1 / x-yard-test / offline / preview), from its logged source. */
export function isLoggedTest(r: { source?: string | null }): boolean {
  return r.source === "test";
}
