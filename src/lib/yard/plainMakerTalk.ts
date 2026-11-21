/**
 * Shop words for every step and note.
 *
 * Builders still compose sentences from engine terms (the model's joints, a class
 * default, a family name). Those terms are how the screw pass and the size notes
 * keep their counts. This is the one pass that says the finished sentence: where
 * the parts meet, at each joint, a size you did not type. Buy lines do not come
 * through here. Their notes stay the accounting the screw total is checked against.
 */
import type { BuildPlan } from "./types";
import { strangerPlainShopTalk } from "./voiceHonesty";

/** Internal terms that must not remain in a step title, description, tip, or note. */
export const STEP_NOTE_DENY: [RegExp, string][] = [
  [/\bmodels?\b/i, "model"],
  [/\bgraph\b/i, "graph"],
  [/\bclass\b/i, "class"],
  [/\bfamily\b/i, "family"],
  [/\(default size\)/i, "default-size marker"],
  [/\bderived\b/i, "derived"],
  [/\bnot yet in a step\b/i, "unplaced-part marker"],
  [/\bnodes?\b/i, "node"],
  [/\bdensif/i, "densify"],
  [/\bcarcases?\b/i, "carcase"],
  [/\btoekicks?\b/i, "toekick"],
  [/\bfrom the joints\b/i, "joints as a data list"],
];

const DROP = [
  /\s*This part was on the model and not yet in a step\.?/g,
  /\s*Walk the road on the bench\.?/g,
];

/** One sentence, in the words a maker uses at the bench. */
export function plainMakerTalk(text: string): string {
  let t = text;
  for (const re of DROP) t = t.replace(re, "");
  t = t
    .replace(/\bfrom the model's joints\b/g, "where the parts meet")
    .replace(/\bfrom the model's spacing\b/g, "at the spacing shown")
    .replace(/\bwhere the model shows (?:them|it)\b/g, "where the parts meet")
    .replace(/\bbuild a model\b/g, "build a small one")
    .replace(/\bdisplay model\b/g, "display piece")
    .replace(/\bon the model\b/g, "in the build")
    .replace(/\bfrom the model\b/g, "from the drawing")
    .replace(/\bthe model's\b/g, "the build's")
    .replace(/\bthe model\b/g, "the build")
    .replace(/\bOne join class:/g, "One join:")
    .replace(/\bClass anatomy:\s*([a-z])?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ""))
    .replace(/\bRaised enclosure class:/g, "Raised enclosure:")
    .replace(/\bNo class matched, so this\b/g, "This")
    .replace(/\bbuilt from its anatomy class\b/g, "built from the shape of its parts")
    .replace(/\bClass defaults fill untyped axes — type Measure to lock size\.?/g, "Sizes you did not type are filled in — type them in Measure to lock the size.")
    .replace(/\s*\([^)]*\bclass default\)/gi, "")
    .replace(/\s*[—–-]\s*(?:[\w-]+\s+){0,4}class default\b/gi, "")
    .replace(/\s*\(default size\)/gi, "")
    .replace(/\boutdoor seat family\b/g, "outdoor seat")
    .replace(/\b([\w-]+-[\w-]+) family\b/g, (_m, w: string) => w.replace(/-/g, " "))
    .replace(/\bsupport graph\b/gi, "the way the parts hold each other up")
    .replace(/\bthe graph\b/gi, "the frame")
    .replace(/\bdensified\b/gi, "filled in")
    .replace(/\bdensify\b/gi, "fill in")
    .replace(/\bderived\b/gi, "worked out");
  t = strangerPlainShopTalk(t);
  return t.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

/** The published plan: every step title, description and tip, after the screw pass has counted. */
export function plainPlanTalk(plan: BuildPlan): BuildPlan {
  const say = (s: string | undefined) => {
    if (!s) return s;
    const t = plainMakerTalk(s);
    return t || undefined;
  };
  return {
    ...plan,
    instructions: plan.instructions.map((s) => ({
      ...s,
      title: plainMakerTalk(s.title) || s.title,
      description: plainMakerTalk(s.description),
      tips: say(s.tips),
    })),
  };
}
