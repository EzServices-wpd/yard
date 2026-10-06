/**
 * Typed feature cues (doors, drawers, lid), with no imports so any module can share them.
 * One rule when a feature is typed both ways: the cue typed LAST wins, and a note says which.
 */

const NO_DRAWERS = /\b(?:no|zero|without|sans)\s+(?:any\s+)?drawers?\b|\bdrawerless\b|\b0\s*-?\s*drawers?\b|\bdrawers?\s*[:=]\s*0\b/g;
const NO_DOORS = /\b(?:no|zero|without|sans)\s+(?:any\s+)?doors?\b|\bdoorless\b|\b0\s*-?\s*doors?\b|\bdoors?\s*[:=]\s*0\b|\bopen\s*-?\s*front(?:ed)?\b/g;
const SAY = String.raw`\b(?:with|plus|add|adds|has|[1-9]\d*|one|two|three|four|five|six|a\s+pair\s+of|pair\s+of|double|glass|hinged|sliding|barn|shaker|cabinet)\s+(?:(?!no\b|zero\b|any\b|without\b)[a-z-]+\s+)?`;
const WITH_DRAWERS = new RegExp(`${SAY}drawers?\\b`, "g");
const WITH_DOORS = new RegExp(`${SAY}doors?\\b`, "g");
const NO_LID = /\b(?:no|without|sans)\s+(?:a\s+|any\s+)?(?:top|lids?)\b|\blidless\b|\bopen\s*-?\s*top(?:ped)?\b|\btopless\b/g;
const WITH_LID = /\b(?:with\s+(?:a\s+|the\s+)?(?:(?!no\b|any\b)[a-z-]+\s+)?|hinged\s+|lift[\s-]?off\s+|removable\s+|loose\s+|piano[\s-]+hinged?\s+)lids?\b/g;
type Feature = "doors" | "drawers" | "lid";
const CUES: Record<Feature, [RegExp, RegExp]> = { doors: [NO_DOORS, WITH_DOORS], drawers: [NO_DRAWERS, WITH_DRAWERS], lid: [NO_LID, WITH_LID] };
const lastAt = (re: RegExp, s: string) => {
  let at = -1, said = "";
  for (const m of s.matchAll(re)) if (m.index! >= at) { at = m.index!; said = m[0].trim(); }
  return { at, said };
};

/**
 * One rule for a front feature typed both ways ("open front with doors", "no drawers … 3 drawers"):
 * the cue typed LAST wins, and `note` says which cue won and how to flip it.
 */
export function frontCue(lower: string, feature: Feature): { none: boolean; note?: string } {
  const [noRe, yesRe] = CUES[feature];
  const no = lastAt(noRe, lower);
  if (no.at < 0) return { none: false };
  const yes = lastAt(yesRe, lower);
  if (yes.at < 0) return { none: true };
  const [won, lost] = yes.at > no.at ? [yes.said, no.said] : [no.said, yes.said];
  const thing = feature === "lid" ? "a lid" : feature;
  const built = yes.at > no.at ? `it has ${thing}` : feature === "lid" ? "it is open-topped" : `it has no ${feature}`;
  return {
    none: no.at > yes.at,
    note: `You typed "${no.said}" and "${yes.said}". The later cue ("${won}") won, so ${built}. To build it the other way, take out "${won}" and keep "${lost}".`,
  };
}

/**
 * A typed cue that takes away what the named thing normally has (a dresser's drawers, a cabinet's
 * doors) changes what it is: one line says what it became and how to get the usual one back.
 */
