/**
 * The learned-recipe gate: a recipe the live site learned (recipe bot, `learned: true`) reaches main and the
 * Ideas library only when its default build passes support, cut list vs Buy agreement and wording checks.
 * Seed recipes keep the standard validateRecipe checks; this gate is what the bot's auto-merge waits on.
 */
import { getCatalogItem } from "./catalog";
import { bearingFailures, glueUpFailures, boardSection, buildRecipe, ROUND_WORD, validateRecipe } from "./recipeBuild";
import { recipePrompt } from "./recipeIdeas";
import type { Recipe } from "./recipes";
import { buildPlan, cutStepCount, dedupeBuy, duplicateBuyLines, overlongCuts } from "./report";
import { isOutdoorPrompt } from "./outdoor";
import type { BuildPlan, Panel } from "./types";
import { generateFromPrompt } from "./promptMain";

/** Buy lines that are not cut stock: fasteners, glue, finish, glides, hardware. */
// Consumables (oil, fabric liner, finish) are bought, never cut: no part comes from them, by design.
const SUPPLY = /screw|nail|glue|bolt|mechanism|\bstay\b|nut|washer|hinge|glide|finish|stain|sandpaper|brad|pin|latch|hook|bracket|dowel|bead|\boil\b|fabric|liner/i;
/** Fitted-build wording that a freestanding (non-wall) recipe must never print. */
const FITTED = /\bcloset\b|\bfootprint\b|\bopening\b/i;

