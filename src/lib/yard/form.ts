import type { StructureKind, Vec3 } from "./types";
import { classifyAnatomy } from "./anatomy";
import { figureStrokes } from "./figure";

export type FormOp =
  | { op: "taper"; y0: number; y1: number; r0: number; r1: number; sides?: number; role?: string }
  | { op: "column"; x: number; z: number; y0: number; y1: number; role?: string }
  | { op: "ring"; y: number; rx: number; rz?: number; n?: number; role?: string }
  | { op: "box"; x: number; y: number; z: number; w: number; h: number; d: number; role?: string }
  | { op: "arch"; x0: number; z0: number; x1: number; z1: number; y0?: number; crown: number; role?: string }
  | { op: "dome"; x?: number; z?: number; y0: number; r: number; role?: string }
  | { op: "grid"; y: number; w: number; d: number; nx?: number; nz?: number; x?: number; z?: number; role?: string }
  | { op: "poly"; points: Vec3[]; role?: string }
  | { op: "legs"; count: number; radius: number; y0: number; y1: number; role?: string }
  | {
      op: "shell";
      y0: number;
      y1: number;
      r: number;
      x?: number;
      z?: number;
      profile?: "hemisphere" | "onion" | "drum";
      role?: string;
    };

export type FormStroke = {
  points: Vec3[];
  role?: string;
};

export type FormRecipe = {
  name: string;
  kind: StructureKind;
  historic?: boolean;
  notes: string[];
  ops: FormOp[];
  strokes?: FormStroke[];
  source?: string;
};

export type Size3 = { height: number; width: number; depth: number };

type Hit = { re: RegExp; kind: StructureKind; name: string; historic?: boolean; build: (s: Size3) => FormOp[] };

