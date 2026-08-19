/**
 * Stock window + contractor framing.
 * Pick the unit first. Frame the published rough opening. BOM is the window plus the lumber.
 */

import { createId } from "@/lib/utils";
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

export function pickWindow(prompt: string, roW?: number, roH?: number): StockWindow {
  const lower = prompt.toLowerCase();
  let pool = STOCK_WINDOWS;
  if (/andersen/.test(lower)) pool = pool.filter((w) => w.brand === "Andersen");
  else if (/pella/.test(lower)) pool = pool.filter((w) => w.brand === "Pella");
  else if (/jeld|jeld-wen|jeldwen/.test(lower)) pool = pool.filter((w) => w.brand === "JELD-WEN");
  else if (/marvin/.test(lower)) pool = pool.filter((w) => w.brand === "Marvin");
  if (/casement/.test(lower)) pool = pool.filter((w) => w.style === "casement");
  else if (/slider|horizontal/.test(lower)) pool = pool.filter((w) => w.style === "slider");
  else if (/picture|fixed/.test(lower)) pool = pool.filter((w) => w.style === "picture");
  else if (/awning/.test(lower)) pool = pool.filter((w) => w.style === "awning");
  else if (/double.?hung|hung/.test(lower)) pool = pool.filter((w) => w.style === "double_hung");
  if (!pool.length) pool = STOCK_WINDOWS;
  if (roW && roH) {
    const hit = pool.find((w) => w.roW === roW && w.roH === roH) ?? pool.find((w) => w.callW === roW && w.callH === roH);
    if (hit) return hit;
    return [...pool].sort((a, b) => Math.abs(a.roW - roW) + Math.abs(a.roH - roH) - (Math.abs(b.roW - roW) + Math.abs(b.roH - roH)))[0];
  }
  return pool[0];
}

