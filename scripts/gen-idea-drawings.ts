/**
 * Build-time Ideas drawings: every idea card's real drawing, made once from the engine's own plan overview
 * (planOverviewSvg, the same vector path as the printed plan and the home "Made on Yard" cards), so /ideas
 * never loads the engine. One file per card; the page draws its pencil state from the same file.
 * Writes public/ideas/drawings/<slug>.<v>[.p].svg, src/lib/ideas/drawings.json (the manifest) and
 * src/lib/ideas/recipes.json (passing recipe cards, so /ideas never runs the engine).
 * Run: npx tsx scripts/gen-idea-drawings.ts   (re-run when an idea or the engine geometry changes)
 *      npx tsx scripts/gen-idea-drawings.ts --only rocket   (re-bake only the named slugs; every other entry and file stays)
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { IDEAS } from "../src/lib/yard/ideas";
import { newIdeas, popularIdeas } from "../src/lib/yard/recipeIdeas";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { planOverviewSvg } from "../src/lib/yard/planStepPicture";
import type { YardProject } from "../src/lib/yard/types";
import { drawnDims } from "../src/lib/ideas/size";
import { logCardPrompt, typeKey } from "../src/lib/ideas/liveFeed";
import { nameBase } from "./gen-idea-types";

export const DRAW_W = 480, DRAW_H = 360;
/** Raw bytes per wood drawing; past it coordinates are rounded harder (big models). */
const BUDGET = 40_000; // gzip keeps even 784-part Eiffel near 15 KB
const OUT = path.join("public", "ideas", "drawings");
const MANIFEST = path.join("src", "lib", "ideas", "drawings.json");

/**
 * Repeated paint attributes become classes in one <style> (an <img> drawing needs no per-part hooks, so the
 * data-part groups go too): about a third of the bytes on big models like the 784-part Eiffel.
 */
