/**
 * Any catalog unit can be a member of a form.
 * A sheet is not a 48" thick stick — it is ripped into battens.
 * A brick, a toothpick, and a 2×4 are already members.
 * Buy still names the unit you purchase (the sheet, the brick pack).
 */
import { createId } from "@/lib/utils";
import { isWholeStock, toPrimitive } from "./geometry";
import type { CatalogItem, Panel, PanelType, Vec3, YardInstance, YardProject } from "./types";

export type MemberSection = { width: number; height: number };

export type MemberView = {
  /** The unit the shopper buys. */
  stock: CatalogItem;
  /** Cross-section + a short pitch length for density, weld, and bay. */
  density: CatalogItem;
  /** Real purchasable length for cutting members. */
  cut: CatalogItem;
  /** Drawn cross-section when it is not the raw catalog face. Null = draw the catalog unit. */
  section: MemberSection | null;
  note: string | null;
};

function isSheetStock(item: CatalogItem): boolean {
  return item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard";
}

function inchTalk(n: number): string {
  const q = Math.round(n * 8) / 8;
  const whole = Math.floor(q + 1e-6);
  const eighths = Math.round((q - whole) * 8);
  const names = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"];
  const f = names[eighths] ?? "";
  if (!f) return `${whole}"`;
  if (!whole) return `${f}"`;
  return `${whole} ${f}"`;
}

/** Linear-member view of a catalog unit. Identity for sticks, pipe, and boards. */
export function memberView(item: CatalogItem): MemberView {
  if (!isSheetStock(item)) {
    return { stock: item, density: item, cut: item, section: null, note: null };
  }
  const thick = Math.max(0.12, item.dims.thickness ?? item.dims.height ?? 0.25);
  // A batten ripped off the sheet. Never the 48" face — that weld-collapses the form.
  const stripW = thick >= 0.6 ? 1 : 0.75;
  const sheetL = item.dims.length ?? 96;
  const section: MemberSection = {
    width: stripW,
    height: Math.round(thick * 1000) / 1000,
  };
  const cut: CatalogItem = {
    ...item,
    formFactor: "board",
    dims: { length: sheetL, width: section.width, thickness: section.height },
    canCut: true,
  };
  const density: CatalogItem = {
    ...cut,
    dims: { ...cut.dims, length: Math.min(sheetL, 18) },
  };
  return {
    stock: item,
    density,
    cut,
    section,
    note: `Ripped into ${inchTalk(section.width)} × ${inchTalk(section.height)} strips from ${item.name}. Buy whole sheets — the drawing is the strips, not the full sheet face.`,
  };
}

type Ax = "x" | "y" | "z";

function worldOf(panel: Panel, lx: number, ly: number, lz: number): Vec3 {
  const yaw = panel.yaw ?? 0;
  const x = panel.position.x + lx;
  const y = panel.position.y + ly;
  const z = panel.position.z + lz;
  if (!yaw) return { x, y, z };
  const cx = panel.position.x + panel.size.width / 2;
  const cz = panel.position.z + panel.size.depth / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const dx = x - cx;
  const dz = z - cz;
  return { x: cx + dx * c + dz * s, y, z: cz - dx * s + dz * c };
}

/**
 * The same carcase, tiled in a stock that is not a sheet or a board.
 * Faces stay where they were. The plan follows the sticks, bricks, or pipe.
 */
function isFaceStock(item: CatalogItem): boolean {
  return isSheetStock(item) || item.formFactor === "board";
}

/**
 * Kinds a person sets a load on. Checked as PanelType, so a kind that is not real
 * ("seat") does not compile. A seat or a deck is also a name on another kind.
 * A counter and a bay are kinds of their own.
 */
const LOAD_KINDS: readonly PanelType[] = ["shelf", "top", "bottom", "deck", "counter", "bay"];

export function isLoadSurface(panel: Panel): boolean {
  return LOAD_KINDS.includes(panel.type) || /\b(?:shelf|seat|top|bottom|deck)\b/i.test(panel.name);
}

/**
 * The release cantilever for a rack that is not pipe. Starts at the origin.
 * Pipe racks do not use this.
 */
function openMemberRack(project: YardProject, item: CatalogItem): YardProject {
  const W = Math.max(8, project.overall?.width ?? 36);
  const H = Math.max(8, project.overall?.height ?? 30);
  const D = Math.max(6, project.overall?.depth ?? 12);
  const shelves = project.panels.filter((panel) => panel.type === "shelf" || /shelf/i.test(panel.name));
  const arms = Math.max(2, Math.min(6, shelves.length || 2));
  const join = item.preferredJoins?.[0] ?? "glue";
  const r = (n: number) => Math.round(n * 8) / 8;
  const member = (role: string, a: Vec3, b: Vec3): YardInstance => {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    return {
      id: createId("rk"),
      catalogId: item.id,
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: r(len),
      role,
      join,
      from: a,
      to: b,
    };
  };
  const instances: YardInstance[] = [
    member("upright", { x: 0, y: 0, z: 0 }, { x: 0, y: H, z: 0 }),
    member("upright", { x: W, y: 0, z: 0 }, { x: W, y: H, z: 0 }),
    member("rail", { x: 0, y: 1, z: 0 }, { x: W, y: 1, z: 0 }),
    member("rail", { x: 0, y: H - 1, z: 0 }, { x: W, y: H - 1, z: 0 }),
  ];
  for (let i = 0; i < arms; i++) {
    const y = r(H * (0.35 + (0.45 * i) / Math.max(1, arms - 1)));
    instances.push(member(`arm ${i + 1}`, { x: 0, y, z: 0 }, { x: 0, y, z: D }));
    instances.push(member(`arm ${i + 1}`, { x: W, y, z: 0 }, { x: W, y, z: D }));
  }
  const name = /^Storage unit\b/i.test(project.name)
    ? `Rack ${r(W)}" × ${r(H)}" × ${r(D)}"`
    : project.name;
  return {
    ...project,
    name,
    panels: [],
    fitted: undefined,
    pocket: undefined,
    instances,
    primaryMaterialId: item.id,
    joinMethod: join as YardProject['joinMethod'],
    overall: { width: r(W), height: r(H), depth: r(D) },
    notes: [
      `Open frame of ${item.name}. ${arms} arms at the typed depth. Not a pin-shelf box.`,
      ...recastNotes(project.notes ?? [], item).filter((n) => !/Tiers stay tiers/.test(n)),
    ],
  };
}

