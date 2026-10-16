/** Spec 006: the 20-prompt sweep per class (also the whole-class test corpus). */
export const SWEEPS = {
  d1: {
    title: "the same prompt gives identical steps on every run",
    inv: "I25",
    file: "d1-deterministic-steps.md",
    prompts: [
      "3 foot Eiffel Tower from popsicle sticks", "eiffel tower", "big ben", "brooklyn bridge", "trebuchet",
      "submarine", "water wheel", "model lighthouse", "popsicle stick bridge", "4 foot lattice tower from jumbo craft sticks",
      "linen closet 31.5 wide 78 tall 16 deep", "bunk bed", "loft bed", "picnic table", "hanging birdhouse",
      "corner shelf", "wine rack 12 bottles", "toothpick tower", "catapult from popsicle sticks", "ferris wheel",
    ],
  },
  g1: {
    title: "hung builds never get glides; frames tied to a wall stud buy the tie; plain truss words",
    inv: "I9",
    file: "g1-hung-glides-stud-tie.md",
    prompts: [
      "hanging birdhouse", "wall mounted birdhouse", "outdoor wall planter box", "outdoor hanging shelf", "hanging planter",
      "bunk bed", "loft bed", "bunk bed 80 long 42 wide 66 tall", "model lighthouse", "adirondack chair",
      "outdoor bench", "picnic table", "garden bed", "porch swing", "wall mounted outdoor planter",
      "birdhouse", "outdoor plant stand", "bookcase 36 wide 72 tall 12 deep", "floating shelf 24 wide", "coat rack",
    ],
  },
  j1: {
    title: "engine jargon and template leftovers never reach the person",
    inv: "I11",
    file: "j1-jargon.md",
    prompts: [
      "floating shelf 24 wide", "garage storage shelves", "dog bed frame", "window seat 60 wide", "model lighthouse",
      "rolling kitchen island", "kitchen island 60x36x36", "bathroom medicine cabinet 16 wide 24 high 4 deep", "30 inch range hood", "wall mounted ironing board cabinet 48 high 16 wide 6 deep",
      "mudroom bench 48 wide 18 high 16 deep", "bench 31 wide 17.5 tall 14 deep", "popsicle stick bridge", "4 foot lattice tower from jumbo craft sticks", "3 foot Eiffel Tower from popsicle sticks",
      "linen closet 31.5 wide 78 tall 16 deep", "6 foot ladder from 2x4", "toy airplane", "picnic table", "floating desk",
    ],
  },
  h1: {
    title: "hardware named in the steps or notes is on Buy",
    inv: "I9",
    file: "h1-hardware-on-buy.md",
    prompts: [
      "wine rack 12 bottles", "spice rack", "dog bed frame", "floating shelves 36 wide 10 deep", "wine rack 24 wide 36 high 12 deep",
      "wall shelf for jars 24 wide", "30 inch range hood", "over the toilet cabinet 27 wide 68 high 9 deep", "L-shaped corner desk 60 by 48 30 tall", "catapult from popsicle sticks",
      "barn birdhouse", "window box", "birdhouse shaped like church", "wall mounted mail organizer", "wall clock frame",
      "bookshelf under a sloped ceiling 48 wide 60 tall at the high side 30 at the low side", "toy box", "nightstand with drawer", "dresser 36 wide 34 tall 18 deep", "porch swing",
    ],
  },
  c12: {
    title: "store search terms follow the Buy name",
    inv: "C12",
    file: "c12-store-terms.md",
    prompts: [
      "linen closet 31.5 wide 78 tall 16 deep", "bookcase 36 wide 72 tall 12 deep", "pantry cabinet 24 wide 84 tall 16 deep", "wall cabinet 30 wide 30 tall 12 deep", "media console 60 wide 24 tall 18 deep",
      "dresser 36 wide 34 tall 18 deep", "nightstand", "closet 72 wide 96 tall 24 deep", "cedar raised garden bed 4x8", "adirondack chair",
      "picnic table", "workbench", "coat bench", "toy box", "shoe rack",
      "zip tie", "paper clip chain 12 inches long", "3/8 dowel", "birdhouse", "window 36x48",
    ],
  },
  c11: {
    title: "whole items carry no cutting language; shelf pins in inches",
    inv: "C11",
    file: "c11-whole-items-uncut.md",
    prompts: [
      "zip tie", "pipe cleaner", "marble", "wine cork", "washer",
      "paper clip", "paper clip chain 12 inches long", "pony bead bracelet", "washer tower", "craft stick",
      "3/8 dowel", "cotton swab", "binder clip", "golf tee", "16d nail",
      "linen closet 31.5 wide 78 tall 16 deep", "bookcase 36 wide 72 tall 12 deep", "4 foot bookshelf", "pantry cabinet 24 wide 84 tall 16 deep", "bookshelf",
    ],
  },
  c10: {
    title: "price consistency",
    inv: "C10",
    file: "c10-price-consistency.md",
    prompts: [
      "linen closet 31.5 wide 78 tall 16 deep", "linen closet", "bookcase 36 wide 72 tall 12 deep", "bookshelf", "4 foot bookshelf",
      "media console 60 wide 24 tall 18 deep", "tv stand", "pantry cabinet 24 wide 84 tall 16 deep", "wall cabinet 30 wide 30 tall 12 deep", "nightstand",
      "dresser 36 wide 34 tall 18 deep", "shoe rack", "desk 48 wide 30 tall 24 deep", "workbench", "coat bench",
      "toy box", "garage shelving 48 wide 72 tall 18 deep", "closet 72 wide 96 tall 24 deep", "floating shelf 36 wide", "storage cubby 3x3",
    ],
  },
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
  b8: {
    title: "bought-item path: no cut rows, inches only, round sizes, typed title",
    inv: "I20",
    file: "b8-bought-path.md",
    prompts: [
      "zip tie", "marbles", "pipe cleaner", "pony bead", "cotton ball",
      "bottle cap", "button", "washer", "wine cork", "3/8 dowel",
      "paper clip", "paper clip chain 12 inches long", "pony bead bracelet", "washer tower", "toothpick",
      "cotton swab", "jumbo craft stick", "straw", "clothes pin", "rubber band",
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
