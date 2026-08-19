import { createId } from "@/lib/utils";
import type { Panel, PocketSpec, PocketUnit, PocketWalls, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";
const P = 0.75;

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
  const space = /pocket|trapezoid|alcove|back wall|centerline|angled/.test(lower);
  const use = /vanity|linen|towel|built-?in|cabinet/.test(lower);
  const measures = (lower.match(/\d+(?:\.\d+)?/g) ?? []).length >= 6;
  return (space && measures) || (use && space) || (use && measures && /bathroom|pocket/.test(lower));
}

export function parsePocket(prompt: string): PocketSpec | null {
  if (!looksLikePocket(prompt)) return null;
  const t = prompt.replace(/×/g, "x").replace(/″/g, '"');
  const backWidth = pick(t, /back wall[:\s]+(\d+(?:\.\d+)?)/i, pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*wide/i, 38.5));
  const leftDepth = pick(t, /left(?: side)? depth[:\s]+(\d+(?:\.\d+)?)/i, 26);
  const rightDepth = pick(t, /right(?: side)? depth[:\s]+(\d+(?:\.\d+)?)/i, 33.5);
  const height = pick(t, /(?:all walls|walls)[:\s]+(\d+(?:\.\d+)?)/i, pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*high/i, 102));
  const station = pick(t, /at (\d+(?:\.\d+)?)\s*(?:inches?|")?\s*(?:perpendicular )?from the back/i, 20);
  const leftOfCL = pick(t, /left of centerline[^\d]{0,24}(\d+(?:\.\d+)?)/i, 25);
  const rightOfCL = pick(t, /right of centerline[^\d]{0,24}(\d+(?:\.\d+)?)/i, 21);
  let leftAngleDeg = pick(t, /left wall angle[^\d]{0,8}(\d+(?:\.\d+)?)/i, NaN);
  let rightAngleDeg = pick(t, /right wall angle[^\d]{0,8}(\d+(?:\.\d+)?)/i, NaN);
  if (!Number.isFinite(leftAngleDeg)) leftAngleDeg = (Math.atan((leftOfCL - backWidth / 2) / station) * 180) / Math.PI;
  if (!Number.isFinite(rightAngleDeg)) rightAngleDeg = (Math.atan((rightOfCL - backWidth / 2) / station) * 180) / Math.PI;
  const unitW = pick(t, /(?:unit|rectangular unit)[^\d]{0,40}(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*(?:wide|w)/i, pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*wide\s*x/i, 38));
  const unitD = pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*deep/i, 17);
  const unitH = pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*high(?! from)/i, height);
  const vanityH = pick(t, /counter(?:[^\d]{0,16})(\d+(?:\.\d+)?)/i, 34);
  const kneeW = pick(t, /knee[^\d]{0,24}(\d+(?:\.\d+)?)/i, pick(t, /(\d+(?:\.\d+)?)\s*(?:inches?|")?\s*clear/i, 22));
  const upperStart = pick(t, /upper[^\d]{0,40}(\d+(?:\.\d+)?)/i, pick(t, /starting at (\d+(?:\.\d+)?)/i, 54));
  const walls: PocketWalls = { backWidth, leftDepth, rightDepth, height, leftAngleDeg, rightAngleDeg };
  const unit: PocketUnit = {
    width: unitW,
    depth: Math.min(unitD, Math.min(leftDepth, rightDepth) - 1),
    height: unitH || height,
    vanityH,
    kneeW: Math.min(kneeW, unitW - 8),
    upperStart,
  };
  const { leftClear, rightClear } = clearancesAt(walls, unit);
  return { walls, unit, leftClear, rightClear };
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
  return { leftClear: -unit.width / 2 - leftWall, rightClear: rightWall - unit.width / 2, opening: rightWall - leftWall };
}

function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId = PLY): Panel {
  return { id: createId(type.slice(0, 2)), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId };
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
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x1 - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back (stud-anchored)", x0 + P, 0, 0, W - P * 2, H, 0.25));
  panels.push(panel("divider", "Left knee divider", kneeL - P, 0, 0, P, unit.vanityH, D));
  panels.push(panel("divider", "Right knee divider", kneeR, 0, 0, P, unit.vanityH, D));
  const kickH = 3.5;
  panels.push(panel("kick", "Left toekick", x0 + P, 0, D - 0.5, leftBankW - P, kickH, 0.5));
  panels.push(panel("kick", "Right toekick", kneeR + P, 0, D - 0.5, rightBankW - P, kickH, 0.5));
  const drawerSpan = unit.vanityH - kickH;
  const drawerHs = [drawerSpan * 0.28, drawerSpan * 0.32, drawerSpan * 0.4];
  let yL = kickH;
  drawerHs.forEach((dh, i) => {
    panels.push(panel("drawer", `Left drawer ${i + 1}`, x0 + P, yL, 0.15, leftBankW - P - 0.1, dh - 0.12, D - 0.3));
    panels.push(panel("drawer", `Right drawer ${i + 1}`, kneeR + P, yL, 0.15, rightBankW - P - 0.1, dh - 0.12, D - 0.3));
    yL += dh;
  });
  panels.push(panel("counter", "Vanity counter", x0, unit.vanityH, 0, W, 1.5, D));
  const mirrorH = Math.max(8, unit.upperStart - unit.vanityH - 3.5);
  panels.push(panel("mirror", "Vanity mirror", kneeL, unit.vanityH + 2, 0.4, unit.kneeW, mirrorH, 0.2));
  const u0 = unit.upperStart;
  const uH = H - u0;
  panels.push(panel("bottom", "Upper bottom", x0 + P, u0, 0, W - P * 2, P, D));
  panels.push(panel("top", "Upper top", x0 + P, H - P, 0, W - P * 2, P, D));
  panels.push(panel("divider", "Upper center divider", -P / 2, u0, 0, P, uH, D));
  const shelfYs = [u0 + uH * 0.28, u0 + uH * 0.52, u0 + uH * 0.76];
  const bayW = (W - P * 3) / 2;
  shelfYs.forEach((y, i) => {
    panels.push(panel("shelf", `Left linen shelf ${i + 1}`, x0 + P, y, 0.1, bayW, P, D - 0.2));
    panels.push(panel("shelf", `Right towel shelf ${i + 1}`, P / 2, y, 0.1, bayW, P, D - 0.2));
  });
  panels.push(panel("door", "Left upper door", x0 + 0.1, u0, D - 0.35, W / 2 - 0.2, uH, 0.35));
  panels.push(panel("door", "Right upper door", 0.1, u0, D - 0.35, W / 2 - 0.2, uH, 0.35));
  const notes = [
    `Trapezoidal bathroom pocket. Back ${walls.backWidth}" · left depth ${walls.leftDepth}" @ ${walls.leftAngleDeg.toFixed(2)}° · right depth ${walls.rightDepth}" @ ${walls.rightAngleDeg.toFixed(2)}° · ${walls.height}" high.`,
    `Unit ${unit.width}" W × ${unit.depth}" D × ${unit.height}" H. Front parallel to the back wall. Centered on the back-wall centerline.`,
    `At the unit front (${unit.depth}"): left clearance ${clr.leftClear.toFixed(2)}" · right clearance ${clr.rightClear.toFixed(2)}" · opening ${clr.opening.toFixed(2)}".`,
    `Vanity counter at ${unit.vanityH}". Knee ${unit.kneeW}" clear, centered. Drawers in the wings. Uppers ${unit.upperStart}" to ${unit.height}".`,
    "Anchor the back and both uprights into studs. Do not rely on drywall alone — this is a 102\" mixed-use unit.",
    "Scribe the uprights if the back wall is out of plumb. The unit stays rectangular; the pocket is the thing that is wonky.",
    "Adjustable shelves on pins. Large doors. Mirror over the knee. Guidance only — confirm studs and plumbing before you cut.",
  ];
  if (clr.leftClear < 0.5 || clr.rightClear < 0.5) {
    notes.unshift("CRITICAL: the unit collides with a side wall at this depth. Pull the unit shallower or narrow it.");
  }
  return {
    id: createId("proj"),
    name: "Bathroom pocket vanity",
    prompt,
    kind: "closet",
    overall: { width: Math.max(walls.backWidth, clr.opening) + 4, height: walls.height + 2, depth: Math.max(walls.leftDepth, walls.rightDepth) + 2 },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: { width: walls.backWidth, height: walls.height, depth: Math.max(walls.leftDepth, walls.rightDepth), kind: "pocket" },
    pocket: { walls, unit, leftClear: clr.leftClear, rightClear: clr.rightClear },
    assumptions: { load: "medium", units: "inches", installMode: "alcove", wallType: "wood_stud" },
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
