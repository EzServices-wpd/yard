import { createServerFn } from "@tanstack/react-start";
import { FORGE_CATALOG } from "@/lib/yard/catalog";
import { isFormOp, isFormStroke, subjectFromPrompt, type FormOp, type FormRecipe, type FormStroke } from "@/lib/yard/form";
import { parseModelJson } from "@/lib/yard/parseJson";
import { lookupRealForm, stripEntityIds } from "@/lib/yard/wiki";
import type { StructureKind } from "@/lib/yard/types";

const KINDS: StructureKind[] = [
  "eiffel",
  "lattice",
  "tower",
  "taj",
  "pyramid",
  "castle",
  "bridge",
  "house",
  "wall",
  "dome",
  "arch",
  "ladder",
  "frame",
  "closet",
  "opening",
  "figure",
  "vehicle",
  "furniture",
  "vessel",
  "plant",
  "custom",
];

async function chat(
  messages: { role: "system" | "user"; content: string }[],
  maxTokens = 700,
  opts?: { json?: boolean },
) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "AI is not available in this environment" };

  const body: Record<string, unknown> = {
    model: "grok-4.5",
    messages,
    max_tokens: maxTokens,
    temperature: 0.2,
  };
  if (opts?.json) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
  const payload = (await res.json()) as { choices: { message: { content: string } }[] };
  return { ok: true as const, text: payload.choices[0]?.message.content ?? "" };
}

export const interpretPrompt = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; heightIn?: number; widthIn?: number }) => input)
  .handler(async ({ data }) => {
    const catalog = FORGE_CATALOG.map((c) => `${c.id}: ${c.name} [${(c.aliases ?? []).slice(0, 4).join(", ")}]`).join("\n");
    const subject = subjectFromPrompt(data.prompt);
    const looked = await lookupRealForm(subject);
    const heightIn = data.heightIn ?? 36;
    const widthIn = data.widthIn ?? heightIn * 0.5;
    const realBlock = looked.summary
      ? `Real form for "${subject}": ${looked.summary}. Scale the entire armature so its overall height is ${heightIn} inches. Keep the real height/length/width ratios.`
      : `Use well-known real proportions for "${subject}" and scale the armature to about ${heightIn}" high.`;

    const result = await chat(
      [
        {
          role: "system",
          content:
            "You interpret a free-text build prompt into a short form recipe for Yard.\n" +
            "Return one JSON object only. Fields: structure (one of the KINDS), materialId (catalog id or null), heightIn, widthIn, notes (string), form { name, historic, source, strokes[], ops[] }.\n" +
            "- historic true only for a named real monument or site.\n" +
            "- Prefer strokes over abstract boxes. Do not return an empty strokes array.\n" +
            "- Reply with one JSON object only. No markdown. No commentary. Keep it short enough to finish.\n" +
            "- Closet/wardrobe → structure closet and empty strokes. Window rough opening → opening.\n" +
            "- materialId must be a catalog id or null.",
        },
        {
          role: "user",
          content: `Catalog:\n${catalog}\n\nPrompt: ${data.prompt}\nSubject: ${subject}\n${realBlock}`,
        },
      ],
      1600,
      { json: true },
    );
    if (!result.ok) {
      return {
        ...result,
        real: looked.summary || null,
        form: null,
      };
    }
    try {
      const parsed = parseModelJson(result.text) as {
        structure?: string;
        materialId?: string | null;
        heightIn?: number;
        widthIn?: number;
        notes?: string;
        form?: { name?: string; historic?: boolean; source?: string; strokes?: unknown[]; ops?: unknown[] };
      } | null;
      if (!parsed) {
        return { ok: false as const, error: "Could not parse interpretation", real: looked.summary || null, form: null };
      }
      const structure = KINDS.includes(parsed.structure as StructureKind)
        ? (parsed.structure as StructureKind)
        : null;
      const materialId =
        parsed.materialId && FORGE_CATALOG.some((c) => c.id === parsed.materialId)
          ? parsed.materialId
          : null;
      const strokes = (parsed.form?.strokes ?? []).filter(isFormStroke) as FormStroke[];
      const ops = (parsed.form?.ops ?? []).filter(isFormOp) as FormOp[];
      const form: FormRecipe | null =
        strokes.length >= 2 || ops.length > 0
          ? {
              name: stripEntityIds(parsed.form?.name || "") || subject,
              kind: structure ?? "custom",
              historic: !!parsed.form?.historic,
              notes: parsed.notes ? [stripEntityIds(parsed.notes)] : [],
              source: parsed.form?.source,
              strokes,
              ops,
            }
          : null;
      return {
        ok: true as const,
        structure,
        materialId,
        heightIn: parsed.heightIn ?? heightIn,
        widthIn: parsed.widthIn ?? widthIn,
        notes: parsed.notes ? stripEntityIds(parsed.notes) : null,
        real: looked.summary || null,
        form,
      };
    } catch {
      return { ok: false as const, error: "Interpretation parse failed", real: looked.summary || null, form: null };
    }
  });

