/**
 * Checked store listings for the stock and hardware the C15/C16 passes put on Buy. Every price here was read off the
 * store's own listing on the checked date (Home Depot product or category pages); none is an estimate. Each row links to
 * that product page, so the store term is the product itself (C12 leaves product pages as they are).
 */
import type { BomLine } from "./types";
import { checkedOffer } from "./listings";

export { checkedOffer };

export const STOCK_CHECKED_AT = "2026-10-16";

export type Checked = { name: string; title: string; href: string; packQty: number; packPrice: number };

/** Untreated western red cedar, Home Depot, checked 2026-10-16: the rot-resistant stock for food, skin and nest contact. */
export const CEDAR: Record<string, Checked> = {
  "lumber-1x2-8": { name: "1×2 cedar (8 ft)", title: "1 in. x 2 in. x 8 ft. Cedar Board", href: "https://www.homedepot.com/p/1-in-x-2-in-x-8-ft-Cedar-Board-234926/203429559", packQty: 1, packPrice: 4.05 },
  "lumber-1x6-8": { name: "1×6 cedar (8 ft)", title: "1 in. x 6 in. x 8 ft. S1S2E Cedar Board", href: "https://www.homedepot.com/p/1-in-x-6-in-x-8-ft-S1S2E-Cedar-Board-168CS1S2E/205407582", packQty: 1, packPrice: 19.98 },
  "lumber-2x2-8": { name: "2×2 cedar (8 ft)", title: "2 in. x 2 in. x 8 ft. S4S Cedar Dimensional Lumber", href: "https://www.homedepot.com/p/2-in-x-2-in-x-8-ft-S4S-Cedar-Dimensional-Lumber-281799/301040209", packQty: 1, packPrice: 11.88 },
  "lumber-2x4-8": { name: "2×4 cedar (8 ft)", title: "2 in. x 4 in. x 8 ft. Premium S4S Cedar Lumber", href: "https://www.homedepot.com/p/2-in-x-4-in-x-8-ft-Premium-S4S-Cedar-Lumber-281800/301040956", packQty: 1, packPrice: 9.67 },
  "lumber-2x6-8": { name: "2×6 cedar (8 ft)", title: "2 in. x 6 in. x 8 ft. Premium S4S Cedar Lumber", href: "https://www.homedepot.com/p/2-in-x-6-in-x-8-ft-Premium-S4S-Cedar-Lumber-12508/313685674", packQty: 1, packPrice: 18.38 },
  "lumber-4x4-8": { name: "4×4 cedar (8 ft)", title: "4 in. x 4 in. x 8 ft. Clear Cedar Lumber", href: "https://www.homedepot.com/p/4-in-x-4-in-x-8-ft-Clear-Cedar-Lumber-264784/204723742", packQty: 1, packPrice: 15.09 },
};

/** BC sanded pine plywood (exterior glue), Home Depot BC plywood listing, checked 2026-10-16. Interior sheets map by thickness. */
const BC_LIST = "https://www.homedepot.com/b/Lumber-Composites-Plywood/BC/N-5yc1vZbqm7Z1z1tlvp";
export const EXTERIOR_PLY: Record<string, Checked> = {
  "plywood-3-4-4x8": { name: "23/32\" BC exterior plywood 4×8", title: "Plytanium 23/32 in. x 4 ft. x 8 ft. BC Sanded Pine Plywood", href: BC_LIST, packQty: 1, packPrice: 51.31 },
  "plywood-1-2-4x8": { name: "15/32\" BC exterior plywood 4×8", title: "Plytanium 15/32 in. x 4 ft. x 8 ft. BC Sanded Pine Plywood", href: BC_LIST, packQty: 1, packPrice: 42.78 },
  "plywood-1-4-4x8": { name: "1/4\" BC exterior plywood 4×8", title: "Plytanium 1/4 in. x 4 ft. x 8 ft. BC Sanded Pine Plywood", href: BC_LIST, packQty: 1, packPrice: 31.82 },
};

/** Bought hardware the engine draws (casters, screw eyes) and the screws its steps name, checked 2026-10-16 at Home Depot. */
export const HARDWARE: Record<string, Checked> = {
  caster: { name: "2\" locking swivel plate casters (90 lb)", title: "Everbilt 2 in. Black Soft Rubber and Steel Swivel Plate Caster with Locking Brake and 90 lbs. Load Rating", href: "https://www.homedepot.com/p/Everbilt-2-in-Black-Soft-Rubber-and-Steel-Swivel-Plate-Caster-with-Locking-Brake-and-90-lbs-Load-Rating-49509/203661074", packQty: 1, packPrice: 7.57 },
  casterScrew: { name: "#10 × 3/4\" pan-head screws", title: "Everbilt #10 x 3/4 in. Phillips Pan Head Zinc Plated Sheet Metal Screw (10-Pack)", href: "https://www.homedepot.com/p/Everbilt-10-x-3-4-in-Phillips-Pan-Head-Zinc-Plated-Sheet-Metal-Screw-10-Pack-806481/204275204", packQty: 10, packPrice: 1.38 },
  screwEye: { name: "#8 zinc screw eyes, 1 5/8\"", title: "Everbilt #8 x 1-5/8 in. Zinc-Plated Steel Screw Eye (3 per Pack)", href: "https://www.homedepot.com/p/8-x-1-5-8-in-Zinc-Plated-Steel-Screw-Eye-3-per-Pack-816551/204273871", packQty: 3, packPrice: 1.57 },
  chain: { name: "#2/0 zinc-plated chain, by the foot", title: "Everbilt #2/0 x 1 ft. Zinc Plated Steel Twisted Link Chain", href: "https://www.homedepot.com/p/Everbilt-2-0-x-1-ft-Zinc-Plated-Steel-Twisted-Link-Chain-806436/204630487", packQty: 1, packPrice: 2.53 },
};

/** A Buy row for `count` items of a checked listing. Packs show in the unit ("2 packs of 10"); singles stay "each". */
export function checkedRow(c: Checked, count: number, notes: string, unit?: string): BomLine {
  const { offers, lineTotal, packs } = checkedOffer(c, count);
  return {
    name: c.name,
    quantity: c.packQty > 1 ? packs : count,
    unit: unit ?? (c.packQty > 1 ? `${packs === 1 ? "pack" : "packs"} of ${c.packQty}` : "each"),
    estimatedCost: lineTotal,
    notes,
    offers,
  };
}