/** Centre-to-centre pitch a 3/4" fitting can actually sit on. */
const FITTING_PITCH = 2.75;

function isPipeStock(item: CatalogItem): boolean {
  return item.formFactor === "pipe" || item.formFactor === "tube";
}

function isRackPrompt(prompt: string | undefined): boolean {
  const text = (prompt ?? "").toLowerCase();
  return /\bracks?\b/.test(text) && !/rail|peg|hook/.test(text);
}

export function recastPanelsAsStock(project: YardProject, item: CatalogItem): YardProject {
  if (!project.panels.length) return project;
  const rack = isRackPrompt(project.prompt);
  const pipe = isPipeStock(item);
  // Dowel and stick racks stay the release cantilever. Pipe racks leave it.
  if (rack && !isFaceStock(item) && !pipe) return openMemberRack(project, item);
  if (rack && !pipe) {
    const shelves = project.panels.filter((panel) => panel.type === "shelf" || /shelf/i.test(panel.name));
    if (shelves.length) {
      const posts = project.panels.filter((panel) => panel.type === "upright" || /post|upright/i.test(panel.name));
      const keep = [...posts, ...shelves].map((panel) => ({ ...panel, materialId: item.id }));
      return {
        ...project,
        panels: keep,
        instances: project.instances,
        primaryMaterialId: item.id,
        notes: [`Tiers stay tiers in ${item.name}.`, ...recastNotes(project.notes ?? [], item)],
      };
    }
  }
  const recast = recastFrameAsStock(project, item);
  if (!pipe || !rack) return recast;
  const r = (n: number) => Math.round(n * 8) / 8;
  const name = /^Storage unit\b/i.test(recast.name)
    ? `Rack ${r(recast.overall.width)}" × ${r(recast.overall.height)}" × ${r(recast.overall.depth)}"`
    : recast.name;
  return { ...recast, name, instances: weldOutline(recast.instances, item) };
}

