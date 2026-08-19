import type { StructureKind, Vec3 } from "./types";

export type FormOp =
  | { op: "taper"; y0: number; y1: number; r0: number; r1: number; sides?: number; role?: string }
  | { op: "column"; x: number; z: number; y0: number; y1: number; role?: string }
  | { op: "ring"; y: number; rx: number; rz?: number; n?: number; role?: string }
  | { op: "box"; x: number; y: number; z: number; w: number; h: number; d: number; role?: string }
  | { op: "arch"; x0: number; z0: number; x1: number; z1: number; y0?: number; crown: number; role?: string }
  | { op: "dome"; x?: number; z?: number; y0: number; r: number; role?: string }
  | { op: "grid"; y: number; w: number; d: number; nx?: number; nz?: number; x?: number; z?: number; role?: string }
  | { op: "poly"; points: Vec3[]; role?: string }
  | { op: "legs"; count: number; radius: number; y0: number; y1: number; role?: string };

export type FormStroke = { points: Vec3[]; role?: string };
export type FormRecipe = { name: string; kind: StructureKind; historic?: boolean; notes: string[]; ops: FormOp[]; strokes?: FormStroke[]; source?: string };
export type Size3 = { height: number; width: number; depth: number };

type Hit = { re: RegExp; kind: StructureKind; name: string; historic?: boolean; build: (s: Size3) => FormOp[] };

const HITS: Hit[] = [
  { re: /eiffel/, kind: "eiffel", name: "Eiffel", historic: true, build: () => [] },
  { re: /taj|mahal/, kind: "taj", name: "Taj Mahal", historic: true, build: tajOps },
  { re: /pyramid|giza|khufu/, kind: "pyramid", name: "Pyramid", historic: true, build: pyramidOps },
  { re: /statue of liberty|liberty statue|\bliberty\b/, kind: "figure", name: "Liberty", historic: true, build: libertyOps },
  { re: /castle|fort|keep|turret/, kind: "castle", name: "Castle", build: castleOps },
  { re: /bridge|span/, kind: "bridge", name: "Bridge", build: bridgeOps },
  { re: /house|cabin|shed|hut|cottage|barn|birdhouse/, kind: "house", name: "House", build: houseOps },
  { re: /wall|fence/, kind: "wall", name: "Wall", build: wallOps },
  { re: /dome|igloo|sphere/, kind: "dome", name: "Dome", build: domeOps },
  { re: /arch|gateway|portal/, kind: "arch", name: "Arch", build: archOps },
  { re: /ladder|stairs/, kind: "ladder", name: "Ladder", build: ladderOps },
  { re: /chair|stool/, kind: "furniture", name: "Chair", build: chairOps },
  { re: /table|desk|workbench/, kind: "furniture", name: "Table", build: tableOps },
  { re: /rocket|spaceship/, kind: "vehicle", name: "Rocket", build: rocketOps },
  { re: /giraffe/, kind: "figure", name: "Giraffe", build: giraffeOps },
  { re: /person|human|figure|statue/, kind: "figure", name: "Figure", build: figureOps },
  { re: /lattice/, kind: "lattice", name: "Lattice", build: () => [] },
  { re: /tower|spire|column|stack|lighthouse|obelisk|pagoda|windmill/, kind: "tower", name: "Tower", build: towerOps },
  { re: /frame|box|cube|platform/, kind: "frame", name: "Frame", build: frameOps },
];

export function detectForm(prompt: string, size: Size3): FormRecipe {
  const lower = prompt.toLowerCase();
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? `${looks[1]} ${lower}` : lower;
  for (const hit of HITS) {
    if (hit.re.test(hay)) {
      return {
        name: hit.name, kind: hit.kind, historic: hit.historic,
        notes: [`${hit.name} · stock mapped onto the form, not a hull.`, hit.historic ? "Historic proportions, scaled to the size you asked for." : "Frame first, then brace."],
        ops: hit.build(size),
      };
    }
  }
  return { name: "Custom form", kind: "custom", notes: ["Framed body from the prompt."], ops: guessOps(lower, size) };
}

