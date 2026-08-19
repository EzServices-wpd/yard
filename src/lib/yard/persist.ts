import type { YardProject } from "./types";
import { emptyProject } from "./prompt";

const KEY = "yard_project_v1";

export function loadProject(): YardProject {
  if (typeof window === "undefined") return emptyProject();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProject();
    const parsed = JSON.parse(raw) as YardProject;
    if (!parsed || !parsed.id) return emptyProject();
    return {
      ...emptyProject(),
      ...parsed,
      instances: parsed.instances ?? [],
      panels: parsed.panels ?? [],
      notes: parsed.notes ?? [],
      assumptions: {
        ...emptyProject().assumptions,
        ...parsed.assumptions,
      },
    };
  } catch {
    return emptyProject();
  }
}

export function saveProject(project: YardProject) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    /* quota */
  }
}

export function clearProject() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
