/**
 * Test-traffic gate for the Endless Ideas log (/api/ideas-log). The nightly sweep treats every logged
 * prompt as a real user request, so Critic's harness, our walks and preview deploys must never write.
 *
 * Markers (any one drops the write; the response is still 204 so callers can't tell):
 *   - page URL has `offline=1` or `local=1`  -> the client never sends (isTestPage)
 *   - request header `x-yard-test: 1` (any non-empty value)  -> Playwright `extraHTTPHeaders` covers beacons too
 *   - request URL query `?test=1` / `offline=1` / `local=1` on /api/ideas-log itself
 *   - Referer whose query has `offline=1` / `local=1` (same-origin fetch fallback)
 *   - server env VERCEL_ENV=preview or development (preview deploys are Critic-only)
 */
const TEST_QS = /(?:^|[?&])(?:offline|local|test)=1(?:&|$)/;
const PAGE_QS = /(?:^|[?&])(?:offline|local)=1(?:&|$)/;

/** Client: true when the current page is a test/offline build; logIdea must not send. */
export function isTestPage(search: string): boolean {
  return PAGE_QS.test(search);
}

function query(u: string | null): string {
  if (!u) return "";
  try { return new URL(u, "http://x").search; } catch { return ""; }
}

/** Server: why this log request must be dropped, or null when it is real user traffic. */
export function testTrafficReason(
  req: { url: string; headers: { get(name: string): string | null } },
  env: Record<string, string | undefined> = process.env,
): string | null {
  const vEnv = env.VERCEL_ENV;
  if (vEnv === "preview" || vEnv === "development") return `env:${vEnv}`;
  if ((req.headers.get("x-yard-test") ?? "").trim()) return "header:x-yard-test";
  if (TEST_QS.test(query(req.url))) return "query";
  if (PAGE_QS.test(query(req.headers.get("referer")))) return "referer";
  return null;
}
