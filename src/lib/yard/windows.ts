/**
 * Stock window + contractor framing.
 * Pick the unit first. Frame the published rough opening. BOM is the window plus the lumber.
 */

import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import type {
  AssemblyStep,
  BomLine,
  CutLine,
  FeasibilityIssue,
  Panel,
  StockWindow,
  WindowPackage,
  WindowStyle,
  YardProject,
} from "./types";

const STUD = "lumber-2x4-8";

function win(
  brand: string,
  line: string,
  style: WindowStyle,
  callW: number,
  callH: number,
  cost: number,
  extra?: Partial<StockWindow>,
): StockWindow {
  const roW = callW;
  const roH = callH;
  return {
    id: `${brand.split(" ")[0].toLowerCase()}-${style}-${callW}x${callH}`,
    brand,
    line,
    style,
    callW,
    callH,
    unitW: callW - 0.5,
    unitH: callH - 0.5,
    roW,
    roH,
    jambDepth: 3.25,
    unitCostUsd: cost,
    searchQuery: `${brand} ${line} ${callW}x${callH} ${style.replace("_", " ")} window`,
    notes: "Call size is the published rough opening. Unit is ½\" under that for shims. Confirm the current shop drawing before you cut.",
    ...extra,
  };
}

/** Common new-construction vinyl / clad units. Call size = published RO. */
export const STOCK_WINDOWS: StockWindow[] = [
  win("Andersen", "100 Series", "double_hung", 24, 36, 280),
  win("Andersen", "100 Series", "double_hung", 30, 48, 360),
  win("Andersen", "100 Series", "double_hung", 36, 48, 420),
  win("Andersen", "100 Series", "double_hung", 36, 60, 510),
  win("Andersen", "100 Series", "casement", 24, 48, 390),
  win("Andersen", "100 Series", "casement", 30, 48, 450),
  win("Andersen", "100 Series", "picture", 48, 48, 540),
  win("Pella", "250 Series", "double_hung", 24, 36, 240),
  win("Pella", "250 Series", "double_hung", 32, 54, 380),
  win("Pella", "250 Series", "double_hung", 36, 48, 390),
  win("Pella", "250 Series", "slider", 48, 36, 410),
  win("Pella", "250 Series", "slider", 60, 48, 560),
  win("Pella", "250 Series", "picture", 48, 48, 480),
  win("JELD-WEN", "Builders Vinyl", "double_hung", 24, 36, 190),
  win("JELD-WEN", "Builders Vinyl", "double_hung", 36, 48, 280),
  win("JELD-WEN", "Builders Vinyl", "double_hung", 36, 60, 340),
  win("JELD-WEN", "Builders Vinyl", "slider", 48, 36, 300),
  win("JELD-WEN", "Builders Vinyl", "slider", 60, 36, 360),
  win("JELD-WEN", "Builders Vinyl", "picture", 48, 48, 320),
  win("Marvin", "Essential", "double_hung", 36, 48, 620),
  win("Marvin", "Essential", "casement", 30, 48, 680),
  win("Marvin", "Essential", "picture", 48, 60, 890),
  win("Andersen", "100 Series", "single_hung", 24, 36, 240),
  win("Andersen", "100 Series", "single_hung", 36, 48, 360),
  win("Andersen", "100 Series", "awning", 36, 24, 340),
  win("Pella", "250 Series", "awning", 24, 36, 310),
  win("JELD-WEN", "Builders Vinyl", "hopper", 24, 20, 160),
  win("Andersen", "100 Series", "hopper", 36, 24, 280),
];

export function windowLabel(w: StockWindow) {
  return `${w.brand} ${w.line} ${w.callW}×${w.callH} ${w.style.replace("_", " ")}`;
}

export function matchStockWindows(roW: number, roH: number) {
  return STOCK_WINDOWS.map((u) => {
    const dw = roW - u.roW;
    const dh = roH - u.roH;
    const fit =
      Math.abs(dw) <= 0.01 && Math.abs(dh) <= 0.01
        ? ("exact" as const)
        : dw >= 0.5 && dw <= 1.5 && dh >= 0.5 && dh <= 1.5
          ? ("good" as const)
          : dw >= 0.25 && dh >= 0.25 && dw < 2.5 && dh < 2.5
            ? ("tight" as const)
            : ("poor" as const);
    return { window: u, shimW: u.roW > 0 ? roW - u.unitW : 0, shimH: roH - u.unitH, fit, dw, dh };
  }).sort((a, b) => {
    const rank = { exact: 0, good: 1, tight: 2, poor: 3 };
    return rank[a.fit] - rank[b.fit] || Math.abs(a.dw) + Math.abs(a.dh) - (Math.abs(b.dw) + Math.abs(b.dh));
  });
}

function windowSizeFromPrompt(prompt: string): { w: number; h: number } | null {
  const m = prompt.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (w < 12 || h < 12) return null;
  return { w, h };
}

