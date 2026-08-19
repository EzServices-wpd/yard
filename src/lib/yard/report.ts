import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { uniqueSteps } from "./steps";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import type { AssemblyStep, BuildPlan, CutLine, FeasibilityIssue, YardProject } from "./types";

function closetFeasibility(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  const load = project.assumptions.load;
  const max: Record<typeof load, number> = { light: 36, medium: 30, heavy: 24 };
  for (const p of project.panels) {
    if (p.type !== "shelf" && p.type !== "glass_panel" && p.type !== "top" && p.type !== "bottom") continue;
    const span = p.size.width;
    if (span > max[load] + 2) issues.push({ severity: "critical", message: `${p.name} spans ${span.toFixed(1)}" — past the ${load} load limit.`, suggestion: `Add a divider or drop the span below ${max[load]}".` });
    else if (span > max[load]) issues.push({ severity: "warning", message: `${p.name} spans ${span.toFixed(1)}" — near the limit.` });
  }
  if (project.pocket) {
    const p = project.pocket;
    issues.push({ severity: "info", message: `Trapezoidal pocket. Unit ${p.unit.width}" × ${p.unit.depth}" × ${p.unit.height}" on the back-wall centerline.`, suggestion: `Front clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}".` });
    if (p.leftClear < 0.5 || p.rightClear < 0.5) issues.push({ severity: "critical", message: "Unit hits a side wall at this depth.", suggestion: "Pull the unit shallower or narrow it." });
    issues.push({ severity: "info", message: "Anchor into studs — back and both uprights." });
  } else if (project.fitted) {
    issues.push({ severity: "info", message: `${project.fitted.name} — ${project.fitted.program}.` });
  }
  return issues;
}

function closetCuts(project: YardProject): CutLine[] {
  const grouped = new Map<string, CutLine>();
  for (const p of project.panels) {
    const item = getCatalogItem(p.materialId);
    const key = `${p.name}|${p.size.width}|${p.size.depth}|${p.size.height}`;
    const existing = grouped.get(key);
    if (existing) { existing.quantity += 1; continue; }
    grouped.set(key, { id: p.id, name: p.name, quantity: 1, lengthIn: Math.max(p.size.width, p.size.depth), widthIn: Math.min(p.size.width, p.size.depth), thicknessIn: Math.min(p.size.height, p.size.width, p.size.depth), material: item?.name ?? p.materialId });
  }
  return [...grouped.values()];
}

function closetBom(project: YardProject, cuts: CutLine[]): BuildPlan["bom"] {
  const sheet = getCatalogItem("plywood-3-4-4x8");
  const area = cuts.reduce((s, c) => s + c.lengthIn * c.widthIn * c.quantity, 0);
  const sheets = Math.max(1, Math.ceil(area / (48 * 96) / 0.7));
  const bom: BuildPlan["bom"] = [
    { name: sheet?.name ?? '3/4" plywood 4×8', quantity: sheets, unit: "sheet", searchQuery: sheet?.searchQuery, estimatedCost: (sheet?.unitCostUsd ?? 55) * sheets },
    { name: '#8 × 1-1/4" wood screws', quantity: Math.max(1, Math.ceil((project.panels.length * 6) / 50)), unit: "box", searchQuery: "#8 wood screws 1-1/4", estimatedCost: 8 },
    { name: "Wood glue", quantity: 1, unit: "bottle", searchQuery: "titebond wood glue", estimatedCost: 8 },
  ];
  if (project.assumptions.installMode !== "freestanding") {
    bom.push({ name: "Structural wood screws / lag", quantity: 1, unit: "box", searchQuery: "GRK RSS structural screws", estimatedCost: 14 });
  }
  const drawers = project.panels.filter((p) => p.type === "drawer").length;
  const doors = project.panels.filter((p) => p.type === "door").length;
  const shelves = project.panels.filter((p) => p.type === "shelf").length;
  if (drawers) bom.push({ name: "Side-mount drawer slides 16\"", quantity: drawers, unit: "pair", searchQuery: "16 inch side mount drawer slides", estimatedCost: drawers * 12 });
  if (doors) bom.push({ name: "Concealed cabinet hinges", quantity: doors * 2, unit: "hinge", searchQuery: "soft close concealed cabinet hinges", estimatedCost: doors * 8 });
  if (shelves) bom.push({ name: "Shelf pins 5mm", quantity: 1, unit: "pack", searchQuery: "5mm shelf pins", estimatedCost: 6 });
  if (project.panels.some((p) => p.type === "mirror")) {
    bom.push({ name: "Vanity mirror", quantity: 1, unit: "mirror", searchQuery: "vanity mirror", estimatedCost: 40 });
  }
  return bom;
}

