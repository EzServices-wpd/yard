import { createFileRoute } from "@tanstack/react-router";
import { cleanEvent } from "@/lib/feedback/events";
import { shopStore } from "@/lib/feedback/store.server";

// Build events (build, buy, export, thumb), keyed by build id. Reads only the JSON body: no IP, UA or cookie.
// 204 when kept (or the store is off), 429 when the hard daily cap or the instance limiter says no, 400 otherwise.
export const Route = createFileRoute("/api/ev")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        try {
          const text = (await request.text()).slice(0, 1024);
          const rec = cleanEvent(JSON.parse(text), process.env.VERCEL_GIT_COMMIT_SHA ?? "");
          if (!rec) return new Response(null, { status: 400, headers });
          const out = await shopStore().addEvent(rec);
          return new Response(null, { status: out === "limited" ? 429 : 204, headers });
        } catch {
          return new Response(null, { status: 400, headers });
        }
      },
    },
  },
});