function recastFrameAsStock(project: YardProject, item: CatalogItem): YardProject {
  const prim = toPrimitive(item);
  const stockL = Math.max(0.4, prim.length);
  const across = Math.max(prim.width, prim.height, 0.08);
  const whole = isWholeStock(item);
  const join = item.preferredJoins?.[0] ?? "glue";
  const budget = 3200;
  let gap = item.formFactor === "block" ? 0.06 : 0.04;

  const countAt = (g: number) => {
    const pitch = across + g;
    let n = 0;
    for (const p of project.panels) {
      const lens = [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b);
      const mid = lens[1];
      const long = lens[2];
      const nAcross = Math.max(1, Math.round(mid / Math.max(pitch, 0.08)));
      const usable = whole ? Math.max(stockL * 0.86, stockL - 0.25) : Math.max(stockL * 0.9, 0.5);
      const nAlong = long <= (whole ? stockL : usable) * 1.02 ? 1 : Math.max(1, Math.ceil(long / usable));
      n += nAcross * nAlong;
    }
    return n;
  };
  while (countAt(gap) > budget && gap < across * 8) gap *= 1.4;

  const instances: YardInstance[] = [];
  const pitch = across + gap;

  type Grid = {
    panel: Panel;
    thinA: Ax;
    midA: Ax;
    longA: Ax;
    thinN: number;
    midN: number;
    longN: number;
    nAcross: number;
    nAlong: number;
    cover: number;
    stepAlong: number;
    /** Sticks across the face (the rest of nAcross are the second lamination layer). */
    perLayer: number;
    layers: number;
  };

  // Half the stick across the face and through it: the outer sticks sit flush with the member's faces.
  const roundStock = prim.radius != null;
  const hFace = (roundStock ? prim.width : prim.width) / 2;
  const hThin = (roundStock ? prim.width : prim.height) / 2;
  const grids: Grid[] = [];
  for (const panel of project.panels) {
    const axes: { a: Ax; n: number }[] = [
      { a: "x" as Ax, n: panel.size.width },
      { a: "y" as Ax, n: panel.size.height },
      { a: "z" as Ax, n: panel.size.depth },
    ];
    axes.sort((a, b) => a.n - b.n);
    const thinA = axes[0].a;
    const midA = axes[1].a;
    const longA = axes[2].a;
    const thinN = axes[0].n;
    const midN = axes[1].n;
    const longN = axes[2].n;
    if (longN < 0.2) continue;
    // Edges trace the face. A shelf, seat, or top needs slats so something can sit on it.
    // A section under 1/2" cannot be that face — the note says it is a display model.
    const bearing = panel.type === "shelf" || panel.type === "deck" || panel.type === "top" || /shelf|seat|top/i.test(panel.name);
    const section = Math.max(prim.width, prim.height, item.dims.diameter ?? 0, 0.08);
    // A top, seat, or shelf gets slats across it even in thin stock, so it rests on the frame under it
    // (a display model in thin stock says so in its notes).
    // A 3/4" fitting is about 1 3/8" from centre to face, so pipes between nodes
    // stay at least 2.75" apart. A pipe rack draws that pitch, not one slat per board.
    const pipeRack = isPipeStock(item) && isRackPrompt(project.prompt);
    const pitchCount = (span: number) => {
      let n = Math.max(2, Math.floor((span - section) / FITTING_PITCH) + 1);
      while (n > 2 && (span - section) / (n - 1) < FITTING_PITCH - 1e-6) n -= 1;
      return n;
    };
    const nAcross = bearing
      ? pipeRack
        ? pitchCount(midN)
        : Math.max(3, Math.min(8, Math.round(midN / Math.max(section * 1.5, 1))))
      : midN < 0.2 ? 1 : 2;
    const usable = whole ? Math.max(stockL * 0.86, stockL - 0.25) : Math.max(stockL * 0.9, 0.5);
    const cover = whole ? stockL : Math.min(stockL, longN);
    const nAlong = longN <= cover * 1.02 ? 1 : Math.max(1, Math.ceil(longN / usable));
    const stepAlong = nAlong === 1 ? 0 : Math.max(0.15, (longN - cover) / (nAlong - 1));
    // A member thicker than two sticks is laminated: a layer on each face, so the faces that glue to
    // the next part are stick faces there too and the load path stays a chain of touching sticks.
    const layers = thinN >= 4 * hThin + 0.02 ? 2 : 1;
    grids.push({ panel, thinA, midA, longA, thinN, midN, longN, nAcross: nAcross * layers, nAlong, cover, stepAlong, perLayer: nAcross, layers });
  }

  const place = (g: Grid, i: number, s: number) => {
    const { panel, thinA, midA, longA, thinN, midN, longN, nAlong, cover, stepAlong, perLayer, layers } = g;
    const k = i % perLayer;
    const layer = Math.floor(i / perLayer);
    // Edge sticks flush with the member's edges, the rest evenly between.
    const v = perLayer === 1 || midN <= 2 * hFace ? midN / 2 : hFace + (k * (midN - 2 * hFace)) / (perLayer - 1);
    const t = layers === 1 ? thinN / 2 : layer === 0 ? hThin : thinN - hThin;
    const start = nAlong === 1 ? Math.max(0, (longN - cover) / 2) : Math.min(s * stepAlong, Math.max(0, longN - cover));
    const aL: Record<Ax, number> = { x: thinN / 2, y: thinN / 2, z: thinN / 2 };
    const bL: Record<Ax, number> = { x: thinN / 2, y: thinN / 2, z: thinN / 2 };
    aL[longA] = start;
    bL[longA] = start + cover;
    aL[midA] = Math.min(midN, Math.max(0, v));
    bL[midA] = aL[midA];
    aL[thinA] = t;
    bL[thinA] = t;
    const a = worldOf(panel, aL.x, aL.y, aL.z);
    const b = worldOf(panel, bL.x, bL.y, bL.z);
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.15) return;
    const fL: Record<Ax, number> = { x: aL.x, y: aL.y, z: aL.z };
    fL[thinA] += 1;
    const fw = worldOf(panel, fL.x, fL.y, fL.z);
    instances.push({
      id: createId("sk"),
      catalogId: item.id,
      position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: whole ? undefined : Math.round(Math.min(len, stockL) * 100) / 100,
      role: isPipeStock(item) && isRackPrompt(project.prompt) && DESIGNED_TIP.test(panel.name) ? panel.name : panel.type,
      join,
      from: a,
      to: b,
      // Flat on the member's face, so its thickness runs through the member.
      face: { x: fw.x - a.x, y: fw.y - a.y, z: fw.z - a.z },
    });
  };

  const total = grids.reduce((n, g) => n + g.nAcross * g.nAlong, 0);
  if (total <= budget) {
    for (const g of grids) {
      for (let i = 0; i < g.nAcross; i++) {
        for (let s = 0; s < g.nAlong; s++) place(g, i, s);
      }
    }
  } else {
    // Filling the first faces solid and dropping the rest erases the door,
    // the drawer, and the kick. Share the budget: every face keeps its
    // outline, then leftovers fill the interiors.
    const edgeN = (g: Grid) =>
      g.nAcross * g.nAlong - Math.max(0, g.nAcross - 2) * Math.max(0, g.nAlong - 2);
    const edges = grids.map(edgeN);
    const edgeSum = edges.reduce((n, e) => n + e, 0);
    const quotas = grids.map((g, idx) => {
      const full = g.nAcross * g.nAlong;
      if (edgeSum >= budget) {
        const share = Math.max(1, Math.min(edges[idx], Math.floor((budget * edges[idx]) / Math.max(edgeSum, 1))));
        return Math.min(full, share);
      }
      return edges[idx];
    });
    if (edgeSum < budget) {
      const interiors = grids.map((g, idx) => g.nAcross * g.nAlong - edges[idx]);
      const intSum = interiors.reduce((n, e) => n + e, 0);
      let left = budget - edgeSum;
      for (let idx = 0; idx < grids.length; idx++) {
        const extra = intSum ? Math.floor((left * interiors[idx]) / intSum) : 0;
        quotas[idx] = Math.min(grids[idx].nAcross * grids[idx].nAlong, quotas[idx] + extra);
      }
      let rem = budget - quotas.reduce((n, q) => n + q, 0);
      for (let k = 0; rem > 0 && k < grids.length * 3; k++) {
        const idx = k % grids.length;
        const full = grids[idx].nAcross * grids[idx].nAlong;
        if (quotas[idx] < full) {
          quotas[idx] += 1;
          rem -= 1;
        }
      }
    } else {
      let rem = budget - quotas.reduce((n, q) => n + q, 0);
      for (let k = 0; rem > 0 && k < grids.length * 3; k++) {
        const idx = k % grids.length;
        if (quotas[idx] < edges[idx]) {
          quotas[idx] += 1;
          rem -= 1;
        }
      }
    }

    const sample = (g: Grid, quota: number, fn: (i: number, s: number) => void) => {
      const nA = g.nAcross;
      const nL = g.nAlong;
      if (quota >= nA * nL) {
        for (let i = 0; i < nA; i++) for (let s = 0; s < nL; s++) fn(i, s);
        return;
      }
      const seen = new Set<string>();
      const take = (i: number, s: number) => {
        if (seen.size >= quota) return;
        if (i < 0 || s < 0 || i >= nA || s >= nL) return;
        const key = `${i},${s}`;
        if (seen.has(key)) return;
        seen.add(key);
        fn(i, s);
      };
      take(0, 0);
      take(nA - 1, 0);
      take(0, nL - 1);
      take(nA - 1, nL - 1);
      const perimeter: [number, number][] = [];
      for (let i = 0; i < nA; i++) {
        perimeter.push([i, 0]);
        if (nL > 1) perimeter.push([i, nL - 1]);
      }
      for (let s = 1; s < nL - 1; s++) {
        perimeter.push([0, s]);
        if (nA > 1) perimeter.push([nA - 1, s]);
      }
      if (seen.size < quota && perimeter.length) {
        const stride = Math.max(1, Math.ceil(perimeter.length / Math.max(1, quota - seen.size)));
        for (let k = 0; k < perimeter.length && seen.size < quota; k += stride) take(perimeter[k][0], perimeter[k][1]);
      }
      const innerA = Math.max(0, nA - 2);
      const innerL = Math.max(0, nL - 2);
      const innerN = innerA * innerL;
      const left = quota - seen.size;
      if (left > 0 && innerN > 0) {
        const stride = Math.max(1, Math.round(Math.sqrt(innerN / left)));
        for (let i = 1; i < nA - 1 && seen.size < quota; i += stride) {
          for (let s = 1; s < nL - 1 && seen.size < quota; s += stride) take(i, s);
        }
      }
    };

    for (let idx = 0; idx < grids.length && instances.length < budget; idx++) {
      const room = budget - instances.length;
      sample(grids[idx], Math.min(quotas[idx], room), (i, s) => {
        if (instances.length < budget) place(grids[idx], i, s);
      });
    }
  }

  // End ties: at each end of a member a stick runs across between its edge sticks (and through it
  // between the two laminations), so the member's sticks are one glued bundle, not loose outlines.
  const tie = (g: Grid, from: Record<Ax, number>, to: Record<Ax, number>, faceA: Ax) => {
    const L = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (L < 0.15) return;
    const span = whole ? stockL : Math.max(stockL * 0.9, 0.5);
    const n = L <= span * 1.02 ? 1 : Math.ceil(L / (span * 0.95));
    const seg = Math.min(L, span);
    for (let q = 0; q < n; q++) {
      const t0 = n === 1 ? 0 : (q * (L - seg)) / (n - 1);
      const lerp = (u: number): Record<Ax, number> => ({ x: from.x + ((to.x - from.x) * u) / L, y: from.y + ((to.y - from.y) * u) / L, z: from.z + ((to.z - from.z) * u) / L });
      const aL = lerp(t0);
      const bL = lerp(Math.min(L, t0 + seg));
      const a = worldOf(g.panel, aL.x, aL.y, aL.z);
      const b = worldOf(g.panel, bL.x, bL.y, bL.z);
      const fL = { ...aL };
      fL[faceA] += 1;
      const fw = worldOf(g.panel, fL.x, fL.y, fL.z);
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      instances.push({
        id: createId("sk"),
        catalogId: item.id,
        position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        cutLength: whole ? undefined : Math.round(len * 100) / 100,
        role: g.panel.type,
        join,
        from: a,
        to: b,
        face: { x: fw.x - a.x, y: fw.y - a.y, z: fw.z - a.z },
      });
    }
  };
  for (const g of grids) {
    const { thinA, midA, longA, thinN, midN, longN, perLayer, layers } = g;
    if (perLayer < 2 && layers < 2) continue;
    const ts = layers === 1 ? [thinN / 2] : [hThin, thinN - hThin];
    const vs = perLayer === 1 || midN <= 2 * hFace ? [midN / 2] : [hFace, midN - hFace];
    for (const along of longN > 4 * hFace ? [hFace, longN - hFace] : [longN / 2]) {
      const at = (mid: number, thin: number): Record<Ax, number> => {
        const r = { x: 0, y: 0, z: 0 } as Record<Ax, number>;
        r[longA] = along;
        r[midA] = mid;
        r[thinA] = thin;
        return r;
      };
      if (vs.length > 1) for (const t of ts) tie(g, at(vs[0], t), at(vs[1], t), thinA);
      if (ts.length > 1) for (const v of vs) tie(g, at(v, ts[0]), at(v, ts[1]), midA);
    }
  }

  const note = `Same ${project.name} in ${item.name}. Each face is the outline of that stock, not a solid tile.`;
  const notes = recastNotes(project.notes ?? [], item).filter((n) => !/^Same .+ in /.test(n) && !/^Named stock:/.test(n) && !/^Stock:/.test(n));
  const section = Math.max(prim.width, prim.height, item.dims.diameter ?? 0, 0.08);
  const bearing = project.panels.some((panel) => panel.type === "shelf" || panel.type === "deck" || panel.type === "top" || /shelf|seat|top/i.test(panel.name));
  if (bearing && section < 0.5) {
    notes.unshift(`This is a display model in ${item.name}. A shelf, seat, or top that holds needs ¾" plywood or 1× boards.`);
  }
  if (instances.length >= budget) {
    notes.unshift(`Stopped at ${budget} pieces so the bench can draw it. A solid tile of ${item.name} would be denser.`);
  }
  const big = Math.max(project.overall?.width ?? 0, project.overall?.height ?? 0, project.overall?.depth ?? 0) >= 30;
  if (big && instances.length >= 300 && item.category !== "lumber") {
    notes.unshift(
      `At full size this takes ${instances.length >= budget ? "over " : ""}${instances.length} pieces of ${item.name} — great as a model or a fun build. ` +
        `For a piece that holds weight every day, ¾" plywood or 1×12 boards build the same shape from the same cut list.`,
    );
  }
  return {
    ...project,
    panels: [],
    fitted: undefined,
    pocket: undefined,
    recastFrom: project.fitted || project.pocket ? { fitted: project.fitted, pocket: project.pocket } : project.recastFrom,
    instances,
    primaryMaterialId: item.id,
    notes: bearing && section < 0.5 ? notes : [note, ...notes],
  };
}

