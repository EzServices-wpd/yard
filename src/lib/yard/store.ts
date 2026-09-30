import { solveModel } from "./solve";
import { create } from "zustand";
import { createId } from "@/lib/utils";
import type { BuildPlan, BuildScale, DetailLevel, JoinMethod, MeasureDraft, Vec3, WorkMode, YardProject } from "./types";
import { emptyProject, generateFromPrompt } from "./prompt";
import { applyFollowOnSize, followOnNamesStock, looksLikeFollowOn } from "./promptHelpers";
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
import { buildPocket } from "./pocket";
import { buildFitted } from "./fitted";
import { liftFlatTo3d } from "./flatLayout";

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

type YardState = {
  project: YardProject;
  plan: BuildPlan | null;
  selectedId: string | null;
  explode: boolean;
  facesOpen: boolean;
  camera: "iso" | "front" | "side" | "top";
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
  generate: (prompt: string, materialId?: string, form?: FormRecipe, opts?: { includeSpine?: boolean; joinMethod?: JoinMethod; scale?: BuildScale; fresh?: boolean; cutStock?: boolean; fittedOverride?: import("./types").FittedSpec }) => YardProject;
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
  liftTo3d: () => YardProject | null;
  reset: () => void;
};

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
    const { project, history } = get();
    set({
      project: next,
      history: [...history.slice(-40), project],
      future: [],
      plan: null,
      selectedId: null,
      activeStep: null,
      placedIds: [],
      lockedIds: [],
      dragPos: null,
    });
    persist(next);
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
    const genOpts: {
      includeSpine?: boolean;
      joinMethod?: JoinMethod;
      scale: BuildScale;
      sizeOverride?: { width: number; height: number; depth: number };
      cutStock?: boolean;
      fittedOverride?: import("./types").FittedSpec;
    } = { ...opts, scale, cutStock: stockFlag(mode) };
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
    const next = generateFromPrompt(used, materialId, form, genOpts);
    const flags = defaultGhostFlags(next.kind, prompt, next.historic);
    // The wall opening stays as a faint outline (context for where the unit sits).
    if (next.pocket) flags.showHull = true;
    if (next.fitted?.opening.kind === "alcove") flags.showHull = true;
    get().commit(next);
    const angled = angleMeasureFromProject(next);
    set({
      ...flags,
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
      measure: next.pocket
        ? {
            width: String(next.pocket.unit.width),
            height: String(next.pocket.unit.height),
            depth: String(next.pocket.unit.depth),
            kind: "closet_niche",
            backWidth: String(next.pocket.walls.backWidth),
            leftDepth: String(next.pocket.walls.leftDepth),
            rightDepth: String(next.pocket.walls.rightDepth),
          }
        : next.windowPkg
          ? {
              width: String(next.windowPkg.window.roW),
              height: String(next.windowPkg.window.roH),
              depth: String(next.windowPkg.window.jambDepth),
              kind: "window_rough_opening",
              windowId: next.windowPkg.window.id,
            }
          : next.fitted
            ? {
                width: angled?.width ?? String(next.fitted.unit.width),
                height: angled?.height ?? String(next.fitted.unit.height),
                depth: angled?.depth ?? String(next.fitted.unit.depth),
                kind: measureKindFromProject(next),
                angle: angled?.angle,
                lowSide: angled?.lowSide,
              }
            : next.overall.width > 1
            ? {
                width: String(Math.round(next.overall.width * 10) / 10),
                height: String(Math.round(next.overall.height * 10) / 10),
                depth: String(Math.round(next.overall.depth * 10) / 10),
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
    const { history, future, project } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    set({
      project: prev,
      history: history.slice(0, -1),
      future: [project, ...future],
      plan: null,
      selectedId: null,
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
  setCamera: (v) => set({ camera: v }),
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
    const snapped = maybeSnap(position, homeOf(inst), 1.25);
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
    const len = defaultPlaceLength(item);
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
    const { measure, project } = get();
    let widthIn = parseFloat(measure.width);
    const heightIn = parseFloat(measure.height);
    let depthIn = parseFloat(measure.depth);
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
      const ang = parseFloat(measure.angle ?? "");
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
          measure: next ? { ...measure, ...next, kind: measure.kind } : measure,
        });
        get().makePlan();
      }
      return;
    }
    if (oddKind === "sloped") {
      const low = parseFloat(measure.lowSide ?? "");
      const currentLow = Number((project.fitted?.unit?.odd?.params as { loH?: number } | undefined)?.loH ?? 0);
      const lowOk = Number.isFinite(low) && low < heightIn && low >= 12;
      if (!lowOk && commitAngle) {
        const why = Number.isFinite(low) && low >= heightIn
          ? "The low side has to be shorter than the high side. Left the slope as it was."
          : "The low side needs about 12 inches before a shelf fits under it. Left the slope as it was.";
        set({
          measureNote: why,
          measure: { ...measure, lowSide: String(currentLow) },
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
          measure: next ? { ...measure, ...next, kind: measure.kind } : measure,
        });
        get().makePlan();
      }
      return;
    }
    let prompt = stampPromptSize(project.prompt || project.name, widthIn, heightIn, depth ?? (parseFloat(measure.depth) || 16));
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
    if (project.fitted) {
      // Stolen Bench fitted on a climb/step stool — rebuild weekend form, keep Measure size.
      if (climbIdentityLabel((project.prompt || prompt).toLowerCase())) {
        const built = generateFromPrompt(prompt, project.primaryMaterialId, undefined, {
          sizeOverride: {
            width: widthIn,
            height: heightIn,
            depth: depth ?? project.fitted.unit.depth,
          },
          joinMethod: project.joinMethod,
        });
        if (built) get().commit(built);
        return;
      }
      const spec = {
        ...project.fitted,
        opening: {
          ...project.fitted.opening,
          width: widthIn,
          height: heightIn,
          depth: depth ?? project.fitted.opening.depth,
        },
        unit: {
          ...project.fitted.unit,
          width: widthIn,
          height: heightIn,
          depth: depth ?? project.fitted.unit.depth,
        },
      };
      if (spec.walls && measure.backWidth) {
        const back = parseFloat(measure.backWidth);
        const left = parseFloat(measure.leftDepth ?? "");
        const right = parseFloat(measure.rightDepth ?? "");
        spec.walls = {
          ...spec.walls,
          height: heightIn,
          backWidth: Number.isFinite(back) ? back : spec.walls.backWidth,
          leftDepth: Number.isFinite(left) ? left : spec.walls.leftDepth,
          rightDepth: Number.isFinite(right) ? right : spec.walls.rightDepth,
        };
      }
      const built = generateFromPrompt(prompt, undefined, undefined, { fittedOverride: spec, honorUnit: true });
      if (built) get().commit(built);
      return;
    }
    if (project.pocket) {
      const back = parseFloat(measure.backWidth ?? "");
      const left = parseFloat(measure.leftDepth ?? "");
      const right = parseFloat(measure.rightDepth ?? "");
      // Re-measured pocket goes through the same interference solve as every generated build.
      const built = solveModel(buildPocket(
        {
          ...project.pocket,
          walls: {
            ...project.pocket.walls,
            height: heightIn,
            backWidth: Number.isFinite(back) ? back : project.pocket.walls.backWidth,
            leftDepth: Number.isFinite(left) ? left : project.pocket.walls.leftDepth,
            rightDepth: Number.isFinite(right) ? right : project.pocket.walls.rightDepth,
          },
          unit: {
            ...project.pocket.unit,
            width: widthIn,
            height: heightIn,
            depth: depth ?? project.pocket.unit.depth,
          },
        },
        prompt,
      ));
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
        const n = (v: number) => String(Math.round(v * 10) / 10);
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
        kindHint: measure.kind === "closet_niche" || measure.kind === "window_rough_opening" ? measure.kind : undefined,
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