function taper(y0: number, y1: number, r0: number, r1: number, sides = 8, role = "leg"): FormOp {
  return { op: "taper", y0, y1, r0, r1, sides, role };
}
function tajOps(s: Size3): FormOp[] {
  const H = s.height, plat = H * 0.65, body = plat * 0.42;
  return [
    { op: "grid", y: 0.4, w: plat * 2, d: plat * 2, nx: 4, nz: 4, role: "base" },
    taper(0.4, H * 0.55, body, body * 0.75, 8, "leg"),
    { op: "dome", y0: H * 0.55, r: body * 0.9, role: "ring" },
    { op: "column", x: plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
    { op: "column", x: -plat * 0.82, z: -plat * 0.82, y0: 0, y1: H * 0.58, role: "leg" },
  ];
}
function pyramidOps(s: Size3): FormOp[] {
  const H = s.height;
  const half = (s.width > H * 0.7 ? s.width : H * (230.3 / 146.6)) / 2;
  const ops: FormOp[] = [];
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
    ops.push({ op: "poly", role: "leg", points: [{ x: Math.cos(a) * half, y: 0, z: Math.sin(a) * half }, { x: 0, y: H, z: 0 }] });
  }
  const courses = Math.max(4, Math.round(H / 4));
  for (let i = 0; i < courses; i++) ops.push({ op: "ring", y: (i / courses) * H, rx: half * (1 - i / courses), n: 8, role: "ring" });
  return ops;
}
function libertyOps(s: Size3): FormOp[] {
  const H = s.height;
  return [taper(0, H * 0.55, H * 0.16, H * 0.1, 8, "leg"), { op: "column", x: 0, z: 0, y0: H * 0.55, y1: H * 0.78, role: "leg" }, { op: "poly", role: "support", points: [{ x: 0, y: H * 0.62, z: 0 }, { x: H * 0.22, y: H * 0.78, z: 0 }, { x: H * 0.28, y: H * 0.98, z: 0 }] }];
}
function castleOps(s: Size3): FormOp[] {
  const H = s.height, w = s.width / 2;
  const ops: FormOp[] = [{ op: "box", x: 0, y: H * 0.35, z: 0, w: w * 2, h: H * 0.7, d: w * 2, role: "ring" }];
  for (const [x, z] of [[w, w], [-w, w], [w, -w], [-w, -w]] as const) ops.push({ op: "column", x, z, y0: 0, y1: H, role: "leg" });
  return ops;
}
function bridgeOps(s: Size3): FormOp[] {
  return [{ op: "column", x: 0, z: 0, y0: 0, y1: s.height * 0.35, role: "leg" }, { op: "column", x: s.width, z: 0, y0: 0, y1: s.height * 0.35, role: "leg" }, { op: "grid", y: s.height * 0.35, w: s.width, d: Math.max(6, s.depth * 0.4), nx: 6, nz: 2, x: s.width / 2, role: "rail" }, { op: "arch", x0: 0, z0: 0, x1: s.width, z1: 0, crown: s.height * 0.3, role: "support" }];
}
function houseOps(s: Size3): FormOp[] {
  return [{ op: "box", x: 0, y: s.height * 0.31, z: 0, w: s.width, h: s.height * 0.62, d: s.depth, role: "leg" }, { op: "poly", role: "brace", points: [{ x: -s.width / 2, y: s.height * 0.62, z: 0 }, { x: 0, y: s.height, z: 0 }, { x: s.width / 2, y: s.height * 0.62, z: 0 }] }];
}
function wallOps(s: Size3): FormOp[] {
  const posts = Math.max(3, Math.round(s.width / 8));
  const ops: FormOp[] = [];
  for (let i = 0; i < posts; i++) ops.push({ op: "column", x: (i / (posts - 1 || 1)) * s.width, z: 0, y0: 0, y1: s.height, role: "leg" });
  return ops;
}
function domeOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.height) / 2;
  return [{ op: "dome", y0: 0, r, role: "ring" }, { op: "ring", y: 0, rx: r, n: 12, role: "base" }];
}
function archOps(s: Size3): FormOp[] {
  return [{ op: "column", x: -s.width / 2, z: 0, y0: 0, y1: s.height, role: "leg" }, { op: "column", x: s.width / 2, z: 0, y0: 0, y1: s.height, role: "leg" }, { op: "arch", x0: -s.width / 2, z0: 0, x1: s.width / 2, z1: 0, y0: s.height * 0.55, crown: s.height * 0.45, role: "support" }];
}
function ladderOps(s: Size3): FormOp[] {
  const z = Math.max(4, s.depth * 0.2);
  return [{ op: "column", x: 0, z: -z / 2, y0: 0, y1: s.height, role: "leg" }, { op: "column", x: 0, z: z / 2, y0: 0, y1: s.height, role: "leg" }];
}
function frameOps(s: Size3): FormOp[] {
  return [{ op: "box", x: 0, y: s.height / 2, z: 0, w: s.width, h: s.height, d: s.depth, role: "leg" }];
}
function towerOps(s: Size3): FormOp[] {
  return [taper(0, s.height, s.width * 0.45, s.width * 0.18, 6, "leg")];
}
function chairOps(s: Size3): FormOp[] {
  return [{ op: "legs", count: 4, radius: s.width * 0.38, y0: 0, y1: s.height * 0.45, role: "leg" }, { op: "grid", y: s.height * 0.45, w: s.width, d: s.width * 0.85, nx: 3, nz: 3, role: "rail" }];
}
function tableOps(s: Size3): FormOp[] {
  return [{ op: "legs", count: 4, radius: Math.min(s.width, s.depth) * 0.42, y0: 0, y1: s.height, role: "leg" }, { op: "grid", y: s.height, w: s.width, d: s.depth, nx: 4, nz: 3, role: "rail" }];
}
function rocketOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [taper(0, H * 0.78, H * 0.12, H * 0.07, 8, "leg"), { op: "dome", y0: H * 0.78, r: H * 0.08, role: "tip" }];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ops.push({ op: "poly", role: "brace", points: [{ x: Math.cos(a) * H * 0.05, y: 0, z: Math.sin(a) * H * 0.05 }, { x: Math.cos(a) * H * 0.22, y: 0, z: Math.sin(a) * H * 0.22 }, { x: Math.cos(a) * H * 0.06, y: H * 0.22, z: Math.sin(a) * H * 0.06 }] });
  }
  return ops;
}
function giraffeOps(s: Size3): FormOp[] {
  const H = s.height, L = H * (4.3 / 5.5), leg = H * 0.42, z = H * 0.06;
  return [
    { op: "poly", role: "leg", points: [{ x: L * 0.18, y: 0, z: -z }, { x: L * 0.18, y: leg, z: -z }] },
    { op: "poly", role: "leg", points: [{ x: L * 0.28, y: 0, z }, { x: L * 0.28, y: leg, z }] },
    { op: "poly", role: "leg", points: [{ x: L * 0.72, y: 0, z: -z }, { x: L * 0.72, y: leg, z: -z }] },
    { op: "poly", role: "leg", points: [{ x: L * 0.82, y: 0, z }, { x: L * 0.82, y: leg, z }] },
    { op: "poly", role: "rail", points: [{ x: L * 0.18, y: leg, z: 0 }, { x: L * 0.5, y: leg + H * 0.06, z: 0 }, { x: L * 0.82, y: leg, z: 0 }] },
    { op: "poly", role: "support", points: [{ x: L * 0.22, y: leg + H * 0.04, z: 0 }, { x: L * 0.12, y: H * 0.72, z: 0 }, { x: L * 0.18, y: H * 0.94, z: 0 }] },
    { op: "poly", role: "tip", points: [{ x: L * 0.18, y: H * 0.94, z: 0 }, { x: L * 0.32, y: H * 0.97, z: 0 }] },
  ];
}
function figureOps(s: Size3): FormOp[] {
  const H = s.height;
  return [{ op: "legs", count: 2, radius: H * 0.06, y0: 0, y1: H * 0.42, role: "leg" }, taper(H * 0.4, H * 0.72, H * 0.1, H * 0.08, 6, "rail"), { op: "ring", y: H * 0.84, rx: H * 0.07, n: 6, role: "tip" }];
}
function guessOps(lower: string, s: Size3): FormOp[] {
  const ops: FormOp[] = [taper(0, s.height * 0.85, s.width * 0.35, s.width * 0.16, 6, "leg")];
  if (/leg|stand|foot/.test(lower)) ops.push({ op: "legs", count: 4, radius: s.width * 0.3, y0: 0, y1: s.height * 0.35, role: "support" });
  if (/head|face/.test(lower)) ops.push({ op: "ring", y: s.height * 0.92, rx: s.width * 0.12, n: 6, role: "tip" });
  return ops;
}

export function isFormStroke(v: unknown): v is FormStroke {
  if (!v || typeof v !== "object") return false;
  const pts = (v as FormStroke).points;
  return Array.isArray(pts) && pts.length >= 2 && pts.every((p) => p && typeof p.x === "number" && typeof p.y === "number" && typeof p.z === "number");
}
export function isFormOp(v: unknown): v is FormOp {
  if (!v || typeof v !== "object") return false;
  const op = (v as FormOp).op;
  return op === "taper" || op === "column" || op === "ring" || op === "box" || op === "arch" || op === "dome" || op === "grid" || op === "poly" || op === "legs";
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
