/**
 * Shadow assembly compile. Derives an order and the machining and fastening
 * steps reviewed joints imply.
 *
 * The order is a topological walk: a housed end waits for the part it enters,
 * a hinge leaf waits for its carcass part, and parts that share a drawer or a
 * leaf stay together. Ties go by position, then id. Contact is not a joint and
 * adds no step.
 *
 * Screw counts are the fastener ledger's. This file does not recount them and
 * does not read a prompt, a live step, or a Buy quantity. report.ts is not a
 * caller and is not called. The screw finder's short overlap cutoff is not
 * used. A housed end is seated by the construction band: more than 1/16" and
 * at most 0.8" inside a face.
 */
import type { GraphJoint, GraphPart, YardBuildGraph } from "./buildContract";
import { jointPattern } from "./jointLibrary";

export type AssemblyKind = "prepare" | "machine" | "fasten" | "hang" | "place" | "group";

export type AssemblyMachining = "groove" | "rebate" | "half-lap" | "mortise" | "miter" | "notch";

export type AssemblyNoScrew =
  | "hardware"
  | "planed"
  | "thin-sheet"
  | "thin-not-sheet"
  | "member"
  | "glue-stock"
  | "hinge"
  | "no-ledger-row";

export type DerivedAssemblyStep = {
  step: number;
  kind: AssemblyKind;
  id: string;
  title: string;
  detail: string;
  partIds: string[];
  jointIds: string[];
  /** Set when every part on the step shares one drawer or leaf. */
  subassemblyId?: string;
  machining?: AssemblyMachining;
  /**
   * host: one part is machined or carries the hinge.
   * both: a lap or a miter, machined on both parts.
   * unresolved: the boxes and the declaration do not say which part is housed.
   */
  seat?: "host" | "both" | "unresolved";
  hosts?: string[];
  guests?: string[];
  /** Piece counts from the fastener ledger. Absent when that row is zero. */
  fasteners?: { id: string; qty: number }[];
  noScrew?: AssemblyNoScrew;
  /** Hinge count copied off the leaf, when the part records one. Not a carcass screw. */
  hardware?: { kind: "hinge"; qty: number };
};

export type AssemblyLedgerRow = {
  pair: string;
  patternId: string;
  screws: number;
  noScrew?: "hardware" | "planed" | "thin-sheet" | "thin-not-sheet" | "member";
};

export type AssemblyInputs = {
  /** Derived cuts. The count is the cut list; a part that is ripped is still one part. */
  cuts: readonly { partId: string }[];
  /** One row per physical reviewed shop pair. */
  fasteners: readonly AssemblyLedgerRow[];
  /** Screw item for every positive ledger row. The same id the fastener Buy line uses. */
  fastenerId?: string;
  /** Why the stock compile cut nothing, when it said so. */
  stockDisclosure?: string;
};

type Group = { pair: string; a: string; b: string; joints: GraphJoint[] };

type Seat =
  | { kind: "host"; host: string; guest: string; machining: AssemblyMachining; patternId: string }
  | { kind: "both"; parts: [string, string]; machining: AssemblyMachining; patternId: string }
  | { kind: "unresolved"; parts: [string, string]; machining: AssemblyMachining; patternId: string }
  | { kind: "hang"; host: string; leaf: string; patternId: string }
  | { kind: "hang-unresolved"; parts: [string, string]; patternId: string }
  | { kind: "unknown"; parts: [string, string]; patternId: string };

type Draft = Omit<DerivedAssemblyStep, "step"> & { at: number };

const END_TOL = 1 / 16;
const HOUSED_MAX = 0.8;

const MACHINING: Record<string, AssemblyMachining> = {
  dado: "groove",
  rabbet: "rebate",
  lap: "half-lap",
  mortise: "mortise",
  miter: "miter",
  notch: "notch",
};

const MACHINE_TITLE: Record<AssemblyMachining, string> = {
  groove: "Machine groove",
  rebate: "Machine rebate",
  "half-lap": "Machine half-lap",
  mortise: "Machine mortise",
  miter: "Machine miter",
  notch: "Machine notch",
};

