/** Pull a JSON object out of model text. Survives markdown fences and a cut-off tail. */

export function parseModelJson(text: string): Record<string, unknown> | null {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = raw.indexOf("{");
  if (start < 0) return null;
  const slice = raw.slice(start);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const end = slice.lastIndexOf("}");
  if (end > 0) {
    try {
      return JSON.parse(slice.slice(0, end + 1)) as Record<string, unknown>;
    } catch {
      /* salvage a cut-off array */
    }
  }
  return salvageKey(slice, "steps") ?? salvageKey(slice, "strokes");
}

function salvageKey(slice: string, key: "steps" | "strokes"): Record<string, unknown> | null {
  const mark = slice.match(key === "steps" ? /"steps"\s*:\s*\[/ : /"strokes"\s*:\s*\[/);
  if (!mark || mark.index == null) return null;
  const arrStart = slice.indexOf("[", mark.index);
  if (arrStart < 0) return null;
  let depth = 0;
  let lastObj = -1;
  for (let i = arrStart; i < slice.length; i++) {
    const c = slice[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) lastObj = i;
    } else if (c === "]" && depth === 0 && i > arrStart) {
      try {
        const arr = JSON.parse(slice.slice(arrStart, i + 1));
        return wrap(key, arr);
      } catch {
        break;
      }
    }
  }
  if (lastObj < 0) return null;
  try {
    const arr = JSON.parse(`${slice.slice(arrStart, lastObj + 1)}]`);
    return wrap(key, arr);
  } catch {
    return null;
  }
}

function wrap(key: "steps" | "strokes", arr: unknown): Record<string, unknown> {
  if (key === "steps") return { steps: arr };
  return { form: { strokes: arr } };
}
