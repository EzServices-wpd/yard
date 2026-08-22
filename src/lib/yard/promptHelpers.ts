import { createId } from "@/lib/utils";
import { FORGE_CATALOG, getCatalogItem, searchCatalog } from "./catalog";
import { toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { detectForm } from "./form";
import { classifyAnatomy } from "./anatomy";
import type { CatalogItem, StructureKind, YardInstance, YardProject } from "./types";

export function parseSize(lower: string): { height: number; width: number; depth: number } {
  let height = 24;
  let width = 24;
  let depth = 24;

  const isBridge = /bridge|span|viaduct|overpass|trestle|golden gate|brooklyn/.test(lower);
  const isArch = /arch|arbor|arbour|pergola|gateway|portal/.test(lower);
  const dimText = stripLumberStock(lower);

  const ftTall = dimText.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:tall|high|height|tower)\b/);
  const inTall = dimText.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:tall|high)\b/);
  const ftAny = dimText.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\b/);
  const inAny = dimText.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/);

  if (ftTall) height = parseFloat(ftTall[1]) * 12;
  else if (inTall) height = parseFloat(inTall[1]);
  else if (ftAny && isBridge) width = parseFloat(ftAny[1]) * 12;
  else if (inAny && isBridge && !/wide|width|deep|depth/.test(dimText)) width = parseFloat(inAny[1]);
  else if (ftAny) height = parseFloat(ftAny[1]) * 12;
  else if (inAny) height = parseFloat(inAny[1]);

  const pair = dimText.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/,
  );
  if (pair && !isLumberPair(parseFloat(pair[1]), parseFloat(pair[2]), pair[3] ? parseFloat(pair[3]) : undefined)) {
    width = parseFloat(pair[1]);
    height = parseFloat(pair[2]);
    if (pair[3]) depth = parseFloat(pair[3]);
  }

  const ftW = dimText.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wide|width|long|span)\b/);
  const inW = dimText.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:wide|width)\b/);
  if (ftW) width = parseFloat(ftW[1]) * 12;
  else if (inW) width = parseFloat(inW[1]);

  const ftD = dimText.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:deep|depth)\b/);
  const inD = dimText.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:deep|depth)\b/);
  if (ftD) depth = parseFloat(ftD[1]) * 12;
  else if (inD) depth = parseFloat(inD[1]);

  const bareD = dimText.match(/(\d+(?:\.\d+)?)\s*(?:deep|depth)\b/);
  const bareH = dimText.match(/(\d+(?:\.\d+)?)\s*(?:tall|high|height)\b/);
  const bareW = dimText.match(/(\d+(?:\.\d+)?)\s*(?:wide|width)\b/);
  if (bareD && !ftD && !inD) depth = parseFloat(bareD[1]) * ( /ft|foot|feet/.test(bareD[0]) ? 12 : 1);
  if (bareH && !ftTall && !inTall) height = parseFloat(bareH[1]) * ( /ft|foot|feet/.test(bareH[0]) ? 12 : 1);
  if (bareW && !ftW && !inW) width = parseFloat(bareW[1]) * ( /ft|foot|feet/.test(bareW[0]) ? 12 : 1);

  if (isArch && width === 24 && height === 24) {
    width = 48;
    height = 84;
    depth = 16;
  }
  if (isBridge && width === 24 && height === 24) {
    width = 96;
    height = 24;
    depth = 18;
  }

  return { height, width, depth };
}

function stripLumberStock(s: string): string {
  return s
    .replace(/\b\d+\s*[x×]\s*\d+(?:\s*[x×]\s*\d+)?(?:\s*(?:ft|foot|feet|in|inch|inches))?\b/gi, " ")
    .replace(/\b(?:1x4|2x4|1x6|2x6|4x4|2x8|1x2)\b/gi, " ");
}

function isLumberPair(a: number, b: number, c?: number): boolean {
  const dims = [a, b, ...(c != null ? [c] : [])].sort((x, y) => x - y);
  if (dims.length === 2) {
    return (dims[0] <= 4 && dims[1] <= 12) || (dims[0] <= 2 && dims[1] <= 8);
  }
  return dims[0] <= 4 && dims[1] <= 12;
}

export function hasExplicitSize(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (/\d+(?:\.\d+)?\s*(?:ft|foot|feet|in|inch|inches)\s*(?:tall|high|wide|deep|long|span)/.test(lower)) return true;
  if (/\d+(?:\.\d+)?\s*(?:x|by|×)\s*\d+/.test(stripLumberStock(lower))) return true;
  const pair = stripLumberStock(lower).match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/);
  if (pair && !isLumberPair(parseFloat(pair[1]), parseFloat(pair[2]))) return true;
  return false;
}

