import { readLengths, releaseReads } from "./lengthReader";

/**
 * A typed axis is the finished size, even when it is shorter than the class usual.
 * The usual fills only an axis that was not typed. A class default is not a typed axis.
 */
export function typedAxisNumber(prompt: string, kind: "length" | "width" | "height" | "depth"): number | null {
  const t = prompt.toLowerCase().replace(/[″”]/g, '"');
  const words = { length: "long|length", width: "wide|width", height: "tall|high|height", depth: "deep|depth" }[kind];
  if (releaseReads(t)) {
    // Release's reading, kept for releaseReads text (NR-1 r3; NR-2/NR-3 own it).
    const n = String.raw`(\d+(?:\.\d+)?)`;
    const unit = String.raw`(?:ft|foot|feet|in|inch|inches|["'])?`;
    const m = t.match(new RegExp(n + String.raw`\s*` + unit + String.raw`\s*(?:` + words + String.raw`)\b`))
      ?? t.match(new RegExp(String.raw`\b(?:` + words + String.raw`)\s*` + n));
    if (!m) return null;
    const raw = parseFloat(m[1]);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return /(?:ft|foot|feet)/.test(m[0]) ? raw * 12 : raw;
  }
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
