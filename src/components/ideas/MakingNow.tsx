import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { safePrompt, type SnapshotRow } from "@/lib/yard/ideaLog";
import { loadSnapshot } from "@/lib/yard/ideaLogClient";
import { useOffscreen } from "@/hooks/use-offscreen";

/**
 * "People are making right now" (R10–R12). Loads the CDN snapshot at idle, no engine import.
 * Fixed-height slot from SSR (CLS 0). CSS-only scroll (transform), paused on hover/focus/off-screen;
 * prefers-reduced-motion shows a static list. Every prompt is re-sanitised before it is shown.
 */
export function MakingNow() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [ref, off] = useOffscreen<HTMLDivElement>();
  useEffect(() => {
    let live = true;
    const go = () => void loadSnapshot().then((s) => live && setRows(s.recent.filter((r) => safePrompt(r.prompt) === r.prompt).slice(0, 12)));
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 6000 }) : setTimeout(go, 3000);
    return () => {
      live = false;
      if ("cancelIdleCallback" in window && typeof id === "number") window.cancelIdleCallback(id);
    };
  }, []);
  return (
    <div ref={ref} data-offscreen={off || undefined} className="yard-making-now mx-auto mt-8 h-9 max-w-3xl overflow-hidden text-sm text-ink-muted" data-yard-making-now aria-live="off">
      {rows.length ? (
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="shrink-0 font-medium text-ink">People are making right now:</span>
          <div className="yard-making-track relative min-w-0 flex-1 overflow-hidden">
            <ul className="yard-making-list inline-flex gap-4">
              {[...rows, ...rows].map((r, i) => (
                <li key={`${r.key}-${i}`} aria-hidden={i >= rows.length || undefined}>
                  <Link to="/workspace" search={{ q: r.prompt }} tabIndex={i >= rows.length ? -1 : undefined} className="hover:text-ink hover:underline">
                    {r.prompt}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