const FASTEN_TITLE: Record<string, string> = {
  dado: "Fasten dado",
  rabbet: "Fasten rabbet",
  lap: "Fasten lap",
  mortise: "Fasten mortise",
  miter: "Fasten miter",
  notch: "Fasten notch",
};

const KIND_RANK: Record<string, number> = { machine: 0, hang: 1, fasten: 2 };

function defined<T extends Record<string, unknown>>(row: T): T {
  const out = {} as T;
  for (const key of Object.keys(row) as (keyof T)[]) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function partName(part: GraphPart | undefined, id: string): string {
  if (!part) return id;
  return part.source === "panel" ? part.name : part.role;
}

type AxisBox = { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] };

function axisBox(part: Extract<GraphPart, { source: "panel" }>): AxisBox {
  const size: [number, number, number] = [part.size.width, part.size.height, part.size.depth];
  return {
    min: [part.position.x, part.position.y, part.position.z],
    max: [part.position.x + size[0], part.position.y + size[1], part.position.z + size[2]],
    size,
  };
}

function overlapOn(a: AxisBox, b: AxisBox, axis: number): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

/** One end of `part` sits inside `host`, and the part leaves through only the other face. */
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

function axisAligned(part: GraphPart): part is Extract<GraphPart, { source: "panel" }> {
  return part.source === "panel" && !part.yaw && !part.polygon;
}

type Burial = { overlap: number; outside: number };

/**
 * How far `guest` is buried in `host`, and how far the guest keeps running past that face.
 * Undefined when the boxes do not show an end in a face. The part's own thickness is not an end.
 */
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
    if (!best || outside > best.outside) best = { overlap, outside };
  }
  return best;
}

/**
 * The part that runs out of the joint. A face that only pokes into the other board
 * is the host. Equal runs are not a guess, and a declaration must not break the tie.
 */
function housedGuest(a: GraphPart, b: GraphPart): string | undefined | "tie" {
  const aInB = insertionOverlap(a, b);
  const bInA = insertionOverlap(b, a);
  if (!aInB && !bInA) return undefined;
  if (aInB && bInA) {
    if (Math.abs(aInB.outside - bInA.outside) <= 1e-9) return "tie";
    return aInB.outside > bInA.outside ? a.id : b.id;
  }
  return aInB ? a.id : b.id;
}

/**
 * Panel.joints records the part that is let into the other as joint.a.
 * A reading does not. Opposite declarations on one pair are not a guess.
 */
function declaredGuest(group: Group): string | undefined {
  const guests = new Set(group.joints.filter((joint) => joint.basis === "declared" && !joint.reading).map((joint) => joint.a));
  if (guests.size !== 1) return undefined;
  const guest = [...guests][0];
  return guest === group.a || guest === group.b ? guest : undefined;
}

function hingeLeaf(group: Group, a: GraphPart, b: GraphPart): string | undefined {
  if (a.source === "panel" && a.hinged?.to === b.id) return a.id;
  if (b.source === "panel" && b.hinged?.to === a.id) return b.id;
  const leaves = new Set(
    group.joints
      .filter((joint) => joint.patternId === "hinge" && (joint.basis === "declared" || joint.reading === "hinge-leaf"))
      .map((joint) => joint.a),
  );
  if (leaves.size !== 1) return undefined;
  const leaf = [...leaves][0];
  return leaf === a.id || leaf === b.id ? leaf : undefined;
}

function hingeCount(part: GraphPart | undefined): number | undefined {
  if (!part || part.source !== "panel") return undefined;
  const count = part.hinged?.hinges;
  return typeof count === "number" && count > 0 ? count : undefined;
}

function rawSubassembly(part: GraphPart): string | undefined {
  if (part.source !== "panel") return undefined;
  if (part.drawerId) return `drawer:${part.drawerId}`;
  if (part.leaf?.id) return `leaf:${part.leaf.id}`;
  return undefined;
}

