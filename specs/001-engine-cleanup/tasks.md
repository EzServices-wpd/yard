# Tasks: Engine Cleanup

**Input**: Design documents from `/specs/001-engine-cleanup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup

- [x] T001 Confirm feature dir `specs/001-engine-cleanup/` and `.specify/feature.json` point at it
- [x] T002 [P] Ensure `.gitignore` does not ignore `*.goldens.json` or Spec Kit artifacts needed in git

## Phase 2: Foundational

- [x] T003 Add capture helper `capturePromptSnapshot` in `src/lib/yard/promptSnapshots.ts` matching `contracts/prompt-snapshot.md`
- [x] T004 Commit generated goldens at `src/lib/yard/promptSnapshots.goldens.json` (~40 cases, four buckets)

## Phase 3: User Story 1 — Prompt snapshots (P1)

**Goal**: ~40 golden snapshots green in CI unit-test path
**Independent Test**: `npx tsx --test src/lib/yard/promptSnapshots.test.ts`

- [x] T005 [US1] Write `src/lib/yard/promptSnapshots.test.ts` comparing live captures to goldens (name/dims/parts/notesHead/signals)
- [x] T006 [US1] Assert linen-closet golden enforces overall 31.5×78×16 and `linenExact`
- [x] T007 [US1] Run snapshot file alone until green; fix capture shape only (no engine behavior change)

## Phase 4: User Story 2 — Modularize fitted.ts (P2)

**Goal**: Split monolith; facade keeps imports working; snapshots stay green
**Independent Test**: snapshots + `npx tsc --noEmit` + shallow-wall-cabinet test

- [x] T008 [US2] Extract shared constants/helpers into `src/lib/yard/fittedShared.ts`
- [x] T009 [P] [US2] Extract wine block into `src/lib/yard/fittedWine.ts`
- [x] T010 [P] [US2] Extract `looksLikeFitted` / `detectProgram` into `src/lib/yard/fittedDetect.ts`
- [x] T011 [US2] Extract `parseBrief` (+ parse-only helpers) into `src/lib/yard/fittedParse.ts`
- [x] T012 [US2] Extract specialty `build*` carcases into `src/lib/yard/fittedBuilders.ts`
- [x] T013 [US2] Extract `buildFitted` / `fittedFromPocketProject` into `src/lib/yard/fittedBuild.ts`
- [x] T014 [US2] Turn `src/lib/yard/fitted.ts` into thin re-export facade of public exports
- [x] T015 [US2] Re-run snapshots + typecheck; restore any accidental behavior drift or update goldens only with documented honesty reason

## Phase 5: User Story 3 — ARCHITECTURE.md (P3)

**Goal**: Document real engine paths after split
**Independent Test**: listed paths exist on disk

- [x] T016 [US3] Write `docs/ARCHITECTURE.md` with pipeline + fitted module map pointing at real paths

## Phase 6: Polish

- [x] T017 Run full local guards mirroring `.github/workflows/guards.yml`; fix failures
- [x] T018 `git fetch` + rebase on `origin/main`; commit Spec Kit + implementation; push with `env -u GH_TOKEN -u GITHUB_TOKEN git push origin HEAD:main`

## Dependencies

- Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
- T009/T010 parallel after T008; T011–T014 sequential after detect/wine exist

## Parallel example

```text
# After T008:
T009 fittedWine.ts || T010 fittedDetect.ts
```

## MVP

T001–T007 (snapshots only). Prefer completing T008–T016 in the same ship if snapshots stay green.

## Implementation strategy

1. Snapshots first (constitution IV).
2. Mechanical moves only (Ponytail).
3. Facade so importers do not change.
4. Architecture doc last so paths are real.
