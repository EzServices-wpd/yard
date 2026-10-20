/**
 * Bathroom vanity is a sink base: doors (or typed drawers) over a plumbing opening,
 * a toe kick, an open back, and a bought mirror. A makeup / dressing / knee-space
 * vanity stays the knee-hole desk and never comes through here.
 */
import { createId } from "@/lib/utils";
import { doorLeaves, doorRise } from "./hingedLeaf";
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

/** Clear reach a ¼" sheet can hold. Stiles at the plumbing opening keep a thin-stock counter inside it. */
const SPAN_OK = 14;

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
  // Faces sit on the opening, flush with the uprights. The box stops behind that plane so a thinner sheet
  // does not pull the front back and change the size.
  const faceZ = D - P;
  const boxD = Math.max(P * 2, faceZ - 0.08);
  panels.push(panel("top", "Counter", innerX, counterY, 0, innerW, counterT, boxD));
  if (kickH > 0) panels.push(panel("kick", "Toekick", innerX, 0, D - kickH, innerW, kickH, P));

  // Back is open through the center so the trap and supplies come in. Side pieces keep the box from racking.
  const interiorH = counterY - (bottomY + bottomT);
  const cutW = Math.min(14, innerW - 8);
  if (cutW >= 6 && interiorH >= 6) {
    const sideW = (innerW - cutW) / 2;
    const cutTop = bottomY + bottomT + Math.min(12, interiorH - 2);
    panels.push(panel("back", "Left back", innerX, 0, 0, sideW, H, P));
    panels.push(panel("back", "Right back", innerX + sideW + cutW, 0, 0, sideW, H, P));
    if (H - cutTop > 1) panels.push(panel("back", "Back rail", innerX + sideW, cutTop, 0, cutW, H - cutTop, P));
  }

  const stileZ = P;
  // Stop short of the toe kick and of the door face. A post that reaches either one shares its space.
  const stileEnd = Math.min(D - P - 0.05, kickH >= 2 ? D - kickH - 0.1 : D - P - 0.05);
  const stileD = Math.max(1, stileEnd - stileZ);
  const stileY = bottomY + bottomT;
  const stileH = Math.max(0.5, counterY - stileY);
  // Posts run to the floor, so a thinner sheet (the bottom gets shorter) still leaves them standing on something.
  const posts: { x: number; name: string }[] = [];
  const addPost = (x: number, name: string) => {
    if (x < innerX - 0.1 || x + P > innerX + innerW + 0.1) return;
    if (posts.some((q) => Math.abs(q.x - x) < P)) return;
    posts.push({ x, name });
  };
  front.forEach((zone, i) => {
    if (i < front.length - 1) addPost(zone.x + zone.w, zone.pocket ? `${zone.pocket} pocket divider` : "Bay divider");
    if (zone.drawers > 0 && zone.w > 2 && stileH > 2) {
      const clear = counterY - stileY;
      const shares = clear / zone.drawers > 12;
      const sec = drawerSection({
        x0: zone.x,
        innerW: zone.w,
        yBottom: stileY,
        yTop: counterY,
        depth: D,
        count: zone.drawers,
        width: zone.w,
        shares,
        rowIn: shares ? 8 : undefined,
      });
      panels.push(...sec.panels);
    }
    if (zone.doors > 0 && zone.w > 2 && gap - falseH > 0.5) {
      const rise = doorRise(bottomY, counterY - falseH - bottomY);
      const leafX = zone.x;
      const leafR = zone.x + zone.w;
      if (rise.h > 0.25 && leafR - leafX > 1) {
        for (const leaf of doorLeaves({ x: leafX, w: leafR - leafX, count: zone.doors })) {
          panels.push(panel("door", leaf.name, leaf.x, rise.y, D - P, Math.max(0.5, leaf.w), rise.h, P));
        }
      }
    }
    // Stiles at the edges of the plumbing opening. The opening stays clear; the counter and bottom are held on either side of it.
    if (zone.drawers === 0 && zone.w > SPAN_OK && stileH > 2) {
      const hole = Math.min(13, Math.max(8, zone.w - 10));
      if (zone.w - hole >= 3) {
        const mid = zone.x + zone.w / 2;
        const left = mid - hole / 2 - zone.x;
        const ats = [mid - hole / 2 - P, mid + hole / 2];
        if (left > SPAN_OK) ats.push(zone.x + left / 2 - P / 2);
        if (zone.w - left - hole > SPAN_OK) ats.push(mid + hole / 2 + (zone.w - left - hole) / 2 - P / 2);
        for (const at of ats) addPost(at, "Sink bay divider");
      }
    }
  });
  const cuts = posts.map((q) => q.x).sort((a, b) => a - b);
  let cursor = innerX;
  const boxEnd = innerX + innerW;
  const spans: [number, number][] = [];
  for (const x of cuts) {
    if (x > cursor + 1) spans.push([cursor, Math.min(x, boxEnd)]);
    cursor = Math.max(cursor, x + P);
  }
  if (boxEnd > cursor + 1) spans.push([cursor, boxEnd]);
  for (const [a, b] of spans) {
    panels.push(panel("bottom", "Bottom", a, bottomY, 0, b - a, bottomT, boxD));
    // Across the depth, not along it: a ¼" bottom is checked on its deep axis, and a rail thin that way holds it.
    if (kickH >= 2 && b - a > P * 2) {
      const z = Math.min((D - P) / 2, D - kickH - P - 0.15);
      panels.push(panel("divider", "Kick support", a, 0, Math.max(P, z), b - a, kickH, P));
    }
  }
  for (const post of posts) panels.push(panel("divider", post.name, post.x, 0, stileZ, P, counterY, stileD));
  if (falseH > 0) panels.push(panel("rail", "False front", innerX, counterY - falseH, faceZ, innerW, falseH, P));

  // Bought mirror, hung on the wall above the counter. Never a plywood part.
  const mirrorW = Math.max(8, W - 4);
  const mirror = panel("mirror", "Mirror", -mirrorW / 2, H, 0, mirrorW, Math.min(30, Math.max(12, W * 0.6)), 0.25, "hardware");
  mirror.id = createId("mirror");
  panels.push(mirror);

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
    `Sink base with ${frontTalk}${kickH > 0 ? ", a toe kick," : ""} and the back open in the center for the drain and supplies. No shelf runs through that opening.${falseH > 0 ? " A false front sits under the top, where a drawer would hit the bowl." : ""}`,
    "The mirror is a bought piece. It is not cut from plywood.",
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
        mirror: true,
        rod: false,
      },
    },
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}
