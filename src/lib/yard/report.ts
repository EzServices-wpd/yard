import { withSaidHardware } from "./hardwareSaid";
import { drawerBoxes } from "./hollowDrawers";
import { withTypedFinish } from "./typedFinish";
import { storeTermsFromBuy } from "./listings";
import { checkedRow, HARDWARE } from "./checkedStock";
import { buyComplete, stepTextForPlace } from "./buyComplete";
import { unletterWhole } from "./wholeItems";
import { withPartIds } from "./partIds";
import { ownEveryPart } from "./ownEveryPart";
import { unitSizeById } from "./unitSizes";
import { isUnitItem } from "./unitItems";
import { isNoLidPrompt } from "./cueRules";
import { foldDownBuy, hingeContext, hingedBuy } from "./hingedLeaf";
import { featureBay } from "./heldObjects";
import { hookCount, SCREWS_PER_HOOK } from "./hookCount";
import { stepsDriveJointScrews, stepsStateJointScrews, BUY_JOINTS } from "./stepJointScrews";
import { LAG_ROW, stepsInstallWallAnchors } from "./wallAnchorSteps";
import { isFixedSpanShelf, shelfLineCount } from "./shelfSpan";
import { CATALOG_BY_ID, FORGE_CATALOG, getCatalogItem } from "./catalog";
import { fractionizeInches, inchFrac } from "./inchText";
import { positivePlan } from "./positiveWording";
import { usesHotGlue, hotGlueBom } from "./adhesive";
import { isWholeStock, panelWorldCorners, toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom, nestSheets } from "./bom";
import { uniqueSteps } from "./uniqueSteps";
import { decorateBom, estimateOffers } from "./listings";
import { speciesBoardUsd, speciesOfBoardLabel } from "./speciesPrice";
import { binderBom, effectiveJoin, screwBoxUnit, SCREWS_PER_BOX } from "./joints";
import { applyShopJoin, stockThickness, faceScrewInches, stepsUseFaceScrew } from "./shopJoin";
import { spaceCutStep } from "./spaceCuts";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import { loadIssues, panelBomLines } from "./function";
import { drawerSlideInches, SLIDE_LENGTHS_IN } from "./stockLook";
import { cutListName, sheetCutDims, isBoundingDrawerPanel, explodeDrawerBoxCuts, drawerPartStock, isBuyMirrorPanel, isSquareLumberStick, isFrameGlazing, isStickAccessorySheet, isBoughtHardwareName } from "./shopPlural";
import { oddCutName } from "./oddShapes";
import { isSheetStockCut, spliceCutListToSheet, fitsOnSheet, SHEET_4X8, plySheetCatalogId, planSheetNest, nestSheetCounts, isLumberLegCut, type PlanSheetNest } from "./nesting";
import { honestPlan, wantsFixedGlueShelves, wantsRackAffordance } from "./honesty";
import { isBedsideShelf, isBootTrayBench, isCoatHookBoard, isDryingRack, isFoldingTable, isIroningWallMount, isKeyMailShelf, isLaundrySorter, isLeashRail, isPegRail, isLumberRack, isOutdoorSideTable, isServingCart, isButcherCart, isDiningTable, isSlotRack, isPlateRack, isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame, isPottingBench, isToolRail, isToyChest, isHingedLidChest, isLiftOffLidPrompt, isUtilityShelf, isWorkbench, sitBenchTitleStem, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, identityTitleStem } from "./family";
import { honestWeekendPlan, namedStockDisplayName, namedStockFromPrompt } from "./weekendStockHonesty";
import { CATALOG_LUMBER_BIND, namedLegLumberFromPrompt, namedLumberFromPrompt } from "./namedLumberSpecies";
import { planSolidBoards } from "./solidStock";
import { packLengths } from "./linearPack";
import { panelJoints, screwTalk } from "./modelJoints";
import { withOutdoorPackage } from "./outdoor";
import { strangerPlainShopTalk, densifyKitCraftInstructions, densifyDrawerExplodeTalk, stampPartsPlate, speciesStockHonestyTalk, honestNamedLumberBuyWoodNote, densifyConfirmAssumedNotes, measureRefitTalk } from "./voiceHonesty";
import type { AssemblyStep, BuildPlan, CatalogItem, CutLine, FeasibilityIssue, Panel, YardProject } from "./types";
import { withPlacementTalk } from "./placement";
import { restsOnLaterStep } from "./placeEveryPart";
import { panelStock } from "./partStock";
import { backReachesTwoStuds, STUD_CENTER_IN } from "./fitted";

function letterLabel(i: number) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function stampLabels(lines: CutLine[]): CutLine[] {
  const sorted = [...lines].sort((a, b) => b.lengthIn - a.lengthIn || a.name.localeCompare(b.name));
  return sorted.map((line, i) => ({ ...line, label: letterLabel(i) }));
}

function partFamily(name: string, type?: string) {
  return cutListName(name, type);
}

function effortLabel(project: YardProject, pieces: number): string {
  if (project.kind === "opening") return "1/2-day";
  // C3: a few bought pieces linked, stacked or threaded is a short sit-down job, never a "weekend".
  if (isUnitItem(project)) return "under an hour";
  // Fitted/house: bands on honest wood piece count (same as Confirm/chip /
  // plan.totals.pieces via closetCuts) — never raw panels.length. Bounding
  // type=drawer envelopes under-count exploded sides/back/bottom kits.
  if (project.panels.length > 0) {
    if (pieces <= 10) return "1/2-day";
    if (pieces <= 20) return "1-day";
    return "weekend";
  }
  // Crafts / instances: stick-count bands.
  if (pieces <= 120) return "1/2-day";
  if (pieces <= 400) return "1-day";
  return "weekend";
}

