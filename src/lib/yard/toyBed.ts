/**
 * Toy-scale bed frame: four corner legs, side/end rails, and a flat rectangular deck.
 * Built as stick instances (popsicle / craft) so the model reads as a bed — not a
 * recast platform-bed lattice that sprawls past the overall box.
 */
import { createId } from "@/lib/utils";
import { toPrimitive } from "./geometry";
import { rotationForDirection } from "./structureGraph";
import type { CatalogItem, Vec3, YardInstance, YardProject } from "./types";
import { fallbackNote } from "./fallbackPrimitive";

function r(n: number) {
  return Math.round(n * 1000) / 1000;
}

function member(item: CatalogItem, a: Vec3, b: Vec3, role: string): YardInstance {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const [rx, ry, rz] = rotationForDirection(a, b, false);
  return {
    id: createId("bed"),
    catalogId: item.id,
    position: { x: r((a.x + b.x) / 2), y: r((a.y + b.y) / 2), z: r((a.z + b.z) / 2) },
    rotation: { x: rx, y: ry, z: rz },
    cutLength: Math.round(len * 16) / 16,
    role,
    join: item.preferredJoins?.[0] ?? "glue",
    from: { x: r(a.x), y: r(a.y), z: r(a.z) },
    to: { x: r(b.x), y: r(b.y), z: r(b.z) },
  };
}

/** Four posts, perimeter rails, and deck slats inside the typed (or default) envelope. */
export function buildToyBedFrame(
  prompt: string,
  item: CatalogItem,
  size: { width: number; height: number; depth: number },
  noun: string,
): YardProject {
  const prim = toPrimitive(item);
  const tw = Math.max(0.2, prim.width || 0.375);
  // Every marked cut must fit one stick — scale the bed to the stock, never ask for a
  // 13″ rail from a 4½″ popsicle. Span members run between legs (outer − 2× stick).
  const stockLen = Math.max(2, item.dims.length ?? 4.5);
  const maxOuter = stockLen + tw * 2;
  const W = Math.max(tw * 4, Math.min(size.width, maxOuter));
  const D = Math.max(tw * 4, Math.min(size.depth, maxOuter));
  const H = Math.max(tw * 2, Math.min(size.height, stockLen));
  const x0 = -W / 2;
  const x1 = W / 2;
  const z0 = 0;
  const z1 = D;
  const deckY = Math.max(tw * 2, H * 0.55);
  const instances: YardInstance[] = [];

  // Four corner legs — floor to deck height, clear posts.
  const legs: [Vec3, Vec3][] = [
    [{ x: x0 + tw / 2, y: 0, z: z0 + tw / 2 }, { x: x0 + tw / 2, y: H, z: z0 + tw / 2 }],
    [{ x: x1 - tw / 2, y: 0, z: z0 + tw / 2 }, { x: x1 - tw / 2, y: H, z: z0 + tw / 2 }],
    [{ x: x0 + tw / 2, y: 0, z: z1 - tw / 2 }, { x: x0 + tw / 2, y: H, z: z1 - tw / 2 }],
    [{ x: x1 - tw / 2, y: 0, z: z1 - tw / 2 }, { x: x1 - tw / 2, y: H, z: z1 - tw / 2 }],
  ];
  for (const [a, b] of legs) instances.push(member(item, a, b, "leg"));

  // Perimeter rails at deck height (side = long, end = short).
  // End rails butt the legs' inner faces; side rails run between the legs along the depth.
  const th = Math.max(0.03, prim.height || 0.08);
  const ex = tw / 2 + th / 2;
  const rails: [Vec3, Vec3][] = [
    [{ x: x0 + ex, y: deckY, z: z0 + tw / 2 }, { x: x1 - ex, y: deckY, z: z0 + tw / 2 }],
    [{ x: x0 + ex, y: deckY, z: z1 - tw / 2 }, { x: x1 - ex, y: deckY, z: z1 - tw / 2 }],
    [{ x: x0 + tw / 2, y: deckY, z: z0 + tw }, { x: x0 + tw / 2, y: deckY, z: z1 - tw }],
    [{ x: x1 - tw / 2, y: deckY, z: z0 + tw }, { x: x1 - tw / 2, y: deckY, z: z1 - tw }],
  ];
  for (const [a, b] of rails) instances.push(member(item, a, b, "rail"));

  // Rectangular deck: slats spanning the width, resting on the side rails, spaced along the depth.
  const slatL = Math.min(stockLen, W - tw);
  const innerD = Math.max(tw * 2, D - tw * 2);
  const nSlats = Math.max(4, Math.min(8, Math.round(innerD / Math.max(tw * 2.2, 0.9))));
  for (let i = 0; i < nSlats; i++) {
    const t = nSlats === 1 ? 0.5 : i / (nSlats - 1);
    const z = z0 + tw + t * (D - tw * 2);
    instances.push(
      member(
        item,
        { x: -slatL / 2, y: deckY + th, z },
        { x: slatL / 2, y: deckY + th, z },
        "deck",
      ),
    );
  }

  const title = noun.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: createId("proj"),
    name: title,
    prompt,
    typedPrompt: prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances,
    panels: [],
    primaryMaterialId: item.id,
    notes: [fallbackNote(noun.toLowerCase(), "bed frame on legs")],
    historic: false,
    assumptions: {
      load: "light",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "display",
    },
  };
}
