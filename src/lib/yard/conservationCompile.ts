/**
 * Shadow conservation check. After the other compiles have written cuts, packs,
 * fasteners, and assembly steps, this reads those artifacts and the part
 * geometry and recomputes whether the relationships still hold.
 *
 * It does not call the stock, fastener, or assembly compilers, and it does not
 * read a prompt, a live Buy quantity, or a live step as the answer. A copied
 * quantity that disagrees with a derived pack stays a disclosed gap. The live
 * engine does not read the ledger.
 *
 * Schema success is not design success. A graph can compile and still list gaps.
 */
import { isBoughtHardwareName } from "./boughtHardware";
import type { GraphJoint, GraphPart, YardBuildGraph } from "./buildContract";
import { getCatalogItem } from "./catalog";
import { isWholeStock } from "./geometry";
import { jointPattern } from "./jointLibrary";

export type ConservationCheck =
  | "cut-identity"
  | "joint-work"
  | "allocation"
  | "packs"
  | "invention"
  | "disclosed";

export type ConservationFinding = {
  id: string;
  check: ConservationCheck;
  /** holds: the relation is true. gap: it failed, or it is an honest difference left in the open. */
  status: "holds" | "gap";
  detail: string;
  subjects: string[];
};

export type ConservationLedger = {
  findings: ConservationFinding[];
};

/** The compiled fields this check reads. It does not take the ledger it is about to write. */
export type ConservationView = {
  model: {
    panels: readonly {
      id: string;
      name: string;
      type: string;
      materialId: string;
      position: { x: number; y: number; z: number };
      size: { width: number; height: number; depth: number };
    }[];
    members: readonly {
      id: string;
      catalogId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      cutLength?: number;
    }[];
  };
  steps: readonly {
    title: string;
    description: string;
    tips?: string;
    partsUsed: readonly string[];
    fastenersUsed?: readonly { id: string; qty: number }[];
  }[];
  buy: readonly { name: string; quantity: number; unit: string; catalogId?: string }[];
  fasteners: readonly { pair: string; patternId: string; screws: number }[];
  cuts: readonly {
    partId: string;
    materialId: string;
    lengthIn: number;
    widthIn: number;
    thicknessIn: number;
    kind: string;
  }[];
  packs: readonly {
    kind: string;
    catalogId: string;
    quantity: number;
    partIds: readonly string[];
  }[];
  assembly: readonly {
    step: number;
    kind: string;
    partIds: readonly string[];
    jointIds: readonly string[];
    machining?: string;
    hosts?: readonly string[];
    guests?: readonly string[];
    fasteners?: readonly { id: string; qty: number }[];
    hardware?: { qty: number };
  }[];
};

type Dims = { lengthIn: number; widthIn: number; thicknessIn: number };
type StockClass = "sheet" | "lumber" | "hardware" | "unknown" | "whole" | "not-sheet-or-lumber" | "no-size";
type Problem = { detail: string; subjects: string[] };

const END_TOL = 1 / 16;
const HOUSED_MAX = 0.8;
const MEET_EPS = 1e-9;
const SCREWS_IN_A_BOX = 50;

const MACHINING: Record<string, string> = {
  dado: "groove",
  rabbet: "rebate",
  lap: "half-lap",
  mortise: "mortise",
  miter: "miter",
  notch: "notch",
};

const CHECKS: ConservationCheck[] = ["cut-identity", "joint-work", "allocation", "packs", "invention"];

type PanelPart = Extract<GraphPart, { source: "panel" }>;
type Seat =
  | { kind: "host"; host: string; guest: string; machining: string }
  | { kind: "both"; parts: [string, string]; machining: string }
  | { kind: "unresolved"; machining: string }
  | { kind: "hang"; host: string; leaf: string }
  | { kind: "hang-unresolved" }
  | { kind: "fasten-only" };

const round8 = (n: number) => Math.round(n * 8) / 8;