export function windowStyleFromPrompt(lower: string): WindowStyle | null {
  if (/awning/.test(lower)) return "awning";
  if (/hopper/.test(lower)) return "hopper";
  if (/casement/.test(lower)) return "casement";
  if (/slider|glider/.test(lower)) return "slider";
  if (/picture|\bfixed\b/.test(lower)) return "picture";
  if (/single.?hung/.test(lower)) return "single_hung";
  if (/double.?hung|\bhung\b/.test(lower)) return "double_hung";
  return null;
}

function brandFromPrompt(lower: string): string | null {
  if (/andersen/.test(lower)) return "Andersen";
  if (/pella/.test(lower)) return "Pella";
  if (/jeld|jeld-wen|jeldwen/.test(lower)) return "JELD-WEN";
  if (/marvin/.test(lower)) return "Marvin";
  return null;
}

/** Typed call size with no catalog twin — frame THAT opening. Do not swap in a nearer unit. */
function customWindow(w: number, h: number, style: WindowStyle, note: string): StockWindow {
  return {
    id: `custom-${style}-${w}x${h}`,
    brand: "To order",
    line: "Call size",
    style,
    callW: w,
    callH: h,
    unitW: Math.round((w - 0.5) * 1000) / 1000,
    unitH: Math.round((h - 0.5) * 1000) / 1000,
    roW: w,
    roH: h,
    jambDepth: 3.25,
    unitCostUsd: 0,
    searchQuery: `${w}x${h} ${style.replace("_", " ")} window`,
    notes: note,
  };
}

export function pickWindow(prompt: string, roW?: number, roH?: number): StockWindow {
  const lower = prompt.toLowerCase();
  const style = windowStyleFromPrompt(lower);
  const brand = brandFromPrompt(lower);
  let pool = STOCK_WINDOWS;
  if (brand) pool = pool.filter((w) => w.brand === brand);
  if (style) pool = pool.filter((w) => w.style === style);
  const typed = windowSizeFromPrompt(prompt);
  const wantW = typed?.w ?? (roW != null && roW >= 12 ? roW : undefined);
  const wantH = typed?.h ?? (roH != null && roH >= 12 ? roH : undefined);
  if (wantW && wantH) {
    const exact =
      pool.find((w) => w.roW === wantW && w.roH === wantH) ??
      STOCK_WINDOWS.find(
        (w) =>
          w.roW === wantW &&
          w.roH === wantH &&
          (!style || w.style === style) &&
          (!brand || w.brand === brand),
      );
    if (exact) return exact;
    const nearest = [...(pool.length ? pool : STOCK_WINDOWS)].sort(
      (a, b) =>
        Math.abs(a.roW - wantW) + Math.abs(a.roH - wantH) - (Math.abs(b.roW - wantW) + Math.abs(b.roH - wantH)),
    )[0];
    const nearestNote = nearest
      ? `No ${brand ? brand + " " : ""}stock unit at ${wantW}" × ${wantH}". Frame this rough opening. Nearest catalog unit is ${windowLabel(nearest)} — do not substitute it unless the shop drawing matches.`
      : `No catalog unit at ${wantW}" × ${wantH}". Frame this rough opening and order that call size.`;
    return customWindow(wantW, wantH, style ?? nearest?.style ?? "double_hung", nearestNote);
  }
  if (pool.length) return pool[0];
  if (style) return customWindow(style === "awning" || style === "hopper" ? 36 : 36, style === "awning" || style === "hopper" ? 24 : 48, style, `No catalog ${style.replace("_", " ")} was tagged. Framing a typical opening — type the call size to lock it.`);
  return STOCK_WINDOWS[0];
}

export function headerForSpan(roW: number, stud: "2x4" | "2x6" = "2x4"): WindowPackage["header"] {
  const nominal = roW <= 36 ? "2x6" : roW <= 48 ? "2x8" : roW <= 72 ? "2x10" : "2x12";
  const depth = nominal === "2x6" ? 5.5 : nominal === "2x8" ? 7.25 : nominal === "2x10" ? 9.25 : 11.25;
  // 2×4 wall: two 1½" plies + ½" plywood = 3½". 2×6 wall: three plies (4½") + ½" skins to flush 5½".
  const plies = stud === "2x6" ? 3 : 2;
  return { nominal, plies, depth, length: roW + 3 };
}

export function headerCatalogId(nominal: string, lengthIn: number): string {
  const long = lengthIn > 92;
  if (nominal === "2x12") return long ? "lumber-2x12-10" : "lumber-2x12-8";
  if (nominal === "2x10") return long ? "lumber-2x10-10" : "lumber-2x10-8";
  if (nominal === "2x8") return "lumber-2x8-8";
  return "lumber-2x6-8";
}

export function studFromPrompt(prompt: string, explicit?: "2x4" | "2x6"): "2x4" | "2x6" {
  if (explicit) return explicit;
  const lower = prompt.toLowerCase();
  if (/2\s*[x×]\s*6\s*(?:wall|stud)/.test(lower)) return "2x6";
  if (/(?:in|on)\s+a\s+2\s*[x×]\s*6\b/.test(lower)) return "2x6";
  if (/(?:wall|studs?)\s+(?:is\s+|are\s+|of\s+)?2\s*[x×]\s*6\b/.test(lower)) return "2x6";
  return "2x4";
}

