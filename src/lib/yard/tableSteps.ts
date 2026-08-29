/** Table walkthrough — top + legs + aprons. Not a closet. */

import { getCatalogItem } from "./catalog";
import { shopPlural } from "./shopPlural";
import type { AssemblyStep, Panel, YardProject } from "./types";

function round(n: number) {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
}

function cutLine(p: Panel) {
  return `${p.name} — ${round(p.size.width)} × ${round(p.size.height)} × ${round(p.size.depth)}"`;
}

export function uniqueTableSteps(project: YardProject): AssemblyStep[] {
  const panels = project.panels;
  const u = project.fitted?.unit;
  const W = u?.width ?? project.overall.width;
  const H = u?.height ?? project.overall.height;
  const D = u?.depth ?? project.overall.depth;
  const roundTop = u?.shape === "round";
  const legs = panels.filter((p) => /^leg\b/i.test(p.name) || (p.type === "upright" && p.size.width <= 2));
  const aprons = panels.filter((p) => p.type === "rail" || /^apron\b/i.test(p.name));
  const tops = panels.filter((p) => p.type === "top");
  const legN = legs.length || u?.legs || 4;
  const item = getCatalogItem(project.primaryMaterialId);
  const steps: AssemblyStep[] = [];
  let n = 1;

  steps.push({
    step: n++,
    title: "Confirm the footprint — do not cut yet",
    description: `${project.name}. ${roundTop ? `Round top, diameter ${round(W)}"` : `Top ${round(W)}" × ${round(D)}"`} · height ${round(H)}" · ${legN} legs. Mark the footprint on the floor. Check it is square (or the circle is the size you want).`,
    tips: "If a number on this plan disagrees with the cut list, trust the cut list.",
    partsUsed: ["*"],
  });

  const plyBits = [...tops, ...aprons];
  steps.push({
    step: n++,
    title: `Cut the ${item?.name ?? '3/4" plywood'} (top + aprons)`,
    description: `Circular saw and a straightedge. Face up, label the waste face. ${plyBits.map(cutLine).join("; ")}.${roundTop ? ` Cut the top as a ${round(W)}" square blank, then band-saw / jigsaw to a ${round(W)}" diameter circle.` : ""}`,
    tips: "Support the offcut so it does not break out. Iron-on edge banding on the top edge if people will see ply.",
    partsUsed: plyBits.map((p) => p.name),
  });

  if (legs.length) {
    const legLen = round(legs[0].size.height);
    steps.push({
      step: n++,
      title: `Cut ${legN} legs from 2x2`,
      description: `${legs.map(cutLine).join("; ")}. Buy 2x2 (1-1/2" actual). Square both ends. All ${legN} the same length (${legLen}") so the top sits level.`,
      tips: "A stop-block on the saw keeps every leg identical. Do not nest 2x2 on the plywood sheet.",
      partsUsed: legs.map((p) => p.name),
    });
  }

  if (aprons.length && legs.length) {
    steps.push({
      step: n++,
      title: `Screw the ${aprons.length} aprons to the legs`,
      description: `Build the base upside-down on the bench. ${aprons.map(cutLine).join("; ")}. Each apron spans two legs, flush with the top of the posts. Glue + #8 × 1¼" screws, two per end. Predrill so the 2x2 does not split.`,
      tips: "Check both diagonals of the base before the glue skins. A 1/8 in difference will show as a wobble.",
      partsUsed: [...legs, ...aprons].map((p) => p.name),
    });
  }

  if (tops.length) {
    steps.push({
      step: n++,
      title: roundTop ? "Center the round top on the base" : "Set the top on the base",
      description: `${tops.map(cutLine).join("; ")}. Flip the base right-side up. Center the top on the aprons${roundTop ? " so the overhang is even all around" : " so the overhang is even on all four sides"}. Glue the aprons, then screw up through the aprons into the top (not down through the face).`,
      tips: "Clamp. Wipe squeeze-out. Do not rack the legs while the glue is wet.",
      partsUsed: [...tops, ...aprons, ...legs].map((p) => p.name),
    });
  }

  steps.push({
    step: n++,
    title: "Level it",
    description: `Stand the table. Sight the top. If a leg is short, shim the foot — do not twist the base. Height should read ${round(H)}".`,
    tips: "Guidance only — not stamped engineering. A felt pad under each foot saves the floor.",
    partsUsed: panels.map((p) => p.name),
  });

  return steps;
}

export function tableCutBlurb(panels: Panel[]): string {
  const tops = panels.filter((p) => p.type === "top");
  const aprons = panels.filter((p) => p.type === "rail");
  const n = aprons.length;
  return `${tops.length} ${shopPlural("top", tops.length)}, ${n} ${shopPlural("apron", n)}.`;
}
