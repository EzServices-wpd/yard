import { createId } from "@/lib/utils";
import { FORGE_CATALOG, getCatalogItem, searchCatalog } from "./catalog";
import { toPrimitive } from "./geometry";
import { graphToInstances } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket, POCKET_DREAM } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { projectFromMeasurement } from "./space";
import { looksLikeWindow, pickWindow, buildWindowProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import { analyzePieces, finishGraph } from "./connect";
import type { CatalogItem, StructureKind, YardInstance, YardProject } from "./types";

export const DREAMS = [
  {
    id: "eiffel",
    label: "3-ft popsicle Eiffel",
    prompt: "3 foot Eiffel Tower from popsicle sticks",
    blurb: "The north star — true-scale lattice, pack count, ordered steps.",
  },
  {
    id: "taj",
    label: "Paper-towel Taj",
    prompt: "2 foot tower from paper towels that looks like the Taj Mahal",
    blurb: "Recycled cores, stacked body, onion top.",
  },
  {
    id: "closet",
    label: "Bathroom pocket vanity",
    prompt: POCKET_DREAM,
    blurb: "The original — a wonky trapezoid, a straight unit, a plan you can cut.",
  },
  {
    id: "arch",
    label: "PVC garden arch",
    prompt: "6 foot garden arch from 3/4 inch PVC pipe",
    blurb: "Two legs and a curved crown in shop-length pipe.",
  },
  {
    id: "pyramid",
    label: "Craft-stick pyramid",
    prompt: "3 ft popsicle stick pyramid",
    blurb: "Stepped square rings, real stick lengths.",
  },
  {
    id: "window",
    label: "Andersen 36×48 hung",
    prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    blurb: "Pick the unit. Frame its RO. Buy the window and the lumber.",
  },
  {
    id: "bridge",
    label: "Straw bridge",
    prompt: "4 foot bridge from plastic drinking straws",
    blurb: "Deck, piers, a raised mid-span.",
  },
  {
    id: "desk",
    label: "60\" desk with drawers",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    blurb: "Same engine as the pocket — measure it, cut it, sit at it.",
  },
] as const;

export function parseSize(lower: string): { height: number; width: number; depth: number } {
  let height = 24;
  let width = 24;
  let depth = 24;

  const ftH = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:tall|high|height|tower)?/);
  const inH = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:tall|high)?/);
  if (ftH) height = parseFloat(ftH[1]) * 12;
  else if (inH) height = parseFloat(inH[1]);

  const pair = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/);
  if (pair) {
    width = parseFloat(pair[1]);
    height = parseFloat(pair[2]);
    if (pair[3]) depth = parseFloat(pair[3]);
  }

  const ftW = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wide|width|long|span)/);
  const inW = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:wide|width)/);
  if (ftW) width = parseFloat(ftW[1]) * 12;
  else if (inW) width = parseFloat(inW[1]);

  const ftD = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:deep|depth)/);
  const inD = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:deep|depth)/);
  if (ftD) depth = parseFloat(ftD[1]) * 12;
  else if (inD) depth = parseFloat(inD[1]);

  if (!ftW && !inW && !pair) {
    width = Math.max(12, height * 0.5);
    depth = width;
  }

  height = Math.min(Math.max(height, 6), 480);
  width = Math.min(Math.max(width, 6), 480);
  depth = Math.min(Math.max(depth, 4), 480);
  return { height, width, depth };
}

export function detectStructure(lower: string): StructureKind {
  if (looksLikeWindow(lower) || /rough opening|window ro|window opening/.test(lower)) return "opening";
  if (
    /closet|wardrobe|pantry|built-?in|cabinet|shelv|linen|vanity|alcove|pocket space|pocket in|desk|bookcase|bookshelf|workbench|dresser|nightstand|mudroom/.test(
      lower,
    )
  ) {
    return "closet";
  }
  return detectForm(lower, parseSize(lower)).kind;
}

