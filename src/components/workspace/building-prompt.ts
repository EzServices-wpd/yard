/** The prompt being built right now, so the Building overlay can pick a matching preview. */
let current = "";
export function noteBuildingPrompt(prompt: string) {
  current = prompt;
}
export function buildingPrompt(): string {
  return current;
}
