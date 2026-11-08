# 008 Bought-item path: whole cut rows, inches only, round sizes, typed title

## Why
One root, the purchased-item path (unitItems/unitSizes → buildPlan):
- Whole bought pieces went through the cut-list builder as if cut, and sub-1/16" sizes rounded to blank 0" rows.
- Cited sources and names said "mm" (Pony bead 9 × 6 mm, 1 mm stretch cord).
- Round pieces were "N" long".
- The table name replaced the typed noun ("8" cable tie" for "zip tie").

## What
- Cut-list rows for whole bought pieces are marked `whole`. They carry the unit table's real piece size (report.ts `wholeItemsUncut`). Real cuts (cord) are untouched.
- `mmToInches` (inchText.ts) converts every metric figure in unit names, sources and notes to inch fractions. The cord is 1/32".
- `unitSizeTalk`: round pieces are "N" across" (with thickness when flat), a washer is a disc, a cork is "L long, D across", anything else is "N" long".
- The typed item words are the title when the table name lacks them ("Zip tie", "Pipe cleaner"). Otherwise the table name stays.
- I20 also flags: a whole piece listed as a cut, any blank (0) cut-list size, and any "N mm" text. I24 now covers unit builds (the typed item noun stays in the title).

## Gates
- classB8.test.ts (whole class over the b8, c3 and c2b sweeps plus every table row).
- evals/sweeps/b8-bought-path.md (20/20).
- Gate 0, canaries 6/6, linen $183.70, eval 854/874.
