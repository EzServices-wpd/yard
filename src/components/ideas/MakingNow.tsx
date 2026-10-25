import { Link } from "@tanstack/react-router";
import { currentTestFlags } from "@/lib/ideas/testFlags";
import { useEffect, useState } from "react";
import type { IdeasFeed } from "@/lib/ideas/feed";
import { makingNow, type MakingNowItem } from "@/lib/ideas/liveFeed";
import { useOffscreen } from "@/hooks/use-offscreen";

/**
 * "People are making right now" (R10–R12). Loads the Ideas feed (/api/ideas, CDN-cached) at idle, no engine import.
 * Each row is a build's engine title and size, never the words a visitor typed (privacy page; makingNow in liveFeed).
 * Fixed-height slot from SSR (CLS 0): 44px on a phone so every link is a 44px target (row 57), 36px from sm.
 * CSS-only scroll (transform), paused on hover/focus/off-screen; prefers-reduced-motion shows a static list.
 */
export function MakingNow() {
  const [rows, setRows] = useState<MakingNowItem[]>([]);
  const [ref, off] = useOffscreen<HTMLDivElement>();
  useEffect(() => {
    let live = true;
    const go = () =>
      void fetch("/api/ideas")
        .then((r) => (r.ok ? (r.json() as Promise<IdeasFeed>) : null))
        .then((f) => live && f && setRows(makingNow(f)))
        .catch(() => {});
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 6000 }) : setTimeout(go, 3000);
    return () => {
      live = false;
      if ("cancelIdleCallback" in window && typeof id === "number") window.cancelIdleCallback(id);
    };
  }, []);
  return (
    <div ref={ref} data-offscreen={off || undefined} className="yard-making-now mx-auto mt-8 h-11 max-w-3xl overflow-hidden sm:h-9 text-sm text-ink-muted" data-yard-making-now aria-live="off">
      {rows.length ? (
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="shrink-0 font-medium text-ink">People are making right now:</span>
          <div className="yard-making-track relative min-w-0 flex-1 overflow-hidden">
            <ul className="yard-making-list inline-flex gap-4">
              {[...rows, ...rows].map((r, i) => (
                <li key={`${r.slug}-${i}`} aria-hidden={i >= rows.length || undefined}>
                  <Link to="/workspace" search={{ q: r.q, ...currentTestFlags() }} tabIndex={i >= rows.length ? -1 : undefined} className="inline-flex min-h-11 items-center hover:text-ink hover:underline sm:min-h-0">
                    {r.title}
                    {r.size ? (
                      <>
                        ,&nbsp;<span className="yard-measure" aria-hidden>{r.size}</span>
                        <span className="sr-only">{r.sizeAria}</span>
                      </>
                    ) : null}
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
