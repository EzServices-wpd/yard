/**
 * Sheet / board buildings: walls you cut, a door you walk through.
 * Cardboard castle, plywood doghouse, cedar birdhouse — not a stick loft.
 */
import { createId } from "@/lib/utils";
import type { CatalogItem, Panel, StructureKind, YardProject } from "./types";

export function wantsSheetBox(prompt: string, item: CatalogItem, kind: StructureKind): boolean {
  const lower = prompt.toLowerCase();
  const sheetish = item.formFactor === "sheet" || item.category === "cardboard" || item.category === "sheet_goods";
  const boardBox =
    item.formFactor === "board" && /birdhouse|dog\s*house|coop|playhouse/.test(lower);
  if (!sheetish && !boardBox) return false;
  return (
    kind === "house" ||
    kind === "castle" ||
    /playhouse|dog\s*house|birdhouse|coop|castle|fort/.test(lower)
  );
}

export function buildSheetBox(
  prompt: string,
  item: CatalogItem,
  kind: StructureKind,
  size: { width: number; height: number; depth: number },
  name: string,
): YardProject {
  const lower = prompt.toLowerCase();
  const bird = /birdhouse/.test(lower);
  const castle = kind === "castle" || /castle|fort/.test(lower);
  const W = bird ? Math.max(size.width, 7) : Math.max(size.width, 16);
  const D = bird ? Math.max(size.depth, 7) : Math.max(size.depth, 12);
  const H = bird ? Math.max(size.height, 10) : Math.max(size.height, 14);
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.15, 0.12);
  const x0 = -W / 2;
  const z0 = -D / 2;
  const panels: Panel[] = [];
  const add = (
    type: Panel["type"],
    label: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    cutouts?: Panel["cutouts"],
  ) => {
    panels.push({
      id: createId(type.slice(0, 2)),
      type,
      name: label,
      position: { x, y, z },
      size: { width: w, height: h, depth: d },
      materialId: item.id,
      cutouts,
    });
  };

  const doorW = bird ? Math.min(1.5, W * 0.28) : Math.min(W * 0.36, castle ? 8 : 10);
  const doorH = bird ? doorW : Math.min(H * 0.55, H - T * 2);
  const doorX = (W - doorW) / 2 - T;

  add("bottom", "Floor", x0 + T, 0, z0 + T, W - T * 2, T, D - T * 2);
  add("upright", "Left wall", x0, 0, z0, T, H, D);
  add("upright", "Right wall", x0 + W - T, 0, z0, T, H, D);
  add("back", "Back wall", x0 + T, 0, z0, W - T * 2, H, T);
  add(
    "back",
    "Front wall",
    x0 + T,
    0,
    z0 + D - T,
    W - T * 2,
    H,
    T,
    [
      {
        id: createId("cut"),
        x: doorX,
        y: bird ? H * 0.55 : 0,
        width: doorW,
        height: doorH,
        label: bird ? "entrance" : "door",
      },
    ],
  );
  const roofY = H;
  if (castle) {
    add("top", "Roof", x0, roofY, z0, W, T, D);
    const merlon = Math.max(2, T * 4);
    for (const [x, z] of [
      [x0, z0],
      [x0 + W - merlon, z0],
      [x0, z0 + D - merlon],
      [x0 + W - merlon, z0 + D - merlon],
    ] as const) {
      add("upright", "Keep", x, roofY, z, merlon, merlon * 1.6, merlon);
    }
  } else {
    add("top", "Roof", x0, roofY - T * 0.2, z0 - T, W, T, D + T * 2);
  }

  const assumed: string[] = [
    `${name} in ${item.name} — walls, floor, roof, ${bird ? "an entrance hole" : "a door"}.`,
    `Unit ${W.toFixed(0)}" × ${D.toFixed(0)}" × ${H.toFixed(0)}". Cut the openings before you tape the corners.`,
  ];
  if (!/door|hole|entrance/.test(lower)) {
    assumed.push(`Assumed ${bird ? "a 1½\" entrance" : "a front door"} so it reads as the thing, not a closed box.`);
  }

  return {
    id: createId("proj"),
    name,
    prompt,
    kind: kind === "castle" ? "castle" : "house",
    overall: { width: W + 4, height: H + (castle ? 8 : 4), depth: D + 4 },
    instances: [],
    panels,
    primaryMaterialId: item.id,
    notes: assumed,
    assumptions: {
      load: item.formFactor === "sheet" && item.category === "cardboard" ? "light" : "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: bird || item.category === "cardboard" ? "display" : "toy",
    },
  };
}
