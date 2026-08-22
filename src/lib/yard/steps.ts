/** Unique walkthrough for THIS project — names, sizes, and counts from the bench. */

import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { slideInches } from "./stockLook";
import type { AssemblyStep, CatalogItem, Panel, YardInstance, YardProject } from "./types";

function dim(p: Panel) {
  return `${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}`;
}

function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2);
}

function list(panels: Panel[]) {
  return panels.map((p) => `${p.name} (${dim(p)}")`).join("; ");
}

function joinHold(item?: CatalogItem | null) {
  const join = (item?.preferredJoins && item.preferredJoins[0]) || "glue";
  if (join === "glue") return { join, hold: "Wood glue. Hold 30–60 seconds. Wipe squeeze-out. It will not take load until tomorrow." };
  if (join === "solvent") return { join, hold: "Solvent cement is permanent. Dry-fit the whole thing first — you get one shot." };
  if (join === "tape") return { join, hold: "Packing tape, inside and out. Rub every seam so it bonds. Not screws." };
  if (join === "screw") return { join, hold: "Predrill. #8 screws, plus a drop of glue in the joint if a person will sit or stand on it." };
  if (join === "nail") return { join, hold: "Finish nails or brads, plus glue. Predrill near the ends so the board does not split." };
  return { join, hold: `Primary join: ${join}.` };
}

function cutHow(item?: CatalogItem | null) {
  if (!item) return { how: "Cut to the list.", tip: "Label the waste face." };
  if (item.category === "cardboard") {
    return { how: "Utility knife and a straightedge. Score twice, then snap.", tip: "Not a circular saw. A knife follows a drywall T-square." };
  }
  if (item.formFactor === "pipe") {
    return { how: "PVC cutter or a fine hacksaw. Deburr so each end seats in the fitting.", tip: "A ragged end will not bottom out in a slip tee." };
  }
  if (item.category === "craft_wood") {
    return { how: "Snips or a razor on a scrap board.", tip: "One wrong cut wastes a stick. Cut long, then sneak up on the line." };
  }
  if (item.formFactor === "board") {
    return { how: "Hand saw or circular saw. Square every cut. Predrill near the ends — boards split.", tip: "Cedar and 1× split. Predrill." };
  }
  if (item.category === "plastic") {
    return { how: "Sharp snips. Square the cut so tape has a face to grab.", tip: "A crushed straw will not take a joint." };
  }
  return { how: "Circular saw and a straightedge. Face up, label the waste face.", tip: "Support the offcut so it does not break out." };
}

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  if (project.panels.length && !project.instances.length) {
    if (isSheetCraft(project)) return uniqueSheetSteps(project);
    return uniqueCarcaseSteps(project);
  }
  if (project.instances.length) return uniqueForgeSteps(project);
  return [
    {
      step: 1,
      title: "Empty bench",
      description: "Generate a thing first. These steps are written from the pieces on the bench.",
    },
  ];
}

function isSheetCraft(project: YardProject) {
  if (project.fitted || project.pocket || project.kind === "closet" || project.kind === "opening") return false;
  if (project.kind === "castle" || project.kind === "house") return true;
  const item = getCatalogItem(project.primaryMaterialId);
  return item?.category === "cardboard" || (item?.formFactor === "sheet" && item.category !== "sheet_goods");
}
