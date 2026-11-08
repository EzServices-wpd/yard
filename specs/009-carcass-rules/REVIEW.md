# Plan review: 009 carcass shelf rules (gstack-plan-review, CEO + Eng)

Reviewer: SWE (self-review with the gstack-plan-review checklist), 2026-10-24 ~9:45 PM ET. Review only; no code.
Independent cold read by another in-house agent: not run (optional in the skill); Critic's grade is the independent read.
Scope changes below are proposals; each needs Chief/Critic (and, for canaries, Ezra) to accept.
**r2 (after Critic's BLOCK on 17cd1263):** D-2 and D-3 are decided by Critic (below); F-2, F-4 and F-5 are updated; F-17 to F-20 are Critic's findings, resolved in the spec.
**r3 (after Critic's BLOCK on ea52fb2e):** F-21 to F-24 (B1–B4, rows 360–363) are resolved; D-5's assertions are quoted in acceptance.md.

## Step 0: premise and scope
- **0A Premise.** Real problem: the same shelf decision is copied across ~10 places (spec.md "Why"), so each fix lands in one copy and another copy regresses (#114: 7 verdicts; row 304: 9 mentions). Target: one table + one builder + one read-back, so a shelf rule changes in one row. Cost of doing nothing: about 2.4 Critic rounds per shelf PR continue, and each round spends the shared usage pool. **Verdict: the plan hits the pain directly** (the copies), not a proxy.
- **0B Demand check.** Not a product bet (internal engine refactor); skipped.
- **0C Existing leverage.** `usableFloors.ts` (#117) row shape; `shelfSpan.ts` span rule (#114); `shelfClear.ts` min height, clear constants and `typedShelfDemand` (#142, merged); `hangingClearance.ts` (#112); `tooSmall.ts refused()`. The plan reuses all of them and writes only the table, `planShelves`, `shelfPlanOf` and a parity test.
- **0D Dream state.** CURRENT: shelf rules in ~10 places, five typed-count regexes → THIS PLAN: one table for eight families, one counter for every surface → 12-MONTH: every carcass rule (doors, drawers, hinges, toe kick) in family tables, the "carcass rules data table" of Phase 2. Moves toward it.
- **0E Alternatives.** A) plan as written (9 PRs, ~2,500 lines total, parity-gated). B) smallest: only PR 1 + PR 2 (typed-count reader + one counter), leaving positions in `buildFitted`; fixes 211 and the count class, ~600 lines, but leaves the copies of zone/clear logic. C) rewrite `buildFitted` carcass section in one go: rejected (no evidence it's needed; it's how #114 got 7 verdicts).
- **0F Mode.** Recommended **HOLD** (harden what's there; no new behavior beyond rows already blocked). Owner: Chief.

## Findings and resolutions

| # | Section | Finding | Resolution in the spec |
|---|---|---|---|
| F-1 | Architecture | First draft started PR 1 on release-24 now. `gh pr diff` shows **#112 and #142 both rewrite `buildFitted` L2865–2903** (rod, `shelvesAsked`, `zoneY0`), the exact lines the table replaces. Starting now guarantees conflicts and two copies of each rule value. | Added a start gate: #112 and #142 merged before PR 1 (plan §5, tasks T002). |
| F-2 | Code quality (ponytail) | First draft wrote its own minimum-height formula. #142 already adds `closetShelfMinHeight` (`(n+1)(t+7)+2t`, exact under even positions) used by #112 too. r2 (Critic): it undercounts the zone families (drawers, knee, rod), so "no new formula" cannot hold. | One minimum definition (r3: smallest H where the builder's own zone fits, `(H − S) + stack(n, t)` as the start value) with the picked stock's t; `closetShelfMinHeight` is its no-zone closed form and `rodShelfMinHeight` its typed-rod closed form; `SHELF_MIN_CLEAR` becomes a re-export (plan §2, NOT-building #2). |
| F-3 | Architecture | First draft's PR 1 claimed the bookcase usable-clear fix and multi-bay wording (317). #142 (merged in 4e74ad3) already does both (`… needs at least 71 1/4" tall for 8 shelves`, "5 shelves (10 adjustable pieces)"). | PR 1 claims only row 211 and holds the rest (plan §5, acceptance). |
| F-4 | Error & rescue | Two refusal sentences for the same rule: #112 ends "Nothing is built.", #142 "Nothing is built at 36"." Rule 6 wants one honest form. | Decided by Critic: #142's sentence wins (spec FR-011). #112 r8 adopts it; no table PR changes the wording except the full noun ("linen closet", PR 9). **D-3.** |
| F-5 | Edge cases | Five typed-shelf regexes disagree: `spokenShelfCount` (1–12, drops 0), `fittedBuild.ts:2681` (to "eight"), `:2901` (to "six"), `spec.ts COUNTED` (digits incl. 0, to "twelve", but reads sizes as counts on raw words), #142 `typedShelfDemand` (to "ten", 1–12, family-gated). Row 211 is this. | Decided by Critic: `typedShelfDemand` widened survives; the others delegate or are replaced per family PR (plan §3). **D-2.** |
| F-6 | Edge cases | `shelfLineCount` groups levels at 1/4"; the precheck groups at 1/16". Two shelves 1/8" apart (stacked bay pieces) read as one level on the header and two in the grader. | `shelfPlanOf` counts at 1/16" (FR-003); PR 2 lists every build whose count moves. |
| F-7 | Performance | A parity test that rebuilds ~250 prompts on every guards run adds to the guards run (r5: sharded since #143 into 4 parallel unit-test shards, each with a 20-minute timeout). | Budget ≤ 30 s, one process, carcass prompts only (plan §4). If over, it runs in the eval-gate job instead. |
| F-8 | Tests | An "intended diffs" list would be a new allow/baseline file, which precheck check 8 FAILs on added keys, and renaming it to dodge the pattern would evade Critic's check. | Intended changes are explicit assertions in the parity test with the row they fix; no allow file (plan §4). |
| F-9 | Tests | Parity fixture copies the precheck's prompts; it can drift from Critic's `sets.py`. | Fixture records the precheck date; Critic's precheck stays the grader; the fixture only guards parity. |
| F-10 | Security / spend | No new inputs, keys, network or paid calls. All runs under `env -u XAI_API_KEY`. | None needed. |
| F-11 | Canaries | Desk 60×30×29 shares the generic section via the knee path; linen is the closet program in the same section. | Desk is excluded from `ShelfInput` (not a family); linen moves last, parity-only; check 2 on every PR; any linen byte change stops for Ezra. |
| F-12 | Observability | A table-driven refusal or default shrink should be traceable from a build alone. | `ShelfPlan.ruleId` / `ShelfRefusal.ruleId` stored on the project (not shown to users) so a bad build names the row that made it. |
| F-13 | Rollout / rollback | Rollback of a family = flip its rows' `drives` to `false` (one-line revert PR); the legacy code is kept until PR 9 deletes it. | Plan §4; deletion only in PR 9 after all families pass. |
| F-14 | Long-term | Legacy non-family shelf builders (wall shelves `fittedBuild.ts:2530`, ladder `fittedBuilders.ts:1175`) *shrink a typed count* with a note, against the refusal rule. | Out of this spec (not the eight families); proposed as a backlog row to Chief. |
| F-15 | Process | The brief's graphify graph is built from `main` (48460cc), which has no `shelfSpan.ts` callers (#114 is release-24 only). | Blast radius re-checked on the release branch (r2: 1fd539d, by `rg` over the callers); re-run on each PR's head. Proposed to Chief: point `yard-src` at the current release branch. |
| F-16 | Scope | The brief says "68 assertions"; check 7 now has 78 (#112 `rods_le` ×8, #142 `levels16_or_refused_min`, Critic's six "009" rows). | Acceptance uses the live count: 0 regressions on all 78. |
| F-17 | Count rule (Critic) | The first draft's "parity" PRs for cabinet, dresser, nightstand and vanity would have locked in typed counts that are reduced, dropped or unchecked, and `count.max 12` gave 13+ no minimum. | Those PRs move them open → hold as asserted changes; no max (plan §2, §5; acceptance). |
| F-18 | Contradiction (Critic) | PR 1 made `bookcase.default` drive while claiming only row 211 changes. | `bookcase.default` ships `drives: false` in PR 1 (today's code has no default-shrink path); PR 1b flips it with two asserted changes. |
| F-19 | Structure (Critic, row 342) | Nothing said a shelf joint may not sit over open space; I1/I7 stayed silent on #112 r7's butt joint under a standing divider. | FR-010; acceptance rows; Critic adds `ends_supported`. |
| F-21 | Numbers (Critic r2, B1/B2) | The `bookcase 60 wide 30 tall` default shrank to 3 (6 3/8" clear, fails 7"), and the notes named no height. | 5 → 2 at 8 3/4" (n_fit); both notes name the numbers and the header shows no count. |
| F-22 | Real sizes (Critic r2, B3; row 360) | Minimums over 96" (12 → 102 1/4", 13 → 110") are named as buildable, but a 4×8 sheet can't cut them. | Stock limit plus FR-011 second form naming K (11). The 13-shelf row (PR 1) and the wardrobe 12/13 rows (PR 5, row 361) are asserted changes. |
| F-23 | Formula (Critic r2, B4) | `(H − S) + stack` at the typed H undercounts when the outside grows with H (dresser 50 1/2" builds at 6 1/16"). | `minH` = smallest H in 1/16" steps where the builder's own zone fits; the formula is the start value; closed forms kept for the no-zone and rod cases. |
| F-24 | Gate (Critic r2, row 363) | "Widened in place" while two callers already serve wardrobe/pantry/linen. | The gate moves to the callers behind `WIDENED_SHELF_FAMILIES`, which grows one family per PR (plan §3). |
| F-20 | Rod (Critic) | The rod rules lived only in code; #112 r7 drops a typed rod. | Rod and hat rules written as table rows (FR-005, plan §2); #112 r8 must keep the tip's refusal (a typed rod is never dropped). Its wording moves in PR 5 to FR-011's second form, because 97 3/4" is over 96" (up to 96" holds 5). |

## Error & rescue registry (new code paths)
| Path | Can fail | Rescue | User sees |
|---|---|---|---|
| `planShelves` typed count doesn't fit | expected | `refused()` with the table's minimum | "nothing built", the minimum height; no size/price/PDF |
| default count doesn't fit | expected | shrink to `n_fit`, note, no header count | the build, plus "{N} shelves fit at {H}" with 7" clear between them; a {noun} {MIN}" tall holds all {D}." (0: "This {H}" {noun} is an open box; a {noun} {MIN1}" tall holds 1 shelf with 7" clear, {MIN}" holds all {D}.") |
| typed n's minimum is taller than the stock cuts | expected | FR-011 second form with K | "… taller than a 4×8 sheet cuts. A {noun} up to 96" tall holds {K}. Nothing is built at {H}"." |
| zone empty (drawers fill) with typed shelves | expected | refuse, name height | as above |
| zone empty, no typed shelves | expected | 0 levels, no header count | the build |
| `shelfPlanOf` on a non-carcass build | none | returns the panel-derived count (same as `shelfLineCount` today) | unchanged |
| parity mismatch in a non-migrated family | test failure | CI red; PR cannot merge | nothing (caught before ship) |

## Decisions needed (with recommendation)
1. **D-1 Mode**: HOLD (recommended) vs REDUCTION (alternative B, PR 1 + PR 2 only). Owner: Chief.
2. **D-2 One typed-count reader** (decided by Critic): `shelfClear.ts typedShelfDemand`, widened in place, not `spec.ts COUNTED` (plan §3). T011 pins that size phrases are never counts.
3. **D-3 One refusal sentence** (decided by Critic): `{A|An} {noun} needs at least {MIN}" tall for {N} {shelf|shelves} with 7" clear between them{ and a hanging rod}. Nothing is built at {H}".` (spec FR-011).
4. **D-4 Start gate**: PR 1 waits for #112 to merge (#142 merged in 4e74ad3). Owner: Chief.
5. **D-5 New precheck prompts**: Critic added six "009" rows and, in r3, the ten D-5 rows (88 assertions) and is adding `ends_supported`. Critic wrote the r2 D-5 rows (1/2" ply, dresser, vanity, `bookcase 60 wide 30 tall` default, header-count guards), and they are quoted in acceptance.md for Critic to paste into `sets.py`. Owner: Critic.

## NOT in scope
Hinge/door/drawer rules; wine rack (row 314, #142); pocket vanity (`buildPocket`); sink vanity; corner unit; ladder, cubby,
wall, hung and collection shelves; Measure re-tile rewrite; 1/16" position snapping; any UI; any env/feature flag; AI.

## What already exists (reused)
`usableFloors.ts` row shape (#117) · `shelfSpan.ts` span rule and `isFixedSpanShelf` (#114) · `shelfClear.ts` constants and
`closetShelfMinHeight`, `rodShelfMinHeight`, `typedShelfDemand` (#142) · `hangingClearance.ts` (#112) · `tooSmall.ts refused()` ·
the precheck (checks 2, 3, 6, 7) as the grader.

## Implementation tasks
See `tasks.md` (T001–T090). Sizes: PR 1 ~310 lines, PR 1b ~40, PR 2 ~170, each family PR ~100–250; every PR ≤ 400.
