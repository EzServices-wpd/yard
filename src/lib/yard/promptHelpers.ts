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

  const ftTall = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:tall|high|height|tower)\b/);
  const inTall = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:tall|high)\b/);
  const ftAny = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\b/);
  const inAny = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/);

  if (ftTall) height = parseFloat(ftTall[1]) * 12;
  else if (inTall) height = parseFloat(inTall[1]);
  else if (ftAny && isBridge) width = parseFloat(ftAny[1]) * 12;
  else if (inAny && isBridge && !/wide|width|deep|depth/.test(lower)) width = parseFloat(inAny[1]);
  else if (ftAny) height = parseFloat(ftAny[1]) * 12;
  else if (inAny) height = parseFloat(inAny[1]);

  const pair = lower.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/,
  );
  if (pair) {
    width = parseFloat(pair[1]);
    height = parseFloat(pair[2]);
    if (pair[3]) depth = parseFloat(pair[3]);
  }

  const ftW = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wide|width|long|span)\b/);
  const inW = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:wide|width)\b/);
  if (ftW) width = parseFloat(ftW[1]) * 12;
  else if (inW) width = parseFloat(inW[1]);

  const ftD = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:deep|depth)\b/);
  const inD = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:deep|depth)\b/);
  if (ftD) depth = parseFloat(ftD[1]) * 12;
  else if (inD) depth = parseFloat(inD[1]);

  if (!ftW && !inW && !pair && !(isBridge && (ftAny || inAny))) {
    if (isArch) {
      width = Math.max(24, height * 0.55);
      depth = Math.max(10, Math.min(height * 0.28, 28));
    } else if (isBridge) {
      /* width already is the span */
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
    [/mailing tube|poster tube/, "mailing-tube-2x24"],
    [/3\/4.?inch pvc|3\/4 pvc|three quarter pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch pvc|half inch pvc|1\/2 pvc/, "pvc-half-sch40"],
    [/1.?inch pvc|one inch pvc/, "pvc-1-sch40"],
    [/pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch dowel|half inch dowel/, "dowel-1-2-36"],
    [/1\/4.?inch dowel|quarter inch dowel/, "dowel-1-4-36"],
    [/dowel/, "dowel-1-2-36"],
    [/2\s*[x×]\s*4|two by four|stud/, "lumber-2x4-8"],
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
