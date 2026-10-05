# Data Model: Engine Cleanup

## PromptSnapshot

| Field | Type | Rules |
|---|---|---|
| id | string | Stable kebab case, unique |
| prompt | string | Exact input string |
| bucket | enum | `fitted-house` \| `weekend-named-stock` \| `craft-kit` \| `unknown-fallback` |
| name | string | Project title from engine |
| kind | string | Project kind |
| material | string | primaryMaterialId |
| overall | {width,height,depth:number} | Exact numbers |
| panels | number | panel count |
| instances | number | instance count |
| uniqueParts | string[] | Sorted unique panel names / roles |
| notesHead | string[] | First ≤2 notes |
| signals | object | Honesty flags (linenExact, mentionsYardBuilt, craftStock, hasKnee24, partBudgetOk) |

## FittedExportSurface

Public symbols that MUST remain importable from `fitted.ts` after the split (non-exhaustive of internals, exhaustive of current external importers):

- `STUD_CENTER_IN`, `HINGE_ARM_CLEAR_IN`
- `shallowWallCabinetFace`, `backReachesTwoStuds`
- `spokenBottleCount`, `typedHeightInches`
- Wine constants + `wineCradle`, `wineCradleOutline`, `wantsBottleFill`, `wineRackLayout`, `inch16`, `wineCapacityVoice`
- `looksLikeFitted`, `detectProgram`, `parseBrief`
- `SHELF_MIN_CLEAR`, `isKidsBookcase`, `isLitterCabinet`
- `buildFitted`, `fittedFromPocketProject`

## Relationships

- PromptSnapshot is produced by running `generateFromPrompt(prompt)` then projecting fields.
- Facade re-exports modules; modules must not create circular imports (shared → wine/detect/parse/builders/build; build may import builders/parse types).
