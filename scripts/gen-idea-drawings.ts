/**
 * Build-time Ideas drawings: every idea card's real drawing, made once from the engine's own plan overview
 * (planOverviewSvg, the same vector path as the printed plan and the home "Made on Yard" cards), so /ideas
 * never loads the engine. One file per card; the page draws its pencil state from the same file.
 * Writes public/ideas/drawings/<slug>.<v>[.p].svg, src/lib/ideas/drawings.json (the manifest) and
 * src/lib/ideas/recipes.json (passing recipe cards, so /ideas never runs the engine).
 * Run: npx tsx scripts/gen-idea-drawings.ts   (re-run when an idea or the engine geometry changes)
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { IDEAS } from "../src/lib/yard/ideas";
import { newIdeas, popularIdeas } from "../src/lib/yard/recipeIdeas";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { planOverviewSvg } from "../src/lib/yard/planStepPicture";
import type { YardProject } from "../src/lib/yard/types";

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
const VIEW: Record<string, { turn?: boolean; zoom?: number }> = {
  "recipe-water-wheel": { turn: true },
  catapult: { zoom: 0.8 },
};
function zoomed(svg: string, k: number) {
  const cx = DRAW_W / 2, cy = DRAW_H / 2;
  return svg.replace(/(<rect x="0" y="0" width="\d+" height="\d+"[^>]*\/>)/, `$1<g transform="translate(${cx * (1 - k)} ${cy * (1 - k)}) scale(${k})">`).replace(/<\/svg>$/, "</g></svg>");
}

const cards = [
  ...IDEAS.map((d) => ({ slug: d.id, prompt: d.prompt })),
  ...[...popularIdeas(), ...newIdeas()].map((r) => ({ slug: r.id, prompt: r.prompt })),
];
const seen = new Set<string>();
/** Hero models: panel boxes only (no engine on /ideas), for builds light enough to turn live on a phone. */
export const HERO_MAX_PARTS = 150;
const MODELS = path.join("public", "ideas", "models");
const manifest: Record<string, { v: string; w: number; h: number; parts: number; bytes: number; model?: string }> = {};
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(MODELS, { recursive: true, force: true });
fs.mkdirSync(MODELS, { recursive: true });
const r2 = (n: number) => Math.round(n * 100) / 100;
for (const c of cards) {
  if (seen.has(c.slug)) continue;
  seen.add(c.slug);
  const view = VIEW[c.slug] ?? {};
  const built = generateFromPrompt(c.prompt);
  const project = (view.turn && quarterTurn(built)) || built;
  let svg = tidy(planOverviewSvg(project, DRAW_W, DRAW_H).svg, 1);
  if (svg.length > BUDGET) svg = tidy(planOverviewSvg(project, DRAW_W, DRAW_H).svg, 0);
  if (view.zoom) svg = zoomed(svg, view.zoom);
  const v = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 8);
  fs.writeFileSync(path.join(OUT, `${c.slug}.${v}.svg`), svg);
  const parts = built.panels.length + built.instances.length;
  manifest[c.slug] = { v, w: DRAW_W, h: DRAW_H, parts, bytes: svg.length };
  if (parts <= HERO_MAX_PARTS && !built.instances.length && !built.panels.some((p) => p.form || p.strut || p.outline)) {
    const model = JSON.stringify({
      overall: built.overall,
      panels: built.panels.map((p) => ({
        p: [r2(p.position.x), r2(p.position.y), r2(p.position.z)],
        s: [r2(p.size.width), r2(p.size.height), r2(p.size.depth)],
        ...(p.yaw ? { yaw: r2(p.yaw) } : {}),
        ...(p.polygon ? { poly: { plane: p.polygon.plane, pts: p.polygon.pts.map(([a, b]) => [r2(a), r2(b)]) } } : {}),
        ...(p.type === "glass_panel" || p.type === "mirror" ? { glass: 1 } : {}),
      })),
    });
    const mv = crypto.createHash("sha1").update(model).digest("hex").slice(0, 8);
    fs.writeFileSync(path.join(MODELS, `${c.slug}.${mv}.json`), model);
    manifest[c.slug].model = `/ideas/models/${c.slug}.${mv}.json`;
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
// Recipe cards baked too, so /ideas never builds a recipe in the browser.
const card = (r: ReturnType<typeof popularIdeas>[number]) => ({ id: r.id, label: r.label, prompt: r.prompt, size: r.size, blurb: r.blurb, box: r.box });
fs.writeFileSync(path.join("src", "lib", "ideas", "recipes.json"), JSON.stringify({ popular: popularIdeas().map(card), fresh: newIdeas().map(card) }, null, 1) + "\n");
const sizes = Object.values(manifest).map((m) => m.bytes).sort((a, b) => b - a);
console.log(`ideas drawings: ${sizes.length} cards, largest ${sizes[0]} B, median ${sizes[sizes.length >> 1]} B`);
