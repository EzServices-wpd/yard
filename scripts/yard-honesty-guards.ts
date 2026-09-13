import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { measureKindFromProject } from "../src/lib/yard/space";
import { buildFitted } from "../src/lib/yard/fitted";
import { climbIdentityLabel, detectHouseFamily, identityTitleStem, isAdirondackChair, isBedsideShelf, isBookBinBench, isBootTrayBench, isButcherCart, isCoatCubbyWall, isDaybed, isDryingRack, isFoldingTable, isIroningWallMount, isKeyMailShelf, isKitchenIsland, isLaundrySorter, isLeashRail, isPegRail, isFilingShelf, isPrinterStand, isLumberRack, isOpenKitchenShelving, isOutdoorSideTable, isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame, isPottingBench, isPrepTable, isSofaConsoleTable, isStandingShopTop, isToolRail, isToyChest, isUtilityShelf, isWorkbench, wantsPrintHold } from "../src/lib/yard/family";
import { climbStepCount, detectWeekendFamily, detectWeekendMech, isHoseReelHold, isUmbrellaHold, isMonitorHold, monitorEnvelopeTalk, monitorRiseIn, reelEnvelopeTalk, wantsPotHold } from "../src/lib/yard/weekendFamily";
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
  const deskHonesty = inspectHonesty(desk, buildPlan(desk));
  if (!deskHonesty.ok) failHonesty("desk envelope/honesty", deskHonesty.issues);
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
expectStock("box from plywood", "plywood-3-4-4x8");
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
  const stepBlob = bedsidePrintPlan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  if (!/5\s*[×x]\s*7|print upright|Print front lip|print envelope/i.test(stepBlob + "\n" + printBlob)) {
    failHonesty("bedside print soft: plan language", stepBlob.slice(0, 400));
  }
  const checkMsg = (bedsidePrintPlan.issues || []).map((i) => i.message).join("\n");
  if (/—\s*nightstand\.?/i.test(checkMsg)) {
    failHonesty("bedside print soft: — nightstand. subtitle", checkMsg.slice(0, 300));
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
// Bamboo skewer stays skewer; bare bamboo board densifies to lumber class pack.
if (detectMaterial("bamboo skewer warren bridge").id !== "bamboo-skewer-12") {
  failHonesty("bamboo skewer lost skewer bind", detectMaterial("bamboo skewer warren bridge").id);
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
    ...stoolPlan.steps.map((s) => `${s.title} ${s.description}`),
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
    ...hamperPlan.steps.map((s) => `${s.title} ${s.description}`),
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
  const umText = [umbrella.name, ...(umbrella.notes ?? []), ...umPlan.steps.map((s) => `${s.title} ${s.description}`), ...umPlan.bom.map((b) => b.name)].join("\n");
  if (!/oak|Oak/i.test(umText)) failHonesty("umbrella Buy Oak", umText.slice(0, 500));
  if (!/8/.test(umText) || !/umbrella/i.test(umText)) failHonesty("umbrella 8×8 envelope", umText.slice(0, 600));
  if (!/upright|envelope/i.test(umText)) failHonesty("umbrella upright densify", umText.slice(0, 500));

  const keyMail = generateFromPrompt(
    "house: key and mail shelf 24″ wide × 6″ deep × 10″ tall with four hooks below; PDF states mount height",
  );
  if (!/Key and mail shelf/i.test(keyMail.name)) failHonesty("key+mail stem", keyMail.name);
  if (/Storage unit|Picture ledge/i.test(keyMail.name)) failHonesty("key+mail Storage/Picture steal", keyMail.name);
  const kmPlan = buildPlan(keyMail);
  const kmText = [keyMail.name, ...(keyMail.notes ?? []), ...kmPlan.steps.map((s) => `${s.title} ${s.description}`)].join("\n");
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
  const leashText = [leash.name, ...(leash.notes ?? []), ...leashPlan.steps.map((s) => `${s.title} ${s.description}`)].join("\n");
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
  const pegBlob = [peg.name, ...(peg.notes ?? [])].join("\n");
  if (!/5 pegs|five pegs|Screw 5 pegs/i.test(pegBlob)) failHonesty("b32 five pegs densify", pegBlob.slice(0, 600));
  if (/6 hooks|Screw 6 hooks/i.test(pegBlob)) failHonesty("b32 peg 6 hooks steal", pegBlob.slice(0, 400));
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
  // Tool rail still tool
  if (!isToolRail("tool rail spanning 48 with six hooks, clear wall mount")) failHonesty("b32 protect isToolRail");
  if (isPegRail("tool rail spanning 48 with six hooks, clear wall mount")) failHonesty("b32 tool ≠ peg");
  const tool = generateFromPrompt("house: tool rail spanning 48″ with six hooks, clear wall mount; PDF states mount height");
  if (!/^Tool rail/i.test(tool.name)) failHonesty("b32 protect tool rail title", tool.name);
}


console.log("STRANGER PLAN OK", {
  coat: coatPlan.cutList.map((c) => c.name),
  closet80: closetRodPlan.cutList.map((c) => c.name),
  jar: jarPlan.cutList.map((c) => c.name),
  refit: linenRefit.overall,
  pocketSlides: pocketSlides?.name,
  deskSlides: deskSlides?.name,
});

