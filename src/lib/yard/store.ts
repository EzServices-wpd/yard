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
import { projectFromMeasurement } from "./space";
import { buildPocket } from "./pocket";
import { buildFitted } from "./fitted";
import { liftFlatTo3d } from "./flatLayout";

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
  history: YardProject[];
  future: YardProject[];
  building: boolean;
  grokBusy: boolean;
  grokError: string | null;
  showLoad: boolean;
  revealBench: () => void;
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
  applyMeasure: () => void;
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
  facesOpen: true,
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
  history: [],
  future: [],
  building: false,
  grokBusy: false,
  grokError: null,
  showLoad: false,
  revealBench: () => set({ building: false }),
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
    set({ building: true, grokError: null });
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
    if (next.pocket) flags.showHull = true;
    if (next.fitted?.opening.kind === "alcove") flags.showHull = true;
    get().commit(next);
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
      facesOpen: true,
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
                width: String(next.fitted.unit.width),
                height: String(next.fitted.unit.height),
                depth: String(next.fitted.unit.depth),
                kind: next.fitted.opening.kind === "alcove" ? "closet_niche" : "general_volume",
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
  applyMeasure: () => {
    const { measure, project } = get();
    const built = projectFromMeasurement(measure, project.prompt || project.name);
    if (built) get().commit(built);
  },
  liftTo3d: () => {
    const { project } = get();
    const lifted = liftFlatTo3d(project);
    if (lifted) get().commit(lifted);
    return lifted;
  },
  reset: () => {
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
