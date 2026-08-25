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
  if (project.pocket) {
    const p = project.pocket;
    issues.push({
      severity: "info",
      message: `Trapezoidal pocket. Unit ${p.unit.width}" x ${p.unit.depth}" x ${p.unit.height}" on the back-wall centerline.`,
      suggestion: `Front clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}". The unit stays rectangular. The walls are the thing that flare.`,
    });
    if (p.leftClear < 0.5 || p.rightClear < 0.5) {
      issues.push({
        severity: "critical",
        message: "Unit hits a side wall at this depth.",
        suggestion: "Pull the unit shallower or narrow it until both clearances are at least 1/2\".",
      });
    } else if (p.rightClear < 2 || p.leftClear < 2) {
      issues.push({
        severity: "warning",
        message: `Tight side: L ${p.leftClear.toFixed(1)}" / R ${p.rightClear.toFixed(1)}".`,
        suggestion: "Scribe the near upright. You will not get a full-depth filler on the tight side.",
      });
    }
    if (p.unit.kneeW < 21) {
      issues.push({
        severity: "warning",
        message: `Knee space is ${p.unit.kneeW}" — under the 22" sitting clearance.`,
        suggestion: "Steal an inch from each drawer bank if someone will actually sit here.",
      });
    }
    issues.push({
      severity: "info",
      message: "Anchor into studs — back and both uprights.",
      suggestion: "Find studs on the back wall first. This unit is 102\" of towels and a person leaning on the counter. Drywall anchors are not enough.",
    });
  } else if (project.fitted) {
    const u = project.fitted.unit;
    issues.push({
      severity: "info",
      message: `${project.fitted.name} — ${project.fitted.program}.`,
      suggestion: "Measure is live. Change W x H x D to refit. Drawers, knee, and doors stay with the program.",
    });
    if (u.kneeW && u.kneeW < 21 && (project.fitted.program === "vanity" || project.fitted.program === "desk")) {
      issues.push({
        severity: "warning",
        message: `Knee space is ${u.kneeW}".`,
        suggestion: "22\" is the usual sitting clearance.",
      });
    }
  } else if (project.opening) {
    issues.push({
      severity: "info",
      message: `Fitted to a ${project.opening.width}" x ${project.opening.height}" x ${project.opening.depth}" ${project.opening.kind}.`,
      suggestion: "Measure twice. Out-of-square openings need scribed uprights.",
    });
  }
  return issues;
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
  const cardboard = sheet?.category === "cardboard" || (sheet?.formFactor === "sheet" && sheet?.unitCostUsd === 0.5);
  const screws = Math.max(16, project.panels.length * 6);

  // Structural 3/4" sheets from the real nest (not a 70% area guess).
  // Thin backs (< 1/2") are excluded from the nest — buy 1/4" separately.
  const structural = cuts.filter((c) => (c.thicknessIn ?? 0.75) >= 0.5);
  const thinBacks = cuts.filter((c) => (c.thicknessIn ?? 0.75) < 0.5);
  const nest = structural.length ? nestCutList(structural) : null;
  const sheets = Math.max(1, nest?.totalSheets ?? nest?.sheets.length ?? 1);

  const bom: BuildPlan["bom"] = [
    {
      name: sheet?.name ?? '3/4" plywood 4x8',
      quantity: sheets,
      unit: "sheet",
      catalogId: sheet?.id,
      searchQuery: sheet?.searchQuery,
      estimatedCost: (sheet?.unitCostUsd ?? 55) * sheets,
      notes: cardboard
        ? "Corrugated — save boxes if you have them."
        : nest
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
      estimatedCost: 28,
      notes: `${thinQty} thin back panel${thinQty === 1 ? "" : "s"} (${thinBacks.map((c) => c.label ?? c.name).join(", ")}) — not nested on the 3/4" sheets.`,
    });
  }
  if (cardboard || sheet?.preferredJoins?.[0] === "tape") {
    bom.push({
      name: "Packing tape",
      quantity: 1,
      unit: "roll",
      searchQuery: "packing tape",
      estimatedCost: 4,
      notes: "Tape every seam. Inside and out if it has to stand.",
    });
  } else {
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
      estimatedCost: 8,
    });
  }
  if (project.assumptions.installMode !== "freestanding") {
    bom.push({
      name: project.assumptions.wallType === "masonry" ? "Tapcon masonry screws" : "Structural wood screws / lag",
      quantity: 1,
      unit: "box",
      searchQuery: project.assumptions.wallType === "masonry" ? "Tapcon concrete screws" : "GRK RSS structural screws",
      estimatedCost: 14,
      notes: "Anchor the carcase into studs. Guidance only.",
    });
  }
  if (project.pocket || project.fitted) {
    const drawers = project.panels.filter((p) => p.type === "drawer").length;
    const doors = project.panels.filter((p) => p.type === "door").length;
    const shelves = project.panels.filter((p) => p.type === "shelf").length;
    if (drawers) {
      const depth = project.fitted?.unit.depth ?? project.pocket?.unit.depth ?? 16;
      const slide = slideInches(depth);
      bom.push({
        name: `Side-mount drawer slides ${slide}"`,
        quantity: drawers,
        unit: "pair",
        searchQuery: `${slide} inch side mount drawer slides`,
        estimatedCost: drawers * 12,
        notes: `Pair per drawer. Confirm depth against the ${depth}" carcase.`,
      });
      bom.push({
        name: "Cup pulls",
        quantity: drawers,
        unit: "pull",
        searchQuery: "3 inch cup pull cabinet",
        estimatedCost: drawers * 6,
        notes: "One per drawer front, centered.",
      });
      if (project.fitted?.program === "desk" || project.fitted?.program === "vanity") {
        bom.push({
          name: "Iron-on edge banding",
          quantity: 1,
          unit: "roll",
          searchQuery: "3/4 inch iron on edge banding birch",
          estimatedCost: 12,
          notes: "Front of the top and the drawer fronts — the plywood people see.",
        });
      }
    }
    if (doors) {
      bom.push({
        name: "Concealed cabinet hinges",
        quantity: doors * 2,
        unit: "hinge",
        searchQuery: "soft close concealed cabinet hinges",
        estimatedCost: doors * 8,
      });
    }
    if (shelves) {
      bom.push({
        name: "Shelf pins 5mm",
        quantity: 1,
        unit: "pack",
        searchQuery: "5mm shelf pins",
        estimatedCost: 6,
        notes: `${shelves} adjustable shelves x 4 pins.`,
      });
    }
    if (project.panels.some((p) => p.type === "mirror")) {
      const knee = project.pocket?.unit.kneeW ?? project.fitted?.unit.kneeW ?? 22;
      const mh =
        (project.pocket
          ? project.pocket.unit.upperStart - project.pocket.unit.vanityH - 3
          : (project.fitted?.unit.upperStart ?? 54) - (project.fitted?.unit.counterH ?? 34) - 3) || 16;
      bom.push({
        name: "Vanity mirror",
        quantity: 1,
        unit: "mirror",
        searchQuery: `${Math.round(knee)}" x ${Math.round(mh)}" vanity mirror`,
        estimatedCost: 40,
        notes: "Size to the knee bay, between counter and uppers.",
      });
    }
  }
  return bom;
}

