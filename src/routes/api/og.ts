import { createFileRoute } from "@tanstack/react-router";
import { cardFacts, cardSvg } from "@/lib/og/card";
import { svgToPng } from "@/lib/og/png.server";

// A shared build's link preview (PR 4): /api/og?y=<share token> → 1200×630 PNG of that build, drawn from the engine
// read-only. Anything else (no token, a bad or measured token, a learner noun, a refusal) gets the default card.
// No fetches, no keys, no store links. A card is the same for a token until a deploy (the CDN cache is per deployment).
const BUILT = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400";
const DEFAULT = "public, max-age=300, s-maxage=3600";
const memo = new Map<string, Uint8Array>();
const MEMO_MAX = 64;

const png = (body: Uint8Array, cache: string) =>
  new Response(body as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("y") ?? "";
        try {
          const hit = memo.get(token);
          if (hit) return png(hit, hit === memo.get("") ? DEFAULT : BUILT);
          let facts = null;
          try { facts = cardFacts(token); } catch { facts = null; }
          const key = facts ? token : "";
          const body = memo.get(key) ?? (await svgToPng(cardSvg(facts)));
          if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
          memo.set(key, body);
          return png(body, facts ? BUILT : DEFAULT);
        } catch {
          // The renderer itself failed: the site's static card.
          return new Response(null, { status: 302, headers: { Location: "/og.jpg", "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
