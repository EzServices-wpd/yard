import { useSyncExternalStore } from "react";
import { useYard } from "@/lib/yard/store";

/**
 * Shop drawing (madera comparison, feature 2): the bench draws outlines only and the browser's own print gives a
 * black-on-white vector drawing. A module store like cut-focus.ts (not store.ts); a stock switch keeps it, a new
 * prompt clears it (shell.tsx). Panel builds only: stick builds' instanced members carry no edges yet.
 */
let on = false;
const subs = new Set<() => void>();
export function setShopDrawing(next: boolean) {
  if (next === on) return;
  on = next;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const useShopDrawing = () => useSyncExternalStore(subscribe, () => on, () => false);

/** A sheet-goods build (panels, no stick members): the only builds the mode draws. */
export const shopDrawable = (p: { panels: unknown[]; instances: unknown[] }) => p.panels.length > 0 && p.instances.length === 0;

/** On, and the bench holds a build the mode can draw. */
export function useShopDrawingOn() {
  const want = useShopDrawing();
  const drawable = useYard((s) => shopDrawable(s.project));
  return want && drawable;
}
