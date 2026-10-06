/**
 * Purpose: what the thing is for. "Broom closet", "record console", "garbage bin enclosure" name the
 * stored item first and the class second. The item wins: it sizes the openings (a 60" bay for brooms,
 * 13" openings for LPs, a 24×28×46 bay per garbage bin) and keeps its word in the title.
 */
export type StoredItem = {
  id: string;
  /** Title word ("Broom closet", "Record console"). */
  title: string;
  /** What the note calls them. */
  label: string;
  re: RegExp;
  /** Clear opening one item needs: height, depth, and width when a bay holds exactly one. */
  clear: { h: number; d: number; w?: number };
  /** One bay per item (bins, bikes): the count sets the bays. */
  perBay?: boolean;
  /** Items that live outdoors get a real-scale outdoor frame when an enclosure is asked for. */
  outdoor?: boolean;
  /** Hardware the item hangs or sits on inside its bay, sized to the clear width (one line, read onto Buy). */
  fitting?: (clearWidth: number) => string;
};

export const STORED_ITEMS: StoredItem[] = [
  { id: "broom", title: "Broom", label: "brooms and mops", re: /\b(?:brooms?|mops?)\b/, clear: { h: 60, d: 10 }, fitting: (w) => `Screw ${Math.max(2, Math.min(6, Math.floor(w / 5)))} broom and mop grip clips across the back of the tall bay, 48" up, so each handle hangs with its head clear of the floor.` },
  { id: "records", title: "Record", label: "LP records", re: /\b(?:records?|vinyl|lps?)\b/, clear: { h: 13, d: 13 } },
  { id: "bins", title: "Garbage bin", label: "garbage and recycling bins", re: /\b(?:(?:garbage|trash|recycling|waste|rubbish)\s+(?:bins?|cans?|carts?|totes?)|bins?)\b/, clear: { h: 46, d: 28, w: 24 }, perBay: true, outdoor: true },
  { id: "shoes", title: "Shoe", label: "shoes", re: /\b(?:shoes?|boots?|sneakers?)\b/, clear: { h: 7, d: 12 } },
  { id: "books", title: "Book", label: "books", re: /\b(?:books?|paperbacks?)\b/, clear: { h: 11, d: 10 } },
  { id: "towels", title: "Towel", label: "folded towels", re: /\btowels?\b/, clear: { h: 12, d: 14 } },
  { id: "firewood", title: "Firewood", label: "16\" firewood", re: /\b(?:firewood|logs?)\b/, clear: { h: 12, d: 16 }, outdoor: true },
  { id: "bikes", title: "Bike", label: "bikes", re: /\b(?:bikes?|bicycles?)\b/, clear: { h: 44, d: 70, w: 24 }, perBay: true, outdoor: true },
];

/** Class words a purpose noun can lead ("broom closet", "record console", "bin enclosure"). */
const CLASS = String.raw`(?:closets?|cupboards?|cabinets?|consoles?|credenzas?|sideboards?|stands?|enclosures?|corrals?|surrounds?|hideaways?|sheds?|storage|lockers?|cubbies|cubby|towers?)`;

const COUNT: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, an: 1, single: 1, double: 2, pair: 2 };

export type Purpose = { item: StoredItem; count: number; phrase: string; /** The item as typed, singular ("trash can", "record"). */ word: string };

/** The stored item the prompt builds for, when it leads a class word or follows "for". */
export function purposeOf(prompt: string): Purpose | null {
  const lower = prompt.toLowerCase();
  for (const item of STORED_ITEMS) {
    const src = item.re.source;
    const lead = lower.match(new RegExp(String.raw`(?:${src})(?:\s+(?:and|&|\/)\s+\w+)?\s+${CLASS}\b`));
    const forM = lower.match(new RegExp(String.raw`\bfor\s+(?:(?:my|the|our|your)\s+)?(?:(\d+|one|two|three|four|five|six|a|an|single|double|pair of)\s+)?(?:\w+\s+){0,2}?(?:${src})`));
    if (!lead && !(forM && new RegExp(String.raw`\b${CLASS}\b`).test(lower))) continue;
    const n = lower.match(new RegExp(String.raw`\b(\d+|one|two|three|four|five|six|single|double)\s+(?:\w+\s+)?(?:${src})`)) ?? lower.match(/\bfor\s+(\d+|one|two|three|four|five|six)\b/);
    const said = (n?.[1] ?? forM?.[1] ?? "").replace(/\s+of$/, "");
    const count = said ? Number(said) || COUNT[said] || 1 : item.perBay ? 2 : 1;
    const phrase = (lead ?? forM)![0];
    const word = (phrase.match(item.re)?.[0] ?? item.title.toLowerCase()).replace(/(?<!s)s$|(?<=sh|ch)es$/, "");
    return { item, count: Math.max(1, Math.min(6, count)), phrase, word };
  }
  return null;
}

const SPECIES = /^(?:(?:Western\s+red\s+)?Cedar|Pine|Oak|White\s+oak|Red\s+oak|Maple|Walnut|Cherry|Poplar|Birch|Ash|Redwood|Fir|Spruce|Teak|Mahogany|Hickory)\s+/;

/** "Media console" → "Record console", "Closet" → "Broom closet", once: the stored item names the build. */
export function titleWithPurpose(name: string, purpose: Purpose): string {
  const t = purpose.word.charAt(0).toUpperCase() + purpose.word.slice(1);
  if (purpose.item.re.test(name.toLowerCase()) || name.toLowerCase().includes(purpose.word)) return name;
  const species = name.match(SPECIES)?.[0] ?? "";
  const rest = name.slice(species.length).replace(/^(?:Media|Storage|Simple|Open)\s+(?=[A-Za-z])/, "");
  return `${species}${t} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
}
