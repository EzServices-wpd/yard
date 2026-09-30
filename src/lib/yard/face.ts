import { createId } from "@/lib/utils";
import { isHingedLidChest } from "./family";
import type { Panel, PanelType, YardProject } from "./types";

/**
 * A face is a cut, not a sticker.
 * Headboard: plain slab, slats, or a framed panel.
 * Door or chest front: flat, or shaker (stiles, rails, recessed panel).
 * Base: nothing, or one molding strip.
 * The prompt carries the choice so the next generate rebuilds the same piece.
 */

const STILE = 2.25;
const GAP = 0.125;
const MOLD_H = 3.5;
const MOLD_T = 0.75;

const r8 = (n: number) => Math.round(n * 8) / 8;

export type HeadboardFace = "plain" | "slats" | "framed";
export type FrontFace = "flat" | "shaker";
export type BaseFace = "none" | "molding";

export type SpokenFace = {
  headboard: HeadboardFace;
  shaker: boolean;
  base: boolean;
};

export type HookRows = "adult" | "kids" | "both";

const HOOK_ROW =
  /\b(?:with\s+)?(?:kid(?:s|')?\s+hooks?|child(?:ren)?'?s?\s+hooks?|both\s+hooks?|two\s+hook\s+rows|adult\s+and\s+kid\s+hooks?)\b/gi;

export function readHookRows(prompt: string): HookRows {
  const l = prompt.toLowerCase();
  if (/both\s+hooks|two\s+hook\s+rows|adult\s+and\s+kid/.test(l)) return "both";
  if (/kid(?:s|')?\s+hooks|child(?:ren)?'?s?\s+hooks/.test(l)) return "kids";
  return "adult";
}

/** Adult hooks, kid hooks, or both. Adult is the default, so the clause is only stored when it changes. */
export function promptNamingHooks(prompt: string, mode: HookRows): string {
  const t = tidy(prompt.replace(HOOK_ROW, " "));
  if (mode === "kids") return appendClause(t, "with kid hooks");
  if (mode === "both") return appendClause(t, "with both hooks");
  return t;
}

function lastAt(text: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let at = -1;
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) at = m.index;
  return at;
}

export function readSpokenFace(prompt: string): SpokenFace {
  const l = prompt.toLowerCase();
  const slatAt = lastAt(l, /slatted\s+headboard|slat\s+headboard|headboard\s+slats|\bwith\s+slats\b/);
  const framedAt = lastAt(l, /framed(?:\s+panel)?\s+headboard|with\s+a\s+framed\s+panel/);
  const plainAt = lastAt(l, /plain\s+headboard|plain\s+face/);
  let headboard: HeadboardFace = "plain";
  const headBest = Math.max(slatAt, framedAt, plainAt);
  if (headBest >= 0 && headBest === framedAt) headboard = "framed";
  else if (headBest >= 0 && headBest === slatAt && /headboard/.test(l)) headboard = "slats";

  const shakerAt = lastAt(l, /shaker\s+fronts?|\bshaker\b/);
  const flatAt = lastAt(l, /flat\s+fronts?/);
  const shaker = shakerAt >= 0 && shakerAt >= flatAt;

  const noBase = lastAt(l, /no\s+base\s+molding/);
  const yesBase = lastAt(l, /with\s+base\s+molding|(?<!no\s)base\s+molding/);
  const base = yesBase >= 0 && (noBase < 0 || yesBase > noBase);
  return { headboard, shaker, base };
}

const FACE_CLAUSE =
  /\b(?:framed\s+panel\s+headboard|slatted\s+headboard|slat\s+headboard|headboard\s+slats|framed\s+headboard|with\s+a\s+framed\s+panel|with\s+slats|plain\s+headboard|plain\s+face|with\s+shaker\s+fronts?|shaker\s+fronts?|\bshaker\b|flat\s+fronts?|with\s+base\s+molding|no\s+base\s+molding|base\s+molding)\b/gi;

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function appendClause(prompt: string, clause: string): string {
  const from = prompt.toLowerCase().lastIndexOf(" from ");
  const body = from >= 0 ? `${prompt.slice(0, from)} ${clause}${prompt.slice(from)}` : `${prompt} ${clause}`;
  return tidy(body);
}

/** Drop an earlier face phrase and append one, so choices don't stack. */
export function promptNamingFace(
  prompt: string,
  patch: { headboard?: HeadboardFace; fronts?: FrontFace; base?: BaseFace },
): string {
  let t = tidy(prompt.replace(FACE_CLAUSE, " "));
  const extra: string[] = [];
  if (patch.headboard === "slats") extra.push(/headboard/i.test(t) ? "with slats" : "slatted headboard");
  else if (patch.headboard === "framed") extra.push(/headboard/i.test(t) ? "with a framed panel" : "framed panel headboard");
  if (patch.fronts === "shaker") extra.push("with shaker fronts");
  if (patch.base === "molding") extra.push("with base molding");
  if (!extra.length) return t;
  return extra.reduce((acc, clause) => appendClause(acc, clause), t);
}

const DRAWER_CLAUSE =
  /\b(?:with\s+)?(?:no|zero|without|sans)\s+(?:any\s+)?drawers?\b|\bdrawerless\b|\bwith\s+\d+\s*-?\s*drawers?\b|\b\d+\s*-?\s*drawers?\b|\bwith\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|single|a)\s+(?:pencil\s+)?drawers?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|single)\s+(?:pencil\s+)?drawers?\b|\ba\s+(?:pencil\s+)?drawer\b|\bdrawers?\s*[:=]\s*\d+\b/gi;

