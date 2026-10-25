# Implementation Plan: 009 Carcass shelf rules table

**Spec**: `spec.md` · **Branch**: `spec/009-carcass-rules` · **Base**: release @ 0a16920 · **Status**: plan only, r3

## 1. Summary
Move every shelf decision of the eight carcass families into one TypeScript table (`CARCASS_SHELF_RULES`) read by one
pure function (`planShelves`), plus one read-back (`shelfPlanOf`) that every surface uses for the count. Ship it one family
per PR. Families not yet moved stay byte-identical; a test-time parity check proves it.

## 2. Table schema
File: `src/lib/yard/carcassShelves.ts` (table + builder + read-back in one file; split only if it passes ~300 lines).
Same row shape as #117's `usableFloors.ts` (every number carries `why` and `source`).

```ts
export type CarcassFamily = "bookcase" | "cabinet" | "linen" | "dresser" | "nightstand" | "vanity" | "wardrobe" | "pantry";
export type Zone = "inside" | "aboveRod" | "belowDrawers" | "aboveDrawers" | "aboveKnee";
export type Spacing = "even" | "lipped" | "itemSized";
export type ShelfKind = "adjustable" | "fixed" | "hat";

export type ShelfRule = {
  id: string;                       // "bookcase.default", "wardrobe.hat", "dresser.drawersFill"
  family: CarcassFamily;
  when: {                           // all listed facts must hold; facts come from ShelfInput, never the prompt
    rod?: "typed" | "default"; drawersFill?: boolean; knee?: boolean; glued?: boolean; typedCount?: boolean;
  };
  zone: Zone;                       // which opening the levels share
  count: { default: number };      // no max: any typed n ≥ 0 is built or refused with its minimum (13 → 110")
  spacing: Spacing;
  minClear: number;                 // inches between levels; SHELF_MIN_CLEAR (7) unless the source says otherwise
  kind: ShelfKind;
  thickness: "stock";               // always the picked stock's thickness (rule 4); no per-row override
  onShort: "refuse" | "shrinkDefault"; // typed → refuse; default → shrink with a note
  drives: boolean;                  // parity switch: false = legacy builds, table checked in tests only
  why: string; source: string;
};
```

