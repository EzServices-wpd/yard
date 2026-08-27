import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { framingNotes } from "./space";
import { uniqueSteps } from "./steps";
import { decorateBom } from "./listings";
import { binderBom, effectiveJoin } from "./joints";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import { loadIssues, panelBomLines } from "./function";
import { slideInches } from "./stockLook";
import { nestCutList } from "./nesting";
import type { AssemblyStep, BuildPlan, CutLine, FeasibilityIssue, YardProject } from "./types";

function letterLabel(i: number) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function stampLabels(lines: CutLine[]): CutLine[] {
  const sorted = [...lines].sort((a, b) => b.lengthIn - a.lengthIn || a.name.localeCompare(b.name));
  return sorted.map((line, i) => ({ ...line, label: letterLabel(i) }));
}

function partFamily(name: string, type?: string) {
  if (/^leg\b/i.test(name)) return "Leg";
  if (/cut round/i.test(name)) return name;
  if (/^apron\b/i.test(name)) return "Apron";
  if (type === "upright") return "Upright";
  if (type === "shelf") return "Shelf";
  if (type === "divider") return "Divider";
  if (type === "top" || type === "counter") return "Top";
  if (type === "bottom") return "Bottom";
  if (type === "back") return "Back";
  if (type === "door") return "Door";
  if (type === "drawer") return "Drawer box";
  if (type === "kick") return "Kick";
  if (type === "rail") return "Rail";
  return name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Top|Bottom)\s+/i, "") || name;
}

function effortLabel(project: YardProject, pieces: number): string {
  if (project.kind === "opening") return "1/2-day";
  if (project.panels.length <= 10) return "1/2-day";
  if (project.panels.length <= 20) return "1-day";
  if (pieces <= 120) return "1/2-day";
  if (pieces <= 400) return "1-day";
  return "weekend";
}

function closetCuts(project: YardProject): CutLine[] {
  const grouped = new Map<string, CutLine>();
  for (const p of project.panels) {
    const item = getCatalogItem(p.materialId);
    const w = Math.round(p.size.width * 8) / 8;
    const d = Math.round(p.size.depth * 8) / 8;
    const h = Math.round(p.size.height * 8) / 8;
    const family = partFamily(p.name, p.type);
    const key = `${p.materialId}|${family}|${w}|${d}|${h}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    grouped.set(key, {
      id: key,
      name: family,
      quantity: 1,
      lengthIn: Math.max(w, d, h),
      widthIn: [w, d, h].sort((a, b) => b - a)[1],
      thicknessIn: Math.min(w, d, h),
      material: item?.name ?? p.materialId,
    });
  }
  return stampLabels([...grouped.values()]);
}

function closetBom(project: YardProject, cuts: CutLine[]): BuildPlan["bom"] {
  const sheet = getCatalogItem(project.primaryMaterialId) ?? getCatalogItem("plywood-3-4-4x8");
  const screws = Math.max(16, project.panels.length * 6);
  const isTable = project.fitted?.program === "table";
  const legCuts = cuts.filter((c) => /^leg$/i.test(c.name) || (c.thicknessIn ?? 0) >= 2);
  const structural = cuts.filter(
    (c) => (c.thicknessIn ?? 0.75) >= 0.5 && (c.thicknessIn ?? 0) < 2 && !/^leg$/i.test(c.name),
  );
  const thinBacks = cuts.filter((c) => (c.thicknessIn ?? 0.75) < 0.5);
  const nest = structural.length ? nestCutList(structural) : null;
  const sheets = Math.max(
    isTable && structural.length === 0 ? 0 : 1,
    nest?.totalSheets ?? nest?.sheets.length ?? (structural.length ? 1 : 0),
  );

  const bom: BuildPlan["bom"] = [];
  if (sheets > 0) {
    bom.push({
      name: sheet?.name ?? '3/4" plywood 4x8',
      quantity: sheets,
      unit: sheets === 1 ? "sheet" : "sheets",
      catalogId: sheet?.id,
      searchQuery: sheet?.searchQuery ?? '3/4" x 4x8 sanded plywood',
      estimatedCost: (sheet?.unitCostUsd ?? 38.43) * sheets,
      notes: nest
        ? `From nest · ${sheets} sheet${sheets === 1 ? "" : "s"} · 1/8" kerf included.`
        : "Kerf-aware nest.",
    });
  }
  if (legCuts.length) {
    const legQty = legCuts.reduce((s, c) => s + c.quantity, 0);
    const legLen = legCuts[0]?.lengthIn ?? 30;
    bom.push({
      name: '2x2 (1-1/2" actual)',
      quantity: legQty,
      unit: legQty === 1 ? "pc" : "pcs",
      searchQuery: "2x2x8 pine poplar",
      estimatedCost: 6.5 * legQty,
      notes: `${legQty} table leg${legQty === 1 ? "" : "s"} · cut to ${legLen}" each · solid lumber, not sheet goods.`,
    });
  }
  if (thinBacks.length) {
    const thinQty = thinBacks.reduce((s, c) => s + c.quantity, 0);
    bom.push({
      name: '1/4" plywood 4x8 (backer)',
      quantity: 1,
      unit: "sheet",
      searchQuery: "1/4 inch sanded plywood 4x8",
      estimatedCost: 24.98,
      notes: `${thinQty} thin back panel${thinQty === 1 ? "" : "s"} (${thinBacks.map((c) => c.label ?? c.name).join(", ")}) — not nested on the 3/4" sheets.`,
    });
  }
  bom.push({
    name: '#8 x 1-1/4" wood screws',
    quantity: Math.ceil(screws / 50),
    unit: "box",
    searchQuery: "#8 wood screws 1-1/4",
    estimatedCost: 8,
    notes: `${screws} screws estimated at joints.`,
  });
  bom.push({
    name: "Wood glue",
    quantity: 1,
    unit: "bottle",
    searchQuery: "titebond wood glue",
    estimatedCost: 5.47,
  });
  if (project.assumptions.installMode !== "freestanding") {
    bom.push({
      name: project.assumptions.wallType === "masonry"
        ? "Tapcon concrete screws 3/16 x 2-3/4"
        : "GRK RSS #9 x 3-1/8 structural screws",
      quantity: 1,
      unit: "box",
      searchQuery:
        project.assumptions.wallType === "masonry"
          ? "Tapcon 3/16 x 2-3/4"
          : "GRK RSS #9 x 3-1/8",
      estimatedCost: 14,
      notes: "4-6 screws through the uprights into studs (or masonry anchors). Guidance only — confirm wall type.",
    });
  }
  return decorateBom(bom);
}

