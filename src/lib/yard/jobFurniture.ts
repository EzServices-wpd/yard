/**
 * A furniture job with no craft stock is full-size wood.
 * Popsicle, cardboard, and Lego only when the person types them.
 */
import { getCatalogItem } from "./catalog";
import { inchFrac } from "./inchText";
import { detectMaterial } from "./promptHelpers";
import { createId } from "./structureGraph";
import type { AssemblyStep, Panel, YardProject } from "./types";

const CRAFT = /popsicle|craft\s*stick|toothpick|skewer|cardboard|chipboard|lego|\bstraw\b|balsa/;
const JOB = /\b(?:chair|stool|bench|table|desk|shelf|bookcase|cabinet)\b/;

/** A piece people sit, sleep, eat, work at, or store things on — built at real size. */
const HUMAN_USE =
  /\b(?:chairs?|stools?|benche?s?|tables?|desks?|beds?|bunks?|cribs?|cots?|headboards?|sofas?|couch(?:es)?|settees?|loveseats?|ottomans?|swings?|picnic|adirondack|loungers?|recliners?|dressers?|nightstands?|wardrobes?|bookcases?|bookshel(?:f|ves)|shel(?:f|ves)|cabinets?|vanit(?:y|ies)|workbench(?:es)?|daybeds?|futons?|chaises?)\b/;
/** Words that make it a model of the piece, not the piece. */
const MODEL_SCALE = /\b(?:doll|dollhouse|barbie|miniature|mini|model|toy|tiny|figurine|ornament|scale|diorama|fairy)\b/;

/** Furniture or a human-use piece with no stock typed: real lumber at real size (craft stock only when typed). */
export function wantsRealStockDefault(prompt: string): boolean {
  const lower = prompt.toLowerCase().replace(/chair[\s-]+space/g, " ");
  return HUMAN_USE.test(lower) && !MODEL_SCALE.test(lower) && !CRAFT.test(lower);
}

/** A house an animal lives in outdoors (birdhouse, wren or bluebird house): built in real boards at real size. */
const OUTDOOR_SHELTER = /\b(?:bird\s*-?\s*houses?|wren\s*houses?|bluebird\s*(?:houses?|box(?:es)?)|martin\s*houses?|(?:bird\s+)?nest(?:ing)?\s*box(?:es)?|(?:mason\s+)?(?:bee|bees|insect|bug|pollinator)\s*(?:hotels?|houses?|box(?:es)?)|bat\s*-?\s*(?:houses?|box(?:es)?))\b/;

/** An outdoor animal shelter with no stock typed: real 1×6 boards (craft stock only when typed). */
export function wantsRealShelterDefault(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return OUTDOOR_SHELTER.test(lower) && !/\b(?:chickens?|hens?|coop|poultry|duck)\b/.test(lower) && !MODEL_SCALE.test(lower) && !CRAFT.test(lower);
}

export const REAL_SHELTER_NOTE =
  "No material typed, so this builds from 1×6 boards at full size, the way it hangs outside. Type popsicle sticks to build a model.";

export const REAL_STOCK_NOTE =
  "No material typed, so this builds from 2×4 lumber at full size, the way people use it. Type popsicle sticks to build a model.";

export function namesCraftStock(prompt: string, materialOverride?: string): boolean {
  return CRAFT.test(`${prompt} ${materialOverride ?? ""}`.toLowerCase());
}

