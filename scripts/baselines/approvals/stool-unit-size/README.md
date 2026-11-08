# A stool keeps a unit-marked size

Not a CI gate. The grader reruns the property test and this script.

Rule: on a stool or a chair (the same seat reader), a width or depth is the inches the one reader reads (`readLengths` in `src/lib/yard/lengthReader.ts`). A unit mark between the number and the axis word stays, so `24" wide`, `24 inches wide`, and `2 feet wide` build the same stool as `24 wide`. A feature word is not what drops the size; the tip dropped the mark with or without one. A comma and a hyphenated `N-inch` stay release's read. `wide 24` stays unread. A count of feet is not a size. Height already kept an inch mark. Bench, table, and desk already kept a marked width and are unchanged.

```bash
npx tsx --test src/lib/yard/stoolUnitSize.test.ts
npx tsx scripts/baselines/approvals/stool-unit-size/rerun.ts
```

`rerun.ts` exits 0 when each marked prompt matches its bare twin (name, overall size, step titles, Buy names and quantities). Price is not compared. Climb stools, the C2 shelf height, and a digit count of feet stay as they were.

`movers.md` is the class matrix whose model, steps, or parts moved against release `104075e45583b7a82b77d6d30cb90c09df5e70de`.
