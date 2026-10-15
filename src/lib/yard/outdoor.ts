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

/** Things that only ever live outdoors: their name alone asks for the exterior package. */
const OUTDOOR_NOUN = /\b(?:bat|bird|wren|bluebird|martin)\s*-?\s*(?:houses?|box(?:es)?)\b|\bcompost\b|\bsand\s*box(?:es)?\b|\bpergolas?\b|\barbou?rs?\b|\bchicken\s+coops?\b|\bdog\s*houses?\b|\bpicnic\s+tables?\b|\badirondack\b/;

/** True when the typed prompt asks for an outdoor build. */
export function isOutdoorPrompt(prompt: string | undefined | null): boolean {
  const lower = (prompt ?? "").toLowerCase();
  if (!lower.trim()) return false;
  // Door / window framing carries its own exterior flashing rules.
  if (/\b(?:exterior|entry|front)\s+doors?\b|\bwindow\b|rough opening/.test(lower)) return false;
  if (/\bskate\s*board\s+deck|\bdeck\s+of\s+cards|\bcard\s+deck|\btape\s+deck/.test(lower) && !OUTDOOR_WORDS.test(lower)) return false;
  return OUTDOOR_WORDS.test(lower) || DECK_PLACE.test(lower) || OUTDOOR_NOUN.test(lower);
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
  // Outdoor when the prompt says so or the build's own notes put it outside.
  const notesOutside = (project.notes ?? []).some((n) => /\b(?:exterior screws|pressure-treated)\b/i.test(n));
  return (isOutdoorPrompt(prompt) || notesOutside) && project.kind !== "opening" && !project.windowPkg && woodBuild(project);
}

function wallHung(project: YardProject): boolean {
  return project.assumptions?.installMode === "wall";
}

/** Ground-contact pressure-treated legs (a coop, a hutch) stand on the ground as they are: no glides. */
function groundContactLegs(project: YardProject): boolean {
  return (project.notes ?? []).some((n) => /ground-contact pressure-treated/i.test(n));
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
  if (outdoor && !notes.some((n) => n.startsWith("Outdoor build — exterior package"))) notes.push(fixedInGround(project) || groundContactLegs(project) || (!wallHung(project) && !footTalk(project).feet) ? OUTDOOR_FIXED_NOTE : OUTDOOR_NOTE);
  if (soil && !notes.some((n) => /drainage holes/i.test(n) && /liner/i.test(n))) notes.push(DRAINAGE_NOTE);
  return { ...project, notes };
}

const isGlueRow = (b: BomLine) =>
  (b.catalogId === "glue" || /\bwood glue\b|\btitebond\b/i.test(b.name)) && !/epoxy|cement|hot glue|solvent/i.test(b.name);
