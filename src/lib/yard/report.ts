import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { framingNotes, matchWindows } from "./space";
import { uniqueSteps } from "./steps";
import { decorateBom } from "./listings";
import { binderBom, effectiveJoin } from "./joints";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import type { AssemblyStep, BuildPlan, CutLine, FeasibilityIssue, YardProject } from "./types";

function roleOf(role?: string) {
  return role ?? "member";
}

function closetFeasibility(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const load = project.assumptions.load;
  const max: Record<typeof load, number> = { light: 36, medium: 30, heavy: 24 };
  for (const p of project.panels) {
    if (p.type !== "shelf" && p.type !== "glass_panel" && p.type !== "top" && p.type !== "bottom") continue;
    const span = p.size.width;
    if (span > max[load] + 2) {
      issues.push({
        severity: "critical",
        message: `${p.name} spans ${span.toFixed(1)}" — past the conservative limit for ${load} load.`,
        suggestion: `Add a divider or drop the span below ${max[load]}".`,
      });
    } else if (span > max[load]) {
      issues.push({
        severity: "warning",
        message: `${p.name} spans ${span.toFixed(1)}" — near the limit.`,
        suggestion: "A center support will keep the shelf honest over time.",
      });
    }
  }
  if (project.pocket) {
    const p = project.pocket;
    issues.push({
      severity: "info",
      message: `Trapezoidal pocket. Unit ${p.unit.width}" × ${p.unit.depth}" × ${p.unit.height}" on the back-wall centerline.`,
      suggestion: `Front clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}". The unit stays rectangular. The walls are the thing that flare.`,
    });
    if (p.leftClear < 0.5 || p.rightClear < 0.5) {
      issues.push({
        severity: "critical",
        message: "Unit hits a side wall at this depth.",
        suggestion: "Pull the unit shallower or narrow it until both clearances are at least ½\".",
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
      suggestion: "Measure is live. Change W × H × D to refit. Drawers, knee, and doors stay with the program.",
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
      message: `Fitted to a ${project.opening.width}" × ${project.opening.height}" × ${project.opening.depth}" ${project.opening.kind}.`,
      suggestion: "Measure twice. Out-of-square openings need scribed uprights.",
    });
  }
  return issues;
}

function closetCuts(project: YardProject): CutLine[] {
  const grouped = new Map<string, CutLine>();
  for (const p of project.panels) {
    const item = getCatalogItem(p.materialId);
    const key = `${p.name}|${p.size.width}|${p.size.depth}|${p.size.height}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    grouped.set(key, {
      id: p.id,
      name: p.name,
      quantity: 1,
      lengthIn: Math.max(p.size.width, p.size.depth),
      widthIn: Math.min(p.size.width, p.size.depth),
      thicknessIn: Math.min(p.size.height, p.size.width, p.size.depth),
      material: item?.name ?? p.materialId,
    });
  }
  return [...grouped.values()];
}

function closetBom(project: YardProject, cuts: CutLine[]): BuildPlan["bom"] {
  const sheet = getCatalogItem("plywood-3-4-4x8");
  const area = cuts.reduce((s, c) => s + c.lengthIn * c.widthIn * c.quantity, 0);
  const sheets = Math.max(1, Math.ceil(area / (48 * 96) / 0.7));
  const screws = Math.max(16, project.panels.length * 6);
  const bom = [
    {
      name: sheet?.name ?? '3/4" plywood 4×8',
      quantity: sheets,
      unit: "sheet",
      searchQuery: sheet?.searchQuery,
      estimatedCost: (sheet?.unitCostUsd ?? 55) * sheets,
      notes: "Kerf-aware nest assumed at ~70% yield.",
    },
    {
      name: '#8 × 1-1/4" wood screws',
      quantity: Math.ceil(screws / 50),
      unit: "box",
      searchQuery: "#8 wood screws 1-1/4",
      estimatedCost: 8,
      notes: `${screws} screws estimated at joints.`,
    },
    {
      name: "Wood glue",
      quantity: 1,
      unit: "bottle",
      searchQuery: "titebond wood glue",
      estimatedCost: 8,
    },
  ];
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
      bom.push({
        name: "Side-mount drawer slides 16\"",
        quantity: drawers,
        unit: "pair",
        searchQuery: "16 inch side mount drawer slides",
        estimatedCost: drawers * 12,
        notes: `Pair per drawer. Confirm depth against the ${project.fitted?.unit.depth ?? project.pocket?.unit.depth ?? 16}" carcase.`,
      });
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
        notes: `${shelves} adjustable shelves × 4 pins.`,
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

function closetSteps(project: YardProject): AssemblyStep[] {
  if (project.pocket) {
    const p = project.pocket;
    return [
      {
        step: 1,
        title: "Confirm the pocket",
        description: `Back ${p.walls.backWidth}" · left depth ${p.walls.leftDepth}" @ ${p.walls.leftAngleDeg.toFixed(1)}° · right depth ${p.walls.rightDepth}" @ ${p.walls.rightAngleDeg.toFixed(1)}° · ${p.walls.height}" high. Measure three heights and both flares.`,
        tips: "The walls are the trapezoid. The unit is a rectangle. Do not try to make the carcase follow the flare.",
      },
      {
        step: 2,
        title: "Find the studs and the centerline",
        description: "Snap a plumb centerline on the back wall. Mark every stud. The unit sits on that line, front face parallel to the back wall.",
        tips: "A 102\" mixed-use unit leans on people and towels. Drywall anchors will let go.",
      },
      {
        step: 3,
        title: "Cut the carcase",
        description: `Two uprights ${p.unit.height}" × ${p.unit.depth}". Back ${p.unit.width - 1.5}" × ${p.unit.height}". Knee dividers ${p.unit.vanityH}" tall. Counter ${p.unit.width}" × ${p.unit.depth}".`,
        partsUsed: ["Left upright", "Right upright", "Back (stud-anchored)", "Vanity counter"],
      },
      {
        step: 4,
        title: "Stand the box and set the vanity",
        description: `Assemble uprights, back, and knee dividers. Set the counter at ${p.unit.vanityH}". Knee opening ${p.unit.kneeW}" in the middle — that is the chair space.`,
        tips: "Check square before the glue grabs. The front must read straight even though the pocket is not.",
      },
      {
        step: 5,
        title: "Drawer banks",
        description: "Three drawers each side of the knee. Hang slides on the dividers. Toekick only on the banks — leave the knee open to the floor.",
        partsUsed: project.panels.filter((x) => x.type === "drawer" || x.type === "kick").map((x) => x.name),
      },
      {
        step: 6,
        title: "Uppers, shelves, doors",
        description: `Upper bottom at ${p.unit.upperStart}". Adjustable shelves on pins in both bays — towels one side, linens the other. Two large doors.`,
        partsUsed: project.panels.filter((x) => x.type === "shelf" || x.type === "door" || x.type === "top").map((x) => x.name),
      },
      {
        step: 7,
        title: "Mirror, then anchor",
        description: `Hang the mirror over the knee, between the counter and the uppers. Fasten the back and both uprights into the studs you marked. Shim the tight side (R ${p.rightClear.toFixed(1)}" / L ${p.leftClear.toFixed(1)}").`,
        tips: "Scribe, don't force. The rectangle stays a rectangle.",
      },
    ];
  }
  if (project.fitted) {
    const u = project.fitted.unit;
    return [
      {
        step: 1,
        title: "Confirm the numbers",
        description: `${project.fitted.name}. ${u.width}" wide × ${u.depth}" deep × ${u.height}" high. Measure the real opening (or the floor) in three places.`,
        tips: "The unit is always a rectangle. Wonky walls get shims, not a wonky box.",
      },
      {
        step: 2,
        title: "Cut the carcase",
        description: "Uprights first — they set every other length. Then back, top, and bottom.",
        partsUsed: ["Left upright", "Right upright", "Back", "Top", "Bottom"],
      },
      {
        step: 3,
        title: "Assemble square",
        description: "Glue and screw. Check diagonal. A racked box will not sit in a straight opening and will not sit in a crooked one either.",
      },
      {
        step: 4,
        title: u.kneeW ? "Work surface and drawers" : "Shelves and doors",
        description: u.kneeW
          ? `Counter at ${u.counterH ?? 34}". Knee ${u.kneeW}" in the middle. Drawers in the wings. Hang slides before you glue the last divider.`
          : `Set the shelves on pins. ${u.doors ? "Hang the doors last." : "Leave it open."}`,
        partsUsed: project.panels
          .filter((x) => ["drawer", "shelf", "door", "counter", "mirror"].includes(x.type))
          .map((x) => x.name),
      },
      {
        step: 5,
        title: project.assumptions.installMode === "freestanding" ? "Level it" : "Set it and anchor",
        description:
          project.assumptions.installMode === "freestanding"
            ? "Level the unit. The back is already on it so it cannot rack."
            : "Shim to the opening. Fasten through the uprights into studs.",
      },
    ];
  }
  return [
    {
      step: 1,
      title: "Confirm the opening",
      description: `Measure width, height, and depth in three places. Design assumes ${project.overall.width}" × ${project.overall.height}" × ${project.overall.depth}".`,
      tips: "Use the smallest width if the walls aren't parallel.",
    },
    {
      step: 2,
      title: "Cut the uprights",
      description: "Rip and crosscut the two uprights first. They set every other length.",
      partsUsed: ["Left upright", "Right upright"],
    },
    {
      step: 3,
      title: "Cut the shelves",
      description: "Shelves are the clear width between uprights. Dry-fit one before committing the stack.",
      partsUsed: project.panels.filter((p) => p.type === "shelf" || p.type === "top").map((p) => p.name),
    },
    {
      step: 4,
      title: "Assemble the carcase",
      description: "Glue and screw shelves into the uprights, starting at the bottom. Check square as you go.",
      tips: "A pair of clamps and a framing square beat hope.",
    },
    {
      step: 5,
      title: "Set it in place",
      description:
        project.assumptions.installMode === "freestanding"
          ? "Level the unit. Add a back if it racks."
          : "Shim to the opening. Fasten through the uprights into studs (or masonry anchors).",
    },
  ];
}

function forgeSteps(project: YardProject): AssemblyStep[] {
  const byRole = new Map<string, number>();
  for (const inst of project.instances) {
    const r = roleOf(inst.role);
    byRole.set(r, (byRole.get(r) ?? 0) + 1);
  }
  const order = ["base", "support", "leg", "ring", "rail", "brace", "splice", "tip", "member"];
  const steps: AssemblyStep[] = [
    {
      step: 1,
      title: "Sort the pile",
      description: `You have ${project.instances.length} pieces of ${getCatalogItem(project.primaryMaterialId)?.name ?? "stock"}. Group by role and pre-cut any marked lengths.`,
      tips: "One wrong cut wastes a whole stick. Mark first.",
    },
  ];
  let n = 2;
  for (const role of order) {
    const count = byRole.get(role);
    if (!count) continue;
    const titles: Record<string, string> = {
      base: "Build the base ring",
      support: "Stand the support — arches and props",
      leg: "Raise the frame legs",
      ring: "Add horizontal rings",
      rail: "Set rails and platforms",
      brace: "Brace the frame",
      splice: "Splice long members",
      tip: "Cap the tip",
      member: "Place remaining members",
    };
    steps.push({
      step: n++,
      title: titles[role] ?? `Place ${role}`,
      description:
        role === "brace"
          ? `${count} brace${count === 1 ? "" : "s"}. The frame will rack and fail without these. Dry-fit, then glue.`
          : role === "support"
            ? `${count} support member${count === 1 ? "" : "s"} (arches / props). These take thrust until the frame is braced and cured.`
            : `${count} ${role} piece${count === 1 ? "" : "s"}. Dry-fit the bay, then glue. Hold 30–60 seconds per joint.`,
      partsUsed: [role],
    });
  }
  steps.push({
    step: n,
    title: "Cure, then handle",
    description: "Let glue cure overnight before you pick it up by the tip. Check that the base sits flat.",
    tips: "Guidance only — not stamped engineering.",
  });
  return steps;
}

export function buildPlan(project: YardProject): BuildPlan {
  const issues: FeasibilityIssue[] = [];

  if (project.kind === "opening" && (project.windowPkg || project.opening?.kind === "window")) {
    const issues = windowIssues(project);
    if (!project.windowPkg && project.opening) {
      issues.push({
        severity: "info",
        message: `Window rough opening ${project.opening.width}" × ${project.opening.height}".`,
      });
      for (const note of framingNotes(project.opening.width, project.opening.height)) {
        issues.push({ severity: "info", message: note });
      }
    }
    const cutList = windowCuts(project);
    const bom = windowBom(project);
    return {
      feasibility: {
        status: issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok",
        summary: project.windowPkg
          ? `${project.windowPkg.window.brand} ${project.windowPkg.window.callW}×${project.windowPkg.window.callH} + framing package`
          : "Framing package for this rough opening. Guidance only — check local code.",
        issues,
      },
      cutList,
      bom: decorateBom(bom),
      instructions: windowSteps(project),
      totals: {
        pieces: project.panels.length,
        estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0),
        packs: bom.reduce((s, b) => s + b.quantity, 0),
      },
      generatedAt: new Date().toISOString(),
      render: project.render,
    };
  }

  if (project.panels.length > 0) {
    issues.push(...closetFeasibility(project));
    const cutList = closetCuts(project);
    const bom = closetBom(project, cutList);
    const status = issues.some((i) => i.severity === "critical")
      ? "critical"
      : issues.some((i) => i.severity === "warning")
        ? "warnings"
        : "ok";
    return {
      feasibility: {
        status,
        summary:
          status === "ok"
            ? `Closet package ready — ${cutList.length} unique parts, conservative spans.`
            : "Review the span notes before you cut.",
        issues,
      },
      cutList,
      bom: decorateBom(bom),
      instructions: uniqueSteps(project),
      totals: {
        pieces: project.panels.length,
        estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0),
        packs: bom.reduce((s, b) => s + b.quantity, 0),
      },
      generatedAt: new Date().toISOString(),
      render: project.render,
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
            suggestion: "Try “3 foot Eiffel Tower from popsicle sticks” or place a piece from the catalog.",
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
  if (project.instances.length > 400) {
    issues.push({
      severity: "warning",
      message: `${project.instances.length} pieces — a long build`,
      suggestion: "Work bay-by-bay. Dry-fit each level before glue.",
    });
  }
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
  const ys = project.instances.map((i) => i.position.y);
  const height = Math.max(...ys) - Math.min(...ys);
  const xs = project.instances.map((i) => i.position.x);
  const zs = project.instances.map((i) => i.position.z);
  const footprint = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);
  const frameN = project.instances.filter((i) =>
    ["leg", "ring", "rail", "base"].includes(i.role ?? ""),
  ).length;
  const braceN = project.instances.filter((i) => i.role === "brace").length;
  const supportN = project.instances.filter((i) => i.role === "support").length;

  if (frameN > 0 && braceN === 0) {
    issues.push({
      severity: "critical",
      message: "Bare frame — no bracing",
      suggestion: "This will rack and fail. Add X-braces or the structure is not buildable as a free-standing piece.",
    });
  } else if (frameN > 8 && braceN < frameN * 0.2) {
    issues.push({
      severity: "warning",
      message: `Light bracing (${braceN} braces on ${frameN} frame members)`,
      suggestion: "Add more lacing. A frame without enough braces fails sideways long before it fails in compression.",
    });
  }
  if (height / footprint > 3.2 && supportN === 0) {
    issues.push({
      severity: "warning",
      message: `Slender (${(height / footprint).toFixed(1)}:1) with no temporary support`,
      suggestion: "Prop the first platform (or the arches) until glue cures. The frame alone is not enough while joints are wet.",
    });
  } else if (supportN > 0) {
    issues.push({
      severity: "info",
      message: `${supportN} support members (arches / props) take thrust until the frame is braced.`,
      suggestion: "Build supports with the base. Do not pull them until the first platform is laced.",
    });
  }
  if (height > 48) {
    issues.push({
      severity: "warning",
      message: `Tall structure (~${height.toFixed(0)}")`,
      suggestion: "Build on a flat surface. Prop the base while glue sets.",
    });
  }
  const stats = project.buildStats;
  if (stats) {
    if (stats.components <= 1 && stats.loose === 0) {
      issues.push({
        severity: "info",
        message: `Connected — ${stats.joints} joints, every piece meets another (ends or mid-span crossings).`,
      });
    } else {
      issues.push({
        severity: stats.loose > Math.max(4, stats.pieces * 0.04) ? "warning" : "info",
        message: `${stats.loose} loose piece${stats.loose === 1 ? "" : "s"} · ${stats.components} cluster${stats.components === 1 ? "" : "s"} · ${stats.joints} joints`,
        suggestion: "Dry-fit the marked joints first. Loose members are usually tip or satellite lacing — glue them to the nearest chord.",
      });
    }
  }
  if (project.supportOffer?.needed && !project.supportOffer.included) {
    issues.push({
      severity: "warning",
      message: project.supportOffer.reason,
      suggestion: "The model is already on the bench. Add a spine if you want it to stand while the glue cures.",
    });
  } else if (project.supportOffer?.included) {
    issues.push({
      severity: "info",
      message: "Internal spine included — temporary support until the frame is braced and cured.",
      suggestion: "Leave the spine in until the first platform (or the body) is laced.",
    });
  }

  const forgeBom = buildForgeBom(project.instances, project.primaryMaterialId);
  const binders =
    item && project.instances.length
      ? binderBom(item, project.instances, project.joinMethod)
      : [];
  const cutMap = new Map<string, CutLine>();
  for (const inst of project.instances) {
    const cat = getCatalogItem(inst.catalogId);
    if (!cat) continue;
    const prim = toPrimitive(cat, inst.cutLength);
    const len = inst.cutLength ?? prim.length;
    const key = `${inst.catalogId}|${len.toFixed(2)}|${roleOf(inst.role)}`;
    const existing = cutMap.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      cutMap.set(key, {
        id: key,
        name: `${cat.name}${inst.role ? ` · ${inst.role}` : ""}`,
        quantity: 1,
        lengthIn: len,
        widthIn: prim.width,
        thicknessIn: prim.height,
        material: cat.name,
        notes: inst.cutLength ? `Cut from ${prim.length}" stock` : "Full stock length",
      });
    }
  }

  const status = issues.some((i) => i.severity === "critical")
    ? "critical"
    : issues.some((i) => i.severity === "warning")
      ? "warnings"
      : "ok";

  const bom = decorateBom([...bomLinesFromForge(forgeBom), ...binders]);

  return {
    feasibility: {
      status,
      summary:
        status === "ok"
          ? `${forgeBom.totalPieces} pieces of ${item?.name ?? "stock"} · ~$${(bom[0]?.estimatedCost ?? forgeBom.totalEstCostUsd).toFixed(2)}`
          : `${forgeBom.totalPieces} pieces — read the notes before you buy.`,
      issues,
    },
    cutList: [...cutMap.values()].sort((a, b) => b.lengthIn - a.lengthIn),
    bom,
    instructions: uniqueSteps(project),
    totals: {
      pieces: forgeBom.totalPieces,
      estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0),
      packs: bom.reduce((s, b) => s + (b.offers?.[0]?.packsNeeded ?? 1), 0),
    },
    generatedAt: new Date().toISOString(),
    render: project.render,
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
    `## Cut list`,
    ...plan.cutList.map(
      (c) => `- ${c.quantity}× ${c.name} — ${c.lengthIn}" × ${c.widthIn}" × ${c.thicknessIn}" (${c.material})`,
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
