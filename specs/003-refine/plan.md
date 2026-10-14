# Plan: 003-refine
- `src/lib/yard/refine.ts`: pure `refinePrompt` (regex for size/count/stock; reuses `promptNamingStock`,
  `detectMaterial`, `hasExplicitStock`). No AI imports.
- `src/components/workspace/refine-box.tsx`: small form in the dock; on submit calls `refinePrompt`, then
  the same `generate` + `makePlan` calls `CatalogPanel.useStock` makes.
- Tests in `src/lib/yard/refine.test.ts` (run by `scripts/run-unit-tests.ts`, in the gate).
