import { createServerFn } from "@tanstack/react-start";
import { FORGE_CATALOG } from "@/lib/yard/catalog";
import { isFormOp, isFormStroke, subjectFromPrompt, type FormOp, type FormRecipe, type FormStroke } from "@/lib/yard/form";
import { parseModelJson } from "@/lib/yard/parseJson";
import { lookupRealForm } from "@/lib/yard/wiki";
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
    const real = looked.measures;
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
              name: parsed.form?.name || subject,
              historic: !!parsed.form?.historic,
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
        notes: parsed.notes ?? null,
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

export const writeInstructions = createServerFn({ method: "POST" })
  .validator((input: { name: string; prompt: string; steps: string; cutList: string }) => input)
  .handler(async ({ data }) => {
    const result = await chat(
      [
        {
          role: "system",
          content:
            "You write short shop instructions for a DIY build. Numbered steps. Plain English. No fluff. Reply with the steps only.",
        },
        {
          role: "user",
          content: `Name: ${data.name}\nPrompt: ${data.prompt}\nCut list:\n${data.cutList}\nExisting steps:\n${data.steps}`,
        },
      ],
      900,
    );
    if (!result.ok) return result;
    return { ok: true as const, text: result.text };
  });

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
