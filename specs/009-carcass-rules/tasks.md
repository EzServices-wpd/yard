# Tasks: 009 carcass shelf rules (code starts only after Critic passes this spec)

Format: `[ID] [P?] description — acceptance — size`. [P] = can run in parallel with the task above it.

## Phase 0: gates (no code)
- [ ] T001 Critic grades `specs/009-carcass-rules` (spec, plan, acceptance, REVIEW) — PASS or edits — 0 lines
- [ ] T002 Wait for #112 and #142 to merge into the release branch; merge release into the work branch (merge only) — both merged — 0 lines
- [ ] T003 Ask Critic to add prompts to `sets.py`: `bookcase with 0 shelves` (exists, row 211), `bookcase 60 wide 30 tall with 8 shelves` (`levels_usable`), `cabinet 48 wide with shelves` (default-shrink note) — Critic's call — 0 lines
- [ ] T004 Copy the precheck's carcass prompts (158 probes + SHELF_COUNT + carcass REGRESSION/DRIFT prompts) to `evals/carcass-shelf-prompts.json` with the precheck date — file committed in PR 1 — ~1 file (data)

## Phase 1: PR 1 bookcase (≤ 400 lines) — fixes row 211, holds 300/304/307/317 and #142's refusals
- [ ] T010 `carcassShelves.ts`: types, `CARCASS_SHELF_RULES` bookcase rows, `planShelves` (fit, positions, default shrink, refusal via `closetShelfMinHeight`) — unit tests per formula (fit edge at exactly 7", 0, 12, fractions, 1/2" stock) — ~150
- [ ] T011 One typed-count reader (export from `spec.ts`; `typedShelfDemand` delegates) — `bookcase with 0 shelves` → 0; "ten shelves" → 10; "6 foot shelf" → none — ~30
- [ ] T012 `buildFitted`: build `ShelfInput` from existing variables; bookcase places `plan.levels` — legacy path unchanged for other programs — ~40
- [ ] T013 `carcassShelves.parity.test.ts` — non-bookcase prompts identical; bookcase prompts identical except row 211's asserted change — ~90
- [ ] T014 graphify explain on head for every touched function → "Blast radius" in the PR body (local only)
- [ ] T015 gstack-review; precheck on head (no FAIL; 211 open → hold); eval gate + canaries under the heavy lock; ship note with the precheck table, "ponytail: what I didn't write", and the standing misses line

## Phase 2: PR 2 read-back (≤ 400 lines) — 315(1), 336 residue
- [ ] T020 `shelfPlanOf` (levels at 1/16", pieces per level, fixed/hat count) — tests on 1-bay, 2-bay, rod+hat builds — ~60
- [ ] T021 Switch the 6 callers (`headerFeatures`, `factsFromProject`, `modelInteriorCounts`, `closetBom`, `uniquePanelSteps`, `MeasurePanel`) — check 6 0 new; list every build whose count moves — ~80
- [ ] T022 Retire `shelfLineCount` (or keep as a one-line wrapper if a test pins it) — ~10

## Phase 3+: one family per PR (same T0x0–T0x5 shape as PR 1)
- [ ] T030 cabinet (default shrink note) · T040 pantry · T050 wardrobe (#112/#142 rows; 315(3)) · T060 nightstand · T070 dresser · T080 vanity (knee path; desk canary watch) · T090 linen (parity only, then delete the legacy generic shelf section; SC-004 grep)

## Every PR
- [ ] ≤ 400 changed lines; merge release in if the branch is older than a day; no rebase, no force push
- [ ] Precheck table on the head sha; gstack-review findings; blast radius; ponytail line
- [ ] A row that blocks twice → systematic-debugging + gstack-investigate DEBUG REPORT before the next push
