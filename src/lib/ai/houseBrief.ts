/**
 * Free-text house prompt → FittedSpec.
 * Few-shots every known-good walk build so the model stays on the cut-list path.
 */
import { createServerFn } from "@tanstack/react-start";
import { parseModelJson } from "@/lib/yard/parseJson";

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
      name: 'Closet 31.5" × 78" × 16"',
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
      name: 'Media unit 70" × 30" × 16"',
      opening: { width: 70, height: 30, depth: 16, kind: "room" },
      unit: { width: 70, depth: 16, height: 30, shelfCount: 2, doors: false, centered: true },
    },
  },
  {
    prompt: "TV console 70 inches wide 30 inches deep",
    brief: {
      program: "media",
      name: 'Media unit 70" × 22" × 30"',
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
    prompt: "kitchen island 60x36x36",
    brief: {
      program: "storage",
      name: 'Island 60" × 36" × 36"',
      opening: { width: 60, height: 36, depth: 36, kind: "room" },
      unit: { width: 60, depth: 36, height: 36, doors: false, counterH: 36, shelfCount: 1, centered: true },
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
- unit may include: shelfCount, cubbies, drawersPerBank, doors, mirror, rod, kneeW, counterH, upperStart, legs (3-4 for table), shape ("rect"|"round"), bays (2-6 for wide closet systems).
- Tables: program "table", legs 3 or 4, shape round when asked; dining height defaults 30. Coffee table: height ~18, not dining 30.
- TV / media console: program "media", doors false unless doors requested. Honor explicit wide/deep/tall. Default depth 16 and height ~22 only when those were not said. Open front. Not a closet.
- Closet system / wall of storage: program "closet", two unlabeled numbers both ≥60 are W×H in typed order (80x120 → 80 wide × 120 tall), depth default 24; one small number with a large one is depth with width = the large; height default 84 only when height was not given. Set bays ≈ width/32, rod true, one shelf above the rod (not four shelves through the hanging bay).
- Nightstand / bedside table: program "storage", ~20 wide × ~24 tall × ~16 deep, one drawer over an open shelf, doors false. Not a 3-drawer mini dresser. Dresser: program "storage", ~36 tall × ~18 deep, three drawers, not a 24" nightstand and not a closet. Dog crate / kennel: program "storage", the animal goes inside, door true, no shelves, default ~36 wide × 30 tall × 24 deep when they only typed a width — not a bookcase and not a wire dog. Shoe rack / headboard / floating shelves: program "storage", doors false, shelves if asked. Coat rack: wall-mounted peg rail + hat shelf, about 36×6×8, no cubby shelves, not a 72" hall tree unless they said tall. Kitchen island: program "storage", honor W×D×H, open both sides (no back), counter + toekick, not a closet and not a 4-leg dining table. Range hood: program "storage", honor typed width (30 inch → 30 wide), default ~24 tall × ~18 deep, plywood canopy open on the bottom with a chimney, wall-mounted over the cooktop — never a giraffe, never a wire figure, never a closet. Ironing board cabinet / wall-mounted ironing board: program "storage", honor typed W×H×D (16 wide × 48 high × 6 deep is typical), door true, no shelves — a shallow wall cabinet with a fold-down board inside, not a freestanding storage box and not a closet. Medicine cabinet / medicine chest: program "storage", honor typed W×H×D (16 wide × 24 high × 4 deep is typical), door true, two shelves, mirrored door, wall-mounted — not a floor vanity, not a sink, and not a closet just because it said bathroom. Over-the-toilet cabinet / space saver: program "storage", honor typed W×H×D (27 wide × 68 high × 9 deep is typical), doors false, three shelves — a floor étagère that straddles the toilet with an open bottom under the tank shelf, lagged to studs, not a closed floor box and not a vanity. Spice rack: program "storage", honor typed W×H×D (18 wide × 24 high × 4 deep is typical), doors false, three shelves — a wall-hung open rack with a front lip on each shelf so jars cannot slide off, lagged to studs, not a floor box, not a mirrored medicine cabinet, and not a shoe rack. Mudroom / entry bench / window seat: program "bench", honor typed W×H×D, doors false, default cubbies ≈ width/16 (3 cubbies at 48" wide) when cubbies were not said — a sittable seat over open shoe bays with dividers and a front apron, not a hollow storage box and not a vanity. Never turn a rack, crate, shelf, island, hood, ironing cabinet, medicine cabinet, over-toilet cabinet, spice rack, or mudroom bench into a closet, a vanity, or a wire animal.
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
      const brief = {
        program,
        name: String(parsed.name || `${program} ${W}" × ${H}" × ${D}"`),
        opening: { width: W, height: H, depth: D, kind },
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
          shape: u.shape === "round" || u.shape === "rect" ? u.shape : undefined,
          bays: typeof u.bays === "number" ? Math.max(2, Math.min(6, Math.round(u.bays))) : undefined,
        },
      };
      return { ok: true as const, brief, error: null };
    } catch {
      return { ok: false as const, error: "House brief parse failed", brief: null };
    }
  });
