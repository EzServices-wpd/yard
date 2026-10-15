/** Bounds on what the bench will try to build, checked before any geometry so a typo can't freeze the tab. */
export const MAX_PROMPT = 1500; // the measured pocket-bathroom brief runs ~1,100
export const MAX_INCHES = 1200; // 100 ft

/** The prompt cut to size and every size clamped, plus a plain note when anything changed. */
export function boundPrompt(raw: string): { prompt: string; note?: string } {
  const notes: string[] = [];
  let p = raw.trim();
  if (p.length > MAX_PROMPT) {
    p = p.slice(0, MAX_PROMPT).replace(/\s+\S*$/, "");
    notes.push(`Yard read the first ${MAX_PROMPT} characters`);
  }
  let big = false;
  p = p.replace(/(\d+(?:\.\d+)?)(\s*)('|ft\b|foot\b|feet\b|yards?\b|yd\b|m\b|meters?\b|metres?\b)?/gi, (all, n: string, sp: string, unit?: string) => {
    const per = !unit ? 1 : /^('|f)/i.test(unit) ? 12 : /^y/i.test(unit) ? 36 : 39.37;
    if (Number(n) * per <= MAX_INCHES) return all;
    big = true;
    return `${Math.floor(MAX_INCHES / per)}${sp}${unit ?? ""}`;
  });
  if (big) notes.push(`sizes over ${MAX_INCHES / 12} ft were brought down to ${MAX_INCHES / 12} ft`);
  return notes.length ? { prompt: p, note: `${notes.join(", and ").replace(/^./, (c) => c.toUpperCase())}. Type a smaller size to change it.` } : { prompt: p };
}
