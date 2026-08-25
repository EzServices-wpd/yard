/**
 * Full "Add more instructions" enrich path.
 * Split out of grok.ts so the large-file push stays reliable.
 */
import { createServerFn } from "@tanstack/react-start";
import { parseModelJson } from "@/lib/yard/parseJson";

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

type StepShape = {
  step?: number;
  title?: string;
  description?: string;
  tips?: string;
};

function extractSteps(text: string): StepShape[] | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const obj = parseModelJson(cleaned) as { steps?: StepShape[] } | null;
  if (Array.isArray(obj?.steps) && obj.steps.length) return obj.steps;

  if (cleaned.startsWith("[")) {
    try {
      const arr = JSON.parse(cleaned) as StepShape[];
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {
      /* fall through */
    }
    try {
      let arr = cleaned;
      const opens = (arr.match(/\[/g) || []).length - (arr.match(/\]/g) || []).length;
      const braces = (arr.match(/\{/g) || []).length - (arr.match(/\}/g) || []).length;
      arr = arr + "}".repeat(Math.max(0, braces)) + "]".repeat(Math.max(0, opens));
      const parsed = JSON.parse(arr) as StepShape[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* fall through */
    }
  }

  const forced = parseModelJson(`{"steps":${cleaned}}`) as { steps?: StepShape[] } | null;
  if (Array.isArray(forced?.steps) && forced.steps.length) return forced.steps;

  const m = cleaned.match(/"steps"\s*:\s*(\[[\s\S]*)/);
  if (m) {
    let arr = m[1];
    const opens = (arr.match(/\[/g) || []).length - (arr.match(/\]/g) || []).length;
    const braces = (arr.match(/\{/g) || []).length - (arr.match(/\}/g) || []).length;
    arr = arr + "}".repeat(Math.max(0, braces)) + "]".repeat(Math.max(0, opens));
    try {
      const parsed = JSON.parse(arr) as StepShape[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* leave null */
    }
  }

  const objects: StepShape[] = [];
  const re = /\{[^{}]*"title"\s*:\s*"[^"]+"[^{}]*\}/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(cleaned)) !== null) {
    try {
      const o = JSON.parse(hit[0]) as StepShape;
      if (o.title || o.description) objects.push(o);
    } catch {
      /* skip */
    }
  }
  if (objects.length) return objects;

  return null;
}

export const writeInstructions = createServerFn({ method: "POST" })
  .validator(
    (input: {
      prompt: string;
      planText: string;
      baseline?: { step: number; title: string; description: string; tips?: string; partsUsed?: string[] }[];
      kind?: string;
      materialName?: string;
      join?: string;
      pieceCount?: number;
      joints?: number;
      envelope?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const baselineBlock =
      data.baseline && data.baseline.length
        ? data.baseline
            .map(
              (s) =>
                `${s.step}. ${s.title}\n   ${s.description}${s.tips ? `\n   Tip: ${s.tips}` : ""}${
                  s.partsUsed?.length ? `\n   Parts: ${s.partsUsed.join(", ")}` : ""
                }`,
            )
            .join("\n")
        : "(no baseline — write from the plan)";

    const scan = [
      data.kind ? `Kind: ${data.kind}` : "",
      data.materialName ? `Primary stock: ${data.materialName}` : "",
      data.join ? `Primary join: ${data.join}` : "",
      data.pieceCount != null ? `Pieces on the bench: ${data.pieceCount}` : "",
      data.joints != null ? `Joint count: ${data.joints}` : "",
      data.envelope ? `Envelope: ${data.envelope}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await chat(
      [
        {
          role: "system",
          content: `You enrich the shop walkthrough for THIS project only. You are given a deterministic baseline already written from the pieces on the bench.

Your job: make every step more detailed, more helpful, and more specific to this exact build — without changing counts, lengths, part names, or the build order.

Audience: a careful first-time builder with a circular saw and a tape measure, not a cabinet shop. Prefer plain English.

Rules:
- Keep the same number of steps (or add at most 2 intermediate steps if a critical dry-fit / square check is missing). Never invent new piece counts or cut lengths.
- Every sentence must mention something on this bench: a named role, a measured length, a join method, a clearance, a footprint dimension, or a joint count.
- Expand each description into 3–6 short sentences: what to do, how to hold it, what "good" looks like, what goes wrong if you skip the dry-fit.
- When you use a shop term, explain it in parentheses on first use in that step. Examples: carcase (the main box of the unit), toekick (the recessed strip at the floor so your toes clear), dry-fit (assemble without glue or screws to check fit), overlay (door sits on top of the face, not inside the opening), lag (long heavy screw into a wall stud), edge banding (thin strip of veneer ironed onto a raw plywood edge).
- Tips must be actionable (tool choice, order of operations, cure time, square check).
- Frame → support → brace language for lattice / tower / pyramid / bridge. Portal stays open on arch. Abutments plant on the ground for bridge. North door stays open on pyramid.
- No cheerleading. No generic "assemble the structure." No changing the cut list.
- CRITICAL: Reply with one JSON object only. Exact shape: {"steps":[{"title":"string","description":"string","tips":"string optional"}]}. No markdown fences. No commentary before or after the object.`,
        },
        {
          role: "user",
          content: `Prompt: ${data.prompt}

Project scan:
${scan || "(none)"}

Baseline steps (enrich these):
${baselineBlock}

Deterministic plan (cut list + buy + check — numbers are law):
${data.planText.slice(0, 5500)}`,
        },
      ],
      4000,
      { json: true },
    );
    if (!result.ok) return result;

    try {
      const rawSteps = extractSteps(result.text);
      const steps = (rawSteps ?? [])
        .filter((s) => s && (s.title || s.description))
        .slice(0, 18)
        .map((s, i) => ({
          step: typeof s.step === "number" && s.step > 0 ? s.step : i + 1,
          title: String(s.title || `Step ${i + 1}`),
          description: String(s.description || ""),
          tips: s.tips ? String(s.tips) : undefined,
        }));

      if (!steps.length) {
        const snippet = (result.text || "").replace(/\s+/g, " ").slice(0, 180);
        return {
          ok: false as const,
          error: `Could not parse steps${snippet ? ` — got: ${snippet}` : " — empty model reply"}. Try again.`,
        };
      }
      return { ok: true as const, steps };
    } catch {
      return { ok: false as const, error: "Could not parse steps" };
    }
  });
