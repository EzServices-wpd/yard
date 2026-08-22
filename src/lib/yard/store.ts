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
  detail: "standard",
  buildScale: "room",
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
    set({ showLoad: true });
    revealTimer = setTimeout(() => set({ showLoad: false }), 1800);
  },

  commit: (next) => {
    const { project } = get();
    persist(next);
    set({
      project: next,
      history: [...get().history, project].slice(-40),
      future: [],
    });
  },

  setProject: (next) => {
    persist(next);
    set({ project: next });
  },

  generate: (prompt, materialId, form, opts) => {
    set({ building: true, grokError: null });
    try {
      const keepId = !opts?.fresh && get().project.instances.length > 0;
      const built = generateFromPrompt(prompt, materialId, form, {
        ...opts,
        detail: get().detail,
        scale: opts?.scale ?? get().buildScale,
        joinMethod: opts?.joinMethod ?? get().project.joinMethod,
      });
      const next: YardProject = {
        ...built,
        id: keepId ? get().project.id : built.id,
        instances: withHome(built.instances),
      };
      // pocket / fitted follow-ons
      if (next.pocket) {
        Object.assign(next.pocket.unit, {
          width: String(next.pocket.unit.width),
          height: String(next.pocket.unit.height),
          depth: String(next.pocket.unit.depth),
        });
      }
      get().commit(next);
      set({
        showHull: true,
        showHistoric: false,
        workMode: "look",
        placedIds: [],
        activeStep: null,
        plan: null,
        selectedId: null,
      });
      return next;
    } finally {
      set({ building: false });
    }
  },

  setJoinMethod: (join) => {
    const { project, commit } = get();
    commit({ ...project, joinMethod: join });
  },

  setDetail: (v) => set({ detail: v }),
  setBuildScale: (v) => set({ buildScale: v }),

  makePlan: () => {
    const plan = buildPlan(get().project);
    set({ plan });
    return plan;
  },

  setPlan: (plan) => set({ plan }),

  setRender: (render) => {
    const { project, commit } = get();
    commit({ ...project, render });
  },

  undo: () => {
    const { history, project, future } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    persist(prev);
    set({
      project: prev,
      history: history.slice(0, -1),
      future: [project, ...future].slice(0, 40),
      plan: null,
    });
  },

  redo: () => {
    const { history, project, future } = get();
    if (!future.length) return;
    const next = future[0];
    persist(next);
    set({
      project: next,
      history: [...history, project].slice(-40),
      future: future.slice(1),
      plan: null,
    });
  },

  select: (id) => set({ selectedId: id }),
  setExplode: (v) => set({ explode: v }),
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
        ? lockedIds.filter((x) => x !== selectedId)
        : [...lockedIds, selectedId],
    });
  },

  beginDrag: (id) => {
    const inst = get().project.instances.find((i) => i.id === id);
    if (!inst) return;
    set({ dragPos: { id, pos: { ...inst.position } } });
  },

  nudgeInstance: (id, position) => {
    const { project } = get();
    const instances = project.instances.map((i) =>
      i.id === id ? { ...i, position: { ...position } } : i,
    );
    set({ project: { ...project, instances }, dragPos: { id, pos: position } });
  },

  finishMove: (id, position) => {
    const { project, commit, lockedIds } = get();
    if (lockedIds.includes(id)) return;
    const snapped = maybeSnap(project, id, position);
    const instances = project.instances.map((i) =>
      i.id === id ? { ...i, position: snapped } : i,
    );
    commit({ ...project, instances });
    set({ dragPos: null });
  },

  moveInstance: (id, position) => {
    const { project, lockedIds } = get();
    if (lockedIds.includes(id)) return;
    const instances = project.instances.map((i) =>
      i.id === id ? { ...i, position: { ...position } } : i,
    );
    set({ project: { ...project, instances } });
  },

  deleteSelected: () => {
    const { project, selectedId, commit, lockedIds } = get();
    if (!selectedId || lockedIds.includes(selectedId)) return;
    commit({
      ...project,
      instances: project.instances.filter((i) => i.id !== selectedId),
    });
    set({ selectedId: null });
  },

  placePiece: (catalogId, position) => {
    const { project, commit } = get();
    const item = getCatalogItem(catalogId);
    if (!item) return;
    const prim = toPrimitive(item);
    const len = defaultPlaceLength(item);
    const inst = {
      id: createId("p"),
      catalogId,
      position: { ...position },
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: len,
      role: "rail" as const,
      join: project.joinMethod || "glue",
      from: position,
      to: { x: position.x + len, y: position.y, z: position.z },
    };
    commit({
      ...project,
      instances: withHome([...project.instances, inst]),
    });
    set({ selectedId: inst.id, workMode: "place" });
  },

  setMeasureOpen: (v) => set({ measureOpen: v }),
  setMeasure: (patch) => set({ measure: { ...get().measure, ...patch } }),

  applyMeasure: () => {
    const { measure, commit } = get();
    const built = projectFromMeasurement(measure);
    if (!built) return;
    commit({
      ...built,
      instances: withHome(built.instances),
    });
    set({
      measureOpen: false,
      showHull: true,
      workMode: "look",
      plan: null,
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
      activeStep: null,
      dragPos: null,
      measure: defaultMeasure,
      measureOpen: false,
      explode: false,
      showHull: false,
      showHistoric: false,
      workMode: "look",
      building: false,
      grokBusy: false,
      grokError: null,
    });
  },
}));

// hydrate on load
if (typeof window !== "undefined") {
  const saved = loadProject();
  if (saved) {
    useYard.setState({ project: saved });
  }
}