/**
 * Carcase notes after the faces are re-tiled in another stock: the sheet wording names the new stock,
 * and sheet-only advice (nesting, 2x2 legs on a sheet build, sheet edges) drops out.
 */
export function recastNotes(notes: string[], item: CatalogItem): string[] {
  const name = item.name;
  // Craft stock (sticks, dowels) names its own members: a 2×4 post is a laminated stick post, glued, not bolted.
  const craft = !isFaceStock(item) && item.category !== "lumber";
  const short = item.formFactor === "dowel" ? "dowel" : item.formFactor === "stick" ? "stick" : name;
  const craftMembers = (n: string) =>
    !craft
      ? n
      : n
          .replace(/\b(?:doubled\s+)?[1-4]\s*×\s*\d+(?=\s+[a-z])/gi, `laminated ${short}`)
          .replace(/[¾]\s*(?:"|″)?\s+(top|tops|seats?|shelf|shelves|deck)\b/g, `${short} $1`)
          .replace(/\s+with\s+(?:\d+\s+)?[^;,.]*?\b(?:bolts|screws)\b/gi, "")
          .replace(/\b(screw|glue) the (\w+) down through\b/g, "glue the $2 down onto")
          .replace(/\bGlue and screw\b/g, "Glue")
          .replace(/\bglue and screw\b/g, "glue")
          .replace(/\b(screw|bolt)(ed|s)?\b/gi, (_m, w: string, e?: string) => `${w[0] === w[0].toUpperCase() ? "G" : "g"}lue${e === "ed" ? "d" : e ?? ""}`)
          .replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, c: string) => a + c.toUpperCase());
  return notes
    .map((n) =>
      craftMembers(
        n
          .replace(/[¾]\s*(?:"|″)?\s*plywood|3\/4\s*(?:"|″|-inch|in\.?)\s*plywood/gi, name)
          .replace(/\bplywood (uprights|shelves|top|box|carcase|sides)\b/gi, `${name} $1`),
      ),
    )
    .filter((n) => !/\bnest(?:s|ed)?\b.*\bsheet\b|\bsheet\b.*\bnest|buy 2x2 lumber|edge band|plywood|4\s*[×x]\s*8\b|4\s*[×x]\s*10\b/i.test(n));
}

