/**
 * Deterministic false-positive filter for arm B (Grok's after-build check). Report-only: it never edits a build,
 * it only drops a B mismatch that the build summary itself contradicts. Three known false positives
 * (grok-intake-ab RESULTS.md §5, hand labels in fixtures/ab-2026-10-19.json):
 *   1. kind-noun     B judged the noun by the engine's internal `Kind:` (e.g. "closet") or a modifier-only miss,
 *                    while the Title names the typed thing ("queen platform bed" → "Platform bed …").
 *   2. present       B called a feature/material missing that the parts, Buy list or notes show
 *                    (casters for "rolling", door parts, paint colour, species, PVC, wall mount).
 *   3. drawer-parts  B counted drawer fronts + backs + sides + bottoms as drawers; the drawer-front count matches.
 * Anything else passes through untouched.
 */
export type Mismatch = { kind: string; spec_quote: string; build_shows: string; severity: string };
export type Spec = { head_noun?: { value: string; quote?: string } | null; [k: string]: unknown };
export type Parsed = { title: string; parts: { name: string; qty: number; material: string }[]; buy: string[]; notes: string[]; steps: string };
export type Dropped = Mismatch & { droppedAs: "kind-noun" | "present" | "drawer-parts"; why: string };

export function parseSummary(summary: string): Parsed {
  const lines = summary.split("\n");
  const title = (lines.find((l) => l.startsWith("Title:")) ?? "").slice(6).trim();
  const parts: Parsed["parts"] = [];
  const buy: string[] = [];
  const notes: string[] = [];
  let sec = "";
  for (const l of lines) {
    if (/^Parts:/.test(l)) { sec = "parts"; continue; }
    if (/^Buy:/.test(l)) { sec = "buy"; continue; }
    if (/^Feasibility:/.test(l)) { sec = "notes"; notes.push(l.slice(12).trim()); continue; }
    if (/^Steps:/.test(l)) { sec = ""; continue; }
    if (!l.startsWith("- ")) continue;
    const x = l.slice(2);
    if (sec === "parts") {
      const m = x.match(/^(?:[A-Z]{1,2} )?(.+?) ×(\d+) — .*? in (.+)$/);
      if (m) parts.push({ name: m[1], qty: Number(m[2]), material: m[3] });
    } else if (sec === "buy") buy.push(x);
    else if (sec === "notes") notes.push(x.replace(/^note: /, ""));
  }
  const steps = (lines.find((l) => l.startsWith("Steps:")) ?? "").slice(6);
  return { title, parts, buy, notes, steps };
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const sing = (w: string) => (/(ss|us)$/.test(w) ? w : w.replace(/ies$/, "y").replace(/(ch|sh|x)es$/, "$1").replace(/s$/, ""));
const phrase = (s: string) => norm(s).trim().split(" ").filter(Boolean).map(sing).join(" ");
/** Leading words that size, place or qualify a noun without changing what it is. */
const MODIFIERS = new Set(["queen", "king", "twin", "full", "double", "single", "small", "large", "mini", "big", "tall", "low", "kid", "kids", "toddler", "storage", "wall", "bar", "mounted", "outdoor", "indoor", "bedroom", "kitchen", "bathroom", "modern", "simple", "rustic"]);

/** True when the Title names the typed head noun, allowing leading modifiers (queen, wall, bar, storage …) to drop. */
export function titleHonorsNoun(title: string, noun: string): boolean {
  const t = ` ${phrase(title)} `;
  const w = phrase(noun).split(" ");
  for (let i = 0; i < w.length; i++) {
    if (i > 0 && !MODIFIERS.has(w[i - 1])) break;
    if (t.includes(` ${w.slice(i).join(" ")} `)) return true;
  }
  return false;
}

const SPECIES = ["walnut", "oak", "maple", "cherry", "cedar", "pine", "birch", "poplar", "ash", "teak", "mahogany", "redwood", "cypress"];
const COLOURS = ["black", "white", "gray", "grey", "red", "blue", "green", "navy", "yellow"];
/** Is the feature/material in a number-free quote shown by the build (parts, Buy, notes, steps)? null = not a word we check. */
export function featurePresent(quote: string, p: Parsed): boolean | null {
  const q = norm(quote);
  const partNames = norm(p.parts.map((x) => x.name).join(" | "));
  const mats = norm(p.parts.map((x) => x.material).join(" | "));
  const buy = norm(p.buy.join(" | "));
  const notesSteps = norm(`${p.notes.join(" | ")} | ${p.steps}`);
  const checks: boolean[] = [];
  if (/ (rolling|casters?|wheels?) /.test(q)) checks.push(/ (casters?|wheels?) /.test(buy + partNames));
  if (/ doors? /.test(q)) checks.push(/ doors? /.test(partNames));
  if (/ drawers? /.test(q)) checks.push(/ drawer fronts? /.test(partNames));
  if (/ lid /.test(q)) checks.push(/ lid /.test(partNames));
  if (/ shel(f|ves) /.test(q)) checks.push(/ shel(f|ves) /.test(partNames));
  if (/ pvc /.test(q)) checks.push(/ pvc /.test(mats + buy));
  if (/ (wall|mounted|mount) /.test(q)) checks.push(/ (cleat|wall mount|lag|french cleat|hang(er|ing)?) /.test(notesSteps + buy + partNames));
  for (const s of SPECIES) if (q.includes(` ${s} `)) checks.push(mats.includes(` ${s} `) || buy.includes(` ${s} `));
  for (const c of COLOURS) if (q.includes(` ${c} `)) checks.push(/ paint /.test(buy) && buy.includes(` ${c} `));
  if (/ paint(ed)? /.test(q) && !COLOURS.some((c) => q.includes(` ${c} `))) checks.push(/ paint /.test(buy));
  return checks.length ? checks.every(Boolean) : null;
}

const NUMWORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, pair: 2 };
const countIn = (q: string) => { const m = q.toLowerCase().match(/(\d+)|\b(one|two|three|four|five|six|seven|eight|nine|ten|pair)\b/); return m ? (m[1] ? Number(m[1]) : NUMWORD[m[2]]) : null; };

