/**
 * "Made on Yard" home cards: each card is live engine output, never a photo.
 * The picture, the cut-piece count and the Buy total all come from the same model the plan opens.
 */
import { generateFromPrompt } from "./prompt";
import { buildPlan } from "./report";
import { planOverviewSvg } from "./planStepPicture";

export type Showcase = {
  /** Finished-piece drawing from the engine (same vector path as the printed plan). */
  svg: string;
  /** Cut pieces on the plan's cut list. */
  pieces: number;
  /** Buy list total in whole dollars. */
  buyUsd: number;
  /** Width × height × depth the model reports, in shop fractions. */
  overall: { width: number; height: number; depth: number };
};

export function showcaseFor(prompt: string, w = 480, h = 360): Showcase {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const buyUsd = Math.round(plan.bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0));
  const svg = planOverviewSvg(project, w, h)
    .svg.replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
  return { svg, pieces: plan.totals.pieces, buyUsd, overall: project.overall };
}