function placeKey(part: GraphPart): [number, number, number, string] {
  const at = part.source === "panel" ? part.position : (part.from ?? part.position);
  return [at.y, at.x, at.z, part.id];
}

function comparePlace(byId: Map<string, GraphPart>, a: string, b: string): number {
  const [ay, ax, az, aid] = placeKey(byId.get(a)!);
  const [by, bx, bz, bid] = placeKey(byId.get(b)!);
  if (ay !== by) return ay - by;
  if (ax !== bx) return ax - bx;
  if (az !== bz) return az - bz;
  return aid < bid ? -1 : aid > bid ? 1 : 0;
}

function inOrder(ids: readonly string[], indexOf: Map<string, number>): string[] {
  return [...new Set(ids)].sort((a, b) => (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0) || a.localeCompare(b));
}

function sharedSubassembly(ids: readonly string[], subOf: Map<string, string>): string | undefined {
  const idsOf = [...new Set(ids)];
  if (!idsOf.length) return undefined;
  const sub = subOf.get(idsOf[0]);
  if (!sub || idsOf.some((id) => subOf.get(id) !== sub)) return undefined;
  return sub;
}

function primaryPattern(group: Group): { patternId: string; extra: string[] } {
  const ids = [...new Set(group.joints.map((joint) => joint.patternId).filter((id): id is string => !!id))];
  const shop = ids.find((id) => jointPattern(id)?.role === "shop");
  const patternId = shop ?? ids[0] ?? "";
  return { patternId, extra: ids.filter((id) => id !== patternId) };
}

function seatOf(group: Group, byId: Map<string, GraphPart>): Seat {
  const { patternId } = primaryPattern(group);
  const pattern = jointPattern(patternId);
  const a = byId.get(group.a)!;
  const b = byId.get(group.b)!;
  const parts: [string, string] = [group.a, group.b];
  if (!pattern) return { kind: "unknown", parts, patternId };
  if (pattern.role === "hardware") {
    const leaf = hingeLeaf(group, a, b);
    if (!leaf) return { kind: "hang-unresolved", parts, patternId };
    return { kind: "hang", host: leaf === group.a ? group.b : group.a, leaf, patternId };
  }
  const machining = MACHINING[patternId];
  if (!machining) return { kind: "unknown", parts, patternId };
  if (patternId === "lap" || patternId === "miter") return { kind: "both", parts, machining, patternId };
  const buried = housedGuest(a, b);
  if (buried === "tie") return { kind: "unresolved", parts, machining, patternId };
  const guest = buried ?? declaredGuest(group);
  if (!guest) return { kind: "unresolved", parts, machining, patternId };
  return { kind: "host", host: guest === group.a ? group.b : group.a, guest, machining, patternId };
}

function groupsOf(graph: YardBuildGraph, byId: Map<string, GraphPart>, gaps: string[]): Group[] {
  const map = new Map<string, Group>();
  for (const joint of graph.joints) {
    if (!joint.reviewedJoin) continue;
    if (joint.a === joint.b) {
      gaps.push(`Joint ${joint.id} names one part twice and is not an assembly step.`);
      continue;
    }
    if (!byId.has(joint.a) || !byId.has(joint.b)) {
      gaps.push(`Joint ${joint.id} names a part that is not on the graph and is not an assembly step.`);
      continue;
    }
    const pair = pairKey(joint.a, joint.b);
    const existing = map.get(pair);
    if (existing) existing.joints.push(joint);
    else map.set(pair, { pair, a: joint.a, b: joint.b, joints: [joint] });
  }
  for (const group of map.values()) group.joints.sort((a, b) => a.id.localeCompare(b.id));
  return [...map.values()].sort((a, b) => a.pair.localeCompare(b.pair));
}

