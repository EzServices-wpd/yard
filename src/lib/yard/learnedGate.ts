/**
 * The learned-recipe gate: a recipe the live site learned (recipe bot, `learned: true`) reaches main and the
 * Ideas library only when its default build passes support, cut list vs Buy agreement and wording checks.
 * Seed recipes keep the standard validateRecipe checks; this gate is what the bot's auto-merge waits on.
 */
import { getCatalogItem } from "./catalog";
import { buildRecipe, ROUND_WORD, validateRecipe } from "./recipeBuild";
import { recipePrompt } from "./recipeIdeas";
import type { Recipe } from "./recipes";
import { buildPlan } from "./report";

/** Buy lines that are not cut stock: fasteners, glue, finish, glides, hardware. */
const SUPPLY = /screw|nail|glue|bolt|nut|washer|hinge|glide|finish|stain|sandpaper|brad|pin|latch|hook|bracket|dowel|bead/i;
/** Fitted-build wording that a freestanding (non-wall) recipe must never print. */
const FITTED = /\bcloset\b|\bfootprint\b|\bopening\b/i;

export function learnedRecipeFailures(recipe: Recipe, prompt = recipePrompt(recipe)): string[] {
  const built = buildRecipe(recipe, prompt);
  const fail = validateRecipe(recipe, built, prompt);
  const { panels } = built.project;
  const plan = buildPlan(built.project);
  // Round things are drawn round: a wheel, bead, disc or drum part needs a round shape, not a box.
  for (const part of recipe.parts) if (!part.shape && ROUND_WORD.test(`${part.role} ${part.name}`)) fail.push(`${part.name}: a ${part.role} drawn as a box`);
  // Cut list vs Buy: every part is a real catalogue item, no member is a glue-up billed as one stick,
  // and every cut-stock Buy line is used by some part.
  for (const p of panels) {
    const it = getCatalogItem(p.materialId);
    if (!it) { fail.push(`${p.name}: no catalogue item (${p.materialId})`); continue; }
    if (it.category === "lumber" && it.dims.width && it.dims.height) {
      const [a, b] = [p.size.width, p.size.height, p.size.depth].sort((m, n) => m - n);
      if (a > it.dims.height + 0.01 && b > it.dims.width + 0.01) fail.push(`${p.name}: ${a.toFixed(2)}×${b.toFixed(2)} is wider than one ${it.name}`);
    }
  }
  const cutStock = new Set(plan.cutList.map((c) => c.material));
  for (const b of plan.bom) if (!SUPPLY.test(b.name) && !cutStock.has(b.name)) fail.push(`Buy ${b.name}: no part is cut from it`);
  // Wording: a freestanding recipe prints no closet / footprint / opening text.
  if (!recipe.wall) {
    const text = [built.project.name, ...built.project.notes, plan.feasibility?.summary ?? "", ...(plan.feasibility?.issues ?? []).map((i) => i.message), ...plan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
    const hit = text.match(FITTED);
    if (hit) fail.push(`fitted wording "${hit[0]}" on a freestanding build`);
  }
  // Every part has a real step: no "not yet in a step" fallback.
  if (plan.instructions.some((s) => /not yet in a step/i.test(`${s.tips ?? ""} ${s.description}`))) fail.push("a part has only a fallback step");
  // A ring floats unless some other part reaches across its open centre to the rim (spokes, a web).
  for (const ring of panels.filter((p) => p.polygon?.holes?.length && recipe.parts.some((q) => q.shape === "ring" && (q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))))) {
    const [a, b] = ring.polygon!.plane === "zy" ? (["z", "y"] as const) : ring.polygon!.plane === "xy" ? (["x", "y"] as const) : (["x", "z"] as const);
    const k = (ax: "x" | "y" | "z") => (ax === "x" ? "width" : ax === "y" ? "height" : "depth");
    const c = [ring.position[a] + ring.size[k(a)] / 2, ring.position[b] + ring.size[k(b)] / 2];
    const inner = ring.polygon!.holes![0].r;
    const reach = (p: (typeof panels)[number]) => {
      const lo = [p.position[a], p.position[b]], hi = [p.position[a] + p.size[k(a)], p.position[b] + p.size[k(b)]];
      const far = Math.hypot(Math.max(Math.abs(lo[0] - c[0]), Math.abs(hi[0] - c[0])), Math.max(Math.abs(lo[1] - c[1]), Math.abs(hi[1] - c[1])));
      const near = Math.hypot(Math.max(lo[0] - c[0], 0, c[0] - hi[0]), Math.max(lo[1] - c[1], 0, c[1] - hi[1]));
      return near < inner - 0.05 && far >= inner;
    };
    const ax3 = (["x", "y", "z"] as const).find((x) => x !== a && x !== b)!;
    const overlaps = (p: (typeof panels)[number]) => p.position[ax3] <= ring.position[ax3] + ring.size[k(ax3)] + 0.05 && ring.position[ax3] <= p.position[ax3] + p.size[k(ax3)] + 0.05;
    if (!panels.some((p) => p !== ring && overlaps(p) && reach(p) && !/^dowel-/.test(p.materialId))) fail.push(`${ring.name} floats: nothing joins its rim to the hub`);
  }
  // Hinged parts: a lid, door or flap touches the part it hinges to, along one shared edge; a lid over
  // walls of two heights (a cold frame's taller back) slopes from the low wall's top to the high one's.
  const hinged = new Set([...(recipe.moving ?? []).filter((m) => m.motion === "hinge" || m.motion === "fold").map((m) => m.part), ...recipe.parts.filter((p) => /^(?:lid|door|flap|hatch)$/.test(p.role)).map((p) => p.name)]);
  const boxOfName = (n: string) => panels.filter((p) => p.name === n || p.name.replace(/ \d+$/, "") === n);
  const tol = 0.1;
  const touch = (a: (typeof panels)[number], b: (typeof panels)[number]) => (["x", "y", "z"] as const).every((k) => {
    const s = k === "x" ? "width" : k === "y" ? "height" : "depth";
    return a.position[k] <= b.position[k] + b.size[s] + tol && b.position[k] <= a.position[k] + a.size[s] + tol;
  });
  for (const name of hinged) {
    const part = recipe.parts.find((p) => p.name === name);
    const carriers = (part?.on ?? []).flatMap(boxOfName);
    for (const h of boxOfName(name)) {
      if (!carriers.length || !carriers.some((c) => touch(h, c))) fail.push(`${h.name} is hinged but does not touch the part it hinges to`);
    }
    if (part?.role === "lid") {
      const walls = panels.filter((p) => /\b(?:front|back)\b/i.test(p.name) && !hinged.has(p.name) && p.size.height > 1);
      const tops = walls.map((w) => w.position.y + w.size.height);
      if (tops.length >= 2 && Math.max(...tops) - Math.min(...tops) > 1) {
        for (const h of boxOfName(name)) {
          if (h.position.y > Math.min(...tops) + tol || h.position.y + h.size.height < Math.max(...tops) - tol) fail.push(`${h.name} lies flat over walls of two heights: it must slope from the front top to the back top`);
        }
      }
    }
  }
  // Names and roles: each part is its own named thing, not every part one role ("rail" for posts, axle and wheel).
  const roles = new Set(recipe.parts.map((p) => p.role));
  if (recipe.parts.length >= 3 && roles.size < 2) fail.push(`every part has the role "${[...roles][0]}"`);
  const dup = recipe.parts.map((p) => p.name.toLowerCase()).find((n, i, a) => a.indexOf(n) !== i);
  if (dup) fail.push(`two parts are both named "${dup}"`);
  // Notes agree with the geometry: a stock a note names is one the parts are cut from, and a counted
  // part ("9 rods", "4 legs") is built that many times.
  const used = panels.map((p) => getCatalogItem(p.materialId)?.name.toLowerCase() ?? "").join(" | ");
  for (const note of recipe.notes) {
    for (const m of note.toLowerCase().matchAll(/\b(\d x\d|\dx\d|plywood|dowels?)\b/g)) {
      const want = m[1].replace(/s$/, "").replace(/x/, "×");
      if (!used.includes(want) && !used.includes(m[1].replace(/s$/, ""))) fail.push(`note names ${m[1]} but no part is cut from it`);
    }
    for (const m of note.toLowerCase().matchAll(/\b(\d+)\s+([a-z]+?)s?\b/g)) {
      const n = Number(m[1]);
      const named = panels.filter((p) => p.name.toLowerCase().replace(/ \d+$/, "").split(" ").includes(m[2]));
      if (named.length && named.length !== n) fail.push(`note says ${n} ${m[2]}, the model has ${named.length}`);
    }
  }
  // Critic's classes, each an automatic check (RESULTS-2026-10-13):
  const all = `${plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`).join("\n")}\n${plan.bom.map((b) => b.notes ?? "").join("\n")}`;
  const minT = (p: (typeof panels)[number]) => Math.min(p.size.width, p.size.height, p.size.depth);
  const isDowel = (p: (typeof panels)[number]) => /^dowel-/.test(p.materialId);
  // (a) A note that names holes or slots needs a part that has them: a bore, a drilled step, or slots between repeated dividers.
  const noteText = recipe.notes.join(". ").toLowerCase();
  if (/\b(?:holes?|drilled|bored)\b/.test(noteText) && !recipe.parts.some((p) => p.bore || p.shape === "ring" || p.shape === "bead") && !/\bdrill\b/i.test(all)) fail.push("a note names holes but no part is drilled");
  // A counted hole array ("60 holes per track") needs that many drilled holes, not just a peg's.
  const holeCount = Math.max(0, ...[...noteText.matchAll(/(\d+)\s+holes?\b/g)].map((m) => Number(m[1])));
  if (holeCount > panels.filter(isDowel).length + recipe.parts.filter((p) => p.bore).length) fail.push(`a note names ${holeCount} holes the model does not drill`);
  if (/\bslots?\b/.test(noteText) && !recipe.parts.some((p) => p.repeat === "between") && !/\bslot\b/i.test(all)) fail.push("a note names slots but no part forms them");
  // (b) Dividers repeated between the sides stand on edge: their thin side runs along the repeat (x).
  for (const part of recipe.parts.filter((q) => q.repeat === "between" && q.kind !== "member")) {
    for (const p of panels.filter((q) => q.name.replace(/ \d+$/, "") === part.name)) if (p.size.width > minT(p) + 0.01) { fail.push(`${part.name} lies flat: a divider repeated between the sides must stand on edge`); break; }
  }
  // (c) Hardware is a catalogue item, never cut from stock, and nothing under 3/4" is screwed.
  for (const part of recipe.parts.filter((q) => q.kind === "hardware")) {
    if (plan.cutList.some((c) => c.name.toLowerCase().replace(/ \d+$/, "") === part.name.toLowerCase().replace(/\d+$/, "") && !/dowel/i.test(c.material))) fail.push(`${part.name} is hardware cut from stock`);
  }
  for (const s of plan.instructions.filter((x) => /\bscrews?\b/i.test(x.description) && !/no screws/i.test(x.description))) {
    const thin = panels.find((p) => !isDowel(p) && minT(p) < 0.7 && (s.partsUsed ?? []).includes(p.name));
    if (thin) fail.push(`${thin.name} is ${minT(thin).toFixed(2)}" thick and screwed: nothing under 3/4" takes a screw`);
  }
  // (d) Glue-up boards cover the strip length, and a thickness under the board's is planed or resawn.
  for (const b of plan.bom) {
    const it = getCatalogItem(b.catalogId ?? "");
    if (!it || it.category !== "lumber" || !it.dims.width || !it.dims.length) continue;
    const mine = plan.cutList.filter((c) => c.material === it.name);
    const need = mine.reduce((n, c) => n + c.quantity * Math.max(1, Math.ceil((c.widthIn - 0.01) / it.dims.width!)) * c.lengthIn, 0);
    if (need > b.quantity * it.dims.length + 0.5) fail.push(`Buy ${b.quantity} ${it.name} for ${Math.round(need)}" of strips`);
    if (it.dims.height && mine.some((c) => c.thicknessIn < it.dims.height! - 0.05 && c.thicknessIn > 0) && !/\b(?:plane|resaw)/i.test(all)) fail.push(`${it.name} parts thinner than the board with no plane or resaw step`);
  }
  // (f) Template text matches this build: no cedar on other wood, no back edges without a back, the stock chip is cut.
  const woods = panels.map((p) => getCatalogItem(p.materialId)?.name ?? "").join(" ");
  if (/cedar/i.test(all) && !/cedar/i.test(woods)) fail.push("cedar wording on a build with no cedar");
  if (/back edges?/i.test(all) && !panels.some((p) => /\bback\b/i.test(p.name))) fail.push("back-edge wording with no back");
  const chip = built.project.primaryMaterialId;
  if (chip && !panels.some((p) => p.materialId === chip) && !plan.cutList.some((c) => c.material === getCatalogItem(chip)?.name)) fail.push(`the stock chip (${getCatalogItem(chip)?.name ?? chip}) is not on the cut list`);
  // (g) Parts are named, not numbered slugs ("Peg1"): a repeat is one part with a count.
  for (const p of panels) if (/[a-z]\d+$/i.test(p.name)) fail.push(`"${p.name}" is a numbered slug: one part with a count`);
  return [...new Set(fail)];
}