export function headerForSpan(roW: number): WindowPackage["header"] {
  if (roW <= 36) return { nominal: "2x6", plies: 2, depth: 5.5, length: roW + 3 };
  if (roW <= 48) return { nominal: "2x8", plies: 2, depth: 7.25, length: roW + 3 };
  return { nominal: "2x10", plies: 2, depth: 9.25, length: roW + 3 };
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
  const wallHeight = opts?.wallHeight ?? 96;
  const stud = opts?.stud ?? "2x4";
  const thick = 1.5;
  const depth = stud === "2x6" ? 5.5 : 3.5;
  const header = headerForSpan(window.roW);
  const plate = 1.5;
  const minSill = plate + 12;
  const maxSill = wallHeight - plate - header.depth - window.roH - 2;
  const sillHeight = Math.min(maxSill, Math.max(minSill, opts?.sillHeight ?? 36));
  const roW = window.roW;
  const roH = window.roH;
  const wallW = roW + thick * 4;
  const jackH = sillHeight + roH - plate;
  const headerY = plate + jackH;
  const crippleTop = wallHeight - plate - (headerY + header.depth);
  const below = sillHeight - plate;
  const shimW = window.roW - window.unitW;
  const shimH = window.roH - window.unitH;

  const xKingL = 0;
  const xJackL = thick;
  const xRo = thick * 2;
  const xJackR = xRo + roW;
  const xKingR = xJackR + thick;

  const panels: Panel[] = [
    panel("bottom", "Bottom plate", 0, 0, 0, wallW, plate, depth),
    panel("top", "Top plate", 0, wallHeight - plate, 0, wallW, plate, depth),
    panel("upright", "Left king", xKingL, plate, 0, thick, wallHeight - plate * 2, depth),
    panel("upright", "Right king", xKingR, plate, 0, thick, wallHeight - plate * 2, depth),
    panel("upright", "Left jack", xJackL, plate, 0, thick, jackH, depth),
    panel("upright", "Right jack", xJackR, plate, 0, thick, jackH, depth),
    panel("shelf", `${header.plies}-ply ${header.nominal} header`, xJackL, headerY, 0, header.length, header.depth, depth, header.nominal === "2x6" ? "lumber-2x6-8" : header.nominal === "2x8" ? "lumber-2x8-8" : "lumber-2x10-8"),
    panel("shelf", "Rough sill", xRo, sillHeight, 0, roW, thick, depth),
  ];

  const nBelow = Math.max(2, Math.ceil(roW / 16) + 1);
  for (let i = 0; i < nBelow; i++) {
    const t = nBelow === 1 ? 0 : i / (nBelow - 1);
    const x = xRo + t * (roW - thick);
    panels.push(panel("upright", `Sill cripple ${i + 1}`, x, plate, 0, thick, below, depth));
  }
  if (crippleTop > 3) {
    const nAbove = Math.max(2, Math.ceil(roW / 16) + 1);
    for (let i = 0; i < nAbove; i++) {
      const t = nAbove === 1 ? 0 : i / (nAbove - 1);
      const x = xRo + t * (roW - thick);
      panels.push(panel("upright", `Head cripple ${i + 1}`, x, headerY + header.depth, 0, thick, crippleTop, depth));
    }
  }

  const unitX = xRo + shimW / 2;
  const unitY = sillHeight + thick + shimH / 2;
  panels.push(
    panel("glass_panel", windowLabel(window), unitX, unitY, (depth - window.jambDepth) / 2, window.unitW, window.unitH, window.jambDepth, "window-unit"),
  );

  const pkg: WindowPackage = {
    window,
    wallHeight,
    stud,
    sillHeight,
    header,
    shimW,
    shimH,
  };

  return {
    id: createId("proj"),
    name: windowLabel(window),
    prompt,
    kind: "opening",
    overall: { width: wallW + 4, height: wallHeight + 2, depth: depth + 4 },
    instances: [],
    panels,
    primaryMaterialId: STUD,
    notes: [
      `Stock unit: ${windowLabel(window)}. Call ${window.callW}" × ${window.callH}". Unit ${window.unitW}" × ${window.unitH}". Published RO ${window.roW}" × ${window.roH}".`,
      `Frame a ${roW}" × ${roH}" rough opening in a ${stud} wall, ${wallHeight}" plate-to-plate. Sill at ${sillHeight}". Header: ${header.plies}-ply ${header.nominal} × ${header.length}".`,
      `Shim gap ~${shimW.toFixed(2)}" wide × ${shimH.toFixed(2)}" high. Square, plumb, and level the unit in the RO — do not rack the frame.`,
      "New-construction sequence: frame → wrap → pan flash → set unit → shim → fasten per the manufacturer → spray foam lightly → interior casing later.",
      "Guidance only. Header size is a common-sense span heuristic, not a stamped design. Confirm the shop drawing and local code.",
    ],
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
    if (p.type === "glass_panel") continue;
    const key = `${p.name}|${p.size.height}|${p.size.width}`;
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
      widthIn: Math.min(p.size.depth, 3.5),
      thicknessIn: 1.5,
      material: p.materialId.startsWith("lumber-2x") ? p.materialId.replace("lumber-", "").replace("-8", "").replace("x", "×") : "2×4",
    });
  }
  return [...grouped.values()];
}

export function windowBom(project: YardProject): BomLine[] {
  const w = project.windowPkg?.window;
  const header = project.windowPkg?.header;
  const studs = project.panels.filter((p) => p.type === "upright").length;
  const plates = project.panels.filter((p) => p.type === "top" || p.type === "bottom").length;
  const bom: BomLine[] = [];
  if (w) {
    bom.push({
      name: windowLabel(w),
      quantity: 1,
      unit: "window",
      searchQuery: w.searchQuery,
      estimatedCost: w.unitCostUsd,
      notes: `Call ${w.callW}×${w.callH}. Unit ${w.unitW}" × ${w.unitH}". Order the unit, then frame its published RO.`,
    });
  }
  bom.push({
    name: `${project.windowPkg?.stud ?? "2x4"} studs (8 ft)`,
    quantity: Math.max(6, studs + plates),
    unit: "ea",
    searchQuery: `${project.windowPkg?.stud ?? "2x4"}x8 stud`,
    estimatedCost: (studs + plates) * 5.5,
    notes: "Kings, jacks, cripples, plates. Cut list is on the plan.",
  });
  if (header) {
    bom.push({
      name: `${header.nominal} header stock`,
      quantity: header.plies,
      unit: "ea",
      searchQuery: `${header.nominal}x8 framing lumber`,
      estimatedCost: header.plies * (header.nominal === "2x6" ? 9 : header.nominal === "2x8" ? 12 : 16),
      notes: `${header.plies} ply, ${header.length}" long. ½" plywood spacer between plies. Not stamped.`,
    });
  }
  bom.push(
    { name: "Window flashing tape / pan", quantity: 1, unit: "roll", searchQuery: "window flashing tape pan", estimatedCost: 18 },
    { name: "Wood shims", quantity: 1, unit: "bundle", searchQuery: "wood shims", estimatedCost: 4 },
    { name: "16d framing nails or structural screws", quantity: 1, unit: "box", searchQuery: "16d framing nails", estimatedCost: 10 },
    { name: "Low-expansion window foam", quantity: 1, unit: "can", searchQuery: "low expansion window foam", estimatedCost: 8, notes: "Do not use high-expansion foam — it bows the frame." },
  );
  return bom;
}