const HITS: Hit[] = [
  { re: /eiffel/, kind: "eiffel", name: "Eiffel", historic: true, build: () => [] },
  { re: /taj|mahal/, kind: "taj", name: "Taj Mahal", historic: true, build: tajOps },
  { re: /pyramid|giza|khufu/, kind: "pyramid", name: "Pyramid", historic: true, build: pyramidOps },
  { re: /colosseum|coliseum|amphitheatre|amphitheater/, kind: "custom", name: "Colosseum", historic: true, build: colosseumOps },
  { re: /statue of liberty|liberty statue|\bliberty\b/, kind: "figure", name: "Liberty", historic: true, build: libertyOps },
  { re: /empire state/, kind: "tower", name: "Empire State", historic: true, build: empireStateOps },
  { re: /chrysler building/, kind: "tower", name: "Chrysler", historic: true, build: empireStateOps },
  { re: /space needle/, kind: "tower", name: "Space Needle", historic: true, build: spaceNeedleOps },
  { re: /cn tower/, kind: "tower", name: "CN Tower", historic: true, build: spaceNeedleOps },
  { re: /leaning tower|pisa/, kind: "tower", name: "Pisa", historic: true, build: pisaOps },
  { re: /golden gate/, kind: "bridge", name: "Golden Gate", historic: true, build: goldenGateOps },
  { re: /brooklyn bridge/, kind: "bridge", name: "Brooklyn Bridge", historic: true, build: goldenGateOps },
  { re: /arc de triomphe|triumphal arch/, kind: "arch", name: "Arc de Triomphe", historic: true, build: arcOps },
  { re: /parthenon|pantheon of athens/, kind: "custom", name: "Parthenon", historic: true, build: parthenonOps },
  { re: /stonehenge/, kind: "custom", name: "Stonehenge", historic: true, build: stonehengeOps },
  { re: /sydney opera/, kind: "dome", name: "Sydney Opera", historic: true, build: sydneyOps },
  { re: /big ben|clock tower|westminster/, kind: "tower", name: "Clock tower", historic: true, build: clockOps },
  { re: /washington monument|obelisk/, kind: "tower", name: "Obelisk", historic: true, build: obeliskOps },
  { re: /lighthouse/, kind: "tower", name: "Lighthouse", build: lighthouseOps },
  { re: /windmill/, kind: "tower", name: "Windmill", build: windmillOps },
  { re: /pagoda/, kind: "tower", name: "Pagoda", build: pagodaOps },
  { re: /mosque|minaret/, kind: "taj", name: "Mosque", build: tajOps },
  { re: /castle|fort|keep|battlement|turret/, kind: "castle", name: "Castle", build: castleOps },
  { re: /bridge|span/, kind: "bridge", name: "Bridge", build: bridgeOps },
  { re: /cabin|shed|hut|cottage|barn|(?<!opera )house/, kind: "house", name: "House", build: houseOps },
  { re: /birdhouse/, kind: "house", name: "Birdhouse", build: houseOps },
  { re: /wall|fence|palisade|barrier/, kind: "wall", name: "Wall", build: wallOps },
  { re: /dome|igloo|sphere|globe/, kind: "dome", name: "Dome", build: domeOps },
  { re: /arch|gateway|portal/, kind: "arch", name: "Arch", build: archOps },
  { re: /ladder|stairs|staircase/, kind: "ladder", name: "Ladder", build: ladderOps },
  { re: /chair|stool|throne/, kind: "furniture", name: "Chair", build: chairOps },
  { re: /table|desk|workbench/, kind: "furniture", name: "Table", build: tableOps },
  { re: /bed|bunk/, kind: "furniture", name: "Bed", build: bedOps },
  { re: /bench|sawhorse/, kind: "furniture", name: "Bench", build: benchOps },
  { re: /rocket|spaceship|missile/, kind: "vehicle", name: "Rocket", build: rocketOps },
  { re: /plane|airplane|aircraft|jet/, kind: "vehicle", name: "Airplane", build: planeOps },
  { re: /car|truck|wagon|cart|vehicle/, kind: "vehicle", name: "Wagon", build: wagonOps },
  { re: /bike|bicycle/, kind: "vehicle", name: "Bicycle", build: bikeOps },
  { re: /boat|ship|canoe|sailboat|yacht/, kind: "vessel", name: "Boat", build: boatOps },
  { re: /ferris/, kind: "custom", name: "Ferris wheel", build: ferrisOps },
  { re: /tree|cactus|plant/, kind: "plant", name: "Tree", build: treeOps },
  { re: /dinosaur|t-?rex|raptor|dino/, kind: "figure", name: "Dinosaur", build: dinoOps },
  { re: /charizard|dragon|wyvern|godzilla|kaiju/, kind: "figure", name: "Wyvern", build: () => [] },
  { re: /robot|android/, kind: "figure", name: "Robot", build: robotOps },
  { re: /giraffe/, kind: "figure", name: "Giraffe", build: giraffeOps },
  { re: /horse|dog|cat|animal|creature/, kind: "figure", name: "Animal", build: animalOps },
  { re: /person|human|man|woman|figure|statue/, kind: "figure", name: "Figure", build: figureOps },
  { re: /guitar|violin|ukulele/, kind: "custom", name: "Guitar", build: guitarOps },
  { re: /swing/, kind: "frame", name: "Swing", build: swingOps },
  { re: /lattice/, kind: "lattice", name: "Lattice", build: () => [] },
  { re: /tower|spire|column|stack|skyscraper/, kind: "tower", name: "Tower", build: towerOps },
  { re: /frame|box|cube|platform/, kind: "frame", name: "Frame", build: frameOps },
];

export function detectForm(prompt: string, size: Size3): FormRecipe {
  const lower = prompt.toLowerCase();
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? `${looks[1]} ${lower}` : lower;
  for (const hit of HITS) {
    if (hit.re.test(hay)) {
      const ops = hit.build(size);
      const stance =
        hit.kind === "figure"
          ? classifyAnatomy(hay).stance
          : undefined;
      const strokes =
        hit.kind === "figure" || hit.name === "Giraffe" || hit.name === "Liberty"
          ? figureStrokes({
              height: size.height,
              stance: stance ?? (hit.name === "Giraffe" ? "longneck" : hit.name === "Liberty" ? "liberty" : "biped"),
              width: size.width,
            })
          : undefined;
      return {
        name: hit.name,
        kind: hit.kind,
        historic: hit.historic,
        notes: [
          `${hit.name} · stock mapped onto the form, not a hull.`,
          hit.historic
            ? "Published / historic proportions, scaled to the size you asked for."
            : "Parametric form. Frame first, then brace. Support if it is slender.",
        ],
        ops: strokes && strokes.length >= 3 ? ops.filter((o) => o.op === "taper" || o.op === "shell" || o.op === "arch") : ops,
        strokes,
      };
    }
  }
  return recipeFromAnatomy(prompt, size);
}

