/**
 * Yard build graph, version 1. Shadow contract only.
 *
 * One finished build — casework panels, a frame with storage, or a StructureGraph lattice already
 * turned into sticks — is lifted into parts, joints, constraints, operations, and stock requirements.
 * compileBuildGraph reads that graph and nothing else: no prompt, no second length reader, no new
 * geometry. Model, steps, and Buy come back as the deterministic compiler already produced them.
 *
 * The graph is not the live source of truth. generateFromPrompt and buildPlan do not read it.
 * StructureGraph still builds lattices. Recipes still build named objects. This file does not
 * substitute stock and does not invent joinery from two boxes that happen to touch.
 */
import { getCatalogItem } from "./catalog";
import { contactReport } from "./contact";
import { jointPattern } from "./jointLibrary";
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

function useOf(project: YardProject): BuildUse {
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

function contactJoints(project: YardProject, declared: readonly GraphJoint[]): GraphJoint[] {
  const taken = new Set(declared.map((joint) => pairKey(joint.a, joint.b)));
  const raw = [
    ...panelJoints(project.panels).map((joint) => ({ ...joint, contactClass: joint.kind })),
    ...stickJoints(project.instances).map((joint) => ({ ...joint, contactClass: joint.kind })),
  ];
  const out: GraphJoint[] = [];
  const seen = new Set<string>();
  for (const joint of raw) {
    const key = pairKey(joint.a, joint.b);
    if (taken.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `contact-${out.length + 1}`,
      a: joint.a,
      b: joint.b,
      basis: "contact",
      contactClass: joint.contactClass,
      reviewedJoin: false,
    });
  }
  return out;
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
  const use = useOf(project);
  const parts: GraphPart[] = [
    ...project.panels.map((panel) => ({ ...panelFact(panel), source: "panel" as const, role: panel.type })),
    ...project.instances.map((inst) => {
      const member = memberFact(inst);
      return { ...member, source: "member" as const, materialId: member.catalogId };
    }),
  ];
  const declared = declaredJoints(project.panels);
  const joints = [...declared, ...contactJoints(project, declared)];
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
  return {
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
      "Switching stock is still the live engine's job. This graph can hold two stocks of one form; it does not resubstitute.",
    ],
  };
}

/** Model, steps, and Buy from the graph alone. Step numbers follow operation order. */
export function compileBuildGraph(graph: YardBuildGraph): CompiledBuild {
  if (graph.version !== BUILD_GRAPH_VERSION) throw new Error(`build graph version ${graph.version} is not ${BUILD_GRAPH_VERSION}`);
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
