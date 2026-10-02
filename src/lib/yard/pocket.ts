/**
 * Trapezoidal pocket built-in — the original Yard prompt.
 * A rectangular unit, front parallel to the back wall, centered on the
 * back-wall centerline, inside an angled alcove. Vanity + drawers + uppers.
 */

import { createId } from "@/lib/utils";
import type { Panel, PocketSpec, PocketUnit, PocketWalls, YardProject } from "./types";
import { plySheetCatalogId } from "./nesting";

const PLY = "plywood-3-4-4x8";
const P = 0.75;

/** Chip / everyday sentence. parsePocket fills Ezra's bathroom as the example pocket. */
export const POCKET_SHORT = "pocket vanity";

/** Full survey of the original bathroom — preset data, not the chip prompt. */
export const POCKET_DREAM = `I have a pocket space in my bathroom with these exact dimensions:
Back wall: 38.5 inches wide. Left side depth: 26 inches. Right side depth: 33.5 inches. All walls: 102 inches high. Open to the front.
The side walls are angled (almost trapezoidal): at 20 inches perpendicular from the back wall, the opening is 46 inches wide. Left of centerline at 20": 25 inches. Right of centerline at 20": 21 inches. Left wall angle ≈ 16.05°. Right wall angle ≈ 5.00°.
I want mixed-use towel and linen storage as well as a vanity space.
A centered rectangular unit 38 inches wide × 17 inches deep × 102 inches high. Front face parallel to the back wall, centered on the back-wall centerline. At 17" depth: about 5.1" clearance on the left and 1.7" on the right.
Centered vanity with open knee space (≈22 inches clear) under a counter at 34 inches high. Drawers on either side of the knee space. Upper cabinetry from 54 inches to the ceiling (102"). Large doors with adjustable shelving for towels and linens. Mirror and storage beside the chair space. Structurally centered and anchored into studs.`;