export function recipeFromAnatomy(prompt: string, size: Size3): FormRecipe {
  const hit = classifyAnatomy(prompt);
  if (hit.anatomy === "figure") {
    const strokes = figureStrokes({
      height: size.height,
      stance: hit.stance ?? "quadruped",
      width: size.width,
    });
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: [
        `${hit.named || subjectTitle(prompt)} · ${hit.stance ?? "figure"} armature.`,
        "Any named creature uses this stance if we have no published wire. Grok can replace the wire when the key is set.",
      ],
      ops: [],
      strokes,
    };
  }
  if (hit.anatomy === "shell") {
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      historic: !!hit.named,
      notes: [`${hit.named || "Dome"} · continuous shell, meridians + belts.`],
      ops: hit.kind === "taj" ? tajOps(size) : shellOps(size),
    };
  }
  if (hit.anatomy === "loft") {
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: [`${hit.named || "Tower"} · continuous loft.`],
      ops: [taper(0, size.height, size.width * 0.35, size.width * 0.12, 4, "leg")],
    };
  }
  if (hit.anatomy === "span") {
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: ["Span · deck + posts, one frame."],
      ops: hit.kind === "arch" ? archOps(size) : hit.kind === "wall" ? wallOps(size) : bridgeOps(size),
    };
  }
  return {
    name: hit.named || subjectTitle(prompt),
    kind: hit.kind,
    notes: [
      "No published wire for this name — built from its anatomy class.",
      "Grok can refine the parts; the stock and joins stay deterministic.",
    ],
    ops: guessOps(prompt.toLowerCase(), size),
  };
}

function subjectTitle(prompt: string): string {
  const s = subjectFromPrompt(prompt);
  if (!s) return "Custom form";
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 48);
}

function shellOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.depth) / 2;
  return [{ op: "shell", y0: 0, y1: s.height, r, profile: "hemisphere", role: "ring" }];
}

export function recipeFromOps(
  name: string,
  kind: StructureKind,
  ops: FormOp[],
  notes: string[] = [],
  historic?: boolean,
): FormRecipe {
  return { name, kind, historic, notes, ops };
}

function taper(y0: number, y1: number, r0: number, r1: number, sides = 8, role = "leg"): FormOp {
  return { op: "taper", y0, y1, r0, r1, sides, role };
}

function tajOps(s: Size3): FormOp[] {
  const H = s.height;
  const plat = H * 0.62;
  const body = plat * 0.38;
  return [
    { op: "grid", y: 0.5, w: plat * 2, d: plat * 2, nx: 4, nz: 4, role: "base" },
    { op: "shell", y0: H * 0.18, y1: H * 0.52, r: body, profile: "drum", role: "leg" },
    { op: "shell", y0: H * 0.5, y1: H, r: body * 0.92, profile: "onion", role: "ring" },
    { op: "column", x: plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "shell", x: plat * 0.82, z: plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: -plat * 0.82, z: plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: plat * 0.82, z: -plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "shell", x: -plat * 0.82, z: -plat * 0.82, y0: H * 0.56, y1: H * 0.68, r: H * 0.045, profile: "onion", role: "tip" },
    { op: "arch", x0: -body, z0: -body, x1: body, z1: -body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: -body, z0: body, x1: body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: -body, z0: -body, x1: -body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
    { op: "arch", x0: body, z0: -body, x1: body, z1: body, y0: H * 0.18, crown: H * 0.16, role: "support" },
  ];
}

function pyramidOps(s: Size3): FormOp[] {
  const H = s.height;
  const half = (s.width > H * 0.7 ? s.width : H * (230.3 / 146.6)) / 2;
  return [taper(0, H, half, Math.max(half * 0.04, 0.4), 4, "leg")];
}

function colosseumOps(s: Size3): FormOp[] {
  const H = s.height;
  const rx = s.width / 2;
  const rz = s.depth / 2;
  const ops: FormOp[] = [];
  for (let i = 0; i <= 3; i++) {
    ops.push({ op: "ring", y: (i / 3) * H, rx, rz, n: 16, role: i === 0 ? "base" : "ring" });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const a2 = ((i + 1) / 12) * Math.PI * 2;
    ops.push({
      op: "arch",
      x0: Math.cos(a) * rx,
      z0: Math.sin(a) * rz,
      x1: Math.cos(a2) * rx,
      z1: Math.sin(a2) * rz,
      y0: 0,
      crown: H * 0.28,
      role: "support",
    });
  }
  return ops;
}

function libertyOps(s: Size3): FormOp[] {
  const H = s.height;
  return [taper(0, H * 0.48, H * 0.2, H * 0.14, 4, "leg")];
}

function clockOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.78, H * 0.18, H * 0.14, 4, "leg"),
    { op: "box", x: 0, y: H * 0.82, z: 0, w: H * 0.22, h: H * 0.16, d: H * 0.22, role: "ring" },
    { op: "column", x: 0, z: 0, y0: H * 0.9, y1: H, role: "tip" },
  ];
}

