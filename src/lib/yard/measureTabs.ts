/**
 * One Measure panel for every build. Tabs appear from the class of the model
 * (a hole, a fitted opening, shelves, drawers) — never from a noun list.
 */
import { inchFrac, parseInch } from "./inchText";
import type { JoinMethod, YardProject } from "./types";

export type MeasureTabId = "space" | "piece" | "inside" | "stock";

export type MeasureTab = { id: MeasureTabId; label: string };

export type MeasureFacts = {
  kind?: string;
  /** Fitted, pocket, or a recast of either — the build was made to a hole. */
  fitted?: boolean;
  pocket?: boolean;
  openingKind?: string;
  installMode?: string;
  oddKind?: string;
  corner?: boolean;
  program?: string;
  shape?: string;
  shelves?: number;
  cubbies?: number;
  drawers?: number;
  doors?: boolean;
  tiers?: number;
  /** Axes the person typed. An untyped axis is Yard's pick until they edit it. */
  typed?: { width?: boolean; height?: boolean; depth?: boolean };
};

const SPACE_OPENINGS = new Set(["alcove", "pocket", "window", "door"]);

/** A build that sits in a hole: alcove, pocket, closet, opening, wall run, under-stair, corner. A freestanding shelf or bench does not. */
export function fitsASpace(facts: MeasureFacts): boolean {
  if (facts.pocket || facts.corner) return true;
  if (facts.installMode === "alcove") return true;
  if (facts.openingKind && SPACE_OPENINGS.has(facts.openingKind)) return true;
  if (facts.oddKind === "sloped" || facts.oddKind === "wrap-opening" || facts.oddKind === "angled-corner" || facts.oddKind === "l-footprint") {
    return true;
  }
  if (facts.kind === "opening") return true;
  // A freestanding shelf, bench, table or desk is not a hole, even when the engine kind is closet.
  if (facts.program === "bookcase" || facts.program === "bench" || facts.program === "table" || facts.program === "desk") return false;
  if (facts.kind === "closet") return true;
  return false;
}

export function hasInside(facts: MeasureFacts): boolean {
  return (facts.shelves ?? 0) > 0 || (facts.cubbies ?? 0) > 1 || (facts.drawers ?? 0) > 0 || Boolean(facts.doors) || (facts.tiers ?? 0) > 1;
}

/** Every build gets Your piece and Stock and joints. Space and Inside appear only when they apply. */
export function measureTabs(facts: MeasureFacts): MeasureTab[] {
  const tabs: MeasureTab[] = [];
  if (fitsASpace(facts)) tabs.push({ id: "space", label: "Your space" });
  tabs.push({ id: "piece", label: "Your piece" });
  if (hasInside(facts)) tabs.push({ id: "inside", label: "Inside" });
  tabs.push({ id: "stock", label: "Stock and joints" });
  return tabs;
}

export function factsFromProject(project: YardProject): MeasureFacts {
  const pocket = project.pocket ?? project.recastFrom?.pocket;
  const fitted = project.fitted ?? project.recastFrom?.fitted;
  const unit = fitted?.unit;
  const shelves = project.panels.filter((p) => p.type === "shelf").length || unit?.shelfCount || 0;
  const drawers = project.panels.filter((p) => p.type === "drawer").length || (unit?.drawersPerBank ? unit.drawersPerBank * 2 : 0);
  const doors = project.panels.some((p) => p.type === "door") || Boolean(unit?.doors);
  return {
    kind: project.kind,
    fitted: Boolean(fitted),
    pocket: Boolean(pocket),
    openingKind: fitted?.opening.kind ?? project.opening?.kind,
    installMode: project.assumptions?.installMode,
    oddKind: unit?.odd?.kind,
    corner: Boolean(unit?.corner) || unit?.odd?.kind === "angled-corner",
    program: fitted?.program,
    shape: unit?.shape,
    shelves,
    cubbies: unit?.cubbies ?? 0,
    drawers,
    doors,
    tiers: unit?.corner?.tiers ?? 0,
    typed: fitted?.typedAxes,
  };
}

export type ClassPreset = { id: string; label: string; width?: number; height?: number; depth?: number };

