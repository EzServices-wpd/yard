export type FormFactor =
  | "stick"
  | "dowel"
  | "tube"
  | "pipe"
  | "sheet"
  | "board"
  | "block"
  | "roll"
  | "custom";

export type JoinMethod =
  | "glue"
  | "friction"
  | "notch"
  | "screw"
  | "nail"
  | "tape"
  | "cable_tie"
  | "slot"
  | "pin"
  | "solvent"
  | "none";

export type CatalogCategory =
  | "craft_wood"
  | "paper_tube"
  | "pvc_plumbing"
  | "lumber"
  | "sheet_goods"
  | "dowel_rod"
  | "cardboard"
  | "foam"
  | "metal"
  | "plastic"
  | "recycled"
  | "hardware"
  | "other";

export type CatalogItem = {
  id: string;
  name: string;
  brand?: string;
  category: CatalogCategory;
  formFactor: FormFactor;
  dims: {
    length?: number;
    width?: number;
    height?: number;
    thickness?: number;
    diameter?: number;
    innerDiameter?: number;
  };
  unitsPerPack?: number;
  unitCostUsd?: number;
  aliases?: string[];
  tags?: string[];
  preferredJoins?: JoinMethod[];
  canCut?: boolean;
  color?: string;
  roughness?: number;
  metalness?: number;
  searchQuery?: string;
  exampleUrl?: string;
  notes?: string;
};

export type Vec3 = { x: number; y: number; z: number };

export type StructureKind =
  | "eiffel"
  | "lattice"
  | "tower"
  | "taj"
  | "pyramid"
  | "castle"
  | "bridge"
  | "house"
  | "wall"
  | "dome"
  | "arch"
  | "ladder"
  | "frame"
  | "closet"
  | "opening"
  | "figure"
  | "vehicle"
  | "furniture"
  | "vessel"
  | "plant"
  | "custom";

export type WorkMode = "look" | "free" | "build";

export type YardInstance = {
  id: string;
  catalogId: string;
  position: Vec3;
  rotation: Vec3;
  cutLength?: number;
  role?: string;
  join?: string;
  /** Original generated seat — snap target. */
  home?: Vec3;
  /** Exact member ends after stock mapping. */
  from?: Vec3;
  to?: Vec3;
};

export type PanelType =
  | "upright"
  | "shelf"
  | "divider"
  | "top"
  | "bottom"
  | "back"
  | "door"
  | "glass_panel"
  | "counter"
  | "drawer"
  | "kick"
  | "mirror"
  | "rail";

export type Panel = {
  id: string;
  type: PanelType;
  name: string;
  position: Vec3;
  size: { width: number; height: number; depth: number };
  materialId: string;
  cutouts?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }[];
};

export type OpeningKind = "alcove" | "window" | "room" | "pocket";

export type PocketWalls = {
  backWidth: number;
  leftDepth: number;
  rightDepth: number;
  height: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
};

export type PocketUnit = {
  width: number;
  depth: number;
  height: number;
  vanityH: number;
  kneeW: number;
  upperStart: number;
};

export type PocketSpec = {
  walls: PocketWalls;
  unit: PocketUnit;
  leftClear: number;
  rightClear: number;
};

export type FittedProgram =
  | "vanity"
  | "closet"
  | "pantry"
  | "wardrobe"
  | "desk"
  | "bookcase"
  | "media"
  | "bench"
  | "storage";

export type FittedUnit = {
  width: number;
  depth: number;
  height: number;
  counterH?: number;
  kneeW?: number;
  upperStart?: number;
  shelfCount?: number;
  drawersPerBank?: number;
  doors?: boolean;
  mirror?: boolean;
  rod?: boolean;
  centered?: boolean;
};

export type FittedSpec = {
  program: FittedProgram;
  name: string;
  opening: { width: number; height: number; depth: number; kind: OpeningKind };
  unit: FittedUnit;
  walls?: PocketWalls;
  leftClear?: number;
  rightClear?: number;
};

export type YardProject = {
  id: string;
  name: string;
  prompt: string;
  kind: StructureKind;
  overall: { width: number; height: number; depth: number };
  instances: YardInstance[];
  panels: Panel[];
  primaryMaterialId: string;
  notes: string[];
  historic?: boolean;
  supportOffer?: {
    needed: boolean;
    included: boolean;
    reason: string;
  };
  buildStats?: {
    joints: number;
    components: number;
    loose: number;
    pieces: number;
  };
  opening?: {
    width: number;
    height: number;
    depth: number;
    kind: OpeningKind;
  };
  pocket?: PocketSpec;
  fitted?: FittedSpec;
  windowPkg?: WindowPackage;
  render?: {
    url: string;
    prompt: string;
    scene?: string;
  };
  assumptions: {
    load: "light" | "medium" | "heavy";
    units: "inches";
    installMode: "wall" | "freestanding" | "alcove";
    wallType: "wood_stud" | "drywall_only" | "masonry" | "concrete";
  };
};

export type FeasibilityIssue = {
  severity: "info" | "warning" | "critical";
  message: string;
  suggestion?: string;
};

export type CutLine = {
  id: string;
  name: string;
  quantity: number;
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  material: string;
  notes?: string;
};

export type BomLine = {
  name: string;
  quantity: number;
  unit: string;
  searchQuery?: string;
  estimatedCost?: number;
  notes?: string;
};

export type AssemblyStep = {
  step: number;
  title: string;
  description: string;
  partsUsed?: string[];
  tips?: string;
};

export type BuildPlan = {
  feasibility: {
    status: "ok" | "warnings" | "critical";
    summary: string;
    issues: FeasibilityIssue[];
  };
  cutList: CutLine[];
  bom: BomLine[];
  instructions: AssemblyStep[];
  totals: {
    pieces: number;
    estCostUsd: number;
    packs: number;
  };
  generatedAt: string;
  grokNotes?: string;
  render?: {
    url: string;
    prompt: string;
    scene?: string;
  };
};

export type SpaceKind = "closet_niche" | "window_rough_opening" | "shelving_alcove" | "general_volume";

export type WindowStyle = "double_hung" | "casement" | "slider" | "picture" | "awning";

export type StockWindow = {
  id: string;
  brand: string;
  line: string;
  style: WindowStyle;
  callW: number;
  callH: number;
  unitW: number;
  unitH: number;
  roW: number;
  roH: number;
  jambDepth: number;
  unitCostUsd: number;
  searchQuery: string;
  notes?: string;
};

export type WindowPackage = {
  window: StockWindow;
  wallHeight: number;
  stud: "2x4" | "2x6";
  sillHeight: number;
  header: { nominal: "2x6" | "2x8" | "2x10"; plies: number; depth: number; length: number };
  shimW: number;
  shimH: number;
};

export type MeasureDraft = {
  width: string;
  height: string;
  depth: string;
  kind: SpaceKind;
  windowId?: string;
};

export type ExportOptions = {
  check: boolean;
  cuts: boolean;
  buy: boolean;
  steps: boolean;
  plates: boolean;
  format: "print" | "markdown" | "html";
};