function obeliskOps(s: Size3): FormOp[] {
  return [taper(0, s.height * 0.92, s.height * 0.08, s.height * 0.035, 4, "leg"), { op: "column", x: 0, z: 0, y0: s.height * 0.9, y1: s.height, role: "tip" }];
}

function empireStateOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.38, H * 0.22, H * 0.16, 4, "leg"),
    taper(H * 0.36, H * 0.72, H * 0.16, H * 0.1, 4, "leg"),
    taper(H * 0.7, H * 0.9, H * 0.1, H * 0.045, 4, "leg"),
    { op: "column", x: 0, z: 0, y0: H * 0.88, y1: H, role: "tip" },
    { op: "ring", y: H * 0.38, rx: H * 0.18, n: 8, role: "rail" },
    { op: "ring", y: H * 0.72, rx: H * 0.12, n: 8, role: "rail" },
  ];
}

function spaceNeedleOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.72, H * 0.14, H * 0.035, 8, "leg"),
    { op: "ring", y: H * 0.78, rx: H * 0.16, n: 12, role: "rail" },
    { op: "shell", y0: H * 0.72, y1: H * 0.86, r: H * 0.14, profile: "drum", role: "ring" },
    { op: "column", x: 0, z: 0, y0: H * 0.84, y1: H, role: "tip" },
  ];
}

function pisaOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.92, H * 0.14, H * 0.12, 8, "leg")];
  for (let i = 0; i < 7; i++) {
    ops.push({ op: "ring", y: (i / 6) * H * 0.88, rx: H * 0.15, n: 10, role: i === 0 ? "base" : "ring" });
  }
  ops.push({ op: "column", x: 0, z: 0, y0: H * 0.9, y1: H, role: "tip" });
  return ops;
}

function goldenGateOps(s: Size3): FormOp[] {
  const span = Math.max(s.width, s.height * 1.6);
  const h = s.height;
  const t0 = span * 0.22;
  const t1 = span * 0.78;
  return [
    { op: "column", x: t0, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "column", x: t1, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "ring", y: h * 0.72, rx: h * 0.04, n: 4, role: "rail" },
    { op: "grid", y: h * 0.42, w: span, d: Math.max(6, s.depth * 0.35), nx: 10, nz: 2, x: span / 2, role: "rail" },
    {
      op: "poly",
      role: "support",
      points: [
        { x: 0, y: h * 0.42, z: 0 },
        { x: t0 * 0.5, y: h * 0.7, z: 0 },
        { x: t0, y: h, z: 0 },
        { x: (t0 + t1) / 2, y: h * 0.62, z: 0 },
        { x: t1, y: h, z: 0 },
        { x: t1 + (span - t1) * 0.5, y: h * 0.7, z: 0 },
        { x: span, y: h * 0.42, z: 0 },
      ],
    },
  ];
}

function arcOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width;
  return [
    { op: "box", x: 0, y: H * 0.55, z: 0, w, h: H * 0.9, d: Math.max(s.depth, w * 0.35), role: "leg" },
    { op: "arch", x0: -w * 0.28, z0: 0, x1: w * 0.28, z1: 0, y0: 0, crown: H * 0.42, role: "support" },
    { op: "ring", y: H, rx: w * 0.48, rz: s.depth * 0.4, n: 8, role: "rail" },
  ];
}

function parthenonOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width;
  const d = s.depth;
  const ops: FormOp[] = [{ op: "grid", y: H * 0.12, w, d, nx: 6, nz: 3, role: "base" }];
  const cols = 6;
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + (i / (cols - 1)) * w;
    ops.push({ op: "column", x, z: -d / 2, y0: H * 0.12, y1: H * 0.78, role: "leg" });
    ops.push({ op: "column", x, z: d / 2, y0: H * 0.12, y1: H * 0.78, role: "leg" });
  }
  ops.push({ op: "grid", y: H * 0.8, w: w * 1.05, d: d * 1.05, nx: 5, nz: 3, role: "rail" });
  ops.push({
    op: "poly",
    role: "tip",
    points: [
      { x: -w / 2, y: H * 0.82, z: 0 },
      { x: 0, y: H, z: 0 },
      { x: w / 2, y: H * 0.82, z: 0 },
    ],
  });
  return ops;
}

function stonehengeOps(s: Size3): FormOp[] {
  const H = s.height;
  const r = Math.max(s.width, s.depth) / 2;
  const ops: FormOp[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ops.push({
      op: "column",
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y0: 0,
      y1: H * 0.78,
      role: "leg",
    });
  }
  ops.push({ op: "ring", y: H * 0.82, rx: r, n, role: "rail" });
  return ops;
}

function sydneyOps(s: Size3): FormOp[] {
  const H = s.height;
  const r = Math.max(s.width, s.depth) / 2;
  return [
    { op: "grid", y: H * 0.08, w: r * 2.2, d: r * 1.4, nx: 5, nz: 3, role: "base" },
    { op: "shell", x: -r * 0.35, z: 0, y0: H * 0.08, y1: H * 0.78, r: r * 0.55, profile: "hemisphere", role: "ring" },
    { op: "shell", x: r * 0.25, z: 0, y0: H * 0.08, y1: H, r: r * 0.48, profile: "hemisphere", role: "ring" },
    { op: "shell", x: r * 0.7, z: r * 0.15, y0: H * 0.08, y1: H * 0.62, r: r * 0.32, profile: "hemisphere", role: "ring" },
  ];
}

function lighthouseOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    taper(0, H * 0.82, H * 0.16, H * 0.08, 8, "leg"),
    { op: "ring", y: H * 0.86, rx: H * 0.12, n: 8, role: "rail" },
    { op: "column", x: 0, z: 0, y0: H * 0.82, y1: H, role: "tip" },
  ];
}

function windmillOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.72, H * 0.16, H * 0.1, 8, "leg")];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: H * 0.72, z: 0 },
        { x: Math.cos(a) * H * 0.35, y: H * 0.72 + Math.sin(a) * H * 0.35, z: H * 0.12 },
      ],
    });
  }
  return ops;
}

function pagodaOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const r = H * 0.22 * (1 - t0 * 0.35);
    ops.push(taper(t0 * H, t1 * H * 0.92, r, r * 0.85, 8, "leg"));
    ops.push({ op: "ring", y: t1 * H * 0.92, rx: r * 1.25, n: 8, role: "rail" });
  }
  return ops;
}

function castleOps(s: Size3): FormOp[] {
  const H = s.height;
  const w = s.width / 2;
  const ops: FormOp[] = [{ op: "box", x: 0, y: H * 0.35, z: 0, w: w * 2, h: H * 0.7, d: w * 2, role: "ring" }];
  for (const [x, z] of [
    [w, w],
    [-w, w],
    [w, -w],
    [-w, -w],
  ] as const) {
    ops.push({ op: "column", x, z, y0: 0, y1: H, role: "leg" });
    ops.push({ op: "ring", y: H, rx: H * 0.06, n: 6, role: "tip" });
  }
  return ops;
}

function bridgeOps(s: Size3): FormOp[] {
  const span = s.width;
  const h = Math.max(s.height * 0.35, 8);
  return [
    { op: "column", x: 0, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "column", x: span, z: 0, y0: 0, y1: h, role: "leg" },
    { op: "grid", y: h, w: span, d: Math.max(6, s.depth * 0.4), nx: 6, nz: 2, x: span / 2, role: "rail" },
    { op: "arch", x0: 0, z0: 0, x1: span, z1: 0, crown: h * 0.85, role: "support" },
  ];
}

function houseOps(s: Size3): FormOp[] {
  const w = s.width;
  const h = s.height * 0.62;
  const d = s.depth;
  return [
    { op: "box", x: 0, y: h / 2, z: 0, w, h, d, role: "leg" },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: -w / 2, y: h, z: 0 },
        { x: 0, y: s.height, z: 0 },
        { x: w / 2, y: h, z: 0 },
      ],
    },
    { op: "arch", x0: -w * 0.12, z0: d / 2, x1: w * 0.12, z1: d / 2, y0: 0, crown: h * 0.45, role: "support" },
  ];
}

