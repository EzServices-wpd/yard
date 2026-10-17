import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { GRADE, shopStore } from "@/lib/feedback/store.server";

/**
 * Critic's review marks on the query log. Bearer CRITIC_REVIEW_SECRET; without the env the route is 404.
 *   GET  ?op=unreviewed&limit=20   → { rows }   query-log entries with no review mark
 *   GET  ?op=sample&n=5            → { rows }   random reviewed entries (stamps lastSampledAt)
 *   POST { key, grade }            → { ok }     marks one reviewed (grade: 1–8 chars, A-Z 0-9 + -)
 * No identity is stored: only the query log's own key, prompt, size and result.
 */
function authorised(request: Request): boolean | null {
  const secret = process.env.CRITIC_REVIEW_SECRET;
  if (!secret || secret.length < 16) return null;
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/critic-review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ok = authorised(request);
        if (ok === null) return new Response(null, { status: 404 });
        if (!ok) return json({ error: "unauthorised" }, 401);
        const u = new URL(request.url);
        const op = u.searchParams.get("op");
        const n = Math.min(50, Math.max(1, Number(u.searchParams.get(op === "sample" ? "n" : "limit")) || (op === "sample" ? 5 : 20)));
        if (op === "unreviewed") return json({ rows: await shopStore().unreviewed(n) });
        if (op === "sample") return json({ rows: await shopStore().sample(n) });
        return json({ error: "op must be unreviewed or sample" }, 400);
      },
      POST: async ({ request }) => {
        const ok = authorised(request);
        if (ok === null) return new Response(null, { status: 404 });
        if (!ok) return json({ error: "unauthorised" }, 401);
        try {
          const b = JSON.parse((await request.text()).slice(0, 512)) as { key?: unknown; grade?: unknown };
          if (typeof b.key !== "string" || !/^[0-9a-f]{8}$/.test(b.key) || typeof b.grade !== "string" || !GRADE.test(b.grade)) return json({ error: "need key (8 hex) and grade" }, 400);
          const out = await shopStore().mark(b.key, b.grade);
          return json({ ok: out === "marked", result: out }, out === "unknown" ? 404 : out === "off" ? 503 : 200);
        } catch {
          return json({ error: "bad json" }, 400);
        }
      },
    },
  },
});
