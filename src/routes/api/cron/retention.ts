import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { Budget, FREE_TIER, IdeaStore, restPipe } from "@/lib/yard/ideaLog.server";
import { ShopStore } from "@/lib/feedback/store.server";

/**
 * Retention sweep (vercel.json crons: two daily jobs, 08:17 and 20:17 UTC; free on the current plan). Vercel calls it with
 * `Authorization: Bearer $CRON_SECRET`; anything else, or no CRON_SECRET in the env, is a plain 404.
 * Drops ideas rows whose last-seen is past RETAIN_DAYS from all their keys together (IdeaStore.sweep, capped at
 * SWEEP_MAX_CMDS commands a run) and trims feedback notes past RETAIN_DAYS (ShopStore.sweep). Counts only in the reply.
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
        // Deletion may use the 50K between BUDGET and the free tier: a month whose writes hit BUDGET still sweeps.
        const pipe = restPipe();
        const ideas = await new IdeaStore(pipe, new Budget(FREE_TIER)).sweep();
        await new ShopStore(pipe, new Budget(FREE_TIER)).sweep();
        return Response.json({ ideas }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
