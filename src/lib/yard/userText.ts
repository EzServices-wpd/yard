/**
 * Quick win (d): the one scrub for engine wording that leaked into user text (Grok review §8.4). Engine data keeps
 * its words (gates and parsers read them, e.g. learnedGate's fallback-step check and typedAxesTalk's "Assumed"
 * notes); every surface a person reads (bench step card, plan drawer, export, PDF via pdfKit.clean) prints
 * through this.
 */
const RULES: [RegExp, string][] = [
  // placeEveryPart's fallback-step tip: an internal marker, not advice.
  [/\s*This part was on the model and not yet in a step\.?/g, ""],
  // stepJointScrews: a bookkeeping aside.
  [/\s*These screws are counted in another step's total\.?/g, ""],
  [/\s*counted in another step's total\.?/g, ""],
  // voiceHonesty's join stamp: "One join class:" reads as jargon; the plain stamp is "One join:".
  [/\bOne join class:/g, "One join:"],
  // Assumed notes: "(vanity class default)" / "(class default)" is how the engine filled it, not news to the maker.
  [/\s*\((?:[\w\s-]*\s)?class default\)/gi, ""],
  // A toy-road suggestion written for the bench, not the maker.
  [/\s*Walk the road on the bench\.?/g, ""],
];

export function userText(s: string | null | undefined): string {
  if (!s) return "";
  let t = String(s);
  for (const [re, to] of RULES) t = t.replace(re, to);
  return t.replace(/\s{2,}/g, " ").trim();
}

/** The leak list (for the lint guard): none of these may reach a person. */
export const LEAKS = [/not yet in a step/i, /counted in another step's total/i, /One join class:/, /class default\)/i, /Walk the road on the bench/i];
