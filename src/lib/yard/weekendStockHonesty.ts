/**
 * Weekend / hobbyist stock honesty — named stock is the only stock.
 * Sibling of house honesty.ts. No new noun programs.
 *
 * CatalogPanel already rebuilds at a picked catalog id. The prompt must bind
 * the same way: detectMaterial → primaryMaterialId → every member.
 * Unnamed stock stays the wire-frame placeholder. Never silent popsicle.
 */
import { getCatalogItem } from "./catalog";
import { isWholeStock } from "./geometry";
import { binderBom, binderKind, effectiveJoin, memberSpan } from "./joints";
import { detectMaterial, hasExplicitSize, isWireStock, parseSize, stripLumberStock } from "./promptHelpers";
import type { BuildPlan, CatalogItem, CutLine, JoinMethod, YardInstance, YardProject } from "./types";

export type WeekendGuard = "stock" | "whole" | "join" | "size";

export type WeekendIssue = {
  guard: WeekendGuard;
  message: string;
};

export type WeekendReport = {
  ok: boolean;
  issues: WeekendIssue[];
  stockId: string | null;
};

/** House fitted / openings stay on honesty.ts. This is the craft/forge path. */
export function isWeekendProject(project: YardProject): boolean {
  if (project.fitted || project.kind === "closet" || project.kind === "opening") return false;
  if (project.pocket) return false;
  return (
    project.instances.length > 0 ||
    project.kind === "eiffel" ||
    project.kind === "arch" ||
    project.kind === "bridge"
  );
}

export function namedStockFromPrompt(prompt: string): CatalogItem | null {
  const item = detectMaterial(prompt);
  if (isWireStock(item)) return null;
  return item;
}

/** True when generateFromPrompt (no CatalogPanel override) bound the prompt's stock. */
export function promptBoundStock(project: YardProject): boolean {
  const named = namedStockFromPrompt(project.prompt ?? "");
  if (named) return project.primaryMaterialId === named.id;
  return isWireStock(getCatalogItem(project.primaryMaterialId));
}


function itemOf(project: YardProject): CatalogItem | undefined {
  return getCatalogItem(project.primaryMaterialId);
}

function lumberTableTop(project: YardProject, item: CatalogItem | undefined, materialId: string) {
  if (materialId === project.primaryMaterialId) return true;
  if (!item) return false;
  if (!(item.category === "lumber" || item.formFactor === "board")) return false;
  return materialId === "plywood-3-4-4x8";
}

function foreignMembers(project: YardProject, item: CatalogItem): YardInstance[] {
  return project.instances.filter((i) => i.catalogId !== item.id);
}

function foreignPanels(project: YardProject, item: CatalogItem) {
  return project.panels.filter((p) => !lumberTableTop(project, item, p.materialId));
}

/** Typed weekend size from the prompt. 3-ft hyphen and "3 foot" both count. */
export function weekendTypedSize(prompt: string): { width?: number; height?: number; depth?: number } | null {
  const lower = prompt.toLowerCase();
  const dim = stripLumberStock(lower);
  const said =
    hasExplicitSize(prompt) ||
    /\d+(?:\.\d+)?\s*-?\s*(?:ft|foot|feet|in|inch|inches)\b/.test(dim) ||
    /\d+(?:\.\d+)?\s*(?:wide|tall|high|deep|width|height|depth|span|long)\b/.test(dim);
  if (!said) return null;
  return parseSize(lower);
}

function sizeTol(item: CatalogItem | undefined) {
  const stock = item?.dims.length ?? 4.5;
  return Math.max(2.5, Math.min(stock * 0.45, 8));
}

