/**
 * One lookup of a real retail listing. Trial product data only — no invented SKU.
 * When the database is quiet or rate-limited, the caller still has store search links.
 */
import { createServerFn } from "@tanstack/react-start";

export type StoreHit = {
  title: string;
  brand?: string;
  merchant?: string;
  priceUsd?: number;
  image?: string;
  /** A store listing, or a reference photo when no listing came back. */
  source?: "listing" | "reference";
};

type Cache = { until: number; hit: StoreHit | null };
const cache = new Map<string, Cache>();
const DAY = 24 * 60 * 60 * 1000;
const QUIET = 15 * 60 * 1000;

type Offer = { merchant?: string; price?: number | string };
type UpcItem = { title?: string; brand?: string; offers?: Offer[]; images?: string[] };
type UpcBody = { items?: UpcItem[] };

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function pick(items: UpcItem[], query: string): StoreHit | null {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const generic = new Set(["water", "bottle", "bottles", "the", "and", "for", "with", "pack", "inch", "inches"]);
  const must = words.filter((w) => !generic.has(w));
  const keys = must.length ? must : words;
  const score = (title: string) => {
    const t = title.toLowerCase();
    return keys.filter((w) => t.includes(w)).length;
  };
  const ranked = [...items]
    .filter((i) => (i.title ?? "").trim().length > 2 && score(i.title ?? "") > 0)
    .sort((a, b) => score(b.title ?? "") - score(a.title ?? ""));
  const item = ranked[0];
  if (!item?.title) return null;
  const offer = (item.offers ?? []).find((o) => num(o.price) != null) ?? item.offers?.[0];
  const image = (item.images ?? []).find((src) => /^https:\/\//.test(src));
  return {
    title: item.title.replace(/\s+/g, " ").trim().slice(0, 140),
    brand: item.brand?.trim() || undefined,
    merchant: offer?.merchant?.trim() || undefined,
    priceUsd: num(offer?.price),
    image,
    source: "listing",
  };
}

type WikiBody = {
  query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
};

async function referencePhoto(query: string): Promise<StoreHit | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=480&format=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Yard/1.0 (shop planner)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as WikiBody;
    const page = Object.values(body.query?.pages ?? {})[0];
    const image = page?.thumbnail?.source;
    if (!page?.title || !image || !/^https:\/\//.test(image)) return null;
    return { title: page.title.replace(/\s+/g, " ").trim().slice(0, 140), image, source: "reference" };
  } catch {
    return null;
  }
}

async function listing(query: string): Promise<StoreHit | null | "quiet"> {
  const url = `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}&match_mode=0&type=product`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Yard/1.0 (shop planner)" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429 || res.status === 503) return "quiet";
    if (!res.ok) return null;
    const body = (await res.json()) as UpcBody;
    return pick(body.items ?? [], query);
  } catch {
    return null;
  }
}

export const lookupStockProduct = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => ({
    query: String(input?.query ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120),
  }))
  .handler(async ({ data }): Promise<{ ok: true; hit: StoreHit | null } | { ok: false; error: string }> => {
    const query = data.query;
    if (query.length < 3) return { ok: true, hit: null };
    const key = query.toLowerCase();
    const hitCache = cache.get(key);
    if (hitCache && hitCache.until > Date.now()) return { ok: true, hit: hitCache.hit };

    // Ask for one item, not the box: pack, count and bulk words are dropped from the search, and the
    // caller never takes a size from a listing title that describes packaging (stockQuery.withStoreHit).
    const single = query.replace(/\b(?:box|boxes|pack|packs|package|bag|bulk|case|carton|\d+\s*(?:ct|pk|pcs|count|pieces))\b(?:\s+of)?/gi, " ").replace(/\s+/g, " ").trim() || query;
    const found = await listing(single);
    let hit = found === "quiet" ? null : found;
    if (!hit?.image) {
      const photo = await referencePhoto(query);
      if (photo) {
        hit = hit ? { ...hit, image: photo.image } : photo;
      }
    }
    cache.set(key, { until: Date.now() + (hit ? DAY : QUIET), hit });
    return { ok: true, hit };
  });

function publicImageUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  const ip = host.replace(/^\[|\]$/g, "");
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/.test(ip)) return null;
  return url.toString().slice(0, 800);
}

/** Private, loopback, link-local, CGNAT, unique-local and IPv4-mapped forms of those: never fetched. */
export function isPrivateIp(raw: string): boolean {
  let ip = raw.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = ip.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? ip.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  else if (/^(?:0*:)*:?ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) {
    const [hi, lo] = ip.split(":").slice(-2).map((h) => parseInt(h, 16));
    ip = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (!ip.includes(":")) return false;
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^::/.test(ip);
}

/** Every address the host resolves to is public. ponytail: a rebinding DNS can still swap between check and fetch; pin the address if that matters. */
async function publicHost(host: string): Promise<boolean> {
  if (isPrivateIp(host)) return false;
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(host.replace(/^\[|\]$/g, ""), { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** Same-origin copy of a listing photo so the bench can draw it. */
export const proxyStockImage = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => ({ url: String(input?.url ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: true; dataUrl: string } | { ok: false }> => {
    let url = publicImageUrl(data.url);
    try {
      // Redirects by hand: every hop is re-checked, so a public URL cannot bounce into the private network.
      let res: Response | null = null;
      for (let hop = 0; hop < 4 && url; hop++) {
        if (!(await publicHost(new URL(url).hostname))) return { ok: false };
        res = await fetch(url, {
          headers: { Accept: "image/*", "User-Agent": "Yard/1.0 (shop planner)" },
          signal: AbortSignal.timeout(8000),
          redirect: "manual",
        });
        if (res.status < 300 || res.status >= 400) break;
        const next = res.headers.get("location");
        url = next ? publicImageUrl(new URL(next, url).toString()) : null;
        res = null;
      }
      if (!res || !res.ok) return { ok: false };
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp" && type !== "image/gif") {
        return { ok: false };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 32 || buf.length > 900_000) return { ok: false };
      return { ok: true, dataUrl: `data:${type};base64,${buf.toString("base64")}` };
    } catch {
      return { ok: false };
    }
  });