export function buildPlan(project: YardProject): BuildPlan {
  const issues: FeasibilityIssue[] = [];

  if (project.kind === "opening" && (project.windowPkg || project.opening?.kind === "window")) {
    const issues = windowIssues(project);
    if (!project.windowPkg && project.opening) {
      issues.push({
        severity: "info",
        message: `Window rough opening ${project.opening.width}" x ${project.opening.height}".`,
      });
      for (const note of framingNotes(project.opening.width, project.opening.height)) {
        issues.push({ severity: "info", message: note });
      }
    }
    const cutList = stampLabels(windowCuts(project));
    const bom = decorateBom(windowBom(project));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      feasibility: {
        status: issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok",
        summary: project.windowPkg
          ? `${project.windowPkg.window.brand} ${project.windowPkg.window.callW}x${project.windowPkg.window.callH} + framing · 1/2-day · ~$${cost.toFixed(0)}`
          : "Framing package for this rough opening. Guidance only — check local code.",
        issues,
      },
      cutList,
      bom,
      instructions: windowSteps(project),
      totals: {
        pieces: project.panels.length,
        estCostUsd: cost,
        packs: bom.reduce((s, b) => s + b.quantity, 0),
      },
      effort: "1/2-day",
      generatedAt: new Date().toISOString(),
      render: project.render,
      partsKind: "cut",
    };
  }

  if (project.panels.length > 0 && !project.instances.length) {
    if (project.pocket || project.fitted || project.kind === "closet") {
      issues.push(...closetFeasibility(project));
    } else {
      issues.push({
        severity: "info",
        message: `${project.name} — ${project.panels.length} panels in ${getCatalogItem(project.primaryMaterialId)?.name ?? "sheet stock"}.`,
        suggestion: project.notes[0],
      });
    }
    const cutList = closetCuts(project);
    const bom = closetBom(project, cutList);
    const status = issues.some((i) => i.severity === "critical")
      ? "critical"
      : issues.some((i) => i.severity === "warning")
        ? "warnings"
        : "ok";
    const decorated = decorateBom(bom);
    const cost = decorated.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      feasibility: {
        status,
        summary:
          status === "ok"
            ? `${project.panels.length} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, project.panels.length)} · ~$${cost.toFixed(0)}`
            : "Review the notes before you cut.",
        issues,
      },
      cutList,
      bom: decorated,
      instructions: uniqueSteps(project),
      totals: {
        pieces: project.panels.length,
        estCostUsd: cost,
        packs: decorated.reduce((s, b) => s + b.quantity, 0),
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
        issues: [
          {
            severity: "critical",
            message: "Empty structure",
            suggestion: 'Try "3 foot Eiffel Tower from popsicle sticks" or place a piece from the catalog.',
          },
        ],
      },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 0, estCostUsd: 0, packs: 0 },
      generatedAt: new Date().toISOString(),
    };
  }

  const item = getCatalogItem(project.primaryMaterialId);
  const join = item ? effectiveJoin(item, project.joinMethod) : "glue";
  if (join === "glue") {
    issues.push({
      severity: "info",
      message: "Primary join: glue",
      suggestion: "Wood glue or multi-purpose craft glue. Clamp or hold 30–60s. Overnight cure.",
    });
  } else if (join === "solvent") {
    issues.push({
      severity: "info",
      message: "Primary join: solvent cement",
      suggestion: "PVC cement is permanent. Dry-fit everything first.",
    });
  }
  issues.push(...loadIssues(project));

  const forgeBom = buildForgeBom(project.instances, project.primaryMaterialId);
  const binders =
    item && project.instances.length
      ? binderBom(item, project.instances, project.joinMethod)
      : [];
  const whole = !!item && isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  const cutMap = new Map<string, CutLine & { roles: Set<string> }>();
  for (const inst of project.instances) {
    const cat = getCatalogItem(inst.catalogId);
    if (!cat) continue;
    const prim = toPrimitive(cat, inst.cutLength);
    const stockLen = toPrimitive(cat).length;
    const raw = inst.cutLength ?? prim.length;
    const len = whole
      ? stockLen
      : Math.abs(raw - stockLen) / Math.max(stockLen, 0.5) < 0.06
        ? stockLen
        : Math.round(raw * 4) / 4;
    const key = `${inst.catalogId}|${len.toFixed(2)}|${prim.width.toFixed(3)}|${prim.height.toFixed(3)}`;
    const existing = cutMap.get(key);
    const role = roleOf(inst.role);
    if (existing) {
      existing.quantity += 1;
      existing.roles.add(role);
    } else {
      cutMap.set(key, {
        id: key,
        name: cat.name,
        quantity: 1,
        lengthIn: len,
        widthIn: prim.width,
        thicknessIn: prim.height,
        material: cat.name,
        notes: whole ? "Full stock. Glue. Do not cut." : inst.cutLength ? `Cut from ${stockLen}" stock` : "Full stock length",
        whole,
        roles: new Set([role]),
      });
    }
  }
  for (const p of project.panels) {
    const cat = getCatalogItem(p.materialId);
    const w = Math.round(p.size.width * 8) / 8;
    const d = Math.round(p.size.depth * 8) / 8;
    const h = Math.round(p.size.height * 8) / 8;
    const family = partFamily(p.name, p.type);
    const key = `panel|${p.materialId}|${family}|${w}|${d}|${h}`;
    const existing = cutMap.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      cutMap.set(key, {
        id: key,
        name: family,
        quantity: 1,
        lengthIn: Math.max(w, d),
        widthIn: Math.min(w, d),
        thicknessIn: h,
        material: cat?.name ?? p.materialId,
        notes: "Sheet for the working surface",
        roles: new Set([p.type]),
      });
    }
  }

  const cutList = stampLabels(
    [...cutMap.values()].map((line) => {
      const roles = [...line.roles];
      const roleName =
        roles.length === 1
          ? roles[0] === "member"
            ? line.name
            : `${roles[0].charAt(0).toUpperCase()}${roles[0].slice(1)}`
          : roles
              .filter((r) => r !== "member")
              .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
              .join(" / ") || line.name;
      return {
        id: line.id,
        name: whole ? line.material : roleName,
        quantity: line.quantity,
        lengthIn: line.lengthIn,
        widthIn: line.widthIn,
        thicknessIn: line.thicknessIn,
        material: line.material,
        notes: line.notes,
        whole: line.whole,
      };
    }),
  );

  const status = issues.some((i) => i.severity === "critical")
    ? "critical"
    : issues.some((i) => i.severity === "warning")
      ? "warnings"
      : "ok";

  const bom = decorateBom([...bomLinesFromForge(forgeBom), ...panelBomLines(project), ...binders]);
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const pieces = forgeBom.totalPieces + project.panels.length;
  const effort = effortLabel(project, pieces);

  return {
    feasibility: {
      status,
      summary:
        status === "ok"
          ? whole
            ? `${pieces} full ${item?.name ?? "sticks"} · glue, do not cut · ${effort} · ~$${cost.toFixed(2)}`
            : `${pieces} pieces of ${item?.name ?? "stock"} · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effort} · ~$${cost.toFixed(2)}`
          : `${pieces} pieces — ${effort}. Read the notes before you buy.`,
      issues,
    },
    cutList,
    bom,
    instructions: uniqueSteps(project),
    totals: {
      pieces,
      estCostUsd: cost,
      packs: bom.reduce((s, b) => s + (b.offers?.[0]?.packsNeeded ?? b.quantity), 0),
    },
    effort,
    generatedAt: new Date().toISOString(),
    render: project.render,
    partsKind: whole ? "whole" : "cut",
  };
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  const lines = [
    `# ${project.name}`,
    "",
    project.prompt ? `Prompt: ${project.prompt}` : "",
    "",
    `## Check`,
    plan.feasibility.summary,
    ...plan.feasibility.issues.map((i) => `- ${i.severity}: ${i.message}${i.suggestion ? ` — ${i.suggestion}` : ""}`),
    "",
    `## ${plan.partsKind === "whole" ? "Stick list" : "Cut list"}`,
    ...plan.cutList.map(
      (c) =>
        `- ${c.label ? `${c.label} · ` : ""}${c.quantity}x ${c.name} — ${c.lengthIn}" x ${c.widthIn}" x ${c.thicknessIn}" (${c.material})${c.notes ? ` · ${c.notes}` : ""}`,
    ),
    "",
    `## Buy`,
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}${b.estimatedCost ? ` · ~$${b.estimatedCost.toFixed(2)}` : ""}`),
    "",
    `## Build`,
    ...plan.instructions.map((s) => `${s.step}. ${s.title} — ${s.description}`),
    "",
    "Yard provides guidance only. Not a substitute for professional engineering or local code.",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}
