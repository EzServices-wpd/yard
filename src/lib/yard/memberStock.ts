/**
 * Any catalog unit can be a member of a form.
 * A sheet is not a 48" thick stick — it is ripped into battens.
 * A brick, a toothpick, and a 2×4 are already members.
 * Buy still names the unit you purchase (the sheet, the brick pack).
 */
import { createId } from "@/lib/utils";
import { isWholeStock, toPrimitive } from "./geometry";
import type { CatalogItem, Panel, Vec3, YardInstance, YardProject } from "./types";

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
 * A rack keeps its tiers only in sheet or board stock.
 * Pipe, round, and stick stock are cut lengths — an open frame, not sheet panels.
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

export function recastPanelsAsStock(project: YardProject, item: CatalogItem): YardProject {
  if (!project.panels.length) return project;
  const rack = /\bracks?\b/.test((project.prompt ?? "").toLowerCase()) && !/rail|peg|hook/.test((project.prompt ?? "").toLowerCase());
  if (rack && !isFaceStock(item)) return openMemberRack(project, item);
  if (rack) {
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
    const nAcross = bearing
      ? Math.max(3, Math.min(8, Math.round(midN / Math.max(section * 1.5, 1))))
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
      role: panel.type,
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
