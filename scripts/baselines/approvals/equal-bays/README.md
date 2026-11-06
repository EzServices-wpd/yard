# Equal clear bays

Not a CI gate. The grader reruns the invariant test and this script.

Rule: when the span pass divides one shelf opening into 3 or more clear bays (closets, cabinets, bookcases), every clear width matches within 1/64 inch. The bays plus the dividers between them fill the run between the sides. Divider centres sit on the equal-bay stations: each opening is the span minus the dividers' own thickness, split evenly. A 2-bay split was already one centre. Builder bays (`Bay divider`) are a different placer and stay as they were.

```bash
npx tsx --test src/lib/yard/equalBays.test.ts
npx tsx scripts/baselines/approvals/equal-bays/rerun.ts
```

`rerun.ts` exits 0 when every named prompt's auto-divided runs of 3+ bays are equal and fill the run. Price is not compared.

`movers.md` is the class matrix whose model, steps, or Buy names and quantities moved against release `c230ab55348aa963937de462a6eb162460a41a1e`.