export function detectMaterial(prompt: string): CatalogItem {
  const lower = prompt.toLowerCase();
  const phrases: [RegExp, string][] = [
    [/jumbo (craft|popsicle)/, "popsicle-jumbo"],
    [/giant (craft|popsicle)/, "popsicle-giant"],
    [/mini (craft|popsicle)/, "popsicle-mini"],
    [/popsicle|craft stick/, "popsicle-standard"],
    [/paper towel/, "paper-towel-roll"],
    [/toilet paper|tp roll/, "toilet-paper-roll"],
    [/mailing tube|poster tube/, "mailing-tube-2x24"],
    [/3\/4.?inch pvc|3\/4 pvc|three quarter pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch pvc|half inch pvc|1\/2 pvc/, "pvc-half-sch40"],
    [/1.?inch pvc|one inch pvc/, "pvc-1-sch40"],
    [/pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch dowel|half inch dowel/, "dowel-1-2-36"],
    [/1\/4.?inch dowel|quarter inch dowel/, "dowel-1-4-36"],
    [/dowel/, "dowel-1-2-36"],
    [/2\s*[x×]\s*4|two by four|stud/, "lumber-2x4-8"],
    [/1\s*[x×]\s*4|one by four/, "lumber-1x4-8"],
    [/plywood/, "plywood-3-4-4x8"],
    [/foam/, "foam-board-20x30"],
    [/cardboard/, "cardboard-corrugated-sheet"],
    [/straw/, "straw-plastic"],
    [/toothpick/, "toothpick"],
    [/skewer/, "bamboo-skewer-12"],
    [/soda can|aluminum can/, "soda-can"],
    [/bottle/, "plastic-bottle-16oz"],
    [/lego/, "legos-2x4"],
    [/copper/, "copper-pipe-half"],
    [/pool noodle|noodle/, "pool-noodle"],
  ];
  for (const [re, id] of phrases) {
    if (re.test(lower)) {
      const item = getCatalogItem(id);
      if (item) return item;
    }
  }
  const ranked = searchCatalog(lower, 5);
  return ranked[0] ?? FORGE_CATALOG[0];
}

function piece(
  id: string,
  catalogId: string,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  cutLength?: number,
  role?: string,
): YardInstance {
  return {
    id,
    catalogId,
    position: { x, y, z },
    rotation: { x: rx, y: ry, z: rz },
    cutLength,
    role,
  };
}

function buildTower(item: CatalogItem, catalogId: string, targetH: number, fancy = false) {
  const prim = toPrimitive(item);
  const layerH = prim.length;
  const layers = Math.max(1, Math.ceil(targetH / layerH));
  const r0 = Math.max(prim.width, prim.radius ? prim.radius * 2 : 1) * 0.9;
  const instances: YardInstance[] = [];
  for (let i = 0; i < layers; i++) {
    const y = i * layerH + layerH / 2;
    const taper = fancy ? 1 - (i / Math.max(layers - 1, 1)) * 0.45 : 1;
    const r = r0 * taper;
    const posts = layers < 3 && !fancy ? 1 : fancy ? 6 : 4;
    if (posts === 1) {
      instances.push(piece(`t-${i}`, catalogId, 0, y, 0, 0, 0, 0, undefined, "leg"));
    } else {
      for (let p = 0; p < posts; p++) {
        const a = (p / posts) * Math.PI * 2;
        instances.push(
          piece(`t-${i}-${p}`, catalogId, Math.cos(a) * r, y, Math.sin(a) * r, 0, a, 0, undefined, "leg"),
        );
      }
    }
  }
  return {
    instances,
    notes: [`Tower · ${layers} layer(s) · ~${(layers * layerH).toFixed(0)}" tall · ${item.name}`],
  };
}

