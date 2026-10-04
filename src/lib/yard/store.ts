import { solveModel } from "./solve";
import { create } from "zustand";
import { createId } from "@/lib/utils";
import type { BuildPlan, BuildScale, DetailLevel, JoinMethod, MeasureDraft, PocketNotch, PocketSpec, Vec3, WorkMode, YardProject } from "./types";
import { emptyProject, generateFromPrompt } from "./prompt";
import { applyFollowOnSize, followOnNamesStock, looksLikeFollowOn, materialUnlessNamed } from "./promptHelpers";
import type { FormRecipe } from "./form";
import { buildPlan } from "./report";
import { clearProject, loadProject, saveLocalYard, saveProject } from "./persist";
import { defaultPlaceLength } from "./bom";
import { toPrimitive } from "./geometry";
import { getCatalogItem } from "./catalog";
import { defaultGhostFlags } from "./ghost";
import { homeOf, maybeSnap, nearHome, withHome } from "./assembly";
import { climbIdentityLabel } from "./family";
import { measureKindFromProject, projectFromMeasurement, stampPromptSize, angleMeasureFromProject, stampCornerAngle, stampSlopeEnds, cornerAngleOk } from "./space";
import { isRoundUnitEnvelope } from "./voiceHonesty";
import { stampSpanOffer } from "./spanCheck";
import { fitPocketAsk } from "./pocket";
import { buildFitted } from "./fitted";
import { liftFlatTo3d } from "./flatLayout";
import { fieldInch, inchFrac, parseInch } from "./inchText";

/** Keep the forge lamp up long enough to watch it. A new build cancels a pending reveal. */
const LAMP_HOLD_MS = 4000;
let lampTimer = 0;
let lampGen = 0;

function dropLampTimer() {
  if (typeof window === "undefined" || !lampTimer) return;
  window.clearTimeout(lampTimer);
  lampTimer = 0;
}

function armBuilding() {
  lampGen += 1;
  dropLampTimer();
}

function panelCutSig(project: YardProject): string {
  return project.panels.map((panel) => `${panel.name}|${panel.cutNote ?? ""}|${panel.cutouts?.length ?? 0}|${panel.polygon ? 1 : 0}|${panel.size.height.toFixed(2)}`).join(";");
}

function sameMeasureBuild(a: YardProject, b: YardProject): boolean {
  if (a === b) return true;
  if (a.prompt !== b.prompt || a.primaryMaterialId !== b.primaryMaterialId || a.shopJoin !== b.shopJoin) return false;
  if (a.panels.length !== b.panels.length || a.instances.length !== b.instances.length) return false;
  if (panelCutSig(a) !== panelCutSig(b)) return false;
  const o = a.overall;
  const p = b.overall;
  return Math.abs(o.width - p.width) < 0.02 && Math.abs(o.height - p.height) < 0.02 && Math.abs(o.depth - p.depth) < 0.02;
}

function isBlankCube(project: YardProject): boolean {
  if (project.prompt?.trim()) return false;
  if (project.panels.length || project.instances.length) return false;
  return Math.abs(project.overall.width - 36) < 0.1 && Math.abs(project.overall.height - 36) < 0.1;
}

function measureFromProject(project: YardProject, prev: MeasureDraft): MeasureDraft {
  const fitted = project.fitted ?? project.recastFrom?.fitted;
  const pocket = project.pocket ?? project.recastFrom?.pocket;
  if (pocket) return { ...prev, ...pocketMeasure(pocket) };
  if (fitted) {
    return {
      ...prev,
      width: fieldInch(fitted.unit.width),
      height: fieldInch(fitted.unit.height),
      depth: fieldInch(fitted.unit.depth),
      openingWidth: fieldInch(fitted.opening.width),
      openingHeight: fieldInch(fitted.opening.height),
      openingDepth: fieldInch(fitted.opening.depth),
    };
  }
  return {
    ...prev,
    width: fieldInch(project.overall.width),
    height: fieldInch(project.overall.height),
    depth: fieldInch(project.overall.depth),
  };
}

