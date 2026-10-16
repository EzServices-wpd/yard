import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/site/chrome";
import { morphTo } from "@/lib/ideas/morph";
import { currentTestFlags, pickTestFlags, type TestFlags } from "@/lib/ideas/testFlags";
import { IdeasPageView } from "@/components/ideas/IdeasPageView";
import { IDEAS_CHANGED, listLearnedIdeas, type LearnedIdea } from "@/lib/yard/ideaLibrary";
import { loadIdeasFeed } from "@/lib/ideas/feedFn";

export const Route = createFileRoute("/ideas")({
  // Same HTML for every visitor: the CDN serves it for an hour and refreshes in the background.
  headers: () => ({ "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" }),
  head: () => ({
    meta: [
      { title: "Ideas · Yard" },
      { name: "description", content: "Build ideas for Yard: shelves, benches, toys and weekend projects, each with a model, cut list and Buy list." },
      { property: "og:title", content: "Ideas · Yard" },
      { property: "og:description", content: "Build ideas for Yard: shelves, benches, toys and weekend projects, each with a model, cut list and Buy list." },
      { property: "og:url", content: "https://yard.wiki/ideas" },
    ],
    links: [{ rel: "canonical", href: "https://yard.wiki/ideas" }],
  }),
  // Test flags (offline/local/test=1) survive here so every build link from Ideas can carry them on.
  validateSearch: (s: Record<string, unknown>): { q?: string } & TestFlags => ({
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.slice(0, 80) } : {}),
    ...pickTestFlags(s),
  }),
  // The live feed is in the SSR HTML (CLS 0): nothing swaps in after load.
  loader: async () => ({ feed: await loadIdeasFeed().catch(() => undefined) }),
  component: IdeasPage,
});

function IdeasPage() {
  const navigate = useNavigate();
  const incoming = Route.useSearch().q ?? "";
  const [learned, setLearned] = useState<LearnedIdea[]>([]);
  // Rendered on the server (live feed, or the curated fallback with live=false); same HTML for every visitor.
  const loaded = Route.useLoaderData().feed;
  const feed = loaded && loaded.sections?.length ? loaded : undefined;
  useEffect(() => {
    const load = () => setLearned(listLearnedIdeas());
    load();
    window.addEventListener("storage", load);
    window.addEventListener(IDEAS_CHANGED, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(IDEAS_CHANGED, load);
    };
  }, []);
  const router = useRouter();
  /** Tap: the card's drawing morphs into the stage (plain navigation under reduced motion or with no card). */
  function go(text: string, from?: HTMLElement | null) {
    const next = text.trim();
    if (next) void morphTo(from, () => navigate({ to: "/workspace", search: { q: next, ...currentTestFlags() } }));
  }
  /** Hover, focus or touchstart: fetch the workspace route's code before the tap. */
  function prefetch(text: string) {
    void router.preloadRoute({ to: "/workspace", search: { q: text.trim(), ...currentTestFlags() } }).catch(() => {});
  }
  return (
    <SiteChrome active="ideas">
      <IdeasPageView incoming={incoming} learned={learned} onBuild={go} onIntent={prefetch} feed={feed} />
    </SiteChrome>
  );
}
