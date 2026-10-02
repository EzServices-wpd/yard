import { guardFail, guardStart } from "./guard-known-failures";
import { DREAMS, generateFromPrompt, detectMaterial, parseSize } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildFitted } from "../src/lib/yard/fitted";
import { isoCaption } from "../src/lib/yard/iso";
import {
  enforceHonesty,
  hasFloorBoxLie,
  hasRackAffordance,
  inspectHonesty,
  isWallHung,
  nearInch,
  typedExtents,
} from "../src/lib/yard/honesty";

guardStart("honesty-smoke");

const extra = [
  // The pyramid left the home-page dream chips; keep guarding it by prompt.
  "3 ft popsicle stick pyramid",
  "6 foot garden arch from 3/4 inch PVC pipe",
  "7 foot PVC garden arch",
  "4 foot bridge from plastic drinking straws",
  "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
  "Build a vanity for a 36 by 22 inch bathroom alcove",
  "3 foot Eiffel Tower from popsicle sticks",
  "golden gate bridge from popsicle sticks",
  "kitchen chair from 1x4",
  "8 foot ladder from 1x4",
];

function report(label: string, prompt: string) {
  const t0 = Date.now();
  const p = generateFromPrompt(prompt);
  const pieces = p.instances.length + p.panels.length;
  const mat = detectMaterial(prompt);
  const size = parseSize(prompt.toLowerCase());
  const line = {
    label,
    kind: p.kind,
    name: p.name,
    material: p.primaryMaterialId,
    detect: mat.id,
    pieces,
    panels: p.panels.length,
    deck: p.panels.filter((x) => x.type === "deck").length,
    traverse: p.traverse?.kind ?? null,
    use: p.assumptions.use ?? null,
    size,
    overall: p.overall,
    ms: Date.now() - t0,
  };
  console.log(JSON.stringify(line));
  return { ...line, project: p };
}

const results = [
  ...DREAMS.map((d) => report(d.id, d.prompt)),
  ...extra.map((p) => report(p.slice(0, 40), p)),
];

