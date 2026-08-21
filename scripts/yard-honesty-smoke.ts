import { DREAMS, generateFromPrompt, detectMaterial, parseSize } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";

const extra = [
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
  console.error("FAIL arch material", arch.material);
  process.exit(1);
}
if (arch.pieces < 8 || arch.pieces > 28) {
  console.error("FAIL arch piece count", arch.pieces);
  process.exit(1);
}
if (arch.traverse !== "portal") {
  console.error("FAIL arch should be a walk-through portal", arch);
  process.exit(1);
}
const desk = results.find((r) => r.label === "desk");
if (desk && (desk.kind !== "closet" || desk.panels < 6)) {
  console.error("FAIL desk not fitted", desk);
  process.exit(1);
}
if (desk) {
  const deskPlan = buildPlan(desk.project);
  const titles = deskPlan.instructions.map((s) => s.title).join(" | ");
  if (/mark studs/i.test(titles)) {
    console.error("FAIL freestanding desk still talks like a closet", titles);
    process.exit(1);
  }
  if (!deskPlan.instructions.some((s) => /knee/i.test(`${s.title} ${s.description}`))) {
    console.error("FAIL desk plan lost the knee bay", titles);
    process.exit(1);
  }
  if (!deskPlan.instructions.some((s) => /false front/i.test(s.title))) {
    console.error("FAIL desk plan does not build drawer fronts", titles);
    process.exit(1);
  }
  if (deskPlan.instructions.filter((s) => /hang drawer/i.test(s.title)).length > 1) {
    console.error("FAIL desk still repeats hang-drawer six times", titles);
    process.exit(1);
  }
}
const vanity = results.find((r) => r.label.startsWith("Build a vanity"));
if (vanity && (vanity.overall.height > 48 || vanity.panels < 6)) {
  console.error("FAIL 36x22 vanity should be a counter-height unit", vanity);
  process.exit(1);
}
const pocket = results.find((r) => r.label === "closet");
if (pocket && (pocket.overall.height < 90 || pocket.panels < 10)) {
  console.error("FAIL pocket vanity lost the trapezoid", pocket);
  process.exit(1);
}
const pyramid = results.find((r) => r.label === "pyramid");
if (!pyramid || pyramid.kind !== "pyramid" || pyramid.traverse !== "portal") {
  console.error("FAIL pyramid needs a north door you can walk through", pyramid);
  process.exit(1);
}
if (pyramid.pieces < 80 || pyramid.pieces > 4000) {
  console.error("FAIL pyramid piece count drifted", pyramid.pieces);
  process.exit(1);
}
const pyrRoles: Record<string, number> = {};
for (const inst of pyramid.project.instances) {
  const r = inst.role || "member";
  pyrRoles[r] = (pyrRoles[r] ?? 0) + 1;
}
const pyrSkin = pyrRoles.skin ?? 0;
const pyrCore = pyramid.pieces - pyrSkin;
if (pyrCore < 80 || pyrCore > 500) {
  console.error("FAIL pyramid structure should stay stepped courses", pyrCore, pyrRoles);
  process.exit(1);
}
if (pyrSkin < pyramid.pieces * 0.45) {
  console.error("FAIL pyramid Fill skin is missing", pyrRoles, pyramid.pieces);
  process.exit(1);
}
const pyrBrace = pyrRoles.brace ?? 0;
if (pyrBrace > pyrCore * 0.55) {
  console.error("FAIL pyramid faces got laced shut", pyrRoles, pyramid.pieces);
  process.exit(1);
}
if (pyramid.use !== "display") {
  console.error("FAIL popsicle pyramid is display load, not", pyramid.use);
  process.exit(1);
}
const eiffel = results.find((r) => r.label === "eiffel");
if (eiffel && (eiffel.deck > 0 || eiffel.traverse === "deck")) {
  console.error("FAIL eiffel picked up a road", eiffel);
  process.exit(1);
}
if (eiffel && (eiffel.pieces < 400 || eiffel.pieces > 1200)) {
  console.error("FAIL eiffel piece count drifted", eiffel.pieces);
  process.exit(1);
}
const gg = results.find((r) => /golden gate/i.test(r.label));
if (!gg || gg.kind !== "bridge" || gg.deck < 1 || gg.traverse !== "deck") {
  console.error("FAIL golden gate needs a road you can walk", gg);
  process.exit(1);
}
if (gg.use !== "display") {
  console.error("FAIL popsicle golden gate is display load, not", gg.use);
  process.exit(1);
}
const straw = results.find((r) => r.label === "bridge");
if (!straw || straw.deck < 1 || straw.traverse !== "deck") {
  console.error("FAIL straw bridge needs a road", straw);
  process.exit(1);
}
const ggPlan = buildPlan(gg.project);
if (!ggPlan.instructions.some((s) => /road deck/i.test(s.title))) {
  console.error("FAIL golden gate plan lost the forge steps / road", ggPlan.instructions.map((s) => s.title));
  process.exit(1);
}
if (ggPlan.feasibility.issues.some((i) => /closet|carcase|stud/i.test(i.message))) {
  console.error("FAIL golden gate plan hijacked by closet path", ggPlan.feasibility);
  process.exit(1);
}
if (!ggPlan.feasibility.issues.some((i) => /display load/i.test(i.message))) {
  console.error("FAIL golden gate missing display-load note", ggPlan.feasibility.issues);
  process.exit(1);
}
if (ggPlan.totals.pieces < gg.pieces) {
  console.error("FAIL plan piece count dropped the deck", ggPlan.totals.pieces, gg.pieces);
  process.exit(1);
}
const chair = results.find((r) => /kitchen chair/i.test(r.label));
if (!chair || chair.kind !== "furniture") {
  console.error("FAIL chair is not furniture", chair);
  process.exit(1);
}
if (chair.material !== "lumber-1x4-8") {
  console.error("FAIL chair stock", chair.material);
  process.exit(1);
}
const chairRoles: Record<string, number> = {};
for (const inst of chair.project.instances) {
  const r = inst.role || "member";
  chairRoles[r] = (chairRoles[r] ?? 0) + 1;
}
if ((chairRoles.leg ?? 0) !== 4) {
  console.error("FAIL chair should have 4 legs", chairRoles, chair.pieces);
  process.exit(1);
}
if ((chairRoles.rail ?? 0) < 6) {
  console.error("FAIL chair lost seat rails / slats", chairRoles);
  process.exit(1);
}
if (chair.pieces < 12 || chair.pieces > 28) {
  console.error("FAIL chair piece count is a jungle gym or a stick", chair.pieces, chairRoles);
  process.exit(1);
}
const chairPlan = buildPlan(chair.project);
if (chairPlan.instructions.some((s) => /mark studs|lace every open bay/i.test(s.title))) {
  console.error("FAIL chair plan talks like a closet or a tower", chairPlan.instructions.map((s) => s.title));
  process.exit(1);
}
if (!chairPlan.instructions.some((s) => /sit on it/i.test(s.title))) {
  console.error("FAIL chair plan never sits", chairPlan.instructions.map((s) => s.title));
  process.exit(1);
}
const ladder = results.find((r) => /8 foot ladder/i.test(r.label));
if (!ladder || ladder.kind !== "ladder") {
  console.error("FAIL ladder kind", ladder);
  process.exit(1);
}
const ladderRoles: Record<string, number> = {};
for (const inst of ladder.project.instances) {
  const r = inst.role || "member";
  ladderRoles[r] = (ladderRoles[r] ?? 0) + 1;
}
if ((ladderRoles.leg ?? 0) !== 2) {
  console.error("FAIL ladder should have two rails", ladderRoles, ladder.pieces);
  process.exit(1);
}
if ((ladderRoles.brace ?? 0) > 0) {
  console.error("FAIL ladder picked up leftover braces", ladderRoles);
  process.exit(1);
}
if ((ladderRoles.rail ?? 0) < 5 || ladder.pieces > 16) {
  console.error("FAIL ladder rungs drifted", ladderRoles, ladder.pieces);
  process.exit(1);
}
const ladderPlan = buildPlan(ladder.project);
if (!ladderPlan.instructions.some((s) => /rung/i.test(s.title))) {
  console.error("FAIL ladder plan never screws rungs", ladderPlan.instructions.map((s) => s.title));
  process.exit(1);
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
  ladderPieces: ladder.pieces,
  ladderRoles,
});
