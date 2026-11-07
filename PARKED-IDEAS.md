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
Update 2026-11-06 15:05 ET: this class is being attempted now (lock held on the feature branch; not merged, not graded). Checked on release `80c3e765` first. The pre-CARD1 examples in standard order already match their digit twins there: "media console 3 ft wide with 1 shelf" is 36" (not 72"), "nightstand 2 1/2 ft wide with 1 shelf" is 30" (not 66"), and "coffee table 4 ft wide with an open shelf" matches "coffee table 48 wide with an open shelf" (both Combined, 84" × 48" × 18"). What still dropped the typed axis was a separator comma (and a size after the shelf when a comma sits in front of the size) for spellings the release comma reader misses: "thirty inches", "four feet", "six feet", "762 mm", "1829 mm", on every host including CARD1. Size-after with no comma already matched the digit twin and stays Combined, which the card-1 pin requires ("vanity with an open shelf 30 wide"). The host allow-list is not being extended: "tv console" / "bedside table" stay Combined when their digit twins are Combined.
Update 2026-11-06: shipped via #245 / #246 / #247. Yard Critic PASS on exact head `d47dc17c8b84012fbe8de8073496db7d7c6ce24a` vs then-release `80c3e765`, lean bar, canaries byte-identical, CARD1 host list unchanged. Plain merge #245 is release `ec37c4c8248abaa72d9e1a555271861083ab71be`. Squash #246 is main `eb082af6a014115fc574598c9fca22393ddf40f9`. Merge-back #247 is release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`. Production READY for that main SHA (`dpl_CghbaV74qwH6gzTB1a7xPvRYyyxc` / yard-if6j79v6x, aliases include yard.wiki).

## 2026-11-06 | Digit count of feet read as a size (pre-existing on release)

"coffee table with 4 feet" → 48" wide, "side table with 3 feet" → 36×36, "table with 4 foot legs" → 48×36,
"bookcase with 2 foot shelves" → 24" tall. Release reads these this way; NR-1 r5 fixed only the spelled forms
("four feet") because NR-1 is the reader of spelled sizes. Fixing the digit forms moves release builds, so it needs
its own mover list.
Update 2026-11-06 16:18 ET: in progress on PR #248 (lock held on the feature branch; not merged, not graded). The one reader skips a digit before feet/foot the same way it skips the spelled number, unless an axis word follows. Checked on release `b5442bef` first. After the change the headlines match their spelled twins: "coffee table with 4 feet" is 40×40×18, "side table with 3 feet" is 20×20×22, "table with 4 foot legs" is 40×40×30, "bookcase with 2 foot shelves" is 36×12×84. "2 feet wide" / "4 feet tall" / "6 foot shelf" stay sizes. Mover list: `scripts/baselines/approvals/digit-feet/`.
Update 2026-11-06: shipped via #248 / #249 / #250. Yard Critic PASS on exact head `a2e8170ee0878c91ff4c884ce0731855e9f5b727` vs then-release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`, lean bar (model, steps, parts). Plain merge #248 is release `94a7e50bbbe6f657808d1bbf1768d5624cfb6437`. Squash #249 is main `333ba25bb31f5085a96e44668e258828534f0a5b`. Merge-back #250 is release `104075e45583b7a82b77d6d30cb90c09df5e70de`. Production READY for that main SHA (`dpl_7uT1q7YuuaDgoYNSx67dGzKFeF21` / yard-d2cp6x7kp, aliases include yard.wiki).

## 2026-11-06 | Stool with a feature word drops a size typed with a unit mark (pre-existing on release)

"stool 24 wide with two drawers" builds 24" wide, but "stool 24\" wide with two drawers" and "stool 24 inches wide
with two drawers" build 18" (also "stool 18\" deep with three shelves" → 16" deep). Without the feature words the
size holds. 14 of 2,044 spelling pairs in the #225 mover sweep. Its own class: the stool path reads a marked size only
without features.
Update 2026-11-06 17:17 ET: in progress on PR #251 (lock held on the feature branch; not merged, not graded). Checked on release `104075e4` first. The note's "without the feature words the size holds" is not what this tip does: `stool 24" wide` is also 18" wide. The chair on the same seat reader drops the mark the same way (`chair 20" wide` is 18"). Height already kept an inch mark. Bench, table, and desk already kept a marked width. The seat reader now uses the one length reader, so a unit mark matches the bare twin (name, overall, steps, Buy names and quantities). A comma and a hyphenated `N-inch` stay release's read. Mover list: `scripts/baselines/approvals/stool-unit-size/`.
Update 2026-11-06: shipped via #251 / #252 / #253. Yard Critic PASS on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`, lean bar (model, steps, parts). Squash #252 is main `ea287eb75361fbfa3a13354257cd84ee0f84048b`. Merge-back #253 is release `c230ab55348aa963937de462a6eb162460a41a1e`. Production READY for that main SHA (`dpl_5ypakZABbcku8KrdqHTfkUhSfQjh` / yard-ds1vwu7ep, aliases include yard.wiki).

## 2026-11-06 | Equal clear bays on an auto-divided shelf (pre-existing on release)

A long shelf span that the span pass divides into 3 or more bays gave wider end bays than the middle. Divider thickness was subtracted to choose the bay count, then the centres split the whole run, so each end bay was wider by half the divider. On release `c230ab55`: `closet 72 wide` was 23 1/8, 22 3/4, 23 1/8; `cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood` was 13 5/16, 13 1/16, 13 5/16 (an older note of about 13 5/12, 13 1/6, 13 5/12 is not this tip).
Update 2026-11-06 18:16 ET: in progress on PR #254 (lock held on the feature branch; not merged, not graded). Centres now use the equal clear bay. Closet 72 is 23, 23, 23 and fills 70 1/2". The cabinet is 13 1/4, 13 1/4, 13 1/4 and fills 40 3/4". A two-bay split and builder `Bay divider` layouts stay as they were. Mover list: `scripts/baselines/approvals/equal-bays/`.
Update 2026-11-07: shipped. Main `e25b82d4f0f96df9619e1324a6e33d829b1d6013` (#255). Release merge-back #256 is `94cc8d6589c42c77fe054111b582af912113f20a`. Do not reopen it. This note does not add a Critic PASS.

## 2026-11-07 | Potting-bench lower shelf is a pin step, and the structure check calls it floating

"potting bench with a lower shelf" builds four legs, two aprons, a top, and a Lower shelf. The builder note says to glue and screw that shelf into the leg faces. The live structure check reports the shelf floating. The step says "Pin 1 adjustable shelf". Seen while lifting the shadow build graph. Not fixed there. Its own class, if Ezra wants it: a shelf asked for between the legs is a fixed shelf on a declared joint, and the structure check agrees.
Update 2026-11-07: construction knowledge did not declare a joint for that shelf. The shelf does not meet the legs, so the graph has no contact for it either. The three-way contradiction is copied onto the shadow graph as a parked constraint. Still not fixed.
Update 2026-11-07 06:48 ET: shadow fastener demand did not fix it. The shelf is still not a reviewed joint, so it still does not add a screw. The live Buy screw line for that bench is the contact butts, and the shadow compile does not copy it. The contradiction stays.
Update 2026-11-07 07:13 ET: the #263 r1 ledger fix did not touch this shelf. Still parked.

## 2026-11-07 | Held-out evaluation findings (not this round)

Still parked. The #263 r1 block was a shadow-ledger fix, not one of these, and this round did not investigate them:
- cardboard bunk bed for a child
- missing lift-up seat
- glass doors as solid plywood
- charging valet / kamado placeholders
- extra wardrobe pulls
- media-console joint and span issues

The potting-bench lower shelf is the note above. "A linen needs…" still needs Ezra's yes.

## 2026-11-06 | Refusal says "A linen needs at least ..." (user-facing wording, pre-existing)

"linen cabinet 24 tall with three shelves" refuses with "A linen needs at least 32 1/2\" tall for 3 shelves ...".
The host word should be "linen cabinet". Wording change: needs Ezra's yes.
