import { featureBay } from "./heldObjects";
import { hookCount, SCREWS_PER_HOOK } from "./hookCount";
import { stepsDriveJointScrews, stepsStateJointScrews, BUY_JOINTS } from "./stepJointScrews";
import { getCatalogItem } from "./catalog";
import { fractionizeInches, inchFrac } from "./inchText";
import { positivePlan } from "./positiveWording";
import { usesHotGlue, hotGlueBom } from "./adhesive";
import { isWholeStock, panelWorldCorners, toPrimitive } from "./geometry";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { uniqueSteps } from "./uniqueSteps";
import { decorateBom, estimateOffers } from "./listings";
import { speciesBoardUsd, speciesOfBoardLabel } from "./speciesPrice";
import { binderBom, effectiveJoin, screwBoxUnit, SCREWS_PER_BOX } from "./joints";
import { applyShopJoin, stockThickness, faceScrewInches, stepsUseFaceScrew } from "./shopJoin";
import { spaceCutStep } from "./spaceCuts";
import { windowBom, windowCuts, windowIssues, windowSteps } from "./windows";
import { loadIssues, panelBomLines } from "./function";
import { slideInches } from "./stockLook";
import { cutListName, sheetCutDims, isBoundingDrawerPanel, explodeDrawerBoxCuts, isBuyMirrorPanel, isSquareLumberStick, isFrameGlazing, isStickAccessorySheet, isBoughtHardwareName } from "./shopPlural";
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
import type { AssemblyStep, BuildPlan, CutLine, FeasibilityIssue, Panel, YardProject } from "./types";
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
    let family = partFamily(name, type);
    const side = name.match(/^(Left|Right)\s+(.+)$/i);
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
    if (isPly && isSquareLumberStick(dims)) {
      family = "Leg";
      id = "lumber-2x2-8";
      matName = getCatalogItem(id)?.name ?? '2x2 (1-1/2" actual)';
    } else if (
      // Class pack: sheet goods thicker than stock are laminated plies (island/desk
      // 1½" counters), not a magic thick board the lumber aisle does not sell.
      (isPly || isSolidBoard) &&
      dims.thicknessIn > STOCK_T + 0.05 &&
      dims.thicknessIn <= 2.05 &&
      !/^leg$/i.test(family)
    ) {
      const plies = Math.max(2, Math.round(dims.thicknessIn / STOCK_T));
      dims = { lengthIn: dims.lengthIn, widthIn: dims.widthIn, thicknessIn: STOCK_T };
      qty = plies;
    }
    // 0.25" ply is ¼″ backer even when the envelope was stamped ¾″ (mirror, drawer bottoms).
    // Skip when square-stick remap already bound solid lumber.
    if ((/plywood/i.test(id ?? "") || id === CATALOG_LUMBER_BIND) && dims.thicknessIn <= 0.26) {
      id = "plywood-1-4-4x8";
      matName = getCatalogItem(id)?.name ?? '1/4" Plywood 4×8';
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
        addCut(p.materialId, part.name, part.type, part.width, part.height, part.depth, materialName);
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

/** After splice: name the sheet that actually fits the face. 102" stays whole on 4×10. */
function stampPlySheetSize(cuts: CutLine[]): CutLine[] {
  return cuts.map((c) => {
    if (!/ply/i.test(`${c.material ?? ""} ${c.name ?? ""}`)) return c;
    if (Math.min(c.lengthIn, c.widthIn) <= 2) return c;
    const id = plySheetCatalogId(c.lengthIn, c.widthIn, c.thicknessIn ?? 0.75);
    const name = getCatalogItem(id)?.name;
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
  const structural = cuts.filter(
    (c) => (c.thicknessIn ?? 0.75) >= 0.5 && (c.thicknessIn ?? 0) < 2 && !isLumberLegCut(c),
  );
  const thinBacks = cuts.filter((c) => (c.thicknessIn ?? 0.75) < 0.5);
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
      const framePlan = planSolidBoards(frameCuts.map((c) => ({ name: c.name, lengthIn: c.lengthIn, widthIn: c.widthIn, qty: c.quantity })));
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
        (thick > 0.9 ? `. Rip to ¾" (this board is ${thick}" thick; the drawing is still ¾")` : "") +
        (face < 3.2 ? `. The face is only ${face}" — buy extra when a part is wider` : "") +
        (thinBacks.length ? `. ¼" backs stay plywood.` : "."),
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
      ]);
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
          `${boardPlan.boards} × 8 ft ${label} (¾" × 3½") for ${legQtyForNote || (namedLegQty && !legsMerged) ? "the" : "all"} ${partsQty} ${label} part${partsQty === 1 ? "" : "s"} on the cut list` +
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
  const otherLumber =
    boardPrimary || solidNamedBuy
      ? []
      : structural.filter(
          (c) => /^lumber-/.test(c.id) && !c.id.startsWith(`${CATALOG_LUMBER_BIND}|`) && !stickBoards.includes(c) && (c.thicknessIn ?? 0) > 1,
        );
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
    const lengths = lines.flatMap((c) => Array.from({ length: c.quantity }, () => Math.max(c.lengthIn, c.widthIn)));
    const packed = packLengths(lengths, stockLen, 0.125);
    const qty = Math.max(1, packed.sticks);
    const pieceQty = lengths.length;
    const feet = Math.round(stockLen / 12);
    const names = [...new Set(lines.map((c) => c.name.toLowerCase()))];
    const lens = [...new Set(lengths.map((n) => Math.round(n * 16) / 16))].sort((a, b) => b - a).map((n) => `${inchFrac(n)}"`).join(", ");
    bom.push({
      name: item?.name ?? "2×4 Stud (8 ft)",
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
        notes: `${thinQty} thin back panel${thinQty === 1 ? "" : "s"} (${thinBacks.map((c) => c.label ?? c.name).join(", ")}) — not nested on the 3/4" sheets.${spliceNote}`,
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
  const crate = /crate/i.test(project.name) || /crate/.test((project.prompt ?? "").toLowerCase());
  const nightstand =
    !isBedsideShelf((project.prompt ?? "").toLowerCase()) &&
    !/^Bedside shelf/i.test(project.name) &&
    (/nightstand/i.test(project.name) ||
      /nightstand/.test((project.prompt ?? "").toLowerCase()) ||
      (/bedside/.test((project.prompt ?? "").toLowerCase()) && !isBedsideShelf((project.prompt ?? "").toLowerCase())));
  const hasCleats = project.panels.some((p) => /cleat/i.test(p.name));
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
  const pinned = (p: Panel) => pinShelves && p.type === "shelf" && shelfSpansUprights(p, project.panels);
  const buyJoints = panelJoints(project.panels, (a, b) => pinned(a) || pinned(b));
  BUY_JOINTS.set(project, buyJoints);
  const modelScrews = screwTalk(buyJoints);
  if (!headboard && !glueOnly) {
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
          ? `${joinScrews} screws shelf into brackets (no carcase joints).`
          : `${joinScrews} screws shelf into cleat (no carcase joints).`
        : modelScrews.screws >= 4
          ? modelScrews.note
          : `${joinScrews} screws for the few joints in the model.`,
    });
  }
  // Drawer fronts are typed as rail with "Drawer front" names — slides count boxes only.
  const drawers = project.panels.filter(
    (panel) => panel.type === "drawer" && !/drawer front/i.test(panel.name),
  );
  if (drawers.length) {
    const carcaseD =
      project.pocket?.unit.depth ?? project.fitted?.unit.depth ?? project.overall.depth;
    const slide = slideInches(carcaseD);
    bom.push({
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
  if (coatRack) {
    const pegRailBuild = project.panels.some((p) => /peg rail/i.test(p.name));
    const hooks = hookCount({ prompt: project.prompt, name: project.name, railWidth: project.overall.width, pegs: /\bpegs?\b/i.test(project.prompt ?? "") });
    bom.push({
      name: "Coat hooks",
      quantity: 1,
      unit: "pack",
      catalogId: "coat-hooks",
      searchQuery: "coat hooks wall mount 6 pack",
      estimatedCost: 12.98,
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
  const doors = project.panels.filter((panel) => panel.type === "door");
  if (doors.length && !stockJoinsWithoutScrews(project)) {
    if (crate) {
      bom.push({
        name: '3" utility hinges',
        quantity: 1,
        unit: "pair",
        searchQuery: "3 inch utility hinges pair",
        estimatedCost: 6.98,
        notes: "Two hinges on the door, screwed into the left upright.",
      });
      bom.push({
        name: "Barrel bolt latch",
        quantity: 1,
        unit: "pc",
        searchQuery: "3 inch barrel bolt latch",
        estimatedCost: 5.98,
        notes: "Latch the door into the right upright so it stays shut.",
      });
    } else {
      bom.push({
        name: "Soft-close concealed cabinet hinges",
        quantity: doors.length,
        unit: doors.length === 1 ? "pair" : "pairs",
        catalogId: "cabinet-hinges",
        searchQuery: "soft close concealed cabinet hinges",
        estimatedCost: 8.99 * doors.length,
        notes: `Two hinges per door (${doors.length * 2} hinges / ${doors.length} pair${doors.length === 1 ? "" : "s"}).`,
      });
      // Door pulls densify with hinged doors (bench shows BarPull) — not crate latch path.
      const pulls = doors.length + project.panels.filter((panel) => /drawer front/i.test(panel.name)).length;
      bom.push({
        name: "Cabinet bar pulls",
        quantity: Math.max(1, pulls),
        unit: pulls === 1 ? "pull" : "pulls",
        catalogId: "cabinet-bar-pulls",
        searchQuery: "cabinet bar pulls door handle",
        asin: "B09TVX1TWZ",
        estimatedCost: 2.6 * Math.max(1, pulls),
        notes: `One bar pull on each door or drawer (${pulls} pull${pulls === 1 ? "" : "s"}).`,
      });
    }
  }
  if (medicine) {
    bom.push({
      name: "Mirror for the door",
      quantity: 1,
      unit: "pc",
      searchQuery: "adhesive bathroom cabinet mirror",
      estimatedCost: 14.98,
      notes: "Glue to the outside face of the door, flush with that face, so the cabinet mirrors when closed. Do not bury it in the door slab.",
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
      notes: `Buy glass this size — do not cut from plywood. Hang over the knee.`,
    });
  }
  if (foldDown || ironing) {
    bom.push({
      name: "Piano hinge",
      quantity: 1,
      unit: "pc",
      catalogId: "piano-hinge",
      searchQuery: "1-1/2 inch x 48 inch piano hinge continuous",
      estimatedCost: 14.98,
      notes: ironing
        ? "Continuous hinge along the bottom edge of the ironing board so it folds down."
        : "Continuous hinge along the bottom edge of the fold-down board so it folds down.",
    });
    bom.push({
      name: "Support-leg hinge",
      quantity: 1,
      unit: "pc",
      catalogId: "utility-hinges",
      searchQuery: "narrow utility hinge 1-1/2 inch",
      estimatedCost: 3.48,
      notes: "Short hinge so the support leg kicks out to the floor when the board is down.",
    });
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
  // Hinged-lid chest OPERATE — piano hinge + lid stay (do not double-add if fold-down already added piano hinge).
  // Lift-off / removable / loose lid ≠ piano / stay (universal lid-attachment class).
  {
    const lidPrompt = (project.prompt ?? "").toLowerCase();
    const hasLiftOffLidPanel = project.panels.some((p) => /^Lift-off lid$/i.test(p.name));
    const hasLidPanel = project.panels.some((p) => /^Lid$/i.test(p.name));
    const liftOff = isLiftOffLidPrompt(lidPrompt) || hasLiftOffLidPanel;
    const hingedLid =
      !liftOff &&
      (hasLidPanel ||
        isHingedLidChest(lidPrompt) ||
        isToyChest(lidPrompt) ||
        /hinged\s*lid/i.test(`${project.name} ${project.prompt ?? ""}`) ||
        ((/Toy chest|\bChest\b/i.test(project.name) || /Toy chest/i.test(project.name)) && hasLidPanel));
    if (hingedLid) {
      const alreadyPiano = bom.some((b) => /piano hinge/i.test(b.name));
      if (!alreadyPiano) {
        bom.push({
          name: "Piano hinge",
          quantity: 1,
          unit: "pc",
          catalogId: "piano-hinge",
          searchQuery: "continuous piano hinge",
          estimatedCost: 14.98,
          notes: `Along the back edge of the lid · length ≈ ${project.overall.width}" (chest width). Long continuous hinge — not two butt hinges.`,
        });
      }
      const alreadyStay = bom.some((b) => /lid stay|lid support/i.test(b.name));
      if (!alreadyStay) {
        bom.push({
          name: "Lid stay / lid support",
          quantity: 1,
          unit: "pc",
          catalogId: "lid-stay",
          searchQuery: "toy chest lid support or lid stay",
          estimatedCost: 9.98,
          notes: "Keeps the lid from slamming. Mount per the stay instructions — usually one side of the lid into the main box.",
        });
      }
    }
  }

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
  const shelfCount = project.panels.filter((panel) => panel.type === "shelf" && shelfSpansUprights(panel, project.panels)).length;
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
    const pins = shelfCount * 4;
    const packs = Math.max(1, Math.ceil(pins / 50));
    bom.push({
      name: "5 mm shelf pins",
      quantity: packs,
      unit: packs === 1 ? "pack" : "packs",
      catalogId: "shelf-pins",
      searchQuery: "5mm shelf pins",
      estimatedCost: 6.49 * packs,
      notes: `${pins} pins (${shelfCount} shel${shelfCount === 1 ? "f" : "ves"} × 4). Set the shelves loose on the pins so they lift out to move.`,
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
                  : `Back is ${backW}" wide — shorter than ${STUD_CENTER_IN}" stud centers, so it cannot take a screw in two studs. Lag the corner that hits a stud and use rated wall anchors at the others. Guidance only — confirm wall type.`;
              })()
          : overToilet
            ? "4-6 screws through the uprights into studs so the unit cannot tip onto the toilet. Guidance only — confirm wall type."
          : spice
            ? "4 screws through the back into studs. A loaded spice rack will rip off drywall anchors. Guidance only — confirm wall type."
          : wine
            ? "4-6 screws through the back into studs. A loaded wine rack will rip off drywall anchors. Guidance only — confirm wall type."
          : project.panels.some((p) => p.type === "upright")
            ? "4-6 screws through the uprights into studs (or masonry anchors). Guidance only — confirm wall type."
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
  if (!coatRack && !headboard && !floatingIssue && !/crate/i.test(project.name) && !/ironing/i.test(project.name) && !/ironing/.test((project.prompt ?? "").toLowerCase()) && !/medicine/i.test(project.name) && !/medicine/.test((project.prompt ?? "").toLowerCase()) && !/over-toilet/i.test(project.name) && !/spice/i.test(project.name) && !(/spice/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && !/wine/i.test(project.name) && !(/wine/.test((project.prompt ?? "").toLowerCase()) && /rack/.test((project.prompt ?? "").toLowerCase())) && (width < 12 || height < 12 || depth < 8)) {
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
  const plainInstructions = instructions.map((s) => ({
    ...s,
    title: strangerPlainShopTalk(s.title),
    description: strangerPlainShopTalk(s.description),
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
    extra.push({
      name: '3/8" carriage bolts',
      quantity: posts * 2,
      unit: "each",
      searchQuery: "3/8 inch carriage bolts",
      notes: "Two per handrail post, through the back post.",
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

export function buildPlan(project: YardProject): BuildPlan {
  return fallbackStepOne(project, buildPlanInner(project));
}

/** A noun built as a simple primitive says so in step 1. */
function fallbackStepOne(project: YardProject, plan: BuildPlan): BuildPlan {
  const note = (project.notes ?? []).find((n) => n.startsWith("Yard built a"));
  if (!note || !plan.instructions.length || (plan.instructions[0].description ?? "").includes(note)) return plan;
  const instructions = plan.instructions.map((s, i) => (i === 0 ? { ...s, description: `${note} ${s.description ?? ""}`.trim() } : s));
  return { ...plan, instructions };
}

function buildPlanInner(project: YardProject): BuildPlan {
  const built = featureBayWording(project, stepsUseFaceScrew(project, applyShopJoin(project, fractionPlanText(buyReadsModel(boardStockWording(project, withOutdoorPackage(project, withPlacementTalk(project, buildPlanCore(project)))))))));
  const plan = withAccessorySheetCuts(project, stepsAccountForScrews(stepsStateJointScrews(project, stepsDriveJointScrews(project, { ...built, bom: hardwareFromNotes(project, built.bom) }))));
  const extra = spaceCutStep(project);
  if (!extra) return positivePlan(plan);
  const step = plan.instructions.length + 1;
  return positivePlan({ ...plan, instructions: [...plan.instructions, { step, title: extra.title, description: extra.description }] });
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
    const each = sold && species && species.id !== "pine" ? speciesBoardUsd(species) : null;
    if (each != null && line.quantity > 0) {
      const total = Math.round(each * line.quantity * 100) / 100;
      const query = `${species!.display} 1x4 board 8 ft`;
      line = { ...line, estimatedCost: total, searchQuery: query, offers: estimateOffers(query, line.quantity, total) };
      changed = true;
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
                  return project.fitted?.program ?? "closet";
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
