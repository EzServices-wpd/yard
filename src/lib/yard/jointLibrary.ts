/**
 * Reviewed construction patterns the engine already names.
 * A pattern is a declared joint (Panel.joints, or a hinged leaf). Geometric contact is not in this list:
 * two parts that touch are not a joint until a pattern says so.
 * Summaries name the pattern. They are not cut procedures.
 */

export type JointPatternUse = "human" | "miniature" | "either";

export type JointPattern = {
  id: string;
  /** Panel.joints kind, or "hinge" for Panel.hinged. */
  kind: "dado" | "rabbet" | "lap" | "mortise" | "miter" | "notch" | "hinge";
  /** Where Yard already records this pattern. */
  provenance: string;
  use: JointPatternUse;
  /**
   * "shop" — a wood joint the interference guard already allows.
   * "hardware" — the leaf hangs on hardware, not a glued carcass joint.
   */
  role: "shop" | "hardware";
  summary: string;
};

export const JOINT_LIBRARY: readonly JointPattern[] = [
  {
    id: "dado",
    kind: "dado",
    provenance: "Panel.joints kind dado (src/lib/yard/types.ts). supportGraph and learnedGate read a dado as the part's host.",
    use: "human",
    role: "shop",
    summary: "A groove across a face that locates the end of another part.",
  },
  {
    id: "rabbet",
    kind: "rabbet",
    provenance: "Panel.joints kind rabbet (src/lib/yard/types.ts). A mirror is rabbetted into its door in fittedBuild.",
    use: "human",
    role: "shop",
    summary: "A rebate along an edge that lets another part in.",
  },
  {
    id: "lap",
    kind: "lap",
    provenance: "Panel.joints kind lap (src/lib/yard/types.ts). The interference guard treats a declared lap as an allowed overlap.",
    use: "human",
    role: "shop",
    summary: "Both parts are notched so their faces land in one plane.",
  },
  {
    id: "mortise",
    kind: "mortise",
    provenance: "Panel.joints kind mortise (src/lib/yard/types.ts). formTemplates seats a member with a mortise.",
    use: "human",
    role: "shop",
    summary: "A hole or slot that takes the end of another part.",
  },
  {
    id: "miter",
    kind: "miter",
    provenance: "Panel.joints kind miter (src/lib/yard/types.ts). A declared mitre is an allowed meeting, not a guessed corner.",
    use: "either",
    role: "shop",
    summary: "Two ends meet at an angle, each cut to the meeting.",
  },
  {
    id: "notch",
    kind: "notch",
    provenance: "Panel.joints kind notch (src/lib/yard/types.ts), the same word as JoinMethod notch. Declaring it is what allows the overlap.",
    use: "either",
    role: "shop",
    summary: "A notch lets one part into another. The pattern does not say the notch can carry a person.",
  },
  {
    id: "hinge",
    kind: "hinge",
    provenance: "Panel.hinged (src/lib/yard/types.ts). modelJoints skips a hinged leaf when it counts carcass screws.",
    use: "either",
    role: "hardware",
    summary: "A leaf swings on hinges from another part.",
  },
];

/**
 * When a pair that only touches becomes one of the seven patterns.
 * A reading cites the engine that already names that pattern. Contact, a butt, a face glue-up,
 * a screwed back edge, and a stick node are not readings.
 */
