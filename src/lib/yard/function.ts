/**
 * The job of the thing, not just its silhouette.
 * A bridge gets a road you can walk. An arch keeps a portal you can pass.
 * Load is inferred from stock + size; a person does not stand on popsicle.
 *
 * Single-stock rule (hard):
 *   When the primary material is craft-scale (sticks, straws, toothpicks,
 *   thin tubes, paper cores, recycled cylinders), the entire model — including
 *   any deck / road / working surface — is built from that stock only.
 *   The only extra items on the Buy list are the recommended joiners
 *   (glue, tape, solvent, etc.). No foreign cardboard, foam, or plywood is
 *   injected. Sheet decks appear only when the primary is already sheet/board/
 *   lumber scale.
 */
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { pyramidDoorDims } from "./lattice";
import type {
  CatalogItem,
  FeasibilityIssue,
  LoadUse,
  Panel,
  TraversePath,
  Vec3,
  YardInstance,
  YardProject,
} from "./types";

/**
 * Craft / single-stock materials: everything stays on this stock.
 * Joiners (glue/tape/solvent) still come from binderBom.
 */
export function isSingleStockCraft(item: CatalogItem): boolean {
  if (item.formFactor === "sheet" || item.formFactor === "board") return false;
  if (item.category === "lumber" || item.category === "sheet_goods") return false;
  if (item.category === "pvc_plumbing" || item.formFactor === "pipe") {
    return (item.dims.diameter ?? 1) < 0.55;
  }
  return (
    item.category === "craft_wood" ||
    item.category === "plastic" ||
    item.category === "paper_tube" ||
    item.category === "recycled" ||
    item.category === "foam" ||
    item.formFactor === "stick" ||
    item.formFactor === "tube" ||
    item.formFactor === "dowel" ||
    item.formFactor === "block" ||
    ((item.dims.diameter ?? 1) < 0.5 && item.formFactor !== "pipe")
  );
}

/**
 * Deck sheet only when the primary stock is already sheet/board/lumber scale.
 * Single-stock craft queries stay pure — road is densified as primary members.
 */
export function deckStockFor(item: CatalogItem): CatalogItem | null {
  if (isSingleStockCraft(item)) return null;
  if (item.formFactor === "sheet") return item;
  if (item.category === "lumber" || item.category === "sheet_goods" || item.formFactor === "board") {
    return getCatalogItem("plywood-3-4-4x8") ?? item;
  }
  if (item.category === "foam") return getCatalogItem("foam-board-20x30") ?? item;
  if (item.formFactor === "pipe" || item.category === "pvc_plumbing") {
    if ((item.dims.diameter ?? 1) >= 0.75) return getCatalogItem("foam-board-20x30") ?? item;
    return null;
  }
  return null;
}

export function inferLoadUse(project: YardProject): LoadUse {
  const item = getCatalogItem(project.primaryMaterialId);
  const t = project.traverse;
  const deckW = t?.width ?? 0;
  const clear = t?.clearH ?? 0;
  const craft =
    !item ||
    isSingleStockCraft(item) ||
    item.category === "craft_wood" ||
    item.category === "plastic" ||
    item.formFactor === "stick" ||
    (item.formFactor === "tube" && (item.dims.diameter ?? 1) < 0.4);
  if (craft) return "display";
  const pipe = item.formFactor === "pipe" || item.category === "pvc_plumbing";
  if (t?.kind === "portal") {
    if (clear >= 60 && deckW >= 28 && (pipe || item.category === "lumber" || item.category === "sheet_goods")) {
      return "person";
    }
    if (clear >= 24 && deckW >= 16) return "toy";
    return "display";
  }
  if (deckW >= 24 && clear >= 36 && (item.category === "lumber" || item.category === "sheet_goods")) {
    return "person";
  }
  if (pipe && clear >= 60) return "person";
  return "toy";
}

