import { generateFromPrompt } from "./promptMain";
import { stampCount } from "./measureTabs";
import type { Panel, YardProject } from "./types";

export type InsidePatch = { shelves?: number; cubbies?: number; drawers?: number };

/**
 * Shelf, cubby, and drawer counts drive the one model.
 * Fitted and pocket builds rebuild from the unit. A shelf-family build with no
 * fitted spec retile the panels it already has, so the cut list and steps follow.
 */
export function applyInsideCount(project: YardProject, patch: InsidePatch): YardProject {
  const pocket = project.pocket ?? project.recastFrom?.pocket;
  const fitted = project.fitted ?? project.recastFrom?.fitted;
  if (pocket && patch.shelves != null) {
    return generateFromPrompt(project.prompt, project.primaryMaterialId, undefined, {
      pocketOverride: {
        ...pocket,
        unit: { ...pocket.unit, shelfRows: Math.max(1, Math.round(patch.shelves / 2)) },
      },
    });
  }
  if (fitted) {
    // A cubby count is spoken so the shoe/cubby builders use it. Shelf and drawer
    // counts ride on the unit, which those builders already honor.
    const prompt = patch.cubbies != null ? stampCount(project.prompt, "cubbies", Math.max(1, Math.round(patch.cubbies))) : project.prompt;
    return generateFromPrompt(prompt, project.primaryMaterialId, undefined, {
      honorUnit: true,
      fittedOverride: {
        ...fitted,
        unit: {
          ...fitted.unit,
          shelfCount: patch.shelves ?? fitted.unit.shelfCount,
          cubbies: patch.cubbies ?? fitted.unit.cubbies,
          drawersPerBank: patch.drawers != null ? Math.max(1, Math.round(patch.drawers)) : fitted.unit.drawersPerBank,
        },
      },
    });
  }
  return retileInside(project, patch);
}

function retileInside(project: YardProject, patch: InsidePatch): YardProject {
  let panels = project.panels;
  if (patch.shelves != null) panels = retileShelves(panels, patch.shelves, project.overall.height);
  if (patch.drawers != null) panels = retileNamed(panels, "drawer", patch.drawers, "Drawer");
  if (patch.cubbies != null) panels = retileCubbies(panels, patch.cubbies);
  if (panels === project.panels) return project;
  return { ...project, panels };
}

function retileShelves(panels: Panel[], count: number, overallH: number): Panel[] {
  const shelves = panels.filter((p) => p.type === "shelf");
  if (!shelves.length) return panels;
  const n = Math.max(0, Math.round(count));
  const proto = shelves[0];
  const bottom = panels.find((p) => p.type === "bottom");
  const top = panels.find((p) => p.type === "top");
  const low = (bottom?.position.y ?? 0) + (bottom?.size.height ?? proto.size.height);
  const high = top?.position.y ?? overallH - proto.size.height;
  const span = Math.max(proto.size.height, high - low - proto.size.height);
  const next = Array.from({ length: n }, (_, i) => {
    const src = shelves[Math.min(i, shelves.length - 1)];
    const y = n <= 1 ? low + span / 2 : low + (span * (i + 1)) / (n + 1);
    return {
      ...src,
      id: `shelf-${i + 1}`,
      name: n === 1 ? "Shelf" : `Shelf ${i + 1}`,
      position: { ...src.position, y: Math.round(y * 16) / 16 },
    };
  });
  return [...panels.filter((p) => p.type !== "shelf"), ...next];
}

function retileNamed(panels: Panel[], type: Panel["type"], count: number, label: string): Panel[] {
  const have = panels.filter((p) => p.type === type);
  if (!have.length) return panels;
  const n = Math.max(0, Math.round(count));
  const proto = have[0];
  const ys = have.map((p) => p.position.y).sort((a, b) => a - b);
  const low = ys[0];
  const high = ys[ys.length - 1];
  const next = Array.from({ length: n }, (_, i) => {
    const src = have[Math.min(i, have.length - 1)];
    const y = n <= 1 ? low : low + ((high - low) * i) / Math.max(1, n - 1);
    return {
      ...src,
      id: `${type}-${i + 1}`,
      name: n === 1 ? label : `${label} ${i + 1}`,
      position: { ...src.position, y: Math.round(y * 16) / 16 },
    };
  });
  return [...panels.filter((p) => p.type !== type), ...next];
}

function retileCubbies(panels: Panel[], count: number): Panel[] {
  const dividers = panels.filter((p) => p.type === "divider");
  if (!dividers.length) return panels;
  const n = Math.max(1, Math.round(count));
  const want = Math.max(0, n - 1);
  const proto = dividers[0];
  const left = panels.find((p) => p.type === "upright");
  const width = Math.max(...panels.filter((p) => p.type === "upright").map((p) => p.position.x + p.size.width), proto.position.x + proto.size.width);
  const x0 = left?.position.x ?? 0;
  const span = width - x0;
  const next = Array.from({ length: want }, (_, i) => {
    const src = dividers[Math.min(i, dividers.length - 1)];
    const x = x0 + (span * (i + 1)) / n - src.size.width / 2;
    return {
      ...src,
      id: `divider-${i + 1}`,
      name: `Cubby divider ${i + 1}`,
      position: { ...src.position, x: Math.round(x * 16) / 16 },
    };
  });
  return [...panels.filter((p) => p.type !== "divider"), ...next];
}
