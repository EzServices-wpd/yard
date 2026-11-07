/**
 * Yard build graph, version 1. Shadow contract only.
 *
 * One finished build — casework panels, a frame with storage, or a StructureGraph lattice already
 * turned into sticks — is lifted into parts, joints, constraints, operations, and stock requirements.
 * compileBuildGraph reads that graph and nothing else: no prompt, no second length reader, no new
 * geometry. Model, steps, and Buy come back as the deterministic compiler already produced them.
 *
 * The graph is not the live source of truth. generateFromPrompt and buildPlan do not read it.
 * StructureGraph still builds lattices. Recipes still build named objects. A pair that only
 * touches stays contact. A reviewed pattern is declared only when a construction reading in
 * the joint library matches. Stock substitution keeps that form and is still not the live path.
 */
import { getCatalogItem } from "./catalog";
import { contactReport } from "./contact";
import { constructionReading, jointPattern, type ConstructionReadingId } from "./jointLibrary";
import { doorHingeLayout, hingeContext, leavesOf } from "./hingedLeaf";
import { panelJoints, stickJoints } from "./modelJoints";
import { structureIssues } from "./structureCheck";
import type { AssemblyStep, BomLine, BuildPlan, Panel, Vec3, YardInstance, YardProject } from "./types";

export const BUILD_GRAPH_VERSION = 1 as const;

export type BuildFamily = "casework" | "frame-storage" | "landmark";
export type BuildUse = "human" | "miniature";
export type BuildOrigin = "panels" | "structure-graph" | "mixed";

/** Fields of a panel the model compile returns. Role is the panel type. */
export const PANEL_FACT_KEYS = [
  "id",
  "type",
  "name",
  "materialId",
  "position",
  "size",
  "yaw",
  "drawerId",
  "drawerPart",
  "blank",
  "hinged",
  "joints",
  "strut",
  "form",
  "outline",
  "polygon",
  "turns",
  "proud",
  "structural",
  "cutNote",
  "leaf",
  "cutouts",
] as const satisfies readonly (keyof Panel)[];

export type PanelFactKey = (typeof PANEL_FACT_KEYS)[number];
export type PanelFact = Pick<Panel, PanelFactKey>;

/** Fields of a stick the model compile returns. These are the StructureGraph edge after graphToInstances. */
export const MEMBER_FACT_KEYS = [
  "id",
  "catalogId",
  "role",
  "position",
  "rotation",
  "cutLength",
  "from",
  "to",
  "join",
  "section",
  "round",
  "face",
] as const;

export type MemberFact = {
  id: string;
  catalogId: string;
  role: string;
  position: Vec3;
  rotation: Vec3;
  cutLength?: number;
  from?: Vec3;
  to?: Vec3;
  join?: string;
  section?: { width: number; height: number };
  round?: number;
  face?: Vec3;
};

export type GraphPart =
  | (PanelFact & { source: "panel"; role: string })
  | (MemberFact & { source: "member"; materialId: string });

export type GraphJoint = {
  id: string;
  a: string;
  b: string;
  /**
   * "declared" — Panel.joints or Panel.hinged, a pattern in the joint library.
   * "contact" — panelJoints / stickJoints saw the boxes or the stick ends meet. That is not joinery.
   */
  basis: "declared" | "contact";
  /** Joint-library id. Set only for a declared pattern. */
  patternId?: string;
  /** Live touch class from modelJoints. Set only for contact. */
  contactClass?: "butt" | "face" | "back" | "frame";
  /** True only for a declared library pattern. Contact is never a reviewed joint. */
  reviewedJoin: boolean;
  /**
   * Which construction reading promoted a contact, when the panel field did not already say so.
   * Panel.joints and Panel.hinged leave this unset.
   */
  reading?: ConstructionReadingId;
};

export type GraphConstraint = {
  id: string;
  kind: "scale" | "stock-rule" | "structure" | "contact";
  detail: string;
  ok: boolean;
  /** stock-rule: part names in 1/4" plywood that are not a back or a drawer bottom. */
  problems?: string[];
  /** structure: the live structure check, copied, not re-decided. */
  issues?: { code: string; part: string }[];
  pieces?: number;
  components?: number;
  /** Contact is recorded so it cannot be read as joinery. Always false. */
  safeJoinery?: false;
};