type YardState = {
  project: YardProject;
  plan: BuildPlan | null;
  selectedId: string | null;
  explode: boolean;
  facesOpen: boolean;
  camera: "iso" | "front" | "side" | "top";
  /** Bumps when the user asks for the framed view back after turning the model by hand. */
  viewNonce: number;
  /** The user turned, zoomed or panned the model since the last framing. */
  orbited: boolean;
  /** The angle the user turned the model to (kept across a resize or a stock change). */
  userView: { azimuthDeg: number; elevationDeg: number } | null;
  showDims: boolean;
  showHull: boolean;
  showHistoric: boolean;
  workMode: WorkMode;
  detail: DetailLevel;
  buildScale: BuildScale;
  cutMode: "auto" | "cut" | "whole";
  activeStep: number | null;
  placedIds: string[];
  lockedIds: string[];
  dragPos: { id: string; pos: Vec3 } | null;
  measure: MeasureDraft;
  measureOpen: boolean;
  measureNote: string | null;
  undoTick: number;
  history: YardProject[];
  future: YardProject[];
  building: boolean;
  grokBusy: boolean;
  grokError: string | null;
  showLoad: boolean;
  revealBench: () => void;
  beginBuild: () => void;
  commit: (next: YardProject) => void;
  setProject: (next: YardProject) => void;
  generate: (prompt: string, materialId?: string, form?: FormRecipe, opts?: { includeSpine?: boolean; joinMethod?: JoinMethod; scale?: BuildScale; fresh?: boolean; cutStock?: boolean; fittedOverride?: import("./types").FittedSpec; pocketOverride?: import("./types").PocketSpec; honorUnit?: boolean; sizeOverride?: { width: number; height: number; depth: number }; keepView?: boolean; restock?: boolean }) => YardProject;
  setJoinMethod: (join: JoinMethod) => void;
  setDetail: (v: DetailLevel) => void;
  setBuildScale: (v: BuildScale) => void;
  setCutMode: (v: "auto" | "cut" | "whole") => void;
  makePlan: () => BuildPlan;
  setPlan: (plan: BuildPlan | null) => void;
  attachStepImage: (step: number, imageDataUrl: string) => void;
  setRender: (render: NonNullable<YardProject["render"]>) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setExplode: (v: boolean) => void;
  setFacesOpen: (v: boolean) => void;
  setCamera: (v: YardState["camera"]) => void;
  resetView: () => void;
  setOrbited: (v: boolean) => void;
  setUserView: (v: { azimuthDeg: number; elevationDeg: number } | null) => void;
  setShowHull: (v: boolean) => void;
  setShowHistoric: (v: boolean) => void;
  setWorkMode: (v: WorkMode) => void;
  setShowLoad: (v: boolean) => void;
  setActiveStep: (n: number | null) => void;
  toggleLockSelected: () => void;
  beginDrag: (id: string) => void;
  nudgeInstance: (id: string, position: Vec3) => void;
  finishMove: (id: string, position: Vec3) => void;
  moveInstance: (id: string, position: Vec3) => void;
  deleteSelected: () => void;
  placePiece: (catalogId: string, position: Vec3) => void;
  setMeasureOpen: (v: boolean) => void;
  setMeasure: (patch: Partial<MeasureDraft>) => void;
  applyMeasure: (commitAngle?: boolean) => void;
  applyMeasureRaw: (commitAngle?: boolean) => void;
  liftTo3d: () => YardProject | null;
  reset: () => void;
};

/** The pocket card's fields, read back from the built pocket (shop fractions, never decimals). */
function pocketMeasure(pocket: PocketSpec): Omit<MeasureDraft, "kind"> {
  const { walls, unit } = pocket;
  const flared = Math.abs(walls.leftAngleDeg) > 0.05 || Math.abs(walls.rightAngleDeg) > 0.05;
  const deg = (n: number) => String(Math.round(n * 10) / 10);
  const notch = walls.notch;
  return {
    width: fieldInch(unit.width),
    height: fieldInch(unit.height),
    depth: fieldInch(unit.depth),
    backWidth: fieldInch(walls.backWidth),
    leftDepth: fieldInch(walls.leftDepth),
    rightDepth: fieldInch(walls.rightDepth),
    ceiling: fieldInch(walls.height),
    leftBay: unit.leftBay != null ? fieldInch(unit.leftBay) : undefined,
    rightBay: unit.rightBay != null ? fieldInch(unit.rightBay) : undefined,
    pocketShape: flared ? "flared" : "straight",
    leftAngle: deg(walls.leftAngleDeg),
    rightAngle: deg(walls.rightAngleDeg),
    notchSide: notch ? notch.side : "none",
    notchWidth: notch ? fieldInch(notch.width) : undefined,
    notchDepth: notch ? fieldInch(notch.depth) : undefined,
    notchHeight: notch ? fieldInch(notch.height) : undefined,
  };
}