function partName(part: GraphPart | undefined, id: string): string {
  if (!part) return id;
  return part.source === "panel" ? part.name : part.role;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function splitPair(pair: string): [string, string] | undefined {
  const cut = pair.indexOf("|");
  if (cut < 0) return undefined;
  return [pair.slice(0, cut), pair.slice(cut + 1)];
}

function hasId(parts: readonly GraphPart[], id: string | undefined): boolean {
  return id !== undefined && parts.some((part) => part.id === id);
}

function carcassScrewLine(line: { name: string; catalogId?: string }): boolean {
  if (line.catalogId === "screws-8" || line.catalogId === "outdoor-screws") return true;
  return /wood screws?/i.test(line.name);
}

function sheetFamily(materialId: string): string {
  return /^(?:plywood|mdf|chipboard|hardboard|osb)-.+-\d+x\d+$/.test(materialId)
    ? materialId.replace(/-\d+x\d+$/, "")
    : materialId;
}

function stockPieces(finished: number, stock: number): number {
  if (!(stock > 0) || !(finished > stock + 0.05)) return 1;
  return Math.max(2, Math.ceil((finished - 0.01) / stock));
}

function classify(part: GraphPart): StockClass {
  const name = partName(part, part.id);
  if (part.materialId === "hardware" || isBoughtHardwareName(name)) return "hardware";
  const item = getCatalogItem(part.materialId);
  if (!item) return "unknown";
  if (isWholeStock(item)) return "whole";
  if (item.canCut === false) return "not-sheet-or-lumber";
  if (item.category === "sheet_goods" || item.formFactor === "sheet") return "sheet";
  if (item.category === "lumber" || item.formFactor === "board") return "lumber";
  return "not-sheet-or-lumber";
}

function finishedDims(part: GraphPart): Dims | undefined {
  if (part.source === "panel" && part.blank) {
    const { lengthIn, widthIn, thicknessIn } = part.blank;
    if (!(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) return undefined;
    return { lengthIn: round8(lengthIn), widthIn: round8(widthIn), thicknessIn: round8(thicknessIn) };
  }
  let raw: [number, number, number] | undefined;
  if (part.source === "panel") raw = [part.size.width, part.size.height, part.size.depth];
  else {
    const item = getCatalogItem(part.materialId);
    const span = part.cutLength ?? (part.from && part.to
      ? Math.hypot(part.to.x - part.from.x, part.to.y - part.from.y, part.to.z - part.from.z)
      : undefined);
    const length = span ?? item?.dims.length ?? 0;
    const width = part.section?.width ?? item?.dims.width ?? item?.dims.diameter ?? 0;
    const thick = part.section?.height ?? item?.dims.thickness ?? item?.dims.height ?? item?.dims.diameter ?? 0;
    raw = [length, width, thick];
  }
  if (!raw || raw.some((n) => !(n > 0))) return undefined;
  const sorted = raw.map(round8).sort((a, b) => b - a);
  return { lengthIn: sorted[0], widthIn: sorted[1], thicknessIn: sorted[2] };
}

function partClass(part: GraphPart): StockClass {
  const kind = classify(part);
  if (kind !== "sheet" && kind !== "lumber") return kind;
  return finishedDims(part) ? kind : "no-size";
}

function boardCross(materialId: string): { face: number; thick: number } | undefined {
  const item = getCatalogItem(materialId);
  if (!item) return undefined;
  const a = item.dims.width ?? 0;
  const b = item.dims.height ?? item.dims.thickness ?? 0;
  const face = Math.max(a, b);
  const thick = Math.min(a, b) || b || a;
  if (!(face > 0) || !(thick > 0)) return undefined;
  return { face, thick };
}

function sheetThick(materialId: string): number | undefined {
  const thick = getCatalogItem(materialId)?.dims.thickness;
  return thick !== undefined && thick > 0 ? thick : undefined;
}

type AxisBox = { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] };

function axisBox(part: PanelPart): AxisBox {
  const size: [number, number, number] = [part.size.width, part.size.height, part.size.depth];
  return {
    min: [part.position.x, part.position.y, part.position.z],
    max: [part.position.x + size[0], part.position.y + size[1], part.position.z + size[2]],
    size,
  };
}

function axisAligned(part: GraphPart): part is PanelPart {
  return part.source === "panel" && !part.yaw && !part.polygon;
}

function overlapOn(a: AxisBox, b: AxisBox, axis: number): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

function faceAxes(box: AxisBox): number[] {
  const thin = Math.min(...box.size);
  return [0, 1, 2].filter((axis) => box.size[axis] - thin <= 1e-9);
}

function passesThroughFace(passer: AxisBox, board: AxisBox): boolean {
  for (const axis of faceAxes(board)) {
    const beyond = passer.min[axis] < board.min[axis] - END_TOL && passer.max[axis] > board.max[axis] + END_TOL;
    if (!beyond) continue;
    if ([0, 1, 2].every((other) => other === axis || overlapOn(passer, board, other) > MEET_EPS)) return true;
  }
  return false;
}

function endEnters(part: AxisBox, host: AxisBox, axis: number): boolean {
  const p0 = part.min[axis];
  const p1 = part.max[axis];
  const h0 = host.min[axis];
  const h1 = host.max[axis];
  const outLow = p0 < h0 - END_TOL;
  const outHigh = p1 > h1 + END_TOL;
  if (outLow === outHigh) return false;
  const buried = outHigh ? p0 : p1;
  return buried > h0 + END_TOL && buried < h1 - END_TOL;
}

type Burial = { outside: number };

function insertionOverlap(guest: GraphPart, host: GraphPart): Burial | undefined {
  if (!axisAligned(guest) || !axisAligned(host)) return undefined;
  const g = axisBox(guest);
  const h = axisBox(host);
  const thin = Math.min(...g.size);
  let best: Burial | undefined;
  for (const axis of [0, 1, 2]) {
    if (g.size[axis] - thin <= 1e-9) continue;
    const overlap = overlapOn(g, h, axis);
    if (!(overlap > END_TOL && overlap <= HOUSED_MAX)) continue;
    if (!endEnters(g, h, axis)) continue;
    if ([0, 1, 2].some((other) => other !== axis && overlapOn(g, h, other) <= END_TOL)) continue;
    const outside = g.size[axis] - overlap;
    if (!best || outside > best.outside) best = { outside };
  }
  return best;
}

type Pick = { pick: "one"; id: string } | { pick: "tie" } | { pick: "none" };
const TIE: Pick = { pick: "tie" };
const NONE: Pick = { pick: "none" };
const one = (id: string): Pick => ({ pick: "one", id });

function notchBoard(a: GraphPart, b: GraphPart): Pick {
  if (!axisAligned(a) || !axisAligned(b)) return NONE;
  const throughA = passesThroughFace(axisBox(b), axisBox(a));
  const throughB = passesThroughFace(axisBox(a), axisBox(b));
  if (throughA && throughB) return TIE;
  if (throughA) return one(a.id);
  if (throughB) return one(b.id);
  return NONE;
}

function notedNotch(a: GraphPart, b: GraphPart): Pick {
  const noted = [a, b].filter((part) => part.source === "panel" && /\bnotch(?:ed|es|ing)?\b/i.test(part.cutNote ?? ""));
  return noted.length === 1 ? one(noted[0].id) : NONE;
}

function housedGuest(a: GraphPart, b: GraphPart): Pick {
  const aInB = insertionOverlap(a, b);
  const bInA = insertionOverlap(b, a);
  if (!aInB && !bInA) return NONE;
  if (aInB && bInA) {
    if (Math.abs(aInB.outside - bInA.outside) <= 1e-9) return TIE;
    return one(aInB.outside > bInA.outside ? a.id : b.id);
  }
  return one(aInB ? a.id : b.id);
}

function declaredGuest(joints: readonly GraphJoint[], a: string, b: string): Pick {
  const guests = new Set(joints.filter((joint) => joint.basis === "declared" && joint.reading === undefined).map((joint) => joint.a));
  if (guests.size !== 1) return NONE;
  const guest = [...guests][0];
  return guest !== undefined && (guest === a || guest === b) ? one(guest) : NONE;
}

function hingeLeaf(joints: readonly GraphJoint[], a: GraphPart, b: GraphPart): Pick {
  if (a.source === "panel" && a.hinged?.to === b.id) return one(a.id);
  if (b.source === "panel" && b.hinged?.to === a.id) return one(b.id);
  const leaves = new Set(
    joints
      .filter((joint) => joint.patternId === "hinge" && (joint.basis === "declared" || joint.reading === "hinge-leaf"))
      .map((joint) => joint.a),
  );
  if (leaves.size !== 1) return NONE;
  const leaf = [...leaves][0];
  return leaf !== undefined && (leaf === a.id || leaf === b.id) ? one(leaf) : NONE;
}

type PairGroup = { pair: string; a: string; b: string; joints: GraphJoint[] };

function groupsOf(graph: YardBuildGraph): { groups: PairGroup[]; broken: Problem[] } {
  const map = new Map<string, PairGroup>();
  const broken: Problem[] = [];
  for (const joint of graph.joints) {
    if (!joint.reviewedJoin) continue;
    if (joint.a === joint.b) {
      broken.push({ detail: `Reviewed joint ${joint.id} names one part twice.`, subjects: [joint.id] });
      continue;
    }
    if (!hasId(graph.parts, joint.a) || !hasId(graph.parts, joint.b)) {
      broken.push({ detail: `Reviewed joint ${joint.id} names a part that is not on the graph.`, subjects: [joint.id] });
      continue;
    }
    const pair = pairKey(joint.a, joint.b);
    const existing = map.get(pair);
    if (existing) existing.joints.push(joint);
    else map.set(pair, { pair, a: joint.a, b: joint.b, joints: [joint] });
  }
  return { groups: [...map.values()].sort((a, b) => a.pair.localeCompare(b.pair)), broken };
}

function patternOf(joints: readonly GraphJoint[]): string {
  const ids = [...new Set(joints.map((joint) => joint.patternId).filter((id): id is string => id !== undefined))];
  return ids.find((id) => jointPattern(id)?.role === "shop") ?? ids[0] ?? "";
}

/**
 * Which part the boxes say is machined. The assembly step's host list is not an input.
 * A tie, or no reading, is unresolved. Contact never reaches this.
 */
function seatOf(group: PairGroup, byId: Map<string, GraphPart>): Seat {
  const patternId = patternOf(group.joints);
  const pattern = jointPattern(patternId);
  const a = byId.get(group.a);
  const b = byId.get(group.b);
  if (!a || !b || !pattern) return { kind: "fasten-only" };
  if (pattern.role === "hardware") {
    const leaf = hingeLeaf(group.joints, a, b);
    if (leaf.pick !== "one") return { kind: "hang-unresolved" };
    return { kind: "hang", host: leaf.id === group.a ? group.b : group.a, leaf: leaf.id };
  }
  const machining = MACHINING[patternId];
  if (!machining) return { kind: "fasten-only" };
  if (patternId === "lap" || patternId === "miter") return { kind: "both", parts: [group.a, group.b], machining };
  if (patternId === "notch") {
    const passed = notchBoard(a, b);
    if (passed.pick === "tie") return { kind: "unresolved", machining };
    const board = passed.pick === "one" ? passed : notedNotch(a, b);
    if (board.pick !== "one") return { kind: "unresolved", machining };
    return { kind: "host", host: board.id, guest: board.id === group.a ? group.b : group.a, machining };
  }
  const buried = housedGuest(a, b);
  if (buried.pick === "tie") return { kind: "unresolved", machining };
  const guest = buried.pick === "one" ? buried : declaredGuest(group.joints, group.a, group.b);
  if (guest.pick !== "one") return { kind: "unresolved", machining };
  return { kind: "host", host: guest.id === group.a ? group.b : group.a, guest: guest.id, machining };
}

function includesId(ids: readonly string[] | undefined, id: string): boolean {
  return ids !== undefined && ids.includes(id);
}

function sameVec(a: { x: number; y: number; z: number } | undefined, b: { x: number; y: number; z: number } | undefined): boolean {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function sameSize(a: { width: number; height: number; depth: number }, b: { width: number; height: number; depth: number }): boolean {
  return a.width === b.width && a.height === b.height && a.depth === b.depth;
}

function fitsSheet(length: number, width: number, sheetLength: number, sheetWidth: number): boolean {
  return (length <= sheetLength + 1e-6 && width <= sheetWidth + 1e-6)
    || (length <= sheetWidth + 1e-6 && width <= sheetLength + 1e-6);
}

function joinProblems(rows: Problem[]): { detail: string; subjects: string[] } {
  const subjects = [...new Set(rows.flatMap((row) => row.subjects))].sort();
  return { detail: rows.map((row) => row.detail).join(" "), subjects };
}

function summary(id: ConservationCheck, rows: Problem[], hold: string): ConservationFinding {
  if (!rows.length) return { id, check: id, status: "holds", detail: hold, subjects: [] };
  const joined = joinProblems(rows);
  return { id, check: id, status: "gap", detail: joined.detail, subjects: joined.subjects };
}

function cutIdentity(graph: YardBuildGraph, view: ConservationView, byId: Map<string, GraphPart>): Problem[] {
  const used = new Set(view.assembly.flatMap((step) => step.partIds));
  const modelIds = new Set([...view.model.panels.map((part) => part.id), ...view.model.members.map((part) => part.id)]);
  const problems: Problem[] = [];
  for (const cut of view.cuts) {
    const label = cut.partId === "" ? 'part ""' : cut.partId;
    if (!hasId(graph.parts, cut.partId)) {
      problems.push({ detail: `Derived cut ${label} has no graph part.`, subjects: [cut.partId] });
      continue;
    }
    if (!modelIds.has(cut.partId)) {
      problems.push({ detail: `Derived cut ${label} is not on the compiled model.`, subjects: [cut.partId] });
    }
    if (!used.has(cut.partId)) {
      problems.push({ detail: `Derived cut ${partName(byId.get(cut.partId), cut.partId)} has no assembly step.`, subjects: [cut.partId] });
    }
  }
  return problems;
}

function allocation(graph: YardBuildGraph, view: ConservationView): Problem[] {
  const problems: Problem[] = [];
  const byPart = new Map<string, ConservationView["cuts"][number][]>();
  for (const cut of view.cuts) {
    const list = byPart.get(cut.partId) ?? [];
    list.push(cut);
    byPart.set(cut.partId, list);
  }
  for (const part of graph.parts) {
    const kind = partClass(part);
    const cuts = byPart.get(part.id) ?? [];
    const name = partName(part, part.id);
    if (kind !== "sheet" && kind !== "lumber") {
      if (cuts.length) problems.push({ detail: `${name} is ${kind} and still has ${cuts.length} derived cuts.`, subjects: [part.id] });
      continue;
    }
    if (!cuts.length) {
      problems.push({ detail: `${name} is ${kind} stock and has no derived cut.`, subjects: [part.id] });
      continue;
    }
    const dims = finishedDims(part);
    if (!dims) continue;
    for (const cut of cuts) {
      if (cut.materialId !== part.materialId) {
        problems.push({ detail: `Cut of ${name} is ${cut.materialId}, not ${part.materialId}.`, subjects: [part.id] });
      }
      if (cut.kind !== kind) problems.push({ detail: `Cut of ${name} is marked ${cut.kind}, not ${kind}.`, subjects: [part.id] });
    }
    if (kind === "sheet") {
      const thick = sheetThick(part.materialId);
      if (thick === undefined) {
        problems.push({ detail: `${name} has no sheet thickness in the catalog.`, subjects: [part.id] });
        continue;
      }
      const layers = stockPieces(dims.thicknessIn, thick);
      const area = cuts.reduce((sum, cut) => sum + cut.lengthIn * cut.widthIn, 0);
      if (area + 0.5 < dims.lengthIn * dims.widthIn * layers) {
        problems.push({ detail: `Cuts of ${name} cover ${round8(area)} sq in, short of ${layers} × the finished face.`, subjects: [part.id] });
      }
      for (const cut of cuts) {
        if (cut.lengthIn > dims.lengthIn + 0.02 || cut.widthIn > dims.widthIn + 0.02) {
          problems.push({ detail: `A cut of ${name} is larger than the finished face.`, subjects: [part.id] });
          break;
        }
      }
    } else {
      const cross = boardCross(part.materialId);
      if (!cross) {
        problems.push({ detail: `${name} has no board section in the catalog.`, subjects: [part.id] });
        continue;
      }
      const layers = stockPieces(dims.thicknessIn, cross.thick);
      const strips = stockPieces(dims.widthIn, cross.face);
      const widthSum = cuts.reduce((sum, cut) => sum + cut.widthIn, 0);
      if (cuts.length < layers * strips) {
        problems.push({ detail: `${name} needs ${layers * strips} board cuts and has ${cuts.length}.`, subjects: [part.id] });
      }
      if (widthSum + 0.05 < dims.widthIn * layers) {
        problems.push({ detail: `Rips of ${name} sum to ${round8(widthSum)} in, short of the finished width.`, subjects: [part.id] });
      }
      for (const cut of cuts) {
        const long = Math.max(cut.lengthIn, cut.widthIn);
        if (long > dims.lengthIn + 0.02) {
          problems.push({ detail: `A rip of ${name} is longer than the part.`, subjects: [part.id] });
          break;
        }
      }
    }
  }
  for (const [partId, cuts] of byPart) {
    if (cuts.length && !hasId(graph.parts, partId)) {
      problems.push({ detail: `Derived cuts name ${partId === "" ? '""' : partId}, which is not a part.`, subjects: [partId] });
    }
  }
  return problems;
}

type PackGroup = { kind: "sheet" | "lumber"; key: string; cuts: ConservationView["cuts"][number][]; packs: ConservationView["packs"][number][] };

function packGroups(view: ConservationView): PackGroup[] {
  const map = new Map<string, PackGroup>();
  const groupFor = (kind: "sheet" | "lumber", materialId: string) => {
    const key = kind === "sheet" ? sheetFamily(materialId) : materialId;
    const id = `${kind}:${key}`;
    const existing = map.get(id);
    if (existing) return existing;
    const created: PackGroup = { kind, key, cuts: [], packs: [] };
    map.set(id, created);
    return created;
  };
  for (const cut of view.cuts) {
    if (cut.kind !== "sheet" && cut.kind !== "lumber") continue;
    groupFor(cut.kind, cut.materialId).cuts.push(cut);
  }
  for (const pack of view.packs) {
    if (pack.kind !== "sheet" && pack.kind !== "lumber") continue;
    groupFor(pack.kind, pack.catalogId).packs.push(pack);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function packCover(view: ConservationView): Problem[] {
  const problems: Problem[] = [];
  for (const group of packGroups(view)) {
    const label = group.key;
    const partIds = [...new Set(group.cuts.map((cut) => cut.partId))].sort();
    const named = [...new Set(group.packs.flatMap((pack) => pack.partIds))].sort();
    if (!group.packs.length) {
      problems.push({ detail: `No purchase pack covers ${partIds.length} ${label} cuts.`, subjects: partIds });
      continue;
    }
    if (!group.cuts.length) {
      problems.push({ detail: `Pack ${group.packs.map((pack) => pack.catalogId).join(", ")} has no derived cuts.`, subjects: group.packs.map((pack) => pack.catalogId) });
      continue;
    }
    for (const id of partIds) {
      if (!named.includes(id)) problems.push({ detail: `Packs of ${label} do not name cut part ${id === "" ? '""' : id}.`, subjects: [id] });
    }
    for (const id of named) {
      if (!partIds.includes(id)) problems.push({ detail: `Packs of ${label} name ${id === "" ? '""' : id}, which has no cut of that stock.`, subjects: [id] });
    }
    if (group.kind === "sheet") {
      const spans = group.packs.map((pack) => {
        const item = getCatalogItem(pack.catalogId);
        const length = item?.dims.length ?? 0;
        const width = item?.dims.width ?? 0;
        return { pack, length, width, area: Math.max(0, pack.quantity) * length * width };
      });
      if (spans.some((span) => !(span.length > 0) || !(span.width > 0))) {
        problems.push({ detail: `A ${label} pack has no sheet size in the catalog.`, subjects: [label] });
        continue;
      }
      const bought = spans.reduce((sum, span) => sum + span.area, 0);
      const need = group.cuts.reduce((sum, cut) => sum + cut.lengthIn * cut.widthIn, 0);
      if (need > bought + 0.5) {
        problems.push({ detail: `${label} cuts are ${round8(need)} sq in and the packs buy ${round8(bought)}.`, subjects: [label] });
      }
      for (const cut of group.cuts) {
        if (!spans.some((span) => span.pack.quantity > 0 && fitsSheet(cut.lengthIn, cut.widthIn, span.length, span.width))) {
          problems.push({ detail: `A ${label} cut ${cut.lengthIn}×${cut.widthIn} does not fit a purchased sheet.`, subjects: [cut.partId] });
          break;
        }
      }
    } else {
      const item = getCatalogItem(group.key);
      const stockLen = item?.dims.length ?? 0;
      if (!(stockLen > 0)) {
        problems.push({ detail: `${label} has no board length in the catalog.`, subjects: [label] });
        continue;
      }
      const inches = group.cuts.reduce((sum, cut) => sum + Math.max(cut.lengthIn, cut.widthIn), 0);
      const bought = group.packs.reduce((sum, pack) => sum + Math.max(0, pack.quantity) * stockLen, 0);
      if (inches > bought + 0.05) {
        problems.push({ detail: `${label} cuts are ${round8(inches)} in and the packs buy ${round8(bought)}.`, subjects: [label] });
      }
    }
  }
  return problems;
}

function jointWork(graph: YardBuildGraph, view: ConservationView, byId: Map<string, GraphPart>): Problem[] {
  const problems: Problem[] = [];
  const contactIds = new Set(graph.joints.filter((joint) => !joint.reviewedJoin).map((joint) => joint.id));
  for (const step of view.assembly) {
    if (step.kind !== "machine" && step.kind !== "fasten" && step.kind !== "hang") continue;
    for (const id of step.jointIds) {
      if (contactIds.has(id)) {
        problems.push({ detail: `Assembly step ${step.kind} uses joint ${id}. Contact is not a joint.`, subjects: [id] });
      }
    }
  }
  const { groups, broken } = groupsOf(graph);
  problems.push(...broken);
  const ledger = new Map(view.fasteners.map((row) => [row.pair, row]));
  for (const group of groups) {
    const seat = seatOf(group, byId);
    const jointIds = new Set(group.joints.map((joint) => joint.id));
    const steps = view.assembly.filter((step) => step.jointIds.some((id) => jointIds.has(id)));
    const machines = steps.filter((step) => step.kind === "machine");
    const fastens = steps.filter((step) => step.kind === "fasten");
    const hangs = steps.filter((step) => step.kind === "hang");
    const names = `${partName(byId.get(group.a), group.a)} / ${partName(byId.get(group.b), group.b)}`;
    if (seat.kind === "hang" || seat.kind === "hang-unresolved") {
      if (machines.length || fastens.length) {
        problems.push({ detail: `${names} is a hinge and also has a carcass machine or fasten step.`, subjects: [...jointIds] });
      }
      if (hangs.length !== 1) {
        problems.push({ detail: `${names} needs one hang step and has ${hangs.length}.`, subjects: [...jointIds] });
        continue;
      }
      const hang = hangs[0];
      if (seat.kind === "hang") {
        if (!includesId(hang.partIds, seat.host) || !includesId(hang.partIds, seat.leaf)) {
          problems.push({ detail: `Hang step for ${names} does not name the leaf and its carcass part.`, subjects: [seat.leaf, seat.host] });
        }
        if (hang.hosts !== undefined && !includesId(hang.hosts, seat.host)) {
          problems.push({ detail: `Hang step for ${names} does not seat ${partName(byId.get(seat.host), seat.host)}.`, subjects: [seat.host] });
        }
        const leaf = byId.get(seat.leaf);
        const recorded = leaf?.source === "panel" && typeof leaf.hinged?.hinges === "number" && leaf.hinged.hinges > 0
          ? leaf.hinged.hinges
          : undefined;
        if (recorded !== undefined && hang.hardware?.qty !== recorded) {
          problems.push({ detail: `Hang step for ${partName(leaf, seat.leaf)} records ${hang.hardware?.qty ?? 0} hinges; the leaf has ${recorded}.`, subjects: [seat.leaf] });
        }
        if (recorded === undefined && hang.hardware) {
          problems.push({ detail: `Hang step for ${names} invents a hinge count the leaf does not record.`, subjects: [seat.leaf] });
        }
      } else if (hang.hosts !== undefined && hang.hosts.length === 1) {
        problems.push({ detail: `Hang step for ${names} names a carcass part the leaf record does not.`, subjects: [...jointIds] });
      }
      const screws = (hang.fasteners ?? []).reduce((sum, use) => sum + use.qty, 0);
      if (screws > 0) problems.push({ detail: `Hang step for ${names} adds ${screws} carcass screws.`, subjects: [...jointIds] });
      continue;
    }
    if (hangs.length) problems.push({ detail: `${names} is not a hinge and has a hang step.`, subjects: [...jointIds] });
    if (fastens.length !== 1) {
      problems.push({ detail: `${names} needs one fasten step and has ${fastens.length}.`, subjects: [...jointIds] });
    } else {
      const fasten = fastens[0];
      if (!includesId(fasten.partIds, group.a) || !includesId(fasten.partIds, group.b)) {
        problems.push({ detail: `Fasten step for ${names} does not name both parts.`, subjects: [group.a, group.b] });
      }
      const qty = (fasten.fasteners ?? []).reduce((sum, use) => sum + use.qty, 0);
      const expected = ledger.get(group.pair)?.screws ?? 0;
      if (qty !== expected) {
        problems.push({ detail: `Fasten step for ${names} uses ${qty} screws; the ledger row is ${expected}.`, subjects: [group.pair] });
      }
      const machine = machines[0];
      if (machine && !(machine.step < fasten.step)) {
        problems.push({ detail: `Machining for ${names} does not precede fastening.`, subjects: [...jointIds] });
      }
    }
    if (seat.kind === "unresolved" || seat.kind === "fasten-only") {
      if (machines.length) {
        problems.push({ detail: `${names} has a machine step, and the boxes do not show a single machined part.`, subjects: [...jointIds] });
      }
      if (fastens.some((step) => step.hosts !== undefined && step.hosts.length === 1)) {
        problems.push({ detail: `${names} has a fasten step that names one machined part, and the boxes do not.`, subjects: [...jointIds] });
      }
      continue;
    }
    if (machines.length !== 1) {
      problems.push({ detail: `${names} needs one machine step and has ${machines.length}.`, subjects: [...jointIds] });
      continue;
    }
    const machine = machines[0];
    if (machine.machining !== seat.machining) {
      problems.push({ detail: `${names} is machined as ${machine.machining ?? "nothing"}, not ${seat.machining}.`, subjects: [...jointIds] });
    }
    if (seat.kind === "host") {
      if (!includesId(machine.partIds, seat.host)) {
        problems.push({ detail: `${partName(byId.get(seat.host), seat.host)} is the part the boxes machine for ${names}, and the machine step does not name it.`, subjects: [seat.host] });
      }
      if (includesId(machine.partIds, seat.guest) && !includesId(machine.partIds, seat.host)) {
        problems.push({ detail: `Machine step for ${names} cuts the guest.`, subjects: [seat.guest] });
      }
      if (machine.hosts !== undefined && (!includesId(machine.hosts, seat.host) || includesId(machine.hosts, seat.guest))) {
        problems.push({ detail: `Machine step for ${names} seats ${machine.hosts.join(", ") || "nobody"}, not ${partName(byId.get(seat.host), seat.host)}.`, subjects: [seat.host] });
      }
    } else if (!includesId(machine.partIds, seat.parts[0]) || !includesId(machine.partIds, seat.parts[1])) {
      problems.push({ detail: `${names} is machined on both parts, and the machine step does not name both.`, subjects: [...seat.parts] });
    }
  }
  return problems;
}

function invention(graph: YardBuildGraph, view: ConservationView): Problem[] {
  const problems: Problem[] = [];
  const panels = graph.parts.filter((part): part is PanelPart => part.source === "panel");
  const members = graph.parts.filter((part) => part.source === "member");
  if (view.model.panels.length !== panels.length || view.model.members.length !== members.length) {
    problems.push({
      detail: `Compiled model has ${view.model.panels.length} panels and ${view.model.members.length} members; the graph has ${panels.length} and ${members.length}.`,
      subjects: [],
    });
  }
  panels.forEach((part, index) => {
    const got = view.model.panels[index];
    if (!got || got.id !== part.id || got.name !== part.name || got.type !== part.type || got.materialId !== part.materialId
      || !sameVec(got.position, part.position) || !sameSize(got.size, part.size)) {
      problems.push({ detail: `Compiled panel ${partName(part, part.id)} does not match the graph part.`, subjects: [part.id] });
    }
  });
  members.forEach((part, index) => {
    const got = view.model.members[index];
    if (!got || got.id !== part.id || got.catalogId !== part.catalogId || got.cutLength !== part.cutLength
      || !sameVec(got.position, part.position) || !sameVec(got.rotation, part.rotation)) {
      problems.push({ detail: `Compiled member ${part.role} does not match the graph part.`, subjects: [part.id] });
    }
  });
  const known = new Set(graph.parts.map((part) => part.id));
  for (const cut of view.cuts) {
    if (!known.has(cut.partId)) {
      problems.push({ detail: `Derived cut names ${cut.partId === "" ? '""' : cut.partId}, which is not a part.`, subjects: [cut.partId] });
    }
  }
  for (const step of view.assembly) {
    for (const id of step.partIds) {
      if (!known.has(id)) problems.push({ detail: `Assembly step ${step.kind} names ${id === "" ? '""' : id}, which is not a part.`, subjects: [id] });
    }
    for (const id of step.jointIds) {
      if (!graph.joints.some((joint) => joint.id === id)) {
        problems.push({ detail: `Assembly step ${step.kind} names joint ${id}, which is not on the graph.`, subjects: [id] });
      }
    }
  }
  const shopPairs = new Set(
    graph.joints
      .filter((joint) => joint.reviewedJoin && jointPattern(joint.patternId ?? "")?.role === "shop" && joint.a !== joint.b && hasId(graph.parts, joint.a) && hasId(graph.parts, joint.b))
      .map((joint) => pairKey(joint.a, joint.b)),
  );
  const seenPairs = new Set<string>();
  for (const row of view.fasteners) {
    if (seenPairs.has(row.pair)) problems.push({ detail: `Fastener ledger repeats ${row.pair}.`, subjects: [row.pair] });
    seenPairs.add(row.pair);
    const ends = splitPair(row.pair);
    if (!ends || !shopPairs.has(row.pair)) {
      problems.push({ detail: `Fastener row ${row.pair || '""'} is not a reviewed shop pair.`, subjects: [row.pair] });
    }
  }
  const screws = view.fasteners.reduce((sum, row) => sum + (row.screws > 0 ? row.screws : 0), 0);
  const screwLines = view.buy.filter(carcassScrewLine);
  const boxes = screws > 0 ? Math.ceil(screws / SCREWS_IN_A_BOX) : 0;
  if (boxes === 0 && screwLines.length) {
    problems.push({ detail: `Compiled Buy has a carcass-screw line and the ledger has no screws.`, subjects: screwLines.map((line) => line.catalogId ?? line.name) });
  } else if (boxes > 0 && (screwLines.length !== 1 || screwLines[0]?.quantity !== boxes)) {
    problems.push({ detail: `Compiled Buy has ${screwLines.map((line) => line.quantity).join(", ") || "no"} carcass-screw boxes; the ledger is ${screws} screws.`, subjects: ["screws"] });
  }
  const ops = [...graph.operations].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (ops.length !== view.steps.length) {
    problems.push({ detail: `Compiled steps are ${view.steps.length}; the graph has ${ops.length} operations.`, subjects: [] });
  }
  ops.forEach((op, index) => {
    const step = view.steps[index];
    const uses = op.fastenersUsed?.map((use) => `${use.id}:${use.qty}`).join(",") ?? "";
    const got = step?.fastenersUsed?.map((use) => `${use.id}:${use.qty}`).join(",") ?? "";
    if (!step || step.title !== op.title || step.description !== op.description || (step.tips ?? "") !== (op.tips ?? "")
      || step.partsUsed.join("|") !== op.labels.join("|") || got !== uses) {
      problems.push({ detail: `Compiled step ${index + 1} does not match operation ${op.id}.`, subjects: [op.id] });
    }
  });
  const stockLines = graph.stock.filter((line) => !carcassScrewLine(line));
  const buyLines = view.buy.filter((line) => !carcassScrewLine(line));
  if (stockLines.length !== buyLines.length) {
    problems.push({ detail: `Compiled Buy has ${buyLines.length} non-screw lines; the graph stock has ${stockLines.length}.`, subjects: [] });
  }
  stockLines.forEach((line, index) => {
    const got = buyLines[index];
    if (!got || got.name !== line.name || got.quantity !== line.quantity || got.unit !== line.unit || got.catalogId !== line.catalogId) {
      problems.push({ detail: `Compiled Buy line ${index + 1} does not match stock ${line.id}.`, subjects: [line.id] });
    }
  });
  for (const pack of view.packs) {
    if (!getCatalogItem(pack.catalogId)) {
      problems.push({ detail: `Pack ${pack.catalogId} is not a catalog item.`, subjects: [pack.catalogId] });
    }
    for (const id of pack.partIds) {
      if (!known.has(id)) problems.push({ detail: `Pack ${pack.catalogId} names ${id === "" ? '""' : id}, which is not a part.`, subjects: [id] });
    }
  }
  return problems;
}

function titleClaims(part: GraphPart, title: string): boolean {
  const name = partName(part, part.id);
  if (name !== "" && title.toLowerCase().includes(name.toLowerCase())) return true;
  const role = part.role.toLowerCase();
  if (role === "") return false;
  if (new RegExp(`\\b${role}(?:es|s)?\\b`, "i").test(title)) return true;
  // shelf → shelves. The copied pin step uses the plural.
  return role.endsWith("f") && new RegExp(`\\b${role.slice(0, -1)}ves\\b`, "i").test(title);
}

function disclosed(graph: YardBuildGraph, view: ConservationView): ConservationFinding[] {
  const findings: ConservationFinding[] = [];
  const worked = new Set(
    view.assembly
      .filter((step) => step.kind === "machine" || step.kind === "fasten" || step.kind === "hang")
      .flatMap((step) => step.partIds),
  );
  const rebated = new Set(
    view.assembly.filter((step) => step.kind === "machine" && step.machining === "rebate").flatMap((step) => step.partIds),
  );
  for (const part of graph.parts) {
    if (part.source !== "panel" || part.type !== "back") continue;
    const rabbet = graph.joints.some((joint) => joint.reviewedJoin && joint.patternId === "rabbet" && (joint.a === part.id || joint.b === part.id));
    if (rabbet || rebated.has(part.id)) continue;
    findings.push({
      id: `disclosed:back:${part.id}`,
      check: "disclosed",
      status: "gap",
      detail: `${part.name || "Back"} is placed, not rebated. No reviewed joint cuts a rebate for it.`,
      subjects: [part.id],
    });
  }
  for (const op of graph.operations) {
    if (!/\b(?:pins?|pinned|fastens?|fastened|rebates?|rebated|rabbets?|screws?|screwed)\b/i.test(op.title)) continue;
    const claimed = graph.parts.filter((part) => op.partIds.includes(part.id) && titleClaims(part, op.title) && !worked.has(part.id));
    if (!claimed.length) continue;
    const names = claimed.map((part) => partName(part, part.id)).join(", ");
    findings.push({
      id: `disclosed:copied:${op.id}`,
      check: "disclosed",
      status: "gap",
      detail: `Copied step "${op.title}" says ${names} ${claimed.length === 1 ? "is" : "are"} pinned, fastened, or rebated. Derived assembly places ${claimed.length === 1 ? "it" : "them"} and does not fasten ${claimed.length === 1 ? "it" : "them"}.`,
      subjects: claimed.map((part) => part.id),
    });
  }
  for (const pack of view.packs) {
    const copied = graph.stock.filter((line) => line.catalogId === pack.catalogId);
    if (!copied.length || copied.every((line) => line.quantity === pack.quantity)) continue;
    const quoted = copied.map((line) => `${line.quantity} ${line.unit}`).join(", ");
    findings.push({
      id: `disclosed:pack:${pack.catalogId}`,
      check: "disclosed",
      status: "gap",
      detail: `Derived pack ${pack.catalogId} is ${pack.quantity}. The copied Buy line is ${quoted}. The copied quantity was not written onto the pack.`,
      subjects: [pack.catalogId],
    });
  }
  const wholeIds = [...new Set(graph.parts.filter((part) => partClass(part) === "whole").map((part) => part.materialId))].sort();
  for (const materialId of wholeIds) {
    const cuts = view.cuts.some((cut) => cut.materialId === materialId);
    const packs = view.packs.some((pack) => pack.catalogId === materialId);
    if (cuts || packs) continue;
    const copied = graph.stock.filter((line) => line.catalogId === materialId);
    const quoted = copied.length ? copied.map((line) => `${line.quantity} ${line.unit} ${line.name}`).join("; ") : "no copied Buy line";
    const count = graph.parts.filter((part) => part.materialId === materialId).length;
    findings.push({
      id: `disclosed:whole:${materialId}`,
      check: "disclosed",
      status: "gap",
      detail: `Whole craft stock ${materialId}: 0 derived cuts and 0 derived packs for ${count} ${count === 1 ? "part" : "parts"}. Copied Buy is ${quoted}. That quantity was not written into packs.`,
      subjects: [materialId],
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

function holdSentence(check: ConservationCheck, graph: YardBuildGraph, view: ConservationView): string {
  const contact = graph.joints.filter((joint) => !joint.reviewedJoin).length;
  const reviewed = graph.joints.filter((joint) => joint.reviewedJoin).length;
  if (check === "cut-identity") {
    return view.cuts.length
      ? `${view.cuts.length} derived ${view.cuts.length === 1 ? "cut names" : "cuts name"} a model part and an assembly step.`
      : "No derived cuts. Nothing to identify.";
  }
  if (check === "joint-work") {
    return reviewed
      ? `${reviewed} reviewed ${reviewed === 1 ? "joint has" : "joints have"} the machining or fastening the boxes require. ${contact} contact ${contact === 1 ? "pair is" : "pairs are"} not a joint.`
      : `No reviewed joints. ${contact} contact ${contact === 1 ? "pair is" : "pairs are"} not a joint.`;
  }
  if (check === "allocation") return "Derived cuts cover the finished sheet and lumber parts, and no other part is cut.";
  if (check === "packs") return view.cuts.length ? "Purchase packs cover the derived cuts by area or length, and they name those parts." : "No derived cuts, so no purchase pack is required.";
  return "Compiled parts, packs, fasteners, steps, and Buy lines trace to the graph.";
}

/**
 * Conservation ledger for one compiled build. Gaps are recorded. Nothing is rewritten
 * to match a copied Buy line or a copied step.
 */
export function compileConservation(graph: YardBuildGraph, view: ConservationView): ConservationLedger {
  const byId = new Map(graph.parts.map((part) => [part.id, part]));
  const rows: Record<ConservationCheck, Problem[]> = {
    "cut-identity": cutIdentity(graph, view, byId),
    "joint-work": jointWork(graph, view, byId),
    allocation: allocation(graph, view),
    packs: packCover(view),
    invention: invention(graph, view),
    disclosed: [],
  };
  const structural = CHECKS.map((check) => summary(check, rows[check], holdSentence(check, graph, view)));
  return { findings: [...structural, ...disclosed(graph, view)] };
}