export function defaultSizeFor(
  kind: StructureKind,
  size: { height: number; width: number; depth: number },
  prompt: string,
): { height: number; width: number; depth: number } {
  const lower = prompt.toLowerCase();
  const explicit = hasExplicitSize(prompt);
  const ftLen = stripLumberStock(lower).match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\b/);
  const isTable = /table|desk|workbench|picnic/.test(lower);
  if (explicit && isTable && ftLen && !/tall|high|height/.test(lower)) {
    const span = parseFloat(ftLen[1]) * 12;
    return { width: span, height: 30, depth: Math.max(size.depth, 24) };
  }
  if (explicit && kind === "ladder" && ftLen && !/wide|deep/.test(lower)) {
    return { width: 18, depth: 6, height: parseFloat(ftLen[1]) * 12 };
  }
  if (explicit) return size;
  if (kind === "furniture" || /chair|stool/.test(lower)) {
    if (/chair|stool/.test(lower)) return { width: 18, depth: 16, height: 36 };
    if (/picnic/.test(lower)) return { width: 72, depth: 28, height: 30 };
    if (isTable) return { width: 48, depth: 24, height: 30 };
    if (/planter|garden box|raised/.test(lower)) return { width: 36, depth: 12, height: 12 };
    if (/\bbed\b/.test(lower)) return { width: 80, depth: 54, height: 18 };
    return { width: 36, depth: 18, height: 30 };
  }
  if (kind === "ladder") return { width: 18, depth: 6, height: 96 };
  if (/birdhouse/.test(lower)) return { width: 8, depth: 8, height: 12 };
  if (kind === "castle") return { width: 24, depth: 24, height: 20 };
  if (kind === "house") return { width: 24, depth: 18, height: 22 };
  if (kind === "arch" && /walk/.test(lower)) return { width: 42, depth: 16, height: 72 };
  if (/ramp/.test(lower)) return { width: 72, depth: 24, height: 24 };
  if (kind === "figure" && /robot/.test(lower)) return { width: 12, depth: 10, height: 24 };
  return size;
}

export function detectStructure(lower: string): StructureKind {
  const hit = classifyAnatomy(lower);
  if (hit.anatomy === "opening") return "opening";
  if (hit.anatomy === "fitted") return "closet";
  return detectForm(lower, parseSize(lower)).kind;
}

/** True when the prompt names a concrete stock (not just a form). */
export function hasExplicitStock(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /jumbo (craft|popsicle)|giant (craft|popsicle)|popsicle|craft stick|toothpick|drinking straw|plastic straw|\bstraws?\b|pool noodle|pvc|schedule.?40|sch.?40|1\s*[x×]\s*[246]|2\s*[x×]\s*[246]|1x4|2x4|1x6|2x6|\bdowel\b|plywood|sheet goods|cardboard|lego|\bbrick\b|bamboo|skewer|paper.?towel|toilet.?paper|foam|balsa|basswood|cedar|pine board|lumber/.test(
      lower,
    )
  );
}

export function isWireStock(item: CatalogItem | undefined | null): boolean {
  return !!item && (item.id === "wire-frame" || !!item.tags?.includes("wire"));
}

export function detectMaterial(prompt: string): CatalogItem {
  const lower = prompt.toLowerCase();
  const phrases: [RegExp, string][] = [
    [/jumbo (craft|popsicle)/, "popsicle-jumbo"],
    [/giant (craft|popsicle)/, "popsicle-giant"],
    [/popsicle|craft stick/, "popsicle-standard"],
    [/toothpick/, "toothpick"],
    [/drinking straw|plastic straw|\bstraws?\b/, "straw-plastic"],
    [/pvc|schedule.?40|sch.?40/, "pvc-3-4-sch40"],
    [/1\s*[x×]\s*4|1x4/, "lumber-1x4-8"],
    [/2\s*[x×]\s*4|2x4/, "lumber-2x4-8"],
    [/\bdowel\b/, "dowel-1-4-36"],
    [/plywood|sheet goods/, "plywood-3-4-4x8"],
    [/bamboo|skewer/, "bamboo-skewer-12"],
    [/paper.?towel/, "paper-towel-roll"],
  ];
  for (const [re, id] of phrases) {
    if (re.test(lower)) {
      const item = getCatalogItem(id);
      if (item) return item;
    }
  }
  // No stock named → wire skeleton. User picks real material from Stock panel.
  return getCatalogItem("wire-frame") || FORGE_CATALOG[0];
}