export function sillFromPrompt(prompt: string): number | null {
  const lower = prompt.toLowerCase();
  const at = lower.match(/\bsill\s*(?:height|at|@)\s*(\d+(?:\.\d+)?)/);
  if (at) return parseFloat(at[1]);
  const withUnit = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")\s+sill\b/);
  if (withUnit) return parseFloat(withUnit[1]);
  const bare = lower.match(/(\d+(?:\.\d+)?)\s*"?\s*sill\b/);
  if (bare) return parseFloat(bare[1]);
  return null;
}

function studCatalogId(stud: "2x4" | "2x6") {
  return stud === "2x6" ? "lumber-2x6-8" : "lumber-2x4-8";
}

function stickCost(id: string, fallback: number) {
  return getCatalogItem(id)?.unitCostUsd ?? fallback;
}

function crippleCount(span: number) {
  return Math.max(1, Math.floor(span / 16) + 1);
}

function crippleXs(x0: number, span: number, thick: number, n: number) {
  if (n <= 1) return [x0 + Math.max(0, span - thick) / 2];
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(x0 + (i / (n - 1)) * (span - thick));
  return xs;
}

/** Typed sill stays. If it does not fit an 8 ft wall, raise the wall — do not shrink the opening. */
function resolveWall(args: {
  wallHeight?: number;
  askedSill: number | null;
  defaultSill: number;
  roH: number;
  headerDepth: number;
  plate: number;
  minSill: number;
}): { wallHeight: number; sillTop: number; note?: string } {
  const locked = args.wallHeight != null;
  let wallH = args.wallHeight ?? 96;
  const minSill = args.minSill;
  if (args.askedSill == null) {
    const maxSill = wallH - args.plate - args.headerDepth - args.roH;
    if (maxSill < minSill && !locked) {
      const sill = minSill;
      wallH = Math.ceil(sill + args.roH + args.headerDepth + args.plate);
      return {
        wallHeight: wallH,
        sillTop: sill,
        note: `Plate-to-plate raised to ${wallH}" so the ${args.roH}" opening clears the header.`,
      };
    }
    const sill = Math.min(args.defaultSill, Math.max(minSill, maxSill));
    return { wallHeight: wallH, sillTop: Math.max(minSill, sill) };
  }
  const sill = Math.max(minSill, args.askedSill);
  const need = sill + args.roH + args.headerDepth + args.plate;
  if (need > wallH && !locked) {
    return {
      wallHeight: Math.ceil(need),
      sillTop: sill,
      note: `Plate-to-plate raised to ${Math.ceil(need)}" so the sill at ${sill}" and the ${args.roH}" opening still clear the header.`,
    };
  }
  if (need > wallH) {
    const fit = Math.max(minSill, wallH - args.plate - args.headerDepth - args.roH);
    return {
      wallHeight: wallH,
      sillTop: fit,
      note: `Sill asked at ${args.askedSill}" does not fit a ${wallH}" wall under that header. Sill set to ${fit}".`,
    };
  }
  return { wallHeight: wallH, sillTop: sill };
}

function boardFaceIn(materialId: string, wallDepth: number) {
  if (/2x12/.test(materialId)) return 11.25;
  if (/2x10/.test(materialId)) return 9.25;
  if (/2x8/.test(materialId)) return 7.25;
  if (/2x6/.test(materialId)) return 5.5;
  return wallDepth;
}

function nominalLabel(materialId: string) {
  const m = materialId.match(/lumber-(\d+)x(\d+)/);
  return m ? `${m[1]}×${m[2]}` : "2×4";
}

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId = STUD,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId,
  };
}

