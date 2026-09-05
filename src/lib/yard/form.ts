import type { StructureKind, Vec3 } from "./types";
import { classifyAnatomy } from "./anatomy";
import { figureStrokes } from "./figure";
import type { FormOp, FormStroke, FormRecipe, Size3 } from "./formTypes";
export type { FormOp, FormStroke, FormRecipe, Size3 } from "./formTypes";
import {
  tajOps,
  pyramidOps,
  colosseumOps,
  libertyOps,
  clockOps,
  obeliskOps,
  empireStateOps,
  spaceNeedleOps,
  pisaOps,
  goldenGateOps,
  fitSuspension,
  fitPyramid,
  arcOps,
  parthenonOps,
  stonehengeOps,
  sydneyOps,
  lighthouseOps,
  windmillOps,
  pagodaOps,
  castleOps,
  bridgeOps,
} from "./formBuildersCore";
import { detectWeekendFamily, detectWeekendMech, figureIdentityLabel, type WeekendHit } from "./weekendFamily";
import {
  houseOps,
  wallOps,
  domeOps,
  archOps,
  ladderOps,
  frameOps,
  launcherFrameOps,
  catapultFrameOps,
  chairOps,
  tableOps,
  bedOps,
  benchOps,
  rocketOps,
  planeOps,
  wagonOps,
  bikeOps,
  boatOps,
  ferrisOps,
  treeOps,
  dinoOps,
  robotOps,
  giraffeOps,
  animalOps,
  figureOps,
  guitarOps,
  swingOps,
  guessOps,
} from "./formBuildersExtra";


type Hit = {
  re: RegExp;
  kind: StructureKind;
  name: string;
  historic?: boolean;
  build: (s: Size3) => FormOp[];
  fit?: (s: Size3, prompt: string) => Size3;
};

