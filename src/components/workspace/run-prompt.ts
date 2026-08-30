"use client";

import { hintSubject, interpretPrompt } from "@/lib/ai/grok";
import { briefHousePrompt } from "@/lib/ai/houseBrief";
import { recipeFromAnatomy, isLockedForm } from "@/lib/yard/form";
import { looksLikeFitted, parseBrief } from "@/lib/yard/fitted";
import { useYard } from "@/lib/yard/store";
import type { FittedSpec } from "@/lib/yard/types";

const HOUSE_HINT =
  /closet|desk|vanity|table|console|\btv\b|cabinet|bookcase|pantry|wardrobe|bench|media|storage|shelf|system|dresser|nightstand|sideboard|credenza|hutch|alcove|built-?in|linen|mudroom|island|drawer/i;

function isHousePrompt(prompt: string, kind?: string, fitted?: unknown) {
  if (kind === "closet" || fitted) return true;
  if (looksLikeFitted(prompt)) return true;
  return HOUSE_HINT.test(prompt);
}

/** Homepage ?q= and the bench prompt bar share this so house prompts never fall through to craft interpret. */
export async function runYardPrompt(raw: string, opts: { fresh?: boolean } = {}) {
  const prompt = raw.trim();
  if (!prompt) return;

  const generate = useYard.getState().generate;
  const makePlan = useYard.getState().makePlan;
  const revealBench = useYard.getState().revealBench;

  const parsed = parseBrief(prompt);
  generate(prompt, undefined, undefined, {
    fresh: opts.fresh,
    fittedOverride: parsed ?? undefined,
  });
  makePlan();

  const next = useYard.getState().project;
  if (next.kind === "opening" || isLockedForm(next.kind) || next.flat) {
    revealBench();
    return;
  }

  const offline =
    typeof window !== "undefined" &&
    /(?:^|[?&])(?:local|offline)=1/.test(window.location.search);
  if (offline) {
    revealBench();
    return;
  }

  const houseLike = isHousePrompt(prompt, next.kind, next.fitted);
  useYard.setState({ grokBusy: true, grokError: null, building: true });
  const timeout = window.setTimeout(() => {
    useYard.setState({ grokBusy: false });
    revealBench();
  }, 22000);

  try {
    if (houseLike) {
      const house = await briefHousePrompt({ data: { prompt } });
      if (house.ok && house.brief) {
        generate(prompt, undefined, undefined, {
          fresh: true,
          fittedOverride: house.brief as FittedSpec,
        });
        makePlan();
        const current = useYard.getState().project;
        const note = "Brief refined from house training set.";
        if (!current.notes.includes(note)) {
          useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
        }
      }
      return;
    }

    const hint = await hintSubject({ data: { prompt } });
    if (hint.summary && hint.summary !== hint.subject) {
      const form = recipeFromAnatomy(`${prompt} ${hint.summary}`, next.overall);
      generate(prompt, undefined, form);
      makePlan();
      const current = useYard.getState().project;
      const note = `Looked up: ${hint.summary}`;
      if (!current.notes.includes(note)) {
        useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
      }
    }
    const interp = await interpretPrompt({
      data: { prompt, heightIn: next.overall.height, widthIn: next.overall.width },
    });
    const after = useYard.getState().project;
    const locked =
      isLockedForm(after.kind) || after.kind === "closet" || after.kind === "opening" || !!after.flat;
    if (interp.ok && interp.form && !locked) {
      generate(prompt, interp.materialId ?? undefined, interp.form);
      makePlan();
    } else if (interp.ok && interp.materialId && interp.materialId !== after.primaryMaterialId && !locked) {
      generate(prompt, interp.materialId);
      makePlan();
    }
    if (interp.ok && (interp.real || interp.notes)) {
      const current = useYard.getState().project;
      const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
      useYard.getState().setProject({
        ...current,
        notes: [...current.notes, ...extra.filter((n) => !current.notes.includes(n))],
      });
    }
  } catch {
    /* deterministic already on the bench */
  } finally {
    window.clearTimeout(timeout);
    useYard.setState({ grokBusy: false });
    revealBench();
  }
}
