/**
 * I42 (F2 typed is never assumed), first slice: the project carries its one spec (spec.ts) and the PDF cover reads it.
 * A typed axis is built or refused; the spec never marks it assumed and the cover never labels it assumed, sets a
 * different "default size … assumed" beside it, or shows an overall size the model does not have (the built box, or on
 * depth the finished depth with proud fronts, or the drawn extent). A typed size built differently is said on the cover, naming both sizes.
 * The cover's subtitle, title and drawing tags agree on every axis, fresh or edited on the bench (row 202).
 * Header/pill, card, Measure readout, steps and Buy move to the spec in their own follow-ups.
 */
import { modelFinishedDepth } from "./modelSize";
import { coverAxesTalk } from "./headerSize";
import { inchFrac } from "./inchText";
import { drawnExtent, lineSpans } from "./pdfDraw";
import { headerTitle } from "./pdf";
import { specBox } from "./spec";
import { isBedLongWide, typedAxesOf, typedOffBy, type Axis } from "./typedAxesRead";
import { isUnitItem } from "./unitItems";
import type { YardProject } from "./types";

const AXES: Axis[] = ["width", "height", "depth"];
const WORD: Record<string, Axis> = { wide: "width", tall: "height", deep: "depth" };
const NUM = String.raw`(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)`;
const inches = (t: string) => t.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
const near = (a: number, b: number) => Math.abs(a - b) < 1 / 16;

export function typedAssumedFailures(p: YardProject, prompt: string): string[] {
  if (p.refused || !p.panels.length || isUnitItem(p)) return [];
  const out: string[] = [];
  const box = specBox(p);
  const finished = modelFinishedDepth(p.panels, box.depth);
  // The model's drawn extent counts too (proud pegs on a cribbage board, headerSize's assumed-axis rule).
  const d = p.instances.length ? null : drawnExtent(p);
  const drawn: Record<Axis, number> | null = d ? { width: d.max.x - d.min.x, height: d.max.y - Math.min(0, d.min.y), depth: d.max.z - d.min.z } : null;
  const fits = (a: Axis, n: number) => near(n, box[a]) || (a === "depth" && near(n, finished)) || (!!drawn && near(n, drawn[a]));
  const bed = isBedLongWide(p.notes);
  const typed = typedAxesOf(p.typedPrompt ?? prompt, bed, { ...box, depth: finished }, box);
  const talk = coverAxesTalk(p);
  // The one spec, set at intake, agreeing with the typed words.
  if (!p.spec) out.push("no spec: the cover would have to decide typed versus assumed on its own");
  else for (const a of typed) if (!p.spec.size[a].typed || p.spec.size[a].assumed) out.push(`spec records the typed ${a} as ${p.spec.size[a].assumed ? "assumed" : "untyped"}`);
  // The cover never labels a typed axis assumed, nor sets a default overall size beside the built one.
  for (const a of typed) if (talk.assumed[a]) out.push(`PDF cover marks the typed ${a} assumed: "${talk.subtitle}"`);
  if (/default size [^·]*assumed/i.test(talk.subtitle)) out.push(`PDF cover sets a default overall size beside the built one: "${talk.subtitle}"`);
  // The sizes the cover shows are the built model.
  const head = talk.subtitle.split(" · ").slice(0, 2).join(" · ");
  for (const m of head.matchAll(new RegExp(String.raw`(?:^| x |, | and | · )${NUM}" (wide|tall|deep)\b`, "g"))) {
    const a = WORD[m[2]];
    if (!fits(a, inches(m[1]))) out.push(`PDF cover shows ${m[1]}" ${m[2]}, built ${inchFrac(a === "depth" ? finished : box[a])}"`);
  }
  // Row 202: the cover says one size on every axis: its subtitle, its title (headerTitle) and its drawing's tags.
  const title = headerTitle(p, { features: false }).match(new RegExp(String.raw`${NUM}" W × ${NUM}" D × ${NUM}" H`));
  const tags = d ? lineSpans(p, d) : null;
  for (const m of head.matchAll(new RegExp(String.raw`(?:^| x |, | and | · )${NUM}" (wide|tall|deep)\b`, "g"))) {
    const a = WORD[m[2]];
    const t = title ? inches(title[{ width: 1, depth: 2, height: 3 }[a]]) : null;
    if (t != null && !near(t, inches(m[1]))) out.push(`PDF cover says ${m[1]}" ${m[2]}, its title ${inchFrac(t)}"`);
    if (tags && !near(tags[a], inches(m[1]))) out.push(`PDF cover says ${m[1]}" ${m[2]}, its drawing tag ${inchFrac(tags[a])}"`);
  }
  // A typed size built differently is said on the cover, naming both sizes (an edited axis is the person's own value).
  for (const a of AXES) {
    const t = bed || p.spec?.size[a].edited ? null : typedOffBy(p.typedPrompt ?? prompt, a, a === "depth" ? [box.depth, finished] : [box[a]]);
    if (t != null && !talk.subtitle.includes(`(you typed ${inchFrac(t)}")`)) out.push(`typed ${inchFrac(t)}" ${a}, built ${inchFrac(box[a])}", and the cover does not name both`);
  }
  return [...new Set(out)].slice(0, 6);
}
