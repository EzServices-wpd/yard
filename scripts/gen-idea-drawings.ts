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

const cards = [
  ...IDEAS.map((d) => ({ slug: d.id, prompt: d.prompt })),
  ...[...popularIdeas(), ...newIdeas()].map((r) => ({ slug: r.id, prompt: r.prompt })),
];
const seen = new Set<string>();
const manifest: Record<string, { v: string; w: number; h: number; parts: number; bytes: number }> = {};
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const c of cards) {
  if (seen.has(c.slug)) continue;
  seen.add(c.slug);
  const project = generateFromPrompt(c.prompt);
  let svg = tidy(planOverviewSvg(project, DRAW_W, DRAW_H).svg, 1);
  if (svg.length > BUDGET) svg = tidy(planOverviewSvg(project, DRAW_W, DRAW_H).svg, 0);
  const v = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 8);
  fs.writeFileSync(path.join(OUT, `${c.slug}.${v}.svg`), svg);
  manifest[c.slug] = { v, w: DRAW_W, h: DRAW_H, parts: project.panels.length + project.instances.length, bytes: svg.length };
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
// Recipe cards baked too, so /ideas never builds a recipe in the browser.
const card = (r: ReturnType<typeof popularIdeas>[number]) => ({ id: r.id, label: r.label, prompt: r.prompt, size: r.size, blurb: r.blurb, box: r.box });
fs.writeFileSync(path.join("src", "lib", "ideas", "recipes.json"), JSON.stringify({ popular: popularIdeas().map(card), fresh: newIdeas().map(card) }, null, 1) + "\n");
const sizes = Object.values(manifest).map((m) => m.bytes).sort((a, b) => b - a);
console.log(`ideas drawings: ${sizes.length} cards, largest ${sizes[0]} B, median ${sizes[sizes.length >> 1]} B`);
