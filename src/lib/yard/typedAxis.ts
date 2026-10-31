import { readLengths } from "./lengthReader";

/**
 * A typed axis is the finished size, even when it is shorter than the class usual.
 * The usual fills only an axis that was not typed. A class default is not a typed axis.
 */
export function typedAxisNumber(prompt: string, kind: "length" | "width" | "height" | "depth"): number | null {
  const t = prompt.toLowerCase().replace(/[″”]/g, '"');
  const words = { length: "long|length", width: "wide|width", height: "tall|high|height", depth: "deep|depth" }[kind];
  // NR-1: one reader for the number ("24 1/2 wide" is 24.5, never the 2 after the slash); "N wide" first, else "wide N".
  const ls = readLengths(t);
  const word = new RegExp(String.raw`\b(?:${words})\s*`, "g");
  const l = ls.find((x) => new RegExp(String.raw`^\s*(?:${words})\b`).test(t.slice(x.end)))
    ?? [...t.matchAll(word)].map((m) => ls.find((x) => x.start === m.index! + m[0].length)).find(Boolean);
  return l && l.inches > 0 ? l.inches : null;
}

/** The typed horizontal span: "N long" is the span when typed (then "wide" is the depth), else "N wide". */
export function typedSpan(prompt: string): number | null {
  return typedAxisNumber(prompt, "length") ?? typedAxisNumber(prompt, "width");
}

/** The typed depth: "N deep", else "N wide" when "long" already took the span. */
export function typedDepth(prompt: string): number | null {
  return typedAxisNumber(prompt, "depth") ?? (typedAxisNumber(prompt, "length") != null ? typedAxisNumber(prompt, "width") : null);
}
