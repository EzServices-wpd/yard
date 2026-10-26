import { pickTestFlags, type TestFlags } from "@/lib/ideas/testFlags";
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/workspace/shell";
import { canonical, workbenchCard, workbenchPath, workbenchRobots } from "@/lib/canonical";
/** The share token's prompt only (base64url JSON, same as shareBuild.encodeShare). Inline so the route tree never loads the engine. */
function sharedPrompt(token: string): string | undefined {
  try {
    const bin = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as { prompt?: unknown };
    return typeof p.prompt === "string" ? p.prompt : undefined;
  } catch { return undefined; }
}

/** "Bunk bed 82×44 · Yard" from a shared prompt: the words before the sizes, then width × height. */
export function buildTitle(prompt: string): string {
  const noun = prompt.replace(/^house:\s*/i, "").split(/[,\d]/)[0].trim().replace(/\s+(with|in|from)$/i, "");
  const n = (re: RegExp) => prompt.match(re)?.[1];
  const by = prompt.match(/(\d+(?:\.\d+)?)\s*(?:"|in|inches)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/i);
  const w = by?.[1] ?? n(/(\d+(?:\.\d+)?)\s*(?:"|in|inches)?\s*(?:wide|long)/i);
  const h = by?.[2] ?? n(/(\d+(?:\.\d+)?)\s*(?:"|in|inches)?\s*(?:tall|high)/i);
  const name = noun ? noun[0].toUpperCase() + noun.slice(1) : "Build";
  return `${name}${w && h ? ` ${w}×${h}` : w ? ` ${w}` : ""} · Yard`;
}

export type WorkspaceSearch = {
  q?: string;
  y?: string;
} & TestFlags;

export const Route = createFileRoute("/workspace")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): WorkspaceSearch => {
    const out: WorkspaceSearch = {};
    if (typeof s.q === "string" && s.q.trim()) out.q = s.q;
    if (typeof s.y === "string" && s.y.trim()) out.y = s.y;
    // Test flags (offline/local/test=1) stay on the URL: run-prompt reads offline/local to skip AI calls.
    return { ...out, ...pickTestFlags(s) };
  },
  head: ({ match }) => {
    const { q, y } = (match.search ?? {}) as WorkspaceSearch;
    const prompt = (y ? sharedPrompt(y) : q) ?? "";
    const title = prompt ? buildTitle(prompt) : "Workspace · Yard";
    const desc = prompt ? `${title.replace(/ · Yard$/, "")}: the 3D model, cut list, Buy list and step-by-step plan on Yard.` : "Type a build and get a 3D model, cut list, Buy list and plan.";
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