export function spokenDrawerCount(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\b(?:no|zero|without|sans)\s+(?:any\s+)?drawers?\b|\bdrawerless\b|\b0\s*-?\s*drawers?\b|\bdrawers?\s*[:=]\s*0\b/.test(lower)) {
    return 0;
  }
  const digit = lower.match(/\b(\d+)\s*-?\s*drawers?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1, a: 1,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|single|a)\s+(?:pencil\s+)?drawers?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  return null;
}

/** One drawer clause. "chest of drawers" stays; "with 3 drawers" does not stack on "with 2 drawers". */
export function promptWithDrawers(prompt: string, count: number): string {
  const n = Math.max(0, Math.min(12, Math.round(count)));
  const t = tidy(prompt.replace(DRAWER_CLAUSE, " "));
  const clause = n <= 0 ? "no drawers" : `with ${n} ${n === 1 ? "drawer" : "drawers"}`;
  return appendClause(t, clause);
}

function textOf(project: YardProject): string {
  return `${project.name}\n${project.prompt ?? ""}`.toLowerCase();
}

function isHeadboard(project: YardProject): boolean {
  return /headboard/.test(textOf(project)) || project.panels.some((p) => /headboard/i.test(p.name));
}

export function pieceControls(project: YardProject): {
  headboard: boolean;
  fronts: boolean;
  base: boolean;
  drawers: number | null;
  headboardMode: HeadboardFace;
  frontMode: FrontFace;
  baseMode: BaseFace;
  hooks: HookRows | null;
} {
  const face = readSpokenFace(project.prompt ?? "");
  const text = textOf(project);
  const panels = project.panels;
  const stick = panels.length === 0 && project.instances.length > 0;
  const hasDoor = panels.some((p) => p.type === "door");
  const hasFront = panels.some((p) => p.type === "rail" && p.name.trim().toLowerCase() === "front");
  const shakerParts = panels.some((p) => /^shaker (stile|rail|panel)$/i.test(p.name));
  const chest = /\bchest\b|\btrunk\b|toy chest/.test(text) && !/of\s+drawers/.test(text);
  const doorish = /\bdoors?\b|closet|pantry|wardrobe|linen|dog\s*-?\s*house|doghouse|kennel|armoire|medicine/.test(text);
  const fronts = hasDoor || shakerParts || (chest && (hasFront || stick || face.shaker)) || (stick && (doorish || face.shaker));

  const family = project.fitted?.family;
  const hung =
    project.assumptions?.installMode === "wall" ||
    family === "slab" ||
    family === "hung-open" ||
    family === "hung-cabinet" ||
    family === "table";
  const drawerClass = /nightstand|dresser|file\s*cabinet|filing\s*cabinet|\bdesk\b|\bvanity\b|of\s+drawers/.test(text);
  const drawerLow = panels.some(
    (p) => (p.type === "drawer" || /drawer front/i.test(p.name)) && p.position.y < 3.2,
  );
  const base =
    !isHeadboard(project) &&
    !hung &&
    !drawerClass &&
    !drawerLow &&
    !/\b(?:table|bench|stool|chair|shelf|ledge)\b/.test(text) &&
    project.overall.height >= 16 &&
    (project.kind === "closet" || Boolean(project.fitted) || panels.length > 0 || stick);

  const headboard = isHeadboard(project);
  let drawers: number | null = null;
  const lidChest = isHingedLidChest(text) && !/of\s+drawers/.test(text);
  const drawerPiece =
    !headboard &&
    !lidChest &&
    (panels.some((p) => p.type === "drawer") ||
      /nightstand|bedside|dresser|file\s*cabinet|filing\s*cabinet|\bdesk\b|\bvanity\b|of\s+drawers/.test(text));
  if (drawerPiece && !/bedside\s+shelf|filing\s+shelf/.test(text)) {
    if (panels.length) drawers = panels.filter((p) => p.type === "drawer").length;
    else {
      const spoken = spokenDrawerCount(project.prompt ?? "");
      if (spoken != null) drawers = spoken;
      else if (/nightstand/.test(text) || (/bedside/.test(text) && !/shelf/.test(text))) drawers = 1;
      else drawers = 3;
    }
  }

  return {
    headboard,
    fronts,
    base,
    drawers,
    headboardMode: face.headboard,
    frontMode: face.shaker ? "shaker" : "flat",
    baseMode: face.base ? "molding" : "none",
    hooks: /coat/.test(text) && /bench/.test(text) ? readHookRows(project.prompt ?? "") : null,
  };
}

