# Equal-bay movers

Against release `c230ab55348aa963937de462a6eb162460a41a1e`, before this change. The grade is the model, the steps, and the Buy names and quantities. A catalog total that follows those parts is not its own grade.

`placeBayDividers` had counted divider thickness when it chose how many bays, then set the centres by splitting the whole run. Each end bay came out wider by half the divider. Centres now sit so every clear bay is `(span − (k − 1) × thickness) / k`. A two-bay split was already one centre. Builder bays (`Bay divider`) are a different placer and stay as they were.

## Headlines (reproduced on this tip)

| Prompt | Before | After |
|---|---|---|
| `closet 72 wide` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood` | 13 5/16, 13 1/16, 13 5/16 | 13 1/4, 13 1/4, 13 1/4 |
| `bookcase 96 wide 72 tall 12 deep` | 23 1/4, 22 7/8, 22 7/8, 23 1/4 | 23 1/16, 23 1/16, 23 1/16, 23 1/16 |
| `bookcase 72 wide from pine boards` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `bookcase 96 wide from pine boards` | 23 1/4, 22 7/8, 22 7/8, 23 1/4 | 23 1/16 × 4 |

The older cabinet note (about 13 5/12, 13 1/6, 13 5/12) is not this tip. On this tip the opening between the sides is 40 3/4", and the three bays plus two 1/2" dividers fill it: 3 × 13 1/4 + 2 × 1/2 = 40 3/4. Closet 72 fills 70 1/2" as 3 × 23 + 2 × 3/4.

Step titles did not change on these prompts. The span note keeps its sentence; only the measured "or less" opening changes (closet 72: 23 1/8" → 23"). Buy names did not change. Board quantities are the table below. The half-inch plywood Buy line is recorded separately because that displayed count is not the nest.

## Buy quantities

Against release `c230ab55348aa963937de462a6eb162460a41a1e`. Step titles did not change. Buy names did not change. A catalog total is not a grade. The sets below are the comparison that was run. They are not a proof that no prompt outside them moves.

- Width and stock sweeps, 10,223 prompts: 17 storage hosts at widths 36–120. Pine is every inch. Plain, MDF, 1/2" plywood, 1×10, 1×12, and oak are every inch as well. A few sized pine and half-ply samples were included (72 tall 12 deep, 84 tall 16 deep, 48 tall 12 deep in 1/2" plywood).
- Height and depth grid, 18,879 prompts: those hosts at widths 48, 55, 56, 58, 60, 64, 70, 72, 75, 80, 84, 90, 96, 100, 108, 119, and 120; heights 48, 60, 72, 78, 84, 90, and 96; depths 12, 14, and 16; stocks `from pine boards`, `from oak`, and `from 1x10`. Bookcase, bookshelf, closet, cabinet, wardrobe, pantry, and pantry cabinet also vary at widths 72/96/108/120, heights 48/60/72/78/84/90, depths 12/14, `in 1/2 inch plywood` and `from MDF`.

The union has 2353 prompts whose Buy quantity changes, each on one line. 2 of them are the half-ply Buy display below and are not a packing-validated SKU count. The other 2351 are board counts: Pine 1×4 on 837, Oak 1×4 on 837, 1×10 Board (8 ft) on 677. All 36 sized neighbors from the r2 grade are in this board table.

## Half-inch plywood Buy is not the nest

`bookcase 108 wide 48 tall 12 deep in 1/2 inch plywood` and `bookshelf 108 wide 48 tall 12 deep in 1/2 inch plywood` both change the Buy line `1/2" Plywood 4×8` from 4 to 3. `3/4" Plywood 4×10` stays 1. That 4→3 is what Buy shows. It is not the packing-validated quantity of the 1/2" sheet.

The plan nest, counted per stock and sheet size:

| Nest stock | Base sheets | Head sheets |
|---|---:|---:|
| 1/2" plywood 4×8 | 1 | 1 |
| 3/4" plywood 4×8 | 3 | 2 |
| 3/4" plywood 4×10 | 1 | 1 |

Buy folds every 4×8 structural sheet into the 1/2" line, so base Buy 4 is 1 thin plus 3 thick, and head Buy 3 is 1 thin plus 2 thick. The 3/4" 4×8 line is omitted. The same fold is already on the base. The bay formula did not introduce it, and this list does not change how Buy chooses sheets.

## Board quantities

| Prompt | Buy line | Before | After |
|---|---|---:|---:|
| `bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `bookcase 119 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookcase 119 wide 48 tall 12 deep from oak` | Oak 1×4 | 50 | 47 |
| `bookcase 119 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 50 | 47 |
| `bookcase 119 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookcase 119 wide 48 tall 14 deep from oak` | Oak 1×4 | 51 | 49 |
| `bookcase 119 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 51 | 49 |
| `bookcase 119 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookcase 119 wide 48 tall 16 deep from oak` | Oak 1×4 | 62 | 59 |
| `bookcase 119 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 62 | 59 |
| `bookcase 119 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookcase 119 wide 72 tall 12 deep from oak` | Oak 1×4 | 55 | 53 |
| `bookcase 119 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 55 | 53 |
| `bookcase 119 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookcase 119 wide 72 tall 14 deep from oak` | Oak 1×4 | 57 | 55 |
| `bookcase 119 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 57 | 55 |
| `bookcase 119 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookcase 119 wide 72 tall 16 deep from oak` | Oak 1×4 | 69 | 67 |
| `bookcase 119 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 69 | 67 |
| `bookcase 119 wide 78 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 119 wide 78 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookcase 119 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookcase 119 wide 78 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookcase 119 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookcase 119 wide 84 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 119 wide 84 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookcase 119 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookcase 119 wide 84 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookcase 119 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookcase 119 wide 90 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 119 wide 90 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookcase 119 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookcase 119 wide 90 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookcase 119 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookcase 119 wide 96 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 119 wide 96 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookcase 119 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookcase 119 wide 96 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookcase 119 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 120 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookcase 120 wide 48 tall 12 deep from oak` | Oak 1×4 | 55 | 57 |
| `bookcase 120 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 55 | 57 |
| `bookcase 120 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookcase 120 wide 48 tall 14 deep from oak` | Oak 1×4 | 56 | 58 |
| `bookcase 120 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 56 | 58 |
| `bookcase 120 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookcase 120 wide 48 tall 16 deep from oak` | Oak 1×4 | 69 | 71 |
| `bookcase 120 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 69 | 71 |
| `bookcase 120 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookcase 120 wide 60 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `bookcase 120 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `bookcase 120 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookcase 120 wide 60 tall 14 deep from oak` | Oak 1×4 | 59 | 61 |
| `bookcase 120 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 59 | 61 |
| `bookcase 120 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookcase 120 wide 60 tall 16 deep from oak` | Oak 1×4 | 72 | 74 |
| `bookcase 120 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 72 | 74 |
| `bookcase 120 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookcase 120 wide 72 tall 12 deep from oak` | Oak 1×4 | 60 | 62 |
| `bookcase 120 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `bookcase 120 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookcase 120 wide 72 tall 14 deep from oak` | Oak 1×4 | 62 | 64 |
| `bookcase 120 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 62 | 64 |
| `bookcase 120 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookcase 120 wide 72 tall 16 deep from oak` | Oak 1×4 | 75 | 78 |
| `bookcase 120 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 75 | 78 |
| `bookcase 120 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 78 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 120 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 78 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookcase 120 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookcase 120 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 78 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookcase 120 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookcase 120 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 84 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 120 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 84 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookcase 120 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookcase 120 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 84 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookcase 120 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookcase 120 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 90 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 120 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 90 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookcase 120 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookcase 120 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 90 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookcase 120 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookcase 120 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 96 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 120 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 96 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookcase 120 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookcase 120 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookcase 120 wide 96 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookcase 120 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookcase 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookcase 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookcase 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookcase 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 39 | 41 |
| `bookcase 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `bookcase 58 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookcase 58 wide 48 tall 12 deep from oak` | Oak 1×4 | 28 | 29 |
| `bookcase 58 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `bookcase 58 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookcase 58 wide 48 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `bookcase 58 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `bookcase 58 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookcase 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 35 | 37 |
| `bookcase 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 35 | 37 |
| `bookcase 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookcase 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookcase 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookcase 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookcase 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookcase 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookcase 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookcase 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookcase 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookcase 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 58 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 78 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 58 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 78 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookcase 58 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookcase 58 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookcase 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookcase 58 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 84 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 58 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 84 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookcase 58 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookcase 58 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookcase 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookcase 58 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 90 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 58 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 90 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookcase 58 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookcase 58 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookcase 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookcase 58 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 96 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 58 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 96 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookcase 58 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookcase 58 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookcase 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookcase 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `bookcase 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 33 | 35 |
| `bookcase 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `bookcase 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `bookcase 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `bookcase 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookcase 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookcase 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 35 | 36 |
| `bookcase 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `bookcase 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 36 | 38 |
| `bookcase 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 36 | 38 |
| `bookcase 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookcase 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 43 | 45 |
| `bookcase 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 43 | 45 |
| `bookcase 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookcase 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 37 | 39 |
| `bookcase 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `bookcase 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookcase 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 39 | 41 |
| `bookcase 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `bookcase 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookcase 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 47 | 49 |
| `bookcase 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `bookcase 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookcase 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookcase 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookcase 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookcase 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookcase 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookcase 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookcase 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookcase 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookcase 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookcase 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookcase 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookcase 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookcase 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookcase 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookcase 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookcase 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `bookcase 96 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookcase 96 wide 48 tall 12 deep from oak` | Oak 1×4 | 43 | 46 |
| `bookcase 96 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 43 | 46 |
| `bookcase 96 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookcase 96 wide 48 tall 14 deep from oak` | Oak 1×4 | 44 | 48 |
| `bookcase 96 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 44 | 48 |
| `bookcase 96 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookcase 96 wide 48 tall 16 deep from oak` | Oak 1×4 | 54 | 58 |
| `bookcase 96 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 54 | 58 |
| `bookcase 96 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookcase 96 wide 60 tall 12 deep from oak` | Oak 1×4 | 45 | 48 |
| `bookcase 96 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 45 | 48 |
| `bookcase 96 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookcase 96 wide 60 tall 14 deep from oak` | Oak 1×4 | 46 | 50 |
| `bookcase 96 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 46 | 50 |
| `bookcase 96 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookcase 96 wide 60 tall 16 deep from oak` | Oak 1×4 | 56 | 60 |
| `bookcase 96 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 56 | 60 |
| `bookcase 96 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookcase 96 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 51 |
| `bookcase 96 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 51 |
| `bookcase 96 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookcase 96 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 53 |
| `bookcase 96 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `bookcase 96 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookcase 96 wide 72 tall 16 deep from oak` | Oak 1×4 | 60 | 64 |
| `bookcase 96 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 60 | 64 |
| `bookcase 96 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 78 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookcase 96 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 78 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookcase 96 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookcase 96 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 78 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookcase 96 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookcase 96 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 84 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookcase 96 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 84 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookcase 96 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookcase 96 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 84 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookcase 96 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookcase 96 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 90 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookcase 96 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 90 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookcase 96 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookcase 96 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 90 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookcase 96 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookcase 96 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 96 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookcase 96 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 96 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookcase 96 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookcase 96 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookcase 96 wide 96 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookcase 96 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `bookshelf 119 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookshelf 119 wide 48 tall 12 deep from oak` | Oak 1×4 | 50 | 47 |
| `bookshelf 119 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 50 | 47 |
| `bookshelf 119 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookshelf 119 wide 48 tall 14 deep from oak` | Oak 1×4 | 51 | 49 |
| `bookshelf 119 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 51 | 49 |
| `bookshelf 119 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `bookshelf 119 wide 48 tall 16 deep from oak` | Oak 1×4 | 62 | 59 |
| `bookshelf 119 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 62 | 59 |
| `bookshelf 119 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookshelf 119 wide 72 tall 12 deep from oak` | Oak 1×4 | 55 | 53 |
| `bookshelf 119 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 55 | 53 |
| `bookshelf 119 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookshelf 119 wide 72 tall 14 deep from oak` | Oak 1×4 | 57 | 55 |
| `bookshelf 119 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 57 | 55 |
| `bookshelf 119 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `bookshelf 119 wide 72 tall 16 deep from oak` | Oak 1×4 | 69 | 67 |
| `bookshelf 119 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 69 | 67 |
| `bookshelf 119 wide 78 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 119 wide 78 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookshelf 119 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookshelf 119 wide 78 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookshelf 119 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookshelf 119 wide 84 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 119 wide 84 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookshelf 119 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookshelf 119 wide 84 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookshelf 119 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookshelf 119 wide 90 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 119 wide 90 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookshelf 119 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookshelf 119 wide 90 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookshelf 119 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookshelf 119 wide 96 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 119 wide 96 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `bookshelf 119 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `bookshelf 119 wide 96 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `bookshelf 119 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `bookshelf 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 120 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookshelf 120 wide 48 tall 12 deep from oak` | Oak 1×4 | 55 | 57 |
| `bookshelf 120 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 55 | 57 |
| `bookshelf 120 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookshelf 120 wide 48 tall 14 deep from oak` | Oak 1×4 | 56 | 58 |
| `bookshelf 120 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 56 | 58 |
| `bookshelf 120 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `bookshelf 120 wide 48 tall 16 deep from oak` | Oak 1×4 | 69 | 71 |
| `bookshelf 120 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 69 | 71 |
| `bookshelf 120 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookshelf 120 wide 60 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `bookshelf 120 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `bookshelf 120 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookshelf 120 wide 60 tall 14 deep from oak` | Oak 1×4 | 59 | 61 |
| `bookshelf 120 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 59 | 61 |
| `bookshelf 120 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `bookshelf 120 wide 60 tall 16 deep from oak` | Oak 1×4 | 72 | 74 |
| `bookshelf 120 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 72 | 74 |
| `bookshelf 120 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookshelf 120 wide 72 tall 12 deep from oak` | Oak 1×4 | 60 | 62 |
| `bookshelf 120 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `bookshelf 120 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookshelf 120 wide 72 tall 14 deep from oak` | Oak 1×4 | 62 | 64 |
| `bookshelf 120 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 62 | 64 |
| `bookshelf 120 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `bookshelf 120 wide 72 tall 16 deep from oak` | Oak 1×4 | 75 | 78 |
| `bookshelf 120 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 75 | 78 |
| `bookshelf 120 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 78 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 120 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 78 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookshelf 120 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookshelf 120 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 78 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookshelf 120 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookshelf 120 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 84 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 120 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 84 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookshelf 120 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookshelf 120 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 84 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookshelf 120 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookshelf 120 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 90 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 120 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 90 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookshelf 120 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookshelf 120 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 90 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookshelf 120 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookshelf 120 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 96 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 120 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 96 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `bookshelf 120 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `bookshelf 120 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `bookshelf 120 wide 96 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `bookshelf 120 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookshelf 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookshelf 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookshelf 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookshelf 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookshelf 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 39 | 41 |
| `bookshelf 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `bookshelf 58 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookshelf 58 wide 48 tall 12 deep from oak` | Oak 1×4 | 28 | 29 |
| `bookshelf 58 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `bookshelf 58 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookshelf 58 wide 48 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `bookshelf 58 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `bookshelf 58 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `bookshelf 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 35 | 37 |
| `bookshelf 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 35 | 37 |
| `bookshelf 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookshelf 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookshelf 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookshelf 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookshelf 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `bookshelf 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `bookshelf 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `bookshelf 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `bookshelf 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `bookshelf 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 58 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 78 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 58 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 78 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookshelf 58 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookshelf 58 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookshelf 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookshelf 58 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 84 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 58 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 84 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookshelf 58 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookshelf 58 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookshelf 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookshelf 58 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 90 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 58 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 90 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookshelf 58 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookshelf 58 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookshelf 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookshelf 58 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 96 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 58 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 96 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `bookshelf 58 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `bookshelf 58 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `bookshelf 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `bookshelf 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `bookshelf 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `bookshelf 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 33 | 35 |
| `bookshelf 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `bookshelf 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `bookshelf 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `bookshelf 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookshelf 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookshelf 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 35 | 36 |
| `bookshelf 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `bookshelf 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 36 | 38 |
| `bookshelf 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 36 | 38 |
| `bookshelf 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `bookshelf 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 43 | 45 |
| `bookshelf 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 43 | 45 |
| `bookshelf 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookshelf 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 37 | 39 |
| `bookshelf 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `bookshelf 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookshelf 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 39 | 41 |
| `bookshelf 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `bookshelf 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `bookshelf 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 47 | 49 |
| `bookshelf 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `bookshelf 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookshelf 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookshelf 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookshelf 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookshelf 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookshelf 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookshelf 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookshelf 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookshelf 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookshelf 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookshelf 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookshelf 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookshelf 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `bookshelf 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `bookshelf 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `bookshelf 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `bookshelf 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookshelf 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `bookshelf 96 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookshelf 96 wide 48 tall 12 deep from oak` | Oak 1×4 | 43 | 46 |
| `bookshelf 96 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 43 | 46 |
| `bookshelf 96 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookshelf 96 wide 48 tall 14 deep from oak` | Oak 1×4 | 44 | 48 |
| `bookshelf 96 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 44 | 48 |
| `bookshelf 96 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `bookshelf 96 wide 48 tall 16 deep from oak` | Oak 1×4 | 54 | 58 |
| `bookshelf 96 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 54 | 58 |
| `bookshelf 96 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookshelf 96 wide 60 tall 12 deep from oak` | Oak 1×4 | 45 | 48 |
| `bookshelf 96 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 45 | 48 |
| `bookshelf 96 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookshelf 96 wide 60 tall 14 deep from oak` | Oak 1×4 | 46 | 50 |
| `bookshelf 96 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 46 | 50 |
| `bookshelf 96 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `bookshelf 96 wide 60 tall 16 deep from oak` | Oak 1×4 | 56 | 60 |
| `bookshelf 96 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 56 | 60 |
| `bookshelf 96 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookshelf 96 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 51 |
| `bookshelf 96 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 51 |
| `bookshelf 96 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookshelf 96 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 53 |
| `bookshelf 96 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `bookshelf 96 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `bookshelf 96 wide 72 tall 16 deep from oak` | Oak 1×4 | 60 | 64 |
| `bookshelf 96 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 60 | 64 |
| `bookshelf 96 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 78 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 96 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 78 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookshelf 96 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookshelf 96 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 78 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookshelf 96 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookshelf 96 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 84 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 96 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 84 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookshelf 96 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookshelf 96 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 84 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookshelf 96 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookshelf 96 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 90 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 96 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 90 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookshelf 96 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookshelf 96 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 90 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookshelf 96 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookshelf 96 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 96 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 96 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 96 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `bookshelf 96 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `bookshelf 96 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `bookshelf 96 wide 96 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `bookshelf 96 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookshelf 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `built-in bookcase 119 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `built-in bookcase 119 wide 48 tall 12 deep from oak` | Oak 1×4 | 50 | 47 |
| `built-in bookcase 119 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 50 | 47 |
| `built-in bookcase 119 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `built-in bookcase 119 wide 48 tall 14 deep from oak` | Oak 1×4 | 51 | 49 |
| `built-in bookcase 119 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 51 | 49 |
| `built-in bookcase 119 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `built-in bookcase 119 wide 48 tall 16 deep from oak` | Oak 1×4 | 62 | 59 |
| `built-in bookcase 119 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 62 | 59 |
| `built-in bookcase 119 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `built-in bookcase 119 wide 72 tall 12 deep from oak` | Oak 1×4 | 55 | 53 |
| `built-in bookcase 119 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 55 | 53 |
| `built-in bookcase 119 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `built-in bookcase 119 wide 72 tall 14 deep from oak` | Oak 1×4 | 57 | 55 |
| `built-in bookcase 119 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 57 | 55 |
| `built-in bookcase 119 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `built-in bookcase 119 wide 72 tall 16 deep from oak` | Oak 1×4 | 69 | 67 |
| `built-in bookcase 119 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 69 | 67 |
| `built-in bookcase 119 wide 78 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 78 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 78 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 84 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 84 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 84 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 90 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 90 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 90 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 96 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 119 wide 96 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `built-in bookcase 119 wide 96 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `built-in bookcase 119 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `built-in bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 120 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `built-in bookcase 120 wide 48 tall 12 deep from oak` | Oak 1×4 | 55 | 57 |
| `built-in bookcase 120 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 55 | 57 |
| `built-in bookcase 120 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `built-in bookcase 120 wide 48 tall 14 deep from oak` | Oak 1×4 | 56 | 58 |
| `built-in bookcase 120 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 56 | 58 |
| `built-in bookcase 120 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `built-in bookcase 120 wide 48 tall 16 deep from oak` | Oak 1×4 | 69 | 71 |
| `built-in bookcase 120 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 69 | 71 |
| `built-in bookcase 120 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `built-in bookcase 120 wide 60 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `built-in bookcase 120 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `built-in bookcase 120 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `built-in bookcase 120 wide 60 tall 14 deep from oak` | Oak 1×4 | 59 | 61 |
| `built-in bookcase 120 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 59 | 61 |
| `built-in bookcase 120 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `built-in bookcase 120 wide 60 tall 16 deep from oak` | Oak 1×4 | 72 | 74 |
| `built-in bookcase 120 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 72 | 74 |
| `built-in bookcase 120 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `built-in bookcase 120 wide 72 tall 12 deep from oak` | Oak 1×4 | 60 | 62 |
| `built-in bookcase 120 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `built-in bookcase 120 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `built-in bookcase 120 wide 72 tall 14 deep from oak` | Oak 1×4 | 62 | 64 |
| `built-in bookcase 120 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 62 | 64 |
| `built-in bookcase 120 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `built-in bookcase 120 wide 72 tall 16 deep from oak` | Oak 1×4 | 75 | 78 |
| `built-in bookcase 120 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 75 | 78 |
| `built-in bookcase 120 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 78 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 78 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 78 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 84 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 84 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 84 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 90 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 90 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 90 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 96 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 120 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 96 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `built-in bookcase 120 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `built-in bookcase 120 wide 96 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `built-in bookcase 120 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `built-in bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `built-in bookcase 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `built-in bookcase 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `built-in bookcase 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `built-in bookcase 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 39 | 41 |
| `built-in bookcase 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `built-in bookcase 58 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `built-in bookcase 58 wide 48 tall 12 deep from oak` | Oak 1×4 | 28 | 29 |
| `built-in bookcase 58 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `built-in bookcase 58 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `built-in bookcase 58 wide 48 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `built-in bookcase 58 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `built-in bookcase 58 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `built-in bookcase 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 35 | 37 |
| `built-in bookcase 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 35 | 37 |
| `built-in bookcase 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `built-in bookcase 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `built-in bookcase 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `built-in bookcase 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `built-in bookcase 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `built-in bookcase 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `built-in bookcase 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `built-in bookcase 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `built-in bookcase 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `built-in bookcase 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 58 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 78 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 78 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 84 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 84 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 90 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 90 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 96 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 58 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 96 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `built-in bookcase 58 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `built-in bookcase 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `built-in bookcase 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `built-in bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `built-in bookcase 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 33 | 35 |
| `built-in bookcase 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `built-in bookcase 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `built-in bookcase 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `built-in bookcase 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 35 | 36 |
| `built-in bookcase 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `built-in bookcase 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 36 | 38 |
| `built-in bookcase 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 36 | 38 |
| `built-in bookcase 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `built-in bookcase 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 43 | 45 |
| `built-in bookcase 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 43 | 45 |
| `built-in bookcase 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `built-in bookcase 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 37 | 39 |
| `built-in bookcase 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `built-in bookcase 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `built-in bookcase 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 39 | 41 |
| `built-in bookcase 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `built-in bookcase 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `built-in bookcase 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 47 | 49 |
| `built-in bookcase 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `built-in bookcase 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `built-in bookcase 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `built-in bookcase 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `built-in bookcase 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `built-in bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `built-in bookcase 96 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `built-in bookcase 96 wide 48 tall 12 deep from oak` | Oak 1×4 | 43 | 46 |
| `built-in bookcase 96 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 43 | 46 |
| `built-in bookcase 96 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `built-in bookcase 96 wide 48 tall 14 deep from oak` | Oak 1×4 | 44 | 48 |
| `built-in bookcase 96 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 44 | 48 |
| `built-in bookcase 96 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `built-in bookcase 96 wide 48 tall 16 deep from oak` | Oak 1×4 | 54 | 58 |
| `built-in bookcase 96 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 54 | 58 |
| `built-in bookcase 96 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `built-in bookcase 96 wide 60 tall 12 deep from oak` | Oak 1×4 | 45 | 48 |
| `built-in bookcase 96 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 45 | 48 |
| `built-in bookcase 96 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `built-in bookcase 96 wide 60 tall 14 deep from oak` | Oak 1×4 | 46 | 50 |
| `built-in bookcase 96 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 46 | 50 |
| `built-in bookcase 96 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `built-in bookcase 96 wide 60 tall 16 deep from oak` | Oak 1×4 | 56 | 60 |
| `built-in bookcase 96 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 56 | 60 |
| `built-in bookcase 96 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `built-in bookcase 96 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 51 |
| `built-in bookcase 96 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 51 |
| `built-in bookcase 96 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `built-in bookcase 96 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 53 |
| `built-in bookcase 96 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `built-in bookcase 96 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `built-in bookcase 96 wide 72 tall 16 deep from oak` | Oak 1×4 | 60 | 64 |
| `built-in bookcase 96 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 60 | 64 |
| `built-in bookcase 96 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 78 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 78 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 78 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 84 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 84 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 84 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 90 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 90 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 90 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 96 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 96 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 96 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `built-in bookcase 96 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `built-in bookcase 96 wide 96 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `built-in bookcase 96 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `built-in bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `cabinet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `cabinet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `cabinet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `cabinet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `cabinet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 46 | 48 |
| `cabinet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `cabinet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 44 | 46 |
| `cabinet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 44 | 46 |
| `cabinet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 46 | 48 |
| `cabinet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `cabinet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `cabinet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 50 | 53 |
| `cabinet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `cabinet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `cabinet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 49 |
| `cabinet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 49 |
| `cabinet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `cabinet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 51 |
| `cabinet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 51 |
| `cabinet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `cabinet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 56 |
| `cabinet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 56 |
| `cabinet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `cabinet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `cabinet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `cabinet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `cabinet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `cabinet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `cabinet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `cabinet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `cabinet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `cabinet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `cabinet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `cabinet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `cabinet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `cabinet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `cabinet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `cabinet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `cabinet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `cabinet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `cabinet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `cabinet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `cabinet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `cabinet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `cabinet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `cabinet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `closet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `closet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `closet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `closet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `closet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `closet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `closet 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `closet 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `closet 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `closet 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `closet 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `closet 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `closet 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `closet 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `closet 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `closet 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `closet 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `closet 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `closet 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `closet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `closet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `closet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `closet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `closet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `closet 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `closet 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `closet 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `closet 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `closet 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `closet 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `closet 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `closet 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `closet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `closet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `closet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `closet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `closet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `closet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `closet 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet shelves 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `closet shelves 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `closet shelves 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet shelves 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `closet shelves 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `closet shelves 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `closet shelves 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `closet shelves 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `closet shelves 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `closet shelves 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `closet shelves 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `closet shelves 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `closet shelves 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `closet shelves 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `closet shelves 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `closet shelves 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `closet shelves 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `closet shelves 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `closet shelves 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `closet shelves 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `closet shelves 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet shelves 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `closet shelves 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `closet shelves 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet shelves 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `closet shelves 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `closet shelves 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `closet shelves 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `closet shelves 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `closet shelves 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `closet shelves 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `closet shelves 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `closet shelves 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `closet shelves 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `closet shelves 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `closet shelves 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `closet shelves 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet shelves 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet shelves 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `closet shelves 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `closet shelves 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `closet shelves 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet shelves 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `closet shelves 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `closet shelves 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet shelves 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `closet shelves 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `closet shelves 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `closet shelves 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `closet shelves 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `closet shelves 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet shelves 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet shelves 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet shelves 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet shelves 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet shelves 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet shelves 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet shelves 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet shelves 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet shelves 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet shelves 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet shelves 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet shelves 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `closet shelves 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `closet shelves 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `closet shelves 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `closet shelves 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `garage cabinet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `garage cabinet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `garage cabinet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `garage cabinet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `garage cabinet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 46 | 48 |
| `garage cabinet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `garage cabinet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 44 | 46 |
| `garage cabinet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 44 | 46 |
| `garage cabinet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 46 | 48 |
| `garage cabinet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `garage cabinet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `garage cabinet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 50 | 53 |
| `garage cabinet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `garage cabinet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `garage cabinet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 49 |
| `garage cabinet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 49 |
| `garage cabinet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `garage cabinet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 51 |
| `garage cabinet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 51 |
| `garage cabinet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `garage cabinet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 56 |
| `garage cabinet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 56 |
| `garage cabinet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `garage cabinet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `garage cabinet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `garage cabinet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `garage cabinet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `garage cabinet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `garage cabinet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `garage cabinet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `garage cabinet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `garage cabinet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `garage cabinet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `garage cabinet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `garage cabinet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `garage cabinet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `garage cabinet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `garage cabinet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `garage cabinet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `garage cabinet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `garage cabinet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `garage cabinet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `garage cabinet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `garage cabinet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `garage cabinet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `garage cabinet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `garage cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `garage cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `garage cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `garage shelves 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `garage shelves 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `garage shelves 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `garage shelves 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `garage shelves 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 33 | 35 |
| `garage shelves 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `garage shelves 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 28 | 29 |
| `garage shelves 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `garage shelves 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `garage shelves 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `garage shelves 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `garage shelves 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `garage shelves 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `garage shelves 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `garage shelves 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `garage shelves 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `garage shelves 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `garage shelves 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `garage shelves 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `garage shelves 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `garage shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `garage shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
| `garage shelves 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `garage shelves 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 26 | 27 |
| `garage shelves 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 26 | 27 |
| `garage shelves 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `garage shelves 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 27 | 28 |
| `garage shelves 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `garage shelves 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `garage shelves 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 32 | 34 |
| `garage shelves 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 32 | 34 |
| `garage shelves 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `garage shelves 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `garage shelves 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `garage shelves 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `garage shelves 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 34 | 35 |
| `garage shelves 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `garage shelves 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `garage shelves 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 30 | 31 |
| `garage shelves 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 30 | 31 |
| `garage shelves 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `garage shelves 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 32 | 33 |
| `garage shelves 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `garage shelves 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `garage shelves 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 37 | 39 |
| `garage shelves 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `garage shelves 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `garage shelves 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `garage shelves 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `garage shelves 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `garage shelves 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `garage shelves 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `garage shelves 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `garage shelves 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `garage shelves 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `garage shelves 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `garage shelves 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `garage shelves 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `garage shelves 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `garage shelves 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `garage shelves 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `garage shelves 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `garage shelves 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `garage shelves 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `garage shelves 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `garage shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 11 | 12 |
| `garage shelves 72 wide from oak` | Oak 1×4 | 27 | 29 |
| `garage shelves 72 wide from pine boards` | Pine 1×4 | 27 | 29 |
| `laundry shelves 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `laundry shelves 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `laundry shelves 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `laundry shelves 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `laundry shelves 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 33 | 35 |
| `laundry shelves 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `laundry shelves 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 28 | 29 |
| `laundry shelves 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `laundry shelves 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `laundry shelves 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `laundry shelves 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `laundry shelves 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `laundry shelves 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `laundry shelves 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `laundry shelves 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `laundry shelves 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `laundry shelves 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `laundry shelves 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `laundry shelves 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `laundry shelves 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `laundry shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `laundry shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
| `laundry shelves 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `laundry shelves 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 26 | 27 |
| `laundry shelves 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 26 | 27 |
| `laundry shelves 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `laundry shelves 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 27 | 28 |
| `laundry shelves 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `laundry shelves 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `laundry shelves 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 32 | 34 |
| `laundry shelves 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 32 | 34 |
| `laundry shelves 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `laundry shelves 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `laundry shelves 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `laundry shelves 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `laundry shelves 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 34 | 35 |
| `laundry shelves 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `laundry shelves 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `laundry shelves 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 30 | 31 |
| `laundry shelves 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 30 | 31 |
| `laundry shelves 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `laundry shelves 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 32 | 33 |
| `laundry shelves 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `laundry shelves 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `laundry shelves 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 37 | 39 |
| `laundry shelves 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `laundry shelves 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `laundry shelves 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `laundry shelves 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `laundry shelves 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `laundry shelves 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `laundry shelves 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `laundry shelves 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `laundry shelves 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `laundry shelves 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `laundry shelves 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `laundry shelves 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `laundry shelves 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `laundry shelves 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `laundry shelves 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `laundry shelves 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `laundry shelves 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `laundry shelves 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `laundry shelves 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `laundry shelves 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `laundry shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 11 | 12 |
| `laundry shelves 72 wide from oak` | Oak 1×4 | 27 | 29 |
| `laundry shelves 72 wide from pine boards` | Pine 1×4 | 27 | 29 |
| `linen closet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `linen closet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `linen closet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `linen closet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `linen closet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `linen closet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `linen closet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `linen closet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `linen closet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `linen closet 56 wide from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `linen closet 56 wide from oak` | Oak 1×4 | 52 | 54 |
| `linen closet 56 wide from pine boards` | Pine 1×4 | 52 | 54 |
| `linen closet 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `linen closet 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `linen closet 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `linen closet 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `linen closet 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `linen closet 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `linen closet 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `linen closet 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `linen closet 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `linen closet 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `linen closet 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `linen closet 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `linen closet 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `linen closet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `linen closet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `linen closet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `linen closet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `linen closet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `linen closet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `linen closet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `linen closet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `linen closet 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `linen closet 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `linen closet 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `linen closet 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `linen closet 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `linen closet 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `linen closet 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `linen closet 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `linen closet 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `linen closet 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `linen closet 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `linen closet 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `linen closet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `linen closet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `linen closet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `linen closet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `linen closet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `linen closet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `linen closet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `linen closet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `linen closet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `linen closet 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `linen closet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `linen closet 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `linen closet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `linen closet 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `linen closet 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `linen closet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `linen closet 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `linen closet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `linen closet 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `linen closet 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `linen closet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `linen closet 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `linen closet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `linen closet 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `linen closet 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `linen closet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `linen closet 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `linen closet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `linen closet 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `linen closet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `office bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `office bookcase 119 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `office bookcase 119 wide 48 tall 12 deep from oak` | Oak 1×4 | 50 | 47 |
| `office bookcase 119 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 50 | 47 |
| `office bookcase 119 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `office bookcase 119 wide 48 tall 14 deep from oak` | Oak 1×4 | 51 | 49 |
| `office bookcase 119 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 51 | 49 |
| `office bookcase 119 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 24 |
| `office bookcase 119 wide 48 tall 16 deep from oak` | Oak 1×4 | 62 | 59 |
| `office bookcase 119 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 62 | 59 |
| `office bookcase 119 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `office bookcase 119 wide 72 tall 12 deep from oak` | Oak 1×4 | 55 | 53 |
| `office bookcase 119 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 55 | 53 |
| `office bookcase 119 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `office bookcase 119 wide 72 tall 14 deep from oak` | Oak 1×4 | 57 | 55 |
| `office bookcase 119 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 57 | 55 |
| `office bookcase 119 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 27 |
| `office bookcase 119 wide 72 tall 16 deep from oak` | Oak 1×4 | 69 | 67 |
| `office bookcase 119 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 69 | 67 |
| `office bookcase 119 wide 78 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 119 wide 78 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `office bookcase 119 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `office bookcase 119 wide 78 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `office bookcase 119 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `office bookcase 119 wide 84 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 119 wide 84 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `office bookcase 119 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `office bookcase 119 wide 84 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `office bookcase 119 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `office bookcase 119 wide 90 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 119 wide 90 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `office bookcase 119 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `office bookcase 119 wide 90 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `office bookcase 119 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `office bookcase 119 wide 96 tall 12 deep from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 119 wide 96 tall 14 deep from oak` | Oak 1×4 | 63 | 61 |
| `office bookcase 119 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 63 | 61 |
| `office bookcase 119 wide 96 tall 16 deep from oak` | Oak 1×4 | 76 | 74 |
| `office bookcase 119 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 76 | 74 |
| `office bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 120 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `office bookcase 120 wide 48 tall 12 deep from oak` | Oak 1×4 | 55 | 57 |
| `office bookcase 120 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 55 | 57 |
| `office bookcase 120 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `office bookcase 120 wide 48 tall 14 deep from oak` | Oak 1×4 | 56 | 58 |
| `office bookcase 120 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 56 | 58 |
| `office bookcase 120 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 28 | 29 |
| `office bookcase 120 wide 48 tall 16 deep from oak` | Oak 1×4 | 69 | 71 |
| `office bookcase 120 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 69 | 71 |
| `office bookcase 120 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `office bookcase 120 wide 60 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `office bookcase 120 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `office bookcase 120 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `office bookcase 120 wide 60 tall 14 deep from oak` | Oak 1×4 | 59 | 61 |
| `office bookcase 120 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 59 | 61 |
| `office bookcase 120 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 29 | 30 |
| `office bookcase 120 wide 60 tall 16 deep from oak` | Oak 1×4 | 72 | 74 |
| `office bookcase 120 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 72 | 74 |
| `office bookcase 120 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `office bookcase 120 wide 72 tall 12 deep from oak` | Oak 1×4 | 60 | 62 |
| `office bookcase 120 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `office bookcase 120 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `office bookcase 120 wide 72 tall 14 deep from oak` | Oak 1×4 | 62 | 64 |
| `office bookcase 120 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 62 | 64 |
| `office bookcase 120 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 30 | 31 |
| `office bookcase 120 wide 72 tall 16 deep from oak` | Oak 1×4 | 75 | 78 |
| `office bookcase 120 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 75 | 78 |
| `office bookcase 120 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 78 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 120 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 78 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `office bookcase 120 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `office bookcase 120 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 78 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `office bookcase 120 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `office bookcase 120 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 84 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 120 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 84 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `office bookcase 120 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `office bookcase 120 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 84 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `office bookcase 120 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `office bookcase 120 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 90 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 120 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 90 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `office bookcase 120 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `office bookcase 120 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 90 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `office bookcase 120 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `office bookcase 120 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 96 tall 12 deep from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 120 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 96 tall 14 deep from oak` | Oak 1×4 | 68 | 70 |
| `office bookcase 120 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 68 | 70 |
| `office bookcase 120 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 33 | 34 |
| `office bookcase 120 wide 96 tall 16 deep from oak` | Oak 1×4 | 82 | 84 |
| `office bookcase 120 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `office bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `office bookcase 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `office bookcase 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `office bookcase 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `office bookcase 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 39 | 41 |
| `office bookcase 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `office bookcase 58 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `office bookcase 58 wide 48 tall 12 deep from oak` | Oak 1×4 | 28 | 29 |
| `office bookcase 58 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `office bookcase 58 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `office bookcase 58 wide 48 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `office bookcase 58 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `office bookcase 58 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 14 | 15 |
| `office bookcase 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 35 | 37 |
| `office bookcase 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 35 | 37 |
| `office bookcase 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `office bookcase 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `office bookcase 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `office bookcase 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `office bookcase 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 32 | 33 |
| `office bookcase 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `office bookcase 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 34 | 35 |
| `office bookcase 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `office bookcase 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `office bookcase 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 58 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 78 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 58 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 78 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `office bookcase 58 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `office bookcase 58 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `office bookcase 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `office bookcase 58 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 84 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 58 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 84 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `office bookcase 58 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `office bookcase 58 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `office bookcase 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `office bookcase 58 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 90 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 58 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 90 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `office bookcase 58 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `office bookcase 58 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `office bookcase 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `office bookcase 58 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 96 tall 12 deep from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 58 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 96 tall 14 deep from oak` | Oak 1×4 | 38 | 39 |
| `office bookcase 58 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `office bookcase 58 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 18 | 19 |
| `office bookcase 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 45 | 47 |
| `office bookcase 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `office bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `office bookcase 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 33 | 35 |
| `office bookcase 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `office bookcase 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `office bookcase 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `office bookcase 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 42 | 44 |
| `office bookcase 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `office bookcase 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 35 | 36 |
| `office bookcase 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `office bookcase 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 36 | 38 |
| `office bookcase 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 36 | 38 |
| `office bookcase 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 17 | 18 |
| `office bookcase 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 43 | 45 |
| `office bookcase 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 43 | 45 |
| `office bookcase 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `office bookcase 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 37 | 39 |
| `office bookcase 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `office bookcase 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `office bookcase 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 39 | 41 |
| `office bookcase 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 39 | 41 |
| `office bookcase 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 19 | 20 |
| `office bookcase 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 47 | 49 |
| `office bookcase 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `office bookcase 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `office bookcase 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `office bookcase 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `office bookcase 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `office bookcase 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `office bookcase 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `office bookcase 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `office bookcase 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `office bookcase 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `office bookcase 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `office bookcase 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `office bookcase 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `office bookcase 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `office bookcase 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `office bookcase 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `office bookcase 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 50 | 52 |
| `office bookcase 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `office bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `office bookcase 96 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `office bookcase 96 wide 48 tall 12 deep from oak` | Oak 1×4 | 43 | 46 |
| `office bookcase 96 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 43 | 46 |
| `office bookcase 96 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `office bookcase 96 wide 48 tall 14 deep from oak` | Oak 1×4 | 44 | 48 |
| `office bookcase 96 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 44 | 48 |
| `office bookcase 96 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 23 |
| `office bookcase 96 wide 48 tall 16 deep from oak` | Oak 1×4 | 54 | 58 |
| `office bookcase 96 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 54 | 58 |
| `office bookcase 96 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `office bookcase 96 wide 60 tall 12 deep from oak` | Oak 1×4 | 45 | 48 |
| `office bookcase 96 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 45 | 48 |
| `office bookcase 96 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `office bookcase 96 wide 60 tall 14 deep from oak` | Oak 1×4 | 46 | 50 |
| `office bookcase 96 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 46 | 50 |
| `office bookcase 96 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `office bookcase 96 wide 60 tall 16 deep from oak` | Oak 1×4 | 56 | 60 |
| `office bookcase 96 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 56 | 60 |
| `office bookcase 96 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `office bookcase 96 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 51 |
| `office bookcase 96 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 51 |
| `office bookcase 96 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `office bookcase 96 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 53 |
| `office bookcase 96 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `office bookcase 96 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 24 | 26 |
| `office bookcase 96 wide 72 tall 16 deep from oak` | Oak 1×4 | 60 | 64 |
| `office bookcase 96 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 60 | 64 |
| `office bookcase 96 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 78 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `office bookcase 96 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 78 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `office bookcase 96 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `office bookcase 96 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 78 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `office bookcase 96 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `office bookcase 96 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 84 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `office bookcase 96 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 84 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `office bookcase 96 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `office bookcase 96 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 84 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `office bookcase 96 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `office bookcase 96 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 90 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `office bookcase 96 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 90 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `office bookcase 96 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `office bookcase 96 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 90 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `office bookcase 96 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `office bookcase 96 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 96 tall 12 deep from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 52 | 55 |
| `office bookcase 96 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 96 tall 14 deep from oak` | Oak 1×4 | 54 | 57 |
| `office bookcase 96 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 54 | 57 |
| `office bookcase 96 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 28 |
| `office bookcase 96 wide 96 tall 16 deep from oak` | Oak 1×4 | 65 | 69 |
| `office bookcase 96 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `office bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `pantry 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `pantry 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `pantry 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `pantry 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `pantry 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `pantry 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `pantry 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `pantry 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `pantry 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `pantry 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `pantry 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `pantry 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `pantry 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `pantry 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `pantry 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `pantry 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `pantry 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `pantry 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `pantry 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `pantry 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `pantry 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `pantry 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `pantry 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `pantry 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `pantry 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `pantry 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `pantry 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry cabinet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `pantry cabinet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `pantry cabinet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry cabinet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `pantry cabinet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `pantry cabinet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry cabinet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `pantry cabinet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `pantry cabinet 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry cabinet 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry cabinet 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry cabinet 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry cabinet 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry cabinet 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry cabinet 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry cabinet 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry cabinet 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry cabinet 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry cabinet 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry cabinet 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry cabinet 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry cabinet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `pantry cabinet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `pantry cabinet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry cabinet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `pantry cabinet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `pantry cabinet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry cabinet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `pantry cabinet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `pantry cabinet 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `pantry cabinet 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `pantry cabinet 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `pantry cabinet 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `pantry cabinet 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry cabinet 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `pantry cabinet 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `pantry cabinet 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry cabinet 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry cabinet 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry cabinet 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `pantry cabinet 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `pantry cabinet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry cabinet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `pantry cabinet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `pantry cabinet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry cabinet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `pantry cabinet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `pantry cabinet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry cabinet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `pantry cabinet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `pantry cabinet 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry cabinet 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry cabinet 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry shelves 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 45 | 47 |
| `pantry shelves 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 45 | 47 |
| `pantry shelves 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry shelves 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 47 | 49 |
| `pantry shelves 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 47 | 49 |
| `pantry shelves 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `pantry shelves 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 52 | 54 |
| `pantry shelves 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 52 | 54 |
| `pantry shelves 58 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 60 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry shelves 58 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry shelves 58 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry shelves 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry shelves 58 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry shelves 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry shelves 58 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 72 tall 12 deep from oak` | Oak 1×4 | 42 | 44 |
| `pantry shelves 58 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `pantry shelves 58 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 44 | 45 |
| `pantry shelves 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 44 | 45 |
| `pantry shelves 58 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 49 | 51 |
| `pantry shelves 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 49 | 51 |
| `pantry shelves 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry shelves 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 52 |
| `pantry shelves 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 52 |
| `pantry shelves 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry shelves 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 54 |
| `pantry shelves 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 54 |
| `pantry shelves 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 22 | 24 |
| `pantry shelves 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 60 |
| `pantry shelves 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 60 |
| `pantry shelves 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 45 | 46 |
| `pantry shelves 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 45 | 46 |
| `pantry shelves 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 46 | 47 |
| `pantry shelves 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 46 | 47 |
| `pantry shelves 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `pantry shelves 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 52 | 53 |
| `pantry shelves 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 52 | 53 |
| `pantry shelves 72 wide 60 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry shelves 72 wide 60 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry shelves 72 wide 60 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `pantry shelves 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 54 | 55 |
| `pantry shelves 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 54 | 55 |
| `pantry shelves 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry shelves 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 56 | 57 |
| `pantry shelves 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `pantry shelves 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry shelves 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 58 | 59 |
| `pantry shelves 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `pantry shelves 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 25 | 26 |
| `pantry shelves 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 64 | 66 |
| `pantry shelves 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 64 | 66 |
| `pantry shelves 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry shelves 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry shelves 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry shelves 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry shelves 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry shelves 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry shelves 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry shelves 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry shelves 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry shelves 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry shelves 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry shelves 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry shelves 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 58 | 60 |
| `pantry shelves 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 58 | 60 |
| `pantry shelves 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 60 | 62 |
| `pantry shelves 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `pantry shelves 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `storage cabinet 56 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 40 | 42 |
| `storage cabinet 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 40 | 42 |
| `storage cabinet 56 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 42 | 44 |
| `storage cabinet 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 42 | 44 |
| `storage cabinet 56 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 46 | 48 |
| `storage cabinet 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `storage cabinet 70 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 70 wide 72 tall 12 deep from oak` | Oak 1×4 | 44 | 46 |
| `storage cabinet 70 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 44 | 46 |
| `storage cabinet 70 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 70 wide 72 tall 14 deep from oak` | Oak 1×4 | 46 | 48 |
| `storage cabinet 70 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 46 | 48 |
| `storage cabinet 70 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 20 | 21 |
| `storage cabinet 70 wide 72 tall 16 deep from oak` | Oak 1×4 | 50 | 53 |
| `storage cabinet 70 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 50 | 53 |
| `storage cabinet 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `storage cabinet 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 48 | 49 |
| `storage cabinet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 49 |
| `storage cabinet 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `storage cabinet 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 50 | 51 |
| `storage cabinet 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 50 | 51 |
| `storage cabinet 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 21 | 22 |
| `storage cabinet 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 55 | 56 |
| `storage cabinet 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 55 | 56 |
| `storage cabinet 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `storage cabinet 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `storage cabinet 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `storage cabinet 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `storage cabinet 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `storage cabinet 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `storage cabinet 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `storage cabinet 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `storage cabinet 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `storage cabinet 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `storage cabinet 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `storage cabinet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `storage cabinet 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `storage cabinet 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `storage cabinet 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `storage cabinet 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `storage cabinet 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `storage cabinet 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `storage cabinet 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 51 | 52 |
| `storage cabinet 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 51 | 52 |
| `storage cabinet 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 53 | 54 |
| `storage cabinet 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 53 | 54 |
| `storage cabinet 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 58 | 59 |
| `storage cabinet 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `storage cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `storage cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `storage cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `utility shelves 56 wide 78 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `utility shelves 56 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `utility shelves 56 wide 78 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `utility shelves 56 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `utility shelves 56 wide 78 tall 16 deep from oak` | Oak 1×4 | 33 | 35 |
| `utility shelves 56 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 33 | 35 |
| `utility shelves 58 wide 48 tall 16 deep from oak` | Oak 1×4 | 28 | 29 |
| `utility shelves 58 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `utility shelves 58 wide 60 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `utility shelves 58 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `utility shelves 58 wide 60 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 58 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 58 wide 72 tall 14 deep from oak` | Oak 1×4 | 28 | 29 |
| `utility shelves 58 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 28 | 29 |
| `utility shelves 58 wide 72 tall 16 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 58 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 58 wide 78 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `utility shelves 58 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `utility shelves 58 wide 84 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `utility shelves 58 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `utility shelves 58 wide 90 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `utility shelves 58 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `utility shelves 58 wide 96 tall 16 deep from oak` | Oak 1×4 | 38 | 39 |
| `utility shelves 58 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 38 | 39 |
| `utility shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `utility shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
| `utility shelves 72 wide 48 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `utility shelves 72 wide 48 tall 12 deep from oak` | Oak 1×4 | 26 | 27 |
| `utility shelves 72 wide 48 tall 12 deep from pine boards` | Pine 1×4 | 26 | 27 |
| `utility shelves 72 wide 48 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `utility shelves 72 wide 48 tall 14 deep from oak` | Oak 1×4 | 27 | 28 |
| `utility shelves 72 wide 48 tall 14 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `utility shelves 72 wide 48 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `utility shelves 72 wide 48 tall 16 deep from oak` | Oak 1×4 | 32 | 34 |
| `utility shelves 72 wide 48 tall 16 deep from pine boards` | Pine 1×4 | 32 | 34 |
| `utility shelves 72 wide 60 tall 12 deep from oak` | Oak 1×4 | 27 | 28 |
| `utility shelves 72 wide 60 tall 12 deep from pine boards` | Pine 1×4 | 27 | 28 |
| `utility shelves 72 wide 60 tall 14 deep from oak` | Oak 1×4 | 29 | 30 |
| `utility shelves 72 wide 60 tall 14 deep from pine boards` | Pine 1×4 | 29 | 30 |
| `utility shelves 72 wide 60 tall 16 deep from oak` | Oak 1×4 | 34 | 35 |
| `utility shelves 72 wide 60 tall 16 deep from pine boards` | Pine 1×4 | 34 | 35 |
| `utility shelves 72 wide 72 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `utility shelves 72 wide 72 tall 12 deep from oak` | Oak 1×4 | 30 | 31 |
| `utility shelves 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 30 | 31 |
| `utility shelves 72 wide 72 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `utility shelves 72 wide 72 tall 14 deep from oak` | Oak 1×4 | 32 | 33 |
| `utility shelves 72 wide 72 tall 14 deep from pine boards` | Pine 1×4 | 32 | 33 |
| `utility shelves 72 wide 72 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 15 | 16 |
| `utility shelves 72 wide 72 tall 16 deep from oak` | Oak 1×4 | 37 | 39 |
| `utility shelves 72 wide 72 tall 16 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `utility shelves 72 wide 78 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 78 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 72 wide 78 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 72 wide 78 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 78 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `utility shelves 72 wide 78 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `utility shelves 72 wide 78 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 78 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `utility shelves 72 wide 78 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `utility shelves 72 wide 84 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 84 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 72 wide 84 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 72 wide 84 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 84 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `utility shelves 72 wide 84 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `utility shelves 72 wide 84 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 84 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `utility shelves 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `utility shelves 72 wide 90 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 90 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 72 wide 90 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 72 wide 90 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 90 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `utility shelves 72 wide 90 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `utility shelves 72 wide 90 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 90 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `utility shelves 72 wide 90 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `utility shelves 72 wide 96 tall 12 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 96 tall 12 deep from oak` | Oak 1×4 | 33 | 34 |
| `utility shelves 72 wide 96 tall 12 deep from pine boards` | Pine 1×4 | 33 | 34 |
| `utility shelves 72 wide 96 tall 14 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 96 tall 14 deep from oak` | Oak 1×4 | 35 | 36 |
| `utility shelves 72 wide 96 tall 14 deep from pine boards` | Pine 1×4 | 35 | 36 |
| `utility shelves 72 wide 96 tall 16 deep from 1x10` | 1×10 Board (8 ft) | 16 | 17 |
| `utility shelves 72 wide 96 tall 16 deep from oak` | Oak 1×4 | 41 | 42 |
| `utility shelves 72 wide 96 tall 16 deep from pine boards` | Pine 1×4 | 41 | 42 |
| `utility shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 11 | 12 |
| `utility shelves 72 wide from oak` | Oak 1×4 | 27 | 29 |
| `utility shelves 72 wide from pine boards` | Pine 1×4 | 27 | 29 |
| `wardrobe 55 wide from oak` | Oak 1×4 | 60 | 59 |
| `wardrobe 55 wide from pine boards` | Pine 1×4 | 60 | 59 |
| `wardrobe 58 wide from 1x10` | 1×10 Board (8 ft) | 27 | 26 |
| `wardrobe 70 wide from oak` | Oak 1×4 | 65 | 66 |
| `wardrobe 70 wide from pine boards` | Pine 1×4 | 65 | 66 |
| `wardrobe 75 wide from oak` | Oak 1×4 | 72 | 73 |
| `wardrobe 75 wide from pine boards` | Pine 1×4 | 72 | 73 |

## Other model moves in the 48-prompt class matrix

Same shape as the headlines: end bays shrink by a fraction of the divider, the middle grows, the run still fills. On these plywood prompts, step titles, Buy names, and Buy quantities are unchanged.

| Prompt | Before | After |
|---|---|---|
| `closet 64 wide` | 20 7/16, 20 1/16, 20 7/16 | 20 1/3, 20 1/3, 20 1/3 |
| `closet 78 wide` | 25 1/8, 24 3/4, 25 1/8 | 25, 25, 25 |
| `cabinet 64 wide` | 20 7/16, 20 1/16, 20 7/16 | 20 1/3, 20 1/3, 20 1/3 |
| `cabinet 72 wide` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `cabinet 78 wide` | 25 1/8, 24 3/4, 25 1/8 | 25, 25, 25 |
| `bookcase 64 wide` | 20 7/16, 20 1/16, 20 7/16 | 20 1/3, 20 1/3, 20 1/3 |
| `bookcase 72 wide` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `bookcase 78 wide` | 25 1/8, 24 3/4, 25 1/8 | 25, 25, 25 |
| `bookcase 84 wide` | 27 1/8, 26 3/4, 27 1/8 | 27, 27, 27 |
| `bookcase 90 wide` | 29 1/8, 28 3/4, 29 1/8 | 29, 29, 29 |
| `bookcase 96 wide` | 23 1/4, 22 7/8, 22 7/8, 23 1/4 | 23 1/16 × 4 |
| `bookcase 108 wide` | 26 1/4, 25 7/8, 25 7/8, 26 1/4 | 26 1/16 × 4 |
| `bookcase 120 wide` | 29 1/4, 28 7/8, 28 7/8, 29 1/4 | 29 1/16 × 4 |
| `bookcase 72 wide 72 tall 12 deep` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `bookcase 84 wide 72 tall 12 deep` | 27 1/8, 26 3/4, 27 1/8 | 27, 27, 27 |
| `bookcase 48 wide 48 tall 12 deep in 1/2 inch plywood` | 15 5/16, 15 1/16, 15 5/16 | 15 1/4 × 3 |
| `bookcase 60 wide 48 tall 12 deep in 1/2 inch plywood` | 19 5/16, 19 1/16, 19 5/16 | 19 1/4 × 3 |
| `bookcase 72 wide 48 tall 12 deep in 1/2 inch plywood` | 17 7/16, 17 3/16, 17 3/16, 17 7/16 | 17 5/16 × 4 |
| `closet 72 wide 96 tall 24 deep` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |
| `wardrobe 72 wide` | 23 1/8, 22 3/4, 23 1/8 | 23, 23, 23 |

Closet 64's clear bay is 20 1/3". The span note still rounds its measured max to the nearest 1/16" and says 20 3/8" or less. The pieces are equal.

## Stayed

Two-bay splits (one centre divider), builder bays that were already equal, and spans under the stock limit. Includes `closet 42/48/60/90/96/120 wide`, `wardrobe 96 wide` (hats stay 31"), `bookcase 60 wide`, `office bookcase with doors 42 wide`, `bookshelf from 1x10`, `pantry cabinet 36x18x78`, `bookcase 30 wide 12 deep 72 tall`, and `linen closet 31.5 wide 78 tall 16 deep`.
