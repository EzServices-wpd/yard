/** One cache key per design: lowercase words in order, numbers kept (the size), punctuation and filler dropped. */
export function designKey(prompt: string): string {
  return prompt.toLowerCase().replace(/(\d)\s*(?:"|''|in\b|inch(?:es)?\b)/g, "$1").replace(/[^a-z0-9.]+/g, " ").replace(/\b(?:a|an|the|please|make|me|build|i|want)\b/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