function clonePanel(p: Panel): Panel {
  return {
    ...p,
    position: { ...p.position },
    size: { ...p.size },
    joints: p.joints?.map((j) => ({ ...j })),
    cutouts: p.cutouts?.map((c) => ({ ...c })),
    leaf: p.leaf ? { ...p.leaf } : undefined,
    blank: p.blank ? { ...p.blank } : undefined,
    polygon: p.polygon ? { ...p.polygon, pts: p.polygon.pts.map((pt) => [...pt] as [number, number]) } : undefined,
  };
}

function makePanel(
  type: PanelType,
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId: string,
  extra: Partial<Panel> = {},
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x: r8(x), y: r8(y), z: r8(z) },
    size: { width: r8(w), height: r8(h), depth: r8(d) },
    materialId,
    ...extra,
  };
}

function faceOk(w: number, h: number, t: number): boolean {
  const thin = Math.min(w, h, t);
  return Math.abs(t - thin) < 0.05 && t <= 1.75 && t >= 0.5 && w >= 8 && h >= 8 && w > STILE * 2 + 2 && h > STILE * 2 + 2;
}

function hingeOf(p: Panel, doors: Panel[]): "left" | "right" {
  if (/left/i.test(p.name) && !/right/i.test(p.name)) return "left";
  if (/right/i.test(p.name)) return "right";
  if (doors.length === 1) return "left";
  return p.position.x + p.size.width / 2 < 0 ? "left" : "right";
}

/** Stiles and rails full thickness, panel half thickness, back edges flush. */
function frameFace(
  p: Panel,
  names: { stile: string; rail: string; panel: string },
  hinge: "left" | "right" | null,
): Panel[] {
  const x = p.position.x;
  const y = p.position.y;
  const z = p.position.z;
  const w = p.size.width;
  const h = p.size.height;
  const t = p.size.depth;
  const mat = p.materialId;
  const panelT = r8(Math.min(0.375, t / 2));
  const innerW = r8(w - STILE * 2);
  const innerH = r8(h - STILE * 2);
  const pw = r8(innerW - GAP * 2);
  const ph = r8(innerH - GAP * 2);
  if (pw < 1.5 || ph < 1.5 || panelT < 0.25) return [p];

  const leafId = p.id;
  const hingeX = hinge === "right" ? x + w : x;
  const hingeZ = z + t / 2;
  const leaf = (role: "hinge" | "pull" | "part") =>
    hinge
      ? { id: leafId, hinge, hingeX, hingeZ, role }
      : undefined;

  const leftRole = hinge === "right" ? "pull" : hinge === "left" ? "hinge" : "part";
  const rightRole = hinge === "left" ? "pull" : hinge === "right" ? "hinge" : "part";
  const stileType = (role: "hinge" | "pull" | "part"): PanelType => (role === "hinge" ? "door" : "rail");

  const parts: Panel[] = [
    makePanel(stileType(leftRole), names.stile, x, y, z, STILE, h, t, mat, {
      leaf: leaf(leftRole),
      cutNote: '2 1/4" wide.',
    }),
    makePanel(stileType(rightRole), names.stile, x + w - STILE, y, z, STILE, h, t, mat, {
      leaf: leaf(rightRole),
      cutNote: '2 1/4" wide.',
    }),
    makePanel("rail", names.rail, x + STILE, y, z, innerW, STILE, t, mat, {
      leaf: leaf("part"),
      cutNote: '2 1/4" wide.',
    }),
    makePanel("rail", names.rail, x + STILE, y + h - STILE, z, innerW, STILE, t, mat, {
      leaf: leaf("part"),
      cutNote: '2 1/4" wide.',
    }),
    makePanel("rail", names.panel, x + STILE + GAP, y + STILE + GAP, z, pw, ph, panelT, mat, {
      leaf: leaf("part"),
      cutNote: 'Resaw to 3/8" thick. The field sits back from the frame.',
    }),
  ];
  return parts;
}

