/** Sink base for a bath, sink, or plumbing cue, or a bare vanity with a typed counter of 30–36. Bedroom, makeup, seating, stool, table, or mirror cues stay the knee-hole desk. The plumbing corridor stays clear. */
import { createId } from "@/lib/utils";
import { LEAF_GAP, doorLeaves, doorRise } from "./hingedLeaf";
import { featureBay } from "./heldObjects";
import { askedDrawerCount, asksDoors, asksDrawers, drawerSection } from "./frontSections";
import { P, PLY, isNoDoorsPrompt, panel, typedDoorCount, typedHeightInches } from "./fittedShared";
import { detectMaterial } from "./promptHelpers";
import { classDefaultAssumedNotes, classDefaultDensifyTitle, guidanceConfirmTalk } from "./voiceHonesty";
import type { FittedSpec, Panel, YardProject } from "./types";

const PLUMB = /\b(?:bathrooms?|sinks?|baths?|plumbing)\b/;
const DESK = /\b(?:bedrooms?|makeup|make-up|dressing|seating)\b|\bsit(?:s|ting)?\b|\b(?:stools?|chairs?|tables?|mirrors?)\b|\bknee\s*space\b/;
const SPAN_OK = 14;
const BACK_T = 0.25;

export function isSinkVanityPrompt(lower: string, typedHeight?: number): boolean {
  if (!/\bvanity\b/.test(lower) || /\bvanity\s+mirrors?\b/.test(lower) || /\bpocket\s+vanity\b/.test(lower)) return false;
  if (PLUMB.test(lower)) return true;
  if (DESK.test(lower)) return false;
  const h = typedHeightInches(lower) ?? typedHeight;
  return h != null && h >= 30 && h <= 36;
}

type Zone = { x: number; w: number; doors: number; drawers: number; pocket?: string };

