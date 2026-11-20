import { createId } from "@/lib/utils";
import { placeBinding } from "./sizePhrases";
import type { Panel, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";

function uprights(W: number, H: number, D: number, p = 0.75, materialId = PLY): Panel[] {
  return [
    {
      id: createId("up"),
      type: "upright",
      name: "Left upright",
      position: { x: 0, y: 0, z: 0 },
      size: { width: p, height: H, depth: D },
      materialId,
    },
    {
      id: createId("up"),
      type: "upright",
      name: "Right upright",
      position: { x: W - p, y: 0, z: 0 },
      size: { width: p, height: H, depth: D },
      materialId,
    },
  ];
}

function shelf(
  name: string,
  y: number,
  W: number,
  D: number,
  p = 0.75,
  materialId = PLY,
  type: Panel["type"] = "shelf",
): Panel {
  return {
    id: createId(type === "glass_panel" ? "gl" : "sh"),
    type,
    name,
    position: { x: p, y, z: type === "glass_panel" ? 0.5 : 0 },
    size: {
      width: W - p * 2,
      height: type === "glass_panel" ? 0.25 : p,
      depth: type === "glass_panel" ? Math.max(4, D - 1) : D,
    },
    materialId,
  };
}

function emptyClosetProject(partial: Partial<YardProject> & Pick<YardProject, "name" | "overall" | "panels">): YardProject {
  return {
    id: createId("proj"),
    prompt: partial.prompt ?? "",
    kind: "closet",
    instances: [],
    primaryMaterialId: PLY,
    notes: partial.notes ?? [],
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: partial.opening ? "alcove" : "wall",
      wallType: "wood_stud",
    },
    ...partial,
  };
}

export function buildClosetFromOpening(
  width: number,
  height: number,
  depth: number,
  prompt = "",
  /** An axis the person typed stays at that number. The floor applies only to an axis they left blank. */
  typed: { width?: boolean; height?: boolean; depth?: boolean } = {},
): YardProject {
  const W = typed.width ? width : Math.max(12, width);
  const H = typed.height ? height : Math.max(24, height);
  const D = typed.depth ? depth : Math.max(8, depth);
  const p = 0.75;
  const inner = H - p;
  const count = H >= 72 ? 4 : H >= 48 ? 3 : 2;
  const gap = inner / count;
  const shelves: Panel[] = [];
  for (let i = 0; i < count; i++) {
    shelves.push(shelf(i === 0 ? "Bottom shelf" : `Shelf ${i}`, i * gap, W, D, p));
  }
  shelves.push(shelf("Top", H - p, W, D, p, PLY, "top"));

  return emptyClosetProject({
    name: `${W}" alcove closet`,
    prompt,
    overall: { width: W, height: H, depth: D },
    opening: { width: W, height: H, depth: D, kind: "alcove" },
    panels: [...uprights(W, H, D, p), ...shelves],
    notes: [
      `Closet fitted to a ${W}" × ${H}" × ${D}" opening.`,
      "¾\" plywood uprights and shelves. Guidance only — verify against the real opening.",
    ],
  });
}

export function buildClosetFromPrompt(prompt: string, size: { width: number; height: number; depth: number }): YardProject {
  const lower = prompt.toLowerCase();
  let W = size.width;
  let H = size.height;
  let D = size.depth;

  if (/linen/.test(lower) && !/vanity/.test(lower) && !/\d/.test(lower)) {
    W = 31.5;
    H = 78;
    D = 16;
  } else if (/pantry/.test(lower) && !/\d/.test(lower)) {
    W = 24;
    H = 84;
    D = 16;
  } else if (/wardrobe|wide/.test(lower) && !/\d/.test(lower)) {
    W = 60;
    H = 84;
    D = 24;
  } else if (/media|tv|niche/.test(lower) && !/\d/.test(lower)) {
    W = 48;
    H = 30;
    D = 18;
  }

  const place = placeBinding(prompt);
  const said = (words: string) => new RegExp(String.raw`\d+(?:\.\d+)?\s*(?:["″]|in(?:ch(?:es)?)?)?\s*(?:${words})\b`, "i").test(prompt);
  const widthTyped = said("wide|width") || place.axes.width != null;
  const heightTyped = said("tall|high|height") || place.axes.height != null;
  const depthTyped = said("deep|depth") || place.axes.depth != null;
  // parseSize copies a typed width under 24" onto the cube's other axes. Those copies were not typed.
  const typedW = place.axes.width ?? (widthTyped ? size.width : W);
  if (widthTyped && !heightTyped && typedW < 24 && place.axes.height == null) H = 24;
  if (widthTyped && !depthTyped && typedW < 24 && place.axes.depth == null) D = 24;
  if (place.axes.width != null) W = place.axes.width;
  if (place.axes.height != null) H = place.axes.height;
  if (place.axes.depth != null) D = place.axes.depth;
  const project = buildClosetFromOpening(W, H, D, prompt, { width: widthTyped, height: heightTyped, depth: depthTyped });
  project.name = /vanity/.test(lower)
    ? "Vanity"
    : /wardrobe/.test(lower)
    ? "Wide wardrobe"
    : /pantry/.test(lower)
      ? "Pantry tower"
      : /linen/.test(lower)
        ? "Linen closet"
        : /media/.test(lower)
          ? "Media niche"
          : "Custom closet";

  if (W >= 48) {
    const p = 0.75;
    project.panels.push({
      id: createId("dv"),
      type: "divider",
      name: "Center divider",
      position: { x: W / 2 - p / 2, y: 0, z: 0 },
      size: { width: p, height: H, depth: D },
      materialId: PLY,
    });
    project.notes.push("Center divider added for the wide span.");
  }

  return project;
}

export const CLOSET_STARTERS = [
  { id: "linen", label: "Linen closet", prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep" },
  { id: "pantry", label: "Pantry tower", prompt: "pantry tower 24 by 84 by 16" },
  { id: "wardrobe", label: "Wide wardrobe", prompt: "wide wardrobe 60 by 84 by 24" },
  { id: "media", label: "Media niche", prompt: "media niche 48 wide 30 high 18 deep" },
] as const;