function shakerPanels(panels: Panel[]): { panels: Panel[]; changed: boolean } {
  const doors = panels.filter((p) => p.type === "door" && faceOk(p.size.width, p.size.height, p.size.depth) && !/shaker/i.test(p.name));
  const fronts = panels.filter(
    (p) => p.type === "rail" && p.name.trim().toLowerCase() === "front" && faceOk(p.size.width, p.size.height, p.size.depth),
  );
  if (!doors.length && !fronts.length) return { panels, changed: false };
  const drop = new Set<Panel>([...doors, ...fronts]);
  const next = panels.filter((p) => !drop.has(p));
  for (const door of doors) {
    next.push(
      ...frameFace(door, { stile: "Shaker stile", rail: "Shaker rail", panel: "Shaker panel" }, hingeOf(door, doors)),
    );
  }
  for (const front of fronts) {
    next.push(...frameFace(front, { stile: "Shaker stile", rail: "Shaker rail", panel: "Shaker panel" }, null));
  }
  return { panels: next, changed: true };
}

type Box = { x: number; y: number; z: number; w: number; h: number; t: number; mat: string };

function headboardBox(panels: Panel[]): { box: Box; slabs: Panel[] } | null {
  const slabs = panels.filter((p) => /headboard/i.test(p.name) && !/^headboard (post|rail|slat|panel)$/i.test(p.name));
  if (!slabs.length) return null;
  const x = Math.min(...slabs.map((p) => p.position.x));
  const y = Math.min(...slabs.map((p) => p.position.y));
  const z = Math.min(...slabs.map((p) => p.position.z));
  const x1 = Math.max(...slabs.map((p) => p.position.x + p.size.width));
  const y1 = Math.max(...slabs.map((p) => p.position.y + p.size.height));
  const z1 = Math.max(...slabs.map((p) => p.position.z + p.size.depth));
  return {
    slabs,
    box: { x, y, z, w: x1 - x, h: y1 - y, t: Math.max(0.5, z1 - z), mat: slabs[0].materialId },
  };
}

function slatHeadboard(box: Box): Panel[] | null {
  const post = 2.5;
  const rail = 2.5;
  const slat = 2.25;
  if (box.w < post * 2 + 6 || box.h < rail * 2 + 6) return null;
  const parts: Panel[] = [];
  const note = "Rip from the sheet.";
  parts.push(makePanel("upright", "Headboard post", box.x, box.y, box.z, post, box.h, box.t, box.mat, { cutNote: "Full height." }));
  parts.push(
    makePanel("upright", "Headboard post", box.x + box.w - post, box.y, box.z, post, box.h, box.t, box.mat, { cutNote: "Full height." }),
  );
  const innerW = r8(box.w - post * 2);
  parts.push(makePanel("rail", "Headboard rail", box.x + post, box.y, box.z, innerW, rail, box.t, box.mat, { cutNote: note }));
  parts.push(
    makePanel("rail", "Headboard rail", box.x + post, box.y + box.h - rail, box.z, innerW, rail, box.t, box.mat, { cutNote: note }),
  );
  const innerH = r8(box.h - rail * 2);
  let n = Math.max(3, Math.floor(innerW / (slat + 1.5)));
  let gap = r8((innerW - n * slat) / (n + 1));
  while (n > 3 && (gap < 1 || n * slat + (n + 1) * gap > innerW + 0.02)) {
    n -= 1;
    gap = r8((innerW - n * slat) / (n + 1));
  }
  const used = n * slat + (n + 1) * gap;
  if (used > innerW + 0.02 || gap < 0.5) return null;
  const lead = box.x + post + gap + Math.max(0, innerW - used) / 2;
  for (let i = 0; i < n; i++) {
    parts.push(
      makePanel("rail", "Headboard slat", lead + i * (slat + gap), box.y + rail, box.z, slat, innerH, box.t, box.mat, {
        cutNote: note,
      }),
    );
  }
  return parts;
}