function zones(innerX: number, innerW: number, doorN: number, drawerN: number, pocket: { w: number; name: string } | null): Zone[] {
  if (pocket && pocket.w + 10 < innerW) {
    return [{ x: innerX, w: pocket.w, doors: 0, drawers: 0, pocket: pocket.name }, ...zones(innerX + pocket.w + P, innerW - pocket.w - P, doorN, drawerN, null)];
  }
  if (drawerN > 0 && doorN >= 2 && drawerN >= 2 && innerW >= 36) {
    const side = Math.min(14, Math.max(11, (innerW - SPAN_OK) / 2));
    const leftN = Math.ceil(drawerN / 2);
    return [
      { x: innerX, w: side, doors: 0, drawers: leftN },
      { x: innerX + side + P, w: innerW - side * 2 - 2 * P, doors: doorN, drawers: 0 },
      { x: innerX + innerW - side, w: side, doors: 0, drawers: drawerN - leftN },
    ];
  }
  if (drawerN > 0) {
    const side = Math.min(16, Math.max(doorN > 0 ? 11 : 12, innerW * (doorN > 0 ? 0.38 : 0.4)));
    return [
      { x: innerX, w: side, doors: 0, drawers: drawerN },
      { x: innerX + side + P, w: innerW - side - P, doors: doorN, drawers: 0 },
    ];
  }
  return [{ x: innerX, w: innerW, doors: doorN, drawers: 0 }];
}
export function buildSinkVanity(spec: FittedSpec, prompt: string): YardProject | null {
  const lower = prompt.toLowerCase();
  const typedH = spec.typedAxes?.height ? spec.unit.height : undefined;
  if (spec.program !== "vanity" || spec.walls || !isSinkVanityPrompt(lower, typedH)) return null;
  const u = spec.unit;
  const { width: W, height: H, depth: D } = u;
  const x0 = -W / 2;
  let counterT = P;
  let bottomT = P;
  let kickH = H >= 16 ? 3.5 : 0;
  if (kickH + bottomT + counterT + 0.5 > H) {
    kickH = 0;
    counterT = Math.max(0.25, (H - 0.5) / 3);
    bottomT = counterT;
  }
  const counterY = H - counterT;
  const bottomY = kickH;
  const wantDrawers = asksDrawers(lower);
  const wantDoors = asksDoors(lower);
  const drawerN = wantDrawers ? askedDrawerCount(lower) : 0;
  const doorN = isNoDoorsPrompt(lower) ? 0 : wantDoors ? typedDoorCount(prompt) ?? (W > 28 ? 2 : 1) : wantDrawers ? 0 : W > 28 ? 2 : 1;
  const bay = featureBay(prompt);
  const innerX = x0 + P;
  const innerW = Math.max(P, W - 2 * P);
  const corridorX = innerX + (innerW - Math.min(SPAN_OK, innerW)) / 2;
  const pocketW = bay ? Math.min(Math.max(bay.object.width + 2, 8.5), Math.max(P * 2, corridorX - innerX - P)) : 0;
  const pocket = bay && pocketW + 10 < innerW ? { w: pocketW, name: bay.object.label } : null;
  const front = zones(innerX, innerW, doorN, drawerN, pocket);
  const gap = counterY - (bottomY + bottomT);
  const falseH = drawerN === 0 && doorN > 0 && gap > 12 ? 5 : 0;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  const boxD = Math.max(P * 2, D - BACK_T);
  const mat0 = detectMaterial(prompt);
  const sheetT = mat0.dims.thickness ?? mat0.dims.height ?? P;
  const thinSheet = sheetT <= 0.3;
  panels.push(panel("top", "Counter", innerX, counterY, thinSheet ? 0 : BACK_T, innerW, counterT, boxD + (thinSheet ? BACK_T : 0)));
  const uprightLen = Math.max(H, D);
  const faceStrips = (type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const n = Math.max(1, Math.ceil(w / Math.max(4, uprightLen - 0.2)));
    const each = w / n;
    for (let i = 0; i < n; i++) panels.push(panel(type, n === 1 ? name : `${name} ${i + 1}`, x + i * each, y, z, each, h, d));
  };
  if (kickH > 0) faceStrips("kick", "Toekick", innerX, 0, D - 3 - P, innerW, kickH, P);
  const railH = Math.min(5, Math.max(2.5, counterY - bottomY - bottomT - 8));
  const railY = counterY - railH - (thinSheet ? 0 : 0.2);
  if (railH >= 2 && innerW > 4 && railY > bottomY + bottomT) panels.push(panel("back", "Back", innerX, railY, 0, innerW, railH, BACK_T));

  const maxClear = sheetT <= 0.3 ? SPAN_OK : sheetT >= 1.1 ? 72 : 36;
  const doors = front.filter((z) => z.doors > 0);
  const sink = doors.length ? doors : front.filter((z) => !z.pocket && z.drawers === 0);
  const zoneX = sink.length ? Math.min(...sink.map((z) => z.x)) : innerX;
  const zoneW = sink.length ? Math.max(...sink.map((z) => z.x + z.w)) - zoneX : innerW;
  const bayW = Math.min(zoneW, sheetT <= 0.3 ? SPAN_OK : Math.max(SPAN_OK, maxClear - 1));
  const bayX = zoneX + (zoneW - bayW) / 2;
  const hitsBay = (x: number, w = P) => x < bayX + bayW - 0.02 && x + w > bayX + 0.02;
  const xs: number[] = [];
  const addX = (x: number) => {
    if (x < innerX + 0.4 || x + P > innerX + innerW - 0.4 || hitsBay(x) || xs.some((q) => Math.abs(q - x) < P)) return;
    xs.push(x);
  };
  front.forEach((zone, i) => { if (i < front.length - 1) addX(zone.x + zone.w); });
  const stops = () => [innerX, ...xs.map((x) => x + P / 2), innerX + innerW].sort((a, b) => a - b);
  if (stops().reduce((m, x, i, a) => (i ? Math.max(m, x - a[i - 1]) : 0), 0) > maxClear) {
    addX(bayX - P);
    addX(bayX + bayW);
  }
  // A thin face is planed in place, so the stile stands on the floor in front of the bottom instead of notching it.
  const thin = sheetT <= 0.3 && xs.length > 0;
  const toeZ = D - 3 - P;
  const stileD = thin ? Math.max(boxD * 0.54, 11) : Math.min(boxD * 0.62, Math.max(4, toeZ - BACK_T - 0.5));
  const stileZ = thin ? Math.max(BACK_T + 0.3, toeZ - 0.7 - stileD) : BACK_T + 0.2;
  const bottomD = thin ? Math.max(4, stileZ - BACK_T - 0.25) : boxD;
  panels.push(panel("bottom", "Bottom (open back)", innerX, bottomY, BACK_T, innerW, bottomT, bottomD));
  const stileY = thin ? 0 : bottomY + bottomT;
  for (const x of xs) {
    const side = front.find((z) => z.pocket && Math.abs(z.x + z.w - x) < 0.2);
    const h = counterY - stileY;
    if (h > 2 && stileD > 2 && !hitsBay(x)) panels.push(panel("rail", side?.pocket ? `${side.pocket} pocket wall` : "Bay stile", x, stileY, stileZ, P, h, stileD));
    if (kickH >= 2 && !hitsBay(x)) panels.push(panel("rail", "Kick support", x, 0, BACK_T + 0.2, P, kickH, Math.min(bottomD * 0.8, bottomD - 0.3)));
  }
  front.forEach((zone) => {
    if (zone.drawers > 0 && zone.w > 2 && counterY - (bottomY + bottomT) > 2) {
      const clear = counterY - (bottomY + bottomT);
      const shares = clear / zone.drawers > 12;
      panels.push(...drawerSection({
        x0: zone.x, innerW: zone.w, yBottom: bottomY + bottomT, yTop: counterY, depth: D,
        count: zone.drawers, width: zone.w, shares, rowIn: shares ? 8 : undefined,
      }).panels);
    }
    if (zone.doors > 0 && zone.w > 2 && gap - falseH > 0.5) {
      const rise = doorRise(bottomY + bottomT, counterY - falseH - (bottomY + bottomT));
      if (rise.h > 0.25 && zone.w > 1) {
        const leaves = doorLeaves({ x: zone.x, w: zone.w, count: zone.doors });
        const lap = LEAF_GAP.reveal + 0.25;
        if (zone.x <= innerX + 0.2) { leaves[0].x -= lap; leaves[0].w += lap; }
        if (zone.x + zone.w >= innerX + innerW - 0.2) leaves[leaves.length - 1].w += lap;
        for (const leaf of leaves) panels.push(panel("door", leaf.name, leaf.x, rise.y, D, Math.max(0.5, leaf.w), rise.h + (falseH > 0 ? 0 : lap), P));
      }
    }
  });
  if (falseH > 0) faceStrips("rail", "False front", innerX - 0.25, counterY - falseH, D, innerW + 0.5, falseH, P);

  const wantMirror = /\bmirrors?\b/.test(lower) && !/\bno\s+mirror\b/.test(lower);
  if (wantMirror) {
    const mirrorW = Math.max(8, W - 4);
    const mirror = panel("mirror", "Mirror", -mirrorW / 2, H, 0, mirrorW, Math.min(30, Math.max(12, W * 0.6)), 0.25, "hardware");
    mirror.id = createId("mirror");
    panels.push(mirror);
  }

  const name = classDefaultDensifyTitle("Vanity", prompt, { width: W, height: H, depth: D });
  const frontTalk = doorN && drawerN ? `${doorN} door${doorN === 1 ? "" : "s"} and ${drawerN} drawer${drawerN === 1 ? "" : "s"}` : doorN ? `${doorN} door${doorN === 1 ? "" : "s"}` : drawerN ? `${drawerN} drawer${drawerN === 1 ? "" : "s"}` : "an open front";
  const notes = [
    `${name}. Stands on its own on the floor.`,
    `Unit ${W}" W × ${D}" D × ${H}" H. ¾" plywood.`,
    `Sink base with ${frontTalk}${kickH > 0 ? " and a toe kick" : ""}. The back is open below a top nailer so the drain and the supply lines come through. No shelf runs through that opening.${falseH > 0 ? " A false front sits under the top, where a drawer would hit the bowl." : ""}`,
    ...(wantMirror ? ["The mirror is a bought piece. It is not cut from plywood."] : []),
    guidanceConfirmTalk(`${prompt} ${name}`, "floor"),
    ...classDefaultAssumedNotes(prompt, "Vanity", { width: W, height: H, depth: D }),
  ];
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: spec.opening,
    fitted: {
      ...spec,
      name,
      unit: { ...u, width: W, depth: D, height: H, counterH: H, kneeW: undefined, shelfCount: 0, doors: doorN > 0, drawersPerBank: drawerN || undefined, mirror: wantMirror, rod: false },
    },
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}