export function buildWindowProject(
  window: StockWindow,
  prompt = "",
  opts?: { wallHeight?: number; stud?: "2x4" | "2x6"; sillHeight?: number },
): YardProject {
  const stud = studFromPrompt(prompt, opts?.stud);
  const thick = 1.5;
  const depth = stud === "2x6" ? 5.5 : 3.5;
  const studId = studCatalogId(stud);
  const plate = 1.5;
  const roW = window.roW;
  const roH = window.roH;
  const header = headerForSpan(roW, stud);
  const headerId = headerCatalogId(header.nominal, header.length);
  const askedSill = opts?.sillHeight ?? sillFromPrompt(prompt);
  const fit = resolveWall({
    wallHeight: opts?.wallHeight,
    askedSill,
    defaultSill: 36,
    roH,
    headerDepth: header.depth,
    plate,
    minSill: plate + thick,
  });
  const wallHeight = fit.wallHeight;
  const sillTop = fit.sillTop;
  const wallW = roW + thick * 4;
  // Sill TOP is the bottom of the rough opening. Header underside is the top.
  const headerY = sillTop + roH;
  const jackH = headerY - plate;
  const sillY = sillTop - thick;
  const below = sillY - plate;
  const crippleTop = wallHeight - plate - (headerY + header.depth);
  const shimW = window.roW - window.unitW;
  const shimH = window.roH - window.unitH;

  const xKingL = 0;
  const xJackL = thick;
  const xRo = thick * 2;
  const xJackR = xRo + roW;
  const xKingR = xJackR + thick;

  const framing = (
    type: Panel["type"],
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    materialId = studId,
  ) => panel(type, name, x, y, z, w, h, d, materialId);

  const panels: Panel[] = [
    framing("bottom", "Bottom plate", 0, 0, 0, wallW, plate, depth),
    framing("top", "Top plate", 0, wallHeight - plate, 0, wallW, plate, depth),
    framing("upright", "Left king", xKingL, plate, 0, thick, wallHeight - plate * 2, depth),
    framing("upright", "Right king", xKingR, plate, 0, thick, wallHeight - plate * 2, depth),
    framing("upright", "Left jack", xJackL, plate, 0, thick, jackH, depth),
    framing("upright", "Right jack", xJackR, plate, 0, thick, jackH, depth),
    framing("shelf", `${header.plies}-ply ${header.nominal} header`, xJackL, headerY, 0, header.length, header.depth, depth, headerId),
    framing("shelf", "Rough sill", xRo, sillY, 0, roW, thick, depth),
  ];

  if (below > 0.5) {
    const xs = crippleXs(xRo, roW, thick, crippleCount(roW));
    xs.forEach((x, i) => {
      panels.push(framing("upright", `Sill cripple ${i + 1}`, x, plate, 0, thick, below, depth));
    });
  }
  if (crippleTop > 0.5) {
    const xs = crippleXs(xRo, roW, thick, crippleCount(roW));
    xs.forEach((x, i) => {
      panels.push(framing("upright", `Head cripple ${i + 1}`, x, headerY + header.depth, 0, thick, crippleTop, depth));
    });
  }

  const unitX = xRo + shimW / 2;
  const unitY = sillTop + shimH / 2;
  panels.push(
    panel(
      "glass_panel",
      windowLabel(window),
      unitX,
      unitY,
      (depth - window.jambDepth) / 2,
      window.unitW,
      window.unitH,
      window.jambDepth,
      "window-unit",
    ),
  );

  const pkg: WindowPackage = {
    window,
    wallHeight,
    stud,
    sillHeight: sillTop,
    header,
    shimW,
    shimH,
    role: "window",
  };
  const stockLen = getCatalogItem(headerId)?.dims.length ?? 96;
  const headerLong = header.length > stockLen
    ? `Header is ${header.length}" — longer than a ${stockLen}" ${header.nominal}. Order a longer stick. Not stamped.`
    : null;

  return {
    id: createId("proj"),
    name: windowLabel(window),
    prompt,
    kind: "opening",
    overall: { width: wallW + 4, height: wallHeight + 2, depth: depth + 4 },
    instances: [],
    panels,
    primaryMaterialId: studId,
    notes: [
      `Stock unit: ${windowLabel(window)}. Call ${window.callW}" × ${window.callH}". Unit ${window.unitW}" × ${window.unitH}". Published RO ${window.roW}" × ${window.roH}".`,
      window.notes ?? "",
      `Clear opening ${roW}" wide × ${roH}" high — sill top to the underside of the header. ${stud} wall, ${wallHeight}" plate-to-plate. Sill at ${sillTop}".`,
      `Header: ${header.plies}-ply ${header.nominal} × ${header.length}", on both jacks. ${stud === "2x6" ? "Two ½\" plywood spacers" : "One ½\" plywood spacer"} so the pack flushes a ${depth}" wall.`,
      fit.note ?? "",
      headerLong ?? "",
      `Shim gap ~${shimW.toFixed(2)}" wide × ${shimH.toFixed(2)}" high. Square, plumb, and level the unit in the RO — do not rack the frame.`,
      "New-construction sequence: frame → wrap → pan flash → set unit → shim → fasten per the manufacturer → spray foam lightly → interior casing later.",
      "Guidance only. Header size is a common-sense span heuristic, not a stamped design. Confirm the shop drawing and local code.",
    ].filter(Boolean),
    historic: false,
    opening: { width: roW, height: roH, depth, kind: "window" },
    windowPkg: pkg,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

export function windowCuts(project: YardProject): CutLine[] {
  const grouped = new Map<string, CutLine>();
  for (const p of project.panels) {
    if (p.type === "glass_panel" || p.type === "door" || p.materialId === "window-unit" || p.materialId === "prehung-door") continue;
    const key = `${p.name}|${p.size.height}|${p.size.width}|${p.materialId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    grouped.set(key, {
      id: p.id,
      name: p.name,
      quantity: 1,
      lengthIn: Math.max(p.size.height, p.size.width),
      widthIn: boardFaceIn(p.materialId, p.size.depth),
      thicknessIn: 1.5,
      material: nominalLabel(p.materialId),
    });
  }
  return [...grouped.values()];
}

export function windowBom(project: YardProject): BomLine[] {
  const w = project.windowPkg?.window;
  const header = project.windowPkg?.header;
  const stud = project.windowPkg?.stud ?? "2x4";
  const studId = studCatalogId(stud);
  const door = project.windowPkg?.role === "door";
  const studs = project.panels.filter((p) => p.type === "upright").length;
  const plates = project.panels.filter((p) => p.type === "top" || p.type === "bottom").length;
  const sill = project.panels.some((p) => /sill/i.test(p.name)) ? 1 : 0;
  const studQty = Math.max(6, studs + plates + sill);
  const bom: BomLine[] = [];
  if (w && door) {
    const slabW = project.windowPkg?.slabW ?? w.callW;
    const slabH = project.windowPkg?.slabH ?? w.callH;
    const slab = `${slabW}×${slabH}`;
    const standard = slabW === 36 && slabH === 80;
    bom.push({
      name: `${windowLabel(w)} (slab ${slab})`,
      quantity: 1,
      unit: "door",
      catalogId: standard ? "prehung-door" : undefined,
      searchQuery: w.searchQuery,
      estimatedCost: w.unitCostUsd,
      notes: `Slab ${slab}. Rough opening ${w.roW}" × ${w.roH}". Order that slab, then frame the RO. Confirm the shop drawing.`,
    });
  } else if (w) {
    const custom = w.brand === "To order";
    bom.push({
      name: windowLabel(w),
      quantity: 1,
      unit: "window",
      catalogId: custom ? undefined : "window-unit",
      searchQuery: w.searchQuery,
      estimatedCost: w.unitCostUsd || undefined,
      notes: `Call ${w.callW}×${w.callH}. Unit ${w.unitW}" × ${w.unitH}". Order the unit, then frame its published RO.${custom ? " No catalog twin at this call size — do not substitute a nearer unit." : ""}`,
    });
  }
  bom.push({
    name: `${stud} studs (8 ft)`,
    quantity: studQty,
    unit: "ea",
    catalogId: studId,
    searchQuery: `${stud}x8 stud`,
    estimatedCost: Math.round(studQty * stickCost(studId, stud === "2x6" ? 8.75 : 5.5) * 100) / 100,
    notes: "Kings, jacks, cripples, plates. Cut list is on the plan.",
  });
  if (header) {
    const headerId = headerCatalogId(header.nominal, header.length);
    const each = stickCost(headerId, header.nominal === "2x12" ? 22 : header.nominal === "2x10" ? 16.87 : header.nominal === "2x8" ? 11.48 : 8.75);
    bom.push({
      name: `${header.nominal} header stock`,
      quantity: header.plies,
      unit: "ea",
      catalogId: headerId,
      searchQuery: getCatalogItem(headerId)?.searchQuery ?? `${header.nominal} framing lumber`,
      estimatedCost: Math.round(header.plies * each * 100) / 100,
      notes: `${header.plies} ply, ${header.length}" long. ${stud === "2x6" ? "Two ½\" plywood spacers" : "½\" plywood spacer"} between plies. Not stamped.`,
    });
    bom.push({
      name: '1/2" plywood header spacer',
      quantity: 1,
      unit: "sheet",
      catalogId: "plywood-1-2-4x8",
      searchQuery: "1/2 inch 4x8 plywood",
      estimatedCost: stickCost("plywood-1-2-4x8", 42),
      notes: stud === "2x6"
        ? "Rip two ½\" spacers. Three 1½\" plies + two spacers flush a 5½\" wall."
        : "Rip one ½\" spacer. Two 1½\" plies + one spacer flush a 3½\" wall.",
    });
  }
  bom.push(
    { name: "Wood shims", quantity: 1, unit: "bundle", catalogId: "shims", searchQuery: "wood shims", estimatedCost: stickCost("shims", 4) },
    { name: "16d framing nails or structural screws", quantity: 1, unit: "box", catalogId: "framing-nails", searchQuery: "16d framing nails", estimatedCost: stickCost("framing-nails", 10) },
  );
  if (!door || /exterior|entry|front|french/i.test(`${w?.line ?? ""} ${project.prompt}`)) {
    bom.push({
      name: "Window flashing tape / pan",
      quantity: 1,
      unit: "roll",
      catalogId: "flashing-tape",
      searchQuery: "window flashing tape pan",
      estimatedCost: stickCost("flashing-tape", 18),
    });
  }
  bom.push({
    name: "Low-expansion window foam",
    quantity: 1,
    unit: "can",
    catalogId: "window-foam",
    searchQuery: "low expansion window foam",
    estimatedCost: stickCost("window-foam", 8),
    notes: "Do not use high-expansion foam — it bows the frame.",
  });
  return bom;
}

export function windowIssues(project: YardProject): FeasibilityIssue[] {
  const pkg = project.windowPkg;
  if (!pkg) return [];
  const w = pkg.window;
  if (pkg.role === "door") {
    return [
      {
        severity: "info",
        message: `${windowLabel(w)} — slab ${pkg.slabW}" × ${pkg.slabH}". Rough opening ${w.roW}" × ${w.roH}".`,
        suggestion: "Buy the prehung unit first. Frame to the shop drawing. The bottom plate is cut — no plate through the doorway.",
      },
      {
        severity: "info",
        message: `${pkg.header.plies}-ply ${pkg.header.nominal} header over a ${w.roW}" span in a ${pkg.wallHeight}" ${pkg.stud} wall.`,
        suggestion: "Heuristic only. Wide openings or a bearing wall need an engineer or the IRC span tables.",
      },
    ];
  }
  return [
    {
      severity: "info",
      message: `${windowLabel(w)} — published RO ${w.roW}" × ${w.roH}". Unit ${w.unitW}" × ${w.unitH}".`,
      suggestion: "Buy the window first. Frame to the shop drawing that ships with it.",
    },
    {
      severity: "info",
      message: `${pkg.header.plies}-ply ${pkg.header.nominal} header over a ${w.roW}" span. Sill at ${pkg.sillHeight}" in a ${pkg.wallHeight}" ${pkg.stud} wall.`,
      suggestion: "Heuristic only. Wide openings, snow load, or a bearing wall need an engineer or the IRC span tables for your species and grade.",
    },
    {
      severity: pkg.shimW < 0.25 || pkg.shimH < 0.25 ? "warning" : "info",
      message: `Shim gap ${pkg.shimW.toFixed(2)}" × ${pkg.shimH.toFixed(2)}".`,
      suggestion: "½\" all around is the usual new-construction gap. Confirm the manufacturer.",
    },
  ];
}

