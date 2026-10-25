# Implementation Plan: 009 Carcass shelf rules table

**Spec**: `spec.md` · **Branch**: `spec/009-carcass-rules` · **Base**: release-24 @ 408c2c15 · **Status**: plan only

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
    rod?: boolean; drawersFill?: boolean; knee?: boolean; glued?: boolean; typedCount?: boolean;
  };
  zone: Zone;                       // which opening the levels share
  count: { default: number; min: 0; max: 12 };   // typed counts outside min..max refuse
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
- **fit** `(S − n·t) / (n + 1) ≥ minClear` (minClear = #142's `CLOSET_SHELF_CLEAR_IN` 7", never below its `SHELF_CLEAR_FLOOR_IN` 4"; the duplicate `SHELF_MIN_CLEAR = 7` in `fittedShared.ts` becomes a re-export of it)
- **positions (even)** `y_k = y0 + S·k / (n + 1)`, k = 1..n. Exactly today's arithmetic (`fittedBuild.ts:2885`), no new rounding in parity mode.
- **largest default that fits** `n_fit = floor((S − minClear) / (minClear + t))`, clamped to `[0, default]`
- **minimum height for a typed n**: the one formula #142 adds, `shelfClear.ts closetShelfMinHeight(n, t)` = `(n + 1)·(t + 7) + 2t` (8 shelves of 3/4" ply → 71 1/4"; 10 → 86 3/4", the same number #112 names). It is 3/4" more than the exact fit (`2t + (n + 1)·7 + n·t`), so the named height always builds cleanly; the table keeps it as is (parity), it does not add a second formula.
- **pieces per level** read after the span pass: the number of shelf panels at that level (1/16" rounding). The table does not re-derive dividers; `withShelfSpanSupports` stays the one span rule (row 307).

Example rows (bookcase, the first PR):

| id | when | zone | default | spacing | minClear | kind | onShort | why · source |
|---|---|---|---|---|---|---|---|---|
| bookcase.typed | typedCount | inside | – | even | 7 | adjustable | refuse | rows 242/336 usable pitch · Critic row 336, precheck `levels_usable` |
| bookcase.default | – | inside | 5 | even | 7 | adjustable | shrinkDefault | today's default (`fittedBuild.ts:2872`) · legacy |
| bookcase.glued | glued | inside | 5 | even | 7 | fixed | shrinkDefault | `wantsFixedGlueShelves` · legacy |

Later families add rows the same way (wardrobe: `wardrobe.hat` kind hat zone aboveRod from #112; `dresser.drawersFill`
default 0; `vanity.knee` zone aboveKnee …). The full row list is written in each family's PR, from that family's legacy
code, so each PR reviews only its own rows.

## 3. Builder interface
```ts
export type ShelfInput = {
  family: CarcassFamily; H: number; t: number; zone: { y0: number; y1: number };
  typed: number | null;            // from the one typed-count reader (spec.ts COUNTED, exported); 0 is a real value
  rod: boolean; drawersFill: boolean; knee: boolean; glued: boolean;
};
export type ShelfPlan = { levels: { y: number; t: number; kind: ShelfKind }[]; typed: number | null; ruleId: string; note?: string };
export type ShelfRefusal = { refusal: string; minHeight: number; ruleId: string };
export function planShelves(input: ShelfInput): ShelfPlan | ShelfRefusal;      // pure, no prompt, no panels
export function shelfPlanOf(project: YardProject): { levels: number; pieces: number; fixed: number; perLevel: number[] }; // read-back
```
- `buildFitted` builds `ShelfInput` from the variables it already has (`shelfZone0/1`, `rodY`, `drawersFillLower`, `hasKnee`, `P`) and, for a family whose rows have `drives: true`, places `plan.levels` with the same `panel("shelf", …)` calls it uses today. A refusal goes through the existing `refused()` path (`tooSmall.ts`), so header, PDF cover and price follow rule 6 with no new surface code.
- The plan's `ruleId` is kept on the project (`project.shelfRule`, never shown) so a bad build names the table row that made it (REVIEW F-12).
- Typed count: export the `COUNTED` reader from `spec.ts` (#109) as `typedCount(words, "shelves")` and use it in the builder; this is the fix for row 211 (a typed 0 today is dropped by `spokenShelfCount`'s 1–12 range and `fittedParse.ts`'s `Math.max(1, …)`).

## 4. Parity mode (nothing silently changes)
- **Production**: one path per family. `drives: false` families run the legacy code only; there is no runtime double build.
- **Test** `src/lib/yard/carcassShelves.parity.test.ts`: for every carcass prompt in a committed fixture (`evals/carcass-shelf-prompts.json`: the precheck's 158 carcass probes, its SHELF_COUNT set, and the carcass prompts of its REGRESSION/DRIFT sets, copied in once, since CI can't read `/workspace`), it builds the project with the legacy path and computes `planShelves` from the same inputs, then asserts:
  - `drives: false` family → plan levels equal legacy shelf levels (y at 1/16", t, count) for every prompt.
  - `drives: true` family → every prompt equals legacy **except** the prompts listed in the test itself with their new expected value and the row it fixes. Intended changes are assertions, never an allow/baseline file (precheck check 8 rule).
- Canaries: the existing canary tests plus precheck check 2. No canary prompt is in a family whose PR changes output until Ezra approves that exact change.
- Budget: the parity test must finish under 30 s on CI (guards is at 38 min; see REVIEW F-7).

## 5. Migration order (one family per PR, each ≤ 400 changed lines, merge-only, max 2 open per bot)
**Start gate: #112 and #142 merged into the release branch.** Both rewrite the same 40 lines of `buildFitted`
(L2865–2903: rod, `shelvesAsked`, `zoneY0`) and between them they define the rule values the table must carry
(`shelfClear.ts`: 7" clear, 4" floor, 40" hang, 2" rod lift, `closetShelfMinHeight`, `typedShelfDemand`;
`hangingClearance.ts`: 22" hanging depth, 42" bays). Starting before they land means a conflict and two
copies of each value. On #142's head the bookcase usable-clear refusal and the "N shelves (M pieces)" wording are
already fixed, so the table PRs do not claim them; they hold them.

| PR | Family / scope | Rows it moves open → hold | Holds (parity) | Waits on |
|---|---|---|---|---|
| 1 | **bookcase**: table + `planShelves` + parity test + the one typed-count reader (bookcase rows `drives: true`) | **211** (`bookcase with 0 shelves`: 0 levels, no "· 5 shelves") | 300, 307, 304, 317, #142 bookcase refusals (`… 60 wide 30 tall with 8 shelves` → `at least 71 1/4" tall`), DRIFT set | #112, #142 merged |
| 2 | read-back `shelfPlanOf` at the 6 `shelfLineCount` callers (one counter, 1/16" levels, fixed/hat named) | 315(1) (hat counted as adjustable), 336 residue in check 6 | 300, 309, 317 | PR 1 |
| 3 | cabinet | default clear (`cabinet 48 wide with shelves`: default 3 at 30" leaves 6 3/8" → 2 with a note) | 300 cabinet prompts | PR 1 |
| 4 | pantry | – (parity; pantry partials are hinge/closet wording, not shelves) | 268 pantry | PR 1 |
| 5 | wardrobe: #112/#142 hang rules become rows (`aboveRod`, hat, 40" hang, 22" depth) | 315(3) (center divider overlapping Shelf 1 on `wardrobe with 2 drawers`) | 242, 334, 304, 271, 274, #112 `rods_le`, #142 `levels16_or_refused_min` | PR 1 |
| 6 | nightstand | – (parity) | 295 nightstand | anti-tip PR merged |
| 7 | dresser | – (parity; drawers fill → 0) | 295 dresser | anti-tip PR merged |
| 8 | vanity (generic knee path only; pocket vanity and sink vanity untouched) | – | 244, 245, 246, 278, 295 vanity; desk canary | PR 1 |
| 9 | linen (closet program): parity only, zero output change, then delete the legacy generic shelf section | – | linen canary byte-identical | Ezra only if any linen byte moves (it must not) |

Rows 314 (wine rail) and 315(2) (pocket vanity "Pin 6") are outside the eight-family generic path: 314 is `fittedWine.ts`
(#142) and the pocket vanity is `buildPocket`. The table holds them by not touching those paths; their acceptance is
"no regression" (check 2 with the approved Pin 6 entry, check 6).

## 6. Ponytail: what we are deliberately NOT building
1. No JSON/YAML rule files, loader or DSL: a typed TS array (rung 2: the repo already does this in `usableFloors.ts`).
2. No new min-height or clear formula: `closetShelfMinHeight` and the clear constants from #142 are the source.
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
| Conflicts with open #112 / #142 in `fittedBuild.ts` L2865–2903, `shelfSpan.ts`, `steps.ts` (verified from `gh pr diff`) | certain if started now | start gate: both merged first (§5) |
| Desk 60×30×29 canary shares the generic section (knee) | medium | desk is not a table family; `ShelfInput` is built only for the eight families; check 2 on every PR |
| Linen canary moves | low | linen is last and parity-only; any byte change stops the PR for Ezra |
| A refusal lowers a gate grade (built → refused) | medium | run eval gate head vs base (check 1); a refusal that the gate grades worse goes to Critic before push |
| Five typed-shelf regexes (`spokenShelfCount`, `fittedBuild.ts:2680`, `:2878`, `spec.ts COUNTED`, #142 `typedShelfDemand`) disagree on 0, words past six/eight/ten, and adjectives | high | PR 1 adds one reader; each family PR switches its reads to it; parity shows any prompt whose count moves |
| Level rounding: `shelfLineCount` 1/4" vs precheck 1/16" | medium | `shelfPlanOf` counts at 1/16"; PR 2 shows every build whose count moves |
| Parity fixture drifts from the precheck's sets | medium | fixture records the precheck commit/date; Critic's sets stay the grader |
| Guards CI time | medium | ≤ 30 s budget, single process |
| The brief's graph (main) misses release-24 callers | known | blast radius taken from a release-24 graph; re-run per PR on its head |

## 8. Verification per PR
gstack-review on the head; precheck table on the head sha (no FAIL); graphify blast radius re-run on the head for the
functions touched; "ponytail: what I didn't write" line; eval gate and canaries via the heavy lock; DEBUG REPORT
(systematic-debugging + gstack-investigate) if any row blocks twice.
