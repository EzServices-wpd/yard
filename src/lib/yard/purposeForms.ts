/**
 * Spec 006 C1 · head noun + purpose resolver. A request that names what it is FOR ("something to hang my keys",
 * "a place for my dog to sleep") is resolved to the form people build for that purpose before any noun match, so it
 * never falls to "Not learned yet" or a generic body. A request with its own head noun keeps it ("bookshelf that
 * fits a 55 inch TV" stays a bookshelf); typed axes ride along.
 */
export type Purpose = { re: RegExp; form: string; why: string };

export const PURPOSES: Purpose[] = [
  { re: /\b(?:hang|hold|keep|store)\s+(?:my\s+|our\s+|the\s+)?(?:car\s+|house\s+)?keys?\b/, form: "key peg rail", why: "keys hang on the pegs of a peg rail" },
  // Row 51 widened: a bare "key holder" / "key rack" is the same peg rail (its hooks builder runs when hooks are typed).
  { re: /\bkey\s+(?:holder|hanger|rack)\b(?!.*\bhooks?\b)/, form: "key peg rail", why: "keys hang on the pegs of a peg rail" },
  { re: /\b(?:place|spot|somewhere|bed)\s+for\s+(?:my\s+|our\s+|the\s+)?(?:dog|puppy)\s+to\s+(?:sleep|nap|rest|lie)\b|\b(?:my\s+|our\s+)?(?:dog|puppy)\s+to\s+sleep\b|\bdog\s+sleep\b/, form: "dog bed", why: "a dog sleeps on a dog bed" },
  { re: /\b(?:place|spot|somewhere|bed)\s+for\s+(?:my\s+|our\s+|the\s+)?(?:cat|kitten)\s+to\s+(?:sleep|nap|rest)\b|\b(?:cat|kitten)\s+to\s+sleep\b/, form: "cat bed", why: "a cat sleeps on a cat bed" },
  { re: /\borgani[sz]e\s+(?:my\s+|our\s+|the\s+)?tools?\b|\b(?:hang|store)\s+(?:my\s+|our\s+)?tools\b|\btool\s+organi[sz]er\b/, form: "pegboard", why: "tools hang on a pegboard wall" },
  { re: /\b(?:my\s+|our\s+|the\s+)?plants?\s+(?:by|near|in front of)\s+(?:the\s+|a\s+)?window\b|\b(?:somewhere|place)\s+for\s+(?:my\s+|our\s+)?plants\b|\b(?:hold|display)\s+(?:my\s+)?plants\b/, form: "3 tier plant stand", why: "pots step up on a tiered plant stand so each gets window light" },
  { re: /\b(?:holder|rack|stand|storage)\s+for\s+(?:(\d+)\s+)?fishing\s+(?:rods?|poles?)\b|\b(?:hold|store)\s+(?:my\s+)?(?:(\d+)\s+)?fishing\s+(?:rods?|poles?)\b/, form: "fishing rod peg rail", why: "each rod rests across a pair of pegs on a wall rail" },
  { re: /\b(?:store|organi[sz]e|hold|keep)\s+(?:my\s+|our\s+)?shoes\b/, form: "shoe rack", why: "shoes go on a shoe rack" },
  { re: /\b(?:store|hold|keep|display)\s+(?:my\s+|our\s+)?books\b/, form: "bookshelf", why: "books go on a bookshelf" },
  { re: /\b(?:hang|hold)\s+(?:my\s+|our\s+)?coats?\b/, form: "coat rack", why: "coats hang on a coat rack" },
  { re: /\b(?:store|stack|hold|keep)\s+(?:my\s+|our\s+)?firewood\b/, form: "firewood rack", why: "firewood stacks in a firewood rack" },
  { re: /\b(?:store|hold|keep)\s+(?:my\s+|our\s+)?(?:wine|wine bottles|bottles)\b/, form: "wine rack", why: "bottles lie in a wine rack" },
];

/** The purpose a prompt names, resolved to its form ("something to hang my keys 18 wide" → "key holder 18 wide"), or null. */
export function resolvePurpose(prompt: string): { prompt: string; form: string; why: string } | null {
  const lower = prompt.toLowerCase();
  for (const p of PURPOSES) {
    const m = lower.match(p.re);
    if (!m) continue;
    const sizes = lower.match(/\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?\s*(?:wide|tall|high|deep|long)\b/g) ?? [];
    const n = m.slice(1).find(Boolean);
    return { prompt: [p.form, n ? `with ${Number(n) * 2} pegs` : p.form.includes("fishing") ? "with 12 pegs" : "", ...sizes].filter(Boolean).join(" "), form: p.form, why: p.why };
  }
  return null;
}
