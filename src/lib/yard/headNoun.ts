/** The typed head noun of a prompt: its last content word, sizes and filler dropped ("galleon 30 inches long" → galleon). */
export const STOP = /^(?:a|an|the|my|our|for|to|of|with|and|from|inch|inches|wide|tall|high|deep|long|foot|feet|model|small|big|large|tiny)$/;

/** The typed noun phrase: the prompt up to its first "from/with/for/in/on/by …" tail ("shoe rack by the door" → shoe rack). */
export const headPhrase = (prompt: string): string => prompt.toLowerCase().split(/\s(?:from|with|without|w\/o|out of|made of|using|for|that|which|to|(?<!\b(?:walk|reach|built)\s)in|on|by)\s/)[0];

export function typedHeadNoun(prompt: string): string | null {
  // The head noun ends the noun phrase: "Eiffel Tower from popsicle sticks" → tower, never sticks.
  const phrase = headPhrase(prompt);
  const ws = phrase.replace(/\d[\d./]*\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?/g, " ").split(/[^a-z]+/).filter((w) => w.length > 1 && !STOP.test(w));
  return ws.length ? ws[ws.length - 1].replace(/(?<!s)s$/, "") : null;
}

/** Sentence case: "pirate ship" → "Pirate ship". */
export const sentenceCase = (t: string) => t.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * A form's own name is a different object when it does not contain the typed head noun ("Castle" for "fort",
 * "Truck" for "fire engine"). The title is the words that matched the head, not that other name. A label that
 * already says the head ("Train engine" for "steam train", "Castle" for "castle") stays.
 */
export function titleKeepsHead(prompt: string, label: string, matched: string | null): string {
  const head = typedHeadNoun(prompt);
  if (!head || !matched || label.toLowerCase().includes(head)) return label;
  if (!matched.toLowerCase().includes(head)) return label;
  const words = matched.replace(/^\s*(?:a|an|the|model)\s+/, "").trim();
  return words ? sentenceCase(words) : label;
}
