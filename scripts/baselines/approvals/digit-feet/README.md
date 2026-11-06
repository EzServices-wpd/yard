# Digit counts of feet are not a size

Not a CI gate. The grader reruns the property test and this script.

Rule, in the one reader (`src/lib/yard/lengthReader.ts`): a number before feet / foot / ft / ' is not a length when with / on / and / has / plus comes before it, or a part noun (legs, shelves, boards, …) follows it, unless an axis word follows. Digits use the same rule as the spelled counts NR-1 r5 already fixed. "2 feet wide" and "4 feet tall" stay sizes. A leading "6 foot shelf" stays the storage form's height (C2). A comma keeps release's reading.

```bash
npx tsx --test --test-name-pattern "digit count before feet" src/lib/yard/lengthReader.test.ts
npx tsx scripts/baselines/approvals/digit-feet/rerun.ts
```

`rerun.ts` exits 0 when each digit prompt matches its spelled twin (name, overall size, Combined flag, step titles, Buy names and quantities). Price is printed and not compared. Axis forms and the C2 shelf height must stay sizes.

`movers.md` is the list of class-matrix prompts whose model, steps, or parts moved against release `b5442befb7a417ba72bd02e1eff43df696e9c7dd`. Eval-corpus prompts in that sweep did not move.
