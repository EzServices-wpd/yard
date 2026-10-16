import { useSyncExternalStore } from "react";

/**
 * The cut row / sheet piece in focus, as 3D part ids (SWE's `partIds`, the same ids as planOverviewSvg's
 * data-part). Shared across the Canvas boundary so the model outlines the parts the cut list points at.
 */
let ids: ReadonlySet<string> = new Set();
const subs = new Set<() => void>();
export function setCutFocus(next: Iterable<string> | null) {
  ids = new Set(next ?? []);
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const useCutFocus = () => useSyncExternalStore(subscribe, () => ids, () => ids);

/** A cut row or sheet piece, reduced to what linking needs. */
export type Linkable = { label?: string | null; partIds?: string[] };
export const overlaps = (a: Linkable, focus: ReadonlySet<string>, letter: string | null) =>
  a.partIds?.length && focus.size ? a.partIds.some((id) => focus.has(id)) : !!letter && a.label === letter;
