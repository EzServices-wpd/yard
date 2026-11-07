LOCK: Cursor Agent | item: shadow fastener demand | started: 2026-11-07 06:44 ET | status: in-progress

# Claude progress log

Shared log for the Yard bot team. Lives on `release/2026-10-24`. Always pull this branch before reading it. Cold start: read `docs/BOT-LOAD.md` first (queue, state, every standing rule).

## Lock

The first line of this file is the push lock. One active pusher at a time.

- Free: `LOCK: none`
- Held: `LOCK: <bot> | item: <short name> | started: <YYYY-MM-DD HH:MM ET> | status: in-progress`

To push: pull `release/2026-10-24` → if the lock is held, wait → otherwise write your lock line, commit and push it → only then start the change. Clear it (back to `LOCK: none`) after the regrade on the new main confirms canaries are still byte-identical.

## Rules

- Only items with an explicit Critic PASS entry below are eligible to push. No entry, no push.
- One at a time: `release/2026-10-24` → squash PR to `main` → merge `main` back. No rebase, no force-push, no direct commits to `main`.
- After each landing, regrade on the new `main` and confirm canaries are byte-identical before the next. On any failure: stop, revert that one, move it to PARKED-IDEAS. For the #235 ship, the canary check on record is Critic's r5 grade (unchanged vs then-release `afcb1f8b`); do not open a second main regrade for it, and do not block the approved queue on one. For #239, no post-merge main regrade was recorded; the CARD1 Critic PASS was vs then-release `deabae9d` / then-main `cf05d769` (model, steps, parts). Do not invent a second main regrade for it, and do not block the approved queue on one.
- Grade the model, the steps, and the parts (correct items and quantities). A price total that follows the catalog from those parts is not its own grade: no dollar-delta card, and no Ezra yes on a price-up list. Wrong Buy items or quantities still block. User-facing wording still needs Ezra's yes. Never loosen a pinning test without Ezra's yes.
- Hands off Vercel settings and env vars.

## Critic PASS entries

Whoever runs the Critic pastes the short PASS summary here right after the grade.

Format: `- <YYYY-MM-DD> | <item> | PASS | <one-line summary> | moves price/part size: yes/no | verdict: <path or link>`

