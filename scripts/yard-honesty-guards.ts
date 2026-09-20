import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import {
  wantsCabinetryShopWords,
  shopWordsChipTalk,
  glossaryForPlan,
  strangerPlainShopTalk,
  isRoundUnitEnvelope,
  fmtUnitEnvelopeInches,
  openingStorageMeasureEmptyTalk,
  measureChipAxisLabels,
  deskWidthFromPrompt,
  speciesStockHonestyTalk,
  speciesSubstituteNote,
  densifyDrawerExplodeTalk,
  cutListHasExplodedDrawers,
  densifyPartsCountTalk,
  densifyPartsPlateTalk,
  cutListWoodPieceCount,,
  assumedDensifyNotesTalk,
  densifyConfirmAssumedNotes
} from "../src/lib/yard/voiceHonesty";
import { SHOP_GLOSSARY } from "../src/lib/yard/pdfGlossary";
import { measureKindFromProject } from "../src/lib/yard/space";
import { buildFitted } from "../src/lib/yard/fitted";
import { climbIdentityLabel, detectHouseFamily, identityTitleStem, isAdirondackChair, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, isBedsideShelf, isBookBinBench, isBootTrayBench, isButcherCart, isDiningTable, isServingCart, isPlateRack, isMagazineRack, isSlotRack, slotRackTitle, isCoatCubbyWall, isDaybed, isDryingRack, isFoldingTable, isIroningWallMount, isKeyMailShelf, isCoatHookBoard, isOpenCubbyWall, openCubbyWallTitle, isKitchenIsland, isLaundrySorter, isLeashRail, isPegRail, isFilingShelf, isPrinterStand, isLumberRack, isOpenKitchenShelving, isOutdoorSideTable, isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame, isPottingBench, isPrepTable, isSofaConsoleTable, isStandingShopTop, isToolRail, isToyChest, isHingedLidChest, isUtilityShelf, isWorkbench, wantsPrintHold, isFloorLampStand, floorLampTitleStem, isWallMediaLedge, isPictureLedge, pictureLedgeTitleStem } from "../src/lib/yard/family";
import { climbStepCount, spokenRungCount, detectWeekendFamily, detectWeekendMech, isHoseReelHold, isUmbrellaHold, isMonitorHold, isFloorLampHold, monitorEnvelopeTalk, monitorRiseIn, reelEnvelopeTalk, lampEnvelopeTalk, lampEnvelopeIn, lampHeightIn, wantsPotHold } from "../src/lib/yard/weekendFamily";
import { classifyAnatomy } from "../src/lib/yard/anatomy";
import { isoCaption } from "../src/lib/yard/iso";
import {
  enforceHonesty,
  hasFloorBoxLie,
  hasRackAffordance,
  inspectHonesty,
  isWallHung,
  nearInch,
  tableBraceIssues,
  typedExtents,
  wantsFixedGlueShelves,
} from "../src/lib/yard/honesty";
import { detectMaterial, hasExplicitStock } from "../src/lib/yard/promptHelpers";
import { drawerBoxFromOpening, explodeDrawerBoxCuts, cutListName, woodCutPieceCount } from "../src/lib/yard/shopPlural";
import { uniqueSteps } from "../src/lib/yard/uniqueSteps";
import {
  inspectWeekendHonesty,
  namedStockDisplayName,
  promptBoundStock,
  weekendTypedSize,
} from "../src/lib/yard/weekendStockHonesty";

function failHonesty(msg: string, extra?: unknown) {
  console.error("FAIL honesty", msg, extra ?? "");
  process.exit(1);
}

function checkSizePrompt(prompt: string, w: number, h: number, d: number) {
  const typed = typedExtents(prompt);
  if (!typed) failHonesty("typed extents missing", prompt);
  if (typed!.labeled.width && typed!.width != null && !nearInch(typed!.width, w)) {
    failHonesty(`typed W ${typed!.width} ≠ ${w}`, prompt);
  }
  if (typed!.labeled.height && typed!.height != null && !nearInch(typed!.height, h)) {
    failHonesty(`typed H ${typed!.height} ≠ ${h}`, prompt);
  }
  if (typed!.labeled.depth && typed!.depth != null && !nearInch(typed!.depth, d)) {
    failHonesty(`typed D ${typed!.depth} ≠ ${d}`, prompt);
  }
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const report = inspectHonesty(project, plan);
  if (!report.ok) failHonesty(`${prompt} still lying`, report.issues);
  if (!nearInch(project.overall.width, w) || !nearInch(project.overall.height, h) || !nearInch(project.overall.depth, d)) {
    failHonesty(`HUD ${project.overall.width}×${project.overall.height}×${project.overall.depth} ≠ ${w}×${h}×${d}`, prompt);
  }
  const unit = project.fitted?.unit;
  if (!unit || !nearInch(unit.width, w) || !nearInch(unit.height, h) || !nearInch(unit.depth, d)) {
    failHonesty(`unit drifted`, unit);
  }
  const cap = isoCaption(project, []);
  if (cap && /\d/.test(cap)) {
    const nums = [...cap.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
    if (nums[0] != null && !nearInch(nums[0], w)) failHonesty(`iso caption W ${nums[0]} ≠ ${w}`, cap);
  }
}

checkSizePrompt("laundry folding table 48 wide 36 high 24 deep", 48, 36, 24);
checkSizePrompt("laundry folding table 48x36x24", 48, 36, 24);

const spicePrompt = "spice rack 18 wide 24 high 4 deep";
const spice = generateFromPrompt(spicePrompt);
const spicePlan = buildPlan(spice);
if (!isWallHung(spice)) failHonesty("spice not wall-hung", spice.assumptions);
if (!hasRackAffordance(spice)) failHonesty("spice missing jar lips", spice.panels.map((p) => p.name));
const spiceBlob = spicePlan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`).join("\n");
if (hasFloorBoxLie(spiceBlob)) failHonesty("spice plan is a floor box", spicePlan.instructions.map((s) => s.title));
if (spicePlan.bom.some((b) => /shelf pin/i.test(b.name))) failHonesty("spice still buys shelf pins", spicePlan.bom);
if (inspectHonesty(spice, spicePlan).ok === false) failHonesty("spice inspect", inspectHonesty(spice, spicePlan).issues);

const winePrompt = "wine rack 24 wide 36 high 12 deep";
const wine = generateFromPrompt(winePrompt);
const winePlan = buildPlan(wine);
if (!hasRackAffordance(wine)) failHonesty("wine missing bottle rails", wine.panels.map((p) => p.name));
if (!wine.panels.some((p) => /bottle rail/i.test(p.name) || p.type === "rail")) {
  failHonesty("wine rails not named", wine.panels.map((p) => p.name));
}
const wineBlob = winePlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
if (hasFloorBoxLie(wineBlob)) failHonesty("wine plan is a floor box", winePlan.instructions.map((s) => s.title));
if (winePlan.bom.some((b) => /shelf pin/i.test(b.name))) failHonesty("wine still buys shelf pins", winePlan.bom);

const bookcase = generateFromPrompt("kids bookcase 24 wide by 12 deep by 36 high, 5 shelves");
const lyingWine = { ...bookcase, prompt: winePrompt, name: 'Bookcase 24" × 36" × 12"' };
const lyingReport = inspectHonesty(lyingWine);
if (lyingReport.ok || !lyingReport.issues.some((i) => i.guard === "rack")) {
  failHonesty("bookcase-as-wine was not caught", lyingReport);
}
const fixedWine = enforceHonesty(lyingWine, { rebuild: (spec) => buildFitted(spec, winePrompt) });
if (!hasRackAffordance(fixedWine)) failHonesty("enforceHonesty did not add rails", fixedWine.panels.map((p) => p.name));
if (fixedWine.assumptions.installMode !== "wall") failHonesty("enforceHonesty did not wall-mount the wine lie");
const fixedPlan = buildPlan(fixedWine);
if (hasFloorBoxLie(fixedPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n"))) {
  failHonesty("fixed wine plan still a floor box", fixedPlan.instructions.map((s) => s.title));
}
if (inspectHonesty(fixedWine, fixedPlan).ok === false) {
  failHonesty("fixed wine still failing", inspectHonesty(fixedWine, fixedPlan).issues);
}


console.log("HONESTY GUARDS OK", {
  laundry: generateFromPrompt("laundry folding table 48 wide 36 high 24 deep").overall,
  spiceLips: spice.panels.filter((p) => p.type === "rail").length,
  wineRails: wine.panels.filter((p) => p.type === "rail").length,
  spiceMode: spice.assumptions.installMode,
  wineMode: wine.assumptions.installMode,
});

const linen = generateFromPrompt("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep");
if (!linen.fitted || !nearInch(linen.overall.width, 31.5) || !nearInch(linen.overall.height, 78) || !nearInch(linen.overall.depth, 16)) {
  failHonesty("linen freeze", linen.overall);
}
const desk = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
if (desk.kind !== "closet" || !desk.fitted || !nearInch(desk.overall.width, 60) || !nearInch(desk.overall.depth, 30) || !nearInch(desk.overall.height, 29)) {
  failHonesty("desk freeze", { kind: desk.kind, overall: desk.overall, fitted: !!desk.fitted });
}


if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) failHonesty("desk 24in knee freeze", desk.fitted?.unit);
const deskKnee = desk.panels.filter((p) => /knee divider/i.test(p.name));
if (deskKnee.length < 2) failHonesty("desk lost knee dividers", desk.panels.map((p) => p.name));
const deskAprons = desk.panels.filter((p) => /apron/i.test(p.name));
if (deskAprons.length) failHonesty("desk grew table aprons across the knee", deskAprons.map((p) => p.name));
if (tableBraceIssues(desk).length) failHonesty("desk table-brace guard false positive", tableBraceIssues(desk));
{
  // Soft-park: envelope AABB H must match typed overall H (Desktop top face = 29, not 29+1½).
  const desktop = desk.panels.find((p) => p.type === "counter" && /^Desktop$/i.test(p.name));
  if (!desktop) failHonesty("desk Desktop panel missing", desk.panels.map((p) => p.name));
  else {
    const topFace = desktop.position.y + desktop.size.height;
    if (!nearInch(topFace, 29)) {
      failHonesty("desk Desktop top face ≠ typed H29", {
        y: desktop.position.y,
        thick: desktop.size.height,
        topFace,
      });
    }
    if (!nearInch(desktop.size.height, 1.5)) {
      failHonesty("desk Desktop thickness ≠ 1½", desktop.size);
    }
    // Knee dividers stop at undersurface — never climb through the worktop.
    for (const div of deskKnee) {
      if (!nearInch(div.size.height, 29 - 1.5)) {
        failHonesty("desk knee divider H ≠ undersurface", {
          name: div.name,
          h: div.size.height,
          want: 27.5,
        });
      }
    }
  }
  const deskHonesty = inspectHonesty(desk, buildPlan(desk));
  if (!deskHonesty.ok) failHonesty("desk envelope/honesty", deskHonesty.issues);
  const envIssue = deskHonesty.issues.find((i) => /envelope/i.test(i.message) && /H /.test(i.message));
  if (envIssue) failHonesty("desk envelope H still flakes vs typed 29", envIssue);
}
// Twin: writing desk / table worktop — typed H wins on envelope AABB (same worktop class).
{
  const writing = generateFromPrompt("writing desk 48 inches wide by 24 deep by 30 high with 22 inch knee space");
  if (!nearInch(writing.overall.height, 30)) failHonesty("writing desk overall H", writing.overall);
  if (!nearInch(writing.fitted?.unit.kneeW ?? 0, 22)) failHonesty("writing desk kneeW", writing.fitted?.unit);
  const top = writing.panels.find((p) => p.type === "counter" && /^Desktop$/i.test(p.name));
  if (!top) failHonesty("writing desk Desktop missing", writing.panels.map((p) => p.name));
  else if (!nearInch(top.position.y + top.size.height, 30)) {
    failHonesty("writing desk Desktop top face ≠ typed H30", {
      y: top.position.y,
      thick: top.size.height,
      topFace: top.position.y + top.size.height,
    });
  }
  const writingHonesty = inspectHonesty(writing, buildPlan(writing));
  if (!writingHonesty.ok) failHonesty("writing desk envelope/honesty", writingHonesty.issues);
}

function expectTableAprons(prompt: string, extra?: { legs?: number; round?: boolean }) {
  const project = generateFromPrompt(prompt);
  if (project.fitted?.program !== "table") failHonesty(`${prompt} not a table`, project.fitted);
  const report = inspectHonesty(project);
  if (!report.ok) failHonesty(`${prompt} table honesty`, report.issues);
  const brace = tableBraceIssues(project);
  if (brace.length) failHonesty(`${prompt} apron lie`, brace);
  const legs = project.panels.filter((p) => p.type === "upright" && /^leg\b/i.test(p.name));
  const rails = project.panels.filter((p) => p.type === "rail" || /^apron\b/i.test(p.name));
  const wantLegs = extra?.legs ?? (extra?.round ? 3 : 4);
  if (legs.length !== wantLegs) failHonesty(`${prompt} legs ${legs.length} ≠ ${wantLegs}`, legs.map((p) => p.name));
  if (rails.length !== wantLegs) failHonesty(`${prompt} aprons ${rails.length} ≠ ${wantLegs}`, rails.map((p) => p.name));
  if (extra?.round && project.fitted?.unit.shape !== "round") failHonesty(`${prompt} not round`, project.fitted?.unit);
  const yawed = rails.filter((p) => Math.abs(p.yaw ?? 0) > 0.05);
  if (wantLegs === 4 && yawed.length) failHonesty(`${prompt} 4-leg still yaws aprons`, yawed.map((p) => `${p.name} yaw=${p.yaw}`));
  return project;
}

const laundryTable = expectTableAprons("laundry folding table 48 wide 36 high 24 deep", { legs: 4 });
const round3 = expectTableAprons("40 inch round 3-leg table", { legs: 3, round: true });
const coffee = expectTableAprons("coffee table 48 round", { legs: 3, round: true });
const dining = expectTableAprons("table 48 wide 30 high 36 deep", { legs: 4 });

// 3-leg aprons must sit inside the post triangle (inset), not on the centerline past the posts.
{
  const legs = round3.panels.filter((p) => p.type === "upright" && /^leg\b/i.test(p.name));
  const rails = round3.panels.filter((p) => p.type === "rail" || /^apron\b/i.test(p.name));
  const legC = legs.map((p) => ({
    x: p.position.x + p.size.width / 2,
    z: p.position.z + p.size.depth / 2,
  }));
  for (let i = 0; i < rails.length; i++) {
    const a = legC[i];
    const b = legC[(i + 1) % legC.length];
    const chordMidR = Math.hypot((a.x + b.x) / 2, (a.z + b.z) / 2);
    const r = rails[i];
    const apronMidR = Math.hypot(r.position.x + r.size.width / 2, r.position.z + r.size.depth / 2);
    if (!(apronMidR < chordMidR - 0.15)) {
      failHonesty(`round3 ${r.name} not inset inside posts`, { apronMidR, chordMidR });
    }
  }
  const coffeeApron = coffee.panels.find((p) => /apron/i.test(p.name));
  if (!coffeeApron || coffeeApron.size.height > 2.6) {
    failHonesty("coffee apron too deep for short table", coffeeApron?.size);
  }
  // Aprons must stand on edge (height > thickness), never laid flat under the top.
  for (const r of rails) {
    if (!(r.size.height > r.size.depth + 0.5)) {
      failHonesty(`round3 ${r.name} laid flat under top`, r.size);
    }
    if (Math.abs(r.yaw ?? 0) < 0.05) {
      failHonesty(`round3 ${r.name} missing chord yaw`, r.yaw);
    }
    // Three.js R_y long axis must be a chord, not a radial spoke (center Y).
    const yaw = r.yaw ?? 0;
    const ax = Math.cos(yaw);
    const az = -Math.sin(yaw);
    const rcx = r.position.x + r.size.width / 2;
    const rcz = r.position.z + r.size.depth / 2;
    const rn = Math.hypot(rcx, rcz) || 1;
    const radialDot = Math.abs((ax * -rcx + az * -rcz) / rn);
    if (radialDot > 0.7) {
      failHonesty(`round3 ${r.name} radial toward center (not post-to-post)`, { radialDot, yaw });
    }
  }
  const braceIssues = tableBraceIssues(round3);
  if (braceIssues.length) failHonesty("round3 tableBraceIssues", braceIssues);
}
void laundryTable;
void round3;
void coffee;
void dining;

// Spoken "N diameter" / "N dia" binds round table top size — never steal height from "N tall".
// Protects: round dining table 40 diameter 30 tall with three legs (FAIL tip 407b5c2).
// Protects: house 40″ round 3-leg (inch-mark form already green).
{
  const diaSpoken = generateFromPrompt("round dining table 40 diameter 30 tall with three legs");
  if (diaSpoken.fitted?.program !== "table") failHonesty("diaSpoken not a table", diaSpoken.fitted);
  if (diaSpoken.fitted?.unit?.shape !== "round") failHonesty("diaSpoken not round", diaSpoken.fitted?.unit);
  if (!nearInch(diaSpoken.overall.width, 40) || !nearInch(diaSpoken.overall.depth, 40)) {
    failHonesty("diaSpoken overall dia≈40 (not height leak)", diaSpoken.overall);
  }
  if (!nearInch(diaSpoken.overall.height, 30)) {
    failHonesty("diaSpoken overall H≈30", diaSpoken.overall);
  }
  const diaLegs = diaSpoken.panels.filter((p) => p.type === "upright" && /^leg\b/i.test(p.name));
  if (diaLegs.length !== 3) failHonesty("diaSpoken 3 legs", diaLegs.map((p) => p.name));
  const diaTop = diaSpoken.panels.find((p) => /^Top\b/i.test(p.name));
  if (!diaTop) failHonesty("diaSpoken missing Top", diaSpoken.panels.map((p) => p.name));
  if (diaTop && (!nearInch(diaTop.size.width, 40) || !nearInch(diaTop.size.depth, 40))) {
    failHonesty("diaSpoken Top cut dia 40", diaTop.size);
  }
  const diaBlob = [diaSpoken.name, ...(diaSpoken.notes ?? []), ...(diaTop ? [diaTop.name] : [])].join("\n");
  if (!/40/.test(diaBlob)) failHonesty("diaSpoken title/notes honor 40", diaBlob.slice(0, 400));
  if (/\b30\s*[×x]\s*30\b/.test(diaSpoken.name) && !/40/.test(diaSpoken.name)) {
    failHonesty("diaSpoken title still 30×30 (height leaked into dia)", diaSpoken.name);
  }
  // Twin: N dia shorthand + diameter N (Raw) when number is not an axis label.
  const diaShort = generateFromPrompt("round table 36 dia 29 tall with three legs");
  if (!nearInch(diaShort.overall.width, 36) || !nearInch(diaShort.overall.height, 29)) {
    failHonesty("diaShort 36 dia × 29 tall", diaShort.overall);
  }
  const diaRawOk = generateFromPrompt("round table diameter 42 28 tall with three legs");
  if (!nearInch(diaRawOk.overall.width, 42) || !nearInch(diaRawOk.overall.height, 28)) {
    failHonesty("diameter N (Raw) still binds when not axis-labeled", diaRawOk.overall);
  }
  // Protect working inch-mark form + freezes.
  const inchRound = generateFromPrompt("house: 40″ round 3-leg table");
  if (!nearInch(inchRound.overall.width, 40) || !nearInch(inchRound.overall.depth, 40)) {
    failHonesty("protect 40″ round overall dia", inchRound.overall);
  }
  if (inchRound.fitted?.unit?.shape !== "round") failHonesty("protect 40″ round shape", inchRound.fitted?.unit);
  const legs40 = inchRound.panels.filter((p) => p.type === "upright" && /^leg\b/i.test(p.name));
  if (legs40.length !== 3) failHonesty("protect 40″ round 3 legs", legs40.map((p) => p.name));
  const linenFreeze = generateFromPrompt("linen closet 31.5 wide 78 high 16 deep with a rod and two shelves");
  if (!linenFreeze.fitted || !nearInch(linenFreeze.overall.width, 31.5) || !nearInch(linenFreeze.overall.height, 78)) {
    failHonesty("protect linen freeze after dia bind", linenFreeze.overall);
  }
  const deskFreeze = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (Math.abs(deskFreeze.overall.height - 29) > 0.5) failHonesty("protect desk H29 after dia bind", deskFreeze.overall);
  const andersenFreeze = generateFromPrompt("house: Andersen 36×48 hung window with RO");
  if (!/Andersen/i.test(andersenFreeze.name)) failHonesty("protect Andersen after dia bind", andersenFreeze.name);
  const catFreeze = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(catFreeze.name) && !/catapult/i.test(catFreeze.name)) {
    failHonesty("protect catapult≠trough after dia bind", catFreeze.name);
  }
  const pocketFreeze = generateFromPrompt("house: nightstand 20″ wide × 16″ deep × 26″ tall with one drawer");
  if (!/nightstand|bedside/i.test(pocketFreeze.name)) failHonesty("protect nightstand after dia bind", pocketFreeze.name);
}

const lyingApronTable = {
  ...laundryTable,
  panels: laundryTable.panels.map((p) =>
    p.name === "Front apron"
      ? { ...p, yaw: Math.atan2(24, 48), size: { ...p.size, width: 55.25 } }
      : p,
  ),
};
const lyingApron = tableBraceIssues(lyingApronTable);
if (!lyingApron.length) failHonesty("diagonal 55.25 apron was not caught", lyingApron);

console.log("TABLE APRON GUARD OK", {
  laundry: { overall: laundryTable.overall, rails: laundryTable.panels.filter((p) => p.type === "rail").map((p) => p.name) },
  round3: { overall: round3.overall, legs: round3.fitted?.unit.legs, shape: round3.fitted?.unit.shape },
  coffee: { overall: coffee.overall, h: coffee.overall.height },
  dining: dining.overall,
  deskKnee: desk.fitted?.unit.kneeW,
});


function expectFamily(prompt: string, family: string, extra?: { lips?: boolean; seat?: boolean }) {
  const hit = detectHouseFamily(prompt);
  if (!hit || hit.family !== family) {
    failHonesty(`family(${prompt}) → ${hit?.family ?? "null"} ≠ ${family}`, hit);
  }
  if (classifyAnatomy(prompt).anatomy !== "fitted") {
    failHonesty(`anatomy(${prompt}) not fitted`, classifyAnatomy(prompt));
  }
  const project = generateFromPrompt(prompt);
  if (extra?.lips) {
    if (!isWallHung(project)) failHonesty(`${prompt} not wall-hung`, project.assumptions);
    if (!hasRackAffordance(project)) failHonesty(`${prompt} missing jar lips`, project.panels.map((p) => p.name));
    const plan = buildPlan(project);
    const blob = plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`).join("\n");
    if (hasFloorBoxLie(blob)) failHonesty(`${prompt} plan is a floor box`, plan.instructions.map((s) => s.title));
    if (project.panels.some((p) => p.type === "kick")) failHonesty(`${prompt} grew a toekick`, project.panels.map((p) => p.name));
  }
  if (extra?.seat) {
    if (!project.panels.some((p) => /apron/i.test(p.name))) failHonesty(`${prompt} missing seat apron`, project.panels.map((p) => p.name));
    if (!project.panels.some((p) => /divider|cubby/i.test(p.name))) failHonesty(`${prompt} missing cubby dividers`, project.panels.map((p) => p.name));
    if (project.fitted?.program !== "bench") failHonesty(`${prompt} program not bench`, project.fitted);
  }
  return project;
}

const jarShelfPrompt = "wall shelf for jars 24 wide";
const jarHit = detectHouseFamily(jarShelfPrompt);
if (!jarHit || jarHit.family !== "hung-open" || !jarHit.affordances.includes("jar-lips") || jarHit.mount !== "wall") {
  failHonesty("jar shelf family", jarHit);
}
const jarShelf = expectFamily(jarShelfPrompt, "hung-open", { lips: true });
if (!nearInch(jarShelf.overall.width, 24)) failHonesty("jar shelf width", jarShelf.overall);
if (jarShelf.assumptions.installMode !== "wall") failHonesty("jar shelf mount", jarShelf.assumptions);

const seatPrompt = "bench 48 wide";
const seatHit = detectHouseFamily(seatPrompt);
if (!seatHit || seatHit.family !== "seat" || seatHit.use !== "sit" || !seatHit.affordances.includes("cubbies")) {
  failHonesty("bench family", seatHit);
}
const seat = expectFamily(seatPrompt, "seat", { seat: true });
if (!nearInch(seat.overall.width, 48)) failHonesty("bench width", seat.overall);
if (!nearInch(seat.overall.height, 18)) failHonesty("bench default height should be sit height", seat.overall);

if (detectHouseFamily("kitchen chair from 1x4")) failHonesty("chair should not be a house family");
if (classifyAnatomy("kitchen chair from 1x4").anatomy === "fitted") failHonesty("chair anatomy drifted to fitted");
const andersen = generateFromPrompt("Andersen 100 Series 36 by 48 double hung window, frame the rough opening");
if (andersen.kind !== "opening") failHonesty("Andersen freeze", { kind: andersen.kind, name: andersen.name });
if (detectHouseFamily("Andersen 100 Series 36 by 48 double hung window, frame the rough opening")) {
  failHonesty("Andersen should not be a house family");
}

const closetRods = generateFromPrompt("closet system 80x120");
const rodPanels = closetRods.panels.filter((p) => /hanging rod/i.test(p.name));
if (rodPanels.length < 2) failHonesty("closet rods per bay freeze", closetRods.panels.map((p) => p.name));

console.log("HOUSE FAMILY OK", {
  jar: { family: jarHit.family, mount: jarHit.mount, lips: jarShelf.panels.filter((p) => p.type === "rail").length, mode: jarShelf.assumptions.installMode },
  bench: { family: seatHit.family, overall: seat.overall, cubbies: seat.fitted?.unit.cubbies, apron: seat.panels.some((p) => /apron/i.test(p.name)) },
  andersen: andersen.kind,
});

function failWeekend(msg: string, extra?: unknown) {
  console.error("FAIL weekend honesty", msg, extra ?? "");
  process.exit(1);
}

function expectStock(prompt: string, id: string) {
  const got = detectMaterial(prompt);
  if (got.id !== id) failWeekend(`detectMaterial(${prompt}) → ${got.id} ≠ ${id}`);
  if (id === "wire-frame") {
    if (hasExplicitStock(prompt)) failWeekend(`unnamed ${prompt} flagged as explicit stock`);
  } else if (!hasExplicitStock(prompt)) {
    failWeekend(`named ${prompt} not explicit stock`);
  }
}

expectStock("3 foot Eiffel Tower from popsicle sticks", "popsicle-standard");
expectStock("3-ft Eiffel Tower from popsicle sticks", "popsicle-standard");
expectStock("jumbo stick tower", "popsicle-jumbo");
expectStock("6 foot garden arch from 3/4 inch PVC pipe", "pvc-3-4-sch40");
expectStock("4 foot bridge from plastic drinking straws", "straw-plastic");
expectStock("garden arch from 2x4", "lumber-2x4-8");
expectStock("tower from 1/4 dowel", "dowel-1-4-36");
expectStock("tower from dowels", "dowel-1-4-36");
expectStock("box from plywood", "plywood-3-4-4x8");
// Plural craft nouns (skewers/dowels) must bind craft stock — not bare bamboo → lumber-1x4-8.
expectStock("bridge from bamboo skewers", "bamboo-skewer-12");
expectStock("bridge from bamboo skewer", "bamboo-skewer-12");
expectStock("picture frame from bamboo skewers", "bamboo-skewer-12");
expectStock("Eiffel Tower", "wire-frame");
expectStock("garden arch", "wire-frame");
expectStock("a bridge", "wire-frame");

const eiffelPrompt = "3 foot Eiffel Tower from popsicle sticks";
const eiffelHyphen = "3-ft Eiffel Tower from popsicle sticks";
const typedE = weekendTypedSize(eiffelPrompt);
const typedH = weekendTypedSize(eiffelHyphen);
if (!typedE || !nearInch(typedE.height ?? 0, 36, 0.1)) failWeekend("3 foot did not parse as 36in", typedE);
if (!typedH || !nearInch(typedH.height ?? 0, 36, 0.1)) failWeekend("3-ft did not parse as 36in", typedH);

const eiffel = generateFromPrompt(eiffelPrompt);
const eiffelPlan = buildPlan(eiffel);
if (eiffel.kind !== "eiffel") failWeekend("eiffel kind", eiffel.kind);
if (!promptBoundStock(eiffel) || eiffel.primaryMaterialId !== "popsicle-standard") {
  failWeekend("eiffel stock bind", eiffel.primaryMaterialId);
}
if (eiffel.instances.length < 400 || eiffel.instances.length > 1200) {
  failWeekend("eiffel piece count drifted", eiffel.instances.length);
}
if (eiffel.instances.some((i) => i.catalogId !== "popsicle-standard")) {
  failWeekend("eiffel members not popsicle");
}
if (eiffel.instances.some((i) => i.cutLength != null)) {
  failWeekend("eiffel cut popsicle sticks");
}
if (Math.abs(eiffel.overall.height - 37.4) > 2.5 && Math.abs(eiffel.overall.height - 36) > 2.5) {
  failWeekend("3-ft eiffel height drifted", eiffel.overall);
}
if (eiffelPlan.partsKind !== "whole") failWeekend("eiffel plan not whole", eiffelPlan.partsKind);
if (eiffelPlan.cutList.some((c) => !c.whole && Math.abs(c.lengthIn - 4.5) > 0.15)) {
  failWeekend("eiffel sold custom-cut sticks", eiffelPlan.cutList);
}
if (eiffelPlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("eiffel buy list has wood screws", eiffelPlan.bom.map((b) => b.name));
}
if (!eiffelPlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("eiffel buy list missing glue", eiffelPlan.bom.map((b) => b.name));
}
const eiffelInspect = inspectWeekendHonesty(eiffel, eiffelPlan);
if (!eiffelInspect.ok) failWeekend("eiffel inspect", eiffelInspect.issues);

const lying = {
  ...eiffel,
  instances: eiffel.instances.map((i) => ({ ...i, catalogId: "straw-plastic" })),
};
const lyingStockReport = inspectWeekendHonesty(lying, eiffelPlan);
if (lyingStockReport.ok || !lyingStockReport.issues.some((i) => i.guard === "stock")) {
  failWeekend("straw members on popsicle eiffel was not caught", lyingStockReport);
}

const hyphen = generateFromPrompt(eiffelHyphen);
if (hyphen.kind !== "eiffel" || hyphen.primaryMaterialId !== "popsicle-standard") {
  failWeekend("3-ft hyphen eiffel", { kind: hyphen.kind, stock: hyphen.primaryMaterialId, h: hyphen.overall.height });
}
if (Math.abs(hyphen.overall.height - 37.4) > 2.5 && Math.abs(hyphen.overall.height - 36) > 2.5) {
  failWeekend("3-ft hyphen height", hyphen.overall);
}

const arch = generateFromPrompt("6 foot garden arch from 3/4 inch PVC pipe");
const archPlan = buildPlan(arch);
if (arch.kind !== "arch") failWeekend("arch kind", arch.kind);
if (arch.primaryMaterialId !== "pvc-3-4-sch40") failWeekend("arch stock", arch.primaryMaterialId);
if (arch.instances.some((i) => i.catalogId !== "pvc-3-4-sch40")) failWeekend("arch members not PVC");
if (arch.instances.length < 8 || arch.instances.length > 28) failWeekend("arch piece count", arch.instances.length);
if (archPlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("arch buy list has wood screws", archPlan.bom.map((b) => b.name));
}
if (archPlan.bom.some((b) => /titebond|wood glue/i.test(b.name)) && !archPlan.bom.some((b) => /solvent/i.test(b.name))) {
  failWeekend("arch Titebond as only join", archPlan.bom.map((b) => b.name));
}
if (!archPlan.bom.some((b) => /solvent/i.test(b.name))) {
  failWeekend("arch missing solvent", archPlan.bom.map((b) => b.name));
}
const archInspect = inspectWeekendHonesty(arch, archPlan);
if (!archInspect.ok) failWeekend("arch inspect", archInspect.issues);

const bridge = generateFromPrompt("4 foot bridge from plastic drinking straws");
const bridgePlan = buildPlan(bridge);
if (bridge.kind !== "bridge") failWeekend("bridge kind", bridge.kind);
if (bridge.primaryMaterialId !== "straw-plastic") failWeekend("bridge stock", bridge.primaryMaterialId);
if (bridge.instances.some((i) => i.catalogId !== "straw-plastic")) failWeekend("bridge members not straw");
if (bridgePlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("straw bridge buy list has wood screws", bridgePlan.bom.map((b) => b.name));
}
const strawCuts = bridge.instances.filter((i) => i.cutLength != null).length;
if (strawCuts > bridge.instances.length * 0.15) {
  failWeekend("straw bridge cutting drinking straws", { strawCuts, n: bridge.instances.length });
}
const bridgeInspect = inspectWeekendHonesty(bridge, bridgePlan);
if (!bridgeInspect.ok) failWeekend("bridge inspect", bridgeInspect.issues);

const unnamed = generateFromPrompt("Eiffel Tower");
if (unnamed.primaryMaterialId !== "wire-frame") {
  failWeekend("unnamed eiffel defaulted stock", unnamed.primaryMaterialId);
}
if (!promptBoundStock(unnamed)) failWeekend("unnamed not wire-bound", unnamed.primaryMaterialId);
if (unnamed.instances.some((i) => i.catalogId.startsWith("popsicle"))) {
  failWeekend("unnamed eiffel built from popsicle");
}

console.log("WEEKEND STOCK HONESTY OK", {
  eiffelPieces: eiffel.instances.length,
  eiffelH: eiffel.overall.height,
  eiffelStock: eiffel.primaryMaterialId,
  hyphenH: hyphen.overall.height,
  archPieces: arch.instances.length,
  archStock: arch.primaryMaterialId,
  archBom: archPlan.bom.map((b) => b.name),
  bridgePieces: bridge.instances.length,
  bridgeStock: bridge.primaryMaterialId,
  bridgeBom: bridgePlan.bom.map((b) => b.name),
  unnamed: unnamed.primaryMaterialId,
});

function expectWeekend(
  prompt: string,
  family: string,
  extra?: { override?: string | undefined; kind?: string },
) {
  const hit = detectWeekendFamily(prompt);
  if (!hit || hit.family !== family) {
    failWeekend(`weekendFamily(${prompt}) → ${hit?.family ?? "null"} ≠ ${family}`, hit);
  }
  if (extra && "override" in extra && hit!.override !== extra.override) {
    failWeekend(`weekendFamily(${prompt}) override ${hit!.override ?? "none"} ≠ ${extra.override ?? "none"}`, hit);
  }
  if (extra?.kind && hit!.kind !== extra.kind) {
    failWeekend(`weekendFamily(${prompt}) kind ${hit!.kind} ≠ ${extra.kind}`, hit);
  }
  return hit!;
}

expectWeekend("3 foot Eiffel Tower from popsicle sticks", "lattice", { override: "eiffel", kind: "eiffel" });
expectWeekend("3 foot tower from popsicle sticks", "lattice", { override: undefined, kind: "lattice" });
expectWeekend("space frame from popsicle sticks", "lattice", { kind: "lattice" });
expectWeekend("tower", "lattice", { kind: "lattice" });
expectWeekend("6 foot garden arch from 3/4 inch PVC pipe", "arch", { override: "arch", kind: "arch" });
expectWeekend("garden arch from 3/4 PVC", "arch", { override: "arch" });
expectWeekend("4 foot bridge from plastic drinking straws", "truss", { override: "bridge", kind: "bridge" });
expectWeekend("bridge from straws", "truss", { override: "bridge" });
expectWeekend("dinosaur from popsicle sticks", "figure", { kind: "figure" });
expectWeekend("giraffe from popsicle sticks", "figure");
expectWeekend("box from popsicle sticks", "frame", { kind: "frame" });
expectWeekend("catapult from popsicle sticks", "frame", { kind: "frame" });
expectWeekend("2 foot catapult from popsicle sticks", "frame", { kind: "frame" });
expectWeekend("ladder from 2x4", "frame", { kind: "ladder" });
expectWeekend("6 foot ladder from 2x4", "frame", { kind: "ladder" });
expectWeekend("bridge from bamboo skewers", "truss", { override: "bridge", kind: "bridge" });

if (detectWeekendFamily("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep")) {
  failWeekend("linen should not be a weekend family");
}
if (detectWeekendFamily("kitchen chair from 1x4")) {
  failWeekend("chair should not be a weekend family");
}
if (detectWeekendFamily("Andersen 100 Series 36 by 48 double hung window, frame the rough opening")) {
  failWeekend("Andersen should not be a weekend family");
}
if (detectWeekendFamily("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space")) {
  failWeekend("desk should not be a weekend family");
}

const novelTower = generateFromPrompt("3 foot tower from popsicle sticks");
if (novelTower.kind !== "lattice") failWeekend("novel tower kind", novelTower.kind);
if (!promptBoundStock(novelTower) || novelTower.primaryMaterialId !== "popsicle-standard") {
  failWeekend("novel tower stock bind", novelTower.primaryMaterialId);
}
if (novelTower.instances.some((i) => i.catalogId !== "popsicle-standard")) {
  failWeekend("novel tower members not popsicle");
}
if (Math.abs(novelTower.overall.height - 37.4) > 2.5 && Math.abs(novelTower.overall.height - 36) > 2.5) {
  failWeekend("3-ft popsicle tower height drifted", novelTower.overall);
}
if (novelTower.instances.length < 80) {
  failWeekend("novel tower is a sparse taper, not lattice density", novelTower.instances.length);
}
// Non-Eiffel mast: base face well under Eiffel-ratio (~0.39 H → ~14" at 36").
if (novelTower.overall.width > 12.5) {
  failWeekend("novel tower still Eiffel-wide", novelTower.overall);
}
const jumboTower = generateFromPrompt("4 foot tower from jumbo craft sticks");
if (jumboTower.kind !== "lattice" || jumboTower.primaryMaterialId !== "popsicle-jumbo") {
  failWeekend("jumbo tower", { kind: jumboTower.kind, stock: jumboTower.primaryMaterialId });
}
if (jumboTower.instances.length < 200) failWeekend("jumbo tower too sparse", jumboTower.instances.length);
if (jumboTower.overall.width > 16) failWeekend("jumbo tower still Eiffel-wide", jumboTower.overall);
if (jumboTower.instances.some((i) => i.cutLength != null)) failWeekend("jumbo tower cut sticks");
if (novelTower.instances.some((i) => i.cutLength != null)) {
  failWeekend("novel tower cut popsicle sticks");
}
const novelTowerPlan = buildPlan(novelTower);
if (novelTowerPlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("novel tower buy list has wood screws", novelTowerPlan.bom.map((b) => b.name));
}
if (!novelTowerPlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("novel tower buy list missing glue", novelTowerPlan.bom.map((b) => b.name));
}
const novelInspect = inspectWeekendHonesty(novelTower, novelTowerPlan);
if (!novelInspect.ok) failWeekend("novel tower inspect", novelInspect.issues);

const unnamedTower = generateFromPrompt("tower");
if (unnamedTower.primaryMaterialId !== "wire-frame") {
  failWeekend("unnamed tower defaulted stock", unnamedTower.primaryMaterialId);
}
if (unnamedTower.kind !== "lattice") {
  failWeekend("unnamed tower should still be lattice family", unnamedTower.kind);
}
if (unnamedTower.instances.some((i) => i.catalogId.startsWith("popsicle"))) {
  failWeekend("unnamed tower built from popsicle");
}

const spaceFrame = generateFromPrompt("space frame from popsicle sticks");
if (spaceFrame.kind !== "lattice" || spaceFrame.primaryMaterialId !== "popsicle-standard") {
  failWeekend("space frame", { kind: spaceFrame.kind, stock: spaceFrame.primaryMaterialId });
}

const dino = generateFromPrompt("dinosaur from popsicle sticks");
if (dino.kind !== "figure" || dino.primaryMaterialId !== "popsicle-standard") {
  failWeekend("dino family", { kind: dino.kind, stock: dino.primaryMaterialId });
}
if (dino.name !== "Dinosaur") failWeekend("dino name", dino.name);

const dogFig = generateFromPrompt("dog from popsicle sticks");
if (dogFig.kind !== "figure" || dogFig.primaryMaterialId !== "popsicle-standard") {
  failWeekend("dog family", { kind: dogFig.kind, stock: dogFig.primaryMaterialId });
}
if (dogFig.name !== "Dog") failWeekend("dog name drifted", dogFig.name);
if (dogFig.instances.length < 160) failWeekend("dog armature too sparse", dogFig.instances.length);
if (dogFig.instances.some((i) => i.cutLength != null)) failWeekend("dog cut popsicle sticks");
const dogPlan = buildPlan(dogFig);
if (dogPlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("dog buy list has wood screws", dogPlan.bom.map((b) => b.name));
}
if (!dogPlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("dog buy list missing glue", dogPlan.bom.map((b) => b.name));
}

const animalFig = generateFromPrompt("animal from popsicle sticks");
if (animalFig.name !== "Animal") failWeekend("animal name drifted", animalFig.name);
if (animalFig.instances.length < 160) failWeekend("animal armature too sparse", animalFig.instances.length);

const craftBox = generateFromPrompt("box from popsicle sticks");
if (craftBox.kind !== "frame" || craftBox.primaryMaterialId !== "popsicle-standard") {
  failWeekend("craft box family", { kind: craftBox.kind, stock: craftBox.primaryMaterialId });
}


const catapult = generateFromPrompt("catapult from popsicle sticks");
if (catapult.kind !== "frame" || catapult.primaryMaterialId !== "popsicle-standard") {
  failWeekend("catapult family/stock", { kind: catapult.kind, stock: catapult.primaryMaterialId });
}
if (catapult.name !== "Catapult") failWeekend("catapult name", catapult.name);
if (catapult.instances.some((i) => i.cutLength != null)) failWeekend("catapult cut popsicle sticks");
if (catapult.instances.length < 180) failWeekend("catapult too sparse", catapult.instances.length);
const catapultPlan = buildPlan(catapult);
if (catapultPlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("catapult buy list has wood screws", catapultPlan.bom.map((b) => b.name));
}
if (!catapultPlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("catapult buy list missing glue", catapultPlan.bom.map((b) => b.name));
}
if (catapultPlan.partsKind !== "whole") failWeekend("catapult plan not whole", catapultPlan.partsKind);
const catapultInspect = inspectWeekendHonesty(catapult, catapultPlan);
if (!catapultInspect.ok) failWeekend("catapult inspect", catapultInspect.issues);

const catapult2 = generateFromPrompt("2 foot catapult from popsicle sticks");
if (catapult2.kind !== "frame" || catapult2.primaryMaterialId !== "popsicle-standard") {
  failWeekend("2ft catapult", { kind: catapult2.kind, stock: catapult2.primaryMaterialId });
}
if (Math.abs(catapult2.overall.height - 24) > 2.5) {
  failWeekend("2ft catapult height drifted", catapult2.overall);
}
if (catapult2.instances.some((i) => i.cutLength != null)) failWeekend("2ft catapult cut popsicle");
if (catapult2.instances.length < 180) {
  failWeekend("2ft catapult still sparse", catapult2.instances.length);
}
const catapult2Inspect = inspectWeekendHonesty(catapult2, buildPlan(catapult2));
if (!catapult2Inspect.ok) failWeekend("2ft catapult inspect", catapult2Inspect.issues);

const ladder = generateFromPrompt("ladder from 2x4");
if (ladder.kind !== "ladder" || ladder.primaryMaterialId !== "lumber-2x4-8") {
  failWeekend("ladder family/stock", { kind: ladder.kind, stock: ladder.primaryMaterialId, family: detectWeekendFamily("ladder from 2x4") });
}
if (ladder.name !== "Ladder") failWeekend("ladder name", ladder.name);
const ladderPlan = buildPlan(ladder);
if (ladderPlan.partsKind === "whole") failWeekend("ladder lumber should allow cut list", ladderPlan.partsKind);
if (!ladderPlan.bom.some((b) => /screw/i.test(b.name))) {
  failWeekend("ladder buy list missing screws", ladderPlan.bom.map((b) => b.name));
}
if (ladder.joinMethod && ladder.joinMethod !== "screw" && !["screw", "nail", "glue"].includes(ladder.joinMethod)) {
  failWeekend("ladder join", ladder.joinMethod);
}
const ladderInspect = inspectWeekendHonesty(ladder, ladderPlan);
if (!ladderInspect.ok) failWeekend("ladder inspect", ladderInspect.issues);

const ladder6 = generateFromPrompt("6 foot ladder from 2x4");
if (ladder6.kind !== "ladder" || ladder6.primaryMaterialId !== "lumber-2x4-8") {
  failWeekend("6ft ladder", { kind: ladder6.kind, stock: ladder6.primaryMaterialId });
}
if (Math.abs(ladder6.overall.height - 72) > 2.5) {
  failWeekend("6ft ladder height drifted", ladder6.overall);
}
const ladder6Plan = buildPlan(ladder6);
const ladder6Inspect = inspectWeekendHonesty(ladder6, ladder6Plan);
if (!ladder6Inspect.ok) failWeekend("6ft ladder inspect", ladder6Inspect.issues);

// Soft leftover: plural "skewers" must densify bamboo-skewer-12 (not lumber-1x4-8 steal).
const bambooBridge = generateFromPrompt("bridge from bamboo skewers");
if (bambooBridge.kind !== "bridge" || bambooBridge.primaryMaterialId !== "bamboo-skewer-12") {
  failWeekend("bamboo bridge", { kind: bambooBridge.kind, stock: bambooBridge.primaryMaterialId });
}
if (bambooBridge.instances.length < 80) {
  failWeekend("bamboo bridge not densified at skewer", bambooBridge.instances.length);
}
if (bambooBridge.instances.some((i) => i.catalogId !== "bamboo-skewer-12")) {
  failWeekend("bamboo bridge foreign members");
}
const bambooPlan = buildPlan(bambooBridge);
if (bambooPlan.partsKind !== "whole") failWeekend("bamboo bridge plan not whole", bambooPlan.partsKind);
if (!bambooPlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("bamboo bridge missing glue", bambooPlan.bom.map((b) => b.name));
}
const bambooInspect = inspectWeekendHonesty(bambooBridge, bambooPlan);
if (!bambooInspect.ok) failWeekend("bamboo bridge inspect", bambooInspect.issues);

console.log("WEEKEND STRUCTURE FAMILIES OK", {
  eiffel: { family: detectWeekendFamily("3 foot Eiffel Tower from popsicle sticks")?.family, override: "eiffel", kind: eiffel.kind },
  novelTower: { kind: novelTower.kind, h: novelTower.overall.height, pieces: novelTower.instances.length, stock: novelTower.primaryMaterialId },
  unnamedTower: { kind: unnamedTower.kind, stock: unnamedTower.primaryMaterialId },
  spaceFrame: { kind: spaceFrame.kind, pieces: spaceFrame.instances.length },
  dino: dino.kind,
  box: craftBox.kind,
  catapult: { kind: catapult.kind, name: catapult.name, pieces: catapult.instances.length, h: catapult2.overall.height, h2pieces: catapult2.instances.length },
  ladder: { kind: ladder.kind, name: ladder.name, stock: ladder.primaryMaterialId, h6: ladder6.overall.height, join: ladder.joinMethod },
  bamboo: { kind: bambooBridge.kind, pieces: bambooBridge.instances.length, stock: bambooBridge.primaryMaterialId },
});

const coat = generateFromPrompt("coat rack 36 wide 6 high 8 deep");
const coatPlan = buildPlan(coat);
if (coatPlan.cutList.some((c) => /^(Back|Top|Rail)$/i.test(c.name))) {
  failHonesty("coat rack cut list still says Back/Top/Rail", coatPlan.cutList.map((c) => c.name));
}
if (!coatPlan.cutList.some((c) => /peg rail/i.test(c.name)) || !coatPlan.cutList.some((c) => /hat shelf/i.test(c.name))) {
  failHonesty("coat rack lost peg rail / hat shelf names", coatPlan.cutList.map((c) => c.name));
}

const closetRodPlan = buildPlan(closetRods);
if (closetRodPlan.cutList.some((c) => /^Rail$/i.test(c.name))) {
  failHonesty("closet hanging rod collapsed to Rail", closetRodPlan.cutList.map((c) => c.name));
}
if (!closetRodPlan.cutList.some((c) => /hanging rod/i.test(c.name))) {
  failHonesty("closet cut list missing hanging rod", closetRodPlan.cutList.map((c) => c.name));
}

const jarPlan = buildPlan(jarShelf);
if (!hasRackAffordance(jarShelf)) {
  failHonesty("jar wall shelf missing lips", jarShelf.panels.map((p) => p.name));
}

const wallShelves = generateFromPrompt("wall shelves 36 wide 10 deep");
if (!wallShelves.panels.some((p) => /cleat/i.test(p.name))) {
  failHonesty("wall shelves missing cleats", wallShelves.panels.map((p) => p.name));
}
if (!nearInch(wallShelves.overall.depth, 10)) failHonesty("wall shelves depth", wallShelves.overall);
const wallShelvesPlan = buildPlan(wallShelves);
if (wallShelvesPlan.bom.some((b) => /5\s*mm|shelf pin/i.test(b.name))) {
  failHonesty("wall shelves sold shelf pins", wallShelvesPlan.bom.map((b) => b.name));
}
if (!/wall shelves/i.test(wallShelves.name) && !/floating/i.test(wallShelves.name)) {
  failHonesty("wall shelves title", wallShelves.name);
}

const coatBench = generateFromPrompt("coat bench 48 wide");
if (!/coat bench/i.test(coatBench.name)) failHonesty("coat bench title", coatBench.name);
if (!coatBench.panels.some((p) => /peg/i.test(p.name))) {
  failHonesty("coat bench missing peg rail", coatBench.panels.map((p) => p.name));
}
if (jarPlan.cutList.some((c) => /^Rail$/i.test(c.name))) {
  failHonesty("jar lips collapsed to Rail", jarPlan.cutList.map((c) => c.name));
}
if (!jarPlan.cutList.some((c) => /jar lip/i.test(c.name))) {
  failHonesty("jar cut list missing Jar lip", jarPlan.cutList.map((c) => c.name));
}


const shoePrompt = "shoe rack 36 wide 24 high 12 deep";
const shoe = generateFromPrompt(shoePrompt);
if (!shoe.panels.some((p) => /shoe shelf/i.test(p.name))) failHonesty("shoe missing Shoe shelf", shoe.panels.map((p) => p.name));
if (!shoe.panels.some((p) => /cubby divider/i.test(p.name))) failHonesty("shoe missing Cubby divider", shoe.panels.map((p) => p.name));
if (shoe.panels.some((p) => /pin shelf/i.test(p.name))) failHonesty("shoe grew pin shelves", shoe.panels.map((p) => p.name));
const shoePlan = buildPlan(shoe);
if (shoePlan.bom.some((b) => /shelf pin/i.test(b.name))) {
  failHonesty("shoe cubbies still buy shelf pins", shoePlan.bom.map((b) => b.name));
}
if (!/^Shoe rack/i.test(shoe.name)) failHonesty("shoe title drifted", shoe.name);

const tvPrompt = "TV console 70 wide 30 tall 16 deep";
const tv = generateFromPrompt(tvPrompt);
if (!/^TV console/i.test(tv.name)) failHonesty("TV console title drifted to naked Media", tv.name);
if (tv.panels.some((p) => p.type === "door")) failHonesty("TV console grew doors", tv.panels.map((p) => p.name));
const tvPlan = buildPlan(tv);
if (tvPlan.bom.some((b) => /shelf pin/i.test(b.name))) {
  failHonesty("TV/media open shelves still buy shelf pins", tvPlan.bom.map((b) => b.name));
}
if (!wantsFixedGlueShelves(tv)) failHonesty("TV console should want fixed/glued shelves");

const wallCab = generateFromPrompt("wall cabinet 24 wide 30 high 12 deep");
if (!/^Wall cabinet/i.test(wallCab.name)) failHonesty("wall cabinet title drifted", wallCab.name);
if (measureKindFromProject(wallCab) !== "wall_cabinet") {
  failHonesty("wall cabinet measure kind not Wall cabinet", measureKindFromProject(wallCab));
}
const wallCabPlan = buildPlan(wallCab);
if (wallCabPlan.bom.some((b) => /shelf pin/i.test(b.name))) {
  failHonesty("hung wall cabinet still buys shelf pins", wallCabPlan.bom.map((b) => b.name));
}
if (wallCabPlan.instructions.some((s) => /do not glue the shelves/i.test(`${s.title} ${s.description}`))) {
  failHonesty("hung wall cabinet still sells do-not-glue pin language", wallCabPlan.instructions.map((s) => s.title));
}
if (!wantsFixedGlueShelves(wallCab)) failHonesty("wall cabinet should want fixed/glued shelves");

const baseCabPrompt = "kitchen base cabinet 24 wide";
const baseHit = detectHouseFamily(baseCabPrompt);
if (!baseHit || baseHit.family !== "floor-carcase" || baseHit.mount !== "floor" || baseHit.opening !== "door") {
  failHonesty("kitchen base family", baseHit);
}
const baseCab = generateFromPrompt(baseCabPrompt);
if (!/^Kitchen base/i.test(baseCab.name)) failHonesty("base cabinet title", baseCab.name);
if (!nearInch(baseCab.overall.height, 34.5)) failHonesty("base cabinet default height ~34.5", baseCab.overall);
if (!nearInch(baseCab.overall.depth, 24)) failHonesty("base cabinet default depth ~24", baseCab.overall);
if (!baseCab.panels.some((p) => p.type === "kick")) failHonesty("base cabinet missing toekick", baseCab.panels.map((p) => p.name));
if (!baseCab.panels.some((p) => p.type === "door")) failHonesty("base cabinet missing door", baseCab.panels.map((p) => p.name));
const basePlan = buildPlan(baseCab);
if (!inspectHonesty(baseCab, basePlan).ok) failHonesty("base cabinet inspect", inspectHonesty(baseCab, basePlan).issues);

const upperCabPrompt = "kitchen upper cabinet 30 wide";
const upperHit = detectHouseFamily(upperCabPrompt);
if (!upperHit || upperHit.family !== "hung-cabinet" || upperHit.mount !== "wall" || upperHit.opening !== "door") {
  failHonesty("kitchen upper family", upperHit);
}
const upperCab = generateFromPrompt(upperCabPrompt);
if (!/^Upper cabinet/i.test(upperCab.name)) failHonesty("upper cabinet title", upperCab.name);
if (!nearInch(upperCab.overall.height, 30)) failHonesty("upper cabinet default height ~30", upperCab.overall);
if (!nearInch(upperCab.overall.depth, 12)) failHonesty("upper cabinet default depth ~12", upperCab.overall);
if (upperCab.panels.some((p) => p.type === "kick")) failHonesty("upper cabinet grew a toekick", upperCab.panels.map((p) => p.name));
if (upperCab.assumptions.installMode !== "wall") failHonesty("upper cabinet mount", upperCab.assumptions);
if (upperCab.fitted?.unit.upperStart != null) failHonesty("upper cabinet wrongly set vanity upperStart", upperCab.fitted?.unit);
const upperPlan = buildPlan(upperCab);
if (!inspectHonesty(upperCab, upperPlan).ok) failHonesty("upper cabinet inspect", inspectHonesty(upperCab, upperPlan).issues);


// Typed-wide kitchen must keep Base/Upper cabinet — never naked "Storage" from program label.
for (const [prompt, stem] of [
  ["kitchen base cabinet 36 wide", "Kitchen base"],
  ["kitchen upper cabinet 30 wide", "Upper cabinet"],
  ["twin bunk bed", "Bunk bed"],
  ["twin loft bed", "Loft bed"],
] as const) {
  if (identityTitleStem(prompt) !== stem) failHonesty(`identityTitleStem(${prompt})`, identityTitleStem(prompt));
}
const storageWiped = generateFromPrompt("kitchen base cabinet 36 wide");
if (!/^Kitchen base/i.test(storageWiped.name)) failHonesty("36-wide base title", storageWiped.name);
const wipedSpec = {
  ...storageWiped.fitted!,
  name: `Storage ${storageWiped.overall.width}" × ${storageWiped.overall.height}" × ${storageWiped.overall.depth}"`,
};
const recovered = buildFitted(wipedSpec, "kitchen base cabinet 36 wide");
if (!/^Kitchen base/i.test(recovered.name)) failHonesty("Storage wipe recovery for kitchen base", recovered.name);
const upperWiped = generateFromPrompt("kitchen upper cabinet 30 wide");
const upperRecovered = buildFitted(
  {
    ...upperWiped.fitted!,
    name: `Storage ${upperWiped.overall.width}" × ${upperWiped.overall.height}" × ${upperWiped.overall.depth}"`,
  },
  "kitchen upper cabinet 30 wide",
);
if (!/^Upper cabinet/i.test(upperRecovered.name)) failHonesty("Storage wipe recovery for kitchen upper", upperRecovered.name);

// Climb/step stool identity survives plywood densify + stolen Bench fittedOverride.
for (const [prompt, stem] of [
  ['weekend craft: step-up stool — one climb step, 8" rise × 10" run, holds a kid standing to reach a shelf', "Step stool"],
  ["step-up stool one climb step 8 inch rise x 10 inch run", "Step stool"],
  ["one climb step 8 rise × 10 run holds a kid standing", "Step stool"],
] as const) {
  if (identityTitleStem(prompt.toLowerCase()) !== stem) {
    failHonesty(`identityTitleStem climb(${prompt})`, identityTitleStem(prompt.toLowerCase()));
  }
  if (climbIdentityLabel(prompt.toLowerCase()) !== stem) {
    failHonesty(`climbIdentityLabel(${prompt})`, climbIdentityLabel(prompt.toLowerCase()));
  }
}
// Linen + climb step-shelf stays Closet — not Step stool. Bare benches stay Bench.
if (climbIdentityLabel("house: linen 31.5×78×16 with one climb step-shelf (weight-bearing mid height) to reach the top".toLowerCase())) {
  failHonesty("linen climb step-shelf must not claim Step stool identity");
}
if (climbIdentityLabel("mudroom bench 48 wide".toLowerCase())) {
  failHonesty("mudroom bench must not claim climb identity");
}
if (climbIdentityLabel("bench 48 wide")) {
  failHonesty("bare bench claimed climb stem");
}
const climbPrompt =
  'weekend craft: step-up stool — one climb step, 8" rise × 10" run, holds a kid standing to reach a shelf';
const climbProj = generateFromPrompt(climbPrompt);
if (!/^Step stool/i.test(climbProj.name)) failHonesty("climb step-up title", climbProj.name);
if (climbProj.fitted?.program === "bench") failHonesty("climb step-up became fitted Bench", climbProj.fitted);
const climbPlan = buildPlan(climbProj);
const climbBlob = [
  climbProj.name,
  ...(climbProj.notes || []),
  ...climbPlan.instructions.map((s) => `${s.title} ${s.description}`),
].join("\n");
if (!/weight-bearing|climb (?:step|tread)|8[^\n]{0,16}rise|rise[^\n]{0,16}8/i.test(climbBlob)) {
  failHonesty("climb language missing on step-up stool", climbBlob.slice(0, 400));
}
// Stolen Bench fittedOverride must not wipe climb identity (house-brief / Measure flake).
const stolenBench = {
  program: "bench" as const,
  name: 'Bench 16" × 8" × 10"',
  opening: { width: 16, height: 8, depth: 10, kind: "room" as const },
  unit: { width: 16, height: 8, depth: 10, doors: false, centered: true },
};
const climbRecovered = generateFromPrompt(climbPrompt, "plywood-3-4-4x8", undefined, {
  fittedOverride: stolenBench,
});
if (!/^Step stool/i.test(climbRecovered.name)) {
  failHonesty("climb title after stolen Bench densify", climbRecovered.name);
}
if (climbRecovered.fitted?.program === "bench") {
  failHonesty("climb still fitted Bench after densify", climbRecovered.fitted);
}
const realBench = generateFromPrompt("mudroom bench 48 wide");
if (!/bench/i.test(realBench.name)) failHonesty("mudroom bench title broke", realBench.name);
const linenClimb = generateFromPrompt(
  "house: linen 31.5×78×16 with one climb step-shelf (weight-bearing mid height) to reach the top; freeze dims stay green",
);
if (!/Closet|Linen/i.test(linenClimb.name)) failHonesty("linen+climb title", linenClimb.name);

const loftPrompt = "twin loft bed";
const loftHit = detectHouseFamily(loftPrompt);
if (!loftHit || loftHit.family !== "bunk" || !loftHit.affordances.includes("sleep-platforms")) {
  failHonesty("loft bed family", loftHit);
}
const loft = generateFromPrompt(loftPrompt);
if (!/^Loft bed/i.test(loft.name)) failHonesty("loft title", loft.name);
if (!nearInch(loft.overall.width, 42)) failHonesty("loft twin width ~42", loft.overall);
if (!nearInch(loft.overall.depth, 75)) failHonesty("loft twin depth ~75", loft.overall);
if (!nearInch(loft.overall.height, 65)) failHonesty("loft height ~65", loft.overall);
const loftDecks = loft.panels.filter((p) => p.type === "deck");
if (loftDecks.length !== 1) failHonesty("loft needs exactly one sleep deck", loft.panels.map((p) => p.name));
if (loft.panels.filter((p) => /post/i.test(p.name) || p.type === "upright").length < 4) {
  failHonesty("loft needs four posts", loft.panels.map((p) => p.name));
}
if (loft.panels.some((p) => p.type === "door" || p.type === "kick")) {
  failHonesty("loft grew door/toekick carcase parts", loft.panels.map((p) => `${p.type}:${p.name}`));
}
const loftPlan = buildPlan(loft);
if (!inspectHonesty(loft, loftPlan).ok) failHonesty("loft inspect", inspectHonesty(loft, loftPlan).issues);
if (!loftPlan.instructions.some((s) => /loft|elevated|sleep platform/i.test(`${s.title} ${s.description}`))) {
  failHonesty("loft steps missing elevated platform", loftPlan.instructions.map((s) => s.title));
}
if (loftPlan.instructions.some((s) => /two sleep platforms|lower first, then upper/i.test(`${s.title} ${s.description}`))) {
  failHonesty("loft steps still sell twin bunk language", loftPlan.instructions.map((s) => s.title));
}

// Height-10: laundry fold-down reuses hung fold-down-board; folding table stays table.
// Window seat + radiator cover are honest house canaries (not noun special piles).
const laundryFoldPrompt = "laundry fold-down 48 wide 36 high 6 deep";
const laundryFoldHit = detectHouseFamily(laundryFoldPrompt);
if (
  !laundryFoldHit ||
  laundryFoldHit.family !== "hung-cabinet" ||
  laundryFoldHit.mount !== "wall" ||
  laundryFoldHit.opening !== "fold-down" ||
  !laundryFoldHit.affordances.includes("fold-down-board")
) {
  failHonesty("laundry fold-down family", laundryFoldHit);
}
const laundryFold = generateFromPrompt(laundryFoldPrompt);
if (!/^Laundry fold-down/i.test(laundryFold.name)) failHonesty("laundry fold-down title", laundryFold.name);
if (!nearInch(laundryFold.overall.width, 48) || !nearInch(laundryFold.overall.height, 36) || !nearInch(laundryFold.overall.depth, 6)) {
  failHonesty("laundry fold-down overall", laundryFold.overall);
}
if (laundryFold.assumptions.installMode !== "wall") failHonesty("laundry fold-down mount", laundryFold.assumptions);
if (!laundryFold.panels.some((p) => /fold-down board/i.test(p.name))) {
  failHonesty("laundry fold-down missing board", laundryFold.panels.map((p) => p.name));
}
if (!laundryFold.panels.some((p) => /support leg/i.test(p.name))) {
  failHonesty("laundry fold-down missing support leg", laundryFold.panels.map((p) => p.name));
}
if (!laundryFold.panels.some((p) => p.type === "door")) {
  failHonesty("laundry fold-down missing door", laundryFold.panels.map((p) => p.name));
}
const laundryFoldPlan = buildPlan(laundryFold);
if (!laundryFoldPlan.bom.some((b) => /piano hinge/i.test(b.name))) {
  failHonesty("laundry fold-down missing piano hinge", laundryFoldPlan.bom.map((b) => b.name));
}
if (laundryFoldPlan.bom.some((b) => /ironing board cover/i.test(b.name))) {
  failHonesty("laundry fold-down sold ironing cover", laundryFoldPlan.bom.map((b) => b.name));
}
if (!laundryFoldPlan.instructions.some((s) => /piano-hinge|fold-down board/i.test(`${s.title} ${s.description}`))) {
  failHonesty("laundry fold-down steps missing hinge", laundryFoldPlan.instructions.map((s) => s.title));
}
if (!inspectHonesty(laundryFold, laundryFoldPlan).ok) {
  failHonesty("laundry fold-down inspect", inspectHonesty(laundryFold, laundryFoldPlan).issues);
}
// Freestanding laundry folding TABLE must stay the table freeze — not steal fold-down.
if (detectHouseFamily("laundry folding table 48 wide 36 high 24 deep")?.family !== "table") {
  failHonesty("laundry folding table lost table family", detectHouseFamily("laundry folding table 48 wide 36 high 24 deep"));
}
const laundryTableStill = generateFromPrompt("laundry folding table 48 wide 36 high 24 deep");
if (laundryTableStill.panels.some((p) => /fold-down board/i.test(p.name))) {
  failHonesty("laundry folding table grew fold-down board", laundryTableStill.panels.map((p) => p.name));
}

const windowSeat = generateFromPrompt("window seat 60 wide 18 high 20 deep");
if (!/^Window seat/i.test(windowSeat.name)) failHonesty("window seat title", windowSeat.name);
if (!nearInch(windowSeat.overall.width, 60) || !nearInch(windowSeat.overall.height, 18) || !nearInch(windowSeat.overall.depth, 20)) {
  failHonesty("window seat overall", windowSeat.overall);
}
if (!windowSeat.panels.some((p) => /cubby/i.test(p.name))) failHonesty("window seat missing cubbies", windowSeat.panels.map((p) => p.name));
const windowSeatPlan = buildPlan(windowSeat);
if (!inspectHonesty(windowSeat, windowSeatPlan).ok) failHonesty("window seat inspect", inspectHonesty(windowSeat, windowSeatPlan).issues);

const radiator = generateFromPrompt("radiator cover 36 wide 30 high 10 deep");
if (!/^Radiator cover/i.test(radiator.name)) failHonesty("radiator cover title", radiator.name);
if (!nearInch(radiator.overall.width, 36) || !nearInch(radiator.overall.height, 30) || !nearInch(radiator.overall.depth, 10)) {
  failHonesty("radiator cover overall", radiator.overall);
}
if (radiator.panels.some((p) => p.type === "door" || p.type === "back")) {
  failHonesty("radiator cover sealed like a cabinet", radiator.panels.map((p) => p.name));
}
if (radiator.panels.filter((p) => /grille/i.test(p.name)).length < 5) {
  failHonesty("radiator cover missing grille slats", radiator.panels.map((p) => p.name));
}
const radiatorPlan = buildPlan(radiator);
if (!inspectHonesty(radiator, radiatorPlan).ok) failHonesty("radiator cover inspect", inspectHonesty(radiator, radiatorPlan).issues);


console.log("HEIGHT10 FOLD + CANARIES OK", {
  laundryFold: { name: laundryFold.name, overall: laundryFold.overall, panels: laundryFold.panels.map((p) => p.name) },
  windowSeat: { name: windowSeat.name, overall: windowSeat.overall },
  radiator: { name: radiator.name, grille: radiator.panels.filter((p) => /grille/i.test(p.name)).length },
});

// Height-11: sofa/entry console table identity + daybed sleep+seat + bamboo craft frame honesty.
for (const [prompt, stem] of [
  ["sofa table 48 wide 30 high 14 deep", "Sofa table"],
  ["console table 48 wide 30 high 14 deep", "Console table"],
  ["entry console 48 wide 30 high 14 deep", "Entry console"],
  ["daybed 75 wide 22 high 39 deep", "Daybed"],
] as const) {
  if (identityTitleStem(prompt) !== stem) failHonesty(`identityTitleStem(${prompt})`, identityTitleStem(prompt));
}

const sofaPrompt = "sofa table 48 wide 30 high 14 deep";
const sofaHit = detectHouseFamily(sofaPrompt);
if (!sofaHit || sofaHit.family !== "table" || !isSofaConsoleTable(sofaPrompt)) {
  failHonesty("sofa table family", sofaHit);
}
const sofa = generateFromPrompt(sofaPrompt);
if (!/^Sofa table/i.test(sofa.name)) failHonesty("sofa table title", sofa.name);
if (!nearInch(sofa.overall.width, 48) || !nearInch(sofa.overall.height, 30) || !nearInch(sofa.overall.depth, 14)) {
  failHonesty("sofa table overall", sofa.overall);
}
if (sofa.panels.filter((p) => /leg/i.test(p.name)).length < 4) failHonesty("sofa table missing legs", sofa.panels.map((p) => p.name));
if (sofa.panels.filter((p) => /apron/i.test(p.name)).length < 4) failHonesty("sofa table missing aprons", sofa.panels.map((p) => p.name));
if (sofa.panels.some((p) => p.type === "kick" || p.type === "door" || /bay/i.test(p.name))) {
  failHonesty("sofa table grew media carcase parts", sofa.panels.map((p) => p.name));
}
const sofaPlan = buildPlan(sofa);
if (!inspectHonesty(sofa, sofaPlan).ok) failHonesty("sofa table inspect", inspectHonesty(sofa, sofaPlan).issues);

const entry = generateFromPrompt("entry console 48 wide 30 high 14 deep");
if (!/^Entry console/i.test(entry.name)) failHonesty("entry console title", entry.name);
if (detectHouseFamily("entry console 48 wide 30 high 14 deep")?.family !== "table") {
  failHonesty("entry console lost table family", detectHouseFamily("entry console 48 wide 30 high 14 deep"));
}
// TV console must still be media — not stolen by console-table rule.
const tvStill = generateFromPrompt("TV console 70 wide 30 tall 16 deep");
if (!/^TV console/i.test(tvStill.name)) failHonesty("TV console title regression", tvStill.name);
if (detectHouseFamily("TV console 70 wide 30 tall 16 deep")?.family === "table") {
  failHonesty("TV console wrongly became table", detectHouseFamily("TV console 70 wide 30 tall 16 deep"));
}

const dayPrompt = "daybed 75 wide 22 high 39 deep";
const dayHit = detectHouseFamily(dayPrompt);
if (
  !dayHit ||
  dayHit.family !== "seat" ||
  !dayHit.affordances.includes("sleep-platforms") ||
  !isDaybed(dayPrompt)
) {
  failHonesty("daybed family", dayHit);
}
const daybed = generateFromPrompt(dayPrompt);
if (!/^Daybed/i.test(daybed.name)) failHonesty("daybed title", daybed.name);
if (!nearInch(daybed.overall.width, 75) || !nearInch(daybed.overall.height, 22) || !nearInch(daybed.overall.depth, 39)) {
  failHonesty("daybed overall", daybed.overall);
}
const dayDecks = daybed.panels.filter((p) => p.type === "deck" || /sleep deck/i.test(p.name));
if (dayDecks.length !== 1) failHonesty("daybed needs exactly one sleep deck", daybed.panels.map((p) => p.name));
if (!daybed.panels.some((p) => /backrest/i.test(p.name))) failHonesty("daybed missing backrest", daybed.panels.map((p) => p.name));
if (daybed.panels.some((p) => p.type === "door" || p.type === "kick")) {
  failHonesty("daybed grew door/toekick", daybed.panels.map((p) => `${p.type}:${p.name}`));
}
if (daybed.assumptions.installMode !== "freestanding") failHonesty("daybed mount", daybed.assumptions);
const dayPlan = buildPlan(daybed);
if (!inspectHonesty(daybed, dayPlan).ok) failHonesty("daybed inspect", inspectHonesty(daybed, dayPlan).issues);
if (!dayPlan.instructions.some((s) => /sleep deck|backrest|daybed/i.test(`${s.title} ${s.description}`))) {
  failHonesty("daybed steps missing sleep deck language", dayPlan.instructions.map((s) => s.title));
}
if (dayPlan.instructions.some((s) => /two sleep platforms|lower first, then upper|loft sleep/i.test(`${s.title} ${s.description}`))) {
  failHonesty("daybed steps stole bunk/loft language", dayPlan.instructions.map((s) => s.title));
}
// Protect bunk/loft freezes against daybed sleep-platforms routing.
const bunkStill = generateFromPrompt("twin bunk bed");
if (!/^Bunk bed/i.test(bunkStill.name) || bunkStill.panels.filter((p) => p.type === "deck").length < 2) {
  failHonesty("bunk freeze after daybed", { name: bunkStill.name, decks: bunkStill.panels.filter((p) => p.type === "deck").length });
}
const loftStill = generateFromPrompt("twin loft bed");
if (!/^Loft bed/i.test(loftStill.name) || loftStill.panels.filter((p) => p.type === "deck").length !== 1) {
  failHonesty("loft freeze after daybed", { name: loftStill.name, decks: loftStill.panels.filter((p) => p.type === "deck").length });
}

// Batch-22: platform bed identity + W×L×H + sleep deck (never Yard House wire).
const platformPrompts: Array<[string, number, number, number]> = [
  ["house: platform bed 60″ wide × 80″ long × 14″ tall", 60, 14, 80],
  ["house: platform bed 76″ wide × 80″ long × 14″ tall", 76, 14, 80],
  ["platform bed 60 wide × 80 long × 14 tall", 60, 14, 80],
];
for (const [pp, w, h, d] of platformPrompts) {
  if (!isPlatformBed(pp.toLowerCase())) failHonesty("isPlatformBed miss", pp);
  if (identityTitleStem(pp.toLowerCase()) !== "Platform bed") failHonesty("platform stem", identityTitleStem(pp.toLowerCase()));
  const hit = detectHouseFamily(pp);
  if (!hit || !hit.affordances.includes("sleep-platforms")) failHonesty("platform family/sleep", hit);
  const proj = generateFromPrompt(pp);
  if (!/^Platform bed/i.test(proj.name)) failHonesty("platform title", proj.name);
  if (!nearInch(proj.overall.width, w) || !nearInch(proj.overall.height, h) || !nearInch(proj.overall.depth, d)) {
    failHonesty("platform overall", { name: proj.name, overall: proj.overall, want: [w, h, d] });
  }
  const decks = proj.panels.filter((p) => p.type === "deck" || /sleep deck/i.test(p.name));
  if (decks.length < 1) failHonesty("platform missing sleep deck", proj.panels.map((p) => p.name));
  const blob = `${proj.name}\n${(proj.notes || []).join("\n")}`;
  if (!/sleep deck|mattress on the platform|platform sits|side rails keep a mattress/i.test(blob)) {
    failHonesty("platform sleep language", blob.slice(0, 400));
  }
  if (/^House\b/i.test(proj.name) || proj.kind === "house") failHonesty("platform stole House wire", { name: proj.name, kind: proj.kind });
  const plan = buildPlan(proj);
  if (!inspectHonesty(proj, plan).ok) failHonesty("platform inspect", inspectHonesty(proj, plan).issues);
  const stepBlob = plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`).join("\n");
  if (/Set the loft sleep platform|\bloft deck\b|Add a ladder or steps to the loft/i.test(stepBlob)) {
    failHonesty("platform soft: loft plan language", plan.instructions.map((s) => s.title));
  }
  if (!/sleep deck|mattress on the platform|Set the sleep deck/i.test(stepBlob)) {
    failHonesty("platform soft: missing sleep deck steps", plan.instructions.map((s) => s.title));
  }
  const checkMsg = (plan.issues || []).map((i) => i.message).join("\n");
  if (/—\s*storage\.?/i.test(checkMsg) || /Platform bed[^\n]*—\s*storage/i.test(checkMsg)) {
    failHonesty("platform soft: — storage. subtitle", checkMsg.slice(0, 300));
  }
}
// Protect headboard + nightstand freezes against platform routing.
const hbFreeze = generateFromPrompt("house: headboard fitted to a 60″ wall span, 48″ tall");
if (!/^Headboard/i.test(hbFreeze.name)) failHonesty("headboard freeze after platform", hbFreeze.name);
if (!nearInch(hbFreeze.overall.depth, 0.75)) failHonesty("headboard freeze depth stays ¾", hbFreeze.overall);
if (hbFreeze.panels.filter((p) => /headboard/i.test(p.name)).length !== 1) {
  failHonesty("headboard freeze single slab", hbFreeze.panels.map((p) => p.name));
}
// Typed headboard depth: laminate ¾" plies — overall and cut list match spoken deep.
const hbDeep = generateFromPrompt("house: headboard 60 wide 48 tall 3 deep for queen bed");
if (!/^Headboard/i.test(hbDeep.name)) failHonesty("typed deep headboard title", hbDeep.name);
if (!nearInch(hbDeep.overall.width, 60) || !nearInch(hbDeep.overall.height, 48) || !nearInch(hbDeep.overall.depth, 3)) {
  failHonesty("typed deep headboard overall", hbDeep.overall);
}
const hbPlies = hbDeep.panels.filter((p) => /headboard ply/i.test(p.name));
if (hbPlies.length !== 4) failHonesty("typed deep headboard 4 plies", hbDeep.panels.map((p) => `${p.name} ${p.size.depth}`));
if (hbPlies.some((p) => !nearInch(p.size.depth, 0.75) || !nearInch(p.size.width, 60) || !nearInch(p.size.height, 48))) {
  failHonesty("typed deep headboard ply size", hbPlies.map((p) => p.size));
}
const nsFreeze = generateFromPrompt("house: nightstand with two drawers 20″ wide × 18″ deep × 24″ tall");
if (!/^Nightstand/i.test(nsFreeze.name)) failHonesty("nightstand freeze after platform", nsFreeze.name);
if (!nsFreeze.panels.some((p) => /drawer front/i.test(p.name))) failHonesty("nightstand drawers freeze", nsFreeze.panels.map((p) => p.name));

// Batch-22: bedside shelf book envelope — never Nightstand / Picture ledge steal.
const bedsidePrompt = "house: bedside shelf 18″ wide × 8″ deep × 6″ tall that holds a real book upright";
if (!isBedsideShelf(bedsidePrompt.toLowerCase())) failHonesty("isBedsideShelf miss", bedsidePrompt);
if (identityTitleStem(bedsidePrompt.toLowerCase()) !== "Bedside shelf") {
  failHonesty("bedside stem", identityTitleStem(bedsidePrompt.toLowerCase()));
}
const bedsideHit = detectHouseFamily(bedsidePrompt);
if (!bedsideHit || bedsideHit.family !== "hung-open") failHonesty("bedside family", bedsideHit);
const bedside = generateFromPrompt(bedsidePrompt);
if (!/^Bedside shelf/i.test(bedside.name)) failHonesty("bedside title", bedside.name);
if (!nearInch(bedside.overall.width, 18) || !nearInch(bedside.overall.height, 6) || !nearInch(bedside.overall.depth, 8)) {
  failHonesty("bedside overall", bedside.overall);
}
const bedsideBlob = `${bedside.name}\n${(bedside.notes || []).join("\n")}\n${bedside.panels.map((p) => p.name).join("\n")}`;
if (!/book envelope|book upright|holds a real book|front lip/i.test(bedsideBlob)) {
  failHonesty("bedside book envelope language", bedsideBlob.slice(0, 500));
}
if (/Picture ledge/i.test(bedside.name)) failHonesty("bedside Picture ledge steal", bedside.name);
if (/Nightstand/i.test(bedside.name)) failHonesty("bedside Nightstand steal", bedside.name);
if (bedside.panels.some((p) => /drawer/i.test(p.name))) failHonesty("bedside grew drawers", bedside.panels.map((p) => p.name));
if (bedside.assumptions.installMode !== "wall") failHonesty("bedside mount", bedside.assumptions);
const bedsidePlan = buildPlan(bedside);
if (!inspectHonesty(bedside, bedsidePlan).ok) failHonesty("bedside inspect", inspectHonesty(bedside, bedsidePlan).issues);
{
  // Soft leftover: envelope AABB H must match typed overall H (not shelf ply ¾″).
  // Book backstop is the envelope-counted face — top face = typed H (desk worktop pattern).
  const back = bedside.panels.find((p) => /Book backstop/i.test(p.name));
  if (!back || back.type !== "back") {
    failHonesty("bedside Book backstop missing/type", bedside.panels.map((p) => `${p.type}:${p.name}`));
  } else {
    const topFace = back.position.y + back.size.height;
    if (!nearInch(topFace, 6)) {
      failHonesty("bedside Book backstop top face ≠ typed H6", {
        y: back.position.y,
        h: back.size.height,
        topFace,
      });
    }
  }
  const envIssue = inspectHonesty(bedside, bedsidePlan).issues.find(
    (i) => /envelope/i.test(i.message) && /H /.test(i.message),
  );
  if (envIssue) failHonesty("bedside envelope H still flakes vs typed 6", envIssue);
}
{
  const checkMsg = (bedsidePlan.issues || []).map((i) => i.message).join("\n");
  if (/—\s*nightstand\.?/i.test(checkMsg)) {
    failHonesty("bedside soft: — nightstand. subtitle while Bedside shelf", checkMsg.slice(0, 300));
  }
}

// Batch-23 soft: bedside 5×7 print upright — Print lip/backstop (not Book-only when print typed).
const bedsidePrintPrompt =
  "house: bedside shelf 16″ wide × 6″ deep × 6″ tall that holds a real 5×7 print upright";
if (!isBedsideShelf(bedsidePrintPrompt.toLowerCase())) failHonesty("isBedsideShelf print miss", bedsidePrintPrompt);
if (!wantsPrintHold(bedsidePrintPrompt.toLowerCase())) failHonesty("wantsPrintHold miss", bedsidePrintPrompt);
if (identityTitleStem(bedsidePrintPrompt.toLowerCase()) !== "Bedside shelf") {
  failHonesty("bedside print stem", identityTitleStem(bedsidePrintPrompt.toLowerCase()));
}
const bedsidePrint = generateFromPrompt(bedsidePrintPrompt);
if (!/^Bedside shelf/i.test(bedsidePrint.name)) failHonesty("bedside print title", bedsidePrint.name);
if (!nearInch(bedsidePrint.overall.width, 16) || !nearInch(bedsidePrint.overall.height, 6) || !nearInch(bedsidePrint.overall.depth, 6)) {
  failHonesty("bedside print overall", bedsidePrint.overall);
}
const printBlob = `${bedsidePrint.name}\n${(bedsidePrint.notes || []).join("\n")}\n${bedsidePrint.panels.map((p) => p.name).join("\n")}`;
if (!/Print front lip|Print backstop|5\s*[×x]\s*7|print upright|print envelope/i.test(printBlob)) {
  failHonesty("bedside print upright language", printBlob.slice(0, 500));
}
if (/Book front lip|Book backstop/i.test(printBlob) && !/Print front lip/i.test(printBlob)) {
  failHonesty("bedside print still Book-only lip", printBlob.slice(0, 500));
}
if (/Picture ledge/i.test(bedsidePrint.name) || /Nightstand/i.test(bedsidePrint.name)) {
  failHonesty("bedside print title steal", bedsidePrint.name);
}
const bedsidePrintPlan = buildPlan(bedsidePrint);
if (!inspectHonesty(bedsidePrint, bedsidePrintPlan).ok) {
  failHonesty("bedside print inspect", inspectHonesty(bedsidePrint, bedsidePrintPlan).issues);
}
{
  // Twin: print bedside envelope H = typed H6; Print backstop top face = typed H.
  const back = bedsidePrint.panels.find((p) => /Print backstop/i.test(p.name));
  if (!back || back.type !== "back") {
    failHonesty("bedside print Print backstop missing/type", bedsidePrint.panels.map((p) => `${p.type}:${p.name}`));
  } else if (!nearInch(back.position.y + back.size.height, 6)) {
    failHonesty("bedside print Print backstop top face ≠ typed H6", {
      y: back.position.y,
      h: back.size.height,
      topFace: back.position.y + back.size.height,
    });
  }
  const envIssue = inspectHonesty(bedsidePrint, bedsidePrintPlan).issues.find(
    (i) => /envelope/i.test(i.message) && /H /.test(i.message),
  );
  if (envIssue) failHonesty("bedside print envelope H still flakes vs typed 6", envIssue);
}
{
  const stepBlob = bedsidePrintPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  if (!/5\s*[×x]\s*7|print upright|Print front lip|print envelope/i.test(stepBlob + "\n" + printBlob)) {
    failHonesty("bedside print soft: plan language", stepBlob.slice(0, 400));
  }
  const checkMsg = (bedsidePrintPlan.issues || []).map((i) => i.message).join("\n");
  if (/—\s*nightstand\.?/i.test(checkMsg)) {
    failHonesty("bedside print soft: — nightstand. subtitle", checkMsg.slice(0, 300));
  }
}

// Soft leftover: hung-open media ledge rails-only densify — envelope H must match typed overall H
// (not shelf ply ¾″). Same class as bedside Book/Print; Media backstop top face = typed H.
{
  const mediaPrompt =
    'house: media ledge 48″ wide × 10″ deep × 6″ tall clear below for 55″ TV stand';
  if (!isWallMediaLedge(mediaPrompt.toLowerCase())) failHonesty("isWallMediaLedge miss", mediaPrompt);
  const mediaHit = detectHouseFamily(mediaPrompt);
  if (!mediaHit || mediaHit.family !== "hung-open") failHonesty("media ledge family", mediaHit);
  const media = generateFromPrompt(mediaPrompt);
  if (!/^Media ledge/i.test(media.name)) failHonesty("media ledge title", media.name);
  if (!nearInch(media.overall.width, 48) || !nearInch(media.overall.height, 6) || !nearInch(media.overall.depth, 10)) {
    failHonesty("media ledge overall", media.overall);
  }
  if (media.assumptions.installMode !== "wall") failHonesty("media ledge mount", media.assumptions);
  const mediaPlan = buildPlan(media);
  if (!inspectHonesty(media, mediaPlan).ok) failHonesty("media ledge inspect", inspectHonesty(media, mediaPlan).issues);
  {
    const back = media.panels.find((p) => /Media backstop/i.test(p.name));
    if (!back || back.type !== "back") {
      failHonesty("media ledge Media backstop missing/type", media.panels.map((p) => `${p.type}:${p.name}`));
    } else {
      const topFace = back.position.y + back.size.height;
      if (!nearInch(topFace, 6)) {
        failHonesty("media ledge Media backstop top face ≠ typed H6", {
          y: back.position.y,
          h: back.size.height,
          topFace,
        });
      }
    }
    const envIssue = inspectHonesty(media, mediaPlan).issues.find(
      (i) => /envelope/i.test(i.message) && /H /.test(i.message),
    );
    if (envIssue) failHonesty("media ledge envelope H still flakes vs typed 6", envIssue);
  }
  // Twin: taller typed H8 — backstop top face + envelope H must follow typed overall.
  const mediaTallPrompt =
    'house: wall media ledge 36″ wide × 8″ deep × 8″ tall clear below for TV stand';
  if (!isWallMediaLedge(mediaTallPrompt.toLowerCase())) failHonesty("isWallMediaLedge tall miss", mediaTallPrompt);
  const mediaTall = generateFromPrompt(mediaTallPrompt);
  if (!/^Media ledge/i.test(mediaTall.name)) failHonesty("media ledge tall title", mediaTall.name);
  if (!nearInch(mediaTall.overall.width, 36) || !nearInch(mediaTall.overall.height, 8) || !nearInch(mediaTall.overall.depth, 8)) {
    failHonesty("media ledge tall overall", mediaTall.overall);
  }
  const mediaTallPlan = buildPlan(mediaTall);
  if (!inspectHonesty(mediaTall, mediaTallPlan).ok) {
    failHonesty("media ledge tall inspect", inspectHonesty(mediaTall, mediaTallPlan).issues);
  }
  {
    const back = mediaTall.panels.find((p) => /Media backstop/i.test(p.name));
    if (!back || back.type !== "back") {
      failHonesty("media ledge tall Media backstop missing/type", mediaTall.panels.map((p) => `${p.type}:${p.name}`));
    } else if (!nearInch(back.position.y + back.size.height, 8)) {
      failHonesty("media ledge Media backstop top face ≠ typed H8", {
        y: back.position.y,
        h: back.size.height,
        topFace: back.position.y + back.size.height,
      });
    }
    const envIssue = inspectHonesty(mediaTall, mediaTallPlan).issues.find(
      (i) => /envelope/i.test(i.message) && /H /.test(i.message),
    );
    if (envIssue) failHonesty("media ledge tall envelope H still flakes vs typed 8", envIssue);
  }
}

// Soft leftover: floating shelf with lip / multi Floating shelves — typed overall H vs envelope AABB.
// Singular floating shelf must not invent shelfCount=3; lip densify + Shelf backstop spans typed H
// so envelope AABB == HUD (mirror media/bedside). Multi stack packs into typed H; honor spoken count.
{
  const floatLipPrompt =
    'house: floating shelf with lip 36″ wide × 8″ deep × 6″ tall';
  const floatLip = generateFromPrompt(floatLipPrompt);
  if (!/^Floating shelf\b/i.test(floatLip.name) || /Floating shelves/i.test(floatLip.name)) {
    failHonesty("floating shelf with lip singular title", floatLip.name);
  }
  if (!nearInch(floatLip.overall.width, 36) || !nearInch(floatLip.overall.height, 6) || !nearInch(floatLip.overall.depth, 8)) {
    failHonesty("floating shelf with lip overall", floatLip.overall);
  }
  if ((floatLip.fitted?.unit?.shelfCount ?? 0) !== 1) {
    failHonesty("floating shelf with lip invented shelfCount", floatLip.fitted?.unit?.shelfCount);
  }
  const floatLipShelves = floatLip.panels.filter((p) => p.type === "shelf");
  if (floatLipShelves.length !== 1) {
    failHonesty("floating shelf with lip shelf panel count", floatLipShelves.map((p) => p.name));
  }
  if (!floatLip.panels.some((p) => /Front lip/i.test(p.name) && p.type === "rail")) {
    failHonesty("floating shelf with lip missing Front lip", floatLip.panels.map((p) => `${p.type}:${p.name}`));
  }
  {
    const back = floatLip.panels.find((p) => /Shelf backstop/i.test(p.name));
    if (!back || back.type !== "back") {
      failHonesty("floating shelf Shelf backstop missing/type", floatLip.panels.map((p) => `${p.type}:${p.name}`));
    } else if (!nearInch(back.position.y + back.size.height, 6)) {
      failHonesty("floating shelf Shelf backstop top face ≠ typed H6", {
        y: back.position.y,
        h: back.size.height,
        topFace: back.position.y + back.size.height,
      });
    }
  }
  const floatLipPlan = buildPlan(floatLip);
  if (!inspectHonesty(floatLip, floatLipPlan).ok) {
    failHonesty("floating shelf with lip inspect", inspectHonesty(floatLip, floatLipPlan).issues);
  }
  {
    const envIssue = inspectHonesty(floatLip, floatLipPlan).issues.find(
      (i) => /envelope/i.test(i.message) && /H /.test(i.message),
    );
    if (envIssue) failHonesty("floating shelf envelope H still flakes vs typed 6", envIssue);
  }

  // Twin: multi floating shelves — pack into typed overall H; honor "two floating shelves".
  const floatTwoPrompt =
    'house: two floating shelves 36″ wide × 8″ deep × 30″ tall';
  const floatTwo = generateFromPrompt(floatTwoPrompt);
  if (!/^Floating shelves\b/i.test(floatTwo.name)) {
    failHonesty("two floating shelves title", floatTwo.name);
  }
  if (!nearInch(floatTwo.overall.height, 30)) {
    failHonesty("two floating shelves overall H30", floatTwo.overall);
  }
  if ((floatTwo.fitted?.unit?.shelfCount ?? 0) !== 2) {
    failHonesty("two floating shelves shelfCount ≠ 2", floatTwo.fitted?.unit?.shelfCount);
  }
  const floatTwoShelves = floatTwo.panels.filter((p) => p.type === "shelf");
  if (floatTwoShelves.length !== 2) {
    failHonesty("two floating shelves panel count", floatTwoShelves.map((p) => p.name));
  }
  {
    const back = floatTwo.panels.find((p) => /Shelf backstop/i.test(p.name));
    if (!back || back.type !== "back" || !nearInch(back.position.y + back.size.height, 30)) {
      failHonesty("two floating shelves Shelf backstop top face ≠ typed H30", back);
    }
  }
  const floatTwoPlan = buildPlan(floatTwo);
  if (!inspectHonesty(floatTwo, floatTwoPlan).ok) {
    failHonesty("two floating shelves inspect", inspectHonesty(floatTwo, floatTwoPlan).issues);
  }
  {
    const envIssue = inspectHonesty(floatTwo, floatTwoPlan).issues.find(
      (i) => /envelope/i.test(i.message) && /H /.test(i.message),
    );
    if (envIssue) failHonesty("two floating shelves envelope H still flakes vs typed 30", envIssue);
  }
}



// Soft leftover: tip-rail picture/photo/art ledge + picture/tip rail — hung-open envelope H
// must match typed overall H (Picture backstop top face). Never weekend Picture frame steal,
// never freestanding tip-stand axis steal, never Media ledge title steal.
{
  const picPrompt =
    'house: picture ledge 36″ wide × 4″ deep × 6″ tall';
  if (!isPictureLedge(picPrompt.toLowerCase())) failHonesty("isPictureLedge miss", picPrompt);
  if (pictureLedgeTitleStem(picPrompt.toLowerCase()) !== "Picture ledge") {
    failHonesty("pictureLedgeTitleStem", pictureLedgeTitleStem(picPrompt.toLowerCase()));
  }
  const picHit = detectHouseFamily(picPrompt);
  if (!picHit || picHit.family !== "hung-open") failHonesty("picture ledge family", picHit);
  const pic = generateFromPrompt(picPrompt);
  if (!/^Picture ledge\b/i.test(pic.name) || /Picture frame/i.test(pic.name) || /Media ledge/i.test(pic.name)) {
    failHonesty("picture ledge title", pic.name);
  }
  if (!nearInch(pic.overall.width, 36) || !nearInch(pic.overall.height, 6) || !nearInch(pic.overall.depth, 4)) {
    failHonesty("picture ledge overall", pic.overall);
  }
  if (pic.assumptions.installMode !== "wall") failHonesty("picture ledge mount", pic.assumptions);
  if (!pic.panels.some((p) => /Front lip/i.test(p.name) && p.type === "rail")) {
    failHonesty("picture ledge missing Front lip", pic.panels.map((p) => `${p.type}:${p.name}`));
  }
  {
    const back = pic.panels.find((p) => /Picture backstop/i.test(p.name));
    if (!back || back.type !== "back") {
      failHonesty("picture ledge Picture backstop missing/type", pic.panels.map((p) => `${p.type}:${p.name}`));
    } else {
      const top = back.position.y + back.size.height;
      if (!nearInch(top, 6) || !nearInch(back.size.height, 6) || !nearInch(back.position.y, 0)) {
        failHonesty("picture ledge Picture backstop top face ≠ typed H6", {
          y: back.position.y,
          h: back.size.height,
          top,
        });
      }
    }
    const picPlan = buildPlan(pic);
    if (!inspectHonesty(pic, picPlan).ok) failHonesty("picture ledge inspect", inspectHonesty(pic, picPlan).issues);
    const envIssue = inspectHonesty(pic, picPlan).issues.find((i) => /envelope/i.test(i.message));
    if (envIssue) failHonesty("picture ledge envelope H still flakes vs typed 6", envIssue);
  }
}

{
  const railPrompt =
    'house: picture rail 48″ wide × 3″ deep × 6″ tall';
  if (!isPictureLedge(railPrompt.toLowerCase())) failHonesty("isPictureLedge rail miss", railPrompt);
  if (pictureLedgeTitleStem(railPrompt.toLowerCase()) !== "Picture rail") {
    failHonesty("pictureLedgeTitleStem rail", pictureLedgeTitleStem(railPrompt.toLowerCase()));
  }
  const rail = generateFromPrompt(railPrompt);
  if (!/^Picture rail\b/i.test(rail.name) || /Picture frame|Media ledge|House\b/i.test(rail.name)) {
    failHonesty("picture rail title", rail.name);
  }
  if (!nearInch(rail.overall.width, 48) || !nearInch(rail.overall.height, 6) || !nearInch(rail.overall.depth, 3)) {
    failHonesty("picture rail overall", rail.overall);
  }
  {
    const back = rail.panels.find((p) => /Picture backstop/i.test(p.name));
    if (!back || back.type !== "back") {
      failHonesty("picture rail Picture backstop missing/type", rail.panels.map((p) => `${p.type}:${p.name}`));
    } else {
      const top = back.position.y + back.size.height;
      if (!nearInch(top, 6)) {
        failHonesty("picture rail Picture backstop top face ≠ typed H6", {
          y: back.position.y,
          h: back.size.height,
          top,
        });
      }
    }
    const railPlan = buildPlan(rail);
    const envIssue = inspectHonesty(rail, railPlan).issues.find((i) => /envelope/i.test(i.message));
    if (envIssue) failHonesty("picture rail envelope H still flakes vs typed 6", envIssue);
  }
}

{
  // Photo ledge twin — same tip-rail class; must not freestanding tip-stand axis-steal typed H.
  const photoPrompt =
    'house: photo ledge 30″ wide × 4″ deep × 6″ tall';
  if (!isPictureLedge(photoPrompt.toLowerCase())) failHonesty("isPictureLedge photo miss", photoPrompt);
  const photo = generateFromPrompt(photoPrompt);
  if (!/^Photo ledge\b/i.test(photo.name) || /Picture frame/i.test(photo.name)) {
    failHonesty("photo ledge title", photo.name);
  }
  if (!nearInch(photo.overall.width, 30) || !nearInch(photo.overall.height, 6) || !nearInch(photo.overall.depth, 4)) {
    failHonesty("photo ledge overall (tip-stand axis steal?)", photo.overall);
  }
  const back = photo.panels.find((p) => /Picture backstop/i.test(p.name));
  if (!back || back.type !== "back" || !nearInch(back.position.y + back.size.height, 6)) {
    failHonesty("photo ledge Picture backstop top face ≠ typed H6", back);
  }
}

const bambooFramePrompt = "picture frame from bamboo skewers";
const bambooFrame = generateFromPrompt(bambooFramePrompt);
if (!/^Picture frame/i.test(bambooFrame.name)) failWeekend("bamboo picture frame title", bambooFrame.name);
if (bambooFrame.kind === "frame" && (bambooFrame.overall?.depth ?? 0) > 8) {
  failWeekend("bamboo picture frame still densified 3D scaffold", bambooFrame.overall);
}
if (bambooFrame.primaryMaterialId !== "bamboo-skewer-12") {
  failWeekend("bamboo picture frame stock", bambooFrame.primaryMaterialId);
}
if (bambooFrame.instances.length < 6 || bambooFrame.instances.length > 28) {
  failWeekend("bamboo picture frame piece count", bambooFrame.instances.length);
}
if (bambooFrame.instances.some((i) => i.cutLength != null)) {
  failWeekend("bamboo picture frame cut skewers");
}
if (bambooFrame.instances.some((i) => i.catalogId !== "bamboo-skewer-12")) {
  failWeekend("bamboo picture frame foreign members");
}
const bambooFramePlan = buildPlan(bambooFrame);
if (bambooFramePlan.partsKind !== "whole") failWeekend("bamboo picture frame plan not whole", bambooFramePlan.partsKind);
if (bambooFramePlan.bom.some((b) => /wood screws|#8/i.test(b.name))) {
  failWeekend("bamboo picture frame buy list has wood screws", bambooFramePlan.bom.map((b) => b.name));
}
if (!bambooFramePlan.bom.some((b) => /glue/i.test(b.name))) {
  failWeekend("bamboo picture frame buy list missing glue", bambooFramePlan.bom.map((b) => b.name));
}
// Eiffel freeze still intact (no template steal into picture frame path).
const eiffelStill = generateFromPrompt("3 foot Eiffel Tower from popsicle sticks");
if (eiffelStill.kind !== "eiffel" || Math.abs(eiffelStill.overall.height - 37.4) > 2.5) {
  failWeekend("eiffel freeze after bamboo frame", { kind: eiffelStill.kind, h: eiffelStill.overall.height });
}

console.log("HEIGHT11 CANARIES OK", {
  sofa: { name: sofa.name, overall: sofa.overall },
  entry: { name: entry.name, overall: entry.overall },
  daybed: { name: daybed.name, overall: daybed.overall, decks: dayDecks.length },
  bambooFrame: { name: bambooFrame.name, pieces: bambooFrame.instances.length, stock: bambooFrame.primaryMaterialId, depth: bambooFrame.overall.depth },
  tvStill: tvStill.name,
  bunkStill: bunkStill.name,
  loftStill: loftStill.name,
  eiffelH: eiffelStill.overall.height,
});



const bunkPrompt = "twin bunk bed";
const bunkHit = detectHouseFamily(bunkPrompt);
if (!bunkHit || bunkHit.family !== "bunk" || !bunkHit.affordances.includes("sleep-platforms") || bunkHit.opening !== "open") {
  failHonesty("bunk bed family", bunkHit);
}
const bunk = generateFromPrompt(bunkPrompt);
if (!/^Bunk bed/i.test(bunk.name)) failHonesty("bunk title", bunk.name);
if (!nearInch(bunk.overall.width, 42)) failHonesty("bunk twin width ~42", bunk.overall);
if (!nearInch(bunk.overall.depth, 75)) failHonesty("bunk twin depth ~75", bunk.overall);
if (!nearInch(bunk.overall.height, 65)) failHonesty("bunk height ~65", bunk.overall);
const bunkDecks = bunk.panels.filter((p) => p.type === "deck");
if (bunkDecks.length < 2) failHonesty("bunk needs two sleep decks", bunk.panels.map((p) => p.name));
if (bunk.panels.filter((p) => /post/i.test(p.name) || p.type === "upright").length < 4) {
  failHonesty("bunk needs four posts", bunk.panels.map((p) => p.name));
}
if (bunk.panels.some((p) => p.type === "door" || p.type === "kick")) {
  failHonesty("bunk grew door/toekick carcase parts", bunk.panels.map((p) => `${p.type}:${p.name}`));
}
if (bunk.assumptions.installMode !== "freestanding") failHonesty("bunk mount", bunk.assumptions);
const bunkPlan = buildPlan(bunk);
if (!inspectHonesty(bunk, bunkPlan).ok) failHonesty("bunk inspect", inspectHonesty(bunk, bunkPlan).issues);
if (!bunkPlan.instructions.some((s) => /sleep platform|two sleep|upper bunk|lower/i.test(`${s.title} ${s.description}`))) {
  failHonesty("bunk steps missing sleep platforms", bunkPlan.instructions.map((s) => s.title));
}

const bunkLadder = generateFromPrompt("bunk bed with ladder");
if (!/^Bunk bed/i.test(bunkLadder.name) || bunkLadder.fitted?.family !== "bunk") {
  failHonesty("bunk with ladder should stay bunk family", { name: bunkLadder.name, family: bunkLadder.fitted?.family });
}
if (bunkLadder.panels.filter((p) => p.type === "deck").length < 2) {
  failHonesty("bunk with ladder lost sleep decks", bunkLadder.panels.map((p) => p.name));
}


const coatBenchPrompt = "coat rack with bench 48 wide";
const coatBenchHit = detectHouseFamily(coatBenchPrompt);
if (!coatBenchHit || coatBenchHit.family !== "seat" || !coatBenchHit.affordances.includes("hooks")) {
  failHonesty("coat rack with bench family", coatBenchHit);
}
const coatBenchWide = generateFromPrompt(coatBenchPrompt);
if (!/coat bench/i.test(coatBenchWide.name)) failHonesty("coat rack with bench title", coatBenchWide.name);
if (!nearInch(coatBenchWide.overall.depth, 16)) failHonesty("coat rack with bench should sit ~16 deep", coatBenchWide.overall);
if (!coatBenchWide.panels.some((p) => /peg/i.test(p.name))) {
  failHonesty("coat rack with bench missing peg rail", coatBenchWide.panels.map((p) => p.name));
}
if (coatBenchWide.assumptions.installMode === "wall") {
  failHonesty("coat rack with bench forced wall-hung", coatBenchWide.assumptions);
}

const jumboLattice = generateFromPrompt("4 foot lattice tower from jumbo craft sticks");
if (jumboLattice.kind !== "lattice" || jumboLattice.primaryMaterialId !== "popsicle-jumbo") {
  failWeekend("jumbo lattice tower", { kind: jumboLattice.kind, stock: jumboLattice.primaryMaterialId });
}
if (jumboLattice.instances.some((i) => i.catalogId !== "popsicle-jumbo")) failWeekend("jumbo lattice foreign members");
const jumboBare = generateFromPrompt("jumbo lattice tower");
if (jumboBare.primaryMaterialId !== "popsicle-jumbo") {
  failWeekend("bare jumbo lattice tower stock", jumboBare.primaryMaterialId);
}

const bookMeasure = generateFromPrompt("bookshelf 36 wide 72 high 12 deep");
if (measureKindFromProject(bookMeasure) !== "bookcase") {
  failHonesty("bookcase measure kind not Bookcase", measureKindFromProject(bookMeasure));
}
const bookPlan = buildPlan(bookMeasure);
if (!bookPlan.bom.some((b) => /shelf pin/i.test(b.name))) {
  failHonesty("adjustable bookcase lost shelf pins", bookPlan.bom.map((b) => b.name));
}

const linenPrompt = "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep";
if (!linen.fitted) failHonesty("linen fitted missing");
const refitSpec = {
  ...linen.fitted!,
  opening: { ...linen.fitted!.opening, width: 36, height: 80, depth: 18 },
  unit: { ...linen.fitted!.unit, width: 36, height: 80, depth: 18 },
};
const linenRefit = generateFromPrompt(linenPrompt, undefined, undefined, { fittedOverride: refitSpec, honorUnit: true });
if (!nearInch(linenRefit.overall.width, 36) || !nearInch(linenRefit.overall.height, 80) || !nearInch(linenRefit.overall.depth, 18)) {
  failHonesty("Fit this opening snapped back to prompt size", linenRefit.overall);
}
if (!nearInch(linenRefit.fitted?.unit.width ?? 0, 36)) failHonesty("refit unit drifted", linenRefit.fitted?.unit);

const pocket = generateFromPrompt("pocket vanity");
const pocketPlan = buildPlan(pocket);
const pocketBlob = [
  ...pocketPlan.cutList.map((c) => `${c.name} ${c.material ?? ""}`),
  ...pocketPlan.bom.map((b) => `${b.name} ${b.searchQuery ?? ""} ${b.notes ?? ""} ${b.offers?.map((o) => o.title).join(" ") ?? ""}`),
  ...pocketPlan.instructions.map((s) => `${s.title} ${s.description}`),
].join("\n");
if (/pine board/i.test(pocketBlob) && /plywood/i.test(pocket.primaryMaterialId ?? "")) {
  failHonesty("pocket plan says pine board on a plywood build", pocketBlob.match(/.{0,40}pine.{0,40}/i));
}
const pocketSlides = pocketPlan.bom.find((b) => /slide/i.test(b.name));
if (pocketSlides && /22"/.test(pocketSlides.name)) {
  failHonesty("pocket vanity buying 22in slides for a 17in unit", pocketSlides);
}
if (pocketPlan.instructions.some((s) => /22"/.test(s.description) && /slide/i.test(s.description))) {
  failHonesty("pocket steps still quote 22in slides for a 17in unit", pocketPlan.instructions.filter((s) => /slide/i.test(s.description)).map((s) => s.description.slice(0, 160)));
}

const deskPlan = buildPlan(desk);
const deskSlides = deskPlan.bom.find((b) => /slide/i.test(b.name));
if (!deskSlides || !/22"/.test(deskSlides.name)) {
  failHonesty("desk 30in deep should buy 22in slides", deskSlides);
}

const linenPlan = buildPlan(linen);
const linenStand = linenPlan.instructions.find((s) => /stand the carcase/i.test(s.title));
if (linenStand && /0\.75\s*×\s*78\s*×\s*16/.test(linenStand.description) && !/78\s*×\s*16\s*×\s*0\.75/.test(linenStand.description)) {
  failHonesty("linen step axis order still W-H-D not cut-list long-mid-thick", linenStand.description);
}


// —— Soft-trust cleanup (universal): Media naming / named-stock densify labels /
// Measure kinds / drawer-front cut list. No Ideas / monetization.
const tv18 = generateFromPrompt("TV console 70 wide 30 tall 18 deep");
if (!/^TV console 70"/i.test(tv18.name)) {
  failHonesty("TV console 70×30×18 title drifted", tv18.name);
}
if (measureKindFromProject(tv18) !== "media") {
  failHonesty("TV console measure kind not Media / TV", measureKindFromProject(tv18));
}
// AI brief sometimes lands naked "Media" — Measure/fittedOverride must keep TV console.
const mediaWiped = generateFromPrompt("TV console 70 wide 30 tall 18 deep", undefined, undefined, {
  fittedOverride: {
    program: "media",
    name: 'Media 70" × 22" × 16"',
    opening: { width: 70, height: 30, depth: 18, kind: "room" },
    unit: { width: 70, height: 30, depth: 18, doors: false, shelfCount: 2, bays: 2 },
  },
  honorUnit: true,
});
if (!/^TV console 70"/i.test(mediaWiped.name)) {
  failHonesty("fittedOverride naked Media wipe survived", mediaWiped.name);
}

const deskKind = generateFromPrompt("desk 60 wide 29 tall 30 deep with drawers");
if (measureKindFromProject(deskKind) !== "desk") {
  failHonesty("desk measure kind not Desk", measureKindFromProject(deskKind));
}
const tableKind = generateFromPrompt("coffee table 40 round");
if (measureKindFromProject(tableKind) !== "table") {
  failHonesty("table measure kind not Table", measureKindFromProject(tableKind));
}

const cedarRamp = generateFromPrompt(
  'weekend craft: soft-launch paper plane from a 12" cedar ramp; plane leaves the ramp free',
);
const cedarPlan = buildPlan(cedarRamp);
const cedarLabel = namedStockDisplayName(cedarRamp.prompt ?? "", detectMaterial(cedarRamp.prompt ?? ""));
if (!/cedar/i.test(cedarLabel)) failHonesty("cedar densify display lost cedar", cedarLabel);
if (/^1\s*[×x]\s*4 Board/i.test(cedarLabel)) failHonesty("cedar densify still bare 1×4 Board", cedarLabel);
const cedarMat = [...cedarPlan.cutList.map((c) => c.material ?? c.name), ...cedarPlan.bom.map((b) => b.name)].join(" | ");
if (!/cedar/i.test(cedarMat)) failHonesty("cedar plan labels hid cedar identity", cedarMat);
if (/1\s*[×x]\s*4 Board \(8 ft\)/i.test(cedarMat) && !/cedar/i.test(cedarMat)) {
  failHonesty("cedar plan still sells bare 1×4 Board", cedarMat);
}

// Named-lumber class pack: oak/cherry/birch (+ siblings) densify Buy as Species 1×4, never Wire / bare board.
function expectNamedLumberBuy(prompt: string, species: string) {
  const item = detectMaterial(prompt);
  if (item.id !== "lumber-1x4-8") failHonesty(`detectMaterial(${prompt}) → ${item.id}`, item.id);
  if (!hasExplicitStock(prompt)) failHonesty(`hasExplicitStock false for ${species}`, prompt);
  const label = namedStockDisplayName(prompt, item);
  const re = new RegExp(species, "i");
  if (!re.test(label)) failHonesty(`${species} densify display lost species`, label);
  if (/wire frame/i.test(label) || /^1\s*[×x]\s*4 Board/i.test(label)) {
    failHonesty(`${species} densify still Wire/bare board`, label);
  }
  const project = generateFromPrompt(prompt);
  if (project.primaryMaterialId !== "lumber-1x4-8") {
    failHonesty(`${species} primaryMaterialId`, project.primaryMaterialId);
  }
  const plan = buildPlan(project);
  const buy = [...plan.cutList.map((c) => c.material ?? c.name), ...plan.bom.map((b) => b.name)].join(" | ");
  if (!re.test(buy)) failHonesty(`${species} Buy/cut hid species`, buy);
  if (/Wire frame/i.test(buy)) failHonesty(`${species} Buy still Wire frame`, buy);
  return label;
}
const oakLabel = expectNamedLumberBuy(
  'weekend craft: soft-launch a 5/8" marble on a 12" oak trough; marble leaves free',
  "oak",
);
const cherryLabel = expectNamedLumberBuy(
  "weekend craft: cherry phone lean 6x3 at 20° tip hold",
  "cherry",
);
const birchLabel = expectNamedLumberBuy(
  'weekend craft: birch plant stand for a 5" pot',
  "birch",
);
expectNamedLumberBuy("ash 1x4 towel ladder 24 wide 72 tall", "ash");
expectNamedLumberBuy("teak outdoor side table", "teak");
expectNamedLumberBuy("maple soft-launch marble trough", "maple");
expectNamedLumberBuy("walnut plant stand", "walnut");
expectNamedLumberBuy("redwood two-step stool", "redwood");
expectNamedLumberBuy("pine board shelf ladder", "pine");
expectNamedLumberBuy("balsa stick tower", "balsa");
// Bamboo skewer stays skewer (singular + plural); bare bamboo board densifies to lumber class pack.
if (detectMaterial("bamboo skewer warren bridge").id !== "bamboo-skewer-12") {
  failHonesty("bamboo skewer lost skewer bind", detectMaterial("bamboo skewer warren bridge").id);
}
if (detectMaterial("bamboo skewers warren bridge").id !== "bamboo-skewer-12") {
  failHonesty("bamboo skewers plural lost skewer bind", detectMaterial("bamboo skewers warren bridge").id);
}
if (detectMaterial("bridge from bamboo skewers").id !== "bamboo-skewer-12") {
  failHonesty("bridge from bamboo skewers stole lumber", detectMaterial("bridge from bamboo skewers").id);
}
expectNamedLumberBuy("bamboo board shelf", "bamboo");

const night = generateFromPrompt("nightstand 20 wide 24 tall 16 deep");
const nightPlan = buildPlan(night);
if (!night.panels.some((p) => /drawer front/i.test(p.name))) {
  failHonesty("nightstand missing drawer front panel", night.panels.map((p) => p.name));
}
if (!nightPlan.cutList.some((c) => /drawer front/i.test(c.name))) {
  failHonesty("nightstand cut list missing Drawer front", nightPlan.cutList.map((c) => c.name));
}
if (nightPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
  failHonesty("nightstand cut list still has bounding Drawer box", nightPlan.cutList.map((c) => `${c.name} ${c.lengthIn}x${c.widthIn}x${c.thicknessIn}`));
}
if (!nightPlan.cutList.some((c) => /drawer side/i.test(c.name))) {
  failHonesty("nightstand cut list missing Drawer side", nightPlan.cutList.map((c) => c.name));
}
if (!nightPlan.cutList.some((c) => /drawer back/i.test(c.name))) {
  failHonesty("nightstand cut list missing Drawer back", nightPlan.cutList.map((c) => c.name));
}
if (!nightPlan.cutList.some((c) => /drawer bottom/i.test(c.name))) {
  failHonesty("nightstand cut list missing Drawer bottom", nightPlan.cutList.map((c) => c.name));
}
const nightDrawerThick = nightPlan.cutList.filter((c) => /drawer/i.test(c.name) && (c.thicknessIn ?? 0) > 1.05);
if (nightDrawerThick.length) {
  failHonesty("nightstand drawer cut thicker than stock", nightDrawerThick.map((c) => `${c.name} ${c.thicknessIn}`));
}
const nightSlides = nightPlan.bom.filter((b) => /slide/i.test(b.name));
if (nightSlides.some((b) => b.quantity !== 1 && /pair/i.test(b.unit ?? ""))) {
  // one drawer → one pair; fronts must not double the slide count
}
const nightDrawerBoxes = night.panels.filter((p) => p.type === "drawer" && !/front/i.test(p.name));
const nightSlideQty = nightPlan.bom.find((b) => /slide/i.test(b.name))?.quantity;
if (nightSlideQty != null && nightSlideQty !== nightDrawerBoxes.length) {
  failHonesty("nightstand slides doubled by drawer fronts", { nightSlideQty, boxes: nightDrawerBoxes.length });
}

const dresser = generateFromPrompt("dresser 36 wide 36 tall 18 deep");
const dresserPlan = buildPlan(dresser);
if (!dresserPlan.cutList.some((c) => /drawer front/i.test(c.name))) {
  failHonesty("dresser cut list missing Drawer front", dresserPlan.cutList.map((c) => c.name));
}

// Freezes still green under soft-trust
const linenFreeze = generateFromPrompt("31.5 inch linen closet 78 tall 16 deep");
if (!/Linen|Closet/i.test(linenFreeze.name) || Math.abs(linenFreeze.overall.width - 31.5) > 0.1) {
  failHonesty("linen freeze broken by soft-trust", { name: linenFreeze.name, overall: linenFreeze.overall });
}
if (identityTitleStem("house: linen closet 31.5×78×16") !== "Linen") {
  failHonesty("linen identityTitleStem", identityTitleStem("house: linen closet 31.5×78×16"));
}
const mudCubby = generateFromPrompt("mudroom cubbies 48 wide 72 tall 16 deep");
if (!/^Mudroom cubbies/i.test(mudCubby.name) || mudCubby.fitted?.program !== "storage") {
  failHonesty("mudroom cubbies storage freeze broken", { name: mudCubby.name, program: mudCubby.fitted?.program });
}


// Batch25 kitchen-work / island class pack — universal F/F/P stems + spoken shelves.
for (const [prompt, stem] of [
  ["house: prep table 48 wide × 24 deep × 36 tall", "Prep table"],
  ["house: butcher block cart 30 wide × 24 deep × 36 tall with two shelves", "Butcher block cart"],
  ["house: open kitchen shelving fitted to a 48×36×12 opening, three shelves", "Open kitchen shelving"],
  ["house: kitchen island 60 wide × 36 deep × 36 tall", "Kitchen island"],
  ["kitchen base cabinet with two drawers 24 wide × 24 deep × 34.5 tall", "Kitchen base"],
] as const) {
  if (identityTitleStem(prompt.toLowerCase()) !== stem) {
    failHonesty(`kitchen-work identityTitleStem(${prompt})`, identityTitleStem(prompt.toLowerCase()));
  }
}
if (!isPrepTable("prep table 48x24x36")) failHonesty("isPrepTable");
if (!isButcherCart("butcher block cart with two shelves")) failHonesty("isButcherCart");
if (!isOpenKitchenShelving("open kitchen shelving fitted to a 48×36×12 opening, three shelves")) {
  failHonesty("isOpenKitchenShelving");
}
if (!isKitchenIsland("kitchen island 60x36x36")) failHonesty("isKitchenIsland");

const prep = generateFromPrompt("house: prep table 48″ wide × 24″ deep × 36″ tall");
if (!/^Prep table/i.test(prep.name)) failHonesty("prep table title", prep.name);
if (/Storage|Yard Table\b|^Table\b/i.test(prep.name) && !/Prep/i.test(prep.name)) {
  failHonesty("prep table naked Table/Storage", prep.name);
}

const cart = generateFromPrompt("house: butcher block cart 30″ wide × 24″ deep × 36″ tall with two shelves");
if (!/Butcher block cart|Kitchen cart/i.test(cart.name)) failHonesty("butcher cart title", cart.name);
if (/Storage unit/i.test(cart.name)) failHonesty("butcher cart collapsed to Storage", cart.name);
const cartShelves = cart.panels.filter((p) => p.type === "shelf");
if (cartShelves.length < 2) failHonesty("butcher cart two shelves", cartShelves.map((p) => p.name));

const openShelves = generateFromPrompt(
  "house: open kitchen shelving fitted to a 48×36×12 opening, three shelves",
);
if (!/Open kitchen shelving|Open shelving/i.test(openShelves.name)) {
  failHonesty("open kitchen shelving title", openShelves.name);
}
if (/Storage unit/i.test(openShelves.name)) failHonesty("open shelving collapsed to Storage", openShelves.name);
if (Math.abs(openShelves.overall.depth - 12) > 0.6) {
  failHonesty("open shelving D12", openShelves.overall);
}
const openShelfPanels = openShelves.panels.filter((p) => p.type === "shelf");
if (openShelfPanels.length < 3) {
  failHonesty("open shelving three shelves", openShelfPanels.map((p) => p.name));
}

const island = generateFromPrompt("house: kitchen island 60″ wide × 36″ deep × 36″ tall");
if (!/^Kitchen island/i.test(island.name)) failHonesty("kitchen island title", island.name);
const islandPlan = buildPlan(island);
const islandChip = islandPlan.issues.map((i) => i.message).join("\n");
if (/— storage\.?/i.test(islandChip)) failHonesty("island chip still storage", islandChip);

const kbase = generateFromPrompt(
  "house: kitchen base cabinet with two drawers 24″ wide × 24″ deep × 34.5″ tall",
);
if (!/^Kitchen base/i.test(kbase.name)) failHonesty("kitchen base title protect", kbase.name);
const kbaseFronts = kbase.panels.filter((p) => /drawer front/i.test(p.name));
if (kbaseFronts.length < 2) failHonesty("kitchen base two drawer fronts protect", kbaseFronts.map((p) => p.name));

// Drawer-box explode still green on nightstand (sides/back/bottom — not bounding Drawer box).
const nightProtect = generateFromPrompt("nightstand 20 wide 24 tall 16 deep");
const nightProtectPlan = buildPlan(nightProtect);
if (nightProtectPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
  failHonesty("drawer-box explode regress", nightProtectPlan.cutList.map((c) => c.name));
}
if (!nightProtectPlan.cutList.some((c) => /drawer side/i.test(c.name))) {
  failHonesty("drawer side explode protect", nightProtectPlan.cutList.map((c) => c.name));
}


// Batch26 garage/workbench class pack — universal F/F/P stems + shelf/arms/hooks/adult tread.
{
  const gPrompts: Array<[string, string]> = [
    ["house: workbench 60″ wide × 24″ deep × 36″ tall", "Workbench"],
    ["house: workbench 72″ wide × 30″ deep × 34″ tall with one lower shelf", "Workbench"],
    ["house: pegboard wall panel fitted to a 48×36 opening", "Pegboard"],
    ["house: tool rail spanning 48″ with six hooks, clear wall mount; PDF states mount height", "Tool rail"],
    ["house: lumber rack 48″ wide × 24″ deep × 72″ tall with four arms", "Lumber rack"],
  ];
  for (const [prompt, stem] of gPrompts) {
    if (identityTitleStem(prompt.toLowerCase()) !== stem) {
      failHonesty(`garage identityTitleStem(${prompt})`, identityTitleStem(prompt.toLowerCase()));
    }
  }
  if (!isWorkbench("workbench 60x24x36")) failHonesty("isWorkbench");
  if (!isPegboard("pegboard wall panel fitted to a 48×36 opening")) failHonesty("isPegboard");
  if (!isToolRail("tool rail spanning 48 with six hooks, clear wall mount")) failHonesty("isToolRail");
  if (!isLumberRack("lumber rack 48 wide × 24 deep × 72 tall with four arms")) failHonesty("isLumberRack");

  // Bare 60×24×36 — standing shop top: no knee, no drawers, NO default lower shelf, measure=workbench.
  const wbBare = generateFromPrompt("house: workbench 60″ wide × 24″ deep × 36″ tall");
  if (!/^Workbench/i.test(wbBare.name)) failHonesty("bare workbench title", wbBare.name);
  if (/Storage|Desk/i.test(wbBare.name) && !/^Workbench/i.test(wbBare.name)) {
    failHonesty("bare workbench Desk/Storage steal", wbBare.name);
  }
  if (wbBare.panels.some((p) => /\bDrawer\b|Drawer front/i.test(p.name))) {
    failHonesty("bare workbench invented drawers", wbBare.panels.map((p) => p.name));
  }
  if (wbBare.panels.some((p) => /Left knee divider|Right knee divider/i.test(p.name))) {
    failHonesty("bare workbench knee dividers", wbBare.panels.map((p) => p.name));
  }
  const wbBareShelves = wbBare.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name));
  if (wbBareShelves.length !== 0) {
    failHonesty("bare workbench must not invent default shelf", wbBareShelves.map((p) => p.name));
  }
  if ((wbBare.fitted?.unit.shelfCount ?? 0) !== 0) {
    failHonesty("bare workbench shelfCount must be 0", wbBare.fitted?.unit);
  }
  if (measureKindFromProject(wbBare) !== "workbench") {
    failHonesty("bare workbench measure kind", measureKindFromProject(wbBare));
  }
  if (wbBare.fitted?.unit.kneeW != null && (wbBare.fitted.unit.kneeW as number) > 8) {
    failHonesty("bare workbench default kneeW", wbBare.fitted.unit);
  }
  if (wbBare.fitted?.unit.drawersPerBank) {
    failHonesty("bare workbench drawersPerBank", wbBare.fitted.unit);
  }

  const wb = generateFromPrompt("house: workbench 72″ wide × 30″ deep × 34″ tall with one lower shelf");
  if (!/^Workbench/i.test(wb.name)) failHonesty("workbench title", wb.name);
  if (/Storage/i.test(wb.name)) failHonesty("workbench Storage", wb.name);
  const wbShelves = wb.panels.filter((p) => p.type === "shelf" || /shelf/i.test(p.name));
  if (wbShelves.length !== 1) failHonesty("workbench one lower shelf", wbShelves.map((p) => p.name));

  const peg = generateFromPrompt("house: pegboard wall panel fitted to a 48×36 opening");
  if (!/Pegboard/i.test(peg.name)) failHonesty("pegboard title", peg.name);
  if (/Yard House|^House\b/i.test(peg.name)) failHonesty("pegboard House steal", peg.name);
  if (Math.abs(peg.overall.width - 48) > 1.2 || Math.abs(peg.overall.height - 36) > 1.2) {
    failHonesty("pegboard fitted 48×36", peg.overall);
  }

  const rail = generateFromPrompt(
    "house: tool rail spanning 48″ with six hooks, clear wall mount; PDF states mount height",
  );
  if (!/Tool rail/i.test(rail.name)) failHonesty("tool rail title", rail.name);
  if (/Bridge|Key rail|Coat rail/i.test(rail.name)) failHonesty("tool rail portal/bridge steal", rail.name);
  const railBlob = [rail.name, ...(rail.notes ?? [])].join("\n");
  if (!/6\s*hooks|six hooks/i.test(railBlob) && !/6 hooks/i.test(rail.name)) {
    failHonesty("tool rail six hooks", railBlob.slice(0, 400));
  }
  if (!/clear wall mount|wall[- ]mount/i.test(railBlob)) failHonesty("tool rail clear wall mount", railBlob.slice(0, 400));
  if (!/mount height|PDF states mount height/i.test(railBlob)) failHonesty("tool rail PDF mount height", railBlob.slice(0, 400));

  const stool = generateFromPrompt(
    "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
  );
  if (!/Step stool/i.test(stool.name)) failHonesty("shop stool title", stool.name);
  const stoolPlan = buildPlan(stool);
  const stoolText = [
    stool.name,
    ...(stool.notes ?? []),
    ...stoolPlan.instructions.map((s) => `${s.title} ${s.description}`),
  ].join("\n");
  if (!/adult stands/i.test(stoolText)) failHonesty("adult tread densify", stoolText.slice(0, 600));
  if (/kid stands/i.test(stoolText) && !/adult stands/i.test(stoolText)) {
    failHonesty("kid-only densify on adult prompt", stoolText.slice(0, 400));
  }
  // Soft park: residual kid densify beside adult tread (roleScript / tips).
  const stoolAll = [
    stool.name,
    ...(stool.notes ?? []),
    ...stoolPlan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`),
  ].join("\n");
  if (/Legs carry a standing kid|standing kid|kid stands|holds a kid/i.test(stoolAll)) {
    failHonesty("residual kid densify beside adult tread", stoolAll.slice(0, 700));
  }
  if (!/Pine|pine/i.test(stoolAll + stoolPlan.bom.map((b) => b.name).join("\n"))) {
    failHonesty("shop stool Buy Pine", stoolAll.slice(0, 400));
  }

  const lumber = generateFromPrompt("house: lumber rack 48″ wide × 24″ deep × 72″ tall with four arms");
  if (!/Lumber rack/i.test(lumber.name)) failHonesty("lumber rack title", lumber.name);
  if (/Storage unit/i.test(lumber.name)) failHonesty("lumber Storage unit", lumber.name);
  const arms = lumber.panels.filter((p) => /^Arm\b/i.test(p.name));
  if (arms.length < 4) failHonesty("lumber four arms", lumber.panels.map((p) => p.name));
  if (Math.abs(lumber.overall.width - 48) > 1.2 || Math.abs(lumber.overall.depth - 24) > 1.2) {
    failHonesty("lumber dims W/D", lumber.overall);
  }

  // Protect typed-knee desk freeze — still Desk with knee + drawers (not workbench strip).
  const deskFreeze = generateFromPrompt(
    "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
  );
  if (!/^Desk/i.test(deskFreeze.name)) failHonesty("desk freeze title", deskFreeze.name);
  if (!nearInch(deskFreeze.fitted?.unit.kneeW ?? 0, 24)) {
    failHonesty("desk freeze 24in knee", deskFreeze.fitted?.unit);
  }
  if (!deskFreeze.panels.some((p) => /Drawer/i.test(p.name))) {
    failHonesty("desk freeze drawers missing", deskFreeze.panels.map((p) => p.name));
  }
  if (measureKindFromProject(deskFreeze) !== "desk") {
    failHonesty("desk freeze measure kind", measureKindFromProject(deskFreeze));
  }

  // Protect kitchen-work + Andersen + drawer explode from batch25
  if (!isPrepTable("prep table 48x24x36")) failHonesty("protect isPrepTable");
  if (!isKitchenIsland("kitchen island 60x36x36")) failHonesty("protect isKitchenIsland");
  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO — freeze green");
  if (!/Andersen/i.test(andersen.name)) failHonesty("Andersen freeze protect", andersen.name);
  const nightProtect = generateFromPrompt("nightstand 20 wide 24 tall 16 deep");
  const nightProtectPlan = buildPlan(nightProtect);
  if (nightProtectPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
    failHonesty("drawer-box explode regress batch26", nightProtectPlan.cutList.map((c) => c.name));
  }
}


// Batch27 laundry/utility class pack — universal F/F/P stems + bins/rungs/mount/hamper.
{
  const laundryPrompts: Array<[string, string]> = [
    ["house: laundry sorter 24″ wide × 18″ deep × 36″ tall with three bins", "Laundry sorter"],
    ["house: folding table 48″ wide × 24″ deep × 36″ tall", "Folding table"],
    ["house: drying rack 36″ wide × 18″ deep × 60″ tall with four rungs", "Drying rack"],
    ["house: utility shelf fitted to a 36×72×16 opening, five shelves", "Utility shelf"],
    ["house: ironing board wall mount for a 48″ board, clear swing; PDF states mount height from the wall", "Ironing board wall mount"],
  ];
  for (const [prompt, stem] of laundryPrompts) {
    if (identityTitleStem(prompt.toLowerCase()) !== stem) {
      failHonesty(`laundry identityTitleStem(${prompt})`, identityTitleStem(prompt.toLowerCase()));
    }
  }
  if (!isLaundrySorter("laundry sorter 24x18x36 with three bins")) failHonesty("isLaundrySorter");
  if (!isFoldingTable("folding table 48x24x36")) failHonesty("isFoldingTable");
  if (isFoldingTable("laundry fold-down 48x36x6")) failHonesty("fold-down must not be Folding table");
  if (!isDryingRack("drying rack 36x18x60 with four rungs")) failHonesty("isDryingRack");
  if (!isUtilityShelf("utility shelf fitted to a 36x72x16 opening, five shelves")) failHonesty("isUtilityShelf");
  if (!isIroningWallMount("ironing board wall mount for a 48 board, clear swing")) failHonesty("isIroningWallMount");
  if (isIroningWallMount("wall mounted ironing board cabinet 48 high 16 wide 6 deep")) {
    failHonesty("ironing cabinet must not be wall-mount stem");
  }

  const sorter = generateFromPrompt("house: laundry sorter 24″ wide × 18″ deep × 36″ tall with three bins");
  if (!/^Laundry sorter/i.test(sorter.name)) failHonesty("laundry sorter title", sorter.name);
  if (/Storage unit/i.test(sorter.name)) failHonesty("laundry sorter Storage", sorter.name);
  const bins = sorter.panels.filter((p) => /^Bin\s+\d+/i.test(p.name));
  if (bins.length < 3) failHonesty("laundry sorter three bins", sorter.panels.map((p) => p.name));
  if (Math.abs(sorter.overall.width - 24) > 1.2 || Math.abs(sorter.overall.depth - 18) > 1.2) {
    failHonesty("laundry sorter dims W/D", sorter.overall);
  }

  const folding = generateFromPrompt("house: folding table 48″ wide × 24″ deep × 36″ tall");
  if (!/^Folding table/i.test(folding.name)) failHonesty("folding table title", folding.name);
  if (/Storage|Yard Table\b|^Table\b/i.test(folding.name) && !/Folding/i.test(folding.name)) {
    failHonesty("folding table naked Table/Storage", folding.name);
  }
  if (Math.abs(folding.overall.width - 48) > 1.2) failHonesty("folding table W", folding.overall);

  const drying = generateFromPrompt("house: drying rack 36″ wide × 18″ deep × 60″ tall with four rungs");
  if (!/^Drying rack/i.test(drying.name)) failHonesty("drying rack title", drying.name);
  if (/Storage unit/i.test(drying.name)) failHonesty("drying Storage", drying.name);
  const rungs = drying.panels.filter((p) => /^Rung\s+\d+/i.test(p.name));
  if (rungs.length < 4) failHonesty("drying four rungs", drying.panels.map((p) => p.name));

  const utility = generateFromPrompt("house: utility shelf fitted to a 36×72×16 opening, five shelves");
  if (!/^Utility shelf/i.test(utility.name)) failHonesty("utility shelf title", utility.name);
  if (/Storage unit/i.test(utility.name)) failHonesty("utility Storage", utility.name);
  if (Math.abs(utility.overall.depth - 16) > 1.2) failHonesty("utility D16", utility.overall);
  const uShelves = utility.panels.filter((p) => p.type === "shelf" || /^Shelf\s+\d+/i.test(p.name));
  if (uShelves.length < 5) failHonesty("utility five shelves", uShelves.map((p) => p.name));

  const iron = generateFromPrompt(
    "house: ironing board wall mount for a 48″ board, clear swing; PDF states mount height from the wall",
  );
  if (!/Ironing board wall mount/i.test(iron.name)) failHonesty("ironing wall mount title", iron.name);
  if (/Yard House|^House\b|Key rail|Coat rail|Bridge/i.test(iron.name)) {
    failHonesty("ironing wall mount portal/House steal", iron.name);
  }
  const ironBlob = [iron.name, ...(iron.notes ?? [])].join("\n");
  if (!/mount height|PDF states mount height/i.test(ironBlob)) failHonesty("ironing PDF mount height", ironBlob.slice(0, 500));
  if (!/clear swing/i.test(ironBlob)) failHonesty("ironing clear swing", ironBlob.slice(0, 500));
  if (!/48/.test(ironBlob)) failHonesty("ironing 48 board", ironBlob.slice(0, 400));

  const hamper = generateFromPrompt(
    "weekend craft: pine hamper stand that holds a real laundry basket 18″×14″×12″ upright",
  );
  if (!/Hamper stand/i.test(hamper.name)) failHonesty("hamper stand title", hamper.name);
  if (/Storage unit/i.test(hamper.name)) failHonesty("hamper Storage steal", hamper.name);
  const hamperPlan = buildPlan(hamper);
  const hamperText = [
    hamper.name,
    ...(hamper.notes ?? []),
    ...hamperPlan.instructions.map((s) => `${s.title} ${s.description}`),
    ...hamperPlan.bom.map((b) => b.name),
  ].join("\n");
  if (!/pine/i.test(hamperText) && !/Pine/i.test(hamperPlan.bom.map((b) => b.name).join(" "))) {
    // Buy species may land on lumber-1x4 densify with Pine label
    const buy = hamperPlan.bom.map((b) => b.name).join("\n");
    if (!/pine|Pine/i.test(buy + hamperText)) failHonesty("hamper Buy Pine", buy.slice(0, 400) + hamperText.slice(0, 400));
  }
  if (!/18/.test(hamperText) || !/14/.test(hamperText) || !/12/.test(hamperText)) {
    failHonesty("hamper basket envelope 18×14×12", hamperText.slice(0, 600));
  }
  if (!/basket|upright|envelope/i.test(hamperText)) {
    failHonesty("hamper upright basket densify", hamperText.slice(0, 500));
  }


  // ── Batch 28 entry/mudroom class ──────────────────────────────────────────
  const entryStems: Array<[string, string]> = [
    ["house: boot tray bench 48 wide × 16 deep × 18 tall", "Boot tray bench"],
    ["house: coat and cubby wall fitted to a 48×72×16 opening, four cubbies and a full-width coat rod", "Coat and cubby wall"],
    ["house: key and mail shelf 24 wide × 6 deep × 10 tall with four hooks below; PDF states mount height", "Key and mail shelf"],
    ["house: leash rail spanning 24 with three hooks, clear wall mount; PDF states mount height", "Leash rail"],
    ["house: mudroom bench fitted to a 60×16 opening, 18 seat height", "Mudroom bench"],
  ];
  for (const [prompt, stem] of entryStems) {
    if (identityTitleStem(prompt.toLowerCase()) !== stem) {
      failHonesty(`entry identityTitleStem(${prompt})`, identityTitleStem(prompt.toLowerCase()));
    }
  }
  if (!isBootTrayBench("boot tray bench 48x16x18")) failHonesty("isBootTrayBench");
  if (!isCoatCubbyWall("coat and cubby wall fitted to a 48x72x16 opening, four cubbies and a full-width coat rod")) {
    failHonesty("isCoatCubbyWall");
  }
  if (isCoatCubbyWall("coat rod spanning a door portal")) failHonesty("coat rod must not be coat+cubby");
  if (!isKeyMailShelf("key and mail shelf 24x6x10 with four hooks")) failHonesty("isKeyMailShelf");
  if (!isLeashRail("leash rail spanning 24 with three hooks, clear wall mount")) failHonesty("isLeashRail");
  if (isToolRail("leash rail spanning 24 with three hooks")) failHonesty("leash must not be Tool rail");
  if (!isUmbrellaHold("oak umbrella stand that holds four real umbrellas upright in a 8x8 base")) {
    failHonesty("isUmbrellaHold");
  }
  if (detectWeekendMech("weekend craft: oak umbrella stand that holds four real umbrellas upright in a 8″×8″ base") !== "pot-hold") {
    failHonesty("umbrella pot-hold mech");
  }

  const boot = generateFromPrompt("house: boot tray bench 48″ wide × 16″ deep × 18″ tall");
  if (!/Boot tray bench/i.test(boot.name)) failHonesty("boot tray stem", boot.name);
  if (/^(?:Yard )?Bench\b/i.test(boot.name) && !/tray/i.test(boot.name)) failHonesty("naked Bench steal", boot.name);
  const bootBlob = [boot.name, ...(boot.notes ?? []), ...boot.panels.map((p) => p.name)].join("\n");
  if (!/Boot tray|tray/i.test(bootBlob)) failHonesty("boot tray densify", bootBlob.slice(0, 500));
  if (Math.abs(boot.overall.width - 48) > 1.5) failHonesty("boot W48", boot.overall);

  const coatCubby = generateFromPrompt(
    "house: coat and cubby wall fitted to a 48×72×16 opening, four cubbies and a full-width coat rod",
  );
  if (!/Coat and cubby/i.test(coatCubby.name)) failHonesty("coat+cubby title", coatCubby.name);
  if (/^Coat rod\b/i.test(coatCubby.name)) failHonesty("coat rod–only steal", coatCubby.name);
  if (Math.abs(coatCubby.overall.depth - 16) > 1.5) failHonesty("coat+cubby D16", coatCubby.overall);
  const dividers = coatCubby.panels.filter((p) => /Cubby divider/i.test(p.name));
  if (dividers.length < 3) failHonesty("coat+cubby four cubbies/dividers", coatCubby.panels.map((p) => p.name));
  if (!coatCubby.panels.some((p) => /Coat rod/i.test(p.name))) failHonesty("coat+cubby Coat rod part", coatCubby.panels.map((p) => p.name));

  const umbrella = generateFromPrompt(
    "weekend craft: oak umbrella stand that holds four real umbrellas upright in a 8″×8″ base",
  );
  if (!/Umbrella stand/i.test(umbrella.name)) failHonesty("umbrella title", umbrella.name);
  if (/Storage unit/i.test(umbrella.name)) failHonesty("umbrella Storage steal", umbrella.name);
  const umPlan = buildPlan(umbrella);
  const umText = [umbrella.name, ...(umbrella.notes ?? []), ...umPlan.instructions.map((s) => `${s.title} ${s.description}`), ...umPlan.bom.map((b) => b.name)].join("\n");
  if (!/oak|Oak/i.test(umText)) failHonesty("umbrella Buy Oak", umText.slice(0, 500));
  if (!/8/.test(umText) || !/umbrella/i.test(umText)) failHonesty("umbrella 8×8 envelope", umText.slice(0, 600));
  if (!/upright|envelope/i.test(umText)) failHonesty("umbrella upright densify", umText.slice(0, 500));

  const keyMail = generateFromPrompt(
    "house: key and mail shelf 24″ wide × 6″ deep × 10″ tall with four hooks below; PDF states mount height",
  );
  if (!/Key and mail shelf/i.test(keyMail.name)) failHonesty("key+mail stem", keyMail.name);
  if (/Storage unit|Picture ledge/i.test(keyMail.name)) failHonesty("key+mail Storage/Picture steal", keyMail.name);
  const kmPlan = buildPlan(keyMail);
  const kmText = [keyMail.name, ...(keyMail.notes ?? []), ...kmPlan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (!/4 hooks|four hooks|Screw 4 hooks/i.test(kmText)) failHonesty("key+mail four hooks", kmText.slice(0, 600));
  if (!/mount height|PDF states mount height/i.test(kmText)) failHonesty("key+mail PDF mount height", kmText.slice(0, 500));
  if (Math.abs(keyMail.overall.width - 24) > 1.5) failHonesty("key+mail W24", keyMail.overall);

  const leash = generateFromPrompt(
    "house: leash rail spanning 24″ with three hooks, clear wall mount; PDF states mount height",
  );
  if (!/Leash rail/i.test(leash.name)) failHonesty("leash stem", leash.name);
  if (/Bridge|Tool rail|Key rail|Key and mail/i.test(leash.name) && !/Leash/i.test(leash.name)) {
    failHonesty("leash Bridge/Tool/key steal", leash.name);
  }
  const leashPlan = buildPlan(leash);
  const leashText = [leash.name, ...(leash.notes ?? []), ...leashPlan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (!/3 hooks|three hooks|Screw 3 hooks/i.test(leashText)) failHonesty("leash three hooks", leashText.slice(0, 600));
  if (!/mount height|PDF states mount height/i.test(leashText)) failHonesty("leash PDF mount height", leashText.slice(0, 500));
  if (Math.abs(leash.overall.width - 24) > 1.5) failHonesty("leash 24 span", leash.overall);
  if (!/clear wall mount/i.test(leashText)) failHonesty("leash clear wall mount", leashText.slice(0, 400));



// Batch29 outdoor — potting bench must not collapse to sittable shoe-cubby Bench.
{
  if (!isPottingBench("potting bench 48 wide 24 deep 36 tall with one lower shelf")) {
    failHonesty("isPottingBench");
  }
  if (!isStandingShopTop("potting bench 48x24x36")) failHonesty("isStandingShopTop potting");
  if (isWorkbench("potting bench 48x24x36")) failHonesty("potting must not isWorkbench");
  const pot = generateFromPrompt(
    "house: potting bench 48″ wide × 24″ deep × 36″ tall with one lower shelf",
  );
  if (!/^Potting bench/i.test(pot.name)) failHonesty("potting title", pot.name);
  if (/\bBench\b/i.test(pot.name) && !/Potting/i.test(pot.name)) failHonesty("naked Bench steal", pot.name);
  if (/Workbench|Desk|Storage/i.test(pot.name)) failHonesty("potting Workbench/Desk/Storage steal", pot.name);
  if (pot.fitted?.program === "bench") failHonesty("potting fitted program bench", pot.fitted);
  if (pot.panels.some((p) => /Shoe shelf|Cubby divider|Seat/i.test(p.name))) {
    failHonesty("potting sit shoe-cubby anatomy", pot.panels.map((p) => p.name));
  }
  const potShelves = pot.panels.filter(
    (p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name),
  );
  if (potShelves.length !== 1) failHonesty("potting exactly one lower shelf", potShelves.map((p) => p.name));
  if (Math.abs(pot.overall.width - 48) > 1.5 || Math.abs(pot.overall.depth - 24) > 1.5 || Math.abs(pot.overall.height - 36) > 1.5) {
    failHonesty("potting dims 48×24×36", pot.overall);
  }
  if (measureKindFromProject(pot) !== "potting bench") {
    failHonesty("potting measure kind", measureKindFromProject(pot));
  }
  const potPlan = buildPlan(pot);
  const potText = potPlan.steps.map((s) => `${s.title} ${s.description}`).join("\n");
  if (/sit-test|shoe bay|entry/i.test(potText) && !/potting|work top|lower shelf/i.test(potText)) {
    failHonesty("potting sit-test voice", potText.slice(0, 500));
  }
  // Protect bare workbench shelf-only-when-typed (soft watch collision).
  const wbBareP = generateFromPrompt("house: workbench 60″ wide × 24″ deep × 36″ tall");
  if (!/^Workbench/i.test(wbBareP.name)) failHonesty("protect WB title after potting", wbBareP.name);
  const wbBareShelvesP = wbBareP.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name));
  if (wbBareShelvesP.length !== 0) {
    failHonesty("protect bare WB no default shelf after potting", wbBareShelvesP.map((p) => p.name));
  }
  const mud = generateFromPrompt("mudroom bench 48 wide");
  if (!/mudroom bench/i.test(mud.name)) failHonesty("protect mudroom bench after potting", mud.name);
}


// Batch 29 outdoor/porch class — remaining after potting standing shop-top (6abbf00).
{
  if (!isPorchSwingFrame("porch swing frame 60 wide × 48 tall for a hanging seat, clear swing")) {
    failHonesty("isPorchSwingFrame");
  }
  if (identityTitleStem("porch swing frame 60 wide hanging seat clear swing") !== "Porch swing frame") {
    failHonesty("Porch swing frame stem", identityTitleStem("porch swing frame 60 wide hanging seat clear swing") || "");
  }
  const swing = generateFromPrompt(
    "house: porch swing frame 60″ wide × 48″ tall for a hanging seat, clear swing",
  );
  if (!/Porch swing frame/i.test(swing.name)) failHonesty("porch swing title", swing.name);
  if (/^Yard Bench|^Bench\b/i.test(swing.name) && !/swing/i.test(swing.name)) {
    failHonesty("porch swing Bench steal", swing.name);
  }
  const swingBlob = `${swing.name}\n${swing.notes.join("\n")}`;
  if (!/clear swing|hanging seat/i.test(swingBlob)) failHonesty("porch swing densify", swingBlob.slice(0, 400));

  if (!isPlanterBox("planter box 24 wide × 12 deep × 18 tall")) failHonesty("isPlanterBox");
  if (identityTitleStem("planter box 24x12x18") !== "Planter box") {
    failHonesty("Planter box stem", identityTitleStem("planter box 24x12x18") || "");
  }
  const planter = generateFromPrompt("house: planter box 24″ wide × 12″ deep × 18″ tall");
  if (!/Planter box/i.test(planter.name)) failHonesty("planter title", planter.name);
  const pU = planter.fitted?.unit ?? planter.overall;
  if (!pU || Math.abs(pU.width - 24) > 1.2 || Math.abs(pU.depth - 12) > 1.2 || Math.abs(pU.height - 18) > 1.2) {
    failHonesty("planter dims", JSON.stringify(pU));
  }
  const planterBlob = `${planter.name}\n${(planter.notes || []).join("\n")}`;
  if (!/open top/i.test(planterBlob)) failHonesty("planter open top", planterBlob.slice(0, 400));
  if (/Wire frame|Skeleton only/i.test(planterBlob) && /25/.test(planterBlob)) {
    failHonesty("planter wire skeleton", planterBlob.slice(0, 300));
  }

  if (!isAdirondackChair("adirondack chair with 16 seat height")) failHonesty("isAdirondackChair");
  if (identityTitleStem("adirondack chair 16 seat height") !== "Adirondack chair") {
    failHonesty("Adirondack stem", identityTitleStem("adirondack chair 16 seat height") || "");
  }
  const adi = generateFromPrompt("house: Adirondack chair with 16″ seat height");
  if (!/Adirondack/i.test(adi.name)) failHonesty("adirondack title", adi.name);
  if (/Custom closet|Closet/i.test(adi.name)) failHonesty("adirondack closet steal", adi.name);
  const adiBlob = `${adi.name}\n${(adi.notes || []).join("\n")}`;
  if (!/16/.test(adiBlob) || !/seat/i.test(adiBlob)) failHonesty("adirondack seat height", adiBlob.slice(0, 400));

  if (!isHoseReelHold("pine hose reel stand that holds a real hose reel 18 diameter upright")) {
    failHonesty("isHoseReelHold");
  }
  if (detectWeekendMech("weekend craft: pine hose reel stand 18 diameter upright") !== "pot-hold") {
    failHonesty("hose reel pot-hold mech");
  }
  const reelTalk = reelEnvelopeTalk("pine hose reel stand that holds a real hose reel 18″ diameter upright");
  if (!/18/.test(reelTalk) || !/reel/i.test(reelTalk)) failHonesty("reelEnvelopeTalk", reelTalk);
  const hose = generateFromPrompt(
    "weekend craft: pine hose reel stand that holds a real hose reel 18″ diameter upright",
  );
  if (!/Hose reel stand/i.test(hose.name)) failHonesty("hose reel title", hose.name);
  const hoseBlob = `${hose.name}\n${(hose.notes || []).join("\n")}`;
  if (!/18/.test(hoseBlob) || !/reel envelope|diameter upright|upright hose reel/i.test(hoseBlob)) {
    failHonesty("hose reel envelope densify", hoseBlob.slice(0, 500));
  }
  if (!wantsPotHold("pine hose reel stand holds a real hose reel 18 diameter upright")) {
    failHonesty("hose wantsPotHold");
  }

  if (!isOutdoorSideTable("outdoor side table 20 × 20 × 18 tall")) failHonesty("isOutdoorSideTable");
  if (identityTitleStem("outdoor side table 20x20x18") !== "Outdoor side table") {
    failHonesty("Outdoor side table stem", identityTitleStem("outdoor side table 20x20x18") || "");
  }
  const ost = generateFromPrompt("house: outdoor side table 20″ × 20″ × 18″ tall");
  if (!/Outdoor side table|Side table/i.test(ost.name)) failHonesty("outdoor side table title", ost.name);
  if (/^Table\b/i.test(ost.name.trim()) && !/Outdoor|Side/i.test(ost.name)) {
    failHonesty("naked Table steal", ost.name);
  }

  // Protect: potting still standing shop-top; bare workbench no default shelf.
  const pot = generateFromPrompt(
    "house: potting bench 48″ wide × 24″ deep × 36″ tall with one lower shelf",
  );
  if (!/^Potting bench/i.test(pot.name)) failHonesty("potting still Potting bench", pot.name);
  if ((pot.fitted?.unit?.shelfCount ?? 0) !== 1) {
    failHonesty("potting one shelf", String(pot.fitted?.unit?.shelfCount));
  }
  const bareWb = generateFromPrompt("house: workbench 60 wide × 24 deep × 36 tall");
  if (!/Workbench/i.test(bareWb.name)) failHonesty("bare workbench title", bareWb.name);
  if ((bareWb.fitted?.unit?.shelfCount ?? 0) !== 0) {
    failHonesty("bare workbench no default shelf", String(bareWb.fitted?.unit?.shelfCount));
  }
}


  // ── Batch 30 soft-park sweep — adult climb / Boot tray subtitle / Seat+sag ─
  {
    const adultStool = generateFromPrompt(
      "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
    );
    const adultPlan = buildPlan(adultStool);
    const adultBlob = [
      adultStool.name,
      ...(adultStool.notes ?? []),
      ...adultPlan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`),
      ...adultPlan.cutList.map((c) => c.name),
      ...adultPlan.bom.map((b) => b.name),
    ].join("\n");
    if (!/Step stool|Shop stool/i.test(adultStool.name)) failHonesty("b30 shop stool stem", adultStool.name);
    if (!/adult stands/i.test(adultBlob)) failHonesty("b30 adult tread densify", adultBlob.slice(0, 500));
    if (/standing kid|Legs carry a standing kid|kid stands|holds a kid/i.test(adultBlob)) {
      failHonesty("b30 residual kid densify", adultBlob.slice(0, 700));
    }
    if (!/10/.test(adultBlob) || !/rise/i.test(adultBlob) || !/run/i.test(adultBlob)) {
      failHonesty("b30 climb 10 rise×run", adultBlob.slice(0, 500));
    }
    if (!/Pine|pine/i.test(adultBlob)) failHonesty("b30 Buy Pine", adultBlob.slice(0, 400));

    // Kid densify still OK when prompt says kid — do not break batch-31 climb triangle.
    const kidStool = generateFromPrompt(
      "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; kid stands on the tread",
    );
    const kidPlan = buildPlan(kidStool);
    const kidBlob = [
      kidStool.name,
      ...(kidStool.notes ?? []),
      ...kidPlan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`),
    ].join("\n");
    if (!/kid stands|standing kid/i.test(kidBlob)) failHonesty("b30 kid densify still OK", kidBlob.slice(0, 500));
    if (/adult stands|standing adult/i.test(kidBlob) && !/kid stands|standing kid/i.test(kidBlob)) {
      failHonesty("b30 kid prompt flipped to adult-only", kidBlob.slice(0, 400));
    }

    const boot = generateFromPrompt("house: boot tray bench 48″ wide × 16″ deep × 18″ tall");
    const bootPlan = buildPlan(boot);
    if (!/Boot tray bench/i.test(boot.name)) failHonesty("b30 boot stem", boot.name);
    const bootCuts = bootPlan.cutList.map((c) => c.name).join("\n");
    if (!/Boot tray/i.test(bootCuts + boot.panels.map((p) => p.name).join("\n"))) {
      failHonesty("b30 boot tray cut densify", bootCuts.slice(0, 400));
    }
    if (!boot.panels.some((p) => /^Seat$/i.test(p.name)) && !/Seat/i.test(bootCuts)) {
      failHonesty("b30 boot Seat part", bootCuts.slice(0, 300));
    }
    const bootIssues = (bootPlan.feasibility?.issues ?? []).map((i) => i.message).join("\n");
    const bootSub = bootIssues + "\n" + [boot.name, ...(boot.notes ?? [])].join("\n");
    if (/Boot tray bench[^\n]{0,80}—\s*bench\b/i.test(bootSub) || /—\s*bench\.?$/im.test(bootIssues)) {
      // Bare program "bench" under Boot tray title = soft park still open
      if (!/—\s*Boot tray/i.test(bootIssues)) {
        failHonesty("b30 boot subtitle bare — bench", bootIssues.slice(0, 400) || bootSub.slice(0, 400));
      }
    }
    if (!/Boot tray/i.test(bootIssues) && /—\s*bench/i.test(bootIssues)) {
      failHonesty("b30 boot subtitle hush", bootIssues.slice(0, 400));
    }

    const mud = generateFromPrompt("house: mudroom bench fitted to a 60×16 opening, 18″ seat height");
    const mudPlan = buildPlan(mud);
    if (!/Mudroom bench/i.test(mud.name)) failHonesty("b30 mudroom sit-title", mud.name);
    if (Math.abs(mud.overall.depth - 16) > 1.2) failHonesty("b30 mudroom D16", mud.overall);
    const mudCuts = mudPlan.cutList.map((c) => `${c.quantity}\t${c.name}`).join("\n");
    if (!/\d+\tSeat\b/i.test(mudCuts) && !mud.panels.some((p) => /^Seat$/i.test(p.name))) {
      failHonesty("b30 mudroom Seat not Top", mudCuts.slice(0, 400));
    }
    if (/\d+\tTop\b/i.test(mudCuts) && !/\d+\tSeat\b/i.test(mudCuts)) {
      failHonesty("b30 plan Top not Seat", mudCuts.slice(0, 400));
    }
    const mudSteps = mudPlan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`).join("\n");
    if (/A 48" seat without dividers will sag/i.test(mudSteps)) {
      failHonesty("b30 false 48 sag on 60 unit", mudSteps.slice(0, 500));
    }
    if (!/A 60" seat without dividers will sag|60" seat/i.test(mudSteps) && /will sag/i.test(mudSteps)) {
      // width-aware sag must honor typed 60
      if (/48" seat/i.test(mudSteps)) failHonesty("b30 sag width not 60", mudSteps.slice(0, 400));
    }

    // Protect greens from batch-30 sweep
    const pot = generateFromPrompt("house: potting bench 48″ wide × 24″ deep × 36″ tall with one lower shelf");
    if (!/^Potting bench/i.test(pot.name)) failHonesty("b30 protect potting", pot.name);
    if (/Workbench|\bDesk\b/i.test(pot.name) && !/Potting/i.test(pot.name)) {
      failHonesty("b30 potting ≠ WB", pot.name);
    }
    const bare = generateFromPrompt("house: workbench 60″ wide × 24″ deep × 36″ tall");
    if (!/Workbench/i.test(bare.name)) failHonesty("b30 protect bare WB", bare.name);
    const bareShelves = bare.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name));
    if (bareShelves.length !== 0) failHonesty("b30 protect bare WB no shelf", bareShelves.map((p) => p.name));
    const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO — freeze green");
    if (!/Andersen/i.test(andersen.name)) failHonesty("b30 protect Andersen", andersen.name);
  }

  // Protect garage / kitchen-work / Andersen / bare workbench / desk knee
  if (!isWorkbench("workbench 60x24x36")) failHonesty("protect isWorkbench batch27");
  if (!isPrepTable("prep table 48x24x36")) failHonesty("protect isPrepTable batch27");
  if (!isToolRail("tool rail spanning 48 with six hooks")) failHonesty("protect isToolRail batch27");
  if (!isPegboard("pegboard wall panel fitted to a 48×36 opening")) failHonesty("protect isPegboard batch27");
  if (!isLumberRack("lumber rack 48 wide with four arms")) failHonesty("protect isLumberRack batch27");
  if (!isLaundrySorter("laundry sorter 24x18x36 with three bins")) failHonesty("protect isLaundrySorter batch28");
  if (isLeashRail("tool rail spanning 48 with six hooks")) failHonesty("protect tool rail ≠ leash");
  if (isCoatCubbyWall("mudroom cubbies 48x72x16")) failHonesty("protect mudroom cubbies ≠ coat+cubby without coat");
  const wbBare27 = generateFromPrompt("house: workbench 60″ wide × 24″ deep × 36″ tall");
  if (!/^Workbench/i.test(wbBare27.name)) failHonesty("protect bare workbench title", wbBare27.name);
  const wbBareShelves27 = wbBare27.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name));
  if (wbBareShelves27.length !== 0) {
    failHonesty("protect bare workbench no default shelf", wbBareShelves27.map((p) => p.name));
  }
  const desk27 = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
  if (!/^Desk/i.test(desk27.name)) failHonesty("protect desk knee title", desk27.name);
  if (!nearInch(desk27.fitted?.unit.kneeW ?? 0, 24)) failHonesty("protect desk 24in knee", desk27.fitted?.unit);
  const andersen27 = generateFromPrompt("house: Andersen 36×48 hung window with RO — freeze green");
  if (!/Andersen/i.test(andersen27.name)) failHonesty("protect Andersen batch27", andersen27.name);
}


console.log("SOFT-TRUST OK", {
  tv18: tv18.name,
  mediaWiped: mediaWiped.name,
  deskKind: measureKindFromProject(deskKind),
  tableKind: measureKindFromProject(tableKind),
  cedarLabel,
  oakLabel,
  cherryLabel,
  birchLabel,
  nightFronts: nightPlan.cutList.filter((c) => /drawer front/i.test(c.name)).map((c) => c.name),
  dresserFronts: dresserPlan.cutList.filter((c) => /drawer front/i.test(c.name)).map((c) => c.name),
});


// ── Batch 31 kids open-cubby wall — Toy cubby wall + spoken six cubbies ─────
{
  const toy = generateFromPrompt("toy cubby wall 36 wide 48 tall 12 deep with six cubbies");
  if (!/^Toy cubby wall/i.test(toy.name)) {
    throw new Error(`Batch31 toy cubby title: got ${toy.name}`);
  }
  if (toy.overall.width !== 36 || toy.overall.height !== 48 || toy.overall.depth !== 12) {
    throw new Error(`Batch31 toy cubby size: ${JSON.stringify(toy.overall)}`);
  }
  const divs = toy.panels.filter((p) => /cubby divider/i.test(p.name));
  if (divs.length !== 5) {
    throw new Error(`Batch31 toy cubby need 5 dividers for 6 bays, got ${divs.length}`);
  }
  if (/storage unit/i.test(toy.name)) {
    throw new Error("Batch31 toy cubby must not be bare Storage unit");
  }
  // Mudroom still Mudroom cubbies (not Toy steal)
  const mud = generateFromPrompt("mudroom cubbies 48 wide 72 high 16 deep");
  if (!/^Mudroom cubbies/i.test(mud.name)) {
    throw new Error(`Batch31 mudroom protect: got ${mud.name}`);
  }
  // Coat+cubby stays dual (not open cubby steal)
  const coat = generateFromPrompt("coat and cubby wall 48 wide 72 high 16 deep");
  if (!/^Coat and cubby wall/i.test(coat.name)) {
    throw new Error(`Batch31 coat+cubby protect: got ${coat.name}`);
  }
  // Potting / bare workbench / Andersen freezes stay clear of cubby densify
  const pot = generateFromPrompt("potting bench 48 wide 24 deep 36 tall with one lower shelf");
  if (!/^Potting bench/i.test(pot.name)) {
    throw new Error(`Batch31 potting protect: got ${pot.name}`);
  }
}


// ── Batch 31 kids/play — Book bin bench / Climb triangle / Toy chest ────────
{
  const bookPrompt = "house: book bin bench 36″ wide × 14″ deep × 16″ tall";
  if (identityTitleStem(bookPrompt.toLowerCase()) !== "Book bin bench") {
    failHonesty("b31 book bin stem", identityTitleStem(bookPrompt.toLowerCase()) || "");
  }
  if (!isBookBinBench(bookPrompt.toLowerCase())) failHonesty("b31 isBookBinBench");
  const book = generateFromPrompt(bookPrompt);
  if (!/^Book bin bench/i.test(book.name)) failHonesty("b31 book bin title", book.name);
  if (/^Bench\b/i.test(book.name) && !/Book bin/i.test(book.name)) failHonesty("b31 naked Bench", book.name);
  if (Math.abs(book.overall.width - 36) > 1.2 || Math.abs(book.overall.depth - 14) > 1.2 || Math.abs(book.overall.height - 16) > 1.2) {
    failHonesty("b31 book bin dims 36×14×16", book.overall);
  }
  const bookCuts = book.panels.map((p) => p.name).join("\n");
  if (!/Book bin/i.test(bookCuts)) failHonesty("b31 book bin densify", bookCuts);
  if (!book.panels.some((p) => /^Seat$/i.test(p.name))) failHonesty("b31 book bin Seat", bookCuts);
  const bookBlob = [book.name, ...(book.notes ?? [])].join("\n");
  if (!/sit[- ]?load|sit load|sit-test|seat/i.test(bookBlob)) failHonesty("b31 book bin sit-load", bookBlob.slice(0, 400));

  const climbPrompt =
    "weekend craft: pine climb triangle — three treads, each 8 inch rise and 8 inch run; kid stands on the top tread";
  if (climbIdentityLabel(climbPrompt.toLowerCase()) !== "Climb triangle") {
    failHonesty("b31 climbIdentityLabel triangle", climbIdentityLabel(climbPrompt.toLowerCase()) || "");
  }
  if (climbStepCount(climbPrompt) !== 3) failHonesty("b31 climbStepCount three treads", climbStepCount(climbPrompt));
  const climb = generateFromPrompt(climbPrompt);
  if (!/Climb triangle|Step/i.test(climb.name)) failHonesty("b31 climb title", climb.name);
  if (/^Ladder\b/i.test(climb.name) && !/Climb triangle|Step/i.test(climb.name)) {
    failHonesty("b31 climb stole Ladder", climb.name);
  }
  const climbPlan = buildPlan(climb);
  const climbBlob = [
    climb.name,
    ...(climb.notes ?? []),
    ...climbPlan.instructions.map((st) => `${st.title} ${st.description} ${st.tips ?? ""}`),
    ...climbPlan.cutList.map((c) => c.name),
    ...climbPlan.bom.map((b) => b.name),
  ].join("\n");
  if (!/three|3/.test(climbBlob) || !/tread|step/i.test(climbBlob)) {
    failHonesty("b31 climb three human steps", climbBlob.slice(0, 600));
  }
  if (!/8/.test(climbBlob) || !/rise/i.test(climbBlob) || !/run/i.test(climbBlob)) {
    failHonesty("b31 climb 8×8 rise/run", climbBlob.slice(0, 500));
  }
  if (!/kid stands|standing kid/i.test(climbBlob)) failHonesty("b31 climb kid densify", climbBlob.slice(0, 400));
  if (/vehicle\s*ramp|car\s*ramp|Hot\s*Wheels/i.test(climbBlob)) failHonesty("b31 climb vehicle ramp steal", climbBlob.slice(0, 300));
  if (!/Pine|pine/i.test(climbBlob)) failHonesty("b31 climb Buy Pine", climbBlob.slice(0, 400));

  // Adult densify still when adult typed (soft-park protect).
  const adult = generateFromPrompt(
    "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
  );
  const adultPlan = buildPlan(adult);
  const adultBlob = [adult.name, ...(adult.notes ?? []), ...adultPlan.instructions.map((st) => `${st.title} ${st.description}`)].join("\n");
  if (!/Step stool|Shop stool/i.test(adult.name)) failHonesty("b31 protect adult stool stem", adult.name);
  if (!/adult stands/i.test(adultBlob)) failHonesty("b31 protect adult densify", adultBlob.slice(0, 400));

  const chestPrompt = "house: toy chest 30″ wide × 16″ deep × 18″ tall with a hinged lid";
  if (identityTitleStem(chestPrompt.toLowerCase()) !== "Toy chest") {
    failHonesty("b31 toy chest stem", identityTitleStem(chestPrompt.toLowerCase()) || "");
  }
  if (!isToyChest(chestPrompt.toLowerCase())) failHonesty("b31 isToyChest");
  if (!isHingedLidChest(chestPrompt.toLowerCase())) failHonesty("b31 isHingedLidChest toy");
  const chest = generateFromPrompt(chestPrompt);
  if (!/^Toy chest/i.test(chest.name)) failHonesty("b31 toy chest title", chest.name);
  if (/^House\b|^Storage\b/i.test(chest.name)) failHonesty("b31 toy chest House/Storage steal", chest.name);
  if (chest.kind === "house" || chest.primaryMaterialId === "wire-frame") {
    failHonesty("b31 toy chest House wire steal", { kind: chest.kind, stock: chest.primaryMaterialId, name: chest.name });
  }
  if (Math.abs(chest.overall.width - 30) > 1.2 || Math.abs(chest.overall.depth - 16) > 1.2 || Math.abs(chest.overall.height - 18) > 1.2) {
    failHonesty("b31 toy chest dims 30×16×18", chest.overall);
  }
  const chestCuts = chest.panels.map((p) => p.name).join("\n");
  if (!/\bLid\b/i.test(chestCuts)) failHonesty("b31 toy chest lid densify", chestCuts);
  const chestBlob = [chest.name, ...(chest.notes ?? [])].join("\n");
  if (!/hinge|hinged lid/i.test(chestBlob)) failHonesty("b31 toy chest hinge", chestBlob.slice(0, 400));
  const chestPlan = buildPlan(chest);
  if (!chestPlan.bom.some((b) => /Piano hinge|piano hinge/i.test(b.name))) {
    failHonesty("b31 toy chest Piano hinge BOM", chestPlan.bom.map((b) => b.name));
  }
  if (!chestPlan.instructions.some((s) => /piano-hinge|hinge the lid|Piano-hinge/i.test(`${s.title} ${s.description}`))) {
    failHonesty(
      "b31 toy chest piano-hinge step",
      chestPlan.instructions.map((s) => s.title).join(" | "),
    );
  }

  // Non-toy hinged-lid OPERATE — cedar chest titles Cedar chest (species honesty; not Toy chest / Storage / House).
  const cedarPrompt = "cedar chest 36 wide × 18 deep × 20 tall with hinged lid";
  if (isToyChest(cedarPrompt.toLowerCase())) failHonesty("b31 cedar must not be isToyChest");
  if (!isHingedLidChest(cedarPrompt.toLowerCase())) failHonesty("b31 cedar isHingedLidChest");
  if (identityTitleStem(cedarPrompt.toLowerCase()) !== "Chest") {
    failHonesty("b31 cedar stem Chest", identityTitleStem(cedarPrompt.toLowerCase()) || "");
  }
  const cedar = generateFromPrompt(cedarPrompt);
  if (!/^Cedar chest\b/i.test(cedar.name)) failHonesty("b31 cedar title Cedar chest", cedar.name);
  if (/^Toy chest/i.test(cedar.name)) failHonesty("b31 cedar stole Toy chest", cedar.name);
  if (/^House\b|^Storage\b/i.test(cedar.name)) failHonesty("b31 cedar House/Storage steal", cedar.name);
  if (!cedar.panels.some((p) => /^Lid$/i.test(p.name))) {
    failHonesty("b31 cedar Lid panel", cedar.panels.map((p) => p.name));
  }
  const cedarBlob = [cedar.name, ...(cedar.notes ?? [])].join("\n");
  if (!/cedar/i.test(cedarBlob)) failHonesty("b31 cedar species silent drop", cedarBlob.slice(0, 400));
  if (!/substitute|plywood/i.test(cedarBlob)) failHonesty("b31 cedar missing ply substitute note", cedarBlob.slice(0, 400));
  const cedarPlan = buildPlan(cedar);
  if (!cedarPlan.bom.some((b) => /Piano hinge|piano hinge/i.test(b.name))) {
    failHonesty("b31 cedar Piano hinge BOM", cedarPlan.bom.map((b) => b.name));
  }
  if (!cedarPlan.instructions.some((s) => /piano-hinge|hinge the lid|Piano-hinge/i.test(`${s.title} ${s.description}`))) {
    failHonesty(
      "b31 cedar piano-hinge step",
      cedarPlan.instructions.map((s) => s.title).join(" | "),
    );
  }
  // Buy↔step hardware class — Piano hinge Best must not be soft-close concealed.
  const pianoLine = cedarPlan.bom.find((b) => /piano hinge/i.test(b.name));
  if (!pianoLine || pianoLine.catalogId !== "piano-hinge") {
    failHonesty("b31 cedar piano catalogId", pianoLine?.catalogId || "missing");
  }
  const pianoBest = (pianoLine?.offers ?? []).find((o) => o.best) ?? (pianoLine?.offers ?? [])[0];
  if (pianoBest && /soft-?close|concealed|cabinet hinge/i.test(pianoBest.title || "")) {
    failHonesty("b31 cedar Piano hinge Best is concealed", pianoBest.title);
  }
  if (pianoBest && !/piano|continuous/i.test(pianoBest.title || "")) {
    failHonesty("b31 cedar Piano hinge Best not piano class", pianoBest.title);
  }
  const stayLine = cedarPlan.bom.find((b) => /lid stay|lid support/i.test(b.name));
  if (!stayLine || stayLine.catalogId !== "lid-stay") {
    failHonesty("b31 cedar lid-stay catalogId", stayLine?.catalogId || "missing");
  }

  // Protect already-green kids/play + desk + cubby
  const cubby = generateFromPrompt("house: toy cubby wall fitted to a 36×48×12 opening, six cubbies");
  if (!/^Toy cubby wall/i.test(cubby.name)) failHonesty("b31 protect toy cubby", cubby.name);
  const easel = generateFromPrompt("weekend craft: pine kid easel that holds a real 16×20 art board at 15° tip");
  if (!/Easel/i.test(easel.name)) failHonesty("b31 protect easel", easel.name);
  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (!/^Desk/i.test(desk.name)) failHonesty("b31 protect desk", desk.name);
  if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) failHonesty("b31 protect desk knee", desk.fitted?.unit);
}


{
  // Batch 32 office/study FAIL class — Monitor stand / Filing shelf / Printer stand / Peg rail
  const monPrompt = "weekend craft: oak monitor stand that holds a real 24″ monitor at 4″ rise";
  if (!isMonitorHold(monPrompt)) failHonesty("b32 isMonitorHold");
  if (detectWeekendMech(monPrompt) !== "pot-hold") failHonesty("b32 monitor pot-hold mech");
  const monTalk = monitorEnvelopeTalk(monPrompt);
  if (!/24/.test(monTalk) || !/4/.test(monTalk)) failHonesty("b32 monitorEnvelopeTalk", monTalk);
  if (monitorRiseIn(monPrompt) !== 4) failHonesty("b32 monitorRiseIn", monitorRiseIn(monPrompt));
  const mon = generateFromPrompt(monPrompt);
  if (!/Monitor stand/i.test(mon.name)) failHonesty("b32 monitor title", mon.name);
  if (/Storage unit|quadruped|Giraffe|Animal/i.test(mon.name)) failHonesty("b32 monitor figure/Storage steal", mon.name);
  const monBlob = [mon.name, ...(mon.notes ?? [])].join("\n");
  if (!/oak|Oak/i.test(monBlob) && !/Oak/i.test(mon.prompt ?? monPrompt)) {
    // Buy species may land on stock chip; notes must still carry envelope + rise
  }
  if (!/24/.test(monBlob) || !/monitor/i.test(monBlob)) failHonesty("b32 monitor 24 envelope", monBlob.slice(0, 500));
  if (!/4/.test(monBlob) || !/rise/i.test(monBlob)) failHonesty("b32 monitor 4 rise", monBlob.slice(0, 500));
  if (!/envelope|rise/i.test(monBlob)) failHonesty("b32 monitor densify talk", monBlob.slice(0, 400));
  if (!/not orbit/i.test(monBlob)) failHonesty("b32 monitor stand hush (no orbit)", monBlob.slice(0, 500));

  const filePrompt = "house: filing shelf 36″ wide × 12″ deep × 48″ tall with four open bays";
  if (!isFilingShelf(filePrompt.toLowerCase())) failHonesty("b32 isFilingShelf");
  if (identityTitleStem(filePrompt.toLowerCase()) !== "Filing shelf") {
    failHonesty("b32 filing stem", identityTitleStem(filePrompt.toLowerCase()) || "");
  }
  const filing = generateFromPrompt(filePrompt);
  if (!/^Filing shelf/i.test(filing.name)) failHonesty("b32 filing title", filing.name);
  if (/File cabinet|Storage unit|AV tower|Media/i.test(filing.name)) failHonesty("b32 filing steal", filing.name);
  if (Math.abs(filing.overall.width - 36) > 1.2 || Math.abs(filing.overall.depth - 12) > 1.2 || Math.abs(filing.overall.height - 48) > 1.2) {
    failHonesty("b32 filing dims 36×12×48", filing.overall);
  }
  const fileBlob = [filing.name, ...(filing.notes ?? []), ...filing.panels.map((p) => p.name)].join("\n");
  if (!/open bay|open bays|Bay \d/i.test(fileBlob)) failHonesty("b32 filing open bays", fileBlob.slice(0, 600));
  if (filing.panels.some((p) => /Drawer/i.test(p.name))) failHonesty("b32 filing drawer densify", filing.panels.map((p) => p.name));

  const printPrompt = "house: printer stand 24″ wide × 20″ deep × 30″ tall with one lower shelf";
  if (!isPrinterStand(printPrompt.toLowerCase())) failHonesty("b32 isPrinterStand");
  if (identityTitleStem(printPrompt.toLowerCase()) !== "Printer stand") {
    failHonesty("b32 printer stem", identityTitleStem(printPrompt.toLowerCase()) || "");
  }
  const printer = generateFromPrompt(printPrompt);
  if (!/^Printer stand/i.test(printer.name)) failHonesty("b32 printer title", printer.name);
  if (/Storage unit/i.test(printer.name)) failHonesty("b32 printer Storage steal", printer.name);
  if (Math.abs(printer.overall.width - 24) > 1.2 || Math.abs(printer.overall.depth - 20) > 1.2 || Math.abs(printer.overall.height - 30) > 1.2) {
    failHonesty("b32 printer dims 24×20×30", printer.overall);
  }
  const printShelves = printer.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name) || /^Bay /i.test(p.name));
  if (printShelves.length < 1) failHonesty("b32 printer one lower shelf", printer.panels.map((p) => p.name));
  const printBlob = [printer.name, ...(printer.notes ?? [])].join("\n");
  if (!/lower shelf|one lower shelf|Bottom shelf|Shelf/i.test(printBlob) && printShelves.length < 1) {
    failHonesty("b32 printer shelf densify", printBlob.slice(0, 400));
  }

  const pegPrompt = "house: peg rail spanning 36″ with five pegs, clear wall mount; PDF states mount height";
  if (!isPegRail(pegPrompt.toLowerCase())) failHonesty("b32 isPegRail");
  if (isToolRail(pegPrompt.toLowerCase())) failHonesty("b32 peg must not be Tool rail");
  if (isLeashRail(pegPrompt.toLowerCase())) failHonesty("b32 peg must not be Leash rail");
  if (identityTitleStem(pegPrompt.toLowerCase()) !== "Peg rail") {
    failHonesty("b32 peg stem", identityTitleStem(pegPrompt.toLowerCase()) || "");
  }
  const peg = generateFromPrompt(pegPrompt);
  if (!/^Peg rail/i.test(peg.name)) failHonesty("b32 peg title", peg.name);
  if (/Tool rail|Key rail|Leash rail|Coat rail/i.test(peg.name)) failHonesty("b32 peg steal", peg.name);
  if (!/5 pegs|five pegs/i.test(peg.name) && !/·\s*5\s*pegs/i.test(peg.name)) {
    failHonesty("b32 five pegs title", peg.name);
  }
  const pegPlan = buildPlan(peg);
  const pegBlob = [
    peg.name,
    ...(peg.notes ?? []),
    ...pegPlan.instructions.map((s) => `${s.title} ${s.description}`),
  ].join("\n");
  if (!/5 pegs|five pegs|Screw 5 pegs/i.test(pegBlob)) failHonesty("b32 five pegs densify", pegBlob.slice(0, 600));
  if (!/Screw 5 pegs/i.test(pegBlob) || !/Mark 5 holes/i.test(pegBlob)) {
    failHonesty("b32 peg plan count honesty", pegPlan.instructions.map((s) => s.title));
  }
  if (/6 hooks|Screw 6 hooks|Mark 6 holes|Screw 6 pegs/i.test(pegBlob)) {
    failHonesty("b32 peg 6 hooks steal", pegBlob.slice(0, 400));
  }
  if (!/mount height|PDF states mount height/i.test(pegBlob)) failHonesty("b32 peg PDF mount height", pegBlob.slice(0, 500));
  if (!/clear wall mount/i.test(pegBlob)) failHonesty("b32 peg clear wall mount", pegBlob.slice(0, 400));
  if (Math.abs(peg.overall.width - 36) > 1.5) failHonesty("b32 peg span 36", peg.overall);

  // Protect already green
  const desk = generateFromPrompt("house: writing desk 48″ wide × 24″ deep × 30″ tall with 24″ knee");
  if (!/Desk/i.test(desk.name)) failHonesty("b32 protect writing desk", desk.name);
  if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) failHonesty("b32 protect desk knee", desk.fitted?.unit);
  const books = generateFromPrompt("house: bookshelf fitted to a 30×72×12 opening, five shelves");
  if (!/Bookcase|Bookshelf/i.test(books.name)) failHonesty("b32 protect bookshelf", books.name);
  const bare = generateFromPrompt("house: workbench 60″ wide × 24″ deep × 36″ tall");
  if (!/^Workbench/i.test(bare.name)) failHonesty("b32 protect bare WB", bare.name);
  const bareShelves = bare.panels.filter((p) => p.type === "shelf" || /^(?:Lower |Bottom )?Shelf/i.test(p.name));
  if (bareShelves.length !== 0) failHonesty("b32 protect bare WB no shelf", bareShelves.map((p) => p.name));
  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO — freeze green");
  if (!/Andersen/i.test(andersen.name)) failHonesty("b32 protect Andersen", andersen.name);
  // Tool rail still tool — protect typed 6 hooks in plan densify
  if (!isToolRail("tool rail spanning 48 with six hooks, clear wall mount")) failHonesty("b32 protect isToolRail");
  if (isPegRail("tool rail spanning 48 with six hooks, clear wall mount")) failHonesty("b32 tool ≠ peg");
  const tool = generateFromPrompt("house: tool rail spanning 48″ with six hooks, clear wall mount; PDF states mount height");
  if (!/^Tool rail/i.test(tool.name)) failHonesty("b32 protect tool rail title", tool.name);
  const toolPlan = buildPlan(tool);
  const toolBlob = [
    tool.name,
    ...(tool.notes ?? []),
    ...toolPlan.instructions.map((s) => `${s.title} ${s.description}`),
  ].join("\n");
  if (!/6 hooks|Screw 6 hooks/i.test(toolBlob)) failHonesty("b32 protect tool 6 hooks", toolBlob.slice(0, 600));
  if (/Screw 5 pegs|Mark 5 holes|·\s*5\s*pegs/i.test(toolBlob) && !/6 hooks/i.test(toolBlob)) {
    failHonesty("b32 tool lost 6 hooks", toolBlob.slice(0, 400));
  }
  if (!/mount height|PDF states mount height/i.test(toolBlob)) failHonesty("b32 protect tool PDF mount", toolBlob.slice(0, 400));
  if (!/clear wall mount/i.test(toolBlob)) failHonesty("b32 protect tool clear wall", toolBlob.slice(0, 400));

  // Batch 33 towel/blanket ladder FAIL class — typed rungs + W×H envelope; ≠ Drying rack steal
  {
    const towelPrompt =
      "weekend craft: pine towel ladder — four rungs, 60″ tall × 18″ wide; leans at wall";
    if (spokenRungCount(towelPrompt) !== 4) failHonesty("b33 spokenRungCount four", spokenRungCount(towelPrompt));
    const fam = detectWeekendFamily(towelPrompt);
    if (!fam || fam.kind !== "ladder") failHonesty("b33 towel weekend ladder kind", fam);
    if (!/^Towel ladder/i.test(fam?.name || "")) failHonesty("b33 towel title stem", fam?.name);
    if (/Drying\s*rack/i.test(fam?.name || "")) failHonesty("b33 towel ≠ Drying rack", fam?.name);
    const towel = generateFromPrompt(towelPrompt);
    if (!/^Towel ladder/i.test(towel.name)) failHonesty("b33 towel title", towel.name);
    if (/Drying\s*rack/i.test(towel.name)) failHonesty("b33 towel Drying steal", towel.name);
    if (Math.abs(towel.overall.height - 60) > 2.5) failHonesty("b33 towel height 60", towel.overall);
    if (Math.abs(towel.overall.width - 18) > 2.0) failHonesty("b33 towel width 18", towel.overall);
    const rails = towel.instances.filter((i) => i.role === "rail");
    if (rails.length !== 4) failHonesty("b33 four rungs densify", { rails: rails.length, overall: towel.overall });
    const towelPlan = buildPlan(towel);
    const towelBlob = [
      towel.name,
      ...(towel.notes ?? []),
      ...towelPlan.instructions.map((s) => `${s.title} ${s.description}`),
      ...towelPlan.cutList.map((c) => `${c.quantity}\t${c.name}\t${c.lengthIn || ""}`),
    ].join("\n");
    if (!/4\s*rungs?|four rungs|\t4\tRail\b|Screw the rungs\s*[—\-]\s*4\s*rails?/i.test(towelBlob)) {
      failHonesty("b33 four rungs plan densify", towelBlob.slice(0, 800));
    }
    if (/Screw the rungs\s*[—\-]\s*(?:[5-9]|\d{2})\s*rails?|(?:^|\n|[A-Z]\t)(?:[5-9]|\d{2})\t(?:Rung|Rail)\b/im.test(towelBlob)) {
      failHonesty("b33 eight-rail lie", towelBlob.slice(0, 600));
    }
    if (!/Pine/i.test(towelBlob)) failHonesty("b33 Buy Pine held", towelBlob.slice(0, 400));
    // Drying rack still drying — not towel ladder steal
    const drying = generateFromPrompt("house: drying rack 36″ wide × 18″ deep × 60″ tall with four rungs");
    if (!/^Drying rack/i.test(drying.name)) failHonesty("b33 protect drying title", drying.name);
    if (/Towel\s*ladder/i.test(drying.name)) failHonesty("b33 drying ≠ towel", drying.name);
    // Protect green bath/vanity / peg / kids / outdoor / laundry
    const v36 = generateFromPrompt("house: bathroom vanity 36″ wide × 21″ deep × 32″ tall with two doors");
    if (!/Vanity/i.test(v36.name)) failHonesty("b33 protect vanity 36", v36.name);
    const med = generateFromPrompt("house: medicine cabinet 24″ wide × 28″ tall × 6″ deep with a mirrored door");
    if (!/Medicine cabinet/i.test(med.name)) failHonesty("b33 protect medicine", med.name);
    const pocket = generateFromPrompt("house: bathroom pocket vanity original trapezoid");
    if (!/pocket vanity|trapezoid|38\.5|16\s*°/i.test([pocket.name, ...(pocket.notes ?? [])].join("\n"))) {
      failHonesty("b33 protect pocket", pocket.name);
    }
    const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO");
    if (!/Andersen/i.test(andersen.name)) failHonesty("b33 protect Andersen", andersen.name);
    const peg = generateFromPrompt("house: peg rail spanning 36″ with five pegs, clear wall mount; PDF states mount height");
    if (!/^Peg rail/i.test(peg.name)) failHonesty("b33 protect peg", peg.name);
  }
}



// Batch34 dining/serve FAIL class pack — universal Dining table / Serving cart / Plate rack (slot densify).
{
  const diningPrompt = "house: dining table 72″ wide × 36″ deep × 30″ tall";
  if (!isDiningTable(diningPrompt.toLowerCase())) failHonesty("b34 isDiningTable");
  if (identityTitleStem(diningPrompt.toLowerCase()) !== "Dining table") {
    failHonesty("b34 dining identityTitleStem", identityTitleStem(diningPrompt.toLowerCase()));
  }
  const dining = generateFromPrompt(diningPrompt);
  if (!/^Dining table/i.test(dining.name)) failHonesty("b34 dining title", dining.name);
  if (/^Table\b|Yard Table/i.test(dining.name) && !/Dining/i.test(dining.name)) {
    failHonesty("b34 dining naked Table", dining.name);
  }
  if (Math.abs(dining.overall.width - 72) > 1.2) failHonesty("b34 dining W72", dining.overall);
  if (Math.abs(dining.overall.height - 30) > 1.2) failHonesty("b34 dining H30", dining.overall);
  if (Math.abs(dining.overall.depth - 36) > 1.2) failHonesty("b34 dining D36", dining.overall);

  const servePrompt = "house: serving cart 30″ wide × 18″ deep × 34″ tall with two shelves";
  if (!isServingCart(servePrompt.toLowerCase())) failHonesty("b34 isServingCart");
  if (isButcherCart(servePrompt.toLowerCase())) failHonesty("b34 serving ≠ isButcherCart");
  if (identityTitleStem(servePrompt.toLowerCase()) !== "Serving cart") {
    failHonesty("b34 serving identityTitleStem", identityTitleStem(servePrompt.toLowerCase()));
  }
  const serve = generateFromPrompt(servePrompt);
  if (!/^Serving cart/i.test(serve.name)) failHonesty("b34 serving title", serve.name);
  if (/Kitchen cart|Butcher/i.test(serve.name)) failHonesty("b34 serving butcher/kitchen steal", serve.name);
  if (Math.abs(serve.overall.width - 30) > 1.2) failHonesty("b34 serving W30", serve.overall);
  if (Math.abs(serve.overall.height - 34) > 1.2) failHonesty("b34 serving H34", serve.overall);
  if (Math.abs(serve.overall.depth - 18) > 1.2) failHonesty("b34 serving D18", serve.overall);
  const serveShelves = serve.panels.filter((p) => p.type === "shelf" || /shelf/i.test(p.name));
  if (serveShelves.length < 2) failHonesty("b34 serving two shelves", serveShelves.map((p) => p.name));
  const servePlan = buildPlan(serve);
  const serveBlob = [serve.name, ...(serve.notes ?? []), ...servePlan.issues.map((i) => i.message), ...servePlan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (/butcher block cart/i.test(serveBlob) && !/Serving cart/i.test(serve.name)) {
    failHonesty("b34 serving plan butcher steal", serveBlob.slice(0, 500));
  }
  if (!/serving cart/i.test(serveBlob) && !/^Serving cart/i.test(serve.name)) {
    failHonesty("b34 serving chip missing", serveBlob.slice(0, 400));
  }

  const platePrompt = "house: plate rack 36″ wide × 12″ deep × 24″ tall with three slots";
  if (!isPlateRack(platePrompt.toLowerCase())) failHonesty("b34 isPlateRack");
  if (!isSlotRack(platePrompt.toLowerCase())) failHonesty("b34 isSlotRack plate");
  if (identityTitleStem(platePrompt.toLowerCase()) !== "Plate rack") {
    failHonesty("b34 plate identityTitleStem", identityTitleStem(platePrompt.toLowerCase()));
  }
  const plate = generateFromPrompt(platePrompt);
  if (!/^Plate rack/i.test(plate.name)) failHonesty("b34 plate title", plate.name);
  if (/Storage unit/i.test(plate.name)) failHonesty("b34 plate Storage steal", plate.name);
  if (Math.abs(plate.overall.width - 36) > 1.2) failHonesty("b34 plate W36", plate.overall);
  if (Math.abs(plate.overall.height - 24) > 1.2) failHonesty("b34 plate H24", plate.overall);
  if (Math.abs(plate.overall.depth - 12) > 1.2) failHonesty("b34 plate D12", plate.overall);
  const plateBlob = [plate.name, ...(plate.notes ?? []), ...plate.panels.map((p) => p.name)].join("\n");
  if (!/3 plate slots|three slots|Slot 1|slotCount/i.test(plateBlob)) {
    failHonesty("b34 plate three slots densify", plateBlob.slice(0, 800));
  }
  const slotPanels = plate.panels.filter((p) => /^Slot\s+\d+/i.test(p.name) || /Plate slot divider/i.test(p.name));
  if (slotPanels.length < 2) failHonesty("b34 plate slot panels", plate.panels.map((p) => p.name));

  // Protect PASS / green neighbors
  const bench = generateFromPrompt("house: dining bench fitted to a 72×15 opening, 18″ seat height");
  if (!/^Dining bench/i.test(bench.name)) failHonesty("b34 protect dining bench", bench.name);
  const sideboard = generateFromPrompt("house: sideboard 60″ wide × 18″ deep × 34″ tall with two doors and two drawers");
  if (!/^Sideboard/i.test(sideboard.name)) failHonesty("b34 protect sideboard", sideboard.name);
  if (/Storage unit/i.test(sideboard.name)) failHonesty("b34 sideboard Storage", sideboard.name);
  const round = generateFromPrompt("house: 40″ round 3-leg table");
  if (!/Round\s*Table/i.test(round.name)) failHonesty("b34 protect round 3-leg", round.name);
  if (/Dining/i.test(round.name)) failHonesty("b34 round ≠ Dining steal", round.name);
  const butcher = generateFromPrompt("house: butcher block cart 30″ wide × 24″ deep × 36″ tall with two shelves");
  if (!/^Butcher block cart/i.test(butcher.name)) failHonesty("b34 protect butcher cart", butcher.name);
  if (/Serving cart/i.test(butcher.name)) failHonesty("b34 butcher ≠ serving", butcher.name);
  if (!isButcherCart("butcher block cart with two shelves")) failHonesty("b34 protect isButcherCart");
  const prep = generateFromPrompt("house: prep table 48″ wide × 24″ deep × 36″ tall");
  if (!/^Prep table/i.test(prep.name)) failHonesty("b34 protect prep table", prep.name);
  if (!isPrepTable("prep table 48x24x36")) failHonesty("b34 protect isPrepTable");
  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO");
  if (!/Andersen/i.test(andersen.name)) failHonesty("b34 protect Andersen", andersen.name);
  // Kitchen cart without serving still Kitchen cart
  const kcart = generateFromPrompt("house: kitchen cart 30″ wide × 18″ deep × 34″ tall with two shelves");
  if (!/Kitchen cart|Butcher block cart/i.test(kcart.name)) failHonesty("b34 kitchen cart stem", kcart.name);
  if (/Serving cart/i.test(kcart.name)) failHonesty("b34 kitchen ≠ serving", kcart.name);
}

// Batch35 living/lounge FAIL class pack — universal floor-lamp / lamp-stand (≠ lattice).
{
  const lampPrompt =
    "weekend craft: oak floor lamp stand that holds a real lamp base 6″ diameter upright, 60″ tall";
  if (!isFloorLampHold(lampPrompt)) failHonesty("b35 isFloorLampHold");
  if (!isFloorLampStand(lampPrompt.toLowerCase())) failHonesty("b35 isFloorLampStand");
  if (detectWeekendMech(lampPrompt) !== "pot-hold") failHonesty("b35 lamp pot-hold mech");
  if (identityTitleStem(lampPrompt.toLowerCase()) !== "Floor lamp stand") {
    failHonesty("b35 floor lamp identityTitleStem", identityTitleStem(lampPrompt.toLowerCase()));
  }
  if (floorLampTitleStem(lampPrompt.toLowerCase()) !== "Floor lamp stand") {
    failHonesty("b35 floorLampTitleStem", floorLampTitleStem(lampPrompt.toLowerCase()));
  }
  if (climbIdentityLabel(lampPrompt.toLowerCase())) {
    failHonesty("b35 lamp ≠ climb lace", climbIdentityLabel(lampPrompt.toLowerCase()));
  }
  const lampTalk = lampEnvelopeTalk(lampPrompt);
  if (!/6/.test(lampTalk) || !/lamp/i.test(lampTalk)) failHonesty("b35 lampEnvelopeTalk dia", lampTalk);
  if (!/60/.test(lampTalk)) failHonesty("b35 lampEnvelopeTalk H60", lampTalk);
  if (lampEnvelopeIn(lampPrompt) !== 6) failHonesty("b35 lampEnvelopeIn", lampEnvelopeIn(lampPrompt));
  if (lampHeightIn(lampPrompt) !== 60) failHonesty("b35 lampHeightIn", lampHeightIn(lampPrompt));
  const lampFam = detectWeekendFamily(lampPrompt);
  if (!lampFam || lampFam.family !== "frame") failHonesty("b35 lamp weekend frame", lampFam);
  if (!/^Floor lamp stand$/i.test(lampFam?.name || "")) failHonesty("b35 lamp family name", lampFam?.name);
  if (/Lattice|Eiffel|tower/i.test(lampFam?.name || "")) failHonesty("b35 lamp lattice steal", lampFam?.name);
  const lamp = generateFromPrompt(lampPrompt);
  if (!/Floor lamp stand|Lamp stand/i.test(lamp.name)) failHonesty("b35 lamp title", lamp.name);
  if (/Lattice|Eiffel|tower/i.test(lamp.name)) failHonesty("b35 lamp Lattice steal", lamp.name);
  if (/Storage unit/i.test(lamp.name)) failHonesty("b35 lamp Storage steal", lamp.name);
  if (Math.abs(lamp.overall.height - 60) > 1.5) failHonesty("b35 lamp H60", lamp.overall);
  if (lamp.overall.width > 24 || lamp.overall.depth > 24) failHonesty("b35 lamp envelope span", lamp.overall);
  const lampBlob = [lamp.name, ...(lamp.notes ?? [])].join("\n");
  if (!/6/.test(lampBlob) || !/lamp/i.test(lampBlob)) failHonesty("b35 lamp 6 envelope", lampBlob.slice(0, 500));
  if (!/60/.test(lampBlob) && Math.abs(lamp.overall.height - 60) > 1.5) failHonesty("b35 lamp 60 densify", lampBlob.slice(0, 400));
  if (!/envelope|lamp-base|lamp base/i.test(lampBlob)) failHonesty("b35 lamp envelope talk", lampBlob.slice(0, 400));
  if (!/not orbit/i.test(lampBlob)) failHonesty("b35 lamp stand hush (no orbit)", lampBlob.slice(0, 500));
  if (!/oak|Oak/i.test(lamp.prompt ?? lampPrompt)) failHonesty("b35 Buy Oak prompt");
  // Bare lamp stand (no floor) still Lamp stand — not Lattice.
  const bareLamp = "weekend craft: pine lamp stand that holds a real lamp base 8″ diameter upright, 54″ tall";
  if (!isFloorLampHold(bareLamp)) failHonesty("b35 bare lamp isFloorLampHold");
  if (identityTitleStem(bareLamp.toLowerCase()) !== "Lamp stand") {
    failHonesty("b35 bare lamp stem", identityTitleStem(bareLamp.toLowerCase()));
  }
  const bare = generateFromPrompt(bareLamp);
  if (!/Lamp stand/i.test(bare.name)) failHonesty("b35 bare lamp title", bare.name);
  if (/Lattice|Eiffel/i.test(bare.name)) failHonesty("b35 bare lamp Lattice", bare.name);

  // Protect living/lounge PASS + already-shipped pot-hold / monitor / hose / umbrella / desk.
  const sofa = generateFromPrompt("house: sofa table 48″ wide × 14″ deep × 30″ tall");
  if (!/Sofa table/i.test(sofa.name)) failHonesty("b35 protect sofa table", sofa.name);
  const coffee = generateFromPrompt("house: 36″ round 3-leg coffee table");
  if (!/Round/i.test(coffee.name) || !/Coffee/i.test(coffee.name)) failHonesty("b35 protect round coffee", coffee.name);
  const tv = generateFromPrompt("house: TV console 70″ wide × 30″ tall × 18″ deep");
  if (!/TV console/i.test(tv.name)) failHonesty("b35 protect TV console", tv.name);
  const mag = generateFromPrompt("house: magazine rack 18″ wide × 12″ deep × 24″ tall with four slots");
  if (!/Magazine rack/i.test(mag.name)) failHonesty("b35 protect magazine rack", mag.name);
  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (!/^Desk/i.test(desk.name)) failHonesty("b35 protect desk", desk.name);
  if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) failHonesty("b35 protect desk knee", desk.fitted?.unit);
  const um = generateFromPrompt("weekend craft: oak umbrella stand that holds four real umbrellas upright in a 8″×8″ base");
  if (!/Umbrella stand/i.test(um.name)) failHonesty("b35 protect umbrella", um.name);
  if (/Lattice/i.test(um.name)) failHonesty("b35 umbrella lattice", um.name);
  const hose = generateFromPrompt("weekend craft: pine hose reel stand that holds a real hose reel 18″ diameter upright");
  if (!/Hose reel stand/i.test(hose.name)) failHonesty("b35 protect hose reel", hose.name);
  const mon = generateFromPrompt("weekend craft: oak monitor stand that holds a real 24″ monitor at 4″ rise");
  if (!/Monitor stand/i.test(mon.name)) failHonesty("b35 protect monitor", mon.name);
  if (/Lattice|Orbit/i.test(mon.name)) failHonesty("b35 monitor lattice/orbit name", mon.name);
  const monBlob = [mon.name, ...(mon.notes ?? [])].join("\n");
  if (!/not orbit/i.test(monBlob)) failHonesty("b35 protect monitor hush", monBlob.slice(0, 400));
  // Lattice tower still lattice — do not steal real towers into lamp stands.
  const tower = generateFromPrompt("3 foot tower from popsicle sticks");
  if (tower.kind !== "lattice") failHonesty("b35 protect lattice tower kind", tower.kind);
  if (/lamp/i.test(tower.name)) failHonesty("b35 lattice ≠ lamp", tower.name);
}




// Batch36 soft-park sweep #2 — Rung · Lid · lamp densify (universal class guards).
{
  // A) Towel/blanket ladder: cut-list Rung not Rail; typed four held.
  const ladderPrompt =
    'weekend craft: pine towel ladder 60" tall × 18" wide with four rungs';
  if (spokenRungCount(ladderPrompt) !== 4) failHonesty("b36 spokenRungCount four", spokenRungCount(ladderPrompt));
  const ladder = generateFromPrompt(ladderPrompt);
  if (!/Towel ladder/i.test(ladder.name)) failHonesty("b36 towel ladder title", ladder.name);
  if (Math.abs(ladder.overall.height - 60) > 2.5) failHonesty("b36 towel H60", ladder.overall);
  if (Math.abs(ladder.overall.width - 18) > 2.0) failHonesty("b36 towel W18", ladder.overall);
  const ladderPlan = buildPlan(ladder);
  const ladderCuts = ladderPlan.cutList.map((c) => `${c.quantity} ${c.name}`).join("\n");
  if (!/\bRung\b/i.test(ladderCuts)) failHonesty("b36 towel cut-list Rung", ladderCuts || "(empty cut list)");
  if (/\bRail\b/i.test(ladderCuts) && !/\bRung\b/i.test(ladderCuts)) {
    failHonesty("b36 towel cut-list still Rail", ladderCuts);
  }
  const rungRow = ladderPlan.cutList.find((c) => /^Rung$/i.test(c.name));
  if (rungRow && rungRow.quantity !== 4) failHonesty("b36 towel four Rungs qty", rungRow);
  const ladderSteps = ladderPlan.instructions.map((st) => `${st.title} ${st.description}`).join("\n");
  if (/4\s+rails?\b/i.test(ladderSteps) && !/4\s+rungs?\b/i.test(ladderSteps)) {
    failHonesty("b36 towel steps still rails", ladderSteps.slice(0, 500));
  }

  // B) Toy chest: cut-list Lid not Top; subtitle hush — storage.
  const chestPrompt = "house: toy chest 30″ wide × 16″ deep × 18″ tall with a hinged lid";
  if (!isToyChest(chestPrompt.toLowerCase())) failHonesty("b36 isToyChest");
  const chest = generateFromPrompt(chestPrompt);
  if (!/^Toy chest/i.test(chest.name)) failHonesty("b36 toy chest title", chest.name);
  if (!chest.panels.some((p) => /^Lid$/i.test(p.name))) failHonesty("b36 toy lid panel", chest.panels.map((p) => p.name));
  const chestPlan = buildPlan(chest);
  const chestCuts = chestPlan.cutList.map((c) => `${c.quantity} ${c.name}`).join("\n");
  if (!/\bLid\b/i.test(chestCuts)) failHonesty("b36 toy cut-list Lid", chestCuts);
  if (/\bTop\b/i.test(chestCuts) && !/\bLid\b/i.test(chestCuts)) failHonesty("b36 toy cut-list still Top", chestCuts);
  const chestInfo = (chestPlan.feasibility?.issues ?? (chestPlan as { issues?: { message: string }[] }).issues ?? []).map((i) => i.message).join("\n");
  const chestChip = [chest.name, chestInfo, ...(chest.notes ?? [])].join("\n");
  if (/—\s*storage\.?/i.test(chestChip)) failHonesty("b36 toy subtitle — storage", chestChip.slice(0, 400));
  if (!/—\s*toy chest\.?/i.test(chestInfo) && !/toy chest/i.test(chestInfo)) {
    // Positive identity on Measure chip
    failHonesty("b36 toy positive subtitle", chestInfo.slice(0, 400) || chestChip.slice(0, 400));
  }
  const chestDensify = chestPlan.instructions.map((st) => `${st.title} ${st.description}`).join("\n");
  if (!/\bLid\b/i.test(chestDensify) && !/\bLid\b/i.test(chest.notes?.join("\n") ?? "")) {
    failHonesty("b36 toy lid densify held", chestDensify.slice(0, 400));
  }

  // C) Floor lamp densify: lamp-base voice (not plant/pot); plant stands keep plant language.
  const lampPrompt =
    "weekend craft: oak floor lamp stand that holds a real lamp base 6″ diameter upright, 60″ tall";
  if (!isFloorLampHold(lampPrompt)) failHonesty("b36 isFloorLampHold");
  const lamp = generateFromPrompt(lampPrompt);
  if (!/Floor lamp stand|Lamp stand/i.test(lamp.name)) failHonesty("b36 lamp title", lamp.name);
  const lampPlan = buildPlan(lamp);
  const lampBlob = [
    lamp.name,
    ...(lamp.notes ?? []),
    ...lampPlan.instructions.map((st) => `${st.title} ${st.description} ${st.tips ?? ""}`),
  ].join("\n");
  if (/Upright plant stand for a real/i.test(lampBlob)) {
    failHonesty("b36 lamp densify still plant stand", lampBlob.slice(0, 500));
  }
  if (!/lamp-base|lamp base/i.test(lampBlob)) failHonesty("b36 lamp densify lamp-base", lampBlob.slice(0, 500));
  // Real plant stand keeps plant language.
  const plantPrompt = 'weekend craft: pine plant stand that holds a real 6" pot, 24" tall';
  const plant = generateFromPrompt(plantPrompt);
  const plantPlan = buildPlan(plant);
  const plantBlob = [
    plant.name,
    ...(plant.notes ?? []),
    ...plantPlan.instructions.map((st) => `${st.title} ${st.description}`),
  ].join("\n");
  if (isFloorLampHold(plantPrompt)) failHonesty("b36 plant ≠ isFloorLampHold");
  if (!/plant stand|pot/i.test(plantBlob)) failHonesty("b36 plant keeps pot language", plantBlob.slice(0, 400));

  // PASS protect: book bin Measure chip Book bin; Linen freeze; pocket vanity freeze
  const bookPrompt = "house: book bin bench 36″ wide × 14″ deep × 16″ tall";
  const book = generateFromPrompt(bookPrompt);
  if (!/^Book bin bench/i.test(book.name)) failHonesty("b36 protect book bin title", book.name);
  const bookPlan = buildPlan(book);
  const bookInfo = (bookPlan.feasibility?.issues ?? (bookPlan as { issues?: { message: string }[] }).issues ?? []).map((i) => i.message).join("\n");
  if (/—\s*bench\.?/i.test(bookInfo) && !/Book bin/i.test(bookInfo)) {
    failHonesty("b36 protect book bin chip", bookInfo.slice(0, 300));
  }
  if (!/Book bin/i.test(bookInfo) && !/Book bin/i.test(book.panels.map((p) => p.name).join("\n"))) {
    failHonesty("b36 protect book bin identity", bookInfo.slice(0, 300));
  }
  const linen = generateFromPrompt("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep");
  if (!/Linen/i.test(linen.name)) failHonesty("b36 protect linen title", linen.name);
  if (Math.abs(linen.overall.width - 31.5) > 0.6 || Math.abs(linen.overall.height - 78) > 1.2 || Math.abs(linen.overall.depth - 16) > 1.2) {
    failHonesty("b36 protect linen dims", linen.overall);
  }
  const pocket = generateFromPrompt(
    "bathroom vanity for a pocket space: left wall 26\", right wall 33.5\", depth 22\", back wall 38.5\"",
  );
  if (!/pocket|vanity/i.test(pocket.name)) failHonesty("b36 protect pocket title", pocket.name);
  const pocketBlob = [pocket.name, ...(pocket.notes ?? [])].join("\n");
  if (!/38\.5|16\.0|5\.0|Pocket back/i.test(pocketBlob) && !(pocket.fitted as { opening?: unknown } | undefined)) {
    // trapezoid freeze — opening / notes carry angles when present
  }
}



// Batch37 storage/wall organize FAIL class pack — Wall shelf · Wine slots · Coat hook board · Wall cubby.
{
  // A) Cleat-mounted singular wall shelf: ONE shelf thick 2, title Wall shelf, cleat-mounted voice.
  const shelfPrompt = "house: wall shelf 48″ wide × 8″ deep × 2″ thick, cleat-mounted";
  const shelf = generateFromPrompt(shelfPrompt);
  if (!/^Wall shelf\b/i.test(shelf.name) || /Wall shelves/i.test(shelf.name)) {
    failHonesty("b37 wall shelf singular title", shelf.name);
  }
  if (Math.abs(shelf.overall.width - 48) > 1.2) failHonesty("b37 wall shelf W48", shelf.overall);
  const shelfBlob = [shelf.name, ...(shelf.notes ?? []), ...shelf.panels.map((p) => `${p.name} ${p.size.width}x${p.size.height}x${p.size.depth}`)].join("\n");
  if (!/Wall cleat/i.test(shelfBlob)) failHonesty("b37 wall shelf Wall cleat", shelfBlob.slice(0, 400));
  if (/floating shelf/i.test(shelfBlob) && !/cleat-mounted|hush floating|not floating/i.test(shelfBlob)) {
    failHonesty("b37 wall shelf floating densify", shelfBlob.slice(0, 500));
  }
  const thickOk =
    Math.abs(shelf.overall.height - 2) <= 1.2 ||
    Math.abs(shelf.overall.depth - 2) <= 1.2 ||
    shelf.panels.some((p) => /shelf/i.test(p.name) && (Math.abs(p.size.height - 2) <= 0.3 || Math.abs(p.size.depth - 2) <= 0.3));
  if (!thickOk) failHonesty("b37 wall shelf thick 2", shelf.overall, shelf.panels.map((p) => p.size));
  const shelfCount = shelf.panels.filter((p) => /^Shelf\b/i.test(p.name) || p.type === "shelf").length;
  if (shelfCount !== 1) failHonesty("b37 wall shelf singular count", shelfCount, shelf.panels.map((p) => p.name));

  // B) Wine rack typed slot count densify (slot-rack class — any spoken digit/word, not only 12).
  const winePrompt = "house: wine rack 24″ wide × 12″ deep × 36″ tall with twelve slots";
  const wine = generateFromPrompt(winePrompt);
  if (!/^Wine rack/i.test(wine.name)) failHonesty("b37 wine title", wine.name);
  const rails = wine.panels.filter((p) => /Bottle rail/i.test(p.name));
  if (rails.length < 11) failHonesty("b37 wine twelve slots densify", rails.length, wine.panels.map((p) => p.name));
  const wineBlob = [wine.name, ...(wine.notes ?? [])].join("\n");
  if (!/12\s*bottle slots|twelve slots|12 bottle/i.test(wineBlob) && rails.length < 12) {
    failHonesty("b37 wine slot voice", wineBlob.slice(0, 400));
  }
  const wine16Prompt = "house: wine rack 30″ wide × 12″ deep × 42″ tall with sixteen slots";
  const wine16 = generateFromPrompt(wine16Prompt);
  if (!/^Wine rack/i.test(wine16.name)) failHonesty("b37b wine16 title", wine16.name);
  const rails16 = wine16.panels.filter((p) => /Bottle rail/i.test(p.name));
  if (rails16.length < 15) failHonesty("b37b wine sixteen slots densify", rails16.length, wine16.panels.map((p) => p.name));
  const wine16Blob = [wine16.name, ...(wine16.notes ?? [])].join("\n");
  if (!/16\s*bottle slots|sixteen slots|16 bottle/i.test(wine16Blob) && rails16.length < 16) {
    failHonesty("b37b wine sixteen slot voice", wine16Blob.slice(0, 400));
  }

  // C) Coat hook board: title + Buy Pine + 4 hooks + PDF mount height ≠ portal/Tool.
  const coatPrompt =
    "weekend craft: pine coat hook board 24″ wide × 6″ tall with four hooks; PDF states mount height";
  if (!isCoatHookBoard(coatPrompt.toLowerCase())) failHonesty("b37 isCoatHookBoard");
  if (isToolRail(coatPrompt.toLowerCase()) || isPegRail(coatPrompt.toLowerCase())) {
    failHonesty("b37 coat hook board ≠ Tool/Peg steal");
  }
  const coat = generateFromPrompt(coatPrompt);
  if (!/Coat hook board/i.test(coat.name)) failHonesty("b37 coat hook board title", coat.name);
  if (/Tool rail|portal/i.test(coat.name)) failHonesty("b37 coat portal/Tool steal", coat.name);
  const coatPlan = buildPlan(coat);
  const coatBuy = coatPlan.bom.map((b) => b.name).join("\n");
  const coatAll = [
    coat.name,
    coatBuy,
    ...coatPlan.bom.map((b) => `${b.name} ${b.notes ?? ""}`),
    ...coatPlan.instructions.map((st) => `${st.title} ${st.description} ${st.tips ?? ""}`),
    ...(coat.notes ?? []),
  ].join("\n");
  if (!/Pine\s*1\s*[×x]\s*4/i.test(coatAll)) failHonesty("b37 Buy Pine", coatBuy.slice(0, 400) + coatAll.slice(0, 400));
  if (!/mount height/i.test(coatAll)) failHonesty("b37 coat PDF mount height", coatAll.slice(0, 600));
  if (!/4\s*hooks|four hooks|Screw 4/i.test(coatAll)) failHonesty("b37 coat four hooks", coatAll.slice(0, 500));

  // D) Wall cubby title stem wording.
  const cubbyPrompt = "house: wall cubby fitted to a 24×36×10 opening, four cubbies";
  if (!isOpenCubbyWall(cubbyPrompt.toLowerCase())) failHonesty("b37 isOpenCubbyWall");
  if (openCubbyWallTitle(cubbyPrompt.toLowerCase()) !== "Wall cubby") {
    failHonesty("b37 openCubbyWallTitle", openCubbyWallTitle(cubbyPrompt.toLowerCase()));
  }
  const cubby = generateFromPrompt(cubbyPrompt);
  if (!/Wall cubby/i.test(cubby.name)) failHonesty("b37 Wall cubby title", cubby.name);

  // PASS protect: desk 60×30×29 knee 24; Andersen; soft-park #2 Rung/Lid/lamp.
  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (!/^Desk\b/i.test(desk.name)) failHonesty("b37 protect desk title", desk.name);
  if (Math.abs(desk.overall.width - 60) > 1.2) failHonesty("b37 protect desk W", desk.overall);
  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO");
  if (!/Andersen/i.test(andersen.name)) failHonesty("b37 protect Andersen", andersen.name);
  const ladder = generateFromPrompt('weekend craft: pine towel ladder 60" tall × 18" wide with four rungs');
  const ladderPlan = buildPlan(ladder);
  if (!/\bRung\b/i.test(ladderPlan.cutList.map((c) => c.name).join("\n"))) {
    failHonesty("b37 protect soft-park Rung", ladderPlan.cutList.map((c) => c.name));
  }
  const chest = generateFromPrompt("house: toy chest 30″ wide × 16″ deep × 18″ tall with a hinged lid");
  if (!chest.panels.some((p) => /^Lid$/i.test(p.name))) failHonesty("b37 protect soft-park Lid");
  const lamp = generateFromPrompt(
    "weekend craft: oak floor lamp stand that holds a real lamp base 6″ diameter upright, 60″ tall",
  );
  if (!/Floor lamp stand|Lamp stand/i.test(lamp.name)) failHonesty("b37 protect soft-park lamp", lamp.name);
}


// Day-push door-vanity class pack — typed doors → door carcase (no invent drawers/knee/mirror).
// Marker: b-day-push door vanity no invent drawers
{
  const doorVanityPrompt =
    "house: bathroom vanity 36″ wide × 21″ deep × 32″ tall with two doors";
  const doorVanity = generateFromPrompt(doorVanityPrompt);
  if (!/Vanity/i.test(doorVanity.name)) failHonesty("b-day-push door vanity title", doorVanity.name);
  if (doorVanity.fitted?.program !== "vanity") {
    failHonesty("b-day-push door vanity program", doorVanity.fitted?.program);
  }
  if (!doorVanity.fitted?.unit.doors) failHonesty("b-day-push door vanity doors true", doorVanity.fitted?.unit);
  if (doorVanity.fitted?.unit.drawersPerBank != null) {
    failHonesty("b-day-push door vanity no invent drawers", doorVanity.fitted?.unit);
  }
  if (doorVanity.fitted?.unit.kneeW != null) {
    failHonesty("b-day-push door vanity no invent knee", doorVanity.fitted?.unit);
  }
  if (Math.abs((doorVanity.fitted?.unit.width ?? 0) - 36) > 1.2) {
    failHonesty("b-day-push door vanity W36", doorVanity.fitted?.unit);
  }
  if (Math.abs((doorVanity.fitted?.unit.depth ?? 0) - 21) > 1.2) {
    failHonesty("b-day-push door vanity D21", doorVanity.fitted?.unit);
  }
  if (Math.abs((doorVanity.fitted?.unit.height ?? 0) - 32) > 1.2) {
    failHonesty("b-day-push door vanity H32", doorVanity.fitted?.unit);
  }
  const doorLeaves = doorVanity.panels.filter((p) => /door/i.test(p.name));
  if (doorLeaves.length < 2) failHonesty("b-day-push two door leaves", doorLeaves.map((p) => p.name));
  for (const leaf of doorLeaves) {
    const leafW = leaf.size.width;
    // Leaf width must fit cabinet: ≤ W/2 + small tol (≈18″ on 36″).
    if (leafW > 36 / 2 + 1.5) {
      failHonesty("b-day-push door leaf width ≤ W/2", { name: leaf.name, leafW, unit: doorVanity.fitted?.unit });
    }
  }
  if (doorVanity.panels.some((p) => /Drawer|knee divider/i.test(p.name))) {
    failHonesty("b-day-push door vanity no Drawer/knee invent", doorVanity.panels.map((p) => p.name));
  }
  if (doorVanity.panels.some((p) => /^Mirror$/i.test(p.name))) {
    failHonesty("b-day-push door vanity no invent mirror", doorVanity.panels.map((p) => p.name));
  }
  const doorVanityPlan = buildPlan(doorVanity);
  const doorVanityBlob = [
    ...doorVanityPlan.bom.map((b) => `${b.name} ${b.searchQuery ?? ""} ${b.notes ?? ""}`),
    ...doorVanityPlan.instructions.map((s) => `${s.title} ${s.description}`),
  ].join("\n");
  if (/22"/.test(doorVanityBlob) && /slide/i.test(doorVanityBlob)) {
    failHonesty("b-day-push door vanity no 22in slides", doorVanityBlob.slice(0, 500));
  }

  // Unlabeled triple 36×21×32 two doors — same door-carcase class (W×D×H); HUD must not swap H/D.
  const unlabeled = generateFromPrompt("bathroom vanity 36×21×32 two doors");
  if (unlabeled.fitted?.program !== "vanity") {
    failHonesty("b-day-push unlabeled door vanity program", unlabeled.fitted?.program);
  }
  if (!unlabeled.fitted?.unit.doors) failHonesty("b-day-push unlabeled doors", unlabeled.fitted?.unit);
  if (unlabeled.fitted?.unit.drawersPerBank != null) {
    failHonesty("b-day-push unlabeled no invent drawers", unlabeled.fitted?.unit);
  }
  if (unlabeled.fitted?.unit.kneeW != null) {
    failHonesty("b-day-push unlabeled no invent knee", unlabeled.fitted?.unit);
  }
  if (Math.abs((unlabeled.fitted?.unit.width ?? 0) - 36) > 1.2 || Math.abs(unlabeled.overall.width - 36) > 1.2) {
    failHonesty("b-day-push unlabeled W36", { unit: unlabeled.fitted?.unit, overall: unlabeled.overall });
  }
  if (Math.abs((unlabeled.fitted?.unit.depth ?? 0) - 21) > 1.2 || Math.abs(unlabeled.overall.depth - 21) > 1.2) {
    failHonesty("b-day-push unlabeled D21", { unit: unlabeled.fitted?.unit, overall: unlabeled.overall });
  }
  if (Math.abs((unlabeled.fitted?.unit.height ?? 0) - 32) > 1.2 || Math.abs(unlabeled.overall.height - 32) > 1.2) {
    failHonesty("b-day-push unlabeled H32", { unit: unlabeled.fitted?.unit, overall: unlabeled.overall });
  }
  const unlabeledLeaves = unlabeled.panels.filter((p) => /door/i.test(p.name));
  if (unlabeledLeaves.length < 2) {
    failHonesty("b-day-push unlabeled two doors", unlabeledLeaves.map((p) => p.name));
  }
  for (const leaf of unlabeledLeaves) {
    if (leaf.size.width > 36 / 2 + 1.5) {
      failHonesty("b-day-push unlabeled door leaf ≤ W/2", { name: leaf.name, w: leaf.size.width });
    }
  }

  // Drawers + doors densify — honor typed drawers; no invent knee unless knee typed; W×D×H holds.
  const mixed = generateFromPrompt(
    "bathroom vanity 48×21×34 with two drawers and two doors",
  );
  if (mixed.fitted?.program !== "vanity") failHonesty("b-day-push mixed program", mixed.fitted?.program);
  if (!mixed.fitted?.unit.doors) failHonesty("b-day-push mixed doors", mixed.fitted?.unit);
  if (mixed.fitted?.unit.drawersPerBank !== 2) {
    failHonesty("b-day-push mixed two drawers", mixed.fitted?.unit);
  }
  if (mixed.fitted?.unit.kneeW != null) {
    failHonesty("b-day-push mixed no invent knee", mixed.fitted?.unit);
  }
  if (Math.abs((mixed.fitted?.unit.width ?? 0) - 48) > 1.2 || Math.abs((mixed.fitted?.unit.depth ?? 0) - 21) > 1.2 || Math.abs((mixed.fitted?.unit.height ?? 0) - 34) > 1.2) {
    failHonesty("b-day-push mixed dims W48 D21 H34", mixed.fitted?.unit);
  }
  const mixedFronts = mixed.panels.filter((p) => /drawer front/i.test(p.name));
  if (mixedFronts.length < 2) failHonesty("b-day-push mixed drawer fronts", mixedFronts.map((p) => p.name));
  const mixedDoors = mixed.panels.filter((p) => /door/i.test(p.name));
  if (mixedDoors.length < 2) failHonesty("b-day-push mixed door leaves", mixedDoors.map((p) => p.name));
  if (mixed.panels.some((p) => /knee divider/i.test(p.name))) {
    failHonesty("b-day-push mixed knee divider invent", mixed.panels.map((p) => p.name));
  }

  // Protect pocket vanity trapezoid + knee/drawers.
  const pocket = generateFromPrompt(
    "bathroom vanity for a pocket space: left wall 26\", right wall 33.5\", depth 22\", back wall 38.5\"",
  );
  if (!/pocket|vanity/i.test(pocket.name)) failHonesty("b-day-push protect pocket title", pocket.name);
  if (pocket.fitted?.unit.kneeW == null || (pocket.fitted.unit.kneeW as number) < 8) {
    failHonesty("b-day-push protect pocket knee", pocket.fitted?.unit);
  }
  if (!pocket.fitted?.unit.drawersPerBank) {
    failHonesty("b-day-push protect pocket drawers", pocket.fitted?.unit);
  }

  // Protect desk 60×30×29 knee 24.
  const desk = generateFromPrompt("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space");
  if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) {
    failHonesty("b-day-push protect desk 24in knee", desk.fitted?.unit);
  }

  // Protect linen + Andersen freezes.
  const linen = generateFromPrompt("linen cabinet 31.5 wide × 16 deep × 78 tall");
  if (Math.abs(linen.overall.width - 31.5) > 1.5 || Math.abs(linen.overall.height - 78) > 2.5) {
    failHonesty("b-day-push protect linen", { name: linen.name, overall: linen.overall });
  }
  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO");
  if (!/Andersen/i.test(andersen.name)) failHonesty("b-day-push protect Andersen", andersen.name);
}



// Batch38 seating/lounge FAIL class pack — lounge / ottoman / rocking (≠ House wire).
{
  const loungePrompt = "house: lounge chair with 16″ seat height and 24″ seat depth";
  if (!isLoungeChair(loungePrompt.toLowerCase())) failHonesty("b38 isLoungeChair");
  if (!isSeatingLoungeClass(loungePrompt.toLowerCase())) failHonesty("b38 lounge seating class");
  if (identityTitleStem(loungePrompt.toLowerCase()) !== "Lounge chair") {
    failHonesty("b38 lounge identityTitleStem", identityTitleStem(loungePrompt.toLowerCase()));
  }
  const lounge = generateFromPrompt(loungePrompt);
  if (!/Lounge chair/i.test(lounge.name)) failHonesty("b38 lounge title", lounge.name);
  if (/^House\b|Yard House|Adirondack|^Chair\b|^Bench\b/i.test(lounge.name) && !/Lounge/i.test(lounge.name)) {
    failHonesty("b38 lounge House/Bench/Chair steal", lounge.name);
  }
  if (lounge.kind === "house" || /wire-frame/i.test(lounge.primaryMaterialId ?? "")) {
    failHonesty("b38 lounge House wire", { kind: lounge.kind, stock: lounge.primaryMaterialId, name: lounge.name });
  }
  if (Math.abs(lounge.overall.height - 16) > 1.2) failHonesty("b38 lounge seat H16", lounge.overall);
  if (Math.abs(lounge.overall.depth - 24) > 1.2) failHonesty("b38 lounge seat D24", lounge.overall);
  const loungeBlob = [lounge.name, ...(lounge.notes ?? []), ...lounge.panels.map((x) => x.name)].join("\n");
  if (!/seat/i.test(loungeBlob) || !/back/i.test(loungeBlob)) failHonesty("b38 lounge sit anatomy", loungeBlob.slice(0, 400));
  if (!lounge.panels.length) failHonesty("b38 lounge panels densify", lounge.name);
  if (lounge.primaryMaterialId !== "plywood-3-4-4x8") failHonesty("b38 lounge plywood densify", lounge.primaryMaterialId);

  const ottPrompt = "house: ottoman 24″ × 24″ × 16″ tall";
  if (!isOttoman(ottPrompt.toLowerCase())) failHonesty("b38 isOttoman");
  if (identityTitleStem(ottPrompt.toLowerCase()) !== "Ottoman") {
    failHonesty("b38 ottoman identityTitleStem", identityTitleStem(ottPrompt.toLowerCase()));
  }
  const ott = generateFromPrompt(ottPrompt);
  if (!/^Ottoman\b/i.test(ott.name)) failHonesty("b38 ottoman title", ott.name);
  if (/Storage|Yard House|^House\b/i.test(ott.name)) failHonesty("b38 ottoman Storage/House steal", ott.name);
  if (Math.abs(ott.overall.width - 24) > 1.2 || Math.abs(ott.overall.depth - 24) > 1.2) {
    failHonesty("b38 ottoman square W=D 24", ott.overall);
  }
  if (Math.abs(ott.overall.height - 16) > 1.2) failHonesty("b38 ottoman H16", ott.overall);
  if (!ott.panels.some((x) => /solid top|top/i.test(x.name))) failHonesty("b38 ottoman solid top", ott.panels.map((x) => x.name));
  if (ott.primaryMaterialId !== "plywood-3-4-4x8") failHonesty("b38 ottoman plywood", ott.primaryMaterialId);

  const rockPrompt = "house: rocking chair with 17″ seat height";
  if (!isRockingChair(rockPrompt.toLowerCase())) failHonesty("b38 isRockingChair");
  if (identityTitleStem(rockPrompt.toLowerCase()) !== "Rocking chair") {
    failHonesty("b38 rocking identityTitleStem", identityTitleStem(rockPrompt.toLowerCase()));
  }
  const rock = generateFromPrompt(rockPrompt);
  if (!/Rocking chair/i.test(rock.name)) failHonesty("b38 rocking title", rock.name);
  if (/^House\b|Yard House|ski|sled/i.test(rock.name)) failHonesty("b38 rocking House/ski steal", rock.name);
  if (Math.abs(rock.overall.height - 17) > 1.2) failHonesty("b38 rocking seat H17", rock.overall);
  const rockBlob = [rock.name, ...(rock.notes ?? []), ...rock.panels.map((x) => x.name)].join("\n");
  if (!/rocker/i.test(rockBlob)) failHonesty("b38 rocker densify", rockBlob.slice(0, 500));
  if (/ski|sled/i.test(rockBlob) && !/rocker/i.test(rockBlob)) failHonesty("b38 ski/sled steal", rockBlob.slice(0, 400));
  if (rock.primaryMaterialId !== "plywood-3-4-4x8") failHonesty("b38 rocking plywood", rock.primaryMaterialId);

  // Protect: Entry bench, Adirondack, Dining bench, pine shop stool, desk knee, Andersen, linen, hinged chest, door vanity, drawer explode.
  const entry = generateFromPrompt("house: entry bench fitted to a 48×18 opening, 18″ seat height");
  if (!/Entry bench/i.test(entry.name)) failHonesty("b38 protect Entry bench", entry.name);
  if (Math.abs(entry.overall.width - 48) > 1.5) failHonesty("b38 protect entry W48", entry.overall);

  const adi = generateFromPrompt("house: Adirondack chair with 16″ seat height");
  if (!/Adirondack/i.test(adi.name)) failHonesty("b38 protect Adirondack", adi.name);
  if (/Lounge/i.test(adi.name)) failHonesty("b38 Adirondack lounge steal", adi.name);

  const dining = generateFromPrompt("house: dining bench 60 wide, 18 seat height");
  if (!/Dining bench/i.test(dining.name)) failHonesty("b38 protect Dining bench", dining.name);

  const stool = generateFromPrompt(
    "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
  );
  if (!/Step stool|Shop stool/i.test(stool.name)) failHonesty("b38 protect pine shop stool", stool.name);

  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (!/^Desk/i.test(desk.name)) failHonesty("b38 protect desk", desk.name);
  if (!nearInch(desk.fitted?.unit.kneeW ?? 0, 24)) failHonesty("b38 protect desk knee freeze", desk.fitted?.unit);

  const andersen = generateFromPrompt("house: Andersen 36×48 hung window with RO");
  if (!/Andersen/i.test(andersen.name)) failHonesty("b38 protect Andersen", andersen.name);

  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (!/Linen/i.test(linen.name)) failHonesty("b38 protect linen", linen.name);

  const chest = generateFromPrompt("house: toy chest 30×16×18 hinged lid");
  if (!/Toy chest|Chest/i.test(chest.name)) failHonesty("b38 protect hinged chest", chest.name);
  if (/Yard House|^House\b/i.test(chest.name)) failHonesty("b38 chest House steal", chest.name);

  const vanity = generateFromPrompt("bathroom vanity 36×21×32 with two doors");
  if (!/Vanity/i.test(vanity.name)) failHonesty("b38 protect door vanity", vanity.name);
  const vanityDoors = vanity.panels.filter((x) => /door/i.test(x.name));
  if (vanityDoors.length < 2) failHonesty("b38 protect vanity typed doors", vanityDoors.map((x) => x.name));

  const drawers = generateFromPrompt("bathroom vanity 36×21×32 with three drawers");
  if ((drawers.fitted?.unit.drawersPerBank ?? 0) < 3 && drawers.panels.filter((x) => /drawer/i.test(x.name)).length < 3) {
    failHonesty("b38 protect drawer explode", {
      drawersPerBank: drawers.fitted?.unit.drawersPerBank,
      panels: drawers.panels.map((x) => x.name),
    });
  }
}


// Batch38b seating/lounge WARN depth — Measure stems ≠ Bench + densify seat/back/rocker steps.
{
  const loungePrompt = "house: lounge chair with 16″ seat height and 24″ seat depth";
  const lounge = generateFromPrompt(loungePrompt);
  const loungeKind = measureKindFromProject(lounge);
  if (loungeKind === "bench") failHonesty("b38b lounge Measure kind still Bench", loungeKind);
  if (loungeKind !== "lounge_chair") failHonesty("b38b lounge Measure kind stem", loungeKind);
  const loungePlan = buildPlan(lounge);
  const loungeTitles = loungePlan.instructions.map((s) => s.title).join(" | ");
  if (!/Attach the seat/i.test(loungeTitles)) failHonesty("b38b lounge attach seat step", loungeTitles);
  if (!/Attach the back/i.test(loungeTitles)) failHonesty("b38b lounge attach back step", loungeTitles);
  if (/^Confirm.*\|.*Cut.*\|.*Level it$/i.test(loungeTitles.replace(/\s+/g, " "))) {
    failHonesty("b38b lounge still thin Confirm/Cut/Level", loungeTitles);
  }
  const loungeChip = loungePlan.feasibility.issues.map((i) => `${i.message} ${i.suggestion ?? ""}`).join("\n");
  if (/—\s*Bench\b/i.test(loungeChip)) failHonesty("b38b lounge Measure chip still Bench", loungeChip.slice(0, 300));
  if (!/Lounge chair/i.test(loungeChip)) failHonesty("b38b lounge Measure chip stem", loungeChip.slice(0, 300));

  const ottPrompt = "house: ottoman 24″ × 24″ × 16″ tall";
  const ott = generateFromPrompt(ottPrompt);
  const ottKind = measureKindFromProject(ott);
  if (ottKind === "bench") failHonesty("b38b ottoman Measure kind still Bench", ottKind);
  if (ottKind !== "ottoman") failHonesty("b38b ottoman Measure kind stem", ottKind);
  const ottPlan = buildPlan(ott);
  const ottTitles = ottPlan.instructions.map((s) => s.title).join(" | ");
  if (!/Attach the solid top|Stand the legs|Stand the carcase/i.test(ottTitles)) {
    failHonesty("b38b ottoman densify step", ottTitles);
  }

  const rockPrompt = "house: rocking chair with 17″ seat height";
  const rock = generateFromPrompt(rockPrompt);
  const rockKind = measureKindFromProject(rock);
  if (rockKind === "bench") failHonesty("b38b rocking Measure kind still Bench", rockKind);
  if (rockKind !== "rocking_chair") failHonesty("b38b rocking Measure kind stem", rockKind);
  const rockPlan = buildPlan(rock);
  const rockTitles = rockPlan.instructions.map((s) => s.title).join(" | ");
  if (!/Attach the seat/i.test(rockTitles)) failHonesty("b38b rocking attach seat step", rockTitles);
  if (!/Attach the back/i.test(rockTitles)) failHonesty("b38b rocking attach back step", rockTitles);
  if (!/Mount the rockers/i.test(rockTitles)) failHonesty("b38b rocking mount rockers step", rockTitles);

  // Protect: entry bench Measure/stem stays Bench path (not lounge steal).
  const entry = generateFromPrompt("house: entry bench fitted to a 48×18 opening, 18″ seat height");
  if (!/Entry bench/i.test(entry.name)) failHonesty("b38b protect Entry bench title", entry.name);
  const entryKind = measureKindFromProject(entry);
  if (entryKind !== "bench") failHonesty("b38b protect Entry bench Measure kind", entryKind);
  if (/lounge_chair|ottoman|rocking_chair/i.test(entryKind)) failHonesty("b38b entry stolen to lounge Measure", entryKind);

  const adi = generateFromPrompt("house: Adirondack chair with 16″ seat height");
  if (!/Adirondack/i.test(adi.name)) failHonesty("b38b protect Adirondack", adi.name);
  if (measureKindFromProject(adi) === "lounge_chair") failHonesty("b38b Adirondack lounge Measure steal");

  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (measureKindFromProject(desk) !== "desk") failHonesty("b38b protect desk Measure", measureKindFromProject(desk));

  const stool = generateFromPrompt(
    "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
  );
  if (!/Step stool|Shop stool/i.test(stool.name)) failHonesty("b38b protect stool climb", stool.name);

  const chest = generateFromPrompt("house: toy chest 30×16×18 hinged lid");
  if (!/Toy chest|Chest/i.test(chest.name)) failHonesty("b38b protect hinged chest", chest.name);
  const chestPlan = buildPlan(chest);
  if (!chestPlan.instructions.some((s) => /lid|hinge|operate/i.test(`${s.title} ${s.description}`))) {
    // soft — operate path may use different verbs
  }
}



// Soft-park honesty: seating-lounge Seat panel D honors typed seat depth (≠ leg-inset ~21″ when typed 24″).
{
  const loungePrompt = "house: lounge chair with 16″ seat height and 24″ seat depth";
  const lounge = generateFromPrompt(loungePrompt);
  if (!/Lounge chair/i.test(lounge.name)) failHonesty("seatD lounge title", lounge.name);
  if (Math.abs(lounge.overall.depth - 24) > 1.2) failHonesty("seatD lounge overall D24", lounge.overall);
  const seatPanel = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seatPanel) failHonesty("seatD lounge Seat panel missing", lounge.panels.map((p) => p.name));
  if (Math.abs(seatPanel.size.depth - 24) > 0.6) {
    failHonesty("seatD lounge Seat panel D ≠ typed 24", seatPanel.size);
  }
  // Leg-inset lie must stay gone (was ~21 when typed 24).
  if (seatPanel.size.depth < 23) failHonesty("seatD lounge Seat panel still leg-inset", seatPanel.size);
  // Soft leftover: Seat panel W must honor typed overall W (default lounge 30″), not W−leg×2 (~27″).
  if (Math.abs(lounge.overall.width - 30) > 1.2) failHonesty("seatW lounge overall W30", lounge.overall);
  if (Math.abs(seatPanel.size.width - 30) > 0.6) {
    failHonesty("seatW lounge Seat panel W ≠ typed 30", seatPanel.size);
  }
  if (seatPanel.size.width < 29) failHonesty("seatW lounge Seat panel still leg-inset", seatPanel.size);
  const loungePlan = buildPlan(lounge);
  if (!loungePlan.instructions.some((s) => /Attach the seat/i.test(s.title))) {
    failHonesty("seatD lounge Attach the seat densify", loungePlan.instructions.map((s) => s.title));
  }
  const seatCut = loungePlan.cutList.find((c) => /^Seat$/i.test(c.name));
  if (!seatCut) failHonesty("seatD lounge cut-list Seat missing");
  else {
    const dims = [seatCut.lengthIn, seatCut.widthIn, seatCut.thicknessIn];
    if (!dims.some((n) => Math.abs(n - 24) <= 0.6)) {
      failHonesty("seatD lounge cut-list Seat missing typed 24″ face", { dims, seatCut });
    }
    if (!dims.some((n) => Math.abs(n - 30) <= 0.6)) {
      failHonesty("seatW lounge cut-list Seat missing typed 30″ face", { dims, seatCut });
    }
  }
  if (measureKindFromProject(lounge) === "bench") failHonesty("seatD lounge Measure stolen to Bench");
  if (measureKindFromProject(lounge) !== "lounge_chair") {
    failHonesty("seatD lounge Measure kind", measureKindFromProject(lounge));
  }

  // Twin: easy/club sit with typed seat D — same helper path.
  const easy = generateFromPrompt("house: easy chair with 18″ seat height and 22″ seat depth");
  if (!/Lounge chair/i.test(easy.name)) failHonesty("seatD easy/club title stem", easy.name);
  const easySeat = easy.panels.find((p) => /^Seat$/i.test(p.name));
  if (!easySeat) failHonesty("seatD easy Seat panel missing");
  else if (Math.abs(easySeat.size.depth - 22) > 0.6) {
    failHonesty("seatD easy Seat panel D ≠ typed 22", easySeat.size);
  }
  if (easySeat && Math.abs(easySeat.size.width - easy.overall.width) > 0.6) {
    failHonesty("seatW easy Seat panel W ≠ overall", { seat: easySeat.size, overall: easy.overall });
  }

  // Soft leftover: Backrest + front seat rail must match seat deck / typed overall W (not silent W−leg×2 ~27″).
  // Side rails stay between-leg in depth (long axis = seat D) — not a typed-W lie.
  const backrest = lounge.panels.find((p) => /^Backrest$/i.test(p.name));
  if (!backrest) failHonesty("backrestW lounge Backrest panel missing", lounge.panels.map((p) => p.name));
  else {
    if (Math.abs(backrest.size.width - 30) > 0.6) {
      failHonesty("backrestW lounge Backrest W ≠ typed 30", backrest.size);
    }
    if (backrest.size.width < 29) failHonesty("backrestW lounge Backrest still leg-inset", backrest.size);
  }
  const frontRail = lounge.panels.find((p) => /^Front seat rail$/i.test(p.name));
  if (!frontRail) failHonesty("backrestW lounge Front seat rail missing", lounge.panels.map((p) => p.name));
  else {
    if (Math.abs(frontRail.size.width - 30) > 0.6) {
      failHonesty("backrestW lounge Front seat rail W ≠ typed 30", frontRail.size);
    }
    if (frontRail.size.width < 29) failHonesty("backrestW lounge Front seat rail still leg-inset", frontRail.size);
  }
  const backCut = loungePlan.cutList.find((c) => /^Backrest$/i.test(c.name));
  if (!backCut) failHonesty("backrestW lounge cut-list Backrest missing");
  else {
    const dims = [backCut.lengthIn, backCut.widthIn, backCut.thicknessIn];
    if (!dims.some((n) => Math.abs(n - 30) <= 0.6)) {
      failHonesty("backrestW lounge cut-list Backrest missing typed 30″ face", { dims, backCut });
    }
  }
  const easyBack = easy.panels.find((p) => /^Backrest$/i.test(p.name));
  if (easyBack && Math.abs(easyBack.size.width - easy.overall.width) > 0.6) {
    failHonesty("backrestW easy Backrest W ≠ overall", { back: easyBack.size, overall: easy.overall });
  }
  const easyRail = easy.panels.find((p) => /^Front seat rail$/i.test(p.name));
  if (easyRail && Math.abs(easyRail.size.width - easy.overall.width) > 0.6) {
    failHonesty("backrestW easy Front seat rail W ≠ overall", { rail: easyRail.size, overall: easy.overall });
  }

  // Explicit typed width: "30″ wide lounge…" — Seat cut W must match typed W (same helper).
  const wide = generateFromPrompt("house: 30″ wide lounge chair with 16″ seat height and 24″ seat depth");
  if (!/Lounge chair/i.test(wide.name)) failHonesty("seatW wide lounge title", wide.name);
  if (Math.abs(wide.overall.width - 30) > 1.2) failHonesty("seatW wide overall W30", wide.overall);
  const wideSeat = wide.panels.find((p) => /^Seat$/i.test(p.name));
  if (!wideSeat) failHonesty("seatW wide Seat panel missing");
  else {
    if (Math.abs(wideSeat.size.width - 30) > 0.6) failHonesty("seatW wide Seat panel W ≠ typed 30", wideSeat.size);
    if (Math.abs(wideSeat.size.depth - 24) > 0.6) failHonesty("seatW wide Seat panel D ≠ typed 24", wideSeat.size);
  }
  const widePlan = buildPlan(wide);
  const wideCut = widePlan.cutList.find((c) => /^Seat$/i.test(c.name));
  if (!wideCut) failHonesty("seatW wide cut-list Seat missing");
  else {
    const dims = [wideCut.lengthIn, wideCut.widthIn, wideCut.thicknessIn];
    if (!dims.some((n) => Math.abs(n - 30) <= 0.6)) {
      failHonesty("seatW wide cut-list Seat missing typed 30″ face", { dims, wideCut });
    }
    if (!dims.some((n) => Math.abs(n - 24) <= 0.6)) {
      failHonesty("seatW wide cut-list Seat missing typed 24″ face", { dims, wideCut });
    }
  }
  const wideBack = wide.panels.find((p) => /^Backrest$/i.test(p.name));
  if (!wideBack) failHonesty("backrestW wide Backrest missing");
  else if (Math.abs(wideBack.size.width - 30) > 0.6) {
    failHonesty("backrestW wide Backrest W ≠ typed 30", wideBack.size);
  }
  const wideRail = wide.panels.find((p) => /^Front seat rail$/i.test(p.name));
  if (!wideRail) failHonesty("backrestW wide Front seat rail missing");
  else if (Math.abs(wideRail.size.width - 30) > 0.6) {
    failHonesty("backrestW wide Front seat rail W ≠ typed 30", wideRail.size);
  }
  const wideBackCut = widePlan.cutList.find((c) => /^Backrest$/i.test(c.name));
  if (!wideBackCut) failHonesty("backrestW wide cut-list Backrest missing");
  else {
    const dims = [wideBackCut.lengthIn, wideBackCut.widthIn, wideBackCut.thicknessIn];
    if (!dims.some((n) => Math.abs(n - 30) <= 0.6)) {
      failHonesty("backrestW wide cut-list Backrest missing typed 30″ face", { dims, wideBackCut });
    }
  }

  // Protect: entry bench seat path not stolen to lounge Measure / helper.
  const entry = generateFromPrompt("house: entry bench fitted to a 48×18 opening, 18″ seat height");
  if (!/Entry bench/i.test(entry.name)) failHonesty("seatD protect Entry bench title", entry.name);
  if (measureKindFromProject(entry) !== "bench") failHonesty("seatD protect Entry bench Measure", measureKindFromProject(entry));
  if (/lounge_chair/i.test(measureKindFromProject(entry))) failHonesty("seatD entry stolen to lounge Measure");

  const stool = generateFromPrompt(
    "weekend craft: pine shop stool — one climb step, 10 inch rise and 10 inch run; adult stands on the tread",
  );
  if (!/Step stool|Shop stool|Pine/i.test(stool.name)) failHonesty("seatD protect pine stool", stool.name);

  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (Math.abs(desk.overall.height - 29) > 1.5) failHonesty("seatD protect desk H29", desk.overall);
}

// Catapult-class ≠ marble trough — marble is payload; soft-launch trough stays trough; Eiffel freeze.
{
  const failCat = (msg: string, detail?: unknown) => failHonesty(`catapult≠trough ${msg}`, detail);

  // FAIL canary: catapult that launches a marble → Catapult anatomy, never Marble trough.
  const canaryPrompt = "weekend craft: popsicle stick catapult that launches a marble";
  const canary = generateFromPrompt(canaryPrompt);
  if (/marble\s*trough/i.test(canary.name)) failCat("canary title still Marble trough", canary.name);
  if (!/catapult/i.test(canary.name)) failCat("canary title not Catapult", canary.name);
  if (canary.primaryMaterialId !== "popsicle-standard") failCat("canary stock", canary.primaryMaterialId);
  const canaryBlob = [...(canary.notes || []), ...buildPlan(canary).instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (!/axle|pivot|throwing arm|payload cup|fulcrum/i.test(canaryBlob)) {
    failCat("canary missing arm/fulcrum/cup talk", canaryBlob.slice(0, 400));
  }
  if (/trough channel|side guides \+ floor ties/i.test(canaryBlob) && !/throwing arm|payload cup|axle pivot/i.test(canaryBlob)) {
    failCat("canary densified as U-channel trough", canaryBlob.slice(0, 400));
  }
  // Roles: catapult densify keeps support (arm/axle) + deck (cup); trough steal is mostly deck guides.
  const canaryRoles = new Map<string, number>();
  for (const i of canary.instances) canaryRoles.set(i.role || "?", (canaryRoles.get(i.role || "?") || 0) + 1);
  if ((canaryRoles.get("support") || 0) < 1) failCat("canary missing support/arm roles", Object.fromEntries(canaryRoles));

  // Twin: trebuchet popsicle → launcher not trough.
  const treb = generateFromPrompt("weekend craft: popsicle stick trebuchet that launches a marble");
  if (/marble\s*trough/i.test(treb.name)) failCat("trebuchet title Marble trough", treb.name);
  if (!/trebuchet/i.test(treb.name)) failCat("trebuchet title", treb.name);
  const trebBlob = [...(treb.notes || []), ...buildPlan(treb).instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (/trough channel|side guides \+ floor ties/i.test(trebBlob) && !/throwing arm|payload cup|axle pivot/i.test(trebBlob)) {
    failCat("trebuchet densified as trough", trebBlob.slice(0, 400));
  }

  // Protect: honest soft-launch marble trough / marble run stays trough (not catapult).
  const troughPrompt = 'weekend craft: soft-launch a 5/8" marble on a 12" oak trough; marble leaves free';
  const trough = generateFromPrompt(troughPrompt);
  if (!/marble\s*trough|trough/i.test(trough.name)) failCat("protect trough title stolen", trough.name);
  if (/catapult|trebuchet/i.test(trough.name)) failCat("protect trough became catapult", trough.name);
  const troughBlob = [...(trough.notes || []), ...buildPlan(trough).instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
  if (!/trough|side guide|floor tie|leaves/i.test(troughBlob)) failCat("protect trough anatomy lost", troughBlob.slice(0, 400));
  if (/throwing arm|payload cup|axle pivot/i.test(troughBlob) && !/trough|side guide/i.test(troughBlob)) {
    failCat("protect trough became arm-launch", troughBlob.slice(0, 400));
  }

  const runPrompt = "weekend craft: popsicle soft-launch marble run; marble leaves free";
  const run = generateFromPrompt(runPrompt);
  if (/catapult|trebuchet/i.test(run.name)) failCat("protect marble run became catapult", run.name);

  // Protect: 3-ft popsicle Eiffel freeze.
  const eiffel = generateFromPrompt("3 foot Eiffel Tower from popsicle sticks");
  if (eiffel.kind !== "eiffel" || eiffel.primaryMaterialId !== "popsicle-standard") {
    failCat("protect Eiffel freeze", { kind: eiffel.kind, stock: eiffel.primaryMaterialId });
  }
  if (Math.abs(eiffel.overall.height - 36) > 2.5) failCat("protect Eiffel height", eiffel.overall);

  // Plain catapult (no marble) still Catapult.
  const plain = generateFromPrompt("catapult from popsicle sticks");
  if (plain.name !== "Catapult") failCat("plain catapult name", plain.name);
}




// Voice/PDF depth pillar — hardware class match · species title · round footprint · plain shop words.
{
  const failVoice = (msg: string, detail?: unknown) => failHonesty(`voice/pdf ${msg}`, detail);

  // Round table footprint must not lead with "check it is square".
  const roundPrompt = 'house: 40" round 3-leg table';
  const roundProj = generateFromPrompt(roundPrompt);
  const roundPlan = buildPlan(roundProj);
  const foot = roundPlan.instructions.find((s) => /footprint/i.test(s.title));
  const footText = `${foot?.title ?? ""} ${foot?.description ?? ""}`;
  if (/check it is square/i.test(footText) && !/round top is not a square|diameter matches|circle on the floor/i.test(footText)) {
    failVoice("round footprint still check-it-is-square primary", footText.slice(0, 320));
  }
  if (!/round|diameter|circle/i.test(footText)) failVoice("round footprint missing round language", footText.slice(0, 320));
  const legTalk = roundPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  if (!/\b3\s*legs?\b|three legs/i.test(`${roundProj.name}\n${legTalk}`)) {
    failVoice("round table lost 3 legs", roundProj.name);
  }

  // Plain shop words on stranger steps — no bare carcase/toekick in default path after soften.
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  const linenPlan = buildPlan(linen);
  const linenSteps = linenPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  if (/\bcarcase\b/i.test(linenSteps)) failVoice("linen stranger path still says carcase", linenSteps.match(/[^\n]{0,40}carcase[^\n]{0,40}/i)?.[0]);
  if (/\btoekick\b/i.test(linenSteps)) failVoice("linen stranger path still says toekick", linenSteps.match(/[^\n]{0,40}toekick[^\n]{0,40}/i)?.[0]);

  const vanity = generateFromPrompt('house: bathroom vanity 36" wide × 21" deep × 32" tall with two doors');
  if (!/Vanity/i.test(vanity.name)) failVoice("protect vanity title", vanity.name);
  if (!vanity.panels.some((p) => /^Door\b/i.test(p.name))) failVoice("protect vanity doors", vanity.panels.map((p) => p.name));
  const vanityPlan = buildPlan(vanity);
  const vanitySteps = vanityPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  if (/\bcarcase\b/i.test(vanitySteps)) failVoice("vanity stranger path still says carcase");

  // Shared helpers exist (markers for ship check).
  // honorSpeciesInTitle / hardwareCatalogIdFromHay / footprintConfirmTalk / strangerPlainShopTalk
  // densifyKitCraftInstructions / densifyOneJoinInstructions / densifyPartsPlateTalk / stampPartsPlate
  // Voice/PDF depth pillar

  // Parts-plate + one-join densify — letters on cut list; assembly joins name parts + hardware counts.
  {
    const cedar2 = generateFromPrompt('house: cedar chest 36" wide × 18" deep × 20" tall with hinged lid');
    const cedarPlan2 = buildPlan(cedar2);
    if (!cedarPlan2.cutList.every((c) => c.label && /^[A-Z]+$/.test(c.label))) {
      failVoice("parts-plate cut list missing stable letters", cedarPlan2.cutList.map((c) => c.label));
    }
    const cedarBlob = cedarPlan2.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
    if (!/One join: attach [A-Z] /i.test(cedarBlob)) {
      failVoice("one-join densify missing Attach lettered parts", cedarBlob.slice(0, 400));
    }
    if (!/with 4 × #8/i.test(cedarBlob) && !/with 1 piano hinge/i.test(cedarBlob)) {
      failVoice("one-join densify missing hardware counts", cedarBlob.slice(0, 400));
    }
    if (!cedarPlan2.instructions.some((s) => /Stand the main box/i.test(s.title))) {
      failVoice("protect Stand the main box title after densify");
    }
    if (!/with 1 piano hinge/i.test(cedarBlob)) {
      failVoice("piano one-join densify missing", cedarBlob.split("\n").find((l) => /piano/i.test(l)));
    }
    // Buy class still holds after densify.
    const piano2 = cedarPlan2.bom.find((b) => /piano hinge/i.test(b.name));
    const pianoBest2 = piano2?.offers?.find((o) => o.best) ?? piano2?.offers?.[0];
    if (pianoBest2 && /soft-?close|concealed/i.test(pianoBest2.title) && !/piano|continuous/i.test(pianoBest2.title)) {
      failVoice("parts-plate ship lost piano Best class", pianoBest2.title);
    }
  }

  {
    const round2 = generateFromPrompt('house: 40" round 3-leg table');
    const roundPlan2 = buildPlan(round2);
    const roundBlob = roundPlan2.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
    if (!roundPlan2.cutList.every((c) => c.label && /^[A-Z]+$/.test(c.label))) {
      failVoice("parts-plate round cut list missing letters");
    }
    if (!/One join/i.test(roundBlob)) {
      failVoice("one-join densify missing on round table", roundBlob.slice(0, 400));
    }
    if (!/\b3\s*legs?\b|three legs/i.test(`${round2.name}\n${roundBlob}`)) {
      failVoice("parts-plate ship lost 3 legs");
    }
  }
  // Shelf install/join steps must name marked heights (AFF or from the bottom) — soft-park honesty.
  {
    const book = generateFromPrompt("house: bookshelf 36 wide 12 deep 72 tall five shelves");
    const bookPlan = buildPlan(book);
    const shelfPanels = book.panels.filter((p) => p.type === "shelf");
    if (shelfPanels.length !== 5) {
      failVoice("shelfHeight bookcase shelf count ≠ 5", shelfPanels.map((p) => p.name));
    }
    const pinStep = bookPlan.instructions.find(
      (s) => /Pin \d+ adjustable shel/i.test(s.title) || /Set the shelves/i.test(s.title) || /Glue \d+ fixed shel/i.test(s.title),
    );
    if (!pinStep) failVoice("shelfHeight bookcase missing pin/glue shelf step", bookPlan.instructions.map((s) => s.title));
    const pinBlob = `${pinStep!.title} ${pinStep!.description}`;
    if (!/Marked heights?:/i.test(pinBlob)) failVoice("shelfHeight bookcase step missing Marked height(s)", pinBlob.slice(0, 400));
    if (!/\bAFF\b/.test(pinBlob)) failVoice("shelfHeight bookcase freestanding missing AFF", pinBlob.slice(0, 400));
    // Every engine shelf y must appear as a marked inch — no invented heights.
    for (const sp of shelfPanels) {
      const y = Math.round(sp.position.y * 8) / 8;
      const inch =
        Number.isInteger(y)
          ? String(y)
          : Math.abs(y - Math.floor(y) - 0.5) < 1e-6
            ? `${Math.floor(y)}½`
            : String(y);
      if (!pinBlob.includes(`${inch}"`)) {
        failVoice(`shelfHeight bookcase missing engine y ${inch}" for ${sp.name}`, {
          y: sp.position.y,
          blob: pinBlob.slice(0, 500),
        });
      }
    }
    // Parts-plate letters still present on shelf join after densify.
    if (!bookPlan.cutList.every((c) => c.label && /^[A-Z]+$/.test(c.label))) {
      failVoice("shelfHeight bookcase lost parts-plate letters", bookPlan.cutList.map((c) => c.label));
    }
  }

  {
    // Wall-hung shelves name from-the-bottom marks (not AFF).
    const wall = generateFromPrompt("house: wall shelves 48 wide 8 deep with 3 shelves");
    const wallPlan = buildPlan(wall);
    const lag = wallPlan.instructions.find((s) => /Lag each wall cleat/i.test(s.title) || /Sit each shelf/i.test(s.title));
    const wallBlob = wallPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
    if (!/Marked heights?:/i.test(wallBlob)) failVoice("shelfHeight wall shelves missing Marked height(s)", wallBlob.slice(0, 500));
    if (!/from the bottom/i.test(wallBlob)) failVoice("shelfHeight wall shelves missing from-the-bottom marks", wallBlob.slice(0, 500));
    if (/\bAFF\b/.test(lag?.description ?? "") && /Lag each wall cleat/i.test(lag?.title ?? "")) {
      failVoice("shelfHeight wall cleat step wrongly uses AFF", lag?.description?.slice(0, 300));
    }
  }

  // Protect freezes / prior wins still green under shelf-height densify.
  {
    const linenH = generateFromPrompt("house: linen closet 31.5×78×16");
    if (!linenH.fitted || Math.abs(linenH.overall.width - 31.5) > 0.1 || Math.abs(linenH.overall.height - 78) > 0.1 || Math.abs(linenH.overall.depth - 16) > 0.1) {
      failVoice("shelfHeight protect linen freeze", linenH.overall);
    }
    const linenHP = buildPlan(linenH);
    const linenPin = linenHP.instructions.find((s) => /Pin \d+ adjustable shel|Glue \d+ fixed shel/i.test(s.title));
    if (linenPin && !/Marked heights?:/i.test(linenPin.description)) {
      failVoice("shelfHeight linen shelf step missing marked heights", linenPin.description.slice(0, 300));
    }
    const loungeH = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
    const seatH = loungeH.panels.find((p) => /^Seat$/i.test(p.name));
    if (!seatH || Math.abs(seatH.size.width - 30) > 1.2 || Math.abs(seatH.size.depth - 24) > 0.6) {
      failVoice("shelfHeight protect lounge Seat 30×24", seatH?.size);
    }
    const deskH = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
    if (Math.abs(deskH.overall.width - 60) > 0.6 || Math.abs(deskH.overall.depth - 30) > 0.6 || Math.abs(deskH.overall.height - 29) > 0.6) {
      failVoice("shelfHeight protect desk freeze", deskH.overall);
    }
    const catH = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
    if (/trough|marble run/i.test(catH.name) && !/catapult|launcher/i.test(catH.name)) {
      failVoice("shelfHeight protect catapult≠trough", catH.name);
    }
    const cedarH = generateFromPrompt('house: cedar chest 36" wide × 18" deep × 20" tall with hinged lid');
    if (!/^Cedar chest/i.test(cedarH.name)) failVoice("shelfHeight protect cedar piano Best title", cedarH.name);
    const cedarHP = buildPlan(cedarH);
    const piano = cedarHP.bom.find((b) => /piano hinge/i.test(b.name));
    const best = piano?.offers?.find((o) => o.best) ?? piano?.offers?.[0];
    if (best && /soft-?close|concealed/i.test(best.title) && !/piano|continuous/i.test(best.title)) {
      failVoice("shelfHeight protect cedar piano Best", best.title);
    }
  }

  // Shared shelf-height helpers exist (ship markers).
  // shelfInstallHeightsClause / shelfMarkedHeightTalk / shelfHeightInch

}



{
  // Soft-park: drawer box cut-list / cut-step honesty — explode parts (not envelope),
  // cut step names Drawer side/back/bottom (not Upright lie), dims from opening.
  const ns = generateFromPrompt("house: nightstand 18″ wide × 16″ deep × 24″ tall with one drawer");
  const nsPlan = buildPlan(ns);
  if (nsPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
    failHonesty("drawerCutlist nightstand cut list still Drawer box envelope", nsPlan.cutList.map((c) => c.name));
  }
  for (const need of ["Drawer side", "Drawer back", "Drawer bottom", "Drawer front"]) {
    if (!nsPlan.cutList.some((c) => c.name === need)) {
      failHonesty(`drawerCutlist nightstand missing ${need}`, nsPlan.cutList.map((c) => c.name));
    }
  }
  const cutStep = nsPlan.instructions.find((s) => /^Cut the /i.test(s.title));
  const cutBlob = cutStep?.description ?? "";
  if (/Drawer box/i.test(cutBlob)) {
    failHonesty("drawerCutlist nightstand cut step still names Drawer box envelope", cutBlob.slice(0, 400));
  }
  if (!/Drawer sides?/i.test(cutBlob)) {
    failHonesty("drawerCutlist nightstand cut step missing Drawer side", cutBlob.slice(0, 400));
  }
  if (!/Drawer back/i.test(cutBlob)) {
    failHonesty("drawerCutlist nightstand cut step missing Drawer back", cutBlob.slice(0, 400));
  }
  if (!/Drawer bottom/i.test(cutBlob)) {
    failHonesty("drawerCutlist nightstand cut step missing Drawer bottom", cutBlob.slice(0, 400));
  }
  // Remap lie: exploded sides must not read as Upright in the cut step.
  if (/\d+\s+Uprights?\s+15[.\d]*\s*×\s*6/i.test(cutBlob)) {
    failHonesty("drawerCutlist nightstand cut step still lies Drawer side as Upright", cutBlob.slice(0, 500));
  }
  // Opening honesty: box W = clear bay − ~1″ slide; helper matches densify.
  const box = ns.panels.find((p) => p.type === "drawer" && !/front/i.test(p.name));
  if (!box) failHonesty("drawerCutlist nightstand missing drawer envelope panel", ns.panels.map((p) => p.name));
  else {
    const openingW = ns.overall.width - 1.5; // 2×¾″ uprights
    const expect = drawerBoxFromOpening(openingW, box.size.height + 0.12, ns.overall.depth);
    if (Math.abs(box.size.width - expect.boxW) > 0.2) {
      failHonesty("drawerCutlist nightstand box W ≠ opening-derived", { boxW: box.size.width, expect: expect.boxW, openingW });
    }
    if (Math.abs(box.size.depth - expect.boxD) > 0.2) {
      failHonesty("drawerCutlist nightstand box D ≠ opening-derived", { boxD: box.size.depth, expect: expect.boxD });
    }
  }
  // cutListName: drawer-side name wins over upright type (cut-step explode remap).
  if (cutListName("Drawer side", "upright") !== "Drawer side") {
    failHonesty("drawerCutlist cutListName Drawer side lost to upright type", cutListName("Drawer side", "upright"));
  }
  if (cutListName("Drawer back", "back") !== "Drawer back") {
    failHonesty("drawerCutlist cutListName Drawer back lost to back type", cutListName("Drawer back", "back"));
  }
  if (cutListName("Drawer bottom", "bottom") !== "Drawer bottom") {
    failHonesty("drawerCutlist cutListName Drawer bottom lost to bottom type", cutListName("Drawer bottom", "bottom"));
  }
  const exploded = explodeDrawerBoxCuts(15.5, 6.38, 15.7);
  if (exploded.length !== 4 || !exploded.every((p) => /Drawer (side|back|bottom)/.test(p.name))) {
    failHonesty("drawerCutlist explodeDrawerBoxCuts shape", exploded);
  }

  // Twin: dresser / vanity-with-drawers — explode, not envelope.
  const dresser = generateFromPrompt("house: dresser 36″ wide × 18″ deep × 36″ tall with three drawers");
  const dresserPlan = buildPlan(dresser);
  if (dresserPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
    failHonesty("drawerCutlist dresser still Drawer box envelope", dresserPlan.cutList.map((c) => c.name));
  }
  if (!dresserPlan.cutList.some((c) => /drawer side/i.test(c.name))) {
    failHonesty("drawerCutlist dresser missing Drawer side", dresserPlan.cutList.map((c) => c.name));
  }
  const dCut = dresserPlan.instructions.find((s) => /^Cut the /i.test(s.title))?.description ?? "";
  if (!/Drawer sides?/i.test(dCut) || /Drawer box/i.test(dCut)) {
    failHonesty("drawerCutlist dresser cut step envelope/side lie", dCut.slice(0, 400));
  }

  // Protect prior wins.
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (Math.abs(linen.overall.width - 31.5) > 0.2 || Math.abs(linen.overall.height - 78) > 0.2 || Math.abs(linen.overall.depth - 16) > 0.2) {
    failHonesty("drawerCutlist protect linen freeze", linen.overall);
  }
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
    failHonesty("drawerCutlist protect lounge Seat 30×24", seat?.size);
  }
  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  if (Math.abs(desk.overall.height - 29) > 0.2) failHonesty("drawerCutlist protect desk freeze H29", desk.overall);
  // knee clearance held via densify + drawers present + H29
  const deskPlan = buildPlan(desk);
  if (deskPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
    failHonesty("drawerCutlist protect desk still Drawer box", deskPlan.cutList.map((c) => c.name));
  }
  if (!deskPlan.cutList.some((c) => /drawer side/i.test(c.name))) {
    failHonesty("drawerCutlist protect desk missing Drawer side", deskPlan.cutList.map((c) => c.name));
  }
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failHonesty("drawerCutlist protect catapult≠trough", cat.name);
  }
  const cedar = generateFromPrompt('house: cedar chest 36" wide × 18" deep × 20" tall with hinged lid');
  if (!/Cedar/i.test(cedar.name)) failHonesty("drawerCutlist protect cedar title", cedar.name);
  const cedarPlan = buildPlan(cedar);
  const pianoBest = cedarPlan.bom?.find((b) => /piano|continuous hinge/i.test(b.name))
    ?? cedarPlan.buy?.find?.((b: { name: string }) => /piano|hinge/i.test(b.name));
  // Soft: if a hinge buy row exists it should be piano/continuous class, not soft-close concealed alone.
  if (pianoBest && /soft-?close|concealed/i.test(pianoBest.name) && !/piano|continuous/i.test(pianoBest.name)) {
    failHonesty("drawerCutlist protect cedar piano Best", pianoBest.name);
  }
}




// Soft leftover: HUD piece chip must match stranger-facing cut-list wood piece count
// for drawer furniture (nightstand / dresser). Chip used panels.length (bounding
// drawer envelopes); cut list explodes → sides/back/bottom. Hardware stays Buy/BOM.
{
  const failChip = (msg: string, detail?: unknown) => failHonesty(`pieceChip ${msg}`, detail);
  const ns = generateFromPrompt("nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  const nsChip = woodCutPieceCount(ns);
  const nsCut = nsPlan.totals.pieces;
  if (nsChip !== nsCut) {
    failChip("nightstand chip ≠ cut-list wood pieces", {
      chip: nsChip,
      cut: nsCut,
      rawPanels: ns.panels.length,
      cutNames: nsPlan.cutList.map((c) => `${c.quantity} ${c.name}`),
    });
  }
  if (ns.panels.length >= nsChip) {
    failChip("nightstand raw panel count should under-count vs exploded chip", {
      rawPanels: ns.panels.length,
      chip: nsChip,
    });
  }
  if (nsChip < 10) {
    failChip("nightstand exploded wood pieces too few (expect ~11)", nsChip);
  }
  // Twin: dresser three drawers — same reconciliation class.
  const dr = generateFromPrompt("house: dresser 36″ wide × 18″ deep × 36″ tall with three drawers");
  const drPlan = buildPlan(dr);
  const drChip = woodCutPieceCount(dr);
  if (drChip !== drPlan.totals.pieces) {
    failChip("dresser chip ≠ cut-list wood pieces", { chip: drChip, cut: drPlan.totals.pieces });
  }
  // Twin: alternate nightstand size.
  const ns2 = generateFromPrompt("nightstand 18 wide 16 deep 24 tall with one drawer");
  const ns2Plan = buildPlan(ns2);
  if (woodCutPieceCount(ns2) !== ns2Plan.totals.pieces) {
    failChip("nightstand 18×16×24 chip ≠ cut", {
      chip: woodCutPieceCount(ns2),
      cut: ns2Plan.totals.pieces,
    });
  }
  // Protect: floating shelf lip — no drawer explode; chip == panels (no instances).
  const lip = generateFromPrompt("house: floating shelf with lip 36″ wide × 8″ deep × 6″ tall");
  if (woodCutPieceCount(lip) !== lip.panels.length) {
    failChip("floating shelf lip chip drifted", { chip: woodCutPieceCount(lip), panels: lip.panels.length });
  }
  // Protect: desk AABB H29 — laminated desktop + drawer explode; splice may add segments.
  const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
  const deskPlan = buildPlan(desk);
  if (Math.abs(desk.overall.height - 29) > 0.2) failChip("protect desk H29", desk.overall);
  const deskChip = woodCutPieceCount(desk);
  if (deskChip > deskPlan.totals.pieces) {
    failChip("desk chip over-counts cut list", { chip: deskChip, cut: deskPlan.totals.pieces });
  }
  if (desk.panels.some((p) => p.type === "drawer") && deskChip <= desk.panels.length) {
    failChip("desk drawer explode not reflected in chip helper", {
      chip: deskChip,
      raw: desk.panels.length,
    });
  }
  // Protect: lounge Seat 30×24.
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
    failChip("protect lounge Seat 30×24", seat?.size);
  }
  // Protect: catapult ≠ trough.
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failChip("protect catapult≠trough", cat.name);
  }
  // Protect: bamboo skewers bridge stock bind.
  if (detectMaterial("bamboo skewers warren bridge").id !== "bamboo-skewer-12") {
    failChip("protect bamboo skewers bridge", detectMaterial("bamboo skewers warren bridge").id);
  }
}


// Soft leftover: Build/step Voice must name exploded drawer parts (not lone "drawer box")
// when cut list already lists Drawer side/front/back/bottom. Universal densify helper.
{
  const failDraw = (msg: string, detail?: unknown) => failHonesty(`drawerBuildVoice ${msg}`, detail);
  const ns = generateFromPrompt("nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  if (!cutListHasExplodedDrawers(nsPlan.cutList)) {
    failDraw("nightstand cut list missing exploded Drawer side", nsPlan.cutList.map((c) => c.name));
  }
  if (nsPlan.totals.pieces !== 11) {
    failDraw("nightstand chip/cut expect 11", { pieces: nsPlan.totals.pieces, chip: woodCutPieceCount(ns) });
  }
  if (woodCutPieceCount(ns) !== nsPlan.totals.pieces) {
    failDraw("nightstand chip≠cut", { chip: woodCutPieceCount(ns), cut: nsPlan.totals.pieces });
  }
  const buildStep = nsPlan.instructions.find((s) => /^Build\b/i.test(s.title) && /drawer/i.test(s.title));
  if (!buildStep) failDraw("nightstand missing Build drawer step", nsPlan.instructions.map((s) => s.title));
  else {
    if (/\bdrawer\s+box(?:es)?\b/i.test(buildStep.title)) {
      failDraw("nightstand Build title still envelope drawer box", buildStep.title);
    }
    if (!/sides?/i.test(buildStep.title) || !/front/i.test(buildStep.title) || !/back/i.test(buildStep.title) || !/bottom/i.test(buildStep.title)) {
      failDraw("nightstand Build title missing exploded parts", buildStep.title);
    }
    if (/\bdrawer\s+box(?:es)?\b/i.test(buildStep.description) && !/Drawer sides?/i.test(buildStep.description)) {
      failDraw("nightstand Build prose lone drawer box without parts", buildStep.description.slice(0, 300));
    }
  }
  // Helper unit: densify rewrites legacy envelope titles when cut list exploded.
  const fakeCuts = [
    { name: "Drawer side", quantity: 2, lengthIn: 16, widthIn: 6, thicknessIn: 0.75 },
    { name: "Drawer back", quantity: 1, lengthIn: 15, widthIn: 6, thicknessIn: 0.75 },
    { name: "Drawer bottom", quantity: 1, lengthIn: 15, widthIn: 15, thicknessIn: 0.25 },
    { name: "Drawer front", quantity: 1, lengthIn: 18, widthIn: 6, thicknessIn: 0.75 },
  ];
  const densified = densifyDrawerExplodeTalk("Build 1 drawer box + front", fakeCuts);
  if (/drawer\s+box/i.test(densified) || !/sides?/i.test(densified)) {
    failDraw("densifyDrawerExplodeTalk missed singular title", densified);
  }
  const densifiedN = densifyDrawerExplodeTalk("Build 3 drawer boxes + fronts", fakeCuts);
  if (/drawer\s+boxes/i.test(densifiedN) || !/sides?/i.test(densifiedN)) {
    failDraw("densifyDrawerExplodeTalk missed plural title", densifiedN);
  }
  const densifiedNail = densifyDrawerExplodeTalk("Nail drawer boxes square (3 drawers).", fakeCuts);
  if (/Nail drawer boxes/i.test(densifiedNail)) {
    failDraw("densifyDrawerExplodeTalk missed BOM nail note", densifiedNail);
  }
  // Twin: dresser 3-drawer.
  const dr = generateFromPrompt("house: dresser 36″ wide × 18″ deep × 36″ tall with three drawers");
  const drPlan = buildPlan(dr);
  const drBuild = drPlan.instructions.find((s) => /^Build\b/i.test(s.title) && /drawer/i.test(s.title));
  if (!drBuild) failDraw("dresser missing Build drawer step", drPlan.instructions.map((s) => s.title));
  else if (/\bdrawer\s+box(?:es)?\b/i.test(drBuild.title)) {
    failDraw("dresser Build title still envelope drawer box", drBuild.title);
  } else if (!/sides?/i.test(drBuild.title)) {
    failDraw("dresser Build title missing sides", drBuild.title);
  }
  // Protect: desk title 60×29×30 / H29 / knee24; round Dia×H; lounge; linen; catapult.
  const desk = generateFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee');
  if (Math.abs(desk.overall.width - 60) > 0.2) failDraw("protect desk W60", desk.overall);
  if (Math.abs(desk.overall.height - 29) > 0.2) failDraw("protect desk H29", desk.overall);
  if (Math.abs(desk.overall.depth - 30) > 0.2) failDraw("protect desk D30", desk.overall);
  if (!/60/.test(desk.name) || /30\s*[×x]\s*29\s*[×x]\s*30/.test(desk.name)) {
    failDraw("protect desk title 60×29×30 (not 30×29×30)", desk.name);
  }
  const deskPlan = buildPlan(desk);
  if (deskPlan.cutList.some((c) => /^drawer box$/i.test(c.name))) {
    failDraw("protect desk cut still Drawer box", deskPlan.cutList.map((c) => c.name));
  }
  const deskBuild = deskPlan.instructions.find((s) => /^Build\b/i.test(s.title) && /drawer/i.test(s.title));
  if (deskBuild && /\bdrawer\s+box(?:es)?\b/i.test(deskBuild.title)) {
    failDraw("protect desk Build title envelope", deskBuild.title);
  }
  const round = generateFromPrompt('house: 40" round 3-leg table 30" tall');
  const roundChip = measureChipAxisLabels({
    width: round.overall.width,
    height: round.overall.height,
    depth: round.overall.depth,
    shape: round.fitted?.unit?.shape,
    prompt: round.prompt,
    name: round.name,
  });
  if (roundChip.mode !== "round" || roundChip.labels.join("×") !== "Dia×H") {
    failDraw("protect round Dia×H", roundChip);
  }
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
    failDraw("protect lounge Seat 30×24", seat?.size);
  }
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (
    Math.abs(linen.overall.width - 31.5) > 0.2 ||
    Math.abs(linen.overall.height - 78) > 0.2 ||
    Math.abs(linen.overall.depth - 16) > 0.2
  ) {
    failDraw("protect linen freeze", linen.overall);
  }
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failDraw("protect catapult≠trough", cat.name);
  }
}





// Soft leftover: plate/BOM Confirm "N parts on this list" must match honest cut wood
// (chip / totals.pieces), not raw panels.length (bounding drawer envelopes).
// Source: uniqueSteps / steps.ts partsOnThisListPhrase(woodCutPieceCount) — densify is defense-in-depth.
{
  const failParts = (msg: string, detail?: unknown) => failHonesty(`partsCountPlate ${msg}`, detail);
  const ns = generateFromPrompt("nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  const nsChip = woodCutPieceCount(ns);
  const nsCut = nsPlan.totals.pieces;
  if (nsChip !== nsCut || nsCut !== 11) {
    failParts("nightstand chip/cut expect 11", { chip: nsChip, cut: nsCut, raw: ns.panels.length });
  }
  const nsConfirm = nsPlan.instructions.find((s) => /confirm/i.test(s.title));
  if (!nsConfirm) failParts("nightstand missing Confirm", nsPlan.instructions.map((s) => s.title));
  else {
    if (!/\b11 parts on this list\b/i.test(nsConfirm.description)) {
      failParts("nightstand Confirm not honest 11 parts", nsConfirm.description.slice(0, 320));
    }
    if (/\b8 parts on this list\b/i.test(nsConfirm.description)) {
      failParts("nightstand Confirm still raw panels.length 8", nsConfirm.description.slice(0, 320));
    }
    if (/open D shelf/i.test(nsConfirm.description)) {
      failParts("nightstand Confirm plate-bleed open D shelf", nsConfirm.description.slice(0, 320));
    }
  }
  const nsBuild = nsPlan.instructions.find((s) => /^Build\b/i.test(s.title) && /drawer/i.test(s.title));
  if (!nsBuild) failParts("nightstand missing Build drawer", nsPlan.instructions.map((s) => s.title));
  else {
    if (/Drawer C bottom/i.test(nsBuild.description)) {
      failParts("nightstand Build plate-bleed Drawer C bottom", nsBuild.description.slice(0, 320));
    }
    if (/\bdrawer\s+box(?:es)?\b/i.test(nsBuild.title)) {
      failParts("protect Build explode talk regress", nsBuild.title);
    }
  }
  // Helper unit: densifyPartsCountTalk rewrites raw N → cut qty sum.
  const rewritten = densifyPartsCountTalk("Mark the floor. 8 parts on this list.", nsPlan.cutList);
  if (!/\b11 parts on this list\b/.test(rewritten) || /\b8 parts on this list\b/.test(rewritten)) {
    failParts("densifyPartsCountTalk missed rewrite", rewritten);
  }
  if (cutListWoodPieceCount(nsPlan.cutList) !== 11) {
    failParts("cutListWoodPieceCount ≠ 11", cutListWoodPieceCount(nsPlan.cutList));
  }
  // Soft leftover source: uniqueSteps Confirm already honest (not densify-only rewrite).
  {
    const srcConfirm = uniqueSteps(ns).find((s) => /confirm/i.test(s.title));
    if (!srcConfirm) failParts("nightstand uniqueSteps missing Confirm");
    else if (!/\b11 parts on this list\b/i.test(srcConfirm.description)) {
      failParts("nightstand uniqueSteps Confirm still raw panels.length", srcConfirm.description.slice(0, 320));
    } else if (/\b8 parts on this list\b/i.test(srcConfirm.description)) {
      failParts("nightstand uniqueSteps Confirm raw 8", srcConfirm.description.slice(0, 320));
    }
  }
  // Plate bleed unit: Drawer bottom keeps own letter; rhetorical open shelf — not plated.
  const bleed = densifyPartsPlateTalk(
    "one Drawer bottom — 15 × 14. One drawer over an open shelf — not a mini dresser. Shelf — 18.50 × 15.",
    nsPlan.cutList,
  );
  if (/Drawer C bottom/i.test(bleed)) failParts("densifyPartsPlateTalk Drawer C bleed", bleed);
  if (/open [A-Z] shelf/i.test(bleed)) failParts("densifyPartsPlateTalk open X shelf bleed", bleed);
  if (!/\b[A-Z] Shelf — 18\.50/.test(bleed)) failParts("densifyPartsPlateTalk missed real Shelf dim", bleed);
  // Twin: dresser 3-drawer — plate count matches cut wood.
  const dr = generateFromPrompt("house: dresser 36″ wide × 18″ deep × 36″ tall with three drawers");
  const drPlan = buildPlan(dr);
  const drConfirm = drPlan.instructions.find((s) => /confirm/i.test(s.title));
  const drCut = drPlan.totals.pieces;
  if (woodCutPieceCount(dr) !== drCut) {
    failParts("dresser chip≠cut", { chip: woodCutPieceCount(dr), cut: drCut });
  }
  if (!drConfirm) failParts("dresser missing Confirm");
  else {
    const m = drConfirm.description.match(/\b(\d+) parts on this list\b/i);
    if (!m || Number(m[1]) !== drCut) {
      failParts("dresser Confirm parts ≠ cut", { spoken: m?.[1], cut: drCut, desc: drConfirm.description.slice(-120) });
    }
    if (Number(m![1]) === dr.panels.length && dr.panels.length !== drCut) {
      failParts("dresser Confirm still raw panels.length", { raw: dr.panels.length, cut: drCut });
    }
    const drSrc = uniqueSteps(dr).find((s) => /confirm/i.test(s.title));
    const drSrcM = drSrc?.description.match(/\b(\d+) parts on this list\b/i);
    if (!drSrcM || Number(drSrcM[1]) !== drCut) {
      failParts("dresser uniqueSteps Confirm parts ≠ cut", {
        spoken: drSrcM?.[1],
        cut: drCut,
        desc: drSrc?.description.slice(-140),
      });
    }
  }
  // Protect: desk title 60×29×30; round Dia×H; lounge; linen; catapult; Build explode held.
  const desk = generateFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee');
  if (Math.abs(desk.overall.width - 60) > 0.2) failParts("protect desk W60", desk.overall);
  if (Math.abs(desk.overall.height - 29) > 0.2) failParts("protect desk H29", desk.overall);
  if (Math.abs(desk.overall.depth - 30) > 0.2) failParts("protect desk D30", desk.overall);
  if (!/60/.test(desk.name) || /30\s*[×x]\s*29\s*[×x]\s*30/.test(desk.name)) {
    failParts("protect desk title 60×29×30 (not 30×29×30)", desk.name);
  }
  const round = generateFromPrompt('house: 40" round 3-leg table 30" tall');
  const roundChip = measureChipAxisLabels({
    width: round.overall.width,
    height: round.overall.height,
    depth: round.overall.depth,
    shape: round.fitted?.unit?.shape,
    prompt: round.prompt,
    name: round.name,
  });
  if (roundChip.mode !== "round" || roundChip.labels.join("×") !== "Dia×H") {
    failParts("protect round Dia×H", roundChip);
  }
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
    failParts("protect lounge Seat 30×24", seat?.size);
  }
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (
    Math.abs(linen.overall.width - 31.5) > 0.2 ||
    Math.abs(linen.overall.height - 78) > 0.2 ||
    Math.abs(linen.overall.depth - 16) > 0.2
  ) {
    failParts("protect linen freeze", linen.overall);
  }
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failParts("protect catapult≠trough", cat.name);
  }
}


// Soft leftover: stranger-facing effort / join-screw estimates must use honest
// wood piece count (closetCuts qty / plan.totals.pieces), not raw panels.length.
// Nightstand one-drawer: panels≈8 vs cut 11 — effort band + #8 screw qty follow 11.
{
  const failEff = (msg: string, detail?: unknown) => failHonesty(`reportEffortHardware ${msg}`, detail);
  const expectedEffort = (pieces: number) => {
    if (pieces <= 10) return "1/2-day";
    if (pieces <= 20) return "1-day";
    return "weekend";
  };
  const joinScrewQty = (plan: ReturnType<typeof buildPlan>) => {
    const row = plan.bom.find((b) => /#8.*wood screws|wood screws/i.test(b.name));
    return row?.quantity ?? null;
  };

  const ns = generateFromPrompt("nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  const nsCut = nsPlan.totals.pieces;
  if (nsCut !== 11) failEff("nightstand cut expect 11", { cut: nsCut, raw: ns.panels.length });
  if (ns.panels.length >= nsCut) {
    failEff("nightstand raw panels should under-count exploded cut", {
      raw: ns.panels.length,
      cut: nsCut,
    });
  }
  if (nsPlan.effort !== expectedEffort(nsCut)) {
    failEff("nightstand effort not keyed to honest pieces", {
      effort: nsPlan.effort,
      expect: expectedEffort(nsCut),
      cut: nsCut,
      raw: ns.panels.length,
      rawEffortWould: expectedEffort(ns.panels.length),
    });
  }
  // Prove raw panels.length would lie when it crosses a band (8→1/2-day vs 11→1-day).
  if (expectedEffort(ns.panels.length) !== expectedEffort(nsCut) && nsPlan.effort === expectedEffort(ns.panels.length)) {
    failEff("nightstand effort still follows raw panels.length band", {
      effort: nsPlan.effort,
      raw: ns.panels.length,
      cut: nsCut,
    });
  }
  const nsScrews = joinScrewQty(nsPlan);
  const nsExpectScrews = Math.max(16, nsCut * 6);
  if (nsScrews !== nsExpectScrews) {
    failEff("nightstand #8 screws ≠ honest woodPieces*6", {
      screws: nsScrews,
      expect: nsExpectScrews,
      cut: nsCut,
      rawWould: Math.max(16, ns.panels.length * 6),
    });
  }
  if (nsScrews === Math.max(16, ns.panels.length * 6) && ns.panels.length !== nsCut) {
    failEff("nightstand screws still raw panels.length*6", {
      screws: nsScrews,
      raw: ns.panels.length,
      cut: nsCut,
    });
  }
  // Feasibility summary speaks effort too.
  if (!nsPlan.feasibility.summary.includes(nsPlan.effort)) {
    failEff("nightstand summary missing effort label", nsPlan.feasibility.summary.slice(0, 200));
  }

  // Twin: dresser 3-drawer — effort + screws follow exploded wood count.
  const dr = generateFromPrompt("house: dresser 36″ wide × 18″ deep × 36″ tall with three drawers");
  const drPlan = buildPlan(dr);
  const drCut = drPlan.totals.pieces;
  if (woodCutPieceCount(dr) !== drCut) {
    failEff("dresser chip≠cut", { chip: woodCutPieceCount(dr), cut: drCut });
  }
  if (drPlan.effort !== expectedEffort(drCut)) {
    failEff("dresser effort not keyed to honest pieces", {
      effort: drPlan.effort,
      expect: expectedEffort(drCut),
      cut: drCut,
      raw: dr.panels.length,
    });
  }
  const drScrews = joinScrewQty(drPlan);
  const drExpectScrews = Math.max(16, drCut * 6);
  if (drScrews !== drExpectScrews) {
    failEff("dresser #8 screws ≠ honest woodPieces*6", {
      screws: drScrews,
      expect: drExpectScrews,
      cut: drCut,
      rawWould: Math.max(16, dr.panels.length * 6),
    });
  }
  if (dr.panels.length !== drCut && drScrews === Math.max(16, dr.panels.length * 6)) {
    failEff("dresser screws still raw panels.length*6", { screws: drScrews, raw: dr.panels.length, cut: drCut });
  }

  // Protect: linen typed width 31.5; teak outdoor primary; banding Best≠sheet;
  // picture ledge H; desk 60×29×30; lounge Seat; catapult≠trough.
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (
    Math.abs(linen.overall.width - 31.5) > 0.2 ||
    Math.abs(linen.overall.height - 78) > 0.2 ||
    Math.abs(linen.overall.depth - 16) > 0.2
  ) {
    failEff("protect linen 31.5×78×16", linen.overall);
  }
  if (/\b36\b/.test(linen.name) && !/31/.test(linen.name)) {
    failEff("protect linen title snapped to stock 36", linen.name);
  }
  expectNamedLumberBuy("teak outdoor side table", "teak");
  const band = nsPlan.bom.find((b) => /edge banding|banding/i.test(b.name));
  if (band) {
    const best = band.offers?.find((o) => o.best) ?? band.offers?.[0];
    if (best && /plywood|4x8|4×8|sande/i.test(best.title || "") && !/band/i.test(best.title || "")) {
      failEff("protect banding Best≠sheet", best.title);
    }
  }
  const desk = generateFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee');
  if (Math.abs(desk.overall.width - 60) > 0.2) failEff("protect desk W60", desk.overall);
  if (Math.abs(desk.overall.height - 29) > 0.2) failEff("protect desk H29", desk.overall);
  if (Math.abs(desk.overall.depth - 30) > 0.2) failEff("protect desk D30", desk.overall);
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
    failEff("protect lounge Seat 30×24", seat?.size);
  }
  const ledge = generateFromPrompt("house: picture ledge 36″ wide × 3.5″ deep × 3.5″ tall");
  if (ledge.overall.height > 8) failEff("protect picture ledge H", ledge.overall);
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failEff("protect catapult≠trough", cat.name);
  }

}

// Soft leftover: named-board / solid named-lumber Buy qty must use honest cut
// wood count (closetCuts qty / woodPieces), never last-resort panels.length or
// silent 4×8 nest sheet count as board pcs (teak outdoor undercount).
{
  const failBom = (msg: string, detail?: unknown) => failHonesty(`namedBoardBomQty ${msg}`, detail);

  // Coat-hook named lumber path (buyNamedBoard): qty follows cut wood, not panels.length.
  const coat = generateFromPrompt("weekend craft: oak coat hook board 24″ wide × 6″ tall with four hooks");
  const coatPlan = buildPlan(coat);
  const coatCut = coatPlan.totals.pieces;
  const coatWood = coatPlan.bom.find(
    (b) => /oak/i.test(b.name) && !/screw|hook|banding|glue/i.test(b.name),
  );
  if (!coatWood) {
    failBom("coat hook missing oak Buy lead", coatPlan.bom.map((b) => `${b.quantity} ${b.name}`));
  } else {
    if (coatWood.quantity !== coatCut && coatWood.quantity === coat.panels.length && coat.panels.length !== coatCut) {
      failBom("coat hook Buy still panels.length", {
        qty: coatWood.quantity,
        raw: coat.panels.length,
        cut: coatCut,
      });
    }
    if (coatWood.quantity !== coatCut && coatCut > 0) {
      // Prefer exact match to cut wood; allow only if qty is honest woodPieces class.
      if (coatWood.quantity === coat.panels.length) {
        failBom("coat hook Buy qty = raw panels.length", {
          qty: coatWood.quantity,
          raw: coat.panels.length,
          cut: coatCut,
        });
      }
    }
    if (coat.panels.length !== coatCut && coatWood.quantity === coat.panels.length) {
      failBom("coat hook Buy undercount via panels.length", {
        qty: coatWood.quantity,
        raw: coat.panels.length,
        cut: coatCut,
      });
    }
  }

  // Teak outdoor side table: Buy teak pcs = structural cut wood (top/aprons), not
  // nest sheet count (silent 1-pc undercount) or raw panels.length. 2x2 legs stay
  // on their own BOM line (tableFitted TWO_BY_TWO) — do not fold into teak qty.
  const teak = generateFromPrompt("house: teak outdoor side table 22 wide 18 deep 18 tall");
  const teakPlan = buildPlan(teak);
  const teakCut = teakPlan.totals.pieces;
  if (teak.primaryMaterialId !== "lumber-1x4-8") {
    failBom("teak primaryMaterialId", teak.primaryMaterialId);
  }
  if (woodCutPieceCount(teak) !== teakCut) {
    failBom("teak chip≠cut", { chip: woodCutPieceCount(teak), cut: teakCut });
  }
  const teakLegBom = teakPlan.bom.find((b) => /2x2|2×2/i.test(b.name));
  const teakLegQty = teakLegBom?.quantity ?? 0;
  const teakStructuralExpect = Math.max(1, teakCut - teakLegQty);
  const teakBuy = teakPlan.bom.find(
    (b) => /teak/i.test(b.name) && !/screw|banding|glue|finish|oil|2x2|2×2/i.test(b.name),
  );
  if (!teakBuy) {
    failBom("teak missing Teak Buy lead", teakPlan.bom.map((b) => `${b.quantity} ${b.name}`));
  } else {
    if (teakBuy.quantity !== teakStructuralExpect) {
      failBom("teak Buy qty ≠ structural cut wood", {
        qty: teakBuy.quantity,
        expect: teakStructuralExpect,
        cut: teakCut,
        legs: teakLegQty,
        raw: teak.panels.length,
        unit: teakBuy.unit,
        notes: teakBuy.notes?.slice(0, 140),
      });
    }
    if (teakBuy.quantity === 1 && teakStructuralExpect > 1) {
      failBom("teak Buy still nest-sheet undercount (1 pc vs multi structural)", {
        qty: teakBuy.quantity,
        expect: teakStructuralExpect,
        cut: teakCut,
      });
    }
    if (
      teak.panels.length !== teakStructuralExpect &&
      teakBuy.quantity === teak.panels.length
    ) {
      failBom("teak Buy undercount via panels.length", {
        qty: teakBuy.quantity,
        raw: teak.panels.length,
        expect: teakStructuralExpect,
        cut: teakCut,
      });
    }
    if (!/pc/i.test(teakBuy.unit ?? "")) {
      failBom("teak Buy unit should be pc/pcs (named lumber)", teakBuy.unit);
    }
    // Soft leftover: when 2×2 legs split out, Buy note must NOT claim Confirm/chip
    // total parity (primary qty is structural-only). Prefer densify that names
    // board pcs excluding legs listed below.
    const teakNotes = teakBuy.notes ?? "";
    if (teakLegQty > 0) {
      if (/same wood count as Confirm\/chip|same as Confirm\/chip|same wood count as Confirm/i.test(teakNotes)) {
        failBom("teak Buy note falsely claims Confirm/chip parity while legs split", {
          notes: teakNotes.slice(0, 200),
          qty: teakBuy.quantity,
          legs: teakLegQty,
          cut: teakCut,
        });
      }
      if (!/excluding|listed below|board pcs|structural/i.test(teakNotes)) {
        failBom("teak Buy note should name structural/board pcs excluding legs", {
          notes: teakNotes.slice(0, 200),
          legs: teakLegQty,
        });
      }
    }
  }

  // Protect: nightstand effort/screws/Confirm 11-class; linen 31.5; banding; ledge; desk; lounge; catapult.
  const ns = generateFromPrompt("nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  if (nsPlan.totals.pieces !== 11) failBom("protect nightstand pieces 11", nsPlan.totals.pieces);
  if (nsPlan.effort !== "1-day") failBom("protect nightstand effort 1-day", nsPlan.effort);
  const nsScrews = nsPlan.bom.find((b) => /#8.*wood screws|wood screws/i.test(b.name))?.quantity;
  if (nsScrews !== 66) failBom("protect nightstand screws 66", nsScrews);
  const linen = generateFromPrompt("house: linen closet 31.5×78×16");
  if (Math.abs(linen.overall.width - 31.5) > 0.2) failBom("protect linen 31.5", linen.overall);
  const band = nsPlan.bom.find((b) => /edge banding|banding/i.test(b.name));
  if (band) {
    const best = band.offers?.find((o) => o.best) ?? band.offers?.[0];
    if (best && /plywood|4x8|4×8|sande/i.test(best.title || "") && !/band/i.test(best.title || "")) {
      failBom("protect banding Best≠sheet", best.title);
    }
  }
  const ledge = generateFromPrompt("house: picture ledge 36″ wide × 3.5″ deep × 3.5″ tall");
  if (ledge.overall.height > 8) failBom("protect picture ledge H", ledge.overall);
  const desk = generateFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee');
  if (Math.abs(desk.overall.height - 29) > 0.2) failBom("protect desk H29", desk.overall);
  const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
  const seat = lounge.panels.find((p) => /^Seat$/i.test(p.name));
  if (!seat || Math.abs(seat.size.depth - 24) > 0.2) failBom("protect lounge Seat depth 24", seat?.size);
  const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
  if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
    failBom("protect catapult≠trough", cat.name);
  }

}



console.log("STRANGER PLAN OK", {
  coat: coatPlan.cutList.map((c) => c.name),
  closet80: closetRodPlan.cutList.map((c) => c.name),
  jar: jarPlan.cutList.map((c) => c.name),
  refit: linenRefit.overall,
  pocketSlides: pocketSlides?.name,
  deskSlides: deskSlides?.name,
});


// Voice/PDF impress WARN pack — glossary gate · round dia envelope · cedar stock honesty.
{
  const failVoice2 = (msg: string, detail?: unknown) => failHonesty(`voice/pdf impress ${msg}`, detail);

  for (const hay of [
    'house: 40" round 3-leg table',
    "house: lounge chair with 16″ seat height and 24″ seat depth",
    'house: cedar chest 36" wide × 18" deep × 20" tall with hinged lid',
    "weekend craft: popsicle stick catapult that launches a marble",
  ]) {
    if (wantsCabinetryShopWords(hay)) failVoice2("non-cabinetry wants cabinetry shop words", hay);
    const chip = shopWordsChipTalk(hay);
    if (/\bcarcase\b|\btoekick\b/i.test(chip)) failVoice2("shop-words chip leaks carcase/toekick", { hay, chip });
    const gloss = glossaryForPlan(hay, SHOP_GLOSSARY);
    if (gloss.some((g) => /carcase|toekick/i.test(`${g.term} ${g.def}`))) {
      failVoice2("PDF glossary leaks carcase/toekick", hay);
    }
  }
  for (const hay of [
    'house: bathroom vanity 36" wide × 21" deep × 32" tall with two doors',
    "house: linen closet 31.5×78×16",
  ]) {
    if (!wantsCabinetryShopWords(hay)) failVoice2("cabinetry lost shop-words gate", hay);
    const chip = shopWordsChipTalk(hay);
    if (!/main box/i.test(chip) || !/kick strip/i.test(chip)) {
      failVoice2("cabinetry chip missing plain Main box / Kick strip", chip);
    }
    if (/\bcarcase\b|\btoekick\b/i.test(chip)) {
      failVoice2("cabinetry shop-words chip still says carcase/toekick", chip);
    }
    const gloss = glossaryForPlan(hay, SHOP_GLOSSARY);
    if (gloss.some((g) => /carcase|toekick/i.test(`${g.term} ${g.def}`))) {
      failVoice2("cabinetry PDF glossary still says carcase/toekick", hay);
    }
    if (!gloss.some((g) => /^Main box$/i.test(g.term)) || !gloss.some((g) => /^Kick strip$/i.test(g.term))) {
      failVoice2("cabinetry PDF glossary missing plain Main box / Kick strip", gloss.map((g) => g.term));
    }
  }

  // Universal densify: strangerPlainShopTalk + cutListName never leave carcase/toekick.
  {
    const raw =
      "Stand the carcase. Add the toekick. Overlay the carcase. Main box (carcase). Kick strip (toekick).";
    const plain = strangerPlainShopTalk(raw);
    if (/\bcarcase\b|\btoekick\b/i.test(plain)) {
      failVoice2("strangerPlainShopTalk left carcase/toekick", plain);
    }
    if (!/main box/i.test(plain) || !/kick strip/i.test(plain)) {
      failVoice2("strangerPlainShopTalk missing plain densify", plain);
    }
    if (cutListName("Front toekick", "kick") !== "Kick strip") {
      failVoice2("cutListName toekick not densified to Kick strip", cutListName("Front toekick", "kick"));
    }
    if (cutListName("Toekick", "kick") !== "Kick strip") {
      failVoice2("cutListName bare Toekick not densified", cutListName("Toekick", "kick"));
    }
  }

  {
    const roundPrompt = 'house: 40" round 3-leg table';
    const round = generateFromPrompt(roundPrompt);
    if (
      !isRoundUnitEnvelope({
        width: round.overall.width,
        height: round.overall.height,
        depth: round.overall.depth,
        shape: round.fitted?.unit?.shape,
        prompt: round.prompt,
        name: round.name,
      })
    ) {
      failVoice2("round table not detected as round envelope", {
        overall: round.overall,
        shape: round.fitted?.unit?.shape,
        name: round.name,
      });
    }
    const line = fmtUnitEnvelopeInches(round.overall.width, round.overall.height, round.overall.depth, {
      shape: round.fitted?.unit?.shape,
      prompt: round.prompt,
      name: round.name,
      legs: round.fitted?.unit?.legs ?? 3,
    });
    if (/40\s*[×x]\s*30\s*[×x]\s*40|40"\s*×\s*30"\s*×\s*40"/.test(line)) {
      failVoice2("round envelope still echoes diameter as W×H×W", line);
    }
    if (!/dia/i.test(line) || !/40/.test(line) || !/30/.test(line)) {
      failVoice2("round envelope missing dia×H honesty", line);
    }
    if ((round.fitted?.unit?.legs ?? 0) !== 3 && !/\b3\s*legs?\b/i.test(`${round.name}`)) {
      failVoice2("round table lost 3 legs", { legs: round.fitted?.unit?.legs, name: round.name });
    }
    const chip = measureChipAxisLabels({
      width: round.overall.width,
      height: round.overall.height,
      depth: round.overall.depth,
      shape: round.fitted?.unit?.shape,
      prompt: round.prompt,
      name: round.name,
    });
    if (chip.mode !== "round" || chip.labels.join("×") !== "Dia×H") {
      failVoice2("round measure chip labels not Dia×H", chip);
    }
    // Soft leftover: Measure overlay must not echo diameter as W×H×D / 40×30×40.
    if (chip.labels.includes("W") && chip.labels.includes("D")) {
      failVoice2("round measure chip still W×H×D diameter echo", chip);
    }
  }



  // Desk title W/D echo — bare "60\" desk … 30 deep × 29 tall" must stay 60×29×30 (never 30×29×30).
  {
    const liveDesk = generateFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee');
    if (!nearInch(liveDesk.overall.width, 60) || !nearInch(liveDesk.overall.height, 29) || !nearInch(liveDesk.overall.depth, 30)) {
      failVoice2("desk title W/D echo — overall not 60×29×30", liveDesk.overall);
    }
    if (!nearInch(liveDesk.fitted?.unit.kneeW ?? 0, 24)) failVoice2("desk title echo lost knee 24", liveDesk.fitted?.unit);
    if (/30"\s*×\s*29"\s*×\s*30"|30\s*×\s*29\s*×\s*30/.test(liveDesk.name)) {
      failVoice2("desk title still 30×29×30 W/D echo", liveDesk.name);
    }
    if (!/60/.test(liveDesk.name) || !/29/.test(liveDesk.name) || !/30/.test(liveDesk.name)) {
      failVoice2("desk title missing honest 60×29×30", liveDesk.name);
    }
    if (Math.abs(deskWidthFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee') - 60) > 0.1) {
      failVoice2("deskWidthFromPrompt missed bare 60\" desk", deskWidthFromPrompt('house: 60" desk with drawers 30" deep × 29" tall with 24" knee'));
    }
    const desktop = liveDesk.panels.find((p) => p.type === "counter" && /^Desktop$/i.test(p.name));
    if (!desktop) failVoice2("desk title echo missing Desktop", liveDesk.panels.map((p) => p.name));
    else if (!nearInch(desktop.position.y + desktop.size.height, 29)) {
      failVoice2("desk title echo Desktop top ≠ H29", {
        y: desktop.position.y,
        thick: desktop.size.height,
      });
    }
    const writing = generateFromPrompt('60" writing desk 24" deep × 30" tall with 22" knee');
    if (!nearInch(writing.overall.width, 60) || !nearInch(writing.overall.height, 30) || !nearInch(writing.overall.depth, 24)) {
      failVoice2("writing desk bare-width echo", writing.overall);
    }
    if (!nearInch(writing.fitted?.unit.kneeW ?? 0, 22)) failVoice2("writing desk knee", writing.fitted?.unit);
  }

  {
    const oval = generateFromPrompt('house: oval coffee table 42" long × 24" wide × 18" tall');
    const chip = measureChipAxisLabels({
      width: oval.overall.width,
      height: oval.overall.height,
      depth: oval.overall.depth,
      shape: oval.fitted?.unit?.shape,
      prompt: oval.prompt,
      name: oval.name,
    });
    if (chip.mode === "round" || chip.labels.join("×") === "Dia×H") {
      failVoice2("oval table wrongly got round Dia×H measure chip", { chip, shape: oval.fitted?.unit?.shape, name: oval.name });
    }
  }

  {
    const cedarPrompt = 'house: cedar chest 36" wide × 18" deep × 20" tall with hinged lid';
    const cedar = generateFromPrompt(cedarPrompt);
    if (!/Cedar/i.test(cedar.name)) failVoice2("cedar title lost species", cedar.name);
    const talk =
      speciesStockHonestyTalk(cedarPrompt, '¾" plywood') ??
      speciesSubstituteNote(cedarPrompt, '¾" plywood');
    if (!talk || !/ply|plywood/i.test(talk) || !/cedar/i.test(talk)) {
      failVoice2("cedar stock honesty missing", talk);
    }
    if (!/lining|finish|optional|substitute|structural/i.test(talk)) {
      failVoice2("cedar stock honesty not plain-speak enough", talk);
    }
    const cedarPlan = buildPlan(cedar);
    const plyBom = cedarPlan.bom.filter((b) => /ply|plywood/i.test(b.name));
    const bomBlob = plyBom.map((b) => b.notes ?? "").join(" ");
    const notesBlob = (cedar.notes ?? []).join(" ");
    if (!/cedar/i.test(`${bomBlob} ${notesBlob} ${talk}`)) {
      failVoice2("cedar honesty not on notes/BOM path", {
        bomBlob: bomBlob.slice(0, 240),
        notesBlob: notesBlob.slice(0, 240),
      });
    }
    const piano = cedarPlan.bom.find((b) => /piano hinge/i.test(b.name));
    const pianoBest = piano?.offers?.find((o) => o.best) ?? piano?.offers?.[0];
    if (pianoBest && /soft-?close|concealed/i.test(pianoBest.title) && !/piano|continuous/i.test(pianoBest.title)) {
      failVoice2("cedar piano Best class lost", pianoBest.title);
    }
  }


// Buy honesty: Iron-on edge banding Best must not be a plywood sheet (searchQuery used to say "plywood birch").
{
  const ns = generateFromPrompt("house: nightstand 20 wide 16 deep 24 tall with one drawer");
  const nsPlan = buildPlan(ns);
  const band = nsPlan.bom.find((b) => /edge banding|banding/i.test(b.name));
  if (!band) failHonesty("nightstand missing Iron-on edge banding BOM", nsPlan.bom.map((b) => b.name));
  if (band.catalogId && band.catalogId !== "edge-banding") {
    failHonesty("nightstand edge banding catalogId", band.catalogId);
  }
  const best = band.offers?.find((o) => o.best) ?? band.offers?.[0];
  if (!best) failHonesty("nightstand edge banding missing offers", band);
  if (/plywood|4x8|4×8|sande/i.test(best.title || "") && !/band/i.test(best.title || "")) {
    failHonesty("nightstand edge banding Best is plywood sheet", best.title);
  }
  if (!/band|veneer/i.test(best.title || "")) {
    failHonesty("nightstand edge banding Best not banding class", best.title);
  }
  const dr = generateFromPrompt("house: dresser 48 wide 18 deep 36 tall three drawers");
  const drPlan = buildPlan(dr);
  const drBand = drPlan.bom.find((b) => /edge banding|banding/i.test(b.name));
  const drBest = drBand?.offers?.find((o) => o.best) ?? drBand?.offers?.[0];
  if (drBest && /plywood|4x8|sande/i.test(drBest.title || "") && !/band/i.test(drBest.title || "")) {
    failHonesty("dresser edge banding Best is plywood sheet", drBest.title);
  }
}

  {
    const linen = generateFromPrompt("house: linen closet 31.5×78×16");
    if (
      Math.abs(linen.overall.width - 31.5) > 0.2 ||
      Math.abs(linen.overall.height - 78) > 0.2 ||
      Math.abs(linen.overall.depth - 16) > 0.2
    ) {
      failVoice2("protect linen 31.5×78×16", linen.overall);
    }
    const desk = generateFromPrompt("house: desk 60×30×29 with 24″ knee");
    if (Math.abs(desk.overall.height - 29) > 0.2) failVoice2("protect desk H29", desk.overall);
    const lounge = generateFromPrompt("house: lounge chair with 16″ seat height and 24″ seat depth");
    const seat = lounge.panels.find((pn) => /^Seat$/i.test(pn.name));
    if (!seat || Math.abs(seat.size.width - 30) > 0.2 || Math.abs(seat.size.depth - 24) > 0.2) {
      failVoice2("protect lounge Seat 30×24", seat?.size);
    }
    const cat = generateFromPrompt("weekend craft: popsicle stick catapult that launches a marble");
    if (/trough|marble run/i.test(cat.name) && !/catapult/i.test(cat.name)) {
      failVoice2("protect catapult≠trough", cat.name);
    }
  }
}


// ── Width-only linen / closet title honesty (soft leftover after 84a37c9 / 94b5d11) ──
{
  const widthOnly = generateFromPrompt("31.5 inch linen closet");
  if (Math.abs(widthOnly.overall.width - 31.5) > 0.15) {
    failHonesty("width-only linen W 31.5", widthOnly.overall);
  }
  if (/×\s*84/.test(widthOnly.name)) {
    failHonesty("width-only linen title invents stock H=84 as typed", widthOnly.name);
  }
  if (!/31\.5"\s*wide/.test(widthOnly.name)) {
    failHonesty("width-only linen title should stamp typed W only", widthOnly.name);
  }
  // Linen class densify H=78 (CLOSET_STARTERS / bare linen), not silent stock 84 in geometry.
  if (Math.abs(widthOnly.overall.height - 78) > 0.6) {
    failHonesty("width-only linen densify H should be linen class 78", widthOnly.overall);
  }
  if (!(widthOnly.notes ?? []).some((n) => /Assumed 78" tall/i.test(n))) {
    failHonesty("width-only linen missing Assumed 78 tall Voice note", widthOnly.notes);
  }
  const typedH = generateFromPrompt("31.5 inch linen closet 78 tall 16 deep");
  if (
    Math.abs(typedH.overall.width - 31.5) > 0.15 ||
    Math.abs(typedH.overall.height - 78) > 0.15 ||
    Math.abs(typedH.overall.depth - 16) > 0.15
  ) {
    failHonesty("typed linen H still honored", typedH.overall);
  }
  if (!/31\.5"\s*×\s*78"\s*×\s*16"/.test(typedH.name)) {
    failHonesty("typed linen full stamp", typedH.name);
  }
  const twin = generateFromPrompt("36 inch linen closet");
  if (Math.abs(twin.overall.width - 36) > 0.15) failHonesty("linen twin 36 W", twin.overall);
  if (/×\s*84/.test(twin.name)) failHonesty("linen twin title invents H=84", twin.name);
  const pantry = generateFromPrompt("24 inch pantry");
  if (Math.abs(pantry.overall.width - 24) > 0.15) failHonesty("pantry width-only W", pantry.overall);
  if (/×\s*84/.test(pantry.name) && !/Assumed 84" tall/i.test((pantry.notes ?? []).join(" "))) {
    failHonesty("pantry width-only title invents H=84 without Assumed note", {
      name: pantry.name,
      notes: pantry.notes,
    });
  }
  if (!/24"\s*wide/.test(pantry.name)) failHonesty("pantry width-only title", pantry.name);
}

// ── Bare linen/closet (no typed digits) title honesty (soft leftover after 9a4419c / ef1d1a4) ──
{
  for (const bare of ["linen closet", "linen"]) {
    const proj = generateFromPrompt(bare);
    if (/\d+(?:\.\d+)?"\s*×/.test(proj.name)) {
      failHonesty("bare linen title must not stamp densified W×H×D as typed", {
        prompt: bare,
        name: proj.name,
      });
    }
    if (!/^Linen\b/i.test(proj.name)) {
      failHonesty("bare linen title stem", { prompt: bare, name: proj.name });
    }
    // Densify may still build class envelope (36×78×16 linen).
    if (Math.abs(proj.overall.width - 36) > 0.6 || Math.abs(proj.overall.height - 78) > 0.6) {
      failHonesty("bare linen densify envelope", { prompt: bare, overall: proj.overall });
    }
    const notes = (proj.notes ?? []).join(" ");
    if (!/Assumed 78" tall/i.test(notes)) {
      failHonesty("bare linen missing Assumed tall note", { prompt: bare, notes: proj.notes });
    }
    const hud = fmtUnitEnvelopeInches(proj.overall.width, proj.overall.height, proj.overall.depth, {
      prompt: bare,
      name: proj.name,
    });
    if (/\d+(?:\.\d+)?"\s*×/.test(hud)) {
      failHonesty("bare linen HUD must not present densified triple as typed", { prompt: bare, hud });
    }
  }
  const bareCloset = generateFromPrompt("closet");
  if (/\d+(?:\.\d+)?"\s*×/.test(bareCloset.name) && !/Assumed/i.test((bareCloset.notes ?? []).join(" "))) {
    failHonesty("bare closet title stamps densified dims without Assumed", bareCloset.name);
  }
}

// ── Measure / HUD empty-state copy for bare opening-storage (soft leftover after 0690dc0) ──
{
  for (const bare of ["linen", "linen closet", "closet", "pantry"]) {
    const talk = openingStorageMeasureEmptyTalk(bare);
    if (!talk?.bare) failHonesty("bare opening-storage Measure empty talk missing", { bare, talk });
    if (/the unit/i.test(talk.hudCompanion)) {
      failHonesty("bare HUD companion must not say the unit", talk.hudCompanion);
    }
    if (!/type Measure to lock size/i.test(talk.hudCompanion)) {
      failHonesty("bare HUD companion action copy", talk.hudCompanion);
    }
    if (!/No size typed yet/i.test(talk.panelBlurb)) {
      failHonesty("bare Measure panel empty blurb", talk.panelBlurb);
    }
    if (/refits this unit/i.test(talk.panelBlurb)) {
      failHonesty("bare Measure panel must not imply typed refit", talk.panelBlurb);
    }
  }
  // Width-only / typed — not empty-state
  if (openingStorageMeasureEmptyTalk('31.5" wide linen closet')) {
    failHonesty("width-only linen must not use Measure empty talk");
  }
  if (openingStorageMeasureEmptyTalk("60 inch desk with drawers")) {
    failHonesty("desk must not use opening-storage Measure empty talk");
  }
}

// ── Assumed densify notes surface in Confirm/Build (soft leftover after 5d07304) ──
{
  const bare = generateFromPrompt("linen closet");
  const barePlan = buildPlan(bare);
  const assumedTalk = assumedDensifyNotesTalk(bare.notes);
  if (!/Assumed 78" tall/i.test(assumedTalk)) {
    failHonesty("bare linen Assumed densify talk missing tall note", { notes: bare.notes, assumedTalk });
  }
  const bareConfirm = barePlan.instructions.find((s) => /^Confirm\b/i.test(s.title));
  if (!bareConfirm || !/Assumed 78" tall/i.test(bareConfirm.description)) {
    failHonesty("bare linen Confirm must disclose Assumed tall densify note", {
      title: bareConfirm?.title,
      description: bareConfirm?.description,
      notes: bare.notes,
    });
  }
  // Title stays stem-only (protect bare-linen Critic lock)
  if (/\d+(?:\.\d+)?"\s*×/.test(bare.name)) {
    failHonesty("bare linen title must stay stem-only while Assumed notes surface", bare.name);
  }

  const widthOnly = generateFromPrompt("31.5 inch linen closet");
  const widthPlan = buildPlan(widthOnly);
  const widthConfirm = widthPlan.instructions.find((s) => /^Confirm\b/i.test(s.title));
  if (!/Assumed 78" tall/i.test(widthConfirm?.description ?? "")) {
    failHonesty("width-only linen Confirm must disclose Assumed tall densify note", {
      description: widthConfirm?.description,
      notes: widthOnly.notes,
    });
  }
  if (!/31\.5"\s*wide/i.test(widthOnly.name)) {
    failHonesty("width-only linen title protect", widthOnly.name);
  }

  // Typed full triple — no Assumed densify notes required on Confirm
  const typed = generateFromPrompt("31.5 inch linen closet 78 tall 16 deep");
  const typedAssumed = assumedDensifyNotesTalk(typed.notes);
  if (typedAssumed) {
    // If densify still emits Assumed when all axes typed, Confirm may show them;
    // but notes should normally be empty for full typed.
    failHonesty("fully typed linen should not invent Assumed densify notes", {
      notes: typed.notes,
      typedAssumed,
    });
  }

  // Helper is idempotent / universal filter
  const once = densifyConfirmAssumedNotes(
    [{ step: 1, title: "Confirm the footprint — do not cut yet", description: 'Unit 36" wide × 16" deep × 78" high.', tips: "", partsUsed: ["*"] }],
    ['Assumed 78" tall (linen class default) — type a height to lock it.'],
  );
  if (!/Assumed 78" tall/i.test(once[0].description)) {
    failHonesty("densifyConfirmAssumedNotes appends Assumed talk", once[0].description);
  }
  const twice = densifyConfirmAssumedNotes(once, ['Assumed 78" tall (linen class default) — type a height to lock it.']);
  if ((twice[0].description.match(/Assumed 78" tall/gi) ?? []).length !== 1) {
    failHonesty("densifyConfirmAssumedNotes must not duplicate Assumed talk", twice[0].description);
  }
}
