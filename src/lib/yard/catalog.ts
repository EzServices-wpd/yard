import type { CatalogItem } from "./types";

export const FORGE_CATALOG: CatalogItem[] = [
  { id: "popsicle-standard", name: "Standard Popsicle Stick", brand: "Generic / Craft", category: "craft_wood", formFactor: "stick", dims: { length: 4.5, width: 0.375, thickness: 0.08 }, unitsPerPack: 100, unitCostUsd: 0.03, aliases: ["popsicle stick", "craft stick", "ice cream stick"], tags: ["wood", "craft"], preferredJoins: ["glue", "notch"], canCut: true, color: "#e8d5a3", roughness: 0.65, searchQuery: "standard 4.5 inch popsicle sticks bulk" },
  { id: "popsicle-jumbo", name: "Jumbo Craft Stick", category: "craft_wood", formFactor: "stick", dims: { length: 6, width: 0.75, thickness: 0.08 }, unitsPerPack: 50, unitCostUsd: 0.06, aliases: ["jumbo popsicle", "large craft stick"], tags: ["wood"], preferredJoins: ["glue", "notch"], canCut: true, color: "#e0c990", searchQuery: "jumbo craft sticks 6 inch" },
  { id: "popsicle-mini", name: "Mini Craft Stick", category: "craft_wood", formFactor: "stick", dims: { length: 2.5, width: 0.25, thickness: 0.06 }, unitsPerPack: 200, unitCostUsd: 0.015, aliases: ["mini popsicle"], tags: ["wood"], preferredJoins: ["glue"], canCut: true, color: "#f0e0b8", searchQuery: "mini craft sticks 2.5 inch" },
  { id: "popsicle-giant", name: "Giant Craft Stick", category: "craft_wood", formFactor: "stick", dims: { length: 12, width: 0.75, thickness: 0.12 }, unitsPerPack: 25, unitCostUsd: 0.25, aliases: ["giant popsicle stick"], tags: ["wood"], preferredJoins: ["glue", "notch"], canCut: true, color: "#d4b87a", searchQuery: "giant craft sticks 12 inch" },
  { id: "bamboo-skewer-12", name: "Bamboo Skewer 12\"", category: "craft_wood", formFactor: "dowel", dims: { length: 12, diameter: 0.125 }, unitsPerPack: 100, unitCostUsd: 0.02, aliases: ["skewer", "bamboo stick"], tags: ["bamboo"], preferredJoins: ["glue", "friction"], canCut: true, color: "#c9a86c", searchQuery: "bamboo skewers 12 inch" },
  { id: "paper-towel-roll", name: "Paper Towel Roll Core", category: "paper_tube", formFactor: "tube", dims: { length: 11, diameter: 1.5, innerDiameter: 1.4 }, unitsPerPack: 1, unitCostUsd: 0, aliases: ["paper towel tube", "kitchen roll core"], tags: ["cardboard", "recycled"], preferredJoins: ["glue", "tape"], canCut: true, color: "#d4c4a8", searchQuery: "empty paper towel rolls craft" },
  { id: "toilet-paper-roll", name: "Toilet Paper Roll Core", category: "paper_tube", formFactor: "tube", dims: { length: 3.7, diameter: 1.6, innerDiameter: 1.5 }, unitsPerPack: 1, unitCostUsd: 0, aliases: ["TP roll", "toilet paper tube"], tags: ["cardboard"], preferredJoins: ["glue", "tape"], canCut: true, color: "#d8c9b0", searchQuery: "empty toilet paper rolls craft" },
  { id: "mailing-tube-2x24", name: "Mailing Tube 2\" × 24\"", category: "paper_tube", formFactor: "tube", dims: { length: 24, diameter: 2.0, innerDiameter: 1.9 }, unitsPerPack: 1, unitCostUsd: 3.5, aliases: ["poster tube"], tags: ["cardboard"], preferredJoins: ["glue", "tape"], canCut: true, color: "#c4b090", searchQuery: "2 inch diameter mailing tube 24 inch" },
  { id: "pvc-half-sch40", name: "1/2\" Schedule 40 PVC Pipe", category: "pvc_plumbing", formFactor: "pipe", dims: { length: 120, diameter: 0.84, innerDiameter: 0.602 }, unitsPerPack: 1, unitCostUsd: 4.5, aliases: ["half inch PVC", "1/2 PVC"], tags: ["pvc"], preferredJoins: ["solvent", "friction"], canCut: true, color: "#f5f5f0", searchQuery: "1/2 inch schedule 40 PVC pipe 10 ft" },
  { id: "pvc-3-4-sch40", name: "3/4\" Schedule 40 PVC Pipe", category: "pvc_plumbing", formFactor: "pipe", dims: { length: 120, diameter: 1.05, innerDiameter: 0.804 }, unitsPerPack: 1, unitCostUsd: 6, aliases: ["3/4 PVC"], tags: ["pvc"], preferredJoins: ["solvent", "friction"], canCut: true, color: "#f0f0eb", searchQuery: "3/4 inch schedule 40 PVC pipe" },
  { id: "pvc-1-sch40", name: "1\" Schedule 40 PVC Pipe", category: "pvc_plumbing", formFactor: "pipe", dims: { length: 120, diameter: 1.315, innerDiameter: 1.029 }, unitsPerPack: 1, unitCostUsd: 8.5, aliases: ["1 inch PVC"], tags: ["pvc"], preferredJoins: ["solvent"], canCut: true, color: "#eeeeea", searchQuery: "1 inch schedule 40 PVC pipe 10 ft" },
  { id: "dowel-1-4-36", name: "1/4\" Hardwood Dowel 36\"", category: "dowel_rod", formFactor: "dowel", dims: { length: 36, diameter: 0.25 }, unitsPerPack: 1, unitCostUsd: 1.2, aliases: ["quarter inch dowel"], tags: ["wood"], preferredJoins: ["glue", "friction"], canCut: true, color: "#d4b896", searchQuery: "1/4 inch hardwood dowel 36 inch" },
  { id: "dowel-1-2-36", name: "1/2\" Hardwood Dowel 36\"", category: "dowel_rod", formFactor: "dowel", dims: { length: 36, diameter: 0.5 }, unitsPerPack: 1, unitCostUsd: 2.5, aliases: ["half inch dowel"], tags: ["wood"], preferredJoins: ["glue", "screw"], canCut: true, color: "#c9a878", searchQuery: "1/2 inch hardwood dowel" },
  { id: "lumber-2x4-8", name: "2×4 Stud (8 ft)", category: "lumber", formFactor: "board", dims: { length: 96, width: 3.5, height: 1.5 }, unitsPerPack: 1, unitCostUsd: 5.5, aliases: ["2x4", "two by four", "stud"], tags: ["lumber", "framing"], preferredJoins: ["screw", "nail"], canCut: true, color: "#d8c4a0", searchQuery: "2x4x8 stud" },
  { id: "lumber-2x6-8", name: "2×6 (8 ft)", category: "lumber", formFactor: "board", dims: { length: 96, width: 5.5, height: 1.5 }, unitsPerPack: 1, unitCostUsd: 9, aliases: ["2x6"], tags: ["lumber", "header"], preferredJoins: ["nail", "screw"], canCut: true, color: "#d0b890", searchQuery: "2x6x8 framing lumber" },
  { id: "lumber-2x8-8", name: "2×8 (8 ft)", category: "lumber", formFactor: "board", dims: { length: 96, width: 7.25, height: 1.5 }, unitsPerPack: 1, unitCostUsd: 12, aliases: ["2x8"], tags: ["lumber"], preferredJoins: ["nail"], canCut: true, color: "#c9ae82", searchQuery: "2x8x8 framing lumber" },
  { id: "lumber-2x10-8", name: "2×10 (8 ft)", category: "lumber", formFactor: "board", dims: { length: 96, width: 9.25, height: 1.5 }, unitsPerPack: 1, unitCostUsd: 16, aliases: ["2x10"], tags: ["lumber"], preferredJoins: ["nail"], canCut: true, color: "#c4a678", searchQuery: "2x10x8 framing lumber" },
  { id: "window-unit", name: "Stock window unit", category: "hardware", formFactor: "sheet", dims: { length: 36, width: 48, thickness: 3.25 }, unitsPerPack: 1, unitCostUsd: 400, aliases: ["window", "sash"], tags: ["window"], preferredJoins: ["screw"], canCut: false, color: "#9ec5d6", searchQuery: "replacement window" },
  { id: "lumber-1x4-8", name: "1×4 Board (8 ft)", category: "lumber", formFactor: "board", dims: { length: 96, width: 3.5, height: 0.75 }, unitsPerPack: 1, unitCostUsd: 4, aliases: ["1x4"], tags: ["lumber"], preferredJoins: ["screw", "glue"], canCut: true, color: "#e0d0b0", searchQuery: "1x4x8 pine board" },
  { id: "plywood-3-4-4x8", name: "3/4\" Plywood 4×8", category: "sheet_goods", formFactor: "sheet", dims: { length: 96, width: 48, thickness: 0.75 }, unitsPerPack: 1, unitCostUsd: 55, aliases: ["3/4 plywood"], tags: ["sheet", "cabinet"], preferredJoins: ["screw", "glue"], canCut: true, color: "#d4a574", searchQuery: "3/4 inch 4x8 plywood" },
  { id: "foam-board-20x30", name: "Foam Board 20×30\"", category: "foam", formFactor: "sheet", dims: { length: 30, width: 20, thickness: 0.2 }, unitsPerPack: 1, unitCostUsd: 4, aliases: ["foamcore"], tags: ["model"], preferredJoins: ["glue", "tape"], canCut: true, color: "#f8f8f5", searchQuery: "20x30 foam board" },
  { id: "cardboard-corrugated-sheet", name: "Corrugated Cardboard Sheet", category: "cardboard", formFactor: "sheet", dims: { length: 36, width: 24, thickness: 0.15 }, unitsPerPack: 1, unitCostUsd: 0.5, aliases: ["cardboard sheet"], tags: ["recycled"], preferredJoins: ["tape", "glue"], canCut: true, color: "#c4a878", searchQuery: "corrugated cardboard sheets" },
  { id: "straw-plastic", name: "Plastic Drinking Straw", category: "plastic", formFactor: "tube", dims: { length: 7.75, diameter: 0.25, innerDiameter: 0.2 }, unitsPerPack: 100, unitCostUsd: 0.02, aliases: ["straw"], tags: ["plastic"], preferredJoins: ["tape", "glue"], canCut: true, color: "#f0f0f0", searchQuery: "plastic drinking straws bulk" },
  { id: "toothpick", name: "Wooden Toothpick", category: "craft_wood", formFactor: "stick", dims: { length: 2.5, width: 0.08, thickness: 0.08 }, unitsPerPack: 250, unitCostUsd: 0.005, aliases: ["toothpick"], tags: ["tiny"], preferredJoins: ["glue"], canCut: true, color: "#f5e6c8", searchQuery: "wooden toothpicks" },
  { id: "bbq-skewer-12", name: "Bamboo BBQ Skewer 12\"", category: "craft_wood", formFactor: "dowel", dims: { length: 12, diameter: 0.15 }, unitsPerPack: 100, unitCostUsd: 0.03, aliases: ["bbq skewer"], tags: ["bamboo"], preferredJoins: ["glue"], canCut: true, color: "#c9a86c", searchQuery: "bamboo bbq skewers 12 inch" },
  { id: "soda-can", name: "Aluminum Soda Can (empty)", category: "recycled", formFactor: "tube", dims: { length: 4.83, diameter: 2.6, innerDiameter: 2.5 }, unitsPerPack: 1, unitCostUsd: 0, aliases: ["soda can", "coke can"], tags: ["recycled"], preferredJoins: ["tape", "glue"], canCut: true, color: "#c0c0c0", metalness: 0.7, searchQuery: "empty aluminum cans craft" },
  { id: "plastic-bottle-16oz", name: "16 oz Plastic Bottle (empty)", category: "recycled", formFactor: "tube", dims: { length: 8, diameter: 2.75, innerDiameter: 2.6 }, unitsPerPack: 1, unitCostUsd: 0, aliases: ["water bottle"], tags: ["recycled"], preferredJoins: ["tape", "glue"], canCut: true, color: "#a8d4e8", searchQuery: "empty plastic water bottles craft" },
  { id: "legos-2x4", name: "LEGO-style Brick 2×4", category: "plastic", formFactor: "block", dims: { length: 1.26, width: 0.63, height: 0.45 }, unitsPerPack: 1, unitCostUsd: 0.15, aliases: ["lego", "lego brick"], tags: ["plastic"], preferredJoins: ["friction"], canCut: false, color: "#c41e3a", searchQuery: "LEGO 2x4 bricks" },
  { id: "copper-pipe-half", name: "1/2\" Copper Pipe", category: "metal", formFactor: "pipe", dims: { length: 120, diameter: 0.625, innerDiameter: 0.545 }, unitsPerPack: 1, unitCostUsd: 18, aliases: ["copper pipe"], tags: ["metal"], preferredJoins: ["solvent"], canCut: true, color: "#b87333", metalness: 0.85, searchQuery: "1/2 inch copper pipe 10 ft" },
  { id: "pool-noodle", name: "Pool Noodle", category: "foam", formFactor: "tube", dims: { length: 55, diameter: 2.5, innerDiameter: 0.75 }, unitsPerPack: 1, unitCostUsd: 3, aliases: ["pool noodle"], tags: ["foam"], preferredJoins: ["friction", "tape"], canCut: true, color: "#ff6b6b", searchQuery: "pool noodles bulk" },
];

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(FORGE_CATALOG.map((item) => [item.id, item]));

