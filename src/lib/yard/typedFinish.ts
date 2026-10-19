/**
 * C18 (typed finish or colour): "black bookshelf", "white toy box", "painted bench", "stained nightstand".
 * The typed finish is the colour the model renders in (panelRenderLook) and a real paint or stain row on Buy,
 * sized from the cut pieces' surface area, with one plain step that applies it. Species words are not colours:
 * black walnut, white oak, red oak, red cedar, white pine stay wood. Pure: no AI, no network.
 */
import type { AssemblyStep, BuildPlan, YardProject } from "./types";
import { checkedRow, type Checked } from "./checkedStock";

export type TypedFinish = { key: string; word: string; kind: "paint" | "stain"; tone: string; product: Checked; coverageSqFt: number; coats: number };

const CHECK_AT = "2026-10-17";
/** Rust-Oleum Painter's Touch Ultra Cover, 1 qt brush-on (wood, indoor/outdoor), covers up to 120 sq ft. */
const PAINT = (color: string, href: string, price = 16.98): Checked => ({
  name: `Rust-Oleum Painter's Touch Ultra Cover paint, ${color}, 1 quart`,
  title: `Rust-Oleum Painter's Touch 32 oz. Ultra Cover ${color} General Purpose Paint`,
  href, packQty: 1, packPrice: price,
});
const HD_PAINT = (q: string) => `https://www.homedepot.com/s/${encodeURIComponent(`Rust-Oleum Painter's Touch Ultra Cover ${q} 32 oz`)}`;
/** Minwax Wood Finish oil-based interior stain, 1 qt (500–600 sq ft/gal → 125 sq ft per quart, one coat). */
const STAIN = (color: string, href: string, price = 13.98): Checked => ({
  name: `Minwax Wood Finish stain, ${color}, 1 quart`,
  title: `Minwax 1 qt. Wood Finish ${color} Oil-Based Interior Stain`,
  href, packQty: 1, packPrice: price,
});
const DARK_WALNUT = STAIN("Dark Walnut", "https://www.homedepot.com/p/Minwax-1-Qt-Oil-Based-Dark-Walnut-Wood-Finish-Interior-Stain-70012/100376185");
const EBONY = STAIN("Ebony", "https://www.homedepot.com/p/Minwax-1-qt-Wood-Finish-Ebony-Oil-Based-Interior-Stain-70013444/100204711");

const paint = (key: string, word: string, tone: string, product: Checked): TypedFinish => ({ key, word, kind: "paint", tone, product, coverageSqFt: 120, coats: 2 });
const stain = (key: string, word: string, tone: string, product: Checked): TypedFinish => ({ key, word, kind: "stain", tone, product, coverageSqFt: 125, coats: 1 });

const BLACK = paint("black", "black", "#1f1f1f", PAINT("Gloss Black", "https://www.homedepot.com/p/Rust-Oleum-Painter-s-Touch-32-oz-Ultra-Cover-Gloss-Black-General-Purpose-Paint-1979502/100139731"));
const WHITE = paint("white", "white", "#f1efe9", PAINT("Semi-Gloss White", "https://www.homedepot.com/p/Rust-Oleum-Painter-s-Touch-32-oz-Ultra-Cover-Semi-Gloss-White-General-Purpose-Paint-1993502/100204833"));
const COLOURS: Record<string, TypedFinish> = {
  black: BLACK, white: WHITE,
  gray: paint("gray", "gray", "#8d8f8c", PAINT("Satin Stone Gray", HD_PAINT("Satin Stone Gray"))),
  grey: paint("gray", "grey", "#8d8f8c", PAINT("Satin Stone Gray", HD_PAINT("Satin Stone Gray"))),
  red: paint("red", "red", "#a8322d", PAINT("Gloss Apple Red", HD_PAINT("Gloss Apple Red"))),
  green: paint("green", "green", "#3f5a3a", PAINT("Satin Hunt Club Green", HD_PAINT("Satin Hunt Club Green"))),
  blue: paint("blue", "blue", "#2f4f7a", PAINT("Gloss Deep Blue", HD_PAINT("Gloss Deep Blue"))),
  navy: paint("navy", "navy", "#24324d", PAINT("Gloss Navy Blue", HD_PAINT("Gloss Navy Blue"))),
};