export function learnedRecipeFailures(recipe: Recipe, prompt = recipePrompt(recipe)): string[] {
  const built = buildRecipe(recipe, prompt);
  const fail = validateRecipe(recipe, built, prompt);
  const { panels } = built.project;
  const plan = buildPlan(built.project);
  // A stand holds what it names: a rain barrel stand's opening between the posts clears a 23" (50-gallon) barrel.
  if (/\bbarrel\b/i.test(recipe.title) && /\bstand\b/i.test(recipe.title)) {
    const posts = panels.filter((p) => /\bpost\b/i.test(p.name));
    const gap = posts.length >= 2 ? Math.max(...posts.map((p) => p.position.x)) - Math.min(...posts.map((p) => p.position.x + p.size.width)) : 0;
    if (gap < 23) fail.push(`the opening between the posts is ${Math.round(gap * 8) / 8}", under a 23" barrel`);
  }
  // A learned recipe never replaces a built-in shape: the engine already builds this noun itself.
  if (recipe.learned && generateFromPrompt(prompt).id !== built.project.id) fail.push(`the engine builds "${prompt}" itself; a learned recipe never replaces a built-in shape`);
  // The header is the model: each side of the overall size matches the parts' extent (pegs standing proud excepted).
  const o = built.project.overall;
  if (o) for (const [a, k] of [["x", "width"], ["y", "height"], ["z", "depth"]] as const) {
    const body = panels.filter((p) => !(k === "height" && /\bpegs?\b/i.test(p.name)));
    const ext = Math.max(...body.map((p) => p.position[a] + p.size[k])) - (a === "y" ? 0 : Math.min(...body.map((p) => p.position[a])));
    if (Math.abs(ext - o[k]) > 0.13) fail.push(`header ${k} ${o[k]}" but the model is ${Math.round(ext * 8) / 8}"`);
  }
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
  // A lumber member is a real board section (whole boards thick, the full face), never a scaled 1.8×3.84.
  for (const p of panels) {
    const part = recipe.parts.find((q) => q.name === p.name || q.name === p.name.replace(/ \d+$/, ""));
    const real = part?.kind === "member" && !p.polygon ? boardSection(p.materialId, p.size) : null;
    if (real) fail.push(`${p.name}: ${[p.size.width, p.size.height, p.size.depth].map((n) => Math.round(n * 100) / 100).join("×")} is not a real ${getCatalogItem(p.materialId)?.name} section`);
  }
  fail.push(...definingFailures(recipe, built.project, plan));
  // The saw step counts what the cut list counts (glue layers as layers, not parts).
  fail.push(...buildClassFailures(built.project, plan, !!recipe.outdoor || isOutdoorPrompt(prompt)));
  fail.push(...bearingFailures(recipe, panels), ...glueUpFailures(recipe, panels));
  // No cut part is longer than its bought stock unless the plan splices it.
  const spliced = plan.instructions.some((st) => /^Splice\b/.test(st.title));
  for (const c of overlongCuts(plan)) if (!spliced) fail.push(`${c.name}: ${c.lengthIn}" is longer than its ${c.material} with no splice step`);
  const cutStock = new Set(plan.cutList.map((c) => c.material));
  const cutIds = new Set(plan.cutList.map((c) => c.id.split("|")[0]));
  for (const b of plan.bom) if (!SUPPLY.test(b.name) && !cutStock.has(b.name) && !(b.catalogId && cutIds.has(b.catalogId))) fail.push(`Buy ${b.name}: no part is cut from it`);
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
  if (/\b(?:holes?|drilled|bored)\b/.test(noteText) && !recipe.parts.some((p) => p.bore || p.holes || p.shape === "ring" || p.shape === "bead") && !/\bdrill\b/i.test(all)) fail.push("a note names holes but no part is drilled");
  // A counted hole array ("60 holes per track") needs that many drilled holes, not just a peg's.
  const holeCount = Math.max(0, ...[...noteText.matchAll(/(\d+)\s+holes?\b/g)].map((m) => Number(m[1])));
  if (holeCount > panels.filter(isDowel).length + recipe.parts.filter((p) => p.bore).length + panels.reduce((n, p) => n + (p.polygon?.holes?.length ?? 0), 0)) fail.push(`a note names ${holeCount} holes the model does not drill`);
  if (/\bslots?\b/.test(noteText) && !recipe.parts.some((p) => p.repeat === "between") && recipe.parts.filter((p) => /\b(?:divider|shelf)\b/i.test(`${p.role} ${p.name}`)).length < 2 && !/\bslot\b/i.test(all)) fail.push("a note names slots but no part forms them");
  // (b) Dividers repeated between the sides stand on edge: their thin side runs along the repeat (x).
  for (const part of recipe.parts.filter((q) => q.repeat === "between" && q.kind !== "member")) {
    for (const p of panels.filter((q) => q.name.replace(/ \d+$/, "") === part.name)) if (p.size.width > minT(p) + 0.01) { fail.push(`${part.name} lies flat: a divider repeated between the sides must stand on edge`); break; }
  }
  // (c) Hardware is a catalogue item, never cut from stock, and nothing under 3/4" is screwed.
  for (const part of recipe.parts.filter((q) => q.kind === "hardware")) {
    if (plan.cutList.some((c) => c.name.toLowerCase().replace(/ \d+$/, "") === part.name.toLowerCase().replace(/\d+$/, "") && !/dowel/i.test(c.material))) fail.push(`${part.name} is hardware cut from stock`);
  }
  // A back is screwed through into the carcase edges; any other part under 3/4" is glued.
  for (const s of plan.instructions.filter((x) => /\bscrews?\b/i.test(x.description.replace(/too thin for a screw|no screws/gi, "")))) {
    const thin = panels.find((p) => !isDowel(p) && !/\bback\b/i.test(p.name) && minT(p) < 0.7 && (s.partsUsed ?? []).includes(p.name));
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
  const chip = built.project.primaryMaterialId;
  if (chip && !panels.some((p) => p.materialId === chip) && !plan.cutList.some((c) => c.material === getCatalogItem(chip)?.name)) fail.push(`the stock chip (${getCatalogItem(chip)?.name ?? chip}) is not on the cut list`);
  // (g) Parts are named, not numbered slugs ("Peg1"): a repeat is one part with a count.
  for (const p of panels) if (/[a-z]\d+$/i.test(p.name)) fail.push(`"${p.name}" is a numbered slug: one part with a count`);
  return [...new Set(fail)];
}

/**
 * The parts and hardware that define the object are in the build: every defining role is modelled (hardware on Buy),
 * a hinged lid buys its hinges and a stay, a bed that pivots buys its lift mechanism, stringers are notched,
 * a part the notes tilt is sloped, and a slatted wall is boards with air gaps.
 */
export function definingFailures(recipe: Recipe, project: { panels: { name: string; materialId: string; polygon?: unknown; size: { width: number; height: number; depth: number } }[] }, plan: { bom: { name: string }[] }): string[] {
  const fail: string[] = [];
  const roleOf = (n: string) => recipe.parts.find((q) => q.name === n || q.name === n.replace(/ \d+$/, ""))?.role ?? "";
  const of = (role: string) => project.panels.filter((p) => roleOf(p.name) === role);
  const buy = plan.bom.map((b) => b.name).join(" | ");
  for (const role of recipe.defining ?? []) {
    const parts = of(role);
    if (!parts.length) fail.push(`defining ${role}: not in the model`);
    // On Buy by its role, or folded into the Buy line of its kind ("Canvas cover" into the canvas drop cloth).
    else if (parts.every((p) => p.materialId === "hardware") && !new RegExp(role, "i").test(buy) && !parts.some((p) => dedupeBuy([...plan.bom, { name: p.name.replace(/ \d+$/, ""), quantity: 1, unit: "pcs" }] as BuildPlan["bom"]).length === plan.bom.length)) fail.push(`defining ${role}: not on Buy`);
  }
  for (const m of recipe.moving ?? []) {
    const role = roleOf(m.part);
    if (m.motion === "hinge" && !/hinge/i.test(buy)) fail.push(`${m.part} swings on hinges, but Buy has none`);
    if (m.motion === "hinge" && role === "lid" && !/\bstay\b|lid support/i.test(buy)) fail.push(`${m.part} is a hinged lid with no lid stay on Buy`);
    if (m.motion === "pivot" && role === "bed" && !/lift mechanism|murphy bed hardware/i.test(buy)) fail.push(`${m.part} pivots down with no lift mechanism on Buy`);
  }
  for (const s of of("stringer")) if (!s.polygon) fail.push(`${s.name}: a stringer drawn as a solid board, not notched for its treads`);
  const notes = recipe.notes.join(" ");
  for (const m of notes.matchAll(/\btilt (?:each|the|every) ([a-z]+?)s? (?:about |by )?\d/gi)) for (const p of of(m[1].toLowerCase())) if (!p.polygon) fail.push(`${p.name}: the notes tilt it, the model is flat`);
  if (/slatted|breathes?|airflow|air gaps?/i.test(notes)) for (const p of of("slat")) if (Math.min(...[p.size.width, p.size.height, p.size.depth].sort((a, b) => b - a).slice(0, 2)) > 8) fail.push(`${p.name}: a solid wall where the notes want slats with air gaps`);
  return fail;
}

/**
 * Walls stand on something: every upright wall or slat board has its underside on the ground, or touching the
 * top of a part under its footprint, or fixed to a part beside it that it overlaps up its height (a post, a
 * corner, the next board). A wall hanging in the air with a gap under it fails.
 */
export function floatingWalls(panels: Panel[]): string[] {
  const WALL = /\b(?:wall|slat|side|siding|panel)\b/i;
  const ground = Math.min(...panels.map((p) => p.position.y));
  const tol = 1 / 16;
  const out: string[] = [];
  const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > tol;
  for (const p of panels) {
    if (!WALL.test(p.name) || p.size.height <= Math.min(p.size.width, p.size.depth)) continue;
    const y = p.position.y;
    if (y - ground <= tol) continue;
    const foot = (q: Panel) => overlaps(p.position.x, p.position.x + p.size.width, q.position.x, q.position.x + q.size.width) && overlaps(p.position.z, p.position.z + p.size.depth, q.position.z, q.position.z + q.size.depth);
    // Beside: touching or overlapping in plan (x and z), and sharing more than a corner on one of them.
    const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
    const near = (q: Panel) => {
      const ox = ov(p.position.x, p.position.x + p.size.width, q.position.x, q.position.x + q.size.width);
      const oz = ov(p.position.z, p.position.z + p.size.depth, q.position.z, q.position.z + q.size.depth);
      return ox >= -tol && oz >= -tol && (ox > tol || oz > tol);
    };
    const sits = panels.some((q) => q !== p && foot(q) && Math.abs(q.position.y + q.size.height - y) <= tol);
    // Fastened beside a part that reaches below its underside (a post, a cleat, the board under it).
    const hung = panels.some((q) => q !== p && near(q) && q.position.y < y - tol && q.position.y + q.size.height > y + tol);
    if (!sits && !hung) out.push(`${p.name} floats ${(y - ground).toFixed(2)}" up with nothing under it`);
  }
  return out;
}

/**
 * Checks every build passes, starter recipes and typed prompts alike (not only learned recipes):
 * one Buy line per piece of hardware, the cut step counts the cut list, back-edge wording only on a build
 * with a back, no plywood treads, walls or slats outdoors, and no wall floating with a gap under it.
 */
export function buildClassFailures(project: { panels: Panel[] }, plan: BuildPlan, outdoor: boolean): string[] {
  const fail: string[] = [];
  for (const d of duplicateBuyLines(plan.bom)) fail.push(`duplicate Buy line: ${d}`);
  const sawCount = cutStepCount(plan);
  const listCount = plan.cutList.reduce((n, c) => n + c.quantity, 0);
  if (sawCount != null && sawCount !== listCount) fail.push(`the cut step cuts ${sawCount} pieces but the cut list has ${listCount}`);
  const all = plan.instructions.map((st) => `${st.title} ${st.description}`).join(" ");
  if (/back[- ]edges?/i.test(all) && !project.panels.some((p) => /\bback\b/i.test(p.name))) fail.push("back-edge wording with no back");
  if (outdoor) for (const p of project.panels) if (/^plywood/.test(p.materialId) && /\b(?:tread|riser|wall|slats?|seat|deck|step)\b/i.test(p.name)) fail.push(`${p.name} is plywood on an outdoor build`);
  fail.push(...floatingWalls(project.panels));
  return fail;
}
