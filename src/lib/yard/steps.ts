import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import type { AssemblyStep, Panel, YardProject } from "./types";

function dim(p: Panel) {
  return `${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}`;
}
function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2);
}
function list(panels: Panel[]) {
  return panels.map((p) => `${p.name} (${dim(p)}")`).join("; ");
}

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  if (project.panels.length) return uniquePanelSteps(project);
  if (project.instances.length) return uniqueForgeSteps(project);
  return [{ step: 1, title: "Empty bench", description: "Generate a thing first. These steps are written from the pieces on the bench." }];
}

function uniquePanelSteps(project: YardProject): AssemblyStep[] {
  const by = (t: Panel["type"] | Panel["type"][]) =>
    project.panels.filter((p) => (Array.isArray(t) ? t.includes(p.type) : p.type === t));
  const steps: AssemblyStep[] = [];
  let n = 1;
  if (project.pocket) {
    const p = project.pocket;
    steps.push({
      step: n++,
      title: `Confirm this pocket — ${project.name}`,
      description: `Back ${p.walls.backWidth}" · left ${p.walls.leftDepth}" at ${p.walls.leftAngleDeg.toFixed(2)}° · right ${p.walls.rightDepth}" at ${p.walls.rightAngleDeg.toFixed(2)}° · ${p.walls.height}" high. Unit ${p.unit.width}" × ${p.unit.depth}" × ${p.unit.height}", centered. Clearances: left ${p.leftClear.toFixed(2)}" · right ${p.rightClear.toFixed(2)}".`,
      tips: "The walls are the trapezoid. This box stays a rectangle.",
    });
  } else if (project.fitted) {
    const u = project.fitted.unit;
    steps.push({
      step: n++,
      title: `Confirm ${project.name}`,
      description: `${project.fitted.program} · ${u.width}" × ${u.depth}" × ${u.height}"${u.counterH ? ` · work surface ${u.counterH}"` : ""}${u.kneeW ? ` · knee ${u.kneeW}"` : ""}.`,
      tips: "Measure the real space in three places. Use the smallest number.",
    });
  } else {
    steps.push({ step: n++, title: `Confirm ${project.name}`, description: `${project.overall.width}" × ${project.overall.height}" × ${project.overall.depth}". ${project.notes[0] ?? ""}` });
  }
  const uprights = by(["upright", "back", "top", "bottom"]);
  if (uprights.length) {
    steps.push({ step: n++, title: "Cut the carcase", description: list(uprights) + ". Rip the ¾\" plywood first.", partsUsed: uprights.map((p) => p.name) });
  }
  const divs = by("divider");
  const counters = by("counter");
  const kicks = by("kick");
  if (divs.length || counters.length) {
    steps.push({
      step: n++,
      title: counters.length ? "Stand the box and set the work surface" : "Stand the box",
      description: [divs.length ? `Dividers: ${list(divs)}.` : "", counters.length ? `Work surface: ${list(counters)}.` : "", kicks.length ? `Toekick: ${list(kicks)}.` : ""].filter(Boolean).join(" "),
      partsUsed: [...divs, ...counters, ...kicks].map((p) => p.name),
    });
  }
  const drawers = by("drawer");
  if (drawers.length) {
    steps.push({ step: n++, title: `Hang ${drawers.length} drawer${drawers.length === 1 ? "" : "s"}`, description: `${list(drawers)}. Pair of slides per drawer.`, partsUsed: drawers.map((p) => p.name) });
  }
  const shelves = by("shelf");
  const doors = by("door");
  const rods = by("rail");
  if (shelves.length || doors.length || rods.length) {
    steps.push({
      step: n++,
      title: doors.length ? "Shelves, rod, doors" : "Set the shelves",
      description: [shelves.length ? `Shelves: ${list(shelves)}.` : "", rods.length ? `Rod: ${list(rods)}.` : "", doors.length ? `Doors: ${list(doors)}.` : ""].filter(Boolean).join(" "),
      partsUsed: [...shelves, ...rods, ...doors].map((p) => p.name),
    });
  }
  const mirrors = by("mirror");
  if (mirrors.length) {
    steps.push({ step: n++, title: "Hang the mirror", description: list(mirrors), partsUsed: mirrors.map((p) => p.name) });
  }
  steps.push({
    step: n,
    title: project.assumptions.installMode === "freestanding" ? "Level it" : "Anchor into studs",
    description: project.assumptions.installMode === "freestanding"
      ? `Level ${project.name}.`
      : `Find studs. Fasten the back and both uprights. Shim the tight side — do not rack the box.`,
    tips: "Guidance only. Not stamped engineering.",
  });
  return steps;
}

function uniqueForgeSteps(project: YardProject): AssemblyStep[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const byRole = new Map<string, typeof project.instances>();
  for (const inst of project.instances) {
    const r = inst.role ?? "member";
    const arr = byRole.get(r) ?? [];
    arr.push(inst);
    byRole.set(r, arr);
  }
  const cuts = project.instances.filter((i) => i.cutLength).slice(0, 6);
  const steps: AssemblyStep[] = [{
    step: 1,
    title: `Sort this ${project.name}`,
    description: `${project.instances.length} pieces of ${item?.name ?? "stock"}. Envelope about ${project.overall.width.toFixed(0)}" × ${project.overall.height.toFixed(0)}" × ${project.overall.depth.toFixed(0)}". ${cuts.length ? `Marked cuts include ${cuts.map((c) => `${(c.cutLength ?? 0).toFixed(1)}"`).join(", ")}.` : "Most members are full stock."}`,
    tips: "Group by role. Mark before you cut.",
  }];
  let n = 2;
  const order = ["base", "support", "leg", "ring", "rail", "brace", "splice", "tip", "member"];
  const titles: Record<string, string> = { base: "Set the base", support: "Stand the support", leg: "Raise the legs", ring: "Close the rings", rail: "Set rails", brace: "Brace the frame", splice: "Splice the long members", tip: "Cap the tip", member: "Place the rest" };
  for (const role of order) {
    const listI = byRole.get(role);
    if (!listI?.length) continue;
    const lens = item ? [...new Set(listI.map((i) => toPrimitive(item, i.cutLength).length))].slice(0, 4) : [];
    steps.push({
      step: n++,
      title: `${titles[role] ?? role} — ${listI.length} ${role}${listI.length === 1 ? "" : "s"}`,
      description: role === "brace"
        ? `${listI.length} braces. The frame will rack and fail without them. Join: ${item?.preferredJoins?.[0] ?? "glue"}.`
        : `${listI.length} ${role} members. Join: ${item?.preferredJoins?.[0] ?? "glue"}. Lengths: ${lens.map((l) => `${l.toFixed(1)}"`).join(", ") || "full stock"}.`,
      partsUsed: [role],
    });
  }
  steps.push({ step: n, title: "Cure, then pick it up", description: `Overnight cure before you lift ${project.name} by the tip.`, tips: "Guidance only — not stamped engineering." });
  return steps;
}
