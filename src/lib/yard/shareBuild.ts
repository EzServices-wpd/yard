/**
 * Save keeps the build in this browser. Share is a link. No account, no server.
 * The token carries every Measure setting that differs from the default.
 */
import { generateFromPrompt } from "./promptMain";
import { applyInsideCount } from "./insideCount";
import type { MeasureDraft, YardProject } from "./types";
import type { ShopJoin } from "./shopJoin";

export type SharePayload = {
  prompt: string;
  measure: Partial<MeasureDraft>;
  stockId?: string;
  join?: string;
  shelves?: number;
  cubbies?: number;
  drawers?: number;
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

/** Drop empty measure fields. Keep a count, stock, or join only when it differs from the default. */
export function shareFrom(input: {
  prompt: string;
  measure: Partial<MeasureDraft>;
  stockId?: string;
  join?: string;
  shelves?: number;
  cubbies?: number;
  drawers?: number;
  defaults?: { stockId?: string; join?: string; shelves?: number; cubbies?: number; drawers?: number };
}): SharePayload {
  const measure: Partial<MeasureDraft> = {};
  for (const [key, value] of Object.entries(input.measure)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    (measure as Record<string, unknown>)[key] = value;
  }
  const d = input.defaults ?? {};
  const payload: SharePayload = { prompt: input.prompt, measure };
  if (input.stockId && input.stockId !== d.stockId) payload.stockId = input.stockId;
  if (input.join && input.join !== d.join) payload.join = input.join;
  if (input.shelves != null && input.shelves !== d.shelves) payload.shelves = input.shelves;
  if (input.cubbies != null && input.cubbies !== d.cubbies) payload.cubbies = input.cubbies;
  if (input.drawers != null && input.drawers !== d.drawers) payload.drawers = input.drawers;
  return payload;
}

export function shareUrl(payload: SharePayload, origin = "https://yard.wiki"): string {
  return `${origin}/workspace?y=${encodeShare(payload)}`;
}

/** Rebuild the model the link names. Same path the bench uses after a shared open. */
export function replayShare(payload: SharePayload): YardProject {
  let project = generateFromPrompt(payload.prompt, payload.stockId);
  if (payload.stockId) project = { ...project, primaryMaterialId: payload.stockId };
  if (payload.shelves != null || payload.cubbies != null || payload.drawers != null) {
    project = applyInsideCount(
      { ...project, primaryMaterialId: payload.stockId ?? project.primaryMaterialId },
      { shelves: payload.shelves, cubbies: payload.cubbies, drawers: payload.drawers },
    );
  }
  if (payload.join) project = { ...project, shopJoin: payload.join as ShopJoin };
  return project;
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