export function windowIssues(project: YardProject): FeasibilityIssue[] {
  const pkg = project.windowPkg;
  if (!pkg) return [];
  const w = pkg.window;
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
  const jackLen = (pkg.sillHeight + w.roH - 1.5).toFixed(1);
  const kingLen = (pkg.wallHeight - 3).toFixed(1);
  return [
    {
      step: 1,
      title: `Order ${windowLabel(w)} — do not cut yet`,
      description: `Call size ${w.callW}" × ${w.callH}". Unit ${w.unitW}" × ${w.unitH}" × ${w.jambDepth}" jamb. Published RO ${w.roW}" × ${w.roH}". Wait for the shop drawing that ships with this unit. Brands revise units.`,
      tips: "The catalog call size is the advertised RO. Confirm the current drawing before you snap a plate.",
      partsUsed: ["*"],
    },
    {
      step: 2,
      title: "Snap the layout on the plates",
      description: `Wall bay is ${(w.roW + 6).toFixed(1)}" wide. From the left: king 1.5", jack 1.5", RO ${w.roW}", jack 1.5", king 1.5". Bottom plate and top plate that full width. Crown the plates the same way.`,
      partsUsed: ["Bottom plate", "Top plate"],
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
      description: `Two jacks / trimmers ${jackLen}". They run from the bottom plate to the underside of the header and carry it. Both jacks the same length. A short jack drops the header.`,
      partsUsed: ["Left jack", "Right jack", "jack", "trimmer"],
    },
    {
      step: 5,
      title: `Build the ${pkg.header.plies}-ply ${pkg.header.nominal} header`,
      description: `Header ${pkg.header.length}" long, ${pkg.header.depth}" deep. Nail the plies with a ½" plywood spacer between. Crown up. This is a common-sense span, not a stamp.`,
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
      title: `Sill and cripples — sill at ${pkg.sillHeight}"`,
      description: `Rough sill ${w.roW}" long between the jacks. Cripples at ~16" o.c. under the sill down to the bottom plate, and above the header up to the top plate. Square the opening: both diagonals the same.`,
      partsUsed: ["Rough sill", "sill", "cripple"],
    },
    {
      step: 8,
      title: "Wrap and pan-flash",
      description: "WRB over the wall. Sill pan or sloped flashing first. Tape up the jambs, then the head. Water has to drain out, not into the wall.",
      partsUsed: ["*"],
      tips: "Do not puncture the pan with a fastener through the sill if the manufacturer forbids it.",
    },
    {
      step: 9,
      title: `Set ${windowLabel(w)}`,
      description: `Set the unit in the RO. Shim the sides — gap about ${pkg.shimW.toFixed(2)}" × ${pkg.shimH.toFixed(2)}". Plumb, level, square. Fasten per the shop drawing, not by habit.`,
      partsUsed: ["window", "glass"],
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

export function looksLikeWindow(prompt: string) {
  const lower = prompt.toLowerCase();
  return /window|casement|double.?hung|slider window|rough opening|andersen|pella|jeld-?wen|marvin/.test(lower);
}
