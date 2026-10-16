/** Spec 006: the 20-prompt sweep per class (also the whole-class test corpus). */
export const SWEEPS = {
  c3: {
    title: "purchased whole items",
    inv: "I20",
    file: "c3-purchased.md",
    prompts: [
      "paper clip", "paperclip chain", "paper clip chain 12 inches long", "paper clip chain 6 inches", "paper clip necklace",
      "paper clip bracelet", "20 paper clip chain", "pony bead bracelet", "pony bead necklace", "washer tower",
      "12 washer stack", "washer", "3/8 dowel", "1/4 dowel", "3/4 dowel",
      "craft stick", "popsicle stick", "jumbo craft stick", "toothpick", "washer tower 4 inches tall",
    ],
  },
} as const;
