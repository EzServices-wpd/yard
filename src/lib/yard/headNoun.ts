/** The typed head noun of a prompt: its last content word, sizes and filler dropped ("galleon 30 inches long" → galleon). */
export const STOP = /^(?:a|an|the|my|our|for|to|of|with|and|from|inch|inches|wide|tall|high|deep|long|foot|feet|model|small|big|large|tiny)$/;

export function typedHeadNoun(prompt: string): string | null {
  // The head noun ends the noun phrase: "Eiffel Tower from popsicle sticks" → tower, never sticks.
  const phrase = prompt.toLowerCase().split(/\s(?:from|with|out of|made of|using|for|that|which|to|in|on|by)\s/)[0];
  const ws = phrase.replace(/\d[\d./]*\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?/g, " ").split(/[^a-z]+/).filter((w) => w.length > 1 && !STOP.test(w));
  return ws.length ? ws[ws.length - 1].replace(/(?<!s)s$/, "") : null;
}

/** Sentence case: "pirate ship" → "Pirate ship". */
export const sentenceCase = (t: string) => t.trim().replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
