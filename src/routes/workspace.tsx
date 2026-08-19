import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/workspace/shell";

export type WorkspaceSearch = {
  q?: string;
};

export const Route = createFileRoute("/workspace")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): WorkspaceSearch =>
    typeof s.q === "string" && s.q.trim().length ? { q: s.q } : {},
  component: WorkspacePage,
});

function WorkspacePage() {
  const { q } = Route.useSearch();
  return <WorkspaceApp initialPrompt={q} />;
}
