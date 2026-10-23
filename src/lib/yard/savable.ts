import type { YardProject } from "./types";

/**
 * A yard worth keeping in Saved yards. A refusal ("Nothing is built …") built nothing and is never saved, on this
 * device or to the account; an empty bench with no prompt is not saved either. One rule for every save path.
 */
export function yardIsSavable(project: Pick<YardProject, "refused" | "panels" | "instances" | "prompt">): boolean {
  const parts = (project.panels ?? []).length + (project.instances ?? []).length;
  if (project.refused && !(project.panels ?? []).length) return false;
  return parts > 0 || !!project.prompt;
}