function joinForbidden(item: CatalogItem, name: string): boolean {
  const n = name.toLowerCase();
  const kind = binderKind(item);
  const joins = new Set(item.preferredJoins ?? ["glue"]);
  if (kind !== "fastener" && !joins.has("screw") && !joins.has("nail") && /(?:wood screws|#8\s*[x×])/.test(n)) {
    return true;
  }
  if (kind === "slip" && /titebond|wood glue/.test(n) && !/solvent|pvc/.test(n)) return true;
  if (kind === "glue" && item.category === "craft_wood" && /solvent cement|pvc (?:tee|elbow|cross)/.test(n)) {
    return true;
  }
  if (kind === "tape" && /(?:wood screws|#8\s*[x×]|titebond)/.test(n)) return true;
  return false;
}

export function inspectWeekendHonesty(project: YardProject, plan?: BuildPlan | null): WeekendReport {
  const issues: WeekendIssue[] = [];
  if (!isWeekendProject(project) && project.instances.length === 0) {
    return { ok: true, issues, stockId: project.primaryMaterialId || null };
  }

  const prompt = project.prompt ?? "";
  const named = namedStockFromPrompt(prompt);
  const item = itemOf(project);
  const wire = isWireStock(item);

  // Named stock on a wire primary means generate forgot to bind.
  // CatalogPanel picking PVC on a popsicle prompt is a real pick (primary is not wire).
  if (named && wire) {
    issues.push({
      guard: "stock",
      message: `Prompt named ${named.name} but the bench is still a wire frame.`,
    });
  }

  const stock = item && !wire ? item : named && project.primaryMaterialId === named.id ? named : item;
  if (stock && !isWireStock(stock) && project.instances.length) {
    const bad = foreignMembers(project, stock);
    if (bad.length) {
      const ids = [...new Set(bad.map((i) => i.catalogId))].join(", ");
      issues.push({
        guard: "stock",
        message: `${bad.length} members are ${ids || "other stock"}, not ${stock.name}.`,
      });
    }
    const badP = foreignPanels(project, stock);
    if (badP.length) {
      issues.push({
        guard: "stock",
        message: `${badP.length} panels are not ${stock.name}.`,
      });
    }
    if (plan) {
      const primaryHit = plan.bom.some(
        (b) => b.catalogId === stock.id || (b.name && b.name.toLowerCase() === stock.name.toLowerCase()),
      );
      if (project.instances.length > 0 && !primaryHit) {
        issues.push({
          guard: "stock",
          message: `Buy list does not sell ${stock.name}.`,
        });
      }
      for (const b of plan.bom) {
        if (joinForbidden(stock, b.name)) {
          issues.push({
            guard: "join",
            message: `Buy list has ${b.name} — joins for ${stock.name} are ${(stock.preferredJoins ?? []).join("/")}.`,
          });
        }
      }
      if (binderKind(stock) === "slip") {
        const blob = plan.bom.map((b) => b.name).join(" ");
        if (!/solvent|pvc cement/i.test(blob) && plan.bom.some((b) => /titebond|wood glue/i.test(b.name))) {
          issues.push({
            guard: "join",
            message: "PVC cannot list Titebond as the only join — solvent / slip fittings.",
          });
        }
      }
    }
    if (isWholeStock(stock)) {
      const cuts = project.instances.filter((i) => i.cutLength != null);
      if (cuts.length) {
        issues.push({
          guard: "whole",
          message: `${cuts.length} ${stock.name} pieces have cut lengths — craft stock is used whole.`,
        });
      }
      if (plan?.partsKind === "cut") {
        issues.push({
          guard: "whole",
          message: `Plan is a cut list for ${stock.name}. Glue them as they come.`,
        });
      }
      if (
        plan?.cutList.some(
          (c) => !c.whole && c.lengthIn > 0 && Math.abs(c.lengthIn - (stock.dims.length ?? c.lengthIn)) > 0.15,
        )
      ) {
        issues.push({
          guard: "whole",
          message: `Cut list sells a custom-cut ${stock.name}.`,
        });
      }
    }
  }

  if (stock && !isWireStock(stock)) {
    const typed = weekendTypedSize(prompt);
    if (typed) {
      const tol = sizeTol(stock);
      const isBridge = /bridge|span|viaduct|overpass|trestle|golden gate|brooklyn/.test(prompt.toLowerCase());
      const bits: string[] = [];
      if (isBridge && typed.width != null && Math.abs(project.overall.width - typed.width) > tol) {
        bits.push(`span ${project.overall.width}" ≠ typed ${typed.width}"`);
      }
      if (!isBridge && typed.height != null && Math.abs(project.overall.height - typed.height) > tol) {
        bits.push(`H ${project.overall.height}" ≠ typed ${typed.height}"`);
      }
      if (bits.length) {
        issues.push({ guard: "size", message: `Weekend envelope: ${bits.join(", ")}` });
      }
    }
  }

  return { ok: issues.length === 0, issues, stockId: project.primaryMaterialId || null };
}

function compatibleJoin(item: CatalogItem, join?: JoinMethod | null): JoinMethod {
  const preferred = item.preferredJoins ?? [];
  if (join && preferred.includes(join)) return join;
  return effectiveJoin(item, join);
}

/**
 * Local fixes only: bind members to the named/picked stock, clear craft cut
 * lengths, snap joinMethod onto preferredJoins. Geometry rebuild is CatalogPanel / generate.
 */
export function enforceWeekendHonesty(project: YardProject): YardProject {
  if (project.fitted || project.kind === "closet" || project.kind === "opening" || project.pocket) {
    return project;
  }
  if (!project.instances.length && !project.panels.length) return project;

  const primaryId = project.primaryMaterialId;
  const notes = [...project.notes];
  const item = getCatalogItem(primaryId);
  if (!item) return project;

  let instances = project.instances;
  if (!isWireStock(item)) {
    const drifted = instances.some((i) => i.catalogId !== item.id);
    if (drifted) {
      instances = instances.map((i) => (i.catalogId === item.id ? i : { ...i, catalogId: item.id }));
      notes.push(`Honesty: every member is ${item.name}.`);
    }
    if (isWholeStock(item) && instances.some((i) => i.cutLength != null)) {
      instances = instances.map((i) => (i.cutLength == null ? i : { ...i, cutLength: undefined }));
      notes.push(`Honesty: ${item.name} used whole. Do not cut.`);
    }
  }

  const panels = project.panels.map((p) =>
    lumberTableTop({ ...project, primaryMaterialId: primaryId }, item, p.materialId)
      ? p
      : { ...p, materialId: item.id },
  );

  const joinMethod = isWireStock(item) ? project.joinMethod : compatibleJoin(item, project.joinMethod);

  if (
    instances === project.instances &&
    panels.every((p, i) => p === project.panels[i]) &&
    primaryId === project.primaryMaterialId &&
    joinMethod === project.joinMethod &&
    notes.length === project.notes.length
  ) {
    return project;
  }

  return {
    ...project,
    primaryMaterialId: primaryId,
    instances,
    panels,
    joinMethod,
    notes: notes.filter((n, i) => notes.indexOf(n) === i),
  };
}

export function weekendCutLines(project: YardProject): CutLine[] {
  const item = itemOf(project);
  if (!item || isWireStock(item) || !project.instances.length) return [];
  const stockLen = item.dims.length ?? 0;
  const width = item.dims.width ?? item.dims.diameter ?? 0;
  const thick = item.dims.thickness ?? item.dims.height ?? item.dims.diameter ?? 0;
  const whole = isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  if (whole) {
    return [
      {
        id: item.id,
        name: item.name,
        quantity: project.instances.length,
        lengthIn: stockLen,
        widthIn: width,
        thicknessIn: thick,
        material: item.name,
        whole: true,
        notes: `Full ${item.name}s from the pack. Glue. Do not cut.`,
      },
    ];
  }
  const grouped = new Map<string, CutLine>();
  for (const inst of project.instances) {
    const lenRaw = inst.cutLength ?? memberSpan(inst.from, inst.to) ?? stockLen;
    const len = Math.round(lenRaw * 8) / 8;
    const family = (inst.role || "member").replace(/^\w/, (c) => c.toUpperCase());
    const key = `${inst.catalogId}|${family}|${len}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    grouped.set(key, {
      id: key,
      name: family,
      quantity: 1,
      lengthIn: len,
      widthIn: width,
      thicknessIn: thick,
      material: getCatalogItem(inst.catalogId)?.name ?? item.name,
      whole: false,
    });
  }
  return [...grouped.values()].sort((a, b) => b.lengthIn - a.lengthIn || a.name.localeCompare(b.name));
}

function letterLabel(i: number) {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function stampWeekendCuts(lines: CutLine[]): CutLine[] {
  return lines.map((line, i) => ({ ...line, label: line.label ?? letterLabel(i) }));
}

/** Rewrite a craft plan so Buy/cut list cannot sell the wrong join or a snipped popsicle. */
export function honestWeekendPlan(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!isWeekendProject(project) && !project.instances.length) return plan;
  const item = itemOf(project);
  if (!item || isWireStock(item)) return plan;

  let bom = plan.bom.filter((b) => !joinForbidden(item, b.name));
  const binders = binderBom(item, project.instances, project.joinMethod);
  for (const line of binders) {
    if (!bom.some((b) => b.name === line.name)) bom = [...bom, line];
  }

  const whole = isWholeStock(item) && project.instances.every((i) => i.cutLength == null);
  let cutList = plan.cutList;
  if (whole) {
    cutList = stampWeekendCuts(weekendCutLines(project)).slice(0, 2);
  } else if (!cutList.length) {
    cutList = stampWeekendCuts(weekendCutLines(project));
  }

  return {
    ...plan,
    bom,
    cutList,
    partsKind: whole ? "whole" : plan.partsKind ?? "cut",
  };
}