export type GraphOperation = {
  id: string;
  /** Sort key. The compiler emits steps in this order and numbers them from 1. */
  order: number;
  title: string;
  description: string;
  tips?: string;
  /** The live step's partsUsed labels, emitted unchanged. */
  labels: string[];
  /** Labels resolved to part ids. "*" is every part. The compiler does not scan titles. */
  partIds: string[];
  fastenersUsed?: { id: string; qty: number }[];
};

export type StockRequirement = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  catalogId?: string;
  notes?: string;
  estimatedCost?: number;
  /** Model part ids the live cut list already tied to this Buy line. Hardware may name none. */
  partIds: string[];
};

export type SpecSnapshot = {
  noun: string;
  stockId: string;
  species: string | null;
  width: number;
  height: number;
  depth: number;
  typedWidth: boolean;
  typedHeight: boolean;
  typedDepth: boolean;
};

export type YardBuildGraph = {
  version: typeof BUILD_GRAPH_VERSION;
  /** This graph was lifted beside the live build. The live build does not read it. */
  shadow: true;
  id: string;
  name: string;
  family: BuildFamily;
  use: BuildUse;
  /** panels: sheet and lumber parts. structure-graph: sticks StructureGraph already emitted. */
  origin: BuildOrigin;
  envelope: { width: number; height: number; depth: number };
  primaryMaterialId: string;
  /** Shop or stock fastener on the whole build, when the live project set one. */
  fastener?: string;
  spec?: SpecSnapshot;
  parts: GraphPart[];
  joints: GraphJoint[];
  constraints: GraphConstraint[];
  operations: GraphOperation[];
  stock: StockRequirement[];
  assumptions: string[];
  /**
   * Form, apart from which stock realized it: roles, envelope, and the reviewed patterns.
   * Contact is not part of the form. A landmark's role list is a multiset; substitution
   * compares the set, because a shorter stick changes the count.
   */
  form?: BuildForm;
  /** Set only by substituteStock, when a second graph kept this form under a new stock. */
  substitution?: { fromMaterialId: string; toMaterialId: string; kept: BuildForm };
};

/** What stays when the stock changes. Reviewed patterns only — contact is not construction intent. */
export type BuildForm = {
  family: BuildFamily;
  use: BuildUse;
  origin: BuildOrigin;
  roles: string[];
  envelope: { width: number; height: number; depth: number };
  reviewedPatterns: string[];
  /** Roles of parts that are 1/4" plywood and a back or a drawer bottom. */
  quarterInchRoles: string[];
};

export type CompiledBuild = {
  model: {
    name: string;
    envelope: { width: number; height: number; depth: number };
    panels: PanelFact[];
    members: MemberFact[];
  };
  steps: {
    step: number;
    title: string;
    description: string;
    tips?: string;
    partsUsed: string[];
    fastenersUsed?: { id: string; qty: number }[];
  }[];
  buy: {
    name: string;
    quantity: number;
    unit: string;
    catalogId?: string;
    notes?: string;
    estimatedCost?: number;
  }[];
};

function defined<T extends Record<string, unknown>>(row: T): T {
  const out = {} as T;
  for (const key of Object.keys(row) as (keyof T)[]) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

const vec = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });

export function panelFact(panel: Pick<Panel, PanelFactKey>): PanelFact {
  const row: Record<string, unknown> = {};
  for (const key of PANEL_FACT_KEYS) {
    const value = panel[key];
    if (value === undefined) continue;
    if ((key === "position" || key === "size") && value && typeof value === "object") row[key] = { ...value };
    else row[key] = value;
  }
  return row as PanelFact;
}

