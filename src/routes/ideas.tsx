import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/site/chrome";
import { IdeasPageView } from "@/components/ideas/IdeasPageView";
import { IDEAS_CHANGED, listLearnedIdeas, type LearnedIdea } from "@/lib/yard/ideaLibrary";
import type { IdeasFeed } from "@/lib/ideas/feed";

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
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s.q === "string" && s.q.trim() ? { q: s.q.slice(0, 80) } : {},
  component: IdeasPage,
});

function IdeasPage() {
  const navigate = useNavigate();
  const incoming = Route.useSearch().q ?? "";
  const [learned, setLearned] = useState<LearnedIdea[]>([]);
  // The HTML is the curated fallback (same for every visitor); the live feed swaps in once the CDN-cached /api/ideas answers.
  const [feed, setFeed] = useState<IdeasFeed | undefined>(undefined);
  useEffect(() => {
    let on = true;
    fetch("/api/ideas").then((r) => (r.ok ? (r.json() as Promise<IdeasFeed>) : null)).then((f) => { if (on && f?.live && f.sections?.length) setFeed(f); }).catch(() => {});
    return () => { on = false; };
  }, []);
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
  function go(text: string) {
    const next = text.trim();
    if (next) void navigate({ to: "/workspace", search: { q: next } });
  }
  return (
    <SiteChrome active="ideas">
      <IdeasPageView incoming={incoming} learned={learned} onBuild={go} feed={feed} />
    </SiteChrome>
  );
}
