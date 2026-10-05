import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/workspace/shell";

export type WorkspaceSearch = {
  q?: string;
  y?: string;
};

export const Route = createFileRoute("/workspace")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): WorkspaceSearch => {
    const out: WorkspaceSearch = {};
    if (typeof s.q === "string" && s.q.trim()) out.q = s.q;
    if (typeof s.y === "string" && s.y.trim()) out.y = s.y;
    return out;
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const { q, y } = Route.useSearch();
  return <WorkspaceApp initialPrompt={q} shareToken={y} />;
}