/** Words that make a colour a species, a metal or a writing board, never a finish. */
const NOT_FINISH = /^(?:walnut|oak|pine|cedar|cherry|ash|maple|birch|alder|spruce|fir|poplar|iron|pipe|metal|steel|glass|marble|wire|board|noise|light|out|wash)\b/;

/** The finish the prompt types, or null. */
export function typedFinish(prompt: string | undefined | null): TypedFinish | null {
  const p = (prompt ?? "").toLowerCase();
  // "stained black", "ebony stain", "espresso stain" → ebony; "stained" / "dark stain" / "walnut stain" → dark walnut.
  if (/\b(?:stained|stain)\b/.test(p)) {
    return /\b(?:black|ebony|espresso)\b/.test(p) ? stain("ebony", "stained", "#3a2a20", EBONY) : stain("dark-walnut", "stained", "#5a3d26", DARK_WALNUT);
  }
  for (const m of p.matchAll(/\b(black|white|gr[ae]y|red|green|blue|navy)\b(?:\s+(\w+))?/g)) {
    if (m[2] && NOT_FINISH.test(m[2])) continue;
    return COLOURS[m[1]];
  }
  if (/\bpainted\b|\bpaint it\b/.test(p)) return WHITE;
  return null;
}

/** Sq ft of every face of every cut piece (whole bought items are not painted). */
export function paintedSqFt(plan: Pick<BuildPlan, "cutList">): number {
  const sqin = plan.cutList.filter((c) => !c.whole).reduce((t, c) => t + c.quantity * 2 * (c.lengthIn * c.widthIn + c.lengthIn * c.thicknessIn + c.widthIn * c.thicknessIn), 0);
  return Math.round((sqin / 144) * 10) / 10;
}

/** Quarts the finish needs: area × coats ÷ coverage, rounded up, at least one. */
export function finishQuarts(f: TypedFinish, sqft: number): number {
  return Math.max(1, Math.ceil((sqft * f.coats) / f.coverageSqFt));
}

/** Builds that take a typed finish: real cut wood, not a placeholder or a bought item. */
function finishable(project: YardProject, plan: BuildPlan): boolean {
  return !project.displayOnly && plan.cutList.some((c) => !c.whole);
}

export function finishFor(project: YardProject, plan: BuildPlan): TypedFinish | null {
  return finishable(project, plan) ? typedFinish(project.typedPrompt || project.prompt) : null;
}

/** C18: the typed finish rides on Buy (a real product sized by area) and in one plain step. */
export function withTypedFinish(project: YardProject, plan: BuildPlan): BuildPlan {
  const f = finishFor(project, plan);
  if (!f || plan.bom.some((b) => b.name === f.product.name)) return plan;
  const sqft = paintedSqFt(plan);
  const qt = finishQuarts(f, sqft);
  const row = checkedRow(f.product, qt, `${sqft} sq ft of faces × ${f.coats} coat${f.coats > 1 ? "s" : ""} at ${f.coverageSqFt} sq ft per quart. Checked ${CHECK_AT}.`, qt === 1 ? "quart" : "quarts");
  const step: AssemblyStep = {
    step: plan.instructions.length + 1,
    title: f.kind === "paint" ? `Paint it ${f.key}` : "Stain it",
    description: f.kind === "paint"
      ? `Sand every face to 180 grit and wipe off the dust. Brush on a thin coat of ${f.product.name.replace(/, 1 quart$/, "")}, let it dry 2 hours, sand lightly with 220 grit, then brush on the second coat.`
      : `Sand every face to 180 grit and wipe off the dust. Wipe on ${f.product.name.replace(/, 1 quart$/, "")} with a rag, wait 5 to 15 minutes, then wipe off what has not soaked in. Let it dry 8 hours before you handle it.`,
  } as AssemblyStep;
  const instructions = [...plan.instructions, step].map((s, i) => ({ ...s, step: i + 1 }));
  return { ...plan, bom: [...plan.bom, row], instructions };
}
