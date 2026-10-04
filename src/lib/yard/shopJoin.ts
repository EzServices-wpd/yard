/**
 * The join the person picked is the join Buy and the steps name.
 * Pocket holes, dowels, biscuits, glue and screws each change the fastener, the size, and the talk.
 */
import { inchFrac } from "./inchText";
import { panelJoints, screwTalk } from "./modelJoints";
import { getCatalogItem } from "./catalog";
import type { AssemblyStep, BomLine, BuildPlan, YardProject } from "./types";

export type ShopJoin = NonNullable<YardProject["shopJoin"]>;

export function stockThickness(project: YardProject): number {
  const item = getCatalogItem(project.primaryMaterialId);
  return item?.dims.thickness ?? item?.dims.diameter ?? item?.dims.height ?? 0.75;
}

/** Pocket-hole screw length follows the stock: 1 1/4" in 3/4", 2 1/2" in 1 1/2". */
export function pocketScrewLength(thickness: number): number {
  return thickness >= 1.25 ? 2.5 : 1.25;
}

export function jointCount(project: YardProject): number {
  const fromPanels = panelJoints(project.panels).length;
  if (fromPanels > 0) return fromPanels;
  return Math.max(1, Math.round((project.instances.length || 4) * 0.6));
}

export function fastenerLines(project: YardProject, join: ShopJoin): BomLine[] {
  const joints = jointCount(project);
  const thick = stockThickness(project);
  const thickTalk = inchFrac(thick);
  if (join === "glue") {
    return [{
      name: "Wood glue",
      quantity: 1,
      unit: "bottle",
      catalogId: "glue",
      searchQuery: "titebond wood glue 8 oz",
      estimatedCost: 5,
      notes: `Glue only — no face screws. ~${joints} joints in ${thickTalk}" stock.`,
    }];
  }
  if (join === "dowel") {
    const n = joints * 2;
    return [
      {
        name: "Wood glue",
        quantity: 1,
        unit: "bottle",
        catalogId: "glue",
        searchQuery: "titebond wood glue 8 oz",
        estimatedCost: 5,
        notes: "Glue the dowels. No face screws.",
      },
      {
        name: `1/4" x 1-1/2" fluted dowels`,
        quantity: n,
        unit: "ea",
        catalogId: "dowel-pins",
        searchQuery: "1/4 inch fluted dowel pins",
        estimatedCost: Math.round(n * 0.08 * 100) / 100,
        notes: `${n} dowels — 2 per joint, ${joints} joints. No face screws.`,
      },
    ];
  }
  if (join === "biscuit") {
    return [
      {
        name: "Wood glue",
        quantity: 1,
        unit: "bottle",
        catalogId: "glue",
        searchQuery: "titebond wood glue 8 oz",
        estimatedCost: 5,
        notes: "Glue the biscuits. No face screws.",
      },
      {
        name: "#20 biscuits",
        quantity: joints * 2,
        unit: "ea",
        catalogId: "biscuits-20",
        searchQuery: "#20 wood biscuits",
        estimatedCost: 6,
        notes: `${joints * 2} #20 biscuits — 2 per joint, ${joints} joints, in ${thickTalk}" stock.`,
      },
    ];
  }
  if (join === "pocket") {
    const len = pocketScrewLength(thick);
    const screws = joints * 2;
    return [
      {
        name: `Pocket-hole screws ${inchFrac(len)}"`,
        quantity: screws,
        unit: "ea",
        catalogId: "pocket-screws",
        searchQuery: `${inchFrac(len)} inch pocket hole screws`,
        estimatedCost: 8,
        notes: `${screws} pocket screws — 2 per joint, ${joints} joints, for ${thickTalk}" stock.`,
      },
      {
        name: "Pocket-hole jig",
        quantity: 1,
        unit: "ea",
        catalogId: "pocket-jig",
        searchQuery: "pocket hole jig",
        notes: "Drill the pockets before assembly. No face screws.",
      },
    ];
  }
  const talk = screwTalk(panelJoints(project.panels));
  const screws = Math.max(4, talk.screws || joints * 2);
  const len = thick >= 1.25 ? 2.5 : 1.25;
  return [{
    name: `#8 x ${inchFrac(len)}" wood screws`,
    quantity: Math.ceil(screws / 50),
    unit: "box (50 ct)",
    catalogId: "screws-8",
    searchQuery: `#8 ${inchFrac(len)} wood screws`,
    estimatedCost: 8,
    notes: talk.screws >= 4 ? talk.note : `${screws} #8 x ${inchFrac(len)}" screws for the joints in ${thickTalk}" stock.`,
  }];
}

