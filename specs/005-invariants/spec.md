# 005 Invariants in CI and the eval scoreboard

## Why
Critic's failures reach users first: 233 direct-to-main commits in a week, classes regressing between grades (cold frame,
chicken tractor, sundial), and a paint-order fix whose test compared a picture with itself (process-review/PROPOSAL.md #1, #2).

## What
- **I1–I14** from critic-kb/invariants.md run as code on every commit (`guards` → unit tests) over every built-in idea
  (ideas.ts), every learned recipe (recipes.json), every eval prompt and seeded random sizes (mulberry32, fixed seed).
- **Ratchet** (`evals/invariants-baseline.json`): today's known violations, each with its failure class. A violation not
  listed fails CI (regression). A listed one that stops firing also fails (STALE) until the fix's own commit deletes it,
  so a class closes only when its check was red before the fix and is green after.
- **Eval set** (`evals/prompts.json`, 40 prompts: 5 canaries + the common breakers). Score = passing (prompt, invariant)
  pairs; tracked in `evals/score.json`. Any drop fails CI. Built locally from the engine and saved recipes with `fetch`
  disabled: no xAI call is possible.

## Mapping (invariant → check → class)
| I | Check | Class |
|---|---|---|
| I1 | supportGraph chain reaches floor or wall | F1 |
| I2 | linen canary: header, 31.5×78, 11 pieces, price = Buy (test) | F2/F3 |
| I3 | cut-list count ≥ model parts; total = Buy lines | F3 |
| I4 | lumber cut ≤ board length or a splice step | F6 |
| I5 | step-depth.test, step-dense.test (dense z-grid), strut/cone test | F12 |
| I6 | build step lights >0 and not every part (whole-unit steps exempt) | F12 |
| I7 | no span warning left | F1 |
| I8 | typed W/H/D = model ±1/8″ | F2 |
| I9 | hardware in notes/steps is on Buy | F7 |
| I10 | 9999 wide / 3,000-char prompt build < 10 s, clamped (test) | F22 |
| I11 | template leaks (0″, both X as, drives 0, shelf into cleat, closet, glides) | F9 |
| I12 | Trusted only on trusted recipes, never with a span warning | F18 |
| I13 | outdoors: no interior ply on the ground | F21 |
| I14 | no part placed before what it rests on | F11 |
