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
  const structural = cuts.filter((c) => (c.thicknessIn ?? 0.75) >= 0.5);
  const thinBacks = cuts.filter((c) => (c.thicknessIn ?? 0.75) < 0.5);
  const nest = structural.length ? nestCutList(structural) : null;
  const sheets = Math.max(1, nest?.totalSheets ?? nest?.sheets.length ?? 1);

  const bom: BuildPlan["bom"] = [
    {
      name: sheet?.name ?? '3/4" plywood 4x8',
      quantity: sheets,
      unit: sheets === 1 ? "sheet" : "sheets",
      catalogId: sheet?.id,
      searchQuery: sheet?.searchQuery ?? '3/4" x 4x8 sanded plywood',
      estimatedCost: (sheet?.unitCostUsd ?? 38.43) * sheets,
      notes: nest
        ? `From nest · ${sheets} sheet${sheets === 1 ? "" : "s"} · 1/8" kerf included.`
        : "Kerf-aware nest.",
    },
  ];
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
      searchQuery: project.assumptions.wallType === "masonry"
        ? "Tapcon 3/16 x 2-3/4 concrete screws"
        : "GRK RSS #9 x 3-1/8 structural screws",
      estimatedCost: 20,
      notes: "4-6 screws through the uprights into studs (or masonry anchors). Guidance only — confirm wall type.",
    });
  }
  const doors = project.panels.filter((p) => p.type === "door").length;
  const drawers = project.panels.filter((p) => p.type === "drawer").length;
  const shelves = project.panels.filter((p) => p.type === "shelf").length;
  if (doors) {
    bom.push({
      name: "Concealed cabinet hinges",
      quantity: doors * 2,
      unit: "hinge",
      searchQuery: "soft close concealed cabinet hinges",
      estimatedCost: doors * 8,
    });
  }
  if (drawers) {
    const depth = project.fitted?.unit.depth ?? project.pocket?.unit.depth ?? 16;
    const slide = slideInches(depth);
    bom.push({
      name: `Side-mount drawer slides ${slide}"`,
      quantity: drawers,
      unit: "pair",
      searchQuery: `${slide} inch side mount drawer slides`,
      estimatedCost: drawers * 12,
    });
  }
  if (shelves) {
    bom.push({
      name: "Shelf pins 5mm",
      quantity: 1,
      unit: "pack",
      searchQuery: "5mm shelf pins",
      estimatedCost: 6.49,
      notes: `${shelves} adjustable shelves x 4 pins.`,
    });
  }
  return bom;
}

export function buildPlan(project: YardProject): BuildPlan {
  const issues: FeasibilityIssue[] = [];

  if (project.kind === "opening" && (project.windowPkg || project.opening?.kind === "window")) {
    const wIssues = windowIssues(project);
    const cutList = stampLabels(windowCuts(project));
    const bom = decorateBom(windowBom(project));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      feasibility: {
        status: wIssues.some((i) => i.severity === "critical") ? "critical" : wIssues.some((i) => i.severity === "warning") ? "warnings" : "ok",
        summary: "Framing package for this rough opening. Guidance only.",
        issues: wIssues,
      },
      cutList,
      bom,
      instructions: windowSteps(project),
      totals: { pieces: project.panels.length, estCostUsd: cost, packs: bom.reduce((s, b) => s + b.quantity, 0) },
      effort: "1/2-day",
      generatedAt: new Date().toISOString(),
      render: project.render,
      partsKind: "cut",
    };
  }

  if (project.panels.length > 0 && !project.instances.length) {
    if (project.fitted || project.pocket || project.kind === "closet") {
      issues.push({
        severity: "info",
        message: `${project.name} — ${project.fitted?.program ?? "closet"}.`,
        suggestion: "Measure is live. Change W x H x D to refit. Drawers, knee, and doors stay with the program.",
      });
    }
    const cutList = closetCuts(project);
    const bom = decorateBom(closetBom(project, cutList));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const status = issues.some((i) => i.severity === "critical")
      ? "critical"
      : issues.some((i) => i.severity === "warning")
        ? "warnings"
        : "ok";
    return {
      feasibility: {
        status,
        summary: `${project.panels.length} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, project.panels.length)} · ~$${cost.toFixed(0)}`,
        issues,
      },
      cutList,
      bom,
      instructions: uniqueSteps(project),
      totals: {
        pieces: project.panels.length,
        estCostUsd: cost,
        packs: bom.reduce((s, b) => s + b.quantity, 0),
      },
      effort: effortLabel(project, project.panels.length),
      generatedAt: new Date().toISOString(),
      render: project.render,
      partsKind: "cut",
    };
  }

  if (project.instances.length === 0) {
    return {
      feasibility: {
        status: "critical",
        summary: "Nothing on the bench yet.",
        issues: [{ severity: "critical", message: "Empty structure", suggestion: "Generate a thing first." }],
      },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 0, estCostUsd: 0, packs: 0 },
      generatedAt: new Date().toISOString(),
    };
  }

  const item = getCatalogItem(project.primaryMaterialId);
  issues.push(...loadIssues(project));
  const forgeBom = buildForgeBom(project.instances, project.primaryMaterialId);
  const binders = item && project.instances.length ? binderBom(item, project.instances, project.joinMethod) : [];
  const whole = !!item && isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  const bom = decorateBom([...bomLinesFromForge(forgeBom), ...panelBomLines(project), ...binders]);
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const pieces = forgeBom.totalPieces + project.panels.length;

  return {
    feasibility: {
      status: issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok",
      summary: `${pieces} pieces of ${item?.name ?? "stock"} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(2)}`,
      issues,
    },
    cutList: [],
    bom,
    instructions: uniqueSteps(project),
    totals: { pieces, estCostUsd: cost, packs: bom.reduce((s, b) => s + b.quantity, 0) },
    effort: effortLabel(project, pieces),
    generatedAt: new Date().toISOString(),
    render: project.render,
    partsKind: whole ? "whole" : "cut",
  };
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  const lines = [
    `# ${project.name}`,
    plan.feasibility.summary,
    "",
    "## Cut list",
    ...plan.cutList.map((c) => `- ${c.label ?? ""} ${c.quantity}x ${c.name} ${c.lengthIn}" x ${c.widthIn}" x ${c.thicknessIn}"`),
    "",
    "## Buy",
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}`),
    "",
    "## Build",
    ...plan.instructions.map((s) => `${s.step}. ${s.title} — ${s.description}`),
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}
