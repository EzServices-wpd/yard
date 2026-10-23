/**
 * Block 1 — one shared hinged door / lid module.
 *
 * Every build that hangs a part on hinges (cabinet and closet doors, vanity, nightstand and medicine-cabinet
 * doors, chest and toy-box lids, coop roofs and pop doors, fold-down and ironing boards, crate doors) gets its
 * hinge type and count, clearance gap, latch, Buy lines with prices, hanging step and Operate markup here.
 * Families only say which part hangs from which edge; the rules below decide the hardware.
 * A hinged part is never screwed to its frame (supportGraph / placeEveryPart read `hinged`); only hinge screws go into it.
 */
import type { AssemblyStep, BuildPlan, Panel, PanelType, YardProject } from "./types";
import { createId } from "@/lib/utils";
import { isHingedLidChest, isLiftOffLidPrompt, isToyChest } from "./family";
import { isNoLidPrompt } from "./cueRules";
import { doorHingesLeft, isHingedLidPanel } from "./operateFaces";
import { getCatalogItem } from "./catalog";

type Bom = BuildPlan["bom"];
type BomLine = Bom[number];

/** Clearance gaps (inches): every edge of a leaf, between a pair of doors, and behind a lid at its hinge. */
export const LEAF_GAP = { reveal: 1 / 16, between: 1 / 8, lidBack: 1 / 8 } as const;

export type LeafRole = "door" | "lid";
export type HingeKind = "concealed" | "utility" | "butt" | "butt-galv" | "t-hinge" | "piano";
export type HingeEdge = NonNullable<Panel["hinged"]>["edge"];

export interface HingeSpec {
  kind: HingeKind;
  count: number;
  /** Heavy lids get a stay so they cannot slam. */
  stay: boolean;
  latch?: "barrel bolt";
}

/** Hardware prices (each, USD), checked against Home Depot / Amazon listings 2026-10. */
const HW: Record<HingeKind, { name: string; searchQuery: string; each: number; catalogId?: string }> = {
  concealed: { name: "Soft-close concealed cabinet hinges", searchQuery: "soft close concealed cabinet hinges", each: 4.495, catalogId: "cabinet-hinges" },
  utility: { name: '3" utility hinges', searchQuery: "3 inch utility hinges pair", each: 3.49 },
  butt: { name: '2" butt hinges', searchQuery: "2 inch butt hinge", each: 3, catalogId: "butt-hinge-2" },
  "butt-galv": { name: '2" galvanized butt hinges', searchQuery: "2 inch galvanized butt hinge exterior", each: 3.98, catalogId: "butt-hinge-2" },
  "t-hinge": { name: '4" galvanized T-hinges', searchQuery: "4 inch galvanized t hinge", each: 6.48 },
  piano: { name: "Piano hinge", searchQuery: "continuous piano hinge", each: 14.98, catalogId: "piano-hinge" },
};
const STAY = { each: 9.98 };
const BOLT = { each: 5.98 };

/** Rough leaf weight: plywood / softwood at ~0.02 lb per cubic inch. */
export function leafWeightLb(p: Pick<Panel, "size">): number {
  return p.size.width * p.size.height * p.size.depth * 0.02;
}

/**
 * Hinge type and count by size and weight.
 * Doors: concealed cabinet hinges, 2 up to 40" tall, 3 to 60", 4 above (a crate takes utility hinges and a bolt;
 * an outdoor door takes galvanized butts and a bolt). Lids: a piano hinge and a stay indoors; outdoors, T-hinges
 * with a stay once the lid passes 10 lb (2 up to 48" wide, 3 to 72", 4 above), else galvanized butts.
 */
