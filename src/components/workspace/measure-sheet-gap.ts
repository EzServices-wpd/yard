import { createElement, useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { _roots } from "@react-three/fiber";

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

type Events = { getState: () => { setEvents: (e: { enabled: boolean }) => void } };
/**
 * The bench's three.js event store for a canvas (react-three-fiber keeps one per canvas). `_roots` is an underscore
 * export, not r3f's public API: an r3f upgrade could rename it or change what it holds, and then this finds no store,
 * the hold below quietly does nothing, and a closing tap on the open phone sheet places or selects parts again (the
 * #208 block). The pin test in scripts/measure-sheet-dismiss.test.ts ("pin: r3f's _roots ...") runs r3f's own
 * createRoot and goes red if that happens; check it on every @react-three/fiber bump.
 */
const benchEvents = (canvas: Element | null) => (canvas ? (_roots.get(canvas as HTMLCanvasElement)?.store as unknown as Events | undefined) : undefined);
function releaseBench(held: { current: Events | null }) {
  held.current?.getState().setEvents({ enabled: true });
  held.current = null;
}

/**
 * The open phone sheet's dismissals (Critic 2 #206 follow-up). The old clear backdrop over the bench ate every
 * press, so dragging the model closed the sheet instead of turning it. Now presses reach the canvas so a drag
 * orbits, but the bench's own pointer actions (select a part, place a piece in Free mode, drag a piece) fire on
 * pointer-down, before a tap can be told from a drag. So while the sheet is open on a phone, a press on the
 * canvas first switches the bench's three.js events off (the orbit controls listen on their own and still turn the
 * model), and they come back when the sheet closes. A tap (6 px or less) then closes the sheet; a drag only orbits.
 * Neither adds a part (Free mode) or selects one (Look mode) only because those events are off while the sheet is
 * open: the bench's handlers would still fire on pointer-down otherwise. Before #208 the clear backdrop got the
 * same result by eating the press. On desktop nothing here touches the bench: its events stay on and its clicks are
 * its own. Escape (phone only) closes the sheet and puts focus back on the control that opened it. Returns the
 * bench host's capture handlers.
 */
export function useMeasureSheetDismiss(open: boolean, close: () => void) {
  const opener = useRef<HTMLElement | null>(null);
  const down = useRef<Pt | null>(null);
  const held = useRef<Events | null>(null);
  const release = () => releaseBench(held);
  // Layout effect: runs before the panel's own passive effects can move focus into the sheet.
  useLayoutEffect(() => {
    if (!open) return;
    const a = document.activeElement as HTMLElement | null;
    opener.current = a && a !== document.body && typeof a.focus === "function" ? a : null;
    return () => releaseBench(held);
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
      const canvas = (e.target as Element).closest?.("canvas") ?? null;
      down.current = open ? { x: e.clientX, y: e.clientY } : null;
      if (!open || !phone() || !canvas) return release();
      // Capture phase: this runs before the bench's own pointer-down handler on the canvas wrapper.
      const ev = benchEvents(canvas);
      if (ev && ev !== held.current) release();
      ev?.getState().setEvents({ enabled: false });
      held.current = ev ?? null;
    },
    onClickCapture: (e: MouseEvent) => {
      if (!open || !phone() || !(e.target as Element).closest?.("canvas")) return;
      // The bench's click is never its own while the sheet is open (a drag's click would read as a miss and clear
      // the selection). Selecting and placing are held off at pointer-down above, not here.
      e.stopPropagation();
      if (isSheetTap(down.current, { x: e.clientX, y: e.clientY })) close();
    },
  };
}

/** The bench host (the fit's overlays live in it); while the phone sheet is open it carries the dismiss handlers. */
export function BenchHost({ sheetOpen, onClose, children }: { sheetOpen: boolean; onClose: () => void; children: ReactNode }) {
  const handlers = useMeasureSheetDismiss(sheetOpen, onClose);
  return createElement("div", { className: "relative min-w-0 flex-1", "data-bench-host": true, ...handlers }, children);
}

/**
 * The phone backdrop behind an open panel (tap to close). Over the half-height Measure sheet it is clear and takes
 * no presses, so the model above the sheet can be turned; the bench host's handlers close on a tap instead.
 */
export function PanelBackdrop({ sheet, onClose }: { sheet: boolean; onClose: () => void }) {
  return createElement("button", {
    type: "button",
    "aria-label": "Close panel",
    onClick: onClose,
    className: `absolute z-10 md:hidden ${sheet ? "pointer-events-none inset-x-0 top-0 h-[50vh] bg-transparent" : "inset-0 bg-bg/50"}`,
  });
}