Formulas (inches; `t` = stock thickness; `[y0, y1]` = zone bounds from the builder's existing variables; `n` = count):
- **span** `S = y1 − y0`
- **fit** `(S − n·t) / (n + 1) ≥ minClear` (minClear = #142's `CLOSET_SHELF_CLEAR_IN` 7"; the duplicate `SHELF_MIN_CLEAR = 7` in `fittedShared.ts` becomes a re-export of it). The 4" `SHELF_CLEAR_FLOOR_IN` is a guard on the constant only and is **never** used as a fallback clear. No row has `minClear < 7` unless a cited source says so; none in this spec do.
- **positions (even)** `y_k = y0 + S·k / (n + 1)`, k = 1..n. Exactly today's arithmetic (`fittedBuild.ts:2908`), no new rounding in parity mode.
- **largest default that fits** `n_fit = floor((S − minClear) / (minClear + t))`, clamped to `[0, default]` (`bookcase 60 wide 30 tall`: S = 28 1/2" → 2, at 8 3/4" clear; 3 would give 6 3/8"). When it shrinks, the header shows no count and the note names the numbers (spec US1-4): `{N} {shelf|shelves} fit at {H}" with 7" clear between them; a {noun} {MIN}" tall holds all {D}.`, or for 0, `This {H}" {noun} is an open box; a {noun} {MIN1}" tall holds 1 shelf with 7" clear, {MIN}" holds all {D}.`
- **minimum height for a typed n** (one definition, used by every row): `minH(n, t)` is the **smallest H, in 1/16" steps,
  at which the builder's own zone at H gives the fit** for n levels. `stack(n, t) = (n + 1)·(t + 7)`.
  - Start value: `(H − S) + stack(n, t)` with `H − S` (everything outside the shelf zone: drawer bank, knee, hutch, rod and
    hang, top and bottom) measured at the typed height. It is only a start, because the outside can grow with H
    (dresser: 19 1/2" at 36", 23 1/4" at 50 1/2"; `dresser 50 1/2 tall with 3 shelves` builds 3 at 6 1/16", so 50 1/2" is
    not the minimum).
  - Search: step H up by 1/16" from the start, re-reading the zone from the builder's zone function at each H (zone only,
    no full build), until the fit holds or H passes the stock limit `MAX` (below). Bounded: at most (MAX − start)·16 zone reads.
  - `closetShelfMinHeight(n, t)` = `(n + 1)·(t + 7) + 2t` stays the closed form of the no-zone case (S = H − 2t, which
    does not grow with H), so bookcase, linen, pantry and rod-less wardrobe refusals need no search.
  - `rodShelfMinHeight(n, t)` is the closed form of the typed-rod case (outside = 2t + 40" hang + 2" lift), used only when a rod was typed.
  - Dresser, vanity and nightstand use the search, so their refusals name a height that builds; the `minBuild` rebuild proves it.
  - **Stock limit**: if `minH(n, t)` is taller than the picked stock's longest part (`MAX` = 96" for a 4×8 sheet; the board
    length for lumber), it is not a usable minimum. The refusal takes FR-011's second form and names `K`, the largest
    count with `minH(K, t) ≤ MAX` (3/4" stock, no rod: 11 at 94 1/2"; 12 needs 102 1/4", 13 needs 110").
  - `t` is the **picked stock's** thickness. `tooSmall.ts:132` passes the default 0.75 today. 8 shelves of 1/2" ply give 68 1/2", not 71 1/4"; that change is an asserted change in each family's PR (bookcase: PR 1).
  - Rounded **up** to 1/16". The `minBuild` rebuild at the named height decides: it must give n levels at ≥ 7" with no new invariant, or the row FAILs.
  - The formula is **conservative** by 3/4" against the exact fit (`2t + (n + 1)·7 + n·t`). 10 shelves of 3/4" → 86 3/4", while the exact fit is 86". So a typed height between the two (e.g. `wardrobe 86 tall with 10 shelves`) refuses today; accepted and logged as P3, not "the minimum".
- **pieces per level** read after the span pass: the number of shelf panels at that level (1/16" rounding). The table does not re-derive dividers; `withShelfSpanSupports` stays the one span rule (row 307). A level may be split only **at** a divider that runs to the bottom (or top) below it; every piece is held at both ends (FR-010).
- **sag rule held, unchanged**: ≤ 0.02" per foot of span (`shelfSpan.ts:50 SAG_PER_FT`), simply supported, creep ×1.5 for **every** stock (the house standard). `shelfSpan.ts:64 creepOf` gives plywood 1.0, not 1.5; logged by Critic (row 362), not this spec's to change.

Rod and hat rules (table rows, carried from #142's `rodPlanForTypedShelves`, `fittedBuild.ts:2877–2898`):
- A rod is in the minimum only when typed (`rodShelfMinHeight`); otherwise `closetShelfMinHeight`.
- `rod: "default"`: lower the rod to keep ≥ 40" of hang; if the shelves still do not fit, drop it **with the note** "The hanging rod is left out so the shelves keep 7" clear between them."
- `rod: "typed"`: never dropped. If the shelves do not fit with it, refuse with `rodShelfMinHeight` (`wardrobe with a hanging rod 60 tall with 6 shelves` → refuses at 97 3/4", as the release tip does).
- With a rod, a typed N counts the hat: 1 fixed hat shelf + N−1 adjustable.

Example rows (bookcase, the first PR):

| id | when | zone | default | spacing | minClear | kind | onShort | why · source |
|---|---|---|---|---|---|---|---|---|
| bookcase.typed | typedCount | inside | – | even | 7 | adjustable | refuse | rows 242/336 usable pitch · Critic row 336, precheck `levels_usable` |
| bookcase.default | – | inside | 5 | even | 7 | adjustable | shrinkDefault (`drives: false` in PR 1, `true` in PR 1b) | today's default (`fittedBuild.ts:2895`) · legacy |
| bookcase.glued | glued | inside | 5 | even | 7 | fixed | shrinkDefault | `wantsFixedGlueShelves` · legacy |

Later families add rows the same way (wardrobe: `wardrobe.hat` kind hat zone aboveRod, `wardrobe.rodDefault` lower/drop with note, `wardrobe.rodTyped` refuse; `dresser.drawersFill`
default 0; `vanity.knee` zone aboveKnee …). The full row list is written in each family's PR, from that family's legacy
code, so each PR reviews only its own rows.

## 3. Builder interface
```ts
export type ShelfInput = {
  family: CarcassFamily; H: number; t: number; zone: { y0: number; y1: number };
  typed: number | null;            // from the one typed-count reader (shelfClear.ts typedShelfDemand, widened); 0 is a real value
  rod: "typed" | "default" | null; drawersFill: boolean; knee: boolean; glued: boolean;
};
export type ShelfPlan = { levels: { y: number; t: number; kind: ShelfKind }[]; typed: number | null; ruleId: string; note?: string };
export type ShelfRefusal = { refusal: string; minHeight: number; ruleId: string };
export function planShelves(input: ShelfInput): ShelfPlan | ShelfRefusal;      // pure, no prompt, no panels
export function shelfPlanOf(project: YardProject): { levels: number; pieces: number; fixed: number; perLevel: number[] }; // read-back
```
- `buildFitted` builds `ShelfInput` from the variables it already has (`shelfZone0/1`, `rodY`, `drawersFillLower`, `hasKnee`, `P`) and, for a family whose rows have `drives: true`, places `plan.levels` with the same `panel("shelf", …)` calls it uses today. A refusal goes through the existing `refused()` path (`tooSmall.ts`), so header, PDF cover and price follow rule 6 with no new surface code.
- The plan's `ruleId` is kept on the project (`project.shelfRule`, never shown) so a bad build names the table row that made it (REVIEW F-12).
- **Typed count (Critic's answer 1)**: the one reader is `shelfClear.ts typedShelfDemand`, widened in place. It is **not** `spec.ts COUNTED`, which on raw words reads `small 6 foot shelf` → 6, `bookcase 12 inch shelves` → 12 and `bookcase 30 wide shelves` → 30, has no "eleven", misses "no shelves" and "5-shelf", and keeps shelf/shelves as two keys.
  - Widening: drop the `SHELF_FAMILY` gate (the builder passes the family); read 0, "no shelves", eleven, twelve and any n (no 1–12 null); allow one adjective (floating, glass, adjustable) but never a unit or axis word between the number and "shelf".
  - Callers that move to it: `spokenShelfCount` (`fittedShared.ts:240`) delegates its shelf branch, which covers `fittedParse.ts:1025` (drop `Math.max(1, …)` and the `(\d+)\s*shel` fallback), `spokenTierCount` (`:229`) and the ladder (`fittedBuilders.ts:1129`, out of family, via the delegate); the regexes at `fittedBuild.ts:2681` (`shelvesTyped`) and `:2901` (purpose); `COUNTED`'s shelf keys in `spec.ts:43/88` (one key, from the reader); `pdf.ts:1212 headerFeatures typed()` (0 → no count in the header, which fixes row 211's header). `tooSmall.ts:125` and `fittedBuild.ts:2877` already call it.
  - Built counts are not this reader's job: `shelfLineCount`, `shelfLevelLayout`/`shelfLevelsFit` and `adjustableShelfTalk` move to `shelfPlanOf` (PR 2).
  - The grader's readers stay separate on purpose and never import the engine's: `scripts/eval-gate-typed.ts:128`, `eval-gate-lib.ts shelfLevelCount`, and the precheck. Otherwise the engine grades itself.
  - In PR 1 only the bookcase rows read the widened reader; every other caller keeps today's gated behavior until its family PR switches it, so parity holds. How (row 363): the `SHELF_FAMILY` gate and the 1–12 range move out of `typedShelfDemand` into its two engine callers, `tooSmall.ts:125` and `fittedBuild.ts:2877` (re-checked on 0a16920). Each caller reads the widened count, then keeps today's result unless the family is in `WIDENED_SHELF_FAMILIES` (PR 1: `["bookcase"]`): for wardrobe, closet, pantry and linen it still returns null outside 1–12, and for every other family null. Each family PR adds its family to the list. The last one deletes the list and the legacy branch. The parity test proves the non-listed families are byte-identical.
- `shelfPlanOf` owns the shelf-pin Buy note (PR 2). The `report.ts:1059` fallback `${shelfCount} shelves × 4`, where `shelfCount` is the number of pin *pieces*, is deleted.

## 4. Parity mode (nothing silently changes)
- **Production**: one path per family. `drives: false` families run the legacy code only; there is no runtime double build.
- **Test** `src/lib/yard/carcassShelves.parity.test.ts`: for every carcass prompt in a committed fixture (`evals/carcass-shelf-prompts.json`: the precheck's 158 carcass probes, its SHELF_COUNT set, and the carcass prompts of its REGRESSION/DRIFT sets, copied in once, since CI can't read the precheck's box-local files), it builds the project with the legacy path and computes `planShelves` from the same inputs, then asserts:
  - `drives: false` family → plan levels equal legacy shelf levels (y at 1/16", t, count) for every prompt.
  - `drives: true` family → every prompt equals legacy **except** the prompts listed in the test itself with their new expected value and the row it fixes. Intended changes are assertions, never an allow/baseline file (precheck check 8 rule).
  - Parity is only for rules that already honor FR-004. A family whose typed count is reduced, dropped or unchecked today moves it open → hold in its PR as an asserted change (§5).
  - PR 1 resolves the default-count question by matching today's code: there is no default-shrink path in the code today (no bookcase default is ever checked for clear), so `bookcase.default` ships `drives: false` in PR 1 and keeps legacy output. PR 1b flips it to `true` with its two asserted changes.
- Canaries: the existing canary tests plus precheck check 2. No canary prompt is in a family whose PR changes output until Ezra approves that exact change.
- Budget: the parity test must finish under 30 s on CI (guards is at 38 min; see REVIEW F-7).

## 5. Migration order (one family per PR, each ≤ 400 changed lines, merge-only, max 2 open per bot)
**Start gate: #112 merged into the release branch (#142 merged in 4e74ad3).** #112 rewrites the same lines of `buildFitted`
(L2865–2926 on 1fd539d: rod, `shelvesAsked`, `zoneY0`) that #142 already changed, and between them they define the rule values the table must carry
(`shelfClear.ts`: 7" clear, 4" floor, 40" hang, 2" rod lift, `closetShelfMinHeight`, `typedShelfDemand`;
`hangingClearance.ts`: 22" hanging depth, 42" bays). Starting before #112 lands means a conflict and two
copies of each value. With #142 merged, the bookcase usable-clear refusal and the "N shelves (M pieces)" wording are
already fixed (merged in 4e74ad3), so the table PRs do not claim them; they hold them.

| PR | Family / scope | Rows it moves open → hold | Holds (parity) | Waits on |
|---|---|---|---|---|
| 1 | **bookcase**: table + `planShelves` + parity test + the widened `typedShelfDemand` (bookcase rows `drives: true`, `bookcase.default` `drives: false`) | **211** (`bookcase with 0 shelves` and `bookcase 60x30x8 with 0 shelves`: 0 levels, no "· 5 shelves"); `bookcase with 13 shelves` (13 at 5 1/8" → refuses with the second form: needs 110", taller than a 4×8 sheet cuts, up to 96" holds 11, nothing built at 84"); `bookcase 60 wide 68 1/2 tall with 8 shelves from 1/2 plywood` (refused at 71 1/4" → builds 8 at ≥ 7"); `bookcase 60 wide 30 tall with 8 shelves from 1/2 plywood` (refusal 71 1/4" → 68 1/2") | 300, 307, 304, 317, #142 bookcase refusals (`… 60 wide 30 tall with 8 shelves` → `at least 71 1/4" tall`), DRIFT set | #112 merged |
| 1b | bookcase default shrink (`bookcase.default` `drives: true`) | `bookcase 60 wide 30 tall` (5 at 4" → 2 at 8 3/4", note "2 shelves fit at 30" with 7" clear between them; a bookcase 48" tall holds all 5.", no header count); `bookcase 60x30x8` (5 in 8" → 0, note "This 8" bookcase is an open box; a bookcase 17" tall holds 1 shelf with 7" clear, 48" holds all 5.", no header count) | everything PR 1 holds | PR 1 |
| 2 | read-back `shelfPlanOf` at 8 callers: the 6 `shelfLineCount` callers, `shelfLevelLayout`/`shelfLevelsFit` (`tooSmall.ts:126/128`), `adjustableShelfTalk` (`report.ts:1039`, `steps.ts:2620`). It owns the pin Buy note; the `report.ts:1059` fallback is deleted | 315(1) (hat counted as adjustable), 336 residue in check 6 | 300, 309, 317 | PR 1 |
| 3 | cabinet | `cabinet 48 wide with shelves` (default 3 at 6 3/8" → 2, with the note); `cabinet 48 wide 30 tall with 4 shelves` (4 at 4 15/16" → refuses at the height where 4 levels keep 7": 40 1/4" by `closetShelfMinHeight(4)` with no kick; the `minBuild` rebuild decides) | 300 cabinet prompts | PR 1 |
| 4 | pantry | – (parity for 1–12, which already refuse through `typedShelfDemand`; a typed 0 or 13+ that moves with the widened reader is listed as an asserted change; pantry partials are hinge/closet wording, not shelves) | 268 pantry | PR 1 |
| 5 | wardrobe: #112/#142 hang rules become rows (`aboveRod`, hat, 40" hang, 22" depth, rod default/typed) | 315(3) (center divider overlapping Shelf 1 on `wardrobe with 2 drawers`); `wardrobe 72 tall with 12 shelves` (refused at 102 1/4" → second form: taller than a 4×8 sheet cuts, up to 96" holds 11, nothing built at 72"); `wardrobe with 13 shelves` (row 361: 13 at 11/16" → second form, needs 110", holds 11) | 242 (10 shelves), 334, 304, 271, 274, #112 `rods_le`, #142 `levels16_or_refused_min`, typed rod refuses at 97 3/4" | PR 1 |
| 6 | nightstand | `nightstand 20 wide 24 tall with 3 shelves` (builds 1, "· 1 shelf" → refuses with the zone-aware minimum, never "· 1 shelf") | 295 nightstand | anti-tip PR merged |
| 7 | dresser | `dresser with 3 shelves` (3 at 3 3/8" in the 16 1/2" zone under the drawers → refuses and names the height where the drawers plus 3 levels at 7" fit, by the zone-aware minimum) | 295 dresser; drawers fill → 0 when no count is typed | anti-tip PR merged |
| 8 | vanity (generic knee path only; pocket vanity and sink vanity untouched) | `bathroom vanity 36 wide with 3 shelves` (0 shelves, "built without them for now" → refuses with the zone-aware minimum, or builds 3 levels at ≥ 7") | 244, 245, 246, 278, 295 vanity; desk canary | PR 1 |
| 9 | linen (closet program): builds byte-identical, then delete the legacy generic shelf section | refusal noun (`linen closet 40 tall with 8 shelves`: "A linen needs …" → "A linen closet needs …"; no build changes) | linen canary byte-identical | Ezra only if any linen build byte moves (it must not) |

Rows 314 (wine rail) and 315(2) (pocket vanity "Pin 6") are outside the eight-family generic path: 314 is `fittedWine.ts`
(#142) and the pocket vanity is `buildPocket`. The table holds them by not touching those paths; their acceptance is
"no regression" (check 2 with the approved Pin 6 entry, check 6).

## 6. Ponytail: what we are deliberately NOT building
1. No JSON/YAML rule files, loader or DSL: a typed TS array (rung 2: the repo already does this in `usableFloors.ts`).
2. No second min-height formula per family: one minimum definition (§2: the smallest H where the builder's own zone fits), of which #142's `closetShelfMinHeight` and `rodShelfMinHeight` are the closed forms of the no-zone and typed-rod cases; the clear constants from #142 are the source.
3. No new span math: `shelfSpanLimit` and `withShelfSpanSupports` stay as the one span rule; the table references them.
4. No second Measure re-tiler: `retileShelves` keeps placing; it only gains the fit check (later PR, if Critic wants it).
5. No change to non-family shelf builders (wall shelves, ladder, cubby, hung/collection shelves, bathroom wall cabinet, wine rack). Their "shrink a typed count" notes (`fittedBuild.ts:2530`, `fittedBuilders.ts:1175`) break the refusal rule; logged as a backlog row for Chief, not fixed here.
6. No drawer, door or hinge rules (the carcass probe's biggest partial class is hinge count, 43 builds; it is the next table, not this one).
7. No 1/16" snapping of shelf positions (it would move canary fingerprints); a later, separately approved rule.
8. No runtime dual-run, no env flag, no feature flag service, no AI.
9. No new UI, picker or page.

## 7. Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Conflicts with open #112 in `fittedBuild.ts` L2865–2926, `shelfSpan.ts`, `steps.ts` (verified from `gh pr diff`) | certain if started now | start gate: #112 merged first (§5) |
| Desk 60×30×29 canary shares the generic section (knee) | medium | desk is not a table family; `ShelfInput` is built only for the eight families; check 2 on every PR |
| Linen canary moves | low | linen is last and parity-only; any byte change stops the PR for Ezra |
| A refusal lowers a gate grade (built → refused) | medium | run eval gate head vs base (check 1); a refusal that the gate grades worse goes to Critic before push |
| Five typed-shelf regexes (`spokenShelfCount`, `fittedBuild.ts:2681`, `:2901`, `spec.ts COUNTED`, #142 `typedShelfDemand`) disagree on 0, words past six/eight/ten, and adjectives | high | `typedShelfDemand` is widened in PR 1 and is the one reader; each family PR switches its reads to it; parity shows any prompt whose count moves; size phrases are pinned as never counts |
| Level rounding: `shelfLineCount` 1/4" vs precheck 1/16" | medium | `shelfPlanOf` counts at 1/16"; PR 2 shows every build whose count moves |
| Parity fixture drifts from the precheck's sets | medium | fixture records the precheck commit/date; Critic's sets stay the grader |
| Guards CI time | medium | ≤ 30 s budget, single process |
| The brief's graph (main) misses release-24 callers | known | blast radius taken from a release-24 graph; re-run per PR on its head |

## 8. Verification per PR
gstack-review on the head; precheck table on the head sha (no FAIL); graphify blast radius re-run on the head for the
functions touched; "ponytail: what I didn't write" line; eval gate and canaries via the heavy lock; DEBUG REPORT
(systematic-debugging + gstack-investigate) if any row blocks twice.
