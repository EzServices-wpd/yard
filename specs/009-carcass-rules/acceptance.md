# Acceptance table: 009 carcass shelf rules

Source of row text: `/workspace/yard-errors-ranked.md` (lines 393, 451, 455, 458, 465, 466) and the precheck's
`lib/sets.py`. "Base" = release-24 @ 408c2c15; "#112" = 793c55fa; "#142" = c649e54e. Base, #112 and #142 results are
read from the precheck dumps of runs `20261024-204235-112` and `20261024-202455-142` (no new engine run). The
grader is the precheck on each PR's head sha: **check 7 (72 assertions today; the brief's 68 predates #112/#142's
additions) 0 regressions vs base, check 3 0 Pass→worse, check 6 0 new contradictions, check 2 canaries 7/7, and no
new invariant codes.**

## The six brief rows

| Row | Prompt(s) (exact) | Assertion / check | Base 408c2c15 | After #112 / #142 | Expected with the table | PR |
|---|---|---|---|---|---|---|
| **242** | `wardrobe 36 tall with 10 shelves`; `wardrobe 72 tall with 12 shelves` | check 7 `levels_usable (n, 7.0)`; refusal's `at least X" tall` rebuilt at X (`minBuild`) must pass | built 9 levels (typed 10), min clear −9/16"; 12 levels, −9/16" (**open**) | refused: "A wardrobe needs at least 86 3/4" tall for 10 shelves with 7" clear between them. Nothing is built." (#112); #142 ends "Nothing is built at 36"." (**hold**) | same minimum (86 3/4") from the table's wardrobe rows; one refusal sentence, ending "Nothing is built at 36"." (REVIEW F-4) | 5 (holds); 1 must not regress it |
| **300** | `bookcase 48 wide with 3 shelves` (+ check 6's 32 typed prompts, e.g. `3 shelf bookshelf 42 wide 14 deep 42 tall`, `cabinet 48 wide with shelves`, `wardrobe with a hanging rod and 2 shelves 66 wide`) | check 7 `header_count 3`; check 6 header = picker = cover = notes/pin | header "· 3 shelves", 3 levels, 6 pieces (**hold**) | hold | hold; header reads `shelfPlanOf` levels | 1 (bookcase), 2 (read-back), 3 (cabinet) |
| **304** | `wardrobe 15 1/2 deep` (`no_double_stamp`); the #115 test case moved to a buildable depth (`wardrobe 22 1/2 deep`) | check 7 `no_double_stamp`; `untypedAxis.test.ts` row 240 case | built, title "Wardrobe 15 1/2" deep" (**hold**) | refused: "A wardrobe needs at least 22" deep so clothes can hang (hangers need about 20" inside). Nothing is built at 15 1/2"." (**hold**) | same refusal from the wardrobe hang row; title never prints the size twice | 5 (holds) |
| **307** | `bookshelf from 1x10`; `bookcase from 1x10 36 wide 72 tall`; `bookshelf 36 wide 72 tall out of 1x10 pine` | check 7 `span_ok`; `no_part ^(Shelf nosing|Front stiffener)` (row 301) | center divider, every span ≤ stock limit, no nosing (**hold**) | hold | hold: span stays `withShelfSpanSupports`; table only reads pieces after it | 1 (holds) |
| **314** | `pine wine rack 30 wide with 20 slots` | check 7 `named_stock_only lumber-1x4-8` (row 308); check 6 header/notes height | front rail below the case (header 22 1/4 vs notes 18 3/4) on #114 r7; not in the eight families (`fittedWine.ts`) | #142 seats the rail inside the case | **untouched** (out of family); must not regress | none (owned by #142) |
| **315** | (1) `wardrobe 72 wide with hanging rod`; (2) pocket vanity canary; (3) `wardrobe with 2 drawers`; (4) ship-note gate delta | check 6 fixed-vs-adjustable WARN; check 2 (approved `pr142` Pin 6 entry); invariants I26 (overlap) | (1) "4 adjustable shelf lines" with a screwed hat shelf; (3) 4" divider overlapping Shelf 1 by 1/16" | #112: hat named fixed in notes; #142: Pin 6 wording (approved by Ezra 8:28 PM ET) | (1) `shelfPlanOf` counts the hat as fixed on every surface; (2) untouched (pocket vanity is `buildPocket`); (3) zone `aboveDrawers` leaves no shelf the divider crosses, I26 clean; (4) process, n/a | (1) 2, (3) 5 |

## Rows the table also moves or must hold (same class)

| Row | Prompt | Assertion | Base | Expected | PR |
|---|---|---|---|---|---|
| 211 | `bookcase with 0 shelves` | `levels_eq_or_refused 0` | 5 levels, header "· 5 shelves" (**open**, also on #142) | 0 levels, no shelf count in the header | **1** |
| 334 | `wardrobe with 4 shelves`, `with 6 shelves`, `84 tall with 6 shelves`, `36 wide 72 tall with 5 shelves` | `levels_usable (n, 7.0)` | clear 3 3/8", 2 3/16", 2 3/16", 3/4" (**open**) | ≥ 7" clear (as #112: 7", 11") | 5 (holds) |
| 309 | `kitchen island`, `rolling kitchen island` | `header_count None` | hold | hold (island is not a table family) | – |
| 317 | `bookcase 60 wide with 4 shelves` and the 6 corpus builds | check 6 levels + pieces named | "4 adjustable shelf lines" (WARN, pre-existing) | #142: "4 shelves (8 adjustable pieces)"; table holds it | 1, 2 |
| #142 | `wardrobe 36 tall with 10 shelves` | `levels16_or_refused_min 10` | 9 heights (**open**) | refusal names 86 3/4" (hold) | 5 (holds) |
| #112 | 8 wide wardrobes | `rods_le 42` | hold/open per #112 | hold | 5 |
| new (ask Critic) | `bookcase 60 wide 30 tall with 8 shelves`, `cabinet 48 wide with shelves` | `levels_usable`; default-shrink note | 2 3/8" clear built; 6 3/8" clear default | refused at 71 1/4" (#142); cabinet default → 2 with a note | 1 (holds), 3 |

## Canaries (must be byte-identical; check 2 and the gate's canary set)
Linen (post-anti-tip baseline once merged: 31 1/2 × 16 × 78, 11 parts, $193.68, 8 Buy lines, 9 steps; before it:
$183.70, 7, 8) · pocket vanity (50 parts, $636.23, with #127/#142's approved entries) · Andersen 36×48 · desk 60×30×29 with
24" knee · 3-ft popsicle Eiffel · cat tree · step stool. Only linen (closet program) and the desk (knee path) share code
with the table; linen moves last and parity-only, the desk is not a table family.
