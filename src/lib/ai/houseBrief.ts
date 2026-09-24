/**
 * Free-text house prompt → FittedSpec.
 * Few-shots every known-good walk build so the model stays on the cut-list path.
 */
import { createServerFn } from "@tanstack/react-start";
import { parseModelJson } from "@/lib/yard/parseJson";
import { detectHouseFamily } from "@/lib/yard/family";

async function chat(
  messages: { role: "system" | "user"; content: string }[],
  maxTokens = 900,
) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "AI is not available in this environment" };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
  const payload = (await res.json()) as { choices: { message: { content: string } }[] };
  return { ok: true as const, text: payload.choices[0]?.message.content ?? "" };
}

const HOUSE_BRIEF_EXAMPLES: { prompt: string; brief: Record<string, unknown> }[] = [
  {
    prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    brief: {
      program: "closet",
      name: 'Linen 31.5" × 78" × 16"',
      opening: { width: 31.5, height: 78, depth: 16, kind: "alcove" },
      unit: { width: 31.5, depth: 16, height: 78, shelfCount: 4, doors: true, centered: true },
    },
  },
  {
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    brief: {
      program: "desk",
      name: 'Desk 60" × 29" × 30"',
      opening: { width: 60, height: 29, depth: 30, kind: "room" },
      unit: {
        width: 60,
        depth: 30,
        height: 29,
        counterH: 29,
        kneeW: 24,
        drawersPerBank: 3,
        doors: false,
        centered: true,
      },
    },
  },
  {
    prompt: "tv console with shelving 70 inches wide 30 inches tall",
    brief: {
      program: "media",
      name: 'TV console 70" × 30" × 16"',
      opening: { width: 70, height: 30, depth: 16, kind: "room" },
      unit: { width: 70, depth: 16, height: 30, shelfCount: 2, doors: false, centered: true },
    },
  },
  {
    prompt: "TV console 70 inches wide 30 inches deep",
    brief: {
      program: "media",
      name: 'TV console 70" × 22" × 30"',
      opening: { width: 70, height: 22, depth: 30, kind: "room" },
      unit: { width: 70, depth: 30, height: 22, shelfCount: 2, doors: false, centered: true },
    },
  },
  {
    prompt: "coffee table 48 round",
    brief: {
      program: "table",
      name: 'Coffee table 48" × 18" × 48"',
      opening: { width: 48, height: 18, depth: 48, kind: "room" },
      unit: { width: 48, depth: 48, height: 18, legs: 4, shape: "round", doors: false, centered: true },
    },
  },
  {
    prompt: "table 40in round with 3 legs",
    brief: {
      program: "table",
      name: 'Table 40" × 30" × 40"',
      opening: { width: 40, height: 30, depth: 40, kind: "room" },
      unit: { width: 40, depth: 40, height: 30, legs: 3, shape: "round", doors: false, centered: true },
    },
  },
  {
    prompt: "give me a 70 inch table",
    brief: {
      program: "table",
      name: 'Table 70" × 30" × 70"',
      opening: { width: 70, height: 30, depth: 70, kind: "room" },
      unit: { width: 70, depth: 70, height: 30, legs: 4, shape: "rect", doors: false, centered: true },
    },
  },
  {
    prompt: "give me a 70 in by 28 in table",
    brief: {
      program: "table",
      name: 'Table 70" × 30" × 28"',
      opening: { width: 70, height: 30, depth: 28, kind: "room" },
      unit: { width: 70, depth: 28, height: 30, legs: 4, shape: "rect", doors: false, centered: true },
    },
  },
  {
    prompt: "oval coffee table 42 long × 24 wide × 18 tall",
    brief: {
      program: "table",
      name: 'Oval Coffee table 42" × 18" × 24"',
      opening: { width: 42, height: 18, depth: 24, kind: "room" },
      unit: { width: 42, depth: 24, height: 18, legs: 4, shape: "oval", doors: false, centered: true },
    },
  },
  {
    prompt: "square dining table 36 × 36 × 30 tall",
    brief: {
      program: "table",
      name: 'Square Table 36" × 30" × 36"',
      opening: { width: 36, height: 30, depth: 36, kind: "room" },
      unit: { width: 36, depth: 36, height: 30, legs: 4, shape: "square", doors: false, centered: true },
    },
  },
  {
    prompt: "oval coffee table 42×24×18",
    brief: {
      program: "table",
      name: 'Oval Coffee table 42" × 18" × 24"',
      opening: { width: 42, height: 18, depth: 24, kind: "room" },
      unit: { width: 42, depth: 24, height: 18, legs: 4, shape: "oval", doors: false, centered: true },
    },
  },
  {
    prompt: "square dining table 36×36×30",
    brief: {
      program: "table",
      name: 'Square Table 36" × 30" × 36"',
      opening: { width: 36, height: 30, depth: 36, kind: "room" },
      unit: { width: 36, depth: 36, height: 30, legs: 4, shape: "square", doors: false, centered: true },
    },
  },
  {
    prompt: "closet system for 80 in by 120 in space",
    brief: {
      program: "closet",
      name: 'Closet 80" × 120" × 24"',
      opening: { width: 80, height: 120, depth: 24, kind: "alcove" },
      unit: { width: 80, depth: 24, height: 120, shelfCount: 1, doors: true, bays: 3, rod: true, centered: true },
    },
  },
  {
    prompt: "hall pantry 24 wide by 84 tall by 14 deep, 5 shelves, 3/4 inch plywood",
    brief: {
      program: "pantry",
      name: 'Pantry 24" × 84" × 14"',
      opening: { width: 24, height: 84, depth: 14, kind: "alcove" },
      unit: { width: 24, depth: 14, height: 84, shelfCount: 5, doors: true, centered: true },
    },
  },
  {
    prompt: "mudroom bench 48 wide by 18 deep by 18 high with 3 cubbies",
    brief: {
      program: "bench",
      name: 'Bench 48" × 18" × 18"',
      opening: { width: 48, height: 18, depth: 18, kind: "room" },
      unit: { width: 48, depth: 18, height: 18, cubbies: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "kids bookcase 30 wide by 11 deep by 48 high, 4 shelves",
    brief: {
      program: "bookcase",
      name: 'Bookcase 30" × 48" × 11"',
      opening: { width: 30, height: 48, depth: 11, kind: "room" },
      unit: { width: 30, depth: 11, height: 48, shelfCount: 4, doors: false, centered: true },
    },
  },
  {
    prompt: "dresser 60 wide",
    brief: {
      program: "storage",
      name: 'Dresser 60" × 36" × 18"',
      opening: { width: 60, height: 36, depth: 18, kind: "room" },
      unit: { width: 60, depth: 18, height: 36, drawersPerBank: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "nightstand 20 wide",
    brief: {
      program: "storage",
      name: 'Nightstand 20" × 24" × 16"',
      opening: { width: 20, height: 24, depth: 16, kind: "room" },
      unit: { width: 20, depth: 16, height: 24, drawersPerBank: 1, shelfCount: 1, doors: false, centered: true },
    },
  },
  {
    prompt: "nightstand 18 wide 16 deep 24 tall",
    brief: {
      program: "storage",
      name: 'Nightstand 18" × 24" × 16"',
      opening: { width: 18, height: 24, depth: 16, kind: "room" },
      unit: { width: 18, depth: 16, height: 24, drawersPerBank: 1, shelfCount: 1, doors: false, centered: true },
    },
  },
  {
    prompt: "shoe rack 36 wide 12 deep 18 tall",
    brief: {
      program: "storage",
      name: 'Shoe rack 36" × 18" × 12"',
      opening: { width: 36, height: 18, depth: 12, kind: "room" },
      unit: { width: 36, depth: 12, height: 18, shelfCount: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "floating shelves 48 wide 8 deep, 3 shelves",
    brief: {
      program: "storage",
      name: 'Shelves 48" × 28" × 8"',
      opening: { width: 48, height: 28, depth: 8, kind: "room" },
      unit: { width: 48, depth: 8, height: 28, shelfCount: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "prep table 48 wide × 24 deep × 36 tall",
    brief: {
      program: "table",
      name: 'Prep table 48" × 36" × 24"',
      opening: { width: 48, height: 36, depth: 24, kind: "room" },
      unit: { width: 48, depth: 24, height: 36, doors: false, legs: 4, centered: true },
    },
  },
  {
    prompt: "butcher block cart 30 wide × 24 deep × 36 tall with two shelves",
    brief: {
      program: "storage",
      name: 'Butcher block cart 30" × 36" × 24"',
      opening: { width: 30, height: 36, depth: 24, kind: "room" },
      unit: { width: 30, depth: 24, height: 36, doors: false, shelfCount: 2, centered: true },
    },
  },
  {
    prompt: "dining table 72 wide × 36 deep × 30 tall",
    brief: {
      program: "table",
      name: 'Dining table 72" × 30" × 36"',
      opening: { width: 72, height: 30, depth: 36, kind: "room" },
      unit: { width: 72, depth: 36, height: 30, doors: false, legs: 4, centered: true },
    },
  },
  {
    prompt: "serving cart 30 wide × 18 deep × 34 tall with two shelves",
    brief: {
      program: "storage",
      name: 'Serving cart 30" × 34" × 18"',
      opening: { width: 30, height: 34, depth: 18, kind: "room" },
      unit: { width: 30, depth: 18, height: 34, doors: false, shelfCount: 2, centered: true },
    },
  },
  {
    prompt: "plate rack 36 wide × 12 deep × 24 tall with three slots",
    brief: {
      program: "storage",
      name: 'Plate rack 36" × 24" × 12"',
      opening: { width: 36, height: 24, depth: 12, kind: "room" },
      unit: { width: 36, depth: 12, height: 24, doors: false, centered: true },
    },
  },
  {
    prompt: "open kitchen shelving fitted to a 48×36×12 opening, three shelves",
    brief: {
      program: "storage",
      name: 'Open kitchen shelving 48" × 36" × 12"',
      opening: { width: 48, height: 36, depth: 12, kind: "alcove" },
      unit: { width: 48, depth: 12, height: 36, doors: false, shelfCount: 3, centered: true },
    },
  },
  {
    prompt: "kitchen island 60x36x36",
    brief: {
      program: "storage",
      name: 'Kitchen island 60" × 36" × 36"',
      opening: { width: 60, height: 36, depth: 36, kind: "room" },
      unit: { width: 60, depth: 36, height: 36, doors: false, counterH: 36, shelfCount: 1, centered: true },
    },
  },
  {
    prompt: "workbench 60 wide × 24 deep × 36 tall",
    brief: {
      program: "desk",
      name: 'Workbench 60" × 36" × 24"',
      opening: { width: 60, height: 36, depth: 24, kind: "room" },
      unit: { width: 60, depth: 24, height: 36, doors: false, counterH: 36, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "workbench 72 wide × 30 deep × 34 tall with one lower shelf",
    brief: {
      program: "desk",
      name: 'Workbench 72" × 34" × 30"',
      opening: { width: 72, height: 34, depth: 30, kind: "room" },
      unit: { width: 72, depth: 30, height: 34, doors: false, counterH: 34, shelfCount: 1, centered: true },
    },
  },
  {
    prompt: "potting bench 48 wide × 24 deep × 36 tall with one lower shelf",
    brief: {
      program: "desk",
      name: 'Potting bench 48" × 36" × 24"',
      opening: { width: 48, depth: 24, height: 36, kind: "room" },
      unit: { width: 48, depth: 24, height: 36, doors: false, counterH: 36, shelfCount: 1, centered: true },
    },
  },
  {
    prompt: "planter box 24 wide × 12 deep × 18 tall",
    brief: {
      program: "storage",
      name: 'Planter box 24" × 18" × 12"',
      opening: { width: 24, depth: 12, height: 18, kind: "room" },
      unit: { width: 24, depth: 12, height: 18, doors: false, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "outdoor side table 20 × 20 × 18 tall",
    brief: {
      program: "table",
      name: 'Outdoor side table 20" × 18" × 20"',
      opening: { width: 20, depth: 20, height: 18, kind: "room" },
      unit: { width: 20, depth: 20, height: 18, doors: false, legs: 4, shape: "square", centered: true },
    },
  },
  {
    prompt: "pegboard wall panel fitted to a 48×36 opening",
    brief: {
      program: "storage",
      name: 'Pegboard 48" × 36"',
      opening: { width: 48, height: 36, depth: 0.75, kind: "alcove" },
      unit: { width: 48, depth: 0.75, height: 36, doors: false, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "tool rail spanning 48 with six hooks, clear wall mount",
    brief: {
      program: "storage",
      name: 'Tool rail 48" · 6 hooks',
      opening: { width: 48, height: 6, depth: 4, kind: "room" },
      unit: { width: 48, depth: 4, height: 6, doors: false, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "peg rail spanning 36 with five pegs, clear wall mount",
    brief: {
      program: "storage",
      name: 'Peg rail 36" · 5 pegs',
      opening: { width: 36, height: 6, depth: 4, kind: "room" },
      unit: { width: 36, depth: 4, height: 6, doors: false, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "filing shelf 36 wide × 12 deep × 48 tall with four open bays",
    brief: {
      program: "storage",
      name: 'Filing shelf 36" × 48" × 12"',
      opening: { width: 36, depth: 12, height: 48, kind: "room" },
      unit: { width: 36, depth: 12, height: 48, doors: false, shelfCount: 3, centered: true },
    },
  },
  {
    prompt: "printer stand 24 wide × 20 deep × 30 tall with one lower shelf",
    brief: {
      program: "storage",
      name: 'Printer stand 24" × 30" × 20"',
      opening: { width: 24, depth: 20, height: 30, kind: "room" },
      unit: { width: 24, depth: 20, height: 30, doors: false, shelfCount: 1, centered: true },
    },
  },
  {
    prompt: "lumber rack 48 wide × 24 deep × 72 tall with four arms",
    brief: {
      program: "storage",
      name: 'Lumber rack 48" × 72" × 24"',
      opening: { width: 48, height: 72, depth: 24, kind: "room" },
      unit: { width: 48, depth: 24, height: 72, doors: false, shelfCount: 0, centered: true },
    },
  },

  {
    prompt: "headboard 60 wide",
    brief: {
      program: "storage",
      name: 'Headboard 60" × 48" × 0.75"',
      opening: { width: 60, height: 48, depth: 0.75, kind: "room" },
      unit: { width: 60, depth: 0.75, height: 48, doors: false, centered: true },
    },
  },
  {
    prompt: "coat rack",
    brief: {
      program: "storage",
      name: 'Coat rack 36" × 6.25" × 8"',
      opening: { width: 36, height: 6.25, depth: 8, kind: "room" },
      unit: { width: 36, depth: 8, height: 6.25, doors: false, centered: true },
    },
  },
  {
    prompt: "30 inch range hood",
    brief: {
      program: "storage",
      name: 'Range hood 30" × 24" × 18"',
      opening: { width: 30, height: 24, depth: 18, kind: "room" },
      unit: { width: 30, depth: 18, height: 24, doors: false, centered: true },
    },
  },
  {
    prompt: "dog crate 36x24x30",
    brief: {
      program: "storage",
      name: 'Crate 36" × 30" × 24"',
      opening: { width: 36, height: 30, depth: 24, kind: "room" },
      unit: { width: 36, depth: 24, height: 30, doors: true, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "dog crate 36 wide",
    brief: {
      program: "storage",
      name: 'Crate 36" × 30" × 24"',
      opening: { width: 36, height: 30, depth: 24, kind: "room" },
      unit: { width: 36, depth: 24, height: 30, doors: true, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "wall mounted ironing board cabinet 48 high 16 wide 6 deep",
    brief: {
      program: "storage",
      name: 'Ironing cabinet 16" × 48" × 6"',
      opening: { width: 16, height: 48, depth: 6, kind: "room" },
      unit: { width: 16, depth: 6, height: 48, doors: true, shelfCount: 0, centered: true },
    },
  },
  {
    prompt: "bathroom medicine cabinet 16 wide 24 high 4 deep",
    brief: {
      program: "storage",
      name: 'Medicine cabinet 16" × 24" × 4"',
      opening: { width: 16, height: 24, depth: 4, kind: "room" },
      unit: { width: 16, depth: 4, height: 24, doors: true, shelfCount: 2, mirror: true, centered: true },
    },
  },
  {
    prompt: "over the toilet cabinet 27 wide 68 high 9 deep",
    brief: {
      program: "storage",
      name: 'Over-toilet 27" × 68" × 9"',
      opening: { width: 27, height: 68, depth: 9, kind: "room" },
      unit: { width: 27, depth: 9, height: 68, doors: false, shelfCount: 3, centered: true },
    },
  },
  {
    prompt: "spice rack 18 wide 24 high 4 deep",
    brief: {
      program: "storage",
      name: 'Spice rack 18" × 24" × 4"',
      opening: { width: 18, height: 24, depth: 4, kind: "room" },
      unit: { width: 18, depth: 4, height: 24, doors: false, shelfCount: 3, centered: true },
    },
  },
  {
    prompt: "wine rack 24 wide 36 high 12 deep",
    brief: {
      program: "storage",
      name: 'Wine rack 24" × 36" × 12"',
      opening: { width: 24, height: 36, depth: 12, kind: "room" },
      unit: { width: 24, depth: 12, height: 36, doors: false, shelfCount: 8, centered: true },
    },
  },
  {
    prompt: "wall shelf for jars 24 wide",
    brief: {
      program: "storage",
      name: 'Jar rack 24" × 18" × 4"',
      opening: { width: 24, height: 18, depth: 4, kind: "room" },
      unit: { width: 24, depth: 4, height: 18, shelfCount: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "kitchen base cabinet 24 wide",
    brief: {
      program: "storage",
      name: 'Kitchen base 24" × 34.5" × 24"',
      opening: { width: 24, height: 34.5, depth: 24, kind: "room" },
      unit: { width: 24, depth: 24, height: 34.5, shelfCount: 1, doors: true, centered: true },
    },
  },
  {
    prompt: "kitchen upper cabinet 30 wide",
    brief: {
      program: "storage",
      name: 'Upper cabinet 30" × 30" × 12"',
      opening: { width: 30, height: 30, depth: 12, kind: "room" },
      unit: { width: 30, depth: 12, height: 30, shelfCount: 1, doors: true, centered: true },
    },
  },
  {
    prompt: "coat rack with bench 48 wide",
    brief: {
      program: "bench",
      name: 'Coat bench 48" × 31" × 16"',
      opening: { width: 48, height: 18, depth: 16, kind: "room" },
      unit: { width: 48, depth: 16, height: 18, cubbies: 3, doors: false, centered: true },
    },
  },
  {
    prompt: "bench 48 wide",
    brief: {
      program: "bench",
      name: 'Bench 48" × 18" × 16"',
      opening: { width: 48, height: 18, depth: 16, kind: "room" },
      unit: { width: 48, depth: 16, height: 18, cubbies: 3, doors: false, centered: true },
    },
  },
];

const HOUSE_PROGRAMS = [
  "vanity",
  "closet",
  "pantry",
  "wardrobe",
  "desk",
  "bookcase",
  "media",
  "bench",
  "storage",
  "table",
] as const;

export const briefHousePrompt = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const examples = HOUSE_BRIEF_EXAMPLES.map(
      (e) => `Prompt: ${e.prompt}\nBrief: ${JSON.stringify(e.brief)}`,
    ).join("\n\n");
    const result = await chat(
      [
        {
          role: "system",
          content: `You turn DIY furniture / built-in prompts into a Yard FittedSpec JSON for a real cut list.

Rules:
- Reply with one JSON object only: { "program", "name", "opening", "unit" }.
- program must be one of: ${HOUSE_PROGRAMS.join(", ")}.
- All dimensions in inches. opening and unit share width/height/depth.
- opening.kind: "alcove" | "room" | "pocket" | "window".
- unit may include: shelfCount, cubbies, drawersPerBank, doors, mirror, rod, kneeW, counterH, upperStart, legs (3-4 for table), shape ("rect"|"round"|"oval"|"square"), bays (2-6 for wide closet systems).
- Tables: program "table", legs 3 or 4, shape round / oval / square when asked (not a silent rectangle); dining height defaults 30. A bare inch span ("70 inch table", "table 70\\"") IS the plan width — never copy the 40" round example and never drop the number. Depth equals that span unless deep/wide was said. An unlabeled pair ("70 in by 28 in") is width × depth at dining height 30 — never 28 tall and never a square 70 deep. Shape stays rect unless they said round, oval, or square. Coffee table: height ~18, not dining 30. Oval long×wide×tall — bare 42×24×18 or labeled — is unit plan length×plan-width×height (displayed W×H×D as 42×18×24) with shape "oval" and Oval in the name. Square tops keep W=D; bare 36×36×30 or "30 tall" → displayed 36×30×36 — never let height steal a plan axis. Rect laundry folding stays unlabeled W×H×D.
- TV / media console / entertainment center: program "media", doors false unless doors requested. Keep the typed name (TV console, Media console, …) — not a naked "Media". Honor explicit wide/deep/tall. Default depth 16 and height ~22 only when those were not said. Open front with bay dividers when wide. Not a closet.
- Closet system / wall of storage: program "closet", two unlabeled numbers both ≥60 are W×H in typed order (80x120 → 80 wide × 120 tall), depth default 24; one small number with a large one is depth with width = the large; height default 84 only when height was not given. Set bays ≈ width/32, rod true, one shelf above the rod (not four shelves through the hanging bay).
- Nightstand / bedside table: program "storage", ~20 wide × ~24 tall × ~16 deep, one drawer over an open shelf, doors false. Not a 3-drawer mini dresser. Dresser: program "storage", ~36 tall × ~18 deep, three drawers, not a 24" nightstand and not a closet. Dog crate / kennel: program "storage", the animal goes inside, door true, no shelves, default ~36 wide × 30 tall × 24 deep when they only typed a width — not a bookcase and not a wire dog. Shoe rack / shoe storage: program "storage", doors false, open shoe cubbies or shoe shelves sized for footwear (divider spacing ~4–6" or shelf heights that fit shoes) — not bookcase pin shelves. Headboard / floating shelves: program "storage", doors false, shelves if asked. Coat rack: wall-mounted peg rail + hat shelf, about 36×6×8, no cubby shelves, not a 72" hall tree unless they said tall. Coat hook board (board + hooks + mount height, often pine weekend craft): program "storage", title "Coat hook board" (never Coat rack / Tool rail / portal steal), Buy named pine when pine is typed, honor typed hook count, PDF states mount height like peg/tool/leash rails. Kitchen island: program "storage", title "Kitchen island" (never bare Island or Storage), honor W×D×H, open both sides (no back), counter + toekick, not a closet and not a 4-leg dining table. Prep table: program "table", title "Prep table" (never naked Table or Storage), honor W×D×H, freestanding work top on legs. Folding table / laundry folding table: program "table", title "Folding table" (never naked Table or Storage), honor W×D×H — not a fold-down hung cabinet. Dining table: program "table", title "Dining table" when dining + table (never naked Table); protect Round Table (round 3-leg), Prep table, Outdoor side table. Serving cart: program "storage", title "Serving cart" when serving + cart (not butcher) — do NOT steal into Butcher block cart / Kitchen cart; honor spoken shelf count (two shelves → shelfCount 2), doors false. Butcher block cart / kitchen cart: program "storage", title "Butcher block cart" (or Kitchen cart without serving), honor spoken shelf count (two shelves → shelfCount 2), doors false — never Storage unit. Plate rack / magazine rack (slot-rack class): program "storage", title "Plate rack" (or Magazine rack), honor spoken slot count (three slots → 3 plate slots / dividers like open-cubby densify), doors false — never Storage unit. Open kitchen shelving / open shelving fitted to an opening: program "storage", title "Open kitchen shelving" (or Open shelving), honor fitted W×H×D (especially depth 12), honor spoken shelf count (three shelves → shelfCount 3), doors false — never Storage unit. Range hood: program "storage", honor typed width (30 inch → 30 wide), default ~24 tall × ~18 deep, plywood canopy open on the bottom with a chimney, wall-mounted over the cooktop — never a giraffe, never a wire figure, never a closet. Ironing board cabinet / wall-mounted ironing board: program "storage", honor typed W×H×D (16 wide × 48 high × 6 deep is typical), door true, no shelves — a shallow wall cabinet with a fold-down board inside, not a freestanding storage box and not a closet. Laundry fold-down / fold-down laundry cabinet: same hung-cabinet fold-down-board affordance (not a freestanding laundry folding table), honor typed W×H×D (48 wide × 36 high × 6 deep is typical), piano hinge + support leg, title "Laundry fold-down". Radiator cover: program "storage", floor open-backed cover with top shelf + front grille slats (no door, no full back), honor typed W×H×D (36 wide × 30 high × 10 deep is typical) — not a sealed cabinet. Window seat: program "bench", title "Window seat", same cubby seat family as mudroom bench. Sofa table / console table / entry console: program "table", keep that identity — never Media console (shallow apron table, not a TV carcase). Daybed: program "bench", title "Daybed", one sleep deck + backrest (sleep-platforms on the seat family) — not a bunk stack and not a loft. Medicine cabinet / medicine chest: program "storage", honor typed W×H×D (16 wide × 24 high × 4 deep is typical), door true, two shelves, mirrored door, wall-mounted — not a floor vanity, not a sink, and not a closet just because it said bathroom. Over-the-toilet cabinet / space saver: program "storage", honor typed W×H×D (27 wide × 68 high × 9 deep is typical), doors false, three shelves — a floor étagère that straddles the toilet with an open bottom under the tank shelf, lagged to studs, not a closed floor box and not a vanity. Spice rack: program "storage", honor typed W×H×D (18 wide × 24 high × 4 deep is typical), doors false, three shelves — a wall-hung open rack with a front lip on each shelf so jars cannot slide off, lagged to studs, not a floor box, not a mirrored medicine cabinet, and not a shoe rack. Wine rack: program "storage", honor typed W×H×D (24 wide × 36 high × 12 deep is typical), doors false — a wall-hung open rack with fixed shelves and a 1.5" front rail on each bottle shelf so bottles cannot roll off, honor spoken slot count (twelve/sixteen/12/16 slots → N bottle slots / Bottle rail densify like plate-rack slot class — any typed digit or word count, not only 12), lagged to studs, not a floor bookcase, not a spice rack, and not a closet. Cleat-mounted singular wall shelf: program "storage", title "Wall shelf" (never Wall shelves plural stack), honor typed W×D×thickness as ONE shelf (48×8×2 thick), Wall cleat real, densify voice cleat-mounted (hush floating boards). Mudroom cubbies / mudroom cubby (no bench/seat word): program "storage", floor carcase with open cubby bays and dividers, honor typed W×H×D (often a tall wall unit like 48×72×16) — not a sit bench. Toy cubby wall / kids cubby wall / cubby wall / wall cubby with N cubbies: program "storage", title "Toy cubby wall" (or Kids cubby wall / Wall cubby), honor spoken cubby count (six cubbies → 6 divider bays), honor W×H×D, doors false — never bare Storage unit or an empty 5-piece box. Prefer title stem "Wall cubby" over "Cubby wall" when plain wall cubby. Mudroom / entry bench / window seat: program "bench", honor typed W×H×D, doors false, default cubbies ≈ width/16 (3 cubbies at 48" wide) when cubbies were not said — a sittable seat over open shoe bays with dividers and a front apron, not a hollow storage box and not a vanity. Coat rack with bench / coat bench: program "bench", ~48 wide × ~18 high × ~16 deep, cubbies + peg rail (hooks), floor seat — not a wall-only coat rack and not depth 8. Kitchen base cabinet / base cabinet: program "storage", floor-carcase with door(s), default ~34.5 high × ~24 deep, toekick — not an island and not a hung upper. Kitchen upper cabinet / upper cabinet: program "storage", hung-cabinet with door(s), default ~30 high × ~12 deep, wall-mounted — not a floor base and not a vanity upperStart. Bunk bed / twin bunk: program "storage", family bunk with sleep-platforms, default twin ~42 wide × ~75 deep × ~65 high (full ~56, queen ~62×80), two decks on posts with upper guard rails — not a hollow closet and not a single bedOps box. Loft bed / twin loft: same family and defaults, one elevated deck only (open floor under), title "Loft bed" — not two bunks. Kitchen base cabinet title "Kitchen base" (bare base cabinet stays "Base cabinet"); kitchen upper "Upper cabinet" — never "Storage". Workbench: program "desk", title "Workbench" (never Desk-only or Storage), honor W×D×H, standing shop top with shelfCount 0 unless spoken (one lower shelf → shelfCount 1, not ×3; bare workbench never invents a default shelf), drawers only when said. Potting bench: program "desk", title "Potting bench" (never Bench / Desk / Workbench / Storage / shoe-cubby sit), honor W×D×H, standing work top like workbench with shelfCount 0 unless spoken (one lower shelf → shelfCount 1), no cubby dividers, no sit-test. Pegboard wall panel fitted to an opening: program "storage", title "Pegboard", panel anatomy fitted to W×H opening — never Yard House wire skeleton. Tool rail spanning N with hooks: program "storage", title "Tool rail", clear wall mount, N hooks, PDF states mount height — never Bridge / key / coat portal steal. Peg rail spanning N with pegs: program "storage", title "Peg rail", clear wall mount, N pegs (not 6 hooks default), PDF states mount height — never Tool / key / leash steal (hung-open peg identity). Leash rail spanning N with hooks: program "storage", title "Leash rail", clear wall mount, N hooks, PDF states mount height — never Bridge / Tool / key steal (tool-rail pattern). Filing shelf with N open bays: program "storage", title "Filing shelf" (never File cabinet drawer densify, never Storage/AV steal), honor W×D×H, open-bay shelves (not drawers). Printer stand: program "storage", title "Printer stand" (never Storage), honor W×D×H, exactly one lower shelf when typed (bare workbench still shelf-only-when-typed). Oak monitor stand (weekend craft): pot-hold stand hush like hose reel/umbrella — Buy Oak + 24″ monitor envelope + typed rise (4″), no Orbit chrome. Oak floor lamp stand (weekend craft): pot-hold stand hush like monitor/hose/umbrella — title "Floor lamp stand" (or "Lamp stand") when (floor) lamp + stand or holds a lamp base — never Lattice tower / Eiffel / climb lace; Buy named stock + typed lamp-base envelope (6″ diameter upright) + typed height (60″), no Orbit chrome. Key and mail shelf: program "storage", title "Key and mail shelf", shelf + hooks below, PDF states mount height — never Storage unit / Picture ledge / portal steal. Boot tray bench: program "bench", title "Boot tray bench" (not Boot bench without tray), tray densify + sit-load, honor W×D×H. Book bin bench / bin bench: program "bench", title "Book bin bench" (never naked Bench), sit-load + bin densify, honor W×D×H (36×14×16). Toy chest / toy box: program "storage", title "Toy chest" (never Yard House / Storage / wire), hinged lid honest, honor W×D×H (30×16×18). Coat and cubby wall fitted to an opening: program "storage", title "Coat and cubby wall", four cubbies + full-width coat rod, honor fitted depth (D16) — never Coat rod–only / D12. Oak umbrella stand (weekend craft): pot-hold stand hush like hamper — Buy Oak + upright umbrella envelope (8×8 base when typed), no Orbit chrome. Porch swing frame: title "Porch swing frame" (never naked Bench / Storage), clear swing / hanging seat densify, honor typed frame W×H (60×48). Planter box: program "storage", title "Planter box", open top (no lid/doors), honor typed W×D×H (24×12×18) — never Wire-frame skeleton cube. Lounge / easy / club chair: program "bench", title "Lounge chair" (never Yard House wire / naked Bench / Chair / Adirondack steal), honor typed seat height and seat depth (16″ seat height + 24″ seat depth), real sit anatomy (seat + back + legs/frame). Ottoman / pouf / footstool: program "bench", title "Ottoman" (never Storage / Yard House), square W=D when typed equal, honor height, solid top densify. Rocking chair: title "Rocking chair", curved rocker rails under legs (≠ skis/sled), honor seat height. Prefer seat/chair family routing over naked House wire when seat language present. Adirondack chair: title "Adirondack chair" (never Custom closet), honor 16″ seat height — outdoor seat, not FITTED closet. Pine hose reel stand (weekend craft): pot-hold stand hush like umbrella/hamper — Buy Pine + 18″ diameter upright reel envelope, no Orbit chrome. Outdoor side table: program "table", title "Outdoor side table" (never naked Table), square W=D when typed equal, honor H. Lumber rack with N arms: program "storage", title "Lumber rack", honor W×D×H and spoken arm count (four arms → 4 Arm parts) — never Storage unit without arms. Laundry sorter with N bins: program "storage", title "Laundry sorter", honor W×D×H and spoken bin count (three bins → Bin 1–3 parts) — never Storage unit without bins. Drying rack with N rungs: program "storage", title "Drying rack", honor W×D×H and spoken rung count (four rungs → Rung 1–4) — never Storage unit. Utility shelf / utility shelving fitted to an opening: program "storage", title "Utility shelf", honor fitted W×H×D (especially depth 16) and spoken shelf count (five shelves → shelfCount 5) — never Storage unit. Ironing board wall mount for an N″ board: program "storage", title "Ironing board wall mount", clear wall mount, PDF states mount height from the wall, clear swing — never Yard House wire and never key/coat portal steal (ironing cabinet stays the hung-cabinet path when cabinet is named). Never turn a rack, crate, shelf, island, prep table, dining table, folding table, serving cart, butcher cart, plate rack, magazine rack, floor lamp stand, lamp stand, open kitchen shelving, utility shelf, laundry sorter, drying rack, hood, ironing cabinet, ironing board wall mount, medicine cabinet, over-toilet cabinet, spice rack, wine rack, mudroom bench, boot tray bench, book bin bench, potting bench, planter box, porch swing frame, Lounge chair, Ottoman, Rocking chair, Adirondack chair, outdoor side table, coat and cubby wall, toy cubby wall, kids cubby wall, cubby wall, toy chest, key and mail shelf, peg rail, filing shelf, printer stand, or leash rail, coat hook board, or cleat-mounted Wall shelf into a closet, a vanity, Storage unit, Bridge, sittable shoe-cubby Bench, Yard House wire, multi Wall shelves stack, or a wire animal. A bare "bench 48 wide" is the same seat family (default ~18 high × 16 deep, cubbies), not a hollow box.
- House family: a new noun reuses a shape — table, floor-carcase, hung-open, hung-cabinet, seat, slab, bunk, straddle — from mount (wall/floor/straddle) + use (sit/store/hang/work) + openings (open/door/fold-down). Explicit fold-down / drop-down forces wall hung-cabinet with fold-down-board (ironing and laundry fold-down share it). "Laundry folding table" stays the freestanding table family. Sofa/entry/console tables stay table. Daybed reuses seat + sleep-platforms (one deck + backrest), never bunk/loft geometry. Affordances (jar lips, bottle rails, cubbies, a door, hanging rods) are flags, not a new program. "wall shelf for jars" is hung-open with lips, not a floor storage box. Kitchen base = floor + door + toekick; kitchen upper = wall + door. Bunk bed = family bunk with sleep-platforms affordance — two decks on a post frame (not a hollow carcase, not bedOps legs). Loft bed = same bunk family with one elevated deck and open floor under — not a twin bunk and not a hollow closet. Kitchen base/upper titles stay Kitchen base (or Base cabinet when kitchen untyped) / Upper cabinet — never naked Storage when width is typed. Do not invent extra programs. Do not bake building codes.
- Bathroom vanity: when doors are typed and drawers are not, program "vanity", doors true, omit drawersPerBank and kneeW — door-carcase anatomy (two door leaves ≈ half width each), never invent knee clearance, drawer banks, 22" slides, toe-kick banks, or a mirror. When drawers are typed, honor spoken drawer count and doors if said; invent knee only when knee is typed. Pocket vanity / trapezoid stays the pocket path with knee + drawers. Desk 60×30×29 with 24" knee still has knee.
- Furniture triples without wide/deep/tall are W×D×H.
- Prefer honest shop geometry over decoration. No markdown.

Examples (training data — match this style exactly):

${examples}`,
        },
        { role: "user", content: `Prompt: ${data.prompt}` },
      ],
      900,
    );
    if (!result.ok) return { ok: false as const, error: result.error, brief: null };

    try {
      const parsed = parseModelJson(result.text) as {
        program?: string;
        name?: string;
        opening?: { width?: number; height?: number; depth?: number; kind?: string };
        unit?: Record<string, unknown>;
      } | null;
      if (!parsed?.program || !parsed.opening || !parsed.unit) {
        return { ok: false as const, error: "Could not parse house brief", brief: null };
      }
      const program = HOUSE_PROGRAMS.includes(parsed.program as (typeof HOUSE_PROGRAMS)[number])
        ? (parsed.program as (typeof HOUSE_PROGRAMS)[number])
        : "storage";
      const W = Number(parsed.opening.width ?? parsed.unit.width);
      const H = Number(parsed.opening.height ?? parsed.unit.height);
      const D = Number(parsed.opening.depth ?? parsed.unit.depth);
      if (![W, H, D].every((n) => Number.isFinite(n) && n > 0 && n < 240)) {
        return { ok: false as const, error: "Brief dimensions out of range", brief: null };
      }
      const kindRaw = String(parsed.opening.kind ?? "room");
      const kind =
        kindRaw === "alcove" || kindRaw === "pocket" || kindRaw === "window" || kindRaw === "room"
          ? kindRaw
          : "room";
      const u = parsed.unit;
      const house = detectHouseFamily(data.prompt);
      const brief = {
        program: house?.program ?? program,
        name: String(parsed.name || `${program} ${W}" × ${H}" × ${D}"`),
        opening: { width: W, height: H, depth: D, kind },
        family: house?.family,
        affordances: house?.affordances,
        unit: {
          width: Number(u.width ?? W),
          depth: Number(u.depth ?? D),
          height: Number(u.height ?? H),
          counterH: typeof u.counterH === "number" ? u.counterH : undefined,
          kneeW: typeof u.kneeW === "number" ? u.kneeW : undefined,
          upperStart: typeof u.upperStart === "number" ? u.upperStart : undefined,
          shelfCount: typeof u.shelfCount === "number" ? u.shelfCount : undefined,
          cubbies: typeof u.cubbies === "number" ? u.cubbies : undefined,
          drawersPerBank: typeof u.drawersPerBank === "number" ? u.drawersPerBank : undefined,
          doors: typeof u.doors === "boolean" ? u.doors : undefined,
          mirror: typeof u.mirror === "boolean" ? u.mirror : undefined,
          rod: typeof u.rod === "boolean" ? u.rod : undefined,
          centered: true as const,
          legs: typeof u.legs === "number" ? Math.max(3, Math.min(4, Math.round(u.legs))) : undefined,
          shape: u.shape === "round" || u.shape === "rect" || u.shape === "oval" || u.shape === "square" ? u.shape : undefined,
          bays: typeof u.bays === "number" ? Math.max(2, Math.min(6, Math.round(u.bays))) : undefined,
        },
      };
      return { ok: true as const, brief, error: null };
    } catch {
      return { ok: false as const, error: "House brief parse failed", brief: null };
    }
  });