function orderParts(
  parts: readonly GraphPart[],
  edges: Map<string, Set<string>>,
  subOf: Map<string, string>,
  subCounts: Map<string, number>,
  compare: (a: string, b: string) => number,
): { order: string[]; cyclic: string[] } {
  const indegree = new Map(parts.map((part) => [part.id, 0]));
  for (const tos of edges.values()) {
    for (const to of tos) indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }
  let ready = parts.filter((part) => (indegree.get(part.id) ?? 0) === 0).map((part) => part.id);
  const order: string[] = [];
  const seen = new Map<string, number>();
  let open: string | undefined;
  while (ready.length) {
    const prefer = open ? ready.filter((id) => subOf.get(id) === open) : [];
    const choice = (prefer.length ? prefer : ready).slice().sort(compare)[0];
    ready = ready.filter((id) => id !== choice);
    order.push(choice);
    const sub = subOf.get(choice);
    if (sub) {
      const count = (seen.get(sub) ?? 0) + 1;
      seen.set(sub, count);
      open = count < (subCounts.get(sub) ?? 0) ? sub : undefined;
    } else open = undefined;
    for (const next of edges.get(choice) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) ready.push(next);
    }
  }
  const placed = new Set(order);
  const cyclic = parts.map((part) => part.id).filter((id) => !placed.has(id)).sort(compare);
  return { order: [...order, ...cyclic], cyclic };
}

function splitSubassemblies(order: readonly string[], subOf: Map<string, string>): string[] {
  const last = new Map<string, number>();
  const seen = new Set<string>();
  const splits: string[] = [];
  order.forEach((id, index) => {
    const sub = subOf.get(id);
    if (!sub) return;
    const prev = last.get(sub);
    if (prev !== undefined && index !== prev + 1 && !seen.has(sub)) {
      splits.push(sub);
      seen.add(sub);
    }
    last.set(sub, index);
  });
  return splits;
}

function screwFields(
  row: AssemblyLedgerRow | undefined,
  fastenerId: string | undefined,
  ledgerEmpty: boolean,
): { fasteners?: { id: string; qty: number }[]; noScrew?: AssemblyNoScrew; sentence: string; missingId: boolean } {
  if (row && row.screws > 0) {
    if (!fastenerId) {
      return { sentence: `${row.screws} screws are on the ledger row and no screw item was given.`, missingId: true };
    }
    return {
      fasteners: [{ id: fastenerId, qty: row.screws }],
      sentence: `${row.screws} ${fastenerId}. The count is that pair's fastener ledger row.`,
      missingId: false,
    };
  }
  if (row) {
    const why = row.noScrew ? ` (${row.noScrew})` : "";
    return { noScrew: row.noScrew, sentence: `No carcass screws${why}.`, missingId: false };
  }
  if (ledgerEmpty) return { noScrew: "glue-stock", sentence: "The fastener ledger is empty, so no carcass screws are derived.", missingId: false };
  return { noScrew: "no-ledger-row", sentence: "The fastener ledger has no row for this pair.", missingId: false };
}

function prepareStep(order: readonly string[], cuts: readonly { partId: string }[], stockDisclosure: string | undefined): Draft {
  const cutIds = new Set(cuts.map((cut) => cut.partId));
  const partIds = order.filter((id) => cutIds.has(id));
  for (const id of cutIds) if (!partIds.includes(id)) partIds.push(id);
  const noun = cuts.length === 1 ? "cut" : "cuts";
  const partNoun = partIds.length === 1 ? "part" : "parts";
  const detail = cuts.length
    ? [`${cuts.length} derived ${noun} for ${partIds.length} ${partNoun}. The pieces are the stock compile's cuts.`, stockDisclosure]
      .filter(Boolean)
      .join(" ")
    : (stockDisclosure ?? "No cuttable sheet or lumber parts.");
  return {
    at: -1,
    kind: "prepare",
    id: "prepare",
    title: cuts.length ? "Cut derived pieces" : "No derived cuts",
    detail,
    partIds,
    jointIds: [],
  };
}

