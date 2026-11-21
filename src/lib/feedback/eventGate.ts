/**
 * Who may POST /api/ev, and which pages must not send. No store, no network.
 * A refused request is decided here, before any Upstash command.
 *
 * yard.wiki (and the stable production hosts) are always allowed. Localhost is allowed
 * only when this process is not production. A preview host is allowed only when
 * VERCEL_ENV is preview, and that deployment charges the preview counters, not production.
 * Content-Type must be application/json, so a text/plain form POST is not an event.
 * offline=1, local=1 and test=1 pages are test traffic and send nothing.
 *
 * A script can still send a matching Origin header. The day cap and the events budget
 * are what bound that; this check does not claim to stop it.
 */
const PRODUCTION_ORIGINS = new Set([
  "https://yard.wiki",
  "https://www.yard.wiki",
  "https://yard-peach.vercel.app",
  "https://yard-build-hq.vercel.app",
]);
const TEST_QS = /(?:^|[?&])(?:offline|local|test)=1(?:&|$)/;

function originOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}
function searchOf(url: string | null): string {
  if (!url) return "";
  try { return new URL(url, "http://x").search; } catch { return ""; }
}
function localOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]" || u.hostname === "::1";
  } catch { return false; }
}

export function jsonContentType(header: string | null): boolean {
  return (header ?? "").toLowerCase().split(";")[0].trim() === "application/json";
}

/** True when Origin, or else Referer, is allowed for this process. */
export function eventOriginAllowed(
  origin: string | null,
  referer: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const cand = origin && origin !== "null" ? origin : originOf(referer);
  if (!cand) return false;
  if (PRODUCTION_ORIGINS.has(cand)) return true;
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv !== "production" && localOrigin(cand)) return true;
  if (env.VERCEL_PROJECT_PRODUCTION_URL && cand === `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`) return true;
  // This deployment's own host. Preview hosts are accepted only on a preview process.
  if (vercelEnv === "preview") {
    for (const key of ["VERCEL_URL", "VERCEL_BRANCH_URL"] as const) {
      const host = env[key];
      if (host && cand === `https://${host}`) return true;
    }
  } else if (vercelEnv === "production" && env.VERCEL_URL && cand === `https://${env.VERCEL_URL}`) return true;
  return false;
}

/** Page search: a test, offline or local build must not send events. */
export function eventPageQuiet(search: string): boolean {
  return TEST_QS.test(search.startsWith("?") || search === "" ? search : `?${search}`);
}

/** Server: the request itself is test traffic (query, referer or x-yard-test). */
export function eventTestTraffic(url: string, referer: string | null, testHeader: string | null): boolean {
  if ((testHeader ?? "").trim()) return true;
  if (TEST_QS.test(searchOf(url))) return true;
  if (TEST_QS.test(searchOf(referer))) return true;
  return false;
}

export type EventPostDecision = "ok" | "type" | "cross" | "test";

/** Decided from headers only. "test" is dropped with no store call. "type" and "cross" are not events. */
export function eventPostDecision(
  input: { contentType: string | null; origin: string | null; referer: string | null; url: string; testHeader: string | null },
  env: Record<string, string | undefined> = process.env,
): EventPostDecision {
  if (!jsonContentType(input.contentType)) return "type";
  if (!eventOriginAllowed(input.origin, input.referer, env)) return "cross";
  if (eventTestTraffic(input.url, input.referer, input.testHeader)) return "test";
  return "ok";
}
