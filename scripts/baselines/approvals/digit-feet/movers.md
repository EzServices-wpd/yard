# Digit-feet movers

Against release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`, before this change. The grade is the model, the steps, and the parts. Price is the catalog total for those parts, not its own grade.

Sweep: 1,100 prompts (the class matrix of 11 hosts × 8 counts × 12 forms, plus axis controls and every eval prompt that contains a digit feet span). **509 moved. 591 stayed.** No eval-corpus prompt moved. These stayed sizes: `desk 2 feet wide`, `bookcase 4 feet tall`, `table 6 feet long`, `workbench 6 feet`, `trestle table 6 feet`, `table 4 feet`, `bench 4 feet`, `6 foot shelf`, `2 foot shelf`, `4 foot bookcase`, `3 foot cabinet`, `6 foot ladder from 2x4`, `PVC garden arch 4 feet wide`, `bookcase, 3 1/2 ft boards`, `dollhouse 4'`, `wardrobe 4 feet wide, 6 feet tall, 2 feet deep with a hanging rod`, `coffee table 4 feet wide with an open shelf`, `nightstand 4 feet wide, with 1 shelf`.

`bookcase with 5 one foot shelves` already matched `bookcase with five one foot shelves` on release (36×12×84) and did not move. A spelled "N foot shelves" on a coffee table is still a Combined Shelf: clauseCore strips a digit and its unit ("4 foot shelves" stays on the table) and leaves the spelled count as its own Shelf product. That split is not this size class. Bookcase keeps both on the bookcase.

## Headlines

| Prompt | Before | After (matches the spelled twin) |
|---|---|---|
| `coffee table with 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `side table with 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `table with 4 foot legs` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `bookcase with 2 foot shelves` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase from 2 1/2 ft boards` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 5 one foot shelves` | Bookcase 36x12x84 $131.76 (already the spelled twin) | unchanged |

## Every move