export const CATALOG_CATEGORIES: { id: CatalogItem["category"]; label: string }[] = [
  { id: "craft_wood", label: "Craft Sticks & Wood" },
  { id: "paper_tube", label: "Paper & Cardboard Tubes" },
  { id: "pvc_plumbing", label: "PVC Pipe" },
  { id: "dowel_rod", label: "Dowels & Rods" },
  { id: "lumber", label: "Dimensional Lumber" },
  { id: "sheet_goods", label: "Sheet Goods" },
  { id: "foam", label: "Foam & Model" },
  { id: "cardboard", label: "Cardboard" },
  { id: "metal", label: "Metal" },
  { id: "plastic", label: "Plastic" },
  { id: "recycled", label: "Recycled / Free" },
  { id: "hardware", label: "Hardware" },
  { id: "other", label: "Other" },
];

export function searchCatalog(query: string, limit = 40): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FORGE_CATALOG.slice(0, limit);
  const scored = FORGE_CATALOG.map((item) => {
    let score = 0;
    const name = item.name.toLowerCase();
    const aliases = (item.aliases ?? []).map((a) => a.toLowerCase());
    const tags = (item.tags ?? []).map((t) => t.toLowerCase());
    if (name === q) score += 100;
    else if (name.startsWith(q)) score += 60;
    else if (name.includes(q)) score += 30;
    for (const a of aliases) {
      if (a === q) score += 90;
      else if (a.startsWith(q)) score += 50;
      else if (a.includes(q)) score += 20;
    }
    for (const t of tags) if (t === q || t.startsWith(q)) score += 15;
    const words = q.split(/\s+/);
    if (words.length > 1 && words.every((w) => name.includes(w) || aliases.some((a) => a.includes(w)) || tags.some((t) => t.includes(w)))) score += 25;
    return { item, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG_BY_ID[id];
}
