# Tasks: 009 carcass shelf rules (code starts only after Critic passes this spec)

Format: `[ID] [P?] description — acceptance — size`. [P] = can run in parallel with the task above it.

## Phase 0: gates (no code)
- [ ] T001 Critic grades `specs/009-carcass-rules` r2 (spec, plan, acceptance, REVIEW) — PASS or edits — 0 lines
- [ ] T002 Wait for #112 to merge into the release branch (#142 merged in 4e74ad3); merge release into the work branch (merge only) — merged — 0 lines
- [x] T003 Critic added the "009" rows to `sets.py` (88 assertions after r3): `bookcase 60 wide 30 tall with 8 shelves` (guard), `cabinet 48 wide with shelves` and `bookcase 60x30x8` (`min_level_pitch 7.75`), `cabinet 48 wide 30 tall with 4 shelves` and `bookcase with 13 shelves` (`levels_usable`), `nightstand 20 wide 24 tall with 3 shelves` (`levels_eq_or_refused`). Critic is adding `ends_supported` (FR-010) — Critic's call — 0 lines
- [ ] T004 Copy the precheck's carcass prompts (158 probes + SHELF_COUNT + carcass REGRESSION/DRIFT/"009" prompts) to `evals/carcass-shelf-prompts.json` with the precheck date — file committed in PR 1 — ~1 file (data)

## Phase 1: PR 1 bookcase (≤ 400 lines) — 211, 13 shelves, 1/2" stock minimum; holds 300/304/307/317 and #142's refusals
- [ ] T010 `carcassShelves.ts`: types, `CARCASS_SHELF_RULES` bookcase rows (`bookcase.default` `drives: false`), `planShelves` (fit, positions, refusal via `minH` with the picked stock's t, the stock limit and the second refusal form) — unit tests per formula (fit edge at exactly 7", 0, 11 at 94 1/2" builds, 12/13 over 96" → second form with K = 11, fractions, 1/2" stock → 68 1/2" for 8, no max) — ~160
- [ ] T011 Widen `shelfClear.ts typedShelfDemand` in place (no family gate; 0, "no shelves", eleven, any n; never a unit or axis word before "shelf"); the family gate and 1–12 range move to the callers (`tooSmall.ts:125`, `fittedBuild.ts:2877`) behind `WIDENED_SHELF_FAMILIES = ["bookcase"]`, so wardrobe/closet/pantry/linen keep today's result — `bookcase with 0 shelves` → 0; `no shelves` → 0; `eleven shelves` → 11; `bookcase with 13 shelves` → 13; size phrases are never counts: `small 6 foot shelf` → none, `bookcase 12 inch shelves` → none, `bookcase 30 wide shelves` → none (`shelfSpan.test.ts:509` stays as is) — ~30
- [ ] T012 `buildFitted`: build `ShelfInput` from existing variables; bookcase places `plan.levels` — legacy path unchanged for other programs — ~40
- [ ] T013 `carcassShelves.parity.test.ts` — non-bookcase prompts identical; bookcase prompts identical except the asserted changes: row 211 (+ `60x30x8 with 0 shelves`), `bookcase with 13 shelves` → second-form refusal (110", holds 11, nothing built at 84"), the 1/2" ply 68 1/2" build — ~90
- [ ] T014 graphify explain on head for every touched function → "Blast radius" in the PR body (local only)
- [ ] T015 gstack-review; precheck on head (no FAIL; 211 and the 13-shelf row open → hold); eval gate + canaries under the heavy lock; ship note with the precheck table, "ponytail: what I didn't write", and the standing misses line

## Phase 1b: PR 1b bookcase default shrink (≤ 150 lines)
- [ ] T016 `bookcase.default` `drives: true` — asserted: `bookcase 60 wide 30 tall` 5 at 4" → 2 at 8 3/4" with "2 shelves fit at 30" with 7" clear between them; a bookcase 48" tall holds all 5."; `bookcase 60x30x8` 5 in 8" → 0 with "This 8" bookcase is an open box; a bookcase 17" tall holds 1 shelf with 7" clear, 48" holds all 5."; no header count in either — ~40

## Phase 2: PR 2 read-back (≤ 400 lines) — 315(1), 336 residue
- [ ] T020 `shelfPlanOf` (levels at 1/16", pieces per level, fixed/hat count) — tests on 1-bay, 2-bay, rod+hat builds — ~60
- [ ] T021 Switch the 8 callers: the 6 `shelfLineCount` callers (`headerFeatures`, `factsFromProject`, `modelInteriorCounts`, `uniquePanelSteps` glue title, `MeasurePanel`, honesty guards), `shelfLevelLayout`/`shelfLevelsFit` (`tooSmall.ts:126/128`) and `adjustableShelfTalk` (`report.ts:1039` Buy pin note, `steps.ts:2620` pin title) — check 6 0 new; list every build whose count moves — ~90
- [ ] T022 `shelfPlanOf` owns the Buy pin note; delete the `report.ts:1059` fallback (it calls pin pieces shelves) — ~10
- [ ] T023 Retire `shelfLineCount` (or keep as a one-line wrapper if a test pins it) — ~10

## Phase 3+: one family per PR (same T0x0–T0x5 shape as PR 1; each switches its callers to the widened reader)
- [ ] T030 cabinet — asserted: default 3 at 6 3/8" → 2 with the note; `cabinet 48 wide 30 tall with 4 shelves` refuses with its minimum
- [ ] T040 pantry — parity
- [ ] T050 wardrobe — #112/#142 rows, rod default/typed rows, hat counted in N; 315(3); a typed rod is kept (refuse, never drop); asserted: `wardrobe 72 tall with 12 shelves` and `wardrobe with 13 shelves` (row 361) → second-form refusal, up to 96" holds 11; `wardrobe with a hanging rod 60 tall with 6 shelves` → second-form refusal, needs 97 3/4", up to 96" holds 5 (`rodShelfMinHeight(5)` = 90")
- [ ] T060 nightstand — asserted: `nightstand 20 wide 24 tall with 3 shelves` refuses with the zone-aware minimum (second form `needs more than 96" tall`, with K from the downward search, if the search passes 96"); proof: the refusal path, including those extra searches, stays under the 30 s parity budget, with the timing in the PR body
- [ ] T070 dresser — asserted: `dresser with 3 shelves` refuses at the searched `minH`, 54 1/4" by Critic's zone probe (not 50 1/2", which builds at 6 1/16"); the rebuild at it gives 3 at ≥ 7" (second form `needs more than 96" tall`, with K from the downward search, if the search passes 96"); proof: the refusal path, including those extra searches, stays under the 30 s parity budget, with the timing in the PR body
- [ ] T080 vanity (knee path; desk canary watch) — asserted: `bathroom vanity 36 wide with 3 shelves` refuses with its minimum or builds 3 at ≥ 7" (second form `needs more than 96" tall`, with K from the downward search, if the search passes 96"); proof: the refusal path, including those extra searches, stays under the 30 s parity budget, with the timing in the PR body
- [ ] T090 linen — builds byte-identical; asserted refusal noun "A linen closet needs …"; then delete the legacy generic shelf section (SC-004 grep)

## Every PR
- [ ] ≤ 400 changed lines; merge release in if the branch is older than a day; no rebase, no force push
- [ ] Precheck table on the head sha (including `ends_supported` once Critic adds it); gstack-review findings; blast radius; ponytail line
- [ ] Every refusal's minimum rebuild is clean of all invariants (I11 on wardrobes/pantries named as pre-existing)
- [ ] A row that blocks twice → systematic-debugging + gstack-investigate DEBUG REPORT before the next push