function buildTaj(item: CatalogItem, catalogId: string, targetH: number) {
  const prim = toPrimitive(item);
  const layerH = prim.length;
  const bodyLayers = Math.max(2, Math.ceil((targetH * 0.65) / layerH));
  const domeLayers = Math.max(1, Math.ceil((targetH * 0.25) / layerH));
  const rBody = Math.max(8, prim.width * 4);
  const instances: YardInstance[] = [];
  const baseY = layerH / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    instances.push(piece(`base-${i}`, catalogId, Math.cos(a) * rBody, baseY, Math.sin(a) * rBody, 0, 0, 0, undefined, "base"));
  }
  for (let i = 0; i < bodyLayers; i++) {
    const y = layerH + i * layerH + layerH / 2;
    const r = rBody * (1 - i * 0.08);
    instances.push(piece(`body-c-${i}`, catalogId, 0, y, 0, 0, 0, 0, undefined, "leg"));
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
      instances.push(
        piece(`mina-${i}-${c}`, catalogId, Math.cos(a) * r * 1.15, y, Math.sin(a) * r * 1.15, 0, 0, 0, undefined, "leg"),
      );
    }
  }
  const domeBase = layerH + bodyLayers * layerH;
  for (let i = 0; i < domeLayers; i++) {
    const y = domeBase + i * layerH + layerH / 2;
    const r = rBody * 0.35 * (1 - i / Math.max(domeLayers, 1));
    const posts = Math.max(3, 6 - i);
    for (let p = 0; p < posts; p++) {
      const a = (p / posts) * Math.PI * 2;
      instances.push(piece(`dome-${i}-${p}`, catalogId, Math.cos(a) * r, y, Math.sin(a) * r, 0, 0, 0, undefined, "ring"));
    }
  }
  instances.push(piece("finial", catalogId, 0, domeBase + domeLayers * layerH + layerH / 2, 0, 0, 0, 0, undefined, "tip"));
  return {
    instances,
    notes: [`Taj-inspired · base + body + dome · ~${(domeBase + domeLayers * layerH + layerH).toFixed(0)}" · ${item.name}`],
  };
}

function buildPyramid(item: CatalogItem, catalogId: string, targetH: number, baseW: number) {
  const prim = toPrimitive(item);
  const historicBase = targetH * (230.3 / 146.6);
  const width = baseW > targetH * 0.7 ? baseW : historicBase;
  const layerH = Math.max(prim.height, prim.length * 0.28, 0.8);
  const layers = Math.max(4, Math.ceil(targetH / layerH));
  const instances: YardInstance[] = [];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1 || 1);
    const half = (width / 2) * (1 - t);
    const y = i * (targetH / layers) + layerH / 2;
    if (half < prim.length * 0.25) {
      instances.push(piece(`py-cap-${i}`, catalogId, 0, y, 0, 0, 0, 0, undefined, "tip"));
      continue;
    }
    const n = Math.max(4, Math.round((half * 8) / Math.max(prim.length * 0.85, 1.5)));
    for (let p = 0; p < n; p++) {
      const a = (p / n) * Math.PI * 2 + Math.PI / 4;
      instances.push(piece(`py-${i}-${p}`, catalogId, Math.cos(a) * half, y, Math.sin(a) * half, 0, 0, 0, undefined, "ring"));
    }
    // Hip edges of this course — the true frame
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
      instances.push(
        piece(`hip-${i}-${c}`, catalogId, Math.cos(a) * half, y, Math.sin(a) * half, 0, a, 0.4, prim.length, "leg"),
      );
    }
  }
  return {
    instances,
    notes: [
      `Pyramid mapped to Khufu slope (base/height ≈ 1.57) · ${layers} courses · base ~${width.toFixed(0)}"`,
      "Hip edges are the frame. Courses are bracing. A hollow hip frame without courses will rack.",
    ],
  };
}

function buildWall(item: CatalogItem, catalogId: string, targetW: number, targetH: number) {
  const prim = toPrimitive(item);
  const isCyl = item.formFactor === "tube" || item.formFactor === "pipe" || item.formFactor === "dowel";
  const pieceLen = prim.length;
  const pieceH = isCyl ? prim.length : prim.height;
  const cols = Math.max(1, Math.ceil(targetW / (pieceLen * 0.95)));
  const rows = Math.max(1, Math.ceil(targetH / pieceH));
  const instances: YardInstance[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pieceLen * 0.95 + pieceLen / 2;
      const y = r * pieceH + pieceH / 2;
      instances.push(
        piece(`w-${r}-${c}`, catalogId, x, y, 0, 0, 0, !isCyl && r % 2 === 1 ? Math.PI / 2 : 0, undefined, "member"),
      );
    }
  }
  return {
    instances,
    notes: [`Wall · ${cols}×${rows} · ~${(cols * pieceLen).toFixed(0)}" × ${(rows * pieceH).toFixed(0)}" · ${item.name}`],
  };
}

