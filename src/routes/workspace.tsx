import { pickTestFlags, type TestFlags } from "@/lib/ideas/testFlags";
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/workspace/shell";
import { canonical, workbenchCard, workbenchHead, workbenchPath, workbenchRobots, workbenchToken } from "@/lib/canonical";
import { engineTitleFn } from "@/lib/og/titleFn";

export type WorkspaceSearch = {
  q?: string;
  y?: string;
} & TestFlags;

export const Route = createFileRoute("/workspace")({
  // Row 578: data-only, so the loader runs on the server for the title; the bench itself still renders only in the browser.
  ssr: "data-only",
  validateSearch: (s: Record<string, unknown>): WorkspaceSearch => {
    const out: WorkspaceSearch = {};
    if (typeof s.q === "string" && s.q.trim()) out.q = s.q;
    if (typeof s.y === "string" && s.y.trim()) out.y = s.y;
    // Test flags (offline/local/test=1) stay on the URL: run-prompt reads offline/local to skip AI calls.
    return { ...out, ...pickTestFlags(s) };
  },
  loaderDeps: ({ search: { q, y } }) => ({ q, y }),
  // The title is the engine's header for the build, worked out on the server (link previews, the first tab title).
  // In the browser the bench names the tab itself once it has built (shell.tsx), so no request here.
  loader: async ({ deps }) => {
    const token = workbenchToken(deps);
    return { title: typeof window === "undefined" && token ? await engineTitleFn({ data: token }) : null };
  },
  head: ({ match, loaderData }) => {
    const { q, y } = (match.search ?? {}) as WorkspaceSearch;
    const { title, desc } = workbenchHead(loaderData?.title ?? null);
    // Its own URL, not "/": a shared build unfurls as itself (the ?y= share link exactly, or the ?q= build).
    const own = canonical(workbenchPath({ q, y }));
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { name: "twitter:title", content: title }, { name: "twitter:description", content: desc }, ...own.meta, ...workbenchCard({ q, y }), ...workbenchRobots({ q, y })], links: own.links };
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const { q, y } = Route.useSearch();
  return <WorkspaceApp initialPrompt={q} shareToken={y} />;
}
