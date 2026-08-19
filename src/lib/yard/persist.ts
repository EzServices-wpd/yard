import type { YardProject } from "./types";
import { emptyProject } from "./prompt";

const KEY = "yard_project_v1";
const LIB = "yard_library_v1";
const MAX_YARDS = 24;

export type YardCard = {
  id: string;
  name: string;
  prompt: string;
  kind: string;
  savedAt: string;
  pieces: number;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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

function cardOf(project: YardProject): YardCard {
  return {
    id: project.id,
    name: project.name,
    prompt: project.prompt,
    kind: project.kind,
    savedAt: new Date().toISOString(),
    pieces: (project.instances?.length ?? 0) + (project.panels?.length ?? 0),
  };
}

export function listLocalYards(): YardCard[] {
  if (typeof window === "undefined") return [];
  const cards = safeParse<YardCard[]>(localStorage.getItem(LIB));
  return Array.isArray(cards) ? cards : [];
}

export function saveLocalYard(project: YardProject) {
  if (typeof window === "undefined") return;
  if (!project.prompt && project.instances.length === 0 && project.panels.length === 0) return;
  try {
    localStorage.setItem(`yard_full_${project.id}`, JSON.stringify(project));
    const cards = listLocalYards().filter((c) => c.id !== project.id);
    cards.unshift(cardOf(project));
    localStorage.setItem(LIB, JSON.stringify(cards.slice(0, MAX_YARDS)));
  } catch {
    /* quota */
  }
}

export function loadLocalYard(id: string): YardProject | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParse<YardProject>(localStorage.getItem(`yard_full_${id}`));
  if (!parsed || !parsed.id) return null;
  return { ...emptyProject(), ...parsed, instances: parsed.instances ?? [], panels: parsed.panels ?? [] };
}

export function deleteLocalYard(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`yard_full_${id}`);
    localStorage.setItem(LIB, JSON.stringify(listLocalYards().filter((c) => c.id !== id)));
  } catch {
    /* ignore */
  }
}
