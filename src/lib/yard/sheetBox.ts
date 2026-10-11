/**
 * Sheet / board buildings: walls you cut, a door you walk through.
 * Cardboard castle, plywood doghouse, cedar birdhouse — not a stick loft.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { subjectFromPrompt } from "./form";
import type { CatalogItem, JoinMethod, Panel, StructureKind, YardProject } from "./types";
import { typedExtents } from "./honesty";

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
  // A typed axis is the finished outside. A readability minimum applies only to an untyped axis.
  const labeled = typedExtents(prompt)?.labeled;
  const W = bird
    ? (labeled?.width ? size.width : Math.max(size.width, 7))
    : (labeled?.width ? size.width : Math.max(size.width, 16));
  const D = bird
    ? (labeled?.depth ? size.depth : Math.max(size.depth, 7))
    : (labeled?.depth ? size.depth : Math.max(size.depth, 12));
  const H = bird
    ? (labeled?.height ? size.height : Math.max(size.height, 10))
    : (labeled?.height ? size.height : Math.max(size.height, 14));
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
    // Typed axes are the finished outside. Padding stays only on untyped axes.
    overall: {
      width: labeled?.width ? W : W + 4,
      height: labeled?.height ? H : H + (castle ? 8 : 4),
      depth: labeled?.depth ? D : D + 4,
    },
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

/**
 * A sheet boat is a hull: tapered bow, two sides, a transom and a seat. Not a closed crate.
 */
export function buildSheetHull(
  prompt: string,
  item: CatalogItem,
  size: { width: number; height: number; depth: number },
  name: string,
): YardProject {
  const L = Math.max(size.width, 12);
  const beam = Math.max(size.depth, 8);
  const H = Math.max(size.height * 0.45, 6);
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.15, 0.08);
  const panels: Panel[] = [];
  const add = (type: Panel["type"], label: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    panels.push({
      id: createId(type.slice(0, 2)),
      type,
      name: label,
      position: { x, y, z },
      size: { width: w, height: h, depth: d },
      materialId: item.id,
      cutNote: label.startsWith("Bow") ? "Tapers to the bow. Cut the long edge on a slant." : undefined,
    });
  };
  add("bottom", "Hull bottom", -L / 2, 0, -beam / 2, L, T, beam * 0.72);
  add("upright", "Bow side", L * 0.15, 0, -beam * 0.28, T, H, L * 0.4);
  add("upright", "Port side", -L / 2, 0, -beam / 2, T, H, L * 0.7);
  add("upright", "Starboard side", -L / 2, 0, beam / 2 - T, T, H, L * 0.7);
  add("back", "Transom", -L / 2, 0, -beam / 2, beam, H, T);
  add("shelf", "Seat", -L * 0.05, H * 0.45, -beam * 0.3, beam * 0.7, T, L * 0.18);
  return {
    id: createId("proj"),
    name: name || "Boat",
    prompt,
    kind: "furniture",
    overall: { width: L, height: H, depth: beam },
    instances: [],
    panels,
    primaryMaterialId: item.id,
    joinMethod: (item.preferredJoins?.[0] === "glue" ? "glue" : "screw") as JoinMethod,
    notes: [
      `${name || "Boat"} in ${item.name} — a hull with a tapered bow, two sides, a transom and a seat. Not a closed crate.`,
      `Outside ${inchFrac(L)}" long × ${inchFrac(beam)}" across × ${inchFrac(H)}" to the gunwale.`,
    ],
    assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
  };
}

/**
 * A named sheet is faces of the typed envelope, not battens ripped for a stick recipe.
 * House and castle already have a walled sheet path. A figure stays a figure.
 * Every other class on sheet stock is that shell.
 * An open frame stays its members on any stock, including sheet (ripped strips) — the same form
 * any stock builds. A plain box is faces of the envelope.
 */
export function wantsUnmatchedSheetShell(
  item: CatalogItem,
  kind: StructureKind,
  wholeMembers = false,
  _notes: string[] = [],
): boolean {
  const sheetish = item.formFactor === "sheet" || item.category === "cardboard" || item.category === "sheet_goods";
  if (!sheetish) return false;
  if (kind === "house" || kind === "castle") return false;
  // A figure is the figure, even on a sheet. Everything else is faces of the typed envelope.
  // A catalog member map must not rip the sheet into battens.
  if (kind === "figure" || kind === "eiffel") return false;
  // An open frame (truss bridge, lattice tower, arch, ladder, any frame) is its members — strips
  // ripped from the sheet keep the same form any other stock builds; a closed box is a different object.
  if (kind === "bridge" || kind === "lattice" || kind === "tower" || kind === "arch" || kind === "ladder" || kind === "frame") return false;
  // (wholeMembers kept for callers; frames already covered above)
  if (wholeMembers) return false;
  return true;
}

