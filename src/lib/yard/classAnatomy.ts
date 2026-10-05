/**
 * Class anatomy fallback: when no builder owns a noun, its class still picks an honest body.
 *
 * - A bed for a pet ("dog bed", "cat bed") is a low open box at pet scale: a floor of boards side by side,
 *   walls of stacked boards, and a lower front so the animal steps in.
 * - A figure in cardboard ("cardboard robot") is built from folded boxes: leg and arm tubes, a body box and
 *   a head box, joined with hot glue — the way cardboard is really built, never ripped into sticks.
 * Steps for both come from the parts and what each rests on.
 */
import { createId } from "./structureGraph";
import { inchFrac } from "./inchText";
import { panelJoints } from "./modelJoints";
import type { AssemblyStep, CatalogItem, Panel, StructureKind, YardProject } from "./types";

export const ANATOMY_NOTE = "Class anatomy:";

const PET_BED = /\b(dogs?|doggy|pupp(?:y|ies)|cats?|kitty|kittens?|pets?)\s*-?\s*beds?\b/;

export type Anatomy = "pet-bed" | "box-figure";

function isCardboard(item: CatalogItem) {
  return item.category === "cardboard" || /cardboard|chipboard/i.test(item.id);
}

export function classAnatomy(prompt: string, item: CatalogItem, kind: StructureKind): Anatomy | null {
  const lower = prompt.toLowerCase();
  if (PET_BED.test(lower) && (item.formFactor === "board" || item.formFactor === "sheet")) return "pet-bed";
  if (kind === "figure" && isCardboard(item)) return "box-figure";
  return null;
}

function typed(prompt: string, re: RegExp): number | null {
  const m = prompt.match(re);
  return m ? Number(m[1]) : null;
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId: string): Panel {
  return { id: createId("p"), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId };
}

const r16 = (n: number) => Math.round(n * 16) / 16;