export function formChangeNotes(lower: string, name: string, lost: { drawers?: boolean; doors?: boolean; doorsLeft?: boolean; lid?: boolean }): string[] {
  const noun = name.replace(/\s+\d.*$/, "").trim().toLowerCase() || "unit";
  const out: string[] = [];
  const said = (re: RegExp) => lastAt(re, lower).said;
  if (lost.drawers) {
    const cue = said(NO_DRAWERS);
    out.push(`A ${noun} normally has drawers. You typed "${cue}", so this one is a plain carcase with ${lost.doorsLeft ? "doors" : "an open front"}. Take out "${cue}" for drawers.`);
  }
  if (lost.doors) {
    const cue = said(NO_DOORS);
    out.push(`A ${noun} normally has doors. You typed "${cue}", so this one has an open front. Take out "${cue}" for doors.`);
  }
  if (lost.lid) {
    const cue = said(NO_LID);
    out.push(`A ${noun} normally has a lid. You typed "${cue}", so this one is open-topped. Take out "${cue}" for a hinged lid.`);
  }
  return out;
}

/** Notes for every front feature typed both ways. */
export function frontCueNotes(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return (["doors", "drawers", "lid"] as const).map((f) => frontCue(lower, f).note).filter((n): n is string => !!n);
}


/** A chest/box typed with "no lid" / "open top" (and no later lid cue) is open-topped. */
export function isNoLidPrompt(lower: string): boolean {
  return frontCue(lower, "lid").none;
}

type CuePanel = { type: string; name: string; leaf?: unknown };
type CueProject = {
  panels: CuePanel[];
  notes?: string[];
  fitted?: { unit?: { doors?: boolean; drawers?: number | boolean }; affordances?: string[] } | null;
};

/**
 * Geometry follows the cue, for every builder: a typed "no doors / no drawers / no lid" (with no later
 * cue the other way) leaves none of them in the model, so Buy (counted from the model) buys no hinges,
 * slides or lid stays. Notes about the parts taken out go too; the cue notes themselves stay.
 */
export function withFrontCuesBuilt<P extends CueProject>(project: P, prompt: string): P {
  const lower = prompt.toLowerCase();
  const gone = { doors: frontCue(lower, "doors").none, drawers: frontCue(lower, "drawers").none, lid: frontCue(lower, "lid").none };
  if (!gone.doors && !gone.drawers && !gone.lid) return project;
  const isDoor = (p: CuePanel) => p.type === "door" || !!p.leaf;
  const isDrawer = (p: CuePanel) => p.type === "drawer" || /\bdrawer\b/i.test(p.name);
  const isLid = (p: CuePanel) => /^(?:lift-off\s+)?lids?\b/i.test(p.name);
  const removed = {
    doors: gone.doors && project.panels.some(isDoor),
    drawers: gone.drawers && project.panels.some(isDrawer),
    lid: gone.lid && project.panels.some(isLid),
  };
  if (!removed.doors && !removed.drawers && !removed.lid) return project;
  const panels = project.panels.filter((p) => !((removed.doors && isDoor(p)) || (removed.drawers && isDrawer(p)) || (removed.lid && isLid(p))));
  const talk = [
    removed.doors ? String.raw`\bdoors?\b|\bhinges?\b|\bpulls?\b` : "",
    removed.drawers ? String.raw`\bdrawers?\b|\bslides?\b` : "",
    removed.lid ? String.raw`\blids?\b|piano hinge|lid stay` : "",
  ].filter(Boolean).join("|");
  const about = new RegExp(talk, "i");
  const cueNote = (n: string) => /You typed "/.test(n);
  const notes = (project.notes ?? [])
    .map((n) => (cueNote(n) ? n : n.split(/(?<=\.)\s+/).filter((s) => !about.test(s)).join(" ")))
    .filter((n) => n.trim());
  const fitted = project.fitted
    ? {
        ...project.fitted,
        unit: project.fitted.unit
          ? { ...project.fitted.unit, ...(removed.doors ? { doors: false } : {}), ...(removed.drawers && typeof project.fitted.unit.drawers === "number" ? { drawers: 0 } : {}) }
          : project.fitted.unit,
        affordances: project.fitted.affordances?.filter((a) => !(removed.doors && a === "door")),
      }
    : project.fitted;
  return { ...project, panels, notes, fitted };
}
