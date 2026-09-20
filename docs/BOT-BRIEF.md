# Yard — Bot briefing

20 September 2026 · Tip `3af4e7b` · [yard.wiki](https://yard.wiki) · `EzServices-wpd/yard`

You are not writing a furniture encyclopedia. You are making a plan a stranger can take to the lumber aisle for the hole they actually have. If a Saturday builder cannot finish from the PDF, Yard is not done. Everything else is noise.

**Type it. Buy the parts. Build it.**  
*The plan the lumber aisle should have printed.*

One-page queue: [`docs/BOT.md`](BOT.md). First command every fire:

```
npx tsx --tsconfig tsconfig.json scripts/walk-canary.ts
```

- Green → one NEXT item. Ship full files. Walk canary again.
- Red → fix *that* canary. Stop. Do not invent a FAIL class. Do not open `fitted.ts`.

If this brief conflicts with a red canary, the canary wins. If it conflicts with a new FAIL class in `yard-honesty-guards.ts`, this brief wins.

---

## 1. The product that still does not exist

Yard started as one bathroom. A pocket with angled walls: 38.5" back, 26" left, 33.5" right, 102" to the ceiling. Mixed-use: a vanity you can sit at, towels and linen above. Not a catalog module. **That hole.**

| Thing | What it does | Why it is not Yard |
|---|---|---|
| IKEA PAX / kitchen planners | Their boxes in their grid | Your 31.5" alcove does not exist in their system |
| SketchUp / Fusion / Polyboard | CAD if you already know CAD | The stranger never opens it. No HD SKUs. No nest. |
| ChatGPT / generic AI | A plausible-sounding cut list | Invents sizes. Does not nest a 4×8. Thinks “chair space” is a chair. |
| Home Depot project sheets | A generic 36" vanity | Not your trapezoid. Not your 16" depth. |
| A contractor | A real unit, months and thousands | Yard is the Saturday path |

**The gap is still:** this prompt + this opening + real SKUs → a 3D unit you can trust → a PDF you can follow → links you can buy.

Close that gap and Yard is a category. Widen the catalog and Yard is a demo farm.

House is the hero. Weekend crafts (Eiffel from popsicle sticks, a PVC arch) prove it is **one engine**, not a closet configurator with a toy mode. Grok writes **voice and true-form**, never SKUs. Geometry is deterministic. If the prompt said 31.5, the HUD, the unit, the cut list, and the PDF all say 31.5. Inventing a size is the original sin.

---

## 2. What “next level” looks like

Next level is not more nouns. Next level is a stranger finishing a real build from a Yard PDF without Ezra in the room.

1. Someone types `linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep`.
2. The bench shows **that unit** — 31.5 × 78 × 16 — not craft chrome, not a measure sidebar they did not ask for, not a House made of arches.
3. They hit **Get the plan**. The drawer opens on the sheet: lettered parts on a 4×8, then the cut list, then buy.
4. They export. Page 1 is the nest. The backer is 1/4" and bought as 1/4". Steps say “main box” and “kick strip,” name the letters on the plate, and tell them where the shelves land.
5. They walk into Home Depot with the PDF, buy the sheets and the hinges, and finish on a Saturday.

The same loop for the original pocket: a rectangular 38 × 17 × 102 vanity centered on the back-wall centerline, 22" knee, drawers in the wings, uppers from 54 to 102, in a trapezoid that is actually angled. Not a weekend House.

When those two PDFs are documents you would hand a first-timer, bring the rest of the freeze 10 to that bar. Then a photograph of a real alcove becomes input. Then buy links can take a tag. Then accounts. **Not before.**

Landing stills under `public/heroes/*.jpg` are **bench renders**, not photographs of real rooms. Slice D is the photo. Do not generate a fake room and call it a photograph.

---

## 3. Where Yard actually is (20 Sep 2026)

Engine honesty ~90%. Stranger-finish ~50%. That is the whole status.

**Keep (do not redo):**

| What | Tip |
|---|---|
| House-path ease — unit as hero, Get the plan, weekend folded, measure on the unit | `d2eb082` |
| Nest as hero — lettered 4×8 first in the drawer and PDF page 1 | `29a1cbf` |
| Voice/PDF kit — parts-plate letters, one-join, main box / kick strip, hardware class | `234e247` `0a1e835` |
| Pocket “chair space” is knee room — freeze #1 is a vanity again | `3af4e7b` |

**Still lying / not done:**

- **Cut A** — linen (and pocket) back is 0.25" but `materialId` is still `plywood-3-4`. Next fire.
- **Slice D** — real alcove photograph.
- Pocket PDF not yet walked as a stranger finish (routing is fixed; the printed plan is not linen-quality yet).
- Amazon / accounts — ask Ezra.

**The treadmill that stole September:** after slice C the bot spent the morning on FAIL-class catalog width (lounge Seat D/W, AABB H, bedside, media ledge, bamboo plurals). Honest in isolation. Not the product. `fitted.ts` ~4,800 lines. `yard-honesty-guards.ts` ~3,760. Growing those files is how Yard stalls.

---

## 4. Laws

1. **Never invent a size.** If the prompt did not give it, do not print it as fact.
2. **Linen is 31.5 × 78 × 16.** Name, HUD, opening, overall, cut list. Kind closet. Name includes **Linen**.
3. **The original pocket is a vanity in a trapezoid.** `project.pocket` set. Kind closet. Never House. “Chair space” is knee room. “Cabinetry” is not a cabin.
4. **Grok writes voice, not SKUs.** Geometry is code.
5. **House-first.** Crafts one click away. No paper chips on the house path.
6. **Full files.** Never PLACEHOLDER. Never wipe `canvas.tsx`, `stick-cloud.tsx`, `steps.ts`, `nest-plate.tsx`.
7. **One engine.** No new form classes. Untaught house nouns reuse a shape. Closets never enter the loft.
8. **Ask before money and accounts.**

---

## 5. Two paths, one engine

**House:** closet / fitted / pocket / opening. Space first, rectangular unit second. Panels, nest, hardware, Get the plan. Homepage, PDF, later money.

`promptMain.ts` → `parsePocket` / `parseBrief` / `buildFitted` / `buildPocket` / `windows.ts` → `steps.ts` · `report.ts` · `nesting.ts` · `pdf.ts`

**Weekend:** named form or anatomy → stock on a wire → weld / stitch / downward path. Eiffel, PVC arch. Same plan pipeline. Not the hero. Must keep working.

**Routing:** house branch unless climb-primary / porch swing / Adirondack / real sit-chair. Lounge class is fitted sit anatomy and may enter. If `looksLikePocket`, **`parsePocket` → `buildPocket` before `parseBrief`**.

`namesSitChair` strips `chair space` / `chair-space` before `\bchair\b`. House form is `\bcabin\b`, not `/cabin/` (cabinetry is not a cabin).

---

## 6. Freeze 10

```
npx tsx --tsconfig tsconfig.json scripts/walk-canary.ts
npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
npx tsx --tsconfig tsconfig.json scripts/walk-soft-launch.ts
```

| # | Prompt | Must be |
|---|---|---|
| 1 | `POCKET_DREAM` original survey | closet, name vanity, `project.pocket`, unit ~38×102×17, **never House** |
| 2 | `linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep` | closet, name **Linen**, 31.5×78×16 overall and unit |
| 3 | `Andersen 100 Series 36 by 48 double hung window, frame the rough opening` | kind opening |
| 4 | `desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space` | Desk 60×29×30, 24" knee |
| 5 | `hall pantry 24 wide by 84 tall by 14 deep, 5 shelves, 3/4 inch plywood` | Pantry 24×84×14 |
| 6 | `mudroom bench 48 wide by 18 deep by 18 high with 3 cubbies` | Bench 48×18×18 |
| 7 | `kids bookcase 30 wide by 11 deep by 48 high, 4 shelves` | Bookcase 30×48×11 |
| 8 | `media console 60 wide by 16 deep by 24 high, two doors, open center` | Media 60×24×16 |
| 9 | `3 foot Eiffel Tower from popsicle sticks` | kind eiffel, whole sticks |
| 10 | `6 foot garden arch from 3/4 inch PVC pipe` | kind arch |

Intake: `bathroom vanity` is counter-height, not linen. `pocket vanity` (chip) fills Ezra’s bathroom and keeps 102" mixed-use.

Walked green at `3af4e7b`: canary, 10/10 launch, 10/10 soft-launch. Linen 11 panels / 8 steps / ~$161. Pocket 26 panels / 15 steps / 18 cuts / ~$451.

---

## 7. Queue — push hard, one fire at a time

### Fire 1 — Cut A honesty (do this now)

Linen back is 0.25". The cut step already says 1/4" plywood (backer). Panel still carries `plywood-3-4-4x8`. Pocket does the same in `buildPocket`. Catalog already has `plywood-1-4-4x8`. Nest already keeps thin off the 3/4 sheet.

**Fix:** any back / backer ≤ 0.5" thick gets the 1/4" id so cut list, buy, and nest agree. Touch the panel factory.

**Do not:** change 31.5×78×16. Nest 1/4 onto the 3/4 sheet. Invent a 4×10. Open a lounge file.

**Done when:** canary green; linen still 31.5×78×16; backer buy line is 1/4; pocket matches; walk-launch 10/10.

### Fire 2 — Pocket stranger PDF

Routing is fixed. Read the PDF as a first-timer in that bathroom. Letters match. Knee 22" open. Counter 34. Uppers 54→102. Slides fit 17" depth (not 22" slides). Main box / kick strip. Shim and lag into studs.

**Done when:** you would hand the PDF to someone who has never built a cabinet.

### Fire 3 — Slice D, a real alcove photograph

Landing already uses `/heroes/pocket.jpg` `linen.jpg` `desk.jpg` — 1280×960 bench stills. The vision is a photograph of a real hole. If Ezra has not given photographs, **ask**. Do not generate a fake room.

### Fire 4 — The other six house PDFs to linen bar

Desk, pantry, bench, bookcase, media, Andersen. Same test: nest page 1, letters, buy matches hardware, stranger steps, prompt sizes. Not new anatomy.

### After that — ask Ezra

Amazon tag. Accounts. Soft-launch audience (founder walks first, then one named stranger).

**Parked:** lounge / desk / AABB catalog width. New form classes. Hourly bot. Paper chips. PLACEHOLDER. Invented sizes. Wiping canvas / stick-cloud / steps / nest-plate.

---

## 8. Worked example — freeze #1 pocket

The original prompt is `POCKET_DREAM` in `src/lib/yard/pocket.ts`. The chip `pocket vanity` fills that survey.

**What went wrong:** `\bchair\b` matched “chair space,” skipped house/fitted, `/cabin/` matched “cabinetry,” detectForm returned House. Name House, 0 cuts, invented 39.5×102.5×18, arches/piers.

**What is true now:** Bathroom pocket vanity, 38×102×17, 26 panels, 18 cuts, 15 steps.

**Lesson:** when a freeze build densifies as the wrong kind, fix routing. Do not add a PocketHouse FAIL class. Do not teach honesty-guards a new noun.

---

## 9. Voice

`src/lib/yard/voiceHonesty.ts` — use it. Do not invent a new voice file.

- `strangerPlainShopTalk`: carcase → main box, toekick → kick strip
- Parts-plate letters in the steps (“Attach D bottom to both C uprights”)
- One-join densify
- Hardware class match (piano stays piano; lid stay stays lid stay)
- Shelf heights AFF / from the bottom
- Buy lines match densify (16" slides on a 17" pocket; 1/4 backer on a 0.25" back)

The PDF is the product. The bench is how we believe the PDF. If they disagree, the PDF is wrong.

---

## 10. Ship a slice

1. Canary. If red, that is the slice.
2. Smallest change that makes the stranger PDF more true.
3. Canary again. `walk-launch.ts`. Soft-launch if you touched ply / nest / steps.
4. Commit `fix(yard):` / `feat(yard):` naming the honesty, not the helper.
5. Rebase if origin moved. Do not force-push main.
6. Push **full files**. Confirm GitHub sizes are real.
7. Wait Vercel READY on project yard (BuildHQ).
8. Tell Ezra to hard-refresh yard.wiki and what to look at.

Stay on `EzServices-wpd/yard`. Live product is yard.wiki. Guidance only — not stamped engineering.

---

## 11. Charge

If the canary is red, that is the job. If it is green: **Cut A**, then the pocket PDF, then a real photograph if Ezra has one, then the rest of the house ten at linen quality.

Do not open `fitted.ts` to teach Yard a lounge chair. Do not invent a size. Do not leave a stub. Do not restart the hourly bot. Do not match chair space as a chair.

Type it. Buy the parts. Build it. The lumber aisle should have printed this. You are the one who makes sure it is worth printing.
