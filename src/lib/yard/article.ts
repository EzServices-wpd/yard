/**
 * "a" or "an", chosen by how the next word is spoken, not how it is spelled: "an 8-rod abacus", "an 11-rod", "an
 * 18-inch", "an 80-piece", but "a 1-rod", "a 7-rod"; "an abacus", "an hour", but "a unit", "a one-piece".
 */
const AN_WORD = /^(?:[aeio]|u(?!ni|s[eu]|r[aeiou]|tens|ku|[bcfhjkqrstn][aeiou]))|^(?:hour|honest|honou?r|heir)/i;
const A_WORD = /^(?:one|once|eu|ewe)/i;

/** The article for a number as it is read aloud: its leading group of three digits decides (8…, 11, 18 → "an"). */
function numberTakesAn(digits: string): boolean {
  const n = digits.replace(/^0+(?=\d)/, "");
  const lead = n.slice(0, ((n.length - 1) % 3) + 1);
  return lead.startsWith("8") || lead === "11" || lead === "18";
}

export function indefiniteArticle(next: string): "a" | "an" {
  const w = next.trim();
  const num = w.match(/^\d[\d,]*/);
  if (num) return numberTakesAn(num[0].replace(/,/g, "")) ? "an" : "a";
  if (A_WORD.test(w)) return "a";
  return AN_WORD.test(w) ? "an" : "a";
}

/** "An 8-rod abacus" / "a 7-rod abacus": the article and the words, capitalized when it opens a sentence. */
export function withArticle(next: string, capital = false): string {
  const a = indefiniteArticle(next);
  return `${capital ? a[0].toUpperCase() + a.slice(1) : a} ${next}`;
}
