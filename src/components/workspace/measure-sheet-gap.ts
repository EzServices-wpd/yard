import { useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from "react";

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

/** How far a press may move and still count as a tap on the bench (px). Further is a drag: it orbits, not closes. */
export const SHEET_TAP_PX = 6;
type Pt = { x: number; y: number };
export const isSheetTap = (down: Pt | null, up: Pt) => down != null && Math.hypot(up.x - down.x, up.y - down.y) <= SHEET_TAP_PX;
const phone = () => typeof window !== "undefined" && window.matchMedia(SHEET_GAP_QUERY).matches;

/**
 * The open phone sheet's dismissals (Critic 2 #206 follow-up). The old clear backdrop over the bench ate every
 * press, so dragging the model closed the sheet instead of turning it. Now presses reach the canvas: a drag
 * orbits, and only a tap on the canvas closes the sheet (and stops there, so the tap selects nothing, as before).
 * Escape closes it and puts focus back on the control that opened it. Returns the bench host's capture handlers.
 */
export function useMeasureSheetDismiss(open: boolean, close: () => void) {
  const opener = useRef<HTMLElement | null>(null);
  const down = useRef<Pt | null>(null);
  // Layout effect: runs before the panel's own passive effects can move focus into the sheet.
  useLayoutEffect(() => {
    if (!open) return;
    const a = document.activeElement as HTMLElement | null;
    opener.current = a && a !== document.body && typeof a.focus === "function" ? a : null;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !phone()) return;
      e.preventDefault();
      const back = opener.current;
      close();
      if (back?.isConnected) back.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);
  return {
    onPointerDownCapture: (e: PointerEvent) => {
      down.current = open ? { x: e.clientX, y: e.clientY } : null;
    },
    onClickCapture: (e: MouseEvent) => {
      if (!open || !phone() || !(e.target as Element).closest?.("canvas")) return;
      if (!isSheetTap(down.current, { x: e.clientX, y: e.clientY })) return;
      e.stopPropagation();
      close();
    },
  };
}