function buildBridge(item: CatalogItem, catalogId: string, span: number) {
  const prim = toPrimitive(item);
  const deckPieces = Math.max(3, Math.ceil(span / prim.length));
  const instances: YardInstance[] = [];
  for (let i = 0; i < deckPieces; i++) {
    const x = i * prim.length * 0.9 + prim.length / 2;
    instances.push(piece(`deck-${i}`, catalogId, x, prim.height / 2, 0, 0, 0, 0, undefined, "rail"));
  }
  const pierH = Math.max(prim.length, 8);
  for (const side of [0, deckPieces - 1]) {
    const x = side * prim.length * 0.9 + prim.length / 2;
    instances.push(piece(`pier-l-${side}`, catalogId, x, pierH / 2, -prim.width * 2, 0, 0, 0, undefined, "leg"));
    instances.push(piece(`pier-r-${side}`, catalogId, x, pierH / 2, prim.width * 2, 0, 0, 0, undefined, "leg"));
  }
  return { instances, notes: [`Bridge · span ~${(deckPieces * prim.length).toFixed(0)}" · ${item.name}`] };
}

function buildHouse(item: CatalogItem, catalogId: string, w: number, h: number) {
  const prim = toPrimitive(item);
  const instances: YardInstance[] = [];
  const wallH = Math.max(prim.length, h * 0.6);
  const hw = w / 2;
  const corners: [number, number][] = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
  corners.forEach(([x, z], i) => {
    instances.push(piece(`post-${i}`, catalogId, x, wallH / 2, z, 0, 0, 0, undefined, "leg"));
  });
  const ridgeY = wallH + prim.length / 2;
  instances.push(piece("ridge", catalogId, 0, ridgeY, 0, 0, 0, 0, undefined, "rail"));
  instances.push(piece("roof-a", catalogId, -hw / 2, ridgeY - 1, 0, 0, 0, 0.4, undefined, "brace"));
  instances.push(piece("roof-b", catalogId, hw / 2, ridgeY - 1, 0, 0, 0, -0.4, undefined, "brace"));
  return { instances, notes: [`House frame · ~${w.toFixed(0)}" footprint · ${item.name}`] };
}

function buildDome(item: CatalogItem, catalogId: string, radius: number) {
  const prim = toPrimitive(item);
  const instances: YardInstance[] = [];
  const rings = Math.max(3, Math.ceil(radius / prim.length) + 1);
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1 || 1);
    const y = Math.sin(t * Math.PI * 0.5) * radius;
    const r = Math.cos(t * Math.PI * 0.5) * radius;
    const n = Math.max(4, Math.round((r * 2 * Math.PI) / Math.max(prim.length * 0.8, 2)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      instances.push(
        piece(`d-${ring}-${i}`, catalogId, Math.cos(a) * r, y + prim.length / 2, Math.sin(a) * r, 0, 0, 0, undefined, "ring"),
      );
    }
  }
  return { instances, notes: [`Dome · radius ~${radius.toFixed(0)}" · ${item.name}`] };
}

function buildArch(item: CatalogItem, catalogId: string, span: number, height: number) {
  const instances: YardInstance[] = [];
  instances.push(piece("leg-l", catalogId, -span / 2, height / 2, 0, 0, 0, 0, undefined, "leg"));
  instances.push(piece("leg-r", catalogId, span / 2, height / 2, 0, 0, 0, 0, undefined, "leg"));
  const segs = 7;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = Math.PI * t;
    const x = -span / 2 + t * span;
    const y = height + Math.sin(a) * (height * 0.35);
    instances.push(piece(`arch-${i}`, catalogId, x, y, 0, 0, 0, 0, undefined, "brace"));
  }
  return { instances, notes: [`Arch · span ${span.toFixed(0)}" · ${item.name}`] };
}

