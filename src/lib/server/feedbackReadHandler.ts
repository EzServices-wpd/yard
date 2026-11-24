import { FEEDBACK_KEEP, shopStore, type ShopStore } from "@/lib/feedback/store.server";
import { authorised, secretMiss } from "./secretRoutes";

/**
 * Read stored "Tell the shop" notes from the same list POST writes (`feedback:list`, newest first).
 * secretRoutes calls this only after the Bearer check; the route's GET calls it directly, and this checks again.
 *   GET /api/feedback?limit=50&since=2026-11-01T00:00:00.000Z
 *   Authorization: Bearer <CRITIC_REVIEW_SECRET>
 * limit defaults to 50 and is capped at the list (2000). since is exclusive (`at` strictly after), a real UTC instant.
 * A value that only matches the shape (month 13, Feb 31, 99:99) is 400, with no echo of the value.
 * The secret is the Authorization header only. limit and since are the only query params read.
 * Every answer is Cache-Control: no-store. A missing, short or wrong secret is an empty 404 (not JSON).
 */
const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE },
  });

const DEFAULT_LIMIT = 50;

/** UTC ISO-8601 that is a real instant. Month 13, Feb 31 and 99:99 match the shape and are still impossible. */
function realSince(raw: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(raw);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export async function feedbackReadHandler(
  request: Request,
  env: Record<string, string | undefined> = process.env,
  store: ShopStore = shopStore(),
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if (!authorised(request.headers.get("authorization"), env.CRITIC_REVIEW_SECRET))
    return secretMiss();
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return json({ error: "url" }, 400);
  }
  const limitRaw = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null && limitRaw !== "") {
    if (!/^[1-9]\d{0,5}$/.test(limitRaw)) return json({ error: "limit" }, 400);
    limit = Math.min(FEEDBACK_KEEP, Number(limitRaw));
  }
  const sinceRaw = url.searchParams.get("since");
  if (sinceRaw !== null && sinceRaw !== "" && !realSince(sinceRaw))
    return json({ error: "since" }, 400);
  const since = sinceRaw ? sinceRaw : null;
  let rows: Awaited<ReturnType<ShopStore["listFeedback"]>>;
  try {
    rows = await store.listFeedback(limit, since);
  } catch {
    rows = null;
  }
  if (!rows) return json({ error: "off" }, 503);
  return json({ rows });
}