export function hingeSpec(leaf: { role: LeafRole; w: number; h: number; t: number; outdoor?: boolean; crate?: boolean; count?: number }): HingeSpec {
  // Doors: 2 up to 40" tall, 3 to 60", 4 to 80", 5 above (hinge makers' 2 m band). Lids hinge along their width: 2 up to 48", 3 to 72", 4 above.
  const byLength = leaf.role === "door" ? (leaf.h <= 40 ? 2 : leaf.h <= 60 ? 3 : leaf.h <= 80 ? 4 : 5) : leaf.w <= 48 ? 2 : leaf.w <= 72 ? 3 : 4;
  if (leaf.role === "door") {
    if (leaf.crate) return { kind: "utility", count: 2, stay: false, latch: "barrel bolt" };
    if (leaf.outdoor) return { kind: "butt-galv", count: leaf.count ?? 2, stay: false, latch: "barrel bolt" };
    return { kind: "concealed", count: byLength, stay: false };
  }
  const lb = leafWeightLb({ size: { width: leaf.w, height: leaf.h, depth: leaf.t } });
  if (leaf.outdoor) return lb > 10 ? { kind: "t-hinge", count: leaf.count ?? byLength, stay: true } : { kind: "butt-galv", count: leaf.count ?? 2, stay: false };
  return { kind: "piano", count: 1, stay: true };
}

export interface Leaf {
  part: Panel;
  role: LeafRole;
  edge: HingeEdge;
  /** Hinge axis in model inches, two points along the hinge line. */
  axis: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }];
}

/** Lid-chest builds hang their Lid; "no lid" and lift-off lids hang nothing. */
export function hangsLid(project: YardProject): boolean {
  const prompt = (project.prompt ?? "").toLowerCase();
  const hasLid = project.panels.some((p) => /^Lid$/i.test(p.name));
  if (isLiftOffLidPrompt(prompt) || project.panels.some((p) => /^Lift-off lid$/i.test(p.name)) || isNoLidPrompt(prompt)) return false;
  return hasLid || isHingedLidChest(prompt) || isToyChest(prompt) || /hinged\s*lid/i.test(`${project.name} ${project.prompt ?? ""}`);
}

function axisOf(p: Panel, edge: HingeEdge): Leaf["axis"] {
  const { x, y, z } = p.position;
  const { width: w, height: h, depth: d } = p.size;
  switch (edge) {
    case "left": return [{ x, y, z }, { x, y: y + h, z }];
    case "right": return [{ x: x + w, y, z }, { x: x + w, y: y + h, z }];
    case "bottom": return [{ x, y, z }, { x: x + w, y, z }];
    case "top": return [{ x, y: y + h, z }, { x: x + w, y: y + h, z }];
    case "front": return [{ x, y: y + h, z }, { x: x + w, y: y + h, z }];
    default: return [{ x, y: y + h, z: z + d }, { x: x + w, y: y + h, z: z + d }];
  }
}

/** Every leaf on the model: parts that declare `hinged`, doors, and the hinged Lid of a chest. */
export function leavesOf(project: YardProject): Leaf[] {
  const out: Leaf[] = [];
  const lid = hangsLid(project);
  for (const p of project.panels) {
    let role: LeafRole | null = null;
    let edge: HingeEdge = "back";
    if (p.hinged) {
      edge = p.hinged.edge;
      role = edge === "left" || edge === "right" ? "door" : "lid";
    } else if (p.type === "door") {
      role = "door";
      edge = p.leaf ? p.leaf.hinge : doorHingesLeft(p) ? "left" : "right";
    } else if (lid && isHingedLidPanel(p)) {
      role = "lid";
    }
    if (role) out.push({ part: p, role, edge, axis: axisOf(p, edge) });
  }
  return out;
}

/** What decides the door hinges Buy lists: a crate hangs utility hinges, glue-only stock buys none. */
export function hingeContext(project: YardProject): { crate: boolean; screwless: boolean } {
  const crate = /crate/i.test(project.name) || /crate/.test((project.prompt ?? "").toLowerCase());
  const item = project.primaryMaterialId ? getCatalogItem(project.primaryMaterialId) : undefined;
  const joins = item?.preferredJoins ?? [];
  return { crate, screwless: joins.length > 0 && !joins.includes("screw") && !joins.includes("nail") };
}

/**
 * Hinge centres up from a leaf's bottom edge (inches): 3" in from the top and bottom (less on a leaf under 12"),
 * the rest evenly between. The Where line (placement.ts) and the bench model (panelHardware) read this one list.
 */
