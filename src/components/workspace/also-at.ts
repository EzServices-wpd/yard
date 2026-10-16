/**
 * "Also at" store links under Buy list rows (Growth store-links brief). Buy list only: never the
 * stock picker, PDF, print view or plan pages. Each store shows only when its own affiliate
 * template (a https deep-link with {url}) is set; with none set nothing renders.
 * Home Depot and Lowe's reuse the existing outbound templates; Rockler, Woodcraft and Walmart
 * read their own VITE_PUBLIC_* templates here (the outbound module is engine-side and untouched).
 */
import { isLocalStockRow } from "@/lib/yard/amazonCart";
import { affiliateConfig, storeOf, wrapTemplate } from "@/lib/yard/outbound";
import type { BomLine } from "@/lib/yard/types";

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
