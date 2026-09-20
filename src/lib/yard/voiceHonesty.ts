/** Voice/PDF honesty helpers — hardware↔Buy class match, species title/stock, footprint talk, plain shop words. */

import { namedLumberFromPrompt } from "./namedLumberSpecies";

/**
 * Map BOM / step hardware language to a Buy catalogId class.
 * Piano / continuous / lid-stay must NOT collapse to soft-close concealed cabinet hinges.
 */
export function hardwareCatalogIdFromHay(hay: string): string | null {
  const h = hay.toLowerCase();
  if (/piano|continuous\s*hinge/.test(h)) return "piano-hinge";
  if (/lid\s*stay|lid\s*support/.test(h)) return "lid-stay";
  if (/soft-?close|concealed|cup\s*hinge/.test(h)) return "cabinet-hinges";
  if (/utility\s*hinge|butt\s*hinge|support-?leg\s*hinge/.test(h)) return "utility-hinges";
  if (/\bhinge/.test(h)) return "cabinet-hinges";
  return null;
}

/** Named lumber species display (Cedar, Oak, …) when the prompt speaks it. */
export function speciesDisplayFromPrompt(prompt: string): string | null {
  return namedLumberFromPrompt(prompt)?.display ?? null;
}

/**
 * Honor typed species in a title stem — "Chest" + cedar prompt → "Cedar chest".
 * No silent drop; does not invent species when the prompt never named one.
 */
export function honorSpeciesInTitle(stem: string, prompt: string): string {
  const sp = speciesDisplayFromPrompt(prompt);
  if (!sp) return stem;
  const esc = sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("\\b" + esc + "\\b", "i").test(stem)) return stem;
  if (/^Chest$/i.test(stem)) return `${sp} chest`;
  if (/^Toy chest$/i.test(stem)) return `${sp} toy chest`;
  return `${sp} ${stem}`;
}

/** Geometry-aware footprint confirm language (round ≠ "check it is square"). */
export function footprintConfirmTalk(opts: {
  shape?: string | null;
  widthLabel: string;
  depthLabel?: string;
}): string {
  const shape = (opts.shape ?? "").toLowerCase();
  if (shape === "round" || shape === "circle") {
    return `Mark the circle on the floor (diameter ${opts.widthLabel}"). Check the diameter matches — a round top is not a square footprint.`;
  }
  if (shape === "oval") {
    const d = opts.depthLabel ?? opts.widthLabel;
    return `Mark the oval footprint ${opts.widthLabel}" × ${d}". Check the long and short axes — not a square box.`;
  }
  return "Mark the footprint on the floor. Check it is square.";
}

/**
 * When prompt names a species but densify stays plywood / generic, say the substitute out loud.
 */
export function speciesSubstituteNote(prompt: string, stockLabel: string): string | null {
  const sp = namedLumberFromPrompt(prompt);
  if (!sp) return null;
  if (!/ply|plywood|sheet/i.test(stockLabel)) return null;
  return `Prompt names ${sp.display} — densify uses ${stockLabel} as the structural substitute (not a silent drop). Buy ${sp.display} boards or lining if you want the named-species story.`;
}

/** Prefer plain stranger words in step/PDF body; keep glossary for shop terms. */
export function strangerPlainShopTalk(text: string): string {
  return text
    .replace(/carcase\s*\(\s*the main box\s*\)/gi, "main box")
    .replace(/\bthe carcase\b/gi, "the main box")
    .replace(/\ba carcase\b/gi, "a main box")
    .replace(/\bcarcase\b/gi, "main box")
    .replace(/\btoekicks\b/gi, "kick strips")
    .replace(/\btoekick\b/gi, "kick strip")
    .replace(/\borbit-?chrome\b/gi, "skeleton chrome");
}


/** Short kit-style orientation cue when hinge/face direction matters. */
export function orientationCueTalk(kind: "hinge-toward-you" | "flip-the-box" | "lid-opens-back"): string {
  if (kind === "hinge-toward-you") return "Orientation: hinge edge toward you on the bench.";
  if (kind === "flip-the-box") return "Orientation: flip the box right-side up before this join.";
  return "Orientation: lid opens up and back — hinge along the back edge.";
}