/**
 * Outline sticks from adjacent faces, and ends that stop short of a neighbour,
 * become one centreline with shared nodes. #286's joint test is an exact
 * 0.01" match, so the node has to be one point before that test runs.
 * A free end is kept only for a designed tip (an arm, a rung) or a foot.
 */
type OutlineSeg = {
  from: Vec3;
  to: Vec3;
  role: string;
  join?: string;
  catalogId: string;
  face?: Vec3;
  whole: boolean;
};

function vsub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function vadd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function vmul(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function vdot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function vlen(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}
function vdist(a: Vec3, b: Vec3): number {
  return vlen(vsub(a, b));
}
function vnorm(a: Vec3): Vec3 {
  const L = vlen(a) || 1;
  return vmul(a, 1 / L);
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function r3(p: Vec3): Vec3 {
  return { x: r2(p.x), y: r2(p.y), z: r2(p.z) };
}
function nodeKey(p: Vec3): string {
  return `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
}
function closestPoint(p: Vec3, a: Vec3, b: Vec3): { d: number; q: Vec3; t: number } {
  const ab = vsub(b, a);
  const L2 = vdot(ab, ab);
  if (L2 < 1e-8) return { d: vdist(p, a), q: a, t: 0 };
  const t = Math.max(0, Math.min(1, vdot(vsub(p, a), ab) / L2));
  const q = vadd(a, vmul(ab, t));
  return { d: vdist(p, q), q, t };
}

function outsideDiameter(item: CatalogItem): number {
  const d = item.dims;
  return Math.max(d.diameter ?? 0, d.width ?? 0, d.thickness ?? 0, d.height ?? 0, 0.08);
}

const DESIGNED_TIP = /\b(?:arm|rung|wing|tine|ear|finial|prong|tail|horn|antler|hook|peg)\b/i;

function mergeParallel(segs: OutlineSeg[], tol: number): OutlineSeg[] {
  const n = segs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const dirs = segs.map((s) => vnorm(vsub(s.to, s.from)));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(vdot(dirs[i], dirs[j])) < 0.985) continue;
      const mid = vmul(vadd(segs[j].from, segs[j].to), 0.5);
      const rel = vsub(mid, segs[i].from);
      const along = vdot(rel, dirs[i]);
      const pd = vdist(mid, vadd(segs[i].from, vmul(dirs[i], along)));
      if (pd > tol) continue;
      const proj = (p: Vec3) => vdot(p, dirs[i]);
      const a0 = Math.min(proj(segs[i].from), proj(segs[i].to));
      const a1 = Math.max(proj(segs[i].from), proj(segs[i].to));
      const b0 = Math.min(proj(segs[j].from), proj(segs[j].to));
      const b1 = Math.max(proj(segs[j].from), proj(segs[j].to));
      const ov = Math.min(a1, b1) - Math.max(a0, b0);
      const shorter = Math.min(vdist(segs[i].from, segs[i].to), vdist(segs[j].from, segs[j].to));
      if (pd > 0.5 ? ov < shorter * 0.55 : ov < 0.5) continue;
      parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, OutlineSeg[]>();
  segs.forEach((s, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), s]);
  });
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const dir = vnorm(vsub(group[0].to, group[0].from));
    const origin = group[0].from;
    let acc = { x: 0, y: 0, z: 0 };
    let k = 0;
    let tMin = Infinity;
    let tMax = -Infinity;
    for (const s of group) {
      for (const p of [s.from, s.to]) {
        const rel = vsub(p, origin);
        const t = vdot(rel, dir);
        tMin = Math.min(tMin, t);
        tMax = Math.max(tMax, t);
        acc = vadd(acc, vsub(rel, vmul(dir, t)));
        k++;
      }
    }
    const shift = vmul(acc, 1 / Math.max(k, 1));
    const longest = group.slice().sort((a, b) => vdist(b.from, b.to) - vdist(a.from, a.to))[0];
    return {
      ...longest,
      from: r3(vadd(vadd(origin, vmul(dir, tMin)), shift)),
      to: r3(vadd(vadd(origin, vmul(dir, tMax)), shift)),
    };
  });
}

function weldNearEnds(segs: OutlineSeg[], tol: number): OutlineSeg[] {
  const ends: { s: number; e: 0 | 1; p: Vec3 }[] = [];
  segs.forEach((s, i) => {
    ends.push({ s: i, e: 0, p: s.from });
    ends.push({ s: i, e: 1, p: s.to });
  });
  const parent = ends.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      if (vdist(ends[i].p, ends[j].p) <= tol) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, number[]>();
  ends.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  const out = segs.map((s) => ({ ...s, from: { ...s.from }, to: { ...s.to } }));
  for (const idxs of groups.values()) {
    const c = idxs.reduce((a, i) => vadd(a, ends[i].p), { x: 0, y: 0, z: 0 });
    const node = r3(vmul(c, 1 / idxs.length));
    for (const i of idxs) {
      const { s, e } = ends[i];
      if (e === 0) out[s].from = node;
      else out[s].to = node;
    }
  }
  return out;
}

function splitSeg(seg: OutlineSeg, points: Vec3[]): OutlineSeg[] {
  const axis = vsub(seg.to, seg.from);
  const L = vlen(axis) || 1;
  const d = vmul(axis, 1 / L);
  const marks: { t: number; p: Vec3 }[] = [
    { t: 0, p: seg.from },
    { t: L, p: seg.to },
  ];
  for (const p of points) {
    const t = vdot(vsub(p, seg.from), d);
    if (t > 0.15 && t < L - 0.15) marks.push({ t, p });
  }
  marks.sort((a, b) => a.t - b.t);
  const uniq: { t: number; p: Vec3 }[] = [];
  for (const m of marks) if (!uniq.length || m.t - uniq[uniq.length - 1].t > 0.12) uniq.push(m);
  const pieces: OutlineSeg[] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const from = r3(uniq[i].p);
    const to = r3(uniq[i + 1].p);
    if (vdist(from, to) < 0.15) continue;
    pieces.push({ ...seg, from, to });
  }
  return pieces.length ? pieces : [{ ...seg, from: r3(seg.from), to: r3(seg.to) }];
}

function segmentClosest(a: OutlineSeg, b: OutlineSeg): { d: number; ti: number; tj: number; qi: Vec3; qj: Vec3 } | null {
  const u = vsub(a.to, a.from);
  const v = vsub(b.to, b.from);
  const w0 = vsub(a.from, b.from);
  const A = vdot(u, u);
  const B = vdot(u, v);
  const C = vdot(v, v);
  const D = vdot(u, w0);
  const E = vdot(v, w0);
  const den = A * C - B * B;
  if (A < 1e-8 || C < 1e-8 || Math.abs(den) < 1e-6) return null;
  const ti = Math.max(0, Math.min(1, (B * E - C * D) / den));
  const tj = Math.max(0, Math.min(1, (A * E - B * D) / den));
  const qi = vadd(a.from, vmul(u, ti));
  const qj = vadd(b.from, vmul(v, tj));
  return { d: vdist(qi, qj), ti, tj, qi, qj };
}

function fuseCollinear(segs: OutlineSeg[], limit: number): OutlineSeg[] {
  let cur = segs.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const at = new Map<string, number[]>();
    cur.forEach((s, i) => {
      for (const p of [s.from, s.to]) {
        const k = nodeKey(p);
        at.set(k, [...(at.get(k) ?? []), i]);
      }
    });
    for (const idxs of at.values()) {
      const uniq = [...new Set(idxs)];
      if (uniq.length < 2) continue;
      const pieces = uniq.map((i) => ({ i, s: cur[i], d: vnorm(vsub(cur[i].to, cur[i].from)) }));
      const seed = pieces.slice().sort((a, b) => vdist(b.s.from, b.s.to) - vdist(a.s.from, a.s.to))[0];
      const bundle = pieces.filter((p) => Math.abs(vdot(p.d, seed.d)) > 0.82);
      const shorts = bundle.filter((p) => p !== seed && vdist(p.s.from, p.s.to) <= limit);
      if (!shorts.length || vdist(seed.s.from, seed.s.to) <= limit) continue;
      const origin = seed.s.from;
      let tMin = vdot(vsub(seed.s.from, origin), seed.d);
      let tMax = vdot(vsub(seed.s.to, origin), seed.d);
      let fromP = seed.s.from;
      let toP = seed.s.to;
      if (tMin > tMax) {
        const swap = tMin;
        tMin = tMax;
        tMax = swap;
        fromP = seed.s.to;
        toP = seed.s.from;
      }
      for (const p of shorts) {
        for (const q of [p.s.from, p.s.to]) {
          const t = vdot(vsub(q, origin), seed.d);
          if (t < tMin) {
            tMin = t;
            fromP = q;
          }
          if (t > tMax) {
            tMax = t;
            toP = q;
          }
        }
      }
      if (vdist(fromP, toP) < 0.15) continue;
      const drop = new Set(shorts.map((p) => p.i));
      cur = cur.filter((_, i) => !drop.has(i));
      const host = cur.findIndex((s) => s === seed.s);
      if (host >= 0) cur[host] = { ...seed.s, from: fromP, to: toP };
      changed = true;
      break;
    }
  }
  return cur;
}

/** A 3/4" fitting body, centre to face. A cap inside this of another pipe is a clash. */
const FITTING_BODY = 1.375;

/**
 * An end that sits within a fitting body of another pipe moves onto that pipe.
 * Two pipes that pass within one pipe width, and do not already meet, get a shared node.
 * Seating can lengthen a member. It will not shorten a designed tip, and it will not leave a member under the fitting pitch.
 */
function seatTouching(segs: OutlineSeg[], od: number): OutlineSeg[] {
  let cur = segs.map((s) => ({ ...s, from: { ...s.from }, to: { ...s.to } }));
  const mayMove = (oldL: number, newL: number) => {
    if (newL < 0.2) return false;
    if (newL >= oldL - 0.05) return true;
    return newL >= FITTING_PITCH - 0.01;
  };
  const owns = (seg: OutlineSeg, p: Vec3) => vdist(seg.from, p) <= 0.05 || vdist(seg.to, p) <= 0.05;
  for (let pass = 0; pass < 4; pass++) {
    const cuts: Vec3[][] = cur.map(() => []);
    let moved = false;
    const seen = new Set<string>();
    for (let i = 0; i < cur.length; i++) {
      for (const end of [0, 1] as const) {
        const p = end === 0 ? cur[i].from : cur[i].to;
        const key = nodeKey(p);
        if (seen.has(key)) continue;
        seen.add(key);
        let best: { d: number; q: Vec3; t: number; j: number } | null = null;
        for (let j = 0; j < cur.length; j++) {
          if (owns(cur[j], p)) continue;
          const hit = closestPoint(p, cur[j].from, cur[j].to);
          const search = DESIGNED_TIP.test(cur[i].role) ? 2.25 : FITTING_BODY;
          if (hit.d <= search && (!best || hit.d < best.d)) best = { ...hit, j };
        }
        if (!best) continue;
        const host = cur[best.j];
        const L = vdist(host.from, host.to);
        const along = best.t * L;
        const ontoEnd = along <= 0.2 || L - along <= 0.2;
        // A cap may reach a fitting body away. A joint that already has pipes only reaches one pipe width.
        const shared = cur.some((seg, idx) => idx !== i && owns(seg, p));
        // A peg or a hook is glued into the rail. Its root may reach that rail; the proud tip is farther than this and stays a cap.
        const reach = !shared && DESIGNED_TIP.test(cur[i].role) ? 2.25 : FITTING_BODY;
        if (shared && best.d > od) continue;
        if (!shared && best.d > reach) continue;
        const dest = ontoEnd ? (along <= 0.2 ? host.from : host.to) : best.q;
        if (vdist(p, dest) <= 0.05) {
          if (!ontoEnd) cuts[best.j].push(r3(dest));
          continue;
        }
        const partners: { i: number; end: 0 | 1 }[] = [];
        let ok = true;
        for (let j = 0; j < cur.length; j++) {
          for (const e of [0, 1] as const) {
            const q = e === 0 ? cur[j].from : cur[j].to;
            if (vdist(q, p) > 0.05) continue;
            const other = e === 0 ? cur[j].to : cur[j].from;
            if (!mayMove(vdist(q, other), vdist(dest, other))) ok = false;
            partners.push({ i: j, end: e });
          }
        }
        if (!ok || !partners.length) continue;
        const at = r3(dest);
        for (const partner of partners) {
          if (partner.end === 0) cur[partner.i].from = at;
          else cur[partner.i].to = at;
        }
        moved = true;
        if (!ontoEnd) cuts[best.j].push(at);
      }
    }
    for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        const hit = segmentClosest(cur[i], cur[j]);
        if (!hit || hit.d > od || hit.d <= 0.02) continue;
        const Li = vdist(cur[i].from, cur[i].to);
        const Lj = vdist(cur[j].from, cur[j].to);
        const ai = hit.ti * Li;
        const aj = hit.tj * Lj;
        if (Math.max(ai, Li - ai) < FITTING_PITCH || Math.max(aj, Lj - aj) < FITTING_PITCH) continue;
        if (ai < 0.2 || Li - ai < 0.2 || aj < 0.2 || Lj - aj < 0.2) continue;
        const node = r3(vmul(vadd(hit.qi, hit.qj), 0.5));
        cuts[i].push(node);
        cuts[j].push(node);
        moved = true;
      }
    }
    if (!moved && cuts.every((c) => c.length === 0)) break;
    cur = cur.flatMap((seg, i) => splitSeg(seg, cuts[i]));
    cur = weldNearEnds(cur, 0.08);
    cur = mergeParallel(cur, od);
    cur = cur.filter((s) => vdist(s.from, s.to) >= FITTING_PITCH);
  }
  return cur;
}

function weldOutline(instances: YardInstance[], item: CatalogItem): YardInstance[] {
  // Slip stock is what the joint test buys fittings for. A dowel or a craft stick
  // stays on the outline it already had: a 2" snap there pulls rods together and
  // lifts a floor off its posts.
  if (item.formFactor !== "pipe" && item.formFactor !== "tube") return instances;
  const kept = instances.filter((inst) => !inst.from || !inst.to);
  const od = outsideDiameter(item);
  // Pipe faces sit about 2" apart where two outlines meet. Thinner stock (a dowel, a craft
  // stick) uses its own diameter, so neighbouring rods are not pulled into one node.
  const snapTol = od >= 0.75 ? Math.max(od, FITTING_BODY) : od;
  let segs: OutlineSeg[] = instances.filter((inst) => inst.from && inst.to).map((inst) => ({
    from: { ...inst.from! },
    to: { ...inst.to! },
    role: inst.role ?? "member",
    join: inst.join,
    catalogId: inst.catalogId,
    face: inst.face,
    whole: inst.cutLength == null,
  }));
  if (segs.length < 2) return instances;
  segs = mergeParallel(segs, od);
  const home = segs.map((s) => ({ from: { ...s.from }, to: { ...s.to } }));
  const clampEnd = (p: Vec3, origin: Vec3): Vec3 => {
    const moved = vdist(p, origin);
    if (moved <= snapTol) return p;
    return vadd(origin, vmul(vnorm(vsub(p, origin)), snapTol));
  };
  const crossing = (a: OutlineSeg, b: OutlineSeg) => Math.abs(vdot(vnorm(vsub(a.to, a.from)), vnorm(vsub(b.to, b.from)))) < 0.85;
  const slide = (full: boolean) => {
    const targets: [Vec3 | null, Vec3 | null][] = segs.map(() => [null, null]);
    for (let i = 0; i < segs.length; i++) {
      for (const end of [0, 1] as const) {
        const p = end === 0 ? segs[i].from : segs[i].to;
        let best: { d: number; q: Vec3; j: number } | null = null;
        for (let j = 0; j < segs.length; j++) {
          if (i === j || !crossing(segs[i], segs[j])) continue;
          const hit = closestPoint(p, segs[j].from, segs[j].to);
          if (hit.d <= snapTol + 1e-6 && (!best || hit.d < best.d)) best = { ...hit, j };
        }
        if (!best || best.d <= 0.005) continue;
        if (full) {
          targets[i][end] = best.q;
          continue;
        }
        const other = segs[best.j];
        const ep = vdist(best.q, other.from) <= vdist(best.q, other.to) ? other.from : other.to;
        const atEnd = vdist(best.q, ep) <= Math.max(od, 0.75);
        targets[i][end] = atEnd ? vmul(vadd(p, ep), 0.5) : best.q;
      }
    }
    segs = segs.map((seg, i) => {
      let from = targets[i][0] ?? seg.from;
      let to = targets[i][1] ?? seg.to;
      from = clampEnd(from, home[i].from);
      to = clampEnd(to, home[i].to);
      if (vdist(from, to) < 0.15) return seg;
      return { ...seg, from, to };
    });
  };
  for (let pass = 0; pass < 4; pass++) slide(false);
  slide(true);
  segs = weldNearEnds(segs, 0.08);
  const cuts: Vec3[][] = segs.map(() => []);
  for (let i = 0; i < segs.length; i++) {
    for (let j = 0; j < segs.length; j++) {
      if (i === j || !crossing(segs[i], segs[j])) continue;
      const limit = 0.08;
      for (const p of [segs[j].from, segs[j].to]) {
        const hit = closestPoint(p, segs[i].from, segs[i].to);
        const L = vdist(segs[i].from, segs[i].to);
        const along = hit.t * L;
        if (hit.d <= limit && along > 0.2 && along < L - 0.2) cuts[i].push(p);
      }
    }
  }
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (!crossing(segs[i], segs[j])) continue;
      const hit = segmentClosest(segs[i], segs[j]);
      if (!hit || hit.d > Math.min(od, 0.75)) continue;
      const Li = vdist(segs[i].from, segs[i].to);
      const Lj = vdist(segs[j].from, segs[j].to);
      if (hit.ti * Li > 0.2 && hit.ti * Li < Li - 0.2 && hit.tj * Lj > 0.2 && hit.tj * Lj < Lj - 0.2) {
        const node = r3(vmul(vadd(hit.qi, hit.qj), 0.5));
        cuts[i].push(node);
        cuts[j].push(node);
      }
    }
  }
  let out: OutlineSeg[] = [];
  segs.forEach((seg, i) => out.push(...splitSeg(seg, cuts[i])));
  out = weldNearEnds(out, 0.08);
  out = fuseCollinear(out, FITTING_PITCH);
  out = seatTouching(out, od);
  out = out.filter((s) => {
    const L = vdist(s.from, s.to);
    if (L < 0.2) return false;
    // A fitting needs about 2.75" of pipe between nodes. A shorter scrap cannot hold one.
    if (L < FITTING_PITCH) return false;
    return true;
  });
  const welded = out.map((s) => {
    const L = vdist(s.from, s.to);
    return {
      id: createId("sk"),
      catalogId: s.catalogId,
      position: { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2, z: (s.from.z + s.to.z) / 2 },
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: s.whole ? undefined : r2(L),
      role: s.role,
      join: s.join,
      from: s.from,
      to: s.to,
      face: s.face,
    } satisfies YardInstance;
  });
  return [...welded, ...kept];
}