function compact(svg: string) {
  const classes = new Map<string, string>();
  const ATTRS = /((?: (?:fill|stroke|stroke-width|stroke-linejoin|stroke-linecap)="[^"]*")+)(?= ?\/?>)/g;
  let out = svg.replace(/<g data-part="[^"]*"[^>]*>|<\/g>/g, "");
  out = out.replace(ATTRS, (m) => {
    if (m.split('="').length - 1 < 3) return m;
    if (!classes.has(m)) classes.set(m, `c${classes.size.toString(36)}`);
    return ` class="${classes.get(m)}"`;
  });
  const css = [...classes].map(([attrs, cls]) => `.${cls}{${[...attrs.matchAll(/ ([a-z-]+)="([^"]*)"/g)].map(([, k, v]) => `${k}:${v}`).join(";")}}`).join("");
  return css ? out.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`) : out;
}
function tidy(svg: string, digits: number) {
  return compact(svg)
    .replace(/ width="\d+" height="\d+"/, "")
    .replace(/(\d+\.\d+)/g, (m) => String(Number(Number(m).toFixed(digits))))
    .replace(/<rect width="100%" height="100%" fill="[^"]+" \/>/, "");
}

/**
 * The model turned a quarter (about the vertical), so a part drawn in the zy plane (a wheel disc) is drawn
 * as an xy plate. The overview renderer extrudes every non-xz polygon along depth (pdfDraw: `thick =
 * plane === "xz" ? height : depth`), so a 3/4" water-wheel disc came out as a 22" drum. Same parts, same
 * sizes, only the view turns. Returns null when the model has parts this simple turn can't carry.
 */
export function quarterTurn(project: YardProject): YardProject | null {
  if (project.instances.length || project.panels.some((p) => p.yaw || p.polygon?.plane === "xz")) return null;
  const xMax = Math.max(...project.panels.map((p) => p.position.x + p.size.width));
  const panels = project.panels.map((p) => ({
    ...p,
    position: { x: p.position.z, y: p.position.y, z: xMax - (p.position.x + p.size.width) },
    size: { width: p.size.depth, height: p.size.height, depth: p.size.width },
    polygon: p.polygon ? { ...p.polygon, plane: p.polygon.plane === "zy" ? ("xy" as const) : ("zy" as const) } : undefined,
  }));
  return { ...project, panels };
}
/** Per-card drawing fixes (Critic, PR 60 regrade): a turned view, or extra margin for a sprawling model. */
const VIEW: Record<string, { turn?: boolean; zoom?: number; stroke?: number; ghostUnit?: boolean; custom?: (p: YardProject) => string }> = {
  "recipe-water-wheel": { turn: true },
  // The plan overview draws 25 whole sticks as a lattice (two sawhorses and a raft, PR 62 regrade):
  // this card gets a drawing of the same model's parts arranged as a catapult reads (base, A-frame, arm, cup).
  catapult: { custom: catapultSvg },
  // The build is the framing: the window unit shows as a faint outline (two sashes, meeting rail), not a slab.
  window: { ghostUnit: true },
};

/** The window unit (glass_panel) split into upper and lower sash boxes, each with an inset pane, ids marked for ghosting. */
const GHOST = "ghost-";
function sashes(project: YardProject): YardProject {
  const panels = project.panels.flatMap((p) => {
    if (p.type !== "glass_panel") return [p];
    const { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
    const half = h / 2, sd = Math.min(1.5, d / 2), inset = Math.min(2, w / 8);
    const box = (id: string, bx: number, by: number, bz: number, bw: number, bh: number, bd: number) => ({ ...p, id: `${GHOST}${id}`, position: { x: bx, y: by, z: bz }, size: { width: bw, height: bh, depth: bd } });
    return [
      box(`${p.id}-lower`, x, y, z + d - sd, w, half, sd),
      box(`${p.id}-upper`, x, y + half, z, w, half, sd),
      box(`${p.id}-lower-pane`, x + inset, y + inset, z + d - sd / 2, w - 2 * inset, half - 1.5 * inset, 0.05),
      box(`${p.id}-upper-pane`, x + inset, y + half + inset / 2, z + sd / 2, w - 2 * inset, half - 1.5 * inset, 0.05),
    ];
  });
  return { ...project, panels };
}
/** Ghost groups: no fill, a faint grey line. */
function ghosted(svg: string) {
  return svg.replace(/<g data-part="ghost-[^"]*">[\s\S]*?<\/g>/g, (g) =>
    g.replace(/fill="rgb\([^)]*\)"/g, 'fill="none"').replace(/stroke="rgb\([^)]*\)"/g, 'stroke="rgb(160,150,138)"').replace(/stroke-width="[\d.]+"/g, 'stroke-width="0.5"'),
  );
}

/**
 * The catapult card: the popsicle-stick catapult as a builder sketches it, sized from the model's
 * overall box (8.7 × 4.6 × 4.5): a two-rail base with cross sticks, an A-frame each side with an axle
 * across the top, the throwing arm resting on the axle, and a cup at its raised end. Sticks are the
 * same two-tone strokes the plan overview gives stick builds, drawn back to front.
 */
function catapultSvg(p: YardProject): string {
  const L = p.overall.width, H = p.overall.height, D = p.overall.depth;
  const hx = L / 2, hz = D / 2 - 0.3;
  type P3 = [number, number, number];
  const sticks: [P3, P3][] = [
    [[-hx, 0.15, -hz], [hx, 0.15, -hz]], [[-hx, 0.15, hz], [hx, 0.15, hz]],
    [[-hx + 0.4, 0.4, -hz - 0.3], [-hx + 0.4, 0.4, hz + 0.3]], [[0.6, 0.4, -hz - 0.3], [0.6, 0.4, hz + 0.3]], [[hx - 0.4, 0.4, -hz - 0.3], [hx - 0.4, 0.4, hz + 0.3]],
  ];
  const ax = 0.6, ay = H * 0.72;
  for (const z of [-hz, hz]) sticks.push([[ax - 1.7, 0.5, z], [ax, ay + 0.4, z]], [[ax + 1.7, 0.5, z], [ax, ay + 0.4, z]]);
  sticks.push([[ax, ay, -hz - 0.4], [ax, ay, hz + 0.4]]); // axle
  // Arm: rests on the axle; its raised front end holds the cup.
  const tip: P3 = [-hx + 1.0, H - 0.15, 0];
  const bx = hx - 0.6, t = (ax - tip[0]) / (bx - tip[0]);
  const by = Math.max(0.6, tip[1] + (ay + 0.3 - tip[1]) / t);
  const back: P3 = [bx, by, 0];
  sticks.push([back, tip]);
  // Cabinet view: the side profile (base, A-frame triangle, rising arm) true, depth receding up-right.
  const proj = ([x, y, z]: P3) => [x + z * 0.42, -y - z * 0.3] as const;
  const cupR = 0.9;
  const all: (readonly [number, number])[] = sticks.flat().map(proj);
  const tp = proj(tip);
  all.push([tp[0] - cupR * 1.4, tp[1] - cupR * 1.2], [tp[0] + cupR * 1.4, tp[1] + cupR]);
  const xs = all.map((q) => q[0]), ys = all.map((q) => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = Math.min((DRAW_W - 80) / (maxX - minX), (DRAW_H - 70) / (maxY - minY));
  const ox = (DRAW_W - (maxX - minX) * k) / 2 - minX * k, oy = (DRAW_H - (maxY - minY) * k) / 2 - minY * k;
  const f = (n: number) => n.toFixed(1);
  const xy = (q: P3) => { const [a, b] = proj(q); return [ox + a * k, oy + b * k]; };
  const depthOf = ([a, b]: [P3, P3]) => (a[2] + b[2]) / 2 + (a[1] + b[1]) * 0.001;
  const order = [...sticks].sort((u, v) => depthOf(v) - depthOf(u));
  const line = ([a, b]: [P3, P3], cls: string) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}"/>`; };
  const sw = Math.max(4, k * 0.38);
  const [cx, cy] = xy(tip);
  const r = cupR * k;
  const cup = `<path d="M ${f(cx - r)} ${f(cy - r * 0.35)} A ${f(r)} ${f(r * 0.9)} 0 0 0 ${f(cx + r)} ${f(cy - r * 0.35)} Z" class="cup"/><ellipse cx="${f(cx)}" cy="${f(cy - r * 0.35)}" rx="${f(r)}" ry="${f(r * 0.32)}" class="cupt"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DRAW_W} ${DRAW_H}"><style>.o{fill:none;stroke:rgb(120,96,66);stroke-width:${f(sw + 1.4)};stroke-linecap:round}.w{fill:none;stroke:rgb(228,206,168);stroke-width:${f(sw)};stroke-linecap:round}.cup{fill:rgb(217,197,161);stroke:rgb(120,96,66);stroke-width:1.4}.cupt{fill:rgb(186,169,139);stroke:rgb(120,96,66);stroke-width:1.2}</style><rect x="0" y="0" width="${DRAW_W}" height="${DRAW_H}" rx="6" ry="6" fill="rgb(247,244,238)" stroke="none" />${order.map((st) => line(st, "o") + line(st, "w")).join("")}${cup}</svg>`;
}
/** Thinner stick strokes (craft builds drawn as lines): every stroke-width in the drawing's classes scales. */
function thinner(svg: string, k: number) {
  return svg.replace(/stroke-width:([\d.]+)/g, (_, w) => `stroke-width:${Number((Number(w) * k).toFixed(2))}`);
}
function zoomed(svg: string, k: number) {
  const cx = DRAW_W / 2, cy = DRAW_H / 2;
  return svg.replace(/(<rect x="0" y="0" width="\d+" height="\d+"[^>]*\/>)/, `$1<g transform="translate(${cx * (1 - k)} ${cy * (1 - k)}) scale(${k})">`).replace(/<\/svg>$/, "</g></svg>");
}