export function buildPetBed(prompt: string, item: CatalogItem): YardProject {
  const lower = prompt.toLowerCase();
  const cat = /\b(cats?|kitty|kittens?)\b/.test(lower);
  const W = typed(lower, /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|")?\s*(?:wide|long)/) ?? (cat ? 20 : 36);
  const D = typed(lower, /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|")?\s*deep/) ?? (cat ? 16 : 28);
  const board = item.formFactor === "board";
  const bt = (item.dims.height ?? item.dims.thickness ?? 0.75) || 0.75;
  const bw = board ? item.dims.width ?? 3.5 : Math.max(W, D);
  const wallH = cat ? 6 : 8;
  const rows = board ? Math.max(1, Math.round((wallH - bt) / bw)) : 1;
  const rowH = board ? bw : wallH - bt;
  const id = item.id;
  const x0 = -W / 2;
  const panels: Panel[] = [];
  // Floor: boards side by side across the whole bed.
  const floorN = board ? Math.ceil(D / bw) : 1;
  for (let i = 0; i < floorN; i++) {
    const z = i * bw;
    const d = board ? Math.min(bw, D - z) : D;
    panels.push(panel("deck", board ? "Floor board" : "Floor", x0, 0, z, W, bt, r16(d), id));
  }
  // Walls stand on the floor edges: back and sides full height, front one row lower so the pet steps in.
  const inner = D - bt * 2;
  for (let r = 0; r < rows; r++) {
    const y = bt + r * rowH;
    panels.push(panel("side", "Back wall board", x0, y, 0, W, rowH, bt, id));
    panels.push(panel("side", "Side wall board", x0, y, bt, bt, rowH, r16(inner), id));
    panels.push(panel("side", "Side wall board", x0 + W - bt, y, bt, bt, rowH, r16(inner), id));
    if (r < Math.max(1, rows - 1)) panels.push(panel("side", "Low front board", x0, y, D - bt, W, rowH, bt, id));
  }
  const H = r16(bt + rows * rowH);
  const who = cat ? "Cat" : /\b(pets?)\b/.test(lower) ? "Pet" : "Dog";
  const name = `${who} bed ${inchFrac(W)}" × ${inchFrac(D)}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "furniture",
    overall: { width: W, height: H, depth: r16(D) },
    instances: [],
    panels,
    primaryMaterialId: id,
    notes: [
      `${ANATOMY_NOTE} low bed. ${name}, ${inchFrac(H)}" tall, at ${who.toLowerCase()} scale from ${item.name}. A floor of boards side by side, walls stacked on its edges, and a lower front so the ${who.toLowerCase()} steps in. Add a cushion about ${inchFrac(W - 2)}" × ${inchFrac(D - 2)}".`,
    ],
    historic: false,
    assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

export function buildBoxFigure(prompt: string, item: CatalogItem, size: { width: number; height: number; depth: number }, name: string): YardProject {
  const lower = prompt.toLowerCase();
  const H = typed(lower, /(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|")?\s*(?:tall|high)/) ?? (size.height >= 12 && size.height <= 72 ? size.height : 24);
  const t = item.dims.thickness ?? 0.16;
  const legH = r16(H * 0.3);
  const bodyH = r16(H * 0.4);
  const headH = r16(H - legH - bodyH);
  const bodyW = r16(H * 0.42);
  const D = r16(H * 0.28);
  const legW = r16(bodyW * 0.32);
  const headW = r16(bodyW * 0.7);
  const armW = r16(legW * 0.8);
  const armL = r16(bodyH * 0.85);
  const id = item.id;
  const panels: Panel[] = [];
  // A closed box: front/back, two sides, top and bottom. A tube skips top and bottom.
  const box = (label: string, x: number, y: number, z: number, w: number, h: number, d: number, closed: boolean) => {
    panels.push(panel("side", `${label} front`, x, y, z + d - t, w, h, t, id));
    panels.push(panel("side", `${label} back`, x, y, z, w, h, t, id));
    panels.push(panel("side", `${label} side`, x, y, z + t, t, h, r16(d - 2 * t), id));
    panels.push(panel("side", `${label} side`, x + w - t, y, z + t, t, h, r16(d - 2 * t), id));
    if (closed) {
      panels.push(panel("side", `${label} bottom`, x + t, y, z + t, r16(w - 2 * t), t, r16(d - 2 * t), id));
      panels.push(panel("side", `${label} top`, x + t, y + h - t, z + t, r16(w - 2 * t), t, r16(d - 2 * t), id));
    }
  };
  const x0 = -bodyW / 2;
  const legD = r16(D * 0.8);
  box("Leg tube", x0, 0, (D - legD) / 2, legW, legH, legD, false);
  box("Leg tube", x0 + bodyW - legW, 0, (D - legD) / 2, legW, legH, legD, false);
  box("Body", x0, legH, 0, bodyW, bodyH, D, true);
  box("Head", -headW / 2, legH + bodyH, (D - r16(D * 0.85)) / 2, headW, headH, r16(D * 0.85), true);
  box("Arm", x0 - armW, legH + bodyH - armL, (D - armW) / 2, armW, armL, armW, false);
  box("Arm", x0 + bodyW, legH + bodyH - armL, (D - armW) / 2, armW, armL, armW, false);
  const title = name || "Robot";
  return {
    id: createId("proj"),
    name: `Cardboard ${title.toLowerCase()} ${inchFrac(H)}" tall`,
    prompt,
    kind: "figure",
    overall: { width: r16(bodyW + armW * 2), height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: id,
    notes: [
      `${ANATOMY_NOTE} box figure. Built from folded cardboard boxes: two leg tubes, a body box, a head box and two arm tubes, joined with hot glue. Each face is cut from the sheet; fold each box on scored lines with a 1" glue tab.`,
    ],
    historic: false,
    assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

export function classAnatomySteps(project: YardProject): AssemblyStep[] | null {
  const note = (project.notes ?? []).find((n) => n.startsWith(ANATOMY_NOTE));
  if (!note) return null;
  const names = (re: RegExp) => project.panels.filter((p) => re.test(p.name)).map((p) => p.name);
  if (/low bed/.test(note)) {
    const floor = names(/^Floor/);
    const walls = names(/^(Back|Side) wall/);
    const front = names(/^Low front/);
    // Screws per step come from the model's joints: each joint is counted in the step that places its later part.
    const joints = panelJoints(project.panels);
    const ids = (re: RegExp) => new Set(project.panels.filter((p) => re.test(p.name)).map((p) => p.id));
    const wallIds = ids(/^(Back|Side) wall/);
    const frontIds = ids(/^Low front/);
    const count = (mine: Set<string>, later: Set<string>) =>
      joints
        .filter((j) => (mine.has(j.a) || mine.has(j.b)) && !later.has(j.a) && !later.has(j.b))
        .reduce((n, j) => n + j.screws, 0);
    const wallScrews = count(wallIds, frontIds);
    const frontScrews = count(frontIds, new Set());
    const total = joints.reduce((n, j) => n + j.screws, 0);
    return [
      { step: 1, title: "Read the bed before you cut", description: `${project.name}. Every part is the same board. Pull any nails from reclaimed boards first.`, partsUsed: ["*"] },
      { step: 2, title: "Cut every board to its mark", description: "Square each cut. Sand off splinters as you go.", partsUsed: ["*"] },
      { step: 3, title: `Lay the ${floor.length} floor boards side by side`, description: "Lay the floor boards side by side on the floor, ends flush, edges tight. This is the bed's floor; the walls stand on its edges.", partsUsed: floor },
      { step: 4, title: "Stand the back and side walls on the floor edges", description: `Stand the back wall boards on the back edge of the floor and the side wall boards on the side edges, rows stacked. Glue every joint, then screw each corner and up through each floor board into the wall it meets, one screw about every 8" along each joint (at least 2): ${wallScrews} screws in this step.`, partsUsed: walls },
      { step: 5, title: "Add the low front", description: `Stand the low front board on the front edge of the floor. It is one row lower so the pet steps in. Glue it, then screw both corners and up through the floor board under it, one screw about every 8" along each joint (at least 2): ${frontScrews} screws. That makes all ${total} screws from the model's joints on the Buy list.`, partsUsed: front },
      { step: 6, title: "Sand every edge and add the cushion", description: "Round every edge and corner with sandpaper so nothing snags fur or paws. Set a cushion inside.", partsUsed: ["*"] },
    ];
  }
  if (/box figure/.test(note)) {
    const glue = "hot glue (or the craft glue on the Buy list) on the tab, hold 15–30 seconds until it grabs";
    return [
      { step: 1, title: "Read the figure before you cut", description: `${project.name}. Six boxes: two leg tubes, a body box, a head box and two arm tubes. Every face is on the cut list.`, partsUsed: ["*"] },
      { step: 2, title: "Cut and score every face", description: "Box cutter on a mat, steel ruler as the guide. Leave a 1\" glue tab on one edge of each face. Score fold lines with a dull edge so they bend clean.", partsUsed: ["*"] },
      { step: 3, title: "Fold the two leg tubes and stand them on the floor", description: `Fold each leg's four faces into a tube, ${glue}. Stand both tubes on the floor, a hand's width apart.`, partsUsed: names(/^Leg tube/) },
      { step: 4, title: "Build the body box and set it on the legs", description: `Fold the body's four sides, then glue in the bottom and the top, ${glue}. Set the body on the leg tubes and hot-glue it down to both.`, partsUsed: names(/^Body/) },
      { step: 5, title: "Build the head box and set it on the body", description: `Fold and glue the head box the same way. Set it centered on the body top and hot-glue it down.`, partsUsed: names(/^Head/) },
      { step: 6, title: "Glue the arm tubes to the body sides", description: `Fold each arm tube, ${glue}. Hot-glue one to each side of the body, tops level with the body top.`, partsUsed: names(/^Arm/) },
      { step: 7, title: "Stand it up and decorate", description: "Check it stands without tipping. Draw on the face and dials with a marker, or glue on bottle caps.", partsUsed: ["*"] },
    ];
  }
  return null;
}
