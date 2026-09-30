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
export function recastPanelsAsStock(project: YardProject, item: CatalogItem): YardProject {
  if (!project.panels.length) return project;
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
  };

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
    const nAcross = Math.max(1, Math.round(midN / Math.max(pitch, 0.08)));
    const usable = whole ? Math.max(stockL * 0.86, stockL - 0.25) : Math.max(stockL * 0.9, 0.5);
    const cover = whole ? stockL : Math.min(stockL, longN);
    const nAlong = longN <= cover * 1.02 ? 1 : Math.max(1, Math.ceil(longN / usable));
    const stepAlong = nAlong === 1 ? 0 : Math.max(0.15, (longN - cover) / (nAlong - 1));
    grids.push({ panel, thinA, midA, longA, thinN, midN, longN, nAcross, nAlong, cover, stepAlong });
  }

  const place = (g: Grid, i: number, s: number) => {
    const { panel, thinA, midA, longA, thinN, midN, longN, nAcross, nAlong, cover, stepAlong } = g;
    const v = nAcross === 1 ? midN / 2 : (i + 0.5) * (midN / nAcross);
    const start = nAlong === 1 ? Math.max(0, (longN - cover) / 2) : Math.min(s * stepAlong, Math.max(0, longN - cover));
    const aL: Record<Ax, number> = { x: thinN / 2, y: thinN / 2, z: thinN / 2 };
    const bL: Record<Ax, number> = { x: thinN / 2, y: thinN / 2, z: thinN / 2 };
    aL[longA] = start;
    bL[longA] = start + cover;
    aL[midA] = Math.min(midN, Math.max(0, v));
    bL[midA] = aL[midA];
    aL[thinA] = thinN / 2;
    bL[thinA] = thinN / 2;
    const a = worldOf(panel, aL.x, aL.y, aL.z);
    const b = worldOf(panel, bL.x, bL.y, bL.z);
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.15) return;
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

  const note = `Same ${project.name} in ${item.name}. Each face is that stock.`;
  const notes = (project.notes ?? []).filter((n) => !/^Same .+ in /.test(n) && !/^Named stock:/.test(n) && !/^Stock:/.test(n));
  if (instances.length >= budget) {
    notes.unshift(`Stopped at ${budget} pieces so the bench can draw it. A solid tile of ${item.name} would be denser.`);
  }
  return {
    ...project,
    panels: [],
    fitted: undefined,
    pocket: undefined,
    instances,
    primaryMaterialId: item.id,
    notes: [note, ...notes],
  };
}