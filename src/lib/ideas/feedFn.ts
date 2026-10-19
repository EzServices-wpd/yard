import { createServerFn } from "@tanstack/react-start";
import type { IdeasFeed } from "./feed";

/**
 * The Ideas feed for SSR (CLS 0): the route loader renders the live feed into the HTML, so no section appears after
 * load. Same feed as /api/ideas; the page HTML is CDN-cached like the API. Any store failure → the curated fallback.
 */
export const loadIdeasFeed = createServerFn({ method: "GET" }).handler(async (): Promise<IdeasFeed> => {
  const [{ ideaStore }, { EMPTY_SNAPSHOT }, { curatedFeed }, { liveFeed }, RECIPES] = await Promise.all([
    import("@/lib/yard/ideaLog.server"), import("@/lib/yard/ideaLog"), import("./feed"), import("./liveFeed"), import("./recipes.json"),
  ]);
  let snap = EMPTY_SNAPSHOT;
  try { snap = await ideaStore().served(); } catch { /* fallback */ }
  return liveFeed(snap, curatedFeed((RECIPES as { default: Parameters<typeof curatedFeed>[0] }).default));
});
