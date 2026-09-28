/**
 * The one door every Buy link walks through — site Buy list, print preview, and the PDF.
 *
 * Inert until an ID is set. With nothing set, every href comes back byte-for-byte unchanged.
 *
 *   VITE_PUBLIC_AMAZON_ASSOCIATE_TAG        Amazon Associates tracking ID, e.g.  yard-20
 *   VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE Impact tracking link with {url},    e.g.  https://homedepot.sjv.io/c/1234567/456789/8154?u={url}
 *   VITE_PUBLIC_LOWES_AFFILIATE_TEMPLATE     same shape for Lowe's (optional)
 *
 * VITE_PUBLIC_ because the Buy links are built in the browser; none of these are secrets.
 * Vite bakes them in at build time, so a change needs a redeploy.
 */

export type AffiliateConfig = {
  amazonTag: string;
  homedepotTemplate: string;
  lowesTemplate: string;
};

export const AFFILIATE_ENV = {
  amazonTag: "VITE_PUBLIC_AMAZON_ASSOCIATE_TAG",
  homedepotTemplate: "VITE_PUBLIC_HOMEDEPOT_AFFILIATE_TEMPLATE",
  lowesTemplate: "VITE_PUBLIC_LOWES_AFFILIATE_TEMPLATE",
} as const;

/** Server/node aliases (guards, SSR) — same values, no prefix. */
const NODE_ALIASES: Record<keyof AffiliateConfig, string[]> = {
  amazonTag: ["NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG", "AMAZON_ASSOCIATES_TAG", "AMAZON_ASSOCIATE_TAG"],
  homedepotTemplate: ["HOMEDEPOT_AFFILIATE_TEMPLATE"],
  lowesTemplate: ["LOWES_AFFILIATE_TEMPLATE"],
};

export const OUTBOUND_REL = "sponsored noopener";
export const OUTBOUND_TARGET = "_blank";

function clean(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t && t !== "undefined" && t !== "null" ? t : "";
}

function readViteEnv(): Record<string, string | undefined> {
  try {
    // Vite replaces import.meta.env with the VITE_* values in the browser build.
    return ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

function readProcessEnv(): Record<string, string | undefined> {
  try {
    return typeof process !== "undefined" && process.env ? process.env : {};
  } catch {
    return {};
  }
}

const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;

function validTemplate(t: string): string {
  return /^https:\/\/[^\s]+$/i.test(t) && t.includes("{url}") ? t : "";
}

/** Read live each call (cheap) so guards can flip env values. */
export function affiliateConfig(): AffiliateConfig {
  const vite = readViteEnv();
  const proc = readProcessEnv();
  const pick = (key: keyof AffiliateConfig) => {
    const name = AFFILIATE_ENV[key];
    return clean(vite[name]) || clean(proc[name]) || NODE_ALIASES[key].map((a) => clean(proc[a])).find(Boolean) || "";
  };
  const tag = pick("amazonTag");
  return {
    amazonTag: TAG_RE.test(tag) ? tag : "",
    homedepotTemplate: validTemplate(pick("homedepotTemplate")),
    lowesTemplate: validTemplate(pick("lowesTemplate")),
  };
}

export function affiliateActive(cfg: AffiliateConfig = affiliateConfig()): boolean {
  return Boolean(cfg.amazonTag || cfg.homedepotTemplate || cfg.lowesTemplate);
}

/** Plain disclosure line; empty when nothing is active. The Amazon sentence only when the Amazon tag is live. */
export function affiliateDisclosure(cfg: AffiliateConfig = affiliateConfig()): string {
  if (!affiliateActive(cfg)) return "";
  const parts = ["Yard may earn a commission from qualifying purchases."];
  if (cfg.amazonTag) parts.push("As an Amazon Associate, Yard earns from qualifying purchases.");
  return parts.join(" ");
}

export type Store = "amazon" | "homedepot" | "lowes" | "walmart" | "other";

export function storeOf(href: string): Store {
  let host = "";
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (/(^|\.)amazon\.[a-z.]+$/.test(host) || host === "amzn.to") return "amazon";
  if (/(^|\.)homedepot\.com$/.test(host)) return "homedepot";
  if (/(^|\.)lowes\.com$/.test(host)) return "lowes";
  if (/(^|\.)walmart\.com$/.test(host)) return "walmart";
  return "other";
}

/** Amazon: clean product or search URL + tag. Keeps other params only when the path is neither. */
export function amazonTagged(href: string, tag: string): string {
  if (!tag) return href;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return href;
  }
  const dp = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (dp) {
    const out = new URL(`${u.protocol}//${u.host}/dp/${dp[1].toUpperCase()}`);
    out.searchParams.set("tag", tag);
    return out.toString();
  }
  if (u.pathname === "/s" || u.pathname === "/s/") {
    const k = u.searchParams.get("k") ?? "";
    const out = new URL(`${u.protocol}//${u.host}/s`);
    if (k) out.searchParams.set("k", k);
    out.searchParams.set("tag", tag);
    return out.toString();
  }
  u.searchParams.set("tag", tag);
  return u.toString();
}

/** Impact-style wrapper: template with {url}, raw store URL URL-encoded into it. */
export function wrapTemplate(href: string, template: string): string {
  if (!template) return href;
  return template.split("{url}").join(encodeURIComponent(href));
}

/**
 * Central outbound link. Every Buy row href goes through here. Idempotent:
 * an already-tagged Amazon URL stays the same; an already-wrapped URL is no longer a store host.
 */
export function outboundHref(href: string, cfg: AffiliateConfig = affiliateConfig()): string {
  if (!href) return href;
  const store = storeOf(href);
  if (store === "amazon") return amazonTagged(href, cfg.amazonTag);
  if (store === "homedepot") return wrapTemplate(href, cfg.homedepotTemplate);
  if (store === "lowes") return wrapTemplate(href, cfg.lowesTemplate);
  return href;
}

/** Is this particular link earning (drives data-yard-affiliate). */
export function outboundIsAffiliate(href: string, cfg: AffiliateConfig = affiliateConfig()): boolean {
  const store = storeOf(href);
  if (store === "amazon") return Boolean(cfg.amazonTag);
  if (store === "homedepot") return Boolean(cfg.homedepotTemplate);
  if (store === "lowes") return Boolean(cfg.lowesTemplate);
  return false;
}
