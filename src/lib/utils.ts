import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function inches(n: number, digits = 1): string {
  const v = Number.isInteger(n) ? n.toString() : n.toFixed(digits);
  return `${v}"`;
}

export function usd(n: number): string {
  return n === 0 ? "—" : `~$${n.toFixed(2)}`;
}

export { shopSearchUrl, affiliateUrl, shopLinks, amazonAssociateTag } from "@/lib/yard/shop";
