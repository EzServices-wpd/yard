import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { withHome } from "./assembly";
import { detectForm } from "./form";
import { classifyAnatomy } from "./anatomy";
import { figureIdentityLabel, isLauncherRamp, launcherRampLengthIn, detectWeekendMech, mediaHoldTipDeg, wantsMediaTipHold, wantsPotHold, potHoldDiameterIn, potHoldHeightIn, marbleDiameterIn, climbRiseRun, climbStepCount } from "./weekendFamily";
import type { CatalogItem, StructureKind, YardInstance, YardProject } from "./types";

export function parseSize(lower: string): { height: number; width: number; depth: number } {
  let height = 24;
  let width = 24;
  let depth = 24;

  const isBridge = /bridge|span|viaduct|overpass|trestle|golden gate|brooklyn/.test(lower);
  const isArch = /arch|arbor|arbour|pergola|gateway|portal/.test(lower);
  const dimText = stripLumberStock(lower).replace(/[″″]/g, '"').replace(/[–—]/g, "-");

  const ftTall = dimText.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:ft|foot|feet)\s*(?:tall|high|height|tower)\b/);
  const inTall = dimText.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:in|inch|inches)\s*(?:tall|high)\b/);
  const ftAny = dimText.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:ft|foot|feet)\b/);
  const inAny = dimText.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:in|inch|inches)\b/);

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

  // Soft-launch / marble trough: typed run length is the envelope long axis.
  if (isLauncherRamp(lower)) {
    const rampLen = launcherRampLengthIn(lower);
    const marbleDia = marbleDiameterIn(lower);
    if (rampLen != null) {
      const long = Math.max(rampLen, 8);
      // Channel clear must leave the typed marble free — short axis ≥ marble + guides.
      const short = Math.max(3, marbleDia != null ? marbleDia * 4 + 1.5 : 0, Math.min(long * 0.55, 10));
      const rise = Math.max(2, Math.min(long * 0.45, 12));
      // Prefer depth as the run when width still defaulted.
      if (width === 24 && depth === 24 && height === 24) {
        depth = long;
        width = short;
        height = rise;
      } else {
        // Keep typed axes; force the longest horizontal to the run length.
        if (depth >= width) depth = long;
        else width = long;
      }
    }
  }


  // Media-hold tip stand: typed device/sheet/card/laptop size binds the envelope (e.g. 11" tablet, 13" open laptop, 4×6 card).
  if (detectWeekendMech(lower) === "media-hold" && wantsMediaTipHold(lower)) {
    const cardPair = dimText.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:card|print|photo|sheet)\b/);
    const tallM = dimText.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:tall|high)\b/);
    const wideM = dimText.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:wide|width)\b/);
    const device =
      dimText.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:tablet|ipad|device|phone|laptop|sheet|print|photo|card)/) ||
      dimText.match(/(?:tablet|ipad|device|phone|laptop|sheet|print|photo|card)[^\d]{0,12}(\d+(?:\.\d+)?)\s*"?/) ||
      dimText.match(/open\s+(\d+(?:\.\d+)?)\s*"?\s*laptop/);
    // Phone / lean: honor labeled tall × wide (e.g. 6" tall × 3" wide at 20° tip).
    if (tallM && wideM && /phone|charging\s*lean|(?:phone|tablet).{0,24}lean|lean.{0,24}phone/.test(dimText)) {
      const tip = mediaHoldTipDeg(lower) ?? 15;
      const rad = (tip * Math.PI) / 180;
      height = parseFloat(tallM[1]);
      width = parseFloat(wideM[1]);
      depth = Math.max(3, height * Math.sin(rad) + 1.5);
    } else if (cardPair) {
      const a = parseFloat(cardPair[1]);
      const b = parseFloat(cardPair[2]);
      // Recipe / photo cards read W×H of the face (4×6 → 6 wide × 4 tall landscape face).
      width = Math.max(a, b);
      height = Math.min(a, b);
      const tip = mediaHoldTipDeg(lower) ?? 15;
      const rad = (tip * Math.PI) / 180;
      depth = Math.max(3, height * Math.sin(rad) + 2);
    } else if (device) {
      const span = Math.max(parseFloat(device[1]), 4);
      const tip = mediaHoldTipDeg(lower) ?? 15;
      const rad = (tip * Math.PI) / 180;
      // Open laptop is landscape envelope; phones/tablets stay portrait unless marked landscape.
      if (/landscape|open\s+laptop|laptop/.test(dimText)) {
        width = span;
        height = Math.max(4, Math.min(span * 0.65, span));
      } else {
        height = span;
        width = Math.max(4, Math.min(span * 0.75, span));
      }
      depth = Math.max(3, span * Math.sin(rad) + 2);
    }
  }

  // Plant / pot stand: typed pot diameter × tall binds the upright pot envelope (stand slightly larger).
  if (detectWeekendMech(lower) === "pot-hold" || wantsPotHold(lower)) {
    const dia = potHoldDiameterIn(lower);
    const potH = potHoldHeightIn(lower);
    if (dia != null || potH != null) {
      const d = dia ?? potH ?? 4;
      const h = potH ?? Math.max(d * 1.0, 4);
      // Envelope for the pot itself is dia × tall; stand clears ~¾" around.
      const span = Math.max(d + 1.5, d, 4);
      width = span;
      depth = span;
      height = Math.max(h + 1.25, h, span * 0.85);
    }
  }

  // Climb / step stool: typed rise × run binds total envelope (steps × each tread).
  // Natural "7 inch rise 9 inch run" must not leave height stuck on the first inch token.
  if (detectWeekendMech(lower) === "climb") {
    const rr = climbRiseRun(lower);
    const steps = Math.max(1, climbStepCount(lower) || 1);
    if (rr != null) {
      height = rr.rise * steps;
      depth = rr.run * steps;
      if (width === 24) width = Math.max(12, Math.min(18, rr.run + 6));
    }
  }

  return { height, width, depth };
}

