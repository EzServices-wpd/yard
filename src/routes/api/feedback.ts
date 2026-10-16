import { createFileRoute } from "@tanstack/react-router";
import { cleanFeedback } from "@/lib/feedback/shop";
import { shopStore } from "@/lib/feedback/store.server";

// "Tell the shop" write. Reads only the JSON body: no IP, UA or cookie is read or stored.
// 204 when kept (or the store is off), 429 when rate-limited, 400 when there was nothing to keep.
export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        try {
          const text = (await request.text()).slice(0, 2048);
          const tip = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
          const rec = cleanFeedback(JSON.parse(text), tip);
          if (!rec) return new Response(null, { status: 400, headers });
          const out = await shopStore().addFeedback(rec);
          return new Response(null, { status: out === "limited" ? 429 : 204, headers });
        } catch {
          return new Response(null, { status: 400, headers });
        }
      },
    },
  },
});
