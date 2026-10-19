/**
 * One size, one rounding (holes-size PR). Every surface that prints a build's overall size (the Ideas card, the
 * workspace/PDF header, the logged "made N×" card, the full-view step pictures and the drawings) prints the same
 * W × D × H through the one shop formatter (inchText, nearest 1/16). Before, the water wheel read 18 × 25 × 31 on
 * its log card (whole inches), 24 5/8 × 31 1/4 in the header (overall rounded up to 1/8) and 24 9/16 × 31 1/8 on
 * the drawings (the true 24.58 × 31.14).
 *
 * A typed axis is the size said back (the linen closet's 16″ with doors standing proud is a note): it may differ
 * from the drawn model, and is listed, never a failure. EXCEPTIONS are drawn/header differences waiting on a call.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { planOverviewSvg, planStepSvg } from "../src/lib/yard/planStepPicture";
import { isoSvgString } from "../src/lib/yard/iso";
import { headerTitle } from "../src/lib/yard/pdf";
import { headerSize, typedAxesTalk } from "../src/lib/yard/headerSize";
import { inchFrac } from "../src/lib/yard/inchText";
import { recordFromPrompt } from "../src/lib/yard/ideaLog.server";
import { drawnDims, formatSize, inch } from "../src/lib/ideas/size";
import { dimsOf } from "../src/lib/ideas/liveFeed";
import { IDEAS } from "../src/lib/yard/ideas";
import { recipeIdeas } from "../src/lib/yard/recipeIdeas";
import { DREAMS } from "../src/lib/yard/promptDreams";
import { PLANS } from "../src/lib/yard/plans";

/** A wall-hung build's header height is its top above the floor; the drawing measures the slab. Chief's call. */
const EXCEPTIONS: Record<string, string> = { "floating desk": "height" };
/** The engine's own "Assumed N tall" note disagrees with the model it built (overall 18, model 19 1/4): engine layout. */
const NOTE_KNOWN: Record<string, string> = {
  "wall shelf for jars 24 wide": "height",
  // Pre-existing: an assumed depth with proud drawer fronts heads as the finished 16 3/4; the note says the 16 box.
  "nightstand 18 wide": "depth",
};

/**
 * Pre-existing (also at release): the 3D view labels project.overall, the header the drawn extent, and these builds'
 * overall is not their drawn extent (proud fronts outside the box; stick builds' overall is to the stick centres; the jar
 * shelf's engine layout as in NOTE_KNOWN). Pinned so the list can only shrink; the water wheel is not on it.
 */
const ISO_KNOWN = new Set([
  "wall shelf for jars 24 wide: 3D height 18 vs header 19 1/4",
  "kitchen base cabinet 24 wide: 3D depth 24 vs header 24 3/4",
  "nightstand 18 wide: 3D depth 16 vs header 16 3/4",
  "catapult from popsicle sticks: 3D width 8 9/16 vs header 8 11/16",
  "catapult from popsicle sticks: 3D height 4 1/2 vs header 4 5/8",
  "dog from popsicle sticks: 3D width 26 7/8 vs header 27 3/16",
  "dog from popsicle sticks: 3D depth 5 1/8 vs header 5 1/2",
  "dog from popsicle sticks: 3D height 21 9/16 vs header 21 11/16",
  "picture frame from bamboo skewers: 3D height 11 9/16 vs header 11 5/8",
]);

const DR = JSON.parse(fs.readFileSync("src/lib/ideas/drawings.json", "utf8")) as Record<string, { dims?: { width: number; height: number; depth: number; round?: boolean } }>;
const CARDS = JSON.parse(fs.readFileSync("src/lib/ideas/recipes.json", "utf8")) as { popular: { id: string; size: string }[]; fresh: { id: string; size: string }[] };
const corpus = new Map<string, string | null>([["linen closet 31.5 wide 78 tall 16 deep", null], ["water wheel", null], ["floating desk", null]]);
for (const d of DREAMS) corpus.set(d.prompt, null);
for (const p of PLANS as { prompt?: string; name: string }[]) corpus.set(p.prompt ?? p.name, null);
for (const d of IDEAS) corpus.set(d.prompt, d.id);
const recipes = recipeIdeas();
for (const r of recipes) corpus.set(r.prompt, r.id);