function closetIssues(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const { width, height, depth } = project.overall;
  if (width < 12 || height < 12 || depth < 8) {
    issues.push({
      id: "small",
      severity: "warn" as never,
      message: "Opening is tight — confirm the measure before you cut.",
    } as FeasibilityIssue);
  }
  return issues;
}

export function buildPlan(project: YardProject): BuildPlan {
  if (project.kind === "opening" && project.windowPkg) {
    const cutList = stampLabels(windowCuts(project));
    const bom = decorateBom(windowBom(project));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      id: `plan-${project.id}`,
      projectId: project.id,
      feasibility: windowIssues(project),
      summary: {
        summary: `${cutList.reduce((s, c) => s + c.quantity, 0)} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, 0)} · ~$${cost.toFixed(0)}`,
        message: `${project.name} — rough opening package.`,
      },
      cutList,
      bom,
      instructions: windowSteps(project),
      nest: null,
    } as BuildPlan;
  }

  if (project.kind === "closet" || project.fitted || project.panels.length > 0) {
    const cutList = closetCuts(project);
    const bom = closetBom(project, cutList);
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const structural = cutList.filter((c) => (c.thicknessIn ?? 0.75) >= 0.5 && (c.thicknessIn ?? 0) < 2 && !/^leg$/i.test(c.name));
    const nest = structural.length ? nestCutList(structural) : null;
    return {
      id: `plan-${project.id}`,
      projectId: project.id,
      feasibility: [...closetIssues(project), ...loadIssues(project)],
      summary: {
        summary: `${project.panels.length} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, project.panels.length)} · ~$${cost.toFixed(0)}`,
        message: `${project.name} — ${project.fitted?.program ?? "closet"}.`,
      },
      cutList,
      bom,
      instructions: uniqueSteps(project),
      nest,
    } as BuildPlan;
  }

  const item = getCatalogItem(project.primaryMaterialId);
  const pieces = project.instances.length;
  const bom = decorateBom([
    ...buildForgeBom(project),
    ...bomLinesFromForge(project),
    ...binderBom(project),
  ]);
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  return {
    id: `plan-${project.id}`,
    projectId: project.id,
    feasibility: framingNotes(project),
    summary: {
      summary: `${pieces} pieces of ${item?.name ?? "stock"} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(2)}`,
      message: project.name,
    },
    cutList: [],
    bom,
    instructions: uniqueSteps(project),
    nest: null,
  } as BuildPlan;
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  return [
    `# ${project.name}`,
    (plan as { summary?: { summary: string } }).summary?.summary ?? "",
    "",
    "## Cut list",
    ...plan.cutList.map((c) => `- ${c.label ?? ""} ${c.quantity}x ${c.name} ${c.lengthIn}" x ${c.widthIn}" x ${c.thicknessIn}"`),
    "",
    "## Buy",
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}`),
  ].join("\n");
}