/** Chair, stool, bench, table, desk, shelf, cabinet — not a step stool, not chair space. */
export function wantsJobFurniture(prompt: string, materialOverride?: string): boolean {
  const lower = prompt.toLowerCase().replace(/chair[\s-]+space/g, " ");
  if (!JOB.test(lower) || namesCraftStock(prompt, materialOverride)) return false;
  const named = detectMaterial(prompt);
  // A named board builds a real chair from that board (seat boards side by side, doubled legs).
  const boardChair = !!named && boardOf(named.id) != null && /\bchair\b/.test(lower) && !materialOverride;
  if (named && !boardChair && !/wire/i.test(named.id) && !/popsicle/i.test(named.id)) return false;
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

/** A named dimensional board (1x4, 1x6, 2x4…): its real width and thickness. */
function boardOf(id: string): { id: string; w: number; t: number; label: string } | null {
  const item = getCatalogItem(id);
  if (!item || item.category !== "lumber" || item.formFactor !== "board") return null;
  const w = item.dims?.width ?? 0;
  const t = item.dims?.height ?? 0;
  if (!(w > 0 && t > 0)) return null;
  return { id, w, t, label: item.name };
}

/**
 * A chair from one named board: every part is that board.
 * Legs are two boards glued face to face. The seat is boards laid side by side across the aprons so
 * they cover the whole seat; the back is two boards across the back legs.
 */
function buildBoardChair(prompt: string, board: { id: string; w: number; t: number; label: string }): YardProject {
  // Seat heights people sit at: a bar stool at a 42" bar, a counter stool at a 36" counter, else a chair.
  const seatH = num(prompt, /(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in)?\s*seat\s*height/i, 18);
  const width = num(prompt, /(\d+(?:\.\d+)?)\s*(?:wide|width)/i, 18);
  const { w: bw, t: bt, id } = board;
  const legT = bt * 2;
  const legD = bw;
  const gap = 0.25;
  const typedDepth = prompt.match(/(\d+(?:\.\d+)?)\s*(?:deep|depth)/i);
  const boards = typedDepth
    ? Math.max(2, Math.floor((Number(typedDepth[1]) - legD + gap) / (bw + gap)))
    : Math.max(3, Math.ceil(13 / (bw + gap)));
  const span = typedDepth ? Number(typedDepth[1]) - legD : boards * bw + (boards - 1) * gap;
  const depth = Math.round((legD + span) * 16) / 16;
  const step = boards > 1 ? (span - bw) / (boards - 1) : 0;
  const backH = 16;
  const x0 = -width / 2;
  const apronTop = seatH - bt;
  const panels: Panel[] = [];
  const leg = (label: string, x: number, z: number, h: number) => {
    panels.push(panel("upright", `${label} leg (outer board)`, x, 0, z, bt, h, legD, id));
    panels.push(panel("upright", `${label} leg (inner board)`, x + bt, 0, z, bt, h, legD, id));
  };
  leg("Front left", x0, depth - legD, apronTop);
  leg("Front right", x0 + width - legT, depth - legD, apronTop);
  leg("Back left", x0, 0, seatH + backH);
  leg("Back right", x0 + width - legT, 0, seatH + backH);
  const inX = x0 + legT;
  const inW = width - legT * 2;
  panels.push(panel("rail", "Front apron", inX, apronTop - bw, depth - bt, inW, bw, bt, id));
  panels.push(panel("rail", "Back apron", inX, apronTop - bw, legD - bt, inW, bw, bt, id));
  panels.push(panel("rail", "Left apron", inX, apronTop - bw, legD, bt, bw, depth - legD * 2, id));
  panels.push(panel("rail", "Right apron", x0 + width - legT - bt, apronTop - bw, legD, bt, bw, depth - legD * 2, id));
  for (let i = 0; i < boards; i++) {
    panels.push(panel("deck", `Seat board ${i + 1}`, x0, apronTop, legD + step * i, width, bt, bw, id));
  }
  const backTop = seatH + backH;
  panels.push(panel("back", "Back board 1", x0, backTop - bw, legD, width, bw, bt, id));
  panels.push(panel("back", "Back board 2", x0, backTop - bw * 2 - 3, legD, width, bw, bt, id));
  const name = `Kitchen chair ${inchFrac(width)}" × ${inchFrac(seatH)}" seat`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "furniture",
    overall: { width, height: backTop, depth },
    instances: [],
    panels,
    primaryMaterialId: id,
    notes: [
      `${name}, every part from ${board.label}. Each leg is two boards glued face to face (${inchFrac(legT)}" × ${inchFrac(legD)}"). ${boards} seat boards lie side by side across the aprons and cover the ${inchFrac(width)}" × ${inchFrac(span)}" seat. Full-size wood — no craft stock was named.`,
    ],
    historic: false,
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "person" },
  };
}

