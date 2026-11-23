import { createFileRoute } from "@tanstack/react-router";
import { feedbackReadHandler } from "@/lib/server/feedbackReadHandler";
import { cleanCid, cleanFeedback } from "@/lib/feedback/shop";
import { shopStore } from "@/lib/feedback/store.server";

// "Tell the shop" write. Reads only the JSON body: no IP, UA or cookie is read or stored.
// 204 when kept (or the store is off), 429 when rate-limited, 400 when there was nothing to keep.
// GET is registered so the document renderer cannot claim it (that was the HTML shell / 406).
// secretRoutes still runs first and answers GET/HEAD before this route.
export const Route = createFileRoute("/api/feedback")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        (await feedbackReadHandler(request)) ??
        new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } }),
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        try {
          const text = (await request.text()).slice(0, 2048);
          const tip = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
          const body = JSON.parse(text) as Record<string, unknown>;
          const rec = cleanFeedback(body, tip); // the server scrub stays, whatever the browser did
          if (!rec) return new Response(null, { status: 400, headers });
          const out = await shopStore().addFeedback(rec, cleanCid(body.cid));
          return new Response(null, { status: out === "limited" ? 429 : 204, headers });
        } catch {
          return new Response(null, { status: 400, headers });
        }
      },
    },
  },
});