export const hintSubject = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const subject = subjectFromPrompt(data.prompt);
    const looked = await lookupRealForm(subject);
    return {
      subject,
      summary: looked.summary || null,
      measures: looked.measures || null,
    };
  });

/**
 * Recipe lookup (spec 001 R1): a named object the engine has no family for comes back as a structured
 * recipe of its defining parts, never a shape. At most two calls per unseen noun (lookup plus one retry
 * with the failures); a saved recipe needs none.
 */
const RECIPE_SYSTEM = [
  "You describe how a real object is built, as JSON only. Schema:",
  '{"key":"head-noun","synonyms":[],"title":"","size":{"width":0,"height":0,"depth":0},"craftSize":{...}?,"feet":bool,"outdoor":bool,"wall":bool,',
  '"count":{"word":"bays","default":1}?,"defining":["role"],"parts":[{"role":"post|rail|tower|cable|deck|wheel|axle|roof|bay|dome|minaret|stringer|tread|lid|hinge|...",',
  '"name":"Unique name","box":[x,y,z,w,h,d],"kind":"member|panel|cover|hardware","on":["names of parts that carry it"],"repeat":"each|between"?,"shape":"disc|ring|cylinder|bead"?,"bore":inches?}],',
  '"moving":[{"part":"name","motion":"fold|hinge|pivot|spin|slide"}],"notes":[]}',
  "Sizes are inches at the typical real size. box values are shares (0..1) of width, height, depth; y=0 is the floor.",
  "Round parts name their shape: a wheel is a ring (rim) or disc, an axle or drum a cylinder, a bead a bead with a bore over the rod's diameter.",
  "Every part touches what it sits on; a part with no 'on' stands on the floor. Build the defining parts at real proportions; never a closed box.",
  "Always include key, title, size, parts and notes. Every part needs role, name, box (six numbers) and kind; 'on' may only name other parts' exact names. At most 24 parts: use repeat for runs of identical parts.",
  "Keep every part inside the size box (shares 0..1); a wheel's axle sits at the wheel's centre, and the wheel reaches the floor.",
  "A lid, door or other hinged part touches the part it hinges to along one edge, lists it in 'on', and has a moving entry with motion hinge; a cold frame's lid slopes from a low front to a taller back.",
].join("\n");

export const lookupRecipe = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; feedback?: string[] }) => input)
  .handler(async ({ data }) => {
    const user = data.feedback?.length ? `${data.prompt}\nThe last recipe failed these checks; fix them: ${data.feedback.join("; ")}` : data.prompt;
    // grok-4.5 spends part of max_tokens on reasoning: 1600 cut long recipes off mid-JSON, which read as
    // "missing fields". Give the reply room for a full part list.
    const result = await chat([{ role: "system", content: RECIPE_SYSTEM }, { role: "user", content: user }], 8000, { json: true });
    return result.ok ? { ok: true as const, recipeJson: JSON.stringify(parseModelJson(result.text)) } : { ok: false as const, error: result.error };
  });

export { writeInstructions } from "./writeInstructions";

export const renderProject = createServerFn({ method: "POST" })
  .validator((input: { name: string; prompt: string; brief: string; scene?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Rendering is not available in this environment" };
    const scene = (data.scene ?? "").trim();
    const imagine = [
      `Photoreal photograph of the finished piece: ${data.name}.`,
      data.brief.slice(0, 700),
      scene
        ? `Setting: ${scene}.`
        : "Setting: a real room that fits the piece — bathroom alcove if it is a vanity, workshop bench if it is a model, living room if it is furniture. Natural window light.",
      "Built of the actual material named. Square, clean joinery, no text, no watermarks, no exploded diagram. Looks like a finished thing someone just built.",
    ].join(" ");
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-quality",
        prompt: imagine,
        n: 1,
        resolution: "1k",
        response_format: "url",
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false as const, error: `Render failed (${res.status})${err ? `: ${err.slice(0, 160)}` : ""}` };
    }
    const body = (await res.json()) as { data?: { url?: string }[] };
    const url = body.data?.[0]?.url;
    if (!url) return { ok: false as const, error: "No image returned" };
    return { ok: true as const, url, prompt: imagine, scene };
  });
