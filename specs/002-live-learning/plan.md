# Plan: 002-live-learning

- Banner: `shell.tsx` reads the placeholder's first note ("Yard is learning…") to pick learning vs
  couldn't-learn text; shown whether or not the bench is busy (R1). Shipped e0f223a.
- Session render: `run-prompt.ts` already calls `generate` after `lookupAndBuild` passes (R2).
- Persistence: `recipes.ts` `rememberRecipe` writes the learned list to localStorage and loads it at start;
  `findRecipe` sees it, so `runYardPrompt` skips the lookup (R3). Shipped e0f223a.
- Keying: `lookupAndBuild` keys by `normalizeNoun(prompt)`; `normalizeNoun` drops "from/made of/out of
  <stock>" (R4). Shipped 4446e8c + e0f223a.
- Verify: `/tmp/pp/walk.mjs` (puppeteer, fresh profile) runs the 18 on live and logs the header, banner,
  lookup console lines and serverFn calls.