function buildLadder(item: CatalogItem, catalogId: string, height: number) {
  const prim = toPrimitive(item);
  const instances: YardInstance[] = [];
  const spacing = Math.max(prim.width * 3, 3);
  const rungs = Math.max(3, Math.ceil(height / (prim.length * 0.5)));
  for (let r = 0; r < 2; r++) {
    const z = (r - 0.5) * spacing;
    const n = Math.ceil(height / prim.length);
    for (let i = 0; i < n; i++) {
      instances.push(piece(`rail-${r}-${i}`, catalogId, 0, i * prim.length + prim.length / 2, z, 0, 0, 0, undefined, "leg"));
    }
  }
  for (let i = 0; i < rungs; i++) {
    const y = ((i + 1) / (rungs + 1)) * height;
    instances.push(piece(`rung-${i}`, catalogId, 0, y, 0, Math.PI / 2, 0, 0, undefined, "rail"));
  }
  return { instances, notes: [`Ladder · ~${height.toFixed(0)}" · ${item.name}`] };
}

function buildFrame(item: CatalogItem, catalogId: string, w: number, h: number, d: number) {
  const instances: YardInstance[] = [];
  const corners: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  corners.forEach(([x, z], i) => {
    instances.push(piece(`leg-${i}`, catalogId, x, h / 2, z, 0, 0, 0, undefined, "leg"));
  });
  instances.push(piece("top-a", catalogId, 0, h, -d / 2, 0, 0, 0, undefined, "rail"));
  instances.push(piece("top-b", catalogId, 0, h, d / 2, 0, 0, 0, undefined, "rail"));
  return { instances, notes: [`Frame · ${w.toFixed(0)}"×${h.toFixed(0)}"×${d.toFixed(0)}" · ${item.name}`] };
}

function buildCastle(item: CatalogItem, catalogId: string, targetH: number, baseW: number) {
  const prim = toPrimitive(item);
  const layerH = prim.length;
  const instances: YardInstance[] = [];
  const wallH = targetH * 0.7;
  const layers = Math.max(2, Math.ceil(wallH / layerH));
  const half = baseW / 2;
  for (let i = 0; i < layers; i++) {
    const y = i * layerH + layerH / 2;
    for (let p = 0; p < 12; p++) {
      const a = (p / 12) * Math.PI * 2;
      instances.push(piece(`wall-${i}-${p}`, catalogId, Math.cos(a) * half, y, Math.sin(a) * half, 0, 0, 0, undefined, "ring"));
    }
  }
  const towerExtra = Math.max(1, Math.ceil((targetH - wallH) / layerH));
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
    for (let i = 0; i < layers + towerExtra; i++) {
      const y = i * layerH + layerH / 2;
      instances.push(
        piece(`turret-${c}-${i}`, catalogId, Math.cos(a) * half * 1.1, y, Math.sin(a) * half * 1.1, 0, 0, 0, undefined, "leg"),
      );
    }
  }
  return {
    instances,
    notes: [`Castle · walls + 4 turrets · ~${(layers + towerExtra) * layerH}" · ${item.name}`],
  };
}