| Prompt | Before | After |
|---|---|---|
| `bookcase from 2 1/2 ft boards` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `coffee table with 1 feet` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 1 feet` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 1 feet` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 1 feet` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 1 feet` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 1 foot legs` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 1 foot shelves` | Coffee table 40" × 12" × 40" 40x40x12 $131.43 | Coffee table 40" × 18" × 40" 40x40x18 $77.97 |
| `coffee table with 1 foot boards` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 1 ft` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 1'` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 1 foot shelves` | Coffee table 40" × 12" × 40" 40x40x12 $131.43 | Coffee table 40" × 18" × 40" 40x40x18 $77.97 |
| `coffee table 1 foot legs` | Coffee table 12" × 18" × 12" 12x12x18 $41.95 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 2 feet` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 2 feet` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 2 feet` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 2 feet` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 2 feet` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 2 foot legs` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 2 foot shelves` | Coffee table 40" × 24" × 40" 40x40x24 $139.43 | Coffee table 40" × 18" × 40" 40x40x18 $131.43 |
| `coffee table with 2 foot boards` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 2 ft` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 2'` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 2 foot shelves` | Coffee table 40" × 24" × 40" 40x40x24 $139.43 | Coffee table 40" × 18" × 40" 40x40x18 $131.43 |
| `coffee table 2 foot legs` | Coffee table 24" × 18" × 22" 24x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 3 feet` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 3 feet` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 3 feet` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 3 feet` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 3 feet` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 3 foot legs` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 3 foot shelves` | Coffee table 40" × 36" × 40" 40x40x36 $143.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 3 foot boards` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 3 ft` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 3'` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 3 foot shelves` | Coffee table 40" × 36" × 40" 40x40x36 $143.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 3 foot legs` | Coffee table 36" × 18" × 22" 36x22x18 $45.23 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 4 feet` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 4 foot legs` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 4 foot shelves` | Coffee table 40" × 48" × 40" 40x40x48 $143.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 4 foot boards` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 4 ft` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 4'` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 4 foot shelves` | Coffee table 40" × 48" × 40" 40x40x48 $143.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 4 foot legs` | Coffee table 48" × 18" × 22" 48x22x18 $48.51 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 5 feet` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 5 feet` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 5 feet` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 5 feet` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 5 feet` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 5 foot legs` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 5 foot shelves` | Coffee table 40" × 60" × 40" 40x40x60 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 5 foot boards` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 5 ft` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 5'` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 5 foot shelves` | Coffee table 40" × 60" × 40" 40x40x60 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 5 foot legs` | Coffee table 60" × 18" × 22" 60x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 6 feet` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 6 feet` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 6 feet` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 6 feet` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 6 feet` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 6 foot legs` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 6 foot shelves` | Coffee table 40" × 72" × 40" 40x40x72 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 6 foot boards` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 6 ft` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 6'` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 6 foot shelves` | Coffee table 40" × 72" × 40" 40x40x72 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 6 foot legs` | Coffee table 72" × 18" × 22" 72x22x18 $62.94 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 8 feet` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 8 feet` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 8 feet` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 8 feet` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 8 feet` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 8 foot legs` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 8 foot shelves` | Coffee table 40" × 96" × 40" 40x40x96 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 8 foot boards` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 8 ft` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 8'` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 8 foot shelves` | Coffee table 40" × 96" × 40" 40x40x96 $152.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 8 foot legs` | Coffee table 96" × 18" × 22" 96x22x18 $66.22 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 12 feet` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table on 12 feet` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table and 12 feet` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table has 12 feet` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table plus 12 feet` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 12 foot legs` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 12 foot shelves` | Coffee table 40" × 144" × 40" 40x40x144 $170.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table with 12 foot boards` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 12 ft` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table with 12'` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `coffee table 12 foot shelves` | Coffee table 40" × 144" × 40" 40x40x144 $170.93 | Coffee table 40" × 18" × 40" 40x40x18 $137.99 |
| `coffee table 12 foot legs` | Coffee table 144" × 18" × 22" 144x22x18 $77.97 | Coffee table 40" × 18" × 40" 40x40x18 $62.94 |
| `side table with 1 feet` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 1 feet` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 1 feet` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 1 feet` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 1 feet` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 1 foot legs` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 1 foot shelves` | Side table 20" × 12" × 20" 20x20x12 $71.41 | Side table 20" × 22" × 20" 20x20x22 $57.7 |
| `side table with 1 foot boards` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 1 ft` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 1'` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 1 foot shelves` | Side table 20" × 12" × 20" 20x20x12 $71.41 | Side table 20" × 22" × 20" 20x20x22 $57.7 |
| `side table 1 foot legs` | Side table 12" × 22" × 12" 12x12x22 $41.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 2 feet` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 2 feet` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 2 feet` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 2 feet` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 2 feet` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 2 foot legs` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 2 foot shelves` | Side table 20" × 24" × 20" 20x20x24 $83.88 | Side table 20" × 22" × 20" 20x20x22 $60.98 |
| `side table with 2 foot boards` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 2 ft` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 2'` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 2 foot shelves` | Side table 20" × 24" × 20" 20x20x24 $83.88 | Side table 20" × 22" × 20" 20x20x22 $60.98 |
| `side table 2 foot legs` | Side table 24" × 22" × 24" 24x24x22 $45.95 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 3 feet` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 3 foot legs` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 3 foot shelves` | Side table 20" × 36" × 20" 20x20x36 $88.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 3 foot boards` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 3 ft` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 3'` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 3 foot shelves` | Side table 20" × 36" × 20" 20x20x36 $88.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 3 foot legs` | Side table 36" × 22" × 36" 36x36x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 4 feet` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 4 feet` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 4 feet` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 4 feet` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 4 feet` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 4 foot legs` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 4 foot shelves` | Side table 20" × 48" × 20" 20x20x48 $88.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 4 foot boards` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 4 ft` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 4'` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 4 foot shelves` | Side table 20" × 48" × 20" 20x20x48 $88.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 4 foot legs` | Side table 48" × 22" × 48" 48x48x22 $64.38 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 5 feet` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 5 feet` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 5 feet` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 5 feet` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 5 feet` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 5 foot legs` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 5 foot shelves` | Side table 20" × 60" × 20" 20x20x60 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 5 foot boards` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 5 ft` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 5'` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 5 foot shelves` | Side table 20" × 60" × 20" 20x20x60 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 5 foot legs` | Side table 60" × 22" × 60" 60x60x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 6 feet` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 6 feet` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 6 feet` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 6 feet` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 6 feet` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 6 foot legs` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 6 foot shelves` | Side table 20" × 72" × 20" 20x20x72 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 6 foot boards` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 6 ft` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 6'` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 6 foot shelves` | Side table 20" × 72" × 20" 20x20x72 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 6 foot legs` | Side table 72" × 22" × 72" 72x72x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 8 feet` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 8 feet` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 8 feet` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 8 feet` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 8 feet` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 8 foot legs` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 8 foot shelves` | Side table 20" × 96" × 20" 20x20x96 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 8 foot boards` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 8 ft` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 8'` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 8 foot shelves` | Side table 20" × 96" × 20" 20x20x96 $97.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 8 foot legs` | Side table 96" × 22" × 96" 96x96x22 $119.28 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 12 feet` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table on 12 feet` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table and 12 feet` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table has 12 feet` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table plus 12 feet` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 12 foot legs` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 12 foot shelves` | Side table 20" × 144" × 20" 20x20x144 $115.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table with 12 foot boards` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 12 ft` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table with 12'` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `side table 12 foot shelves` | Side table 20" × 144" × 20" 20x20x144 $115.38 | Side table 20" × 22" × 20" 20x20x22 $83.88 |
| `side table 12 foot legs` | Side table 144" × 22" × 144" 144x144x22 $289 | Side table 20" × 22" × 20" 20x20x22 $45.95 |
| `table with 1 feet` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 1 feet` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 1 feet` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 1 feet` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 1 feet` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 1 foot legs` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 1 foot shelves` | Table 40" × 12" × 40" 40x40x12 $131.43 | Table 40" × 30" × 40" 40x40x30 $83.91 |
| `table with 1 foot boards` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 1 ft` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 1'` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 1 foot shelves` | Table 40" × 12" × 40" 40x40x12 $131.43 | Table 40" × 30" × 40" 40x40x30 $83.91 |
| `table 1 foot legs` | Table 12" × 30" × 12" 12x12x30 $46.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 2 feet` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 2 feet` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 2 feet` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 2 feet` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 2 feet` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 2 foot legs` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 2 foot shelves` | Table 40" × 24" × 40" 40x40x24 $139.43 | Table 40" × 30" × 40" 40x40x30 $137.37 |
| `table with 2 foot boards` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 2 ft` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 2'` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 2 foot shelves` | Table 40" × 24" × 40" 40x40x24 $139.43 | Table 40" × 30" × 40" 40x40x30 $137.37 |
| `table 2 foot legs` | Table 24" × 30" × 24" 24x24x30 $50.45 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 3 feet` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 3 feet` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 3 feet` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 3 feet` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 3 feet` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 3 foot legs` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 3 foot shelves` | Table 40" × 36" × 40" 40x40x36 $143.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 3 foot boards` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 3 ft` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 3'` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 3 foot shelves` | Table 40" × 36" × 40" 40x40x36 $143.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 3 foot legs` | Table 36" × 30" × 36" 36x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 4 feet` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 4 feet` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 4 feet` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 4 feet` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 4 feet` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 4 foot legs` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 4 foot shelves` | Table 40" × 48" × 40" 40x40x48 $143.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 4 foot boards` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 4 ft` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 4'` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 4 foot shelves` | Table 40" × 48" × 40" 40x40x48 $143.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 4 foot legs` | Table 48" × 30" × 36" 48x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 5 feet` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 5 feet` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 5 feet` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 5 feet` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 5 feet` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 5 foot legs` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 5 foot shelves` | Table 40" × 60" × 40" 40x40x60 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 5 foot boards` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 5 ft` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 5'` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 5 foot shelves` | Table 40" × 60" × 40" 40x40x60 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 5 foot legs` | Table 60" × 30" × 36" 60x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 6 feet` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 6 feet` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 6 feet` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 6 feet` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 6 feet` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 6 foot legs` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 6 foot shelves` | Table 40" × 72" × 40" 40x40x72 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 6 foot boards` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 6 ft` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 6'` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 6 foot shelves` | Table 40" × 72" × 40" 40x40x72 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 6 foot legs` | Table 72" × 30" × 36" 72x36x30 $68.88 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 8 feet` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 8 feet` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 8 feet` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 8 feet` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 8 feet` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 8 foot legs` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 8 foot shelves` | Table 40" × 96" × 40" 40x40x96 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 8 foot boards` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 8 ft` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 8'` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 8 foot shelves` | Table 40" × 96" × 40" 40x40x96 $152.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 8 foot legs` | Table 96" × 30" × 36" 96x36x30 $81.35 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 12 feet` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table on 12 feet` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table and 12 feet` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table has 12 feet` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table plus 12 feet` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 12 foot legs` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 12 foot shelves` | Table 40" × 144" × 40" 40x40x144 $170.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table with 12 foot boards` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 12 ft` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table with 12'` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `table 12 foot shelves` | Table 40" × 144" × 40" 40x40x144 $170.93 | Table 40" × 30" × 40" 40x40x30 $143.93 |
| `table 12 foot legs` | Table 144" × 30" × 36" 144x36x30 $123.78 | Table 40" × 30" × 40" 40x40x30 $68.88 |
| `bookcase with 1 foot legs` | Bookcase 12" tall 36x12x12 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 1 foot shelves` | Bookcase 12" tall 36x12x12 $83.35 | Bookcase 36x12x84 $93.33 |
| `bookcase with 1 foot boards` | Bookcase 12" tall 36x12x12 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase 1 foot shelves` | Bookcase 12" tall 36x12x12 $83.35 | Bookcase 36x12x84 $93.33 |
| `bookcase 1 foot legs` | Bookcase 12" tall 36x12x12 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 2 foot legs` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 2 foot shelves` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 2 foot boards` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase 2 foot shelves` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase 2 foot legs` | Bookcase 24" tall 36x12x24 $83.35 | Bookcase 36x12x84 $131.76 |
| `bookcase with 3 foot legs` | Bookcase 36" tall 36x12x36 $93.33 | Bookcase 36x12x84 $131.76 |
| `bookcase with 3 foot shelves` | Bookcase 36" tall 36x12x36 $93.33 | Bookcase 36x12x84 $131.76 |
| `bookcase with 3 foot boards` | Bookcase 36" tall 36x12x36 $93.33 | Bookcase 36x12x84 $131.76 |
| `bookcase 3 foot shelves` | Bookcase 36" tall 36x12x36 $93.33 | Bookcase 36x12x84 $131.76 |
| `bookcase 3 foot legs` | Bookcase 36" tall 36x12x36 $93.33 | Bookcase 36x12x84 $131.76 |
| `bookcase with 4 foot legs` | Bookcase 48" tall 36x12x48 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 4 foot shelves` | Bookcase 48" tall 36x12x48 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 4 foot boards` | Bookcase 48" tall 36x12x48 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 4 foot shelves` | Bookcase 48" tall 36x12x48 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 4 foot legs` | Bookcase 48" tall 36x12x48 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 5 foot legs` | Bookcase 60" tall 36x12x60 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 5 foot shelves` | Bookcase 60" tall 36x12x60 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 5 foot boards` | Bookcase 60" tall 36x12x60 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 5 foot shelves` | Bookcase 60" tall 36x12x60 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 5 foot legs` | Bookcase 60" tall 36x12x60 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 6 foot legs` | Bookcase 72" tall 36x12x72 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 6 foot shelves` | Bookcase 72" tall 36x12x72 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 6 foot boards` | Bookcase 72" tall 36x12x72 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 6 foot shelves` | Bookcase 72" tall 36x12x72 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 6 foot legs` | Bookcase 72" tall 36x12x72 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 8 foot legs` | Bookcase 96" tall 36x12x96 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 8 foot shelves` | Bookcase 96" tall 36x12x96 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 8 foot boards` | Bookcase 96" tall 36x12x96 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 8 foot shelves` | Bookcase 96" tall 36x12x96 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase 8 foot legs` | Bookcase 96" tall 36x12x96 $131.76 | Bookcase 36x12x84 $131.76 |
| `bookcase with 12 foot legs` | Bookcase 144" tall 36x12x144 $165.21 | Bookcase 36x12x84 $131.76 |
| `bookcase with 12 foot shelves` | Bookcase 144" tall 36x12x144 $165.21 | Bookcase 36x12x84 $170.19 |
| `bookcase with 12 foot boards` | Bookcase 144" tall 36x12x144 $165.21 | Bookcase 36x12x84 $131.76 |
| `bookcase 12 foot shelves` | Bookcase 144" tall 36x12x144 $165.21 | Bookcase 12" wide 12x12x84 $93.33 |
| `bookcase 12 foot legs` | Bookcase 144" tall 36x12x144 $165.21 | Bookcase 12" wide 12x12x84 $93.33 |
| `cabinet with 1 foot legs` | Cabinet 36" × 12" × 16" 36x16x12 $127.29 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 1 foot shelves` | Cabinet 36" × 12" × 16" 36x16x12 $127.29 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 1 foot boards` | Cabinet 36" × 12" × 16" 36x16x12 $127.29 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 1 foot shelves` | Cabinet 36" × 12" × 16" 36x16x12 $127.29 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 1 foot legs` | Cabinet 36" × 12" × 16" 36x16x12 $127.29 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 2 foot legs` | Cabinet 36" × 24" × 16" 36x16x24 $165.72 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 2 foot shelves` | Cabinet 36" × 24" × 16" 36x16x24 $165.72 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 2 foot boards` | Cabinet 36" × 24" × 16" 36x16x24 $165.72 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 2 foot shelves` | Cabinet 36" × 24" × 16" 36x16x24 $165.72 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 2 foot legs` | Cabinet 36" × 24" × 16" 36x16x24 $165.72 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 3 foot legs` | Cabinet 36" × 36" × 16" 36x16x36 $175.7 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 3 foot shelves` | Cabinet 36" × 36" × 16" 36x16x36 $175.7 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 3 foot boards` | Cabinet 36" × 36" × 16" 36x16x36 $175.7 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 3 foot shelves` | Cabinet 36" × 36" × 16" 36x16x36 $175.7 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 3 foot legs` | Cabinet 36" × 36" × 16" 36x16x36 $175.7 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 4 foot legs` | Cabinet 36" × 48" × 16" 36x16x48 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 4 foot shelves` | Cabinet 36" × 48" × 16" 36x16x48 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 4 foot boards` | Cabinet 36" × 48" × 16" 36x16x48 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 4 foot shelves` | Cabinet 36" × 48" × 16" 36x16x48 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 4 foot legs` | Cabinet 36" × 48" × 16" 36x16x48 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 5 foot legs` | Cabinet 36" × 60" × 16" 36x16x60 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 5 foot shelves` | Cabinet 36" × 60" × 16" 36x16x60 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 5 foot boards` | Cabinet 36" × 60" × 16" 36x16x60 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 5 foot shelves` | Cabinet 36" × 60" × 16" 36x16x60 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 5 foot legs` | Cabinet 36" × 60" × 16" 36x16x60 $184.69 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 6 foot legs` | Cabinet 36" × 72" × 16" 36x16x72 $232.11 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 6 foot shelves` | Cabinet 36" × 72" × 16" 36x16x72 $232.11 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 6 foot boards` | Cabinet 36" × 72" × 16" 36x16x72 $232.11 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 6 foot shelves` | Cabinet 36" × 72" × 16" 36x16x72 $232.11 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 6 foot legs` | Cabinet 36" × 72" × 16" 36x16x72 $232.11 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 8 foot legs` | Cabinet 36" × 96" × 16" 36x16x96 $241.1 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 8 foot shelves` | Cabinet 36" × 96" × 16" 36x16x96 $241.1 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 8 foot boards` | Cabinet 36" × 96" × 16" 36x16x96 $241.1 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 8 foot shelves` | Cabinet 36" × 96" × 16" 36x16x96 $241.1 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 8 foot legs` | Cabinet 36" × 96" × 16" 36x16x96 $241.1 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 12 foot legs` | Cabinet 36" × 144" × 16" 36x16x144 $312.98 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet with 12 foot shelves` | Cabinet 36" × 144" × 16" 36x16x144 $312.98 | Cabinet 36" × 30" × 16" 36x16x30 $204.15 |
| `cabinet with 12 foot boards` | Cabinet 36" × 144" × 16" 36x16x144 $312.98 | Cabinet 36" × 30" × 16" 36x16x30 $165.72 |
| `cabinet 12 foot shelves` | Cabinet 36" × 144" × 16" 36x16x144 $312.98 | Cabinet 12" × 30" × 16" 12x16x30 $105.32 |
| `cabinet 12 foot legs` | Cabinet 36" × 144" × 16" 36x16x144 $312.98 | Cabinet 12" × 30" × 16" 12x16x30 $105.32 |
| `desk with 1 foot shelves` | Desk 48" × 12" × 24" 48x24x12 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 1 foot shelves` | Desk 48" × 12" × 24" 48x24x12 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 1 foot legs` | Desk 12" × 29" × 24" 12x24x29 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 2 foot shelves` | Desk 48" × 24" × 24" 48x24x24 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 2 foot shelves` | Desk 48" × 24" × 24" 48x24x24 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 2 foot legs` | Desk 24" × 29" × 24" 24x24x29 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 3 foot shelves` | Desk 48" × 36" × 24" 48x24x36 $356.99 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 3 foot shelves` | Desk 48" × 36" × 24" 48x24x36 $356.99 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 3 foot legs` | Desk 36" × 29" × 24" 36x24x29 $318.56 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 4 foot shelves` | Desk 48" × 48" × 24" 48x24x48 $395.42 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 4 foot shelves` | Desk 48" × 48" × 24" 48x24x48 $395.42 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 5 foot shelves` | Desk 48" × 60" × 24" 48x24x60 $395.42 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 5 foot shelves` | Desk 48" × 60" × 24" 48x24x60 $395.42 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 5 foot legs` | Desk 60" × 29" × 24" 60x24x29 $356.99 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 6 foot shelves` | Desk 48" × 72" × 24" 48x24x72 $458.83 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 6 foot shelves` | Desk 48" × 72" × 24" 48x24x72 $458.83 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 6 foot legs` | Desk 72" × 29" × 24" 72x24x29 $381.97 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 8 foot shelves` | Desk 48" × 96" × 24" 48x24x96 $497.26 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 8 foot shelves` | Desk 48" × 96" × 24" 48x24x96 $497.26 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 8 foot legs` | Desk 96" × 29" × 24" 96x24x29 $445.38 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk with 12 foot shelves` | Desk 48" × 144" × 24" 48x24x144 $621.02 | Desk 48" × 29" × 24" 48x24x29 $356.99 |
| `desk 12 foot shelves` | Desk 48" × 144" × 24" 48x24x144 $621.02 | Desk 12" × 29" × 24" 12x24x29 $318.56 |
| `desk 12 foot legs` | Desk 144" × 29" × 24" 144x24x29 $572.2 | Desk 12" × 29" × 24" 12x24x29 $318.56 |
| `nightstand with 1 foot shelves` | Nightstand 20" × 12" × 16" 20x16x12 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 1 foot shelves` | Nightstand 20" × 12" × 16" 20x16x12 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 1 foot legs` | Nightstand 12" × 24" × 16" 12x16x24 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 2 foot legs` | Nightstand 24" × 24" × 16" 24x16x24 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 3 foot shelves` | Nightstand 20" × 36" × 16" 20x16x36 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 3 foot shelves` | Nightstand 20" × 36" × 16" 20x16x36 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 3 foot legs` | Nightstand 36" × 24" × 16" 36x16x24 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 4 foot shelves` | Nightstand 20" × 48" × 16" 20x16x48 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 4 foot shelves` | Nightstand 20" × 48" × 16" 20x16x48 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 4 foot legs` | Nightstand 48" × 24" × 16" 48x16x24 $117.81 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 5 foot shelves` | Nightstand 20" × 60" × 16" 20x16x60 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 5 foot shelves` | Nightstand 20" × 60" × 16" 20x16x60 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 5 foot legs` | Nightstand 60" × 24" × 16" 60x16x24 $156.24 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 6 foot shelves` | Nightstand 20" × 72" × 16" 20x16x72 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 6 foot shelves` | Nightstand 20" × 72" × 16" 20x16x72 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 6 foot legs` | Nightstand 72" × 24" × 16" 72x16x24 $156.24 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 8 foot shelves` | Nightstand 20" × 96" × 16" 20x16x96 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 8 foot shelves` | Nightstand 20" × 96" × 16" 20x16x96 $127.79 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 8 foot legs` | Nightstand 96" × 24" × 16" 96x16x24 $156.24 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand with 12 foot shelves` | Nightstand 20" × 144" × 16" 20x16x144 $174.69 | Nightstand 20" × 24" × 16" 20x16x24 $117.81 |
| `nightstand 12 foot shelves` | Nightstand 20" × 144" × 16" 20x16x144 $174.69 | Nightstand 12" × 24" × 16" 12x16x24 $117.81 |
| `nightstand 12 foot legs` | Nightstand 144" × 24" × 16" 144x16x24 $228.12 | Nightstand 12" × 24" × 16" 12x16x24 $117.81 |
| `bench with 1 foot shelves` | Bench 48" × 12" × 16" 48x16x12 $76.86 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 1 foot shelves` | Bench 48" × 12" × 16" 48x16x12 $76.86 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 1 foot legs` | Bench 12" × 18" × 16" 12x16x18 $42.4 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 2 foot shelves` | Bench 48" × 24" × 16" 48x16x24 $85.33 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 2 foot shelves` | Bench 48" × 24" × 16" 48x16x24 $85.33 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 2 foot legs` | Bench 24" × 18" × 16" 24x16x18 $46.35 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 3 foot shelves` | Bench 48" × 36" × 16" 48x16x36 $85.33 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 3 foot shelves` | Bench 48" × 36" × 16" 48x16x36 $85.33 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 3 foot legs` | Bench 36" × 18" × 16" 36x16x18 $70.25 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 4 foot shelves` | Bench 48" × 48" × 16" 48x16x48 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 4 foot shelves` | Bench 48" × 48" × 16" 48x16x48 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench with 5 foot shelves` | Bench 48" × 60" × 16" 48x16x60 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 5 foot shelves` | Bench 48" × 60" × 16" 48x16x60 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 5 foot legs` | Bench 60" × 18" × 16" 60x16x18 $74.2 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 6 foot shelves` | Bench 48" × 72" × 16" 48x16x72 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 6 foot shelves` | Bench 48" × 72" × 16" 48x16x72 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 6 foot legs` | Bench 72" × 18" × 16" 72x16x18 $74.2 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 8 foot shelves` | Bench 48" × 96" × 16" 48x16x96 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 8 foot shelves` | Bench 48" × 96" × 16" 48x16x96 $123.76 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 8 foot legs` | Bench 96" × 18" × 16" 96x16x18 $78.15 | Bench 48" × 18" × 16" 48x16x18 $70.25 |
| `bench with 12 foot shelves` | Bench 48" × 144" × 16" 48x16x144 $195.64 | Bench 48" × 18" × 16" 48x16x18 $85.33 |
| `bench 12 foot shelves` | Bench 48" × 144" × 16" 48x16x144 $195.64 | Bench 12" × 18" × 16" 12x16x18 $76.86 |
| `bench 12 foot legs` | Bench 144" × 18" × 16" 144x16x18 $127 | Bench 12" × 18" × 16" 12x16x18 $42.4 |
| `stool with 1 foot shelves` | Stool 18" × 12" seat 18x16x12 $40.42 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 1 foot shelves` | Stool 18" × 12" seat 18x16x12 $40.42 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 2 foot shelves` | Stool 18" × 24" seat 18x16x24 $48.68 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 2 foot shelves` | Stool 18" × 24" seat 18x16x24 $48.68 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 3 foot shelves` | Stool 18" × 36" seat 18x16x36 $52.63 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 3 foot shelves` | Stool 18" × 36" seat 18x16x36 $52.63 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 4 foot shelves` | Stool 18" × 48" seat 18x16x48 $52.63 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 4 foot shelves` | Stool 18" × 48" seat 18x16x48 $52.63 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 5 foot shelves` | Stool 18" × 60" seat 18x16x60 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 5 foot shelves` | Stool 18" × 60" seat 18x16x60 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 6 foot shelves` | Stool 18" × 72" seat 18x16x72 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 6 foot shelves` | Stool 18" × 72" seat 18x16x72 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 8 foot shelves` | Stool 18" × 96" seat 18x16x96 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 8 foot shelves` | Stool 18" × 96" seat 18x16x96 $60.53 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool with 12 foot shelves` | Stool 18" × 144" seat 18x16x144 $76.33 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `stool 12 foot shelves` | Stool 18" × 144" seat 18x16x144 $76.33 | Stool 18" × 18" seat 18x16x18 $40.42 |
| `dresser with 1 foot shelves` | Dresser 12" tall 36x18x12 $169.75 | Dresser 36x18x36 $218.16 |
| `dresser 1 foot shelves` | Dresser 12" tall 36x18x12 $169.75 | Dresser 36x18x36 $218.16 |
| `dresser with 2 foot shelves` | Dresser 24" tall 36x18x24 $208.18 | Dresser 36x18x36 $218.16 |
| `dresser 2 foot shelves` | Dresser 24" tall 36x18x24 $208.18 | Dresser 36x18x36 $218.16 |
| `dresser with 3 foot shelves` | Dresser 36" tall 36x18x36 $218.16 | Dresser 36x18x36 $218.16 |
| `dresser 3 foot shelves` | Dresser 36" tall 36x18x36 $218.16 | Dresser 36x18x36 $218.16 |
| `dresser with 4 foot shelves` | Dresser 48" tall 36x18x48 $271.55 | Dresser 36x18x36 $218.16 |
| `dresser 4 foot shelves` | Dresser 48" tall 36x18x48 $271.55 | Dresser 36x18x36 $218.16 |
| `dresser with 5 foot shelves` | Dresser 60" tall 36x18x60 $271.55 | Dresser 36x18x36 $218.16 |
| `dresser 5 foot shelves` | Dresser 60" tall 36x18x60 $271.55 | Dresser 36x18x36 $218.16 |
| `dresser with 6 foot shelves` | Dresser 72" tall 36x18x72 $296.53 | Dresser 36x18x36 $218.16 |
| `dresser 6 foot shelves` | Dresser 72" tall 36x18x72 $296.53 | Dresser 36x18x36 $218.16 |
| `dresser with 8 foot shelves` | Dresser 96" tall 36x18x96 $296.53 | Dresser 36x18x36 $218.16 |
| `dresser 8 foot shelves` | Dresser 96" tall 36x18x96 $296.53 | Dresser 36x18x36 $218.16 |
| `dresser with 12 foot shelves` | Dresser 144" tall 36x18x144 $393.51 | Dresser 36x18x36 $218.16 |
| `dresser 12 foot shelves` | Dresser 144" tall 36x18x144 $393.51 | Dresser 36x18x36 $218.16 |
| `shelf with 1 foot legs` | Shelf unit 36" × 12" × 12" 36x12x12 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 1 foot shelves` | Shelf unit 36" × 12" × 12" 36x12x12 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 1 foot boards` | Shelf unit 36" × 12" × 12" 36x12x12 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 1 foot shelves` | Shelf unit 36" × 12" × 12" 36x12x12 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 1 foot legs` | Shelf unit 36" × 12" × 12" 36x12x12 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 2 foot legs` | Shelf unit 36" × 24" × 12" 36x12x24 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 2 foot shelves` | Shelf unit 36" × 24" × 12" 36x12x24 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 2 foot boards` | Shelf unit 36" × 24" × 12" 36x12x24 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 2 foot shelves` | Shelf unit 36" × 24" × 12" 36x12x24 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 2 foot legs` | Shelf unit 36" × 24" × 12" 36x12x24 $83.35 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 3 foot legs` | Shelf unit 36" × 36" × 12" 36x12x36 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 3 foot shelves` | Shelf unit 36" × 36" × 12" 36x12x36 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 3 foot boards` | Shelf unit 36" × 36" × 12" 36x12x36 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 3 foot shelves` | Shelf unit 36" × 36" × 12" 36x12x36 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 3 foot legs` | Shelf unit 36" × 36" × 12" 36x12x36 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 4 foot legs` | Shelf unit 36" × 48" × 12" 36x12x48 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 4 foot shelves` | Shelf unit 36" × 48" × 12" 36x12x48 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 4 foot boards` | Shelf unit 36" × 48" × 12" 36x12x48 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 4 foot shelves` | Shelf unit 36" × 48" × 12" 36x12x48 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 4 foot legs` | Shelf unit 36" × 48" × 12" 36x12x48 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 5 foot legs` | Shelf unit 36" × 60" × 12" 36x12x60 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 5 foot shelves` | Shelf unit 36" × 60" × 12" 36x12x60 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 5 foot boards` | Shelf unit 36" × 60" × 12" 36x12x60 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 5 foot shelves` | Shelf unit 36" × 60" × 12" 36x12x60 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 5 foot legs` | Shelf unit 36" × 60" × 12" 36x12x60 $93.33 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 6 foot legs` | Shelf unit 36" × 72" × 12" 36x12x72 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 6 foot shelves` | Shelf unit 36" × 72" × 12" 36x12x72 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 6 foot boards` | Shelf unit 36" × 72" × 12" 36x12x72 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 6 foot shelves` | Shelf unit 36" × 72" × 12" 36x12x72 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 6 foot legs` | Shelf unit 36" × 72" × 12" 36x12x72 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 8 foot legs` | Shelf unit 36" × 96" × 12" 36x12x96 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 8 foot shelves` | Shelf unit 36" × 96" × 12" 36x12x96 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $121.78 |
| `shelf with 8 foot boards` | Shelf unit 36" × 96" × 12" 36x12x96 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 8 foot shelves` | Shelf unit 36" × 96" × 12" 36x12x96 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $121.78 |
| `shelf 8 foot legs` | Shelf unit 36" × 96" × 12" 36x12x96 $131.76 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 12 foot legs` | Shelf unit 36" × 144" × 12" 36x12x144 $165.21 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf with 12 foot shelves` | Shelf unit 36" × 144" × 12" 36x12x144 $165.21 | Shelf unit 36" × 18" × 12" 36x12x18 $121.78 |
| `shelf with 12 foot boards` | Shelf unit 36" × 144" × 12" 36x12x144 $165.21 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
| `shelf 12 foot shelves` | Shelf unit 36" × 144" × 12" 36x12x144 $165.21 | Shelf unit 36" × 18" × 12" 36x12x18 $121.78 |
| `shelf 12 foot legs` | Shelf unit 36" × 144" × 12" 36x12x144 $165.21 | Shelf unit 36" × 18" × 12" 36x12x18 $83.35 |
