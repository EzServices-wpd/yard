import { buildClosetFromOpening } from "./closet";
import { buildWindowProject, pickWindow, STOCK_WINDOWS } from "./windows";
import type { FittedProgram, SpaceKind, YardProject } from "./types";
import { wantsShoes, type HouseFamily } from "./family";

export type { SpaceKind };

export type SpaceMeasurement = {
  widthIn: number;
  heightIn: number;
  depthIn?: number;
  kindHint?: SpaceKind;
  windowId?: string;
};

export { matchStockWindows as matchWindows } from "./windows";


/** Rewrite the prompt so Measure W×H×D is the typed fact honesty will honor. */
export function stampPromptSize(prompt: string, w: number, h: number, d: number): string {
  let p = prompt.trim();
  if (!p) return `${w} wide ${h} high ${d} deep`;
  const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(n));
  const W = fmt(w);
  const H = fmt(h);
  const D = fmt(d);
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(wide|width)\b/i, `${W}$2$3`);
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(tall|high|height)\b/i, `${H}$2$3`);
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(deep|depth)\b/i, `${D}$2$3`);
  p = p.replace(
    /(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s+)((?:bathroom\s+)?alcove)\b/i,
    `${W}$2$3`,
  );
  p = p.replace(
    /(\d+(?:\.\d+)?)\s*(x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(x|by|×)\s*(\d+(?:\.\d+)?))?/i,
    (m: string, a: string, sep1: string, b: string, sep2?: string, c?: string) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (na <= 4 && nb <= 12 && (c == null || parseFloat(c) <= 16)) return m;
      if (c) return `${W}${sep1}${H}${sep2}${D}`;
      return `${W}${sep1}${H}`;
    },
  );
  return p.replace(/\s{2,}/g, " ").trim();
}

export function classifySpace(m: SpaceMeasurement): SpaceKind {
  if (m.kindHint) return m.kindHint;
  const d = m.depthIn ?? 0;
  if (d > 0 && d <= 8 && m.widthIn >= 18 && m.heightIn >= 24) return "window_rough_opening";
  if (d >= 12 && d <= 30 && m.widthIn >= 18 && m.heightIn >= 48) return "closet_niche";
  if (d >= 8 && m.widthIn >= 24 && m.heightIn >= 36) return "shelving_alcove";
  return "general_volume";
}

/** Seed the measure dropdown from the unit on the bench — never leftover "General volume" for a desk. */
export function measureKindFromProject(project: YardProject): SpaceKind {
  if (project.windowPkg) return "window_rough_opening";
  if (project.pocket) return "closet_niche";
  const opening = project.fitted?.opening.kind;
  if (opening === "window") return "window_rough_opening";
  if (opening === "alcove" || opening === "pocket") return "closet_niche";
  const program = project.fitted?.program as FittedProgram | undefined;
  const family = project.fitted?.family as HouseFamily | undefined;
  const blob = `${project.name ?? ""} ${project.prompt ?? ""} ${project.fitted?.name ?? ""}`.toLowerCase();
  if (program === "desk") return "desk";
  if (program === "media" || /\btv\b|media console|entertainment\s*cent/.test(blob)) return "media";
  if (program === "table" || family === "table") return "table";
  if (program === "bench" || family === "seat") return "bench";
  if (wantsShoes(blob) || /shoe rack/.test(blob)) return "shoe_rack";
  if (program === "closet" || program === "vanity" || program === "wardrobe" || program === "pantry") {
    return "closet_niche";
  }
  if (family === "hung-open" || family === "hung-cabinet" || program === "bookcase") return "shelving_alcove";
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