export function toProject(
  prompt: string,
  item: CatalogItem,
  kind: StructureKind,
  instances: YardInstance[],
  notes: string[],
  historic = false,
  extra: Pick<YardProject, "supportOffer" | "buildStats" | "joinMethod"> & { name?: string } = {},
): YardProject {
  let list = instances;
  if (list.length > 8000) {
    list = list.slice(0, 8000);
    notes = [
      ...notes,
      `Stopped at 8,000 pieces — the bench will hitch past that. This is a renderer limit, not a materials cap. Use longer stock or a shorter span.`,
    ];
  } else if (list.length > 1500) {
    notes = [...notes, `${list.length} pieces. Orbit may hitch on a phone — that is expected, not a cap.`];
  }
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const i of list) {
    if (i.from && i.to) {
      xs.push(i.from.x, i.to.x);
      ys.push(i.from.y, i.to.y);
      zs.push(i.from.z, i.to.z);
    } else {
      xs.push(i.position.x);
      ys.push(i.position.y);
      zs.push(i.position.z);
    }
  }
  const stockW = toPrimitive(item).width || 1;
  const pad = Math.max(0.5, stockW * 0.55);
  const names: Partial<Record<StructureKind, string>> = {
    eiffel: "Eiffel frame",
    arch: "Garden arch",
    bridge: "Bridge",
    closet: "Fitted unit",
    furniture: "Furniture",
    ladder: "Ladder",
    table: "Table",
  };
  return {
    id: createId("proj"),
    name: extra.name ?? names[kind] ?? `${item.name} ${kind}`,
    prompt,
    kind,
    overall: {
      width: Math.max(8, (Math.max(...xs, 0) - Math.min(...xs, 0) || 0) + pad * 2),
      height: Math.max(8, (Math.max(...ys, 0) - Math.min(...ys, 0) || 0) + pad),
      depth: Math.max(8, (Math.max(...zs, 0) - Math.min(...zs, 0) || 0) + pad * 2),
    },
    instances: withHome(list),
    panels: [],
    primaryMaterialId: item.id,
    joinMethod: extra.joinMethod,
    notes,
    historic,
    supportOffer: extra.supportOffer,
    buildStats: extra.buildStats,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

const OBJECT_WORD =
  /\b(eiffel|pyramid|taj|giraffe|robot|castle|arch|bridge|chair|desk|vanity|closet|ladder|table|birdhouse|window|stool|bench|tower)\b/;

export function looksLikeFollowOn(prompt: string, currentPrompt: string): boolean {
  const p = prompt.trim();
  if (!currentPrompt.trim() || p.length > 160) return false;
  const lower = p.toLowerCase();
  const current = currentPrompt.toLowerCase();
  const named = lower.match(OBJECT_WORD);
  if (named && !current.includes(named[0]) && !/^(make |add |from |cut |don'?t|taller|shorter|wider)/i.test(lower)) {
    return false;
  }
  return (
    /^(make |add |remove |taller|shorter|wider|narrower|from |cut the |don'?t cut|without |with \d|more |less |bigger|smaller|whole sticks|glue only)/i.test(
      p,
    ) || (p.length < 56 && !OBJECT_WORD.test(lower))
  );
}

export function followOnNamesStock(prompt: string): boolean {
  return /popsicle|craft stick|1\s*[x×]\s*[46]|2\s*[x×]\s*[46]|pvc|cardboard|plywood|straw|toothpick|dowel|cedar/.test(
    prompt.toLowerCase(),
  );
}

export function applyFollowOnSize(
  box: { width: number; height: number; depth: number },
  prompt: string,
): { width: number; height: number; depth: number } {
  const lower = prompt.toLowerCase();
  const take = (re: RegExp) => {
    const m = lower.match(re);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return /ft|foot/.test(m[0]) ? n * 12 : n;
  };
  let { width, height, depth } = box;
  const taller = take(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|ft|foot|feet)?\s*(?:taller|higher)/);
  if (taller) height += taller;
  else if (/taller|higher/.test(lower)) height *= 1.18;
  const shorter = take(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|ft|foot|feet)?\s*shorter/);
  if (shorter) height = Math.max(8, height - shorter);
  else if (/\bshorter\b/.test(lower)) height *= 0.85;
  const wider = take(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|ft|foot|feet)?\s*wider/);
  if (wider) width += wider;
  else if (/\bwider\b/.test(lower)) width *= 1.18;
  const deeper = take(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?\s*deeper/);
  if (deeper) depth += deeper;
  return { width, height, depth };
}
