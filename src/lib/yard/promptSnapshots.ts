/**
 * Deterministic prompt → snapshot capture for golden tests.
 * Uses the same generateFromPrompt entry the app uses. No LLM.
 */
import { generateFromPrompt } from "./promptMain";
import type { YardProject } from "./types";

export type PromptSnapshotBucket =
  | "fitted-house"
  | "weekend-named-stock"
  | "craft-kit"
  | "unknown-fallback";

export type PromptSnapshotSignals = {
  linenExact?: boolean;
  mentionsYardBuilt: boolean;
  craftStock: boolean;
  hasKnee24: boolean;
  partBudgetOk: boolean;
};

export type PromptSnapshot = {
  id: string;
  prompt: string;
  bucket: PromptSnapshotBucket;
  name: string;
  kind: string;
  material: string;
  overall: { width: number; height: number; depth: number };
  panels: number;
  instances: number;
  uniqueParts: string[];
  notesHead: string[];
  signals: PromptSnapshotSignals;
};

export function honestySignals(project: YardProject, prompt: string): PromptSnapshotSignals {
  const notes = (project.notes ?? []).join(" | ");
  const signals: PromptSnapshotSignals = {
    mentionsYardBuilt: /Yard built/i.test(notes),
    craftStock: /popsicle|cardboard|toothpick|straw|craft/i.test(project.primaryMaterialId),
    hasKnee24: /24/.test(notes) && /knee/i.test(notes),
    partBudgetOk: project.panels.length + (project.instances ?? []).length <= 2000,
  };
  if (/linen closet/i.test(prompt)) {
    signals.linenExact =
      project.overall.width === 31.5 && project.overall.height === 78 && project.overall.depth === 16;
  }
  return signals;
}

export function capturePromptSnapshot(meta: {
  id: string;
  prompt: string;
  bucket: PromptSnapshotBucket;
}): PromptSnapshot {
  const project = generateFromPrompt(meta.prompt);
  const partNames = [
    ...project.panels.map((x) => x.name),
    ...(project.instances ?? []).map((x) => x.role || x.catalogId),
  ];
  return {
    id: meta.id,
    prompt: meta.prompt,
    bucket: meta.bucket,
    name: project.name,
    kind: project.kind,
    material: project.primaryMaterialId,
    overall: {
      width: project.overall.width,
      height: project.overall.height,
      depth: project.overall.depth,
    },
    panels: project.panels.length,
    instances: (project.instances ?? []).length,
    uniqueParts: [...new Set(partNames)].sort(),
    notesHead: (project.notes ?? []).slice(0, 2),
    signals: honestySignals(project, meta.prompt),
  };
}