export function memberFact(inst: YardInstance | MemberFact): MemberFact {
  return defined({
    id: inst.id,
    catalogId: inst.catalogId,
    role: inst.role ?? "member",
    position: vec(inst.position),
    rotation: vec(inst.rotation),
    cutLength: inst.cutLength,
    from: inst.from ? vec(inst.from) : undefined,
    to: inst.to ? vec(inst.to) : undefined,
    join: inst.join,
    section: inst.section ? { ...inst.section } : undefined,
    round: inst.round,
    face: inst.face ? vec(inst.face) : undefined,
  });
}

/** 1/4" plywood is a back or a drawer bottom. A wall, shelf, or divider in that sheet is a problem. */
export function quarterPlyProblems(parts: readonly GraphPart[]): string[] {
  const bad: string[] = [];
  for (const part of parts) {
    if (part.source !== "panel") continue;
    if (!/^plywood-1-4/i.test(part.materialId)) continue;
    if (part.type === "back" || part.drawerPart === "bottom") continue;
    bad.push(part.name);
  }
  return bad;
}

function projectBuildUse(project: YardProject): BuildUse {
  const item = getCatalogItem(project.primaryMaterialId);
  if (item && (item.category === "craft_wood" || item.category === "paper_tube" || item.category === "cardboard" || item.category === "foam")) return "miniature";
  if (project.assumptions?.use === "toy" || project.assumptions?.use === "display") return "miniature";
  return "human";
}

function originOf(project: YardProject): BuildOrigin {
  const panels = project.panels.length > 0;
  const members = project.instances.length > 0;
  if (panels && members) return "mixed";
  if (members) return "structure-graph";
  return "panels";
}

function specSnapshot(project: YardProject): SpecSnapshot | undefined {
  const spec = project.spec;
  if (!spec) return undefined;
  return {
    noun: spec.noun,
    stockId: spec.stockId,
    species: spec.species,
    width: spec.size.width.inches,
    height: spec.size.height.inches,
    depth: spec.size.depth.inches,
    typedWidth: spec.size.width.typed,
    typedHeight: spec.size.height.typed,
    typedDepth: spec.size.depth.typed,
  };
}