export function stripLumberStock(s: string): string {
  // Only eat lumber nominals (2x4, 2x4x8). Do not delete 36x48 windows / 60x30 desks.
  // Protect photo/print/card sizes (4x6 card, 5x7 print) — those are media envelopes, not lumber.
  const held: string[] = [];
  const masked = s.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:card|print|photo|sheet)\b/gi,
    (m) => {
      const key = `__CARDSIZE${held.length}__`;
      held.push(m);
      return key;
    },
  );
  const stripped = masked.replace(
    /\b(?:[124]\s*[x×]\s*(?:2|4|6|8|10|12)|1x2|1x4|1x6|1x8|1x12|2x2|2x4|2x6|2x8|2x10|2x12|4x4)(?:\s*[x×]\s*\d+)?(?:\s*(?:ft|foot|feet|in|inch|inches))?\b/gi,
    " ",
  );
  return stripped.replace(/__CARDSIZE(\d+)__/g, (_, i) => held[Number(i)] ?? " ");
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
  const dim = stripLumberStock(lower);
  if (/\d+(?:\.\d+)?\s*-?\s*(?:ft|foot|feet|in|inch|inches)\s*(?:tall|high|wide|deep|long|span)/.test(lower)) return true;
  if (/\d+(?:\.\d+)?\s*-\s*(?:ft|foot|feet)\b/.test(lower)) return true;
  // Bare "6 foot ladder" / "3 foot tower" / "2 foot catapult" count as typed size.
  if (/\d+(?:\.\d+)?\s*-?\s*(?:ft|foot|feet|in|inch|inches)\b/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*["″]?\s*(?:popsicle\s+)?(?:ramp|run|trough)\b/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*["″]?\s*(?:pot|planter)\b/.test(dim)) return true;
  if (/(?:pot|planter)[^\d]{0,16}\d+(?:\.\d+)?\s*["″]?\s*diameter/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*["″]?\s*diameter/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*["″]?\s*(?:tall|high)\b/.test(dim) && /(?:pot|planter|stand)/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*["″]?\s*(?:laptop|tablet|phone|device)\b/.test(dim)) return true;
  if (/open\s+\d+(?:\.\d+)?\s*["″]?\s*laptop/.test(dim)) return true;
  if (/\d+\s*°|\d+\s*deg(?:rees)?|\d+\s*tip/.test(dim) && /lean|stand|hold|laptop|easel/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:card|print|photo|sheet)\b/.test(dim)) return true;
  if (/[⅝⅜⅞¼½¾]|\d+\s*\/\s*\d+\s*["″]?\s*marble/.test(dim)) return true;
  if (/\d+(?:\.\d+)?\s*(?:x|by|×)\s*\d+/.test(dim)) return true;
  const pair = dim.match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/);
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
  const ladderLike = kind === "ladder" || (kind === "frame" && /\bladder\b/.test(lower));
  if (explicit && ladderLike && ftLen && !/wide|deep/.test(lower)) {
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
  if (ladderLike) return { width: 18, depth: 6, height: 96 };
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

/** True when the prompt names a catalog stock detectMaterial can bind. */
export function hasExplicitStock(prompt: string): boolean {
  return !isWireStock(detectMaterial(prompt));
}

export function isWireStock(item: CatalogItem | undefined | null): boolean {
  return !!item && (item.id === "wire-frame" || !!item.tags?.includes("wire"));
}

export function detectMaterial(prompt: string): CatalogItem {
  const lower = prompt.toLowerCase();
  const phrases: [RegExp, string][] = [
    [/jumbo (craft|popsicle)|jumbo stick|(?:lattice|tower).{0,24}jumbo|jumbo.{0,24}(?:lattice|tower)/, "popsicle-jumbo"],
    [/mini (craft|popsicle)|mini stick/, "popsicle-mini"],
    [/giant (craft|popsicle)|giant stick/, "popsicle-giant"],
    [/popsicle|craft stick/, "popsicle-standard"],
    [/toothpick/, "toothpick"],
    [/drinking straw|plastic straw|\bstraws?\b/, "straw-plastic"],
    [/pvc|schedule.?40|sch.?40/, "pvc-3-4-sch40"],
    [/1\s*[x×]\s*4|1x4/, "lumber-1x4-8"],
    [/2\s*[x×]\s*4|2x4/, "lumber-2x4-8"],
    [/2\s*[x×]\s*2|2x2/, "lumber-2x2-8"],
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
  // Unnamed stock is a wire placeholder — never silent popsicle.
  const wire = getCatalogItem("wire-frame");
  if (wire) return wire;
  return {
    id: "wire-frame",
    name: "Wire frame (pick a stock)",
    category: "other",
    formFactor: "dowel",
    dims: { length: 48, diameter: 0.06 },
    tags: ["wire", "placeholder", "choose-stock"],
    preferredJoins: ["none"],
    canCut: true,
    color: "#a8a296",
    searchQuery: "",
  };
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
  const prim = toPrimitive(item);
  const stockW = prim.width || 1;
  const pad = Math.max(0.5, stockW * 0.55);
  const spanX = Math.max(...xs, 0) - Math.min(...xs, 0) || 0;
  const spanY = Math.max(...ys, 0) - Math.min(...ys, 0) || 0;
  const spanZ = Math.max(...zs, 0) - Math.min(...zs, 0) || 0;
  let width = Math.max(8, spanX + pad * 2);
  let height = Math.max(8, spanY + pad);
  let depth = Math.max(8, spanZ + pad * 2);
  // Weekend frame / ladder with typed N-foot: honor typed height when the wire
  // already lands on it (skip stock-face pad that pushed ladders to ~74" / catapults short).
  // Leave Eiffel / lattice / arch / bridge pad math alone — freeze chips.
  if ((kind === "frame" || kind === "ladder") && hasExplicitSize(prompt)) {
    const typed = parseSize(prompt.toLowerCase());
    const typedH = typed.height;
    const mech = detectWeekendMech(prompt);
    // Pot-hold / media-hold: honor typed envelope (pot dia×tall / open laptop+tip), not min-8 pad inflate.
    if (mech === "pot-hold" || mech === "media-hold") {
      width = typed.width;
      height = typed.height;
      depth = typed.depth;
    } else if (typedH && Math.abs(spanY - typedH) <= 1.25) {
      height = typedH;
    } else if (kind === "frame" || kind === "ladder") {
      // Thinner face pad only on frames — 2x4 width was the ladder inflate.
      const padH = Math.max(0.35, Math.min(stockW, prim.height || prim.thickness || stockW) * 0.55);
      height = Math.max(8, spanY + padH);
      if (typedH && Math.abs(spanY - typedH) <= 1.25) height = typedH;
    }
  }
  if (kind === "eiffel") {
    const publishedBase = height * (125 / 324);
    width = Math.max(width, publishedBase);
    depth = Math.max(depth, publishedBase);
  }
  const names: Partial<Record<StructureKind, string>> = {
    eiffel: "Eiffel Tower",
    lattice: "Lattice tower",
    arch: "Garden arch",
    bridge: "Warren bridge",
    figure: "Figure",
    frame: "Frame",
    closet: "Fitted unit",
    furniture: "Furniture",
    ladder: "Ladder",
    table: "Table",
  };
  // Figure prompts keep Dog / Dinosaur / Animal — never naked "Figure" when the noun is known.
  const figLabel = kind === "figure" ? figureIdentityLabel(prompt) : null;
  const name =
    kind === "figure"
      ? figLabel ?? extra.name ?? names.figure ?? "Figure"
      : extra.name ?? names[kind] ?? `${item.name} ${kind}`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind,
    overall: {
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      depth: Math.round(depth * 10) / 10,
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
