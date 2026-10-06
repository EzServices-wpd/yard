import { inchFrac } from "./inchText";
import { toPrimitive } from "./geometry";
/**
 * Weekend / hobbyist stock honesty — named stock is the only stock.
 * Sibling of house honesty.ts. No new noun programs.
 *
 * CatalogPanel already rebuilds at a picked catalog id. The prompt must bind
 * the same way: detectMaterial → primaryMaterialId → every member.
 * Unnamed stock stays the wire-frame placeholder. Never silent popsicle.
 */
import { getCatalogItem } from "./catalog";
import {
  climbRiseRun,
  detectWeekendMech,
  isClimbSingleStep,
  isClimbStepStool,
  climbStepCount,
  spokenRungCount,
  isLauncherRamp,
  isMediaDeviceStand,
  wantsMediaTipHold,
  wantsClimbHandrail,
  wantsPotHold,
  isHamperHold,
  isUmbrellaHold,
  isHoseReelHold,
  isMonitorHold,
  umbrellaEnvelopeTalk,
  reelEnvelopeTalk,
  monitorEnvelopeTalk,
  monitorEnvelopeIn,
  monitorRiseIn,
  potHoldDiameterIn,
  basketEnvelopeWhd,
  basketEnvelopeTalk,
  launcherRampLengthIn,
  mediaHoldTipDeg,
} from "./weekendFamily";
import { isWholeStock } from "./geometry";
import { binderBom, binderKind, effectiveJoin, memberSpan } from "./joints";
import { detectMaterial, hasExplicitSize, isWireStock, parseSize, stripLumberStock, stripJoinWords, weekendSizedStockPhrases } from "./promptHelpers";
import { stripHeldPurpose } from "./heldObjects";
import {
  CATALOG_LUMBER_BIND,
  densifyLabelForPrompt,
  isNamedLumberSpeciesId,
  namedLumberFromPrompt,
} from "./namedLumberSpecies";
import { honorSpeciesInTitle } from "./voiceHonesty";
import type { BuildPlan, CatalogItem, CutLine, JoinMethod, Panel, YardInstance, YardProject } from "./types";

export type WeekendGuard = "stock" | "whole" | "join" | "size" | "anatomy";

export type WeekendIssue = {
  guard: WeekendGuard;
  message: string;
};

export type WeekendReport = {
  ok: boolean;
  issues: WeekendIssue[];
  stockId: string | null;
};

/** House fitted / openings stay on honesty.ts. This is the craft/forge path. */
export function isWeekendProject(project: YardProject): boolean {
  if (project.fitted || project.kind === "closet" || project.kind === "opening") return false;
  if (project.pocket) return false;
  return (
    project.instances.length > 0 ||
    project.kind === "eiffel" ||
    project.kind === "lattice" ||
    project.kind === "arch" ||
    project.kind === "bridge" ||
    project.kind === "figure" ||
    project.kind === "frame" ||
    project.kind === "ladder"
  );
}

export function namedStockFromPrompt(prompt: string): CatalogItem | null {
  const item = detectMaterial(prompt);
  if (isWireStock(item)) return null;
  return item;
}

/**
 * Densify may map cedar/pine/balsa/maple/walnut/redwood/oak/cherry/… onto a lumber size catalog row,
 * but labels/steps keep the spoken stock identity (oak densify must not hide as bare "1×4 Board").
 * Species allowlist + densifyLabel come from NAMED_LUMBER_SPECIES pack (single source).
 */
