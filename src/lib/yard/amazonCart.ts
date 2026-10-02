/**
 * "Buy this list" — one Amazon cart for every Buy row that has an Amazon ASIN in the catalog.
 *
 * Quantities come from the Buy model itself: the packs that row's Amazon offer says to buy
 * (offer.packsNeeded). Rows with no ASIN (lumber and sheet goods, mostly) stay on their own
 * per-row store links. The Associates tag follows the same on/off switch as every other Buy link
 * (VITE_PUBLIC_AMAZON_ASSOCIATE_TAG); with no tag the cart still fills, just untagged.
 *
 * Only the Buy list renders this (scripts/yard-affiliate-guards.ts enforces it).
 */
import { getCatalogItem } from "./catalog";
import { LISTINGS } from "./listings";
import { affiliateConfig, storeOf, type AffiliateConfig } from "./outbound";
import type { BomLine, ShopOffer } from "./types";

export const AMAZON_CART_ADD_URL = "https://www.amazon.com/gp/aws/cart/add.html";

const ASIN_RE = /^[A-Z0-9]{10}$/;

/** ASIN from an Amazon product URL (/dp/, /gp/product/, /gp/aw/d/); null for searches and other stores. */
export function asinFromHref(href: string): string | null {
  if (!href || storeOf(href) !== "amazon") return null;
  try {
    const m = new URL(href).pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Amazon's add-to-cart URL: ASIN.n / Quantity.n pairs, plus AssociateTag only when a tag is live. */
export function amazonCartUrl(items: { asin: string; quantity: number }[], tag = affiliateConfig().amazonTag): string {
  const u = new URL(AMAZON_CART_ADD_URL);
  items.forEach((it, i) => {
    u.searchParams.set(`ASIN.${i + 1}`, it.asin);
    u.searchParams.set(`Quantity.${i + 1}`, String(it.quantity));
  });
  if (tag) u.searchParams.set("AssociateTag", tag);
  return u.toString();
}

/** Lumber and sheet goods: bought at the local yard, not shipped in a box. */
export function isLocalStockRow(line: BomLine): boolean {
  const id = line.catalogId ?? "";
  if (/^(lumber|plywood|mdf|osb|hardboard|hardwood|board|sheet-goods)(-|$)/.test(id)) return true;
  if (/^sheets?$/i.test(line.unit.trim())) return true;
  const hay = `${line.name} ${line.searchQuery ?? ""}`.toLowerCase();
  if (/foam|card|paper|chip|acrylic|glass|popsicle|craft/.test(hay)) return false;
  return /plywood|lumber|\bmdf\b|\bosb\b|hardboard|\b[12]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b|\b4\s*[x×]\s*4\b/.test(hay);
}

/** Priced from the catalog (offersFor) rather than a bare search fallback (whole row = one "pack"). */
function catalogPriced(line: BomLine): boolean {
  const id = line.catalogId;
  if (!id) return false;
  return LISTINGS.some((o) => o.catalogId === id) || Boolean(getCatalogItem(id));
}

/** The Amazon offer on this row that has an ASIN: the row's own ASIN first, else the cheapest one. */
export function amazonCartOffer(line: BomLine): { asin: string; offer: ShopOffer } | null {
  const offers = line.offers ?? [];
  if (offers.some((o) => o.quote === "owned")) return null;
  const withAsin = offers
    .map((offer) => ({ offer, asin: asinFromHref(offer.href) }))
    .filter((x): x is { offer: ShopOffer; asin: string } => Boolean(x.asin && ASIN_RE.test(x.asin)));
  if (!withAsin.length) return null;
  const own = line.asin ? withAsin.find((x) => x.asin === line.asin!.toUpperCase()) : undefined;
  return own ?? withAsin[0];
}

export type CartLine = { rowIndex: number; name: string; asin: string; quantity: number; title: string };
export type PerRowLine = { rowIndex: number; name: string; local: boolean };
export type BuyListCart = {
  /** null when no row has an ASIN. */
  href: string | null;
  lines: CartLine[];
  perRow: PerRowLine[];
  tagged: boolean;
};

export function buyListCart(bom: BomLine[], cfg: AffiliateConfig = affiliateConfig()): BuyListCart {
  const lines: CartLine[] = [];
  const perRow: PerRowLine[] = [];
  bom.forEach((line, rowIndex) => {
    if ((line.offers ?? []).some((o) => o.quote === "owned")) return; // already on hand
    const pick = amazonCartOffer(line);
    if (!pick) {
      perRow.push({ rowIndex, name: line.name, local: isLocalStockRow(line) });
      return;
    }
    const packs = catalogPriced(line) ? pick.offer.packsNeeded : line.quantity;
    const quantity = Math.max(1, Math.ceil(Number.isFinite(packs) ? packs : 1));
    lines.push({ rowIndex, name: line.name, asin: pick.asin, quantity, title: pick.offer.title });
  });
  // One cart entry per ASIN (two rows can name the same product).
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.asin, (merged.get(l.asin) ?? 0) + l.quantity);
  const items = [...merged].map(([asin, quantity]) => ({ asin, quantity }));
  return {
    href: items.length ? amazonCartUrl(items, cfg.amazonTag) : null,
    lines,
    perRow,
    tagged: Boolean(items.length && cfg.amazonTag),
  };
}