export function buildPlan(project: YardProject): BuildPlan {
  if (project.kind === "opening" && (project.windowPkg || project.opening?.kind === "window")) {
    const issues = windowIssues(project);
    const bom = windowBom(project);
    return {
      feasibility: { status: issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok", summary: project.windowPkg ? `${project.windowPkg.window.brand} ${project.windowPkg.window.callW}×${project.windowPkg.window.callH} + framing` : "Framing package.", issues },
      cutList: windowCuts(project), bom, instructions: windowSteps(project),
      totals: { pieces: project.panels.length, estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0), packs: bom.reduce((s, b) => s + b.quantity, 0) },
      generatedAt: new Date().toISOString(), render: project.render,
    };
  }
  if (project.panels.length > 0) {
    const issues = closetFeasibility(project);
    const cutList = closetCuts(project);
    const bom = closetBom(project, cutList);
    const status = issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok";
    return {
      feasibility: { status, summary: status === "ok" ? `Package ready — ${cutList.length} unique parts.` : "Review the notes before you cut.", issues },
      cutList, bom, instructions: uniqueSteps(project),
      totals: { pieces: project.panels.length, estCostUsd: bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0), packs: bom.reduce((s, b) => s + b.quantity, 0) },
      generatedAt: new Date().toISOString(), render: project.render,
    };
  }
  if (project.instances.length === 0) {
    return {
      feasibility: { status: "critical", summary: "Nothing on the bench yet.", issues: [{ severity: "critical", message: "Empty structure", suggestion: "Try “3 foot Eiffel Tower from popsicle sticks”." }] },
      cutList: [], bom: [], instructions: [], totals: { pieces: 0, estCostUsd: 0, packs: 0 }, generatedAt: new Date().toISOString(),
    };
  }
  const item = getCatalogItem(project.primaryMaterialId);
  const issues: FeasibilityIssue[] = [];
  const frameN = project.instances.filter((i) => ["leg", "ring", "rail", "base"].includes(i.role ?? "")).length;
  const braceN = project.instances.filter((i) => i.role === "brace").length;
  const supportN = project.instances.filter((i) => i.role === "support").length;
  if (frameN > 0 && braceN === 0) issues.push({ severity: "critical", message: "Bare frame — no bracing", suggestion: "This will rack and fail." });
  else if (frameN > 8 && braceN < frameN * 0.2) issues.push({ severity: "warning", message: `Light bracing (${braceN} braces on ${frameN} frame members)` });
  const ys = project.instances.map((i) => i.position.y);
  const xs = project.instances.map((i) => i.position.x);
  const zs = project.instances.map((i) => i.position.z);
  const height = Math.max(...ys) - Math.min(...ys);
  const footprint = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);
  if (height / footprint > 3.2 && supportN === 0) issues.push({ severity: "warning", message: `Slender (${(height / footprint).toFixed(1)}:1) with no temporary support` });
  const forgeBom = buildForgeBom(project.instances, project.primaryMaterialId);
  const cutMap = new Map<string, CutLine>();
  for (const inst of project.instances) {
    const cat = getCatalogItem(inst.catalogId);
    if (!cat) continue;
    const prim = toPrimitive(cat, inst.cutLength);
    const len = inst.cutLength ?? prim.length;
    const key = `${inst.catalogId}|${len.toFixed(2)}|${inst.role ?? "member"}`;
    const existing = cutMap.get(key);
    if (existing) existing.quantity += 1;
    else cutMap.set(key, { id: key, name: `${cat.name}${inst.role ? ` · ${inst.role}` : ""}`, quantity: 1, lengthIn: len, widthIn: prim.width, thicknessIn: prim.height, material: cat.name, notes: inst.cutLength ? `Cut from ${prim.length}" stock` : "Full stock length" });
  }
  const status = issues.some((i) => i.severity === "critical") ? "critical" : issues.some((i) => i.severity === "warning") ? "warnings" : "ok";
  return {
    feasibility: { status, summary: status === "ok" ? `${forgeBom.totalPieces} pieces of ${item?.name ?? "stock"} · ~$${forgeBom.totalEstCostUsd.toFixed(2)}` : `${forgeBom.totalPieces} pieces — read the notes.`, issues },
    cutList: [...cutMap.values()].sort((a, b) => b.lengthIn - a.lengthIn),
    bom: bomLinesFromForge(forgeBom),
    instructions: uniqueSteps(project),
    totals: { pieces: forgeBom.totalPieces, estCostUsd: forgeBom.totalEstCostUsd, packs: forgeBom.lines.reduce((s, l) => s + l.packsNeeded, 0) },
    generatedAt: new Date().toISOString(), render: project.render,
  };
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  return [
    `# ${project.name}`, "",
    project.prompt ? `Prompt: ${project.prompt}` : "", "",
    "## Check", plan.feasibility.summary,
    ...plan.feasibility.issues.map((i) => `- ${i.severity}: ${i.message}${i.suggestion ? ` — ${i.suggestion}` : ""}`),
    "", "## Cut list",
    ...plan.cutList.map((c) => `- ${c.quantity}× ${c.name} — ${c.lengthIn}" × ${c.widthIn}" × ${c.thicknessIn}" (${c.material})`),
    "", "## Buy",
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}${b.estimatedCost ? ` · ~$${b.estimatedCost.toFixed(2)}` : ""}`),
    "", "## Build",
    ...plan.instructions.map((s) => `${s.step}. ${s.title} — ${s.description}`),
    "", "Yard provides guidance only. Not a substitute for professional engineering or local code.",
  ].filter((l) => l !== undefined).join("\n");
}
