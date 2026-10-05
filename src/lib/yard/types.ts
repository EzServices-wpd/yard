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

/** A whole product the bench draws as itself, not as a stick or a pipe. */
export type StockShape = "bottle" | "can" | "jar" | "tank" | "tool" | "eyewear" | "ball" | "cup" | "bucket" | "roll" | "block" | "object";

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
  | "staple"
  | "zip"
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
  /** Set when this unit is a product (a bottle), so the bench does not draw a pipe. */
  shape?: StockShape;
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
  asin?: string;
  /** Real product photo from a listing. The bench draws this when the shape is not a known vessel. */
  image?: string;
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
  | "table"
  | "chair"
  | "custom";

export type WorkMode = "look" | "free" | "build" | "walk";
export type DetailLevel = "frame" | "full" | "fill";
export type BuildScale = "tabletop" | "weekend" | "full";

export type YardInstance = {
  id: string;
  catalogId: string;
  position: Vec3;
  rotation: Vec3;
  cutLength?: number;
  role?: string;
  join?: string;
  home?: Vec3;
  from?: Vec3;
  to?: Vec3;
  /** Stick lies flat against this face normal (slatted walls, roof decks, frame faces). */
  face?: Vec3;
  /**
   * Drawn cross-section when this piece is ripped or stacked from a larger unit
   * (a plywood batten, not the 48" sheet face). Absent = draw the catalog unit.
   */
  section?: { width: number; height: number };
  /** Cut round: a disc (wheel, face) of this diameter; from → to runs through its thickness (the axle line). */
  round?: number;
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
  | "rail"
  | "deck"
  | "cleat"
  | "bay"
  | "side";

export type Panel = {
  id: string;
  type: PanelType;
  name: string;
  position: Vec3;
  size: { width: number; height: number; depth: number };
  materialId: string;
  /** Yaw in radians — table legs/aprons rotate about Y. */
  yaw?: number;
  /**
   * Plate outline inside the width × depth box. Corner-unit shelves are right triangles
   * (right angle at −x/−z, the wall corner) or quarter-rounds (arc centered on that corner).
   */
  outline?: "right-triangle" | "quarter-round";
  /**
   * Odd-shape plate: real polygon outline, points relative to `position` (min corner).
   * plane "xz" = plan outline extruded up by size.height; "xy" = front outline extruded by size.depth.
   */
  polygon?: { plane: "xz" | "xy"; pts: [number, number][]; /** Round through-holes (drilled), same local frame as pts. */ holes?: { x: number; y: number; r: number }[] };
  /** Plain-shop cut note for this piece (angle, legs, heights) — lands on the cut list. */
  cutNote?: string;
  /** Rectangular blank the shape is cut from, when the bounding box is not the blank (sloped boards, mitered pieces). */
  blank?: { lengthIn: number; widthIn: number; thicknessIn: number };
  /**
   * Joints declared on purpose where this part is let into another (dado, rabbet, lap) or meets it at a mitre.
   * Only these pairs may share space; the interference guard fails on any other overlap.
   */
  joints?: { with: string; kind: "dado" | "rabbet" | "lap" | "mortise" | "miter" | "notch" }[];
  cutouts?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
  }[];
  /**
   * One swinging door broken into stiles, rails, and a panel.
   * Same id rotates about the same hinge so Operate still opens one door.
   */
  leaf?: {
    id: string;
    hinge: "left" | "right";
    hingeX: number;
    hingeZ: number;
    role: "hinge" | "pull" | "part";
  };
};

export type OpeningKind = "alcove" | "window" | "room" | "pocket" | "door";

export type PocketWalls = {
  backWidth: number;
  leftDepth: number;
  rightDepth: number;
  height: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
  /**
   * A notch in the hole: a pipe chase or wall jog in a back corner ("left" / "right"), or a ledge
   * along the whole back wall ("back"). Width runs along the back, depth out from it, height from the floor.
   */
  notch?: PocketNotch;
};

export type PocketNotch = {
  side: "left" | "right" | "back";
  width: number;
  depth: number;
  height: number;
};

export type PocketUnit = {
  width: number;
  depth: number;
  height: number;
  vanityH: number;
  kneeW: number;
  upperStart: number;
  /** Upper shelves toward the left wall, inches along the back. Absent = half the opening. */
  leftBay?: number;
  /** Upper shelves toward the right wall, inches along the back. */
  rightBay?: number;
  /** Shelves in each upper bay. Absent = 3, the pocket usual. */
  shelfRows?: number;
};

