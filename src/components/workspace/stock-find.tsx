"use client";

import { useEffect, useMemo, useState } from "react";
import { lookupStockProduct, type StoreHit } from "@/lib/ai/stockLookup";
import { searchCatalog } from "@/lib/yard/catalog";
import {
  localStockQuery,
  measuredProduct,
  productNameFromQuery,
  stockHint,
  stockOffer,
  typedStockQuery,
  withStoreHit,
} from "@/lib/yard/stockQuery";
import { inchFrac } from "@/lib/yard/inchText";
import type { CatalogItem } from "@/lib/yard/types";

type Cache = { until: number; hit: StoreHit | null; error?: string };
const cache = new Map<string, Cache>();
const DAY = 24 * 60 * 60 * 1000;
const QUIET = 15 * 60 * 1000;

function stockInches(n: number): string {
  return `${inchFrac(n)}"`;
}

function dimLine(item: CatalogItem): string {
  const d = item.dims;
  if (d.length && d.diameter) return `${stockInches(d.length)} long · ⌀ ${stockInches(d.diameter)}`;
  if (d.length && d.width && d.height) return `${stockInches(d.length)} × ${stockInches(d.width)} × ${stockInches(d.height)}`;
  if (d.length && d.width) return `${stockInches(d.length)} × ${stockInches(d.width)}`;
  if (d.length) return `${stockInches(d.length)} long`;
  return "";
}

function priceLine(item: CatalogItem): string | null {
  if (item.unitCostUsd === 0) return "On hand";
  if (item.unitCostUsd != null && item.unitCostUsd > 0) return `$${item.unitCostUsd.toFixed(2)}`;
  return null;
}

export function StockFind({ query, onUse }: { query: string; onUse: (item: CatalogItem) => void }) {
  const q = query.trim();
  const offer = useMemo(() => (q ? stockOffer(q) : null), [q]);
  const hint = q ? stockHint(q) : null;
  const name = productNameFromQuery(q);
  const lumberCut = Boolean(q && localStockQuery(q));
  const inLibrary = q ? searchCatalog(q, 4).some((item) => !item.id.startsWith("piece-")) : false;
  const look =
    name.length >= 3 &&
    !lumberCut &&
    offer?.category !== "lumber" &&
    (!inLibrary || Boolean(q && typedStockQuery(q)));

  const [hit, setHit] = useState<StoreHit | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "quiet" | "error">("idle");
  const [error, setError] = useState("");
  const [lengthIn, setLengthIn] = useState("");
  const [acrossIn, setAcrossIn] = useState("");
  const [round, setRound] = useState(true);

  useEffect(() => {
    setLengthIn("");
    setAcrossIn("");
    setRound(/bottle|can|jar|tube|pipe|dowel|straw|rod/i.test(q));
  }, [q]);

  useEffect(() => {
    if (!look) {
      setHit(null);
      setStatus("idle");
      setError("");
      return;
    }
    const key = name.toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) {
      setHit(cached.hit);
      setStatus(cached.error ? "error" : cached.hit ? "idle" : "quiet");
      setError(cached.error ?? "");
      return;
    }
    let cancel = false;
    setStatus("loading");
    const timer = window.setTimeout(() => {
      lookupStockProduct({ data: { query: name } })
        .then((res) => {
          if (cancel) return;
          if (!res.ok) {
            cache.set(key, { until: Date.now() + QUIET, hit: null, error: res.error });
            setHit(null);
            setStatus("error");
            setError(res.error);
            return;
          }
          cache.set(key, { until: Date.now() + (res.hit ? DAY : QUIET), hit: res.hit });
          setHit(res.hit);
          setStatus(res.hit ? "idle" : "quiet");
          setError("");
        })
        .catch(() => {
          if (cancel) return;
          setStatus("error");
          setError("Couldn’t reach the product database.");
        });
    }, 450);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [look, name]);

  if (!q || (!offer && !hint && !look)) return null;

  const listing = hit
    ? { title: hit.title, brand: hit.brand, merchant: hit.merchant, priceUsd: hit.priceUsd, image: hit.image }
    : null;
  const ready = offer ? withStoreHit(offer, offer.category === "lumber" ? null : listing) : null;
  const length = parseFloat(lengthIn);
  const across = parseFloat(acrossIn);
  const measured =
    !ready && Number.isFinite(length) && length > 0
      ? measuredProduct(q, length, Number.isFinite(across) ? across : null, round, listing)
      : null;
  const chosen = ready ?? measured;
  const showSize = look && !ready;

  return (
    <div className="mb-3 rounded-md border border-border p-3">
      {ready && (
        <div className="flex items-start gap-3">
          {hit?.image && offer?.category !== "lumber" ? (
            <img
              src={hit.image}
              alt=""
              className="h-14 w-14 shrink-0 rounded-md border border-border object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">{ready.name}</p>
            <p className="mt-0.5 text-xs text-muted">{dimLine(ready)}</p>
            {priceLine(ready) && <p className="mt-0.5 font-mono text-xs text-faint">{priceLine(ready)}</p>}
          </div>
        </div>
      )}
      {!ready && hit && (
        <div className="flex items-start gap-3">
          {hit.image ? (
            <img
              src={hit.image}
              alt=""
              className="h-14 w-14 shrink-0 rounded-md border border-border object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">{hit.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {hit.merchant
                ? `${hit.merchant}${hit.priceUsd != null && hit.priceUsd > 0 ? ` · $${hit.priceUsd.toFixed(2)}` : ""}. One store, not a page for every shop.`
                : "No store or size came back with this title."}
            </p>
          </div>
        </div>
      )}
      {status === "loading" && <p className="mt-2 text-xs text-muted">Checking for a real listing…</p>}
      {status === "quiet" && (
        <p className="mt-2 text-xs text-muted">
          {offer
            ? "No photo came back, so this is the usual size. Put the inches in the search if you measured it."
            : "No listing came back. Type the inches and Yard uses that size."}
        </p>
      )}
      {status === "error" && <p className="mt-2 text-xs text-muted">{error}</p>}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      {ready?.notes && <p className="mt-2 text-xs text-muted">{ready.notes}</p>}
      {showSize && (
        <div className="mt-3">
          <p className="text-xs text-muted">The listing has no inches. Type the size and Yard builds with this piece.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setRound(true)}
              className={`rounded-full border px-2.5 py-1 text-xs ${round ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted"}`}
            >
              Round
            </button>
            <button
              type="button"
              onClick={() => setRound(false)}
              className={`rounded-full border px-2.5 py-1 text-xs ${!round ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted"}`}
            >
              Flat
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              Length (in)
              <input
                value={lengthIn}
                onChange={(e) => setLengthIn(e.target.value)}
                inputMode="decimal"
                aria-label="Length in inches"
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none"
              />
            </label>
            <label className="block text-xs text-muted">
              {round ? "Diameter (in)" : "Width (in)"}
              <input
                value={acrossIn}
                onChange={(e) => setAcrossIn(e.target.value)}
                inputMode="decimal"
                aria-label={round ? "Diameter in inches" : "Width in inches"}
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none"
              />
            </label>
          </div>
        </div>
      )}
      {chosen && (
        <button
          type="button"
          onClick={() => onUse(chosen)}
          className="mt-3 h-10 w-full rounded-md border border-fg/40 bg-elevated text-sm text-fg"
        >
          Use this
        </button>
      )}
      {/* No store links here: shopping links live only on the Buy list (yard-affiliate-guards). */}
    </div>
  );
}
