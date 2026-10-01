/**
 * Pieces found from a search, kept on this device.
 * A remembered id is never a seed catalog row — those stay in FORGE_CATALOG.
 */
import type { CatalogItem } from "./types";

const KEY = "yard_found_stock_v1";
const MAX = 40;
const mem = new Map<string, CatalogItem>();
let loaded = false;

function usable(row: unknown): row is CatalogItem {
  if (!row || typeof row !== "object") return false;
  const item = row as CatalogItem;
  return typeof item.id === "string" && item.id.startsWith("piece-") && typeof item.name === "string";
}

function load() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return;
    for (const row of raw) {
      if (usable(row)) mem.set(row.id, row);
    }
  } catch {
    /* ignore broken storage */
  }
}

function save() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...mem.values()].slice(-MAX)));
  } catch {
    /* quota */
  }
}

export function foundCatalogItem(id: string): CatalogItem | undefined {
  load();
  return mem.get(id);
}

export function listFoundStock(): CatalogItem[] {
  load();
  return [...mem.values()].reverse();
}

export function rememberCatalogItem(item: CatalogItem) {
  if (!item.id.startsWith("piece-")) return;
  load();
  mem.delete(item.id);
  mem.set(item.id, item);
  while (mem.size > MAX) {
    const oldest = mem.keys().next().value;
    if (oldest == null) break;
    mem.delete(oldest);
  }
  save();
}
