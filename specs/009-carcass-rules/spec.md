# Feature Specification: 009 Carcass shelf rules as one table, read by one builder

**Feature Branch**: `spec/009-carcass-rules` (spec only, no code)
**Created**: 2026-10-24
**Status**: r3 (Critic's BLOCKs on 17cd1263 and ea52fb2e answered edit by edit; still no code)
**Base**: `origin/release/2026-10-24` @ `0a16920` (#142 merged in 4e74ad3; #112 still open; 1fd539d..0a16920 touches only `listings.ts` Buy titles)
**Input**: Ezra's speed-up plan ("Yes to all", 2026-10-24 8:34 PM ET, relayed by Chief) and the SWE tool-adoption brief
(team notes, not in the repo): "the carcass shelf rules become ONE data table read by ONE builder, spec first.
Acceptance = the precheck carcass and shelf rows 242, 300, 304, 307, 314, 315."
**Constitution**: `.specify/memory/constitution.md` v1.0.0 (I One Model Honesty, II Universal Engine Rules, III Freeze
Canaries First, IV Snapshot Before Refactor, V Ponytail) and the north star `YARD-SPEC.md` (rules 1, 2, 4, 6, 7; "Current
focus: carcass family"). Where the constitution's workflow says "fetch and rebase", the team's merge-only rule wins
(no rebase, no force push); this spec does not amend the constitution.

## Why

Shelf rules are the most repeated Critic block: row 304 (9 verdict mentions), 242 (7), 315 (6), 300 (6), 314 (5), 307 (5),
plus 309, 317, 334, 336 (the team's speed-up report, §1; not in the repo). "shelf" appears 23 times in BLOCK lines. The cause is
structural: the same shelf decision is made in many places, each with its own copy of the rule.

Where the shelf rules live today (release @ 1fd539d; every line number re-checked on it):

| Decision | Where (each is its own copy) |
|---|---|
| Default count per program | `fittedBuild.ts:2895` (bookcase 5, closet 1, pantry/wardrobe 4, media 2, else 0); `fittedParse.ts:1025` (parse default, clamps 1–12); bathroom wall cabinet `fittedBuild.ts:336,403` (2), `:441` (3), lipped `:532` (3); cubby `:1080`; wall shelves `:2387` |
| Typed count read | `fittedShared.ts:240 spokenShelfCount` (1–12 only, so a typed 0 is lost; reads "6 foot shelf" as 6); `fittedBuild.ts:2681` and `:2901` (two more regexes, "one…eight" and "one…six"); `spec.ts:43/88 COUNTED` (#109; reads sizes as counts on raw words); `pdf.ts:1212 headerFeatures typed()`; `shelfClear.ts:25 typedShelfDemand` (#142; gated to bookcase/wardrobe/closet/pantry/linen, returns null outside 1–12) |
| Zone (where shelves may go) | `fittedBuild.ts:2849-2902` (knee, drawers, upper hutch, rod `rodY + 2`) |
| Positions | even split `fittedBuild.ts:2908`; item-sized `:2909-2917`; lipped `shelfLips.ts`; Measure picker re-tile `insideCount.ts retileShelves` (a second placer) |
| Usable clear | #142's `shelfClear.ts` (7" clear, `closetShelfMinHeight`, `rodShelfMinHeight`) and its refusal `tooSmall.ts:125 shelfCountRefusal`, reached only through the gated `typedShelfDemand`: cabinet, dresser, nightstand and vanity typed counts, a typed 0 and 13+ never reach it, and no default count is checked. A second copy, `SHELF_MIN_CLEAR = 7` (`fittedShared.ts:570`), is used only by wall shelves and the ladder shelf, both of which *shrink a typed count* (against the refusal rule). #112 (open) adds a hanging check (`hangingClearance.ts`) |
| Pieces per level | `u.bays` (`fittedBuild.ts:2644`), hutch split `:2918`, then the span post-pass `shelfSpan.ts withShelfSpanSupports` adds dividers and splits shelves after the builder ran |
| Fixed vs adjustable vs hat | `honesty.ts wantsFixedGlueShelves`; `shelfSpan.ts isFixedSpanShelf` (by `cutNote` text "Screwed fixed shelf") |
| Count said back | `shelfSpan.ts shelfLineCount` (levels rounded to 1/4") read separately by `pdf.ts headerFeatures`, `measureTabs.ts factsFromProject`, `closedStorage.ts modelInteriorCounts`, `steps.ts uniquePanelSteps` (glue step title), `measure-panel.tsx`; plus `shelfLevelLayout`/`shelfLevelsFit` (`tooSmall.ts:126/128`) and `adjustableShelfTalk` (`report.ts:1039` pin Buy note, `steps.ts:2620` pin step title), with a fallback at `report.ts:1059` that calls pin *pieces* shelves; the precheck counts levels at 1/16" |

Evidence on the release tip (Critic's engine-only probes on 4e74ad3, 2026-10-24; 4e74ad3..1fd539d changes no shelf code,
only step-1 wording):
- `bookcase 60 wide 30 tall with 8 shelves` refuses at 71 1/4" and the rebuild at 71 1/4" is clean (holds, #142).
- `bookcase 60x30x8` (W×D×H) builds 5 default shelves in 8" (5/16" clear): a default count is never shrunk.
- `cabinet 48 wide with shelves` builds a default 3 at 6 3/8" clear, header "· 3 shelves", no note.
- `cabinet 48 wide 30 tall with 4 shelves` builds 4 at 4 15/16" clear; `dresser with 3 shelves` builds 3 at 3 3/8"; `nightstand 20 wide 24 tall with 3 shelves` builds 1 ("· 1 shelf"); `bathroom vanity 36 wide with 3 shelves` builds 0 with "built without them for now". Each is a typed count reduced or dropped, never refused.
- `bookcase with 13 shelves` builds 13 at 5 1/8" (the 1–12 cap hides it); `bookcase with 0 shelves` builds 5 (row 211).
- `bookcase … 8 shelves from 1/2 plywood` refuses at 71 1/4" (the 3/4" number; the 1/2" minimum is 68 1/2").
- `linen closet 40 tall with 8 shelves` says "A linen needs at least …" (the noun is cut).
- `wardrobe 86 tall with 10 shelves` refuses at 86 3/4", which is right: 86 3/4" is the exact minimum for 10 even shelves (at 86" they give 6 15/16" clear).
- #112 r7 drops a typed rod (`wardrobe with a hanging rod 60 tall with 6 shelves` builds without it). The tip keeps the rod and refuses, which is right, and #112 r8 must keep that (refuse, never drop the rod). The tip's wording "A wardrobe needs at least 97 3/4" tall … and a hanging rod. Nothing is built at 60"." is not right: 97 3/4" (1 1/2 + 42 + 7·7 3/4) is over 96", so PR 5 moves it to the FR-011 second form (asserted change).

Root cause of the typed-count rows: `typedShelfDemand`, the only reader the refusal uses, is gated by family and by 1–12.

## User Scenarios & Testing

### User Story 1 — A typed shelf count is built exactly or refused (Priority: P1)
A person types "bookcase 60 wide 30 tall with 8 shelves". Yard builds 8 levels with at least 7" clear between them, or
says "nothing built" and names the height at which 8 levels fit (and that height builds cleanly).

**Why P1**: rule 1 and rule 6 of YARD-SPEC; rows 242, 334, 211, #142's `levels16_or_refused_min`.
**Independent test**: precheck check 7 `levels_usable` / `levels_eq_or_refused` on the family's prompts; the refusal's
named height is rebuilt by `probes/dump.mts` (`minBuild`) and must pass the same rule.

**Acceptance scenarios**
1. **Given** a typed count that fits at ≥ 7" clear, **when** built, **then** levels = typed count and every clear ≥ 7".
2. **Given** a typed count that does not fit, **when** built, **then** refused with the one sentence of FR-011, naming `at least X" tall` (X rounded up to 1/16"), and the build at X passes scenario 1 with no new invariant.
3. **Given** a typed 0 ("with 0 shelves", "no shelves"), **then** 0 shelf levels and no shelf count in the header.
4. **Given** no typed count, **then** the family default; if the default does not fit at ≥ 7", the default shrinks to what fits (`n_fit`, plan.md §2), the header shows no shelf count, and the note names the numbers: `{N} {shelf|shelves} fit at {H}" with 7" clear between them; a {noun} {MIN}" tall holds all {D}.` When nothing fits: `This {H}" {noun} is an open box; a {noun} {MIN1}" tall holds 1 shelf with 7" clear, {MIN}" holds all {D}.` ({MIN} = the minimum for the default D, {MIN1} for 1.) `bookcase 60 wide 30 tall` → "2 shelves fit at 30" with 7" clear between them; a bookcase 48" tall holds all 5." `bookcase 60x30x8` → "This 8" bookcase is an open box; a bookcase 17" tall holds 1 shelf with 7" clear, 48" holds all 5." A note never says "type a taller size" without naming the height.
5. **Given** any typed n ≥ 0 (13, 20, …), **then** there is no cap: it is built or refused by the same fit and minimum. If the minimum is taller than the picked stock's longest part (96" for a 4×8 sheet), the refusal names the most that fits instead (FR-011 second form): `bookcase with 13 shelves` → "A bookcase needs 110" tall for 13 shelves with 7" clear between them, taller than a 4×8 sheet cuts. A bookcase up to 96" tall holds 11. Nothing is built at 84"."
6. **Given** a rod, **then** the rod rules of FR-005 hold: a typed rod is never dropped (refuse instead); a default rod is lowered to keep 40" of hang or dropped with its note; a typed N counts the hat (1 fixed hat + N−1 adjustable).

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
- Drawers fill the carcass: zone empty → 0 levels; a typed count then refuses and names the zone-aware minimum (plan.md §2), the height where the drawers plus the typed shelves at 7" fit.
- Rod present (wardrobe/closet): zone starts at the hat shelf above the rod; the hang below keeps ≥ 40" (row 271). The rod rules are table rows (FR-005), carried from #142's `rodPlanForTypedShelves`, not re-derived.
- A span over the stock limit: the existing span pass (`withShelfSpanSupports`) still adds the divider; the plan's `pieces` is read after it.
- Measure picker re-tile (`applyInsideCount`): in this feature it keeps its own placer; it calls the same fit check so it never re-tiles below 7" (deferred, see NOT building).
- Glued/fixed shelves (wine grid, figure, corner, odd): the table's `kind` column; the span rule's edge-rail branch is unchanged.

## Requirements

### Functional requirements
- **FR-001** One table, `CARCASS_SHELF_RULES`, holds every shelf rule for the eight carcass families (bookcase, cabinet, linen, dresser, nightstand, vanity, wardrobe, pantry). One row per rule; columns in plan.md §2. No prompt regex lives in a row; rows read only the builder's inputs (family, the typed count from the one reader (`typedShelfDemand`, widened), zone bounds, stock thickness, rod/drawer/knee facts).
- **FR-002** One builder, `planShelves(input) → ShelfPlan | ShelfRefusal`, reads the table and returns levels (y, thickness, kind), pieces per level, notes, or a refusal with the minimum height. It never reads the prompt.
- **FR-003** One read-back, `shelfPlanOf(project)`, is the only shelf counter surfaces use. It replaces direct `shelfLineCount` calls at its callers (blast radius below), counts levels at 1/16" (the precheck's rounding, not today's 1/4"), and names pieces and fixed levels.
- **FR-004** A typed count is built exactly or refused with the FR-011 sentence and a minimum height that itself builds cleanly. There is no maximum: any typed n ≥ 0 is built or refused. Only a default count may shrink, and only with a note. A typed count is never reduced or dropped and a typed size is never widened.
- **FR-005** Usable clear between levels ≥ `SHELF_MIN_CLEAR` (7"), per row 336/242. The value lives once (#142's `CLOSET_SHELF_CLEAR_IN`, with `SHELF_MIN_CLEAR` as a re-export), referenced by the table. The 4" `SHELF_CLEAR_FLOOR_IN` is a guard on the constant, never a fallback clear. The minimum a refusal names is the one zone-aware minimum of plan.md §2, using the picked stock's thickness; `closetShelfMinHeight` is its no-zone case and `rodShelfMinHeight` its typed-rod case. Rod and hat rules (table rows):
  - A rod counts toward the minimum only when typed.
  - A default rod is lowered to keep ≥ 40" of hang, or dropped with the note "The hanging rod is left out so the shelves keep 7" clear between them."
  - A typed rod is never dropped; the build refuses instead (`rodShelfMinHeight`).
  - With a rod, a typed N counts the hat: 1 fixed hat shelf + N−1 adjustable (as #142 builds).
- **FR-006** Parity mode: a family not yet migrated produces byte-identical output; the table builder runs only in tests for it (no double work in production).
- **FR-007** Migration is one family per PR, ≤ 400 changed lines each, in the order in plan.md §5.
- **FR-008** No canary changes without Ezra's OK: linen (post-anti-tip baseline: 31 1/2 × 16 × 78, 11 parts, $193.68, 8 Buy lines, 9 steps), pocket vanity (50 parts, $636.23), Andersen 36×48, desk 60×30×29 with 24" knee, 3-ft popsicle Eiffel, cat tree, step stool.
- **FR-009** Positive wording and fractions only in every note and refusal.
- **FR-010** Every shelf piece is held at both ends by a side, a divider, a cleat or pins in an upright, never by a joint over open space. A divider may stand on a fixed (hat) shelf only if that shelf is continuous under it and keeps its front rail (row 342; #112 r7's `standsOnShelf` must not become a table row). `pieces per level`, read after the span pass, may split a shelf only at a divider that runs to the bottom (or top) below it. Checked by I1/I7/I26 plus Critic's new `ends_supported` precheck assertion (I1/I7 stayed silent on row 342).
- **FR-011** One refusal sentence for every shelf-count refusal: `{A|An} {noun} needs at least {MIN}" tall for {N} {shelf|shelves} with 7" clear between them{ and a hanging rod}. Nothing is built at {H}".` `{noun}` is the full asked noun ("linen closet", not "linen"); `{MIN}` is `minH(N, t)` of plan.md §2 (the smallest H, in 1/16" steps, where the builder's own zone fits; `closetShelfMinHeight` and `rodShelfMinHeight` are its closed forms for the no-zone and typed-rod cases), with the picked stock's t, rounded up to 1/16"; `{H}` is the built height, typed or assumed. It never says "widened", "reduced", "only N fit" or "the size wins".
  - **Second form, when `{MIN}` is taller than the picked stock's longest part `{MAX}`** (96" for a 4×8 sheet; the board length for lumber): `{A|An} {noun} needs {MIN}" tall for {N} {shelf|shelves} with 7" clear between them{ and a hanging rod}, taller than a {stock} cuts. {A|An} {noun} up to {MAX}" tall holds {K}. Nothing is built at {H}".` `{K}` is the largest count whose minimum is ≤ `{MAX}` (3/4" stock, no rod: 11, at 94 1/2"). For the closed-form families `{K}` is read from the closed form; for the searched families (dresser, vanity, nightstand) it is found by a downward search: n = N − 1, N − 2, … down to 0, each its own bounded `minH` search (plan.md §2), and the first n whose search finds a height ≤ `{MAX}` is `{K}`. A minimum over `{MAX}` is never named as buildable (YARD-SPEC: real-world sizes). When `{K}` would be 0, or not even 0 shelves fit by `{MAX}`, the sentence never prints "holds 0": the family PR that can reach this case words it positively (e.g. "is an open box up to 96" tall") and asserts it (row 385).
  - For the searched families the `minH` search stops at `{MAX}`, so a minimum above it is never known. When the search passes `{MAX}` without a fit, the second form says `needs more than {MAX}" tall` in place of `needs {MIN}" tall`: `{A|An} {noun} needs more than {MAX}" tall for {N} {shelf|shelves} with 7" clear between them{ and a hanging rod}, taller than a {stock} cuts. {A|An} {noun} up to {MAX}" tall holds {K}. Nothing is built at {H}".` The closed-form families (bookcase, cabinet, linen, pantry, wardrobe) keep the number.

### Key entities
- **ShelfRule** (table row): family, applies-when, zone, default count, count limits, spacing rule, min clear, kind, thickness source, on-short behavior, why, source.
- **ShelfPlan**: `{ levels: { y, t, kind: "adjustable" | "fixed" | "hat" }[], piecesPerLevel: number[], typed: number | null, note?: string }`.
- **ShelfRefusal**: `{ refusal: string, minHeight: number }`.

## Blast radius (graphify, local only, never committed)

r2: callers re-checked with `rg` on release @ 1fd539d (where #142's code exists), on top of the first draft's graphify pass
(graph files are local only and are not cited). Line numbers are 1fd539d's. Callers ("←"), tests marked (t):

| Builder / rule the table replaces or wraps | Callers |
|---|---|
| `fittedBuild.ts::buildFitted` (generic shelf section L2849–2962 only) | `promptMain.ts generateRaw()` L1403, `finishHouse()` L172; `store.ts`; `fitted.ts` (re-export); `scripts/yard-honesty-guards.ts` + `yard-honesty-smoke.ts` (`fixedWine`) |
| `shelfSpan.ts::shelfLineCount` → `shelfPlanOf` | `pdf.ts headerFeatures()` L1222; `measureTabs.ts factsFromProject()` L70; `closedStorage.ts modelInteriorCounts()` L42; `steps.ts uniquePanelSteps()` L2613/2621; `measure-panel.tsx MeasurePanel()/snap()` L91; internal `adjustableShelfTalk` L845/846; `scripts/yard-honesty-guards.ts`; (t) `shelfSpan.test.ts`, `insideCount.test.ts`, `countAxisHonesty.test.ts` |
| `shelfSpan.ts::shelfLevelLayout` / `shelfLevelsFit` → `shelfPlanOf` | `tooSmall.ts shelfCountRefusal()` L126/L128; (t) `shelfSpan.test.ts` |
| `shelfSpan.ts::adjustableShelfTalk` → `shelfPlanOf` | `report.ts closetBom()` L1039 (pin Buy note; its fallback at L1059 is deleted); `steps.ts uniquePanelSteps()` L2620 (pin step title); internal `recountAdjustable` L864; (t) `shelfSpan.test.ts` |
| `shelfClear.ts::typedShelfDemand` (the surviving typed-count reader, widened) | `tooSmall.ts shelfCountRefusal()` L125; `fittedBuild.ts buildFitted()` L2877; re-export `shelfSpan.ts` L23; (t) `shelfSpan.test.ts` L483/L508–510 |
| `shelfSpan.ts::isFixedSpanShelf` (kind = hat/fixed) | `steps.ts uniquePanelSteps()` L2605, `spanDividerTalk()` L263; `report.ts closetBom()` L840; `placeEveryPart.ts placeEveryPart()` L388, `placeSentence()` L220; internal `withShelfSpanSupports`, `shelfSpanViolations`, `hatAndStiff`, `housed`; (t) `shelfSpan.test.ts` |
| `shelfSpan.ts::withShelfSpanSupports` (kept; plan read after it) | `promptMain.ts engineCore()` L675; `insideCount.ts retileInside()` L53 |
| `shelfSpan.ts::shelfSpanLimit` (kept; referenced by the table) | internal `withShelfSpanSupports`, `shelfSpanViolations`, `placeBayDividers`, `overSpan`, `splitWide`; (t) `shelfSpan.test.ts` |
| `shelfLips.ts::lippedShelfYs` (kept; spacing = "lipped") | `buildFitted()` L535; `fittedBuilders.ts buildHungOpen()` L779; `honesty.ts injectRackRails()` L691; (t) `partsWithinHeight.test.ts` |
| `insideCount.ts::applyInsideCount` / `retileInside` (kept; calls the fit check) | `measure-panel.tsx applyInside()` L191; `shell.tsx WorkspaceApp()` L183; `shareBuild.ts replayShare()` L79; (t) `fitBadge.test.ts`, `insideCount.test.ts` |
| `fittedShared.ts::spokenShelfCount` (delegates its shelf branch to `typedShelfDemand`) | `fittedParse.ts parseBrief()` L1025; `fittedShared.ts spokenTierCount()` L230; `fittedBuilders.ts buildLadderShelf()` L1129; (t) `countAxisHonesty.test.ts` |
| `fittedShared.ts::SHELF_MIN_CLEAR` (becomes a re-export of #142's `CLOSET_SHELF_CLEAR_IN`) | `fittedBuild.ts`, `fittedBuilders.ts`, `fitted.ts` (re-export) |
| `closet.ts::buildClosetFromPrompt` (fallback when `parseBrief` returns null) | `promptMain.ts generateRaw()` L1446 |
| `pdf.ts::headerFeatures` | `pdf.ts buildPlanPdf()` L197, `headerTitle()` L1180 |

Not touched (out of family or canary paths): `buildPocket` (pocket vanity), `sinkVanity.ts buildSinkVanity`,
`corner.ts buildCornerUnit`, `fittedWine.ts` (row 314's wine rail, owned by #142), `fittedBuilders.ts` ladder/hung/cubby/
collection shelves, window/door builders (Andersen), craft/figure paths (Eiffel, cat tree, step stool).

## Success criteria
- **SC-001** Precheck on every migration PR's head: check 7 (88 assertions today: 68 in the brief, plus #112/#142's, plus Critic's six "009" rows and the ten D-5 rows Critic added in r3) has **0 regressions vs base**, and the rows the PR targets move from open to hold.
- **SC-002** Check 3 (158-prompt carcass probe): 0 Pass→worse. Check 6: 0 new contradictions. Check 2: canaries 7/7 identical unless an Ezra-approved entry covers the change.
- **SC-003** Invariants clean: no new I-codes in `checkBuild` on any carcass probe build (I7, I11, I26, I37, I39, I42 in particular), and every refusal's minimum build is clean of all invariants except I11 "closet wording" on wardrobes and pantries, which is pre-existing on every wardrobe and is named as such, not counted as a pass.
- **SC-004** After the last migration PR, `grep` finds no shelf count/position/clear decision for the eight families outside the table and `planShelves` (the legacy generic section is deleted, not left beside it).
- **SC-005** Critic rounds on shelf rows: target ≤ 1 BLOCK per migration PR (today's median is 2, #114 had 7).

## Assumptions
- #142 (rows 314/315/317, wine rail, level counts, `shelfClear.ts`) merged in 4e74ad3. #112 (rows 242/304/334, hanging clearance) is still open and lands **before PR 1**; its r8 must keep #142's typed-rod refusal (r7 drops the rod). They edit the same lines of `buildFitted` (L2865–2903) and define the values the table carries; the table then holds their rules as rows (parity), not a re-implementation (plan.md §5).
- The precheck's `sets.py` is Critic's, never edited by SWE. Critic added the six "009" rows and, in r3, the ten D-5 rows (88 assertions) and is adding `ends_supported` (FR-010).
- The linen canary baseline is the post-anti-tip one ($193.68) once that PR merges; until then $183.70.