const arch = results.find((r) => r.label === "arch");
if (!arch) throw new Error("arch dream missing");
if (arch.material !== "pvc-3-4-sch40") {
  guardFail("honesty-smoke", "", "arch material", arch.material);
}
if (arch.pieces < 8 || arch.pieces > 28) {
  guardFail("honesty-smoke", "", "arch piece count", arch.pieces);
}
if (arch.traverse !== "portal") {
  guardFail("honesty-smoke", "", "arch should be a walk-through portal", arch);
}
const desk = results.find((r) => r.label === "desk");
if (desk && (desk.kind !== "closet" || desk.panels < 6)) {
  guardFail("honesty-smoke", "", "desk not fitted", desk);
}
if (desk) {
  const deskPlan = buildPlan(desk.project);
  const titles = deskPlan.instructions.map((s) => s.title).join(" | ");
  if (/mark studs/i.test(titles)) {
    guardFail("honesty-smoke", "", "freestanding desk still talks like a closet", titles);
  }
  if (!deskPlan.instructions.some((s) => /knee/i.test(`${s.title} ${s.description}`))) {
    guardFail("honesty-smoke", "", "desk plan lost the knee bay", titles);
  }
  if (!deskPlan.instructions.some((s) => /false front/i.test(s.title))) {
    guardFail("honesty-smoke", "", "desk plan does not build drawer fronts", titles);
  }
  if (deskPlan.instructions.filter((s) => /hang drawer/i.test(s.title)).length > 1) {
    guardFail("honesty-smoke", "", "desk still repeats hang-drawer six times", titles);
  }
}
const vanity = results.find((r) => r.label.startsWith("Build a vanity"));
if (vanity && (vanity.overall.height > 48 || vanity.panels < 6)) {
  guardFail("honesty-smoke", "", "36x22 vanity should be a counter-height unit", vanity);
}
const pocket = results.find((r) => r.label === "pocket");
if (pocket && (pocket.overall.height < 90 || pocket.panels < 10)) {
  guardFail("honesty-smoke", "", "pocket vanity lost the trapezoid", pocket);
}
const pyramid = results.find((r) => r.label === "pyramid" || r.label === "3 ft popsicle stick pyramid");
if (!pyramid || pyramid.kind !== "pyramid" || pyramid.traverse !== "portal") {
  guardFail("honesty-smoke", "", "pyramid needs a north door you can walk through", pyramid);
}
if (pyramid.pieces < 80 || pyramid.pieces > 4000) {
  guardFail("honesty-smoke", "", "pyramid piece count drifted", pyramid.pieces);
}
const pyrRoles: Record<string, number> = {};
for (const inst of pyramid.project.instances) {
  const r = inst.role || "member";
  pyrRoles[r] = (pyrRoles[r] ?? 0) + 1;
}
const pyrSkin = pyrRoles.skin ?? 0;
const pyrCore = pyramid.pieces - pyrSkin;
if (pyrCore < 80 || pyrCore > 500) {
  guardFail("honesty-smoke", "", "pyramid structure should stay stepped courses", pyrCore, pyrRoles);
}
if (pyrSkin < pyramid.pieces * 0.45) {
  guardFail("honesty-smoke", "", "pyramid Fill skin is missing", pyrRoles, pyramid.pieces);
}
const pyrBrace = pyrRoles.brace ?? 0;
if (pyrBrace > pyrCore * 0.55) {
  guardFail("honesty-smoke", "", "pyramid faces got laced shut", pyrRoles, pyramid.pieces);
}
if (pyramid.use !== "display") {
  guardFail("honesty-smoke", "", "popsicle pyramid is display load, not", pyramid.use);
}
const eiffel = results.find((r) => r.label === "eiffel");
if (eiffel && (eiffel.deck > 0 || eiffel.traverse === "deck")) {
  guardFail("honesty-smoke", "", "eiffel picked up a road", eiffel);
}
if (eiffel && (eiffel.pieces < 400 || eiffel.pieces > 1200)) {
  guardFail("honesty-smoke", "", "eiffel piece count drifted", eiffel.pieces);
}
const gg = results.find((r) => /golden gate/i.test(r.label));
if (!gg || gg.kind !== "bridge" || gg.deck < 1 || gg.traverse !== "deck") {
  guardFail("honesty-smoke", "", "golden gate needs a road you can walk", gg);
}
if (gg.use !== "display") {
  guardFail("honesty-smoke", "", "popsicle golden gate is display load, not", gg.use);
}
const straw = results.find((r) => r.label === "bridge");
if (!straw || straw.deck < 1 || straw.traverse !== "deck") {
  guardFail("honesty-smoke", "", "straw bridge needs a road", straw);
}
const ggPlan = buildPlan(gg.project);
if (!ggPlan.instructions.some((s) => /road deck/i.test(s.title))) {
  guardFail("honesty-smoke", "", "golden gate plan lost the forge steps / road", ggPlan.instructions.map((s) => s.title));
}
if (ggPlan.feasibility.issues.some((i) => /closet|carcase|stud/i.test(i.message))) {
  guardFail("honesty-smoke", "", "golden gate plan hijacked by closet path", ggPlan.feasibility);
}
if (!ggPlan.feasibility.issues.some((i) => /display load/i.test(i.message))) {
  guardFail("honesty-smoke", "", "golden gate missing display-load note", ggPlan.feasibility.issues);
}
if (ggPlan.totals.pieces < gg.pieces) {
  guardFail("honesty-smoke", "", "plan piece count dropped the deck", ggPlan.totals.pieces, gg.pieces);
}
const chair = results.find((r) => /kitchen chair/i.test(r.label));
if (!chair || chair.kind !== "furniture") {
  guardFail("honesty-smoke", "", "chair is not furniture", chair);
}
if (chair.material !== "lumber-1x4-8") {
  guardFail("honesty-smoke", "", "chair stock", chair.material);
}
const chairRoles: Record<string, number> = {};
for (const inst of chair.project.instances) {
  const r = inst.role || "member";
  chairRoles[r] = (chairRoles[r] ?? 0) + 1;
}
if ((chairRoles.leg ?? 0) !== 4) {
  guardFail("honesty-smoke", "", "chair should have 4 legs", chairRoles, chair.pieces);
}
if ((chairRoles.rail ?? 0) < 6) {
  guardFail("honesty-smoke", "", "chair lost seat rails / slats", chairRoles);
}
if (chair.pieces < 12 || chair.pieces > 28) {
  guardFail("honesty-smoke", "", "chair piece count is a jungle gym or a stick", chair.pieces, chairRoles);
}
const chairPlan = buildPlan(chair.project);
if (chairPlan.instructions.some((s) => /mark studs|lace every open bay/i.test(s.title))) {
  guardFail("honesty-smoke", "", "chair plan talks like a closet or a tower", chairPlan.instructions.map((s) => s.title));
}
if (!chairPlan.instructions.some((s) => /sit on it/i.test(s.title))) {
  guardFail("honesty-smoke", "", "chair plan never sits", chairPlan.instructions.map((s) => s.title));
}
const ladder = results.find((r) => /8 foot ladder/i.test(r.label));
if (!ladder || ladder.kind !== "ladder") {
  guardFail("honesty-smoke", "", "ladder kind", ladder);
}
const ladderRoles: Record<string, number> = {};
for (const inst of ladder.project.instances) {
  const r = inst.role || "member";
  ladderRoles[r] = (ladderRoles[r] ?? 0) + 1;
}
if ((ladderRoles.leg ?? 0) !== 2) {
  guardFail("honesty-smoke", "", "ladder should have two rails", ladderRoles, ladder.pieces);
}
if ((ladderRoles.brace ?? 0) > 0) {
  guardFail("honesty-smoke", "", "ladder picked up leftover braces", ladderRoles);
}
if ((ladderRoles.rail ?? 0) < 5 || ladder.pieces > 16) {
  guardFail("honesty-smoke", "", "ladder rungs drifted", ladderRoles, ladder.pieces);
}
const ladderPlan = buildPlan(ladder.project);
if (!ladderPlan.instructions.some((s) => /rung/i.test(s.title))) {
  guardFail("honesty-smoke", "", "ladder plan never screws rungs", ladderPlan.instructions.map((s) => s.title));
}
if (eiffel) {
  const cutN = eiffel.project.instances.filter((i) => i.cutLength != null).length;
  if (cutN > 0) {
    guardFail("honesty-smoke", "", "eiffel is still cutting popsicle sticks", cutN, "of", eiffel.pieces);
  }
  const eiffelPlan = buildPlan(eiffel.project);
  if (eiffelPlan.partsKind !== "whole") {
    guardFail("honesty-smoke", "", "eiffel plan is a cut list for craft sticks", eiffelPlan.partsKind, eiffelPlan.cutList.slice(0, 5));
  }
  if (eiffelPlan.cutList.length > 2) {
    guardFail("honesty-smoke", "", "eiffel stick list split into unique lengths", eiffelPlan.cutList);
  }
  if (!eiffelPlan.instructions.some((s) => /do not cut/i.test(s.title))) {
    guardFail("honesty-smoke", "", "eiffel plan still tells a kid to cut", eiffelPlan.instructions.map((s) => s.title));
  }
}
if (!chairPlan.cutList.some((c) => c.quantity >= 2 && c.label)) {
  guardFail("honesty-smoke", "", "chair cut list did not group same-size parts", chairPlan.cutList);
}
if (chairPlan.cutList.some((c) => /left|right/i.test(c.name) && c.quantity === 1)) {
  guardFail("honesty-smoke", "", "chair still lists left/right separately", chairPlan.cutList);
}
if (desk) {
  const deskPlan = buildPlan(desk.project);
  const left = deskPlan.cutList.filter((c) => /left/i.test(c.name));
  if (left.length) {
    guardFail("honesty-smoke", "", "desk cut list still says Left instead of grouping", deskPlan.cutList.map((c) => `${c.label} ${c.quantity}× ${c.name}`));
  }
  if (!deskPlan.cutList.some((c) => /upright/i.test(c.name) && c.quantity >= 2)) {
    guardFail("honesty-smoke", "", "desk uprights not batched", deskPlan.cutList.map((c) => `${c.quantity}× ${c.name}`));
  }
}
if (straw) {
  const strawCuts = straw.project.instances.filter((i) => i.cutLength != null).length;
  if (strawCuts > straw.pieces * 0.15) {
    guardFail("honesty-smoke", "", "straw bridge is cutting drinking straws", strawCuts, straw.pieces);
  }
}

function failHonesty(msg: string, extra?: unknown) {
  guardFail("honesty-smoke", "honesty", msg, extra);
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

console.log("OK", {
  archPieces: arch.pieces,
  archTraverse: arch.traverse,
  deskKind: desk?.kind,
  deskPanels: desk?.panels,
  vanityH: vanity?.overall.height,
  pocketH: pocket?.overall.height,
  eiffelPieces: eiffel?.pieces,
  ggPieces: gg.pieces,
  ggDeck: gg.deck,
  ggUse: gg.use,
  strawDeck: straw.deck,
  pyramidPieces: pyramid.pieces,
  pyramidTraverse: pyramid.traverse,
  chairPieces: chair.pieces,
  chairRoles,
  chairCuts: chairPlan.cutList.map((c) => `${c.label} ${c.quantity}× ${c.name} ${c.lengthIn}"`),
  ladderPieces: ladder.pieces,
  ladderRoles,
  eiffelStickLines: eiffel ? buildPlan(eiffel.project).cutList.length : 0,
  laundry: generateFromPrompt("laundry folding table 48 wide 36 high 24 deep").overall,
  spiceLips: spice.panels.filter((p) => p.type === "rail").length,
  wineRails: wine.panels.filter((p) => p.type === "rail").length,
});
