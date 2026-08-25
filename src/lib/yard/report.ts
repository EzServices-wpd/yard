import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { framingNotes, matchWindows } from "./space";
import { uniqueSteps } from "./steps";
import { decorateBom } from "./listings";
import { binderBom, effectiveJoin } from "./joints";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import { loadIssues, panelBomLines } from "./function";
import { slideInches } from "./stockLook";
import { nestCutList } from "./nesting";
import type { AssemblyStep, BuildPlan, CutLine, FeasibilityIssue, YardProject } from "./types";

function roleOf(role?: string) {
  return role ?? "member";
}

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
  if (type === "deck") return "Deck";
  if (type === "rail") return "Rail";
  return name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Top|Bottom)\s+/i, "") || name;
}

function effortLabel(project: YardProject, pieces: number): string {
  if (project.kind === "opening") return "1/2-day";
  if (project.pocket) return project.panels.length > 18 ? "weekend" : "1-day";
  if (project.fitted || project.kind === "closet") {
    if (project.panels.length <= 10) return "1/2-day";
    if (project.panels.length <= 20) return "1-day";
    return "weekend";
  }
  if (pieces <= 30) return "an hour";
  if (pieces <= 120) return "1/2-day";
  if (pieces <= 400) return "1-day";
  if (pieces <= 900) return "weekend";
  if (pieces <= 2000) return "a week";
  return "a month";
}

function closetFeasibility(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const load = project.assumptions.load;
  const program = project.fitted?.program;
  const workTop = program === "desk" || program === "vanity";
  for (const p of project.panels) {
    if (p.type !== "shelf" && p.type !== "glass_panel" && p.type !== "top" && p.type !== "bottom") continue;
    const span = p.size.width;
    if (workTop && (p.type === "top" || p.type === "bottom")) {
      if (span > 60) {
        issues.push({
          severity: "warning",
          message: `${p.name} spans ${span.toFixed(1)}" — a stretcher under the middle keeps it honest.`,
          suggestion: "A 1x or 2x apron front-to-back, or a center divider, is Saturday-DIY for a 5-ft top.",
        });
      } else if (span > 48) {
        issues.push({
          severity: "info",
          message: `${p.name} spans ${span.toFixed(1)}". Fine for a desk if you add an apron.`,
          suggestion: "Glue a front stretcher. Bookshelves of books are a different load.",
        });
      }
      continue;
    }
    if (span > 42) {
      issues.push({
        severity: "warning",
        message: `${p.name} spans ${span.toFixed(1)}" — add a divider if this will hold books.`,
        suggestion: "A center upright drops the span in half.",
      });
    } else if (span > 36 && p.type === "shelf") {
      issues.push({
        severity: "info",
        message: `${p.name} spans ${span.toFixed(1)}" — OK for light loads.`,
        suggestion: `Heavy books want a divider under ${load === "heavy" ? "24" : "30"}".`,
      });
    }
  }
  return issues;
}

function closetCuts(project: YardProject): CutLine[] {
  const groups = new Map<string, { qty: number; name: string; lengthIn: number; widthIn: number; thicknessIn: number; type?: string }>();
  for (const p of project.panels) {
    const L = Math.max(p.size.width, p.size.height);
    const W = Math.min(p.size.width, p.size.height);
    const T = p.size.depth;
    const family = partFamily(p.name, p.type);
    const key = `${family}|${L.toFixed(3)}|${W.toFixed(3)}|${T.toFixed(3)}`;
    const g = groups.get(key);
    if (g) g.qty += 1;
    else groups.set(key, { qty: 1, name: family, lengthIn: L, widthIn: W, thicknessIn: T, type: p.type });
  }
  const lines: CutLine[] = [...groups.values()].map((g) => ({
    name: g.name,
    qty: g.qty,
    lengthIn: g.lengthIn,
    widthIn: g.widthIn,
    thicknessIn: g.thicknessIn,
    materialId: project.primaryMaterialId,
  }));
  return stampLabels(lines);
}

