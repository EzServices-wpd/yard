/**
 * Shelves that carry a lip (a jar lip or bottle rail stood on the shelf's front edge) inside a unit of height H.
 * The top shelf drops by the lip's height so that lip's top edge is flush with the tops of the uprights (a rail held
 * between them), and every shelf keeps the same spacing: the bottom shelf on the floor of the unit, the rest evenly
 * spaced up to the dropped top shelf. Nothing rises above the stated height.
 */
export function lippedShelfYs(H: number, n: number, shelfT: number, lipH: number, bottom = 0): number[] {
  if (n <= 0) return [];
  const topY = H - shelfT - lipH;
  if (n === 1) return [bottom];
  return Array.from({ length: n }, (_, i) => bottom + (i * (topY - bottom)) / (n - 1));
}
