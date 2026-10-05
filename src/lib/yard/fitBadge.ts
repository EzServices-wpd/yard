/**
 * One fit line for the size fields. Green when the existing warnings are quiet.
 * Amber names the first existing warning from the real numbers. No new rules.
 */
import { inchFrac } from "./inchText";
import type { MeasureWarning } from "./measureTabs";

export type FitBadge = { tone: "green" | "amber"; text: string; field: "width" | "height" | "depth" | "opening" };

function mark(n: number | undefined): string {
  return Number.isFinite(n) ? `${inchFrac(n ?? 0)}″` : "this";
}

/** What a shelf of this depth actually holds. Only used when the shallow warning is already on. */
export function shelfHolds(depth: number): string {
  if (depth < 4) return "sized for spice jars";
  if (depth < 6.5) return "sized for spices, small jars and paperbacks";
  return "sized for paperbacks, tight for a textbook";
}

export function fitBadge(input: {
  warnings: MeasureWarning[];
  hasSpace: boolean;
  depth?: number;
  width?: number;
  span?: number;
}): FitBadge {
  const first = input.warnings[0];
  if (!first) {
    return { tone: "green", text: input.hasSpace ? "Fits your space" : "Sized right", field: "width" };
  }
  if (first.id === "shallow-shelf") {
    const deep = input.depth ?? 0;
    return { tone: "amber", text: `Shelves ${mark(deep)} deep — ${shelfHolds(deep)}`, field: "depth" };
  }
  if (first.id === "span") {
    const wide = input.span ?? input.width;
    return { tone: "amber", text: `Top ${mark(wide)} wide — add a center leg`, field: "width" };
  }
  if (first.id === "narrow-seat") {
    return { tone: "amber", text: `Seat ${mark(input.width)} wide — a bit narrow to sit`, field: "width" };
  }
  if (first.id === "tight") {
    return { tone: "amber", text: first.text || "Leaves a little for the door to swing", field: "opening" };
  }
  return { tone: "amber", text: first.text, field: "width" };
}
