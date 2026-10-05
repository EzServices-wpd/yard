# Contract: Prompt snapshot capture

## Input

- `prompt: string` — user brief
- `id`, `bucket` — test metadata

## Output (PromptSnapshot)

Stable JSON object as in `data-model.md`. Numbers must be exact (no stringified floats beyond engine output). `uniqueParts` sorted lexicographically. `notesHead` length ≤ 2.

## Invariants

1. Same prompt → same snapshot (deterministic, no LLM).
2. `linen-closet` ⇒ overall `{31.5, 78, 16}` and `signals.linenExact === true`.
3. Craft-kit bucket ⇒ `signals.craftStock === true` unless intentionally corrected with golden update.
4. Capture MUST go through `generateFromPrompt` (app entry), not a private fitted-only shim that diverges from the UI path.
