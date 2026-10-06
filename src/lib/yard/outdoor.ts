/**
 * Exterior package. A build the stranger typed for outdoors (outdoor, patio, garden, porch,
 * exterior, backyard, or a deck as a place) gets weather-proof joinery and finish on every
 * surface of the plan: notes, steps and Buy. The trigger reads the typed prompt only — a build's
 * own part words ("deck" on a cat tree or a stand platform) and a species name ("cedar chest")
 * never switch it on. Anything that holds soil or water gets drainage and a liner, indoors or out.
 */
import type { AssemblyStep, BomLine, BuildPlan, YardProject } from "./types";
import { decorateBom } from "./listings";
import { getCatalogItem } from "./catalog";

/** Deck as a place: "for the deck", "on my deck", "deck box", "deck chair". A skateboard deck is a board. */
const DECK_PLACE =
  /\b(?:on|for|by|off|onto|around|beside|to|at|under)\s+(?:the\s+|my\s+|our\s+|a\s+)?(?:back\s+|front\s+|rear\s+|pool\s+)?deck\b|\bdeck\s+(?:box|chair|bench|planter|table|storage|railing|rail planter|side table|bar)\b/;
const OUTDOOR_WORDS = /\b(?:outdoors?|outside|patio|garden|porch|exterior|backyard|back\s*yard|terrace|balcony|poolside)\b/;

/** True when the typed prompt asks for an outdoor build. */
export function isOutdoorPrompt(prompt: string | undefined | null): boolean {
  const lower = (prompt ?? "").toLowerCase();
  if (!lower.trim()) return false;
  // Door / window framing carries its own exterior flashing rules.
  if (/\b(?:exterior|entry|front)\s+doors?\b|\bwindow\b|rough opening/.test(lower)) return false;
  if (/\bskate\s*board\s+deck|\bdeck\s+of\s+cards|\bcard\s+deck|\btape\s+deck/.test(lower) && !OUTDOOR_WORDS.test(lower)) return false;
  return OUTDOOR_WORDS.test(lower) || DECK_PLACE.test(lower);
}

/** Anything that holds soil or water drains through the bottom. */
export function holdsSoilOrWater(prompt: string | undefined | null, name = ""): boolean {
  const hay = `${prompt ?? ""} ${name}`.toLowerCase();
  return /\bplanters?\b|plant(?:ing)?\s+box|flower\s*box|window\s*box|herb\s+(?:box|garden|planter)|garden\s+bed|raised\s+bed|\btrough\b|bird\s*bath/.test(hay);
}

export const OUTDOOR_NOTE =
  "Outdoor build — exterior package: Titebond III waterproof glue, exterior-coated or stainless screws, an exterior finish on every face with extra coats soaked into the end grain, and glides under the feet so the end grain sits off wet ground.";
/** Same package for a build fixed in place (posts in concrete, pier blocks, ground anchors): no feet to lift. */
export const OUTDOOR_FIXED_NOTE =
  "Outdoor build — exterior package: Titebond III waterproof glue, exterior-coated or stainless screws, and an exterior finish on every face with extra coats soaked into the end grain.";
export const DRAINAGE_NOTE =
  'Holds soil or water: drill 1/2" drainage holes about every 6" across the bottom and staple a landscape-fabric liner inside so soil stays in and water runs out.';

const WOOD_CATEGORIES = new Set(["lumber", "sheet_goods", "craft_wood", "dowel_rod"]);

/** The package is for wood: glue, screws and end-grain sealing. PVC, plastic and paper builds skip it. */
function woodBuild(project: YardProject): boolean {
  const ids = [...project.panels.map((p) => p.materialId), ...project.instances.map((i) => i.catalogId)];
  return ids.some((id) => WOOD_CATEGORIES.has(getCatalogItem(id ?? "")?.category ?? ""));
}

function outdoorWood(project: YardProject, prompt: string | undefined | null): boolean {
  return isOutdoorPrompt(prompt) && project.kind !== "opening" && !project.windowPkg && woodBuild(project);
}

function wallHung(project: YardProject): boolean {
  return project.assumptions?.installMode === "wall";
}

/** Set in the ground or hung from posts there: concrete, pier blocks, ground anchors. Nothing stands on feet. */
function fixedInGround(project: YardProject): boolean {
  return (project.notes ?? []).some((n) => /\bin concrete\b|\bpier blocks?\b|\bpavers?\b|\bground anchors?\b|\bin the ground\b/i.test(n));
}

