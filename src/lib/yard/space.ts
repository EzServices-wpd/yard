import { buildClosetFromOpening } from "./closet";
import { buildWindowProject, headerForSpan, pickWindow, STOCK_WINDOWS } from "./windows";
import type { FittedProgram, SpaceKind, YardProject } from "./types";
import { wantsShoes, isWorkbench, isSeatingLoungeClass, isLoungeChair, isRockingChair, isOttoman, type HouseFamily } from "./family";

export type { SpaceKind };

export type SpaceMeasurement = {
  widthIn: number;
  heightIn: number;
  depthIn?: number;
  kindHint?: SpaceKind;
  windowId?: string;
};

export { matchStockWindows as matchWindows } from "./windows";


/** Rewrite the prompt so Measure axes are the typed fact honesty will honor. */
export function stampPromptSize(prompt: string, w: number, h: number, d: number): string {
  let p = prompt.trim();
  if (!p) return `${w} wide ${h} high ${d} deep`;
  const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(n));
  const W = fmt(w);
  const H = fmt(h);
  const D = fmt(d);
  // Desks / writing desks speak unlabeled triples as W×D×H (casegoods), not opening W×H×D.
  const deskLike = /\b(?:writing\s+)?desk\b|\bworkbench\b/.test(p.toLowerCase());
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(wide|width)\b/i, `${W}$2$3`);
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(tall|high|height)\b/i, `${H}$2$3`);
  p = p.replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(deep|depth)\b/i, `${D}$2$3`);
  p = p.replace(
    /(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s+)((?:bathroom\s+)?alcove)\b/i,
    `${W}$2$3`,
  );
  // Typed opening width with adjectives between measure and noun — "31.5 inch linen closet".
  // Skip axis-labeled spans ("16 inch deep …") so Measure apply does not rewrite depth as width.
  p = p.replace(
    /(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s+)(?!(?:wide|width|deep|depth|tall|high|height|long|length)\b)((?:(?:bathroom|linen|utility|broom|coat|pantry|tall|storage|closet|wardrobe)\s+){0,3}(?:alcove|opening|niche|closet|wardrobe|pantry|cabinet|cupboard|armoire|hutch|locker|linen))\b/i,
    `${W}$2$3`,
  );
  // Bare desk width: "60\" desk …" / "desk 60\"" — keep W honest across Measure apply.
  if (deskLike) {
    p = p.replace(
      /(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s+)((?:writing\s+)?desk)\b/i,
      `${W}$2$3`,
    );
    p = p.replace(
      /\b((?:writing\s+)?desk\s+)(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?)(?!\s*(?:wide|width|deep|depth|tall|high|height|knee))/i,
      `$1${W}$3`,
    );
  }
  // Bare table span: "70 inch table" / "table 70\"" — Measure apply must not leave the 40" default.
  const tableLike = /\btable\b/.test(p.toLowerCase()) && !/\bwork table\b/.test(p.toLowerCase());
  if (tableLike) {
    p = p.replace(
      /(\d+(?:\.\d+)?)(\s*-?\s*(?:inches|inch(?![a-z])|in(?![a-z])|")\s+)(?!(?:wide|width|deep|depth|tall|high|height|long|length|dia|diameter|round)\b)((?:\S+\s+){0,6}?table\b)/i,
      `${W}$2$3`,
    );
    p = p.replace(
      /(\btable\s+(?:that(?:'s|\s+is)\s+|of\s+|about\s+)?)(\d+(?:\.\d+)?)(\s*-?\s*(?:inches|inch(?![a-z])|in(?![a-z])|"))(?!\s*(?:wide|width|deep|depth|tall|high|height|long|length|dia|diameter|round)\b)/i,
      `$1${W}$3`,
    );
  }
  p = p.replace(
    /(\d+(?:\.\d+)?)\s*(x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(x|by|×)\s*(\d+(?:\.\d+)?))?/i,
    (m: string, a: string, sep1: string, b: string, sep2?: string, c?: string) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (na <= 4 && nb <= 12 && (c == null || parseFloat(c) <= 16)) return m;
      // Desk casegoods: stamp W×D×H so re-parse does not swap H/D (unlike opening W×H×D).
      if (c) return deskLike ? `${W}${sep1}${D}${sep2}${H}` : `${W}${sep1}${H}${sep2}${D}`;
      return deskLike ? `${W}${sep1}${D}` : `${W}${sep1}${H}`;
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
  // Program / family first — alcove opening must not wipe Desk / Table / Media into Closet.
  const program = project.fitted?.program as FittedProgram | undefined;
  const family = project.fitted?.family as HouseFamily | undefined;
  const blob = `${project.name ?? ""} ${project.prompt ?? ""} ${project.fitted?.name ?? ""}`.toLowerCase();
  // Workbench / potting bench are standing shop tops — never collapse to Desk.
  if (isWorkbench(blob) || /\bworkbench\b/.test(blob) || /potting\s*bench/.test(blob)) return "workbench";
  if (program === "desk" || /\bdesk\b/.test(blob)) return "desk";
  if (program === "media" || /\btv\b|media console|entertainment\s*cent/.test(blob)) return "media";
  if (program === "table" || family === "table" || (/\btable\b/.test(blob) && !/work table/.test(blob))) return "table";
  // Seating lounge class — Measure type uses identity stems, never naked Bench.
  if (isRockingChair(blob) || /rocking\s*chair/.test(blob)) return "rocking_chair";
  if (isLoungeChair(blob) || /lounge\s*chair|easy\s*chair|club\s*chair/.test(blob)) return "lounge_chair";
  if (isOttoman(blob) || /\bottoman\b|\bpouf\b|foot\s*stool|footstool/.test(blob)) return "ottoman";
  if ((program === "bench" || family === "seat") && !isSeatingLoungeClass(blob)) return "bench";
  if (wantsShoes(blob) || /shoe rack/.test(blob)) return "shoe_rack";
  // Bookcase / wall cabinet keep their own labels — never leftover "Shelving niche".
  if (program === "bookcase") return "bookcase";
  if (family === "hung-cabinet" || /\bwall cabinet\b|hung cabinet/.test(blob)) return "wall_cabinet";
  if (family === "hung-open") return "shelving_alcove";
  if (program === "closet" || program === "vanity" || program === "wardrobe" || program === "pantry") {
    return "closet_niche";
  }
  // Known storage carcases (mudroom cubbies, dresser, crate…) — Closet / alcove, not General volume.
  if (
    program === "storage" &&
    (/mudroom|cubb|dresser|nightstand|bedside|crate|linen|alcove|closet|radiator|ironing|medicine|spice|wine/.test(blob) ||
      family === "floor-carcase" ||
      family === "straddle" ||
      family === "slab" ||
      family === "bunk")
  ) {
    return "closet_niche";
  }
  if (opening === "alcove" || opening === "pocket") return "closet_niche";
  return "general_volume";
}

export function framingNotes(roW: number, roH: number): string[] {
  const header = headerForSpan(roW);
  return [
    `Rough opening ${roW}" × ${roH}". Frame to the size you typed, or the unit's published RO.`,
    `Kings: two full-height studs, one each side.`,
    `Jacks: two trimmers supporting the header. The opening between them is ${roW}" wide.`,
    `Header: ${header.plies}-ply ${header.nominal}, ${header.length}" long (heuristic). A 2×6 wall takes 3 plies. Not stamped engineering.`,
    "Window: rough sill at the bottom of the opening, cripples under it. Door: cut the bottom plate — no sill.",
    "½\" plywood spacer between header plies so the pack matches the wall thickness.",
    "Wrap and pan-flash a window before the unit goes in.",
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
