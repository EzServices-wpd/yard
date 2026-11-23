import { createFileRoute } from "@tanstack/react-router";
import { eventPostDecision } from "@/lib/feedback/eventGate";
import { cleanEvent } from "@/lib/feedback/events";
import { shopStore } from "@/lib/feedback/store.server";

// Build events (build, buy, export, thumb), keyed by build id.
// Origin and content-type are checked first, so a cross-origin or text/plain POST never reaches the store.
// Test traffic (offline=1, local=1, test=1) is answered and not stored. This route does not read an IP address.
// The day cap and the events budget are atomic Redis counters. 204 when kept, dropped as a test, or the store is off.
// 403 when the caller is cross-origin or not JSON. 429 when a cap says no. 400 otherwise.
export const Route = createFileRoute("/api/ev")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const headers = { "Cache-Control": "no-store" };
        const decision = eventPostDecision({
          contentType: request.headers.get("content-type"),
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          url: request.url,
          testHeader: request.headers.get("x-yard-test"),
        });
        if (decision === "test") return new Response(null, { status: 204, headers });
        if (decision !== "ok") return new Response(null, { status: 403, headers });
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
