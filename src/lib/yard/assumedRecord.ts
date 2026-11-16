/**
 * One assumed-size record, taken after the build (including template sizing).
 * An axis the person did not type is assumed. Its inches are the built box — the same
 * number the model stands at — and that record is what the Assumed note reads.
 * The header prints the same box, labelled W × D × H. A size the reader filled in earlier cannot stay
 * in the note after a later stage built something else, and a typed length cannot
 * hide the depth and height the builder filled in.
 */
import { typedAxesTalk } from "./headerSize";
import { modelFinishedDepth } from "./modelSize";
import { isBedLongWide, typedAxesOf, type Axis } from "./typedAxesRead";
import type { YardProject } from "./types";
import { untypedAxisAssumedNotes } from "./voiceHonesty";

export type AxisFlags = Record<Axis, boolean>;

/** Axes the person typed, read off the words and confirmed against the built box. */
export function typedAxisFlags(prompt: string, project: YardProject): AxisFlags {
  const set = typedAxesOf(prompt, isBedLongWide(project.notes), project.overall);
  return { width: set.has("width"), height: set.has("height"), depth: set.has("depth") };
}

/**
 * Notes from the built box. `typed` is the axes the person named.
 * An axis with no Assumed note yet gets the existing sentence. A note the builder
 * already wrote is left alone (a proud depth it stated as the box stays that sentence).
 * The unlabelled name triple stays W × H × D; the header is the labelled W × D × H.
 */
export function publishAssumedSize(project: YardProject, prompt: string, typed: AxisFlags): YardProject {
  // A bare build's note names the box (a chair's back and a proud door stay as they were).
  // A partial prompt whose depth the header already shows as the finished depth names that
  // finished depth, so the new note and the header are the same number.
  const fin = modelFinishedDepth(project.panels, project.overall.depth);
  const partial = typed.width || typed.height || typed.depth;
  const proud = partial && typedAxesTalk(project).assumed.depth && fin > project.overall.depth + 1 / 16;
  const shown = proud ? { ...project.overall, depth: fin } : project.overall;
  const extra = untypedAxisAssumedNotes(
    prompt,
    [...(project.fitted?.cueNotes ?? []), ...(project.notes ?? [])],
    project.overall,
    typed,
    shown,
  );
  return extra.length ? { ...project, notes: [...(project.notes ?? []), ...extra] } : project;
}