export const CONSTRUCTION_READINGS = [
  {
    id: "housed-dado",
    patternId: "dado",
    when: "A shelf, bottom, top, divider, or rail end lies inside a host face it enters, by more than 1/16\" and at most 0.8\", and overlaps that face in both directions. The face need not be the host's thinnest side. The part does not pass through the opposite face. The part's own thickness can be a smaller overlap than that insertion.",
    notWhen: "A flush butt is not a groove. A part that only meets an edge of the host, or crosses it with both ends outside, is not a dado. A part that turns on a pin, a hinged leaf, and a purchased hardware piece are not inferred dados. A pin shelf that only touches an upright or a divider stays contact, even when the cut note drills pin holes.",
    provenance: "Panel.joints kind dado. supportGraph and learnedGate read a dado as the part's host. modelJoints records a flush meeting as a butt.",
  },
  {
    id: "housed-rabbet",
    patternId: "rabbet",
    when: "A back or a mirror no thicker than 0.3\" has an end inside a host face it enters, by more than 1/16\" and at most 0.8\", and overlaps that face in both directions. The face need not be the host's thinnest side. It does not pass through the opposite face. A thinner sheet than the insertion is still that rebate.",
    notWhen: "A 1/4\" back that sits on the rear plane and only touches an upright's inner face is the screw joint modelJoints calls a back edge, not a rebate. A sheet that only meets an edge, or crosses a part with both ends outside, is not a rebate. A hinged leaf and a purchased hardware piece are not inferred rebates.",
    provenance: "Panel.joints kind rabbet. fittedBuild sets a mirror into its door with that kind. modelJoints kind back is a screwed sheet edge.",
  },
  {
    id: "cross-lap",
    patternId: "lap",
    when: "A divider and a shelf or deck each pass through the other's opposite faces: one runs past the other's two faces, and the other runs past the first's two faces.",
    notWhen: "An end that stops inside a divider is a dado, not a lap. Shelves that stop against a divider do not cross. That meeting stays a butt.",
    provenance: "solve.crossLap declares an egg-crate half-lap when a divider passes through a fixed shelf. A meeting that does not cross is not that lap.",
  },
  {
    id: "ridge-miter",
    patternId: "miter",
    when: "Two panels that touch both carry the builder's cut note 'bevel the ridge edge 45' or both carry 'miter both ends'.",
    notWhen: "A corner that merely touches, a gable whose outline says 45° to a peak, and a stick landmark are not mitres.",
    provenance: "Panel.joints kind miter. tableFitted writes miter joints where aprons meet. formTemplates bevels a roof ridge 45° on the cut note.",
  },
  {
    id: "hinge-leaf",
    patternId: "hinge",
    when: "A door that doorHingeLayout counts, and that is not already Panel.hinged, meets one carcass part along the hinge edge leavesOf names.",
    notWhen: "Glue-only stock buys no hinges. A pin shelf is not a hinge. A miniature stick model has no leaf.",
    provenance: "Panel.hinged, and hingedLeaf.doorHingeLayout for a door the Buy list hangs when the panel field was not set. modelJoints skips a door.",
  },
  {
    id: "declared-notch",
    patternId: "notch",
    when: "Panel.joints already says notch, the way a board notched around a post is written.",
    notWhen: "A shelf that sits between legs and only touches their faces is not a notch.",
    provenance: "Panel.joints kind notch. solve.notchAround and petGear write it when a post runs through a board. A butt between legs does not.",
  },
  {
    id: "declared-mortise",
    patternId: "mortise",
    when: "Panel.joints already says mortise, the way a member seated in a hole is written.",
    notWhen: "A pin hole drilled for a shelf pin is not a mortise. The shelf end is not let into the upright.",
    provenance: "Panel.joints kind mortise. formTemplates seats a perch in a hole. recipeBuild mortises a hinge leaf that shares a board.",
  },
] as const;

export type ConstructionReadingId = (typeof CONSTRUCTION_READINGS)[number]["id"];

const BY_ID = new Map(JOINT_LIBRARY.map((p) => [p.id, p]));
const READING_BY_ID = new Map(CONSTRUCTION_READINGS.map((reading) => [reading.id, reading]));

export function jointPattern(id: string): JointPattern | undefined {
  return BY_ID.get(id);
}

export function constructionReading(id: string): (typeof CONSTRUCTION_READINGS)[number] | undefined {
  return READING_BY_ID.get(id as ConstructionReadingId);
}