const isPlainScrewRow = (b: BomLine) =>
  (b.catalogId === "screws-8" || /\bwood screws?\b|#\s?\d+\s*[x×]\s*[\d-\/]+"?\s*(?:wood\s+)?screws?/i.test(b.name)) &&
  !/structural|grk|lag|tapcon|masonry|exterior|stainless|deck screw/i.test(b.name);

function footTalk(project: YardProject): { where: string; count: number; feet: boolean } {
  if (wallHung(project)) return { where: "the bottom edges and both ends of every board", count: 0, feet: false };
  const legs = project.panels.filter((panel) => /\bleg\b/i.test(panel.name));
  if (legs.length >= 1) {
    const names = legs.map((panel) => panel.name);
    return { where: `the bottom ends of ${names.join(", ")}`, count: legs.length, feet: true };
  }
  const ground = project.panels.filter((panel) => panel.position.y < 1 && /\b(?:side|upright|end|stile|post)\b/i.test(panel.name));
  if (ground.length >= 2) {
    const names = ground.map((panel) => panel.name);
    return { where: `the bottom ends of ${names.join(", ")}`, count: ground.length, feet: true };
  }
  // A frame of sticks stands on the members that reach the floor; a flat board build (a cover, a lid) has no feet.
  const sticks = (project.instances ?? []).filter((i) => Math.min(i.from?.y ?? i.position.y, i.to?.y ?? i.position.y) < 1 && Math.abs((i.to?.y ?? 0) - (i.from?.y ?? 0)) > 6);
  return { where: "the bottom edges where it meets the ground", count: Math.max(4, sticks.length), feet: sticks.length >= 2 };
}

/** Plain-screw wording in a step becomes the exterior screw the Buy list carries. */
function exteriorTalk(t: string | undefined): string | undefined {
  if (!t) return t;
  return t
    .replace(/(#\s?\d+\s*[×x]\s*[\d¼½¾\/ -]+"?)\s+(?:wood\s+)?screws/g, "$1 exterior screws")
    .replace(/\bwood glue\b/gi, "Titebond III")
    .replace(/A felt pad under each foot saves the floor\.?/g, "A glide under each foot keeps the end grain off wet ground.");
}

/** Pressure-treated #2 lumber, Home Depot shelf prices checked 2026-10-15 (search links where no single product page fits). */
const PT_LUMBER: Record<string, { name: string; price: number; query: string; href?: string; title: string }> = {
  "lumber-2x4-8": { name: "2×4 pressure-treated (8 ft)", price: 4.88, query: "2x4x8 pressure treated lumber", title: "2x4x8 #2 Prime ground contact pressure-treated pine" },
  "lumber-2x6-8": { name: "2×6 pressure-treated (8 ft)", price: 5.98, query: "2x6x8 pressure treated lumber", href: "https://www.homedepot.com/p/2-in-x-6-in-x-8-ft-2-Pressure-Treated-Lumber-2310254/329737526", title: "2x6x8 #2 pressure-treated lumber" },
  // 1× trim (rails, stiles, battens) comes treated too, so no indoor board is left in an outdoor build. Estimates.
  "lumber-1x2-8": { name: "1×2 pressure-treated (8 ft)", price: 2.98, query: "1x2x8 pressure treated furring", title: "1x2x8 pressure-treated furring strip (estimate)" },
  "lumber-1x3-8": { name: "1×3 pressure-treated (8 ft)", price: 3.48, query: "1x3x8 pressure treated board", title: "1x3x8 pressure-treated board (estimate)" },
  "lumber-1x4-8": { name: "1×4 pressure-treated (8 ft)", price: 4.37, query: "1x4x8 pressure treated board", title: "1x4x8 pressure-treated board (estimate)" },
  "lumber-1x6-8": { name: "1×6 pressure-treated (8 ft)", price: 6.48, query: "1x6x8 pressure treated board", title: "1x6x8 pressure-treated board (estimate)" },
  "lumber-4x4-8": { name: "4×4 pressure-treated (8 ft), ground contact", price: 12.98, query: "4x4x8 pressure treated ground contact", title: "4x4x8 #2 ground-contact pressure-treated pine (estimate)" },
  "plywood-3-4-4x8": { name: "3/4\" exterior plywood 4×8 (pressure-treated / CDX)", price: 64.98, query: "3/4 pressure treated plywood 4x8", title: "23/32 in. x 4 ft. x 8 ft. pressure-treated plywood (estimate)" },
  "lumber-2x8-8": { name: "2×8 pressure-treated (8 ft)", price: 12.88, query: "2x8x8 pressure treated lumber", title: "2x8x8 #2 Prime ground contact pressure-treated pine" },
};

function pressureTreated(b: BomLine): BomLine {
  const pt = b.catalogId ? PT_LUMBER[b.catalogId] : undefined;
  if (!pt) return b;
  const lineTotal = Math.round(pt.price * b.quantity * 100) / 100;
  return {
    ...b,
    name: pt.name,
    searchQuery: pt.query,
    estimatedCost: lineTotal,
    notes: `${b.notes ?? ""} Pressure-treated for outdoors (ground-contact rated); let it dry a few weeks before you finish it.`.trim(),
    offers: [{ retailer: "homedepot", label: "Home Depot", title: pt.title, href: pt.href ?? `https://www.homedepot.com/s/${encodeURIComponent(pt.query)}`, packQty: 1, packPrice: pt.price, unitPrice: pt.price, packsNeeded: b.quantity, lineTotal, best: true, checkedAt: "2026-10-15" }],
  } as BomLine;
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
  let cutList = [...plan.cutList];
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
    // Ground-contact pressure-treated legs stand on the ground as they are: no furniture glides under a coop or hutch.
    const groundContact = groundContactLegs(project);
    if (!wall && feet.feet && !groundContact) {
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
    // Notes that call for pressure-treated lumber get it priced on Buy, not kiln-dried framing stock.
    // A typed species (cedar, redwood…) is what gets bought; PT only replaces plain framing stock.
    const species = /\b(?:cedar|redwood|cypress|teak|oak|ipe|acacia|mahogany|douglas fir|walnut|maple|cherry|pine)\b/i;
    if ((project.notes ?? []).some((n) => /\bpressure-treated\b/i.test(n)) && !species.test(prompt)) {
      bom = bom.map((b) => (species.test(b.name) ? b : pressureTreated(b)));
      // F21/I9: the cut list and the steps name the same PT stock Buy prices, never the kiln-dried catalogue name.
      for (const b of bom) {
        const pt = b.catalogId ? PT_LUMBER[b.catalogId] : undefined;
        const was = b.catalogId ? getCatalogItem(b.catalogId)?.name : undefined;
        if (!pt || !was || pt.name !== b.name) continue;
        cutList = cutList.map((c) => (c.material === was ? { ...c, material: pt.name } : c));
        const swap = (t: string | undefined) => t?.split(was).join(pt.name);
        instructions = instructions.map((s) => ({ ...s, title: swap(s.title)!, description: swap(s.description)!, tips: swap(s.tips) }));
      }
    }
    instructions = instructions.map((s) => ({ ...s, title: exteriorTalk(s.title)!, description: exteriorTalk(s.description)!, tips: exteriorTalk(s.tips) }));
    insertStep({
      title: wall || !feet.feet || groundContact ? "Seal it for outdoors — finish and end grain" : "Seal it for outdoors — finish, end grain and feet",
      description:
        `Sand to 180 grit and wipe off the dust. Seal the end grain first: brush finish onto ${feet.where} and every other cut end, ` +
        "let it soak in, and add coats until the end grain stops drinking — end grain wicks water up into the wood. " +
        "Then brush three coats of exterior finish (spar urethane or exterior oil) on every face, inside and out, with a light sand between coats." +
        // Glides only when the Buy list has them: real feet, never a base or skid.
        (wall || !feet.feet || groundContact ? "" : ` When the finish is dry, tap a nylon glide into each of the ${feet.count} feet so the sealed end grain sits off wet ground.`),
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
  if (Math.abs(delta) < 0.005) return { ...plan, bom, instructions, cutList };
  const cost = Math.round((plan.totals.estCostUsd + delta) * 100) / 100;
  const money = (n: number) => `~$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;
  return {
    ...plan,
    bom,
    instructions,
    cutList,
    totals: { ...plan.totals, estCostUsd: cost },
    feasibility: { ...plan.feasibility, summary: plan.feasibility.summary.replace(/~\$[\d,]+(?:\.\d+)?/, () => money(cost)) },
  };
}