/** Presets from the class, not from a product name. Seats and tables share seat heights; shelves share shelf heights. */
export function classPresets(facts: MeasureFacts): ClassPreset[] {
  const seat = facts.program === "bench" || facts.program === "table" || facts.program === "desk";
  if (seat) {
    return [
      { id: "kid", label: "Kid", height: 12 },
      { id: "adult", label: "Adult", height: 18 },
      { id: "bar", label: "Bar", height: 42 },
    ];
  }
  if (facts.program === "bookcase" || (facts.shelves ?? 0) > 0) {
    return [
      { id: "h30", label: "30\" tall", height: 30 },
      { id: "h48", label: "48\" tall", height: 48 },
      { id: "h72", label: "72\" tall", height: 72 },
    ];
  }
  return [];
}

/** Snap a typed size to the nearest 1/16". Half-typed text stays as typed so the field never closes. */
export function commitInch(raw: string): { text: string; inches: number; ready: boolean } {
  const inches = parseInch(raw);
  if (!Number.isFinite(inches)) return { text: raw, inches: NaN, ready: false };
  const snapped = Math.round(inches * 16) / 16;
  return { text: inchFrac(snapped), inches: snapped, ready: true };
}

export function yardsPick(typed: boolean | undefined, touched: boolean): boolean {
  return typed === false && !touched;
}

export type ClearanceTalk = { spare: number; line: string };

/** Default 1/8" a side. Positive when the piece fits, negative when the opening is tighter. */
export function clearanceTalk(opening: number, piece: number, perSide = 0.125): ClearanceTalk {
  if (!Number.isFinite(opening) || !Number.isFinite(piece) || opening <= 0 || piece <= 0) {
    return { spare: NaN, line: "" };
  }
  const spare = opening - piece - perSide * 2;
  const gap = inchFrac(Math.abs(spare));
  if (spare >= -1 / 32) return { spare, line: spare < 1 / 32 ? "fits flush" : `fits with ${gap}" to spare` };
  return { spare, line: `this opening is ${gap}" narrower than the piece` };
}

export type MeasureWarning = { id: string; text: string; fix: string };

export function measureWarnings(input: {
  shelfSpan?: number;
  hasDivider?: boolean;
  openingW?: number;
  pieceW?: number;
  clearance?: number;
}): MeasureWarning[] {
  const out: MeasureWarning[] = [];
  if ((input.shelfSpan ?? 0) >= 48 && !input.hasDivider) {
    const span = inchFrac(input.shelfSpan ?? 48);
    out.push({
      id: "span",
      text: `a ${span}" shelf needs a middle support; added one`,
      fix: "Add the support",
    });
  }
  const talk = clearanceTalk(input.openingW ?? NaN, input.pieceW ?? NaN, input.clearance ?? 0.125);
  if (Number.isFinite(talk.spare) && talk.spare < -1 / 32) {
    out.push({ id: "tight", text: talk.line, fix: "Shrink to fit" });
  }
  return out;
}

export function bayClearTalk(clearW: number, clearH: number, shoe = false): string {
  if (!Number.isFinite(clearW) || clearW <= 0) return "";
  const w = inchFrac(clearW);
  const h = Number.isFinite(clearH) && clearH > 0 ? inchFrac(clearH) : "";
  const fit = shoe && clearW >= 12 ? ", fits a size-12 shoe" : "";
  return h ? `each bay ${w}" wide × ${h}" clear${fit}` : `each bay ${w}" wide${fit}`;
}

/** Clear opening is the inner width: outer minus the two sides and every divider. */
export function clearOpening(outer: number, thickness: number, dividers: number): number {
  if (!Number.isFinite(outer) || outer <= 0) return NaN;
  const t = Number.isFinite(thickness) && thickness > 0 ? thickness : 0.75;
  return Math.max(0, outer - t * 2 - Math.max(0, dividers) * t);
}

export type ChangeSnap = { shelves: number; sheets: number; steps: number };

