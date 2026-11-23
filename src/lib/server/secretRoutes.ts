/**
 * Secret-only endpoints: /api/cron/retention (CRON_SECRET), /api/critic-review (CRITIC_REVIEW_SECRET),
 * and GET/HEAD /api/feedback (the same CRITIC_REVIEW_SECRET). src/start.ts runs secretRoute() as request
 * middleware on every request, before the router. Cron and critic-review are not router routes, so a missing,
 * short or wrong secret doesn't imitate a not-found, it *is* one: next() to the app, the same SSR not-found as
 * any unknown /api/<path> (and the same 406 for a JSON Accept).
 *
 * GET/HEAD /api/feedback is the exception. That path is also the public POST route, so next() renders the app
 * shell (200 text/html) or, for Accept: application/json, 406 "Only HTML requests are supported here". A miss
 * is answered here with an empty 404 instead. POST still returns null so the router keeps the write.
 * The secret is only the Authorization header. A query string would be logged by the platform.
 *
 * Timing: every request does the same work before the decision, whatever the path: one Map lookup, one SHA-256 of
 * the Authorization header, one SHA-256 of the expected value (`Bearer <secret>`, or a fixed dummy when this path has
 * no secret or the env is unset/short) and one timingSafeEqual of the two digests. Nothing is read, imported or
 * fetched before that; the handlers load only after a match.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type SecretHandler = (request: Request, env?: Record<string, string | undefined>) => Promise<Response | null>;
type Entry = { env: string; min?: number; cron?: boolean; read?: boolean; load: () => Promise<SecretHandler> };

/** Chief: CRON_SECRET must be ≥ 16 characters; missing or shorter is treated as unset (and is a loud error). */
export const CRON_MIN_SECRET = 16;
export const SECRET_ROUTES = new Map<string, Entry>([
  ["/api/cron/retention", { env: "CRON_SECRET", min: CRON_MIN_SECRET, cron: true, load: async () => (await import("./retentionHandler")).retentionHandler }],
  ["/api/critic-review", { env: "CRITIC_REVIEW_SECRET", load: async () => (await import("./criticReviewHandler")).criticReviewHandler }],
  ["/api/feedback", { env: "CRITIC_REVIEW_SECRET", read: true, load: async () => (await import("./feedbackReadHandler")).feedbackReadHandler }],
]);
export const MIN_SECRET = 16;
const DUMMY = "Bearer \u0000no-secret-for-this-path\u0000".padEnd(48, "\u0000");

/** Constant-time check of `Authorization: Bearer <secret>`; false for a missing or short secret (same work either way). */
export function authorised(header: string | null, secret: string | undefined, min = MIN_SECRET): boolean {
  const valid = typeof secret === "string" && secret.length >= min;
  const got = createHash("sha256").update(header ?? "").digest();
  const want = createHash("sha256").update(valid ? `Bearer ${secret}` : DUMMY).digest();
  return timingSafeEqual(got, want) && valid;
}

/** Empty 404, no JSON body. A secret read must not fall through to the app shell. */
export function secretMiss(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** The answer for an authorised secret path, or null: carry on exactly as for any other request (next()). */
export async function secretRoute(request: Request, pathname: string, env: Record<string, string | undefined> = process.env): Promise<Response | null> {
  const entry = SECRET_ROUTES.get(pathname);
  const auth = request.headers.get("authorization");
  const ok = authorised(auth, entry ? env[entry.env] : undefined, entry?.min);
  if (entry?.cron && !ok) return cronMisconfigured(request, auth, env[entry.env], entry.min ?? MIN_SECRET);
  // Feedback's GET/HEAD is a router path (the POST). A miss is answered here; next() would be the shell or a 406.
  if (entry?.read) {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") return null;
    if (!ok) return secretMiss();
    return (await entry.load())(request, env) ?? secretMiss();
  }
  if (!entry || !ok) return null;
  return (await entry.load())(request, env);
}

/**
 * Fail loud, never silently skip the cleanup: when CRON_SECRET is missing or short the sweep can't run, so every hit
 * on the cron path logs an error, and a call that looks like Vercel's cron gets a 500 (the cron log shows a failed
 * run). A cron call is told apart by its headers only, never the user agent: `x-vercel-cron-schedule` (Vercel sends
 * it on every cron invocation, with or without CRON_SECRET) or any `Authorization: Bearer` (what Vercel sends once
 * CRON_SECRET exists, e.g. a too-short one). Everything else (public probes) still gets null → next() → the app's
 * real not-found. With CRON_SECRET set and long enough, a bad secret is a not-found as before, whatever the headers.
 */
function cronMisconfigured(request: Request, auth: string | null, secret: string | undefined, min: number): Response | null {
  if (typeof secret === "string" && secret.length >= min) return null;
  console.error("[retention] CRON_SECRET missing or too short");
  const fromCron = request.headers.has("x-vercel-cron-schedule") || /^Bearer\s/i.test(auth ?? "");
  return fromCron ? new Response("retention not run: CRON_SECRET not set up\n", { status: 500, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } }) : null;
}