export function hingeCenters(h: number, count: number): number[] {
  const inset = h >= 12 ? 3 : Math.max(1.5, Math.round(h * 0.2 * 4) / 4);
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => inset + ((h - 2 * inset) * i) / (n - 1));
}

const layoutCache = new WeakMap<YardProject, Map<string, number[]>>();

/**
 * Row 207: every door hinge Buy lists, per door part id (hinge centres up from the door's bottom edge). hingedBuy sums
 * these counts and the bench draws exactly these hinges, so the model, the steps and Buy never disagree. Lids (piano
 * hinge, T-hinges) are not in it: the model draws no lid hinges yet.
 */
export function doorHingeLayout(project: YardProject, given?: { crate: boolean; screwless: boolean }): Map<string, number[]> {
  const hit = given ? undefined : layoutCache.get(project);
  if (hit) return hit;
  const ctx = given ?? hingeContext(project);
  const out = new Map<string, number[]>();
  const outdoor = /pressure-treated|exterior|galvan/i.test((project.notes ?? []).join(" "));
  for (const l of leavesOf(project)) {
    if (l.role !== "door") continue;
    const h = l.part.size.height;
    if (l.part.hinged) out.set(l.part.id, hingeCenters(h, specOfDeclared(l, outdoor).count));
    else if (!ctx.screwless) out.set(l.part.id, hingeCenters(h, ctx.crate ? 2 : hingeSpec({ role: "door", w: l.part.size.width, h, t: l.part.size.depth }).count));
  }
  if (!given) layoutCache.set(project, out);
  return out;
}

