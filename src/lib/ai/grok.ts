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

async function chat(messages: { role: "system" | "user"; content: string }[], maxTokens = 700) {
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
    }),
  });
  if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return { ok: true as const, text: body.choices[0]?.message.content ?? "" };
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
      : `Use well-known real proportions for "${subject}" and scale the armature to ${heightIn} inches tall, about ${widthIn} inches in the longest other axis.`;

    const result = await chat(
      [
        {
          role: "system",
          content: `You query the TRUE FORM of whatever the maker named, then return a wire the stock will be mapped onto.

Yard never invents SKUs or stick lengths. You only return a realistic armature — the same kind of wire a sculptor would bend first.

Return JSON only:
{"structure":"${KINDS.join("|")}","materialId":"catalog-id-or-null","heightIn":number,"widthIn":number,"notes":"one sentence citing the real measures","form":{"name":"...","historic":false,"source":"where the proportions came from","strokes":[{"role":"leg|support|brace|ring|rail|tip","points":[{"x":0,"y":0,"z":0}]}]}}

Rules:
- strokes are the wire. 10–20 strokes. Each stroke 3–10 points. Coordinates in INCHES. Y is up. Origin on the ground under the thing.
- Overall height of the highest point MUST be ${heightIn} inches.
- The armature must be ONE connected wire. Every stroke shares at least one endpoint with another stroke. Crossing members are fine. No floating islands.
- Pick the anatomy: loft (towers, pylons), shell (domes, capitols, mosques), figure (animals, people, characters), span (bridges, arches), carcase (furniture, boxes). Closet/window stay closet/opening.
- Use real anatomy / published architecture. A giraffe is not a box: four long legs, short deep body, S-curve neck ~1/3 of height, small head. A guitar is a figure-8 body + thin neck. Liberty is a robed figure on a pedestal with a raised arm and torch, not a cone. Charizard / a dragon on two legs is a wyvern: plantigrade legs, thick tail, small arms, broad wings, snout and horns — not a horse.
- historic true only for a named real monument or site.
- Prefer strokes over abstract boxes. Do not return an empty strokes array.
- Reply with one JSON object only. No markdown. No commentary. Keep it short enough to finish.
- Closet/wardrobe → structure closet and empty strokes. Window rough opening → opening.
- materialId must be a catalog id or null.`,
        },
        {
          role: "user",
          content: `Catalog:\n${catalog}\n\nPrompt: ${data.prompt}\nSubject: ${subject}\n${realBlock}`,
        },
      ],
      1600,
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
              kind: structure ?? "custom",
              historic: !!parsed.form?.historic || !!(real && (real.heightM || real.lengthM)),
              notes: [
                parsed.notes || `True form queried for ${subject}.`,
                looked.summary,
              ].filter(Boolean) as string[],
              ops: strokes.length >= 2 ? [] : ops,
              strokes,
              source: parsed.form?.source || looked.summary,
            }
          : null;
      return {
        ok: true as const,
        structure,
        materialId,
        heightIn: typeof parsed.heightIn === "number" ? parsed.heightIn : heightIn,
        widthIn: typeof parsed.widthIn === "number" ? parsed.widthIn : widthIn,
        notes: parsed.notes ?? "",
        form,
        real: looked.summary || null,
      };
    } catch {
      return { ok: false as const, error: "Could not parse interpretation", real: looked.summary || null, form: null };
    }
  });

/** Wikipedia + Wikidata only — no Grok. Used to pick anatomy before the paid interpret. */
export const hintSubject = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const { classifyFromSource } = await import("@/lib/yard/anatomy");
    const subject = subjectFromPrompt(data.prompt);
    const looked = await lookupRealForm(subject);
    const hit = classifyFromSource(data.prompt, looked.summary);
    return {
      subject,
      summary: looked.summary,
      hit,
    };
  });

export const writeInstructions = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; planText: string }) => input)
  .handler(async ({ data }) => {
    const result = await chat(
      [
        {
          role: "system",
          content: `You write the shop walkthrough for THIS project only. The cut list and quantities are already correct — never change numbers, lengths, names, or counts.
Every sentence must mention something that exists on this bench (a named part, a measured length, a clearance, a join). No generic “cut the shelves” without which shelf and what size.
Short sentences. No cheerleading. Dry-fit, square, glue cure. Frame then support then brace if it is a lattice.
Return JSON only: {"steps":[{"title":"...","description":"...","tips":"...optional"}]}`,
        },
        {
          role: "user",
          content: `Prompt: ${data.prompt}\n\nDeterministic plan:\n${data.planText.slice(0, 6000)}`,
        },
      ],
      900,
    );
    if (!result.ok) return result;
    try {
      const cleaned = result.text.trim().replace(/^```json\s*|```$/g, "");
      const parsed = JSON.parse(cleaned) as {
        steps?: { title: string; description: string; tips?: string }[];
      };
      const steps = (parsed.steps ?? []).slice(0, 16).map((s, i) => ({
        step: i + 1,
        title: s.title,
        description: s.description,
        tips: s.tips,
      }));
      if (!steps.length) return { ok: false as const, error: "No steps returned" };
      return { ok: true as const, steps };
    } catch {
      return { ok: false as const, error: "Could not parse steps" };
    }
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
