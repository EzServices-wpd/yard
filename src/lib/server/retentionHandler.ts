import { Budget, FREE_TIER, IdeaStore, restPipe } from "@/lib/yard/ideaLog.server";
import { ShopStore } from "@/lib/feedback/store.server";

/**
 * Retention sweep (vercel.json crons: two daily jobs, 08:17 and 20:17 UTC, each once a day: free on the current plan).
 * Reached only with `Authorization: Bearer $CRON_SECRET` (secretRoutes.ts). Drops ideas rows whose last-seen is past
 * RETAIN_DAYS from all their keys together (IdeaStore.sweep) and trims feedback notes past RETAIN_DAYS
 * (ShopStore.sweep). Deletion may use the 50K between BUDGET and the free tier, so a month whose writes hit BUDGET
 * still sweeps. Counts only in the reply. Any other method is left to the app (a not-found like any other).
 */
export async function retentionHandler(request: Request): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const pipe = restPipe();
  const ideas = await new IdeaStore(pipe, new Budget(FREE_TIER)).sweep();
  await new ShopStore(pipe, new Budget(FREE_TIER)).sweep();
  return Response.json({ ideas }, { headers: { "Cache-Control": "no-store" } });
}