export function namedStockDisplayName(prompt: string, item: CatalogItem | undefined | null): string {
  if (!item) return "stock";
  // Lumber size row: prefer pack densifyLabel ("Oak 1×4") over bare catalog name / first-token alias.
  if (item.id === CATALOG_LUMBER_BIND || (/board|stud|post|^\d\s*[×x]\s*\d+\s*\(/i.test(item.name) && item.category === "lumber")) {
    const species = namedLumberFromPrompt(prompt);
    const size = item.name.match(/(\d+\s*[×x]\s*\d+)/)?.[1]?.replace(/x/gi, "×");
    // Species default is 1×4. A spoken 2×4 / 1×3 keeps that size in the Buy name.
    if (species && size && item.id !== CATALOG_LUMBER_BIND) return `${species.display} ${size}`;
    const packLabel = densifyLabelForPrompt(prompt);
    if (packLabel) return packLabel;
  }
  const lower = (prompt || "").toLowerCase();
  const aliases = item.aliases ?? [];
  const spoken = aliases.find((a) => {
    const al = a.toLowerCase();
    if (al.length < 3) return false;
    if (!lower.includes(al)) return false;
    // Skip pure size codes ("1x4", "one by four") — keep species / craft nouns.
    if (/^\d+\s*[x×]\s*\d+/.test(al)) return false;
    if (/^(one|two|three|four)\s+by\s+/.test(al)) return false;
    if (/^(pvc|stud|table leg)$/i.test(al)) return false;
    return true;
  });
  if (!spoken) return item.name;
  const species = spoken
    .split(/\s+/)[0]
    .replace(/^[a-z]/, (c) => c.toUpperCase());
  // Catalog name is a bare lumber size / board — prefer "Cedar 1×4".
  const size = item.name.match(/(\d+\s*[×x]\s*\d+)/)?.[1]?.replace(/x/i, "×");
  if (size && (/board|stud/i.test(item.name) || /^\d+\s*[×x]\s*\d+/i.test(item.name))) {
    if (isNamedLumberSpeciesId(species)) {
      return `${species} ${size}`;
    }
  }
  // If the spoken alias is already the catalog title (popsicle…), keep catalog name.
  if (item.name.toLowerCase().includes(spoken.toLowerCase().split(/\s+/)[0])) return item.name;
  return `${species} · ${item.name}`;
}

/** True when generateFromPrompt (no CatalogPanel override) bound the prompt's stock. */
export function promptBoundStock(project: YardProject): boolean {
  const named = namedStockFromPrompt(project.prompt ?? "");
  if (named) return project.primaryMaterialId === named.id;
  return isWireStock(getCatalogItem(project.primaryMaterialId));
}

/** Sheet / ply catalog ids — fitted densify default when no named species binds. */
export function isSheetPrimaryId(id: string | undefined | null): boolean {
  return !!id && /^(plywood-|sheet-)/i.test(id);
}

/** A build in the named species' lumber says the species in its title ("Cedar Adirondack chair"). */
/**
 * Notes say the plain stock a person asks for at the yard ("1×10", "Walnut 1×4"), never the catalog row
 * ("1×10 Board (8 ft)"). A typed species rides on every lumber size the notes name.
 */
export function withPlainStockNotes(p: YardProject, prompt: string): YardProject {
  if (!p.notes?.length) return p;
  const species = namedLumberFromPrompt(prompt)?.display;
  const re = /(?<![\w×])([1-4])\s*[×x]\s*(\d+)(?:\s+(?:Board|Stud|Post)\b(?:\s+\(\d+\s*ft\))?|\s+\(\d+\s*ft\))/g;
  let changed = false;
  const notes = p.notes.map((n) => {
    const next = n.replace(re, (_m, a: string, b: string, at: number, all: string) => {
      const plain = `${a}×${b}`;
      const said = species && new RegExp(`${species}\\s*$`, "i").test(all.slice(0, at));
      return species && !said ? `${species} ${plain}` : plain;
    });
    if (next !== n) changed = true;
    return next;
  });
  return changed ? { ...p, notes } : p;
}

export function withSpeciesTitle(p: YardProject, prompt: string, inNotes = false): YardProject {
  const species = namedLumberFromPrompt(prompt);
  if (!species) return p;
  if (inNotes) {
    // Notes that name the bare catalog row ("1×6 Board (8 ft)") say the typed species stock ("Cedar 1×6").
    const item = getCatalogItem(p.primaryMaterialId);
    const label = namedStockDisplayName(prompt, item);
    if (item && label !== item.name && p.notes?.some((n) => n.includes(item.name))) {
      p = { ...p, notes: p.notes.map((n) => n.split(item.name).join(label)) };
    }
  }
  const esc = species.display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${esc}\\b`, "i").test(p.name)) return p;
  // Split trailing dimension suffix so honorSpeciesInTitle sees a clean stem.
  const m = p.name.match(/^(.*?)(\s+\d.*)?$/);
  const stem = (m?.[1] || p.name).trim();
  const dims = m?.[2] || "";
  const honored = honorSpeciesInTitle(stem, prompt);
  const nextName = `${honored}${dims}`.replace(/\s+/g, " ").trim();
  if (nextName === p.name) return p;
  const fitted = p.fitted ? { ...p.fitted, name: nextName } : p.fitted;
  return { ...p, name: nextName, fitted };
}

/**
 * Shared named-species primary honesty (universal densify/bind helper).
 *
 * When the stranger names a solid lumber species (teak, walnut, oak, cedar, …)
 * and fitted densify would silently keep sheet/ply as primaryMaterialId, bind
 * primary to CATALOG_LUMBER_BIND and honor the species in the title — never a
 * silent plywood default. Buy lead then speaks densifyLabel via namedStockDisplayName.
 *
 * Cedar-chest-class hinged-lid sheet carcases that already publish a substitute
 * note keep ply primary (protect cedar chest species/lining honesty).
 */
export function applyNamedLumberPrimaryHonesty(
  project: YardProject,
  prompt = project.prompt ?? "",
): YardProject {
  const species = namedLumberFromPrompt(prompt);
  if (!species) return project;

  const primary = project.primaryMaterialId;
  const notes = project.notes ?? [];

  const honorTitle = (p: YardProject) => withSpeciesTitle(p, prompt);

  if (primary === CATALOG_LUMBER_BIND) {
    return honorTitle(solidNamedPanels(project, species.display));
  }

  if (!isSheetPrimaryId(primary)) return project;

  // Protect cedar-chest-class: hinged-lid sheet carcase keeps ply + substitute note.
  const program = project.fitted?.program ?? "";
  const aff = project.fitted?.affordances ?? [];
  const chestClass =
    (/chest/i.test(project.name) || /chest/i.test(prompt)) &&
    (program === "storage" || aff.includes("hinged-lid") || /hinged\s*lid|\blid\b/i.test(prompt));
  if (chestClass) {
    return honorTitle(project);
  }

  // Bind primary to named lumber; the named solid stock drives every ¾" part
  // (edge-glued where wider than a board) so chip, cut list and Buy agree.
  return honorTitle(
    solidNamedPanels({ ...project, primaryMaterialId: CATALOG_LUMBER_BIND }, species.display),
  );
}

/** ¾" sheet parts → the named solid board. Thin (¼") backers stay plywood. */
function solidNamedPanels(project: YardProject, speciesName: string): YardProject {
  const panels = project.panels.map((p) => {
    if (!/^plywood-3-4/i.test(p.materialId ?? "")) return p;
    const t = Math.min(p.size.width, p.size.height, p.size.depth);
    if (t < 0.5) return p;
    return { ...p, materialId: CATALOG_LUMBER_BIND };
  });
  const prompt = project.prompt ?? "";
  const label = densifyLabelForPrompt(prompt) ?? `${speciesName} 1×4`;
  const thinPly = panels.some((p) => /^plywood-/i.test(p.materialId ?? "") || p.type === "drawer");
  const bindNote = `Named stock: every ¾" part is solid ${label} (true ¾" × 3½" boards). Parts wider than one board are edge-glued from boards, then cut to size — ${thinPly ? "only ¼\" backers and drawer bottoms stay ¼\" plywood" : "no plywood"}.`;
  const notes = (project.notes ?? [])
    .filter((n) => !/primary stock binds/i.test(n) && !/^Named stock:/.test(n))
    .map((n) =>
      n
        .replace(/\s*¾" plywood,\s*/g, " ")
        .replace(/\s*¾" plywood\.?/g, "")
        .trim(),
    );
  return { ...project, panels, notes: [...notes, bindNote] };
}

/** Catalog or "from 2x4" / "from 1x4" — the carcase is that board. ¼" backs and 2×2 posts stay put. */
const BOARD_SECTIONS: { id: string; thick: number; face: number }[] = [
  { id: "lumber-1x2-8", thick: 0.75, face: 1.5 },
  { id: "lumber-1x3-8", thick: 0.75, face: 2.5 },
  { id: "lumber-1x4-8", thick: 0.75, face: 3.5 },
  { id: "lumber-1x6-8", thick: 0.75, face: 5.5 },
  { id: "lumber-1x8-8", thick: 0.75, face: 7.25 },
  { id: "lumber-1x10-8", thick: 0.75, face: 9.25 },
  { id: "lumber-1x12-8", thick: 0.75, face: 11.25 },
  { id: "lumber-2x2-8", thick: 1.5, face: 1.5 },
  { id: "lumber-2x4-8", thick: 1.5, face: 3.5 },
  { id: "lumber-2x6-8", thick: 1.5, face: 5.5 },
  { id: "lumber-4x4-8", thick: 3.5, face: 3.5 },
];

function nearSection(a: number, b: number) {
  return Math.abs(a - b) < 0.08;
}

/** A member drawn as a different board section takes the named section's thickness and face. */
function sectionSize(
  size: { width: number; height: number; depth: number },
  item: CatalogItem,
): { width: number; height: number; depth: number } {
  const thick = item.dims.thickness ?? item.dims.height ?? 0.75;
  const face = item.dims.width ?? 3.5;
  const axes = (["width", "height", "depth"] as const).slice().sort((a, b) => size[a] - size[b]);
  const t = size[axes[0]];
  const w = size[axes[1]];
  const other = BOARD_SECTIONS.find(
    (s) => s.id !== item.id && nearSection(t, s.thick) && nearSection(w, s.face),
  );
  if (!other) return size;
  return { ...size, [axes[0]]: thick, [axes[1]]: face };
}

/**
 * A ¾" face recast to a thicker named board takes that board's real thickness.
 * It grows into the piece, not out of it: a top or seat grows down from its surface
 * (the typed height stays), an outer side grows inward, an inner board grows about its middle.
 * The interference solve then trims whatever it now butts into.
 */
function atBoardThickness(p: Panel, thick: number, box: { min: Record<Axis, number>; max: Record<Axis, number> }): Panel {
  if (p.yaw || p.polygon || p.outline) return p;
  const axes: Axis[] = ["width", "height", "depth"];
  const a = axes.reduce((m, k) => (p.size[k] < p.size[m] ? k : m));
  const delta = thick - p.size[a];
  if (!(delta > 0.05) || Math.abs(p.size[a] - 0.75) > 0.06) return p;
  const pos = { x: "x", width: "x", height: "y", depth: "z" } as const;
  const k = pos[a];
  const lo = p.position[k];
  const hi = lo + p.size[a];
  let shift: number;
  if (a === "height") shift = lo - delta >= box.min.height - 1e-6 ? -delta : 0;
  else if (Math.abs(hi - box.max[a]) < 0.06) shift = -delta;
  else if (Math.abs(lo - box.min[a]) < 0.06) shift = 0;
  else shift = -delta / 2;
  return { ...p, position: { ...p.position, [k]: lo + shift }, size: { ...p.size, [a]: thick } };
}

type Axis = "width" | "height" | "depth";

/** One plain line naming the parts that stay on another stock, and why. Never a silent swap. */
function keptStockNote(panels: Panel[], item: CatalogItem): string {
  const kept = new Map<string, string[]>();
  for (const p of panels) {
    const id = p.materialId ?? "";
    if (id === item.id || /^plywood-1-4/i.test(id) || Math.min(p.size.width, p.size.height, p.size.depth) <= 0.26) continue;
    const other = getCatalogItem(id);
    if (!other || (other.category !== "lumber" && !/^plywood-/i.test(id))) continue;
    const label = p.name.replace(/\s*\d+$/, "").toLowerCase();
    const list = kept.get(id) ?? [];
    if (!list.includes(label)) list.push(label);
    kept.set(id, list);
  }
  const short = item.name.replace(/\s*\(.*\)$/, "");
  return [...kept.entries()]
    .map(([id, names]) => {
      const other = getCatalogItem(id)!.name.replace(/\s*\(.*\)$/, "");
      const why = /2×2|4×4/.test(other) ? `posts need a square section and ${short} is a flat board` : `the form draws them from ${other}`;
      return `Not ${short}: ${names.join(", ")} stay ${other} — ${why}.`;
    })
    .join(" ");
}

/**
 * Never a silent swap: every lumber size / dowel / sized plywood the prompt names either shows up in the
 * build or gets one plain note saying which parts use what instead, and why.
 */
export function typedStockKeptNote(project: YardProject, prompt: string): YardProject {
  let hay = stripJoinWords(stripHeldPurpose(prompt)).toLowerCase();
  const typed: { id: string; said: string }[] = [];
  for (const [re, id] of weekendSizedStockPhrases()) {
    if (!/^(?:lumber-|dowel-|closet-rod|plywood-1-|plywood-3-4-4x10)/.test(id)) continue;
    const m = hay.match(new RegExp(String.raw`(?<![\d./])(?:${re.source})`));
    if (!m) continue;
    hay = hay.replace(m[0], " ");
    typed.push({ id, said: m[0].trim() });
  }
  if (!typed.length) return project;
  const base = (id: string) => id.replace(/^(lumber-\dx\d+)-\d+$/, "$1");
  const used = new Set([project.primaryMaterialId, ...project.panels.map((p) => p.materialId), ...project.instances.map((i) => i.catalogId)].map(base));
  const species = namedLumberFromPrompt(prompt);
  const notes = [...(project.notes ?? [])];
  // A scrap / brick row that carries the size in its name ("2×4 scrap, 5″") is that stock too.
  const usedNames = [...used].map((id) => (getCatalogItem(id)?.name ?? id).replace(/x/gi, "×")).join(" | ");
  for (const t of typed) {
    if (used.has(base(t.id))) continue;
    const item = getCatalogItem(t.id);
    if (!item) continue;
    const nominal = item.name.match(/\d\s*[×x]\s*\d+/)?.[0].replace(/\s|x/g, (c) => (c === "x" ? "×" : ""));
    if (nominal && usedNames.includes(nominal)) continue;
    const said = `${species && item.category !== "sheet_goods" ? `${species.display} ` : ""}${t.said.replace(/\s*[x×]\s*/g, "×")}`;
    if (notes.some((n) => n.startsWith(`Not ${said}`))) continue;
    const parts = new Map<string, string[]>();
    for (const p of project.panels) {
      const other = getCatalogItem(p.materialId);
      if (!other || (other.category !== "lumber" && other.category !== "sheet_goods") || Math.min(p.size.width, p.size.height, p.size.depth) <= 0.26) continue;
      const label = p.name.replace(/\s*\d+$/, "").toLowerCase();
      const list = parts.get(p.materialId) ?? [];
      if (!list.includes(label)) list.push(label);
      parts.set(p.materialId, list);
    }
    const round = item.formFactor === "dowel" || /dowel|rod/.test(item.id);
    const what = [...parts.entries()]
      .map(([id, names]) => `${names.length > 4 ? `${names.slice(0, 4).join(", ")} and the rest` : names.join(", ").replace(/, ([^,]*)$/, " and $1")} ${names.length === 1 ? "is" : "are"} ${namedStockDisplayName(prompt, getCatalogItem(id))}`)
      .join("; ");
    const why = round ? `those are flat parts and a ${t.said} is round` : `this form draws those parts from that stock`;
    notes.push(`Not ${said}: ${what || `this build uses ${namedStockDisplayName(prompt, getCatalogItem(project.primaryMaterialId))}`} — ${why}.${round ? ` Cut pegs or rods from the ${said} if you want it in the build.` : ""}`);
  }
  return notes.length === (project.notes ?? []).length ? project : { ...project, notes };
}

export function applyExplicitBoardCarcase(project: YardProject, item: CatalogItem): YardProject {
  if (item.category !== "lumber" || item.formFactor !== "board") return project;
  const thick = item.dims.thickness ?? item.dims.height ?? 0.75;
  const all = project.panels.map((p) => panelBox(p));
  const box = {
    min: { width: Math.min(...all.map((b) => b.x0)), height: Math.min(...all.map((b) => b.y0)), depth: Math.min(...all.map((b) => b.z0)) },
    max: { width: Math.max(...all.map((b) => b.x1)), height: Math.max(...all.map((b) => b.y1)), depth: Math.max(...all.map((b) => b.z1)) },
  };
  const panels = project.panels.map((p) => {
    const dims = [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b);
    const t = dims[0];
    const w = dims[1];
    const len = dims[2];
    if (t <= 0.26) {
      if (/^plywood-3-4/i.test(p.materialId ?? "")) return { ...p, materialId: "plywood-1-4-4x8" };
      return p;
    }
    const post = t > 0.8 && t <= 2.05 && Math.abs(w - t) < 0.06 && len >= w + 2;
    if (post && item.id !== "lumber-2x2-8" && item.id !== "lumber-4x4-8") return p;
    if (p.materialId === "closet-rod") return p;
    if (p.materialId === "lumber-2x2-8" && item.id !== p.materialId) return p;
    const recast = { ...p, materialId: item.id, size: sectionSize(p.size, item) };
    return thick > 0.9 ? atBoardThickness(recast, thick, box) : recast;
  });
  const label = namedStockDisplayName(project.prompt ?? "", item);
  const face = item.dims.width ?? 3.5;
  const note = [
    thick > 0.9 ? `Stock: every board part is ${label}, at its real ${inchFrac(thick)}" thickness.` : `Stock: every ¾" part is ${label}.`,
    `Parts wider than one board are edge-glued, then cut to size.`,
    face < 3.2 ? `This board is ${inchFrac(face)}" wide, so buy extra when a part is wider than the face.` : "",
    keptStockNote(panels, item),
    `¼" backs stay plywood.`,
  ]
    .filter(Boolean)
    .join(" ");
  const short = item.name.replace(/\s*\(.*\)$/, "");
  const notes = (project.notes ?? [])
    .filter((n) => !/^Named stock:/.test(n) && !/^Stock:/.test(n))
    .map((n) =>
      n
        .replace(/(\d"?\s*H\.|\.)\s*¾"\s*plywood\./, `$1 ${label}.`)
        .replace(/2×4 legs|2x4 legs/g, `${short} legs`)
        .replace(/four 2×4\b|four 2x4\b/g, `four ${short}`)
        .replace(/¾" top and seats/g, thick > 0.9 ? `${inchFrac(thick)}" top and seats` : `¾" top and seats`),
    )
    .filter((n) => !/Aprons nest on the 3\/4" sheet/.test(n));
  return { ...project, primaryMaterialId: item.id, panels, notes: [...notes, note] };
}

function panelBox(p: Panel) {
  return {
    x0: p.position.x, x1: p.position.x + p.size.width,
    y0: p.position.y, y1: p.position.y + p.size.height,
    z0: p.position.z, z1: p.position.z + p.size.depth,
  };
}

/** The picked sheet replaces ¾" faces. A face longer than that sheet stays on a sheet that fits. ¼" backs stay ¼" unless the pick is the thin sheet. */
function faceAtSheetThickness(size: { width: number; height: number; depth: number }, thick: number) {
  const axes = (["width", "height", "depth"] as const).slice().sort((a, b) => size[a] - size[b]);
  const thin = axes[0];
  if (size[thin] <= thick + 0.02) return size;
  return { ...size, [thin]: Math.round(thick * 1000) / 1000 };
}

export function applyExplicitSheetCarcase(project: YardProject, item: CatalogItem): YardProject {
  if (item.formFactor !== "sheet" && item.category !== "sheet_goods") return project;
  const sheetL = item.dims.length ?? 96;
  const thick = item.dims.thickness ?? 0.75;
  const thinPick = thick < 0.4;
  // A craft sheet is not plywood wearing a new name. Faces take that sheet's thickness.
  const craftSheet = item.category !== "sheet_goods";
  const panels = project.panels.map((p) => {
    const id = p.materialId ?? "";
    // A picked sheet outside the sheet-good class is the stock of every panel.
    // A recipe post left on lumber is not a second stock the sentence named.
    if (craftSheet) {
      if (id === item.id) return p;
      const size = faceAtSheetThickness(p.size, thick);
      return { ...p, materialId: item.id, size };
    }
    if (!/^plywood-/i.test(id)) return p;
    const long = Math.max(p.size.width, p.size.height, p.size.depth);
    if (long > sheetL + 0.5 && !craftSheet) {
      const taller = thinPick || /^plywood-1-4/i.test(id) ? "plywood-1-4-4x10" : "plywood-3-4-4x10";
      return { ...p, materialId: taller };
    }
    if (!thinPick && /^plywood-1-4/i.test(id)) return p;
    const size = craftSheet ? faceAtSheetThickness(p.size, thick) : p.size;
    return { ...p, materialId: item.id, size };
  });
  const joins = item.preferredJoins ?? [];
  const fastener = joins.includes("screw") || joins.includes("nail");
  const note = craftSheet
    ? `Stock: ${item.name}. Every panel is this sheet, at this sheet's thickness. Join it the way this sheet joins.`
    : thinPick
      ? `Stock: ${item.name}. Every plywood face is this sheet.`
      : `Stock: ${item.name}. Every ¾" face is this sheet. ¼" backs stay ¼" unless they only fit a longer sheet.`;
  const notes = (project.notes ?? [])
    .filter((n) => !/^Stock:/.test(n) && !/does not replace the sheet/i.test(n) && !/thinner than this carcase/i.test(n))
    .map((n) => (craftSheet ? n.replace(/¾["″]?\s*plywood/gi, item.name).replace(/\bplywood\b/gi, item.name) : n));
  return {
    ...project,
    primaryMaterialId: item.id,
    panels,
    notes: [...notes, note],
    joinMethod: craftSheet && !fastener ? (joins[0] as YardProject["joinMethod"]) ?? "glue" : project.joinMethod,
  };
}




function itemOf(project: YardProject): CatalogItem | undefined {
  return getCatalogItem(project.primaryMaterialId);
}

function lumberTableTop(project: YardProject, item: CatalogItem | undefined, materialId: string) {
  if (materialId === project.primaryMaterialId) return true;
  if (!item) return false;
  if (!(item.category === "lumber" || item.formFactor === "board")) return false;
  return materialId === "plywood-3-4-4x8";
}

function foreignMembers(project: YardProject, item: CatalogItem): YardInstance[] {
  return project.instances.filter((i) => i.catalogId !== item.id);
}

function foreignPanels(project: YardProject, item: CatalogItem) {
  return project.panels.filter((p) => !lumberTableTop(project, item, p.materialId));
}

/** Typed weekend size from the prompt. 3-ft hyphen and "3 foot" both count. */
export function weekendTypedSize(prompt: string): { width?: number; height?: number; depth?: number } | null {
  const lower = prompt.toLowerCase();
  const dim = stripLumberStock(lower);
  const said =
    hasExplicitSize(prompt) ||
    /\d+(?:\.\d+)?\s*-?\s*(?:ft|foot|feet|in|inch|inches)\b/.test(dim) ||
    /\d+(?:\.\d+)?\s*(?:wide|tall|high|deep|width|height|depth|span|long)\b/.test(dim);
  if (!said) return null;
  return parseSize(lower);
}

function sizeTol(item: CatalogItem | undefined) {
  const stock = item?.dims.length ?? 4.5;
  return Math.max(2.5, Math.min(stock * 0.45, 8));
}

function joinForbidden(item: CatalogItem, name: string): boolean {
  const n = name.toLowerCase();
  const kind = binderKind(item);
  const joins = new Set(item.preferredJoins ?? ["glue"]);
  if (kind !== "fastener" && !joins.has("screw") && !joins.has("nail") && /(?:wood screws|#8\s*[x×])/.test(n)) {
    return true;
  }
  if (kind === "slip" && /titebond|wood glue/.test(n) && !/solvent|pvc/.test(n)) return true;
  if (kind === "glue" && item.category === "craft_wood" && /solvent cement|pvc (?:tee|elbow|cross)/.test(n)) {
    return true;
  }
  if (kind === "tape" && /(?:wood screws|#8\s*[x×]|titebond)/.test(n)) return true;
  return false;
}

export function inspectWeekendHonesty(project: YardProject, plan?: BuildPlan | null): WeekendReport {
  const issues: WeekendIssue[] = [];
  if (!isWeekendProject(project) && project.instances.length === 0) {
    return { ok: true, issues, stockId: project.primaryMaterialId || null };
  }

  const prompt = project.prompt ?? "";
  const named = namedStockFromPrompt(prompt);
  const item = itemOf(project);
  const wire = isWireStock(item);

  // Named stock on a wire primary means generate forgot to bind.
  // CatalogPanel picking PVC on a popsicle prompt is a real pick (primary is not wire).
  if (named && wire) {
    issues.push({
      guard: "stock",
      message: `Prompt named ${named.name} but the bench is still a wire frame.`,
    });
  }

  const stock = item && !wire ? item : named && project.primaryMaterialId === named.id ? named : item;
  if (stock && !isWireStock(stock) && project.instances.length) {
    const bad = foreignMembers(project, stock);
    if (bad.length) {
      const ids = [...new Set(bad.map((i) => i.catalogId))].join(", ");
      issues.push({
        guard: "stock",
        message: `${bad.length} members are ${ids || "other stock"}, not ${stock.name}.`,
      });
    }
    const badP = foreignPanels(project, stock);
    if (badP.length) {
      issues.push({
        guard: "stock",
        message: `${badP.length} panels are not ${stock.name}.`,
      });
    }
    if (plan) {
      const primaryHit = plan.bom.some(
        (b) => {
          const label = namedStockDisplayName(prompt, stock).toLowerCase();
          return (
            b.catalogId === stock.id ||
            (b.name &&
              (b.name.toLowerCase() === stock.name.toLowerCase() || b.name.toLowerCase() === label))
          );
        },
      );
      if (project.instances.length > 0 && !primaryHit) {
        issues.push({
          guard: "stock",
          message: `Buy list does not sell ${namedStockDisplayName(prompt, stock)}.`,
        });
      }
      for (const b of plan.bom) {
        if (joinForbidden(stock, b.name)) {
          issues.push({
            guard: "join",
            message: `Buy list has ${b.name} — joins for ${stock.name} are ${(stock.preferredJoins ?? []).join("/")}.`,
          });
        }
      }
      if (binderKind(stock) === "slip") {
        const blob = plan.bom.map((b) => b.name).join(" ");
        if (!/solvent|pvc cement/i.test(blob) && plan.bom.some((b) => /titebond|wood glue/i.test(b.name))) {
          issues.push({
            guard: "join",
            message: "PVC cannot list Titebond as the only join — solvent / slip fittings.",
          });
        }
      }
    }
    if (isWholeStock(stock)) {
      const cuts = project.instances.filter((i) => i.cutLength != null);
      if (cuts.length) {
        issues.push({
          guard: "whole",
          message: `${cuts.length} ${stock.name} pieces have cut lengths — craft stock is used whole.`,
        });
      }
      if (plan?.partsKind === "cut") {
        issues.push({
          guard: "whole",
          message: `Plan is a cut list for ${stock.name}. Glue them as they come.`,
        });
      }
      if (
        plan?.cutList.some(
          (c) => !c.whole && c.lengthIn > 0 && Math.abs(c.lengthIn - (stock.dims.length ?? c.lengthIn)) > 0.15,
        )
      ) {
        issues.push({
          guard: "whole",
          message: `Cut list sells a custom-cut ${stock.name}.`,
        });
      }
    }
  }

  if (stock && !isWireStock(stock)) {
    const typed = weekendTypedSize(prompt);
    if (typed) {
      const tol = sizeTol(stock);
      const isBridge = /bridge|span|viaduct|overpass|trestle|golden gate|brooklyn/.test(prompt.toLowerCase());
      const bits: string[] = [];
      const longOnly =
        /\d+(?:\.\d+)?\s*(?:in|inch|inches|["″])?\s*long\b/.test(prompt.toLowerCase()) &&
        !/(?:tall|high|height)\b/.test(prompt.toLowerCase());
      const seatOnly =
        /seat\s*height/.test(prompt.toLowerCase()) &&
        !/(?:tall|high|height)\b/.test(prompt.toLowerCase().replace(/seat\s*height/g, " "));
      if (longOnly && typed.width != null && Math.abs(project.overall.width - typed.width) > tol) {
        bits.push(`length ${project.overall.width}" ≠ typed ${typed.width}"`);
      } else if (isBridge && typed.width != null && Math.abs(project.overall.width - typed.width) > tol) {
        bits.push(`span ${project.overall.width}" ≠ typed ${typed.width}"`);
      } else if (!isBridge && !longOnly && !seatOnly && typed.height != null && Math.abs(project.overall.height - typed.height) > tol) {
        bits.push(`H ${project.overall.height}" ≠ typed ${typed.height}"`);
      }
      if (bits.length) {
        issues.push({ guard: "size", message: `Weekend envelope: ${bits.join(", ")}` });
      }
    }
  }


  // Universal mechanism anatomy — densify must not erase launcher / climb / media-hold / pot-hold.
  const mech = detectWeekendMech(prompt);
  const blobAll = [...(project.notes || []), ...(plan?.instructions.map((s) => `${s.title} ${s.description}`) || [])].join("\n");
  if (mech === "launcher" && project.instances.length) {
    const roles = new Map<string, number>();
    for (const i of project.instances) {
      const k = i.role || "?";
      roles.set(k, (roles.get(k) || 0) + 1);
    }
    const hasPivot = (roles.get("support") || 0) + (roles.get("deck") || 0) > 0;
    if (isLauncherRamp(prompt)) {
      const rampLen = launcherRampLengthIn(prompt);
      const leaves = /leaves the ramp|free projectile|soft-?launch|leave(?:s)? free/i.test(blobAll);
      const channelTalk =
        /trough|channel|side guide|guide rail|U-?channel|floor tie|cross-?tie/i.test(blobAll);
      const deckN = roles.get("deck") || 0;
      const supportN = roles.get("support") || 0;
      const lengthSaid =
        rampLen == null ||
        new RegExp(
          `(?:ramp|run|trough|length)[^\n]{0,40}${rampLen}|${rampLen}[^\n]{0,16}(?:\"|"|in)?[^\n]{0,16}(?:ramp|run|trough|length)`,
          "i",
        ).test(blobAll) ||
        (project.overall.width >= rampLen - 1 && project.overall.width <= rampLen + 1) ||
        (project.overall.depth >= rampLen - 1 && project.overall.depth <= rampLen + 1);
      if (!hasPivot || deckN < 3 || supportN < 2) {
        issues.push({
          guard: "anatomy",
          message:
            "Launcher ramp needs a continuous trough channel (side guides + floor ties as support/deck) after densify; typed marble leaves free.",
        });
      }
      if (!leaves) {
        issues.push({
          guard: "anatomy",
          message: "Launcher ramp must say the free projectile leaves the ramp.",
        });
      }
      if (!channelTalk) {
        issues.push({
          guard: "anatomy",
          message: "Launcher ramp steps/notes must name the trough channel (side guides + floor).",
        });
      }
      if (rampLen != null && !lengthSaid) {
        issues.push({
          guard: "anatomy",
          message: `Launcher ramp length ${rampLen}" must be stated clearly.`,
        });
      }
    } else if (/\bslingshots?\b/.test(prompt.toLowerCase())) {
      const forkTalk = /fork|pouch|band|slingshot/i.test(blobAll);
      if (!hasPivot) {
        issues.push({
          guard: "anatomy",
          message: "Slingshot needs a Y-fork and a pouch (support/deck) after densify — not a catapult arm.",
        });
      }
      if (!forkTalk) {
        issues.push({
          guard: "anatomy",
          message: "Slingshot steps must name the fork and the pouch.",
        });
      }
    } else {
      const talks = /axle|pivot|throwing arm|payload|cup|spoon|bucket/i.test(blobAll);
      if (!hasPivot) {
        issues.push({
          guard: "anatomy",
          message: "Launcher missing pivot/arm/payload members (support/deck roles) after densify.",
        });
      }
      if (!talks && !hasPivot) {
        issues.push({
          guard: "anatomy",
          message: "Launcher steps/notes must name axle, throwing arm, or payload.",
        });
      }
    }
  }
  if (mech === "media-hold") {
    if (wantsMediaTipHold(prompt)) {
      const tip = mediaHoldTipDeg(prompt);
      const tipOk =
        tip == null ||
        blobAll.includes(`${tip}°`) ||
        blobAll.includes(`${tip} deg`) ||
        new RegExp(`${tip}\s*°|tip(?:\s+angle)?\s*${tip}`, "i").test(blobAll);
      const hold =
        /real (?:phone|tablet|device|book|cookbook|print|photo|card)|(?:4\s*[×x]\s*6)|(?:5\s*[×x]\s*7)|(?:8\s*[×x]\s*10)|device envelope|phone(?:\s+lean)?\s+stand|picture ledge|holds? (?:a )?real|tipped lean|front lip|open book|cookbook easel|book stand|recipe card/i.test(
          blobAll,
        ) || /phone|tablet|device|book|cookbook|easel|lip/i.test(blobAll);
      const tipRoles = new Map<string, number>();
      for (const i of project.instances) {
        const k = i.role || "?";
        tipRoles.set(k, (tipRoles.get(k) || 0) + 1);
      }
      const hasLean = (tipRoles.get("support") || 0) + (tipRoles.get("deck") || 0) > 0;
      const notDecal = !/decal|flat print|sticker face/i.test(blobAll) || /never a (?:flat )?decal|not a decal/i.test(blobAll);
      if (!hold) {
        issues.push({
          guard: "anatomy",
          message: "Media-hold tip stand must bind a real book/device envelope (not a decal).",
        });
      }
      if (project.instances.length && !hasLean) {
        issues.push({
          guard: "anatomy",
          message: "Media-hold tip stand needs lean back + lip (support/deck roles) after densify; open laptop / device envelope + tip when typed.",
        });
      }
      if (tip != null && !tipOk) {
        issues.push({
          guard: "anatomy",
          message: `Media-hold must state the ${tip}° tip angle.`,
        });
      }
      if (/8\s*[×x]\s*10/.test(prompt) && !/8\s*[×x]\s*10|8"\s*×\s*10"/.test(blobAll)) {
        issues.push({
          guard: "anatomy",
          message: "Media-hold must densify the typed 8×10 print envelope.",
        });
      }
      if (!notDecal && /decal/i.test(blobAll)) {
        issues.push({
          guard: "anatomy",
          message: "Media-hold must not treat the held media as a decal.",
        });
      }
    } else {
      const hasBack = /backing|back bar|rabbet|mat opening|slip the (picture|photo)/i.test(blobAll);
      if (!hasBack) {
        issues.push({
          guard: "anatomy",
          message: "Media-hold needs a rabbet/backing path so flat media stays put.",
        });
      }
    }
  }
  if (mech === "pot-hold" || wantsPotHold(prompt)) {
    const dia = potHoldDiameterIn(prompt);
    const basket = isHamperHold(prompt) ? basketEnvelopeWhd(prompt) : null;
    const hold =
      /plant stand|pot stand|figurine stand|hamper stand|basket stand|umbrella stand|hose reel|real (?:\d+\"?\s*)?\s*pot|figurine|pot envelope|basket envelope|laundry basket|umbrella envelope|reel envelope|monitor envelope|umbrellas?|hose reel|monitor|rise|upright/i.test(
        blobAll,
      ) || /holds? (?:a )?real/i.test(blobAll);
    const roles = new Map<string, number>();
    for (const i of project.instances) {
      const k = i.role || "?";
      roles.set(k, (roles.get(k) || 0) + 1);
    }
    const hasStand =
      (roles.get("leg") || 0) + (roles.get("deck") || 0) + (roles.get("ring") || 0) + (roles.get("support") || 0) > 0;
    if (!hold) {
      issues.push({
        guard: "anatomy",
        message: isHoseReelHold(prompt)
          ? "Hose reel stand must bind a real upright reel envelope (diameter when typed)."
          : isUmbrellaHold(prompt)
          ? "Umbrella stand must bind a real upright umbrella envelope (N×N base when typed)."
          : isMonitorHold(prompt)
          ? "Monitor stand must bind a real monitor envelope + typed rise (no Orbit chrome)."
          : isHamperHold(prompt)
            ? "Hamper stand must bind a real laundry-basket envelope upright (W×D×H when typed)."
            : "Plant / pot stand must bind a real pot envelope upright (diameter × tall when typed).",
      });
    }
    if (project.instances.length && !hasStand) {
      issues.push({
        guard: "anatomy",
        message: "Plant / pot / figurine / hamper stand needs legs + deck/ring after densify.",
      });
    }
    if (basket != null) {
      const talk = basketEnvelopeTalk(prompt);
      if (
        !(
          blobAll.includes(String(basket.w)) &&
          blobAll.includes(String(basket.d)) &&
          blobAll.includes(String(basket.h))
        ) &&
        !/18\s*[″"']?\s*[×x]\s*14/.test(blobAll)
      ) {
        issues.push({
          guard: "anatomy",
          message: `Hamper stand must state the ${talk} basket envelope.`,
        });
      }
    } else if (isHoseReelHold(prompt)) {
      const talk = reelEnvelopeTalk(prompt);
      if (!/hose\s*reel|reel envelope/i.test(blobAll) || (!/18/.test(blobAll) && !/diameter|dia|envelope|upright/i.test(blobAll))) {
        issues.push({
          guard: "anatomy",
          message: `Hose reel stand must state the ${talk}.`,
        });
      }
    } else if (isUmbrellaHold(prompt)) {
      const talk = umbrellaEnvelopeTalk(prompt);
      if (!/umbrella/i.test(blobAll) || (!/8/.test(blobAll) && !/base|envelope|upright/i.test(blobAll))) {
        issues.push({
          guard: "anatomy",
          message: `Umbrella stand must state the ${talk}.`,
        });
      }
    } else if (isMonitorHold(prompt)) {
      const talk = monitorEnvelopeTalk(prompt);
      const env = monitorEnvelopeIn(prompt);
      const rise = monitorRiseIn(prompt);
      if (
        !/monitor/i.test(blobAll) ||
        (env != null && !new RegExp(String(env)).test(blobAll)) ||
        (rise != null && !new RegExp(String(rise)).test(blobAll) && !/rise/i.test(blobAll))
      ) {
        issues.push({
          guard: "anatomy",
          message: `Monitor stand must state the ${talk} (Buy named stock; no Orbit chrome).`,
        });
      }
    } else if (dia != null && !new RegExp(String(dia)).test(blobAll)) {
      issues.push({
        guard: "anatomy",
        message: `Plant / pot stand must state the ${dia}" pot envelope.`,
      });
    }
  }
  if (mech === "climb" || project.kind === "ladder") {
    const legs = project.instances.filter((i) => i.role === "leg").length;
    const rungs = project.instances.filter((i) => i.role === "rail").length;
    if (isClimbStepStool(prompt)) {
      const rr = climbRiseRun(prompt);
      if (project.instances.length && legs < 2) {
        issues.push({ guard: "anatomy", message: "Climb step needs ≥2 legs." });
      }
      if (project.instances.length && rungs < 1) {
        issues.push({ guard: "anatomy", message: "Climb step needs a weight-bearing tread." });
      }
      const riseRunTalk =
        /rise|run|tread|step|weight-bearing/i.test(blobAll) &&
        (rr == null ||
          blobAll.includes(`${rr.rise}`) && blobAll.includes(`${rr.run}`) ||
          new RegExp(`${rr?.rise}[^\\n]{0,20}rise|[Rr]ise[^\\n]{0,12}${rr?.rise}`).test(blobAll));
      if (project.instances.length && !riseRunTalk) {
        issues.push({
          guard: "anatomy",
          message: "Climb step must use rise/run (weight-bearing human step) language; densify from named stock; kid stands on the tread.",
        });
      }
      const nSteps = Math.max(1, climbStepCount(prompt));
      if (
        nSteps >= 2 &&
        project.instances.length &&
        !/two[\s-]?step|each step|2\s+steps|top tread|second (?:step|tread)|human steps/i.test(blobAll)
      ) {
        issues.push({
          guard: "anatomy",
          message: "Two-step climb must name two human steps / top tread.",
        });
      }
      if (wantsClimbHandrail(prompt) && project.instances.length) {
        const supports = project.instances.filter((i) => i.role === "support").length;
        if (supports < 2) {
          issues.push({
            guard: "anatomy",
            message: "Spoken handrail needs posts + a grip above the top tread (support members).",
          });
        }
        if (!/hand\s*-?\s*rail|grab\s*-?\s*rail|grip you hold|hold while climbing/i.test(blobAll)) {
          issues.push({
            guard: "anatomy",
            message: "Spoken handrail must be named in steps/notes as a grip you hold while climbing.",
          });
        }
      }
    } else {
      if (project.instances.length && legs < 2) {
        issues.push({ guard: "anatomy", message: "Climb needs ≥2 side rails." });
      }
      const typedRungs = spokenRungCount(prompt);
      if (typedRungs != null) {
        if (project.instances.length && rungs !== typedRungs) {
          issues.push({
            guard: "anatomy",
            message: `Towel/blanket ladder must honor typed ${typedRungs} rungs (got ${rungs}).`,
          });
        }
      } else if (project.instances.length && rungs < 3) {
        issues.push({ guard: "anatomy", message: "Climb needs ≥3 rungs." });
      }
      if (project.instances.length && !/rung/i.test(blobAll)) {
        issues.push({ guard: "anatomy", message: "Climb steps must use rung language." });
      }
      // Typed W×H envelope for towel/blanket ladders (lean depth soft).
      if (/towel|blanket|quilt/.test(prompt.toLowerCase()) && project.instances.length) {
        const dim = prompt.toLowerCase();
        const bareH = dim.match(/(\d+(?:\.\d+)?)\s*["″']?\s*(?:tall|high|height)\b/);
        const bareW = dim.match(/(\d+(?:\.\d+)?)\s*["″']?\s*(?:wide|width)\b/);
        if (bareH) {
          const wantH = parseFloat(bareH[1]);
          if (Number.isFinite(wantH) && Math.abs(project.overall.height - wantH) > 2.5) {
            issues.push({
              guard: "size",
              message: `Towel/blanket ladder height must honor typed ${wantH}" (got ${project.overall.height}).`,
            });
          }
        }
        if (bareW) {
          const wantW = parseFloat(bareW[1]);
          if (Number.isFinite(wantW) && Math.abs(project.overall.width - wantW) > 2.0) {
            issues.push({
              guard: "size",
              message: `Towel/blanket ladder width must honor typed ${wantW}" (got ${project.overall.width}).`,
            });
          }
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, stockId: project.primaryMaterialId || null };
}

function compatibleJoin(item: CatalogItem, join?: JoinMethod | null): JoinMethod {
  const preferred = item.preferredJoins ?? [];
  if (join && preferred.includes(join)) return join;
  return effectiveJoin(item, join);
}

/**
 * Local fixes only: bind members to the named/picked stock, clear craft cut
 * lengths, snap joinMethod onto preferredJoins. Geometry rebuild is CatalogPanel / generate.
 */
/** Roles whose pieces are bought as their own stock, not the build's primary stock. */
export const OWN_STOCK_ROLES = new Set(["handle"]);

export function enforceWeekendHonesty(project: YardProject): YardProject {
  if (project.fitted || project.kind === "closet" || project.kind === "opening" || project.pocket) {
    return project;
  }
  if (!project.instances.length && !project.panels.length) return project;

  const primaryId = project.primaryMaterialId;
  const notes = [...project.notes];
  const item = getCatalogItem(primaryId);
  if (!item) return project;

  let instances = project.instances;
  if (!isWireStock(item)) {
    // Parts that carry their own stock (a ridden rocker's 2x2 handle bar, a parts-block axle, wood ball or closet-rod boiler) keep it.
    const perPiece = project.shape?.classId === "blocks";
    const own = (i: YardProject["instances"][number]) => OWN_STOCK_ROLES.has(i.role ?? "") || (perPiece && !!getCatalogItem(i.catalogId));
    const drifted = instances.some((i) => i.catalogId !== item.id && !own(i));
    if (drifted) {
      instances = instances.map((i) => (i.catalogId === item.id || own(i) ? i : { ...i, catalogId: item.id }));
      notes.push(`Honesty: every member is ${namedStockDisplayName(project.prompt ?? "", item)}.`);
    }
    if (isWholeStock(item) && instances.some((i) => i.cutLength != null && i.catalogId === item.id)) {
      instances = instances.map((i) => (i.cutLength == null || i.catalogId !== item.id ? i : { ...i, cutLength: undefined }));
      notes.push(`Honesty: ${namedStockDisplayName(project.prompt ?? "", item)} used whole. Do not cut.`);
    }
    // A member drawn well under one stick (a short lattice web) is a cut piece: the stick list says so.
    // (Tower-class builds and figures; the frozen Eiffel keeps its whole-stick contract.)
    // Animals in long craft stock (12" skewers) are drawn at each part's true length too (a skewer is longer than a snout).
    const S0 = Math.max(0.5, toPrimitive(item).length);
    const exactCut = project.shape?.classId === "humanoid" || project.shape?.classId === "flat-frame" || project.shape?.classId === "blocks" || (project.shape?.classId === "quadruped" && S0 > 8);
    if (isWholeStock(item) && (project.kind === "tower" || exactCut || project.shape?.classId === "small-house")) {
      const S = S0;
      let cut = 0;
      instances = instances.map((i) => {
        if (!i.from || !i.to || i.catalogId !== item.id) return i;
        const L = Math.hypot(i.to.x - i.from.x, i.to.y - i.from.y, i.to.z - i.from.z);
        // Template classes draw every member at its true length: anything short of a whole stick is cut.
        const exact = exactCut || (project.shape?.classId === "small-house" && i.role === "perch");
        if (exact ? L >= S - 0.07 : L >= S * 0.6) return i;
        cut++;
        return { ...i, cutLength: Math.max(0.25, Math.round(L * 16) / 16) };
      });
      if (cut) for (let k = notes.length - 1; k >= 0; k--) if (/Do not cut\.?$/.test(notes[k])) notes.splice(k, 1);
      if (cut) notes.push(`${cut} short members are cut from whole ${namedStockDisplayName(project.prompt ?? "", item)}s — the stick list gives each length.`);
    }
  }

  const panels = project.panels.map((p) =>
    lumberTableTop({ ...project, primaryMaterialId: primaryId }, item, p.materialId) ||
    // Thin (¼") plywood backers stay plywood whatever the named frame stock.
    (p.type === "back" && /^plywood-1-4/.test(p.materialId ?? "") && Math.min(p.size.width, p.size.height, p.size.depth) <= 0.26) ||
    // A chipboard backer on a stick frame stays chipboard (it is on Buy as its own line).
    (p.type === "back" && p.materialId === "chipboard-sheet") ||
    // Frame glazing (glass / acrylic) is bought, never the frame stock.
    p.type === "glass_panel"
      ? p
      : { ...p, materialId: item.id },
  );

  const joinMethod = isWireStock(item) ? project.joinMethod : compatibleJoin(item, project.joinMethod);

  if (
    instances === project.instances &&
    panels.every((p, i) => p === project.panels[i]) &&
    primaryId === project.primaryMaterialId &&
    joinMethod === project.joinMethod &&
    notes.length === project.notes.length
  ) {
    return project;
  }

  return {
    ...project,
    primaryMaterialId: primaryId,
    instances,
    panels,
    joinMethod,
    notes: notes.filter((n, i) => notes.indexOf(n) === i),
  };
}

export function weekendCutLines(project: YardProject): CutLine[] {
  const item = itemOf(project);
  if (!item || isWireStock(item) || !project.instances.length) return [];
  const stockLen = item.dims.length ?? 0;
  const width = item.dims.width ?? item.dims.diameter ?? 0;
  const thick = item.dims.thickness ?? item.dims.height ?? item.dims.diameter ?? 0;
  const label = namedStockDisplayName(project.prompt ?? "", item);
  const whole = isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  if (whole) {
    return [
      {
        id: item.id,
        name: label,
        quantity: project.instances.length,
        lengthIn: stockLen,
        widthIn: width,
        thicknessIn: thick,
        material: label,
        whole: true,
        notes: `Full ${label}s from the pack. Glue. Do not cut.`,
      },
    ];
  }
  const grouped = new Map<string, CutLine>();
  const hay = (project.prompt ?? "").toLowerCase();
  const ladderRungs =
    (project.kind === "ladder" || detectWeekendMech(hay) === "climb") &&
    !isClimbStepStool(project.prompt ?? "") &&
    (/towel|blanket|quilt|\bladder\b/.test(hay) || project.kind === "ladder");
  for (const inst of project.instances) {
    const lenRaw = inst.cutLength ?? memberSpan(inst.from, inst.to) ?? stockLen;
    const len = Math.round(lenRaw * 8) / 8;
    // Towel/blanket ladder climb cut parts: Rung not Rail (role stays rail for anatomy counts).
    let family = (inst.role || "member").replace(/^\w/, (c) => c.toUpperCase());
    if (ladderRungs && inst.role === "rail") family = "Rung";
    // The row's section is the member as drawn (ripped strip, cut disc, or the row's own stock), never the primary sheet's width.
    const rowItem = getCatalogItem(inst.catalogId) ?? item;
    const rowW = inst.round ?? inst.section?.width ?? rowItem.dims.width ?? rowItem.dims.diameter ?? width;
    const rowT = inst.section?.height ?? rowItem.dims.thickness ?? rowItem.dims.height ?? rowItem.dims.diameter ?? thick;
    const key = `${inst.catalogId}|${family}|${len}|${rowW}x${rowT}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    const rowLabel = namedStockDisplayName(project.prompt ?? "", rowItem);
    grouped.set(key, {
      id: key,
      name: family,
      quantity: 1,
      lengthIn: inst.round ? rowW : len,
      widthIn: rowW,
      thicknessIn: rowT,
      material: rowLabel,
      whole: false,
      ...(inst.round ? { notes: `Cut round, ${inchFrac(rowW)}" across.` } : {}),
    });
  }
  return [...grouped.values()].sort((a, b) => b.lengthIn - a.lengthIn || a.name.localeCompare(b.name));
}

function letterLabel(i: number) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function stampWeekendCuts(lines: CutLine[]): CutLine[] {
  return lines.map((line, i) => ({ ...line, label: line.label ?? letterLabel(i) }));
}

/** Rewrite a craft plan so Buy/cut list cannot sell the wrong join or a snipped popsicle. */
export function honestWeekendPlan(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!isWeekendProject(project) && !project.instances.length) return plan;
  const item = itemOf(project);
  if (!item || isWireStock(item)) return plan;

  const stockLabel = namedStockDisplayName(project.prompt ?? "", item);
  let bom = plan.bom.filter((b) => !joinForbidden(item, b.name));
  // Densify catalog row stays lumber-1x4; Buy/cut/marketplace labels keep spoken cedar/popsicle identity.
  // Chip may say Cedar 1×4 — offer rows must not leave bare "1×4 Board" beside it.
  bom = bom.map((b) => {
    const matches =
      b.catalogId === item.id || (b.name && b.name.toLowerCase() === item.name.toLowerCase());
    if (!matches) return b;
    const offers = b.offers?.map((o) => {
      if (!o.title) return o;
      const bare =
        o.title === item.name ||
        o.title.toLowerCase() === item.name.toLowerCase() ||
        (/board|stud/i.test(item.name) &&
          /^\d+\s*[×x]\s*\d+(\s*Board)?(\s*\([^)]*\))?$/i.test(o.title.trim()));
      return bare && stockLabel !== item.name ? { ...o, title: stockLabel } : o;
    });
    return { ...b, name: stockLabel, ...(offers ? { offers } : {}) };
  });
  const binders = binderBom(item, project.instances, project.joinMethod);
  for (const line of binders) {
    if (!bom.some((b) => b.name === line.name)) bom = [...bom, line];
  }

  const whole = isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  let cutList = plan.cutList;
  if (whole) {
    cutList = stampWeekendCuts(weekendCutLines(project)).slice(0, 2);
  } else if (!cutList.length) {
    cutList = stampWeekendCuts(weekendCutLines(project));
  } else {
    // Refresh material labels on existing cut lines when densify hid the spoken stock.
    cutList = cutList.map((c) =>
      c.material && c.material.toLowerCase() === item.name.toLowerCase()
        ? { ...c, material: stockLabel, name: c.whole ? stockLabel : c.name }
        : c,
    );
  }

  return {
    ...plan,
    bom,
    cutList,
    partsKind: whole ? "whole" : plan.partsKind ?? "cut",
  };
}
