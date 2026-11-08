# Class F — typed axis beside a shelf

Not a CI gate. The grader reruns the property test and this script.

Rule: beside `1 shelf` / `one shelf` / `1 open shelf` / `an open shelf`, every axis the one reader (`src/lib/yard/lengthReader.ts`) reads is the same inches as the digit spelling, on every host. A separator comma does not drop it. `compose.ts` CARD1 still decides only whether the shelf stays on the host.

```bash
npx tsx --test src/lib/yard/typedCounts.test.ts
npx tsx scripts/baselines/approvals/class-f-shelf/rerun.ts
```

`rerun.ts` exits 0 when each prompt matches its digit twin (name, overall size, Combined flag, panel count, step titles, cut rows, Buy names and quantities). Price is printed and not compared.
