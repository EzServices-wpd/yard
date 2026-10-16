"use client";

import { ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { usd } from "@/lib/utils";
import { buyListCart, isLocalStockRow } from "@/lib/yard/amazonCart";
import { tagNote } from "@/lib/yard/listings";
import { affiliateConfig, outboundHref, outboundIsAffiliate, OUTBOUND_REL, OUTBOUND_TARGET, storeOf, wrapTemplate } from "@/lib/yard/outbound";
import type { BomLine, BuildPlan } from "@/lib/yard/types";

// ── "Also at" store links: part of the Buy list (they render only on its rows) ──
/**
 * "Also at" store links under Buy list rows (Growth store-links brief). Buy list only: never the
 * stock picker, PDF, print view or plan pages. Each store shows only when its own affiliate
 * template (a https deep-link with {url}) is set; with none set nothing renders.
 * Home Depot and Lowe's reuse the existing outbound templates; Rockler, Woodcraft and Walmart
 * read their own VITE_PUBLIC_* templates here (the outbound module is engine-side and untouched).
 */

export type AlsoAtStore = "homedepot" | "lowes" | "rockler" | "woodcraft" | "walmart";
export type AlsoAtLink = { store: AlsoAtStore; label: string; href: string };

export const ALSO_AT_ENV = {
  rockler: "VITE_PUBLIC_ROCKLER_AFFILIATE_TEMPLATE",
  woodcraft: "VITE_PUBLIC_WOODCRAFT_AFFILIATE_TEMPLATE",
  walmart: "VITE_PUBLIC_WALMART_AFFILIATE_TEMPLATE",
} as const;

const LABEL: Record<AlsoAtStore, string> = { homedepot: "Home Depot", lowes: "Lowe\u2019s", rockler: "Rockler", woodcraft: "Woodcraft", walmart: "Walmart" };
const ORDER: AlsoAtStore[] = ["homedepot", "lowes", "rockler", "woodcraft", "walmart"];
/** Specialty woodworking stores: not for lumber and sheet goods. */
const SPECIALTY = new Set<AlsoAtStore>(["rockler", "woodcraft"]);

function readEnv(name: string): string {
  let v: unknown;
  try {
    v = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {})[name];
  } catch {
    v = undefined;
  }
  if (!v && typeof process !== "undefined") v = process.env?.[name];
  return typeof v === "string" ? v.trim() : "";
}

const valid = (t: string) => (/^https:\/\/[^\s]+$/i.test(t) && t.includes("{url}") ? t : "");

export function alsoAtTemplates(): Record<AlsoAtStore, string> {
  const cfg = affiliateConfig();
  return {
    homedepot: cfg.homedepotTemplate,
    lowes: cfg.lowesTemplate,
    rockler: valid(readEnv(ALSO_AT_ENV.rockler)),
    woodcraft: valid(readEnv(ALSO_AT_ENV.woodcraft)),
    walmart: valid(readEnv(ALSO_AT_ENV.walmart)),
  };
}

export function alsoAtSearchUrl(store: AlsoAtStore, query: string): string {
  const q = encodeURIComponent(query.trim());
  switch (store) {
    case "homedepot": return `https://www.homedepot.com/s/${q}`;
    case "lowes": return `https://www.lowes.com/search?searchTerm=${q}`;
    case "walmart": return `https://www.walmart.com/search?q=${q}`;
    case "woodcraft": return `https://www.woodcraft.com/search?q=${q}`;
    case "rockler": return `https://www.rockler.com/search?q=${q}`;
  }
}

function storeOfOffer(href: string): string {
  const s = storeOf(href);
  if (s !== "other") return s;
  try {
    const h = new URL(href).hostname;
    if (/(^|\.)rockler\.com$/.test(h)) return "rockler";
    if (/(^|\.)woodcraft\.com$/.test(h)) return "woodcraft";
  } catch {
    /* not a URL */
  }
  return "other";
}

export function alsoAtLinks(line: BomLine, templates: Record<AlsoAtStore, string> = alsoAtTemplates()): AlsoAtLink[] {
  if ((line.offers ?? []).some((o) => o.quote === "owned")) return [];
  const have = new Set((line.offers ?? []).map((o) => storeOfOffer(o.href)));
  const local = isLocalStockRow(line);
  const query = line.searchQuery ?? line.name;
  return ORDER.filter((s) => templates[s] && !have.has(s) && !(local && SPECIALTY.has(s))).map((s) => ({
    store: s,
    label: LABEL[s],
    href: wrapTemplate(alsoAtSearchUrl(s, query), templates[s]),
  }));
}

export const ALSO_AT_REL = "sponsored nofollow noopener";
export const ALSO_AT_DISCLOSURE = "Yard may earn a commission from qualifying purchases.";


/**
 * The Buy list — the only place store and affiliate links render on the site
 * (scripts/yard-affiliate-guards.ts fails the build check if they show up anywhere else).
 */
export function BuyList({ plan }: { plan: BuildPlan }) {
  const cart = useMemo(() => buyListCart(plan.bom), [plan.bom]);
  const inCart = new Map(cart.lines.map((l) => [l.rowIndex, l]));
  const local = cart.perRow.filter((r) => r.local);
  const other = cart.perRow.filter((r) => !r.local);
  const also = useMemo(() => {
    const t = alsoAtTemplates();
    return plan.bom.map((b) => alsoAtLinks(b, t));
  }, [plan.bom]);
  // Any "also at" link carries a commission, so the disclosure shows whenever one renders.
  const disclosure = tagNote() || (also.some((l) => l.length) ? ALSO_AT_DISCLOSURE : "");
  const itemCount = cart.lines.length;

  if (!plan.bom.length) return null;

  return (
    <section data-yard-buy-list="1">
      <h3 className="font-display text-lg text-fg">Buy</h3>
      <p className="mt-1 text-xs text-muted">
        {plan.partsKind === "whole"
          ? `${plan.totals.pieces === 1 ? "1 full piece" : `${plan.totals.pieces} full pieces`} · glue · do not cut`
          : `${plan.totals.pieces === 1 ? "1 piece" : `${plan.totals.pieces} pieces`}`}{" "}
        · {usd(plan.totals.estCostUsd)} estimated{plan.bom.some((b) => b.estimatedCost == null || b.estimatedCost === 0) ? " · plus unpriced items" : ""} · cheapest first for the amount you need, any store, same size only
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
                {b.estimatedCost != null && b.estimatedCost > 0 && (!b.offers?.length || b.offers.some((o) => o.unitPrice > 0)) && (
                  <p className="shrink-0 font-mono text-xs text-muted">{usd(b.estimatedCost)}</p>
                )}
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
                        {o.quote === "search" || !(o.unitPrice > 0) ? (o.quote === "search" ? "Search" : "No price") : `${o.packsNeeded} × ${usd(o.packPrice)} · ${usd(o.unitPrice)}/ea`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {also[i].length > 0 && (
                <p className="mt-1 text-xs text-muted" data-yard-also-at-row="1">
                  Also at:{" "}
                  {also[i].map((l, k) => (
                    <span key={l.store}>
                      {k > 0 && " · "}
                      <a
                        href={l.href}
                        target={OUTBOUND_TARGET}
                        rel={ALSO_AT_REL}
                        className="underline-offset-2 hover:text-fg hover:underline"
                        data-yard-shop={l.store}
                        data-yard-affiliate="1"
                        data-yard-also-at="1"
                      >
                        {l.label}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
