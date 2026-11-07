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

const BY_ID = new Map(JOINT_LIBRARY.map((p) => [p.id, p]));

export function jointPattern(id: string): JointPattern | undefined {
  return BY_ID.get(id);
}
