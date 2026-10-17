import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { inchFrac } from "@/lib/yard/inchText";
import { stableId } from "@/lib/stableId";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix = "id"): string {
  return stableId(prefix);
}

/** Every user-visible inch goes through the one shop-fraction formatter (0.75 → 3/4"). */
export function inches(n: number, _digits = 1): string {
  return `${inchFrac(n)}"`;
}

export function usd(n: number): string {
  // No price (0, missing, NaN) reads as a dash — never "$NaN".
  return !Number.isFinite(n) || n === 0 ? "—" : `~$${n.toFixed(2)}`;
}

