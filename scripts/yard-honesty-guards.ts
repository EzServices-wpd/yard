import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { measureKindFromProject } from "../src/lib/yard/space";
import { buildFitted } from "../src/lib/yard/fitted";
import { detectHouseFamily } from "../src/lib/yard/family";
import { detectWeekendFamily } from "../src/lib/yard/weekendFamily";
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
expectWeekend("ladder from 2x4", "frame", { kind: "frame" });
expectWeekend("6 foot ladder from 2x4", "frame", { kind: "frame" });
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
if (catapult.instances.length < 220) failWeekend("catapult too sparse", catapult.instances.length);
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
if (catapult2.instances.length < 220) {
  failWeekend("2ft catapult still sparse", catapult2.instances.length);
}
const catapult2Inspect = inspectWeekendHonesty(catapult2, buildPlan(catapult2));
if (!catapult2Inspect.ok) failWeekend("2ft catapult inspect", catapult2Inspect.issues);

const ladder = generateFromPrompt("ladder from 2x4");
if (ladder.kind !== "frame" || ladder.primaryMaterialId !== "lumber-2x4-8") {
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
if (ladder6.kind !== "frame" || ladder6.primaryMaterialId !== "lumber-2x4-8") {
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

console.log("STRANGER PLAN OK", {
  coat: coatPlan.cutList.map((c) => c.name),
  closet80: closetRodPlan.cutList.map((c) => c.name),
  jar: jarPlan.cutList.map((c) => c.name),
  refit: linenRefit.overall,
  pocketSlides: pocketSlides?.name,
  deskSlides: deskSlides?.name,
});

