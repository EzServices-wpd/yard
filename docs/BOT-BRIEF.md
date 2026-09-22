# Yard — Bot field manual

20 September 2026 · tip `3af4e7b` · [yard.wiki](https://yard.wiki) · `EzServices-wpd/yard`

A working brief for the Grok bot. Not a vision deck. Read `docs/BOT.md` first (the queue), then this (the why). If a canary is red, the canary wins.

**Type it. Buy the parts. Build it.** House-first. Deterministic geometry. Grok writes voice, not SKUs.

If you remember one paragraph: run `npx tsx --tsconfig tsconfig.json scripts/walk-canary.ts`. Green → one item from NEXT. Red → fix that canary and **stop**. Do not invent a FAIL class. Do not open `fitted.ts` for a new noun. Never invent a size. Never push PLACEHOLDER. Never wipe `canvas.tsx`, `stick-cloud.tsx`, `steps.ts`, or `nest-plate.tsx`.

---

## 1. How to use this document

You are the Grok bot on **EzServices-wpd/yard**. Live product is **yard.wiki** (Vercel team BuildHQ, project `yard`, auto-deploys `main`). The founder is Ezra.

Read in this order:

1. `docs/BOT.md` — one page, always current NEXT.
2. This brief — why the queue is the queue, and what “honest” means.
3. Then the files for the *one* NEXT item.

`docs/PRODUCTION.md` freeze language is **historical** (linen used to be named “Closet”; product name is now **Linen**). `docs/REFINEMENT.md` is the working log. Do not restore old expects that the product already outgrew.

**Conflict rule:** typed size in the prompt > freeze table > this brief > honesty-guards > your new FAIL class. A red linen or red pocket means you are lying, even if 40 other guards went green.

## 2. What Yard is, and the gap it still fills

Yard is the plan the lumber aisle should have printed. A person types a space or a dream. The engine returns geometry they can trust, a sheet nest they can cut, hardware they can buy, and steps a stranger can follow. Grok is the voice and the true-form of named objects. Grok is *not* the SKU picker and not the tape measure.

The gap that still is not filled by IKEA, SketchUp, ChatGPT-with-a-cut-list, or a contractor:

**this opening + HD SKUs → trusted 3D → followable PDF → buy links.**

- **House-first.** Closet, vanity, desk, pantry, bench, bookcase, media, pocket. Measure a space.
- **Weekend proves the same engine.** Popsicle Eiffel, PVC arch. Secondary on the landing, not forgotten.
- **Deterministic geometry.** If they typed 31.5 × 78 × 16, every surface a stranger sees says those numbers: name, HUD, unit, overall, cut list, nest, PDF.
- **Guidance, not stamped engineering.** The legal line stays.

Paper/2D kids layouts exist in the engine and stay off the homepage. Amazon tag and accounts exist in the stack and stay off until Ezra says go.

## 3. Where the product holds (20 Sep 2026)

Tip `3af4e7b` was READY on Vercel when this brief was written. Hard-refresh yard.wiki after every deploy.

| Layer | Hold | Note |
|---|---|---|
| Engine | ~88–90% | Geometry for the freeze 10 is real. Routing bugs still steal (pocket was House until this morning). |
| Stranger-finish | ~55% | Slice B + C + Cut A + pocket PDF shipped. Slice D is not a real photograph. |
| Catalog width | Treadmill | Lounge / desk / AABB FAIL classes. Do not feed it. |

### What is true on the bench right now

- **Linen** `linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep` → name *Linen 31.5" × 78" × 16"*, kind closet, overall = unit = 31.5 × 78 × 16, 11 panels, 8 steps, 2× 4×8 nest (~91% / 78%), ~$161, PDF 7 pages.
- **Pocket** (original survey) → *Bathroom pocket vanity*, kind closet, `project.pocket` set, unit 38 × 102 × 17, 26 panels, 18 cuts, 15 steps, knee 22″, counter 34″, uppers 54″→102″. Not House. Not 0 cuts.
- **Slice B (16 Sep, `d2eb082`)** — unit is the hero; measure on the unit; primary action **Get the plan**; weekend chips folded; first-timer never needs the kebab.
- **Slice C (17 Sep, `29a1cbf`)** — nest is the hero of Get the plan and PDF page 1. Footer names the real sheet. Thin backer stays off the ¾″ nest (nesting is honest; the *id* on the 0.25″ panel is not).
- **Voice/PDF kit (20 Sep)** — parts-plate letters, one-join densify, `strangerPlainShopTalk` (carcase → main box, toekick → kick strip), hardware class match. Helpers in `voiceHonesty.ts` (439 lines) — not a form class.

### Sizes of the danger files

| File | Lines | Rule |
|---|---|---|
| `src/lib/yard/fitted.ts` | 4798 | Do not grow this for a new noun. Cut A may touch `panel()`. That is it. |
| `scripts/yard-honesty-guards.ts` | 3760 | Do not add a FAIL class. The bot already did, all morning. |
| `src/lib/yard/steps.ts` | 2558 | Voice lives here. Do not wipe. |
| `src/lib/yard/promptMain.ts` | 393 | Routing. Chair-space + parsePocket-first already landed in `3af4e7b`. |

## 4. What “next level” means

Not more furniture nouns. Not a smarter AABB. Next level is a stranger finishing a real weekend from a Yard PDF without Ezra in the room.

1. They type an opening they measured with a tape.
2. The bench shows *that* unit. Craft chrome is gated. Measure is on the unit.
3. They hit **Get the plan**. The sheet nest is first. Then cut list. Then buy.
4. The printed plan’s page 1 is the nest. Letters match the cut list. Kerf is honest. Grain is marked. ¼″ backer is not on the ¾″ sheet *and is not sold as ¾″*.
5. Steps are one action each, with sizes in the sentence, in words a first-timer knows (main box, kick strip). Shop terms have a glossary.
6. Pocket is a vanity in the trapezoid they surveyed, not a weekend House of arches.
7. Landing looks like the house they will actually build — real alcove photographs, not only bench stills.

That is why NEXT is Cut A, then Slice D — not lounge chair Seat W, not media-ledge AABB, not bamboo-skewer plurals.

Engine honesty: the AABB of a lounge backrest matches typed width. Product honesty: a stranger can cut linen from the PDF. The bot has been optimizing the first. Ezra asked for the second.

## 5. First command every fire

```
npx tsx --tsconfig tsconfig.json scripts/walk-canary.ts
```

- **Green** — print the two ok lines. Pick the first undone item in NEXT. Do that item only. Walk canary again. Then `scripts/walk-launch.ts` (must be 10/10). Then ship full files.
- **Red** — the output tells you which freeze broke. Fix *that*. Stop. Do not “while I’m here” a seating lounge class.

```
npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
npx tsx --tsconfig tsconfig.json scripts/walk-soft-launch.ts
```

Linen walk expect is the substring **Linen**, not Closet. Pocket walk expect is kind `closet`, name includes **vanity**, and canary additionally requires `project.pocket` and unit ≈ 38 × 102 × 17.

Intake that must stay green inside walk-launch: `bathroom vanity` is a counter-height vanity (not a linen closet); `vanity 36 inches wide` stays 36″ and under 48″ tall; `pocket vanity` (short chip) fills Ezra’s bathroom (102″ mixed-use, named vanity, `project.pocket` set).

## 6. Freeze table — exact prompts, exact expects

Never invent a size these prompts did not give. If you change a number, you have failed even if the 3D looks nicer.

| # | Prompt (verbatim) | Must stay |
|---|---|---|
| 1 | Original pocket survey (full text in §17). Short chip: `pocket vanity`. | Name includes vanity. Kind closet. `project.pocket` set. Unit 38 × 102 × 17. Knee 22″. Counter 34″. Walls 38.5 / 26 / 33.5 / 102. Never kind house. Never 0 cuts. Never named House. |
| 2 | `linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep` | Name includes **Linen**. Kind closet. Unit and overall **31.5 × 78 × 16**. HUD, cut list, nest, PDF all say those numbers. 11 panels. |
| 3 | `Andersen 100 Series 36 by 48 double hung window, frame the rough opening` | Kind opening. Named Andersen. RO framed (kings / jacks / header). Not a closet. |
| 4 | `desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space` | Name includes Desk. 60 × 29 × 30. Knee 24″. Kind closet. Do not steal to House or Table wire. |
| 5–8 | Pantry 24×84×14 · mudroom bench 48×18×18 · kids bookcase 30×11×48 · media console 60×16×24 | Typed W×H×D. Names Pantry / Bench / Bookcase / Media. Followable steps. Nest for ply. |
| 9 | `3 foot Eiffel Tower from popsicle sticks` | Kind eiffel. Whole popsicle sticks (don’t cut). Weekend, not house chrome. |
| 10 | `6 foot garden arch from 3/4 inch PVC pipe` | Kind arch. PVC. Opening stays clear. |

**Chair space.** The original pocket survey contains *“Mirror and storage beside the chair space.”* That is knee room under a vanity. It is not a chair. `namesSitChair` in `family.ts` strips `chair space` / `chair-space` before the sit-noun test. Do not revert this. Do not add a seating lounge class to “fix” pocket.

## 7. NEXT queue — one item at a time

Copied from `docs/BOT.md`. If you ship an item, check it off there. Do not start the next item in the same fire unless the one you shipped is on main, canary green, and Vercel READY.

**Shipped 21 Sep:** Cut A — thin back `materialId` is `plywood-1-4-4x8`. Linen 31.5 × 78 × 16 unchanged.

**Shipped 21 Sep:** Pocket stranger PDF — freeze #1 printed plan stamps 4×10 for 102" faces, ¼″ on thin parts, nest page 1 includes the 4×10 sheet, kick title sentence-case, pocket measure is walls/flares. Unit 38 × 102 × 17 unchanged. Do not reopen routing.

1. **Slice D** — real alcove *photographs* for landing heroes (linen / pocket / desk). Rendered bench stills already exist at `public/heroes/{linen,pocket,desk}.jpg` (1280×960). Do not generate a fake bathroom. If you do not have Ezra’s photos, **ask and stop**.

After those three, the product is closer to launch than another month of AABB. Then Ezra decides Amazon / accounts / a stranger walk (Stage 3.3).

## 8. Worked next fire: Cut A (thin backer id)

This is the highest-leverage honesty leak that is still open. A stranger who buys what the cut list names will buy ¾″ for a ¼″ back.

### The lie

- Linen step 2 already *says* “From the 1/4" plywood (backer): 1 Back 78 × 30 × 0.25"”.
- The panel is 0.25″ thick on the bench.
- `nesting.ts` already keeps parts ≤ ¼″ off the ¾″ sheet.
- `listings.ts` already maps hay with `1/4` / `backer` + ply → `plywood-1-4-4x8`.
- **But** `fitted.ts` `panel()` hardcodes `materialId: PLY` (`plywood-3-4-4x8`) for every panel, including the 0.25″ back. `pocket.ts` `panel()` defaults the same way, and the stud-anchored back is created at 0.25″.

### The fix (do this, nothing else)

1. In `fitted.ts` `panel()`, if thickness (the last size, currently always assigned `d`) is ≈ 0.25, set `materialId` to `plywood-1-4-4x8`. Same for `pocket.ts` `panel()` when the default would otherwise stamp ¾″ onto a ¼″ back.
2. Do not change unit sizes. Do not retitle Linen. Do not add a new honesty-guard FAIL class if the canary + a one-line linen backer check would do.
3. Walk canary. Walk-launch 10/10. Confirm linen overall still 31.5 × 78 × 16. Confirm nest still two 4×8 of ¾″ plus a separate ¼″ buy. Confirm the cut line / BOM for Back is ¼″ catalog, not ¾″.

**Done when:** Linen Back thickness 0.25, `materialId` `plywood-1-4-4x8`. Name, HUD, unit, overall still 31.5 × 78 × 16. Pocket back follows the same rule. Canary green. 10/10 walk.

Catalog already has the ¼″ 4×8 SKU. You are aligning identity with thickness, not inventing a product.

## 9. Worked later fire: Slice D (real alcove photo)

Landing already has three clickable house heroes above the fold, with real W×H×D callouts:

| Id | File now | Caption now |
|---|---|---|
| pocket (featured) | `/heroes/pocket.jpg` | 38 × 102 × 17 · trapezoid fit |
| linen | `/heroes/linen.jpg` | 31.5 × 78 × 16 |
| desk | `/heroes/desk.jpg` | 60 × 30 × 29 · 24″ knee |

Those JPEGs are **rendered bench stills** of the units. They are not photographs of Ezra’s alcove. Slice D in the founder’s mouth is: a real room, a real tape, the unit in the hole.

Do not generate a synthetic interior and overwrite `public/heroes/*.jpg`. Do not “improve” the stills with a new camera angle if you do not have a photograph. If photos are not in the repo and Ezra did not attach them this fire, ask: *“Send the three alcove photos (linen, pocket, desk) and I will swap the heroes.”* Then stop.

When photos arrive: keep the callouts (31.5 × 78 × 16 etc.). Keep click → generate with the freeze prompts. Share card stays the linen alcove, not the popsicle Eiffel. Crafts stay below the fold.

## 10. Routing map — why freeze #1 became House

This already shipped in `3af4e7b`. Do not reopen it unless canary goes red. Learn the pattern so you do not recreate it.

1. `generateFromPrompt` in `promptMain.ts` enters the house/fitted branch only if the prompt is not a sit-chair steal: `(!namesSitChair(lower) || isSeatingLoungeClass(lower))`.
2. Old code used `/\bchair\b|\bstool\b/`. The pocket survey says *chair space*. The branch was skipped.
3. Fallthrough: `detectForm`. House hit was `/cabin|shed|hut|…/`. The survey says *Upper **cabin**etry*. Match → name House, kind house, weekend wire, arches/piers/braces, invented overall ~39.5 × 102.5 × 18, **0 cuts**.
4. Even inside the house branch, `parseBrief` ran before `parsePocket`. Brief wraps the survey as a rectangular FittedSpec named “Bathroom pocket vanity”. `buildFitted` can forward wonky walls to `buildPocket`, but the dedicated path is `parsePocket` → `buildPocket` → `project.pocket`.

Fixes in place:

- `namesSitChair` strips `chair[\s-]+space`.
- When `looksLikePocket(prompt)`, `parsePocket` wins before `parseBrief`.
- House form regex is now `\bcabin\b` so *cabinetry* / *cabinet* are not a log cabin.
- Anatomy sit-carve uses `namesSitChair` the same way.

`looksLikePocket`: wonky geometry only — `pocket|trapezoid|centerline|angled|wonky`, or back wall + left + right. Alcove alone is a rectangular fitted unit. Do not broaden it so every closet becomes a trapezoid.

`looksLikeFitted` returns true for pocket at the top. Linen does *not* look like pocket. Leave that alone.

## 11. House path vs weekend path

**House (hero):** closet, vanity, desk, pantry, bench, bookcase, media, pocket, Andersen opening. Panels. Cut list. Nest. Buy. One-action steps. Unit is the hero. Measure on the unit. Get the plan. Weekend chips folded behind one Weekend chip. First-timer never needs the kebab.

**Weekend (proves the engine):** Eiffel loft, PVC arch, straw Warren, popsicle, figures. Whole-stock default (don’t cut popsicle). Lattice / loft / anatomy. Grok true-form when the key is set. Class default if Grok is down. Cover photo may stay page 1 (nest is house ply). Not the landing hero. Not a new form class this week.

Steals that have already happened and must not happen again: chair space → Chair; cabinetry → House; climb step-shelf on a linen → step stool; media tower → lattice tower; platform bed → House wire; “chair” on a vanity → furniture densify.

Seating lounge class (lounge / rocker / ottoman) is *fitted sit anatomy*, not naked House wire. It is also **parked**. Do not spend a fire on Seat D / Seat W / Backrest W. Those three commits already landed 20 Sep.

## 12. Already shipped — do not redo

| Slice | Tip | Protect |
|---|---|---|
| House-first landing, paper off | Aug freeze | No 2D chips on the homepage. No new paper programs. |
| Fitted plan voice | Aug | confirm → cut → stand main box → parts → shim/lag. Unique to the panels on the bench. |
| Nest engine (MaxRects BSSF) | Aug C / Sep C | `nesting.ts`, `pdfNest.ts`, `nest-plate.tsx`. Letter parts. ⅛″ kerf. Grain. Thin off ¾″ sheet. |
| Slice B house-path ease | `d2eb082` | Get the plan. Unit overlay. Weekend folded. Do not auto-open measure sidebar on house. |
| Slice C nest-as-hero | `29a1cbf` | Plan drawer: nest, then cut list, then buy. PDF page 1 = nest. `data-yard-nest-hero`. |
| Voice/PDF kit | `234e247` `0a1e835` | Parts-plate letters, one-join, hardware↔Buy class, plain footprint, Main box / Kick strip. |
| Pocket routing | `3af4e7b` | Chair space, parsePocket first, cabin ≠ cabinetry. |

Historical overnight bots wiped `canvas.tsx`, `stick-cloud.tsx`, and `steps.ts` with the string PLACEHOLDER. Restores that only pushed the word PLACEHOLDER were not restores. If a file is under a few hundred bytes and used to be tens of KB, you have wiped it. Do not push. Restore from git.

## 13. Voice / PDF kit (stranger words)

Grok writes voice. The kit in `voiceHonesty.ts` is the contract:

- `strangerPlainShopTalk` — carcase → main box; toekick → kick strip. Glossary in the PDF still defines the shop words.
- Parts-plate letters match the cut list. Same letter on the nest, the step, the waste-face mark.
- One-join densify: stand the main box, then attach named parts (D bottom, F top), then pins, then doors. Do not collapse to “assemble the carcase / square and label / cut the sheet” — walk-launch fails generic titles.
- Hardware class match: piano hinge stays piano; lid-stay stays lid-stay; do not collapse everything to soft-close cup hinges.
- Species: if they named cedar, say cedar. If densify is plywood, say the substitute out loud. Do not silent-drop.
- Shelf install heights AFF / from the bottom when marked (`eaed54a`).
- Drawer explode is sides, not the envelope, not an Upright lie (`945dccf`).

Walk-soft-launch still greps shop terms `carcase|toekick|dry-fit|…` in step blobs. If you change voice, run the soft walk. Do not “fix” the walk by deleting the shop-term assert.

## 14. The FAIL-class treadmill (anti-patterns with SHAs)

The bot is not compute-bound. It starts from a red 10-walk (stale expect, or a real steal) and invents a FAIL class so honesty-guards go green. That is how `fitted.ts` hit 4798 lines and guards hit 3760. The morning of 20 Sep, after Slice C, the bot shipped this instead of Cut A:

| SHA | What it actually did | Class |
|---|---|---|
| `234e247` `0a1e835` | Voice/PDF kit — this one was real stranger-finish. Keep. | Voice (good) |
| `b4b545c` `1ad15a6` `6ce002d` | Seating lounge Seat D, Seat W, Backrest W | FAIL catalog |
| `eaed54a` | Shelf AFF heights | Voice (ok, not NEXT) |
| `945dccf` | Drawer explode sides | Honesty (ok, not NEXT) |
| `ea47cbb` | Desk/vanity worktop AABB H = typed overall | FAIL AABB |
| `f047526` | Bamboo skewer plurals ≠ 1x4 lumber | FAIL catalog |
| `8c107ea` | Bedside hung-open envelope AABB H | FAIL AABB |
| `043e2fb` | Media ledge envelope AABB H | FAIL AABB |

Three AABB commits landed *while* pocket was still densifying as House and the linen walk still expected the word Closet. That is the shape of a wasted month (1–16 Sep was the same pattern).

### Banned moves

- Invent a size the prompt did not give.
- Push empty files or the word PLACEHOLDER.
- Wipe canvas, stick-cloud, steps, nest-plate, plan-drawer, pdf, pdfNest.
- Add a form class, a new `src/lib/yard/*Chair.ts`, or a new family unless Ezra names it.
- Restart the hourly overnight refiner. Automations list is empty on purpose.
- Set Amazon tag, domain env, or accounts. Ask first.
- Open `fitted.ts` to teach a new noun. Untaught house nouns reuse a family (hung-open, floor-carcase, table, seat).
- Add 50 lines to `yard-honesty-guards.ts` for a catalog edge.
- Treat “chair space” as a chair.
- Rsync, clone, or overwrite this product into a Grok Build /workspace app. Live is yard.wiki.
- Commit untracked local walks: `scripts/walk-linen.ts`, `walk-slice-c.ts`, `walk-eiffel-pdf.ts`.

If honesty-guards yell about a lounge AABB after you fixed Cut A, **leave it**. Write it in the commit message as parked. Do not feed the treadmill.

## 15. File map — what to touch for what

| Job | Touch | Do not touch |
|---|---|---|
| Cut A backer id | `fitted.ts` `panel()`, `pocket.ts` `panel()`. Maybe cut-list material label if it still copies id. | Unit math. Nest algorithm. Honesty-guards FAIL class. Linen title stem. |
| Slice D photos | `public/heroes/*.jpg`, maybe `src/routes/index.tsx` if captions need a photo credit. | Prompt routing. Engine. Generating new stills. |
| Routing steal | `promptMain.ts`, `family.ts`, `form.ts`, `anatomy.ts`, `pocket.ts` `looksLikePocket` | New form hits. Broadening pocket to every alcove. |
| Stranger steps | `steps.ts`, `voiceHonesty.ts`, `report.ts` | Generic “assemble the carcase” titles. |
| Nest / PDF page 1 | `nesting.ts`, `pdfNest.ts`, `pdf.ts`, `nest-plate.tsx`, `plan-drawer.tsx` | Putting cover photo back as house page 1. |
| House chrome | `shell.tsx`, `prompt-bar.tsx`, `measure-overlay.tsx` | Re-opening measure sidebar by default. Un-folding weekend chips. |
| Walk expects | `walk-canary.ts`, `walk-launch.ts`, `walk-soft-launch.ts` | Weakening asserts to match a House steal. |

Stack, for orientation only: TanStack Start, Vite, React 19, R3F, Zustand, jsPDF, MaxRects nest. Do not add a new framework.

## 16. How to ship a slice

1. Stay on `EzServices-wpd/yard`, branch `main`. No new repo.
2. Walk canary first (red → fix that, stop).
3. Do one NEXT item. Full file contents. Humans used to ship empty PLACEHOLDER blobs via partial pushes — never again.
4. Walk canary. Walk-launch. Soft-launch if you touched steps, nest, or house ply.
5. Commit message style: `fix(yard): …` or `feat(yard): …`. One sentence that a stranger could read.
6. `git fetch` then rebase if main moved — this bot races itself. Never force-push main.
7. Push full files. Verify GitHub sizes (BOT.md ~1 KB, promptMain ~17 KB, not 20-byte stubs).
8. Wait Vercel production READY for the SHA. Then tell Ezra to hard-refresh yard.wiki.
9. If you finished Cut A, edit `docs/BOT.md` NEXT so the next fire does not redo it. Log a line on `docs/REFINEMENT.md`.

Git identity on this repo: EzServices-wpd \<ezlent11@gmail.com\>. Do not change it.

## 17. The ten launch builds

House PDFs must be followable. Weekend uses the same engine, not the hero.

```
1  pocket   (full survey below, or chip "pocket vanity")
2  linen    linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep
3  window   Andersen 100 Series 36 by 48 double hung window, frame the rough opening
4  desk     desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space
5  pantry   hall pantry 24 wide by 84 tall by 14 deep, 5 shelves, 3/4 inch plywood
6  bench    mudroom bench 48 wide by 18 deep by 18 high with 3 cubbies
7  bookcase kids bookcase 30 wide by 11 deep by 48 high, 4 shelves
8  media    media console 60 wide by 16 deep by 24 high, two doors, open center
9  eiffel   3 foot Eiffel Tower from popsicle sticks
10 arch     6 foot garden arch from 3/4 inch PVC pipe
```

### Original pocket survey (freeze #1) — do not paraphrase sizes

```
I have a pocket space in my bathroom with these exact dimensions:
Back wall: 38.5 inches wide. Left side depth: 26 inches. Right side depth: 33.5 inches. All walls: 102 inches high. Open to the front.
The side walls are angled (almost trapezoidal): at 20 inches perpendicular from the back wall, the opening is 46 inches wide. Left of centerline at 20": 25 inches. Right of centerline at 20": 21 inches. Left wall angle ≈ 16.05°. Right wall angle ≈ 5.00°.
I want mixed-use towel and linen storage as well as a vanity space.
A centered rectangular unit 38 inches wide × 17 inches deep × 102 inches high. Front face parallel to the back wall, centered on the back-wall centerline. At 17" depth: about 5.1" clearance on the left and 1.7" on the right.
Centered vanity with open knee space (≈22 inches clear) under a counter at 34 inches high. Drawers on either side of the knee space. Upper cabinetry from 54 inches to the ceiling (102"). Large doors with adjustable shelving for towels and linens. Mirror and storage beside the chair space. Structurally centered and anchored into studs.
```

Constants the engine must not “improve”: back 38.5, left 26, right 33.5, walls 102, unit 38 × 17 × 102, knee 22, counter 34, upper start 54, station 20, left-of-CL 25, right-of-CL 21, angles ≈ 16.05° / 5.00°. Unit stays rectangular. The pocket is the thing that is wonky. Front parallel to the back wall, centered on the back-wall centerline.

## 18. Parked, never, and the closeout checklist

**Parked (do not pick these up)**

- Lounge / desk / bedside / media-ledge AABB catalog width
- New form classes, new noun files, wine racks as a new program
- Hourly overnight bot / Grok Automations cadence
- Amazon Associates tag, retailer adapters on by default
- Accounts, Neon `yards` table, cross-device save
- Plausible until Ezra creates the site and sets env
- Paper/2D chips back on the homepage

**Stage 3 (founder, not bot).** Domain yard.wiki is live. OG unfurls. Soft-launch 3.3a is *Ezra walks the freeze on production*. 3.3b is one named stranger. Public launch is house PDFs followable + Ezra’s go on Amazon/accounts. You do not declare launch.

**Closeout checklist for every fire**

1. Canary green: linen 31.5×78×16 named Linen; pocket vanity with `project.pocket`, not House.
2. Walk-launch 10/10. Linen nameIncludes is Linen.
3. No PLACEHOLDER in product files. No file you touched collapsed to a stub.
4. B + C still in the workspace: Get the plan, nest-as-hero, unit overlay, weekend folded.
5. You shipped at most one NEXT item, or you only fixed a red canary.
6. `docs/BOT.md` NEXT still true.
7. Pushed to EzServices-wpd/yard main. Vercel READY. Told Ezra to hard-refresh.

The job, in one sentence: **make a stranger able to type a hole, buy the parts at HD, and build it this weekend — starting with linen 31.5 × 78 × 16 and the original pocket vanity — without lying about a size, a thickness, or a name.**

Yard is guidance only — not stamped engineering or a substitute for local building codes. Tip referenced: `3af4e7b` (20 Sep 2026). Update the tip line in `docs/BOT.md` when main moves; do not let a SHA in this brief become a stale freeze. The rules do not go stale. The SHA does.