function addBase(panels: Panel[]): "added" | "drawers" | "short" | "skip" {
  if (panels.some((p) => /base molding/i.test(p.name))) return "skip";
  if (!panels.length) return "skip";
  const drawerLow = panels.some((p) => (p.type === "drawer" || /drawer front/i.test(p.name)) && p.position.y < MOLD_H - 0.2);
  if (drawerLow) return "drawers";
  const maxZ = Math.max(...panels.map((p) => p.position.z + p.size.depth));
  const minX = Math.min(...panels.map((p) => p.position.x));
  const maxX = Math.max(...panels.map((p) => p.position.x + p.size.width));
  const doors = panels.filter((p) => p.type === "door" && p.position.z + p.size.depth >= maxZ - 0.35 && p.position.y < MOLD_H);
  const floor = MOLD_H + GAP;
  for (const door of doors) {
    const lift = floor - door.position.y;
    if (door.size.height - lift < 6) return "short";
  }
  for (const door of doors) {
    const lift = floor - door.position.y;
    door.position = { ...door.position, y: r8(door.position.y + lift) };
    door.size = { ...door.size, height: r8(door.size.height - lift) };
  }
  const mat = panels.find((p) => p.type === "upright")?.materialId ?? panels[0].materialId;
  panels.push(
    makePanel("rail", "Base molding", minX, 0, maxZ, maxX - minX, MOLD_H, MOLD_T, mat, {
      cutNote: "length = the width",
    }),
  );
  return "added";
}

/**
 * Apply the face the prompt asked for. No-op when the prompt names none,
 * so a plain generate stays the piece it already was.
 */
export function applySpokenFace(project: YardProject, prompt: string): YardProject {
  const want = readSpokenFace(prompt);
  const head = isHeadboard(project);
  if (want.headboard === "plain" && !want.shaker && !want.base) return project;
  if (!project.panels.length) return project;

  let panels = project.panels.map(clonePanel);
  const notes = [...(project.notes ?? [])];
  let changed = false;
  let depthBump = 0;

  if (want.base && !head) {
    const result = addBase(panels);
    if (result === "added") {
      changed = true;
      depthBump = MOLD_T;
      notes.push('Base molding: one strip, 3 1/2" tall and 3/4" thick, 3/4" proud of the front. Length = the width.');
    } else if (result === "drawers") {
      notes.push("Base molding left off — a drawer already fills the bottom.");
    } else if (result === "short") {
      notes.push("Base molding left off — the front is too short to clear a 3 1/2\" strip.");
    }
  }

  if (want.shaker) {
    const framed = shakerPanels(panels);
    panels = framed.panels;
    if (framed.changed) {
      changed = true;
      notes.push('Shaker front: 2 1/4" stiles and rails, and a panel resawn to 3/8" so it sits back from the frame.');
    }
  }

  if (head && (want.headboard === "slats" || want.headboard === "framed")) {
    const found = headboardBox(panels);
    if (found) {
      const built =
        want.headboard === "slats"
          ? slatHeadboard(found.box)
          : frameFace(
              {
                ...found.slabs[0],
                position: { x: found.box.x, y: found.box.y, z: found.box.z },
                size: { width: found.box.w, height: found.box.h, depth: found.box.t },
                materialId: found.box.mat,
              },
              { stile: "Headboard post", rail: "Headboard rail", panel: "Headboard panel" },
              null,
            );
      if (!built || built.length < 2) {
        /* keep the plain slab */
      } else if (want.headboard === "slats" || built[0].name === "Headboard post") {
        const drop = new Set(found.slabs);
        panels = panels.filter((p) => !drop.has(p));
        panels.push(...built);
        changed = true;
        notes.push(
          want.headboard === "slats"
            ? "Slatted headboard: two posts, a top and bottom rail, and slats ripped from the sheet. The gaps are open."
            : "Framed headboard: posts and rails around a panel set back from the face.",
        );
      }
    }
  }

  if (!changed) return project;
  const overall = depthBump
    ? { ...project.overall, depth: r8(project.overall.depth + depthBump) }
    : project.overall;
  return { ...project, panels, notes, overall };
}
