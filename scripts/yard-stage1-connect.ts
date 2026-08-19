import { generateFromPrompt } from "../src/lib/yard/prompt";

const cases = [
  { name: "eiffel-36-popsicle", prompt: "3 foot Eiffel Tower from popsicle sticks" },
  { name: "eiffel-12-popsicle", prompt: "1 foot Eiffel Tower from popsicle sticks" },
  { name: "eiffel-12-toothpick", prompt: "1 foot Eiffel Tower from toothpicks" },
  { name: "eiffel-36-toothpick", prompt: "3 foot Eiffel Tower from toothpicks" },
  { name: "giraffe-popsicle", prompt: "3 foot giraffe from popsicle sticks" },
  { name: "liberty-popsicle", prompt: "3 foot Statue of Liberty from popsicle sticks" },
  { name: "taj-popsicle", prompt: "2 foot Taj Mahal from popsicle sticks" },
  { name: "dragon-toothpick", prompt: "18 inch dragon from toothpicks" },
  { name: "igloo-popsicle", prompt: "1 foot igloo from popsicle sticks" },
  { name: "closet", prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep" },
  { name: "window", prompt: "window rough opening 36 by 48, 6 inches deep" },
];

let failed = 0;
for (const c of cases) {
  const t0 = Date.now();
  const project = generateFromPrompt(c.prompt);
  const ms = Date.now() - t0;
  const stats = project.buildStats;
  const pieces = project.instances.length + project.panels.length;
  const okForge =
    project.panels.length > 0 ||
    (stats && stats.components <= 2 && stats.loose / Math.max(stats.pieces, 1) <= 0.05);
  const line = {
    name: c.name,
    kind: project.kind,
    pieces,
    joints: stats?.joints ?? 0,
    components: stats?.components ?? (project.panels.length ? 1 : 0),
    loose: stats?.loose ?? 0,
    material: project.primaryMaterialId,
    spine: project.supportOffer?.needed ? (project.supportOffer.included ? "in" : "offered") : "no",
    ms,
    ok: okForge,
  };
  if (!okForge) failed += 1;
  console.log(JSON.stringify(line));
}

const pop12 = generateFromPrompt("1 foot Eiffel Tower from popsicle sticks");
const tooth12 = generateFromPrompt("1 foot Eiffel Tower from toothpicks");
const denser = tooth12.instances.length > pop12.instances.length;
console.log(
  JSON.stringify({
    name: "density",
    popsicle12: pop12.instances.length,
    toothpick12: tooth12.instances.length,
    denser,
    ok: denser,
  }),
);
if (!denser) failed += 1;

const spine = generateFromPrompt("3 foot giraffe from popsicle sticks", undefined, undefined, {
  includeSpine: true,
});
console.log(
  JSON.stringify({
    name: "spine-on",
    pieces: spine.instances.length,
    included: spine.supportOffer?.included ?? false,
    ok: (spine.supportOffer?.included || !spine.supportOffer?.needed) && spine.instances.length > 0,
  }),
);

console.log(JSON.stringify({ failed }));
if (failed) process.exit(1);
