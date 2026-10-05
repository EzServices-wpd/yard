# Implementation Plan: Engine Cleanup

**Branch**: `001-engine-cleanup` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-engine-cleanup/spec.md`

## Summary

Lock ~40 deterministic prompt goldens across fitted / weekend / craft / fallback, then mechanically split `src/lib/yard/fitted.ts` into sibling modules with a thin re-export facade, and document the layout in `docs/ARCHITECTURE.md`. Snapshots first; split only while goldens stay green.

## Technical Context

**Language/Version**: TypeScript (Node 22), ESM (`"type": "module"`)

**Primary Dependencies**: Existing Yard engine (`generateFromPrompt`, fitted parse/build, report). No new packages.

**Storage**: Committed JSON goldens at `src/lib/yard/promptSnapshots.goldens.json`

**Testing**: `node:test` via `npx tsx --test` / `scripts/run-unit-tests.ts` (CI Unit tests step)

**Target Platform**: Local + GitHub Actions `guards.yml`

**Project Type**: Web app (Vite / TanStack) with pure engine library under `src/lib/yard/`

**Performance Goals**: Snapshot suite completes in seconds on CI (no LLM)

**Constraints**: Constitution I–V; linen 31.5×78×16 sacred; no new deps; shortest diffs; public fitted imports unchanged

**Scale/Scope**: ~40 snapshots; ~7000-line fitted split into ~5 modules + facade; one architecture doc

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|---|---|
| I. One Model Honesty | PASS — snapshots lock title/dims/parts together |
| II. Universal Engine Rules | PASS — no noun patches; mechanical move only |
| III. Freeze Canaries | PASS — linen + launch prompts included in goldens |
| IV. Snapshot Before Refactor | PASS — P1 goldens before P2 split |
| V. Ponytail | PASS — reuse `generateFromPrompt` / existing test runner; no new framework |

Post-design: still PASS — modules are move-only seams already visible in `fitted.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/001-engine-cleanup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/lib/yard/
├── promptSnapshots.goldens.json      # committed goldens
├── promptSnapshots.ts                # capture helper
├── promptSnapshots.test.ts           # ~40 cases
├── fitted.ts                         # thin re-export facade
├── fittedShared.ts                   # constants + shared helpers
├── fittedWine.ts                     # wine rack geometry/voice
├── fittedDetect.ts                   # looksLikeFitted, detectProgram
├── fittedParse.ts                    # parseBrief
├── fittedBuilders.ts                 # specialty build* carcases
└── fittedBuild.ts                    # buildFitted + pocket bridge
docs/ARCHITECTURE.md
```

## Complexity Tracking

No unjustified complexity. Split follows natural seams already in the file; facade avoids churning importers.
