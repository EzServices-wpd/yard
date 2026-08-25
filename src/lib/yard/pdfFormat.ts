/** Display helpers for plan PDFs — keep floats off the page. */
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
