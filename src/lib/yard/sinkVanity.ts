/**
 * Bathroom vanity is a sink base: doors (or typed drawers), a toe kick, a thin back
 * with a plumbing cutout, and a bought mirror. A makeup / dressing / knee-space
 * vanity stays the knee-hole desk and never comes through here.
 */
import { createId } from "@/lib/utils";
import { LEAF_GAP, doorLeaves, doorRise } from "./hingedLeaf";
import { featureBay } from "./heldObjects";
import { askedDrawerCount, asksDoors, asksDrawers, drawerSection } from "./frontSections";
import { P, PLY, isNoDoorsPrompt, panel, typedDoorCount } from "./fittedShared";
import { classDefaultAssumedNotes, classDefaultDensifyTitle, guidanceConfirmTalk } from "./voiceHonesty";
import type { FittedSpec, Panel, YardProject } from "./types";

/** Knee-hole desk: only when the prompt says makeup, dressing, or knee space. */
export function isMakeupVanityPrompt(lower: string): boolean {
  return /\b(?:makeup|make-up|dressing)\b/.test(lower) || /\bknee\s*space\b/.test(lower);
}

/** Floor sink base. A vanity mirror (the glass itself) and a pocket vanity are not this. */
export function isSinkVanityPrompt(lower: string): boolean {
  if (isMakeupVanityPrompt(lower) || /\bvanity\s+mirrors?\b/.test(lower) || /\bpocket\s+vanity\b/.test(lower)) return false;
  return /\bvanity\b/.test(lower);
}

/** Clear reach a ¼" sheet can hold. Stiles under the counter keep a thin sheet inside it. */
const SPAN_OK = 14;
const BACK_T = 0.25;

type Zone = { x: number; w: number; doors: number; drawers: number; pocket?: string };

function zones(innerX: number, innerW: number, doorN: number, drawerN: number, pocket: { w: number; name: string } | null): Zone[] {
  if (pocket && pocket.w + 10 < innerW) {
    const rest = zones(innerX + pocket.w + P, innerW - pocket.w - P, doorN, drawerN, null);
    return [{ x: innerX, w: pocket.w, doors: 0, drawers: 0, pocket: pocket.name }, ...rest];
  }
  if (drawerN > 0 && doorN >= 2 && drawerN >= 2 && innerW >= 36) {
    const side = Math.min(14, Math.max(11, (innerW - 14) / 2));
    const leftN = Math.ceil(drawerN / 2);
    const midW = innerW - side * 2 - 2 * P;
    return [
      { x: innerX, w: side, doors: 0, drawers: leftN },
      { x: innerX + side + P, w: midW, doors: doorN, drawers: 0 },
      { x: innerX + innerW - side, w: side, doors: 0, drawers: drawerN - leftN },
    ];
  }
  if (drawerN > 0 && doorN > 0) {
    const side = Math.min(16, Math.max(11, innerW * 0.38));
    return [
      { x: innerX, w: side, doors: 0, drawers: drawerN },
      { x: innerX + side + P, w: innerW - side - P, doors: doorN, drawers: 0 },
    ];
  }
  if (drawerN > 0) {
    const side = Math.min(16, Math.max(12, innerW * 0.4));
    return [
      { x: innerX, w: side, doors: 0, drawers: drawerN },
      { x: innerX + side + P, w: innerW - side - P, doors: 0, drawers: 0 },
    ];
  }
  return [{ x: innerX, w: innerW, doors: doorN, drawers: 0 }];
}

