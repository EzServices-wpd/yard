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

/** Bounding drawer envelope → sides / back / bottom a stranger can cut from sheet stock. */
export type DrawerCutPart = {
  name: string;
  type: string;
  width: number;
  height: number;
  depth: number;
};

export function isBoundingDrawerPanel(name: string, type?: string): boolean {
  return type === "drawer" && !/drawer\s*front/i.test(name);
}

/**
 * Class pack: a type=drawer panel is a visual envelope, not a cuttable board.
 * Explode into ¾" sides + back and a ¼" bottom so sheetCutDims never treats
 * drawer height as "thickness" (the 19.5×15.75×6.375 lie).
 */
export function explodeDrawerBoxCuts(boxW: number, boxH: number, boxD: number): DrawerCutPart[] {
  const Ts = 0.75;
  const Tb = 0.25;
  const innerW = Math.max(Math.round((boxW - 2 * Ts) * 8) / 8, 1);
  const bottomD = Math.max(Math.round((boxD - Ts) * 8) / 8, 1);
  const H = Math.round(boxH * 8) / 8;
  const D = Math.round(boxD * 8) / 8;
  return [
    { name: "Drawer side", type: "drawer-side", width: Ts, height: H, depth: D },
    { name: "Drawer side", type: "drawer-side", width: Ts, height: H, depth: D },
    { name: "Drawer back", type: "drawer-back", width: innerW, height: H, depth: Ts },
    { name: "Drawer bottom", type: "drawer-bottom", width: innerW, height: Tb, depth: bottomD },
  ];
}

/** Long × mid × thick — same order as the cut list a builder takes to the lumber aisle. */

/**
 * Clear drawer-bay opening → honest box envelope a stranger can cut (or buy).
 * Side-mount slides eat ~1″ total width; height/depth insets leave running clearance.
 * Shared densify helper — callers pass bay clear W×H×D (between uprights / under top).
 */
export type DrawerBoxFromOpening = {
  boxW: number;
  boxH: number;
  boxD: number;
  frontW: number;
};

export function drawerBoxFromOpening(
  openingW: number,
  openingH: number,
  openingD: number,
  opts?: {
    slideClearIn?: number;
    heightInsetIn?: number;
    depthInsetIn?: number;
    frontInsetIn?: number;
  },
): DrawerBoxFromOpening {
  const slide = opts?.slideClearIn ?? 1;
  const hInset = opts?.heightInsetIn ?? 0.12;
  const dInset = opts?.depthInsetIn ?? 0.3;
  const fInset = opts?.frontInsetIn ?? 0.25;
  const r8 = (n: number) => Math.round(n * 8) / 8;
  const boxW = Math.max(r8(openingW - slide), 4);
  const boxH = Math.max(r8(openingH - hInset), 3);
  const boxD = Math.max(r8(openingD - dInset), 4);
  const frontW = Math.max(r8(openingW - fInset), boxW);
  return { boxW, boxH, boxD, frontW };
}

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
  if (/shoe peg/i.test(name)) return "Shoe peg";
  if (/shoe cubb/i.test(name)) return "Shoe cubbies";
  if (/shoe rail/i.test(name)) return "Shoe rail";
  if (/cubby divider/i.test(name)) return "Cubby divider";
  if (/shoe shelf/i.test(name)) return "Shoe shelf";
  if (/boot tray/i.test(name)) return "Boot tray";
  if (/^seat$/i.test(name.trim())) return "Seat";
  if (/towel rail/i.test(name)) return "Towel rail";
  if (/peg rail/i.test(name)) return "Peg rail";
  if (/hat shelf/i.test(name)) return "Hat shelf";
  if (/toekick|toe[- ]?kick/i.test(name) || type === "kick") return "Toekick";
  if (/desktop|desk top/i.test(name)) return "Desktop";
  if (/headboard/i.test(name)) return "Headboard";
  if (/picture ledge/i.test(name)) return "Picture ledge";
  if (/^apron\b/i.test(name) || (type === "rail" && /apron/i.test(name))) return "Apron";
  if (/^leg\b/i.test(name)) return "Leg";
  if (/cut round/i.test(name)) return name;
  // Drawer box parts — name wins BEFORE carcase type aliases. Cut-step explode
  // remaps drawer-side→upright, drawer-back→back, drawer-bottom→bottom; without
  // this order the cut step lies "Upright/Back/Bottom" for parts the cut list
  // correctly names Drawer side/back/bottom (soft-park envelope honesty).
  if (/drawer front/i.test(name)) return "Drawer front";
  if (type === "drawer-side" || /drawer side/i.test(name)) return "Drawer side";
  if (type === "drawer-back" || /drawer back/i.test(name)) return "Drawer back";
  if (type === "drawer-bottom" || /drawer bottom/i.test(name)) return "Drawer bottom";
  if (type === "drawer") return "Drawer box";
  if (type === "upright") return "Upright";
  if (type === "shelf") return "Shelf";
  if (type === "divider") return "Divider";
  if (type === "counter") return "Counter";
  // Sit benches keep Seat (not Top); hinged-lid chests keep Lid (not Top); tray densify keeps Boot tray (not Bottom).
  if (type === "top") {
    if (/^seat$/i.test(name.trim())) return "Seat";
    if (/^lid$/i.test(name.trim())) return "Lid";
    return "Top";
  }
  if (type === "bottom") return /boot tray/i.test(name) ? "Boot tray" : "Bottom";
  if (type === "back") return "Back";
  if (type === "door") return "Door";
  if (type === "rail") {
    const stripped = name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Bay \d+)\s+/i, "").trim();
    return stripped || "Rail";
  }
  return name.replace(/^(Left|Right|Center|Upper|Lower|Front|Rear|Top|Bottom)\s+/i, "") || name;
}
