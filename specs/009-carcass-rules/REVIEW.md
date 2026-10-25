# Plan review: 009 carcass shelf rules (gstack-plan-review, CEO + Eng)

Reviewer: SWE (self-review with the gstack-plan-review checklist), 2026-10-24 ~9:45 PM ET. Review only; no code.
Independent cold read by another in-house agent: not run (optional in the skill); Critic's grade is the independent read.
Scope changes below are proposals; each needs Chief/Critic (and, for canaries, Ezra) to accept.

## Step 0: premise and scope
- **0A Premise.** Real problem: the same shelf decision is copied across ~10 places (spec.md "Why"), so each fix lands in one copy and another copy regresses (#114: 7 verdicts; row 304: 9 mentions). Target: one table + one builder + one read-back, so a shelf rule changes in one row. Cost of doing nothing: about 2.4 Critic rounds per shelf PR continue, and each round spends the shared usage pool. **Verdict: the plan hits the pain directly** (the copies), not a proxy.
- **0B Demand check.** Not a product bet (internal engine refactor); skipped.
- **0C Existing leverage.** `usableFloors.ts` (#117) row shape; `shelfSpan.ts` span rule (#114); `shelfClear.ts` min height and clear constants (#142); `hangingClearance.ts` (#112); `spec.ts` typed counts (#109); `tooSmall.ts refused()`. The plan reuses all six and writes only the table, `planShelves`, `shelfPlanOf` and a parity test.
- **0D Dream state.** CURRENT: shelf rules in ~10 places, five typed-count regexes → THIS PLAN: one table for eight families, one counter for every surface → 12-MONTH: every carcass rule (doors, drawers, hinges, toe kick) in family tables, the "carcass rules data table" of Phase 2. Moves toward it.
- **0E Alternatives.** A) plan as written (9 PRs, ~2,500 lines total, parity-gated). B) smallest: only PR 1 + PR 2 (typed-count reader + one counter), leaving positions in `buildFitted`; fixes 211 and the count class, ~600 lines, but leaves the copies of zone/clear logic. C) rewrite `buildFitted` carcass section in one go: rejected (no evidence it's needed; it's how #114 got 7 verdicts).
- **0F Mode.** Recommended **HOLD** (harden what's there; no new behavior beyond rows already blocked). Owner: Chief.

## Findings and resolutions

| # | Section | Finding | Resolution in the spec |
|---|---|---|---|
| F-1 | Architecture | First draft started PR 1 on release-24 now. `gh pr diff` shows **#112 and #142 both rewrite `buildFitted` L2865–2903** (rod, `shelvesAsked`, `zoneY0`), the exact lines the table replaces. Starting now guarantees conflicts and two copies of each rule value. | Added a start gate: #112 and #142 merged before PR 1 (plan §5, tasks T002). |
| F-2 | Code quality (ponytail) | First draft wrote its own minimum-height formula. #142 already adds `closetShelfMinHeight` (`(n+1)(t+7)+2t`, 3/4" conservative) used by #112 too. A second formula would be the scattered-rule problem again. | Table references #142's formula and constants; `SHELF_MIN_CLEAR` becomes a re-export (plan §2, NOT-building #2). |
| F-3 | Architecture | First draft's PR 1 claimed the bookcase usable-clear fix and multi-bay wording (317). #142's head already does both (`… needs at least 71 1/4" tall for 8 shelves`, "5 shelves (10 adjustable pieces)"). | PR 1 claims only row 211 and holds the rest (plan §5, acceptance). |
| F-4 | Error & rescue | Two refusal sentences for the same rule: #112 ends "Nothing is built.", #142 "Nothing is built at 36"." Rule 6 wants one honest form. | Table owns one refusal template; it ends "Nothing is built at <typed>"." Listed as an intended change in the wardrobe PR, shown to Critic. **Decision D-3.** |
| F-5 | Edge cases | Five typed-shelf regexes disagree: `spokenShelfCount` (1–12, drops 0), `fittedBuild.ts:2680` (to "eight"), `:2878` (to "six"), `spec.ts COUNTED` (digits incl. 0, to "twelve"), #142 `typedShelfDemand` (to "ten", 1–12). Row 211 is this. | PR 1 adds one reader; others delegate per family PR. **Decision D-2** (which one survives). |
| F-6 | Edge cases | `shelfLineCount` groups levels at 1/4"; the precheck groups at 1/16". Two shelves 1/8" apart (stacked bay pieces) read as one level on the header and two in the grader. | `shelfPlanOf` counts at 1/16" (FR-003); PR 2 lists every build whose count moves. |
| F-7 | Performance | A parity test that rebuilds ~250 prompts on every guards run adds to a 38-minute job already hitting its 45-minute timeout. | Budget ≤ 30 s, one process, carcass prompts only (plan §4). If over, it runs in the eval-gate job instead. |
| F-8 | Tests | An "intended diffs" list would be a new allow/baseline file, which precheck check 8 FAILs on added keys, and renaming it to dodge the pattern would evade Critic's check. | Intended changes are explicit assertions in the parity test with the row they fix; no allow file (plan §4). |
| F-9 | Tests | Parity fixture copies the precheck's prompts; it can drift from Critic's `sets.py`. | Fixture records the precheck date; Critic's precheck stays the grader; the fixture only guards parity. |
| F-10 | Security / spend | No new inputs, keys, network or paid calls. All runs under `env -u XAI_API_KEY`. | None needed. |
| F-11 | Canaries | Desk 60×30×29 shares the generic section via the knee path; linen is the closet program in the same section. | Desk is excluded from `ShelfInput` (not a family); linen moves last, parity-only; check 2 on every PR; any linen byte change stops for Ezra. |
| F-12 | Observability | A table-driven refusal or default shrink should be traceable from a build alone. | `ShelfPlan.ruleId` / `ShelfRefusal.ruleId` stored on the project (not shown to users) so a bad build names the row that made it. |
| F-13 | Rollout / rollback | Rollback of a family = flip its rows' `drives` to `false` (one-line revert PR); the legacy code is kept until PR 9 deletes it. | Plan §4; deletion only in PR 9 after all families pass. |
| F-14 | Long-term | Legacy non-family shelf builders (wall shelves `fittedBuild.ts:2530`, ladder `fittedBuilders.ts:1175`) *shrink a typed count* with a note, against the refusal rule. | Out of this spec (not the eight families); proposed as a backlog row to Chief. |
| F-15 | Process | The brief's graphify graph is built from `main` (48460cc), which has no `shelfSpan.ts` callers (#114 is release-24 only). | Blast radius taken from a release-24 graph (408c2c1); re-run on each PR's head. Proposed to Chief: point `yard-src` at the current release branch. |
| F-16 | Scope | The brief says "68 assertions"; check 7 now has 72 (#112 `rods_le` ×8, #142 `levels16_or_refused_min`). | Acceptance uses the live count: 0 regressions on all 72. |

## Error & rescue registry (new code paths)
| Path | Can fail | Rescue | User sees |
|---|---|---|---|
| `planShelves` typed count doesn't fit | expected | `refused()` with the table's minimum | "nothing built", the minimum height; no size/price/PDF |
| default count doesn't fit | expected | shrink to `n_fit`, note | the build, plus "N shelves fit with 7" between them; type a taller size for M" |
| zone empty (drawers fill) with typed shelves | expected | refuse, name height | as above |
| zone empty, no typed shelves | expected | 0 levels, no header count | the build |
| `shelfPlanOf` on a non-carcass build | none | returns the panel-derived count (same as `shelfLineCount` today) | unchanged |
| parity mismatch in a non-migrated family | test failure | CI red; PR cannot merge | nothing (caught before ship) |

## Decisions needed (with recommendation)
1. **D-1 Mode**: HOLD (recommended) vs REDUCTION (alternative B, PR 1 + PR 2 only). Owner: Chief.
2. **D-2 One typed-count reader**: keep `spec.ts COUNTED` (#109, the one spec object; reads 0 and to "twelve") and make #142's `typedShelfDemand` delegate (recommended), or the reverse. Owner: Critic.
3. **D-3 One refusal sentence** ending "Nothing is built at <typed size>"." for both #112's and #142's shelf refusals (recommended), shown as an intended change in the wardrobe PR. Owner: Critic.
4. **D-4 Start gate**: PR 1 waits for #112 and #142 to merge (recommended), vs basing PR 1 on #142's branch (a chain; counts as one PR under the cap). Owner: Chief.
5. **D-5 New precheck prompts** (`bookcase 60 wide 30 tall with 8 shelves`, `cabinet 48 wide with shelves` default note): Critic adds them to `sets.py` if wanted. Owner: Critic.

## NOT in scope
Hinge/door/drawer rules; wine rack (row 314, #142); pocket vanity (`buildPocket`); sink vanity; corner unit; ladder, cubby,
wall, hung and collection shelves; Measure re-tile rewrite; 1/16" position snapping; any UI; any env/feature flag; AI.

## What already exists (reused)
`usableFloors.ts` row shape (#117) · `shelfSpan.ts` span rule and `isFixedSpanShelf` (#114) · `shelfClear.ts` constants and
`closetShelfMinHeight` (#142) · `hangingClearance.ts` (#112) · `spec.ts` typed counts (#109) · `tooSmall.ts refused()` ·
the precheck (checks 2, 3, 6, 7) as the grader.

## Implementation tasks
See `tasks.md` (T001–T090). Sizes: PR 1 ~310 lines, PR 2 ~150, each family PR ~100–250; every PR ≤ 400.
