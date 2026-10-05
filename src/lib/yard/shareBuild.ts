/**
 * Save keeps the build in this browser. Share is a link. No account, no server.
 */
import type { MeasureDraft } from "./types";

export type SharePayload = {
  prompt: string;
  measure: MeasureDraft;
  stockId?: string;
  join?: string;
};

const SAVE_KEY = "yard.saved";

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShare(token: string): SharePayload | null {
  try {
    const pad = token.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
    if (!parsed?.prompt || !parsed.measure) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function shareUrl(payload: SharePayload, origin = "https://yard.wiki"): string {
  return `${origin}/?y=${encodeShare(payload)}`;
}

export function saveBuild(payload: SharePayload): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

export function loadSaved(): SharePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SharePayload) : null;
  } catch {
    return null;
  }
}
