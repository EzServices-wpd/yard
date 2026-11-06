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
Seen by: Critic NR-1 probe tests A and D (scripts/nr1.critic.test.ts on critic/nr1-head).

## 2026-11-06 | Digit count of feet read as a size (pre-existing on release)

"coffee table with 4 feet" → 48" wide, "side table with 3 feet" → 36×36, "table with 4 foot legs" → 48×36,
"bookcase with 2 foot shelves" → 24" tall. Release reads these this way; NR-1 r5 fixed only the spelled forms
("four feet") because NR-1 is the reader of spelled sizes. Fixing the digit forms moves release builds, so it needs
its own mover list.
