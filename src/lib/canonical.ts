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
 */
// ponytail: meta only; an X-Robots-Tag header would also cover non-HTML fetches, not needed while /workspace is HTML.
export function workbenchRobots({ q, y }: { q?: string; y?: string }): { name: string; content: string }[] {
  return y || q?.trim() ? [{ name: "robots", content: "noindex,follow" }] : [];
}