export type PocketSpec = {
  walls: PocketWalls;
  unit: PocketUnit;
  leftClear: number;
  rightClear: number;
  /** Set when a typed size was pulled back into the hole. */
  clampNote?: string;
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
  | "storage"
  | "table";

export type FittedUnit = {
  width: number;
  depth: number;
  height: number;
  counterH?: number;
  kneeW?: number;
  upperStart?: number;
  shelfCount?: number;
  cubbies?: number;
  drawersPerBank?: number;
  doors?: boolean;
  mirror?: boolean;
  rod?: boolean;
  centered?: boolean;
  legs?: number;
  shape?: "rect" | "round" | "oval" | "square";
  bays?: number;
  /** Corner-unit class — shelves that tuck into a 90° inside corner. */
  corner?: CornerUnit;
  /** Odd-shape class pack (L-footprint, diagonal corner, sloped, wrap, angled, outside, polygon). */
  odd?: OddShape;
};

export type OddShape = {
  kind:
    | "l-footprint"
    | "corner-diagonal"
    | "sloped"
    | "wrap-opening"
    | "angled-corner"
    | "outside-corner"
    | "polygon-planter"
    | "polygon-stand"
    | "honeycomb";
  params: Record<string, number | string | boolean>;
  stem?: string;
};

export type CornerUnit = {
  shape: "triangle" | "quarter";
  /** Along-wall legs (quarter-round: legA = legB = radius). */
  legA: number;
  legB: number;
  height: number;
  tiers: number;
  wallHung: boolean;
  typed: { legs: boolean; height: boolean; tiers: boolean };
  stem?: string;
};

export type FittedSpec = {
  program: FittedProgram;
  name: string;
  opening: { width: number; height: number; depth: number; kind: OpeningKind };
  unit: FittedUnit;
  walls?: PocketWalls;
  leftClear?: number;
  rightClear?: number;
  /** Shape family from detectHouseFamily — not a noun program. */
  family?: import("./family").HouseFamily;
  affordances?: import("./family").HouseAffordance[];
  /**
   * Axes the stranger typed into the prompt (not densified class defaults).
   * Title/HUD must not present unlabeled axes as typed (width-only linen ≠ ×84).
   */
  typedAxes?: { width: boolean; height: boolean; depth: boolean };
};

export type LoadUse = "display" | "toy" | "person";

export type TraversePath = {
  kind: "deck" | "portal" | "around";
  origin: Vec3;
  axis: Vec3;
  length: number;
  width: number;
  y: number;
  eyeH: number;
  clearH: number;
};

export type YardProject = {
  id: string;
  name: string;
  prompt: string;
  /**
   * The words the person typed, when the bench built from an internal primitive prompt instead
   * ("lemonade stand" → "table 48 wide 42 tall 24 deep"). The prompt box shows this, never the remap.
   */
  typedPrompt?: string;
  kind: StructureKind;
  overall: { width: number; height: number; depth: number };
  instances: YardInstance[];
  panels: Panel[];
  primaryMaterialId: string;
  joinMethod?: JoinMethod;
  /** Shop join the person picked. Buy and steps follow this, not the stock default. */
  shopJoin?: "screw" | "pocket" | "dowel" | "biscuit" | "glue";
  notes: string[];
  /** Stock that can hold this load. The plan offers a one-tap switch to it. */
  holdStockId?: string;
  historic?: boolean;
  supportOffer?: {
    needed: boolean;
    included: boolean;
    reason: string;
    /** spine = a temporary mast. span = rails or a divider under a long span. */
    kind?: "spine" | "span";
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
  /**
   * A house build re-tiled in sticks, pipe or bricks keeps the hole and unit it was fitted to here,
   * so Size and the pocket card still refit the same object in that stock.
   */
  recastFrom?: { fitted?: FittedSpec; pocket?: PocketSpec };
  windowPkg?: WindowPackage;
  traverse?: TraversePath;
  /** Subject-class shape template (quadruped…) the build was materialized from. */
  shape?: import("./shapeTemplates").ShapeSummary;
  render?: {
    url: string;
    prompt: string;
    scene?: string;
  };
  /** Human climb build (step stool, library/loft ladder): built to its typed size, never rescaled. */
  climb?: { kind: "stool" | "ladder"; topTreadIn: number; steps: number; handrailIn: number };
  flat?: {
    paper: "letter" | "letter-landscape" | "8x10" | "a4";
    plane: "top" | "front" | "side";
    subject: string;
    lifted?: boolean;
  };
  assumptions: {
    load: "light" | "medium" | "heavy";
    use?: LoadUse;
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
  label?: string;
  whole?: boolean;
};

export type ShopOffer = {
  retailer: string;
  label: string;
  title: string;
  href: string;
  packQty: number;
  packPrice: number;
  unitPrice: number;
  packsNeeded: number;
  lineTotal: number;
  best: boolean;
  checkedAt: string;
  /** search = open the store, no price. owned = already on hand. */
  quote?: "search" | "owned";
};

export type BomLine = {
  name: string;
  quantity: number;
  unit: string;
  searchQuery?: string;
  asin?: string;
  catalogId?: string;
  estimatedCost?: number;
  notes?: string;
  offers?: ShopOffer[];
};

export type AssemblyStep = {
  step: number;
  title: string;
  description: string;
  partsUsed?: string[];
  tips?: string;
  imageDataUrl?: string;
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
  effort?: string;
  generatedAt: string;
  grokNotes?: string;
  partsKind?: "cut" | "whole";
  /**
   * The one sheet nest (structural + backer) Buy counted. The plan's sheet layout and the PDF
   * cut diagrams draw exactly these sheets.
   */
  sheetNest?: import("./nesting").PlanSheetNest | null;
  render?: {
    url: string;
    prompt: string;
    scene?: string;
  };
};

export type SpaceKind = "closet_niche" | "window_rough_opening" | "desk" | "workbench" | "media" | "table" | "bench" | "lounge_chair" | "ottoman" | "rocking_chair" | "shoe_rack" | "bookcase" | "wall_cabinet" | "shelving_alcove" | "general_volume";

export type WindowStyle = "double_hung" | "single_hung" | "casement" | "slider" | "picture" | "awning" | "hopper" | "door";

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
  header: { nominal: "2x6" | "2x8" | "2x10" | "2x12"; plies: number; depth: number; length: number };
  shimW: number;
  shimH: number;
  /** Door rough openings cut the bottom plate. Windows keep a sill. */
  role?: "window" | "door";
  slabW?: number;
  slabH?: number;
};

export type MeasureDraft = {
  width: string;
  height: string;
  depth: string;
  kind: SpaceKind;
  windowId?: string;
  backWidth?: string;
  leftDepth?: string;
  rightDepth?: string;
  /** Ceiling of the hole, when the build is allowed to stop short of it. */
  ceiling?: string;
  /** Shelves toward the left wall, inches along the back. */
  leftBay?: string;
  /** Shelves toward the right wall, inches along the back. */
  rightBay?: string;
  /** Pocket shape: straight sides (a rectangle) or flared sides (a trapezoid). */
  pocketShape?: "straight" | "flared";
  /** How far each side wall flares out from square, in degrees. */
  leftAngle?: string;
  rightAngle?: string;
  /** Notch in the hole: none, a chase in a back corner, or a ledge along the back. */
  notchSide?: "none" | "left" | "right" | "back";
  notchWidth?: string;
  notchDepth?: string;
  notchHeight?: string;
  /** Corner the two walls make, in degrees. Only on a corner shelf. */
  angle?: string;
  /** Low side of a slope. The high side is `height`. */
  lowSide?: string;
  /** Clearance left on each side of the piece, shop inches. Default 1/8. */
  clearance?: string;
  /** Height of each shelf when spacing is set one by one. */
  shelfAt?: string[];
  /** Opening cut from Your space. Rectangle until the person picks an arch or a slope. */
  spaceShape?: "rectangle" | "arch" | "slope";
  archRise?: string;
  outletOn?: boolean;
  outletX?: string;
  outletY?: string;
  outletW?: string;
  outletH?: string;
  baseboardOn?: boolean;
  baseboardH?: string;
  baseboardD?: string;
  /** Opening size, separate from the piece. The piece is the opening minus clearance. */
  openingWidth?: string;
  openingHeight?: string;
  openingDepth?: string;
};

export type ExportOptions = {
  check: boolean;
  cuts: boolean;
  buy: boolean;
  steps: boolean;
  plates: boolean;
  format: "print" | "markdown" | "html";
};