/** Operate hooks: attributes for the overview SVG group of one part (null for a part that does not swing). */
export function leafSvgAttrs(project: YardProject): (id: string) => Record<string, string> | null {
  const by = new Map(leavesOf(project).map((l) => [l.part.id, l]));
  return (id): Record<string, string> | null => {
    const l = by.get(id);
    if (!l) return { "data-part": id };
    const f = (n: number) => String(Math.round(n * 1000) / 1000);
    return {
      "data-part": id,
      "data-role": l.role,
      "data-hinge-edge": l.edge,
      "data-hinge-axis": l.axis.map((q) => `${f(q.x)},${f(q.y)},${f(q.z)}`).join(" "),
    };
  };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Buy lines for every leaf: hinges by kind, lid stays, latches and door pulls, with prices.
 * Lines already on the Buy list (a fold-down board's piano hinge) are not added twice.
 */
export function hingedBuy(project: YardProject, bom: Bom, ctx: { crate: boolean; screwless: boolean }): BomLine[] {
  const leaves = leavesOf(project);
  const have = () => bom.map((b) => b.name.toLowerCase()).join(" ") + " " + extra.map((b) => b.name.toLowerCase()).join(" ");
  const extra: BomLine[] = [];
  const doors = leaves.filter((l) => l.role === "door" && !l.part.hinged);
  // The one door-hinge source (row 207): the bench draws the same list.
  const layout = doorHingeLayout(project, ctx);
  if (doors.length && !ctx.screwless) {
    if (ctx.crate) {
      const pairs = Math.max(1, Math.ceil(doors.reduce((a, d) => a + (layout.get(d.part.id)?.length ?? 0), 0) / 2));
      extra.push({ name: HW.utility.name, quantity: pairs, unit: pairs === 1 ? "pair" : "pairs", searchQuery: HW.utility.searchQuery, estimatedCost: Math.round(6.98 * pairs * 100) / 100, notes: "Two hinges on the door, screwed into the left upright." });
      extra.push({ name: "Barrel bolt latch", quantity: 1, unit: "pc", searchQuery: "3 inch barrel bolt latch", estimatedCost: BOLT.each, notes: "Latch the door into the right upright so it stays shut." });
    } else {
      const each = doors.map((d) => layout.get(d.part.id)?.length ?? 0);
      const n = each.reduce((a, b) => a + b, 0);
      const pairs = Math.ceil(n / 2);
      extra.push({
        name: HW.concealed.name,
        quantity: pairs,
        unit: pairs === 1 ? "pair" : "pairs",
        catalogId: HW.concealed.catalogId,
        searchQuery: HW.concealed.searchQuery,
        estimatedCost: Math.round(HW.concealed.each * 2 * pairs * 100) / 100,
        notes: `${plural(n, "hinge")} for ${plural(doors.length, "door")} (${plural(pairs, "pair")}): 2 on a door up to 40" tall, 3 up to 60", 4 up to 80", 5 above. Hang each door with a 1/16" gap all round.`,
      });
      const pulls = doors.length + project.panels.filter((panel) => /drawer front/i.test(panel.name)).length;
      extra.push({
        name: "Cabinet bar pulls",
        quantity: Math.max(1, pulls),
        unit: pulls === 1 ? "pull" : "pulls",
        catalogId: "cabinet-bar-pulls",
        searchQuery: "cabinet bar pulls door handle",
        asin: "B09TVX1TWZ",
        estimatedCost: 2.6 * Math.max(1, pulls),
        notes: `One bar pull on each door or drawer (${plural(pulls, "pull")}).`,
      });
    }
  }
  // Leaves declared with `hinged` (coop roof, pop door): their kind follows from the spec the family stored.
  const declared = leaves.filter((l) => l.part.hinged);
  const tally = new Map<HingeKind, { n: number; where: string[] }>();
  let stays = 0;
  let bolts = 0;
  const outdoor = /pressure-treated|exterior|galvan/i.test((project.notes ?? []).join(" "));
  for (const l of declared) {
    const s = specOfDeclared(l, outdoor);
    const t = tally.get(s.kind) ?? { n: 0, where: [] };
    t.n += s.count;
    t.where.push(`${s.count} on the ${l.part.name.toLowerCase()}`);
    tally.set(s.kind, t);
    if (s.stay) stays++;
    if (s.latch) bolts++;
  }
  for (const [kind, t] of tally) {
    const hw = HW[kind];
    if (new RegExp(kind === "t-hinge" ? "t-hinge" : kind.startsWith("butt") ? "butt hinge" : hw.name, "i").test(have())) continue;
    extra.push({ name: hw.name, quantity: t.n, unit: "each", ...(hw.catalogId ? { catalogId: hw.catalogId } : {}), searchQuery: hw.searchQuery, estimatedCost: Math.round(hw.each * t.n * 100) / 100, notes: `${t.where.join(", ")}; strap on the leaf, leaf on the frame.` });
  }
  if (stays && !/lid stay|lid support/i.test(have())) {
    extra.push({ name: "Lid stay (soft-close or folding)", quantity: stays, unit: "each", searchQuery: "lid support stay hinge", estimatedCost: Math.round(8.98 * stays * 100) / 100, notes: "Holds the lid open and stops it slamming. Estimate." });
  }
  if (bolts && !/barrel bolt/i.test(have())) {
    extra.push({ name: '3" barrel bolts', quantity: bolts, unit: "each", searchQuery: "3 inch barrel bolt", estimatedCost: Math.round(BOLT.each * bolts * 100) / 100, notes: "One on the free edge of each door so it locks shut." });
  }
  // A chest's Lid (no `hinged` declared): piano hinge along the back plus a stay.
  const lids = leaves.filter((l) => l.role === "lid" && !l.part.hinged);
  const chestLid = lids.length > 0 || (hangsLid(project) && !declared.length);
  if (chestLid) {
    if (!/piano hinge/i.test(have())) {
      extra.push({ name: HW.piano.name, quantity: 1, unit: "pc", catalogId: HW.piano.catalogId, searchQuery: HW.piano.searchQuery, estimatedCost: HW.piano.each, notes: `Along the back edge of the lid · length ≈ ${project.overall.width}" (chest width). Long continuous hinge — not two butt hinges.` });
    }
    if (!/lid stay|lid support/i.test(have())) {
      extra.push({ name: "Lid stay / lid support", quantity: 1, unit: "pc", catalogId: "lid-stay", searchQuery: "toy chest lid support or lid stay", estimatedCost: STAY.each, notes: "Keeps the lid from slamming. Mount per the stay instructions — usually one side of the lid into the main box." });
    }
  }
  return extra;
}

/** A fold-down or ironing board hangs on a piano hinge along its bottom edge, its support leg on a short hinge. */
export function foldDownBuy(ironing: boolean): BomLine[] {
  return [
    { name: "Piano hinge", quantity: 1, unit: "pc", catalogId: "piano-hinge", searchQuery: "1-1/2 inch x 48 inch piano hinge continuous", estimatedCost: 14.98, notes: `Continuous hinge along the bottom edge of the ${ironing ? "ironing" : "fold-down"} board so it folds down.` },
    { name: "Support-leg hinge", quantity: 1, unit: "pc", catalogId: "utility-hinges", searchQuery: "narrow utility hinge 1-1/2 inch", estimatedCost: 3.48, notes: "Short hinge so the support leg kicks out to the floor when the board is down." },
  ];
}

function specOfDeclared(l: Leaf, outdoor: boolean): HingeSpec {
  const h = l.part.hinged!;
  if (h.kind) return { kind: h.kind, count: h.hinges, stay: !!h.stay, latch: h.latch === "barrel bolt" ? "barrel bolt" : undefined };
  const s = hingeSpec({ role: l.role, w: l.part.size.width, h: l.part.size.height, t: l.part.size.depth, outdoor, count: h.hinges });
  return { ...s, latch: h.latch === "barrel bolt" ? "barrel bolt" : undefined };
}

/** Plain words for a spec, for notes and steps. */
export function hingeWords(s: HingeSpec): string {
  const n = ["zero", "one", "two", "three", "four", "five", "six"][s.count] ?? String(s.count);
  switch (s.kind) {
    case "t-hinge": return `${n} 3–4" galvanized T-hinges`;
    case "butt-galv": return `${n} 2" galvanized butt hinges`;
    case "butt": return `${n} 2" butt hinges`;
    case "piano": return "a continuous piano hinge";
    case "utility": return `${n} 3" utility hinges`;
    default: return `${n} concealed cabinet hinges`;
  }
}

/** Declare a part as hung from another: stores the spec the rules chose, so Buy, notes and steps agree. */
export function hang(part: Panel, to: Panel, edge: HingeEdge, opts: { outdoor: boolean; latch?: "barrel bolt" }): HingeSpec {
  const role: LeafRole = edge === "left" || edge === "right" ? "door" : "lid";
  const s = hingeSpec({ role, w: part.size.width, h: part.size.height, t: part.size.depth, outdoor: opts.outdoor });
  const spec = { ...s, latch: opts.latch ?? (role === "door" ? s.latch : undefined) };
  part.hinged = { to: to.id, edge, hinges: spec.count, kind: spec.kind, stay: spec.stay, ...(spec.latch ? { latch: spec.latch } : {}) };
  return spec;
}

/**
 * The one hanging-step writer for every leaf (coop roof and pop door, chest lid, crate door, fold-down board).
 * Hinges first, then the stay and the latch; no screws go through the leaf.
 */
export function hangLeafStep(o: { name: string; lead?: string; spec: HingeSpec; edge: HingeEdge; to: string; extra?: string; gap?: boolean }): { title: string; description: string } {
  const s = o.spec;
  const name = o.name.toLowerCase();
  const fix = s.kind === "piano"
    ? `screw a piano hinge (one long continuous hinge, not two butt hinges) about as long as the ${name} along its ${o.edge} edge, into the ${o.to}`
    : `screw ${hingeWords(s)} along its ${o.edge} edge to the ${o.to}`;
  return {
    title: `Hang the ${name} on ${s.kind === "piano" ? "a piano hinge" : `${s.count} hinges`}${s.latch ? " and latch it" : ""}`,
    description: `${o.lead ? `${o.lead} ` : ""}Set the ${name} in place${o.gap === false ? "" : ` with a 1/16" gap all round`} and ${fix}.${s.stay ? ` Fit a lid stay (or a short chain) so the ${name} stays open and closes gently.` : ""} No screws go through the ${name} into anything else, so it opens.${s.latch ? ` Fit the ${s.latch} on its free edge so it locks shut.` : ""}${o.extra ? ` ${o.extra}` : ""}`,
  };
}

/** The hanging step for one part that declares `hinged`. */
export function hangStep(project: YardProject, p: Panel, extra = ""): { title: string; description: string; partsUsed: string[] } {
  const h = p.hinged!;
  const to = project.panels.find((x) => x.id === h.to)?.name.toLowerCase() ?? "its frame";
  const spec = specOfDeclared({ part: p, role: h.edge === "left" || h.edge === "right" ? "door" : "lid", edge: h.edge, axis: axisOf(p, h.edge) }, false);
  return { ...hangLeafStep({ name: p.name, spec, edge: h.edge, to, extra: extra.trim() || undefined }), partsUsed: [p.name] };
}

/** Concealed hinges for one door, from its height (2 to 40", 3 to 60", 4 above), spaced 3–4" from top and bottom. */
export function doorHingeCount(p: Pick<Panel, "size">): number {
  return hingeSpec({ role: "door", w: p.size.width, h: p.size.height, t: p.size.depth }).count;
}

/**
 * The shared step that hangs cabinet doors on concealed hinges (vanity, closet, nightstand, medicine cabinet,
 * built-ins). Title and text carry the per-door count the Buy list bought; `extra` adds a family's own words.
 */
export function hangDoorsStep(doors: Panel[], cutLine: (p: Panel) => string, opts: { overlay?: string; extra?: string; pulls?: boolean } = {}): { title: string; description: string } {
  const counts = doors.map(doorHingeCount);
  const total = counts.reduce((a, b) => a + b, 0);
  const same = counts.every((c) => c === counts[0]);
  const each = counts[0] ?? 2;
  const words = ["zero", "one", "Two", "Three", "Four", "Five"];
  const title = doors.length > 1
    ? `Hang ${doors.length} doors — ${same ? `${each} concealed hinges each` : `${total} concealed hinges`}`
    : `Hang the door — ${each} concealed hinges`;
  const per = doors.length > 1
    ? same ? `${words[each] ?? each} concealed hinges per door (${total} hinges total)` : `${total} concealed hinges in all (${counts.join(", ")} by door height)`
    : `${words[each] ?? each} concealed hinges (cup hinges that mount inside the door and carcase so you do not see them from the front)`;
  // The Where line (placement.ts) gives the measured hinge centres; this only says how they spread.
  const spread = each > 2 ? `, 3–4" from top and bottom, the others evenly spaced between` : `, 3–4" from top and bottom`;
  const lead = doors.length ? `${doors.map(cutLine).join("; ")}.` : "Door.";
  const overlay = opts.overlay ?? "Overlay the main box (the door sits on the face, not inside the opening).";
  const pulls = opts.pulls === false ? "" : doors.length > 1 ? " Screw one bar pull centered on each door." : " Screw one bar pull centered on the door.";
  return { title, description: `${lead} ${per}${spread}. Leave a 1/16" gap all round${doors.length > 1 ? " and 1/8\" between doors" : ""}. ${overlay}${opts.extra ? ` ${opts.extra}` : ""}${pulls} Open and close${doors.length > 1 ? " each door" : ""} — gaps even.` };
}

// ---- Door style: flat or Shaker (moved from face.ts) ----
// A Shaker door or chest front is cut as stiles, rails and a recessed panel; a flat one is a single slab.
export type DoorStyle = "flat" | "shaker";
const STILE = 2.25;
const GAP = 0.125;
/** A captured panel reaches 5/16" into its 3/8" groove. */
const CAP = 0.3125;
const r8 = (n: number) => Math.round(n * 8) / 8;

export function clonePanel(p: Panel): Panel {
  return {
    ...p,
    position: { ...p.position },
    size: { ...p.size },
    joints: p.joints?.map((j) => ({ ...j })),
    cutouts: p.cutouts?.map((c) => ({ ...c })),
    leaf: p.leaf ? { ...p.leaf } : undefined,
    blank: p.blank ? { ...p.blank } : undefined,
    polygon: p.polygon ? { ...p.polygon, pts: p.polygon.pts.map((pt) => [...pt] as [number, number]) } : undefined,
  };
}

export function makePanel(
  type: PanelType,
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId: string,
  extra: Partial<Panel> = {},
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    // Positions stay exact: a 1/16" reveal must survive; cut sizes read on the 1/8" grid.
    position: { x, y, z },
    size: { width: r8(w), height: r8(h), depth: r8(d) },
    materialId,
    ...extra,
  };
}

export function faceOk(w: number, h: number, t: number): boolean {
  const thin = Math.min(w, h, t);
  return Math.abs(t - thin) < 0.05 && t <= 1.75 && t >= 0.5 && w >= 8 && h >= 8 && w > STILE * 2 + 2 && h > STILE * 2 + 2;
}

export function hingeOf(p: Panel, doors: Panel[]): "left" | "right" {
  if (/left/i.test(p.name) && !/right/i.test(p.name)) return "left";
  if (/right/i.test(p.name)) return "right";
  if (doors.length === 1) return "left";
  return p.position.x + p.size.width / 2 < 0 ? "left" : "right";
}

/** Stiles and rails full thickness, panel half thickness, back edges flush. */
export function frameFace(
  p: Panel,
  names: { stile: string; rail: string; panel: string },
  hinge: "left" | "right" | null,
): Panel[] {
  const x = p.position.x;
  const y = p.position.y;
  const z = p.position.z;
  const w = p.size.width;
  const h = p.size.height;
  const t = p.size.depth;
  const mat = p.materialId;
  const panelT = r8(Math.min(0.375, t / 2));
  const innerW = r8(w - STILE * 2);
  const innerH = r8(h - STILE * 2);
  const pw = r8(innerW - GAP * 2);
  const ph = r8(innerH - GAP * 2);
  if (pw < 1.5 || ph < 1.5 || panelT < 0.25) return [p];

  const leafId = p.id;
  const hingeX = hinge === "right" ? x + w : x;
  const hingeZ = z + t / 2;
  const leaf = (role: "hinge" | "pull" | "part") =>
    hinge
      ? { id: leafId, hinge, hingeX, hingeZ, role }
      : undefined;

  const leftRole = hinge === "right" ? "pull" : hinge === "left" ? "hinge" : "part";
  const rightRole = hinge === "left" ? "pull" : hinge === "right" ? "hinge" : "part";
  const stileType = (role: "hinge" | "pull" | "part"): PanelType => (role === "hinge" ? "door" : "rail");

  const parts: Panel[] = [
    makePanel(stileType(leftRole), names.stile, x, y, z, STILE, h, t, mat, {
      leaf: leaf(leftRole),
      cutNote: '2 1/4" wide.',
    }),
    makePanel(stileType(rightRole), names.stile, x + w - STILE, y, z, STILE, h, t, mat, {
      leaf: leaf(rightRole),
      cutNote: '2 1/4" wide.',
    }),
    makePanel("rail", names.rail, x + STILE, y, z, innerW, STILE, t, mat, {
      leaf: leaf("part"),
      cutNote: '2 1/4" wide.',
    }),
    makePanel("rail", names.rail, x + STILE, y + h - STILE, z, innerW, STILE, t, mat, {
      leaf: leaf("part"),
      cutNote: '2 1/4" wide.',
    }),
    // The panel is 1/4" plywood captured in a 1/4" × 3/8" groove in the stiles and rails, 1/16" shy of the
    // groove bottom all round: never glued or screwed, so it floats.
    makePanel("rail", names.panel, x + STILE - CAP, y + STILE - CAP, z + (t - 0.25) / 2, r8(innerW + CAP * 2), r8(innerH + CAP * 2), 0.25, "plywood-1-4-4x8", {
      leaf: leaf("part"),
      cutNote: 'Sits in a 1/4" groove, 3/8" deep, in the stiles and rails. No glue or screws on the panel.',
    }),
  ];
  return parts;
}

export function shakerPanels(panels: Panel[]): { panels: Panel[]; changed: boolean } {
  const doors = panels.filter((p) => p.type === "door" && faceOk(p.size.width, p.size.height, p.size.depth) && !/shaker/i.test(p.name));
  const fronts = panels.filter(
    (p) => p.type === "rail" && p.name.trim().toLowerCase() === "front" && faceOk(p.size.width, p.size.height, p.size.depth),
  );
  if (!doors.length && !fronts.length) return { panels, changed: false };
  const drop = new Set<Panel>([...doors, ...fronts]);
  const next = panels.filter((p) => !drop.has(p));
  for (const door of doors) {
    next.push(
      ...frameFace(door, { stile: "Shaker stile", rail: "Shaker rail", panel: "Shaker panel" }, hingeOf(door, doors)),
    );
  }
  for (const front of fronts) {
    next.push(...frameFace(front, { stile: "Shaker stile", rail: "Shaker rail", panel: "Shaker panel" }, null));
  }
  return { panels: next, changed: true };
}

export type Box = { x: number; y: number; z: number; w: number; h: number; t: number; mat: string };


/** The assembled door of a frame-and-panel leaf: the box around every part sharing its leaf id. */
export function leafDoor(panels: Panel[], p: Panel): Panel {
  const parts = panels.filter((q) => q.leaf?.id === p.leaf?.id);
  const lo = (a: "x" | "y" | "z") => Math.min(...parts.map((q) => q.position[a]));
  const hi = (a: "x" | "y" | "z", k: "width" | "height" | "depth") => Math.max(...parts.map((q) => q.position[a] + q.size[k]));
  const position = { x: lo("x"), y: lo("y"), z: lo("z") };
  return { ...p, position, size: { width: hi("x", "width") - position.x, height: hi("y", "height") - position.y, depth: hi("z", "depth") - position.z } };
}

/** Frame-and-panel doors are glued up as one door before the step that hangs them. */
export function withLeafGlueUp(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const members = project.panels.filter((p) => p.leaf);
  if (!members.length) return steps;
  const names = new Set(members.map((p) => p.name));
  const at = steps.findIndex((s) => s.partsUsed?.some((n) => names.has(n)));
  if (at < 0) return steps;
  const leaves = new Set(members.map((p) => p.leaf!.id)).size;
  const kinds = [...names];
  const step: AssemblyStep = {
    step: 0,
    title: `Glue up the ${leaves} frame-and-panel door${leaves === 1 ? "" : "s"}`,
    description: `Each door is two stiles, two rails and a panel (${kinds.join(", ")}). Cut a 1/4" groove 3/8" deep along the inside edge of every stile and rail, centred on the thickness. Dry-fit, then glue only the stile-to-rail joints with the 1/4" plywood panel floating in the groove, never glued or screwed. Clamp each door flat and check it is square by measuring both diagonals. Let the glue cure before hanging.`,
    partsUsed: kinds,
  };
  // The hanging step places the whole leaf: its stiles, rails and panel go up as one door.
  const hang = { ...steps[at], partsUsed: [...new Set([...(steps[at].partsUsed ?? []), ...kinds])] };
  return [...steps.slice(0, at), step, hang, ...steps.slice(at + 1)].map((s, i) => ({ ...s, step: i + 1 }));
}


/**
 * Door leaves across one opening: a 1/16" reveal at the outer edges and 1/8" between leaves, each leaf the same width.
 * Every family that hangs doors over a box (vanity, nightstand, wall and base cabinets, medicine and ironing cabinets,
 * kennel, pocket uppers) lays its doors out with this, so the gaps and the hinge rules agree everywhere.
 */
export function doorLeaves(o: { x: number; w: number; count: number }): { x: number; w: number; name: string }[] {
  const n = Math.max(1, o.count);
  const w = (o.w - 2 * LEAF_GAP.reveal - (n - 1) * LEAF_GAP.between) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: o.x + LEAF_GAP.reveal + i * (w + LEAF_GAP.between),
    w,
    name: n === 1 ? "Door" : n === 2 ? (i === 0 ? "Left door" : "Right door") : `Door ${i + 1}`,
  }));
}

/** The same reveal top and bottom: a door's bottom edge and height inside an opening from `y` that is `h` tall. */
export function doorRise(y: number, h: number): { y: number; h: number } {
  return { y: y + LEAF_GAP.reveal, h: h - 2 * LEAF_GAP.reveal };
}
