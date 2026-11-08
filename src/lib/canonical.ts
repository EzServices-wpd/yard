/**
 * One canonical per page (Growth's Ideas review): each route's head sets its own `<link rel="canonical">` and the
 * same absolute URL as og:url. The root route sets neither, so no page inherits "/" as a second canonical.
 */
const host = (import.meta.env?.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";
export const SITE = `https://${host}`;

export function canonical(path: string) {
  const url = `${SITE}${path}`;
  return { meta: [{ property: "og:url", content: url }], links: [{ rel: "canonical", href: url }] };
}

/** The workbench's own path: a shared build (?y=) is exactly its share link (shareBuild.shareUrl); a typed build is ?q=. Test flags never. */
export function workbenchPath({ q, y }: { q?: string; y?: string }): string {
  if (y) return `/workspace?${new URLSearchParams({ y })}`;
  if (q?.trim()) return `/workspace?${new URLSearchParams({ q: q.trim() })}`;
  return "/workspace";
}

/**
 * A typed build (?q=) is the visitor's own words, and a ?y= share link carries the sharer's prompt: neither is indexed
 * (Chief, 10-25; the sharer never agreed to indexing). Links still followed; the ?y= self canonical is unchanged.
 * Whitespace-only ?q= or ?y= is no build (the route drops it), so no robots meta.
 */
// ponytail: meta only; an X-Robots-Tag header would also cover non-HTML fetches, not needed while /workspace is HTML.
export function workbenchRobots({ q, y }: { q?: string; y?: string }): { name: string; content: string }[] {
  return y?.trim() || q?.trim() ? [{ name: "robots", content: "noindex,follow" }] : [];
}

/** The ?q= build as a share token (shareBuild.encodeShare's base64url JSON), inline so the route tree never loads the engine. */
const qToken = (q: string) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ prompt: q, measure: {} })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

/** The build a /workspace URL opens, as one share token (the ?y= link, or the ?q= words as one); "" for no build. */
export const workbenchToken = ({ q, y }: { q?: string; y?: string }) => y?.trim() || (q?.trim() ? qToken(q.trim()) : "");

/**
 * Row 578: the workbench's title is the engine's header for the build (name and size, what the bench shows), never
 * the typed words; no engine title (not built, not learned, measured, AI-shaped, too slow) is the plain workbench title.
 */
export function workbenchHead(engine: { name: string; size: string } | null): { title: string; desc: string } {
  if (!engine) return { title: "Workspace · Yard", desc: "Type a build and get a 3D model, cut list, Buy list and plan." };
  const named = `${engine.name} · ${engine.size}`;
  return { title: `${named} · Yard`, desc: `${named}: the 3D model, cut list, Buy list and step-by-step plan on Yard.` };
}

/** A build's own link preview: /api/og draws that build (its drawing, name, size, parts, price); no build keeps the site card. */
export function workbenchCard({ q, y }: { q?: string; y?: string }): { name?: string; property?: string; content: string }[] {
  const token = workbenchToken({ q, y });
  if (!token) return [];
  const url = `${SITE}/api/og?${new URLSearchParams({ y: token })}`;
  return [{ property: "og:image", content: url }, { property: "og:image:alt", content: "The build's drawing with its size, part count and estimated price on Yard" }, { name: "twitter:image", content: url }];
}