const HITS: Hit[] = [
  { re: /eiffel/, kind: "eiffel", name: "Eiffel", historic: true, build: () => [] },
  { re: /taj|mahal/, kind: "taj", name: "Taj Mahal", historic: true, build: tajOps },
  { re: /pyramid|giza|khufu/, kind: "pyramid", name: "Pyramid", historic: true, build: pyramidOps, fit: fitPyramid },
  { re: /colosseum|coliseum|amphitheatre|amphitheater/, kind: "custom", name: "Colosseum", historic: true, build: colosseumOps },
  { re: /statue of liberty|liberty statue|\bliberty\b/, kind: "figure", name: "Liberty", historic: true, build: libertyOps },
  { re: /empire state/, kind: "tower", name: "Empire State", historic: true, build: empireStateOps },
  { re: /chrysler building/, kind: "tower", name: "Chrysler", historic: true, build: empireStateOps },
  { re: /space needle/, kind: "tower", name: "Space Needle", historic: true, build: spaceNeedleOps },
  { re: /cn tower/, kind: "tower", name: "CN Tower", historic: true, build: spaceNeedleOps },
  { re: /leaning tower|pisa/, kind: "tower", name: "Pisa", historic: true, build: pisaOps },
  { re: /golden gate/, kind: "bridge", name: "Golden Gate", historic: true, build: goldenGateOps, fit: fitSuspension },
  { re: /brooklyn bridge/, kind: "bridge", name: "Brooklyn Bridge", historic: true, build: goldenGateOps, fit: fitSuspension },
  { re: /arc de triomphe|triumphal arch/, kind: "arch", name: "Arc de Triomphe", historic: true, build: arcOps },
  { re: /parthenon|pantheon of athens/, kind: "custom", name: "Parthenon", historic: true, build: parthenonOps },
  { re: /stonehenge/, kind: "custom", name: "Stonehenge", historic: true, build: stonehengeOps },
  { re: /sydney opera/, kind: "dome", name: "Sydney Opera", historic: true, build: sydneyOps },
  { re: /big ben|clock tower|westminster/, kind: "tower", name: "Clock tower", historic: true, build: clockOps },
  { re: /washington monument|obelisk/, kind: "tower", name: "Obelisk", historic: true, build: obeliskOps },
  { re: /lighthouse/, kind: "tower", name: "Lighthouse", build: lighthouseOps },
  { re: /windmill/, kind: "tower", name: "Windmill", build: windmillOps },
  { re: /pagoda/, kind: "tower", name: "Pagoda", build: pagodaOps },
  { re: /mosque|minaret/, kind: "taj", name: "Mosque", build: tajOps },
  { re: /castle|fort|keep|battlement|turret/, kind: "castle", name: "Castle", build: castleOps },
  { re: /bridge|span/, kind: "bridge", name: "Bridge", build: bridgeOps },
  { re: /birdhouse/, kind: "house", name: "Birdhouse", build: houseOps },
  { re: /stairs|staircase/, kind: "ladder", name: "Stairs", build: ladderOps },
  { re: /planter|raised (garden )?bed|garden box/, kind: "furniture", name: "Planter", build: benchOps },
  { re: /ramp|half-?pipe/, kind: "custom", name: "Ramp", build: frameOps },
  { re: /cabin|shed|hut|cottage|barn|(?<!opera )house/, kind: "house", name: "House", build: houseOps },
  { re: /wall|fence|palisade|barrier/, kind: "wall", name: "Wall", build: wallOps },
  { re: /dome|igloo|sphere|globe/, kind: "dome", name: "Dome", build: domeOps },
  { re: /garden\s*arch|arbor|arbour|pergola/, kind: "arch", name: "Garden arch", build: archOps },
  { re: /arch|gateway|portal/, kind: "arch", name: "Arch", build: archOps },
  { re: /chair|stool|throne/, kind: "furniture", name: "Chair", build: chairOps },
  { re: /table|desk|workbench/, kind: "furniture", name: "Table", build: tableOps },
  { re: /\bbed\b|bunk/, kind: "furniture", name: "Bed", build: bedOps },
  { re: /bench|sawhorse/, kind: "furniture", name: "Bench", build: benchOps },
  { re: /rocket|spaceship|missile/, kind: "vehicle", name: "Rocket", build: rocketOps },
  { re: /plane|airplane|aircraft|jet/, kind: "vehicle", name: "Airplane", build: planeOps },
  { re: /robot|android/, kind: "figure", name: "Robot", build: robotOps },
  { re: /marble run|marble maze/, kind: "custom", name: "Marble run", build: (s) => guessOps("marble", s) },
  { re: /\bcar\b|\btruck\b|\bwagon\b|\bcart\b|\bvehicle\b/, kind: "vehicle", name: "Wagon", build: wagonOps },
  { re: /bike|bicycle/, kind: "vehicle", name: "Bicycle", build: bikeOps },
  { re: /boat|ship|canoe|sailboat|yacht/, kind: "vessel", name: "Boat", build: boatOps },
  { re: /ferris/, kind: "custom", name: "Ferris wheel", build: ferrisOps },
  { re: /tree|cactus|plant/, kind: "plant", name: "Tree", build: treeOps },
  { re: /dinosaur|t-?rex|raptor|dino/, kind: "figure", name: "Dinosaur", build: dinoOps },
  { re: /charizard|dragon|wyvern|godzilla|kaiju/, kind: "figure", name: "Wyvern", build: () => [] },
  { re: /giraffe/, kind: "figure", name: "Giraffe", build: giraffeOps },
  { re: /\bdogs?\b|puppy|puppies/, kind: "figure", name: "Dog", build: animalOps },
  { re: /\bcats?\b|kitten/, kind: "figure", name: "Cat", build: animalOps },
  { re: /\bhorses?\b|pony|ponies/, kind: "figure", name: "Horse", build: animalOps },
  { re: /horse|\bdog\b|\bcat\b|animal|creature/, kind: "figure", name: "Animal", build: animalOps },
  { re: /person|human|man|woman|figure|statue/, kind: "figure", name: "Figure", build: figureOps },
  { re: /guitar|violin|ukulele/, kind: "custom", name: "Guitar", build: guitarOps },
  { re: /swing/, kind: "frame", name: "Swing", build: swingOps },
  { re: /lattice|space\s*frame/, kind: "lattice", name: "Lattice", build: () => [] },
  { re: /tower|spire|column|stack|skyscraper/, kind: "lattice", name: "Lattice tower", build: () => [] },
  { re: /frame|box|cube|platform/, kind: "frame", name: "Frame", build: frameOps },
];

export function isLockedForm(kind: StructureKind): boolean {
  return kind === "eiffel" || kind === "pyramid" || kind === "arch" || kind === "bridge";
}

