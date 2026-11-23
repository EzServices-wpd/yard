/**
 * The name the build page prints (headerName), read-only. Ideas titles for log-only cards use this
 * instead of the result key with its numbers stripped: that strip turned "Step stool with 2 steps"
 * into "Step stool with". The prompt is Yard's own (an idea, LOG_PROMPT, or the type plus the logged
 * size). Never words a visitor typed.
 */
import { headerName } from "@/lib/yard/pdf";
import { generateFromPrompt } from "@/lib/yard/promptMain";

const memo = new Map<string, string>();

/** headerName of the build `prompt` makes. Empty when the build throws. */
export function headerTitleFor(prompt: string): string {
  const key = prompt.trim();
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let name = "";
  try {
    name = headerName(generateFromPrompt(key)).trim();
  } catch {
    name = "";
  }
  memo.set(key, name);
  return name;
}

/** The engine's generic stand-in name, not a thing a card should take as its title. */
export function genericHeaderName(name: string): boolean {
  return /^(?:storage unit|storage|thing|box|unit|rough block|block|yard plan)$/i.test(name.trim());
}