function resolvePartIds(parts: readonly { id: string; name?: string }[], labels: string[]): string[] {
  if (labels.some((label) => label === "*" || label.toLowerCase() === "all")) return parts.map((part) => part.id);
  const byId = new Map(parts.map((part) => [part.id, part.id]));
  const byName = new Map<string, string[]>();
  for (const part of parts) {
    const name = part.name?.toLowerCase();
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(part.id);
    byName.set(name, list);
  }
  const ids: string[] = [];
  for (const label of labels) {
    const id = byId.get(label);
    if (id) {
      ids.push(id);
      continue;
    }
    const named = byName.get(label.toLowerCase());
    if (named) ids.push(...named);
  }
  return [...new Set(ids)];
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function declaredJoints(panels: readonly Panel[]): GraphJoint[] {
  const out: GraphJoint[] = [];
  const seen = new Set<string>();
  const push = (a: string, b: string, patternId: string) => {
    const key = `${pairKey(a, b)}|${patternId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const pattern = jointPattern(patternId);
    out.push({
      id: `declared-${out.length + 1}`,
      a,
      b,
      basis: "declared",
      patternId,
      reviewedJoin: !!pattern,
    });
  };
  for (const panel of panels) {
    for (const joint of panel.joints ?? []) push(panel.id, joint.with, joint.kind);
    if (panel.hinged) push(panel.id, panel.hinged.to, "hinge");
  }
  return out;
}

const RIDGE_BEVEL = /bevel the ridge edge 45/i;
const MITER_ENDS = /miter both ends/i;
const PIN_HOLE = /pin hole/i;
const HOUSED = new Set(["shelf", "bottom", "top", "divider", "rail"]);
const HOST_FACE = new Set(["upright", "side", "divider", "back"]);
const LEAF_TYPES = new Set(["door", "drawer", "mirror", "glass_panel"]);

type AxisBox = { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] };

function axisBox(panel: Panel): AxisBox {
  const size: [number, number, number] = [panel.size.width, panel.size.height, panel.size.depth];
  return {
    min: [panel.position.x, panel.position.y, panel.position.z],
    max: [panel.position.x + size[0], panel.position.y + size[1], panel.position.z + size[2]],
    size,
  };
}

/** Axes that are the part's thickness. A tied minimum (a square section) is still a face. */
function faceAxes(box: AxisBox): number[] {
  const thin = Math.min(...box.size);
  return [0, 1, 2].filter((axis) => box.size[axis] - thin <= 1e-9);
}

function overlapOn(a: AxisBox, b: AxisBox, axis: number): number {
  return Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
}

const END_TOL = 1 / 16;

/**
 * One end of `part` sits inside `host` on `axis`, and the part leaves through only the other face.
 * Both ends outside is a crossing. An end that reaches the far face has passed through.
 */
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

/** Each board runs past the other's two faces on some axis. Stopping inside a face is not a crossing. */
function facesCross(a: AxisBox, b: AxisBox): boolean {
  const contains = (outer: AxisBox, inner: AxisBox, axis: number) =>
    outer.min[axis] < inner.min[axis] - END_TOL && outer.max[axis] > inner.max[axis] + END_TOL;
  let aThroughB = false;
  let bThroughA = false;
  for (let axis = 0; axis < 3; axis++) {
    if (contains(a, b, axis)) aThroughB = true;
    if (contains(b, a, axis)) bThroughA = true;
  }
  return aThroughB && bThroughA;
}

/**
 * A contact pair becomes a reviewed pattern only when a construction reading matches.
 * A flush butt, a pin shelf, a screwed back, and a stick node return nothing.
 * A housed end is an end inside the host. A lap is each board passing through the other.
 */
export function readingForPanels(a: Panel, b: Panel): ConstructionReadingId | undefined {
  const notes = (panel: Panel) => panel.cutNote ?? "";
  // The ridge note is the builder's miter, including on a polygon roof. A gable's "45° to a peak" does not match.
  if ((RIDGE_BEVEL.test(notes(a)) && RIDGE_BEVEL.test(notes(b))) || (MITER_ENDS.test(notes(a)) && MITER_ENDS.test(notes(b)))) {
    return "ridge-miter";
  }
  if (a.yaw || b.yaw || a.polygon || b.polygon) return undefined;
  const A = axisBox(a);
  const B = axisBox(b);
  // Any host face can be entered, not only its thinnest side. The part's own thickness can
  // overlap less than the insertion, so that smaller overlap is not the only axis tried.
  const housedEnd = housedOnEnteredFace(a, b, A, B, notes) ?? housedOnEnteredFace(b, a, B, A, notes);
  if (housedEnd) return housedEnd;
  const overlaps = [0, 1, 2].map((axis) => Math.min(A.max[axis], B.max[axis]) - Math.max(A.min[axis], B.min[axis]));
  if (overlaps.every((overlap) => overlap > END_TOL) && Math.min(...overlaps) <= 0.8 && facesCross(A, B)) {
    const crosses = (divider: Panel, shelf: Panel) => divider.type === "divider" && (shelf.type === "shelf" || shelf.type === "deck");
    if (crosses(a, b) || crosses(b, a)) return "cross-lap";
  }
  return undefined;
}

function housedOnEnteredFace(
  part: Panel,
  host: Panel,
  partBox: AxisBox,
  hostBox: AxisBox,
  notes: (panel: Panel) => string,
): ConstructionReadingId | undefined {
  if (PIN_HOLE.test(`${notes(part)} ${notes(host)}`)) return undefined;
  const partFaces = new Set(faceAxes(partBox));
  for (const axis of [0, 1, 2]) {
    // Entering along the part's own thickness is a face stacked on a face, not an end in a groove.
    if (partFaces.has(axis)) continue;
    const overlap = overlapOn(partBox, hostBox, axis);
    if (!(overlap > END_TOL && overlap <= 0.8)) continue;
    if (!endEnters(partBox, hostBox, axis)) continue;
    // The other two axes are the face. Both have to overlap, or the part only meets an edge.
    if ([0, 1, 2].some((other) => other !== axis && overlapOn(partBox, hostBox, other) <= END_TOL)) continue;
    const sheet = Math.min(...partBox.size) <= 0.3 && (part.type === "back" || part.type === "mirror");
    if (sheet) return "housed-rabbet";
    if (HOUSED.has(part.type) && HOST_FACE.has(host.type)) return "housed-dado";
  }
  return undefined;
}

function declareReading(joints: GraphJoint[], a: string, b: string, reading: ConstructionReadingId, seq: number): boolean {
  const patternId = constructionReading(reading)?.patternId;
  if (!patternId || !jointPattern(patternId)) return false;
  joints.push({
    id: `declared-${seq}`,
    a,
    b,
    basis: "declared",
    patternId,
    reviewedJoin: true,
    reading,
  });
  return true;
}

function contactJoints(project: YardProject, declared: readonly GraphJoint[]): { contact: GraphJoint[]; promoted: GraphJoint[] } {
  const taken = new Set(declared.map((joint) => pairKey(joint.a, joint.b)));
  const panels = new Map(project.panels.map((panel) => [panel.id, panel]));
  const raw = [
    ...panelJoints(project.panels).map((joint) => ({ ...joint, contactClass: joint.kind })),
    ...stickJoints(project.instances).map((joint) => ({ ...joint, contactClass: joint.kind })),
  ];
  const contact: GraphJoint[] = [];
  const promoted: GraphJoint[] = [];
  const seen = new Set<string>();
  let declaredCount = declared.length;
  for (const joint of raw) {
    const key = pairKey(joint.a, joint.b);
    if (taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    const a = panels.get(joint.a);
    const b = panels.get(joint.b);
    const reading = a && b ? readingForPanels(a, b) : undefined;
    if (reading && declareReading(promoted, joint.a, joint.b, reading, declaredCount + 1)) {
      declaredCount += 1;
      taken.add(key);
      continue;
    }
    contact.push({
      id: `contact-${contact.length + 1}`,
      a: joint.a,
      b: joint.b,
      basis: "contact",
      contactClass: joint.contactClass,
      reviewedJoin: false,
    });
  }
  return { contact, promoted };
}

/** A door the Buy list hangs, meeting the one carcass part on its hinge edge. Glue-only stock stays unhinged. */
function hingeReadings(project: YardProject, taken: Set<string>, seq: number): GraphJoint[] {
  if (!project.panels.length || hingeContext(project).screwless) return [];
  const layout = doorHingeLayout(project);
  const out: GraphJoint[] = [];
  for (const leaf of leavesOf(project)) {
    if (leaf.role !== "door" || leaf.part.hinged || !layout.has(leaf.part.id) || leaf.part.yaw) continue;
    const host = hingeHost(leaf.part, leaf.edge, project.panels);
    if (!host) continue;
    const key = pairKey(leaf.part.id, host.id);
    if (taken.has(key)) continue;
    if (!declareReading(out, leaf.part.id, host.id, "hinge-leaf", seq + 1)) continue;
    taken.add(key);
    seq += 1;
  }
  return out;
}

function hingeHost(door: Panel, edge: NonNullable<Panel["hinged"]>["edge"], panels: readonly Panel[]): Panel | undefined {
  const doorBox = axisBox(door);
  const axis = edge === "left" || edge === "right" ? 0 : edge === "top" || edge === "bottom" ? 1 : 2;
  const coord = edge === "right" || edge === "top" || edge === "front" ? doorBox.max[axis] : doorBox.min[axis];
  const others = [0, 1, 2].filter((k) => k !== axis);
  const hits = panels.filter((panel) => {
    if (panel.id === door.id || LEAF_TYPES.has(panel.type) || panel.yaw) return false;
    const box = axisBox(panel);
    if (coord < box.min[axis] - 0.2 || coord > box.max[axis] + 0.2) return false;
    // A door hangs on the front edge, so the depth meeting is a touch (gap 0), not an overlap.
    return others.every((k) => Math.min(doorBox.max[k], box.max[k]) - Math.max(doorBox.min[k], box.min[k]) > -0.15);
  });
  const prefer = hits.filter((panel) => /^(?:upright|side|stile|rail|back)$/.test(panel.type));
  const pool = prefer.length ? prefer : hits;
  const ranked = pool
    .map((panel) => {
      const box = axisBox(panel);
      return { panel, dist: Math.min(Math.abs(box.min[axis] - coord), Math.abs(box.max[axis] - coord)) };
    })
    .sort((a, b) => a.dist - b.dist || a.panel.id.localeCompare(b.panel.id));
  if (!ranked.length) return undefined;
  if (ranked.length > 1 && ranked[1].dist - ranked[0].dist < 0.05) return undefined;
  return ranked[0].panel;
}

function operationsFrom(plan: BuildPlan, parts: readonly GraphPart[]): GraphOperation[] {
  const named = parts.map((part) => ({ id: part.id, name: part.source === "panel" ? part.name : part.role }));
  return plan.instructions.map((step, index) => {
    const labels = step.partsUsed ?? [];
    return defined({
      id: `op-${index + 1}`,
      order: index + 1,
      title: step.title,
      description: step.description,
      tips: step.tips,
      labels,
      partIds: resolvePartIds(named, labels),
      fastenersUsed: step.fastenersUsed?.map((use) => ({ id: use.id, qty: use.qty })),
    });
  });
}

function stockFrom(plan: BuildPlan): StockRequirement[] {
  return plan.bom.map((line, index) => ({
    id: `stock-${index + 1}`,
    ...buyFact(line),
    partIds: partIdsForLine(line, plan),
  }));
}

function partIdsForLine(line: BomLine, plan: BuildPlan): string[] {
  const ids: string[] = [];
  for (const cut of plan.cutList) {
    const stockId = (cut.id ?? "").split("|")[0];
    const same = (!!line.catalogId && stockId === line.catalogId) || (!!cut.material && cut.material === line.name);
    if (!same) continue;
    for (const id of cut.partIds ?? []) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function buyFact(line: BomLine): CompiledBuild["buy"][number] {
  return defined({
    name: line.name,
    quantity: line.quantity,
    unit: line.unit,
    catalogId: line.catalogId,
    notes: line.notes,
    estimatedCost: line.estimatedCost,
  });
}

/**
 * Lift a finished project and the plan the deterministic compiler already wrote.
 * `family` is the representative this spike is proving. It is not read off the prompt.
 */
export function liftBuildGraph(project: YardProject, plan: BuildPlan, family: BuildFamily): YardBuildGraph {
  const use = projectBuildUse(project);
  const parts: GraphPart[] = [
    ...project.panels.map((panel) => ({ ...panelFact(panel), source: "panel" as const, role: panel.type })),
    ...project.instances.map((inst) => {
      const member = memberFact(inst);
      return { ...member, source: "member" as const, materialId: member.catalogId };
    }),
  ];
  const declared = declaredJoints(project.panels);
  const { contact, promoted } = contactJoints(project, declared);
  const taken = new Set([...declared, ...promoted].map((joint) => pairKey(joint.a, joint.b)));
  const hinges = hingeReadings(project, taken, declared.length + promoted.length);
  const joints = [...declared, ...promoted, ...hinges, ...contact];
  const touch = contactReport(project);
  const issues = structureIssues(project).map((issue) => ({ code: issue.code, part: issue.part }));
  const quarter = quarterPlyProblems(parts);
  const spec = specSnapshot(project);
  const constraints: GraphConstraint[] = [
    {
      id: "scale",
      kind: "scale",
      ok: true,
      detail: use === "miniature"
        ? "Miniature model. Glue on a stick and boxes that touch are not person-safe furniture joinery."
        : "Human-use furniture. A reviewed joint is a declared pattern, not two parts that touch.",
    },
    {
      id: "quarter-ply",
      kind: "stock-rule",
      ok: quarter.length === 0,
      detail: "1/4\" plywood is a back or a drawer bottom, never a wall, shelf, or divider.",
      problems: quarter,
    },
    {
      id: "structure",
      kind: "structure",
      ok: issues.length === 0,
      detail: issues.length ? issues.map((issue) => `${issue.code}: ${issue.part}`).join("; ") : "The live structure check found every part on a load path.",
      issues,
    },
    {
      id: "contact",
      kind: "contact",
      ok: true,
      safeJoinery: false,
      pieces: touch.pieces,
      components: touch.components,
      detail: `${touch.components} touching component(s) of ${touch.pieces} pieces. Contact is not joinery.`,
    },
  ];
  const parked = parkedContradiction(project, plan, issues);
  if (parked) constraints.push(parked);
  const graph: YardBuildGraph = {
    version: BUILD_GRAPH_VERSION,
    shadow: true,
    id: project.id,
    name: project.name,
    family,
    use,
    origin: originOf(project),
    envelope: { width: project.overall.width, height: project.overall.height, depth: project.overall.depth },
    primaryMaterialId: project.primaryMaterialId,
    ...(project.joinMethod ? { fastener: project.joinMethod } : {}),
    ...(spec ? { spec } : {}),
    parts,
    joints,
    constraints,
    operations: operationsFrom(plan, parts),
    stock: stockFrom(plan),
    assumptions: [
      "Shadow graph, version 1. The live engine does not read it.",
      "Dimensions, cuts, Buy quantities, and step wording are the deterministic compiler's. This graph addresses them by part id.",
      "A reviewed joint is a construction reading or a panel field. Contact stays contact. substituteStock keeps the form; the live compiler does not read it.",
    ],
  };
  return { ...graph, form: buildForm(graph) };
}

/**
 * The potting-bench lower shelf says three different things. Recorded here so a later joint
 * reading cannot hide it. Not resolved.
 */
function parkedContradiction(
  project: YardProject,
  plan: BuildPlan,
  issues: { code: string; part: string }[],
): GraphConstraint | undefined {
  const note = (project.notes ?? []).some((line) => /glue and screw it into the leg faces/i.test(line));
  const floating = issues.some((issue) => issue.code === "floating" && /lower shelf/i.test(issue.part));
  const pin = plan.instructions.some((step) => /pin 1 adjustable shelf/i.test(step.title));
  if (!note || !floating || !pin) return undefined;
  return {
    id: "potting-shelf",
    kind: "structure",
    ok: false,
    detail: "Parked: the builder note glues and screws the lower shelf into the legs, the structure check calls it floating, and the step calls it an adjustable pin shelf.",
  };
}

/** Model, steps, and Buy from the graph alone. Step numbers follow operation order. */
export function compileBuildGraph(graph: YardBuildGraph): CompiledBuild {
  if (graph.version !== BUILD_GRAPH_VERSION) throw new Error(`build graph version ${graph.version} is not ${BUILD_GRAPH_VERSION}`);
  const illegal = quarterPlyProblems(graph.parts);
  if (illegal.length) throw new Error(`1/4" plywood is a back or a drawer bottom, not: ${illegal.join(", ")}`);
  const steps = [...graph.operations]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((op, index) => defined({
      step: index + 1,
      title: op.title,
      description: op.description,
      tips: op.tips,
      partsUsed: op.labels,
      fastenersUsed: op.fastenersUsed?.map((use) => ({ id: use.id, qty: use.qty })),
    }));
  return {
    model: {
      name: graph.name,
      envelope: { ...graph.envelope },
      panels: graph.parts.filter((part) => part.source === "panel").map((part) => panelFact(part)),
      members: graph.parts.filter((part) => part.source === "member").map((part) => memberFact(part)),
    },
    steps,
    buy: graph.stock.map((line) => defined({
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      catalogId: line.catalogId,
      notes: line.notes,
      estimatedCost: line.estimatedCost,
    })),
  };
}

/** Roles, envelope, and reviewed patterns. Contact is left out on purpose. */
export function buildForm(graph: YardBuildGraph): BuildForm {
  return {
    family: graph.family,
    use: graph.use,
    origin: graph.origin,
    roles: graph.parts.map((part) => part.role).sort(),
    envelope: { ...graph.envelope },
    reviewedPatterns: graph.joints.filter((joint) => joint.reviewedJoin && joint.patternId).map((joint) => joint.patternId!).sort(),
    quarterInchRoles: graph.parts
      .filter((part) => part.source === "panel" && /^plywood-1-4/i.test(part.materialId) && (part.type === "back" || part.drawerPart === "bottom"))
      .map((part) => part.role)
      .sort(),
  };
}

export type SubstitutionReview = {
  ok: boolean;
  reasons: string[];
  fromMaterialId: string;
  toMaterialId: string;
  kept: BuildForm;
};

const ENVELOPE_TOLERANCE: Record<BuildFamily, number> = { casework: 0, "frame-storage": 0, landmark: 1 };

/**
 * A switched stock keeps the form when roles, envelope, and reviewed joints agree,
 * 1/4" backs and drawer bottoms stay, and Buy names the new stock instead of the old.
 * Landmark role counts may change with the stick. Contact counts are not the form.
 */
export function reviewStockSubstitution(base: YardBuildGraph, switched: YardBuildGraph): SubstitutionReview {
  const reasons: string[] = [];
  const kept = buildForm(base);
  const next = buildForm(switched);
  if (base.family !== switched.family) reasons.push("family");
  if (base.use !== switched.use) reasons.push("use");
  if (base.origin !== switched.origin) reasons.push("origin");
  const roleKey = (roles: string[]) => (base.family === "landmark" ? [...new Set(roles)].sort() : roles).join("|");
  if (roleKey(kept.roles) !== roleKey(next.roles)) reasons.push("roles");
  const tolerance = ENVELOPE_TOLERANCE[base.family];
  for (const axis of ["width", "height", "depth"] as const) {
    if (Math.abs(kept.envelope[axis] - next.envelope[axis]) > tolerance) reasons.push(`envelope.${axis}`);
  }
  if (kept.reviewedPatterns.join("|") !== next.reviewedPatterns.join("|")) reasons.push("construction");
  if (kept.quarterInchRoles.join("|") !== next.quarterInchRoles.join("|")) reasons.push("quarter-inch");
  if (base.primaryMaterialId === switched.primaryMaterialId) reasons.push("stock-unchanged");
  if (!switched.stock.some((line) => line.catalogId === switched.primaryMaterialId)) reasons.push("buy");
  if (switched.stock.some((line) => line.catalogId === base.primaryMaterialId)) reasons.push("buy-keeps-old-stock");
  return { ok: reasons.length === 0, reasons, fromMaterialId: base.primaryMaterialId, toMaterialId: switched.primaryMaterialId, kept };
}

/**
 * Accept a switched graph only when the form holds. The result is that graph, with the kept form recorded.
 * It does not rebuild geometry and it does not call the live compiler.
 */
export function substituteStock(base: YardBuildGraph, switched: YardBuildGraph): YardBuildGraph {
  const review = reviewStockSubstitution(base, switched);
  if (!review.ok) throw new Error(`stock substitution rejected: ${review.reasons.join(", ")}`);
  return {
    ...switched,
    substitution: { fromMaterialId: review.fromMaterialId, toMaterialId: review.toMaterialId, kept: review.kept },
    assumptions: [
      ...switched.assumptions,
      `Stock substitution ${review.fromMaterialId} → ${review.toMaterialId} kept the form. Buy follows ${review.toMaterialId}. The live compiler does not read this.`,
    ],
  };
}

/** The live plan's steps and Buy in the shape compileBuildGraph emits. */
export function planFacts(plan: BuildPlan): { steps: CompiledBuild["steps"]; buy: CompiledBuild["buy"] } {
  return {
    steps: plan.instructions.map((step: AssemblyStep, index) => defined({
      step: index + 1,
      title: step.title,
      description: step.description,
      tips: step.tips,
      partsUsed: step.partsUsed ?? [],
      fastenersUsed: step.fastenersUsed?.map((use) => ({ id: use.id, qty: use.qty })),
    })),
    buy: plan.bom.map(buyFact),
  };
}