const AX = ["width", "depth", "height"] as const;
const f3 = (d: { width: number; depth: number; height: number }) => AX.map((a) => inchFrac(d[a])).join(" × ");
const headerAxes = (h: string) => {
  const m = [...h.matchAll(/(\d+(?: \d+\/\d+)?|\d+\/\d+)" ([WDH])\b/g)];
  return ["W", "D", "H"].map((l) => m.find((x) => x[2] === l)?.[1] ?? "?").join(" × ");
};
const near = (a: { width: number; depth: number; height: number }, b: { width: number; depth: number; height: number }) => AX.every((k) => Math.abs(a[k] - b[k]) <= 1);

type Row = { prompt: string; slug: string | null; header: string; drawn: string | null; iso: string[]; round: boolean; steps: string[]; unitText: string | null; notes: Partial<Record<(typeof AX)[number], string>>; assumed: Partial<Record<(typeof AX)[number], boolean>>; size: { width: number; depth: number; height: number } };
const rows: Row[] = [];
for (const [prompt, slug] of corpus) {
  const p = generateFromPrompt(prompt);
  const plan = buildPlan(p);
  const ov = drawnDims(planOverviewSvg(p, 480, 360).svg);
  const steps: string[] = [];
  plan.instructions.forEach((_, i) => {
    const d = drawnDims(planStepSvg(p, plan, i).svg);
    if (d && !d.round && ov && !ov.round && near(d, ov)) steps.push(f3(d)); // a full view (not a sub-assembly)
  });
  // Step 1 says the size in words: "Unit 18" wide × 23 7/16" deep × 30 1/4" high".
  const m = plan.instructions.map((s) => s.description).join(" ").match(/Unit ([\d\s/]+)" wide × ([\d\s/]+)" deep × ([\d\s/]+)" high/);
  const notes: Row["notes"] = {};
  for (const n of plan.instructions.map((s) => s.description).join(" ").matchAll(/Assumed ([\d\s/]+)" (wide|tall|deep) \(default size\)/g)) notes[n[2] === "wide" ? "width" : n[2] === "tall" ? "height" : "depth"] = n[1].trim();
  // The 3D view's W, H and D labels and its "W × H × D" caption, as printed.
  const iso = [...isoSvgString(p).matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1].replace(/&quot;|″/g, '"'));
  rows.push({ prompt, slug, notes, iso, header: headerTitle(p), drawn: ov && !ov.round ? f3(ov) : null, round: !!ov?.round, steps, unitText: m ? `${m[1].trim()} × ${m[2].trim()} × ${m[3].trim()}` : null, assumed: typedAxesTalk(p).assumed, size: headerSize(p) });
}

test("canaries: linen says its typed 31 1/2 × 16 × 78; the water wheel says its true 18 × 23 7/16 × 30 1/4 (#85's rotors wheel, 23.458 × 30.229)", () => {
  const linen = rows.find((r) => r.prompt.startsWith("linen"))!;
  assert.match(linen.header, /31 1\/2" W × 16" D × 78" H/);
  const ww = rows.find((r) => r.prompt === "water wheel")!;
  assert.match(ww.header, /18" W × 23 7\/16" D × 30 1\/4" H/);
  assert.equal(formatSize(ww.size).text, "18 × 23 7/16 × 30 1/4 in");
});

test("header = drawings on every assumed axis, for every build and idea (typed axes are said back)", () => {
  const bad: string[] = [];
  const said: string[] = [];
  for (const r of rows) {
    if (!r.drawn) continue;
    const h = headerAxes(r.header).split(" × "), d = r.drawn.split(" × ");
    AX.forEach((a, k) => {
      if (h[k] === d[k] || EXCEPTIONS[r.prompt] === a) return;
      (r.assumed[a] ? bad : said).push(`${r.prompt}: ${a} header ${h[k]} vs drawn ${d[k]}`);
    });
  }
  assert.deepEqual(bad, []);
  // Typed sizes said back stay few and known (proud doors/fronts, a pocket unit, a rough opening, a typed height).
  assert.ok(said.length <= 12, said.join("\n"));
});

test("the 3D view's dimension labels are its caption, and the header's on every assumed axis (no 23.5\" beside 23 7/16\")", () => {
  const bad: string[] = [];
  let n = 0;
  for (const r of rows) {
    // A plain W × H × D caption ("784 sticks · " or "Headboard · " before it, " assumed" after it, are words, not sizes).
    const cap = r.iso.find((t) => t.includes(" × "));
    const m = cap?.match(/^(?:[^·]+ · )?([\d /]+)" × ([\d /]+)" × ([\d /]+)"(?: assumed)?$/);
    if (!cap || !m) continue;
    const [w, ht, d] = [m[1], m[2], m[3]];
    const labels = r.iso.filter((t) => t !== cap).map((x) => x.replace(/"$/, ""));
    if (labels.length !== 3) continue; // a flat panel's 3D view labels two axes
    if (labels.join(" | ") !== [w, ht, d].join(" | ")) bad.push(`${r.prompt}: labels ${labels.join(", ")} vs caption ${cap}`);
    const h = headerAxes(r.header).split(" × ");
    const isoAx = { width: w, depth: d, height: ht };
    AX.forEach((a, k) => {
      const msg = `${r.prompt}: 3D ${a} ${isoAx[a]} vs header ${h[k]}`;
      if (r.assumed[a] && EXCEPTIONS[r.prompt] !== a && isoAx[a] !== h[k] && !ISO_KNOWN.has(msg)) bad.push(msg);
    });
    if (r.prompt === "water wheel") assert.equal(`${w} × ${d} × ${ht}`, headerAxes(r.header), "water wheel 3D view vs title");
    n++;
  }
  assert.deepEqual(bad, []);
  assert.ok(n >= 40, `only ${n} 3D views checked`);
});

test("full-view step pictures label exactly what the overview labels", () => {
  for (const r of rows) for (const s of r.steps) assert.equal(s, r.drawn, `${r.prompt}: step ${s} vs overview ${r.drawn}`);
});

test("step 1's size in words is the header's on every assumed axis", () => {
  let n = 0;
  for (const r of rows) {
    if (!r.unitText) continue;
    const t = r.unitText.split(" × "), h = headerAxes(r.header).split(" × ");
    AX.forEach((a, k) => { if (r.assumed[a] && EXCEPTIONS[r.prompt] !== a) assert.equal(t[k], h[k], `${r.prompt}: step 1 "${r.unitText}" vs header ${r.header}`); });
    n++;
  }
  assert.ok(n >= 10, `only ${n} step-1 sizes checked`);
});

test("the steps' \"Assumed N (default size)\" notes name the header's number", () => {
  const bad: string[] = [];
  for (const r of rows) {
    const h = headerAxes(r.header).split(" × ");
    AX.forEach((a, k) => { const v = r.notes[a]; if (v && r.assumed[a] && v !== h[k] && NOTE_KNOWN[r.prompt] !== a && EXCEPTIONS[r.prompt] !== a) bad.push(`${r.prompt}: assumed ${a} ${v} vs header ${h[k]}`); });
  }
  assert.deepEqual(bad, []);
});

test("Ideas cards print the drawing's size, in the model's own W × D × H (a turned drawing is turned back)", () => {
  let n = 0;
  for (const r of rows) {
    if (!r.slug || !DR[r.slug]?.dims || !r.drawn || EXCEPTIONS[r.prompt]) continue;
    const card = formatSize(DR[r.slug].dims!).text;
    // Typed axes said back may differ from the drawing; every other axis of the card is the header's.
    const c = card.replace(/ in$/, "").split(" × "), h = headerAxes(r.header).split(" × ");
    AX.forEach((a, k) => { if (r.assumed[a]) assert.equal(c[k], h[k], `${r.prompt}: card ${card} vs header ${r.header}`); });
    assert.equal(card.replace(/ in$/, ""), r.drawn, `${r.prompt}: card ${card} vs drawing ${r.drawn}`);
    n++;
  }
  assert.ok(n >= 40, `only ${n} cards checked`);
});

test("recipe card manifest (ideas/recipes.json) is fresh and says the header's size", () => {
  const built = new Map(recipes.map((r) => [r.id, r.size]));
  for (const c of [...CARDS.popular, ...CARDS.fresh]) {
    assert.equal(c.size, built.get(c.id), `${c.id}: stale manifest size (re-run scripts/gen-idea-drawings.ts)`);
    const r = rows.find((x) => x.slug === c.id)!;
    assert.equal(c.size.replace(/″/g, '"'), `${inchFrac(r.size.width)}" W × ${inchFrac(r.size.depth)}" D × ${inchFrac(r.size.height)}" H`);
  }
});

test("the logged size (made N× card) is the header's, to the same 1/16", async () => {
  for (const r of rows.slice(0, 80)) {
    const rec = await recordFromPrompt(r.prompt);
    if (!rec?.size) continue;
    assert.equal(formatSize(dimsOf(rec.size)).text, formatSize(r.size).text, `${r.prompt}: logged ${rec.size}`);
  }
});

test("one formatter: card inch() and the header both round to the nearest 1/16", () => {
  for (const n of [24.58, 31.14, 31.5, 16.75, 0.75, 3.41, 18, 23.4579, 30.229]) assert.equal(inch(n), inchFrac(n));
  // #85's wheel is 23.458 deep: the drawing's 23 7/16 is the truth, so the title says 23 7/16 too (not a 1/4-rounded 23 1/2).
  assert.equal(inch(23.4579), "23 7/16");
  assert.equal(inch(30.229), "30 1/4");
  assert.equal(inch(24.58), "24 9/16");
  assert.equal(inch(31.14), "31 1/8");
});

test("headerSize class: an assumed height is the unit's own, never a wall-hung mirror above it (vanity seed, Critic #93)", async () => {
  const { headerSize, isWallAccessoryAbove } = await import("../src/lib/yard/headerSize.ts");
  for (const q of ["30 inch vanity", "bathroom vanity", "vanity with mirror", "bathroom vanity 30 wide"]) {
    const p = generateFromPrompt(q);
    assert.ok(p.panels.some((x) => isWallAccessoryAbove(x, p.overall.height)), `${q}: seed has a mirror over the top`);
    assert.equal(headerSize(p).height, p.overall.height, `${q}: header height is the vanity's ${p.overall.height}, not the mirror's top`);
  }
  // The rule never trims the build itself: a mirror frame or a chair's back still counts.
  assert.equal(headerSize(generateFromPrompt("mirror frame 24 wide")).height, generateFromPrompt("mirror frame 24 wide").overall.height);
  assert.ok(headerSize(generateFromPrompt("rocking chair")).height > 30, "a chair's back is the chair");
});