export function detectForm(prompt: string, size: Size3): FormRecipe {
  const lower = prompt.toLowerCase();
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? `${looks[1]} ${lower}` : lower;
  for (const hit of HITS) {
    if (hit.re.test(hay)) {
      const sized = hit.fit ? hit.fit(size, prompt) : size;
      const ops = hit.build(sized);
      const stance =
        hit.kind === "figure"
          ? classifyAnatomy(hay).stance
          : undefined;
      const strokes =
        hit.kind === "figure" || hit.name === "Giraffe" || hit.name === "Liberty"
          ? figureStrokes({
              height: size.height,
              stance: stance ?? (hit.name === "Giraffe" ? "longneck" : hit.name === "Liberty" ? "liberty" : "biped"),
              width: size.width,
            })
          : undefined;
      const figLabel = hit.kind === "figure" ? figureIdentityLabel(hay) : null;
      const name = figLabel ?? hit.name;
      return {
        name,
        kind: hit.kind,
        historic: hit.historic,
        notes: [
          `${name} · stock mapped onto the form, not a hull.`,
          hit.historic
            ? "Published / historic proportions, scaled to the size you asked for."
            : "Parametric form. Frame first, then brace. Support if it is slender.",
        ],
        ops: strokes && strokes.length >= 3 ? ops.filter((o) => o.op === "taper" || o.op === "shell" || o.op === "arch") : ops,
        strokes,
      };
    }
  }
  const weekend = detectWeekendFamily(prompt);
  if (weekend) return recipeFromWeekend(weekend, prompt, size);
  return recipeFromAnatomy(prompt, size);
}

function recipeFromWeekend(hit: WeekendHit, prompt: string, size: Size3): FormRecipe {
  if (hit.family === "figure") {
    const stance = classifyAnatomy(prompt).stance ?? "quadruped";
    const strokes = figureStrokes({
      height: size.height,
      stance,
      width: size.width,
    });
    return {
      name: hit.name,
      kind: "figure",
      notes: [
        `${hit.name} · ${stance} armature.`,
        "Weekend figure family — not a noun per file.",
      ],
      ops: [],
      strokes,
    };
  }
  if (hit.family === "lattice") {
    return {
      name: hit.name,
      kind: hit.kind,
      historic: hit.override === "eiffel",
      notes: [
        hit.override === "eiffel"
          ? "Eiffel override — four arches, four piers, one shaft."
          : `${hit.name} · lattice densified at the named stock's stick length / section.`,
      ],
      ops: [],
    };
  }
  if (hit.family === "arch") {
    return {
      name: hit.name,
      kind: "arch",
      notes: ["Walk-through portal: four posts, front + back crowns, side rails only."],
      ops: archOps(size),
    };
  }
  if (hit.family === "truss") {
    const named = /golden gate|brooklyn|suspension/.test(prompt.toLowerCase());
    return {
      name: hit.name,
      kind: "bridge",
      historic: named,
      notes: [
        named
          ? "Published / historic proportions, scaled to the size you asked for."
          : "Warren truss · continuous chords, densified at the named stock.",
      ],
      ops: named ? goldenGateOps(fitSuspension(size, prompt)) : bridgeOps(size),
    };
  }
  const lower = prompt.toLowerCase();
  const mech = detectWeekendMech(lower) ?? detectWeekendMech(prompt);
  const frameOpsFor =
    mech === "climb"
      ? ladderOps(size)
      : mech === "launcher"
        ? launcherFrameOps(size)
        : frameOps(size);
  const kind = mech === "climb" || hit.kind === "ladder" ? ("ladder" as const) : ("frame" as const);
  const notes =
    mech === "climb"
      ? ["Ladder · side rails + rungs at the named stock (cut list OK for lumber)."]
      : mech === "launcher"
        ? [
            `${hit.name} · base, axle pivot, throwing arm, and payload cup — densify keeps that anatomy.`,
            "Glue the base, seat the axle, hang the throwing arm, then brace the A-frame faces.",
          ]
        : mech === "media-hold"
          ? [
              `${hit.name} · opening with a rabbet and same-stock backing so flat media stays put.`,
            ]
          : ["Simple frame in the named craft stock."];
  return {
    name: hit.name,
    kind,
    notes,
    ops: frameOpsFor,
  };
}

