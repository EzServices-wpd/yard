# Parked ideas

Unsolved items from a round. Each needs its own class, its own round and its own regrade.

## 2026-11-06 | "<host> with Shelf" ignores the typed size (class F, pre-existing on release)

"1 shelf" or "an open shelf" (and "N foot shelves") next to a size that is not plain digits switches the build to a
"<host> with Shelf" family that drops the typed width and adds a shelf unit beside it. Release does this today
(75 of the Critic's 712 NR-1 probe prompts end in a "with Shelf" build); NR-1 only routes more spellings into it.
Examples (release and NR-1 r5 alike):
- "desk 4 ft wide with an open shelf" → 84" wide, $363.48 (digits "desk 48 wide with an open shelf" → 48", $318.56)
- "media console 3 ft wide with 1 shelf" → 72" wide (digits → 36")
- "nightstand 2 1/2 ft wide with 1 shelf" → 66" wide (digits → 30")
Class to write: a typed size is kept by every class F feature build (I41 "the feature picked the build" holds).
Update 2026-11-06: fix for the card 1 hosts is on branch `class-card1-any-size` (f1e7472, mover folder 4dc2add): 213
price-downs, 0 ups; sent to Critic after #225 landed; waiting for PASS/BLOCK. Other hosts ("coffee table with an open shelf") stay two products by row 570.
Seen by: Critic NR-1 probe tests A and D (scripts/nr1.critic.test.ts on critic/nr1-head).

## 2026-11-06 | Digit count of feet read as a size (pre-existing on release)

"coffee table with 4 feet" → 48" wide, "side table with 3 feet" → 36×36, "table with 4 foot legs" → 48×36,
"bookcase with 2 foot shelves" → 24" tall. Release reads these this way; NR-1 r5 fixed only the spelled forms
("four feet") because NR-1 is the reader of spelled sizes. Fixing the digit forms moves release builds, so it needs
its own mover list.

## 2026-11-06 | Stool with a feature word drops a size typed with a unit mark (pre-existing on release)

"stool 24 wide with two drawers" builds 24" wide, but "stool 24\" wide with two drawers" and "stool 24 inches wide
with two drawers" build 18" (also "stool 18\" deep with three shelves" → 16" deep). Without the feature words the
size holds. 14 of 2,044 spelling pairs in the #225 mover sweep. Its own class: the stool path reads a marked size only
without features.

## 2026-11-06 | Refusal says "A linen needs at least ..." (user-facing wording, pre-existing)

"linen cabinet 24 tall with three shelves" refuses with "A linen needs at least 32 1/2\" tall for 3 shelves ...".
The host word should be "linen cabinet". Wording change: needs Ezra's yes.