function closetCuts(project: YardProject): CutLine[] {
  const STOCK_T = 0.75;
  const namedSolid = !!namedLumberFromPrompt(project.prompt ?? "");
  // Named wood drives the legs too: laminated from two ripped strips of the leg species.
  const legSpecies = namedSolid ? namedLegLumberFromPrompt(project.prompt ?? "") : null;
  const grouped = new Map<string, CutLine>();
  const addCut = (
    materialId: string,
    name: string,
    type: string | undefined,
    w: number,
    h: number,
    d: number,
    materialName: string,
    note?: string,
  ) => {
    // Numbered copies ("rod 1", "Paddle 3") are one part: identical copies share one line and letter.
    let family = partFamily(name, type).replace(/\s+\d+$/, "");
    // A hollow drawer's parts are one row per part kind ("Left drawer side 2 (right)" is a Drawer side).
    const drawerPart = /\bdrawer (?:side|back|bottom)\b/i.test(name);
    if (drawerPart) family = cutListName(name, type);
    const side = drawerPart ? null : name.match(/^(Left|Right)\s+(.+)$/i);
    if (side) {
      const twin = side[1].toLowerCase() === "left" ? "Right" : "Left";
      const other = project.panels.find((panel) => panel.name.toLowerCase() === `${twin} ${side[2]}`.toLowerCase());
      if (other) {
        const ow = Math.round(other.size.width * 8) / 8;
        const oh = Math.round(other.size.height * 8) / 8;
        const od = Math.round(other.size.depth * 8) / 8;
        if (ow === w && oh === h && od === d) {
          const shaped = oddCutName(name);
          const role = (shaped && !/^(?:Left|Right)\b/.test(shaped) ? shaped : side[2])
            .replace(/\s+\d+(?:-\d+)?$/, "")
            .replace(/^\w/, (c) => c.toUpperCase());
          family = /^(Upright|Side|Post|Apron|Stretcher|End)$/.test(role) ? partFamily(role, type) : role;
        }
      }
    }
    let dims = sheetCutDims(w, h, d);
    let qty = 1;
    const isPly =
      /plywood/i.test(materialId ?? "") ||
      /plywood/i.test(materialName ?? "");
    // Named solid boards follow the same shop rules as ¾" sheet parts: a 1½" top is
    // two laminated layers, a ¼" drawer bottom / backer stays ¼" plywood.
    const isSolidBoard = materialId === CATALOG_LUMBER_BIND;
    let id = materialId;
    let matName = materialName;
    // Square stick posts (≈1½×1½) are solid 2x2 lumber — never laminated into
    // thin ply strips. Fixes platform/bunk/daybed cut list ×8 0.75" vs steps ×4 1.5".
    // A named-board build's square stick (a ladder rung) is that 2x2 too, under its own name.
    if ((isPly || (isSolidBoard && !/^leg$/i.test(family))) && isSquareLumberStick(dims)) {
      if (isPly) family = "Leg";
      id = "lumber-2x2-8";
      matName = getCatalogItem(id)?.name ?? '2x2 (1-1/2" actual)';
    } else if (
      // Class pack: sheet goods thicker than stock are laminated plies (island/desk
      // 1½" counters), not a magic thick board the lumber aisle does not sell.
      (((isPly || isSolidBoard) && dims.thicknessIn > STOCK_T + 0.05 && !/^leg$/i.test(family)) ||
        // A lumber part thicker than its board (a 3 5/8" post from 2x4) is boards glued face to face too.
        (!isSolidBoard && /^lumber-/.test(id ?? "") && dims.thicknessIn > lumberT(id) + 0.05))
      // Any part thicker than its stock is a real glue-up, even under 1.5x of it.
    ) {
      // Any sheet part thicker than its sheet is a glue-up of plies (a 3 5/8" hub is 5 layers), never one thick board.
      const T = isPly || isSolidBoard ? STOCK_T : lumberT(id);
      const plies = Math.max(2, Math.round(dims.thicknessIn / T));
      // The row counts layers, so the note always says how many make each part: the part count reads off the model.
      // The text reads off the real layers: the count × the stock's thickness, never the part's modelled size.
      note = `${note ? `${note} ` : ""}Glue up ${plies} layers face to face for each ${inchFrac(plies * T)}" ${family.toLowerCase()}.`;
      dims = { lengthIn: dims.lengthIn, widthIn: dims.widthIn, thicknessIn: T };
      qty = plies;
    }
    // 0.25" ply is ¼″ backer even when the envelope was stamped ¾″ (mirror, drawer bottoms).
    // Skip when square-stick remap already bound solid lumber.
    if ((/plywood/i.test(id ?? "") || id === CATALOG_LUMBER_BIND) && dims.thicknessIn <= 0.26) {
      id = "plywood-1-4-4x8";
      matName = getCatalogItem(id)?.name ?? '1/4" Plywood 4×8';
    }
    // A part longer than its board is bought as the longer board of the same size when the catalogue sells one.
    const sold = getCatalogItem(id ?? "");
    if (sold?.category === "lumber" && sold.dims.length && dims.lengthIn > sold.dims.length + 0.01) {
      const longer = longerLumber(sold, dims.lengthIn);
      if (longer) { id = longer.id; matName = longer.name; }
    }
    // A notched (half-lapped) board is a different cut from its plain twin.
    const lapKey = note && /Egg-crate half-lap/.test(note) ? `|${note}` : "";
    const key = `${id}|${family}|${dims.lengthIn}|${dims.widthIn}|${dims.thicknessIn}${lapKey}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += qty;
      if (note && !existing.notes) existing.notes = note;
      return;
    }
    grouped.set(key, {
      id: key,
      name: family,
      quantity: qty,
      lengthIn: dims.lengthIn,
      widthIn: dims.widthIn,
      thicknessIn: dims.thicknessIn,
      material: matName,
      ...(note ? { notes: note } : {}),
    });
  };
  for (const p of project.panels) {
    // Hardware (hinges, catches) is bought, never cut: it goes on the Buy list, not the cut list.
    if (p.materialId === "hardware") continue;
    const w = Math.round(p.size.width * 8) / 8;
    const d = Math.round(p.size.depth * 8) / 8;
    const h = Math.round(p.size.height * 8) / 8;
    // One stock answer per part — the bench paints the part from the same answer.
    const stock = panelStock(project.prompt ?? "", p);
    const materialName = stock.label;
    // Class pack: type=drawer panels are visual envelopes, not cuttable boards.
    // Explode into sides/back/bottom so the cut list matches Build steps.
    if (isBuyMirrorPanel(p.name, p.type)) continue;
    if (legSpecies && stock.catalogId !== p.materialId) {
      // Named-wood leg: laminated from two ripped strips of the leg species.
      const len = Math.max(w, h, d);
      addCut(
        stock.catalogId,
        p.name,
        p.type,
        w,
        h,
        d,
        stock.label,
        `Laminated leg: rip two 1 1/2" strips from ${stock.label}, face-glue them into a 1 1/2" × 1 1/2" square, then cut to ${len}".`,
      );
      continue;
    }
    if (isBoundingDrawerPanel(p.name, p.type)) {
      for (const part of explodeDrawerBoxCuts(w, h, d)) {
        addCut(drawerPartStock(p.materialId, part), part.name, part.type, part.width, part.height, part.depth, materialName);
      }
      continue;
    }
    if (p.blank) {
      addCut(p.materialId, p.name, p.type, p.blank.lengthIn, p.blank.thicknessIn, p.blank.widthIn, materialName, p.cutNote);
      continue;
    }
    addCut(p.materialId, p.name, p.type, w, h, d, materialName, p.cutNote);
  }
  return stampLabels(stampPlySheetSize(spliceCutListToSheet([...grouped.values()]))).map(cornerCutNote);
}

/** Corner-unit cut lines say how a stranger gets the shape from a square blank. */
function cornerCutNote(c: CutLine): CutLine {
  const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.01 ? String(Math.round(n)) : String(n));
  if (/^triangle shelf/i.test(c.name)) {
    const squares = Math.ceil(c.quantity / 2);
    return {
      ...c,
      notes: `Right triangle, ${fmt(c.lengthIn)}" × ${fmt(c.widthIn)}" legs. Cut ${squares} square${squares === 1 ? "" : "s"} ${fmt(c.lengthIn)}" × ${fmt(c.widthIn)}", then one diagonal cut each — every square gives 2 shelves.`,
    };
  }
  if (/^quarter-round shelf/i.test(c.name)) {
    return {
      ...c,
      notes: `Quarter circle, ${fmt(c.lengthIn)}" radius. Cut ${c.quantity} square${c.quantity === 1 ? "" : "s"} ${fmt(c.lengthIn)}" × ${fmt(c.widthIn)}", then cut a ${fmt(c.lengthIn)}" radius arc on each with a jigsaw.`,
    };
  }
  return c;
}

/** Sold plywood sheets, smallest face first (the size stamp picks among them). */
const PLY_SHEETS = FORGE_CATALOG.filter((i) => i.category === "sheet_goods" && /plywood/i.test(i.id) && !!i.dims.thickness && !!i.dims.length && !!i.dims.width).sort(
  (a, b) => a.dims.length! * a.dims.width! - b.dims.length! * b.dims.width!,
);

/**
 * After splice: name the sheet that actually fits the face. 102" stays whole on 4×10.
 * Rule: the size stamp changes a sheet's size, never its thickness. A row cut from a sold plywood sheet keeps that
 * sheet when the face fits it, else takes the smallest sold sheet of the same thickness that fits (1/2" stays 1/2").
 */
function stampPlySheetSize(cuts: CutLine[]): CutLine[] {
  return cuts.map((c) => {
    if (!/ply/i.test(`${c.material ?? ""} ${c.name ?? ""}`)) return c;
    if (Math.min(c.lengthIn, c.widthIn) <= 2) return c;
    const stock = PLY_SHEETS.find((s) => s.id === c.id.split("|")[0]);
    let name: string | undefined;
    if (stock) {
      const fits = (s: CatalogItem) => fitsOnSheet(c.lengthIn, c.widthIn, { width: s.dims.width!, height: s.dims.length! });
      const sameT = PLY_SHEETS.filter((s) => s.dims.thickness === stock.dims.thickness);
      if (sameT.some((s) => s.name === c.material && fits(s))) return c;
      name = sameT.find(fits)?.name;
    } else {
      name = getCatalogItem(plySheetCatalogId(c.lengthIn, c.widthIn, c.thicknessIn ?? 0.75))?.name;
    }
    if (!name || name === c.material) return c;
    return { ...c, material: name };
  });
}

function panelBox(p: Panel) {
  const c = panelWorldCorners(p);
  const xs = c.map((q) => q.x), ys = c.map((q) => q.y), zs = c.map((q) => q.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** A shelf with a standing panel (side, upright, divider, back-to-front wall) at each end, beside it at its height. */
export function shelfSpansUprights(shelf: Panel, panels: Panel[]): boolean {
  const s = panelBox(shelf);
  const tol = 0.26;
  const ends = { left: false, right: false };
  for (const q of panels) {
    if (q === shelf || q.type === "shelf" || q.type === "top" || q.type === "bottom" || q.type === "back") continue;
    const b = panelBox(q);
    const standing = b.maxY - b.minY > Math.max(b.maxX - b.minX, 0.8) && b.maxZ - b.minZ > 0.8;
    if (!standing) continue;
    if (b.minY > s.maxY + tol || b.maxY < s.minY - tol) continue;
    if (b.minZ > s.maxZ - 0.5 || b.maxZ < s.minZ + 0.5) continue;
    if (Math.abs(b.maxX - s.minX) <= tol || (b.minX <= s.minX + tol && b.maxX >= s.minX - tol && b.maxX <= s.minX + 1)) ends.left = true;
    if (Math.abs(b.minX - s.maxX) <= tol || (b.maxX >= s.maxX - tol && b.minX <= s.maxX + tol && b.minX >= s.maxX - 1)) ends.right = true;
  }
  return ends.left && ends.right;
}

/**
 * Panels cut from the build's own craft sheet (chipboard, card, foam board…) are bought as that sheet,
 * counted from the cut list — never swapped for a 1/4" plywood backer.
 */
function craftSheetCuts(project: YardProject, cuts: CutLine[]) {
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item || item.formFactor !== "sheet" || /^plywood-/.test(item.id) || item.category === "lumber") return null;
  const mine = cuts.filter((c) => c.id.split("|")[0] === item.id);
  if (!mine.length) return null;
  const L = item.dims.length ?? 11;
  const W = item.dims.width ?? 8.5;
  const area = mine.reduce((s, c) => s + c.lengthIn * c.widthIn * c.quantity, 0);
  const parts = mine.reduce((s, c) => s + c.quantity, 0);
  const oversize = mine.filter((c) => !(Math.max(c.lengthIn, c.widthIn) <= L + 0.01 && Math.min(c.lengthIn, c.widthIn) <= W + 0.01));
  const sheets = Math.max(parts - oversize.reduce((s, c) => s + c.quantity, 0) > 0 ? 1 : 0, Math.ceil(area / (L * W * 0.8)));
  const perPack = item.unitsPerPack ?? 1;
  const name = item.name;
  const line: BuildPlan["bom"][number] = {
    name,
    quantity: sheets,
    unit: sheets === 1 ? "sheet" : "sheets",
    catalogId: item.id,
    searchQuery: item.searchQuery ?? name,
    estimatedCost: (item.unitCostUsd ?? 0.5) * sheets,
    notes:
      `${sheets} × ${name} for the ${parts} part${parts === 1 ? "" : "s"}, counted from the cut list with a little waste` +
      (perPack > 1 ? ` (sold in packs of ${perPack})` : "") +
      (oversize.length
        ? `. ${oversize.length} part${oversize.length === 1 ? " is" : "s are"} bigger than one sheet — butt-join sheets edge to edge with a glued strip behind the seam`
        : "") +
      (usesHotGlue(item) ? ". Hot glue holds it (sticks are on this list)." : ". Glue it — craft glue or hot glue holds sheet stock best."),
  };
  return { mine, line };
}

function closetBom(project: YardProject, allCuts: CutLine[], nest: PlanSheetNest = planSheetNest(allCuts)): BuildPlan["bom"] {
  const craft = craftSheetCuts(project, allCuts);
  const cuts = craft ? allCuts.filter((c) => !craft.mine.includes(c)) : allCuts;
  if (craft && !cuts.length) {
    return [
      craft.line,
      usesHotGlue(getCatalogItem(project.primaryMaterialId))
        ? hotGlueBom()
        : { name: "Multi-purpose craft glue", quantity: 1, unit: "bottle", catalogId: "glue", searchQuery: "multi-purpose craft glue", estimatedCost: 4.99 },
      ...templateAccessories(project),
    ];
  }
  const sheet = getCatalogItem(project.primaryMaterialId) ?? getCatalogItem("plywood-3-4-4x8");
  // Join-screw estimate from honest cut wood qty (drawer explode + plies), not raw panels.length.
  const woodPieces = cuts.reduce((s, c) => s + c.quantity, 0);
  const isTable = project.fitted?.program === "table";
  const namedLumber = namedStockFromPrompt(project.prompt ?? "");
  const coatHookBoard =
    isCoatHookBoard((project.prompt ?? "").toLowerCase()) || /Coat hook board/i.test(project.name || "");
  const buyNamedBoard = !!(coatHookBoard && namedLumber && namedLumber.category === "lumber");
  // Lumber legs buy as sticks; legs cut from a sheet good nest on the shared sheet with the rest.
  const allLegCuts = cuts.filter(isLumberLegCut);
  // Named-wood legs are laminated from the leg species' 1×4 boards (cut line id carries the bind).
  const namedLegCuts = allLegCuts.filter((c) => c.id.startsWith(`${CATALOG_LUMBER_BIND}|`));
  // Legs cut from plywood ride on the sheet nest with every other sheet part (Buy counts sheets once).
  const legCuts = allLegCuts.filter((c) => !namedLegCuts.includes(c) && !isSheetStockCut(c));
  const namedLegLabel = namedLegCuts[0]?.material ?? "";
  const namedLegQty = namedLegCuts.reduce((s, c) => s + c.quantity, 0);
  const legStripParts = namedLegCuts.map((c) => ({ name: "Leg strip", lengthIn: c.lengthIn + 1, widthIn: 1.5, qty: 2 * c.quantity }));
  let legsMerged = false;
  // ¾" board stocks already bought on their own lines (mixed-board branch); the linear packer skips them.
  const boardsBought = new Set<string>();
  // Thin sheet parts only are a backer: a 1/4" dowel rod is round stock, and a thin part cut from a board
  // (a 3/8" maple divider) is bought with that board, never as an orphan backer line.
  // A real 1/4" backer only (up to 5/16"): a 3/8" learned part stays on the sheet its cut line names, so no orphan backer.
  const thinSheet = (c: CutLine) => (c.thicknessIn ?? 0.75) < (/plywood-1-4/.test(c.id) ? 0.5 : 0.34) && /plywood/i.test(c.material ?? "");
  const structural = cuts.filter(
    (c) => ((c.thicknessIn ?? 0.75) >= 0.5 || (!thinSheet(c) && !/dowel/i.test(c.material ?? ""))) && (c.thicknessIn ?? 0) < 2 && !isLumberLegCut(c),
  );
  const thinBacks = cuts.filter(thinSheet);
  const sheet10 = getCatalogItem("plywood-3-4-4x10");
  // 2x4 / 2x6 bearers are boards, not sheet parts. Nesting them onto plywood inflates Buy.
  const stickBoards = structural.filter((c) => /^lumber-2x(?:4|6|8|10|12)-\d+\|/.test(c.id));
  // Sheet counts come from the plan's one sheet nest — the same sheets the layout and PDF draw.
  const counted = nestSheetCounts(nest.sheets);
  const sheets8 = counted.on8;
  const sheets10 = counted.on10;
  const unplaced = counted.unplaced;

  // A build made of one board stock (glue-ups and rips from that board). A frame of lumber under a
  // plywood deck is not: its plywood rides the sheet nest and its lumber goes through the linear packer.
  const boardPrimary =
    !!sheet &&
    sheet.category === "lumber" &&
    sheet.formFactor === "board" &&
    project.primaryMaterialId !== CATALOG_LUMBER_BIND &&
    !structural.some((c) => isSheetStockCut(c)) &&
    structural.every((c) => c.id.startsWith(`${project.primaryMaterialId}|`));

  const bom: BuildPlan["bom"] = [];
  let frameBought = false;
  // Honest Buy wood qty: cut-list quantity sum (same class as Confirm/chip/effort
  // woodPieces). Never last-resort to raw panels.length — bounding envelopes
  // under-count exploded kits / multi-piece named lumber.
  const honestBuyWoodQty = (cutQty: number) => Math.max(1, cutQty || woodPieces || 1);
  if (buyNamedBoard && namedLumber) {
    const boardCuts = cuts.filter((c) => /hook board|peg rail|board/i.test(c.name) || c.quantity > 0);
    const qty = honestBuyWoodQty(boardCuts.reduce((s, c) => s + c.quantity, 0));
    const cutTo = boardCuts[0]?.lengthIn ?? project.overall.width;
    const label = namedStockDisplayName(project.prompt ?? "", namedLumber);
    bom.push({
      name: label,
      quantity: qty,
      unit: qty === 1 ? "pc" : "pcs",
      catalogId: namedLumber.id,
      searchQuery: namedLumber.searchQuery ?? label,
      estimatedCost: namedLumber.unitCostUsd != null ? namedLumber.unitCostUsd * qty : undefined,
      notes: `${qty} piece${qty === 1 ? "" : "s"} · Cut to: ${cutTo}"${namedLumber.unitCostUsd == null ? " · No price — plus unpriced items" : ""}`,
    });
  } else if (boardPrimary && sheet) {
    const label = namedStockDisplayName(project.prompt ?? "", sheet);
    const thick = sheet.dims.thickness ?? sheet.dims.height ?? 0.75;
    const face = sheet.dims.width ?? 3.5;
    const feet = Math.round((sheet.dims.length ?? 96) / 12);
    // Mixed frames (a 2×2 / 2×4 frame under a plywood deck): plywood parts are Bought as sheets and
    // frame parts that already match the board's section are cut to length — no rip, no glue-up talk.
    const isPlyCut = (c: (typeof structural)[number]) => /^plywood-/.test(c.id) || /plywood|sheet/i.test(`${c.material ?? ""}`);
    const plyCuts = structural.filter(isPlyCut);
    const frameCuts = structural.filter((c) => !isPlyCut(c));
    const asSection = (c: (typeof structural)[number]) =>
      Math.abs((c.thicknessIn ?? thick) - thick) < 0.05 && c.widthIn <= face + 0.05;
    if (plyCuts.length && frameCuts.length && frameCuts.every(asSection)) {
      frameBought = true;
      const framePlan = planSolidBoards(frameCuts.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })), face);
      const frameQty = frameCuts.reduce((s, c) => s + c.quantity, 0);
      bom.push({
        name: label,
        quantity: framePlan.boards,
        unit: framePlan.boards === 1 ? "board" : "boards",
        catalogId: sheet.id,
        searchQuery: sheet.searchQuery ?? label,
        estimatedCost: sheet.unitCostUsd != null ? sheet.unitCostUsd * framePlan.boards : undefined,
        notes: `${framePlan.boards} × ${feet} ft ${label} for the ${frameQty} frame part${frameQty === 1 ? "" : "s"}, cut to length — packed from the cut list with 1/8" kerf.`,
      });
      const plyItem = getCatalogItem("plywood-3-4-4x8");
      const plyName = plyItem?.name ?? '3/4" Plywood 4×8';
      const area = plyCuts.reduce((s, c) => s + c.lengthIn * c.widthIn * c.quantity, 0);
      const plyQty = Math.max(1, Math.ceil(area / (48 * 96 * 0.8)));
      const plyParts = plyCuts.reduce((s, c) => s + c.quantity, 0);
      const small = area <= 24 * 48 * 0.8;
      bom.push({
        name: small ? '3/4" Plywood 2×4 project panel' : plyName,
        quantity: small ? 1 : plyQty,
        unit: small ? "panel" : plyQty === 1 ? "sheet" : "sheets",
        catalogId: plyItem?.id ?? "plywood-3-4-4x8",
        searchQuery: small ? '3/4 inch plywood project panel 2x4' : plyItem?.searchQuery ?? '3/4" x 4x8 sanded plywood',
        estimatedCost: small ? 24.98 : (plyItem?.unitCostUsd ?? 38.43) * plyQty,
        notes: `${plyParts} plywood part${plyParts === 1 ? "" : "s"} (${plyCuts.map((c) => `${c.quantity} × ${inchFrac(c.lengthIn)}" × ${inchFrac(c.widthIn)}"`).join(", ")}).`,
      });
    } else {
    // Every structural part (2×4 parts included) is packed into these boards — no second 2×4 line.
    frameBought = true;
    const boardPlan = planSolidBoards(
      structural.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })),
      face,
    );
    const glued = boardPlan.glueUps.reduce((s2, g) => s2 + g.qty, 0);
    const qty = boardPlan.boards;
    const partsQty = structural.reduce((s, c) => s + c.quantity, 0);
    bom.push({
      name: label,
      quantity: qty,
      unit: qty === 1 ? "board" : "boards",
      catalogId: sheet.id,
      searchQuery: sheet.searchQuery ?? label,
      estimatedCost: sheet.unitCostUsd != null ? sheet.unitCostUsd * qty : undefined,
      notes:
        `${qty} × ${feet} ft ${label} for the ${partsQty} carcase part${partsQty === 1 ? "" : "s"}` +
        (glued ? ` — ${glued} wide part${glued === 1 ? "" : "s"} edge-glued` : "") +
        (thick > 0.9 && structural.some((c) => Math.abs((c.thicknessIn ?? thick) - 0.75) < 0.05) ? `. Rip to ¾" (this board is ${thick}" thick; the drawing is still ¾")` : "") +
        (face < 3.2 ? `. The face is only ${face}" — buy extra when a part is wider` : "") +
        (thinBacks.length ? `. ¼" backs stay plywood.` : "."),
    });
    }
  } else if (
    project.primaryMaterialId !== CATALOG_LUMBER_BIND &&
    !structural.some((c) => isSheetStockCut(c)) &&
    structural.some((c) => /^lumber-1x\d+-8\|/.test(c.id))
  ) {
    // Mixed ¾" boards (treads from the typed 1×10, rails from 1×4): each board stock is bought on its own line,
    // packed at that board's real face. 2× and post stock go through the linear packer below.
    const byBoard = new Map<string, typeof structural>();
    for (const c of structural) if (/^lumber-1x\d+-8\|/.test(c.id)) boardsBought.add(c.id.split("|")[0]);
    for (const c of structural.filter((x) => /^lumber-1x\d+-8\|/.test(x.id))) {
      const id = c.id.split("|")[0];
      byBoard.set(id, [...(byBoard.get(id) ?? []), c]);
    }
    for (const [id, lines] of byBoard) {
      const item = getCatalogItem(id);
      if (!item) continue;
      const label = namedStockDisplayName(project.prompt ?? "", item);
      // Laminated legs ripped from this same board ride on its line (one Buy line per stock).
      const withLegs = id === CATALOG_LUMBER_BIND && namedLegQty > 0;
      if (withLegs) legsMerged = true;
      const plan = planSolidBoards(
        [...lines.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })), ...(withLegs ? legStripParts : [])],
        item.dims.width ?? 3.5,
      );
      const partsQty = lines.reduce((n, c) => n + c.quantity, 0) + (withLegs ? namedLegQty : 0);
      const glued = plan.glueUps.reduce((n, g) => n + g.qty, 0);
      bom.push({
        name: label,
        quantity: plan.boards,
        unit: plan.boards === 1 ? "board" : "boards",
        catalogId: id,
        searchQuery: item.searchQuery ?? label,
        estimatedCost: item.unitCostUsd != null ? item.unitCostUsd * plan.boards : undefined,
        notes:
          `${plan.boards} × 8 ft ${label} for the ${partsQty} ${label} part${partsQty === 1 ? "" : "s"} on the cut list` +
          (withLegs ? `, ${namedLegQty} leg${namedLegQty === 1 ? "" : "s"} laminated from two ripped 1 1/2" strips each` : "") +
          (glued ? ` — ${glued} wide part${glued === 1 ? "" : "s"} edge-glued from boards` : "") +
          `. Packed from the cut list with 1/8" kerf.`,
      });
    }
  } else if (sheets8 > 0 || (project.primaryMaterialId === CATALOG_LUMBER_BIND && !!namedLumber && structural.length > 0)) {
    const isNamedLumberPrimary =
      project.primaryMaterialId === CATALOG_LUMBER_BIND && !!namedLumber;
    // Solid named lumber (teak outdoor etc.): Buy pcs = honest cut wood qty, not
    // 4×8 nest sheet count (silent undercount vs Confirm/chip).
    // When densify still nests sheet faces (table tops/aprons stay plywood-*),
    // Buy the nest sheets too — never pretend a 40" round top comes from 1×4 alone.
    const structuralQty = structural.reduce((s, c) => s + c.quantity, 0);
    const densifyNestsOnSheet = structural.some((c) =>
      /ply|sheet/i.test(`${c.material ?? ""}`),
    );
    const solidNamed = isNamedLumberPrimary && !densifyNestsOnSheet;
    const nestSheetQty = sheets8;
    const legQtyForNote = legCuts.reduce((s, c) => s + c.quantity, 0);
    if (solidNamed) {
      // Named solid stock drives every ¾" part: Buy the 8-ft boards the parts
      // actually need (edge-glue strips + rips packed with kerf) — no unused boards.
      const label = namedStockDisplayName(project.prompt ?? "", namedLumber!);
      legsMerged = namedLegQty > 0 && namedLegLabel === label;
      const boardPlan = planSolidBoards([
        ...structural.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })),
        ...(legsMerged ? legStripParts : []),
      ], namedLumber!.dims.width ?? 3.5);
      const partsQty = structuralQty + (legsMerged ? namedLegQty : 0);
      const glued = boardPlan.glueUps.reduce((s2, g) => s2 + g.qty, 0);
      bom.push({
        name: label,
        quantity: boardPlan.boards,
        unit: boardPlan.boards === 1 ? "board" : "boards",
        catalogId: namedLumber!.id,
        searchQuery: namedLumber!.searchQuery ?? label,
        estimatedCost: (namedLumber!.unitCostUsd ?? 4) * boardPlan.boards,
        notes:
          `${boardPlan.boards} × 8 ft ${label} (¾" × ${(namedLumber!.dims.width ?? 3.5) === 3.5 ? "3½" : inchFrac(namedLumber!.dims.width!)}") for ${legQtyForNote || (namedLegQty && !legsMerged) ? "the" : "all"} ${partsQty} ${label} part${partsQty === 1 ? "" : "s"} on the cut list` +
          (legQtyForNote ? ` (excluding the ${legQtyForNote} leg${legQtyForNote === 1 ? "" : "s"} listed below)` : "") +
          (namedLegQty && !legsMerged ? ` (the ${namedLegQty} ${namedLegLabel} leg${namedLegQty === 1 ? "" : "s"} are listed below)` : "") +
          (glued ? ` — ${glued} wide part${glued === 1 ? "" : "s"} edge-glued from boards` : "") +
          (legsMerged ? `, ${namedLegQty} leg${namedLegQty === 1 ? "" : "s"} laminated from two ripped 1 1/2" strips each` : "") +
          `. Packed from the cut list with 1/8" kerf${glued ? ' and 1" trim on each glue-up' : ""}.` +
          "",
      });
    } else if (isNamedLumberPrimary && densifyNestsOnSheet) {
      const plyItem = getCatalogItem("plywood-3-4-4x8");
      const plyName = plyItem?.name ?? '3/4" Plywood 4×8';
      const nestNote =
        `From nest · ${nestSheetQty} sheet${nestSheetQty === 1 ? "" : "s"} · 1/8" kerf included.` +
        (cuts.some((c) => / · /.test(c.name))
          ? " Some faces are splice segments — butt-join before assembly."
          : "") +
        (unplaced.length ? ` ${unplaced.length} part(s) still oversize — do not buy until fixed.` : "");
      const species = speciesStockHonestyTalk(project.prompt ?? "", plyName);
      bom.push({
        name: plyName,
        quantity: nestSheetQty,
        unit: nestSheetQty === 1 ? "sheet" : "sheets",
        catalogId: plyItem?.id ?? "plywood-3-4-4x8",
        searchQuery: plyItem?.searchQuery ?? '3/4" x 4x8 sanded plywood',
        estimatedCost: (plyItem?.unitCostUsd ?? 38.43) * nestSheetQty,
        notes: species ? `${nestNote} ${species}` : nestNote,
      });
      const boardQty = honestBuyWoodQty(structuralQty);
      const label = namedStockDisplayName(project.prompt ?? "", namedLumber!);
      bom.push({
        name: label,
        quantity: boardQty,
        unit: boardQty === 1 ? "pc" : "pcs",
        catalogId: namedLumber!.id,
        searchQuery: namedLumber!.searchQuery ?? label,
        estimatedCost: (namedLumber!.unitCostUsd ?? 4) * boardQty,
        notes:
          `${honestNamedLumberBuyWoodNote({ qty: boardQty, legQty: legQtyForNote })} ` +
          `Cut the top/aprons from the plywood nest above; these boards are the named-species story (face/finish), not a silent 1×4 blank for a sheet-sized top.`,
      });
    } else {
      const n = isNamedLumberPrimary
        ? honestBuyWoodQty(structuralQty)
        : nestSheetQty;
      // Named-species primary bind (board densify): Buy lead speaks densifyLabel.
      // The nest line buys the sheet the parts are nested on (a 2×2 frame's deck is plywood, not 2×2).
      const nestStock =
        (sheet?.formFactor === "sheet" ? sheet : undefined) ??
        getCatalogItem((structural.find((c) => isSheetStockCut(c))?.id ?? "").split("|")[0]) ??
        getCatalogItem("plywood-3-4-4x8");
      const buySheet = isNamedLumberPrimary ? sheet : nestStock;
      const sheetName = isNamedLumberPrimary
        ? namedStockDisplayName(project.prompt ?? "", sheet ?? namedLumber!)
        : (buySheet?.name ?? '3/4" plywood 4x8');
      bom.push({
        name: sheetName,
        quantity: n,
        unit: isNamedLumberPrimary
          ? n === 1
            ? "pc"
            : "pcs"
          : n === 1
            ? "sheet"
            : "sheets",
        catalogId: buySheet?.id ?? "plywood-3-4-4x8",
        searchQuery: buySheet?.searchQuery ?? '3/4" x 4x8 sanded plywood',
        estimatedCost: (buySheet?.unitCostUsd ?? 38.43) * n,
        notes: (() => {
          const base = isNamedLumberPrimary
            ? honestNamedLumberBuyWoodNote({ qty: n, legQty: legQtyForNote })
            : `From nest · ${n} sheet${n === 1 ? "" : "s"} · 1/8" kerf included.${
                cuts.some((c) => / · /.test(c.name))
                  ? " Some faces are splice segments — butt-join before assembly."
                  : ""
              }${unplaced.length ? ` ${unplaced.length} part(s) still oversize — do not buy until fixed.` : ""}`;
          const species = speciesStockHonestyTalk(project.prompt ?? "", buySheet?.name ?? '3/4" plywood');
          return species ? `${base} ${species}` : base;
        })(),
      });
    }
  }
  const solidNamedBuy =
    project.primaryMaterialId === CATALOG_LUMBER_BIND &&
    !!namedLumber &&
    !structural.some((c) => /ply|sheet/i.test(`${c.material ?? ""}`));
  // 1× boards beside sheet parts (slats and guards on a plywood-deck frame) are bought as boards too.
  // An untyped 1×4 primary (a towel ladder's rails) is bought here too; a named-species 1×4 bought above.
  if (!buyNamedBoard && !boardPrimary && !(project.primaryMaterialId === CATALOG_LUMBER_BIND && namedLumber)) {
    const byBoard = new Map<string, typeof structural>();
    for (const c of structural) {
      const id = c.id.split("|")[0];
      if (/^lumber-1x\d+-8$/.test(id) && !boardsBought.has(id)) byBoard.set(id, [...(byBoard.get(id) ?? []), c]);
    }
    for (const [id, lines] of byBoard) {
      const item = getCatalogItem(id);
      if (!item) continue;
      boardsBought.add(id);
      const plan = planSolidBoards(lines.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })), item.dims.width ?? 3.5);
      const partsQty = lines.reduce((n, c) => n + c.quantity, 0);
      bom.push({
        name: item.name,
        quantity: plan.boards,
        unit: plan.boards === 1 ? "board" : "boards",
        catalogId: id,
        searchQuery: item.searchQuery ?? item.name,
        estimatedCost: item.unitCostUsd != null ? item.unitCostUsd * plan.boards : undefined,
        notes: `${plan.boards} × 8 ft ${item.name} for the ${partsQty} part${partsQty === 1 ? "" : "s"} on the cut list. Packed with 1/8" kerf.`,
      });
    }
  }
  if (!buyNamedBoard && !solidNamedBuy && !boardPrimary && sheets10 > 0) {
    bom.push({
      name: sheet10?.name ?? '3/4" plywood 4x10',
      quantity: sheets10,
      unit: sheets10 === 1 ? "sheet" : "sheets",
      catalogId: sheet10?.id ?? "plywood-3-4-4x10",
      searchQuery: sheet10?.searchQuery ?? '3/4" x 4x10 sanded plywood',
      estimatedCost: (sheet10?.unitCostUsd ?? 72) * sheets10,
      notes: (() => {
        const base = `From nest · ${sheets10} sheet${sheets10 === 1 ? "" : "s"} · 1/8" kerf · full-height faces that do not fit a 4×8.`;
        const species = speciesStockHonestyTalk(project.prompt ?? "", sheet10?.name ?? '3/4" plywood 4x10');
        return species ? `${base} ${species}` : base;
      })(),
    });
  }
  if (namedLegQty && !legsMerged) {
    const legPlan = planSolidBoards(legStripParts);
    bom.push({
      name: namedLegLabel,
      quantity: legPlan.boards,
      unit: legPlan.boards === 1 ? "board" : "boards",
      catalogId: CATALOG_LUMBER_BIND,
      searchQuery: `${namedLegLabel.replace(/ 1×4$/, "")} 1x4 board`,
      estimatedCost: (getCatalogItem(CATALOG_LUMBER_BIND)?.unitCostUsd ?? 4) * legPlan.boards,
      notes: `${legPlan.boards} × 8 ft ${namedLegLabel} (¾" × 3½") for the ${namedLegQty} leg${namedLegQty === 1 ? "" : "s"} — each laminated from two 1 1/2" strips ripped from the board. Packed from the cut list with 1/8" kerf and 1" trim.`,
    });
  }
  // Every solid-lumber part (legs, 2× rails and bearers, posts) is bought by stock length through the one
  // linear packer, grouped per stock. Named-species boards and plywood are bought above.
  // Posts and other 2"+ sections (4×4) are never board glue-ups: they are bought here on any build.
  const thickLumber = cuts.filter(
    (c) => /^lumber-/.test(c.id) && !c.id.startsWith(`${CATALOG_LUMBER_BIND}|`) && (c.thicknessIn ?? 0) >= 2 && !isLumberLegCut(c),
  );
  const otherLumber = [
    // A named-species build buys its species boards above; its other lumber (2×2 rungs) is bought here.
    ...(boardPrimary
      ? []
      : structural.filter(
          (c) =>
            /^lumber-/.test(c.id) &&
            !c.id.startsWith(`${CATALOG_LUMBER_BIND}|`) &&
            !boardsBought.has(c.id.split("|")[0]) &&
            !stickBoards.includes(c) &&
            (c.thicknessIn ?? 0) > 1,
        )),
    ...thickLumber,
  ];
  const lumberCuts = [...legCuts, ...(frameBought ? [] : stickBoards), ...otherLumber];
  const byStock = new Map<string, CutLine[]>();
  for (const c of lumberCuts) {
    const legPanel = /^leg$/i.test(c.name) ? project.panels.find((p) => /^leg\b/i.test(p.name))?.materialId : undefined;
    const id = (c.id.split("|")[0] || legPanel || "lumber-2x2-8").replace(/^plywood-.*/, "lumber-2x2-8");
    const list = byStock.get(id) ?? [];
    list.push(c);
    byStock.set(id, list);
  }
  for (const [id, lines] of byStock) {
    const item = getCatalogItem(id);
    const stockLen = item?.dims.length ?? 96;
    // A part wider than the stick's face is edge-glued from that many strips, each its full length.
    const strips = (c: CutLine) => (item?.dims.width && c.widthIn < c.lengthIn ? Math.max(1, Math.ceil((c.widthIn - 0.01) / item.dims.width)) : 1);
    const lengths = lines.flatMap((c) => Array.from({ length: c.quantity * strips(c) }, () => Math.max(c.lengthIn, c.widthIn)));
    // A member longer than the board is half-lap spliced: each joint needs SPLICE_LAP more board (the splice step's 12").
    const packed = packLengths(lengths.map((n) => (n > stockLen + 0.01 ? n + SPLICE_LAP * Math.ceil((n - stockLen) / (stockLen - SPLICE_LAP)) : n)), stockLen, 0.125);
    const qty = Math.max(1, packed.sticks);
    const pieceQty = lengths.length;
    const feet = Math.round(stockLen / 12);
    const names = [...new Set(lines.map((c) => c.name.toLowerCase()))];
    const lens = [...new Set(lengths.map((n) => Math.round(n * 16) / 16))].sort((a, b) => b - a).map((n) => `${inchFrac(n)}"`).join(", ");
    // Typed species stock keeps its species on Buy (the cut list already says "Cedar 2×6").
    const speciesLabel = lines.every((c) => c.material && c.material === lines[0].material && speciesOfBoardLabel(c.material)) ? lines[0].material! : "";
    bom.push({
      name: speciesLabel || (item?.name ?? "2×4 Stud (8 ft)"),
      quantity: qty,
      unit: qty === 1 ? "pc" : "pcs",
      catalogId: id,
      searchQuery: item?.searchQuery ?? "2x4x8 stud",
      estimatedCost: (item?.unitCostUsd ?? 5.5) * qty,
      notes: `${pieceQty} part${pieceQty === 1 ? "" : "s"} (${names.join(", ")}) cut to ${lens}, from ${qty} × ${feet} ft solid lumber with 1/8" kerf.${packed.spare ? ` ${packed.spare}` : ""}`,
    });
  }
  if (thinBacks.length) {
    const thinQty = thinBacks.reduce((s, c) => s + c.quantity, 0);
    // Backer sheets from the plan's one nest (4×8, and 4×10 for full-height backs).
    const thin10 = thinBacks.filter((c) => !fitsOnSheet(c.lengthIn, c.widthIn, SHEET_4X8));
    const backer = nestSheetCounts(nest.backer);
    const t8 = backer.on8;
    const t10 = backer.on10;
    const spliceNote = thinBacks.some((c) => / · /.test(c.name))
      ? " Splice segments butt-join into the finished back before you hang it."
      : "";
    if (t8 > 0 || (t8 + t10 === 0)) {
      const n = Math.max(1, t8);
      bom.push({
        name: '1/4" plywood 4x8 (backer)',
        quantity: n,
        unit: n === 1 ? "sheet" : "sheets",
        catalogId: "plywood-1-4-4x8",
        searchQuery: "1/4 inch sanded plywood 4x8",
        estimatedCost: 24.98 * n,
        // Name what they are: backs are back panels; a mix (Shaker panels, drawer bottoms) are thin 1/4" parts.
        notes: `${thinQty} ${thinBacks.every((c) => /\bback\b/i.test(c.name)) ? "thin back panel" : 'thin 1/4" part'}${thinQty === 1 ? "" : "s"} (${thinBacks.map((c) => c.label ?? c.name).join(", ")}) — not nested on the 3/4" sheets.${spliceNote}`,
      });
    }
    if (t10 > 0) {
      bom.push({
        name: '1/4" plywood 4x10 (backer)',
        quantity: t10,
        unit: t10 === 1 ? "sheet" : "sheets",
        catalogId: "plywood-1-4-4x10",
        searchQuery: "1/4 inch sanded plywood 4x10",
        estimatedCost: 34.98 * t10,
        notes: `${thin10.reduce((s, c) => s + c.quantity, 0)} tall thin back panel${thin10.length === 1 ? "" : "s"} on 4×10 — not nested on the 3/4" sheets.${spliceNote}`,
      });
    }
  }
  const headboard =
    /headboard/i.test(project.name) ||
    /headboard/.test((project.prompt ?? "").toLowerCase());
  const coatRack =
    /coat/i.test(project.name) ||
    isCoatHookBoard((project.prompt ?? "").toLowerCase()) ||
    (/coat/.test((project.prompt ?? "").toLowerCase()) && /rack|hook|rail|peg|tree/.test((project.prompt ?? "").toLowerCase())) ||
    /\b(?:coat|hat|key|leash)\s+(?:rack|holder)\b/i.test(project.name);
  const island = /island/i.test(project.name) || /island/.test((project.prompt ?? "").toLowerCase());
  const nightstand =
    !isBedsideShelf((project.prompt ?? "").toLowerCase()) &&
    !/^Bedside shelf/i.test(project.name) &&
    (/nightstand/i.test(project.name) ||
      /nightstand/.test((project.prompt ?? "").toLowerCase()) ||
      (/bedside/.test((project.prompt ?? "").toLowerCase()) && !isBedsideShelf((project.prompt ?? "").toLowerCase())));
  // Wall cleats make a floating build; a freestanding frame's top cleat (picnic table) does not.
  const hasCleats = project.assumptions?.installMode !== "freestanding" && project.panels.some((p) => /cleat/i.test(p.name));
  const hasBrackets = project.panels.some((p) => /bracket/i.test(p.name));
  const oddKind = project.fitted?.unit?.odd?.kind;
  const floating =
    oddKind ? oddKind === "outside-corner" || oddKind === "honeycomb" :
    hasCleats ||
    hasBrackets ||
    ((/floating|wall-?mounted|wall\s+shelves?/i.test(project.name) ||
      /floating|wall-?mounted|wall\s+shelves?/.test((project.prompt ?? "").toLowerCase())) &&
      /shel/i.test(`${project.name} ${project.prompt ?? ""}`));
  const ironing =
    /ironing/i.test(project.name) ||
    /ironing/.test((project.prompt ?? "").toLowerCase());
  const foldDownBoard = project.panels.some((p) => /fold-down board|ironing board/i.test(p.name));
  const foldDown =
    foldDownBoard ||
    project.fitted?.affordances?.includes("fold-down-board") ||
    /fold-down|fold down/i.test(project.name) ||
    /fold[- ]?down|drop[- ]?down/.test((project.prompt ?? "").toLowerCase());
  const medicine =
    /medicine/i.test(project.name) ||
    /medicine/.test((project.prompt ?? "").toLowerCase());
  const overToilet =
    /over-toilet/i.test(project.name) ||
    /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf)|space[- ]?saver/.test((project.prompt ?? "").toLowerCase());
  const spice =
    /spice/i.test(project.name) ||
    (/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  const wine =
    /wine/i.test(project.name) ||
    (/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()));
  // Single-slab headboard has no carcase joints — skip join screws.
  // Floating shelves only need a few screws shelf→cleat (not a carcase box).
  // Template builds that declare glue-only joinery (mitered frames) take no screws.
  const glueOnly = !!project.shape?.params?.glueOnly || stockJoinsWithoutScrews(project);
  // Shelves on pins (the same rule the pin line below uses) take no screws.
  const pinShelves =
    !coatRack && !island && !nightstand && !floating && !ironing && !foldDown && !spice && !wine &&
    !wantsRackAffordance(project.prompt ?? "") && !wantsFixedGlueShelves(project);
  const pinned = (p: Panel) => pinShelves && p.type === "shelf" && !isFixedSpanShelf(p) && shelfSpansUprights(p, project.panels);
  // Joints the notes bolt (an A-frame's cleat and seat support through its legs) take carriage bolts, not screws.
  const boltedToLegs = (project.notes ?? []).some((n) => /held to both legs with \d+ 3\/8" carriage bolts/.test(n));
  const bolted = (a: Panel, b: Panel) => boltedToLegs && [[a, b], [b, a]].some(([x, y]) => /^Leg\b/.test(x.name) && /^(?:Top cleat|Seat support)\b/.test(y.name));
  const buyJoints = panelJoints(project.panels, (a, b) => pinned(a) || pinned(b) || bolted(a, b));
  BUY_JOINTS.set(project, buyJoints);
  const modelScrews = screwTalk(buyJoints);
  // A build with no screwed joint (pegs glued in holes) buys no screws.
  if (!headboard && !glueOnly && (modelScrews.screws > 0 || project.fitted?.unit?.corner || floating)) {
    const cornerUnit = project.fitted?.unit?.corner;
    const cornerShelves = project.panels.filter((p) => p.type === "shelf").length;
    const cornerWallPanelScrews = cornerUnit && !cornerUnit.wallHung ? Math.max(4, Math.ceil(cornerUnit.height / 8)) : 0;
    const joinScrews = cornerUnit
      ? cornerShelves * 4 + cornerWallPanelScrews
      : floating ? Math.max(8, project.panels.filter((p) => p.type === "shelf").length * 4) : Math.max(4, modelScrews.screws);
    const screwLen = inchFrac(faceScrewInches(stockThickness(project))).replace(" ", "-");
    bom.push({
      name: `#8 x ${screwLen}" wood screws`,
      quantity: Math.ceil(joinScrews / SCREWS_PER_BOX),
      unit: screwBoxUnit(Math.ceil(joinScrews / SCREWS_PER_BOX)),
      catalogId: "screws-8",
      searchQuery: `#8 wood screws ${screwLen}`,
      estimatedCost: 8,
      notes: cornerUnit
        ? cornerUnit.wallHung
          ? `${joinScrews} screws — 4 per shelf, down into its two wall cleats.`
          : `${joinScrews} screws — 4 per shelf (2 through each wall panel) plus ${cornerWallPanelScrews} joining Wall panel A to Wall panel B.`
        : floating
        ? hasBrackets
          ? `${joinScrews} screws through the shelf into the brackets.`
          : `${joinScrews} screws through the shelf into the cleat.`
        : modelScrews.screws >= 4
          ? modelScrews.note
          : `${joinScrews} screws for the few joints in the model.`,
    });
  }
  // Drawer fronts are typed as rail with "Drawer front" names — slides count boxes only.
  const drawers = drawerBoxes(project.panels);
  if (drawers.length) {
    // A box shallower than the shortest slide runs on wood runners: it buys no slides.
    const onSlides = Math.max(...drawers.map((d) => d.size.depth)) >= SLIDE_LENGTHS_IN[0] - 1e-6;
    const carcaseD =
      project.pocket?.unit.depth ?? project.fitted?.unit.depth ?? project.overall.depth;
    const slide = drawerSlideInches(project.panels, carcaseD);
    if (onSlides) bom.push({
      name: `${slide}" side-mount drawer slides`,
      quantity: drawers.length,
      unit: drawers.length === 1 ? "pair" : "pairs",
      catalogId: `drawer-slides-${slide}`,
      searchQuery: `${slide} inch side mount drawer slides`,
      asin: "B0CLGQP8TL",
      estimatedCost: 14.98 * drawers.length,
      notes: `One pair per drawer (${drawers.length} drawers). Confirm slide length against the ${carcaseD}" carcase.`,
    });
    bom.push({
      name: "Cup pulls",
      quantity: drawers.length,
      unit: drawers.length === 1 ? "pull" : "pulls",
      catalogId: "cup-pulls",
      searchQuery: "3 inch cup pulls cabinet drawer",
      asin: "B09TVX1TWZ",
      estimatedCost: 3.5 * drawers.length,
      notes: `One cup pull centered on each drawer front (${drawers.length} drawer${drawers.length === 1 ? "" : "s"}).`,
    });
    bom.push({
      name: '1" finish nails / brads',
      quantity: 1,
      unit: "box",
      searchQuery: "1 inch finish nails brad box",
      estimatedCost: 6,
      notes: `Nail each drawer (sides, back, and bottom) square (${drawers.length} drawer${drawers.length === 1 ? "" : "s"}).`,
    });
    const solidFronts =
      project.primaryMaterialId === CATALOG_LUMBER_BIND &&
      !project.panels.some((pp) => /^plywood-3-4/i.test(pp.materialId ?? ""));
    if (!solidFronts) bom.push({
      name: "Iron-on edge banding",
      quantity: 1,
      unit: "roll",
      catalogId: "edge-banding",
      searchQuery: "iron on edge banding birch 3/4 inch",
      estimatedCost: 8.98,
      notes: `Cover raw plywood edges on drawer fronts people see (${drawers.length} front${drawers.length === 1 ? "" : "s"}).`,
    });
  }
  // Hooks are bought only when the model carries them.
  if (coatRack && project.panels.some((p) => /^Coat (?:hook|peg) \d+$/.test(p.name))) {
    const pegRailBuild = project.panels.some((p) => /peg rail/i.test(p.name));
    const hooks = hookCount({ prompt: project.prompt, name: project.name, railWidth: project.overall.width, pegs: /\bpegs?\b/i.test(project.prompt ?? "") });
    bom.push({
      name: "Coat hooks",
      // Hooks come 6 to a pack: buy enough packs for every drawn hook.
      quantity: Math.max(1, Math.ceil(hooks / 6)),
      // Bought hardware shows its piece count, the way stick packs do.
      unit: `pack of 6 (${hooks} hook${hooks === 1 ? "" : "s"} used)`,
      catalogId: "coat-hooks",
      searchQuery: "coat hooks wall mount 6 pack",
      estimatedCost: 12.98 * Math.max(1, Math.ceil(hooks / 6)),
      notes: `${hooks} hooks, 6" on center into the ${pegRailBuild ? "peg rail" : project.panels.some((p) => /body profile/i.test(p.name)) ? "body profile" : project.shape ? "body" : "rail"}, with ${hooks * SCREWS_PER_HOOK} hook screws (${SCREWS_PER_HOOK} per hook; most hook packs include them).`,
    });
  }
  if ((project.notes ?? []).some((n) => /\banti-tip\b/i.test(n)) && !bom.some((b) => /anti-tip/i.test(b.name))) {
    bom.push({
      name: "Furniture anti-tip kit",
      quantity: 1,
      unit: "kit",
      searchQuery: "furniture anti tip kit wall anchor strap",
      estimatedCost: 9.98,
      notes: "Strap or bracket from the top back into a wall stud so the unit cannot tip forward.",
    });
  }
  if (medicine) {
    bom.push({
      name: "Mirror for the door",
      quantity: 1,
      unit: "pc",
      searchQuery: "adhesive bathroom cabinet mirror",
      estimatedCost: 14.98,
      notes: "Set into a 1/8\" rabbet in the door's outer face with mirror adhesive, flush with that face and inside the door's edges.",
    });
    const backW = project.panels.find((p) => p.type === "back")?.size.width ?? 0;
    if (backW > 0 && !backReachesTwoStuds(backW)) {
      bom.push({
        name: "Rated wall anchors",
        quantity: 1,
        unit: "pack",
        searchQuery: "toggle bolt drywall anchors",
        estimatedCost: 8.98,
        notes: `Back is ${backW}" wide — shorter than ${STUD_CENTER_IN}" stud centers. Anchors at the corners that miss a stud.`,
      });
    }
  }
  const glassMirrors = project.panels.filter((p) => isBuyMirrorPanel(p.name, p.type) && !isFrameGlazing(p.name, p.type) && !isBoughtHardwareName(p.name));
  if (glassMirrors.length && !medicine) {
    const m = glassMirrors[0];
    const dims = sheetCutDims(m.size.width, m.size.height, m.size.depth);
    bom.push({
      name: `Vanity mirror ${inchFrac(dims.lengthIn)}" × ${inchFrac(dims.widthIn)}"`,
      quantity: glassMirrors.length,
      unit: glassMirrors.length === 1 ? "pc" : "pcs",
      catalogId: "vanity-mirror",
      searchQuery: `vanity wall mirror ${Math.round(dims.widthIn)}x${Math.round(dims.lengthIn)}`,
      estimatedCost: 39.99 * glassMirrors.length,
      notes: (project.fitted?.unit?.kneeW ?? 0) > 0 || project.pocket
        ? `Buy glass this size — do not cut from plywood. Hang over the knee.`
        : `Buy glass this size — do not cut from plywood. Hang it on a French cleat into two studs.`,
    });
  }
  if (foldDown || ironing) {
    bom.push(...foldDownBuy(ironing));
    if (ironing) {
      bom.push({
        name: "Ironing board cover",
        quantity: 1,
        unit: "pc",
        searchQuery: "tabletop ironing board cover pad",
        estimatedCost: 12.99,
        notes: "Heat-resistant pad and cover for the plywood board. Staple or clip it on.",
      });
    }
  }
  // Every door and lid: hinges by size and weight, stays, latches, pulls (one shared module).
  bom.push(...hingedBuy(project, bom, hingeContext(project)));


  const hangingRods = project.panels.filter(
    (panel) => /hanging rod/i.test(panel.name),
  );
  if (hangingRods.length) {
    const lengths = hangingRods.map((p) =>
      Math.max(p.size.width, p.size.height, p.size.depth),
    );
    const longest = Math.max(...lengths);
    const total = lengths.reduce((s, n) => s + n, 0);
    const sticks = longest > 96 ? lengths.length : Math.max(1, Math.ceil(total / 96));
    const rod = getCatalogItem("closet-rod");
    bom.push({
      name: rod?.name ?? 'Closet rod 1-1/4" (8 ft)',
      quantity: sticks,
      unit: sticks === 1 ? "pc" : "pcs",
      catalogId: "closet-rod",
      searchQuery: rod?.searchQuery ?? "1-1/4 inch closet rod 8 ft",
      estimatedCost: (rod?.unitCostUsd ?? 14) * sticks,
      notes: `Cut to ${lengths.map((n) => `${Math.round(n * 8) / 8}"`).join(", ")}. Not a plywood strip.`,
    });
    bom.push({
      name: "Closet rod sockets",
      quantity: hangingRods.length,
      unit: hangingRods.length === 1 ? "pair" : "pairs",
      catalogId: "closet-rod-sockets",
      searchQuery: "closet rod sockets flanges pair",
      estimatedCost: 7.98 * hangingRods.length,
      notes: `One pair of sockets/flanges per hanging rod (${hangingRods.length} rod${hangingRods.length === 1 ? "" : "s"}). Seat on that bay's uprights or dividers. A rod cannot pass through a divider.`,
    });
  }
  // Pins hold a shelf that spans between two uprights (sides, dividers). A shelf screwed down on a
  // frame, a profile or legs has nothing to drill, so it buys no pins.
  const pinPieces = project.panels.filter((panel) => panel.type === "shelf" && !isFixedSpanShelf(panel) && shelfSpansUprights(panel, project.panels));
  const shelfCount = shelfLineCount(pinPieces);
  // Floating shelves sit on wall cleats — no adjustable pins, no uprights to drill.
  // Shoe cubbies / jar lips / bottle rails are glued and screwed — never pin-shelf bookcases.
  if (
    shelfCount > 0 &&
    !coatRack &&
    !island &&
    !nightstand &&
    !floating &&
    !ironing &&
    !foldDown &&
    !spice &&
    !wine &&
    !wantsRackAffordance(project.prompt ?? "") &&
    !wantsFixedGlueShelves(project)
  ) {
    const pins = pinPieces.length * 4;
    const packs = Math.max(1, Math.ceil(pins / 50));
    const pinWord = pinPieces.length === shelfCount
      ? `${shelfCount} shel${shelfCount === 1 ? "f" : "ves"} × 4`
      : `4 on each of ${pinPieces.length} pieces, ${shelfCount} shel${shelfCount === 1 ? "f" : "ves"}`;
    bom.push({
      name: '3/16" shelf pins',
      quantity: packs,
      unit: packs === 1 ? "pack" : "packs",
      catalogId: "shelf-pins",
      searchQuery: '3/16" shelf pins',
      estimatedCost: 6.49 * packs,
      notes: `${pins} pins (${pinWord}). Set the shelves loose on the pins so they lift out to move.`,
    });
  }
  const headboardPlies = project.panels.filter((p) => /headboard/i.test(p.name)).length;
  // Untyped single-slab headboard needs no glue; laminated typed-depth plies do.
  if (!headboard || headboardPlies > 1) {
    bom.push({
      name: "Wood glue",
      quantity: 1,
      unit: "bottle",
      catalogId: "glue",
      searchQuery: "titebond wood glue",
      estimatedCost: 5.47,
      notes:
        headboard && headboardPlies > 1
          ? `Glue ${headboardPlies} headboard plies face-to-face to the typed depth.`
          : undefined,
    });
  }
  // Template pivots (figure joints): one paper fastener per joint.
  if (project.shape?.params?.pivots) bom.push(pivotLine(project.shape.params.pivots));
  if (craft) bom.unshift(craft.line);
  bom.push(...templateAccessories(project));
  // Template spring (catapult arm): the rubber band is part of the build.
  if (project.shape?.params?.rubberBands) {
    bom.push({
      name: "Rubber bands",
      quantity: 1,
      unit: "pack",
      catalogId: "rubber-bands",
      searchQuery: "rubber bands assorted",
      estimatedCost: 5.99,
      notes: `${project.shape.params.rubberBands} bands: one hinges the arm on the axle, one is the spring from the arm over the crossbar.`,
    });
  }
  if (project.assumptions.installMode !== "freestanding") {
    bom.push({
      name: project.assumptions.wallType === "masonry"
        ? "Tapcon concrete screws 3/16 x 2-3/4"
        : "GRK RSS #9 x 3-1/8 structural screws",
      quantity: 1,
      unit: "box",
      searchQuery:
        project.assumptions.wallType === "masonry"
          ? "Tapcon 3/16 x 2-3/4"
          : "GRK RSS #9 x 3-1/8",
      estimatedCost: 14,
      notes: project.fitted?.unit?.corner
        ? project.fitted.unit.corner.wallHung
          ? `${project.panels.filter((p) => /^wall cleat/i.test(p.name)).length * 2} screws — 2 through each wall cleat into studs or corner framing on both walls. Guidance only — confirm wall type.`
          : "4 screws — 2 through Wall panel A and 2 through Wall panel B into studs or corner framing on both walls. Guidance only — confirm wall type."
        : headboard
        ? "4-6 screws through the board into studs (or a french cleat). Guidance only — confirm wall type."
        : coatRack
          ? "4-6 screws through the peg rail into studs. Guidance only — confirm wall type."
          : floating
            ? hasBrackets
              ? "2-3 screws per bracket into studs. Guidance only — confirm wall type."
              : "2-3 screws per wall cleat into studs. Guidance only — confirm wall type."
          : ironing || foldDown
            ? "4-6 screws through the back into studs. A person leaning on the fold-down board will rip it off drywall anchors. Guidance only — confirm wall type."
          : medicine
            ? (() => {
                const backW = project.panels.find((p) => p.type === "back")?.size.width ?? 0;
                return backReachesTwoStuds(backW)
                  ? "4 screws through the back into studs. A loaded medicine cabinet will rip off drywall anchors. Guidance only — confirm wall type."
                  : `Back is ${backW}" wide — shorter than ${STUD_CENTER_IN}" stud centers, so it cannot take a screw in two studs. Screw the corner that hits a stud and use rated wall anchors at the others. Guidance only — confirm wall type.`;
              })()
          : overToilet
            ? "4-6 screws through the uprights into studs so the unit cannot tip onto the toilet. Guidance only — confirm wall type."
          : spice
            ? "4 screws through the back into studs. A loaded spice rack will rip off drywall anchors. Guidance only — confirm wall type."
          : wine
            ? "4-6 screws through the back into studs. A loaded wine rack will rip off drywall anchors. Guidance only — confirm wall type."
          : project.panels.some((p) => p.type === "upright")
            ? "4-6 screws through the uprights into studs. Guidance only — confirm wall type."
            : "4-6 screws through the board into studs. Guidance only — confirm wall type.",
    });
  }
  return decorateBom(bom);
}

