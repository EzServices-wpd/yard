"use client";

import { ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { usd } from "@/lib/utils";
import { buyListCart } from "@/lib/yard/amazonCart";
import { tagNote } from "@/lib/yard/listings";
import { outboundHref, outboundIsAffiliate, OUTBOUND_REL, OUTBOUND_TARGET } from "@/lib/yard/outbound";
import type { BuildPlan } from "@/lib/yard/types";

/**
 * The Buy list — the only place store and affiliate links render on the site
 * (scripts/yard-affiliate-guards.ts fails the build check if they show up anywhere else).
 */
export function BuyList({ plan }: { plan: BuildPlan }) {
  const cart = useMemo(() => buyListCart(plan.bom), [plan.bom]);
  const inCart = new Map(cart.lines.map((l) => [l.rowIndex, l]));
  const local = cart.perRow.filter((r) => r.local);
  const other = cart.perRow.filter((r) => !r.local);
  const disclosure = tagNote();
  const itemCount = cart.lines.length;

  if (!plan.bom.length) return null;

  return (
    <section data-yard-buy-list="1">
      <h3 className="font-display text-lg text-fg">Buy</h3>
      <p className="mt-1 text-xs text-muted">
        {plan.partsKind === "whole"
          ? `${plan.totals.pieces} full pieces · glue · do not cut`
          : `${plan.totals.pieces} pieces`}{" "}
        · {usd(plan.totals.estCostUsd)} estimated · cheapest first for the amount you need, any store, same size only
      </p>
      <p className="mt-1 text-[11px] text-faint">
        Estimates, not a quote. Best is the cheapest checked listing; rows with search links only show an estimate.
      </p>

      {cart.href && (
        <div
          className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
          data-yard-buy-cart-box="1"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Get it all in one cart</p>
            <p className="mt-0.5 text-xs text-muted">
              {itemCount} {itemCount === 1 ? "item" : "items"} go to Amazon with the quantities already set.
            </p>
          </div>
          <a
            href={cart.href}
            target={OUTBOUND_TARGET}
            rel={OUTBOUND_REL}
            className="mt-3 flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/30 sm:mt-0 sm:w-auto"
            data-yard-buy-cart="1"
            data-yard-shop="amazon"
            data-yard-affiliate={cart.tagged ? "1" : "0"}
            aria-label={`Buy this list: add ${itemCount} ${itemCount === 1 ? "item" : "items"} to an Amazon cart`}
          >
            <ShoppingCart className="size-4" aria-hidden />
            Buy this list
          </a>
        </div>
      )}
      {(local.length > 0 || other.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-muted" data-yard-buy-per-row="1">
          {local.length > 0 && (
            <p data-yard-buy-local="1">
              <span className="text-fg">Lumber and sheets: pick up at your local store.</span> Their rows below link to
              Home Depot and Lowe&rsquo;s.
            </p>
          )}
          {other.length > 0 && (
            <p>
              {cart.href ? "Also grab from their own rows: " : "Shop each row from its links: "}
              {other.map((r) => r.name).join(", ")}.
            </p>
          )}
        </div>
      )}
      {disclosure && (
        <p className="mt-2 text-[11px] text-faint" data-yard-affiliate-disclosure="1">
          {disclosure}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {plan.bom.map((b, i) => {
          const c = inCart.get(i);
          return (
            <li key={i} className="border-b border-rule/60 pb-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-fg">
                    {b.quantity} {b.unit} · {b.name}
                  </p>
                  {b.notes && <p className="text-xs text-muted">{b.notes}</p>}
                  {c && (
                    <p
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-fg"
                      data-yard-in-cart={c.asin}
                    >
                      <ShoppingCart className="size-3" aria-hidden />
                      In the cart · {c.quantity} × {c.title}
                    </p>
                  )}
                </div>
                {b.estimatedCost != null && <p className="shrink-0 font-mono text-xs text-muted">{usd(b.estimatedCost)}</p>}
              </div>
              {b.offers && b.offers.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {b.offers.map((o) => (
                    <li key={o.href} className="flex items-baseline justify-between gap-2">
                      <a
                        href={outboundHref(o.href)}
                        target={OUTBOUND_TARGET}
                        rel={OUTBOUND_REL}
                        className={`min-w-0 text-xs underline-offset-2 hover:underline ${o.best ? "text-fg" : "text-muted hover:text-fg"}`}
                        data-yard-shop={o.retailer}
                        data-yard-affiliate={outboundIsAffiliate(o.href) ? "1" : "0"}
                        data-yard-best={o.best ? "1" : "0"}
                      >
                        {o.best ? "Best · " : ""}
                        {o.label} · {o.title}
                      </a>
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {o.quote === "search" ? "Search" : `${o.packsNeeded} × ${usd(o.packPrice)} · ${usd(o.unitPrice)}/ea`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