export function loadIssues(project: YardProject): FeasibilityIssue[] {
  const t = project.traverse;
  if (!t || t.kind === "around") return [];
  const issues: FeasibilityIssue[] = [];
  const use = project.assumptions.use ?? inferLoadUse(project);
  const item = getCatalogItem(project.primaryMaterialId);
  const deck = project.panels.find((p) => p.type === "deck");
  const deckItem = deck ? getCatalogItem(deck.materialId) : undefined;

  if (use === "display") {
    issues.push({
      severity: "info",
      message: `Display load — ${item?.name ?? "this stock"} will not carry a person.`,
      suggestion: "Walk the road on the bench. A toy can roll it. Do not stand on it.",
    });
  } else if (use === "toy") {
    issues.push({
      severity: "info",
      message:
        t.kind === "portal"
          ? "Toy load — a kid or a figure can pass. Not a stamped doorway."
          : "Toy load — a car or figure can cross. Not a person.",
      suggestion: deckItem
        ? `Road is ${deckItem.name}. Keep the live load under a couple of pounds.`
        : t.kind === "portal"
          ? "Widen the prompt if you want a person-scale opening."
          : "Deck is the same stock as the frame when craft-scale.",
    });
  } else if (item && (item.formFactor === "stick" || item.category === "craft_wood" || item.category === "plastic")) {
    issues.push({
      severity: "critical",
      message: "This stock cannot carry a person.",
      suggestion: "Switch to lumber or plywood, or treat it as a display model.",
    });
  } else {
    issues.push({
      severity: "warning",
      message: "Person load — heuristic only, not stamped engineering.",
      suggestion: "Yard sizes the deck. A PE stamps the span tables for your species and grade.",
    });
  }

  if (t.width < 2.4) {
    issues.push({
      severity: "warning",
      message:
        t.kind === "portal"
          ? `Opening is only ${t.width.toFixed(1)}" wide.`
          : `Road is only ${t.width.toFixed(1)}" wide.`,
      suggestion:
        t.kind === "portal"
          ? "Widen the prompt or pick thicker stock if you want a doorway you can actually use."
          : "Widen the prompt or pick thicker stock if you want a lane you can actually use.",
    });
  }

  if (deck && deckItem) {
    const thick = deckItem.dims.thickness ?? deck.size.height;
    const gap = hangerSpacing(project);
    const limit = Math.max(thick * 48, 6);
    if (gap > limit + 2) {
      issues.push({
        severity: "warning",
        message: `Deck spans ~${gap.toFixed(1)}" between supports on ${thick}" stock.`,
        suggestion: "Closer hangers or a thicker sheet keep the road from sagging.",
      });
    }
  }
  return issues;
}

function hangerSpacing(project: YardProject): number {
  const xs = project.instances
    .filter((i) => i.role === "brace" && i.from && i.to)
    .map((i) => (i.from!.x + i.to!.x) / 2);
  if (xs.length < 2) return project.traverse?.length ?? project.overall.width;
  xs.sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < xs.length; i++) max = Math.max(max, xs[i] - xs[i - 1]);
  return max || 8;
}

export function attachFunction(project: YardProject): YardProject {
  if (project.kind === "bridge") return withBridgeDeck(project);
  if (project.kind === "arch") return withArchPortal(project);
  if (project.kind === "pyramid") return withPyramidTomb(project);
  return withGroundWalk(project);
}