function closetIssues(project: YardProject): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];
  // Corner-unit class: the corner is the opening. Flag real tip risk, not a tight opening.
  const odd = project.fitted?.unit?.odd;
  if (odd) {
    const p = odd.params as Record<string, number>;
    if (odd.kind === "sloped" && p.angle > 50) {
      issues.push({ severity: "warning", message: `Steep slope (${p.angle}°) — the low bays get very short; check a shelf still fits before you cut.` });
    }
    if (odd.kind === "angled-corner" && (p.theta < 60 || p.theta > 150)) {
      issues.push({ severity: "info", message: `A ${p.theta}° corner makes ${p.theta < 60 ? "narrow, pointy" : "shallow"} wedge shelves — they hold small things.` });
    }
    if (odd.kind === "outside-corner" && p.D > 8) {
      issues.push({ severity: "warning", message: `${p.D}" deep shelves on an outside corner stick out into the walkway.` });
    }
    return issues;
  }
  const corner = project.fitted?.unit?.corner;
  if (corner) {
    const leg = Math.min(corner.legA, corner.legB);
    if (!corner.wallHung && corner.height / Math.max(leg, 1) > 5) {
      issues.push({
        severity: "warning",
        message: `Tall and slim (${Math.round(corner.height)}" tall on ${Math.round(leg)}" legs) — screw both wall panels into the walls before you load it.`,
      });
    }
    if (leg < 10) {
      const reach = Math.round((leg / Math.SQRT2) * 10) / 10;
      if (reach < 6) {
        issues.push({
          severity: "info",
          message: `About ${reach}" of shelf in front of the corner — phones and plants, not a row of books. Type a longer run along each wall for books.`,
        });
      }
    }
    return issues;
  }
  const { width, height, depth } = project.overall;
  const coatRack =
    /coat/i.test(project.name) ||
    isCoatHookBoard((project.prompt ?? "").toLowerCase()) ||
    (/coat/.test((project.prompt ?? "").toLowerCase()) && /rack|hook|rail|peg|tree/.test((project.prompt ?? "").toLowerCase()));
  const headboard =
    /headboard/i.test(project.name) ||
    /headboard/.test((project.prompt ?? "").toLowerCase());
  const floatingIssue =
    (project.panels.some((p) => /cleat/i.test(p.name) || /bracket/i.test(p.name)) ||
      /floating|wall-?mounted|wall\s+shelves?/i.test(project.name) ||
      /floating|wall-?mounted|wall\s+shelves?/.test((project.prompt ?? "").toLowerCase())) &&
    /shel/i.test(`${project.name} ${project.prompt ?? ""}`);
  if (!isUnitItem(project) && !project.id.startsWith("recipe-") && !coatRack && !headboard && !floatingIssue && !/crate/i.test(project.name) && !/ironing/i.test(project.name) && !/ironing/.test((project.prompt ?? "").toLowerCase()) && !/medicine/i.test(project.name) && !/medicine/.test((project.prompt ?? "").toLowerCase()) && !/over-toilet/i.test(project.name) && !/spice/i.test(project.name) && !(/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && !/wine/i.test(project.name) && !(/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && (width < 12 || height < 12 || depth < 8)) {
    issues.push({
      severity: "warning",
      message: "Opening is tight — confirm the measure before you cut.",
    });
  }
  return issues;
}

function packPlan(
  project: YardProject,
  issues: FeasibilityIssue[],
  summary: string,
  cutList: CutLine[],
  bom: BuildPlan["bom"],
  instructions: AssemblyStep[],
  pieces: number,
  cost: number,
  partsKind: "cut" | "whole" = "cut",
): BuildPlan {
  // Stranger Voice/PDF path — prefer plain words (main box / kick strip) over carcase/toekick/Orbit.
  // Then kit craft: parts-plate letters on every cut + one-join densify with hardware counts.
  const platedCutList = stampPartsPlate(cutList);
  // Steps name the adhesive Buy lists: hot-glue stock never reads "tape or glue".
  const hot = bom.some((b) => /hot glue sticks/i.test(b.name));
  const glueTalk = (t: string) => (hot ? t.replace(/\bTape or glue\b/g, "Hot glue").replace(/\btape or glue\b/g, "hot glue") : t);
  const plainInstructions = instructions.map((s) => ({
    ...s,
    title: strangerPlainShopTalk(s.title),
    description: glueTalk(strangerPlainShopTalk(s.description)),
    tips: s.tips ? strangerPlainShopTalk(s.tips) : s.tips,
  }));
  const kitInstructions = densifyKitCraftInstructions(plainInstructions, platedCutList, project.name, restsOnLaterStep(project, plainInstructions));
  const assumedInstructions = firstStepSaysDefaultStock(densifyConfirmAssumedNotes(kitInstructions, project.notes), project.notes);
  // Money is finite or absent: a piece with no listing price never reads "$NaN" on Buy.
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const plainBom = bom.map((b) => ({
    ...b,
    estimatedCost: finite(b.estimatedCost) ? b.estimatedCost : undefined,
    offers: b.offers?.map((o) => ({
      ...o,
      packPrice: finite(o.packPrice) ? o.packPrice : 0,
      unitPrice: finite(o.unitPrice) ? o.unitPrice : 0,
      lineTotal: finite(o.lineTotal) ? o.lineTotal : 0,
    })),
    notes: b.notes
      ? densifyDrawerExplodeTalk(strangerPlainShopTalk(b.notes), platedCutList)
      : b.notes,
  }));
  return {
    feasibility: {
      status: issues.some((i) => i.severity === "critical")
        ? "critical"
        : issues.some((i) => i.severity === "warning")
          ? "warnings"
          : "ok",
      summary,
      issues,
    },
    cutList: platedCutList,
    bom: plainBom,
    instructions: assumedInstructions,
    totals: {
      pieces,
      estCostUsd: Number.isFinite(cost) ? cost : plainBom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0),
      packs: bom.reduce((s, b) => s + b.quantity, 0),
    },
    effort: effortLabel(project, pieces),
    generatedAt: new Date().toISOString(),
    render: project.render,
    partsKind,
  };
}

