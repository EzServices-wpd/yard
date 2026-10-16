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
  c2: {
    title: "size phrases",
    inv: "I21",
    file: "c2-size-phrases.md",
    prompts: [
      "about knee high bench", "about waist high console", "as wide as a twin bed bench", "half a sheet of plywood shelf",
      "a full sheet of plywood table", "shelf that fits under a 30 inch window", "small 6 foot shelf", "stand for a 65 inch TV",
      "counter height stool", "bar height stool", "bar height table", "waist high workbench", "as wide as a queen bed bench",
      "as wide as a king bed headboard", "5 foot cabinet", "4 foot bookshelf", "chest high cabinet", "knee high coffee table",
      "media console for a 75 inch TV", "half sheet of plywood desk",
    ],
  },
  c1: {
    title: "named forms and purposes",
    inv: "I22",
    file: "c1-named-forms.md",
    prompts: [
      "Tower Bridge", "Leaning Tower of Pisa", "Statue of Liberty", "Sydney Opera House", "lighthouse",
      "Dutch windmill", "covered bridge", "pirate ship", "galleon 30 inches long", "doll house",
      "Golden Gate Bridge 36 inches long", "Brooklyn Bridge 36 inches", "Big Ben", "Eiffel Tower", "trebuchet",
      "something to hang my keys", "a place for my dog to sleep", "organize my tools", "plants by the window", "a holder for 6 fishing rods",
    ],
  },
  c2b: {
    title: "bought-item size table",
    inv: "I20",
    file: "c2b-bought-items.md",
    prompts: [
      "zip tie", "marbles", "clothespin", "16d nail", "rubber band",
      "button", "binder clip", "golf tee", "straw", "pipe cleaner",
      "wine cork", "shoelace", "bottle cap", "cotton ball", "cable tie",
      "marble", "nail", "cork", "clothes pin", "drinking straw",
    ],
  },
  l1: {
    title: "live path: engine forms never reach the learner",
    inv: "I23",
    file: "l1-live-path.md",
    prompts: [
      "ship", "pirate ship", "a ship", "Eiffel Tower", "Big Ben",
      "Dutch windmill", "covered bridge", "trebuchet", "catapult", "Leaning Tower of Pisa",
      "Sydney Opera House", "Golden Gate Bridge 36 inches long", "something to hang my keys", "a place for my dog to sleep", "organize my tools",
      "plants by the window", "lighthouse", "doll house", "Taj Mahal", "Space Needle",
    ],
  },
  c3t: {
    title: "typed noun as title",
    inv: "I24",
    file: "c3t-typed-title.md",
    prompts: [
      "pirate ship", "ship", "galleon", "tall ship", "viking ship",
      "longship", "schooner", "frigate", "clipper ship", "galleon 30 inches long",
      "Dutch windmill", "covered bridge", "doll house", "lighthouse", "Tower Bridge",
      "model ship", "viking longship", "sailing ship", "Golden Gate Bridge 36 inches long", "Big Ben",
    ],
  },
} as const;
