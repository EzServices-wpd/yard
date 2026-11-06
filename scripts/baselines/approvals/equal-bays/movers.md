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

Step titles did not change on these prompts. The span note keeps its sentence; only the measured "or less" opening changes (closet 72: 23 1/8" → 23"). Buy names and plywood quantities did not change. The two pine bookcases below are the Buy-quantity movers.

## Buy quantities

Sweep of 379 prompts (closet, cabinet, bookcase, wardrobe, pantry at widths 48–120 step 2, plain and `in 1/2 inch plywood`, plus MDF and pine bookcases, the cabinet headline, and the linen canary). **190 changed bay widths. Step titles: 0 changed. Buy names: 0 changed. Buy quantities: 2 changed.** Both quantity changes are Pine 1×4 board counts. The catalog total moves only with that count.

| Prompt | Buy before | Buy after | Catalog total |
|---|---|---|---|
| `bookcase 72 wide from pine boards` | Pine 1×4 ×40 | Pine 1×4 ×42 | $248.35 → $256.35 |
| `bookcase 96 wide from pine boards` | Pine 1×4 ×52 | Pine 1×4 ×55 | $296.35 → $308.35 |

Same other Buy lines (1/4" backer ×2, screws ×2, shelf pins ×2, glue ×1, anti-tip kit ×1). The equal bay lengths nest onto more 8 ft 1×4s. Overall size unchanged.

## Other model moves in the 48-prompt class matrix

Same shape as the headlines: end bays shrink by a fraction of the divider, the middle grows, the run still fills. Step titles unchanged. Buy names and quantities unchanged. Catalog total unchanged.

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
