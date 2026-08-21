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
  if (bareD && !ftD && !inD) depth = parseFloat(bareD[1]);
  if (bareH && !ftTall && !inTall) height = parseFloat(bareH[1]);
  if (bareW && !ftW && !inW) width = parseFloat(bareW[1]);

  if (!ftW && !inW && !bareW && !(pair && !isLumberPair(parseFloat(pair?.[1] ?? "0"), parseFloat(pair?.[2] ?? "0"))) && !(isBridge && (ftAny || inAny))) {
    if (isArch) {
      width = Math.max(24, height * 0.55);
      depth = Math.max(10, Math.min(height * 0.28, 28));
    } else if (isBridge) {
      if (width <= 24 && height > 24) {
        width = height;
        height = Math.max(10, width * 0.28);
      }
      depth = Math.max(8, Math.min(width * 0.12, 16));
    } else {
      width = Math.max(12, height * 0.5);
      depth = width;
    }
  }

  if (isBridge && width < height && !/golden gate|brooklyn|suspension|tall|high|height/.test(lower)) {
    const span = Math.max(width, height);
    height = Math.min(height, Math.max(10, span * 0.3));
    width = span;
  }

  height = Math.min(Math.max(height, 6), 480);
  width = Math.min(Math.max(width, 6), 480);
  depth = Math.min(Math.max(depth, 4), 480);
  return { height, width, depth };
}

/** Nominal lumber like 2x4 / 1x6 / 4x4 is stock, not a size. */
export function isLumberPair(a: number, b: number, c?: number): boolean {
  if (c != null && c > 0) return false;
  const nom = new Set([1, 2, 4, 5, 6, 8]);
  const face = new Set([2, 3, 4, 6, 8, 10, 12]);
  return nom.has(a) && face.has(b) && a <= 8 && b <= 12;
}

const LUMBER_STOCK_RE =
  /\b(?:from\s+)?(?:[1-8]\s*[x×]\s*(?:2|3|4|6|8|10|12)|two by four|two by six|two by eight|one by four|one by six|four by four)\b/gi;

export function stripLumberStock(text: string): string {
  return text.replace(LUMBER_STOCK_RE, " ");
}

export function hasExplicitSize(prompt: string): boolean {
  const lower = stripLumberStock(prompt.toLowerCase());
  if (/\d+(?:\.\d+)?\s*(?:ft|foot|feet|in|inch|inches)\s*(?:tall|high|wide|deep|long|span)/.test(lower)) return true;
  if (/\d+(?:\.\d+)?\s*(?:wide|width|deep|depth|tall|high|height|long)\b/.test(lower)) return true;
  if (/\d+(?:\.\d+)?\s*(?:ft|foot|feet)\b/.test(lower)) return true;
  if (/\d+(?:\.\d+)?\s*(?:in|inch|inches)\b/.test(lower)) return true;
  const pair = lower.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/,
  );
  if (pair && !isLumberPair(parseFloat(pair[1]), parseFloat(pair[2]), pair[3] ? parseFloat(pair[3]) : undefined)) {
    return true;
  }
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

export function detectMaterial(prompt: string): CatalogItem {
  const lower = prompt.toLowerCase();
  const phrases: [RegExp, string][] = [
    [/jumbo (craft|popsicle)/, "popsicle-jumbo"],
    [/giant (craft|popsicle)/, "popsicle-giant"],
    [/mini (craft|popsicle)/, "popsicle-mini"],
    [/popsicle|craft stick/, "popsicle-standard"],
    [/paper towel/, "paper-towel-roll"],
    [/toilet paper|tp roll/, "toilet-paper-roll"],
    [/paper cup|dixie cup/, "paper-cup-9oz"],
    [/mailing tube|poster tube|cardboard tubes?/, "mailing-tube-2x24"],
    [/3\/4.?inch pvc|3\/4 pvc|three quarter pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch pvc|half inch pvc|1\/2 pvc/, "pvc-half-sch40"],
    [/1.?inch pvc|one inch pvc/, "pvc-1-sch40"],
    [/pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch dowel|half inch dowel/, "dowel-1-2-36"],
    [/1\/4.?inch dowel|quarter inch dowel/, "dowel-1-4-36"],
    [/dowel/, "dowel-1-2-36"],
    [/cedar/, "lumber-cedar-1x6-8"],
    [/4\s*[x×]\s*4|four by four/, "lumber-4x4-8"],
    [/2\s*[x×]\s*6|two by six/, "lumber-2x6-8"],
    [/2\s*[x×]\s*4|two by four|stud/, "lumber-2x4-8"],
    [/1\s*[x×]\s*6|one by six/, "lumber-1x6-8"],
    [/1\s*[x×]\s*4|one by four/, "lumber-1x4-8"],
    [/plywood/, "plywood-3-4-4x8"],
    [/foam/, "foam-board-20x30"],
    [/cardboard/, "cardboard-corrugated-sheet"],
    [/straw/, "straw-plastic"],
    [/toothpick/, "toothpick"],
    [/skewer/, "bamboo-skewer-12"],
    [/soda can|aluminum can/, "soda-can"],
    [/bottle/, "plastic-bottle-16oz"],
    [/lego/, "legos-2x4"],
    [/copper/, "copper-pipe-half"],
    [/pool noodle|noodle/, "pool-noodle"],
  ];
  for (const [re, id] of phrases) {
    if (re.test(lower)) {
      const item = getCatalogItem(id);
      if (item) return item;
    }
  }
  const ranked = searchCatalog(lower, 5);
  return ranked[0] ?? FORGE_CATALOG[0];
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
  const xs = list.map((i) => i.position.x);
  const ys = list.map((i) => i.position.y);
  const zs = list.map((i) => i.position.z);
  const pad = Math.max(4, (toPrimitive(item).width || 2) * 2);
  const names: Partial<Record<StructureKind, string>> = {
    eiffel: "Eiffel frame",
    arch: "Garden arch",
    bridge: "Bridge",
    closet: "Fitted unit",
  };
  return {
    id: createId("proj"),
    name: extra.name ?? names[kind] ?? `${item.name} ${kind}`,
    prompt,
    kind,
    overall: {
      width: Math.max(12, (Math.max(...xs, 0) - Math.min(...xs, 0) || 0) + pad * 2),
      height: Math.max(12, (Math.max(...ys, 0) - Math.min(...ys, 0) || 0) + pad),
      depth: Math.max(12, (Math.max(...zs, 0) - Math.min(...zs, 0) || 0) + pad * 2),
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
