import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { findListings, type ListingOffer } from "./listings";
import { nestCutList } from "./nesting";
import { uniqueSteps } from "./steps";
import type { AssemblyStep, BuildPlan, CutLine, Panel, YardInstance, YardProject } from "./types";

function round8(n: number) {
  return Math.round(n * 8) / 8;
}

function cutKey(w: number, h: number, d: number) {
  return `${round8(w)}|${round8(h)}|${round8(d)}`;
}

function groupCuts(panels: Panel[]): CutLine[] {
  const map = new Map<string, CutLine>();
  for (const p of panels) {
    const w = p.size.width;
    const h = p.size.height;
    const d = p.size.depth;
    const key = cutKey(w, h, d);
    const g = map.get(key);
    if (g) {
      g.qty += 1;
      g.names.push(p.name);
    } else {
      map.set(key, {
        qty: 1,
        width: round8(w),
        height: round8(h),
        depth: round8(d),
        label: p.type,
        names: [p.name],
        materialId: p.materialId,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.width * b.height - a.width * a.height);
}

function letterCuts(cuts: CutLine[]): CutLine[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return cuts.map((c, i) => ({ ...c, letter: letters[i] ?? `P${i + 1}` }));
}

function instanceCuts(project: YardProject): CutLine[] {
  const item = getCatalogItem(project.primaryMaterialId);
  const map = new Map<string, CutLine>();
  for (const inst of project.instances) {
    const prim = item ? toPrimitive(item, inst.cutLength) : null;
    const len = prim?.length ?? inst.cutLength ?? 0;
    if (!len) continue;
    const key = `${round8(len)}`;
    const g = map.get(key);
    if (g) {
      g.qty += 1;
      g.names.push(inst.role ?? inst.id.slice(0, 6));
    } else {
      map.set(key, {
        qty: 1,
        width: round8(len),
        height: round8(prim?.width ?? 0.75),
        depth: round8(prim?.height ?? 0.75),
        label: inst.role ?? "member",
        names: [inst.role ?? inst.id.slice(0, 6)],
        materialId: project.primaryMaterialId,
      });
    }
  }
  return letterCuts([...map.values()].sort((a, b) => b.width - a.width));
}

function closetCuts(project: YardProject): CutLine[] {
  return letterCuts(groupCuts(project.panels));
}

function attachOffers(bom: BuildPlan["bom"]): BuildPlan["bom"] {
  return bom.map((b) => {
    const offers = findListings(b.searchQuery || b.name, b.estimatedCost);
    return { ...b, offers };
  });
}

function closetBom(project: YardProject, cuts: CutLine[]): BuildPlan["bom"] {
  const bom: BuildPlan["bom"] = [];
  const nest = nestCutList(
    project.panels
      .filter((p) => p.size.depth >= 0.5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        w: p.size.width,
        h: p.size.height,
        d: p.size.depth,
        grain: "long" as const,
      })),
  );
  const sheets = nest.totalSheets || 1;
  const plyItem = getCatalogItem(project.primaryMaterialId);
  bom.push({
    name: plyItem?.name ?? '3/4" Plywood 4x8',
    quantity: sheets,
    unit: sheets === 1 ? "sheet" : "sheet",
    searchQuery: '3/4" x 4x8 sanded plywood',
    estimatedCost: sheets * 38.43,
    notes: `From nest · ${sheets} sheet${sheets === 1 ? "" : "s"} · 1/8" kerf included.`,
  });
  const thin = project.panels.filter((p) => p.size.depth < 0.5);
  if (thin.length) {
    bom.push({
      name: '1/4" plywood 4x8 (backer)',
      quantity: 1,
      unit: "sheet",
      searchQuery: '1/4" x 4x8 sanded plywood',
      estimatedCost: 24.98,
      notes: `1 thin back panel (${thin.map((p) => p.name).join(", ")}) — not nested on the 3/4" sheets.`,
    });
  }
  bom.push({
    name: '#8 x 1-1/4" wood screws',
    quantity: 2,
    unit: "box",
    searchQuery: '#8 x 1-1/4 wood screws',
    estimatedCost: 9.29,
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
      notes: "4–6 screws through the uprights into studs (or masonry anchors). Guidance only — confirm wall type.",
    });
  }
  if (project.pocket || project.fitted) {
    const drawers = project.panels.filter((p) => p.type === "drawer");
    const doors = project.panels.filter((p) => p.type === "door");
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
      bom.push({
        name: "Side-mount drawer slides",
        quantity: drawers.length,
        unit: "pair",
        searchQuery: "side mount drawer slides",
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
  }
  return attachOffers(bom);
}

function forgeBom(project: YardProject): BuildPlan["bom"] {
  const item = getCatalogItem(project.primaryMaterialId);
  const n = project.instances.length;
  const bom: BuildPlan["bom"] = [
    {
      name: item?.name ?? "stock",
      quantity: n,
      unit: "piece",
      searchQuery: item?.name ?? project.primaryMaterialId,
      estimatedCost: (item?.unitPrice ?? 0.5) * n,
    },
  ];
  bom.push({
    name: "Wood glue",
    quantity: 1,
    unit: "bottle",
    searchQuery: "Titebond Original wood glue 8 oz",
    estimatedCost: 5.47,
  });
  return attachOffers(bom);
}

export function makeBuildPlan(project: YardProject): BuildPlan {
  const steps = uniqueSteps(project);
  if (project.panels.length && !project.instances.length) {
    const cuts = closetCuts(project);
    const bom = closetBom(project, cuts);
    const est = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    return {
      title: project.name,
      summary: `${project.name} — ${project.fitted?.program ?? "closet"}.`,
      effort: "1-day",
      partsKind: "cut",
      cuts,
      bom,
      instructions: steps,
      totals: { pieces: project.panels.length, estCostUsd: Math.round(est * 100) / 100 },
    };
  }
  if (project.instances.length) {
    const cuts = instanceCuts(project);
    const bom = forgeBom(project);
    const est = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const whole = project.instances.every((i) => !i.cutLength);
    return {
      title: project.name,
      summary: project.notes[0] ?? project.name,
      effort: whole ? "1 sitting" : "1-day",
      partsKind: whole ? "whole" : "cut",
      cuts,
      bom,
      instructions: steps,
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
    instructions: steps,
    totals: { pieces: 0, estCostUsd: 0 },
  };
}
