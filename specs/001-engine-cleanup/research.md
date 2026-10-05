# Research: Engine Cleanup

## Decision: Reuse generateFromPrompt + node:test

- **Decision**: Capture goldens via `generateFromPrompt` (same entry as the app) and assert with `node:assert/strict` under `node:test`, run by `scripts/run-unit-tests.ts`.
- **Rationale**: Existing harness already discovers `src/lib/yard/*.test.ts`; no new deps; deterministic (no LLM in that path).
- **Alternatives considered**: Vitest snapshots (new dep); deep-equal entire YardProject (too brittle / huge); only assert linen (too thin vs constitution IV).

## Decision: JSON goldens file beside the test

- **Decision**: Commit `promptSnapshots.goldens.json` with one object per case; test loads and deep-equals the capture shape.
- **Rationale**: Easy to review diffs when intentional honesty fixes update goldens; one file for ~40 cases.
- **Alternatives considered**: Inline expected objects (noisy); binary snapshots (opaque).

## Decision: Sibling modules + facade, not fitted/ directory

- **Decision**: Split into `fittedShared.ts`, `fittedWine.ts`, `fittedDetect.ts`, `fittedParse.ts`, `fittedBuilders.ts`, `fittedBuild.ts`; keep `fitted.ts` as re-exports.
- **Rationale**: Current imports are `./fitted` / `@/lib/yard/fitted` resolving to `fitted.ts`. A `fitted/` package would conflict or force import edits.
- **Alternatives considered**: `fitted/index.ts` package (import path risk); leave monolith (fails US2).

## Decision: Move-only seams

- **Decision**: Cut at wine block, detect/parse, specialty builders, buildFitted — already visible export boundaries. Shared constants/helpers go to `fittedShared.ts`.
- **Rationale**: Constitution V + hint text; redesign is out of scope.
- **Alternatives considered**: Full rewrite by program class (too large); extract only wine (insufficient).
