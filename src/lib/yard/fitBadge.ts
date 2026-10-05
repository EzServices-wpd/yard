/**
 * One fit line for the size fields. Green when the existing warnings are quiet.
 * Amber names the first existing warning in plain words. No new rules.
 */
import { inchFrac } from "./inchText";
import type { MeasureWarning } from "./measureTabs";

export type FitBadge = { tone: "green" | "amber"; text: string; field: "width" | "height" | "depth" | "opening" };

export function fitBadge(input: {
  warnings: MeasureWarning[];
  hasSpace: boolean;
  depth?: number;
  width?: number;
}): FitBadge {
  const first = input.warnings[0];
  if (!first) {
    return { tone: "green", text: input.hasSpace ? "Fits your space" : "Sized right", field: "width" };
  }
  if (first.id === "shallow-shelf") {
    const deep = Number.isFinite(input.depth) ? inchFrac(input.depth ?? 0) : "this";
    return { tone: "amber", text: `Shelves ${deep} deep — good for books, tight for towels`, field: "depth" };
  }
  if (first.id === "span") {
    return { tone: "amber", text: "Top over 48 wide — add a center leg", field: "width" };
  }
  if (first.id === "narrow-seat") {
    const wide = Number.isFinite(input.width) ? inchFrac(input.width ?? 0) : "this";
    return { tone: "amber", text: `Seat ${wide} wide — a bit narrow to sit`, field: "width" };
  }
  if (first.id === "tight") {
    return { tone: "amber", text: first.text || "Leaves a little for the door to swing", field: "opening" };
  }
  return { tone: "amber", text: first.text, field: "width" };
}
