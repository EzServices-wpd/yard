/**
 * Deterministic part ids. The same prompt (and options) must give byte-identical steps on every run, so ids come
 * from a PRNG seeded per build (seedIds at the top of generateFromPrompt) instead of Math.random. Ids stay unique
 * inside a build: a repeat is redrawn. Before any seed (tests, ad-hoc edits) the stream starts from a fixed seed.
 */
let state = 0x9e3779b9;
let issued = new Set<string>();

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function next(): number {
  // mulberry32
  state = (state + 0x6d2b79f5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Start a build's id stream from its own words; the same input always yields the same ids. */
export function seedIds(input: unknown): void {
  let key: string;
  try { key = JSON.stringify(input) ?? ""; } catch { key = String(input); }
  state = hash(key) | 0;
  issued = new Set();
}

export function stableId(prefix: string): string {
  for (;;) {
    const id = `${prefix}-${(next() % 78364164096).toString(36).padStart(7, "0")}`;
    if (!issued.has(id)) { issued.add(id); return id; }
  }
}