/** Closed sheet shell at the typed size. A named window or door is a cut opening, not a wire cube. */
export function buildTypedSheetShell(
  prompt: string,
  item: CatalogItem,
  size: { width: number; height: number; depth: number },
  name: string,
  unmatched = false,
): YardProject {
  const lower = prompt.toLowerCase();
  const W = Math.max(size.width, 1);
  const D = Math.max(size.depth, 1);
  const H = Math.max(size.height, 1);
  const T = Math.max(item.dims.thickness ?? item.dims.height ?? 0.15, 0.08);
  const x0 = -W / 2;
  const z0 = -D / 2;
  const panels: Panel[] = [];
  const add = (type: Panel["type"], label: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    panels.push({
      id: createId(type.slice(0, 2)),
      type,
      name: label,
      position: { x, y, z },
      size: { width: w, height: h, depth: d },
      materialId: item.id,
    });
  };
  const openTop = /\bopen\s+top\b/.test(lower);
  const titled = name === "Frame" || name === "Custom form"
    ? (subjectFromPrompt(prompt).replace(/\b\w/g, (c) => c.toUpperCase()) || name)
    : name;
  const hull = /\bboats?\b|\bhull\b/.test(lower);
  if (hull) return buildSheetHull(prompt, item, size, titled);
  const opening = /\b(?:windows?|doors?)\b/.test(lower);
  add("bottom", "Floor", x0, 0, z0, W, T, D);
  add("upright", "Left wall", x0, 0, z0, T, H, D);
  add("upright", "Right wall", x0 + W - T, 0, z0, T, H, D);
  add("back", "Back wall", x0, 0, z0, W, H, T);
  add("back", "Front wall", x0, 0, z0 + D - T, W, H, T);
  if (!openTop) add("top", "Top", x0, H - T, z0, W, T, D);
  if (opening) {
    const ow = Math.max(4, Math.min(W * 0.45, W - 2 * T));
    const oh = Math.max(4, Math.min(H * 0.45, H - 2 * T));
    const front = panels[panels.length - (openTop ? 1 : 2)];
    if (front) {
      front.name = "Front wall";
      front.cutNote = `Cut a ${inchFrac(ow)}" × ${inchFrac(oh)}" opening in this face, ${inchFrac((W - ow) / 2)}" in from the left and ${inchFrac(H * 0.28)}" up. Do not glue a patch over it.`;
      front.polygon = {
        plane: "xy",
        pts: [[0, 0], [W, 0], [W, H], [0, H]],
        holes: [{ x: (W - ow) / 2 + ow / 2, y: H * 0.28 + oh / 2, r: Math.min(ow, oh) / 2 }],
      };
    }
  }
  const join = item.preferredJoins?.[0];
  const glue = join === "glue" || join === "tape" || item.category === "cardboard";
  const joinTalk = glue ? "Tape or glue the corners." : "Glue and screw the corners.";
  const inch = (n: number) => `${inchFrac(n)}"`;
  return {
    id: createId("proj"),
    name: titled,
    prompt,
    // A class the form matched (chair, table) is furniture; an unmatched noun claims no class.
    kind: unmatched || name === "Frame" || name === "Custom form" ? "custom" : "furniture",
    ...(unmatched ? { unmatched: true } : {}),
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: item.id,
    joinMethod: (glue ? "glue" : join === "solvent" ? "solvent" : "screw") as JoinMethod,
    notes: [
      `${titled} in ${item.name} — a closed shell of the typed envelope, not battens ripped from the sheet.`,
      `Outside ${inch(W)} wide × ${inch(H)} high × ${inch(D)} deep. Walls are the sheet thickness. ${joinTalk}${openTop ? " Leave the top open." : " The top closes the box."}${opening ? " Cut the opening in the front before that wall goes on." : ""}`,
    ],
    assumptions: {
      load: item.category === "cardboard" ? "light" : "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "display",
    },
  };
}

/** A container noun (box, chest, crate, bin, case, hamper, suitcase, and compounds) builds as faces, not a frame. */
export function wantsContainerBox(prompt: string, item: CatalogItem): boolean {
  const lower = prompt.toLowerCase();
  if (!/\b\w*(?:box|chest|crate|bin|case|hamper|suitcase)\b/.test(lower)) return false;
  if (/planter|garden|window\s*box|flower|shadow\s*box|music\s*box|sandbox|mail\s*box|mailbox/.test(lower)) return false;
  const sheetish = item.formFactor === "sheet" || item.category === "cardboard" || item.category === "sheet_goods" || (item.category === "lumber" && item.formFactor === "board");
  return sheetish;
}
