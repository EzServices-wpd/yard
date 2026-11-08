# Plan
- `src/lib/yard/invariants.ts`: one pure checker per invariant, `checkBuild(project, prompt)`.
- `scripts/invariants-corpus.ts`: corpus + seeded sizes; `scripts/eval-lib.ts`: offline runner and score.
- `scripts/invariants.test.ts`: ratchet, I2, I10, eval-score floor (picked up by run-unit-tests in `guards`).
- `scripts/eval-score.ts [--write]`, `scripts/invariants-run.ts`: record a new high mark / dump violations.
- Ponytail: no new dependency (no fast-check); a 10-line seeded RNG covers the property sizes.
