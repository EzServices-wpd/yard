import { createFileRoute } from "@tanstack/react-router";
import { ideaStore } from "@/lib/yard/ideaLog.server";
import { EMPTY_SNAPSHOT } from "@/lib/yard/ideaLog";
import { curatedFeed } from "@/lib/ideas/feed";
import { liveFeed } from "@/lib/ideas/liveFeed";
import RECIPES from "@/lib/ideas/recipes.json";

// The Ideas feed (PR-PLAN.md (a)): the store snapshot (one rebuild per 10 min, F36) grouped by build type with
// test traffic skipped, then the curated sections. Same JSON for every visitor; the request is never read.
export const Route = createFileRoute("/api/ideas")({
  server: {
    handlers: {
      GET: async () => {
        let snap = EMPTY_SNAPSHOT;
        try { snap = await ideaStore().served(); } catch { /* fallback */ }
        const feed = liveFeed(snap, curatedFeed(RECIPES));
        return Response.json(feed, { headers: { "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400" } });
      },
    },
  },
});