function wallOps(s: Size3): FormOp[] {
  const ops: FormOp[] = [];
  const posts = Math.max(3, Math.round(s.width / 8));
  for (let i = 0; i < posts; i++) {
    const x = (i / (posts - 1 || 1)) * s.width;
    ops.push({ op: "column", x, z: 0, y0: 0, y1: s.height, role: "leg" });
  }
  ops.push({
    op: "poly",
    role: "rail",
    points: [
      { x: 0, y: s.height * 0.7, z: 0 },
      { x: s.width, y: s.height * 0.7, z: 0 },
    ],
  });
  return ops;
}

function domeOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.height) / 2;
  return [{ op: "dome", y0: 0, r, role: "ring" }, { op: "ring", y: 0, rx: r, n: 12, role: "base" }];
}

function archOps(s: Size3): FormOp[] {
  return [
    { op: "column", x: -s.width / 2, z: 0, y0: 0, y1: s.height, role: "leg" },
    { op: "column", x: s.width / 2, z: 0, y0: 0, y1: s.height, role: "leg" },
    { op: "arch", x0: -s.width / 2, z0: 0, x1: s.width / 2, z1: 0, y0: s.height * 0.55, crown: s.height * 0.45, role: "support" },
  ];
}

function ladderOps(s: Size3): FormOp[] {
  const z = Math.max(4, s.depth * 0.2);
  return [
    { op: "column", x: 0, z: -z / 2, y0: 0, y1: s.height, role: "leg" },
    { op: "column", x: 0, z: z / 2, y0: 0, y1: s.height, role: "leg" },
    { op: "grid", y: s.height * 0.5, w: 0.4, d: z, nx: 1, nz: Math.max(3, Math.round(s.height / 5)), x: 0, z: 0, role: "rail" },
  ];
}

function frameOps(s: Size3): FormOp[] {
  return [{ op: "box", x: 0, y: s.height / 2, z: 0, w: s.width, h: s.height, d: s.depth, role: "leg" }];
}

function towerOps(s: Size3): FormOp[] {
  return [taper(0, s.height, s.width * 0.45, s.width * 0.18, 6, "leg")];
}

function chairOps(s: Size3): FormOp[] {
  const h = s.height;
  const w = Math.min(s.width, h * 0.7);
  return [
    { op: "legs", count: 4, radius: w * 0.38, y0: 0, y1: h * 0.45, role: "leg" },
    { op: "grid", y: h * 0.45, w, d: w * 0.85, nx: 3, nz: 3, role: "rail" },
    { op: "box", x: 0, y: h * 0.72, z: -w * 0.4, w, h: h * 0.5, d: w * 0.08, role: "brace" },
  ];
}

function tableOps(s: Size3): FormOp[] {
  return [
    { op: "legs", count: 4, radius: Math.min(s.width, s.depth) * 0.42, y0: 0, y1: s.height, role: "leg" },
    { op: "grid", y: s.height, w: s.width, d: s.depth, nx: 4, nz: 3, role: "rail" },
  ];
}

function bedOps(s: Size3): FormOp[] {
  return [
    { op: "box", x: 0, y: s.height * 0.35, z: 0, w: s.width, h: s.height * 0.7, d: s.depth, role: "rail" },
    { op: "legs", count: 4, radius: Math.min(s.width, s.depth) * 0.45, y0: 0, y1: s.height * 0.35, role: "leg" },
  ];
}

function benchOps(s: Size3): FormOp[] {
  return [
    { op: "legs", count: 4, radius: s.width * 0.4, y0: 0, y1: s.height, role: "leg" },
    { op: "grid", y: s.height, w: s.width, d: Math.max(6, s.depth), nx: 5, nz: 2, role: "rail" },
  ];
}

function rocketOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.78, H * 0.12, H * 0.07, 8, "leg"), { op: "dome", y0: H * 0.78, r: H * 0.08, role: "tip" }];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: Math.cos(a) * H * 0.05, y: 0, z: Math.sin(a) * H * 0.05 },
        { x: Math.cos(a) * H * 0.22, y: 0, z: Math.sin(a) * H * 0.22 },
        { x: Math.cos(a) * H * 0.06, y: H * 0.22, z: Math.sin(a) * H * 0.06 },
      ],
    });
  }
  return ops;
}