/**
 * HUD/bench chip stock name from nest / Buy — not the hardcoded primary 4×8.
 * When Buy nests any 3/4" 4×10 sheets, chip must say 4×10 (sheet-chip honesty).
 * Returns null for crafts / when nest is 4×8-only so callers keep primary label.
 */
export function honestNestSheetStockName(
  project: YardProject,
  plan?: BuildPlan | null,
): string | null {
  const name10 = getCatalogItem("plywood-3-4-4x10")?.name ?? '3/4" Plywood 4×10';
  if (plan?.bom?.length) {
    const has10 = plan.bom.some(
      (b) =>
        b.catalogId === "plywood-3-4-4x10" ||
        /3\/4"?\s*Plywood\s*4\s*[×x]\s*10/i.test(b.name),
    );
    if (has10) return name10;
    return null;
  }
  if (!project.panels.length) {
    return null;
  }
  // Same one nest Buy counts.
  const sheets10 = nestSheetCounts(planSheetNest(closetCuts(project)).sheets).on10;
  return sheets10 > 0 ? name10 : null;
}

/**
 * Stranger-facing wood piece count for the HUD chip — same quantity sum as
 * BuildPlan.totals.pieces for house/fitted projects (closetCuts: drawer explode
 * + laminated plies + sheet splice). Buy-only hardware is BOM, not counted.
 * Crafts (instances, no panels path) → instance count.
 */