/** The stock to rebuild in: the default sheet stays implicit so a sheet build keeps its own sheet choices. */
function rebuildStock(project: YardProject): string | undefined {
  return project.primaryMaterialId && project.primaryMaterialId !== "plywood-3-4-4x8" && project.primaryMaterialId !== "wire-frame"
    ? project.primaryMaterialId
    : undefined;
}

function persist(project: YardProject) {
  saveProject(project);
  saveLocalYard(project);
}

const defaultMeasure: MeasureDraft = {
  width: "31.5",
  height: "78",
  depth: "16",
  kind: "closet_niche",
};

function stockFlag(mode: "auto" | "cut" | "whole"): boolean | undefined {
  if (mode === "cut") return true;
  if (mode === "whole") return false;
  return undefined;
}

export const useYard = create<YardState>((set, get) => ({
  project: emptyProject(),
  plan: null,
  selectedId: null,
  explode: false,
  facesOpen: false,
  camera: "iso",
  viewNonce: 0,
  orbited: false,
  userView: null,
  showDims: true,
  showHull: false,
  showHistoric: false,
  workMode: "look",
  detail: "full",
  buildScale: "full",
  cutMode: "auto",
  activeStep: null,
  placedIds: [],
  lockedIds: [],
  dragPos: null,
  measure: defaultMeasure,
  measureOpen: false,
  measureNote: null,
      undoTick: 0,
  history: [],
  future: [],
  building: false,
  grokBusy: false,
  grokError: null,
  showLoad: false,
  revealBench: () => {
    const gen = lampGen;
    dropLampTimer();
    if (typeof window === "undefined") {
      set({ building: false });
      return;
    }
    lampTimer = window.setTimeout(() => {
      lampTimer = 0;
      if (gen !== lampGen) return;
      set({ building: false });
    }, LAMP_HOLD_MS);
  },
  beginBuild: () => {
    armBuilding();
    set({ building: true, grokError: null });
  },
  commit: (next) => {
    const stamped = stampSpanOffer(next);
    const { project, history } = get();
    if (sameMeasureBuild(project, stamped)) return;
    set({
      project: stamped,
      history: [...history.slice(-40), project],
      future: [],
      plan: null,
      selectedId: null,
      activeStep: null,
      placedIds: [],
      lockedIds: [],
      dragPos: null,
    });
    persist(stamped);
  },
  setProject: (next) => {
    set({ project: next });
    persist(next);
  },
  generate: (prompt, materialId, form, opts) => {
    get().beginBuild();
    const scale = opts?.scale ?? get().buildScale;
    const current = get().project;
    let used = prompt;
    const follow = !opts?.fresh && current.prompt.trim() && looksLikeFollowOn(prompt, current.prompt);
    let mode: "auto" | "cut" | "whole" = get().cutMode;
    if (opts?.cutStock === true) mode = "cut";
    else if (opts?.cutStock === false) mode = "whole";
    else if (!follow && current.prompt.trim() !== prompt.trim()) mode = "auto";
    const keepView = !!opts?.keepView;
    const genOpts: {
      includeSpine?: boolean;
      joinMethod?: JoinMethod;
      scale: BuildScale;
      sizeOverride?: { width: number; height: number; depth: number };
      cutStock?: boolean;
      fittedOverride?: import("./types").FittedSpec;
      pocketOverride?: PocketSpec;
      honorUnit?: boolean;
    } = { ...opts, scale, cutStock: stockFlag(mode) };
    // Same object, new stock: a pocket or fitted unit rebuilds from the hole and unit on the bench
    // (with every edit made there), not from re-reading the sentence.
    // Restock rebuilds from the hole already on the bench. A caller that already
    // passed a count (shelves, cubbies, drawers) keeps that override — copying the
    // bench spec back would snap the field to the old count.
    if (opts?.restock && materialId && !opts.fittedOverride && !opts.pocketOverride) {
      const srcPocket = current.pocket ?? current.recastFrom?.pocket;
      const srcFitted = current.fitted ?? current.recastFrom?.fitted;
      if (srcPocket) genOpts.pocketOverride = srcPocket;
      else if (srcFitted && !climbIdentityLabel((current.prompt || "").toLowerCase())) {
        genOpts.fittedOverride = srcFitted;
        genOpts.honorUnit = true;
      }
    }
    if (follow) {
      used = `${current.prompt.replace(/\. Then:[\s\S]*$/, "")}. Then: ${prompt}`;
      genOpts.sizeOverride = applyFollowOnSize(current.overall, prompt);
      if (!materialId && !followOnNamesStock(prompt)) materialId = current.primaryMaterialId;
      if (/cut the sticks|cut each stick/.test(prompt.toLowerCase())) {
        mode = "cut";
        genOpts.cutStock = true;
      }
      if (/don'?t cut|whole sticks/.test(prompt.toLowerCase())) {
        mode = "whole";
        genOpts.cutStock = false;
      }
    }
    if (!materialId) materialId = materialUnlessNamed(current.primaryMaterialId, used);
    const next = generateFromPrompt(used, materialId, form, genOpts);
    const flags = defaultGhostFlags(next.kind, prompt, next.historic);
    const srcPocket = next.pocket ?? next.recastFrom?.pocket;
    const srcFitted = next.fitted ?? next.recastFrom?.fitted;
    // The wall opening stays as a faint outline (context for where the unit sits).
    if (srcPocket) flags.showHull = true;
    if (srcFitted?.opening.kind === "alcove") flags.showHull = true;
    get().commit(next);
    const angled = angleMeasureFromProject(next);
    set({
      ...flags,
      // A new build is framed fresh; the same build in a new stock keeps the angle the user chose.
      ...(keepView ? {} : { orbited: false, userView: null }),
      cutMode: mode,
      workMode: "look",
      showLoad: false,
      activeStep: null,
      placedIds: [],
      lockedIds: [],
      dragPos: null,
      selectedId: null,
      facesOpen: false,
      measureNote: null,
      undoTick: 0,
      measure: srcPocket
        ? {
            ...pocketMeasure(srcPocket),
            kind: "closet_niche" as const,
          }
        : next.windowPkg
          ? {
              width: fieldInch(next.windowPkg.window.roW),
              height: fieldInch(next.windowPkg.window.roH),
              depth: fieldInch(next.windowPkg.window.jambDepth),
              kind: "window_rough_opening",
              windowId: next.windowPkg.window.id,
            }
          : srcFitted
            ? {
                width: angled?.width ?? fieldInch(srcFitted.unit.width),
                height: angled?.height ?? fieldInch(srcFitted.unit.height),
                depth: angled?.depth ?? fieldInch(srcFitted.unit.depth),
                kind: measureKindFromProject(next),
                angle: angled?.angle,
                lowSide: angled?.lowSide,
              }
            : next.overall.width > 1
            ? {
                width: fieldInch(next.overall.width),
                height: fieldInch(next.overall.height),
                depth: fieldInch(next.overall.depth),
                kind: "general_volume" as const,
              }
            : get().measure,
    });
    return next;
  },
  setJoinMethod: (join) => {
    const { project } = get();
    get().commit({ ...project, joinMethod: join });
  },
  setDetail: (v) => set({ detail: v }),
  setBuildScale: (v) => set({ buildScale: v }),
  setCutMode: (v) => set({ cutMode: v }),
  makePlan: () => {
    const prev = get().plan;
    const plan = buildPlan(get().project);
    if (prev?.instructions?.length) {
      const photos = new Map(
        prev.instructions
          .filter((s) => s.imageDataUrl && s.imageDataUrl.startsWith("data:image"))
          .map((s) => [s.step, s.imageDataUrl as string]),
      );
      if (photos.size) {
        plan.instructions = plan.instructions.map((s) =>
          photos.has(s.step) ? { ...s, imageDataUrl: photos.get(s.step) } : s,
        );
      }
    }
    set({ plan });
    return plan;
  },
  setPlan: (plan) => set({ plan }),
  attachStepImage: (step, imageDataUrl) => {
    const plan = get().plan;
    if (!plan) return;
    const instructions = plan.instructions.map((s) =>
      s.step === step ? { ...s, imageDataUrl } : s,
    );
    set({ plan: { ...plan, instructions } });
  },
  setRender: (render) => {
    const { project, plan } = get();
    const next = { ...project, render };
    set({ project: next, plan: plan ? { ...plan, render } : plan });
    persist(next);
  },
  undo: () => {
    set({ undoTick: get().undoTick + 1 });
    const { history, future, project } = get();
    let stack = history;
    while (stack.length && sameMeasureBuild(stack[stack.length - 1], project)) stack = stack.slice(0, -1);
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    if (isBlankCube(prev)) return;
    set({
      project: prev,
      history: stack.slice(0, -1),
      future: [project, ...future],
      plan: null,
      selectedId: null,
      measure: measureFromProject(prev, get().measure),
    });
    persist(prev);
  },
  redo: () => {
    const { history, future, project } = get();
    if (!future.length) return;
    const [next, ...rest] = future;
    set({
      project: next,
      history: [...history, project],
      future: rest,
      plan: null,
      selectedId: null,
    });
    persist(next);
  },
  select: (id) => set({ selectedId: id }),
  setExplode: (v) => set({ explode: v }),
  setFacesOpen: (v) => set({ facesOpen: v }),
  setCamera: (v) => set({ camera: v, orbited: false, userView: null, viewNonce: get().viewNonce + 1 }),
  resetView: () => set({ orbited: false, userView: null, viewNonce: get().viewNonce + 1 }),
  setOrbited: (v) => {
    if (get().orbited !== v) set(v ? { orbited: true } : { orbited: false, userView: null });
  },
  setUserView: (v) => set({ userView: v }),
  setShowHull: (v) => set({ showHull: v }),
  setShowHistoric: (v) => set({ showHistoric: v }),
  setWorkMode: (v) => set({ workMode: v }),
  setShowLoad: (v) => set({ showLoad: v }),
  setActiveStep: (n) => set({ activeStep: n }),
  toggleLockSelected: () => {
    const { selectedId, lockedIds } = get();
    if (!selectedId) return;
    set({
      lockedIds: lockedIds.includes(selectedId)
        ? lockedIds.filter((id) => id !== selectedId)
        : [...lockedIds, selectedId],
    });
  },
  beginDrag: (id) => {
    const inst = get().project.instances.find((i) => i.id === id);
    if (!inst) return;
    set({ dragPos: { id, pos: { ...inst.position } }, selectedId: id });
  },
  nudgeInstance: (id, position) => {
    const { project, lockedIds } = get();
    if (lockedIds.includes(id)) return;
    set({
      project: {
        ...project,
        instances: project.instances.map((i) => (i.id === id ? { ...i, position } : i)),
      },
      dragPos: { id, pos: position },
    });
  },
  finishMove: (id, position) => {
    const { project, lockedIds, history } = get();
    if (lockedIds.includes(id)) return;
    const inst = project.instances.find((i) => i.id === id);
    if (!inst) return;
    const snapped = maybeSnap(position, homeOf(inst));
    const next = {
      ...project,
      instances: project.instances.map((i) => (i.id === id ? { ...i, position: snapped } : i)),
    };
    set({
      project: next,
      history: [...history.slice(-40), project],
      future: [],
      dragPos: null,
    });
    persist(next);
  },
  moveInstance: (id, position) => get().finishMove(id, position),
  deleteSelected: () => {
    const { project, selectedId, history } = get();
    if (!selectedId) return;
    const next = {
      ...project,
      instances: project.instances.filter((i) => i.id !== selectedId),
      panels: project.panels.filter((p) => p.id !== selectedId),
    };
    set({
      project: next,
      history: [...history.slice(-40), project],
      future: [],
      selectedId: null,
      plan: null,
    });
    persist(next);
  },
  placePiece: (catalogId, position) => {
    const { project, history } = get();
    const item = getCatalogItem(catalogId);
    if (!item) return;
    const len = defaultPlaceLength(catalogId);
    const inst = {
      id: createId("inst"),
      catalogId,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: len,
      role: "member",
      home: position,
    };
    const next = { ...project, instances: [...project.instances, inst] };
    set({
      project: next,
      history: [...history.slice(-40), project],
      future: [],
      selectedId: inst.id,
      plan: null,
    });
    persist(next);
    void toPrimitive(item, len);
  },
  setMeasureOpen: (v) => set({ measureOpen: v }),
  setMeasure: (patch) => set({ measure: { ...get().measure, ...patch } }),
  applyMeasure: (commitAngle = false) => {
    const before = get().project;
    const ask = get().measure;
    set({ measureNote: null });
    get().applyMeasureRaw(commitAngle);
    const after = get().project;
    if (after === before || get().measureNote) return;
    // Say where the build landed when the stock or the class can't hit the asked size exactly.
    const w = parseInch(ask.width);
    const h = parseInch(ask.height);
    const d = parseInch(ask.depth);
    const srcPocket = after.pocket ?? after.recastFrom?.pocket;
    const env = srcPocket?.unit ?? (after.fitted ?? after.recastFrom?.fitted)?.unit ?? after.overall;
    const off = (a: number, b: number) => Number.isFinite(a) && a > 0 && Math.abs(a - b) > 0.5;
    const parts: string[] = [];
    if (off(w, env.width)) parts.push(`${inchFrac(env.width)}" wide`);
    if (off(h, env.height)) parts.push(`${inchFrac(env.height)}" tall`);
    if (off(d, env.depth) && !srcPocket) parts.push(`${inchFrac(env.depth)}" deep`);
    if (parts.length) {
      set({ measureNote: `Lands at ${parts.join(" × ")} — the nearest this build makes in this stock.` });
    }
  },
  applyMeasureRaw: (commitAngle = false) => {
    const { measure, project } = get();
    let widthIn = parseInch(measure.width);
    const heightIn = parseInch(measure.height);
    let depthIn = parseInch(measure.depth);
    if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) return;
    // Round / diameter tables: Measure chip is Dia × H — keep plan axes equal (never W×H×W drift).
    const roundUnit = isRoundUnitEnvelope({
      width: widthIn,
      height: heightIn,
      depth: Number.isFinite(depthIn) ? depthIn : widthIn,
      shape: project.fitted?.unit?.shape,
      prompt: project.prompt,
      name: project.name,
    });
    if (roundUnit) {
      depthIn = widthIn;
    }
    const depth = Number.isFinite(depthIn) ? depthIn : undefined;
    const corner = project.fitted?.unit?.corner;
    const oddKind = project.fitted?.unit?.odd?.kind;
    if (corner || oddKind === "angled-corner") {
      const ang = parseInch(measure.angle ?? "");
      const current = corner ? 90 : Number((project.fitted?.unit?.odd?.params as { theta?: number } | undefined)?.theta ?? 90);
      const angOk = Number.isFinite(ang) && cornerAngleOk(ang);
      if (!angOk && commitAngle && (measure.angle ?? "").trim()) {
        const shown = Number.isFinite(ang) ? ang : measure.angle;
        set({
          measureNote: `${shown}° is outside the corner this shelf can be — just over 20° through just under 170°. Left it at ${current}°.`,
          measure: { ...measure, angle: String(current) },
        });
        return;
      }
      const useAng = angOk ? ang : current;
      const tiers = corner?.tiers ?? Number((project.fitted?.unit?.odd?.params as { tiers?: number } | undefined)?.tiers ?? 0);
      const prompt = stampCornerAngle(
        project.prompt || project.name,
        useAng,
        widthIn,
        depth ?? widthIn,
        heightIn,
        tiers || undefined,
        corner?.shape === "quarter" && Math.abs(useAng - 90) < 0.05,
      );
      const built = generateFromPrompt(prompt, project.primaryMaterialId);
      if (built) {
        get().commit(built);
        const next = angleMeasureFromProject(built);
        set({
          measureNote: null,
      undoTick: 0,
          measure: next ? { ...measure, ...next, kind: measure.kind } : measure,
        });
        get().makePlan();
      }
      return;
    }
    if (oddKind === "sloped") {
      const low = parseInch(measure.lowSide ?? "");
      const currentLow = Number((project.fitted?.unit?.odd?.params as { loH?: number } | undefined)?.loH ?? 0);
      const lowOk = Number.isFinite(low) && low < heightIn && low >= 12;
      if (!lowOk && commitAngle) {
        const why = Number.isFinite(low) && low >= heightIn
          ? "The low side has to be shorter than the high side. Left the slope as it was."
          : "The low side needs about 12 inches before a shelf fits under it. Left the slope as it was.";
        set({
          measureNote: why,
          measure: { ...measure, lowSide: fieldInch(currentLow) },
        });
        return;
      }
      const useLow = lowOk ? low : currentLow;
      const prompt = stampSlopeEnds(
        stampPromptSize(project.prompt || project.name, widthIn, heightIn, depth ?? project.overall.depth),
        heightIn,
        useLow,
      );
      const built = generateFromPrompt(prompt, project.primaryMaterialId);
      if (built) {
        get().commit(built);
        const next = angleMeasureFromProject(built);
        set({
          measureNote: null,
      undoTick: 0,
          measure: next ? { ...measure, ...next, kind: measure.kind } : measure,
        });
        get().makePlan();
      }
      return;
    }
    let prompt = project.prompt || project.name;
    if (roundUnit) {
      const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(n));
      const dia = fmt(widthIn);
      const H = fmt(heightIn);
      prompt = prompt
        .replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(diameter|dia\b)/i, `${dia}$2$3`)
        .replace(/(diameter|dia\.?)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i, `$1 ${dia}`)
        .replace(/(\d+(?:\.\d+)?)(\s*(?:inch(?:es)?|in|")?\s*)(tall|high|height)\b/i, `${H}$2$3`);
    }
    if (measure.kind === "window_rough_opening" || project.windowPkg) {
      const built = projectFromMeasurement(
        {
          widthIn,
          heightIn,
          depthIn: depth,
          kindHint: "window_rough_opening",
          windowId: measure.windowId ?? project.windowPkg?.window.id,
        },
        prompt,
      );
      if (built) get().commit(built);
      return;
    }
    // A pocket is also fitted. Size the hole and the shelves here, before the generic fitted rebuild, or the bay numbers are dropped.
    const pocketSrc = project.pocket ?? project.recastFrom?.pocket;
    if (pocketSrc) {
      const back = parseInch(measure.backWidth ?? "");
      const left = parseInch(measure.leftDepth ?? "");
      const right = parseInch(measure.rightDepth ?? "");
      const ceiling = parseInch(measure.ceiling ?? "");
      const leftBay = parseInch(measure.leftBay ?? "");
      const rightBay = parseInch(measure.rightBay ?? "");
      const shapeNotes: string[] = [];
      // Shape: straight sides are a rectangle; flared sides are a trapezoid at the typed wall angles.
      const flaredNow = Math.abs(pocketSrc.walls.leftAngleDeg) > 0.05 || Math.abs(pocketSrc.walls.rightAngleDeg) > 0.05;
      const shape = measure.pocketShape ?? (flaredNow ? "flared" : "straight");
      const angleOf = (raw: string | undefined, current: number, side: string) => {
        const a = parseFloat(raw ?? "");
        if (!Number.isFinite(a)) return current;
        if (a < 0 || a > 45) {
          shapeNotes.push(`A side wall flares 0° to 45° here, so the ${side} wall stays at ${Math.round(Math.min(45, Math.max(0, a)))}°.`);
          return Math.min(45, Math.max(0, a));
        }
        return a;
      };
      const leftAngleDeg = shape === "straight" ? 0 : angleOf(measure.leftAngle, pocketSrc.walls.leftAngleDeg, "left");
      const rightAngleDeg = shape === "straight" ? 0 : angleOf(measure.rightAngle, pocketSrc.walls.rightAngleDeg, "right");
      const side = measure.notchSide ?? pocketSrc.walls.notch?.side ?? "none";
      let notch: PocketNotch | undefined;
      if (side !== "none") {
        const nw = parseInch(measure.notchWidth ?? "");
        const nd = parseInch(measure.notchDepth ?? "");
        const nh = parseInch(measure.notchHeight ?? "");
        const prev = pocketSrc.walls.notch;
        notch = {
          side,
          width: Number.isFinite(nw) && nw > 0 ? nw : prev?.width ?? 6,
          depth: Number.isFinite(nd) && nd > 0 ? nd : prev?.depth ?? 4,
          height: Number.isFinite(nh) && nh > 0 ? nh : prev?.height ?? (side === "back" ? 36 : pocketSrc.walls.height),
        };
      }
      const walls = {
        ...pocketSrc.walls,
        height: Number.isFinite(ceiling) ? ceiling : pocketSrc.walls.height,
        backWidth: Number.isFinite(back) && back >= 12 ? back : pocketSrc.walls.backWidth,
        leftDepth: Number.isFinite(left) && left >= 8 ? left : pocketSrc.walls.leftDepth,
        rightDepth: Number.isFinite(right) && right >= 8 ? right : pocketSrc.walls.rightDepth,
        leftAngleDeg,
        rightAngleDeg,
        notch,
      };
      if (!notch) delete walls.notch;
      const fit = fitPocketAsk(
        { ...pocketSrc, walls },
        {
          width: widthIn,
          height: heightIn,
          depth: depth ?? pocketSrc.unit.depth,
          ceiling: walls.height,
          leftBay: Number.isFinite(leftBay) ? leftBay : undefined,
          rightBay: Number.isFinite(rightBay) ? rightBay : undefined,
        },
      );
      if (fit.note) fit.spec.clampNote = fit.note;
      // Same stock as the build on the bench: a pocket switched to 2×4 or popsicle stays that stock.
      const builtRaw = generateFromPrompt(prompt, rebuildStock(project), undefined, { pocketOverride: fit.spec });
      const fittedSrc0 = project.fitted ?? project.recastFrom?.fitted;
      const built = builtRaw && fittedSrc0 && builtRaw.pocket
        ? {
            ...builtRaw,
            fitted: {
              ...fittedSrc0,
              walls: fit.spec.walls,
              unit: { ...fittedSrc0.unit, ...fit.spec.unit },
            },
          }
        : builtRaw;
      if (built) {
        get().commit(built);
        const note = [fit.note, ...shapeNotes].filter(Boolean).join(" ");
        set({
          measureNote: note || null,
          measure: {
            ...get().measure,
            ...pocketMeasure(built.pocket ?? fit.spec),
          },
        });
      }
      return;
    }
    const fittedSrc = project.fitted ?? project.recastFrom?.fitted;
    if (fittedSrc) {
      // Stolen Bench fitted on a climb/step stool — rebuild weekend form, keep Measure size.
      if (climbIdentityLabel((project.prompt || prompt).toLowerCase())) {
        const built = generateFromPrompt(prompt, project.primaryMaterialId, undefined, {
          sizeOverride: {
            width: widthIn,
            height: heightIn,
            depth: depth ?? fittedSrc.unit.depth,
          },
          joinMethod: project.joinMethod,
        });
        if (built) get().commit(built);
        return;
      }
      const spec = {
        ...fittedSrc,
        opening: {
          ...fittedSrc.opening,
          width: Number.isFinite(parseInch(measure.openingWidth ?? "")) ? parseInch(measure.openingWidth ?? "") : widthIn,
          height: Number.isFinite(parseInch(measure.openingHeight ?? "")) ? parseInch(measure.openingHeight ?? "") : heightIn,
          depth: Number.isFinite(parseInch(measure.openingDepth ?? "")) ? parseInch(measure.openingDepth ?? "") : depth ?? fittedSrc.opening.depth,
        },
        unit: {
          ...fittedSrc.unit,
          width: widthIn,
          height: heightIn,
          depth: depth ?? fittedSrc.unit.depth,
        },
      };
      if (spec.walls && measure.backWidth) {
        const back = parseInch(measure.backWidth);
        const left = parseInch(measure.leftDepth ?? "");
        const right = parseInch(measure.rightDepth ?? "");
        spec.walls = {
          ...spec.walls,
          height: heightIn,
          backWidth: Number.isFinite(back) ? back : spec.walls.backWidth,
          leftDepth: Number.isFinite(left) ? left : spec.walls.leftDepth,
          rightDepth: Number.isFinite(right) ? right : spec.walls.rightDepth,
        };
      }
      const built = generateFromPrompt(prompt, rebuildStock(project), undefined, { fittedOverride: spec, honorUnit: true });
      if (built) get().commit(built);
      return;
    }
    // Weekend forms take the same three numbers as a closet. Never rebuild them as a carcase.
    const houseCarcase =
      project.kind === "closet" ||
      project.kind === "opening" ||
      !!project.fitted ||
      !!project.pocket ||
      !!project.windowPkg;
    if (!houseCarcase && (project.instances.length > 0 || project.panels.length > 0)) {
      const built = generateFromPrompt(prompt, project.primaryMaterialId, undefined, {
        sizeOverride: {
          width: widthIn,
          height: heightIn,
          depth: depth ?? project.overall.depth,
        },
        joinMethod: project.joinMethod,
        includeSpine: project.supportOffer?.included,
        scale: get().buildScale,
      });
      if (built) {
        get().commit(built);
        const n = fieldInch;
        set({
          measure: {
            ...get().measure,
            width: n(built.overall.width),
            height: n(built.overall.height),
            depth: n(built.overall.depth),
            kind: "general_volume",
          },
        });
      }
      return;
    }
    const built = projectFromMeasurement(
      {
        widthIn,
        heightIn,
        depthIn: depth,
        kindHint: measure.kind === "closet_niche" ? measure.kind : undefined,
      },
      prompt,
    );
    if (built) get().commit(built);
  },
  liftTo3d: () => {
    const { project } = get();
    const lifted = liftFlatTo3d(project);
    if (lifted) get().commit(lifted);
    return lifted;
  },
  reset: () => {
    armBuilding();
    clearProject();
    set({
      project: emptyProject(),
      plan: null,
      selectedId: null,
      history: [],
      future: [],
      activeStep: null,
      placedIds: [],
      lockedIds: [],
      dragPos: null,
      building: false,
      grokBusy: false,
      grokError: null,
    });
  },
}));

export function hydrateYard() {
  if (typeof window === "undefined") return;
  const loaded = loadProject();
  if (!loaded) return;
  const flags = defaultGhostFlags(loaded.kind, loaded.prompt, loaded.historic);
  useYard.setState({
    project: {
      ...loaded,
      instances: withHome(loaded.instances),
    },
    ...flags,
  });
}
