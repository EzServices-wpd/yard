LOCK: YARD Chief | item: equal clear bays | started: 2026-11-06 18:16 ET | status: in-progress

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
- Tests: `npx tsx --test src/lib/yard/equalBays.test.ts` pass. `npx tsx scripts/baselines/approvals/equal-bays/rerun.ts` pass (22 prompts, 53 runs). `shelfSpan.test.ts` 20/20. Weekend canaries 6/6, walk-canary, linen-check, and `npx tsc --noEmit` pass. Buy board rows are now the closed neighbor dump in `scripts/baselines/approvals/equal-bays/movers.md`: every host and width that already moved, at pine, oak, 1×4, 1×6, 1×8, 1×10, and 1×12, for every integer height 36–96 and every integer depth 9–20, plus the unsized rows and the outside ring that still moved. 152,743 board rows. All 48 r3 neighbors are in the table. The half-ply Buy line stays separate from that count (nest: 1/2" 4×8 stays 1, 3/4" 4×8 goes 3→2, 3/4" 4×10 stays 1). `shelfSpan.ts` was not edited. Fourteen `stepLetterBySize` fixtures that required two Shelf lengths now expect the one equalized cut line. The size-disambiguation pin is unchanged. `npx tsx scripts/run-unit-tests.ts` passed all 272 files with no unlisted failure, including `stepLetterBySize.test.ts`.
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
