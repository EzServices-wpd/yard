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
  camera: "iso" | "front" | "side" | "top";
  showDims: boolean;
  showHull: boolean;
  showHistoric: boolean;
  workMode: WorkMode;
  detail: DetailLevel;
  buildScale: BuildScale;
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
  generate: (prompt: string, materialId?: string, form?: FormRecipe, opts?: { includeSpine?: boolean; joinMethod?: JoinMethod; scale?: BuildScale; fresh?: boolean }) => YardProject;
  setJoinMethod: (join: JoinMethod) => void;
  setDetail: (v: DetailLevel) => void;
  setBuildScale: (v: BuildScale) => void;
  makePlan: () => BuildPlan;
  setPlan: (plan: BuildPlan | null) => void;
  setRender: (render: NonNullable<YardProject["render"]>) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setExplode: (v: boolean) => void;
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
  /** Lift a prompt-native 2D paper layout into a dual-face 3D model. */
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

let revealTimer: ReturnType<typeof setTimeout> | null = null;

export const useYard = create<YardState>((set, get) => ({
  project: emptyProject(),
  plan: null,
  selectedId: null,
  explode: false,
  camera: "iso",
  showDims: true,
  showHull: false,
  showHistoric: false,
  workMode: "look",
  detail: "fill",
  buildScale: "full" as BuildScale,
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
  revealBench: () => {
    if (revealTimer) clearTimeout(revealTimer);
    const wait = get().grokBusy ? 220 : 720;
    revealTimer = setTimeout(() => {
      revealTimer = null;
      if (get().grokBusy) return;
      set({ building: false });
    }, wait);
  },
  commit: (next) => {
    const { project } = get();
    set({
      project: next,
      history: [...get().history, project].slice(-40),
      future: [],
      plan: null,
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
    const genOpts: {
      includeSpine?: boolean;
      joinMethod?: JoinMethod;
      scale: BuildScale;
      sizeOverride?: { width: number; height: number; depth: number };
      cutStock?: boolean;
    } = { ...opts, scale };
    if (!opts?.fresh && current.prompt.trim() && looksLikeFollowOn(prompt, current.prompt)) {
      used = `${current.prompt.replace(/\. Then:[\s\S]*$/, "")}. Then: ${prompt}`;
      genOpts.sizeOverride = applyFollowOnSize(current.overall, prompt);
      if (!materialId && !followOnNamesStock(prompt)) materialId = current.primaryMaterialId;
      if (/cut the sticks|cut each stick/.test(prompt.toLowerCase())) genOpts.cutStock = true;
      if (/don'?t cut|whole sticks/.test(prompt.toLowerCase())) genOpts.cutStock = false;
    }
    const next = generateFromPrompt(used, materialId, form, genOpts);
    const flags = defaultGhostFlags(next.kind, prompt, next.historic);
    if (next.pocket) flags.showHull = true;
    if (next.fitted?.opening.kind === "alcove") flags.showHull = true;
    get().commit(next);
    set({
      ...flags,
      workMode: "look",
      showLoad: false,
      activeStep: null,
      placedIds: [],
      lockedIds: [],
      dragPos: null,
      selectedId: null,
      measure: next.pocket
        ? {
            width: String(next.pocket.unit.width),
            height: String(next.pocket.unit.height),
            depth: String(next.pocket.unit.depth),
            kind: "closet_niche",
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
    get().revealBench();
    return next;
  },
  setJoinMethod: (join) => {
    const { project, generate, makePlan } = get();
    if (project.prompt.trim()) {
      generate(project.prompt, project.primaryMaterialId, undefined, {
        includeSpine: project.supportOffer?.included,
        joinMethod: join,
      });
      makePlan();
    } else {
      get().setProject({ ...project, joinMethod: join });
    }
  },
  setDetail: (v) => set({ detail: v }),
  setBuildScale: (v) => {
    set({ buildScale: v });
    const { project, generate, makePlan } = get();
    if (project.prompt.trim()) {
      generate(project.prompt, project.primaryMaterialId, undefined, {
        includeSpine: project.supportOffer?.included,
        joinMethod: project.joinMethod,
        scale: v,
      });
      makePlan();
    }
  },
  makePlan: () => {
    const plan = buildPlan(get().project);
    set({ plan });
    return plan;
  },
  setPlan: (plan) => set({ plan }),
  setRender: (render) => {
    const { project, plan, commit } = get();
    commit({ ...project, render });
    if (plan) set({ plan: { ...plan, render } });
  },
  undo: () => {
    const { history, project, future } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    set({
      project: prev,
      history: history.slice(0, -1),
      future: [project, ...future].slice(0, 40),
      plan: null,
    });
    persist(prev);
  },
  redo: () => {
    const { future, project, history } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      project: next,
      history: [...history, project].slice(-40),
      future: future.slice(1),
      plan: null,
    });
    persist(next);
  },
  select: (id) => set({ selectedId: id }),
  setExplode: (v) => set({ explode: v }),
  setCamera: (v) => set({ camera: v }),
  setShowHull: (v) => set({ showHull: v }),
  setShowHistoric: (v) => set({ showHistoric: v }),
  setWorkMode: (v) => {
    const { project } = get();
    const mode: WorkMode = v === "walk" && !project.traverse ? "look" : v === "build" ? "look" : v;
    set({
      workMode: mode,
      dragPos: null,
    });
  },
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
  beginDrag: () => {
    /* snapshot handled in finishMove via pre-nudge commit */
  },
  nudgeInstance: (id, position) => {
    set({ dragPos: { id, pos: position } });
  },
  finishMove: (id, position) => {
    const { project, commit, workMode, placedIds, lockedIds } = get();
    const inst = project.instances.find((i) => i.id === id);
    if (!inst) {
      set({ dragPos: null });
      return;
    }
    const home = homeOf(inst);
    if (workMode === "build") {
      if (nearHome(position, home)) {
        const next = {
          ...project,
          instances: project.instances.map((i) =>
            i.id === id ? { ...i, position: { ...home } } : i,
          ),
        };
        commit(next);
        set({
          placedIds: placedIds.includes(id) ? placedIds : [...placedIds, id],
          dragPos: null,
          selectedId: id,
        });
        return;
      }
      set({ dragPos: null });
      return;
    }
    const snapped = maybeSnap(position, home);
    commit({
      ...project,
      instances: project.instances.map((i) => (i.id === id ? { ...i, position: snapped } : i)),
    });
    set({
      dragPos: null,
      lockedIds: snapped === position || !nearHome(snapped, home) ? lockedIds : lockedIds,
    });
  },
  moveInstance: (id, position) => {
    get().nudgeInstance(id, position);
  },
  deleteSelected: () => {
    const { selectedId, project, commit } = get();
    if (!selectedId) return;
    commit({
      ...project,
      instances: project.instances.filter((i) => i.id !== selectedId),
      panels: project.panels.filter((p) => p.id !== selectedId),
    });
    set({
      selectedId: null,
      placedIds: get().placedIds.filter((id) => id !== selectedId),
      lockedIds: get().lockedIds.filter((id) => id !== selectedId),
    });
  },
  placePiece: (catalogId, position) => {
    if (get().workMode !== "free") return;
    const { project, commit } = get();
    const item = getCatalogItem(catalogId);
    const prim = item ? toPrimitive(item) : null;
    const y = (prim?.length ?? defaultPlaceLength(catalogId)) / 2;
    const id = createId("pc");
    const pos = { ...position, y };
    commit({
      ...project,
      primaryMaterialId: catalogId,
      instances: [
        ...project.instances,
        {
          id,
          catalogId,
          position: pos,
          home: { ...pos },
          rotation: { x: 0, y: 0, z: 0 },
        },
      ],
    });
    set({ selectedId: id });
  },
  setMeasureOpen: (v) => set({ measureOpen: v }),
  setMeasure: (patch) => set({ measure: { ...get().measure, ...patch } }),
  applyMeasure: () => {
    const { measure, commit, project } = get();
    const w = parseFloat(measure.width);
    const h = parseFloat(measure.height);
    const d = parseFloat(measure.depth);
    if (!w || !h) return;
    if (project.fitted && !project.pocket) {
      const unit = { ...project.fitted.unit, width: w, height: h, depth: d || project.fitted.unit.depth };
      const built = buildFitted({ ...project.fitted, unit }, project.prompt);
      commit({ ...built, id: project.id });
      set({ showHull: true, showHistoric: false, workMode: "look", placedIds: [], activeStep: null });
      return;
    }
    if (project.pocket) {
      const unit = { ...project.pocket.unit, width: w, height: h, depth: d || project.pocket.unit.depth };
      const built = buildPocket({ ...project.pocket, unit, leftClear: 0, rightClear: 0 }, project.prompt);
      commit({ ...built, id: project.id });
      set({ showHull: true, showHistoric: false, workMode: "look", placedIds: [], activeStep: null });
      return;
    }
    const built = projectFromMeasurement(
      {
        widthIn: w,
        heightIn: h,
        depthIn: d || undefined,
        kindHint: measure.kind,
        windowId: measure.windowId,
      },
      `${w} x ${h} x ${d || 0} ${measure.kind.replaceAll("_", " ")}`,
    );
    const keepId = get().project.kind === "closet" || get().project.kind === "opening";
    commit({
      ...built,
      id: keepId ? get().project.id : built.id,
      instances: withHome(built.instances),
    });
    set({
      showHull: true,
      showHistoric: false,
      workMode: "look",
      placedIds: [],
      activeStep: null,
    });
  },
  liftTo3d: () => {
    const { project, commit } = get();
    if (!project.flat || project.flat.lifted) return null;
    const next = liftFlatTo3d(project);
    commit({
      ...next,
      id: project.id,
      instances: withHome(next.instances),
    });
    set({
      plan: null,
      showHull: true,
      showHistoric: false,
      workMode: "look",
      placedIds: [],
      activeStep: null,
      selectedId: null,
    });
    return next;
  },
  reset: () => {
    clearProject();
    set({
      project: emptyProject(),
      plan: null,
      selectedId: null,
      history: [],
      future: [],
      placedIds: [],
      lockedIds: [],
      dragPos: null,
      activeStep: null,
      showHull: false,
      showHistoric: false,
      workMode: "look",
      showLoad: false,
    });
  },
}));

export function hydrateYard() {
  const loaded = loadProject();
  const flags = defaultGhostFlags(loaded.kind, loaded.prompt, loaded.historic);
  useYard.setState({
    project: {
      ...loaded,
      instances: withHome(loaded.instances),
    },
    ...flags,
  });
}