function toProject(
  prompt: string,
  item: CatalogItem,
  kind: StructureKind,
  instances: YardInstance[],
  notes: string[],
  historic = false,
  extra: Pick<YardProject, "supportOffer" | "buildStats"> = {},
): YardProject {
  let list = instances;
  if (list.length > 8000) {
    list = list.slice(0, 8000);
    notes = [
      ...notes,
      `Stopped at 8,000 pieces — the bench will hitch past that. This is a renderer limit, not a materials cap. Use longer stock or a shorter span.`,
    ];
  } else if (list.length > 1500) {
    notes = [...notes, `${list.length} pieces. Orbit may hitch on a phone — that is expected, not a cap.`];
  }
  const xs = list.map((i) => i.position.x);
  const ys = list.map((i) => i.position.y);
  const zs = list.map((i) => i.position.z);
  const pad = Math.max(4, (toPrimitive(item).width || 2) * 2);
  return {
    id: createId("proj"),
    name: kind === "eiffel" ? "Eiffel frame" : `${item.name} ${kind}`,
    prompt,
    kind,
    overall: {
      width: Math.max(12, (Math.max(...xs, 0) - Math.min(...xs, 0) || 0) + pad * 2),
      height: Math.max(12, (Math.max(...ys, 0) - Math.min(...ys, 0) || 0) + pad),
      depth: Math.max(12, (Math.max(...zs, 0) - Math.min(...zs, 0) || 0) + pad * 2),
    },
    instances: withHome(list),
    panels: [],
    primaryMaterialId: item.id,
    notes,
    historic,
    supportOffer: extra.supportOffer,
    buildStats: extra.buildStats,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

export function emptyProject(): YardProject {
  return {
    id: createId("proj"),
    name: "Untitled",
    prompt: "",
    kind: "tower",
    overall: { width: 36, height: 36, depth: 36 },
    instances: [],
    panels: [],
    primaryMaterialId: "popsicle-standard",
    notes: [],
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

export function generateFromPrompt(
  prompt: string,
  materialOverride?: string,
  formOverride?: FormRecipe,
  opts: { includeSpine?: boolean } = {},
): YardProject {
  const lower = prompt.toLowerCase().trim();
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);

  if (kindHint === "opening") {
    const unit = pickWindow(prompt, size.width, size.height);
    return buildWindowProject(unit, prompt);
  }
  if (kindHint === "closet" || looksLikeFitted(prompt)) {
    const brief = parseBrief(prompt);
    if (brief) return buildFitted(brief, prompt);
    const pocket = parsePocket(prompt);
    if (pocket) return buildPocket(pocket, prompt);
    return buildClosetFromPrompt(prompt, size);
  }

  const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
  const recipe = formOverride ?? detectForm(prompt, size);
  const kind = recipe.kind;

  if ((kind === "eiffel" || kind === "lattice") && !(formOverride?.strokes && formOverride.strokes.length >= 4)) {
    const raw = buildLatticeTowerGraph({
      targetHeightIn: size.height,
      materialId: item.id,
      item,
      eiffel: kind === "eiffel" || /eiffel/.test(lower),
      platforms: true,
    });
    const finished = finishGraph(raw, item, kind, !!opts.includeSpine);
    return projectFromGraph(prompt, item, kind, finished.graph, true, finished.offer);
  }

  const built = buildFormGraph(recipe, item, item.id, { includeSpine: opts.includeSpine, kind });
  return projectFromGraph(prompt, item, kind, built.graph, !!recipe.historic, built.offer);
}

function projectFromGraph(
  prompt: string,
  item: CatalogItem,
  kind: StructureKind,
  graph: import("./structureGraph").StructureGraph,
  historic: boolean,
  offer?: YardProject["supportOffer"],
): YardProject {
  const mapped = graphToInstances(graph, item);
  const instances: YardInstance[] = mapped.instances.map((g) => ({
    id: g.id,
    catalogId: g.catalogId,
    position: { x: g.position[0], y: g.position[1], z: g.position[2] },
    rotation: { x: g.rotation[0], y: g.rotation[1], z: g.rotation[2] },
    cutLength: g.cutLength,
    role: g.role,
    join: g.join,
    from: g.from ? { x: g.from[0], y: g.from[1], z: g.from[2] } : undefined,
    to: g.to ? { x: g.to[0], y: g.to[1], z: g.to[2] } : undefined,
  }));
  const stats = analyzePieces(instances, item);
  const notes = [
    ...graph.notes,
    ...graph.assumptions,
    mapped.spliceCount > 0
      ? `${mapped.spliceCount} lap splice(s) where members exceed stock — overlap the joint, then glue`
      : "No splices — each member fits in one stock piece",
    `Joins: ${mapped.joinSummary.join(", ") || "glue"}`,
    stats.components <= 1 && stats.loose === 0
      ? `Connected structure · ${stats.joints} joints · every piece meets another`
      : `Mostly connected · ${stats.joints} joints · ${stats.loose} loose · ${stats.components} cluster${stats.components === 1 ? "" : "s"}`,
    "Frame first, then support, then brace. The frame will fail without bracing.",
  ];
  if (offer?.needed && !offer.included) notes.push(offer.reason);
  if (offer?.included) notes.push("Internal spine included at your request.");
  return toProject(prompt, item, kind, instances, notes, historic, {
    supportOffer: offer,
    buildStats: stats,
  });
}