function bbox(instances: YardInstance[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const i of instances) {
    if (i.from && i.to) {
      xs.push(i.from.x, i.to.x);
      ys.push(i.from.y, i.to.y);
      zs.push(i.from.z, i.to.z);
    } else {
      xs.push(i.position.x);
      ys.push(i.position.y);
      zs.push(i.position.z);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function member(from: Vec3, to: Vec3, catalogId: string, role: string, join: string, whole = false): YardInstance {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    id: createId("fn"),
    catalogId,
    position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
    rotation: { x: 0, y: Math.atan2(dx, dz), z: 0 },
    cutLength: whole ? undefined : len,
    role,
    join,
    from,
    to,
  };
}

function runMembers(from: Vec3, to: Vec3, item: CatalogItem, role: string, join: string): YardInstance[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  if (!isWholeStock(item)) return [member(from, to, item.id, role, join)];
  const stock = toPrimitive(item).length;
  const ux = dx / (length || 1);
  const uy = dy / (length || 1);
  const uz = dz / (length || 1);
  const along = (origin: Vec3, t: number): Vec3 => ({
    x: origin.x + ux * t,
    y: origin.y + uy * t,
    z: origin.z + uz * t,
  });
  if (length < stock * 0.4) return [];
  if (length <= stock * 1.08) {
    const extra = (stock - length) / 2;
    return [member(along(from, -extra), along(from, stock - extra), item.id, role, join, true)];
  }
  const n = Math.max(2, Math.ceil(length / stock));
  const step = (length - stock) / (n - 1);
  const out: YardInstance[] = [];
  for (let s = 0; s < n; s++) {
    const a = along(from, s * step);
    out.push(member(a, along(a, stock), item.id, role, join, true));
  }
  return out;
}

function withBridgeDeck(project: YardProject): YardProject {
  const item = getCatalogItem(project.primaryMaterialId);
  const craft = item ? isSingleStockCraft(item) : false;
  let panels = project.panels;
  if (craft) {
    panels = project.panels.filter((p) => {
      if (p.type !== "deck") return true;
      return p.materialId === project.primaryMaterialId;
    });
  }
  if (panels.some((p) => p.type === "deck")) {
    return panels === project.panels ? project : { ...project, panels };
  }
  if (!item || !project.instances.length) return project;

  const box = bbox(project.instances);
  const rails = project.instances.filter((i) => i.role === "rail");
  const deckY = rails.length ? median(rails.map((i) => i.position.y)) : box.minY + (box.maxY - box.minY) * 0.32;
  const span = box.maxX - box.minX;
  const depth = Math.max(box.maxZ - box.minZ, 4);
  const z0 = box.minZ;
  const z1 = box.maxZ;
  const roadW = Math.max(depth * 0.88, 3.2);
  const sheet = craft ? null : deckStockFor(item);
  const join = project.joinMethod ?? item.preferredJoins?.[0] ?? "glue";
  const portalH = Math.max(2.2, (box.maxY - deckY) * 0.22);

  if (!sheet) {
    const deckTop = deckY;
    const extras: YardInstance[] = [];
    const stockLen = Math.max(item.dims.length ?? 4.5, 2.5);
    const ties = Math.max(6, Math.min(20, Math.round(span / Math.max(stockLen * 0.85, 2.2))));
    for (let i = 0; i <= ties; i++) {
      const x = box.minX + (span * i) / ties;
      extras.push(
        ...runMembers({ x, y: deckTop, z: z0 }, { x, y: deckTop, z: z1 }, item, "rail", join),
      );
    }
    for (const z of [z0 + depth * 0.12, (z0 + z1) / 2, z1 - depth * 0.12]) {
      extras.push(
        ...runMembers({ x: box.minX, y: deckTop, z }, { x: box.maxX, y: deckTop, z }, item, "rail", join),
      );
    }
    const railH = Math.max(0.7, Math.min(1.8, portalH * 0.45, depth * 0.25));
    const posts = Math.max(5, Math.min(16, Math.round(span / Math.max(stockLen * 0.9, 2.8))));
    for (const z of [z0, z1]) {
      extras.push(
        ...runMembers({ x: box.minX, y: deckTop + railH, z }, { x: box.maxX, y: deckTop + railH, z }, item, "brace", join),
      );
      for (let i = 0; i <= posts; i++) {
        const x = box.minX + (span * i) / posts;
        extras.push(
          ...runMembers({ x, y: deckTop, z }, { x, y: deckTop + railH, z }, item, "brace", join),
        );
      }
    }
    const traverse: TraversePath = {
      kind: "deck",
      origin: { x: box.minX + 1.2, y: deckTop, z: 0 },
      axis: { x: 1, y: 0, z: 0 },
      length: Math.max(span - 2.4, 8),
      width: roadW,
      y: deckTop,
      eyeH: Math.max(0.75, Math.min(1.35, portalH * 0.4)),
      clearH: portalH,
    };
    const use = inferLoadUse({ ...project, traverse });
    return {
      ...project,
      panels,
      instances: withHome([...project.instances, ...extras]),
      traverse,
      notes: [
        ...project.notes,
        `Road: same ${item.name} as the truss — cross-ties + runners, no foreign sheet.`,
        "Single-stock build. Only the joiner (tape / glue) is extra on the Buy list.",
        "Walk the deck (Walk on the bench).",
      ],
      assumptions: {
        ...project.assumptions,
        use,
        load: use === "person" ? "heavy" : use === "toy" ? "medium" : "light",
      },
    };
  }

  const thick = Math.max(sheet.dims.thickness ?? 0.15, 0.12);
  const deckTop = deckY + thick;

  const panel: Panel = {
    id: createId("deck"),
    type: "deck",
    name: "Road deck",
    position: { x: box.minX, y: deckY, z: (z0 + z1) / 2 - roadW / 2 },
    size: { width: span, height: thick, depth: roadW },
    materialId: sheet.id,
  };

  const railH = Math.max(0.9, Math.min(2.2, portalH * 0.55, depth * 0.28));
  const posts = Math.max(4, Math.min(14, Math.round(span / Math.max(item.dims.length ?? 4.5, 3))));
  const extras: YardInstance[] = [];
  for (const z of [z0, z1]) {
    extras.push(
      ...runMembers({ x: box.minX, y: deckTop + railH, z }, { x: box.maxX, y: deckTop + railH, z }, item, "brace", join),
    );
    for (let i = 0; i <= posts; i++) {
      const x = box.minX + (span * i) / posts;
      extras.push(
        ...runMembers({ x, y: deckTop, z }, { x, y: deckTop + railH, z }, item, "brace", join),
      );
    }
  }

  const traverse: TraversePath = {
    kind: "deck",
    origin: { x: box.minX + 1.2, y: deckTop, z: 0 },
    axis: { x: 1, y: 0, z: 0 },
    length: Math.max(span - 2.4, 8),
    width: roadW,
    y: deckTop,
    eyeH: Math.max(0.75, Math.min(1.35, portalH * 0.4)),
    clearH: portalH,
  };

  const use = inferLoadUse({ ...project, traverse, panels: [...panels, panel] });
  const notes = [
    ...project.notes,
    `Road: ${sheet.name} · ${span.toFixed(0)}" × ${roadW.toFixed(1)}" · ${use} load.`,
    "Walk the deck (Walk on the bench). Frame hides the road; Full and Fill show the thing in use.",
  ];

  return {
    ...project,
    instances: withHome([...project.instances, ...extras]),
    panels: [...panels, panel],
    traverse,
    notes,
    assumptions: { ...project.assumptions, use, load: use === "person" ? "heavy" : use === "toy" ? "medium" : "light" },
  };
}

function withArchPortal(project: YardProject): YardProject {
  if (project.traverse) return project;
  if (!project.instances.length) return project;
  const box = bbox(project.instances);
  const spanX = box.maxX - box.minX;
  const spanZ = box.maxZ - box.minZ;
  const alongZ = spanX >= spanZ;
  const stand = Math.max(2.8, (alongZ ? spanZ : spanX) * 0.12, (box.maxY - box.minY) * 0.08);
  const traverse: TraversePath = alongZ
    ? {
        kind: "portal",
        origin: { x: (box.minX + box.maxX) / 2, y: 0.45, z: box.minZ - stand },
        axis: { x: 0, y: 0, z: 1 },
        length: spanZ + stand * 2,
        width: Math.max(spanX * 0.78, 18),
        y: 0.45,
        eyeH: Math.max(1.2, Math.min(5, (box.maxY - box.minY) * 0.18)),
        clearH: (box.maxY - box.minY) * 0.85,
      }
    : {
        kind: "portal",
        origin: { x: box.minX - stand, y: 0.45, z: (box.minZ + box.maxZ) / 2 },
        axis: { x: 1, y: 0, z: 0 },
        length: spanX + stand * 2,
        width: Math.max(spanZ * 0.78, 18),
        y: 0.45,
        eyeH: Math.max(1.2, Math.min(5, (box.maxY - box.minY) * 0.18)),
        clearH: (box.maxY - box.minY) * 0.85,
      };
  return {
    ...project,
    traverse,
    notes: [...project.notes, "Portal is clear — Walk through it on the bench."],
    assumptions: { ...project.assumptions, use: inferLoadUse({ ...project, traverse }) },
  };
}

function withGroundWalk(project: YardProject): YardProject {
  if (project.traverse) return project;
  if (!project.instances.length && !project.panels.length) return project;
  const box = project.instances.length
    ? bbox(project.instances)
    : {
        minX: -project.overall.width / 2,
        maxX: project.overall.width / 2,
        minY: 0,
        maxY: project.overall.height,
        minZ: -project.overall.depth / 2,
        maxZ: project.overall.depth / 2,
      };
  const spanX = Math.max(box.maxX - box.minX, 8);
  const spanZ = Math.max(box.maxZ - box.minZ, 8);
  const H = Math.max(box.maxY - box.minY, 8);
  const stand = Math.max(8, spanX * 0.45, spanZ * 0.45, H * 0.22);
  const item = getCatalogItem(project.primaryMaterialId);
  const craft =
    !item ||
    isSingleStockCraft(item) ||
    item.category === "craft_wood" ||
    item.category === "plastic" ||
    item.formFactor === "stick";
  const traverse: TraversePath = {
    kind: "around",
    origin: { x: (box.minX + box.maxX) / 2, y: 0.4, z: box.minZ - stand },
    axis: { x: 0, y: 0, z: 1 },
    length: spanZ + stand * 2,
    width: spanX + stand * 2,
    y: 0.4,
    eyeH: craft ? Math.max(1.2, Math.min(8, H * 0.28)) : Math.max(4, Math.min(16, H * 0.4)),
    clearH: H,
  };
  return {
    ...project,
    traverse,
    notes: [...project.notes, "Walk around it on the bench (WASD + mouse look)."],
  };
}

function withPyramidTomb(project: YardProject): YardProject {
  if (project.traverse) return project;
  if (!project.instances.length) return project;
  const box = bbox(project.instances);
  const span = box.maxX - box.minX;
  const H = box.maxY - box.minY;
  const half = span / 2;
  const item = getCatalogItem(project.primaryMaterialId);
  const personish =
    !!item && (item.category === "lumber" || item.category === "sheet_goods") && H >= 72;
  const door = pyramidDoorDims(H, half, personish);
  const cx = (box.minX + box.maxX) / 2;
  const stand = Math.max(4.2, door.height * 0.9, span * 0.1);
  const traverse: TraversePath = {
    kind: "portal",
    origin: { x: cx, y: 0.4, z: box.minZ - stand },
    axis: { x: 0, y: 0, z: 1 },
    length: stand + Math.max(door.height * 1.4, span * 0.38),
    width: door.width,
    y: 0.4,
    eyeH: Math.max(0.75, Math.min(1.45, door.height * 0.22)),
    clearH: door.height,
  };
  const use = inferLoadUse({ ...project, traverse });
  return {
    ...project,
    traverse,
    notes: [
      ...project.notes,
      `North door ${door.width.toFixed(1)}" × ${door.height.toFixed(1)}" — Walk in. Frame is the skeleton; Full is every structural course; Fill is the packed faces.`,
    ],
    assumptions: {
      ...project.assumptions,
      use,
      load: use === "person" ? "heavy" : use === "toy" ? "medium" : "light",
    },
  };
}

export function panelBomLines(project: YardProject) {
  const item = getCatalogItem(project.primaryMaterialId);
  if (item && isSingleStockCraft(item)) return [];
  const decks = project.panels.filter((p) => p.type === "deck");
  if (!decks.length) return [];
  const byId = new Map<string, { area: number; name: string }>();
  for (const p of decks) {
    if (item && isSingleStockCraft(item) && p.materialId !== item.id) continue;
    const cat = getCatalogItem(p.materialId);
    const area = p.size.width * p.size.depth;
    const cur = byId.get(p.materialId) ?? { area: 0, name: cat?.name ?? p.name };
    cur.area += area;
    byId.set(p.materialId, cur);
  }
  return [...byId.entries()].map(([id, row]) => {
    const cat = getCatalogItem(id);
    const stockA = Math.max(1, (cat?.dims.length ?? 30) * (cat?.dims.width ?? 20));
    const qty = Math.max(1, Math.ceil(row.area / (stockA * 0.8)));
    return {
      name: row.name,
      quantity: qty,
      unit: "sheet",
      catalogId: id,
      searchQuery: cat?.searchQuery ?? row.name,
      estimatedCost: (cat?.unitCostUsd ?? 4) * qty,
      notes: `Road deck · ${row.area.toFixed(0)} in²`,
    };
  });
}