function planeOps(s: Size3): FormOp[] {
  const L = Math.max(s.width, s.height);
  return [
    taper(0, L * 0.15, L * 0.04, L * 0.06, 6, "leg"),
    { op: "column", x: 0, z: 0, y0: 0, y1: L * 0.08, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -L * 0.45, y: L * 0.08, z: 0 },
        { x: L * 0.45, y: L * 0.08, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: L * 0.08, z: -L * 0.12 },
        { x: 0, y: L * 0.08, z: L * 0.12 },
      ],
    },
  ];
}

function wagonOps(s: Size3): FormOp[] {
  const w = s.width;
  const d = s.depth;
  return [
    { op: "box", x: 0, y: s.height * 0.45, z: 0, w, h: s.height * 0.4, d, role: "rail" },
    { op: "ring", y: s.height * 0.18, rx: s.height * 0.16, n: 8, role: "brace" },
    { op: "column", x: w * 0.35, z: d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: -w * 0.35, z: d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: w * 0.35, z: -d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
    { op: "column", x: -w * 0.35, z: -d * 0.4, y0: 0, y1: s.height * 0.25, role: "leg" },
  ];
}

function bikeOps(s: Size3): FormOp[] {
  const L = s.width;
  return [
    { op: "ring", y: L * 0.22, rx: L * 0.22, n: 10, role: "brace" },
    { op: "box", x: L * 0.55, y: L * 0.22, z: 0, w: 0.2, h: 0.2, d: 0.2, role: "ring" },
    {
      op: "poly",
      role: "leg",
      points: [
        { x: 0, y: L * 0.22, z: 0 },
        { x: L * 0.35, y: L * 0.42, z: 0 },
        { x: L * 0.55, y: L * 0.22, z: 0 },
      ],
    },
  ];
}

function boatOps(s: Size3): FormOp[] {
  const L = s.width;
  const ops: FormOp[] = [
    {
      op: "poly",
      role: "leg",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: L, y: 0, z: 0 },
      ],
    },
    { op: "column", x: L * 0.4, z: 0, y0: 0, y1: s.height, role: "support" },
  ];
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ops.push({ op: "ring", y: s.height * 0.12, rx: s.depth * (0.2 + Math.sin(t * Math.PI) * 0.3), n: 8, role: "brace" });
  }
  return ops;
}

function ferrisOps(s: Size3): FormOp[] {
  const r = Math.max(s.height, s.width) / 2;
  const ops: FormOp[] = [
    { op: "ring", y: r, rx: r, n: 16, role: "ring" },
    { op: "column", x: -r * 0.15, z: 0, y0: 0, y1: r, role: "support" },
    { op: "column", x: r * 0.15, z: 0, y0: 0, y1: r, role: "support" },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: r, z: 0 },
        { x: Math.cos(a) * r, y: r + Math.sin(a) * r, z: 0 },
      ],
    });
  }
  return ops;
}

function treeOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [{ op: "column", x: 0, z: 0, y0: 0, y1: H * 0.55, role: "leg" }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ops.push({
      op: "poly",
      role: "brace",
      points: [
        { x: 0, y: H * 0.45, z: 0 },
        { x: Math.cos(a) * H * 0.28, y: H * 0.75, z: Math.sin(a) * H * 0.28 },
      ],
    });
  }
  ops.push({ op: "dome", y0: H * 0.62, r: H * 0.28, role: "ring" });
  return ops;
}

function dinoOps(s: Size3): FormOp[] {
  const H = s.height;
  const L = Math.max(s.width, H * 1.4);
  return [
    { op: "legs", count: 4, radius: L * 0.18, y0: 0, y1: H * 0.4, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -L * 0.35, y: H * 0.42, z: 0 },
        { x: 0, y: H * 0.5, z: 0 },
        { x: L * 0.25, y: H * 0.55, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "tip",
      points: [
        { x: L * 0.25, y: H * 0.55, z: 0 },
        { x: L * 0.4, y: H * 0.85, z: 0 },
      ],
    },
    {
      op: "poly",
      role: "brace",
      points: [
        { x: -L * 0.35, y: H * 0.42, z: 0 },
        { x: -L * 0.55, y: H * 0.2, z: 0 },
      ],
    },
  ];
}

