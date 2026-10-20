/**
 * A size is shown only for something built (SWE 2 on #103 r2). A refused build (a size too small to use, a count that
 * doesn't fit) has no size on any surface: not the Measure chip or panel, the header, the PDF, the plan drawer, a saved
 * idea or the notes. Every surface reads the size through here. The one exception is the faint outline of the size
 * typed (refusedOutline.ts), labeled as that, never as a build; the refusal sentence itself names the sizes it is about.
 */
import { fmtUnitEnvelopeInches } from "./voiceHonesty";
import type { YardProject } from "./types";

type Built = Pick<YardProject, "refused" | "panels" | "instances">;

/** Nothing was built: a refusal with no parts. */
export function nothingBuilt(p: Built): boolean {
  return !!p.refused && !p.panels.length && !(p.instances ?? []).length;
}

/** The size built, or null when nothing was. */
export function shownSize(p: Built & Pick<YardProject, "overall">): YardProject["overall"] | null {
  return nothingBuilt(p) ? null : p.overall;
}

/**
 * The unit line every surface prints (the HUD chip, the export header, the plan drawer, a saved idea), or null when
 * nothing was built. `finishedDepth` is the chip's own finished depth; `unit` the fitted or pocket unit when the
 * surface prints that instead of the overall.
 */
export function envelopeText(p: YardProject, o: { finishedDepth?: number; unit?: { width: number; height: number; depth: number } } = {}): string | null {
  const size = shownSize(p);
  if (!size) return null;
  const u = o.unit ?? size;
  return fmtUnitEnvelopeInches(u.width, u.height, o.finishedDepth ?? u.depth, {
    shape: p.fitted?.unit?.shape,
    prompt: p.prompt,
    name: p.name,
    legs: p.fitted?.unit?.legs,
  });
}

/** What the Measure panel says for a refusal: what to do next, no size. */
export const MEASURE_NOTHING_BUILT = "Nothing was built yet, so there is nothing to measure. Type a size in the prompt bar and it builds here.";