export function windowSteps(project: YardProject): AssemblyStep[] {
  const pkg = project.windowPkg;
  const w = pkg?.window;
  if (!pkg || !w) {
    return [
      {
        step: 1,
        title: "Pick a unit first",
        description: "Select a stock window. The rough opening and the lumber follow the unit, not the other way around.",
      },
    ];
  }
  const jackLen = (pkg.role === "door" ? w.roH : pkg.sillHeight + w.roH - 1.5).toFixed(1);
  const kingLen = (pkg.wallHeight - 3).toFixed(1);
  return [
    {
      step: 1,
      title: `Order ${windowLabel(w)} — do not cut yet`,
      description: pkg.role === "door"
        ? `Slab ${pkg.slabW}" × ${pkg.slabH}". Prehung unit about ${w.unitW}" × ${w.unitH}". Rough opening ${w.roW}" × ${w.roH}". Wait for the shop drawing before you cut the plate.`
        : `Call size ${w.callW}" × ${w.callH}". Unit ${w.unitW}" × ${w.unitH}" × ${w.jambDepth}" jamb. Published RO ${w.roW}" × ${w.roH}". Wait for the shop drawing that ships with this unit. Brands revise units.`,
      tips: pkg.role === "door"
        ? "The slab is what you buy. The rough opening is 2\" wider and 2½\" taller unless you already named the RO."
        : "The catalog call size is the advertised RO. Confirm the current drawing before you snap a plate.",
      partsUsed: ["*"],
    },
    {
      step: 2,
      title: "Snap the layout on the plates",
      description: pkg.role === "door"
        ? `Wall bay is ${(w.roW + 6).toFixed(1)}" wide. From the left: king 1.5", jack 1.5", RO ${w.roW}", jack 1.5", king 1.5". Cut the bottom plate out of the doorway — plate pieces only under the kings. Top plate is full width.`
        : `Wall bay is ${(w.roW + 6).toFixed(1)}" wide. From the left: king 1.5", jack 1.5", RO ${w.roW}", jack 1.5", king 1.5". Bottom plate and top plate that full width. Crown the plates the same way.`,
      partsUsed: pkg.role === "door" ? ["Left bottom plate", "Right bottom plate", "Top plate"] : ["Bottom plate", "Top plate"],
    },
    {
      step: 3,
      title: `Stand the kings — ${kingLen}"`,
      description: `Two kings, full height between plates (${kingLen}"). They run past the header to the top plate. Nail into the plates, then the jacks will sit inside them.`,
      partsUsed: ["Left king", "Right king", "king"],
    },
    {
      step: 4,
      title: `Cut and set the jacks — ${jackLen}"`,
      description: `Two jacks / trimmers ${jackLen}". ${pkg.role === "door" ? "They run from the floor to the underside of the header — the bottom plate is cut at the opening." : "They run from the bottom plate to the underside of the header and carry it."} Both jacks the same length. A short jack drops the header.`,
      partsUsed: ["Left jack", "Right jack", "jack", "trimmer"],
    },
    {
      step: 5,
      title: `Build the ${pkg.header.plies}-ply ${pkg.header.nominal} header`,
      description: `Header ${pkg.header.length}" long, ${pkg.header.depth}" deep. ${pkg.stud === "2x6" ? "Three plies with two ½\" plywood spacers so the pack is 5½\"." : "Two plies with a ½\" plywood spacer so the pack is 3½\"."} Crown up. This is a common-sense span, not a stamp.`,
      partsUsed: ["header"],
      tips: "Bearing walls, snow load, or a wider opening need the IRC tables or an engineer.",
    },
    {
      step: 6,
      title: "Set the header on the jacks",
      description: `The header bears on both jacks, tight to the kings. Check it is level before you nail. The RO below must still read ${w.roW}" × ${w.roH}".`,
      partsUsed: ["header", "jack", "king"],
    },
    {
      step: 7,
      title: pkg.role === "door" ? "Cripples above the header" : `Sill and cripples — sill at ${pkg.sillHeight}"`,
      description: pkg.role === "door"
        ? `No sill and no bottom plate through the opening. Cripples at ~16" o.c. from the top of the header up to the top plate. Square the opening: both diagonals the same. Clear height from the floor to the header is ${w.roH}".`
        : `Rough sill ${w.roW}" long between the jacks. The top of the sill is the bottom of the rough opening (${pkg.sillHeight}"). Cripples stop under the sill, and more go above the header. Clear height from sill top to header underside is ${w.roH}". Square the opening: both diagonals the same.`,
      partsUsed: ["Rough sill", "sill", "cripple"],
    },
    {
      step: 8,
      title: pkg.role === "door" ? "Flash the opening" : "Wrap and pan-flash",
      description: pkg.role === "door"
        ? "Exterior doors get a sill pan and flashing tape up the jambs, then the head. Interior doors just need a square opening and shims."
        : "WRB over the wall. Sill pan or sloped flashing first. Tape up the jambs, then the head. Water has to drain out, not into the wall.",
      partsUsed: ["*"],
      tips: "Do not puncture the pan with a fastener through the sill if the manufacturer forbids it.",
    },
    {
      step: 9,
      title: `Set ${windowLabel(w)}`,
      description: pkg.role === "door"
        ? `Set the prehung door in the RO. Shim the sides and the head — about ${pkg.shimW.toFixed(2)}" total wide and ${pkg.shimH.toFixed(2)}" at the head. The slab should swing without hitting the jamb.`
        : `Set the unit in the RO. Shim the sides — gap about ${pkg.shimW.toFixed(2)}" × ${pkg.shimH.toFixed(2)}". Plumb, level, square. Fasten per the shop drawing, not by habit.`,
      partsUsed: pkg.role === "door" ? ["door"] : ["window", "glass"],
    },
    {
      step: 10,
      title: "Foam, then interior",
      description: "Low-expansion window foam only — high-expansion bows vinyl frames. Check the sash still operates. Interior casing last.",
      tips: "Guidance only. Not stamped engineering. Confirm local code and the unit's install sheet.",
      partsUsed: ["*"],
    },
  ];
}

