# Feature Specification: 009 Carcass shelf rules as one table, read by one builder

**Feature Branch**: `spec/009-carcass-rules` (spec only, no code)
**Created**: 2026-10-24
**Status**: Draft, for Critic before any code
**Base**: `origin/release/2026-10-24` @ `408c2c15`
**Input**: Ezra's speed-up plan ("Yes to all", 2026-10-24 8:34 PM ET, relayed by Chief) and the SWE tool brief
(`/workspace/tool-adoption/BRIEFS.md`): "the carcass shelf rules become ONE data table read by ONE builder, spec first.
Acceptance = the precheck carcass and shelf rows 242, 300, 304, 307, 314, 315."
**Constitution**: `.specify/memory/constitution.md` v1.0.0 (I One Model Honesty, II Universal Engine Rules, III Freeze
Canaries First, IV Snapshot Before Refactor, V Ponytail) and the north star `YARD-SPEC.md` (rules 1, 2, 4, 6, 7; "Current
focus: carcass family"). Where the constitution's workflow says "fetch and rebase", the team's merge-only rule wins
(no rebase, no force push); this spec does not amend the constitution.

## Why

Shelf rules are the most repeated Critic block: row 304 (9 verdict mentions), 242 (7), 315 (6), 300 (6), 314 (5), 307 (5),
plus 309, 317, 334, 336 (`/workspace/speedup/REPORT.md` §1). "shelf" appears 23 times in BLOCK lines. The cause is
structural: the same shelf decision is made in many places, each with its own copy of the rule.

Where the shelf rules live today (release-24 @ 408c2c15):

| Decision | Where (each is its own copy) |
|---|---|
| Default count per program | `fittedBuild.ts:2872` (bookcase 5, closet 1, pantry/wardrobe 4, media 2, else 0); `fittedParse.ts:1025` (parse default, clamps 1–12); bathroom wall cabinet `fittedBuild.ts:336,403` (2), `:441` (3), lipped `:532` (3); cubby `:1080`; wall shelves `:2387` |
| Typed count read | `fittedShared.ts:240 spokenShelfCount` (1–12 only, so a typed 0 is lost); `fittedBuild.ts:2680` and `:2878` (two more regexes, "one…eight" and "one…six"); `spec.ts COUNTED` (#109); `pdf.ts:1208 headerFeatures typed()` |
| Zone (where shelves may go) | `fittedBuild.ts:2849-2884` (knee, drawers, upper hutch, rod `rodY + 2`) |
| Positions | even split `fittedBuild.ts:2885`; item-sized `:2886-2894`; lipped `shelfLips.ts`; Measure picker re-tile `insideCount.ts retileShelves` (a second placer) |
| Usable clear | `SHELF_MIN_CLEAR = 7` (`fittedShared.ts:570`), used only by wall shelves (`fittedBuild.ts:2495`) and ladder shelf (`fittedBuilders.ts:1133`), both of which *shrink a typed count* (against the refusal rule). The generic carcass has no clear check at all on base (row 242/334); #112 adds one for hanging builds only (`hangingClearance.ts`) |
| Pieces per level | `u.bays` (`fittedBuild.ts:2644`), hutch split `:2918`, then the span post-pass `shelfSpan.ts withShelfSpanSupports` adds dividers and splits shelves after the builder ran |
| Fixed vs adjustable vs hat | `honesty.ts wantsFixedGlueShelves`; `shelfSpan.ts isFixedSpanShelf` (by `cutNote` text "Screwed fixed shelf") |
| Count said back | `shelfSpan.ts shelfLineCount` (levels rounded to 1/4") read separately by `pdf.ts headerFeatures`, `measureTabs.ts factsFromProject`, `closedStorage.ts modelInteriorCounts`, `report.ts closetBom` (pin Buy note), `steps.ts uniquePanelSteps` (pin/glue step title); the precheck counts levels at 1/16" |

Evidence on base (from the precheck dumps of run `20261024-204235-112`, base 408c2c15, head #112 793c55fa; full list in
the acceptance table):
- `bookcase with 0 shelves` builds 5 shelves, header "· 5 shelves" (row 211, open).
- `bookcase 60 wide 30 tall with 8 shelves` builds 8 levels with 2 3/8" clear, silently (row 242's class in the bookcase family; no assertion covers it yet). #142's head (c649e54e) refuses it: "A bookcase needs at least 71 1/4\" tall for 8 shelves with 7\" clear between them."
- `wardrobe 36 tall with 10 shelves` builds 9 levels with −9/16" clear (row 242; #112 refuses it).
- `cabinet 48 wide with shelves` (default 3 at 30" tall) leaves 6 3/8" clear (a default count, which may shrink with a note).

## User Scenarios & Testing

### User Story 1 — A typed shelf count is built exactly or refused (Priority: P1)
A person types "bookcase 60 wide 30 tall with 8 shelves". Yard builds 8 levels with at least 7" clear between them, or
says "nothing built" and names the height at which 8 levels fit (and that height builds cleanly).

**Why P1**: rule 1 and rule 6 of YARD-SPEC; rows 242, 334, 211, #142's `levels16_or_refused_min`.
**Independent test**: precheck check 7 `levels_usable` / `levels_eq_or_refused` on the family's prompts; the refusal's
named height is rebuilt by `probes/dump.mts` (`minBuild`) and must pass the same rule.

**Acceptance scenarios**
1. **Given** a typed count that fits at ≥ 7" clear, **when** built, **then** levels = typed count and every clear ≥ 7".
2. **Given** a typed count that does not fit, **when** built, **then** refused: "nothing built", names `at least X" tall` (X in 1/16" fractions), and the build at X passes scenario 1.
3. **Given** a typed 0 ("with 0 shelves", "no shelves"), **then** 0 shelf levels and no shelf count in the header.
4. **Given** no typed count, **then** the family default; if the default does not fit at ≥ 7", the default shrinks to what fits and a positive note says so ("2 shelves fit with 7" between them; type a taller size for 3").

### User Story 2 — Every surface says the same shelf count (Priority: P1)
Header, picker facts, PDF cover, notes, pin/glue step title and the shelf-pin Buy note read one shelf plan: levels,
pieces per level, and which levels are fixed (hat shelf, glued) or adjustable.

**Why P1**: rows 300, 309, 315(1), 317, 336 (check 6), the largest repeat-block class.
**Independent test**: precheck check 6 (header = picker = cover = notes/pin text) on all 608 dumped builds, 0 new findings, and the pre-existing multi-bay "levels without pieces" WARNs fall.

**Acceptance scenarios**
1. **Given** a 2-bay bookcase with 4 typed shelves, **then** header "· 4 shelves", notes and pin step say "4 shelves (8 pieces across 2 bays)", pins = 4 × 8.
2. **Given** a wardrobe with a rod (fixed hat shelf + pinned shelves), **then** the hat shelf is named fixed and is not counted as adjustable (row 315(1)).
3. **Given** no shelf word typed, **then** no shelf count in the header (row 309).

### User Story 3 — Switching stock changes thickness only (Priority: P2)
The table's formulas take the shelf thickness from the picked stock; level count, positions' rule and pieces stay the
same, and the span rule re-checks with the new thickness (row 295, YARD-SPEC rule 4).
**Independent test**: precheck check 5 and `edit_stock_ok` on dresser, wardrobe, vanity, nightstand, desk: 0 new issue types.

### User Story 4 — Nothing silently changes while families move (Priority: P1, process)
Each family moves in its own PR. Until a family moves, its output is byte-identical; the PR that moves it lists every
build that changed and why.
**Independent test**: the parity test (plan.md §4) and precheck checks 1–3 and 7: 0 Pass→worse, 0 regressions, canaries 7/7.

### Edge cases
- Fractions and ft-in sizes ("5ft6in", "24 1/2"): the zone is computed from the parsed inches; positions keep the legacy arithmetic in parity mode (no new rounding), and refusal heights round **up** to 1/16" so the named size always fits (row 217's "rounds up" lesson).
- Drawers fill the carcass: zone empty → 0 levels; a typed count then refuses and names the height where drawers plus the typed shelves fit.
- Rod present (wardrobe/closet): zone starts at the hat shelf above the rod; the hang below keeps ≥ 40" (row 271) — #112's rule, carried as a table row, not re-derived.
- A span over the stock limit: the existing span pass (`withShelfSpanSupports`) still adds the divider; the plan's `pieces` is read after it.
- Measure picker re-tile (`applyInsideCount`): in this feature it keeps its own placer; it calls the same fit check so it never re-tiles below 7" (deferred, see NOT building).
- Glued/fixed shelves (wine grid, figure, corner, odd): the table's `kind` column; the span rule's edge-rail branch is unchanged.

## Requirements

### Functional requirements
- **FR-001** One table, `CARCASS_SHELF_RULES`, holds every shelf rule for the eight carcass families (bookcase, cabinet, linen, dresser, nightstand, vanity, wardrobe, pantry). One row per rule; columns in plan.md §2. No prompt regex lives in a row; rows read only the builder's inputs (family, typed counts from the spec reader, zone bounds, stock thickness, rod/drawer/knee facts).
- **FR-002** One builder, `planShelves(input) → ShelfPlan | ShelfRefusal`, reads the table and returns levels (y, thickness, kind), pieces per level, notes, or a refusal with the minimum height. It never reads the prompt.
- **FR-003** One read-back, `shelfPlanOf(project)`, is the only shelf counter surfaces use. It replaces direct `shelfLineCount` calls at its callers (blast radius below), counts levels at 1/16" (the precheck's rounding, not today's 1/4"), and names pieces and fixed levels.
- **FR-004** A typed count is built exactly or refused with "nothing built" and a minimum height that itself builds cleanly. Only a default count may shrink, and only with a note. A typed count is never reduced and a typed size is never widened.
- **FR-005** Usable clear between levels ≥ `SHELF_MIN_CLEAR` (7"), per row 336/242. The value lives once (#142's `CLOSET_SHELF_CLEAR_IN`, with `SHELF_MIN_CLEAR` as a re-export), referenced by the table; the minimum height a refusal names is #142's `closetShelfMinHeight`.
- **FR-006** Parity mode: a family not yet migrated produces byte-identical output; the table builder runs only in tests for it (no double work in production).
- **FR-007** Migration is one family per PR, ≤ 400 changed lines each, in the order in plan.md §5.
- **FR-008** No canary changes without Ezra's OK: linen (post-anti-tip baseline: 31 1/2 × 16 × 78, 11 parts, $193.68, 8 Buy lines, 9 steps), pocket vanity (50 parts, $636.23), Andersen 36×48, desk 60×30×29 with 24" knee, 3-ft popsicle Eiffel, cat tree, step stool.
- **FR-009** Positive wording and fractions only in every note and refusal.

### Key entities
- **ShelfRule** (table row): family, applies-when, zone, default count, count limits, spacing rule, min clear, kind, thickness source, on-short behavior, why, source.
- **ShelfPlan**: `{ levels: { y, t, kind: "adjustable" | "fixed" | "hat" }[], piecesPerLevel: number[], typed: number | null, note?: string }`.
- **ShelfRefusal**: `{ refusal: string, minHeight: number }`.

## Blast radius (graphify, local only, never committed)

Graph rebuilt 2026-10-24 ~9:05 PM ET. The brief's graph (`/workspace/graphify/yard`, built from `yard-src` = main
@ 48460cc, Oct 23) **does not contain `shelfSpan.ts`'s callers** (#114 is in release-24, not main), so the callers below
come from a second local graph of release-24 @ 408c2c1 (kept locally at `/workspace/wt/carcass-graph-r24-408c2c1.json`). Raw output:
`/workspace/wt/carcass-blast-r24.txt` and `carcass-blast-main.txt`. Callers ("←"), tests marked (t):

| Builder / rule the table replaces or wraps | Callers |
|---|---|
| `fittedBuild.ts::buildFitted` (generic shelf section L2849–2939 only) | `promptMain.ts generateRaw()` L1403, `finishHouse()` L172; `store.ts`; `fitted.ts` (re-export); `scripts/yard-honesty-guards.ts` + `yard-honesty-smoke.ts` (`fixedWine`) |
| `shelfSpan.ts::shelfLineCount` → `shelfPlanOf` | `pdf.ts headerFeatures()` L1222; `measureTabs.ts factsFromProject()` L70; `closedStorage.ts modelInteriorCounts()` L42; `report.ts closetBom()` L1038; `steps.ts uniquePanelSteps()` L2613/2620; `measure-panel.tsx MeasurePanel()/snap()` L91; `scripts/yard-honesty-guards.ts`; (t) `shelfSpan.test.ts`, `insideCount.test.ts`, `countAxisHonesty.test.ts` |
| `shelfSpan.ts::isFixedSpanShelf` (kind = hat/fixed) | `steps.ts uniquePanelSteps()` L2605, `spanDividerTalk()` L263; `report.ts closetBom()` L840; `placeEveryPart.ts placeEveryPart()` L388, `placeSentence()` L220; internal `withShelfSpanSupports`, `shelfSpanViolations`, `hatAndStiff`, `housed`; (t) `shelfSpan.test.ts` |
| `shelfSpan.ts::withShelfSpanSupports` (kept; plan read after it) | `promptMain.ts engineCore()` L675; `insideCount.ts retileInside()` L53 |
| `shelfSpan.ts::shelfSpanLimit` (kept; referenced by the table) | internal `withShelfSpanSupports`, `shelfSpanViolations`, `placeBayDividers`, `overSpan`, `splitWide`; (t) `shelfSpan.test.ts` |
| `shelfLips.ts::lippedShelfYs` (kept; spacing = "lipped") | `buildFitted()` L535; `fittedBuilders.ts buildHungOpen()` L779; `honesty.ts injectRackRails()` L691; (t) `partsWithinHeight.test.ts` |
| `insideCount.ts::applyInsideCount` / `retileInside` (kept; calls the fit check) | `measure-panel.tsx applyInside()` L191; `shell.tsx WorkspaceApp()` L183; `shareBuild.ts replayShare()` L79; (t) `fitBadge.test.ts`, `insideCount.test.ts` |
| `fittedShared.ts::spokenShelfCount` (typed-count reader; 0 support) | `fittedParse.ts parseBrief()` L1025; `fittedShared.ts spokenTierCount()` L230; `fittedBuilders.ts buildLadderShelf()` L1129; (t) `countAxisHonesty.test.ts` |
| `fittedShared.ts::SHELF_MIN_CLEAR` (becomes a re-export of #142's `CLOSET_SHELF_CLEAR_IN`) | `fittedBuild.ts`, `fittedBuilders.ts`, `fitted.ts` (re-export) |
| `closet.ts::buildClosetFromPrompt` (fallback when `parseBrief` returns null) | `promptMain.ts generateRaw()` L1446 |
| `pdf.ts::headerFeatures` | `pdf.ts buildPlanPdf()` L197, `headerTitle()` L1180 |

Not touched (out of family or canary paths): `buildPocket` (pocket vanity), `sinkVanity.ts buildSinkVanity`,
`corner.ts buildCornerUnit`, `fittedWine.ts` (row 314's wine rail, owned by #142), `fittedBuilders.ts` ladder/hung/cubby/
collection shelves, window/door builders (Andersen), craft/figure paths (Eiffel, cat tree, step stool).

## Success criteria
- **SC-001** Precheck on every migration PR's head: check 7 (72 assertions today, 68 named in the brief; the set grew with #112/#142) has **0 regressions vs base**, and the rows the PR targets move from open to hold.
- **SC-002** Check 3 (158-prompt carcass probe): 0 Pass→worse. Check 6: 0 new contradictions. Check 2: canaries 7/7 identical unless an Ezra-approved entry covers the change.
- **SC-003** Invariants clean: no new I-codes in `checkBuild` on any carcass probe build (I7, I11, I26, I37, I39, I42 in particular).
- **SC-004** After the last migration PR, `grep` finds no shelf count/position/clear decision for the eight families outside the table and `planShelves` (the legacy generic section is deleted, not left beside it).
- **SC-005** Critic rounds on shelf rows: target ≤ 1 BLOCK per migration PR (today's median is 2, #114 had 7).

## Assumptions
- #112 (rows 242/304/334, hanging clearance) and #142 (rows 314/315/317, wine rail, level counts, and `shelfClear.ts`'s shared clear/min-height rule for bookcase, wardrobe, closet, pantry and linen) both land **before PR 1**. They edit the same lines of `buildFitted` (L2865–2903) and define the values the table carries; the table then holds their rules as rows (parity), not a re-implementation (plan.md §5).
- The precheck's `sets.py` is Critic's; new assertions (e.g. bookcase usable clear) are asked of Critic, never edited by SWE.
- The linen canary baseline is the post-anti-tip one ($193.68) once that PR merges; until then $183.70.
