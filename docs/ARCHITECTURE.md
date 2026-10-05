# Yard engine architecture

How a typed prompt becomes one honest model (title, HUD, Measure, cut list, Buy list, steps).

## Pipeline

```
prompt
  → promptMain.generateFromPrompt
      → looksLikeFitted / parseBrief / buildFitted   (fitted facade)
      → OR weekend / craft / figure / loft paths
  → YardProject on the bench
  → report.buildPlan → steps, cut list, Buy list
```

Geometry is deterministic. LLM voice (when present) must not overwrite locked named form recipes.

## Fitted modules (post–engine-cleanup split)

`src/lib/yard/fitted.ts` is a **thin re-export facade**. Callers keep importing from `./fitted` / `@/lib/yard/fitted`.

| Module | Path | Role |
|---|---|---|
| Facade | `src/lib/yard/fitted.ts` | Public exports only |
| Shared | `src/lib/yard/fittedShared.ts` | Constants, spoken counts, `panel` / `pushPegs`, stud/hinge clears, kids bookcase helpers |
| Wine | `src/lib/yard/fittedWine.ts` | Wine-rack layout, cradle geometry, capacity voice |
| Detect | `src/lib/yard/fittedDetect.ts` | `looksLikeFitted`, `detectProgram` |
| Parse | `src/lib/yard/fittedParse.ts` | `parseBrief` (measured prompt → `FittedSpec`) |
| Builders | `src/lib/yard/fittedBuilders.ts` | Specialty carcases (bench, hung, beds, litter, shoe, …) |
| Build | `src/lib/yard/fittedBuild.ts` | `buildFitted`, `fittedFromPocketProject` |

## Prompt entry and neighboring engine paths

| Concern | Path |
|---|---|
| Public prompt API | `src/lib/yard/prompt.ts` → `promptMain.ts` / `promptHelpers.ts` / `promptDreams.ts` |
| Form recipes / templates | `src/lib/yard/form.ts`, `formTemplates.ts`, `formBuildersCore.ts`, `formBuildersExtra.ts` |
| Weekend / craft stock honesty | `src/lib/yard/weekendFamily.ts`, `weekendStockHonesty.ts` |
| Anatomy / loft / connect | `src/lib/yard/anatomy.ts`, `lattice.ts`, `connect.ts`, `ghost.ts` |
| Plan / steps / Buy | `src/lib/yard/report.ts`, `steps.ts`, `bom.ts` |
| Prompt snapshot goldens | `src/lib/yard/promptSnapshots.ts`, `promptSnapshots.goldens.json`, `promptSnapshots.test.ts` |

## Constitution freeze (canaries)

Before tip ships, keep green and exact:

- Linen closet **31.5 × 78 × 16**
- Bathroom pocket vanity (original trapezoid)
- Andersen 36×48 hung + RO
- Desk 60 × 30 × 29 with 24″ knee
- 3-ft popsicle Eiffel (craft; never an Eiffel lattice template)

See `.specify/memory/constitution.md` and `docs/ENGINE.md` for product rules. This file describes **layout after modularization**; ENGINE.md remains the deeper loft/structural narrative.

## Snapshot-before-refactor

Behavior-changing moves in the fitted path require the ~40 goldens in `promptSnapshots.goldens.json` to stay green (or an intentional honesty fix with an updated golden and a written reason).

<!-- ponytail: split is move-only behind the facade; no new abstraction layers. -->
