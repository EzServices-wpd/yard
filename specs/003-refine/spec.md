# Feature Specification: Refine box

**Feature**: `003-refine` · **Status**: Draft · **Created**: 2026-10-13

## Why
Changing one thing about a build (taller, a drawer, plywood) means retyping the whole prompt. Ezra wants a
free Refine box under the model that edits the current build with no AI call.

## User scenarios
1. **Size** — "make it 6 inches taller" on a 60" bookcase rebuilds it 66" tall; same shape, same stock.
2. **Count** — "add a drawer" adds one drawer; "two shelves" sets two shelves.
3. **Stock** — "use plywood" rebuilds from plywood the way the Stock panel does.
4. **Anything else** — the phrase is appended to the prompt and the existing parser reads it.

## Requirements
- **R1** A "Refine" input sits under the model (in the bench dock) whenever a build is on the bench.
- **R2** `refinePrompt(prompt, phrase, project)` merges the phrase into the current prompt: a size change
  restates the three sizes, a count replaces the stated count, a stock phrase uses `promptNamingStock`.
- **R3** The merged prompt rebuilds with `generate(..., { fresh, keepView })` + `makePlan`, the stock-switch
  path; the prompt bar shows the merged prompt.
- **R4** Zero AI calls: refine never calls `runYardPrompt` or any server function.
- **R5** The linen closet stays exactly 31.5×78×16 (gate baseline).

## Acceptance tests (`src/lib/yard/refine.test.ts`)
10 phrases across common builds: bookcase taller / two shelves / wider; nightstand add a drawer;
desk 2 inches lower / one drawer; workbench use plywood / 12 inches longer; medicine cabinet 2 inches deeper;
bookcase use plywood keeps shape and size. Each asserts the changed size, count or stock. One test stubs `fetch` and
asserts it is never called.
