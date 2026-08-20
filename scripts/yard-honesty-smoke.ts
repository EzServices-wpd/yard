import { DREAMS, generateFromPrompt, detectMaterial, parseSize } from "../src/lib/yard/prompt";

const extra = [
  "6 foot garden arch from 3/4 inch PVC pipe",
  "7 foot PVC garden arch",
  "4 foot bridge from plastic drinking straws",
  "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
  "Build a vanity for a 36 by 22 inch bathroom alcove",
  "3 foot Eiffel Tower from popsicle sticks",
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
    size,
    overall: p.overall,
    ms: Date.now() - t0,
  };
  console.log(JSON.stringify(line));
  return line;
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
const desk = results.find((r) => r.label === "desk");
if (desk && (desk.kind !== "closet" || desk.panels < 6)) {
  console.error("FAIL desk not fitted", desk);
  process.exit(1);
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
console.log("OK", {
  archPieces: arch.pieces,
  deskKind: desk?.kind,
  deskPanels: desk?.panels,
  vanityH: vanity?.overall.height,
  pocketH: pocket?.overall.height,
});
