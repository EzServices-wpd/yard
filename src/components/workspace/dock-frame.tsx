"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const KEY = "yard-dock";
type Pos = { x: number; y: number; collapsed: boolean };
const read = (): Pos => {
  try { return { x: 0, y: 0, collapsed: false, ...JSON.parse(sessionStorage.getItem(KEY) ?? "{}") }; } catch { return { x: 0, y: 0, collapsed: false }; }
};

/**
 * The editing dock over the model: collapses to a small tab; on desktop drag it by its handle (kept on screen);
 * on a phone it is a bottom sheet you swipe down to tuck away. Position and collapsed state last the session.
 * Collapsed content stays mounted (hidden) so the build's data attributes stay readable.
 */
export function DockFrame({ className, children }: { className: string; children: ReactNode }) {
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, collapsed: false });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; desk: boolean } | null>(null);
  useEffect(() => setPos(read()), []);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* private mode */ } }, [pos]);
  const desk = () => window.matchMedia("(min-width: 768px)").matches;
  // Keep the whole dock inside the window: shift the offset back by however far the box pokes out.
  const clamp = (x: number, y: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { x, y };
    const dx = x - pos.x, dy = y - pos.y;
    const l = r.left + dx, t = r.top + dy;
    return { x: x - Math.min(0, l) - Math.max(0, l + r.width - window.innerWidth), y: y - Math.min(0, t) - Math.max(0, t + r.height - window.innerHeight) };
  };
  const down = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, desk: desk() };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.desk) setPos((p) => ({ ...p, ...clamp(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy) }));
    else if (box.current) box.current.style.transform = `translateY(${Math.max(0, e.clientY - d.sy)}px)`;
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.desk) return;
    if (box.current) box.current.style.transform = "";
    if (e.clientY - d.sy > 60) setPos((p) => ({ ...p, collapsed: true }));
  };
  const style = pos.collapsed ? undefined : { translate: `${pos.x}px ${pos.y}px` };
  return (
    <>
      {pos.collapsed && (
        <button type="button" data-yard-dock-tab="1" onClick={() => setPos((p) => ({ ...p, collapsed: false }))} className="pointer-events-auto rounded-full border border-border/80 bg-surface/90 px-4 py-1.5 text-xs text-fg shadow-lg backdrop-blur-md">
          Edit ▴
        </button>
      )}
      <div ref={box} data-bench-overlay="dock" data-yard-dock={pos.collapsed ? "collapsed" : "open"} style={style} className={`${className} ${pos.collapsed ? "hidden" : ""} max-md:!translate-x-0 max-md:!translate-y-0`}>
        <div className="flex items-center border-b border-border/60">
          <div
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Drag to move the panel"
            className="flex h-5 flex-1 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <button type="button" aria-label="Collapse the panel" onClick={() => setPos((p) => ({ ...p, collapsed: true }))} className="grid size-11 place-items-center text-xs text-muted hover:text-fg">▾</button>
        </div>
        {children}
      </div>
    </>
  );
}