/** One line after a refit. Empty when nothing the person can see changed. */
export function changeLine(before: ChangeSnap, after: ChangeSnap): string {
  const parts: string[] = [];
  const dShelves = after.shelves - before.shelves;
  if (dShelves > 0) parts.push(`${dShelves} ${dShelves === 1 ? "shelf" : "shelves"} added`);
  else if (dShelves < 0) parts.push(`${-dShelves} ${dShelves === -1 ? "shelf" : "shelves"} removed`);
  const dSheets = after.sheets - before.sheets;
  if (dSheets > 0) parts.push(`Buy +${dSheets} ${dSheets === 1 ? "sheet" : "sheets"}`);
  else if (dSheets < 0) parts.push(`Buy ${dSheets} ${dSheets === -1 ? "sheet" : "sheets"}`);
  if (!parts.length && after.steps !== before.steps) parts.push("steps updated");
  return parts.join(", ");
}

/** Replace a spoken count, or add one. Keeps the noun and the stock. */
export function stampCount(prompt: string, noun: "shelves" | "cubbies" | "drawers", n: number): string {
  const re = new RegExp(String.raw`\b\d+\s+${noun}\b`, "i");
  if (re.test(prompt)) return prompt.replace(re, `${n} ${noun}`);
  const base = prompt.replace(/\s+$/, "").replace(/\.$/, "");
  return `${base} with ${n} ${noun}`;
}

/** The piece sits inside the opening. Default clearance is 1/8" a side, so the piece is 1/4" under the opening. */
export function pieceFromOpening(opening: number, clearance = 0.125): number {
  if (!Number.isFinite(opening) || opening <= 0) return NaN;
  const c = Number.isFinite(clearance) && clearance >= 0 ? clearance : 0.125;
  return Math.max(1, Math.round((opening - c * 2) * 16) / 16);
}

/** A class minimum, said next to the field. Never blocks. The fix is one tap. */
export function classSizeWarning(facts: MeasureFacts, width: number, depth: number): MeasureWarning | null {
  const seat = facts.program === "bench" || facts.program === "table" || facts.program === "desk";
  if (seat && Number.isFinite(width) && width > 0 && width < 12) {
    return {
      id: "narrow-seat",
      text: `a seat ${inchFrac(width)}" wide is hard to sit; 16" is a usable width`,
      fix: "Use 16\" wide",
    };
  }
  const shelf = facts.program === "bookcase" || (facts.shelves ?? 0) > 0;
  if (shelf && !seat && Number.isFinite(depth) && depth > 0 && depth < 8) {
    return {
      id: "shallow-shelf",
      text: `a shelf ${inchFrac(depth)}" deep holds little; 11" fits a paperback`,
      fix: "Use 11\" deep",
    };
  }
  return null;
}

/** House stock is sheet or board. Craft sticks, straws and edge banding are not vanity stock. */
export function stockFitsClass(name: string, facts: MeasureFacts): boolean {
  const craft = /popsicle|straw|edge band|banding/i.test(name);
  const house = facts.fitted || facts.pocket || facts.kind === "closet" || facts.kind === "opening" || facts.program === "vanity";
  return !(house && craft);
}

export function sheetCountOf(nest: { sheets: { totalSheets: number } | null; backer: { totalSheets: number } | null } | null | undefined): number {
  if (!nest) return 0;
  return (nest.sheets?.totalSheets ?? 0) + (nest.backer?.totalSheets ?? 0);
}

export const JOIN_CHOICES: { id: JoinMethod; label: string; changes: string }[] = [
  { id: "screw", label: "Screws", changes: "Buy lists cabinet screws; steps say drive them." },
  { id: "pin", label: "Dowels", changes: "Buy lists dowels; steps say glue and pin." },
  { id: "glue", label: "Glue", changes: "Screws drop off Buy; steps say glue the joints." },
  { id: "nail", label: "Nails", changes: "Buy lists nails; steps say nail the joints." },
  { id: "solvent", label: "Solvent", changes: "Buy lists cement; steps say cement the joints." },
];

/** Pocket-hole and biscuit are screw and glue in the joint model, said in plain words. */
export const JOIN_ALIASES: { id: string; label: string; join: JoinMethod; changes: string }[] = [
  { id: "pocket", label: "Pocket holes", join: "screw", changes: "Buy lists pocket-hole screws; steps say drive them." },
  { id: "biscuit", label: "Biscuits", join: "glue", changes: "Buy lists biscuits and glue; steps say glue the joints." },
];