function rewriteStep(text: string, join: ShopJoin, thick: number): string {
  if (!text) return text;
  if (join === "glue") {
    return text
      .replace(/\bScrew\b/g, "Glue")
      .replace(/\bscrew\b/g, "glue")
      .replace(/\bDrive\b/g, "Spread glue and clamp")
      .replace(/#8[^.]*(?:screw|screws)/gi, "glue");
  }
  if (join === "dowel") {
    return text
      .replace(/\bScrew\b/g, "Dowel and glue")
      .replace(/\bscrew\b/g, "dowel")
      .replace(/#8[^.]*(?:screw|screws)/gi, "two 1/4\" dowels and glue");
  }
  if (join === "biscuit") {
    return text
      .replace(/\bScrew\b/g, "Biscuit and glue")
      .replace(/\bscrew\b/g, "biscuit")
      .replace(/#8[^.]*(?:screw|screws)/gi, "#20 biscuits and glue");
  }
  if (join === "pocket") {
    const len = inchFrac(pocketScrewLength(thick));
    return text
      .replace(/\bScrew\b/g, "Pocket-screw")
      .replace(/\bscrew\b/g, "pocket-screw")
      .replace(/#8[^.]*(?:screw|screws)/gi, `${len}" pocket screws`);
  }
  return text;
}

/** Swap the face-screw Buy line and the step verbs for the picked join. Geometry stays. */
export function applyShopJoin(project: YardProject, plan: BuildPlan): BuildPlan {
  const join = project.shopJoin;
  if (!join) return plan;
  const lines = fastenerLines(project, join);
  const bom = [
    ...plan.bom.filter((b) => !/wood screw|pocket-hole|pocket screw|fluted dowel|#20 biscuit/i.test(b.name) || /structural/i.test(b.name)),
    ...lines,
  ];
  const thick = stockThickness(project);
  const instructions: AssemblyStep[] = plan.instructions.map((st) => ({
    ...st,
    title: rewriteStep(st.title, join, thick),
    description: rewriteStep(st.description, join, thick),
    tips: st.tips ? rewriteStep(st.tips, join, thick) : st.tips,
  }));
  if (join === "pocket" && !instructions.some((s) => /pocket-hole jig/i.test(s.description))) {
    const jig: AssemblyStep = {
      step: 1,
      title: "Drill the pocket holes",
      description: `Set the pocket-hole jig for ${inchFrac(thick)}" stock. Two pockets per joint, ${jointCount(project) * 2} pocket screws at ${inchFrac(pocketScrewLength(thick))}".`,
      tips: undefined,
    };
    instructions.unshift(jig);
    instructions.forEach((s, i) => { s.step = i + 1; });
  }
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  return { ...plan, bom, instructions, totals: { ...plan.totals, estCostUsd: Math.round(cost * 100) / 100 } };
}

/** One line from the real Buy and step diff, including a size change. */
export function planDiffLine(before: BuildPlan, after: BuildPlan): string {
  const names = (p: BuildPlan) => p.bom.map((b) => b.name).join(" | ");
  const steps = (p: BuildPlan) => p.instructions.map((s) => s.description).join("\n");
  const parts: string[] = [];
  if (names(before) !== names(after)) {
    const added = after.bom.filter((b) => !before.bom.some((a) => a.name === b.name)).map((b) => b.name);
    const dropped = before.bom.filter((b) => !after.bom.some((a) => a.name === b.name)).map((b) => b.name);
    if (added.length) parts.push(`Buy now ${added.join(", ")}`);
    if (dropped.length) parts.push(`dropped ${dropped.join(", ")}`);
  }
  if (steps(before) !== steps(after)) parts.push("steps follow the join");
  return parts.join("; ");
}