function robotOps(s: Size3): FormOp[] {
  const H = s.height;
  return [
    { op: "legs", count: 2, radius: H * 0.08, y0: 0, y1: H * 0.4, role: "leg" },
    { op: "box", x: 0, y: H * 0.58, z: 0, w: H * 0.28, h: H * 0.32, d: H * 0.18, role: "rail" },
    { op: "box", x: 0, y: H * 0.88, z: 0, w: H * 0.16, h: H * 0.14, d: H * 0.16, role: "tip" },
    { op: "column", x: H * 0.2, z: 0, y0: H * 0.45, y1: H * 0.75, role: "brace" },
    { op: "column", x: -H * 0.2, z: 0, y0: H * 0.45, y1: H * 0.75, role: "brace" },
  ];
}

function giraffeOps(_s: Size3): FormOp[] {
  return [];
}

function animalOps(_s: Size3): FormOp[] {
  return [];
}

function figureOps(_s: Size3): FormOp[] {
  return [];
}

function guitarOps(s: Size3): FormOp[] {
  const L = Math.max(s.height, s.width);
  return [
    { op: "ring", y: L * 0.22, rx: L * 0.18, n: 10, role: "ring" },
    { op: "column", x: 0, z: 0, y0: L * 0.35, y1: L, role: "leg" },
    { op: "box", x: 0, y: L * 0.96, z: 0, w: L * 0.14, h: L * 0.06, d: L * 0.04, role: "tip" },
  ];
}

function swingOps(s: Size3): FormOp[] {
  const w = s.width;
  const h = s.height;
  return [
    { op: "column", x: -w / 2, z: -w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: -w / 2, z: w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: w / 2, z: -w * 0.2, y0: 0, y1: h, role: "leg" },
    { op: "column", x: w / 2, z: w * 0.2, y0: 0, y1: h, role: "leg" },
    {
      op: "poly",
      role: "rail",
      points: [
        { x: -w / 2, y: h, z: 0 },
        { x: w / 2, y: h, z: 0 },
      ],
    },
  ];
}

function guessOps(lower: string, s: Size3): FormOp[] {
  const hit = classifyAnatomy(lower);
  if (hit.anatomy === "shell") return shellOps(s);
  if (hit.anatomy === "loft") return [taper(0, s.height, s.width * 0.35, s.width * 0.14, 4, "leg")];
  if (hit.anatomy === "span") return bridgeOps(s);
  const ops: FormOp[] = [
    { op: "box", x: 0, y: s.height * 0.45, z: 0, w: s.width, h: s.height * 0.7, d: s.depth, role: "rail" },
  ];
  if (/leg|stand|foot/.test(lower)) {
    ops.push({ op: "legs", count: 4, radius: s.width * 0.38, y0: 0, y1: s.height * 0.4, role: "leg" });
  }
  return ops;
}

export function isFormStroke(v: unknown): v is FormStroke {
  if (!v || typeof v !== "object") return false;
  const pts = (v as FormStroke).points;
  return Array.isArray(pts) && pts.length >= 2 && pts.every((p) => p && typeof p.x === "number" && typeof p.y === "number" && typeof p.z === "number");
}

export function subjectFromPrompt(prompt: string): string {
  let s = prompt.toLowerCase();
  const looks = s.match(/looks like (?:an? |the )?([a-z0-9][a-z0-9\s'-]{1,60})/);
  if (looks) s = looks[1];
  s = s.replace(/\d+(?:\.\d+)?\s*(?:ft|foot|feet|in|inch|inches|cm|m|meter|metre)s?/g, " ");
  s = s.replace(/\bfrom\b.+$/g, " ");
  s = s.replace(/\b(build|make|a|an|the|of|that|with|using|out|model|replica|mini|miniature|scale)\b/g, " ");
  return s.replace(/\s+/g, " ").trim() || prompt.trim();
}

export function isFormOp(v: unknown): v is FormOp {
  if (!v || typeof v !== "object") return false;
  const op = (v as FormOp).op;
  return (
    op === "taper" ||
    op === "column" ||
    op === "ring" ||
    op === "box" ||
    op === "arch" ||
    op === "dome" ||
    op === "grid" ||
    op === "poly" ||
    op === "legs" ||
    op === "shell"
  );
}
