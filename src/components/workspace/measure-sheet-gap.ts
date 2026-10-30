/**
 * Phone Measure sheet (Critic 2 backlog): the half-height sheet sits over the bottom of the bench, outside the
 * bench host, so the fit never saw it and the model sat half behind it. While the sheet is open on a phone this
 * puts a clear, inert card of the sheet's height inside the bench host: the fit avoids it like any other card, so
 * the whole model sits in the free bench above the sheet. Desktop (md and up) has no card (the panel is beside
 * the bench there), and with the sheet closed nothing renders and the fit key is release's.
 */
let open = false;
const subs = new Set<() => void>();
export const sheetGapOpen = () => open;
export function subscribeSheetGap(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
export function setSheetGap(next: boolean) {
  if (open === next) return;
  open = next;
  subs.forEach((f) => f());
}

/** The phone query the sheet uses (shell.tsx: the Measure aside is a bottom sheet below md). */
export const SHEET_GAP_QUERY = "(max-width: 767.98px)";
