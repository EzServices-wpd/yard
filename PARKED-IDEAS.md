# Parked ideas

Unsolved items from a round. Each needs its own class, its own round and its own regrade.

## 2026-11-06 | "<host> with Shelf" ignores the typed size (class F, pre-existing on release)

"1 shelf" or "an open shelf" (and "N foot shelves") next to a size that is not plain digits switches the build to a
"<host> with Shelf" family that drops the typed width and adds a shelf unit beside it. Before the card-1 ship, release did this
(75 of the Critic's 712 NR-1 probe prompts ended in a "with Shelf" build); NR-1 only routes more spellings into it.
Examples from before that ship (release and NR-1 r5 alike):
- "desk 4 ft wide with an open shelf" → 84" wide, $363.48 (digits "desk 48 wide with an open shelf" → 48", $318.56)
- "media console 3 ft wide with 1 shelf" → 72" wide (digits → 36")
- "nightstand 2 1/2 ft wide with 1 shelf" → 66" wide (digits → 30")
Class to write: a typed size is kept by every class F feature build (I41 "the feature picked the build" holds).
Update 2026-11-06: the card-1 hosts fix has shipped via #238/#239/#240. Engine `f1e7472a930dd929b31c6f92510bddd8adba43bf` from `ship/card1-any-size` (plain release merge `e04795ae0d83af1375d2e3dcf12e45345bd19246`; mover-folder tip `4dc2add4` was not merged). Squash #239 is main `3cb578532eb00e5627e2d363ab9616452df3a70b`. Merge-back #240 is release `b0bdccff09bdee04ca64feb70d41cfd9bc642347`. Critic headline: "desk 4 ft wide with an open shelf" builds as the typed-size desk matching the digit twin. Other hosts ("coffee table with an open shelf") remain parked. Scope note from the grade (not a blocker): size-after, comma-before-shelf, and non-CARD1 hosts still Combined, same as the graded tip (`deabae9d`).
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
