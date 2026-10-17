import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { ideaStore } from "@/lib/yard/ideaLog.server";
import { shopStore } from "@/lib/feedback/store.server";

/**
 * Daily retention sweep (vercel.json crons, once a day; free on the current plan). Vercel calls it with
 * `Authorization: Bearer $CRON_SECRET`; anything else, or no CRON_SECRET in the env, is a plain 404.
 * Drops ideas rows whose last-seen is past RETAIN_DAYS from all their keys together (IdeaStore.sweep, capped at
 * SWEEP_MAX_CMDS commands a run) and trims feedback notes past 90 days (ShopStore.sweep). Counts only in the reply.
 */
function authorised(request: Request, secret = process.env.CRON_SECRET): boolean {
  if (!secret || secret.length < 16) return false;
  const got = request.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/retention")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorised(request)) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
        const ideas = await ideaStore().sweep();
        await shopStore().sweep();
        return Response.json({ ideas }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
