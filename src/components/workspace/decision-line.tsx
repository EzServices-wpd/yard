"use client";

import { useEffect, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { usd } from "@/lib/utils";
import { refineTick } from "./refine-note";

// Module-level, not a ref: the card remounts while a Refine rebuilds, and the old price must survive that.
let seen: { price: number; tick: number } | null = null;

/** "1/2-day" → "½ day": the plan's own effort band, read aloud. */
export function effortWords(e: string): string {
  return e === "1/2-day" ? "½ day" : e === "weekend" ? "a weekend" : e.replace(/-/g, " ");
}

/**
 * Item 4: "10 parts · ~$183.70 · ½ day", read straight from the plan (same total the plan calls
 * "all-in", same piece count), beside the action. After a Refine a "+$14" pill shows the change for
 * 2.4 s, then settles. Plain text: no links, ever (store links live on the Buy list only).
 */
export function DecisionLine({ className = "" }: { className?: string }) {
  const plan = useYard((s) => s.plan);
  const price = plan?.totals.estCostUsd ?? 0;
  const [delta, setDelta] = useState<{ d: number; key: number } | null>(null);
  useEffect(() => {
    if (!plan) return;
    const t = refineTick();
    const was = seen;
    seen = { price, tick: t };
    if (!was || t === was.tick) return;
    const d = Math.round(price - was.price);
    if (!d) return;
    setDelta({ d, key: t });
    const id = window.setTimeout(() => setDelta(null), 2400);
    return () => window.clearTimeout(id);
  }, [plan, price]);
  if (!plan) return null;
  const n = plan.totals.pieces;
  return (
    <p data-yard-decision-line="1" className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] tabular-nums text-fg sm:text-[15px] ${className}`}>
      <span>
        {n} {n === 1 ? "part" : "parts"} · <span data-yard-decision-price>{usd(price)}</span>{plan.effort ? ` · ${effortWords(plan.effort)}` : ""}
      </span>
      {delta && (
        <span key={delta.key} data-yard-decision-delta={delta.d} className="yard-delta rounded-full bg-elevated px-1.5 text-[12px] text-fg">
          {delta.d > 0 ? "+" : "−"}${Math.abs(delta.d)}
        </span>
      )}
    </p>
  );
}