export function recipeFromAnatomy(prompt: string, size: Size3): FormRecipe {
  const weekend = detectWeekendFamily(prompt);
  if (weekend) return recipeFromWeekend(weekend, prompt, size);
  const hit = classifyAnatomy(prompt);
  if (hit.anatomy === "figure") {
    const strokes = figureStrokes({
      height: size.height,
      stance: hit.stance ?? "quadruped",
      width: size.width,
    });
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: [
        `${hit.named || subjectTitle(prompt)} · ${hit.stance ?? "figure"} armature.`,
        "Any named creature uses this stance if we have no published wire. Grok can replace the wire when the key is set.",
      ],
      ops: [],
      strokes,
    };
  }
  if (hit.anatomy === "shell") {
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      historic: !!hit.named,
      notes: [`${hit.named || "Dome"} · continuous shell, meridians + belts.`],
      ops: hit.kind === "taj" ? tajOps(size) : shellOps(size),
    };
  }
  if (hit.anatomy === "loft") {
    if (!hit.named) {
      return {
        name: hit.named || subjectTitle(prompt),
        kind: "lattice",
        notes: [
          `${hit.named || subjectTitle(prompt)} · lattice densified at the named stock.`,
          "Four chords, Warren faces, hoops at the stock's bay. Not a hollow taper.",
        ],
        ops: [],
      };
    }
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: [`${hit.named || "Tower"} · continuous loft.`],
      ops: [taper(0, size.height, size.width * 0.35, size.width * 0.12, 4, "leg")],
    };
  }
  if (hit.anatomy === "span") {
    return {
      name: hit.named || subjectTitle(prompt),
      kind: hit.kind,
      notes: ["Span · deck + posts, one frame."],
      ops: hit.kind === "arch" ? archOps(size) : hit.kind === "wall" ? wallOps(size) : bridgeOps(size),
    };
  }
  return {
    name: hit.named || subjectTitle(prompt),
    kind: hit.kind,
    notes: [
      "No published wire for this name — built from its anatomy class.",
      "Grok can refine the parts; the stock and joins stay deterministic.",
    ],
    ops: guessOps(prompt.toLowerCase(), size),
  };
}

function subjectTitle(prompt: string): string {
  const s = subjectFromPrompt(prompt);
  if (!s) return "Custom form";
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 48);
}

function shellOps(s: Size3): FormOp[] {
  const r = Math.max(s.width, s.depth) / 2;
  return [{ op: "shell", y0: 0, y1: s.height, r, profile: "hemisphere", role: "ring" }];
}

export function recipeFromOps(
  name: string,
  kind: StructureKind,
  ops: FormOp[],
  notes: string[] = [],
  historic?: boolean,
): FormRecipe {
  return { name, kind, historic, notes, ops };
}

function taper(y0: number, y1: number, r0: number, r1: number, sides = 8, role = "leg"): FormOp {
  return { op: "taper", y0, y1, r0, r1, sides, role };
}


export function isFormStroke(v: unknown): v is FormStroke {
  if (!v || typeof v !== "object") return false;
  const pts = (v as FormStroke).points;
  return Array.isArray(pts) && pts.length >= 2 && pts.every((p) => p && typeof p.x === "number" && typeof p.y === "number" && typeof p.z === "number");
}

export function subjectFromPrompt(prompt: string): string {
  let s = prompt.toLowerCase();
  const looks = s.match(/looks like (?:an? |the )?([a-z0-9][a-z0-9\s'-]{1,60})/);
  if (looks) s = looks[1];
  s = s.replace(/\d+(?:\.\d+)?\s*(?:ft|foot|feet|in|inch|inches|cm|m|meter|metre)s?/g, " ");
  s = s.replace(/\bfrom\b.+$/g, " ");
  s = s.replace(/\b(build|make|a|an|the|of|that|with|using|out|model|replica|mini|miniature|scale)\b/g, " ");
  return s.replace(/\s+/g, " ").trim() || prompt.trim();
}

export function isFormOp(v: unknown): v is FormOp {
  if (!v || typeof v !== "object") return false;
  const op = (v as FormOp).op;
  return (
    op === "taper" ||
    op === "column" ||
    op === "ring" ||
    op === "box" ||
    op === "arch" ||
    op === "dome" ||
    op === "grid" ||
    op === "poly" ||
    op === "legs" ||
    op === "shell"
  );
}
