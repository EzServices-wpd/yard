# Acceptance table: 009 carcass shelf rules

Source of row text: the team's ranked error log (rows 242, 300, 304, 307, 314, 315, 342) and the precheck's `lib/sets.py`
(both outside the repo). "Tip" = the release branch as Critic probed it on 4e74ad3 (#142 merged); 4e74ad3..1fd539d changes
no shelf code. "#112" = r7 793c55fa (open). The grader is the precheck on each PR's head sha: **check 7 (78 assertions:
the brief's 68, #112/#142's, and Critic's six "009" rows) 0 regressions vs base, check 3 0 Pass→worse, check 6 0 new
contradictions, check 2 canaries 7/7, `ends_supported` once Critic adds it, and no new invariant codes.** Every refusal's
minimum rebuild must be clean of **all** invariants; the only exception is I11 "closet wording" on wardrobes and pantries,
which is pre-existing on every wardrobe and is named as such, not counted as a pass. A new invariant on a minimum build is a FAIL.

The one refusal sentence (FR-011): `{A|An} {noun} needs at least {MIN}" tall for {N} {shelf|shelves} with 7" clear between
them{ and a hanging rod}. Nothing is built at {H}".`

## The six brief rows

| Row | Prompt(s) (exact) | Assertion / check | Tip | Expected with the table | PR |
|---|---|---|---|---|---|
| **242** | `wardrobe 36 tall with 10 shelves`; `wardrobe 72 tall with 12 shelves` | check 7 `levels_usable (n, 7.0)`; the refusal's `at least X" tall` rebuilt at X (`minBuild`) must pass | refused: "A wardrobe needs at least 86 3/4" tall for 10 shelves with 7" clear between them. Nothing is built at 36"." (**hold**; #112 r7 ends "Nothing is built.") | the one sentence: "A wardrobe needs at least 86 3/4" tall for 10 shelves with 7" clear between them. Nothing is built at 36"." The rebuild at 86 3/4" gives 10 levels at ≥ 7" and is clean except the pre-existing I11. 86 3/4" is conservative (exact fit 86", P3) | 5 (holds); 1 must not regress it |
| **300** | `bookcase 48 wide with 3 shelves` (+ check 6's 32 typed prompts, e.g. `3 shelf bookshelf 42 wide 14 deep 42 tall`, `cabinet 48 wide with shelves`, `wardrobe with a hanging rod and 2 shelves 66 wide`) | check 7 `header_count 3`; check 6 header = picker = cover = notes/pin | header "· 3 shelves", 3 levels, 6 pieces (**hold**) | hold; header reads `shelfPlanOf` levels | 1 (bookcase), 2 (read-back), 3 (cabinet) |
| **304** | `wardrobe 15 1/2 deep` (`no_double_stamp`); the #115 test case moved to a buildable depth (`wardrobe 22 1/2 deep`) | check 7 `no_double_stamp`; `untypedAxis.test.ts` row 240 case | built, title "Wardrobe 15 1/2" deep" (**hold**); #112 refuses at 22" deep | same refusal from the wardrobe hang row; title never prints the size twice | 5 (holds) |
| **307** | `bookshelf from 1x10`; `bookcase from 1x10 36 wide 72 tall`; `bookshelf 36 wide 72 tall out of 1x10 pine` | check 7 `span_ok`; `no_part ^(Shelf nosing|Front stiffener)` (row 301) | center divider, every span ≤ stock limit, no nosing (**hold**) | hold: span stays `withShelfSpanSupports`; table only reads pieces after it; each piece held at both ends (FR-010) | 1 (holds) |
| **314** | `pine wine rack 30 wide with 20 slots` | check 7 `named_stock_only lumber-1x4-8` (row 308); check 6 header/notes height | #142 seats the rail inside the case (**hold**); not in the eight families (`fittedWine.ts`) | **untouched** (out of family); must not regress | none |
| **315** | (1) `wardrobe 72 wide with hanging rod`; (2) pocket vanity canary; (3) `wardrobe with 2 drawers`; (4) ship-note gate delta | check 6 fixed-vs-adjustable WARN; check 2 (approved `pr142` Pin 6 entry); invariants I26 (overlap) | (1) hat named fixed in notes (#112); (2) Pin 6 wording (approved by Ezra 8:28 PM ET); (3) 4" divider overlapping Shelf 1 by 1/16" | (1) `shelfPlanOf` counts the hat as fixed on every surface; (2) untouched (`buildPocket`); (3) zone `aboveDrawers` leaves no shelf the divider crosses, I26 clean; (4) process, n/a | (1) 2, (3) 5 |

## Rows the table also moves (asserted changes, open → hold)

| Row | Prompt | Assertion | Tip | Expected | PR |
|---|---|---|---|---|---|
| 211 | `bookcase with 0 shelves` | `levels_eq_or_refused 0` | 5 levels, header "· 5 shelves" (**open**) | 0 levels, no shelf count in the header | **1** |
| 009 | `bookcase with 13 shelves` | `levels_usable (13, 7.0)` | 13 levels at 5 1/8" (**open**: the 1–12 cap) | refused, one sentence, at least 110" (`closetShelfMinHeight(13)`); the rebuild at 110" gives 13 at ≥ 7" | **1** |
| rule 4 | `bookcase 60 wide 30 tall with 8 shelves from 1/2 plywood` | refusal minimum rebuilt (not in `sets.py`; asked of Critic) | refuses at 71 1/4" (the 3/4" number) | refuses at 68 1/2" (picked stock's t); the rebuild is clean | **1** |
| 009 | `bookcase 60x30x8` (W×D×H) | `min_level_pitch 7.75` | 5 default shelves in 8" (5/16" clear) (**open**) | 0 shelves, with the default-shrink note | **1b** |
| default | `bookcase 60 wide 30 tall` | default clear (not in `sets.py`; asked of Critic) | 5 default shelves at 4" clear | 3 shelves, with the note | **1b** |
| 009 | `cabinet 48 wide with shelves` | `min_level_pitch 7.75` | default 3 at 6 3/8" clear, no note (**open**) | 2 shelves, with the note | **3** |
| 009 | `cabinet 48 wide 30 tall with 4 shelves` | `levels_usable (4, 7.0)` | 4 levels at 4 15/16" (**open**) | refused at the height where 4 levels keep 7" (40 1/4" by `closetShelfMinHeight(4)` with no kick; the `minBuild` rebuild decides) | **3** |
| 009 | `nightstand 20 wide 24 tall with 3 shelves` | `levels_eq_or_refused 3` | builds 1, "· 1 shelf" (**open**) | refused with the zone-aware minimum; never "· 1 shelf" | **6** |
| count | `dresser with 3 shelves` | levels at ≥ 7" or refused (not in `sets.py`; asked of Critic) | 3 levels at 3 3/8" in the 16 1/2" zone under the drawers | refused, naming the height where the drawers plus 3 levels at 7" fit (zone-aware minimum); the rebuild is clean | **7** |
| count | `bathroom vanity 36 wide with 3 shelves` | levels at ≥ 7" or refused (not in `sets.py`; asked of Critic) | 0 shelves, "built without them for now" (a drop) | refused with its minimum, or 3 levels at ≥ 7" | **8** |
| noun | `linen closet 40 tall with 8 shelves` | refusal text (check 6 sweep) | "A linen needs at least 71 1/4" tall …" | "A linen closet needs at least 71 1/4" tall for 8 shelves with 7" clear between them. Nothing is built at 40"." | **9** |

## Rows the table must hold

| Row | Prompt | Assertion | Tip | Expected | PR |
|---|---|---|---|---|---|
| 334 | `wardrobe with 4 shelves`, `with 6 shelves`, `84 tall with 6 shelves`, `36 wide 72 tall with 5 shelves` | `levels_usable (n, 7.0)` | per #142/#112 (≥ 7" or refused) | ≥ 7" clear or the one sentence | 5 (holds) |
| 309 | `kitchen island`, `rolling kitchen island` | `header_count None` | hold | hold (island is not a table family) | – |
| 317 | `bookcase 60 wide with 4 shelves` and the 6 corpus builds | check 6 levels + pieces named | "4 shelves (8 adjustable pieces)" (#142) | hold | 1, 2 |
| #142 | `wardrobe 36 tall with 10 shelves` | `levels16_or_refused_min 10` | refusal names 86 3/4" (hold) | hold | 5 |
| #112 | 8 wide wardrobes | `rods_le 42` | hold/open per #112 | hold | 5 |
| 009 | `bookcase 60 wide 30 tall with 8 shelves` | `levels_usable (8, 7.0)` + minimum probe (guard) | refuses at 71 1/4", rebuild clean | hold | 1 |
| rod | `wardrobe with a hanging rod 60 tall with 6 shelves` | typed rod kept or refused | refuses at 97 3/4" (`rodShelfMinHeight(6)`); #112 r7 drops the rod (must not ship) | hold: a typed rod is never dropped | 5 |
| P3 | `wardrobe 86 tall with 10 shelves` | logged | refuses at 86 3/4" (exact fit 86") | hold; the conservative minimum is accepted P3 | 5 |

## FR-010: every shelf piece held at both ends (new)

| Row | Prompt | Check | Expected | PR |
|---|---|---|---|---|
| 342 | the 8 wide-wardrobe prompts (#112 `rods_le` set) | I1/I7/I26 clean **plus** `ends_supported` (Critic adding) | no shelf joint over open space; a divider stands on a hat shelf only if the hat is continuous under it and keeps its front rail | 5 |
| FR-010 | multi-bay bookcases (`bookcase 60 wide with 4 shelves`, `bookshelf from 1x10`, `bookcase from 1x10 36 wide 72 tall`) | I1/I7/I26 + `ends_supported` | every piece ends on a side, divider, cleat or pins; a split only at a divider that runs to the bottom/top | 1, 2 |

## Canaries (must be byte-identical; check 2 and the gate's canary set)
Linen (post-anti-tip baseline once merged: 31 1/2 × 16 × 78, 11 parts, $193.68, 8 Buy lines, 9 steps; before it:
$183.70, 7, 8) · pocket vanity (50 parts, $636.23, with #127/#142's approved entries) · Andersen 36×48 · desk 60×30×29 with
24" knee · 3-ft popsicle Eiffel · cat tree · step stool. Only linen (closet program) and the desk (knee path) share code
with the table; linen moves last with builds byte-identical (only its refusal noun changes), the desk is not a table family.
