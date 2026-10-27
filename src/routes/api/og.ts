import { createFileRoute } from "@tanstack/react-router";
import { cardSvg } from "@/lib/og/card";
import { cardFactsWithin } from "@/lib/og/budget.server";
import { svgToPng } from "@/lib/og/png.server";

// A shared build's link preview (PR 4): /api/og?y=<share token> → 1200×630 PNG of that build, drawn from the engine
// read-only. Anything else (no token, a bad or measured token, a learner noun, a refusal) gets the default card.
// No fetches, no keys, no store links. A card is the same for a token until a deploy (the CDN cache is per deployment).
const BUILT = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400";
const DEFAULT = "public, max-age=300, s-maxage=3600";
/** Another card was rendering on this instance: the default card, but not for long (the next try may build it). */
const BUSY = "public, max-age=60, s-maxage=60";
/** Per instance: a token's answer (built, default or too slow) is worked out once. */
const memo = new Map<string, { body: Uint8Array; cache: string }>();
const MEMO_MAX = 64;
let site: Uint8Array | null = null;

const png = (body: Uint8Array, cache: string) =>
  new Response(body as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("y") ?? "";
        // One URL per card: any other parameter (?y=…&z=1) would be a new CDN entry and a new render.
        if ([...url.searchParams.keys()].some((k) => k !== "y") || url.searchParams.getAll("y").length > 1) {
          const to = token ? `/api/og?${new URLSearchParams({ y: token })}` : "/api/og";
          return new Response(null, { status: 308, headers: { Location: to, "Cache-Control": DEFAULT } });
        }
        try {
          const hit = memo.get(token);
          if (hit) return png(hit.body, hit.cache);
          // Off the request thread and inside a time budget: a slow or busy card is the default card.
          const { facts, why } = token ? await cardFactsWithin(token) : { facts: null, why: "ok" as const };
          const body = facts ? await svgToPng(cardSvg(facts)) : (site ??= await svgToPng(cardSvg(null)));
          const cache = facts ? BUILT : why === "busy" ? BUSY : DEFAULT;
          if (why !== "busy") {
            if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
            memo.set(token, { body, cache });
          }
          return png(body, cache);
        } catch {
          // The renderer itself failed: the site's static card.
          return new Response(null, { status: 302, headers: { Location: "/og.jpg", "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
