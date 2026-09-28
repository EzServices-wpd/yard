/**
 * Stage 2 — every buy click.
 * URL builders for the Buy list. Affiliate tagging/wrapping lives in outbound.ts (outboundHref).
 */

import { affiliateConfig, amazonTagged, storeOf } from "./outbound";

export type ShopRetailer = "amazon" | "homedepot" | "lowes" | "walmart";

export type ShopLink = {
  retailer: ShopRetailer;
  label: string;
  href: string;
  affiliate: boolean;
};

export function amazonAssociateTag(): string {
  return affiliateConfig().amazonTag;
}

/** Stamp an Amazon URL with the Associates tag when one is set (the central outbound rule). */
export function stampAmazon(href: string, tag = amazonAssociateTag()): string {
  if (!href || storeOf(href) !== "amazon") return href;
  return amazonTagged(href, tag);
}

export function amazonSearchUrl(query: string, tag = amazonAssociateTag()): string {
  return stampAmazon(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`, tag);
}

export function amazonProductUrl(asin: string, tag = amazonAssociateTag()): string {
  return stampAmazon(`https://www.amazon.com/dp/${encodeURIComponent(asin)}`, tag);
}

export function homeDepotSearchUrl(query: string): string {
  return `https://www.homedepot.com/s/${encodeURIComponent(query)}`;
}

export function lowesSearchUrl(query: string): string {
  return `https://www.lowes.com/search?searchTerm=${encodeURIComponent(query)}`;
}

export function walmartSearchUrl(query: string): string {
  return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
}

export function affiliateUrl(opts: {
  query: string;
  asin?: string | null;
  retailer?: ShopRetailer;
}): string {
  const retailer = opts.retailer ?? (amazonAssociateTag() ? "amazon" : "homedepot");
  if (retailer === "amazon") {
    return opts.asin ? amazonProductUrl(opts.asin) : amazonSearchUrl(opts.query);
  }
  if (retailer === "lowes") return lowesSearchUrl(opts.query);
  if (retailer === "walmart") return walmartSearchUrl(opts.query);
  return homeDepotSearchUrl(opts.query);
}

export function shopSearchUrl(query: string, asin?: string | null): string {
  return affiliateUrl({ query, asin });
}

const LABELS: Record<ShopRetailer, string> = {
  amazon: "Amazon",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  walmart: "Walmart",
};

export function shopLinks(query: string, asin?: string | null): ShopLink[] {
  const tag = amazonAssociateTag();
  return [
    {
      retailer: "amazon",
      label: "Amazon",
      href: asin ? amazonProductUrl(asin) : amazonSearchUrl(query),
      affiliate: Boolean(tag),
    },
    {
      retailer: "homedepot",
      label: "Home Depot",
      href: homeDepotSearchUrl(query),
      affiliate: false,
    },
    {
      retailer: "lowes",
      label: "Lowe's",
      href: lowesSearchUrl(query),
      affiliate: false,
    },
    {
      retailer: "walmart",
      label: "Walmart",
      href: walmartSearchUrl(query),
      affiliate: false,
    },
  ];
}

export function retailerLabel(id: ShopRetailer) {
  return LABELS[id];
}
