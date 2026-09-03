import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { uniqueSteps } from "./uniqueSteps";
import { decorateBom } from "./listings";
import { binderBom, effectiveJoin } from "./joints";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import { loadIssues, panelBomLines } from "./function";
import { slideInches } from "./stockLook";
import { cutListName, sheetCutDims } from "./shopPlural";
import { nestCutList } from "./nesting";
import { honestPlan, wantsRackAffordance } from "./honesty";
import { honestWeekendPlan } from "./weekendStockHonesty";
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
  return cutListName(name, type);
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
      ...sheetCutDims(w, h, d),
      material: item?.name ?? p.materialId,
    });
  }
  return stampLabels([...grouped.values()]);
}

function closetBom(project: YardProject, cuts: CutLine[]): BuildPlan["bom"] {
  const sheet = getCatalogItem(project.primaryMaterialId) ?? getCatalogItem("plywood-3-4-4x8");
  const screws = Math.max(16, project.panels.length * 6);
  const isTable = project.fitted?.program === "table";
  const legCuts = cuts.filter((c) => /^leg$/i.test(c.name));
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
      catalogId: "lumber-2x2-8",
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
  const headboard =
    /headboard/i.test(project.name) ||
    /headboard/.test((project.prompt ?? "").toLowerCase());
  const coatRack =
    /coat/i.test(project.name) ||
    (/coat/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  const island = /island/i.test(project.name) || /island/.test((project.prompt ?? "").toLowerCase());
  const crate = /crate/i.test(project.name) || /crate/.test((project.prompt ?? "").toLowerCase());
  const nightstand =
    /nightstand|bedside/i.test(project.name) ||
    /nightstand|bedside/.test((project.prompt ?? "").toLowerCase());
  const floating =
    (/floating|wall-?mounted/i.test(project.name) ||
      /floating|wall-?mounted/.test((project.prompt ?? "").toLowerCase())) &&
    /shel/i.test(`${project.name} ${project.prompt ?? ""}`);
  const ironing =
    /ironing/i.test(project.name) ||
    /ironing/.test((project.prompt ?? "").toLowerCase());
  const medicine =
    /medicine/i.test(project.name) ||
    /medicine/.test((project.prompt ?? "").toLowerCase());
  const overToilet =
    /over-toilet/i.test(project.name) ||
    /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf)|space[- ]?saver/.test((project.prompt ?? "").toLowerCase());
  const spice =
    /spice/i.test(project.name) ||
    (/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  const wine =
    /wine/i.test(project.name) ||
    (/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  // Single-slab headboard has no carcase joints — skip join screws.
  // Floating shelves only need a few screws shelf→cleat (not a carcase box).
  if (!headboard) {
    const joinScrews = floating ? Math.max(8, project.panels.filter((p) => p.type === "shelf").length * 4) : screws;
    bom.push({
      name: '#8 x 1-1/4" wood screws',
      quantity: Math.ceil(joinScrews / 50),
      unit: "box",
      catalogId: "screws-8",
      searchQuery: "#8 wood screws 1-1/4",
      estimatedCost: 8,
      notes: floating
        ? `${joinScrews} screws shelf into cleat (no carcase joints).`
        : `${joinScrews} screws estimated at joints.`,
    });
  }
  const drawers = project.panels.filter((panel) => panel.type === "drawer");
  if (drawers.length) {
    const carcaseD =
      project.pocket?.unit.depth ?? project.fitted?.unit.depth ?? project.overall.depth;
    const slide = slideInches(carcaseD);
    bom.push({
      name: `${slide}" side-mount drawer slides`,
      quantity: drawers.length,
      unit: drawers.length === 1 ? "pair" : "pairs",
      catalogId: `drawer-slides-${slide}`,
      searchQuery: `${slide} inch side mount drawer slides`,
      estimatedCost: 14.98 * drawers.length,
      notes: `One pair per drawer (${drawers.length} drawers). Confirm slide length against the ${carcaseD}" carcase.`,
    });
    bom.push({
      name: "Cup pulls",
      quantity: 1,
      unit: "pack",
      searchQuery: "3 inch cup pulls cabinet drawer",
      estimatedCost: 12.98,
      notes: `One cup pull centered on each drawer front (${drawers.length} drawer${drawers.length === 1 ? "" : "s"}).`,
    });
  }
  if (coatRack) {
    const hooks = Math.max(3, Math.min(8, Math.round(project.overall.width / 6)));
    bom.push({
      name: "Coat hooks",
      quantity: 1,
      unit: "pack",
      catalogId: "coat-hooks",
      searchQuery: "coat hooks wall mount 6 pack",
      estimatedCost: 12.98,
      notes: `${hooks} hooks, 6" on center into the peg rail.`,
    });
  }
  const doors = project.panels.filter((panel) => panel.type === "door");
  if (doors.length) {
    if (crate) {
      bom.push({
        name: '3" utility hinges',
        quantity: 1,
        unit: "pair",
        searchQuery: "3 inch utility hinges pair",
        estimatedCost: 6.98,
        notes: "Two hinges on the door, screwed into the left upright.",
      });
      bom.push({
        name: "Barrel bolt latch",
        quantity: 1,
        unit: "pc",
        searchQuery: "3 inch barrel bolt latch",
        estimatedCost: 5.98,
        notes: "Latch the door into the right upright so it stays shut.",
      });
    } else {
      bom.push({
        name: "Soft-close concealed cabinet hinges",
        quantity: doors.length,
        unit: doors.length === 1 ? "pair" : "pairs",
        catalogId: "cabinet-hinges",
        searchQuery: "soft close concealed cabinet hinges",
        estimatedCost: 8.99 * doors.length,
        notes: `Two hinges per door (${doors.length * 2} hinges / ${doors.length} pair${doors.length === 1 ? "" : "s"}).`,
      });
    }
  }
  if (medicine) {
    bom.push({
      name: "Mirror for the door",
      quantity: 1,
      unit: "pc",
      searchQuery: "adhesive bathroom cabinet mirror",
      estimatedCost: 14.98,
      notes: "Glue to the outside of the door so the cabinet mirrors when closed. Order or cut close to the door size.",
    });
  }
  if (ironing) {
    bom.push({
      name: "Piano hinge",
      quantity: 1,
      unit: "pc",
      searchQuery: "1-1/2 inch x 48 inch piano hinge continuous",
      estimatedCost: 14.98,
      notes: "Continuous hinge along the bottom edge of the ironing board so it folds down.",
    });
    bom.push({
      name: "Ironing board cover",
      quantity: 1,
      unit: "pc",
      searchQuery: "tabletop ironing board cover pad",
      estimatedCost: 12.99,
      notes: "Heat-resistant pad and cover for the plywood board. Staple or clip it on.",
    });
  }
  const hangingRods = project.panels.filter(
    (panel) => /hanging rod/i.test(panel.name),
  );
  if (hangingRods.length) {
    bom.push({
      name: "Closet rod sockets",
      quantity: hangingRods.length,
      unit: hangingRods.length === 1 ? "pair" : "pairs",
      catalogId: "closet-rod-sockets",
      searchQuery: "closet rod sockets flanges pair",
      estimatedCost: 7.98 * hangingRods.length,
      notes: `One pair of sockets/flanges per hanging rod (${hangingRods.length} rod${hangingRods.length === 1 ? "" : "s"}). Seat on that bay's uprights or dividers. A rod cannot pass through a divider.`,
    });
  }
  const shelfCount = project.panels.filter((panel) => panel.type === "shelf").length;
  // Floating shelves sit on wall cleats — no adjustable pins, no uprights to drill.
  if (shelfCount > 0 && !coatRack && !island && !nightstand && !floating && !ironing && !spice && !wine && !wantsRackAffordance(project.prompt ?? "")) {
    const pins = shelfCount * 4;
    const packs = Math.max(1, Math.ceil(pins / 50));
    bom.push({
      name: "5 mm shelf pins",
      quantity: packs,
      unit: packs === 1 ? "pack" : "packs",
      catalogId: "shelf-pins",
      searchQuery: "5mm shelf pins",
      estimatedCost: 6.49 * packs,
      notes: `${pins} pins (${shelfCount} shel${shelfCount === 1 ? "f" : "ves"} × 4). Do not glue the shelves — the pins hold them.`,
    });
  }
  if (!headboard) {
    bom.push({
      name: "Wood glue",
      quantity: 1,
      unit: "bottle",
      catalogId: "glue",
      searchQuery: "titebond wood glue",
      estimatedCost: 5.47,
    });
  }
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
      notes: headboard
        ? "4-6 screws through the board into studs (or a french cleat). Guidance only — confirm wall type."
        : coatRack
          ? "4-6 screws through the peg rail into studs. Guidance only — confirm wall type."
          : floating
            ? "2-3 screws per wall cleat into studs. Guidance only — confirm wall type."
          : ironing
            ? "4-6 screws through the plywood back into studs. A loaded ironing board will rip it off drywall anchors. Guidance only — confirm wall type."
          : medicine
            ? "4 screws through the plywood back into studs. A loaded medicine cabinet will rip off drywall anchors. Guidance only — confirm wall type."
          : overToilet
            ? "4-6 screws through the uprights into studs so the unit cannot tip onto the toilet. Guidance only — confirm wall type."
          : spice
            ? "4 screws through the plywood back into studs. A loaded spice rack will rip off drywall anchors. Guidance only — confirm wall type."
          : wine
            ? "4-6 screws through the plywood back into studs. A loaded wine rack will rip off drywall anchors. Guidance only — confirm wall type."
          : project.panels.some((p) => p.type === "upright")
            ? "4-6 screws through the uprights into studs (or masonry anchors). Guidance only — confirm wall type."
            : "4-6 screws through the board into studs. Guidance only — confirm wall type.",
    });
  }
  return decorateBom(bom);
}