/** Bathroom sink base. Null when this prompt is not that form. */
export function buildSinkVanity(spec: FittedSpec, prompt: string): YardProject | null {
  const lower = prompt.toLowerCase();
  if (spec.program !== "vanity" || spec.walls || !isSinkVanityPrompt(lower)) return null;
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  let counterT = P;
  let bottomT = P;
  let kickH = H >= 16 ? 3.5 : 0;
  if (kickH + bottomT + counterT + 0.5 > H) {
    kickH = 0;
    const t = Math.max(0.25, (H - 0.5) / 3);
    counterT = t;
    bottomT = t;
  }
  const counterY = H - counterT;
  const bottomY = kickH;
  const wantDrawers = asksDrawers(lower);
  const wantDoors = asksDoors(lower);
  const drawerN = wantDrawers ? askedDrawerCount(lower) : 0;
  const doorN = isNoDoorsPrompt(lower) ? 0 : wantDoors ? typedDoorCount(prompt) ?? (W > 28 ? 2 : 1) : wantDrawers ? 0 : W > 28 ? 2 : 1;
  const bay = featureBay(prompt);
  const pocket = bay ? { w: Math.max(bay.object.width + 2, 8.5), name: bay.object.label } : null;
  const innerX = x0 + P;
  const innerW = Math.max(P, W - 2 * P);
  const front = zones(innerX, innerW, doorN, drawerN, pocket);
  const gap = counterY - (bottomY + bottomT);
  const falseH = drawerN === 0 && doorN > 0 && gap > 12 ? 5 : 0;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  // The box face is the typed depth. Doors stand ¾" proud of it, so the header can say that.
  const boxD = Math.max(P * 2, D - BACK_T);
  const uprightLen = Math.max(H, D);
  // A face longer than the uprights would take their plate letter. Split it into shorter pieces.
  const faceStrips = (type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const n = Math.max(1, Math.ceil(w / Math.max(4, uprightLen - 0.2)));
    const each = w / n;
    for (let i = 0; i < n; i++) {
      panels.push(panel(type, n === 1 ? name : `${name} ${i + 1}`, x + i * each, y, z, each, h, d));
    }
  };
  panels.push(panel("top", "Counter", innerX, counterY, BACK_T, innerW, counterT, boxD));
  if (kickH > 0) faceStrips("kick", "Toekick", innerX, 0, D - 3 - P, innerW, kickH, P);

  // A thin nailer under the counter, clear of it and of the bay dividers, so the stand step
  // can hang it on the uprights and the plumbing stays open below.
  const railH = Math.min(5, Math.max(2.5, counterY - bottomY - bottomT - 8));
  const railY = counterY - railH - 0.2;
  if (railH >= 2 && innerW > 4 && railY > bottomY + bottomT) panels.push(panel("back", "Back", innerX, railY, 0, innerW, railH, BACK_T));

  // Stations along the width, close enough for a ¼" sheet. Kick supports under the one bottom
  // hold it; stiles from the bottom up hold the counter, and stay out of a drawer bank.
  const stations: number[] = [];
  const addX = (x: number) => {
    if (x < innerX + 0.4 || x + P > innerX + innerW - 0.4) return;
    if (stations.some((q) => Math.abs(q - x) < P)) return;
    stations.push(x);
  };
  const nSpan = Math.ceil(innerW / SPAN_OK);
  for (let i = 1; i < nSpan; i++) addX(innerX + (innerW * i) / nSpan - P / 2);
  front.forEach((zone, i) => {
    if (i < front.length - 1) addX(zone.x + zone.w);
  });
  const inDrawer = (x: number) => front.some((z) => z.drawers > 0 && x + P > z.x + 0.3 && x < z.x + z.w - 0.3);
  const stileZ = BACK_T + 0.2;
  const stileD = Math.min(boxD * 0.6, Math.max(4, D - 3 - P - stileZ - 0.3));
  const stileH = counterY - (bottomY + bottomT);
  // The cut list still says Bottom. The name keeps the word "back" so a 1/4" sheet
  // (every face thinned) still screws this panel to the uprights.
  const bottom = panel("bottom", "Bottom (open back)", innerX, bottomY, BACK_T, innerW, bottomT, boxD);
  panels.push(bottom);
  // Bay dividers stand on the floor and are notched through the bottom, so a thinner sheet
  // still leaves them standing.
  for (const x of stations) {
    if (kickH >= 2) panels.push(panel("divider", "Kick support", x, 0, stileZ, P, kickH, Math.min(stileD, boxD - (stileZ - BACK_T) - 0.1)));
    if (!inDrawer(x) && counterY > 4 && stileD > 2) {
      const zone = front.find((z) => x >= z.x - 0.1 && x <= z.x + z.w + 0.1);
      const name = zone?.pocket ? `${zone.pocket} pocket divider` : "Sink bay divider";
      const stile = panel("divider", name, x, 0, stileZ, P, counterY, stileD);
      stile.joints = [{ with: bottom.id, kind: "notch" }];
      bottom.joints = [...(bottom.joints ?? []), { with: stile.id, kind: "notch" }];
      panels.push(stile);
    }
  }
  front.forEach((zone) => {
    if (zone.drawers > 0 && zone.w > 2 && stileH > 2) {
      const clear = counterY - (bottomY + bottomT);
      const shares = clear / zone.drawers > 12;
      panels.push(...drawerSection({
        x0: zone.x,
        innerW: zone.w,
        yBottom: bottomY + bottomT,
        yTop: counterY,
        depth: D,
        count: zone.drawers,
        width: zone.w,
        shares,
        rowIn: shares ? 8 : undefined,
      }).panels);
    }
    if (zone.doors > 0 && zone.w > 2 && gap - falseH > 0.5) {
      const rise = doorRise(bottomY + bottomT, counterY - falseH - (bottomY + bottomT));
      if (rise.h > 0.25 && zone.w > 1) {
        // Cover 1/4" of the upright beside the opening, and 1/4" of the counter front when no false front is there.
        const leaves = doorLeaves({ x: zone.x, w: zone.w, count: zone.doors });
        const lap = LEAF_GAP.reveal + 0.25;
        const topLap = falseH > 0 ? 0 : lap;
        if (zone.x <= innerX + 0.2) { leaves[0].x -= lap; leaves[0].w += lap; }
        if (zone.x + zone.w >= innerX + innerW - 0.2) leaves[leaves.length - 1].w += lap;
        for (const leaf of leaves) {
          panels.push(panel("door", leaf.name, leaf.x, rise.y, D, Math.max(0.5, leaf.w), rise.h + topLap, P));
        }
      }
    }
  });
  if (falseH > 0) faceStrips("rail", "False front", innerX - 0.25, counterY - falseH, D, innerW + 0.5, falseH, P);

  // A bought mirror hangs above the counter. Doors typed without the word mirror do not invent one. Never plywood.
  const wantMirror = /\bmirrors?\b/.test(lower) || !/\bdoors?\b/.test(lower);
  if (wantMirror) {
    const mirrorW = Math.max(8, W - 4);
    const mirror = panel("mirror", "Mirror", -mirrorW / 2, H, 0, mirrorW, Math.min(30, Math.max(12, W * 0.6)), 0.25, "hardware");
    mirror.id = createId("mirror");
    panels.push(mirror);
  }

  const name = classDefaultDensifyTitle("Vanity", prompt, { width: W, height: H, depth: D });
  const frontTalk =
    doorN && drawerN
      ? `${doorN} door${doorN === 1 ? "" : "s"} and ${drawerN} drawer${drawerN === 1 ? "" : "s"}`
      : doorN
        ? `${doorN} door${doorN === 1 ? "" : "s"}`
        : drawerN
          ? `${drawerN} drawer${drawerN === 1 ? "" : "s"}`
          : "an open front";
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
      unit: {
        ...u,
        width: W,
        depth: D,
        height: H,
        counterH: H,
        kneeW: undefined,
        shelfCount: 0,
        doors: doorN > 0,
        drawersPerBank: drawerN || undefined,
        mirror: wantMirror,
        rod: false,
      },
    },
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}