function num(s: string | undefined, fallback: number) {
  if (!s) return fallback;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

function pick(text: string, re: RegExp, fallback: number) {
  const m = text.match(re);
  return num(m?.[1], fallback);
}

export function looksLikePocket(prompt: string) {
  const lower = prompt.toLowerCase();
  // Wonky geometry only — "alcove" alone is a rectangular fitted unit.
  const wonky =
    /pocket|trapezoid|centerline|angled|wonky/.test(lower) ||
    (/back wall/.test(lower) && /left/.test(lower) && /right/.test(lower));
  if (!wonky) return false;
  const use = /vanity|linen|towel|built-?in|cabinet|closet|storage/.test(lower);
  const measures = (lower.match(/\d+(?:\.\d+)?/g) ?? []).length >= 6;
  return use || measures;
}

export function parsePocket(prompt: string): PocketSpec | null {
  if (!looksLikePocket(prompt)) return null;
  const t = prompt.replace(/×/g, "x").replace(/″/g, '"');
  const lower = t.toLowerCase();
  // "original trapezoid" / original pocket vanity freezes Ezra's bathroom survey — do not invent new flares.
  const freezeOriginal =
    /original/.test(lower) && /(?:trapezoid|pocket|vanity)/.test(lower) && (lower.match(/\d+(?:\.\d+)?/g) ?? []).length < 4;
  if (freezeOriginal) {
    // Fall through with empty measure text so defaults below stay the original survey.
  }

  const measure = freezeOriginal ? "" : t;
  const backWidth = pick(measure, /back wall[:\s]+(\d+(?:\.\d+)?)/i, pick(measure, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*wide/i, 38.5));
  const saidLeft = /left(?: side)? (?:depth|wall)[:\s]+\d/i.test(measure);
  const saidRight = /right(?: side)? (?:depth|wall)[:\s]+\d/i.test(measure);
  const deepM = measure.match(/(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*deep/i);
  const leftDepth = saidLeft
    ? pick(measure, /left(?: side)? (?:depth|wall)[:\s]+(\d+(?:\.\d+)?)/i, 26)
    : deepM
      ? num(deepM[1], 26)
      : 26;
  const rightDepth = saidRight
    ? pick(measure, /right(?: side)? (?:depth|wall)[:\s]+(\d+(?:\.\d+)?)/i, 33.5)
    : deepM
      ? num(deepM[1], 33.5)
      : 33.5;
  const ceilingM = measure.match(/ceilings?\s*(?:height\s*)?(?:is|of|:|=)?\s*(\d+(?:\.\d+)?)/i);
  const tallM = measure.match(/(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*tall/i);
  const wallsHigh = measure.match(/(?:all walls|walls)[:\s]+(\d+(?:\.\d+)?)/i);
  const highM = measure.match(/(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*high/i);
  const height = wallsHigh
    ? num(wallsHigh[1], 102)
    : ceilingM
      ? num(ceilingM[1], 102)
      : tallM
        ? num(tallM[1], 102)
        : highM
          ? num(highM[1], 102)
          : 102;

  const station = pick(measure, /at (\d+(?:\.\d+)?)\s*(?:inches?|")?\s*(?:perpendicular )?from the back/i, 20);
  const leftOfCL = pick(measure, /left of centerline[^\d]{0,24}(\d+(?:\.\d+)?)/i, 25);
  const rightOfCL = pick(measure, /right of centerline[^\d]{0,24}(\d+(?:\.\d+)?)/i, 21);

  let leftAngleDeg = pick(measure, /left wall angle[^\d]{0,8}(\d+(?:\.\d+)?)/i, NaN);
  let rightAngleDeg = pick(measure, /right wall angle[^\d]{0,8}(\d+(?:\.\d+)?)/i, NaN);
  const saidFlare = /angle|centerline|trapezoid/i.test(measure);
  // A typed survey with no flare cue is a straight hole — uneven depths do not invent angles.
  // A bare chip ("pocket vanity") has no survey numbers, so it keeps the example hole's flare.
  const saidSurvey = /\d/.test(measure);
  if (saidSurvey && !saidFlare) {
    leftAngleDeg = 0;
    rightAngleDeg = 0;
  } else if (!saidFlare && leftDepth === rightDepth) {
    leftAngleDeg = 0;
    rightAngleDeg = 0;
  } else {
    if (!Number.isFinite(leftAngleDeg)) {
      leftAngleDeg = (Math.atan((leftOfCL - backWidth / 2) / station) * 180) / Math.PI;
    }
    if (!Number.isFinite(rightAngleDeg)) {
      rightAngleDeg = (Math.atan((rightOfCL - backWidth / 2) / station) * 180) / Math.PI;
    }
  }

  const takeW = measure.match(/takes?\s+only\s+(\d+(?:\.\d+)?)\s+of the width/i);
  const takeD = measure.match(/(\d+(?:\.\d+)?)\s+of the depth/i);
  const takeH = measure.match(/(\d+(?:\.\d+)?)\s+of the height/i);
  const leftShelf = measure.match(/left shel(?:f|ves)\s+(\d+(?:\.\d+)?)/i);
  const rightShelf = measure.match(/right shel(?:f|ves)\s+(\d+(?:\.\d+)?)/i);
  const unitW = takeW
    ? num(takeW[1], backWidth)
    : pick(measure, /(?:unit|rectangular unit)[^\d]{0,40}(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*(?:wide|w)/i, pick(measure, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*wide\s*x/i, 38));
  const unitD = takeD
    ? num(takeD[1], 17)
    : pick(measure, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*deep/i, 17);
  const unitH = takeH
    ? num(takeH[1], height)
    : pick(measure, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*(?:high|tall)(?! from)/i, height);
  const vanityH = pick(measure, /counter(?:[^\d]{0,16})(\d+(?:\.\d+)?)/i, 34);
  const kneeW = pick(measure, /knee[^\d]{0,24}(\d+(?:\.\d+)?)/i, pick(measure, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*clear/i, 22));
  const upperStart = pick(measure, /upper[^\d]{0,40}(\d+(?:\.\d+)?)/i, pick(measure, /starting at (\d+(?:\.\d+)?)/i, 54));

  const walls: PocketWalls = {
    backWidth,
    leftDepth,
    rightDepth,
    height,
    leftAngleDeg,
    rightAngleDeg,
  };
  const unit: PocketUnit = {
    width: unitW,
    depth: Math.min(unitD, Math.min(leftDepth, rightDepth) - 1),
    height: unitH || height,
    vanityH,
    kneeW: Math.min(kneeW, Math.max(8, unitW - 8)),
    upperStart,
  };
  if (leftShelf) unit.leftBay = num(leftShelf[1], 0);
  if (rightShelf) unit.rightBay = num(rightShelf[1], 0);
  const fit = fitPocketAsk(
    { walls, unit, leftClear: 0, rightClear: 0 },
    {
      width: unit.width,
      depth: unitD,
      height: unit.height,
      ceiling: walls.height,
      leftBay: unit.leftBay,
      rightBay: unit.rightBay,
    },
  );
  if (fit.note) fit.spec.clampNote = fit.note;
  return fit.spec;
}

export function wallX(walls: PocketWalls, side: "left" | "right", z: number) {
  const half = walls.backWidth / 2;
  if (side === "left") return -half - z * Math.tan((walls.leftAngleDeg * Math.PI) / 180);
  return half + z * Math.tan((walls.rightAngleDeg * Math.PI) / 180);
}

export function clearancesAt(walls: PocketWalls, unit: PocketUnit) {
  const z = unit.depth;
  const leftWall = wallX(walls, "left", z);
  const rightWall = wallX(walls, "right", z);
  const leftUnit = -unit.width / 2;
  const rightUnit = unit.width / 2;
  return {
    leftClear: leftUnit - leftWall,
    rightClear: rightWall - rightUnit,
    opening: rightWall - leftWall,
  };
}

function inch(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** How much of a measured pocket the build is allowed to take. Clamps to the hole. */
export function fitPocketAsk(
  spec: PocketSpec,
  ask: { width: number; height: number; depth: number; ceiling?: number; leftBay?: number; rightBay?: number },
): { spec: PocketSpec; note: string | null } {
  const notes: string[] = [];
  const walls = { ...spec.walls };
  if (ask.ceiling != null && Number.isFinite(ask.ceiling)) walls.height = Math.max(24, ask.ceiling);

  let width = ask.width;
  let depth = ask.depth;
  let height = ask.height;
  if (width > walls.backWidth + 0.05) {
    notes.push(`The back wall is ${inch(walls.backWidth)}". The build uses that, not ${inch(width)}".`);
    width = walls.backWidth;
  }
  width = Math.max(12, width);

  const shallow = Math.min(walls.leftDepth, walls.rightDepth);
  const maxD = Math.max(6, shallow - 0.75);
  if (depth > maxD + 0.05) {
    notes.push(`The shallower wall is ${inch(shallow)}". The build comes out ${inch(maxD)}", so it stays in the hole.`);
    depth = maxD;
  }
  depth = Math.max(6, Math.min(depth, maxD));

  if (height > walls.height + 0.05) {
    notes.push(`The ceiling is ${inch(walls.height)}". The build stops there.`);
    height = walls.height;
  }
  height = Math.max(24, Math.min(height, walls.height));

  const usable = Math.max(6, width - 2.25);
  let leftBay = ask.leftBay;
  let rightBay = ask.rightBay;
  if (leftBay != null || rightBay != null) {
    let L = Math.max(4, leftBay ?? usable / 2);
    let R = Math.max(4, rightBay ?? usable / 2);
    if (L + R > usable + 0.05) {
      notes.push(`Those shelves are wider than the build. They share the ${inch(usable)}" inside it.`);
      const s = usable / (L + R);
      L = Math.round(L * s * 10) / 10;
      R = Math.round((usable - L) * 10) / 10;
    }
    leftBay = Math.round(L * 10) / 10;
    rightBay = Math.round(R * 10) / 10;
  }

  const unit: PocketUnit = {
    ...spec.unit,
    width,
    depth,
    height,
    kneeW: Math.min(spec.unit.kneeW, Math.max(8, width - 8)),
    vanityH: Math.min(spec.unit.vanityH, Math.max(24, height - 16)),
    upperStart: Math.min(spec.unit.upperStart, Math.max(32, height - 12)),
  };
  if (leftBay != null) unit.leftBay = leftBay;
  else delete unit.leftBay;
  if (rightBay != null) unit.rightBay = rightBay;
  else delete unit.rightBay;

  const clr = clearancesAt(walls, unit);
  return { spec: { walls, unit, leftClear: clr.leftClear, rightClear: clr.rightClear }, note: notes.join(" ") || null };
}

/** Upper shelf widths along the back. Absent bays split the opening. */
export function pocketBays(unit: PocketUnit) {
  const usable = Math.max(6, unit.width - 2.25);
  if (unit.leftBay == null && unit.rightBay == null) {
    const half = usable / 2;
    return { left: half, right: half, usable };
  }
  let left = Math.max(4, unit.leftBay ?? usable / 2);
  let right = Math.max(4, unit.rightBay ?? usable / 2);
  if (left + right > usable) {
    const s = usable / (left + right);
    left *= s;
    right *= s;
  }
  return { left, right, usable };
}

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId?: string,
): Panel {
  const t = Math.min(w, h, d);
  const long = Math.max(w, h, d);
  const mid = w + h + d - t - long;
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: materialId ?? plySheetCatalogId(long, mid, t),
  };
}

export function buildPocket(spec: PocketSpec, prompt = ""): YardProject {
  const { walls, unit } = spec;
  const clr = clearancesAt(walls, unit);
  const x0 = -unit.width / 2;
  const x1 = unit.width / 2;
  const W = unit.width;
  const H = unit.height;
  const D = unit.depth;
  const kneeL = -unit.kneeW / 2;
  const kneeR = unit.kneeW / 2;
  const leftBankW = kneeL - x0;
  const rightBankW = x1 - kneeR;

  const panels: Panel[] = [];

  // Carcase
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x1 - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back (stud-anchored)", x0 + P, 0, 0, W - P * 2, H, 0.25));
  panels.push(panel("divider", "Left knee divider", kneeL - P, 0, 0, P, unit.vanityH, D));
  panels.push(panel("divider", "Right knee divider", kneeR, 0, 0, P, unit.vanityH, D));

  // Toekick on the drawer banks only — knee stays open
  const kickH = 3.5;
  panels.push(panel("kick", "Left toekick", x0 + P, 0, D - P, leftBankW - P, kickH, P));
  panels.push(panel("kick", "Right toekick", kneeR + P, 0, D - P, rightBankW - P, kickH, P));

  // Drawer stacks — three each side, 34" to kick
  const drawerSpan = unit.vanityH - kickH;
  const drawerHs = [drawerSpan * 0.28, drawerSpan * 0.32, drawerSpan * 0.4];
  let yL = kickH;
  drawerHs.forEach((dh, i) => {
    panels.push(panel("drawer", `Left drawer ${i + 1}`, x0 + P, yL, 0.15, leftBankW - P - 0.1, dh - 0.12, D - 0.3));
    panels.push(panel("drawer", `Right drawer ${i + 1}`, kneeR + P, yL, 0.15, rightBankW - P - 0.1, dh - 0.12, D - 0.3));
    yL += dh;
  });

  // Counter — full width, front-to-back. Knee is the void under the middle.
  panels.push(panel("counter", "Vanity counter", x0, unit.vanityH, 0, W, 1.5, D));

  // Mirror above the knee, below the uppers
  const mirrorH = Math.max(8, unit.upperStart - unit.vanityH - 3.5);
  // Glass hangs on the back panel face (back is 1/4" thick at z 0) — not floating off it.
  panels.push(panel("mirror", "Vanity mirror", kneeL, unit.vanityH + 2, 0.25, unit.kneeW, mirrorH, 0.2));

  // Upper carcase. Shelves on each side can be a different width of the back.
  const u0 = Math.min(unit.upperStart, Math.max(unit.vanityH + 4, H - 8));
  const uH = Math.max(6, H - u0);
  const bays = pocketBays(unit);
  panels.push(panel("bottom", "Upper bottom", x0 + P, u0, 0, W - P * 2, P, D));
  panels.push(panel("top", "Upper top", x0 + P, H - P, 0, W - P * 2, P, D));
  panels.push(panel("divider", "Left upper divider", x0 + P + bays.left, u0, 0, P, uH, D));
  if (bays.usable - bays.left - bays.right > 1) {
    panels.push(panel("divider", "Right upper divider", x1 - P - bays.right - P, u0, 0, P, uH, D));
  }

  const shelfYs = [u0 + uH * 0.28, u0 + uH * 0.52, u0 + uH * 0.76];
  shelfYs.forEach((y, i) => {
    panels.push(panel("shelf", `Left linen shelf ${i + 1}`, x0 + P, y, 0.1, bays.left, P, D - 0.2));
    panels.push(panel("shelf", `Right towel shelf ${i + 1}`, x1 - P - bays.right, y, 0.1, bays.right, P, D - 0.2));
  });

  panels.push(panel("door", "Left upper door", x0 + 0.1, u0, D - P, bays.left, uH, P));
  panels.push(panel("door", "Right upper door", x1 - bays.right - 0.1, u0, D - P, bays.right, uH, P));

  const straight = Math.abs(walls.leftAngleDeg) < 0.05 && Math.abs(walls.rightAngleDeg) < 0.05;
  const notes = [
    straight
      ? walls.leftDepth === walls.rightDepth
        ? `Pocket. Back ${walls.backWidth}" · both walls ${walls.leftDepth}" deep · ceiling ${walls.height}".`
        : `Pocket. Back ${walls.backWidth}" · left depth ${walls.leftDepth}" · right depth ${walls.rightDepth}" · ceiling ${walls.height}".`
      : `Trapezoidal bathroom pocket. Back ${walls.backWidth}" · left depth ${walls.leftDepth}" @ ${walls.leftAngleDeg.toFixed(2)}° · right depth ${walls.rightDepth}" @ ${walls.rightAngleDeg.toFixed(2)}° · ${walls.height}" high.`,
    `Unit ${unit.width}" along the back × ${unit.depth}" out × ${unit.height}" tall. Front parallel to the back wall.`,
    `Left shelves ${bays.left.toFixed(1)}" wide. Right shelves ${bays.right.toFixed(1)}" wide.`,
    `At the unit front (${unit.depth}"): left clearance ${clr.leftClear.toFixed(2)}" · right clearance ${clr.rightClear.toFixed(2)}" · opening ${clr.opening.toFixed(2)}".`,
    `Vanity counter at ${unit.vanityH}". Knee ${unit.kneeW}" clear, centered. Drawers in the wings. Uppers ${unit.upperStart}" to ${unit.height}".`,
    `Anchor the back and both uprights into studs. Do not rely on drywall alone — this is a ${walls.height}" mixed-use unit.`,
    "Scribe the uprights if the back wall is out of plumb. The unit stays rectangular; the pocket is the thing that is wonky.",
    "Adjustable shelves on pins. Large doors. Mirror over the knee. Guidance only — confirm studs and plumbing before you cut.",
  ];

  if (spec.clampNote) notes.unshift(spec.clampNote);
  if (clr.leftClear < 0.5 || clr.rightClear < 0.5) {
    notes.unshift("CRITICAL: the unit collides with a side wall at this depth. Pull the unit shallower or narrow it.");
  }

  return {
    id: createId("proj"),
    name: "Bathroom pocket vanity",
    prompt,
    kind: "closet",
    overall: {
      width: Math.max(walls.backWidth, clr.opening) + 4,
      height: walls.height + 2,
      depth: Math.max(walls.leftDepth, walls.rightDepth) + 2,
    },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: {
      width: walls.backWidth,
      height: walls.height,
      depth: Math.max(walls.leftDepth, walls.rightDepth),
      kind: "pocket",
    },
    pocket: { walls, unit, leftClear: clr.leftClear, rightClear: clr.rightClear },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "alcove",
      wallType: "wood_stud",
    },
  };
}

export function pocketStrokes(spec: PocketSpec): { points: [number, number, number][]; weight: "main" | "fine" }[] {
  const { walls } = spec;
  const H = walls.height;
  const zL = walls.leftDepth;
  const zR = walls.rightDepth;
  const bl = wallX(walls, "left", 0);
  const br = wallX(walls, "right", 0);
  const fl = wallX(walls, "left", zL);
  const fr = wallX(walls, "right", zR);
  const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  return [
    { points: [v(bl, 0, 0), v(br, 0, 0), v(br, H, 0), v(bl, H, 0), v(bl, 0, 0)], weight: "main" },
    { points: [v(bl, 0, 0), v(fl, 0, zL), v(fl, H, zL), v(bl, H, 0)], weight: "main" },
    { points: [v(br, 0, 0), v(fr, 0, zR), v(fr, H, zR), v(br, H, 0)], weight: "main" },
    { points: [v(fl, 0, zL), v(fr, 0, zR)], weight: "fine" },
    { points: [v(fl, H, zL), v(fr, H, zR)], weight: "fine" },
  ];
}
