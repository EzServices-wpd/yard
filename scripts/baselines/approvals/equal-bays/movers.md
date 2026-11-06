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

Step titles did not change on these prompts. The span note keeps its sentence; only the measured "or less" opening changes (closet 72: 23 1/8" → 23"). Buy names did not change. Buy quantities for the whole comparison are the table below, not a two-prompt list.

## Buy quantities

Compared with release `c230ab55348aa963937de462a6eb162460a41a1e` on 10,223 prompts. **129 changed a Buy quantity. 0 changed a Buy name. 0 changed a step title.** Each prompt below changes one line. The board count follows the equal-bay cut packing. A catalog total is not a grade.

The comparison is two sweeps, deduped:

- 5,939 prompts: bookcase, bookshelf, closet, cabinet, wardrobe, pantry, pantry cabinet, linen closet, garage cabinet, office bookcase, storage cabinet, closet shelves, garage shelves, pantry shelves, laundry shelves, utility shelves, and built-in bookcase, at widths 36–120 every inch with `from pine boards`; the same hosts at even widths with no stock phrase, `from MDF`, `in 1/2 inch plywood`, `from 1x10`, `from 1x12s`, and `from oak`; plus sized pine and half-ply variants (`72 tall 12 deep`, `84 tall 16 deep`, `48 tall 12 deep in 1/2 inch plywood`) at 60/64/72/84/96/108/120 for bookcase, closet, cabinet, wardrobe, and pantry.
- 4,284 prompts: the same 17 hosts at odd widths 37–119 with no stock phrase, `from MDF`, `in 1/2 inch plywood`, `from 1x10`, `from 1x12s`, and `from oak`.

By line: Pine 1×4 on 57 prompts, Oak 1×4 on 45, 1×10 Board (8 ft) on 26, 1/2" Plywood 4×8 on 1 (`bookcase 108 wide 48 tall 12 deep in 1/2 inch plywood`, 4→3). `from MDF`, `from 1x12s`, and plain 3/4" plywood sheet counts did not change a quantity in this comparison. The critic's five extras and the two previously listed bookcases are in the table.

| Prompt | Buy line | Before | After |
|---|---|---:|---:|
| `bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `bookcase 108 wide 48 tall 12 deep in 1/2 inch plywood` | 1/2" Plywood 4×8 | 4 | 3 |
| `bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `bookcase 120 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 60 | 62 |
| `bookcase 120 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 82 | 84 |
| `bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `bookcase 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 37 | 39 |
| `bookcase 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 50 | 52 |
| `bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `bookcase 96 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 51 |
| `bookcase 96 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 65 | 69 |
| `bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `bookshelf 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `bookshelf 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `bookshelf 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `bookshelf 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `bookshelf 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `bookshelf 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `bookshelf 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `bookshelf 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `bookshelf 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `bookshelf 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `bookshelf 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `bookshelf 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `bookshelf 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `built-in bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `built-in bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `built-in bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `built-in bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `built-in bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `built-in bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `built-in bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `built-in bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `built-in bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `built-in bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `built-in bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `built-in bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `built-in bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `cabinet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 48 | 49 |
| `cabinet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 58 | 59 |
| `cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `closet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `closet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `closet 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `closet 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `closet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `closet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `closet shelves 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `closet shelves 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `closet shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `closet shelves 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `closet shelves 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `garage cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `garage cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `garage cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `garage shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `garage shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
| `garage shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 11 | 12 |
| `garage shelves 72 wide from oak` | Oak 1×4 | 27 | 29 |
| `garage shelves 72 wide from pine boards` | Pine 1×4 | 27 | 29 |
| `laundry shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `laundry shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
| `laundry shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 11 | 12 |
| `laundry shelves 72 wide from oak` | Oak 1×4 | 27 | 29 |
| `laundry shelves 72 wide from pine boards` | Pine 1×4 | 27 | 29 |
| `linen closet 56 wide from 1x10` | 1×10 Board (8 ft) | 23 | 24 |
| `linen closet 56 wide from oak` | Oak 1×4 | 52 | 54 |
| `linen closet 56 wide from pine boards` | Pine 1×4 | 52 | 54 |
| `linen closet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `linen closet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `linen closet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `linen closet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `linen closet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `office bookcase 100 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `office bookcase 119 wide from oak` | Oak 1×4 | 61 | 59 |
| `office bookcase 119 wide from pine boards` | Pine 1×4 | 61 | 59 |
| `office bookcase 120 wide from oak` | Oak 1×4 | 66 | 68 |
| `office bookcase 120 wide from pine boards` | Pine 1×4 | 66 | 68 |
| `office bookcase 58 wide from oak` | Oak 1×4 | 36 | 37 |
| `office bookcase 58 wide from pine boards` | Pine 1×4 | 36 | 37 |
| `office bookcase 61 wide from 1x10` | 1×10 Board (8 ft) | 9 | 10 |
| `office bookcase 72 wide from oak` | Oak 1×4 | 40 | 42 |
| `office bookcase 72 wide from pine boards` | Pine 1×4 | 40 | 42 |
| `office bookcase 80 wide from 1x10` | 1×10 Board (8 ft) | 12 | 11 |
| `office bookcase 96 wide from oak` | Oak 1×4 | 52 | 55 |
| `office bookcase 96 wide from pine boards` | Pine 1×4 | 52 | 55 |
| `pantry 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry 72 wide 72 tall 12 deep from pine boards` | Pine 1×4 | 56 | 57 |
| `pantry 72 wide 84 tall 16 deep from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry cabinet 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry cabinet 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry cabinet 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry cabinet 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `pantry shelves 58 wide from oak` | Oak 1×4 | 60 | 61 |
| `pantry shelves 58 wide from pine boards` | Pine 1×4 | 60 | 61 |
| `pantry shelves 72 wide from 1x10` | 1×10 Board (8 ft) | 26 | 27 |
| `pantry shelves 72 wide from oak` | Oak 1×4 | 67 | 69 |
| `pantry shelves 72 wide from pine boards` | Pine 1×4 | 67 | 69 |
| `storage cabinet 72 wide from 1x10` | 1×10 Board (8 ft) | 13 | 14 |
| `storage cabinet 72 wide from oak` | Oak 1×4 | 32 | 33 |
| `storage cabinet 72 wide from pine boards` | Pine 1×4 | 32 | 33 |
| `utility shelves 58 wide from oak` | Oak 1×4 | 24 | 25 |
| `utility shelves 58 wide from pine boards` | Pine 1×4 | 24 | 25 |
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