function closetBom(project: YardProject): BuildPlan["bom"] {
  const bom: BuildPlan["bom"] = [];
  const nestParts = project.panels
    .filter((p) => p.size.depth >= 0.5)
    .map((p) => ({
      id: p.id,
      w: Math.max(p.size.width, p.size.height),
      h: Math.min(p.size.width, p.size.height),
      grain: "long" as const,
      label: p.name,
    }));
  const nest = nestCutList(nestParts);
  const sheets = Math.max(1, nest.totalSheets ?? 1);
  bom.push({
    name: '3/4" Plywood 4x8',
    quantity: sheets,
    unit: "sheet",
    searchQuery: '3/4" x 4x8 Sande sanded plywood',
    estimatedCost: sheets * 38.43,
    notes: `From nest · ${sheets} sheet${sheets === 1 ? "" : "s"} · 1/8" kerf included.`,
  });
  const thin = project.panels.filter((p) => p.size.depth < 0.5);
  if (thin.length) {
    bom.push({
      name: '1/4" plywood 4x8 (backer)',
      quantity: 1,
      unit: "sheet",
      searchQuery: '1/4 inch x 4x8 plywood',
      estimatedCost: 24.98,
      notes: `1 thin back panel (${thin[0]?.name ?? "A"}) — not nested on the 3/4" sheets.`,
    });
  }
  bom.push({
    name: '#8 x 1-1/4" wood screws',
    quantity: 2,
    unit: "box",
    searchQuery: '#8 x 1-1/4 wood screws',
    estimatedCost: 18.58,
    notes: "66 screws estimated at joints.",
  });
  bom.push({
    name: "Wood glue",
    quantity: 1,
    unit: "bottle",
    searchQuery: "Titebond Original wood glue 8 oz",
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
  const doors = project.panels.filter((p) => p.type === "door");
  const drawers = project.panels.filter((p) => p.type === "drawer");
  const shelves = project.panels.filter((p) => p.type === "shelf");
  if (doors.length) {
    bom.push({
      name: "Concealed cabinet hinges",
      quantity: doors.length * 2,
      unit: "hinge",
      searchQuery: "soft close concealed cabinet hinges",
      estimatedCost: doors.length * 8.99,
    });
  }
  if (drawers.length) {
    const slide = slideInches(project.overall.depth);
    bom.push({
      name: `${slide}" side-mount drawer slides`,
      quantity: drawers.length,
      unit: "pair",
      searchQuery: `${slide} inch side mount drawer slides`,
      estimatedCost: drawers.length * 12,
    });
  }
  if (shelves.length) {
    bom.push({
      name: "Shelf pins 5mm",
      quantity: 1,
      unit: "pack",
      searchQuery: "5mm shelf pins",
      estimatedCost: 6.49,
      notes: `${shelves.length} adjustable shelves x 4 pins.`,
    });
  }
  return decorateBom(bom);
}

export function buildPlan(project: YardProject): BuildPlan {
  if (project.kind === "opening") {
    const cuts = windowCuts(project);
    const bom = windowBom(project);
    const steps = windowSteps(project);
    const issues = windowIssues(project);
    return {
      title: project.name,
      summary: project.notes[0] ?? project.name,
      effort: effortLabel(project, cuts.reduce((s, c) => s + c.qty, 0)),
      partsKind: "cut",
      cuts,
      bom,
      instructions: steps,
      issues,
      totals: {
        pieces: cuts.reduce((s, c) => s + c.qty, 0),
        estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0),
      },
    };
  }

  if (project.panels.length && !project.instances.length) {
    const cuts = closetCuts(project);
    const bom = closetBom(project);
    const steps = uniqueSteps(project);
    const issues = [...closetFeasibility(project), ...loadIssues(project), ...panelBomLines(project).issues];
    const est = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      title: project.name,
      summary: `${project.name} — ${project.fitted?.program ?? (project.pocket ? "vanity" : "closet")}.`,
      effort: effortLabel(project, project.panels.length),
      partsKind: "cut",
      cuts,
      bom,
      instructions: steps,
      issues,
      totals: { pieces: project.panels.length, estCostUsd: Math.round(est * 100) / 100 },
    };
  }

  if (project.instances.length) {
    const forge = buildForgeBom(project);
    const bom = decorateBom([...forge.bom, ...binderBom(project)]);
    const steps = uniqueSteps(project);
    const cuts = stampLabels(
      project.instances
        .filter((i) => i.cutLength)
        .reduce<CutLine[]>((acc, i) => {
          const item = getCatalogItem(i.catalogId || project.primaryMaterialId);
          const prim = item ? toPrimitive(item, i.cutLength) : null;
          const len = prim?.length ?? i.cutLength ?? 0;
          if (!len) return acc;
          const existing = acc.find((c) => Math.abs(c.lengthIn - len) < 0.05);
          if (existing) existing.qty += 1;
          else
            acc.push({
              name: roleOf(i.role),
              qty: 1,
              lengthIn: len,
              widthIn: prim?.width ?? 0.75,
              thicknessIn: prim?.height ?? 0.75,
              materialId: i.catalogId || project.primaryMaterialId,
            });
          return acc;
        }, []),
    );
    const whole = !!getCatalogItem(project.primaryMaterialId) && isWholeStock(getCatalogItem(project.primaryMaterialId)!) && project.instances.every((i) => !i.cutLength);
    const est = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      title: project.name,
      summary: project.notes[0] ?? project.name,
      effort: effortLabel(project, project.instances.length),
      partsKind: whole ? "whole" : "cut",
      cuts,
      bom,
      instructions: steps,
      issues: forge.issues ?? [],
      totals: { pieces: project.instances.length, estCostUsd: Math.round(est * 100) / 100 },
    };
  }

  return {
    title: project.name,
    summary: "Empty bench.",
    effort: "—",
    partsKind: "cut",
    cuts: [],
    bom: [],
    instructions: uniqueSteps(project),
    totals: { pieces: 0, estCostUsd: 0 },
  };
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  const lines: (string | undefined)[] = [
    `# ${plan.title}`,
    plan.summary,
    plan.effort ? `Effort: ${plan.effort}` : undefined,
    plan.totals?.estCostUsd != null ? `Est. cost: $${plan.totals.estCostUsd}` : undefined,
    "",
    "## Cut list",
    ...plan.cuts.map((c) => `- ${c.label ?? ""} ${c.qty}x ${c.name} ${c.lengthIn}" × ${c.widthIn}" × ${c.thicknessIn}"`),
    "",
    "## Buy",
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}${b.estimatedCost != null ? ` (~$${b.estimatedCost})` : ""}`),
    "",
    "## Build",
    ...plan.instructions.flatMap((s) => [`### ${s.step}. ${s.title}`, s.description, s.tips ? `Tip: ${s.tips}` : undefined, ""]),
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}
