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
      name: 'Closet 120" × 80" × 24"',
      opening: { width: 120, height: 80, depth: 24, kind: "alcove" },
      unit: { width: 120, depth: 24, height: 80, shelfCount: 4, doors: true, bays: 4, centered: true },
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
- Tables: program "table", legs 3 or 4, shape round when asked; height defaults 30.
- TV / media console: program "media", doors false unless doors requested, depth default 16, shelves default 2.
- Closet system / wall of storage: program "closet", longer axis = width (run), height if ≥60 else default 84, depth default 24, set bays ≈ width/32.
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
