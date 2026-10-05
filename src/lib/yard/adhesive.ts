/**
 * The adhesive follows the stock, and Buy lists the adhesive the steps use.
 * Paper, cardboard, chipboard and foam: hot glue from a low-temp glue gun. Wood: wood glue.
 */
import type { BomLine, CatalogItem } from "./types";

export function usesHotGlue(item?: CatalogItem | null): boolean {
  return !!item && (item.category === "cardboard" || /cardboard|chipboard|paper|foam/i.test(item.id));
}

export const HOT_GLUE_HOLD = "Hot glue from a low-temp glue gun. Hold 15–30 seconds until it grabs.";

export function hotGlueBom(): BomLine {
  return {
    name: "Hot glue sticks (mini, 30 ct)",
    quantity: 1,
    unit: "pack",
    searchQuery: "mini hot glue sticks 30 pack",
    estimatedCost: 5.99,
    notes: "For a low-temp mini glue gun, the glue every step uses. A mini glue gun is about $10 if you need one.",
  };
}
