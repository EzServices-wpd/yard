import type { StructureKind, Vec3 } from "./types";
import { classifyAnatomy } from "./anatomy";
import { figureStrokes } from "./figure";

export type FormOp =
  | { op: "taper"; y0: number; y1: number; r0: number; r1: number; sides?: number; role?: string }
  | { op: "column"; x: number; z: number; y0: number; y1: number; role?: string }
  | { op: "ring"; y: number; rx: number; rz?: number; n?: number; role?: string }
  | { op: "box"; x: number; y: number; z: number; w: number; h: number; d: number; role?: string }
  | { op: "arch"; x0: number; z0: number; x1: number; z1: number; y0?: number; crown: number; role?: string }
  | { op: "dome"; x?: number; z?: number; y0: number; r: number; role?: string }
  | { op: "grid"; y: number; w: number; d: number; nx?: number; nz?: number; x?: number; z?: number; role?: string }
  | { op: "poly"; points: Vec3[]; role?: string }
  | { op: "legs"; count: number; radius: number; y0: number; y1: number; role?: string }
  | {
      op: "shell";
      y0: number;
      y1: number;
      r: number;
      x?: number;
      z?: number;
      profile?: "hemisphere" | "onion" | "drum";
      role?: string;
    };

export type FormStroke = {
  points: Vec3[];
  role?: string;
};

export type FormRecipe = {
  name: string;
  kind: StructureKind;
  historic?: boolean;
  notes: string[];
  ops: FormOp[];
  strokes?: FormStroke[];
  source?: string;
};

export type Size3 = { height: number; width: number; depth: number };

// TEMP STUB - will be replaced
export function detectForm(prompt: string, size: Size3): FormRecipe {
  return { name: "Custom", kind: "custom", notes: [], ops: [] };
}

export function recipeFromAnatomy(prompt: string, size: Size3): FormRecipe {
  return { name: "Custom", kind: "custom", notes: [], ops: [] };
}

export function recipeFromOps(name: string, kind: StructureKind, ops: FormOp[], notes: string[] = [], historic?: boolean): FormRecipe {
  return { name, kind, historic, notes, ops };
}

export function isFormStroke(v: unknown): v is FormStroke {
  if (!v || typeof v !== "object") return false;
  const pts = (v as FormStroke).points;
  return Array.isArray(pts) && pts.length >= 2;
}

export function subjectFromPrompt(prompt: string): string {
  return prompt.trim().slice(0, 48) || "Custom form";
}

export function isFormOp(v: unknown): v is FormOp {
  return !!v && typeof v === "object" && "op" in (v as object);
}
