/** Display helpers for plan PDFs — keep floats off the page. */

import { fmtUnitEnvelopeInches, isRoundUnitEnvelope } from "./voiceHonesty";

export function fmtIn(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function fmtDims(w: number, h: number, d: number): string {
  return `${fmtIn(w)}" x ${fmtIn(h)}" x ${fmtIn(d)}"`;
}

export function fmtDimsWHD(w: number, h: number, d: number): string {
  return `${fmtIn(w)}" W × ${fmtIn(h)}" H × ${fmtIn(d)}" D`;
}

/** PDF/HUD unit line — round tables speak dia × H, never W×H×W diameter echo. */
export function fmtUnitEnvelope(
  w: number,
  h: number,
  d: number,
  opts?: { shape?: string | null; prompt?: string | null; name?: string | null; legs?: number | null },
): string {
  return fmtUnitEnvelopeInches(w, h, d, opts);
}

export { isRoundUnitEnvelope };

/** Lumber-aisle sheet talk: '1/4" Plywood 4×10' → '1/4" 4×10'. */
export function shortSheetTalk(material: string | null | undefined): string {
  if (!material) return "";
  return material
    .replace(/Plywood\s+/gi, "")
    .replace(/plywood\s+/gi, "")
    .replace(/\(\s*backer\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