/** Notes on the project itself: the exterior package and the drainage rule, written once. */
export function withOutdoorNotes(project: YardProject, prompt = project.prompt): YardProject {
  const outdoor = outdoorWood(project, prompt);
  const soil = holdsSoilOrWater(prompt, project.name);
  if (!outdoor && !soil) return project;
  let notes = (project.notes ?? []).map((n) =>
    soil ? n.replace(/\s*Drainage holes optional\.?/i, "").replace(/\s*Guidance only — set level outdoors\.?$/i, " Guidance only — set it level.") : n,
  );
  notes = notes.filter((n) => n.trim());
  if (outdoor && !notes.some((n) => n.startsWith("Outdoor build — exterior package"))) notes.push(fixedInGround(project) ? OUTDOOR_FIXED_NOTE : OUTDOOR_NOTE);
  if (soil && !notes.some((n) => /drainage holes/i.test(n) && /liner/i.test(n))) notes.push(DRAINAGE_NOTE);
  return { ...project, notes };
}

const isGlueRow = (b: BomLine) =>
  (b.catalogId === "glue" || /\bwood glue\b|\btitebond\b/i.test(b.name)) && !/epoxy|cement|hot glue|solvent/i.test(b.name);
const isPlainScrewRow = (b: BomLine) =>
  (b.catalogId === "screws-8" || /\bwood screws?\b|#\s?\d+\s*[x×]\s*[\d-\/]+"?\s*(?:wood\s+)?screws?/i.test(b.name)) &&
  !/structural|grk|lag|tapcon|masonry|exterior|stainless|deck screw/i.test(b.name);

function footTalk(project: YardProject): { where: string; count: number } {
  if (wallHung(project)) return { where: "the bottom edges and both ends of every board", count: 0 };
  const legs = project.panels.filter((panel) => /\bleg\b/i.test(panel.name));
  if (legs.length >= 1) {
    const names = legs.map((panel) => panel.name);
    return { where: `the bottom ends of ${names.join(", ")}`, count: legs.length };
  }
  const ground = project.panels.filter((panel) => panel.position.y < 1 && /\b(?:side|upright|end|stile|post)\b/i.test(panel.name));
  if (ground.length >= 2) {
    const names = ground.map((panel) => panel.name);
    return { where: `the bottom ends of ${names.join(", ")}`, count: ground.length };
  }
  return { where: "the bottom edges where it meets the ground", count: 4 };
}

/** Plain-screw wording in a step becomes the exterior screw the Buy list carries. */
function exteriorTalk(t: string | undefined): string | undefined {
  if (!t) return t;
  return t
    .replace(/(#\s?\d+\s*[×x]\s*[\d¼½¾\/ -]+"?)\s+(?:wood\s+)?screws/g, "$1 exterior screws")
    .replace(/\bwood glue\b/gi, "Titebond III")
    .replace(/A felt pad under each foot saves the floor\.?/g, "A glide under each foot keeps the end grain off wet ground.");
}

/** Plan pass: Buy swaps indoor glue and screws for exterior ones, adds finish + glides; steps seal end grain. */
export function withOutdoorPackage(project: YardProject, plan: BuildPlan): BuildPlan {
  // A primitive stand-in (a feeder built as an open box) answers to the words the person typed.
  const prompt = project.typedPrompt ?? project.prompt ?? "";
  const outdoor = outdoorWood(project, prompt);
  const soil = holdsSoilOrWater(prompt, project.name);
  if (!outdoor && !soil) return plan;
  if (!project.panels.length && !project.instances.length) return plan;
  let bom = [...plan.bom];
  let instructions = [...plan.instructions];
  const lastIsCheck = (s?: AssemblyStep) => !!s && /level|plumb|sit-test|check|hang it|test/i.test(s.title);
  const insertStep = (step: Omit<AssemblyStep, "step">) => {
    const at = lastIsCheck(instructions[instructions.length - 1]) ? instructions.length - 1 : instructions.length;
    instructions.splice(at, 0, { ...step, step: 0 });
  };
  // Drainage first, so the seal coats run into the holes.
  if (soil) {
    if (!bom.some((b) => /landscape fabric/i.test(b.name))) {
      bom.push({
        name: "Landscape fabric liner, 3 ft × 50 ft roll",
        quantity: 1,
        unit: "roll",
        catalogId: "outdoor-liner",
        searchQuery: "landscape fabric 3 ft x 50 ft",
        estimatedCost: 12.98,
        notes: "Staple it inside the walls and over the bottom so soil stays in and water drains out.",
      });
    }
    insertStep({
      title: "Drill drainage holes and line it",
      description:
        'Drill 1/2" drainage holes about every 6" across the bottom so water runs straight out. Staple landscape fabric inside the walls and over the bottom, folded at the corners, then fill with soil.',
      tips: "Water should drain out the bottom within a minute of watering.",
    });
  }
  if (outdoor) {
    const feet = footTalk(project);
    const wall = wallHung(project) || fixedInGround(project);
    // Exactly one glue: the exterior one replaces the indoor bottle.
    const glueRows = bom.filter(isGlueRow);
    const glueQty = Math.max(1, ...glueRows.map((b) => b.quantity));
    const glueNotes = glueRows.map((b) => b.notes).filter(Boolean).join(" ");
    bom = bom.filter((b) => !isGlueRow(b));
    const exteriorGlue: BomLine = {
      name: "Titebond III Ultimate wood glue (waterproof, exterior)",
      quantity: glueQty,
      unit: glueQty === 1 ? "bottle" : "bottles",
      catalogId: "outdoor-glue",
      searchQuery: "Titebond III Ultimate wood glue 8 oz",
      estimatedCost: 7.98 * glueQty,
      notes: `${glueNotes ? `${glueNotes} ` : ""}Waterproof exterior glue for every joint on an outdoor build.`,
    };
    // Exactly one screw class: the exterior screw takes the plain screw's place and count.
    bom = bom.map((b) =>
      isPlainScrewRow(b)
        ? {
            ...b,
            name: b.name.replace(/\s*(?:wood\s+)?screws?\b/i, " exterior-coated or stainless wood screws"),
            catalogId: "outdoor-screws",
            searchQuery: `${b.name.match(/#\s?\d+\s*[x×]\s*[\d-\/]+"?/)?.[0] ?? "#8 x 1-1/4\""} exterior coated wood screws`,
            estimatedCost: (b.estimatedCost ?? 9) * 1.35,
            offers: undefined,
            asin: "B09NNZB6M9",
            notes: `${b.notes ? `${b.notes} ` : ""}Exterior-coated or stainless so they stay bright in the rain and leave no rust streaks.`,
          }
        : b,
    );
    const glueAt = bom.findIndex((b) => b.catalogId === "outdoor-screws");
    bom.splice(glueAt >= 0 ? glueAt + 1 : bom.length, 0, exteriorGlue);
    bom.push({
      name: "Exterior finish — spar urethane or exterior oil, 1 quart (also seals the end grain)",
      quantity: 1,
      unit: "can",
      catalogId: "outdoor-finish",
      searchQuery: "spar urethane exterior 1 quart",
      asin: "B000C0140S",
      estimatedCost: 18.98,
      notes: `Three coats on every face. Flood ${feet.where} and every other cut end until they stop soaking it in.`,
    });
    if (!wall) {
      const packs = Math.max(1, Math.ceil(feet.count / 8));
      bom.push({
        name: "Outdoor furniture glides (nylon, nail-in)",
        quantity: packs,
        unit: packs === 1 ? "pack of 8" : "packs of 8",
        catalogId: "outdoor-glides",
        searchQuery: "outdoor furniture glides nylon nail in",
        estimatedCost: 7.99 * packs,
        notes: `One under each foot (${feet.count}) so the end grain sits off wet ground.`,
      });
    }
    instructions = instructions.map((s) => ({ ...s, title: exteriorTalk(s.title)!, description: exteriorTalk(s.description)!, tips: exteriorTalk(s.tips) }));
    insertStep({
      title: wall ? "Seal it for outdoors — finish and end grain" : "Seal it for outdoors — finish, end grain and feet",
      description:
        `Sand to 180 grit and wipe off the dust. Seal the end grain first: brush finish onto ${feet.where} and every other cut end, ` +
        "let it soak in, and add coats until the end grain stops drinking — end grain wicks water up into the wood. " +
        "Then brush three coats of exterior finish (spar urethane or exterior oil) on every face, inside and out, with a light sand between coats." +
        (wall ? "" : ` When the finish is dry, tap a nylon glide into each of the ${feet.count} feet so the sealed end grain sits off wet ground.`),
      tips: bom.some((b) => b.catalogId === "outdoor-screws")
        ? "Titebond III and exterior-coated or stainless screws are on the Buy list for every joint. Refresh the finish each spring."
        : "Titebond III is on the Buy list for every joint. Refresh the finish each spring.",
    });
  }
  instructions = instructions.map((s, i) => ({ ...s, step: i + 1 }));
  bom = bom.map((b) => (b.offers?.length ? b : decorateBom([b])[0]));
  // The plan total is the sum of the Buy lines: carry the swap's cost into it.
  const sum = (rows: BomLine[]) => rows.reduce((t, b) => t + (b.estimatedCost ?? 0), 0);
  const delta = sum(bom) - sum(plan.bom);
  if (Math.abs(delta) < 0.005) return { ...plan, bom, instructions };
  const cost = Math.round((plan.totals.estCostUsd + delta) * 100) / 100;
  const money = (n: number) => `~$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;
  return {
    ...plan,
    bom,
    instructions,
    totals: { ...plan.totals, estCostUsd: cost },
    feasibility: { ...plan.feasibility, summary: plan.feasibility.summary.replace(/~\$[\d,]+(?:\.\d+)?/, () => money(cost)) },
  };
}
