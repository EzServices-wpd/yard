/**
 * The two secret-only endpoints, /api/cron/retention (CRON_SECRET) and /api/critic-review (CRITIC_REVIEW_SECRET).
 * They are not router routes: src/start.ts runs secretRoute() as request middleware on every request, and anything
 * it doesn't answer goes on with next() to the app, where these paths match nothing. So a missing, short or wrong
 * secret doesn't imitate a not-found, it *is* one: the same SSR not-found page with the same status, body and headers
 * (and the same 406 for a JSON Accept, HEAD body-stripping, etc.) as any unknown /api/<path>.
 *
 * Timing: every request does the same work before the decision, whatever the path: one Map lookup, one SHA-256 of
 * the Authorization header, one SHA-256 of the expected value (`Bearer <secret>`, or a fixed dummy when this path has
 * no secret or the env is unset/short) and one timingSafeEqual of the two digests. Nothing is read, imported or
 * fetched before that; the handlers load only after a match.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type SecretHandler = (request: Request) => Promise<Response | null>;
type Entry = { env: string; load: () => Promise<SecretHandler> };

export const SECRET_ROUTES = new Map<string, Entry>([
  ["/api/cron/retention", { env: "CRON_SECRET", load: async () => (await import("./retentionHandler")).retentionHandler }],
  ["/api/critic-review", { env: "CRITIC_REVIEW_SECRET", load: async () => (await import("./criticReviewHandler")).criticReviewHandler }],
]);
export const MIN_SECRET = 16;
const DUMMY = "Bearer \u0000no-secret-for-this-path\u0000".padEnd(48, "\u0000");

/** Constant-time check of `Authorization: Bearer <secret>`; false for a missing or short secret (same work either way). */
export function authorised(header: string | null, secret: string | undefined): boolean {
  const valid = typeof secret === "string" && secret.length >= MIN_SECRET;
  const got = createHash("sha256").update(header ?? "").digest();
  const want = createHash("sha256").update(valid ? `Bearer ${secret}` : DUMMY).digest();
  return timingSafeEqual(got, want) && valid;
}

/** The answer for an authorised secret path, or null: carry on exactly as for any other request (next()). */
export async function secretRoute(request: Request, pathname: string, env: Record<string, string | undefined> = process.env): Promise<Response | null> {
  const entry = SECRET_ROUTES.get(pathname);
  const ok = authorised(request.headers.get("authorization"), entry ? env[entry.env] : undefined);
  if (!entry || !ok) return null;
  return (await entry.load())(request);
}
