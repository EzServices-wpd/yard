/** Table walkthrough — top + legs + aprons (+ spoken lower shelf on shelf rails).
 * Round/oval footprint uses footprintConfirmTalk (round top is not a square).
 */

import { getCatalogItem } from "./catalog";
import { namedStockDisplayName } from "./weekendStockHonesty";
import { glueUpTalk, planSolidBoards } from "./solidStock";
import { shopPlural } from "./shopPlural";
import type { AssemblyStep, Panel, YardProject } from "./types";
import { footprintConfirmTalk } from "./voiceHonesty";

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
  const ovalTop = u?.shape === "oval";
  const legs = panels.filter((p) => /^leg\b/i.test(p.name) || (p.type === "upright" && p.size.width <= 2));
  // Aprons only — shelf rails are a separate join under the spoken shelf.
  const aprons = panels.filter((p) => /apron/i.test(p.name));
  const shelfRails = panels.filter((p) => /shelf\s*rail/i.test(p.name));
  const shelves = panels.filter((p) => p.type === "shelf" || /^Shelf(?:\s+\d+)?$/i.test(p.name));
  const tops = panels.filter((p) => p.type === "top");
  const legN = legs.length || u?.legs || 4;
  const item = getCatalogItem(project.primaryMaterialId);
  const steps: AssemblyStep[] = [];
  let n = 1;

  const shelfBit =
    shelves.length > 0
      ? ` · ${shelves.length} shelf${shelves.length === 1 ? "" : "ves"} on shelf rails`
      : "";

  steps.push({
    step: n++,
    title: "Confirm the footprint — do not cut yet",
    description: `${project.name}. ${roundTop ? `Round top, diameter ${round(W)}"` : ovalTop ? `Oval top ${round(W)}" long × ${round(D)}" wide` : `Top ${round(W)}" × ${round(D)}"`} · height ${round(H)}" · ${legN} legs${shelfBit}. ${footprintConfirmTalk({
      shape: roundTop ? "round" : ovalTop ? "oval" : "rect",
      widthLabel: round(W),
      depthLabel: round(D),
    })} ${legN} legs stay on the plan.`,
    tips: "If a number on this plan disagrees with the cut list, trust the cut list.",
    partsUsed: ["*"],
  });

  const plyBits = [...tops, ...aprons, ...shelves, ...shelfRails];
  const plyTitleBits = [
    "top",
    aprons.length ? "aprons" : "",
    shelves.length ? (shelves.length === 1 ? "shelf" : "shelves") : "",
    shelfRails.length ? "shelf rails" : "",
  ].filter(Boolean);
  // Cut-step stock follows panel materialIds — never "Cut the 1×4 Board" for a
  // plywood-nested top/apron when named lumber only bound the primary label.
  const sheetPanel = plyBits.find((p) => /^(plywood-|sheet-)/i.test(p.materialId));
  const cutStockName = sheetPanel
    ? (getCatalogItem(sheetPanel.materialId)?.name ?? '3/4" plywood')
    : (item?.name ?? '3/4" plywood');
  const namedBoundOverSheet =
    !!sheetPanel && project.primaryMaterialId === "lumber-1x4-8" && !!item;
  const speciesBoardLabel = namedBoundOverSheet
    ? namedStockDisplayName(project.prompt ?? "", item!)
    : "";
  // Named solid stock drives the parts: glue the wide top up from boards first.
  const solidBits = plyBits.filter((p) => p.materialId === "lumber-1x4-8");
  const solidLabel = solidBits.length && item ? namedStockDisplayName(project.prompt ?? "", item) : "";
  const glueTalk = solidLabel
    ? glueUpTalk(
        planSolidBoards(
          solidBits.map((p) => {
            const dims = [p.size.width, p.size.height, p.size.depth].sort((a, b) => b - a);
            return { name: p.name, lengthIn: dims[0], widthIn: dims[1], qty: 1 };
          }),
        ),
        solidLabel,
      )
    : "";
  steps.push({
    step: n++,
    title: `${glueTalk ? "Glue up and cut" : "Cut"} the ${solidLabel || cutStockName} (${plyTitleBits.join(" + ")})`,
    description: `${glueTalk ? `${glueTalk} ` : ""}Circular saw and a straightedge. Face up, label the waste face. ${plyBits.map(cutLine).join("; ")}.${roundTop ? ` Cut the top as a ${round(W)}" square blank, then band-saw / jigsaw to a ${round(W)}" diameter circle.` : ovalTop ? ` Cut the top as a ${round(W)}" × ${round(D)}" rectangular blank, then band-saw / jigsaw to an oval ${round(W)}" long × ${round(D)}" wide.` : ""}${namedBoundOverSheet ? ` Do not try to cut a sheet-sized top from a single ${speciesBoardLabel} — the blank comes from the plywood nest on the Buy list.` : ""}`,
    tips: namedBoundOverSheet
      ? `Support the offcut so it does not break out. Iron-on edge banding on the top edge if people will see ply. ${speciesBoardLabel} on the Buy list are the species story (face/finish), not the blank width.`
      : "Support the offcut so it does not break out. Iron-on edge banding on the top edge if people will see ply.",
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

  if (shelfRails.length && shelves.length && legs.length) {
    const shelfY = round(shelves[0].position.y + shelves[0].size.height);
    steps.push({
      step: n++,
      title: `Screw the shelf rails and set the ${shelves.length === 1 ? "shelf" : "shelves"}`,
      description: `${shelfRails.map(cutLine).join("; ")}. ${shelves.map(cutLine).join("; ")}. Keep the base upside-down. Screw each shelf rail to the inner faces of the legs at the marked height (shelf top face ~${shelfY}" AFF when standing). Sit each shelf on its rails and screw down into the rails — not up through the face. Glue + #8 × 1¼" screws.`,
      tips: "Shelf rails match the apron style — 3/4\" ply on the inner faces, clear of the apron under the top.",
      partsUsed: [...legs, ...shelfRails, ...shelves].map((p) => p.name),
    });
  }

  if (tops.length) {
    steps.push({
      step: n++,
      title: roundTop ? "Center the round top on the base" : ovalTop ? "Center the oval top on the base" : "Set the top on the base",
      description: `${tops.map(cutLine).join("; ")}. Flip the base right-side up. Center the top on the aprons${roundTop ? " so the overhang is even all around" : ovalTop ? " so the oval overhang is even on the long and short axes" : " so the overhang is even on all four sides"}. Glue the aprons, then screw up through the aprons into the top (not down through the face).`,
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
  const aprons = panels.filter((p) => /apron/i.test(p.name));
  const shelves = panels.filter((p) => p.type === "shelf" || /^Shelf(?:\s+\d+)?$/i.test(p.name));
  const shelfRails = panels.filter((p) => /shelf\s*rail/i.test(p.name));
  const parts = [
    `${tops.length} ${shopPlural("top", tops.length)}`,
    `${aprons.length} ${shopPlural("apron", aprons.length)}`,
  ];
  if (shelves.length) parts.push(`${shelves.length} ${shopPlural("shelf", shelves.length)}`);
  if (shelfRails.length) parts.push(`${shelfRails.length} shelf rail${shelfRails.length === 1 ? "" : "s"}`);
  return `${parts.join(", ")}.`;
}
