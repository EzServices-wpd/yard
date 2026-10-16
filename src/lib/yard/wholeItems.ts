/**
 * C11: a whole bought item (zip tie, marble, washer) is used as bought. Nothing about it is cut, marked or
 * assumed, so no surface (cut list, steps, PDF header) talks to it in cutting words. One answer for every surface.
 */
import type { BuildPlan, CutLine } from "./types";

/** Cut-list rows are all whole bought pieces (no row is a real cut). */
export function allWhole(plan: Pick<BuildPlan, "cutList">): boolean {
  return plan.cutList.length > 0 && plan.cutList.every((c) => c.whole);
}

/** The line under the cut-list heading. Whole bought pieces never read "Mark A on the first cut". */
export function cutListIntro(plan: Pick<BuildPlan, "cutList" | "partsKind">): string {
  if (plan.partsKind === "whole") return "Full pieces from the pack. Glue them. Do not cut.";
  if (allWhole(plan)) return "Whole pieces, used as bought. Nothing to cut.";
  return "Same size is the same letter. Mark A on the first cut, then batch.";
}

/**
 * The PDF cut-list line (C11). A pack build says "Glue them as they come"; whole bought pieces are never told to be
 * marked "as you cut it"; only a list with real cuts asks for a pencil letter as each part is cut.
 */
export function pdfCutListIntro(plan: Pick<BuildPlan, "cutList" | "partsKind">, craft = plan.partsKind === "whole"): string {
  if (craft) return "Full pieces from the pack. Glue them as they come.";
  if (allWhole(plan)) return "Whole pieces, used as bought. Nothing to cut.";
  if (plan.cutList.some((c) => c.whole)) return "Same size is the same letter. Mark each cut part with its letter in pencil as you cut it; whole pieces are used as bought.";
  return "Same size is the same letter. Mark each part with its letter in pencil as you cut it.";
}

/** Rows a person ticks off as cut ("2 of 5 sizes cut"): real cuts only, never a whole bought piece. */
export function cutProgressRows(plan: Pick<BuildPlan, "cutList" | "partsKind">): CutLine[] {
  if (plan.partsKind === "whole") return [];
  return plan.cutList.filter((c) => c.label && !c.whole);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A whole piece has no cut letter in prose: "One A 8" cable tie" → "One 8" cable tie". */
export function unletterWhole(text: string, rows: CutLine[]): string {
  let t = text;
  for (const c of rows) {
    if (!c.whole || !c.label) continue;
    // The name in either case at its first letter, singular or plural ("A Bead", "30 A beads").
    const name = esc(c.name).replace(/^[A-Za-z]/, (ch) => `[${ch.toUpperCase()}${ch.toLowerCase()}]`);
    t = t.replace(new RegExp(`\\b${esc(c.label)} (${name}(?:e?s)?)\\b`, "g"), "$1");
  }
  return t;
}

/** Cutting words that never belong to a whole bought piece (the C11 invariant). */
export const WHOLE_ITEM_CUT_TALK = /measure to lock|assumed|Mark A on the first cut|\bsizes cut\b|\bOne [A-Z] (?=\d|[A-Z][a-z])/;
