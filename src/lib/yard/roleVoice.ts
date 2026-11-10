/**
 * The sentences already approved for this change, and no others.
 * A role sentence is applied only when the part's own name is that role
 * (a seat, not a seat rail; a seat lid, not a wall).
 */
import type { AssemblyStep, YardProject } from "./types";

const SEAT_TITLE = /^Attach [A-Z]{1,2} Seat to both [A-Z]{1,2} uprights$/;

function bare(name: string): string {
  return name.replace(/^[A-Z]{1,2}\s+/, "").trim().toLowerCase();
}

function withWhere(description: string, sentence: string): string {
  const at = description.indexOf("Where:");
  const where = at >= 0 ? description.slice(at).trim() : "";
  return where ? `${sentence} ${where}` : sentence;
}

/** Approved seat / lid / dog sentences. Titles that already exist are left as they are. */
export function roleVoice(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const prompt = project.prompt ?? "";
  return steps.map((step) => {
    const dog = dogStep(prompt, step);
    if (dog) return dog;
    const seat = seatSentence(project, step);
    if (seat) return { ...step, description: withWhere(step.description, seat) };
    const lid = seatLid(prompt, step);
    if (lid) return lid;
    return step;
  });
}

function dogStep(prompt: string, step: AssemblyStep): AssemblyStep | null {
  if (!/dog from popsicle sticks/i.test(prompt)) return null;
  const used = (step.partsUsed ?? []).map((n) => n.toLowerCase());
  let description = step.description;
  let hit = false;
  if (used.includes("body")) {
    const sentence = /from pvc/i.test(prompt)
      ? "Fasten the body to the parts it meets with solvent cement, the same cement on the Buy list."
      : /from 2x2/i.test(prompt)
        ? 'Fasten the body to the parts it meets with #8 x 2 1/2" screws, the same screws on the Buy list.'
        : /dowel/i.test(prompt)
          ? "Set the body on the 4 legs."
          : "Set the body on the four legs.";
    const next = description
      .replace(/Set the \d+ bodies on the \d+ legs\./, sentence)
      .replace(/Fasten the \d+ bodies to the parts it meets with [^.]+\./, sentence);
    description = next.includes(sentence) ? next : `${sentence} ${description}`;
    hit = true;
  }
  if (/from pvc/i.test(prompt) && used.includes("ear")) {
    const sentence = "Fasten the two ears (2 sticks each) to the parts they meet with solvent cement, the same cement on the Buy list.";
    const next = description.replace(/Fasten the \d+ ears to the parts it meets with [^.]+\./, sentence);
    description = next.includes(sentence) ? next : `${sentence} ${description}`;
    hit = true;
  }
  return hit ? { ...step, description } : null;
}

function seatSentence(project: YardProject, step: AssemblyStep): string | null {
  if (!SEAT_TITLE.test(step.title)) return null;
  const used = (step.partsUsed ?? []).map(bare);
  if (!used.includes("seat")) return null;
  const cubbies = project.panels.filter((p) => /cubby divider/i.test(p.name)).length;
  const bays = project.panels.filter((p) => /bay divider/i.test(p.name)).length;
  const onto =
    bays === 2 ? "both uprights, the front apron and both bay dividers"
    : cubbies === 3 ? "both uprights, the front apron and the 3 cubby dividers"
    : cubbies === 2 ? "both uprights, the front apron and both cubby dividers"
    : null;
  if (!onto) return null;
  return `Fasten the seat to ${onto} with #8 × 1 1/4" screws, the same screws on the Buy list.`;
}

function seatLid(prompt: string, step: AssemblyStep): AssemblyStep | null {
  if (!/outdoor storage bench from 3\/4 inch dowel/i.test(prompt)) return null;
  const used = (step.partsUsed ?? []).map(bare);
  if (!used.includes("seat lid") && !/seat lid/i.test(step.title)) return null;
  const sentence = "Hang the seat lid on its hinges: screw each hinge's free leaf to the seat lid with the short hinge screws. The seat lid itself takes no screws: it rests on the walls and swings open.";
  return { ...step, title: "Hang the Seat lid", description: withWhere(step.description, sentence) };
}