function closetIssues(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const { width, height, depth } = project.overall;
  const coatRack =
    /coat/i.test(project.name) ||
    (/coat/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  const headboard =
    /headboard/i.test(project.name) ||
    /headboard/.test((project.prompt ?? "").toLowerCase());
  const floatingIssue =
    (/floating|wall-?mounted/i.test(project.name) ||
      /floating|wall-?mounted/.test((project.prompt ?? "").toLowerCase())) &&
    /shel/i.test(`${project.name} ${project.prompt ?? ""}`);
  if (!coatRack && !headboard && !floatingIssue && !/crate/i.test(project.name) && !/ironing/i.test(project.name) && !/ironing/.test((project.prompt ?? "").toLowerCase()) && !/medicine/i.test(project.name) && !/medicine/.test((project.prompt ?? "").toLowerCase()) && !/over-toilet/i.test(project.name) && !/spice/i.test(project.name) && !(/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && !/wine/i.test(project.name) && !(/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && (width < 12 || height < 12 || depth < 8)) {
    issues.push({
      severity: "warning",
      message: "Opening is tight — confirm the measure before you cut.",
    });
  }
  return issues;
}

function packPlan(
  project: YardProject,
  issues: FeasibilityIssue[],
  summary: string,
  cutList: CutLine[],
  bom: BuildPlan["bom"],
  instructions: AssemblyStep[],
  pieces: number,
  cost: number,
  partsKind: "cut" | "whole" = "cut",
): BuildPlan {
  return {
    feasibility: {
      status: issues.some((i) => i.severity === "critical")
        ? "critical"
        : issues.some((i) => i.severity === "warning")
          ? "warnings"
          : "ok",
      summary,
      issues,
    },
    cutList,
    bom,
    instructions,
    totals: {
      pieces,
      estCostUsd: cost,
      packs: bom.reduce((s, b) => s + b.quantity, 0),
    },
    effort: effortLabel(project, pieces),
    generatedAt: new Date().toISOString(),
    render: project.render,
    partsKind,
  };
}

export function buildPlan(project: YardProject): BuildPlan {
  if (project.kind === "opening" && project.windowPkg) {
    const cutList = stampLabels(windowCuts(project));
    const bom = decorateBom(windowBom(project));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const issues = windowIssues(project);
    const pieces = cutList.reduce((s, c) => s + c.quantity, 0);
    return packPlan(
      project,
      issues,
      `${pieces} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, 0)} · ~$${cost.toFixed(0)}`,
      cutList,
      bom,
      windowSteps(project),
      pieces,
      cost,
    );
  }

  if (project.kind === "closet" || project.fitted || project.panels.length > 0) {
    const cutList = closetCuts(project);
    const bom = closetBom(project, cutList);
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const issues: FeasibilityIssue[] = [
      {
        severity: "info",
        message: `${project.name} — ${
          /headboard/i.test(project.name) || /headboard/.test((project.prompt ?? "").toLowerCase())
            ? "headboard"
            : /coat/i.test(project.name)
              ? "coat rack"
              : /crate/i.test(project.name) || /crate/.test((project.prompt ?? "").toLowerCase())
                ? "crate"
              : /ironing/i.test(project.name) || /ironing/.test((project.prompt ?? "").toLowerCase())
                ? "ironing cabinet"
              : /medicine/i.test(project.name) || /medicine/.test((project.prompt ?? "").toLowerCase())
                ? "medicine cabinet"
              : /wine/i.test(project.name) ||
                  (/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()))
                ? "wine rack"
              : /spice/i.test(project.name) ||
                  (/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()))
                ? "spice rack"
              : /nightstand|bedside/i.test(project.name) ||
                  /nightstand|bedside/.test((project.prompt ?? "").toLowerCase())
                ? "nightstand"
              : (project.fitted?.program ?? "closet")
        }.`,
        suggestion: "Measure is live. Change W × H × D to refit.",
      },
      ...closetIssues(project),
      ...loadIssues(project),
    ];
    const pieces = project.panels.length;
    return honestPlan(
      project,
      packPlan(
        project,
        issues,
        `${pieces} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(0)}`,
        cutList,
        bom,
        uniqueSteps(project),
        pieces,
        cost,
      ),
    );
  }

  const item = getCatalogItem(project.primaryMaterialId);
  const pieces = project.instances.length;
  const forge = buildForgeBom(project.instances, project.primaryMaterialId);
  const glue = item ? binderBom(item, project.instances, project.joinMethod) : [];
  const bom = decorateBom([
    ...bomLinesFromForge(forge),
    ...glue,
  ]);
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const whole = !!item && isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  const issues = loadIssues(project);
  if (pieces === 0) {
    return packPlan(
      project,
      [{ severity: "critical", message: "Empty structure", suggestion: "Generate a thing first." }],
      "Nothing on the bench yet.",
      [],
      [],
      [],
      0,
      0,
    );
  }
  return honestWeekendPlan(
    project,
    packPlan(
      project,
      issues,
      `${pieces} pieces of ${item?.name ?? "stock"} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(2)}`,
      [],
      bom,
      uniqueSteps(project),
      pieces,
      cost,
      whole ? "whole" : "cut",
    ),
  );
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  return [
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
  ].join("\n");
}