/**
 * Log-only build types (no curated card): the feed draws them by type key (drawingForType), so each is baked under its
 * type from the prompt the card builds on tap (logCardPrompt: logPrompts.json, else the type at its logged size).
 * Not baked (judged by eye, 10-26): soccer-goal (a bare box frame), brooklyn-bridge (no towers above the deck),
 * windmill (broken sails), barn (a braced crate, no roof), empire-state-building (a cone, no setbacks), space-needle
 * (straight tapered legs, no waist), firewood-unit (builds a firewood-rack); dollhouse, toolbox, bike rack, White House,
 * mailbox post and sailboat still build wrong.
 */
export const LOG_TYPES: Record<string, string> = {
  rocket: logCardPrompt("rocket", { width: 9.875, depth: 9.875, height: 28 }),
  ...Object.fromEntries(["lighthouse", "cat-tree", "viking-ship"].map((t) => [t, logCardPrompt(t, null)])),
};

const cards = [
  ...IDEAS.map((d) => ({ slug: d.id, prompt: d.prompt })),
  ...[...popularIdeas(), ...newIdeas()].map((r) => ({ slug: r.id, prompt: r.prompt })),
  ...Object.entries(LOG_TYPES).map(([slug, prompt]) => ({ slug, prompt, log: true })),
];
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
const seen = new Set<string>();
/** Hero models: panel boxes only (no engine on /ideas), for builds light enough to turn live on a phone. */
export const HERO_MAX_PARTS = 150;
const MODELS = path.join("public", "ideas", "models");
/** `stock`: the build's own primary stock id (the feed reads no price, shop or href from here). */
type Entry = { v: string; w: number; h: number; parts: number; bytes: number; dims: { width: number; height: number; depth: number; round?: true }; model?: string; stock?: string };
const manifest: Record<string, Entry> = only ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
if (only) {
  for (const slug of only) {
    const old = manifest[slug];
    if (old) fs.rmSync(path.join(OUT, `${slug}.${old.v}.svg`), { force: true });
    if (old?.model) fs.rmSync(path.join("public", old.model), { force: true });
    delete manifest[slug];
  }
} else {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(MODELS, { recursive: true, force: true });
  fs.mkdirSync(MODELS, { recursive: true });
}
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Card dims keep the drawing's 1/16″ labels exact (6 5/16 = 6.3125; r2 made it 6.31, which printed as 6 1/4). */
const r4 = (n: number) => Math.round(n * 10000) / 10000;
for (const c of cards) {
  if (seen.has(c.slug) || (only && !only.has(c.slug))) continue;
  seen.add(c.slug);
  const view = VIEW[c.slug] ?? {};
  const built = generateFromPrompt(c.prompt);
  // A log type's drawing must be that type's own build: a refusal, stand-in or other type stops the bake.
  if ("log" in c && (built.refused || built.standIn || built.unmatched || built.displayOnly || typeKey(`builtin:${nameBase(built.name)}`) !== c.slug)) {
    throw new Error(`${c.slug}: "${c.prompt}" builds ${built.name}${built.refused ? ` (refused: ${built.refused})` : ""}, not a ${c.slug}`);
  }
  const project = (view.turn && quarterTurn(built)) || built;
  const drawn = view.ghostUnit ? sashes(project) : project;
  const raw = planOverviewSvg(drawn, DRAW_W, DRAW_H).svg;
  const post = (x: string) => (view.ghostUnit ? ghosted(x) : x);
  let svg = view.custom ? view.custom(project) : tidy(post(raw), 1);
  if (!view.custom && svg.length > BUDGET) svg = tidy(post(raw), 0);
  if (view.stroke) svg = thinner(svg, view.stroke);
  if (view.zoom) svg = zoomed(svg, view.zoom);
  const v = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 8);
  fs.writeFileSync(path.join(OUT, `${c.slug}.${v}.svg`), svg);
  const parts = built.panels.length + built.instances.length;
  // The size the card claims must be the size the drawing shows: its own labels, else the model's box.
  const labelled = !view.custom ? drawnDims(raw) : null;
  // A quarter-turned drawing labels the model's depth across: the card still says W × D in the model's own axes.
  const o = labelled && project !== built ? { ...labelled, width: labelled.depth, depth: labelled.width } : labelled || project.overall;
  manifest[c.slug] = { v, w: DRAW_W, h: DRAW_H, parts, bytes: svg.length, dims: { width: r4(o.width), height: r4(o.height), depth: r4(o.depth), ...("round" in o && o.round ? { round: true as const } : {}) }, stock: built.primaryMaterialId };
  if (parts <= HERO_MAX_PARTS && !built.instances.length && !built.panels.some((p) => p.form || p.strut || p.outline)) {
    const model = JSON.stringify({
      overall: built.overall,
      panels: built.panels.map((p) => ({
        p: [r2(p.position.x), r2(p.position.y), r2(p.position.z)],
        s: [r2(p.size.width), r2(p.size.height), r2(p.size.depth)],
        ...(p.yaw ? { yaw: r2(p.yaw) } : {}),
        ...(p.polygon ? { poly: { plane: p.polygon.plane, pts: p.polygon.pts.map(([a, b]) => [r2(a), r2(b)]), ...(p.polygon.holes?.length ? { holes: p.polygon.holes.map((q) => [r2(q.x), r2(q.y), r2(q.r)]) } : {}) } } : {}),
        ...(p.type === "glass_panel" || p.type === "mirror" ? { glass: 1 } : {}),
      })),
    });
    const mv = crypto.createHash("sha1").update(model).digest("hex").slice(0, 8);
    fs.writeFileSync(path.join(MODELS, `${c.slug}.${mv}.json`), model);
    manifest[c.slug].model = `/ideas/models/${c.slug}.${mv}.json`;
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
// Recipe cards baked too, so /ideas never builds a recipe in the browser (a full bake only).
const card = (r: ReturnType<typeof popularIdeas>[number]) => ({ id: r.id, label: r.label, prompt: r.prompt, size: r.size, blurb: r.blurb, box: r.box });
if (!only) fs.writeFileSync(path.join("src", "lib", "ideas", "recipes.json"), JSON.stringify({ popular: popularIdeas().map(card), fresh: newIdeas().map(card) }, null, 1) + "\n");
const sizes = Object.values(manifest).map((m) => m.bytes).sort((a, b) => b - a);
console.log(`ideas drawings: ${sizes.length} cards, largest ${sizes[0]} B, median ${sizes[sizes.length >> 1]} B`);