export function strangerWoodPieceCount(project: YardProject): number {
  if (project.kind === "opening" && project.windowPkg) {
    return stampLabels(windowCuts(project)).reduce((s, c) => s + c.quantity, 0);
  }
  if (project.panels.length > 0) {
    return closetCuts(project).reduce((s, c) => s + c.quantity, 0);
  }
  return project.instances.length;
}

/** Every plan leaves with placement talk: each attach/position step says where, from geometry. */

function stockJoinsWithoutScrews(project: { primaryMaterialId?: string }): boolean {
  const item = project.primaryMaterialId ? getCatalogItem(project.primaryMaterialId) : undefined;
  const joins = item?.preferredJoins ?? [];
  if (!joins.length) return false;
  return !joins.includes("screw") && !joins.includes("nail");
}

/** Hardware the notes already name, so Buy and the notes agree. */
export function hardwareFromNotes(project: YardProject, bom: BuildPlan["bom"]): BuildPlan["bom"] {
  const notes = (project.notes ?? []).join(" ");
  const have = bom.map((line) => line.name.toLowerCase()).join(" ");
  const extra = [...bom];
  if (/carriage bolt/i.test(notes) && !/carriage bolt/i.test(have)) {
    const posts = Math.max(1, project.panels.filter((panel) => /handrail post/i.test(panel.name)).length);
    const counted = notes.match(/(\d+) 3\/8" carriage bolts/i);
    const quantity = counted ? Number(counted[1]) : posts * 2;
    // Bolt class: length = the two 1 1/2" members it clamps + washer + nut + a few threads; galvanized for outdoors.
    // Each set is bolt + nut + washer. Price: Home Depot Everbilt 3/8"-16 galvanized carriage bolt $1.97 (4", checked
    // 2026-10-15), +$0.20 for 4 1/2", plus nut and flat washer ~$0.45 = $2.62 a set.
    const long = /held to both legs/.test(notes);
    const size = long ? '3/8" × 4-1/2"' : '3/8" × 4"';
    const each = long ? 2.62 : 2.42;
    extra.push({
      name: `${size} galvanized carriage bolts, each with a nut and washer`,
      quantity,
      unit: "each",
      searchQuery: `3/8 inch x ${long ? "4-1/2" : "4"} inch galvanized carriage bolt`,
      estimatedCost: Math.round(each * quantity * 100) / 100,
      notes: (counted ? "Where the notes place them, through each joint." : "Two per handrail post, through the back post.") + " A flat washer under each nut.",
    });
  }
  if (/non-slip pad/i.test(notes) && !/non-slip/i.test(have)) {
    const feet = Math.max(4, project.panels.filter((panel) => /leg/i.test(panel.name)).length);
    extra.push({
      name: "Non-slip pads",
      quantity: feet,
      unit: "each",
      searchQuery: "non slip furniture pads",
      notes: "One pad under each foot.",
    });
  }
  const rope = notes.match(/(\d+) ft of 3\/8" sisal rope/i);
  if (rope && !/sisal/i.test(have)) {
    const packs = Math.max(1, Math.ceil(Number(rope[1]) / 100));
    extra.push({
      name: '3/8" sisal rope, 100 ft',
      quantity: packs,
      unit: packs === 1 ? "roll" : "rolls",
      catalogId: "sisal-rope",
      searchQuery: "3/8 inch sisal rope 100 ft",
      estimatedCost: 19.99 * packs,
      notes: `About ${rope[1]} ft wraps the post, tight turns, stapled at both ends.`,
    });
  }
  const mesh = notes.match(/½" galvanized hardware cloth, ([\d ½¼¾/]+)" × ([\d ½¼¾/]+)"/);
  if (mesh && !/hardware cloth/i.test(have)) {
    const inches = (t: string) => t.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
    const [a, b] = [inches(mesh[1]), inches(mesh[2])].sort((x, y) => x - y);
    const roll = `${a <= 24 ? 24 : a <= 36 ? 36 : 48} in × ${b <= 120 ? 10 : 25} ft`;
    extra.push({
      name: `1/2" galvanized hardware cloth, ${roll}`,
      quantity: 1,
      unit: "roll",
      catalogId: "hardware-cloth",
      searchQuery: `1/2 inch galvanized hardware cloth ${roll.replace("×", "x")}`,
      estimatedCost: 24,
      notes: `Cut to ${mesh[1]}" × ${mesh[2]}" for the front; staples hold it.`,
    });
  }
  const roll = notes.match(/\b(\d+) roll of mineral-surfaced roll roofing\b/);
  if (roll && !/roll roofing/i.test(have)) {
    extra.push({ name: "Mineral-surfaced roll roofing, 36 in × 33 ft", quantity: Number(roll[1]), unit: "roll", searchQuery: "mineral surfaced roll roofing 36 in", estimatedCost: 39.98 * Number(roll[1]), notes: "Over the roof sheet, lapped over every edge." });
    extra.push({ name: "Galvanized roofing nails, 7/8 in, 1 lb", quantity: 1, unit: "box", searchQuery: "7/8 inch galvanized roofing nails 1 lb", estimatedCost: 5.98, notes: "Fix the roll roofing to the roof sheet." });
  }
  const barrel = notes.match(/\b(\d+) 3" barrel bolts?\b/);
  if (barrel && !/barrel bolt/i.test(have)) {
    extra.push({
      name: '3" galvanized barrel bolt',
      quantity: Number(barrel[1]),
      unit: "each",
      searchQuery: "3 inch galvanized barrel bolt",
      estimatedCost: 5.98 * Number(barrel[1]),
      notes: "Locks the pop door at night; a raccoon opens a hook-and-eye.",
    });
  }
  const railBolts = notes.match(/(\d+) 3\/8" × 5 1\/2" bed-rail bolts/);
  if (railBolts && !/bed-rail bolt/i.test(have)) {
    extra.push({
      name: '3/8" × 5 1/2" bed-rail bolts with barrel nuts',
      quantity: Number(railBolts[1]),
      unit: "each",
      searchQuery: "3/8 x 5-1/2 bed rail bolt barrel nut",
      estimatedCost: 1.5 * Number(railBolts[1]),
      notes: "Two at each rail end, through the post into a barrel nut in the rail.",
    });
  }
  // Outdoor frames: footings, ties, hinges and swing hardware the notes name.
  const outdoor: [RegExp, (m: RegExpMatchArray) => BuildPlan["bom"][number]][] = [
    [/(\d+) precast concrete deck pier blocks/, (m) => ({ name: "Precast concrete deck pier blocks", quantity: Number(m[1]), estimatedCost: 9.98 * (Number(m[1])), unit: "each", searchQuery: "precast concrete deck pier block 4x4", notes: "One under each post, on compacted gravel." })],
    [/(\d+) hurricane ties/, (m) => ({ name: "Hurricane ties (joist to beam)", quantity: Number(m[1]), estimatedCost: 1.28 * (Number(m[1])), unit: "each", searchQuery: "galvanized hurricane tie joist to beam", notes: "One where each joist crosses a beam." })],
    [/two 8" strap hinges/, () => ({ name: '8" heavy strap hinges', quantity: 2, estimatedCost: 12.98 * (2), unit: "each", searchQuery: "8 inch heavy strap hinge gate", notes: "Hinge stile to hinge post." })],
    [/(\d+) 6" T-hinges/, (m) => ({ name: '6" heavy T-hinges', quantity: Number(m[1]), estimatedCost: 8.98 * (Number(m[1])), unit: "each", searchQuery: "6 inch heavy t hinge exterior", notes: "Where the notes place them: doors to posts, lids to the back rail." })],
    [/(\d+) gravity latch(?:es)?/, (m) => ({ name: "Gravity latches", quantity: Number(m[1]), estimatedCost: 9.98 * (Number(m[1])), unit: "each", searchQuery: "gravity gate latch", notes: "One per door." })],
    [/(\d+) broom and mop grip clips/, (m) => ({ name: "Broom and mop grip clips", quantity: Number(m[1]), estimatedCost: 2.5 * (Number(m[1])), unit: "each", searchQuery: "broom mop holder grip clip wall mount", notes: "Across the back of the tall bay, 48\" up." })],
    [/(\d+) nesting tubes/, (m) => ({ name: '5/16" nesting tubes, 6" (paper or bamboo)', quantity: Number(m[1]), estimatedCost: 0.3 * (Number(m[1])), unit: "each", searchQuery: "mason bee nesting tubes 5/16 inch", notes: "Packed tight into each tier, open end out." })],
    [/for a gate latch/, () => ({ name: "Gate latch", quantity: 1, estimatedCost: 9.98 * (1), unit: "each", searchQuery: "gravity gate latch", notes: "On the latch stile and latch post." })],
    [/steel A-frame bracket at each end/, () => ({ name: "A-frame swing set brackets", quantity: 2, estimatedCost: 24.98 * (2), unit: "each", searchQuery: "swing set a-frame bracket 2x6 legs", notes: "One at each end, legs to beam." })],
    [/Hang (\d+) swings? from heavy-duty swing hangers/, (m) => ({ name: "Heavy-duty swing hangers", quantity: 2 * Number(m[1]), estimatedCost: 8.98 * (2 * Number(m[1])), unit: "each", searchQuery: "heavy duty swing hanger bolt through", notes: "Two per swing, bolted through the beam." })],
    [/Hang (\d+) swings? from/, (m) => ({ name: "Swing seats with chains", quantity: Number(m[1]), estimatedCost: 29.98 * (Number(m[1])), unit: "each", searchQuery: "swing seat with chains", notes: "One per pair of hangers." })],
    [/anchor each foot with a ground anchor/, () => ({ name: "Swing set ground anchors", quantity: 4, estimatedCost: 7.98 * (4), unit: "each", searchQuery: "swing set ground anchor", notes: "One at each foot." })],
  ];
  for (const [re, row] of outdoor) {
    const m = notes.match(re);
    if (m && !have.includes(row(m).name.toLowerCase())) extra.push(row(m));
  }
  // Hardware drawn in the model is bought: every hinge and latch on the model has a Buy line.
  const drawn = (re: RegExp) => project.panels.filter((p) => re.test(p.name)).length;
  const hinges = drawn(/^Hinge \d+$/);
  if (hinges && !/hinge/.test(have)) extra.push({ name: "Gate hinges", quantity: hinges, estimatedCost: 6.98 * (hinges), unit: "each", searchQuery: "self closing gate hinge", notes: "On the hinge stile, into the wall stud." });
  // A bed that pivots down out of the wall is carried by a bought lift mechanism (pivot arms + springs or pistons).
  if ((/\bmurphy\b/i.test(project.name) || /\bbed\b[^.]*\bpivots?\b/i.test(notes)) && !/lift mechanism|murphy bed hardware/.test(have))
    extra.push({ name: "Murphy bed lift mechanism (pivot arms + springs or pistons)", quantity: 1, unit: "kit", estimatedCost: 289, searchQuery: "murphy bed hardware kit vertical queen", notes: "The pivot arms bolt to the cabinet sides and the bed frame rails; the springs or pistons carry the bed up and down. Size it to the mattress." });
  const folds = drawn(/^Fold bracket \d+$/);
  if (folds && !/folding leg|fold bracket/.test(have)) extra.push({ name: "Locking folding leg brackets", quantity: folds, unit: "each", estimatedCost: 5.98 * folds, searchQuery: "locking folding table leg bracket", notes: "One at the top of each leg, so it folds flat under the top." });
  const latches = drawn(/^Latch \d+$/);
  if (latches && !/latch/.test(have)) extra.push({ name: "Gate latch", quantity: latches, estimatedCost: 9.98 * (latches), unit: "each", searchQuery: "child safety gate latch", notes: "On the latch stile, into the far stud." });
  const hooks = drawn(/^Coat hook \d+$/);
  if (hooks && !/hook/.test(have)) extra.push({ name: "Coat hooks", quantity: hooks, estimatedCost: 3.98 * hooks, unit: "each", searchQuery: "double coat hook wall mount", notes: "One per drawn hook." });
  // Hardware the notes and steps name is bought, once: caulk, paint, lag screws, fabric, handles.
  const said = `${notes} ${(project.notes ?? []).join(" ")}`;
  const named: [RegExp, RegExp, BuildPlan["bom"][number]][] = [
    [/\bcaulk/i, /caulk/, { name: "Exterior caulk", quantity: 1, estimatedCost: 6.98, unit: "tube", searchQuery: "exterior paintable caulk", notes: "Seal the seams the notes name." }],
    [/\b(?:exterior|dark|latex)\s+paint|\bpaint (?:it|the outside)/i, /paint/, { name: "Exterior paint", quantity: 1, estimatedCost: 14.98, unit: "quart", searchQuery: "exterior latex paint quart", notes: "Outside faces only, as the notes say." }],
    [/\blag (?:screws?|bolts?)|\blag the\b/i, /\blag\b/, { ...LAG_ROW }],
    [/landscape[- ]fabric/i, /fabric/, { name: "Landscape fabric", quantity: 1, estimatedCost: 12.98, unit: "roll", searchQuery: "landscape fabric 3 ft roll", notes: "Under the sand or soil, as the notes say." }],
    [/\bhandles?\b/i, /handle|pull/, { name: "Handles", quantity: 2, estimatedCost: 4.98 * 2, unit: "each", searchQuery: "galvanized door pull handle", notes: "The handles the notes name." }],
    [/fabric cover|\bcanvas\b/i, /canvas|fabric/, { name: "Canvas drop cloth, 9 × 12 ft", quantity: 1, estimatedCost: 24.98, unit: "each", searchQuery: "canvas drop cloth 9x12", notes: "Cut to the cover panels and hem the edges." }],
    [/\bstretch cord\b/i, /cord/, { name: "1/32\" clear stretch cord", quantity: 1, estimatedCost: 3.98, unit: "spool", searchQuery: "1mm clear stretch bead cord", notes: "The beads thread on it, as the notes say." }],
    [/\bbed bolts?\b/i, /bolt/, { name: '3/8" × 5 1/2" bed-rail bolts with barrel nuts', quantity: 8, estimatedCost: 1.5 * 8, unit: "each", searchQuery: "3/8 x 5-1/2 bed rail bolt barrel nut", notes: "The bed bolts the notes name." }],
  ];
  for (const [re, got, row] of named) if (re.test(said) && !got.test(have) && !extra.some((e) => got.test(e.name.toLowerCase()))) extra.push(row);
  // Craft sticks and dowels drawn as panels (recipe builds) are bought by the sticks that tile them.
  const sticksById = new Map<string, number>();
  const dowelCuts = new Map<string, number[]>();
  const dowelNotes = new Map<string, string>();
  for (const panel of project.panels) {
    const item = getCatalogItem(panel.materialId);
    if (!item || (project.instances ?? []).some((i) => i.catalogId === item.id)) continue;
    // Unit-table discs and beads (washers, pony beads) are one bought piece per drawn part.
    // C2: in a purchased-item build every unit-table piece (clothespin, straw, nail…) is one bought piece per part,
    // never a craft-stick area count.
    if ((item.formFactor === "custom" || (isUnitItem(project) && item.formFactor !== "dowel")) && unitSizeById(item.id)) { sticksById.set(item.id, (sticksById.get(item.id) ?? 0) + 1); continue; }
    if (!(item.formFactor === "stick" || item.formFactor === "dowel")) continue;
    const d = [panel.size.width, panel.size.height, panel.size.depth].sort((a, b) => b - a);
    const across = Math.max(1, Math.ceil(d[1] / Math.max(0.1, item.dims.width ?? item.dims.diameter ?? 0.375)));
    const along = Math.max(1, Math.ceil(d[0] / Math.max(1, item.dims.length ?? 4.5)));
    if (item.formFactor === "dowel") dowelCuts.set(item.id, [...(dowelCuts.get(item.id) ?? []), d[0]]);
    else sticksById.set(item.id, (sticksById.get(item.id) ?? 0) + across * along);
  }
  // Short dowel parts share stock: pack every cut (with 1/8" kerf) onto as few full-length dowels as fit.
  for (const [id, cuts] of dowelCuts) {
    const L = getCatalogItem(id)?.dims.length ?? 36;
    const bins: number[] = [];
    for (const c of [...cuts].sort((a, b) => b - a)) {
      if (c > L) { bins.push(...Array(Math.ceil(c / L) - 1).fill(0), L - (c % L || L)); continue; }
      const i = bins.findIndex((left) => left >= c + 0.125);
      if (i >= 0) bins[i] -= c + 0.125; else bins.push(L - c - 0.125);
    }
    sticksById.set(id, bins.length);
    // C3/F10: full-length parts are used whole: no cut, no kerf (the step says the same).
    if (cuts.every((c) => Math.abs(c - L) <= 1 / 64)) { dowelNotes.set(id, `${cuts.length} whole ${inchFrac(L)}" dowel${cuts.length === 1 ? "" : "s"}, used as bought, nothing to cut.`); continue; }
    dowelNotes.set(id, `${cuts.length} part${cuts.length === 1 ? "" : "s"} cut from ${bins.length} × ${inchFrac(L)}" dowel${bins.length === 1 ? "" : "s"}, 1/8" kerf.`);
  }
  for (const [id, n] of sticksById) {
    const item = getCatalogItem(id)!;
    if (have.includes(item.name.toLowerCase())) continue;
    const per = Math.max(1, item.unitsPerPack ?? 1);
    extra.push({ name: item.name, quantity: Math.ceil(n / per), estimatedCost: Math.round(Math.ceil(n / per) * per * (item.unitCostUsd ?? 0) * 100) / 100, unit: per > 1 ? `pack of ${per}` : "each", searchQuery: item.searchQuery ?? item.name, notes: dowelNotes.get(id) ?? `${n} ${n === 1 ? "piece" : "pieces"} used${per > 1 ? ` from ${Math.ceil(n / per) === 1 ? "1 pack" : `${Math.ceil(n / per)} packs`} of ${per}` : ""}.` });
  }
  if (/structural screws/i.test(notes) && !/structural|grk/i.test(have)) {
    extra.push({
      name: "GRK RSS #9 x 3-1/8 structural screws",
      quantity: 1,
      unit: "box",
      catalogId: "structural-screws",
      searchQuery: "GRK RSS #9 x 3-1/8",
      estimatedCost: 14,
      notes: "The long screws the notes call for.",
    });
  }
  if (/water-resistant finish/i.test(notes) && !/finish/i.test(have)) {
    extra.push({
      name: "Water-resistant finish",
      quantity: 1,
      unit: "can",
      searchQuery: "water resistant wood finish",
      notes: "For a stool that lives in a bathroom.",
    });
  }
  return extra;
}

/** The join step quotes the same screw total Buy already summed from the joints. */
export function stepsAccountForScrews(plan: BuildPlan): BuildPlan {
  const line = plan.bom.find((item) => /screws from the model's joints/.test(item.notes ?? ""));
  const sentence = line?.notes;
  if (!sentence || plan.instructions.some((step) => (step.description ?? "").includes("from the model's joints"))) return plan;
  const idx = plan.instructions.findIndex((step) => /screw/i.test(step.description ?? ""));
  if (idx < 0) return plan;
  const instructions = plan.instructions.map((step, i) => i === idx ? { ...step, description: `${step.description} ${sentence}` } : step);
  return { ...plan, instructions };
}

/**
 * A typed feature bay ("a pocket for the trash can") is the open bay of the model, sized to the object.
 * The plan calls it by its use and says what fits, instead of calling it knee space.
 */
function featureBayWording(project: YardProject, plan: BuildPlan): BuildPlan {
  const bay = featureBay(project.prompt ?? "");
  const knee = project.fitted?.unit?.kneeW;
  if (!bay || !knee) return plan;
  const o = bay.object;
  const pocket = `${o.label} ${bay.word}`;
  const fix = (t?: string) =>
    t
      ?.replace(/\bknee clear\b/gi, `${pocket} clear`)
      .replace(/\bknee clear stays open\b/gi, `${pocket} stays open`)
      .replace(/\bKnee dividers?\b/g, (m) => m.replace("Knee", "Pocket"))
      .replace(/\bknee dividers?\b/g, (m) => m.replace("knee", "pocket"))
      .replace(/that is the knee\b/gi, `that is the ${pocket}`)
      .replace(/\bthe knee\b/gi, `the ${pocket}`)
      .replace(/\bknee space\b/gi, pocket);
  const fits = `The open ${inchFrac(knee)}" bay between the drawer banks is the ${pocket}, open to the floor. It fits a ${o.label} about ${inchFrac(o.width)}" wide × ${inchFrac(o.depth)}" deep × ${inchFrac(o.height)}" tall with room to lift it out.`;
  return {
    ...plan,
    cutList: plan.cutList.map((c) => ({ ...c, name: fix(c.name) ?? c.name })),
    instructions: plan.instructions.map((st, i) => ({
      ...st,
      title: fix(st.title) ?? st.title,
      description: `${fix(st.description) ?? st.description}${i === 0 ? ` ${fits}` : ""}`,
      tips: fix(st.tips),
    })),
  };
}

const PIECE_UNIT = /^(?:boards?|pcs?|pieces?)$/;

/** A lumber stock's actual thickness (1 1/2" for a 2x4). */
const lumberT = (id?: string) => { const d = getCatalogItem(id ?? "")?.dims; return d?.width && d.height ? Math.min(d.width, d.height) : 1.5; };

/** Food-contact objects: boards and trays food sits on or is cut on. */
const FOOD = /\b(?:cutting|chopping|bread|serving|charcuterie|cheese|butcher|pastry)\s+boards?\b|\b(?:butcher\s+block|serving\s+tray|salad\s+bowl|spoon|spatula|rolling\s+pin)\b/i;
const HARDWOOD = /\b(?:maple|oak|walnut|cherry|beech|birch|teak|ash|hickory|mahogany|acacia)\b/i;

/** A food-contact build is hardwood, glued with Type II glue and oiled food-safe: no screws, no floor or feet talk. */
function foodContact(_project: YardProject, plan: BuildPlan): BuildPlan {
  const cut = plan.instructions.filter((s) => /^(?:Confirm|Cut)\b/.test(s.title)).map((s) => ({ ...s, description: s.description.replace(/\s*Predrill near the ends[^.]*\.(?:[^.]*split\.)?/, "").replace(/ and that the frame is square/, "") }));
  const steps = [
    ...cut,
    { step: 0, title: "Glue up the board", description: "Spread food-safe wood glue (Type II) along the mating edges, clamp the pieces flat with the faces flush, and let it cure overnight. No screws or nails: metal dulls knives and traps food.", partsUsed: [] },
    { step: 0, title: "Flatten and sand", description: "Scrape off the squeeze-out, plane or sand both faces flat, ease every edge, and sand to 220 grit.", partsUsed: [] },
    { step: 0, title: "Finish with a food-safe oil", description: "Wipe on food-grade mineral oil or board butter, let it soak in, wipe off the excess, and repeat until it stops soaking in. No varnish or stain on a food surface.", partsUsed: [] },
  ].map((s, i) => ({ ...s, step: i + 1 }));
  const bom = plan.bom.filter((b) => !/screw|nail|bracket|backer|glide|\bfeet\b|\bfoot\b|stain|varnish|polyurethane|sealer/i.test(b.name));
  if (!bom.some((b) => /mineral oil|board butter/i.test(b.name))) bom.push({ name: "Food-safe mineral oil", quantity: 1, unit: "bottle", searchQuery: "food grade mineral oil cutting board", estimatedCost: 8.98 });
  const glue = bom.find((b) => b.catalogId === "glue");
  if (glue) Object.assign(glue, { name: "Wood glue (food-safe, Type II)", searchQuery: "titebond II wood glue" });
  return { ...plan, instructions: steps, bom };
}

export function buildPlan(project: YardProject): BuildPlan {
  // C12: the last pass: every store search a Buy row links to says that row's Buy name.
  return storeTermsFromBuy(withPartIds(project, wholeItemsUncut(project, buildPlanOuter(project))));
}

/**
 * Spec 008 (I20): a purchased-item build's whole pieces (clip, marble, dowel used as bought) are bought, not cut:
 * their cut-list rows are marked whole and carry the piece's real size from the unit table (they read as blank
 * 0" sizes before, because a 1/32" wire rounded to 0). Real cuts (bracelet cord) are untouched.
 */
function wholeItemsUncut(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!isUnitItem(project)) return plan;
  const marked: BuildPlan = {
    ...plan,
    cutList: plan.cutList.map((c) => {
      const u = unitSizeById(c.id.split("|")[0]);
      if (!u || /kerf|cut from/i.test(plan.bom.find((b) => b.name === c.material)?.notes ?? "")) return c;
      const d = u.dims;
      const len = d.length ?? d.diameter ?? c.lengthIn;
      const wid = d.width ?? d.diameter ?? c.widthIn;
      const thk = d.thickness ?? d.diameter ?? c.thicknessIn;
      return { ...c, whole: true, lengthIn: len, widthIn: wid, thicknessIn: thk };
    }),
  };
  // C11: a whole piece carries no cut letter in the steps ("One A 8" cable tie" → "One 8" cable tie").
  const talk = (t: string) => unletterWhole(t, marked.cutList);
  return {
    ...marked,
    instructions: marked.instructions.map((s) => ({ ...s, title: talk(s.title), description: talk(s.description), tips: s.tips ? talk(s.tips) : s.tips })),
  };
}

function buildPlanOuter(project: YardProject): BuildPlan {
  if (!project.displayOnly && FOOD.test(`${project.prompt ?? ""} ${project.name}`)) {
    // Hardwood unless a species was typed: the board is planned under that species' stock.
    const prompt = HARDWOOD.test(project.prompt ?? "") ? project.prompt : `maple ${project.prompt ?? project.name}`;
    return buildPlanBody({ ...project, prompt, panels: project.panels.filter((p) => !/\b(?:foot|feet|glides?)\b/i.test(p.name)) }, foodContact);
  }
  return buildPlanBody(project);
}

/**
 * F4/I3: a Buy line's pack words name the pack the cart actually sells ("1 pack of 1000 (837 sticks used)"),
 * never the catalog's default pack when the best listing is a different count.
 */
export function packWordsFromCart(bom: BuildPlan["bom"]): BuildPlan["bom"] {
  return bom.map((b) => {
    const best = (b.offers ?? []).find((o) => o.best);
    const m = b.unit.match(/^(packs?) of (\d+)(.*)$/);
    if (!best || !m || !best.packQty || best.packQty <= 1 || !best.packsNeeded || Number(m[2]) === best.packQty) return b;
    const n = best.packsNeeded;
    return { ...b, quantity: n, unit: `${n === 1 ? "pack" : "packs"} of ${best.packQty}${m[3]}` };
  });
}

function buildPlanBody(project: YardProject, shape: (p: YardProject, plan: BuildPlan) => BuildPlan = (_p, plan) => plan): BuildPlan {
  // A lookup-fallback block is display-only: no cut list, Buy, price or steps, only a plain note.
  if (project.displayOnly) {
    return { feasibility: { status: "warnings", summary: `Yard couldn't learn this yet: the ${project.name.toLowerCase()} is shown as a rough block only.`, issues: [] }, cutList: [], bom: [], instructions: [], totals: { pieces: 0, estCostUsd: 0, packs: 0 }, generatedAt: new Date().toISOString(), sheetNest: null };
  }
  // F12: every part is installed by one build step (I18), after every pass that writes steps.
  const plan0 = ownEveryPart(project, shape(project, fallbackStepOne(project, buildPlanInner(project))));
  // Hardware parts (hinges, catches) are bought by count.
  const hw = new Map<string, number>();
  // A mirror panel is the sized glass line, not a second hardware row.
  for (const p of project.panels) if (p.materialId === "hardware" && p.type !== "mirror") { const k = p.name.replace(/ \d+$/, "").replace(/^(?:Left|Right|Front|Back|Top|Bottom|Upper|Lower)\s+/i, ""); hw.set(k, (hw.get(k) ?? 0) + 1); }
  // C13/C14: casters and screw eyes are bought as the real items (a typed "rolling", a hung feeder or birdhouse).
  const named = (name: string, n: number): BuildPlan["bom"] => {
    // C15: each is a checked store listing with its link (checkedStock.ts), and the screws the caster step names are bought too.
    if (name === "Caster") return [
      checkedRow(HARDWARE.caster, n, "One under each corner, the locking pair at the front."),
      checkedRow(HARDWARE.casterScrew, n * 4, `Four through each caster plate (${n * 4} screws).`),
    ];
    if (name === "Screw eye") return [
      checkedRow(HARDWARE.screwEye, n, "Twisted into pilot holes in the top; the chain hooks through them."),
      checkedRow(HARDWARE.chain, 3, "3 ft, cut at the store: from the screw eyes to a branch or hook.", "ft"),
    ];
    if (name === "Lid hinge") return [
      { name: '3" stainless butt hinges', quantity: n, unit: "each", searchQuery: '3" stainless butt hinges', estimatedCost: Math.round(n * 5.98 * 100) / 100, notes: "Along the back edge of the lid, into the back boards; stainless so they never rust outdoors." },
      { name: "Lid stay / lid support", quantity: 1, unit: "each", searchQuery: "Lid stay / lid support", estimatedCost: 9.98, notes: "Holds the lid open and keeps it from slamming." },
    ];
    return [];
  };
  const plan = withSaidHardware(project, { ...plan0, bom: [...plan0.bom, ...[...hw].flatMap(([name, n]) => named(name, n)), ...[...hw].filter(([name]) => !named(name, 1).length).map(([name, n]) => ({ name: `${name.replace(/^\w/, (c) => c.toUpperCase())}${n > 1 ? "s" : ""}`, quantity: n, unit: "pcs", searchQuery: `${name} hardware`, estimatedCost: Math.round(n * 3.49 * 100) / 100 }) as BuildPlan["bom"][number])] });
  // Buy lists glue only when a step or the notes glue.
  const glues = [...plan.instructions.map((s) => `${s.title} ${s.description}`), ...(project.notes ?? [])].some((t) => /\bglue/i.test(t));
  const bom0 = glues ? plan.bom : plan.bom.filter((b) => !/\bglue\b/i.test(b.name));
  // One Buy line per stock: lines with the same name and stock merge into one count.
  const bom: BuildPlan["bom"] = [];
  for (const b of bom0) {
    const same = bom.find((x) => x.name === b.name && x.catalogId === b.catalogId && PIECE_UNIT.test(x.unit) === PIECE_UNIT.test(b.unit));
    if (!same) { bom.push(b); continue; }
    same.quantity += b.quantity;
    if (PIECE_UNIT.test(same.unit)) same.unit = "boards";
    if (same.estimatedCost != null || b.estimatedCost != null) same.estimatedCost = (same.estimatedCost ?? 0) + (b.estimatedCost ?? 0);
    same.notes = [same.notes, b.notes].filter(Boolean).join(" ");
  }
  // The header total is the Buy list: the sum of its rows, never a separate estimate.
  const out = stepTextForPlace(project, withTypedFinish(project, buyComplete(project, smallestSheetStock({ ...plan, bom: dedupeBuy(bom) }))));
  const sum = Math.round(out.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
  // The summary line (and the Check card that reads it) prices from the same Buy total.
  const summary = out.feasibility.summary.replace(/~\$[\d,]+(?:\.\d+)?/, `~$${sum >= 100 ? sum.toFixed(0) : sum.toFixed(2)}`);
  // C3: whole purchased pieces have no cut list to restate as a cut step.
  const fin = { ...out, bom: packWordsFromCart(out.bom), feasibility: { ...out.feasibility, summary }, totals: { ...out.totals, estCostUsd: sum } };
  return isUnitItem(project) ? fin : cutStepFromList(fin);
}

/**
 * The cut step cuts the cut list. When its counted pieces differ from the list (spliced halves, layers counted
 * from the model instead of the list), its pieces are rewritten from the cut list, grouped by stock.
 */
export function cutStepFromList(plan: BuildPlan): BuildPlan {
  const n = cutStepCount(plan);
  const total = plan.cutList.reduce((t, c) => t + c.quantity, 0);
  if (n == null || n === total || !plan.cutList.length) return plan;
  const at = plan.instructions.findIndex((s) => /^Cut the\b/.test(s.title));
  const st = plan.instructions[at];
  // Only the piece sentences are rewritten: every other sentence (how to cut, an arc or bevel) stays where it was.
  const sentences = st.description.split(/(?<=[.:])\s+(?=From the |\d+ [A-Za-z]|[A-Z])/);
  const isPiece = (t: string) => /^(?:From the [^:]+:\s*)?\d+ [A-Za-z][^."]*?\d[^."]*"\.?$/.test(t) || /^From the [^:]+:$/.test(t);
  const firstPiece = sentences.findIndex(isPiece);
  const lead = sentences.slice(0, Math.max(0, firstPiece)).join(" ");
  const tail = sentences.slice(Math.max(0, firstPiece)).filter((t) => !isPiece(t)).join(" ");
  const mats = [...new Set(plan.cutList.map((c) => c.material))];
  const piece = (c: BuildPlan["cutList"][number]) =>
    `${c.quantity} ${c.label ? c.label + " " : ""}${c.name} ${inchFrac(c.lengthIn)} × ${inchFrac(c.widthIn)} × ${inchFrac(c.thicknessIn)}".`;
  const body = mats.map((m) => `${mats.length > 1 ? `From the ${m}: ` : ""}${plan.cutList.filter((c) => c.material === m).map(piece).join(" ")}`).join(" ");
  const title = `Cut the ${mats.join(" and ")}`;
  const instructions = plan.instructions.map((s, i) => (i === at ? { ...s, title, description: [lead, body, tail].filter(Boolean).join(" ") } : s));
  return { ...plan, instructions };
}

/**
 * Small parts buy the smallest real sheet that yields them: when every part cut from a full sheet nests on
 * one smaller sheet of the same thickness, Buy lists that sheet instead.
 */
function smallestSheetStock(plan: BuildPlan): BuildPlan {
  let changed = false;
  const swapped = new Map<string, string>();
  const bom = plan.bom.map((b) => {
    const item = b.catalogId ? getCatalogItem(b.catalogId) : undefined;
    // Only a full 4×8 (or larger) sheet steps down; cut-to-size goods (glazing, mats) are already small.
    if (!item || item.formFactor !== "sheet" || b.quantity !== 1 || (item.dims.length ?? 0) * (item.dims.width ?? 0) < 96 * 48) return b;
    // An exterior sheet never steps down to an interior panel: the smaller panels are interior plywood.
    if (/\bexterior\b|pressure-treated/i.test(b.name)) return b;
    const parts = plan.cutList.filter((c) => c.id.split("|")[0] === item.id);
    if (!parts.length) return b;
    const rects: [number, number][] = parts.flatMap((c) =>
      Array.from({ length: c.quantity }, () => [Math.max(c.lengthIn, c.widthIn ?? 0), Math.min(c.lengthIn, c.widthIn ?? 0)] as [number, number]),
    );
    const smaller = Object.values(CATALOG_BY_ID).filter(
      (s) =>
        s.formFactor === "sheet" &&
        s.id !== item.id &&
        s.category === item.category &&
        s.dims.thickness === item.dims.thickness &&
        (s.dims.length ?? 96) * (s.dims.width ?? 48) < (item.dims.length ?? 96) * (item.dims.width ?? 48) &&
        s.unitCostUsd != null &&
        // Every part must fit the smaller sheet whole: a 102" upright never steps down to a 4×8.
        rects.every(([a, b]) => a <= (s.dims.length ?? 96) && b <= (s.dims.width ?? 48)) &&
        nestSheets(rects, s.dims.length ?? 96, s.dims.width ?? 48) === 1,
    ).sort((a, c) => (a.unitCostUsd ?? 0) - (c.unitCostUsd ?? 0))[0];
    if (!smaller) return b;
    changed = true;
    swapped.set(item.id, smaller.name);
    const size = `${(smaller.dims.width ?? 24) / 12}×${(smaller.dims.length ?? 48) / 12} ft`;
    return {
      ...b,
      name: smaller.name,
      catalogId: smaller.id,
      searchQuery: smaller.searchQuery ?? b.searchQuery,
      estimatedCost: smaller.unitCostUsd,
      offers: undefined,
      notes: `Every part fits one ${size} panel, so you buy the panel, not a full ${(item.dims.width ?? 48) / 12}×${(item.dims.length ?? 96) / 12} sheet.`,
    };
  });
  if (!changed) return plan;
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const cutList = plan.cutList.map((c) => (swapped.has(c.id.split("|")[0]) ? { ...c, material: swapped.get(c.id.split("|")[0])! } : c));
  return { ...plan, bom, cutList, totals: { ...plan.totals, estCostUsd: cost } };
}

/** A noun built as a simple primitive says so in step 1. */
function fallbackStepOne(project: YardProject, plan: BuildPlan): BuildPlan {
  const note = (project.notes ?? []).find((n) => n.startsWith("Yard built a"));
  if (!note || !plan.instructions.length || (plan.instructions[0].description ?? "").includes(note)) return plan;
  const instructions = plan.instructions.map((s, i) => (i === 0 ? { ...s, description: `${note} ${s.description ?? ""}`.trim() } : s));
  return { ...plan, instructions };
}

/** One Buy line per piece of hardware: a kind and the generic name a recipe part leaves behind ("Hinge", "Fold bracket"). */
const BUY_KINDS: [RegExp, RegExp][] = [
  [/\bhinges?\b/i, /^hinges?$/i],
  [/\blatch(?:es)?\b/i, /^latch(?:es)?$/i],
  [/\bhooks?\b/i, /^(?:coat )?hooks?$/i],
  [/canvas|drop cloth/i, /^canvas(?: cover)?$/i],
  [/lift mechanism|^fold bracket/i, /^fold brackets?$/i],
  [/\bstay\b|lid support/i, /^(?:lid )?stays?$/i],
];

/**
 * Buy merges duplicates once, at the end: two lines with the same name are one line (the larger count), and a
 * generic line a recipe part leaves ("Hinge", "Latch", "Canvas cover", "Fold bracket") folds into the specific
 * line of its kind (Piano hinge, Gate latch, Canvas drop cloth, the Murphy lift kit).
 */
export function dedupeBuy(bom: BuildPlan["bom"]): BuildPlan["bom"] {
  const out: BuildPlan["bom"] = [];
  for (const b of bom) {
    const same = out.findIndex((o) => o.name.toLowerCase() === b.name.toLowerCase());
    if (same >= 0) { if (b.quantity > out[same].quantity) out[same] = b; continue; }
    const kind = BUY_KINDS.find(([k]) => k.test(b.name));
    const specific = (x: { name: string }) => kind && kind[0].test(x.name) && !kind[1].test(x.name.trim());
    if (kind && kind[1].test(b.name.trim()) && bom.some((o) => o !== b && specific(o))) continue;
    out.push(b);
  }
  return out;
}

/** Buy lines that duplicate another of the same kind (the gate check for dedupeBuy). */
export function duplicateBuyLines(bom: BuildPlan["bom"]): string[] {
  const names = bom.map((b) => b.name.toLowerCase());
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  for (const [k, generic] of BUY_KINDS) {
    const lines = bom.filter((b) => k.test(b.name));
    if (lines.length > 1 && lines.some((b) => generic.test(b.name.trim()))) dup.push(lines.map((b) => b.name).join(" / "));
  }
  return dup;
}

function buildPlanInner(project: YardProject): BuildPlan {
  const built = featureBayWording(project, stepsUseFaceScrew(project, applyShopJoin(project, fractionPlanText(buyReadsModel(boardStockWording(project, withOutdoorPackage(project, withPlacementTalk(project, buildPlanCore(project)))))))));
  const plan = withAccessorySheetCuts(project, stepsInstallWallAnchors(project, stepsAccountForScrews(stepsStateJointScrews(project, stepsDriveJointScrews(project, { ...built, bom: hardwareFromNotes(project, built.bom) })))));
  const extra = spaceCutStep(project);
  if (!extra) return positivePlan(spliceStep(plan));
  const step = plan.instructions.length + 1;
  return positivePlan(spliceStep({ ...plan, instructions: [...plan.instructions, { step, title: extra.title, description: extra.description }] }));
}

/** Pieces the "Cut the …" step tells you to cut ("4 Posts …", "16 Rafter layers …"), or null with no such step. */
export function cutStepCount(plan: BuildPlan): number | null {
  const st = plan.instructions.find((s) => /^Cut the\b/.test(s.title));
  if (!st) return null;
  return [...st.description.matchAll(/(?:^|[:.]\s)(\d+) [A-Za-z][^."]*?\d[^."]*"/g)].reduce((n, m) => n + Number(m[1]), 0);
}

/** Overlap of a half-lap splice: Buy adds it per joint, the splice step cuts it. */
const SPLICE_LAP = 12;

/** The shortest catalogue board of the same section that is at least `len` long. */
export function longerLumber(item: CatalogItem, len: number): CatalogItem | undefined {
  return FORGE_CATALOG.filter((c) => c.category === "lumber" && c.dims.width === item.dims.width && c.dims.height === item.dims.height && (c.dims.length ?? 0) >= len - 0.01)
    .sort((x, y) => (x.dims.length ?? 0) - (y.dims.length ?? 0))[0];
}

/** Cut rows longer than the board they are bought as (no longer board in the catalogue): they are spliced. */
export function overlongCuts(plan: BuildPlan): BuildPlan["cutList"] {
  return plan.cutList.filter((c) => {
    const it = getCatalogItem((c.id ?? "").split("|")[0]);
    return !c.whole && it?.category === "lumber" && !!it.dims.length && c.lengthIn > it.dims.length + 0.01;
  });
}

/** A member longer than any board sold gets a splice step after the cuts. */
function spliceStep(plan: BuildPlan): BuildPlan {
  const long = overlongCuts(plan);
  if (!long.length) return plan;
  const what = long.map((c) => `${c.quantity} × ${inchFrac(c.lengthIn)}" ${c.name.toLowerCase()}${/Glue up/.test(c.notes ?? "") ? " layers" : ""}`).join(", ");
  const at = Math.max(0, plan.instructions.findIndex((s) => /^Cut\b/.test(s.title))) + 1;
  const step: AssemblyStep = {
    step: 0,
    title: "Splice the long members",
    description: `No board in the catalogue is long enough for the ${what}. Make each from two boards joined with a half-lap splice: cut a ${SPLICE_LAP}" half-lap on the mating ends, glue, and through-bolt or screw it, with the joint over a post or support. Never splice mid-span.`,
  };
  // Buy says the same: those boards are joined end to end, the count already covers the overlap.
  const ids = new Set(long.map((c) => (c.id ?? "").split("|")[0]));
  const bom = plan.bom.map((b) => (b.catalogId && ids.has(b.catalogId) ? { ...b, notes: `${b.notes ?? ""} Parts longer than this board are spliced from two boards (half-lap over a support, see the splice step).`.trim() } : b));
  const instructions = [...plan.instructions.slice(0, at), step, ...plan.instructions.slice(at)].map((s, i) => ({ ...s, step: i + 1 }));
  return { ...plan, instructions, bom };
}

/**
 * Buy reads the same model as the cut list:
 * - "Cut to" lengths are the cut-list rows for that stock (one rounding place, the cut list's).
 * - A named species board is priced as that species (oak ≠ walnut ≠ pine).
 * - The plan total is the sum of the Buy lines.
 */
export function buyReadsModel(plan: BuildPlan): BuildPlan {
  const lengthsByStock = new Map<string, number[]>();
  for (const c of plan.cutList) {
    if (c.whole) continue;
    const stock = (c.id ?? "").split("|")[0];
    if (!stock || !(c.lengthIn > 0)) continue;
    const list = lengthsByStock.get(stock) ?? [];
    list.push(Math.round(c.lengthIn * 16) / 16);
    lengthsByStock.set(stock, list);
  }
  let changed = false;
  const bom = plan.bom.map((b) => {
    let line = b;
    const lengths = b.catalogId ? lengthsByStock.get(b.catalogId) : undefined;
    if (lengths?.length && b.notes && /Cut to: /.test(b.notes)) {
      const list = [...new Set(lengths)].sort((x, y) => y - x).map((n) => `${inchFrac(n)}"`).join(", ");
      const notes = b.notes.replace(/Cut to: (?:(?! · ).)*/, `Cut to: ${list}`);
      if (notes !== b.notes) line = { ...line, notes };
    }
    const species = speciesOfBoardLabel(line.name);
    const catalog = line.catalogId ? getCatalogItem(line.catalogId) : undefined;
    const sold = catalog?.unitCostUsd != null && catalog.unitCostUsd > 0;
    // Species price is per 1×4; a wider named board (Cedar 1×6) scales by its real face and keeps its size in the search.
    const face = catalog?.dims.width ?? 3.5;
    const thick = catalog?.dims.height ?? 0.75;
    const size = line.name.match(/([1-4])\s*[×x]\s*(\d+)/)?.slice(1).join("x") ?? "1x4";
    const piece = thick >= 3 ? "post" : "board";
    const per1x4 = sold && species && species.id !== "pine" ? speciesBoardUsd(species) : null;
    const each = per1x4 != null ? Math.round(per1x4 * ((face * thick) / (3.5 * 0.75)) * 100) / 100 : null;
    if (each != null && line.quantity > 0) {
      const total = Math.round(each * line.quantity * 100) / 100;
      const query = `${species!.display} ${size} ${piece} 8 ft`;
      line = { ...line, estimatedCost: total, searchQuery: query, offers: estimateOffers(query, line.quantity, total) };
      changed = true;
    } else if (species && species.id !== "pine" && catalog?.category === "lumber") {
      // Unpriced row (no fake price): the search still names the species and size that was typed.
      line = { ...line, searchQuery: `${species.display} ${size} ${piece} 8 ft` };
    }
    return line;
  });
  if (!changed) return { ...plan, bom };
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const was = plan.totals.estCostUsd;
  const money = (n: number) => `~$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;
  const summary = plan.feasibility.summary.replace(/~\$[\d,]+(?:\.\d+)?/, () => money(cost));
  return {
    ...plan,
    bom,
    totals: { ...plan.totals, estCostUsd: cost },
    feasibility: { ...plan.feasibility, summary: Math.abs(cost - was) > 0.005 ? summary : plan.feasibility.summary },
  };
}

/** Every plan string a stranger reads goes through the shared shop-fraction formatter. */
function fractionPlanText(plan: BuildPlan): BuildPlan {
  return {
    ...plan,
    instructions: plan.instructions.map((st) => ({
      ...st,
      title: fractionizeInches(st.title),
      description: fractionizeInches(st.description),
      tips: fractionizeInches(st.tips),
    })),
    cutList: plan.cutList.map((c) => (c.notes ? { ...c, notes: fractionizeInches(c.notes) } : c)),
    bom: plan.bom.map((b) => ({ ...b, notes: fractionizeInches(b.notes) })),
  };
}

/**
 * Named solid-wood builds have no ¾" sheet: steps, tips and Buy notes speak about the
 * real boards (wood splits, edges get eased) — never sheet-only ply / nest / banding talk.
 */
function boardStockWording(project: YardProject, plan: BuildPlan): BuildPlan {
  const item = getCatalogItem(project.primaryMaterialId);
  const board = !!item && item.category === "lumber" && item.formFactor === "board";
  if (
    !board ||
    !project.panels.length ||
    project.panels.some((p) => /^plywood-3-4/i.test(p.materialId ?? ""))
  ) {
    return plan;
  }
  const label = namedStockDisplayName(project.prompt ?? "", item);
  const fix = (t?: string) =>
    t
      ?.replace(/\bthe ply does not split/g, "the wood does not split")
      .replace(/\bthe ply d(?:oes)? not split/g, "the wood does not split")
      .replace(/Iron-on edge banding on the top edge if people will see ply\.?/g, "Ease the edges with sandpaper.")
      .replace(/Iron-on edge banding \(thin veneer strip that covers the raw plywood edge\) on the (?:edges people will see|front if people will see it)\./g, "Ease the edges people will see with sandpaper.")
      .replace(/edge-band the plywood edge people see \(thin veneer strip over the raw edge\)(?: if the carcase is ply)?/g, "ease the front edges with sandpaper")
      .replace(/Cut it from the same ¾" plywood/g, `Cut it from the same ${label} boards`)
      .replace(/Aprons nest on the 3\/4" sheet\.\s*/g, "")
      .replace(/ — not nested on the 3\/4" sheets\./g, ` — the only sheet good here; every ¾" part is ${label}.`);
  return {
    ...plan,
    instructions: plan.instructions.map((st) => ({ ...st, title: fix(st.title) ?? st.title, description: fix(st.description) ?? st.description, tips: fix(st.tips) })),
    bom: plan.bom.map((b) => ({ ...b, notes: fix(b.notes) })),
  };
}

function buildPlanCore(project: YardProject): BuildPlan {
  if (project.kind === "opening" && project.windowPkg) {
    const cutList = stampLabels(windowCuts(project));
    const bom = decorateBom(windowBom(project));
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const issues = windowIssues(project);
    const pieces = cutList.reduce((s, c) => s + c.quantity, 0);
    return packPlan(
      project,
      issues,
      `${pieces} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, 0)} · ~$${cost.toFixed(0)}`,
      cutList,
      bom,
      windowSteps(project),
      pieces,
      cost,
    );
  }

  // Plates → cut list. A closet rebuilt in sticks (no plates) uses the stick plan below; a stick build whose
  // only sheet part is a chipboard backer stays a stick plan too (backer on Buy).
  const stickWithBacker = project.instances.length > 0 && project.panels.length > 0 && project.panels.every(isStickAccessorySheet);
  if (project.panels.length > 0 && !stickWithBacker) {
    const cutList = closetCuts(project);
    const sheetNest = planSheetNest(cutList);
    const bom = closetBom(project, cutList, sheetNest);
    const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    const issues: FeasibilityIssue[] = [
      {
        severity: "info",
        message: `${project.name} — ${
          /headboard/i.test(project.name) || /headboard/.test((project.prompt ?? "").toLowerCase())
            ? "headboard"
            : isPlatformBed((project.prompt ?? "").toLowerCase()) || /platform\s*bed/i.test(project.name)
              ? "platform bed"
            : /\bbunk\b/i.test(project.name) || /\bbunk\b/.test((project.prompt ?? "").toLowerCase())
              ? "bunk bed"
            : isBedsideShelf((project.prompt ?? "").toLowerCase()) || /^Bedside shelf/i.test(project.name)
              ? "bedside shelf"
            : isCoatHookBoard((project.prompt ?? "").toLowerCase()) || /Coat hook board/i.test(project.name)
              ? "coat hook board"
            : /coat/i.test(project.name)
              ? "coat rack"
              : /crate/i.test(project.name) || /crate/.test((project.prompt ?? "").toLowerCase())
                ? "crate"
              : isIroningWallMount((project.prompt ?? "").toLowerCase()) || /Ironing board wall mount/i.test(project.name)
                ? "ironing board wall mount"
              : /ironing/i.test(project.name) || /ironing/.test((project.prompt ?? "").toLowerCase())
                ? "ironing cabinet"
              : /medicine/i.test(project.name) || /medicine/.test((project.prompt ?? "").toLowerCase())
                ? "medicine cabinet"
              : /wine/i.test(project.name) ||
                  (/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()))
                ? "wine rack"
              : /spice/i.test(project.name) ||
                  (/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase()))
                ? "spice rack"
              : /nightstand/i.test(project.name) ||
                  /nightstand/.test((project.prompt ?? "").toLowerCase()) ||
                  (/bedside/.test((project.prompt ?? "").toLowerCase()) &&
                    !isBedsideShelf((project.prompt ?? "").toLowerCase()) &&
                    !/^Bedside shelf/i.test(project.name))
                ? "nightstand"
              : /island/i.test(project.name) || /island/.test((project.prompt ?? "").toLowerCase())
                ? "kitchen island"
              : /prep\s*table/i.test(project.name) || /prep\s*table/.test((project.prompt ?? "").toLowerCase())
                ? "prep table"
              : isDiningTable((project.prompt ?? "").toLowerCase()) || /Dining table/i.test(project.name)
                ? "dining table"
              : isServingCart((project.prompt ?? "").toLowerCase()) || /Serving cart/i.test(project.name)
                ? "serving cart"
              : isSlotRack((project.prompt ?? "").toLowerCase()) || /Plate rack|Magazine rack|Dish rack/i.test(project.name)
                ? (isPlateRack((project.prompt ?? "").toLowerCase()) || /Plate rack/i.test(project.name) ? "plate rack" : "slot rack")
              : /butcher|kitchen cart/i.test(project.name) ||
                  isButcherCart((project.prompt ?? "").toLowerCase()) ||
                  /butcher/.test((project.prompt ?? "").toLowerCase())
                ? (/butcher/.test((project.prompt ?? "").toLowerCase()) || /Butcher/i.test(project.name)
                    ? "butcher block cart"
                    : "kitchen cart")
              : /open(?:\s+kitchen)?\s+shelving/i.test(project.name) ||
                  /open\s+kitchen\s+shelving|open\s+shelving|shelving\s+niche/.test(
                    (project.prompt ?? "").toLowerCase(),
                  )
                ? "open shelving"
              : isPottingBench((project.prompt ?? "").toLowerCase()) || /Potting bench/i.test(project.name)
                ? "potting bench"
              : isPlanterBox((project.prompt ?? "").toLowerCase()) || /Planter box/i.test(project.name)
                ? "planter box"
              : isPorchSwingFrame((project.prompt ?? "").toLowerCase()) || /Porch swing frame/i.test(project.name)
                ? "porch swing frame"
              : isOutdoorSideTable((project.prompt ?? "").toLowerCase()) || /Outdoor side table/i.test(project.name)
                ? "outdoor side table"
              : isWorkbench((project.prompt ?? "").toLowerCase()) || /Workbench/i.test(project.name)
                ? "workbench"
              : isPegboard((project.prompt ?? "").toLowerCase()) || /Pegboard/i.test(project.name)
                ? "pegboard"
              : isToolRail((project.prompt ?? "").toLowerCase()) || /Tool rail/i.test(project.name)
                ? "tool rail"
              : isLeashRail((project.prompt ?? "").toLowerCase()) || /Leash rail/i.test(project.name)
                ? "leash rail"
              : isPegRail((project.prompt ?? "").toLowerCase()) || /Peg rail/i.test(project.name)
                ? "peg rail"
              : isKeyMailShelf((project.prompt ?? "").toLowerCase()) || /Key and mail shelf/i.test(project.name)
                ? "key and mail shelf"
              : isLumberRack((project.prompt ?? "").toLowerCase()) || /Lumber rack/i.test(project.name)
                ? "lumber rack"
              : isFoldingTable((project.prompt ?? "").toLowerCase()) || /Folding table/i.test(project.name)
                ? "folding table"
              : isLaundrySorter((project.prompt ?? "").toLowerCase()) || /Laundry sorter/i.test(project.name)
                ? "laundry sorter"
              : isDryingRack((project.prompt ?? "").toLowerCase()) || /Drying rack/i.test(project.name)
                ? "drying rack"
              : isUtilityShelf((project.prompt ?? "").toLowerCase()) || /Utility shelf/i.test(project.name)
                ? "utility shelf"
              : isIroningWallMount((project.prompt ?? "").toLowerCase()) || /Ironing board wall mount/i.test(project.name)
                ? "ironing board wall mount"
              : isBootTrayBench((project.prompt ?? "").toLowerCase()) || /Boot tray bench/i.test(project.name)
                ? "Boot tray"
              : isToyChest((project.prompt ?? "").toLowerCase()) || /Toy chest/i.test(project.name)
                ? "toy chest"
              : isHingedLidChest((project.prompt ?? "").toLowerCase()) ||
                  isLiftOffLidPrompt((project.prompt ?? "").toLowerCase()) ||
                  (/\bChest\b/i.test(project.name) &&
                    project.panels.some((p) => /^Lid$/i.test(p.name) || /^Lift-off lid$/i.test(p.name)))
                ? "chest"
              : /Mudroom bench/i.test(project.name) ||
                  (/mudroom/.test((project.prompt ?? "").toLowerCase()) && /\bbench\b/.test((project.prompt ?? "").toLowerCase()))
                ? "mudroom bench"
              : /Window seat/i.test(project.name) || /window seat/.test((project.prompt ?? "").toLowerCase())
                ? "window seat"
              : /Coat bench/i.test(project.name) ||
                  (/coat/.test((project.prompt ?? "").toLowerCase()) && /\bbench\b/.test((project.prompt ?? "").toLowerCase()))
                ? "coat bench"
              : isRockingChair((project.prompt ?? "").toLowerCase()) || /Rocking chair/i.test(project.name)
                ? "Rocking chair"
              : isLoungeChair((project.prompt ?? "").toLowerCase()) || /Lounge chair/i.test(project.name)
                ? "Lounge chair"
              : isOttoman((project.prompt ?? "").toLowerCase()) || /^Ottoman\b/i.test(project.name)
                ? "Ottoman"
              : (() => {
                  const lower = (project.prompt ?? "").toLowerCase();
                  if (isSeatingLoungeClass(lower)) {
                    return identityTitleStem(lower) || identityTitleStem((project.name ?? "").toLowerCase()) || "Lounge chair";
                  }
                  const sit = sitBenchTitleStem(lower);
                  if (sit) return sit.replace(/ bench$/i, "").trim() || sit;
                  if ((project.fitted?.program ?? "") === "bench") return "seat";
                  // Only a closet is called a closet: a recipe object names itself, anything else is freestanding.
                  return project.fitted?.program ?? (project.id.startsWith("recipe-") ? (/^Unverified:/.test(project.notes?.[0] ?? "") ? "learned, not yet verified" : "built from its recipe") : project.kind === "closet" ? "closet" : "freestanding build");
                })()
        }.`,
        suggestion: measureRefitTalk({
          width: project.overall.width,
          height: project.overall.height,
          depth: project.overall.depth,
          shape: project.fitted?.unit?.shape,
          prompt: project.prompt,
          name: project.name,
          pocket: Boolean(project.pocket),
        }).checkSuggestion,
      },
      ...closetIssues(project),
      ...loadIssues(project),
    ];
    const pieces = cutList.reduce((s, c) => s + c.quantity, 0);
    const plan = honestPlan(
      project,
      packPlan(
        project,
        issues,
        `${pieces} pieces · ${cutList.length} size${cutList.length === 1 ? "" : "s"} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(0)}`,
        cutList,
        bom,
        uniqueSteps(project),
        pieces,
        cost,
      ),
    );
    // The sheets Buy counted ride on the plan: the layout and PDF draw exactly these.
    return { ...plan, sheetNest };
  }

  const item = getCatalogItem(project.primaryMaterialId);
  const pieces = project.instances.length;
  const forge = buildForgeBom(project.instances, project.primaryMaterialId);
  const glue = item ? binderBom(item, project.instances, project.joinMethod) : [];
  const spring = project.shape?.params?.rubberBands
    ? [{
        name: "Rubber bands",
        quantity: 1,
        unit: "pack",
        catalogId: "rubber-bands",
        searchQuery: "rubber bands assorted",
        estimatedCost: 5.99,
        notes: `${project.shape.params.rubberBands} bands: one hinges the arm on the axle, one is the spring from the arm over the crossbar.`,
      }]
    : [];
  const pivots = [...(project.shape?.params?.pivots ? [pivotLine(project.shape.params.pivots)] : []), ...templateAccessories(project)];
  const bom = decorateBom([
    ...bomLinesFromForge(forge),
    ...glue,
    ...spring,
    ...pivots,
  ]);
  const cost = bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  const whole = !!item && isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  const issues = loadIssues(project);
  if (pieces === 0) {
    return packPlan(
      project,
      [{ severity: "critical", message: "Empty structure", suggestion: "Generate a thing first." }],
      "Nothing on the bench yet.",
      [],
      [],
      [],
      0,
      0,
    );
  }
  return honestWeekendPlan(
    project,
    packPlan(
      project,
      issues,
      `${pieces} pieces of ${namedStockDisplayName(project.prompt ?? "", item)} · ${effortLabel(project, pieces)} · ~$${cost.toFixed(2)}`,
      [],
      bom,
      uniqueSteps(project),
      pieces,
      cost,
      whole ? "whole" : "cut",
    ),
  );
}

export function planToMarkdown(project: YardProject, plan: BuildPlan): string {
  return [
    `# ${project.name}`,
    plan.feasibility.summary,
    "",
    "## Cut list",
    ...plan.cutList.map((c) => `- ${c.label ?? ""} ${c.quantity}x ${c.name} ${c.lengthIn}" x ${c.widthIn}" x ${c.thicknessIn}"${c.material ? ` · ${c.material}` : ""}`),
    "",
    "## Buy",
    ...plan.bom.map((b) => `- ${b.quantity} ${b.unit} ${b.name}`),
    "",
    "## Build",
    ...plan.instructions.map((s) => `${s.step}. ${s.title} — ${s.description}`),
  ].join("\n");
}

/** Paper fasteners for a figure's pivot joints (shoulders, elbows, hips, knees). */
function pivotLine(n: number) {
  return {
    name: "Brass paper fasteners",
    quantity: 1,
    unit: "pack",
    catalogId: "paper-fasteners",
    searchQuery: "brass paper fasteners brads",
    estimatedCost: 6.49,
    notes: `${n} used: one through each shoulder, elbow, hip and knee overlap so the figure poses.`,
  };
}

/** Template accessories on Buy: a stick frame's chipboard backer / sawtooth hanger, a cat tree's sisal rope. */
function templateAccessories(project: YardProject) {
  const P = project.shape?.params;
  const out: { name: string; quantity: number; unit: string; catalogId: string; searchQuery: string; estimatedCost: number; notes: string }[] = [];
  if (project.shape?.classId === "platform-tower" && P?.sisal) {
    const circ = 4 * (P.post ?? 4) + 0.5;
    const ft = Math.ceil(((P.sisalLen ?? 0) / 0.375) * circ / 12);
    const packs = Math.max(1, Math.ceil(ft / 100));
    out.push({ name: "3/8\" sisal rope, 100 ft", quantity: packs, unit: packs === 1 ? "roll" : "rolls", catalogId: "sisal-rope", searchQuery: "3/8 inch sisal rope 100 ft", estimatedCost: 19.99 * packs, notes: `About ${ft} ft wraps ${Math.round(P.sisalLen ?? 0)}" of the scratching post, tight turns, stapled at both ends.` });
  }
  if (project.shape?.classId !== "flat-frame") return out;
  // Glazing asked for: glass or acrylic cut to the photo size, in front of the photo.
  const g = project.panels.find((p) => isFrameGlazing(p.name, p.type));
  if (g) {
    const gw = Math.round(g.size.width * 16) / 16, gh = Math.round(g.size.height * 16) / 16;
    const acrylic = g.materialId === "acrylic-sheet";
    out.push(
      acrylic
        ? { name: `Clear acrylic sheet ${sheetFor(gw, gh, ACRYLIC_SHEETS).name}`, quantity: 1, unit: "sheet", catalogId: "acrylic-sheet", searchQuery: `clear acrylic sheet ${sheetFor(gw, gh, ACRYLIC_SHEETS).query}`, estimatedCost: sheetFor(gw, gh, ACRYLIC_SHEETS).cost, notes: `Score and snap it to ${inchFrac(gw)}" × ${inchFrac(gh)}" (the photo size); it sits in front of the photo.` }
        : { name: `Picture-frame glass ${inchFrac(gw)}×${inchFrac(gh)}`, quantity: 1, unit: "pc", catalogId: "frame-glass", searchQuery: `${inchFrac(gw)}x${inchFrac(gh)} picture frame glass`, estimatedCost: 6.99, notes: `Cut to ${inchFrac(gw)}" × ${inchFrac(gh)}" (the photo size); a hardware store cuts glass, or buy replacement frame glass this size. It sits in front of the photo.` },
    );
  }
  if (P?.hanger && !project.instances.length) out.push({ name: "Sawtooth picture hanger", quantity: 1, unit: "pack", catalogId: "sawtooth-hanger", searchQuery: "sawtooth picture hangers", estimatedCost: 5.99, notes: "One hanger screwed to the top back." });
  if (!project.instances.length) return out;
  const b = project.panels.find((p) => p.materialId === "chipboard-sheet");
  if (P?.backer && b) {
    const bw = Math.round(b.size.width * 16) / 16, bh = Math.round(b.size.height * 16) / 16;
    const sheet = sheetFor(bw, bh, CHIPBOARD_SHEETS);
    out.push({ name: `Chipboard sheets ${sheet.name}`, quantity: 1, unit: "pack", catalogId: "chipboard-sheet", searchQuery: `chipboard sheets ${sheet.query}`, estimatedCost: sheet.cost, notes: `One sheet cut to ${inchFrac(bw)}" × ${inchFrac(bh)}" is the backer.` });
  }
  if (P?.hanger) out.push({ name: "Sawtooth picture hanger", quantity: 1, unit: "pack", catalogId: "sawtooth-hanger", searchQuery: "sawtooth picture hangers", estimatedCost: 5.99, notes: "One hanger glued or tacked to the top back." });
  return out;
}

type SheetSize = { w: number; h: number; cost: number };
const ACRYLIC_SHEETS: SheetSize[] = [{ w: 9, h: 12, cost: 9.99 }, { w: 11, h: 14, cost: 12.99 }, { w: 12, h: 24, cost: 18.99 }, { w: 18, h: 24, cost: 26.99 }, { w: 24, h: 36, cost: 44.99 }];
const CHIPBOARD_SHEETS: SheetSize[] = [{ w: 8.5, h: 11, cost: 8.99 }, { w: 11, h: 14, cost: 11.99 }, { w: 12, h: 18, cost: 13.99 }, { w: 18, h: 24, cost: 17.99 }, { w: 24, h: 36, cost: 24.99 }];

/** The smallest stock sheet the cut part fits on (either way round). */
function sheetFor(w: number, h: number, sizes: SheetSize[]): { name: string; query: string; cost: number } {
  const [a, b] = [w, h].sort((x, y) => x - y);
  const s = sizes.find((z) => a <= z.w + 1e-6 && b <= z.h + 1e-6) ?? sizes[sizes.length - 1];
  return { name: `${inchFrac(s.w)} × ${inchFrac(s.h)}`, query: `${inchFrac(s.w)} x ${inchFrac(s.h)}`, cost: s.cost };
}

/**
 * A stick build's sheet parts (frame glazing, chipboard backer) are cut too: they join the cut list as
 * their own lettered rows, cut from the sheet Buy lists, so the model, cut list and Buy all show them.
 */
function withAccessorySheetCuts(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!project.instances.length) return plan;
  const sheets = project.panels.filter(isStickAccessorySheet);
  if (!sheets.length || plan.cutList.some((c) => sheets.some((p) => c.name === p.name))) return plan;
  const rows: CutLine[] = sheets.map((p, i) => {
    const [a, b] = [p.size.width, p.size.height, p.size.depth].sort((x, y) => y - x);
    const t = Math.min(p.size.width, p.size.height, p.size.depth);
    const stock = p.materialId === "acrylic-sheet" ? "Clear acrylic sheet" : p.materialId === "frame-glass" ? "Picture-frame glass" : "Chipboard sheet";
    return {
      id: `${p.materialId}|${p.name}`,
      name: p.name,
      quantity: 1,
      lengthIn: Math.round(a * 16) / 16,
      widthIn: Math.round(b * 16) / 16,
      thicknessIn: Math.round(t * 16) / 16 || 1 / 16,
      material: stock,
      notes: `Cut from the ${stock.toLowerCase()} on the Buy list.`,
      label: letterLabel(plan.cutList.length + i),
    };
  });
  return { ...plan, cutList: [...plan.cutList, ...rows] };
}

/** A stock the engine picked because none was typed is said up front, in step 1. */
function firstStepSaysDefaultStock(steps: AssemblyStep[], notes: readonly string[] | null | undefined): AssemblyStep[] {
  const note = (notes ?? []).find((n) => n.startsWith("No material typed"));
  if (!note || !steps.length || steps[0].description.includes(note)) return steps;
  return [{ ...steps[0], description: `${steps[0].description.replace(/\s*$/, "")} ${note}` }, ...steps.slice(1)];
}