export function buildJobFurniture(prompt: string): YardProject {
  const lower = prompt.toLowerCase();
  const named = detectMaterial(prompt);
  const board = named && /\bchair\b/.test(lower) ? boardOf(named.id) : null;
  if (board) return buildBoardChair(prompt, board);
  // Seat heights people sit at: a bar stool at a 42" bar, a counter stool at a 36" counter, else a chair.
  const seatH = num(prompt, /(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in)?\s*seat\s*height/i, /\bbar\s*stool/.test(lower) ? 30 : /\bcounter\s*stool/.test(lower) ? 24 : 18);
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
  panels.push(panel("rail", "Front apron", x0 + leg, seatH - 3.5, depth - 0.75, width - leg * 2, 3.5, 0.75, ply));
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

function boardChairSteps(project: YardProject): AssemblyStep[] {
  const names = (re: RegExp) => project.panels.filter((p) => re.test(p.name)).map((p) => p.name);
  const seat = names(/^Seat board/);
  const back = names(/^Back board/);
  const fix = '#8 x 1 1/4" screws, the same screws on the Buy list';
  const steps: AssemblyStep[] = [
    { step: 1, title: "Confirm the footprint — read before you cut", description: "Mark the four leg spots on the bench. Check both diagonals.", partsUsed: ["*"] },
    { step: 2, title: "Cut every board to its mark", description: "Every part is the same board. Cut the leg boards, the four aprons, the seat boards and the back boards to the cut list.", partsUsed: ["*"] },
    {
      step: 3,
      title: "Glue each leg pair",
      description: `Each leg is two boards. Spread glue on one face, clamp the pair flush, and drive ${fix} from the inner face, every 6". Make all 4 legs, then stand them on the floor at the leg spots.`,
      partsUsed: names(/ leg \(/),
    },
    {
      step: 4,
      title: "Build the two chair sides",
      description: `One join: each apron end takes glue and 2 screws. Glue and screw the left apron between the front left and back left legs, and the right apron between the right legs, top edges level, with ${fix}. Each side is a front leg, a back leg and an apron.`,
      partsUsed: ["Left apron", "Right apron"],
    },
    {
      step: 5,
      title: "Join the two sides with the front and back aprons",
      description: `One join: each apron end takes glue and 2 screws. Stand both sides up. Glue and screw the front apron between the front legs and the back apron between the back legs with ${fix}. Measure the diagonals equal.`,
      partsUsed: ["Front apron", "Back apron"],
    },
    {
      step: 6,
      title: `Set the ${seat.length} seat boards on the aprons`,
      description: `Lay the ${seat.length} seat boards side by side across the side aprons, front board flush with the front apron, small even gaps between boards. Two screws through each board end into the side apron, with ${fix}. Together they cover the whole seat.`,
      partsUsed: seat,
    },
    {
      step: 7,
      title: "Screw the back boards to the back legs",
      description: `Set the ${back.length} back boards across the front faces of the back legs, the top board flush with the leg tops. Two screws at each leg, with ${fix}.`,
      partsUsed: back,
    },
    { step: 8, title: "Sit on it", description: "With the seat boards and back boards fastened, sit on the seat. It should feel solid. If a joint moves, re-drive its screws.", partsUsed: seat },
  ];
  return steps;
}

export function jobFurnitureSteps(project: YardProject): AssemblyStep[] {
  if (project.panels.some((p) => /^Seat board/.test(p.name))) return boardChairSteps(project);
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