export function looksLikeDoorFrame(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/\bwindows?\b/.test(lower)) return false;
  if (
    !/prehung|(?:exterior|entry|front|french|passage|interior|slab)\s+doors?|door\s+rough\s+opening|frame\s+(?:a\s+|the\s+)?door|door\s+frame|bypass\s+doors?|pocket\s+doors?/.test(
      lower,
    )
  ) {
    return false;
  }
  if (
    /cabinet|vanity|drawer|crate|ironing|cupboard|hutch|closet|wardrobe|pantry|bookcase/.test(lower) &&
    !/prehung|door\s+rough|frame\s+(?:a\s+|the\s+)?door|door\s+frame|(?:exterior|entry|front|french)\s+doors?/.test(lower)
  ) {
    return false;
  }
  return true;
}

function doorLine(lower: string) {
  if (/french/.test(lower)) return "French";
  if (/exterior|entry|front/.test(lower)) return "Exterior";
  if (/pocket/.test(lower)) return "Pocket";
  if (/bypass|sliding/.test(lower)) return "Bypass";
  return "Interior";
}

function doorCost(lower: string) {
  if (/french/.test(lower)) return 480;
  if (/exterior|entry|front/.test(lower)) return 349;
  return 189;
}

/** Slab is what you buy. Rough opening is slab + 2" wide and + 2½" tall unless they named the RO. */
export function doorOpeningFromPrompt(prompt: string): { slabW: number; slabH: number; roW: number; roH: number; saidRo: boolean } {
  const lower = prompt.toLowerCase();
  const saidRo = /rough opening|\bro\b/.test(lower);
  const pair = windowSizeFromPrompt(prompt);
  let slabW = 36;
  let slabH = 80;
  if (pair && saidRo) {
    return {
      slabW: Math.round((pair.w - 2) * 1000) / 1000,
      slabH: Math.round((pair.h - 2.5) * 1000) / 1000,
      roW: pair.w,
      roH: pair.h,
      saidRo: true,
    };
  }
  if (pair) {
    slabW = pair.w;
    slabH = pair.h;
  } else {
    const one =
      lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide\s+)?(?:prehung|exterior|interior|entry|front|french|passage|slab|pocket|bypass)?\s*doors?/) ||
      lower.match(/\bdoors?\s+(?:that(?:'s|\s+is)\s+|of\s+|about\s+)?(\d+(?:\.\d+)?)/);
    const n = one ? parseFloat(one[1]) : NaN;
    if (Number.isFinite(n) && n >= 60 && n <= 120) slabH = n;
    else if (Number.isFinite(n) && n >= 18 && n < 60) slabW = n;
  }
  return { slabW, slabH, roW: slabW + 2, roH: Math.round((slabH + 2.5) * 1000) / 1000, saidRo: false };
}

export function buildDoorProject(
  prompt: string,
  opts?: { wallHeight?: number; stud?: "2x4" | "2x6" },
): YardProject {
  const lower = prompt.toLowerCase();
  const size = doorOpeningFromPrompt(prompt);
  const line = doorLine(lower);
  const unitW = Math.round((size.roW - 0.5) * 1000) / 1000;
  const unitH = Math.round((size.roH - 0.5) * 1000) / 1000;
  const door: StockWindow = {
    id: `door-${line.toLowerCase()}-${size.slabW}x${size.slabH}`,
    brand: "Prehung",
    line,
    style: "door",
    callW: size.slabW,
    callH: size.slabH,
    unitW,
    unitH,
    roW: size.roW,
    roH: size.roH,
    jambDepth: 4.5625,
    unitCostUsd: doorCost(lower),
    searchQuery: `${size.slabW}x${size.slabH} prehung ${line.toLowerCase()} door`,
    notes: size.saidRo
      ? `You named the rough opening ${size.roW}" × ${size.roH}". Slab is about ${size.slabW}" × ${size.slabH}" (RO minus 2" wide and 2½" tall). Confirm the shop drawing.`
      : `Slab ${size.slabW}" × ${size.slabH}". Rough opening ${size.roW}" × ${size.roH}" — 2" wider and 2½" taller than the slab, the usual prehung allowance.`,
  };
  const stud = studFromPrompt(prompt, opts?.stud);
  const thick = 1.5;
  const depth = stud === "2x6" ? 5.5 : 3.5;
  const studId = studCatalogId(stud);
  const plate = 1.5;
  const header = headerForSpan(door.roW, stud);
  const headerId = headerCatalogId(header.nominal, header.length);
  const fit = resolveWall({
    wallHeight: opts?.wallHeight,
    askedSill: 0,
    defaultSill: 0,
    roH: door.roH,
    headerDepth: header.depth,
    plate,
    minSill: 0,
  });
  const wallHeight = fit.wallHeight;
  const roW = door.roW;
  const roH = door.roH;
  const wallW = roW + thick * 4;
  const headerY = roH;
  const jackH = roH;
  const crippleTop = wallHeight - plate - (headerY + header.depth);
  const xKingL = 0;
  const xJackL = thick;
  const xRo = thick * 2;
  const xJackR = xRo + roW;
  const xKingR = xJackR + thick;

  const framing = (
    type: Panel["type"],
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    materialId = studId,
  ) => panel(type, name, x, y, z, w, h, d, materialId);

  const panels: Panel[] = [
    framing("bottom", "Left bottom plate", xKingL, 0, 0, thick, plate, depth),
    framing("bottom", "Right bottom plate", xKingR, 0, 0, thick, plate, depth),
    framing("top", "Top plate", 0, wallHeight - plate, 0, wallW, plate, depth),
    framing("upright", "Left king", xKingL, plate, 0, thick, wallHeight - plate * 2, depth),
    framing("upright", "Right king", xKingR, plate, 0, thick, wallHeight - plate * 2, depth),
    framing("upright", "Left jack", xJackL, 0, 0, thick, jackH, depth),
    framing("upright", "Right jack", xJackR, 0, 0, thick, jackH, depth),
    framing("shelf", `${header.plies}-ply ${header.nominal} header`, xJackL, headerY, 0, header.length, header.depth, depth, headerId),
  ];
  if (crippleTop > 0.5) {
    crippleXs(xRo, roW, thick, crippleCount(roW)).forEach((x, i) => {
      panels.push(framing("upright", `Head cripple ${i + 1}`, x, headerY + header.depth, 0, thick, crippleTop, depth));
    });
  }
  panels.push(
    panel("door", windowLabel(door), xRo + 0.25, 0, (depth - door.jambDepth) / 2, unitW, unitH, Math.min(door.jambDepth, depth), "prehung-door"),
  );

  const stockLen = getCatalogItem(headerId)?.dims.length ?? 96;
  const pkg: WindowPackage = {
    window: door,
    wallHeight,
    stud,
    sillHeight: 0,
    header,
    shimW: roW - unitW,
    shimH: roH - unitH,
    role: "door",
    slabW: size.slabW,
    slabH: size.slabH,
  };

  return {
    id: createId("proj"),
    name: windowLabel(door),
    prompt,
    kind: "opening",
    overall: { width: wallW + 4, height: wallHeight + 2, depth: depth + 4 },
    instances: [],
    panels,
    primaryMaterialId: studId,
    notes: [
      door.notes ?? "",
      `Clear opening ${roW}" wide × ${roH}" high, from the floor to the underside of the header. Bottom plate is split — nothing through the doorway.`,
      `Header: ${header.plies}-ply ${header.nominal} × ${header.length}" on both jacks. ${stud} wall, ${wallHeight}" plate-to-plate.`,
      fit.note ?? "",
      header.length > stockLen ? `Header is ${header.length}" — longer than a ${stockLen}" ${header.nominal}.` : "",
      "Jacks run from the floor to the header. Kings sit on the plate pieces outside the opening.",
      "Guidance only. Header size is a common-sense span heuristic, not a stamped design. Confirm the shop drawing and local code.",
    ].filter(Boolean),
    historic: false,
    opening: { width: roW, height: roH, depth, kind: "door" },
    windowPkg: pkg,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

export function looksLikeWindow(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/window seat/.test(lower)) return false;
  return /window|casement|double.?hung|single.?hung|awning|hopper|slider window|picture window|rough opening|andersen|pella|jeld-?wen|marvin/.test(lower);
}
