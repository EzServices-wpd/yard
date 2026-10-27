/**
 * PR 16 Shop light (plan L610, L612): a warm raking key on wood, a cool fill so white PVC and kraft
 * cardboard keep their real colour, a firmer soft contact shadow, and plywood cut edges that show
 * their plies. Lights and materials only: no geometry, no part counts, no sizes, no prices.
 * Night shop B: chalk blue marks measurements only, so it never appears in the light rig.
 */
import * as THREE from "three";
import type { StockLook } from "@/lib/yard/stockLook";
import type { CatalogItem } from "@/lib/yard/types";

export const SHOP_LIGHT = {
  ambient: 0.1,
  /** Ground bounce on the Night shop ground (SHOP_GROUND.bg), not a warm brown. */
  hemi: { sky: "#ffe9cc", ground: "#131518", fitted: 0.28, loose: 0.36 },
  /** Warm shop lamp, low and from the side so it rakes across grain and edges. */
  key: { color: "#ffdcae", fitted: 2.3, loose: 2.0 },
  /** Cool fill: balances the warm key so whites (PVC, paint) and kraft stay neutral. */
  fill: { color: "#c9d8ec", fitted: 0.55, loose: 0.45 },
  rim: { color: "#ffcf96", intensity: 0.34 },
  /** Opacity of the soft footprint (contact) shadow under the model. */
  contact: 0.7,
} as const;

/**
 * Night shop ground for the 3D bench, so the canvas meets the workspace chrome with no seam: bg is the
 * `--color-bg` value (#131518) from PR #172, the floor one step up (`--color-surface`), grid lines on `--color-border`.
 * three.js can't read CSS variables, so these are the values, not new tokens. Colours only.
 */
export const SHOP_GROUND = { bg: "#131518", floor: "#1c1f23", gridCell: "#131518", gridSection: "#2c3136" } as const;

/**
 * Bench inks and marks on Night shop B (scripts/bench-colors.test.ts keeps each equal to its src/styles.css token).
 * Part materials and scale props keep their own real-world colours; these are the bench's drawn marks only.
 */
export const BENCH_INK = {
  ink: "#eceae6", // --color-fg: Form (historic) ghost lines and the scale figure
  stepEdge: "#7cb2ff", // --color-mark: edges of the current build step (chalk blue marks progress)
  stepGlow: "#eceae6", // --color-fg: a neutral lift so the step's parts keep their real wood tone (no glow tint)
  contact: "#000000", // the footprint shadow: absence of light, neutral on the cool ground (not a palette colour)
} as const;

/** Mark line opacities: each reaches 3:1 on the bench bg, floor and lit floor (WCAG 1.4.11, non-text indicators). */
export const MARK_ALPHA = { measure: 0.6, ghostMain: 0.8, ghostFine: 0.75 } as const;

/** Raking key position: lower and further to the side than a studio key. */
export function shopKeyPosition(span: number, height: number): [number, number, number] {
  return [-span * 0.95, Math.max(height * 1.05, 40), span * 0.55];
}

/** Wood tuning under the warm key: less grey HDR wash, a touch more satin so the rake reads. */
export function shopLook(look: StockLook, item?: CatalogItem | null): StockLook {
  const cat = item?.category;
  // Only the wood and ply maps: kraft (card map) and every unmapped stock (PVC, metal, glass, foam) keep today's look.
  if (!look.map || cat === "cardboard" || cat === "paper_tube" || cat === "recycled") return look;
  return { ...look, env: +(look.env * 0.8).toFixed(3), roughness: Math.max(0.5, +(look.roughness - 0.04).toFixed(3)) };
}

/** Plies a plywood edge shows: 1/4″ → 3, 1/2″ → 5, 3/4″ → 7. Not plywood (MDF, lumber, card) → 0. */
export function plyCount(item: CatalogItem | null | undefined, thickness: number): number {
  if (!item || item.category !== "sheet_goods" || !/ply/i.test(`${item.id} ${item.name}`)) return 0;
  if (thickness <= 0.3) return 3;
  if (thickness <= 0.56) return 5;
  return 7;
}

const plyMaps = new Map<string, THREE.CanvasTexture>();

/**
 * A tiny cached edge map: alternating face and cross-grain veneers with dark glue lines.
 * `axis` is the UV axis that runs across the panel's thickness on that strip face.
 */
export function plyEdgeMap(plies: number, axis: "u" | "v"): THREE.CanvasTexture | null {
  if (plies <= 0 || typeof document === "undefined") return null;
  const key = `${plies}${axis}`;
  const hit = plyMaps.get(key);
  if (hit) return hit;
  const n = 64;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d");
  if (!g) return null;
  const band = n / plies;
  for (let i = 0; i < plies; i++) {
    g.fillStyle = i % 2 === 0 ? "#e8d1a2" : "#c49b62";
    const a = Math.round(i * band), b = Math.round((i + 1) * band);
    if (axis === "v") g.fillRect(0, a, n, b - a);
    else g.fillRect(a, 0, b - a, n);
    g.fillStyle = "rgba(74,50,24,0.55)";
    if (i > 0) {
      if (axis === "v") g.fillRect(0, a, n, 1);
      else g.fillRect(a, 0, 1, n);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  plyMaps.set(key, tex);
  return tex;
}
