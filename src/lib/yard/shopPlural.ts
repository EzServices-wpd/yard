/** Shop-plan plurals — avoid "shelfs" on a cut list. */
export function shopPlural(label: string, qty: number): string {
  if (qty === 1) return label;
  if (label === "shelf") return "shelves";
  if (label === "toekick") return "toekicks";
  if (label.endsWith("s")) return label;
  return `${label}s`;
}
