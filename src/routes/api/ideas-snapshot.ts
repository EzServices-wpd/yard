import { createFileRoute } from "@tanstack/react-router";
import { ideaStore } from "@/lib/yard/ideaLog.server";
import { EMPTY_SNAPSHOT } from "@/lib/yard/ideaLog";

// Endless Ideas CDN snapshot (R8, R12): one store read per 10 min per edge; search and the banner read this, never the store.
export const Route = createFileRoute("/api/ideas-snapshot")({
  server: {
    handlers: {
      // F36: the request (query string included) is never read: every URL gets the same memoised body,
      // and a store rebuild happens at most once per 10 min across all instances (store lock).
      GET: async () => {
        let snap = EMPTY_SNAPSHOT;
        try { snap = await ideaStore().served(); } catch { /* empty */ }
        return Response.json(snap, { headers: { "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600" } });
      },
    },
  },
});
