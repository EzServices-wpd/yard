/**
 * The job of the thing, not just its silhouette.
 * A bridge gets a road you can walk. An arch keeps a portal you can pass.
 * Load is inferred from stock + size; a person does not stand on popsicle.
 */
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { withHome } from "./assembly";
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

export function deckStockFor(item: CatalogItem): CatalogItem {
  if (item.formFactor === "sheet") return item;
  if (item.category === "lumber" || item.category === "sheet_goods" || item.formFactor === "board") {
    return getCatalogItem("plywood-3-4-4x8") ?? item;
  }
  if (item.category === "foam") return getCatalogItem("foam-board-20x30") ?? item;
  if (item.formFactor === "pipe" || item.category === "pvc_plumbing") {
    return getCatalogItem("foam-board-20x30") ?? item;
  }
  return getCatalogItem("cardboard-corrugated-sheet") ?? getCatalogItem("foam-board-20x30") ?? item;
}

export function inferLoadUse(project: YardProject): LoadUse {
  const item = getCatalogItem(project.primaryMaterialId);
  const t = project.traverse;
  const deckW = t?.width ?? 0;
  const clear = t?.clearH ?? 0;
  const craft =
    !item ||
    item.category === "craft_wood" ||
    item.category === "plastic" ||
    item.formFactor === "stick" ||
    (item.formFactor === "tube" && (item.dims.diameter ?? 1) < 0.4);
  if (craft) return "display";
  if (deckW >= 24 && clear >= 36 && (item.category === "lumber" || item.category === "sheet_goods")) {
    return "person";
  }
  return "toy";
}

export function loadIssues(project: YardProject): FeasibilityIssue[] {
  const t = project.traverse;
  if (!t) return [];
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
      message: "Toy load — a car or figure can cross. Not a person.",
      suggestion: deckItem
        ? `Road is ${deckItem.name}. Keep the live load under a couple of pounds.`
        : "The deck sheet is the road. Don't skip it.",
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
      message: `Road is only ${t.width.toFixed(1)}" wide.`,
      suggestion: "Widen the prompt or pick thicker stock if you want a lane you can actually use.",
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
  return project;
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

function member(from: Vec3, to: Vec3, catalogId: string, role: string, join: string): YardInstance {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    id: createId("fn"),
    catalogId,
    position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
    rotation: { x: 0, y: Math.atan2(dx, dz), z: 0 },
    cutLength: len,
    role,
    join,
    from,
    to,
  };
}

function withBridgeDeck(project: YardProject): YardProject {
  if (project.panels.some((p) => p.type === "deck")) return project;
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item || !project.instances.length) return project;
  const box = bbox(project.instances);
  const rails = project.instances.filter((i) => i.role === "rail");
  const deckY = rails.length ? median(rails.map((i) => i.position.y)) : box.minY + (box.maxY - box.minY) * 0.32;
  const span = box.maxX - box.minX;
  const depth = Math.max(box.maxZ - box.minZ, 4);
  const z0 = box.minZ;
  const z1 = box.maxZ;
  const roadW = Math.max(depth * 0.88, 3.2);
  const sheet = deckStockFor(item);
  const thick = Math.max(sheet.dims.thickness ?? 0.15, 0.12);
  const deckTop = deckY + thick;
  const portalH = Math.max(2.2, (box.maxY - deckY) * 0.22);
  const join = project.joinMethod ?? item.preferredJoins?.[0] ?? "glue";

  const panel: Panel = {
    id: createId("deck"),
    type: "deck",
    name: "Road deck",
    position: { x: box.minX, y: deckY, z: -roadW / 2 },
    size: { width: span, height: thick, depth: roadW },
    materialId: sheet.id,
  };

  // Guard rails ride the existing chords (tower faces), not the middle of the portal.
  const railH = Math.max(0.9, Math.min(2.2, portalH * 0.55, depth * 0.28));
  const posts = Math.max(4, Math.min(14, Math.round(span / Math.max(item.dims.length ?? 4.5, 3))));
  const extras: YardInstance[] = [];
  for (const z of [z0, z1]) {
    extras.push(
      member({ x: box.minX, y: deckTop + railH, z }, { x: box.maxX, y: deckTop + railH, z }, item.id, "brace", join),
    );
    for (let i = 0; i <= posts; i++) {
      const x = box.minX + (span * i) / posts;
      extras.push(
        member({ x, y: deckTop, z }, { x, y: deckTop + railH, z }, item.id, "brace", join),
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

  const use = inferLoadUse({ ...project, traverse, panels: [...project.panels, panel] });
  const notes = [
    ...project.notes,
    `Road: ${sheet.name} · ${span.toFixed(0)}" × ${roadW.toFixed(1)}" · ${use} load.`,
    "Walk the deck (Walk on the bench). Frame hides the road; Full is the thing in use.",
  ];

  return {
    ...project,
    instances: withHome([...project.instances, ...extras]),
    panels: [...project.panels, panel],
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
  const traverse: TraversePath = alongZ
    ? {
        kind: "portal",
        origin: { x: (box.minX + box.maxX) / 2, y: 0.45, z: box.minZ - 1 },
        axis: { x: 0, y: 0, z: 1 },
        length: spanZ + 2,
        width: spanX * 0.55,
        y: 0.45,
        eyeH: Math.max(1.2, Math.min(5, (box.maxY - box.minY) * 0.18)),
        clearH: (box.maxY - box.minY) * 0.7,
      }
    : {
        kind: "portal",
        origin: { x: box.minX - 1, y: 0.45, z: (box.minZ + box.maxZ) / 2 },
        axis: { x: 1, y: 0, z: 0 },
        length: spanX + 2,
        width: spanZ * 0.55,
        y: 0.45,
        eyeH: Math.max(1.2, Math.min(5, (box.maxY - box.minY) * 0.18)),
        clearH: (box.maxY - box.minY) * 0.7,
      };
  return {
    ...project,
    traverse,
    notes: [...project.notes, "Portal is clear — Walk through it on the bench."],
    assumptions: { ...project.assumptions, use: inferLoadUse({ ...project, traverse }) },
  };
}

export function panelBomLines(project: YardProject) {
  const decks = project.panels.filter((p) => p.type === "deck");
  if (!decks.length) return [];
  const byId = new Map<string, { area: number; name: string }>();
  for (const p of decks) {
    const item = getCatalogItem(p.materialId);
    const area = p.size.width * p.size.depth;
    const cur = byId.get(p.materialId) ?? { area: 0, name: item?.name ?? p.name };
    cur.area += area;
    byId.set(p.materialId, cur);
  }
  return [...byId.entries()].map(([id, row]) => {
    const item = getCatalogItem(id);
    const stockA = Math.max(1, (item?.dims.length ?? 30) * (item?.dims.width ?? 20));
    const qty = Math.max(1, Math.ceil(row.area / (stockA * 0.8)));
    return {
      name: row.name,
      quantity: qty,
      unit: "sheet",
      catalogId: id,
      searchQuery: item?.searchQuery ?? row.name,
      estimatedCost: (item?.unitCostUsd ?? 4) * qty,
      notes: `Road deck · ${row.area.toFixed(0)} in²`,
    };
  });
}