function machineDetail(seat: Extract<Seat, { kind: "host" | "both" | "unresolved" }>, names: (id: string) => string, jointIds: string[]): string {
  const listed = jointIds.join(", ");
  const word = MACHINE_TITLE[seat.machining].slice("Machine ".length);
  if (seat.kind === "host") {
    return `${word} in ${names(seat.host)} for ${listed} (${seat.patternId}). ${names(seat.guest)} is fastened after this.`;
  }
  if (seat.kind === "both") {
    return `${word} on ${seat.parts.map(names).join(" and ")} for ${listed} (${seat.patternId}). Both parts are machined, then fastened.`;
  }
  return `The boxes do not show which part is housed for ${listed} (${seat.patternId}). Both parts are machined before the joint is fastened.`;
}

/**
 * Assembly steps for one graph. `inputs.cuts` and `inputs.fasteners` are the
 * compiles already derived from the same graph. Live operations are not read.
 */
export function compileAssembly(graph: YardBuildGraph, inputs: AssemblyInputs): { steps: DerivedAssemblyStep[]; disclosure?: string } {
  const byId = new Map(graph.parts.map((part) => [part.id, part]));
  const names = (id: string) => partName(byId.get(id), id);
  const gaps: string[] = [];
  const groups = groupsOf(graph, byId, gaps);
  const seats = new Map(groups.map((group) => [group.pair, seatOf(group, byId)]));
  const subCounts = new Map<string, number>();
  for (const part of graph.parts) {
    const sub = rawSubassembly(part);
    if (sub) subCounts.set(sub, (subCounts.get(sub) ?? 0) + 1);
  }
  for (const [sub, count] of subCounts) if (count < 2) subCounts.delete(sub);
  const subOf = new Map<string, string>();
  for (const part of graph.parts) {
    const sub = rawSubassembly(part);
    if (sub && subCounts.has(sub)) subOf.set(part.id, sub);
  }
  const edges = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    if (from === to) return;
    const tos = edges.get(from) ?? new Set<string>();
    tos.add(to);
    edges.set(from, tos);
  };
  for (const group of groups) {
    const seat = seats.get(group.pair)!;
    if (seat.kind === "host") link(seat.host, seat.guest);
    else if (seat.kind === "hang") link(seat.host, seat.leaf);
  }
  const compare = (a: string, b: string) => comparePlace(byId, a, b);
  const { order, cyclic } = orderParts(graph.parts, edges, subOf, subCounts, compare);
  const indexOf = new Map(order.map((id, index) => [id, index]));
  const ledger = new Map(inputs.fasteners.map((row) => [row.pair, row]));
  const ledgerEmpty = inputs.fasteners.length === 0;
  const joined = new Set(groups.flatMap((group) => [group.a, group.b]));
  const unresolved: string[] = [];
  const hangUnresolved: string[] = [];
  const unknown: string[] = [];
  const extraPatterns: string[] = [];
  const missingRows: string[] = [];
  let missingId = false;
  let shopWithoutLedger = false;

  const drafts: Draft[] = [prepareStep(order, inputs.cuts, inputs.stockDisclosure)];
  const pending = new Map<number, Draft[]>();
  const add = (draft: Draft) => {
    const list = pending.get(draft.at) ?? [];
    list.push(draft);
    pending.set(draft.at, list);
  };

  for (const group of groups) {
    const seat = seats.get(group.pair)!;
    const jointIds = group.joints.map((joint) => joint.id);
    const { extra } = primaryPattern(group);
    if (extra.length) extraPatterns.push(`${group.pair} (${[seat.patternId, ...extra].filter(Boolean).join(", ")})`);
    const row = ledger.get(group.pair);
    if (seat.kind === "host" || seat.kind === "both" || seat.kind === "unresolved") {
      if (seat.kind === "unresolved") unresolved.push(jointIds.join(", "));
      const machined = seat.kind === "host" ? [seat.host] : [...seat.parts];
      const ends = seat.kind === "host" ? [seat.host, seat.guest] : [...seat.parts];
      const partIds = inOrder(machined, indexOf);
      add({
        at: Math.min(...machined.map((id) => indexOf.get(id) ?? 0)),
        kind: "machine",
        id: `machine:${group.pair}`,
        title: MACHINE_TITLE[seat.machining],
        detail: machineDetail(seat, names, jointIds),
        partIds,
        jointIds,
        subassemblyId: sharedSubassembly(partIds, subOf),
        machining: seat.machining,
        seat: seat.kind,
        hosts: seat.kind === "unresolved" ? undefined : inOrder(seat.kind === "host" ? [seat.host] : seat.parts, indexOf),
        guests: seat.kind === "host" ? [seat.guest] : undefined,
      });
      const screws = screwFields(row, inputs.fastenerId, ledgerEmpty);
      if (screws.missingId) missingId = true;
      if (!row && ledgerEmpty) shopWithoutLedger = true;
      if (!row && !ledgerEmpty) missingRows.push(group.pair);
      const fastenIds = inOrder(ends, indexOf);
      add({
        at: Math.max(...ends.map((id) => indexOf.get(id) ?? 0)),
        kind: "fasten",
        id: `fasten:${group.pair}`,
        title: FASTEN_TITLE[seat.patternId] ?? "Fasten joint",
        detail: `${seat.patternId || "joint"} ${jointIds.join(", ")}. ${screws.sentence}`,
        partIds: fastenIds,
        jointIds,
        subassemblyId: sharedSubassembly(fastenIds, subOf),
        seat: seat.kind,
        hosts: seat.kind === "host" ? [seat.host] : seat.kind === "both" ? inOrder(seat.parts, indexOf) : undefined,
        guests: seat.kind === "host" ? [seat.guest] : undefined,
        fasteners: screws.fasteners,
        noScrew: screws.noScrew,
      });
    } else if (seat.kind === "hang" || seat.kind === "hang-unresolved") {
      const ends = seat.kind === "hang" ? [seat.host, seat.leaf] : [...seat.parts];
      const partIds = inOrder(ends, indexOf);
      const count = seat.kind === "hang" ? hingeCount(byId.get(seat.leaf)) : undefined;
      if (seat.kind === "hang-unresolved") hangUnresolved.push(jointIds.join(", "));
      const countSentence = count
        ? `${count} ${count === 1 ? "hinge is" : "hinges are"} on the leaf. They are not carcass screws.`
        : "The joint does not carry a hinge count. No carcass screws are derived.";
      add({
        at: Math.max(...ends.map((id) => indexOf.get(id) ?? 0)),
        kind: "hang",
        id: `hang:${group.pair}`,
        title: "Hang hinge",
        detail: `${jointIds.join(", ")}. ${countSentence}`,
        partIds,
        jointIds,
        subassemblyId: sharedSubassembly(partIds, subOf),
        seat: seat.kind === "hang" ? "host" : "unresolved",
        hosts: seat.kind === "hang" ? [seat.host] : undefined,
        guests: seat.kind === "hang" ? [seat.leaf] : undefined,
        noScrew: "hinge",
        hardware: count ? { kind: "hinge", qty: count } : undefined,
      });
    } else {
      unknown.push(jointIds.join(", "));
      const screws = screwFields(row, inputs.fastenerId, ledgerEmpty);
      if (screws.missingId) missingId = true;
      if (!row && ledgerEmpty) shopWithoutLedger = true;
      if (!row && !ledgerEmpty) missingRows.push(group.pair);
      const partIds = inOrder(seat.parts, indexOf);
      add({
        at: Math.max(...seat.parts.map((id) => indexOf.get(id) ?? 0)),
        kind: "fasten",
        id: `fasten:${group.pair}`,
        title: "Fasten joint",
        detail: `${jointIds.join(", ")} has no library pattern. ${screws.sentence}`,
        partIds,
        jointIds,
        subassemblyId: sharedSubassembly(partIds, subOf),
        seat: "unresolved",
        fasteners: screws.fasteners,
        noScrew: screws.noScrew,
      });
    }
  }

  for (const list of pending.values()) list.sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) || a.id.localeCompare(b.id));

  const membersOf = new Map<string, string[]>();
  for (const id of order) {
    const sub = subOf.get(id);
    if (!sub) continue;
    const list = membersOf.get(sub) ?? [];
    list.push(id);
    membersOf.set(sub, list);
  }
  const remaining = new Map(subCounts);
  let run: { sub?: string; ids: string[] } | undefined;
  let placeCount = 0;
  const flush = () => {
    if (!run) return;
    const ids = run.ids;
    const sub = run.sub;
    placeCount += 1;
    drafts.push({
      at: indexOf.get(ids[ids.length - 1]) ?? 0,
      kind: "place",
      id: `place:${placeCount}`,
      title: "Place unjoined parts",
      detail: `${ids.length} ${ids.length === 1 ? "part has" : "parts have"} no reviewed joint. Contact is not joinery, so no machining or carcass screws are derived.`,
      partIds: ids,
      jointIds: [],
      subassemblyId: sub,
    });
    run = undefined;
  };

  order.forEach((id, index) => {
    if (!joined.has(id)) {
      const sub = subOf.get(id);
      if (run && run.sub === sub) run.ids.push(id);
      else {
        flush();
        run = { sub, ids: [id] };
      }
    } else {
      flush();
      for (const job of pending.get(index) ?? []) drafts.push(job);
    }
    const sub = subOf.get(id);
    if (!sub) return;
    const left = (remaining.get(sub) ?? 0) - 1;
    remaining.set(sub, left);
    if (left !== 0) return;
    flush();
    const memberIds = membersOf.get(sub) ?? [];
    const inside = groups.filter((group) => subOf.get(group.a) === sub && subOf.get(group.b) === sub);
    const interior = inside.length > 0;
    drafts.push({
      at: index,
      kind: "group",
      id: `group:${sub}`,
      title: "Group subassembly",
      detail: interior
        ? `${sub} has ${memberIds.length} parts. Fasteners stay on the joint steps; the group adds none.`
        : `${sub} has ${memberIds.length} parts and no reviewed joint inside it, so no machining or carcass screws are derived for the group.`,
      partIds: memberIds,
      jointIds: inside.flatMap((group) => group.joints.map((joint) => joint.id)),
      subassemblyId: sub,
    });
  });
  flush();

  const unjoined = graph.parts.filter((part) => !joined.has(part.id)).length;
  if (groups.length === 0) {
    gaps.push("No reviewed joints. Contact is not joinery, so no machining or carcass-screw steps are derived.");
  } else if (unjoined > 0) {
    gaps.push(`${unjoined} ${unjoined === 1 ? "part has" : "parts have"} no reviewed joint. Contact is not joinery, so no machining or carcass screws are derived for them.`);
  }
  if (shopWithoutLedger) gaps.push("The fastener ledger is empty, so fasten steps derive no carcass screws.");
  if (unresolved.length) {
    gaps.push(`The boxes do not show which part is housed for ${unresolved.join("; ")}. Both parts are machined before the joint is fastened.`);
  }
  if (hangUnresolved.length) gaps.push(`The leaf was not read for ${hangUnresolved.join("; ")}. No carcass screws are derived.`);
  if (unknown.length) gaps.push(`No library pattern for ${unknown.join("; ")}.`);
  if (extraPatterns.length) gaps.push(`One pair carries more than one pattern: ${extraPatterns.join("; ")}. The shop pattern is the step.`);
  if (missingRows.length) gaps.push(`The fastener ledger has no row for ${missingRows.join(", ")}.`);
  if (missingId) gaps.push("The fastener ledger counts screws and no screw item was given.");
  if (cyclic.length) {
    gaps.push(`Reviewed joints cycle among ${cyclic.join(", ")}. Those parts are ordered by position, then id. Machining still precedes fastening.`);
  }
  const splits = splitSubassemblies(order, subOf);
  if (splits.length) gaps.push(`Reviewed joints keep these subassemblies from staying contiguous: ${splits.join(", ")}.`);

  const steps = drafts.map(({ at: _at, ...rest }, index) => defined({ ...rest, step: index + 1 }));
  const disclosure = [...new Set(gaps.map((line) => line.trim()).filter(Boolean))].join(" ");
  return disclosure ? { steps, disclosure } : { steps };
}
