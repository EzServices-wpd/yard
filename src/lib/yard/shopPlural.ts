/** Shop-plan plurals — avoid "shelfs" on a cut list. */
export function shopPlural(label: string, qty: number): string {
  if (qty === 1) return label;
  if (/shelves$/i.test(label)) return label;
  if (/shelf$/i.test(label)) return label.replace(/shelf$/i, "shelves");
  if (label === "toekick" || label === "Toekick") return "Toekicks";
  if (/box$/i.test(label)) return label.replace(/box$/i, "boxes");
  if (label.endsWith("s")) return label;
  return `${label}s`;
}

/** Long × mid × thick — same order as the cut list a builder takes to the lumber aisle. */
export function sheetCutDims(w: number, h: number, d: number) {
  const a = Math.round(w * 8) / 8;
  const b = Math.round(h * 8) / 8;
  const c = Math.round(d * 8) / 8;
  const sorted = [a, b, c].sort((x, y) => y - x);
  return { lengthIn: sorted[0], widthIn: sorted[1], thicknessIn: sorted[2] };
}

export function fmtSheetCut(w: number, h: number, d: number) {
  const { lengthIn, widthIn, thicknessIn } = sheetCutDims(w, h, d);
  const r = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(2));
  return `${r(lengthIn)} × ${r(widthIn)} × ${r(thicknessIn)}`;
}

/**
 * Cut-list names a stranger can find in the pile — hanging rod, not "Rail";
 * peg rail / hat shelf, not "Back" / "Top".
 */
export function cutListName(name: string, type?: string): string {
  if (/hanging rod/i.test(name)) return "Hanging rod";
  if (/jar lip/i.test(name)) return "Jar lip";
  if (/bottle rail/i.test(name)) return "Bottle rail";
  if (/peg rail/i.test(name)) return "Peg rail";
  if (/hat shelf/i.test(name)) return "Hat shelf";
  if (/toekick|toe[- ]?kick/i.test(name) || type === "kick") return "Toekick";
  if (/desktop|desk top/i.test(name)) return "Desktop";
  if (/headboard/i.test(name)) return "Headboard";
  if (/^apron\b/i.test(name) || (type === "rail" && /apron/i.test(name))) return "Apron";
  if (/^leg\b/i.test(name)) return "Leg";
  if (/cut round/i.test(name)) return name;
  if (type === "upright") return "Upright";
  if (type === "shelf") return "Shelf";
  if (type === "divider") return "Divider";
  if (type === "counter") return "Counter";
  if (type === "top") return "Top";
  if (type === "bottom") return "Bottom";
  if (type === "back") return "Back";
  if (type === "door") return "Door";
  if (type === "drawer") return "Drawer box";
  if (type === "rail") {
    const stripped = name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Bay \d+)\s+/i, "").trim();
    return stripped || "Rail";
  }
  return name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Top|Bottom)\s+/i, "") || name;
}