export function classify(m: Mismatch, spec: Spec, summary: string, p = parseSummary(summary)): Dropped | null {
  const noun = spec.head_noun?.value ?? "";
  const q = m.spec_quote ?? "";
  // 1. kind-noun: the noun is judged on the Title; the internal Kind ("closet") is not the build's name.
  if (noun && (m.kind === "wrong_noun" || (m.kind === "missing_feature" && phrase(q) === phrase(noun))) && (phrase(q) === phrase(noun) || phrase(noun).includes(phrase(q))) && titleHonorsNoun(p.title, noun))
    return { ...m, droppedAs: "kind-noun", why: `title "${p.title.split(" · ")[0]}" names "${noun}"` };
  // 3. drawer-parts: B summed drawer parts; the drawer fronts match the typed count.
  if (m.kind === "wrong_count" && /drawer/i.test(q)) {
    const n = countIn(q);
    const fronts = p.parts.filter((x) => /drawer front/i.test(x.name)).reduce((s, x) => s + x.qty, 0);
    if (n != null && fronts === n && /\b(fronts?|backs?|sides?|bottoms?)\b/i.test(m.build_shows))
      return { ...m, droppedAs: "drawer-parts", why: `${fronts} drawer fronts = ${n} typed; B counted drawer parts` };
  }
  // 2. present: a number-free feature/material quote the build shows.
  if ((m.kind === "missing_feature" || m.kind === "material_off") && q.trim() && countIn(q) == null && featurePresent(q, p) === true)
    return { ...m, droppedAs: "present", why: `"${q}" is in the parts/Buy/notes` };
  return null;
}

export function filterMismatches(ms: Mismatch[], spec: Spec, summary: string): { kept: Mismatch[]; dropped: Dropped[] } {
  const p = parseSummary(summary);
  const kept: Mismatch[] = [];
  const dropped: Dropped[] = [];
  for (const m of ms) { const d = classify(m, spec, summary, p); if (d) dropped.push(d); else kept.push(m); }
  return { kept, dropped };
}
