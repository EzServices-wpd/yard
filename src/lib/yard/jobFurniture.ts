/**
 * A furniture job with no craft stock is full-size wood.
 * Popsicle, cardboard, and Lego only when the person types them.
 */
import { createId } from "./structureGraph";
import type { AssemblyStep, Panel, YardProject } from "./types";

const CRAFT = /popsicle|craft\s*stick|toothpick|skewer|cardboard|chipboard|lego|\bstraw\b|balsa/;
const JOB = /\b(?:chair|stool|bench|table|desk|shelf|bookcase|cabinet)\b/;

export function namesCraftStock(prompt: string, materialOverride?: string): boolean {
  return CRAFT.test(`${prompt} ${materialOverride ?? ""}`.toLowerCase());
}

/** Chair, stool, bench, table, desk, shelf, cabinet — not a step stool, not chair space. */
export function wantsJobFurniture(prompt: string, materialOverride?: string): boolean {
  const lower = prompt.toLowerCase().replace(/chair[\s-]+space/g, " ");
  if (!JOB.test(lower) || namesCraftStock(prompt, materialOverride)) return false;
  if (/step-?stool|step-?up|climb\s+stool|adirondack|lounge\s*chair|rocking\s*chair|ottoman/.test(lower)) return false;
  if (/\bcloset\b|\balcove\b|\bpocket\b/.test(lower)) return false;
  return true;
}

function num(prompt: string, re: RegExp, fallback: number): number {
  const m = prompt.match(re);
  return m ? Number(m[1]) : fallback;
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId: string): Panel {
  return { id: createId("p"), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId };
}

export function buildJobFurniture(prompt: string): YardProject {
  const lower = prompt.toLowerCase();
  const seatH = num(prompt, /(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in)?\s*seat\s*height/i, 18);
  const width = num(prompt, /(\d+(?:\.\d+)?)\s*(?:wide|width)/i, /\bchair\b|\bstool\b/.test(lower) ? 18 : 36);
  const depth = num(prompt, /(\d+(?:\.\d+)?)\s*(?:deep|depth)/i, /\bchair\b|\bstool\b/.test(lower) ? 16 : 18);
  const leg = 1.5;
  const x0 = -width / 2;
  const ply = "plywood-3-4-4x8";
  const stud = "lumber-2x4-8";
  const panels: Panel[] = [];
  const chair = /\bchair\b/.test(lower);
  const backH = chair ? 16 : 0;
  const legH = chair ? seatH + backH : seatH;
  panels.push(panel("upright", "Front left leg", x0, 0, depth - leg, leg, seatH, leg, stud));
  panels.push(panel("upright", "Front right leg", x0 + width - leg, 0, depth - leg, leg, seatH, leg, stud));
  panels.push(panel("upright", "Back left leg", x0, 0, 0, leg, legH, leg, stud));
  panels.push(panel("upright", "Back right leg", x0 + width - leg, 0, 0, leg, legH, leg, stud));
  panels.push(panel("rail", "Front apron", x0 + leg, seatH - 3.5, depth - leg - 0.75, width - leg * 2, 3.5, 0.75, ply));
  panels.push(panel("rail", "Back apron", x0 + leg, seatH - 3.5, 0, width - leg * 2, 3.5, 0.75, ply));
  panels.push(panel("rail", "Left apron", x0, seatH - 3.5, leg, 0.75, 3.5, depth - leg * 2, ply));
  panels.push(panel("rail", "Right apron", x0 + width - 0.75, seatH - 3.5, leg, 0.75, 3.5, depth - leg * 2, ply));
  panels.push(panel("deck", "Seat", x0, seatH - 0.75, 0, width, 0.75, depth, ply));
  if (chair) {
    panels.push(panel("upright", "Back left upright", x0, seatH, 0, leg, backH, leg, stud));
    panels.push(panel("upright", "Back right upright", x0 + width - leg, seatH, 0, leg, backH, leg, stud));
    panels.push(panel("back", "Back", x0 + leg, seatH + 1, 0, width - leg * 2, backH - 2, 0.75, ply));
  }
  const name = chair ? `Dining chair ${width}" × ${seatH}" seat` : `Seat ${width}" × ${seatH}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "furniture",
    overall: { width, height: chair ? seatH + backH : seatH, depth },
    instances: [],
    panels,
    primaryMaterialId: ply,
    notes: [`${name}. 2× legs, 3/4" plywood seat and aprons. Full-size wood — no craft stock was named.`],
    historic: false,
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "person" },
  };
}

export function jobFurnitureSteps(project: YardProject): AssemblyStep[] {
  const seat = project.panels.some((p) => p.name === "Seat");
  const back = project.panels.some((p) => p.name === "Back");
  const steps: AssemblyStep[] = [
    { step: 1, title: "Confirm the footprint — do not cut yet", description: "Mark the four leg centers. Check both diagonals.", partsUsed: ["*"] },
    { step: 2, title: "Cut the 2×4 legs and the 3/4\" plywood", description: "Four legs, four aprons, and the seat. A chair also gets two back uprights and a back.", partsUsed: ["*"] },
    { step: 3, title: "Stand the 4 legs", description: "Stand the 4 legs on the marks. Fasten the pairs with the screws on the Buy list.", partsUsed: ["Front left leg", "Front right leg", "Back left leg", "Back right leg"] },
    { step: 4, title: "Set the 4 aprons on the legs", description: "Set the front, back, left, and right aprons on the legs. Fasten with #8 x 1 1/4\" screws, the same screws on the Buy list.", partsUsed: ["Front apron", "Back apron", "Left apron", "Right apron"] },
  ];
  if (seat) steps.push({ step: 5, title: "Set the seat on the aprons", description: "Set the seat on the aprons. Fasten with #8 x 1 1/4\" screws, the same screws on the Buy list.", partsUsed: ["Seat"] });
  if (back) steps.push({ step: 6, title: "Set the back on the seat", description: "Set the back uprights and the back on the seat. Fasten with #8 x 1 1/4\" screws, the same screws on the Buy list.", partsUsed: ["Back left upright", "Back right upright", "Back"] });
  steps.push({ step: steps.length + 1, title: "Sit on it", description: "Sit on the seat. It should feel solid. If an apron rocks, re-join that joint.", partsUsed: ["Seat"] });
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}