- 2026-11-06 | stool plus a feature word keeps a unit-marked size (exact head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`) | PASS | Yard Critic on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`, lean bar (model, steps, parts). A width or depth on a stool, or the chair on the same reader, keeps a unit mark (`24"` and `24 inches` match `24`). | moves price/part size: yes (catalog follows the parts; no price card) | verdict: Yard Critic grade (no verdict path recorded)
- 2026-11-06 | digit count of feet not a size (exact head `a2e8170ee0878c91ff4c884ce0731855e9f5b727`) | PASS | vs then-release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`, lean bar (model, steps, parts). A digit before feet/foot is not a size when with/on/and/has/plus comes before it or a part noun follows, unless an axis word follows. Headline prompts match their spelled twins. | moves price/part size: yes (catalog follows the parts; no price card) | verdict: Yard Critic grade (no verdict path recorded)
- 2026-11-06 | class F typed size beside a shelf on every host (exact head `d47dc17c8b84012fbe8de8073496db7d7c6ce24a`) | PASS | vs then-release `80c3e7655194c89bacd741e55097531e20f0c93e`, lean bar (model, steps, parts only). Canaries byte-identical. CARD1 host list unchanged. A typed axis beside `1 shelf` / `an open shelf` is kept on every host, including comma, spelled, and metric axes. | moves price/part size: yes (typed size kept to match the digit twin; no price card) | verdict: Yard Critic grade (no verdict path recorded)
- 2026-11-06 | CARD1 any-size spelling (`ship/card1-any-size`, code `f1e7472a930dd929b31c6f92510bddd8adba43bf`) | PASS | vs then-release `deabae9d818a04a59bbd99104456df485eed0f88` / then-main `cf05d769fee45089ce5ac70e2dd45343515667a9`, lean bar (model, steps, parts only). Zero blockers. No price card. Headline: "desk 4 ft wide with an open shelf" builds as the typed-size desk matching the digit twin. Scope note (not a blocker): size-after, comma-before-shelf, and non-CARD1 hosts still Combined, same as that tip. | moves price/part size: yes (typed size kept to match the digit twin; no price card) | verdict: Yard Critic grade (no verdict path recorded)
- 2026-11-06 | NR-1 r5 (#225, head `fc7de9efb98af31f9ae3324df177384d8bbebf7f`) | PASS | vs then-release `afcb1f8b` ~9:24 AM ET, lean bar (model, steps, parts only). Zero blockers. Digit forms ("with 4 feet") parked (= release). Axis forms still sizes. 0 movers drop a typed size release honoured. 35/35 new refusals match their digit twins. Canaries unchanged. eval-gate Δ 0. Tests 2116/2116. No loosened tests. | moves price/part size: yes (catalog follows the parts; no dollar-delta card) | verdict: Critic grade 2026-11-06 ~9:24 AM ET (no verdict path recorded)

## Landings

Format: `- <YYYY-MM-DD HH:MM ET> | <item> | PR #<n> | main <sha> | regrade: canaries identical yes/no | by <bot>`

- 2026-11-06 18:16 ET | stool plus a feature word keeps a unit-marked size (squash of release after #251) | PR #252 | main `ea287eb75361fbfa3a13354257cd84ee0f84048b` | regrade: Critic PASS was on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85` (no separate post-merge main regrade recorded in this note); production READY `dpl_5ypakZABbcku8KrdqHTfkUhSfQjh` (yard-ds1vwu7ep, aliases include yard.wiki). Merge-back #253 `c230ab55348aa963937de462a6eb162460a41a1e` | by YARD Chief
- 2026-11-06 17:11 ET | digit count of feet not a size (squash of release after #248) | PR #249 | main `333ba25bb31f5085a96e44668e258828534f0a5b` | regrade: canaries identical yes — Critic PASS on exact head `a2e8170ee0878c91ff4c884ce0731855e9f5b727` vs then-release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`; production READY `dpl_7uT1q7YuuaDgoYNSx67dGzKFeF21` (yard-d2cp6x7kp, aliases include yard.wiki) | by YARD Chief
- 2026-11-06 15:52 ET | class F typed size beside a shelf on every host (squash of release after #245) | PR #246 | main `eb082af6a014115fc574598c9fca22393ddf40f9` | regrade: canaries identical yes — Critic PASS on exact head `d47dc17c8b84012fbe8de8073496db7d7c6ce24a` vs then-release `80c3e765`; production READY `dpl_CghbaV74qwH6gzTB1a7xPvRYyyxc` (yard-if6j79v6x, aliases include yard.wiki) | by YARD Chief
- 2026-11-06 10:31 ET | CARD1 any-size spelling (squash of release after #238) | PR #239 | main `3cb578532eb00e5627e2d363ab9616452df3a70b` | regrade: no separate post-merge canary check recorded (Critic PASS was vs then-release `deabae9d` / then-main `cf05d769`) | by YARD Chief
- 2026-11-06 09:36 ET | NR-1 r5 one length reader (squash of release after #225) | PR #235 | main `cf05d769fee45089ce5ac70e2dd45343515667a9` | regrade: canaries identical yes — Critic's r5 grade found canaries unchanged vs then-release `afcb1f8b`; no separate post-merge main regrade | by YARD Chief

## Session notes

Newest first. Tip, canary status, the rule per change, before/after prompts, files, tests, parked items.

### 2026-11-07 07:30 ET | #263 r2 parked hole — thin dowel and thin polygon (Chief authorized)

- Yard Critic BLOCK on #263 r2, head `a544fd24defd16876b049276abce2437df296ebb`, vs release `6ef07183c7ca20c0aec85b581df54affbf9b993e`. r1 holes stayed closed. The remaining hole was parked. Chief authorized this round. Same branch. Not graded. Not merged. Do not merge.
- Live `panelJoints` skips a pair, before it counts screws, when either part is thinner than 1/2" and is not a thin sheet. A thin sheet is thinner than 1/2", not a dowel, and has no polygon. A 1/4" dowel and a quarter-inch back with a polygon are that skip. The shadow ledger checked hardware, planed stock, and a non-back thin sheet, and then counted a butt. It now records `thin-not-sheet` and zero screws before the positive count. The reviewed joint stays on the graph.
  - Perch, `dowel-1-4-36`, at (0.5, 4, 2), size 8×0.25×0.25, mortised into a 3/4" upright: was 2 screws / 1 box `screws-8`, meeting butt, no reason. Now 0, `thin-not-sheet`, both orders. Live `panelJoints` is `[]`.
  - Shaped Back, `plywood-1-4-4x8`, type back, at (0.5, 4, 0), size 8×0.25×20, with an xz polygon: legal quarter-inch back. Was 3 screws / 1 box `screws-8`, meeting butt, no reason. Now 0, `thin-not-sheet`, both orders. Live `panelJoints` is `[]`. The 0.25" overlap cutoff was not restored.
- Still holding: wide thin back and the narrow back edge at 12; planed 1/2" shelf and the A-frame bracket at 0, joints kept; native 1/2" sheet at 3; one 400" pair 50 and both directions 50; two pairs 100; birdhouses 2 `outdoor-screws`; chicken coop 12 `outdoor-screws` / 1 box, structural line copied, hinges none; 20" housed end 3; 32×8 lap 4. The seven compile-back families still derive no screws.
- `generateFromPrompt` and `buildPlan` still do not call the graph. `modelJoints.ts` and `lengthReader.ts` not edited. No AI reader. No new CI gate. `approved-canary-changes.json` not edited. User-facing wording not changed. This note does not record a canary re-run.
- Files: `src/lib/yard/buildContract.ts`, `src/lib/yard/buildContract.test.ts`, `CLAUDE-PROGRESS.md`, `PARKED-IDEAS.md`, `docs/BOT-LOAD.md`.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` 29/29. `npx tsc --noEmit` pass. `npx eslint` on `buildContract.ts` and `buildContract.test.ts` pass.
- Still parked, not this fix: potting-bench lower shelf; cardboard bunk bed for a child; missing lift-up seat; glass doors as solid plywood; charging valet / kamado placeholders; extra wardrobe pulls; media-console joint and span issues. "A linen needs…" still needs Ezra's yes.

### 2026-11-07 07:13 ET | #263 r1 block — fastener ledger (same branch, not parked)

- Yard Critic BLOCK on #263 r1, head `80396b8537a3fa2c41a4f9aaf17221b4f1ad8728`, vs release `6ef07183c7ca20c0aec85b581df54affbf9b993e`. Same branch. Not graded. Not merged. Do not merge. Not parked.
- The shadow ledger now has one row per physical reviewed shop pair. a→b and b→a count once. Each row carries the meeting class, a no-screw reason when the pair buys none, and the screw item follows the build name.
  - B1: a thin sheet named as a back takes a screw every 8" of the long edge, including when the face is wider than 3". The wide rabbet (side 48×96×0.75, Back 48×96×0.25, both at the origin) was 72 screws / 2 boxes and is now 12 / 1 box, both part orders. Live `panelJoints` calls that pair a back and counts 12. The narrow back-edge rabbet (upright 0.75×96×12, Back at (0.5, 0, 11.25)) stays 12.
  - B2: a part under 3/4" planed thinner than its stock is glue-only, except a named back and a full-thickness 1/2" sheet. The planed 1/2" shelf in 3/4" stock still lifts as a housed-dado and now buys no carcass screws. Live `panelJoints` is empty and live `buildPlan` has no carcass-screw line. A reviewed shop pair with purchased `A-frame bracket 1` buys none. The joint stays on the graph. Contact still adds none.
  - B3: host 0.75×10×400 and shelf 8×0.75×400 is 50 screws / 1 box. Both directions of that pair stay 50 / 1 box. Two distinct pairs stay 100 / 2 boxes.
  - B4: `birdhouse` and `outdoor birdhouse` each have one reviewed miter and now buy `#8 x 1-1/4" exterior-coated or stainless wood screws` (`outdoor-screws`), 2 screws / 1 box. The live line is the same item and is 30 contact screws; that count is not copied. `chicken coop` has six notches and two hinges, derives 12 screws / 1 box of `#8 x 2-1/2" exterior-coated or stainless wood screws`. The live exterior line is 3 boxes (149 contact screws). The structural-screw line stays copied. Hinges add no carcass screws.
- Kept: a 20" housed end is 3 screws / one box of `#8 x 1-1/4"`. A 32" × 8" lap is 4. The seven compile-back families still derive no screws. Their live contact screw boxes stay unrestored. Graph-level glue and screwless stock still derive none. Sheet goods, lumber, glue, pins, hinges, pulls, anti-tip, and step wording stay copied.
- `generateFromPrompt` and `buildPlan` still do not call `liftBuildGraph`, `compileBuildGraph`, `reviewedFastenerUses`, `fastenerBuyLines`, or `fastenerDemandLedger`. `modelJoints.ts` and `lengthReader.ts` not edited. No AI reader. No new CI gate. `approved-canary-changes.json` not edited. User-facing wording not changed. This note does not record a canary re-run.
- Files: `src/lib/yard/buildContract.ts`, `src/lib/yard/buildContract.test.ts`, `CLAUDE-PROGRESS.md`, `PARKED-IDEAS.md`, `docs/BOT-LOAD.md`.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` 28/28. `npx tsc --noEmit` pass. `npx eslint` on `buildContract.ts` and `buildContract.test.ts` pass.
- Parked, not this fix: potting-bench lower shelf; cardboard bunk bed for a child; missing lift-up seat; glass doors as solid plywood; charging valet / kamado placeholders; extra wardrobe pulls; media-console joint and span issues. "A linen needs…" still needs Ezra's yes.

### 2026-11-07 06:48 ET | shadow fastener demand — in progress (lock held)

- Construction knowledge and substitution is on main `10f776525411543ea0fc7d2d13c421d49f3a7c04` (#261) and release `6ef07183c7ca20c0aec85b581df54affbf9b993e` (#262, merge-back of #260). Do not redo it. This note does not record a Critic PASS or a deployment id for that ship. Its lock rode in on the merge-back. Replaced on this feature branch only. Lock commit `5cd8a13a16e1be54d4a503d4daccbf16d97da062`.
- New lock: shadow fastener demand. Not graded. Not merged. PR #263 into `release/2026-10-24`. Do not merge.
- Hypothesis held. `compileBuildGraph` was copying `graph.stock`, and `liftBuildGraph` had copied that from the live Buy. Carcass-screw lines are no longer copied. `reviewedFastenerUses` counts screws from reviewed shop joints only (dado, rabbet, lap, mortise, miter, notch). The schedule is the live one, read off the parts on the graph: one screw per 64 sq in when the meeting is wider than 3", otherwise every 8" of the long edge, and never fewer than 2. It does not call `panelJoints`. A hinge adds no carcass screws. Contact adds none. Glue-only stock, and a material whose joins are not screws or nails, adds none. The Buy line is a box of 50 (`screws-8`), named with that stock's face-screw length. Sheet goods, lumber, glue, shelf pins, hinges, pulls, anti-tip, and step wording stay the live compiler's, including a step's `fastenersUsed`. Part ids on those lines are unchanged.
- Compile-back, checked against the live Buy fastener line. None of these graphs has a reviewed joint, so the derived screw list is empty. Contact was present on every one and added no screws.
  - `bookcase 36 wide 84 tall 12 deep`, the same prompt in 3/4" plywood, and `from oak`: live Buy still has 1 box of `#8 x 1-1/4" wood screws` (44 screws, butts and back edges). The shadow Buy does not copy that line. The 1/4" back stays. 3/4" sheets or oak 1×4, pins, glue, and the anti-tip kit stay. The default and the 3/4" prompt have the same live screw line.
  - The same bookcase in 1/2" plywood: live line is 1 box of `#8 x 1" wood screws` (33 screws). Derived none. The 1/2" sheets and the 1/4" back stay.
  - `potting bench with a lower shelf`: live line is 1 box of `#8 x 2-1/2" wood screws` (28 screws, 10 butts). Derived none. The plywood sheet, the 2×4s, and the glue stay.
  - `eiffel tower` and `eiffel tower from toothpicks`: glue, miniature, 0 reviewed joints. Live Buy has no wood-screw line. Derived none. Those two lists match. Sticks and wood glue stay.
- A housed end 20" long derives 3 screws, one box of `#8 x 1-1/4"`. A 32" × 8" reviewed lap derives 4. A screw quantity sitting on the lifted stock is ignored. Adding a contact joint does not change the count. A hinge joint does not add screws. Glue, and popsicle stock, derive none.
- `generateFromPrompt` and `buildPlan` still do not call `liftBuildGraph`, `compileBuildGraph`, `reviewedFastenerUses`, or `fastenerBuyLines`. The graph is not the live source of truth. `YARD_AI_READER` / `VITE_PUBLIC_AI_READER` / `VITE_PUBLIC_YARD_AI_READER` not turned on. No AI planner. No AI Buy list. `lengthReader.ts` not touched. `modelJoints.ts` not edited. No new CI gate. `approved-canary-changes.json` not edited. 1/4" plywood still throws unless it is a back or a drawer bottom. User-facing wording not changed. This note does not record a canary re-run. The live compiler was not edited.
- Files: `src/lib/yard/buildContract.ts`, `src/lib/yard/buildContract.test.ts`, `CLAUDE-PROGRESS.md`, `PARKED-IDEAS.md`, `docs/BOT-LOAD.md`.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` 24/24. `npx tsc --noEmit` pass. `npx eslint` on `buildContract.ts` and `buildContract.test.ts` pass.
- Parked, not started: the potting-bench lower shelf (glue-and-screw note, floating structure check, pin-shelf step). Held-out findings stay parked: cardboard bunk bed for a child, missing lift-up seat, glass doors as solid plywood, charging valet / kamado placeholders, extra wardrobe pulls, media-console joint and span issues. "A linen needs…" still needs Ezra's yes.

### 2026-11-07 04:10 ET | #260 r5 block — a moving part and bought hardware are not dados

- Yard Critic BLOCK on #260 r5, head `84468c7691f60ac812cd69c109e48ab546cd76f3`, vs release `6de4631859fbfd7eb467e60c48b312abc60c5715`. The r4 band lift stayed fixed. Same branch. Not graded. Not merged. Do not merge.
- `housedReadings` asked only the geometric reader. A rail with `turns` (Pivot arm, bored 1/16" over its pin) and a purchased `A-frame bracket 1` both sit inside the insertion and transverse bands, so the reader called them housed-dados. `panelJoints` already leaves those out: a part that turns takes no screws, and `isBoughtHardwareName` is not a wood end. That live file was not edited.
- The geometric reader now refuses a pair when either part turns, is hinged, or is purchased hardware. `readingForPanels` and the lift share that check. The same stationary wood, without `turns`, still lifts as a dado. Mirrors, thin backs, and glue housings are not in this exclusion. The 0.25" screw-overlap filter was not restored.
- Potting-bench lower shelf stays parked and disclosed. Not fixed. Live path not edited. This note does not claim a new canary check.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on the three graph files pass.

### 2026-11-07 03:55 ET | #260 r4 block — a housed end is not gated on the screw finder

- Yard Critic BLOCK on #260 r4, head `55674ad2b6fea30e7f98f931c61d473281c11af8`, vs release `6de4631859fbfd7eb467e60c48b312abc60c5715`. The r3 edge-butt and 1.5" face entry stayed fixed, as did the 13 r2 fixtures and B1/B2. Same branch. Not graded. Not merged. Do not merge.
- `readingForPanels` already returned housed-dado for an ordinary 3/4" shelf at (0.625, 9.875, 0), size 8 × 0.75 × 8, into an upright at (0, 0, 0), size 0.75 × 10 × 8. Overlaps 0.125 / 0.125 / 8: insertion 0.125" is inside the more-than-1/16" and at-most-0.8" band, and both face directions overlap by more than 1/16". `liftBuildGraph` emitted no joint. `contactJoints` only asked the reader about pairs from `panelJoints`, and `panelJoints` skips a pair when another axis overlaps by under 0.25". That cutoff is the live screw-Buy finder. It was not edited.
- The shadow lift now also asks `housedOnEnteredFace` about panel pairs the screw finder did not list. A pair already recorded as contact or a declaration is left alone. Nothing is added unless that reading matches, so an edge butt stays contact and a pair the reader rejects is not invented as contact. Buy quantities and the live compiler are unchanged.
- The fixture above lifts to a reviewed housed-dado in both panel orders and all three axis cycles. The top-edge butt still lifts as contact. The 1.5" face entry still lifts as a dado.
- Potting-bench lower shelf stays parked and disclosed. Not fixed. Live path not edited. This note does not claim a new canary check.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on the three graph files pass.

### 2026-11-07 03:38 ET | #260 r3 block — an entered face is the face, not the thinnest side

- Yard Critic BLOCK on #260 r3, head `0e6d94b1de7ff87b74ebe2516e6b3de80d4714fb`, vs release `6de4631859fbfd7eb467e60c48b312abc60c5715`. The 13 r2 fixtures stayed fixed. Same branch. Not graded. Not merged. Do not merge.
- Two holes, one rule. `housedOnEnteredFace` only tried the host's thinnest axes, and it never required the part to overlap the rest of that face. A shelf sitting on the top edge of a 3/4" upright (overlaps 0.25 / 0 / 8) was called a dado. A shelf end 0.5" inside the 1.5" face of an upright whose stock thickness is 0.75" on another axis was missed.
- A housed end is now any host face the end enters, not only the minimum-size side. Both directions of that face have to overlap by more than 1/16", so an edge touch stays contact. Insertion is still more than 1/16" and at most 0.8". `endEnters`, `facesCross`, and housed-before-lap are unchanged. An end that reaches the far face, and a middle overlap with both ends outside, stay unreviewed.
- The top-edge butt stays contact through the lift, in both argument orders and all three axis cycles. The 1.5" face entry is a dado under the same cycles. The 13 r2 fixtures, the cubby family (0 reviewed, rails stay contact), the 0.25" divider end, the upright end, and the mutual crossing are unchanged.
- Potting-bench lower shelf stays parked and disclosed. Not fixed. Live path not edited.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on the three graph files pass. Weekend canaries 6/6 unchanged. `walk-canary.ts` linen 31.5×78×16 and pocket green. linen-check PASS.

### 2026-11-07 03:25 ET | #260 r2 block — a thin part does not hide the face it entered

- Yard Critic BLOCK on #260 r2, head `d50003c80e47cd457ed6510967bcd29243acc18f`, vs release `6de4631859fbfd7eb467e60c48b312abc60c5715`. B1 and B2 of r1 stayed fixed. Same branch. Not graded. Not merged. Do not merge.
- The miss was one axis choice. `readingForPanels` kept only the smallest overlap. When the part is thinner than how far it enters, that smallest overlap is the part's own thickness, and the host face actually entered was never tried. A half-inch shelf 0.625" into a 3/4" upright, a 1/4" back or mirror 0.5" into that upright, and the same geometries after a cyclic swap of the axes, all came back undefined. A 1/4" back whose insertion equals its thickness still read as a rabbet unrotated and dropped after the swap, because the tie broke toward whichever axis was first.
- The entered face is now every host thickness, judged on its own overlap. Insertion still has to be more than 1/16" and at most 0.8". `endEnters` and `facesCross` are unchanged, and a housed end is still decided before a lap. An end that reaches the far face is not housed. A middle overlap with both ends outside is not housed.
- Still 0 reviewed joints: `cubby shelf 48 wide 36 tall 12 deep` and 40×36×12, 44×36×12, 52×36×12, 60×48×12, 48×48×16. Front rail / center support pairs stay contact. The shelf end 0.25" into a divider is still a dado, the same end in an upright is still a dado, and a mutual crossing is still a lap.
- Potting-bench lower shelf stays parked and disclosed. Not fixed. Live path not edited.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on the three graph files pass. Weekend canaries 6/6 unchanged. `walk-canary.ts` linen 31.5×78×16 and pocket green. linen-check PASS.

### 2026-11-07 03:10 ET | #260 r1 block — a housed end must enter, a lap must pass through

- Yard Critic BLOCK on #260 r1, head `0b1809f447a68a2fdceb1f041ad5df3f598085ea`, vs release `6de4631859fbfd7eb467e60c48b312abc60c5715`. Same branch. Not graded. Not merged. Do not merge.
- The other r1 claims held and were not reopened: live path isolated, hinge / miter / notch / mortise examples, plain bookcase and both Eiffels and the potting bench at 0 reviewed joints, `substituteStock`, compile rejecting an illegal 1/4" part, `projectBuildUse`, the seven compile-backs, canaries including linen 31.5×78×16.
- B1: `cubby shelf 48 wide 36 tall 12 deep` invented three housed-dados (Front rail / Front rail 2 / Front rail 3 into Center support 4 / 3 / 2). Each rail runs the full width and crosses the support's front. Neither rail end is inside the support. `Panel.joints` is empty. The base graph had 0 reviewed joints. The old predicate promoted an interior overlap from type and thin-axis alone.
- B2: a shelf end stopped 0.25" inside a divider (it does not reach the far face) was a cross-lap, because any all-axis overlap of a divider and a shelf was a lap and that test ran before the housed end. The same end in an upright was already a dado.
- Fix, on every pair, not on the cubby noun: a housed end (dado or rabbet) requires one end inside the host and the part leaving through only the other face. A lap requires each board to pass through the other's opposite faces, and it is not considered once an end is housed. After the fix the cubby prompt has 0 reviewed joints; those rail/support pairs stay contact. A housed shelf end in a divider is a dado. A divider and a shelf that each pass through the other stay a lap. A housed end in an upright stays a dado.
- Potting-bench lower shelf stays parked and disclosed. Not fixed.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on `buildContract.ts`, `buildContract.test.ts`, and `jointLibrary.ts` pass. Weekend canaries 6/6 unchanged. `walk-canary.ts` linen 31.5×78×16 and pocket green. linen-check PASS. `lengthReader.ts` not touched.

### 2026-11-07 02:49 ET | shadow build graph shipped; construction knowledge and substitution — in progress (lock held)

- Shadow build graph version 1 is on main `3966f67f2e2d071c3e0c7d420c5bbb558adec765` (#258) and release `6de4631859fbfd7eb467e60c48b312abc60c5715` (merge-back #259). Do not redo it. `generateFromPrompt` and `buildPlan` still do not read the graph. This note does not record a Critic PASS or a deployment id for that ship. The graph lock rode in on the merge-back. Replaced on this feature branch only.
- New lock: construction knowledge / substitution. Not graded. Not merged. PR #260 into `release/2026-10-24`. Do not merge.
- Declared joints, only where one of the seven library patterns already applies. Contact stays contact.
  - Became declared: a door `doorHingeLayout` already hangs, when `Panel.hinged` was not set, is a hinge to the upright on that edge (`bookcase with a door`, medicine-cabinet door). Two panels whose cut notes both say "bevel the ridge edge 45" are a miter (birdhouse roof panels). `Panel.joints` notch and mortise stay declared (chicken-coop floor, a seated perch) and are not also stored as contact. The r1 dado and lap readings were too loose; the 03:10 ET note is the rule that replaced them.
  - Stay contact: the plain bookcase (pin shelves are flush butts, the 1/4" back is a screwed back edge, not a rabbet, no reviewed joint). The Eiffel canary and the toothpick tower (glue, frame contact, 0 reviewed joints — no furniture joints on the stick model). A gable that only says "45° to a peak". A pin-hole cut note is not a mortise and not a dado.
- Stock substitution is a review of two lifted graphs, not a second compiler. `substituteStock` accepts the switch only when roles, envelope, and reviewed patterns hold, 1/4" backs and drawer bottoms stay, and Buy names the new stock instead of the old. Casework (3/4" plywood, 1/2" plywood, oak) keeps the role multiset and the 36×84×12 envelope. The towers keep the role set and an envelope within 1"; the stick count changes. The live stock-switch path does not go through the graph.
- Contract honesty: `useOf` is now `projectBuildUse` so it is not a React hook name. `compileBuildGraph` throws on a 1/4" plywood part that is not a back or a drawer bottom.
- Canaries on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green; linen-check PASS. `approved-canary-changes.json` not edited. `lengthReader.ts` not touched. No new CI gate. `YARD_AI_READER` / `VITE_PUBLIC_AI_READER` not turned on. No AI planner. No AI Buy list. No user-facing wording change.
- Files: `src/lib/yard/buildContract.ts`, `src/lib/yard/buildContract.test.ts`, `src/lib/yard/jointLibrary.ts`.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. `npx eslint` on those three files pass. Weekend canaries 6/6, walk-canary, linen-check pass.
- Parked, not started: the potting bench's lower shelf. The graph now copies the contradiction (glue-and-screw note, floating structure check, "Pin 1 adjustable shelf") and does not declare a joint. The shelf does not meet the legs, so it is not contact either. "A linen needs…" wording still needs Ezra's yes.

### 2026-11-07 02:01 ET | equal bays shipped; shadow build graph — in progress (lock held)

- Equal clear bays is on main `e25b82d4f0f96df9619e1324a6e33d829b1d6013` (#255) and release `94cc8d6589c42c77fe054111b582af912113f20a` (merge-back #256). Do not reopen it. The equal-bays lock rode in on that tip. Replaced on this feature branch only. No new Critic PASS is recorded here. Ezra: that ship is live. This note does not record a deployment id.
- New lock: shadow build graph. Not graded. Not merged. PR #257 into `release/2026-10-24`. Do not merge.
- What the graph is: `YardBuildGraph` version 1 (`src/lib/yard/buildContract.ts`) is a shadow fact graph lifted from a finished project and the plan the deterministic compiler already wrote. It holds parts, joints, constraints, operations, and stock requirements. `compileBuildGraph` reads that graph and nothing else (no prompt, no second length reader) and emits model, steps, and Buy. `generateFromPrompt` and `buildPlan` do not read it. It is not the live source of truth, and it does not build anything out of anything.
- StructureGraph stays the lattice generator. Checked: a bookcase is panels (no sticks); the Eiffel canary is sticks with from/to, the instances StructureGraph already emitted. Nodes and edges are not a furniture contract, so version 1 does not pretend they are. A member part stores that stick. A panel part stores the panel, with its type as the role.
- Joints: a declared `Panel.joints` or `Panel.hinged` entry is a pattern in `src/lib/yard/jointLibrary.ts` (dado, rabbet, lap, mortise, miter, notch, hinge), each with a provenance in the code that already names it. Pairs from `panelJoints` / `stickJoints` are stored as contact. Contact is not a reviewed joint. Human furniture and a miniature (craft stock, or a toy/display use) are different. 1/4" plywood on the graph is a back or a drawer bottom.
- What compiled back, unchanged against this tip: bookcase 36 wide 84 tall 12 deep (casework); potting bench with a lower shelf (four legs, aprons, a top, and a lower shelf); eiffel tower (the weekend canary, read only). The same bookcase roles and 36×84×12 envelope hold for 3/4" plywood, 1/2" plywood, and oak; the back stays 1/4"; the Buy lines change with the stock. Eiffel from toothpicks keeps the same member roles and a tower envelope within 1"; the stick count changes with the stock, which is the loft we already have. The compiler's step order, Buy quantity, and part size follow the graph when those fields change.
- Left out: no new geometry, no re-nest, no rewritten step prose, no stock substitution. Buy quantities and step wording are the live compiler's, addressed by part id (the 1/4" backer line names the back part). Recipes are not compiled into the graph. The live pin-shelf screw exception is not reimplemented. Construction knowledge and substitution are the next gated step: declared joints where today there is only contact, then a reviewed substitution that keeps form, still not switched on as the source of truth until that grade.
- Canaries on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green; linen-check PASS. `approved-canary-changes.json` not edited. 1/4" plywood still drawer-bottom stock only. No new CI gate. `YARD_AI_READER` / `VITE_PUBLIC_AI_READER` not turned on. No AI planner. No AI Buy list. `lengthReader.ts` not touched.
- Files: `src/lib/yard/buildContract.ts`, `src/lib/yard/buildContract.test.ts`, `src/lib/yard/jointLibrary.ts`.
- Tests: `npx tsx --test src/lib/yard/buildContract.test.ts` pass. `npx tsc --noEmit` pass. Weekend canaries 6/6, walk-canary, linen-check pass. `npx tsx scripts/run-unit-tests.ts` passed all 273 files with no unlisted failure.
- Parked, not started: the potting bench's lower shelf. The live structure check calls that shelf floating, and the step calls it an adjustable pin shelf, while the builder's own note says to glue and screw it into the legs. "A linen needs…" wording still needs Ezra's yes.

### 2026-11-06 18:16 ET | stool unit-size shipped; equal clear bays — in progress (lock held)

- Stool unit-size shipped. Do not re-implement it. Digit-feet stays as shipped. Yard Critic PASS on #251 head `c6cccd6673289e40d23b1aba5672d0ce4e30aa85`, lean bar (model, steps, parts). Plain-merged #251 into release. Squash #252 to main `ea287eb75361fbfa3a13354257cd84ee0f84048b`. Merge-back #253 `c230ab55348aa963937de462a6eb162460a41a1e`. Production READY for that main SHA (`dpl_5ypakZABbcku8KrdqHTfkUhSfQjh` / yard-ds1vwu7ep, aliases include yard.wiki).
- The stool lock rode into release with #251 and was still on the merge-back tip. Replaced on this feature branch only. New lock: equal clear bays. Not graded. Not merged. PR #254 into `release/2026-10-24`. Do not merge.
- Rule: when the span pass divides one shelf opening into 3 or more clear bays, every clear width matches within 1/64", and the bays plus the dividers between them fill the run between the sides. `placeBayDividers` already subtracted divider thickness to choose the bay count, then placed centres by splitting the whole run, so each end bay was wider by half the divider. Centres now use the equal clear bay. A two-bay split stays one centre. Builder `Bay divider` layouts stay as they were. This is geometry, not a new size reader. `lengthReader.ts` was not touched.
- Reproduced on `c230ab55348aa963937de462a6eb162460a41a1e` before the change. The older cabinet fractions (about 13 5/12, 13 1/6, 13 5/12) are not this tip. On this tip:

  | Prompt | Before (release) | After |
  |---|---|---|
  | closet 72 wide | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
  | cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood | 13 5/16, 13 1/16, 13 5/16 | 13 1/4, 13 1/4, 13 1/4 |
  | bookcase 96 wide 72 tall 12 deep | 23 1/4, 22 7/8, 22 7/8, 23 1/4 | 23 1/16, 23 1/16, 23 1/16, 23 1/16 |

- Closet 72 fills 70 1/2" (3 × 23 + 2 × 3/4). The cabinet fills 40 3/4" (3 × 13 1/4 + 2 × 1/2). `wardrobe 96 wide` hats stay 31".
- Canaries on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green; linen-check PASS. `approved-canary-changes.json` not edited. C19 still in PR gates. ¼" plywood still drawer-bottom stock only. CARD1 host list unchanged.
- Files: `src/lib/yard/shelfSpan.ts`, `src/lib/yard/equalBayRuns.ts`, `src/lib/yard/equalBays.test.ts`, `scripts/baselines/approvals/equal-bays/` (rerun, not a CI gate, plus the mover list).
- Tests: `npx tsx --test src/lib/yard/equalBays.test.ts` pass. `npx tsx scripts/baselines/approvals/equal-bays/rerun.ts` pass (22 prompts, 53 runs). `shelfSpan.test.ts` 20/20. Weekend canaries 6/6, walk-canary, linen-check, and `npx tsc --noEmit` pass. Buy board rows now fill every integer from the outer ring through the other side: heights 24–132 and depths 6–30, for every host and width that already moved, at pine, oak, and 1×4 through 1×12. 437,516 board rows in `scripts/baselines/approvals/equal-bays/movers.md`. Heights and depths that do not change a count are omitted. The 48 r3 neighbors and the 34 r4 between-sample neighbors are in the table. The half-ply Buy line stays separate (nest: 1/2" 4×8 stays 1, 3/4" 4×8 goes 3→2, 3/4" 4×10 stays 1). `shelfSpan.ts` was not edited. Fourteen `stepLetterBySize` fixtures that required two Shelf lengths now expect the one equalized cut line. The size-disambiguation pin is unchanged. `npx tsx scripts/run-unit-tests.ts` passed all 272 files with no unlisted failure, including `stepLetterBySize.test.ts`.
- Parked, not started: "A linen needs…" wording still needs Ezra's yes. A comma (`stool, 24" wide`) and a hyphenated `24-inch` still drop the mark. A spelled "N foot shelves" on a coffee table is still a Combined Shelf.

### 2026-11-06 17:17 ET | digit-feet shipped; a stool keeps a unit-marked size — in progress (lock held)

- Digit-feet shipped. Do not re-implement it. Yard Critic PASS on exact head `a2e8170ee0878c91ff4c884ce0731855e9f5b727` vs then-release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`, lean bar (model, steps, parts). Plain-merged #248 into release as `94a7e50bbbe6f657808d1bbf1768d5624cfb6437`. Squash #249 to main `333ba25bb31f5085a96e44668e258828534f0a5b`. Merge-back #250 `104075e45583b7a82b77d6d30cb90c09df5e70de`. Production READY for that main SHA (`dpl_7uT1q7YuuaDgoYNSx67dGzKFeF21` / yard-d2cp6x7kp, aliases include yard.wiki).
- The digit-feet lock rode into release with #248. Replaced on this feature branch only. New lock: a stool plus a feature word keeps a unit-marked size. Not graded. Not merged. PR #251 into `release/2026-10-24`. Do not merge.
- Rule: a width or depth on a stool, or on the chair that shares that seat reader, is the inches the one reader reads. A unit mark between the number and the axis word stays (`24"`, `inches`, `inch`, `in`, `in.`, feet, a marked fraction, a spelled inch). `jobFurniture` calls `readLengths`; it does not add a second scan. A comma and a hyphenated `N-inch` stay release's read. `wide 24` stays unread. A count of feet is not a size. Height already kept an inch mark. Bench, table, and desk already kept a marked width.
- Reproduced on `104075e45583b7a82b77d6d30cb90c09df5e70de` before the change. The parked note said the size holds without a feature word. On this tip it does not: `stool 24" wide` was 18" wide, the same drop as the feature-word prompts. After, each broken prompt matches its bare twin (name, overall, steps, Buy names and quantities):

  | Prompt | Before (release) | After |
  |---|---|---|
  | stool 24 wide with two drawers | 24×16×18 (already the twin) | unchanged |
  | stool 24" wide with two drawers | 18×16×18 | 24×16×18 |
  | stool 24 inches wide with two drawers | 18×16×18 | 24×16×18 |
  | stool 18" deep with three shelves | 18×16×18 | 18×18×18 |
  | stool 18 deep with three shelves | 18×18×18 (already the twin) | unchanged |
  | stool 24" wide | 18×16×18 | 24×16×18 |
  | chair 20" wide with a drawer | 18×16×34 | 20×16×34 |

- Canaries on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green; linen-check PASS. `approved-canary-changes.json` not edited. C19 still in PR gates. ¼" plywood still drawer-bottom stock only. CARD1 host list unchanged.
- Files: `src/lib/yard/jobFurniture.ts`, `src/lib/yard/stoolUnitSize.test.ts`, `scripts/baselines/approvals/stool-unit-size/` (rerun, not a CI gate, plus the mover list).
- Tests: `npx tsx --test src/lib/yard/stoolUnitSize.test.ts` pass. `npx tsx scripts/baselines/approvals/stool-unit-size/rerun.ts` pass (28 pairs). `lengthReader.test.ts` and `classC2.test.ts` pass. Weekend canaries 6/6, walk-canary, linen-check, and `npx tsc --noEmit` pass. 210 of 1,355 movers change the catalog total; that total follows the parts and is not a grade.
- Parked, not started: equal bays. "A linen needs…" wording still needs Ezra's yes. A comma (`stool, 24" wide`) and a hyphenated `24-inch` still drop the mark, because releaseReads leaves them to release. A spelled "N foot shelves" on a coffee table is still a Combined Shelf. That split is clauseCore, not this size class.

### 2026-11-06 16:18 ET | class F shipped; digit counts of feet are not a size — in progress (lock held)

- Class F shipped. Do not re-implement it. Yard Critic PASS on exact head `d47dc17c8b84012fbe8de8073496db7d7c6ce24a` vs then-release `80c3e765`, lean bar, canaries byte-identical, CARD1 host list unchanged. Plain-merged #245 into release `ec37c4c8248abaa72d9e1a555271861083ab71be`. Squash #246 to main `eb082af6a014115fc574598c9fca22393ddf40f9`. Merge-back #247 `b5442befb7a417ba72bd02e1eff43df696e9c7dd`. Production READY for that main SHA (`dpl_CghbaV74qwH6gzTB1a7xPvRYyyxc` / yard-if6j79v6x, aliases include yard.wiki).
- Lock for class F cleared on this feature branch only (it had ridden in with #245). New lock: digit count of feet not a size. Not graded. Not merged. PR #248 into `release/2026-10-24`. Do not merge.
- Rule: a number before feet / foot is not a length when with / on / and / has / plus comes before it or a part noun follows it, unless an axis word follows. Digits use the same rule the one reader already applied to spelled counts. `normalizeUserPrompt` and `sizePhrases` follow that reader instead of a second feet scan. A leading "6 foot shelf" stays the storage height (C2). A comma keeps release's reading (`bookcase, 3 1/2 ft boards` unchanged).
- Reproduced on `b5442bef` before the change. After, each headline matches its spelled twin (name, overall, steps, Buy names and quantities):

  | Prompt | Before (release) | After |
  |---|---|---|
  | coffee table with 4 feet | 48×22×18 | 40×40×18 |
  | side table with 3 feet | 36×36×22 | 20×20×22 |
  | table with 4 foot legs | 48×36×30 | 40×40×30 |
  | bookcase with 2 foot shelves | 36×12×24 | 36×12×84 |
  | bookcase with 5 one foot shelves | 36×12×84 (already the twin) | unchanged |

  Axis forms stay sizes: "desk 2 feet wide" is 24" wide, "bookcase 4 feet tall" is 48" tall, "table 6 feet long" is 72" wide, "6 foot shelf" is 72" tall, "workbench 6 feet" is 72" wide. Class F shelf sizes ("coffee table 4 feet wide with an open shelf", "nightstand 4 feet wide, with 1 shelf", "desk 4 ft wide with an open shelf") still match their digit twins.
- Canaries on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green; linen-check PASS. `approved-canary-changes.json` not edited.
- Files: `src/lib/yard/lengthReader.ts`, `src/lib/yard/sizePhrases.ts`, `src/lib/yard/voiceHonesty.ts`, `src/lib/yard/lengthReader.test.ts`, `scripts/baselines/approvals/digit-feet/` (rerun, not a CI gate, plus the mover list).
- Tests: `npx tsx --test --test-name-pattern "digit count before feet" src/lib/yard/lengthReader.test.ts` pass. Class F `typedCounts.test.ts`, C2, weekend canaries 6/6, axis binding, hanging clearance pass. `npx tsx scripts/baselines/approvals/digit-feet/rerun.ts` pass (16 pairs, 9 sizes).
- Parked, not started: stool plus a feature word dropping a unit-marked size; equal bays. "A linen needs…" wording still needs Ezra's yes. A spelled "N foot shelves" on a coffee table is still a Combined Shelf; the digit form keeps the shelves on the table. That split is clauseCore, not this size class.

### 2026-11-06 15:05 ET | class F other hosts with Shelf — in progress (lock held)

- Lock taken on this feature branch only (not a direct commit to `release/2026-10-24`). Do not clear it here. Release tip when the lock was written: `80c3e7655194c89bacd741e55097531e20f0c93e` (docs #242). Main `a032063e5f1c4cc94f0d02b32772cb788600b6a4`. Engine-speed #241 / squash #243 / merge-back #244 already shipped; production deploy for `a032063e` is READY (`dpl_5H2BWSNgXhcwtkQFcsSzGXqTiQ9z`).
- Rule: a typed axis beside class F shelf wording (`1 shelf`, `one shelf`, `1 open shelf`, `an open shelf`) is the inches the one reader reads, on every host and on either side of the shelf phrase. A separator comma is not a reason to leave that axis to release. The host allow-list in `compose.ts` still only decides whether the shelf stays on the host.
- Reproduced on `80c3e765` before the change. Standard order already matched the digit twin (media console 3 ft, nightstand 2 1/2 ft, coffee table 4 ft, desk 4 ft). A comma dropped spelled and metric axes (`thirty inches`, `four feet`, `six feet`, `762 mm`, `1829 mm`) into a default-sized build. Size-after without a comma already matched its digit twin and stayed Combined.
- Not graded. Not merged. PR #245 into `release/2026-10-24`. Canaries run locally on this branch: weekend geometry 6/6 unchanged; `walk-canary.ts` linen 31.5×78×16 and pocket green. `approved-canary-changes.json` not edited.

### 2026-11-06 ~10:33 ET | CARD1 any-size spelling shipped (#238/#239/#240)

- Lock not taken (`LOCK: none`). Docs only. Release tip `b0bdccff09bdee04ca64feb70d41cfd9bc642347` (merge-back #240). Main `3cb578532eb00e5627e2d363ab9616452df3a70b`.
- Yard Critic PASSed code `f1e7472a930dd929b31c6f92510bddd8adba43bf` vs then-release `deabae9d818a04a59bbd99104456df485eed0f88` / then-main `cf05d769fee45089ce5ac70e2dd45343515667a9` under the lean bar (model, steps, and parts only). Zero blockers. No price card. Headline: "desk 4 ft wide with an open shelf" builds as the typed-size desk matching the digit twin. Scope note (not a blocker): size-after, comma-before-shelf, and non-CARD1 hosts still Combined, same as that tip.
- Release PR #238 merged as `e04795ae0d83af1375d2e3dcf12e45345bd19246` (plain merge, 10:22 ET; engine head stayed `f1e7472a`). Shipped from branch `ship/card1-any-size` at that exact engine sha. Mover-folder tip `4dc2add4` was not merged.
- Squash PR #239 to main, 10:31 ET, by YARD Chief: `3cb578532eb00e5627e2d363ab9616452df3a70b` (2 files, `compose.ts` + `typedCounts.test.ts`).
- Merge-back PR #240, 10:32 ET: release tip `b0bdccff09bdee04ca64feb70d41cfd9bc642347`.
- Production deploy for `3cb57853` was not verified. yard.wiki is not claimed live.
- Approved next queue (Ezra, 2026-11-06 ~10:04 AM ET), with item 1 done:
  1. DONE: `class-card1-any-size` shipped.
  2. NEXT: land Claude's output-neutral engine-speed patch (compile hot regexes once, cache graded gate rows; no build-output change). Grade, then ship.
  3. Then parked honesty classes, one at a time: other hosts that still become "with Shelf" and drop the typed size; digit forms like "with 4 feet"; stool plus a feature word dropping a unit-marked size; equal bays.
  4. "A linen needs…" wording still needs Ezra's yes.
- Do not resume SWE 2, Critic 2, or Design.

### 2026-11-06 ~10:04 ET | NR-1 (#225) shipped; lean bar; approved queue

- State at ~10:04 ET, before CARD1 shipped. CARD1 was still with Critic then; it later PASSed and shipped — see the ~10:33 ET note. Do not treat the CARD1 lines below as current.
- Lock not taken (`LOCK: none`). Docs only. Release tip then `deabae9d818a04a59bbd99104456df485eed0f88`, which was also the #236 merge-back tip. Main then `cf05d769fee45089ce5ac70e2dd45343515667a9`.
- Critic PASSed #225 r5 (head `fc7de9efb98af31f9ae3324df177384d8bbebf7f`) vs then-release `afcb1f8b` on 2026-11-06 ~9:24 AM ET, under Ezra's lean bar (model, steps, and parts only; no dollar-delta / price-up card). Zero blockers. Digit forms like "with 4 feet" parked (= release). Axis forms still sizes. 0 movers drop a typed size release honoured. 35/35 new refusals match their digit twins. Canaries unchanged. eval-gate Δ 0. Tests 2116/2116. No loosened tests.
- Merged #225 into `release/2026-10-24` as `efbd49fc9b3df273f2832f143649289969a5c749` (merge commit, 09:26 ET; PR head stayed `fc7de9ef`). Squash PR #235 (release → main) merged 09:36 ET: main `cf05d769fee45089ce5ac70e2dd45343515667a9`, by YARD Chief. Merge-back PR #236 (main → release, plain merge) 09:37 ET: `deabae9d818a04a59bbd99104456df485eed0f88`.
- Regrade recorded for #235: Critic's r5 grade found canaries unchanged vs then-release. No separate post-merge main regrade was run; do not invent one, and do not block the queue on it.
- Lean grading bar (Ezra, 2026-11-06 ~8:37 AM ET, standing): grade only the model, the steps, and the parts (correct items and quantities). Drop dollar-delta cards; price follows the catalog from those parts. A changed total is not its own grade and does not need Ezra's click on a list of price-ups. Still block on a bad model, wrong or mismatched steps, wrong Buy items or quantities, a loosened test, a false claim, a canary or protected-build regression, or a privacy/auth risk. User-facing wording changes (e.g. "A linen needs…") still need Ezra's yes. Canaries stay byte-identical. Never loosen a pinning test without Ezra's yes.
- Approved next queue at 10:04 (Ezra). Item 1 later shipped; the live queue is in the ~10:33 ET note.
  1. Then in flight: grade of `class-card1-any-size` (tip `f1e7472` + movers `4dc2add`). Sent to Critic after #225 landed. Later PASSed and shipped from `ship/card1-any-size` at `f1e7472a` — not still waiting.
  2. Then land Claude's already-written output-neutral engine-speed patch (compile hot regexes once, cache graded gate rows; no build-output change). Grade, then ship.
  3. Then parked honesty classes, one at a time: other hosts that still become "with Shelf" and drop the typed size; digit forms like "with 4 feet"; stool plus a feature word dropping a unit-marked size; equal bays.
  4. "A linen needs…" refusal wording still needs Ezra's yes before any change.
- Do not resume SWE 2, Critic 2, or Design.

### 2026-11-06 (later) | #225 mover folder; class F card 1 fix held behind #225

- Release tip `e8a8119`. Lock not taken (no landing).
- #225 DRAFT mover folder: branch `movers/nr1-r5`, `scripts/baselines/approvals/pr-225/` (generator sweep.py +
  observe.mts + movers.py, prompts.json 6,433, release/head outputs, movers.md, nr1-r5.diff, draft card text).
  r5 vs release: 1,962 move — 488 price-ups (189 builds, every one listed), 834 down, 640 same-price/refusal.
  0 movers leave a typed size release honoured; 35 new refusals each match their digit spelling's refusal on release.
  Card not to be shown until the Critic PASS of r5 is logged here. (That PASS is now logged above. The lean bar dropped the dollar-delta card.)
- Class F card 1 at every size spelling: branch `class-card1-any-size` (f1e7472 + mover folder 4dc2add), built on r5.
  Rule: CARD1 reads any spelling the one reader reads as its inches, so "desk 4 ft wide with an open shelf" builds the
  48" desk, not an 84" "Desk with Shelf". vs r5: 213 move, all price-downs, 0 ups. Critic NR-1 probe A–E all pass.
  Test: typedCounts.test.ts (5 hosts × 13 spellings × 3 shelf forms; fails on the old CARD1). Unit suite same as r5.
  At this session there was no PR yet (graded after #225). Later shipped — see the ~10:33 ET note.
- Parked: stool + feature words drops a unit-marked size; "A linen needs ..." refusal wording.

### 2026-11-06 | NR-1 r5 (PR #225, `class-number-reader` fc7de9e) | session note before the PASS

- Release tip `afdc8b1`, main `5a21262`. Lock not taken (no landing this session).
- Why: Critic NR-1 probe (critic/nr1-head, 2026-11-05) failed test B: r4 read a spelled count of feet as a size.
- Rule: a spelled number before feet/foot is not a length when with/on/and/has/plus comes before it or a part noun
  (legs, shelves, boards, rods, ...) follows it, unless an axis word follows ("two feet wide" is still 24").
- Before → after (r4 → r5; each after = release byte for byte):
  - "coffee table with four feet" 48x22x18 $48.51 → 40x40x18 $62.94
  - "side table with three feet" 36x36x22 $64.38 → 20x20x22 $45.95
  - "table with four foot legs" 48x36x30 $68.88 → 40x40x30 $68.88
  - "bookcase with two foot shelves" 36x12x24 $83.35 → 36x12x84 $131.76
  - "bookcase with five one foot shelves" / "with 5 one foot shelves" 36x12x12 $83.35 → 36x12x84 $131.76
  - No other probe prompt moved (712 compared). Digit forms ("with 4 feet") unchanged = release.
- Files: src/lib/yard/lengthReader.ts, src/lib/yard/lengthReader.test.ts (new r5 property; fails with the rule off).
- CI on fc7de9e: guards ✅, eval-gate ✅ (Δ 0 on 511 prompts), canaries 7/7.
- Probe A and D still fail; both failures are on release too ("<host> with Shelf" ignores the typed size). Parked in
  PARKED-IDEAS.md, not NR-1's.
- NR-1 vs release still moves 265 probe prompts (67 price-ups, 110 price-downs); needs Critic PASS, then Ezra's yes with the
  full mover list before merge.
- Next: Critic regrade of r5; then the mover card. (Historical for this session. The r5 PASS and #235 landing are logged above.)
