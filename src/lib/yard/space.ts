import { buildClosetFromOpening } from "./closet";
import { buildWindowProject, pickWindow, STOCK_WINDOWS } from "./windows";
import type { SpaceKind, YardProject } from "./types";

export type { SpaceKind };

export type SpaceMeasurement = {
  widthIn: number;
  heightIn: number;
  depthIn?: number;
  kindHint?: SpaceKind;
  windowId?: string;
};

export { matchStockWindows as matchWindows } from "./windows";

export function classifySpace(m: SpaceMeasurement): SpaceKind {
  if (m.kindHint) return m.kindHint;
  const d = m.depthIn ?? 0;
  if (d > 0 && d <= 8 && m.widthIn >= 18 && m.heightIn >= 24) return "window_rough_opening";
  if (d >= 12 && d <= 30 && m.widthIn >= 18 && m.heightIn >= 48) return "closet_niche";
  if (d >= 8 && m.widthIn >= 24 && m.heightIn >= 36) return "shelving_alcove";
  return "general_volume";
}

export function framingNotes(roW: number, roH: number): string[] {
  const header = roW <= 36 ? "2×6 doubled header (heuristic)" : roW <= 48 ? "2×8 doubled header (heuristic)" : "engineered header — have a carpenter check";
  return [
    `Rough opening ${roW}" × ${roH}". Frame to the unit's published RO.`,
    `Kings: two full-height studs, one each side.`,
    `Jacks: two trimmers supporting the header.`,
    `Header: ${header}. Not stamped engineering.`,
    "Sill + cripples. Wrap and pan-flash before the unit goes in.",
  ];
}

export function projectFromMeasurement(m: SpaceMeasurement, prompt = ""): YardProject {
  const kind = classifySpace(m);
  const d = m.depthIn ?? (kind === "window_rough_opening" ? 3.5 : 16);
  if (kind === "window_rough_opening") {
    const unit =
      (m.windowId && STOCK_WINDOWS.find((x) => x.id === m.windowId)) ||
      pickWindow(prompt || `${m.widthIn}x${m.heightIn} window`, m.widthIn, m.heightIn);
    return buildWindowProject(unit, prompt || `window ${m.widthIn} by ${m.heightIn}`);
  }
  return buildClosetFromOpening(m.widthIn, m.heightIn, d, prompt);
}