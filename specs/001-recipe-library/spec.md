# Feature Specification: Learning recipe library

**Feature**: `001-recipe-library` · **Status**: Draft · **Created**: 2026-10-11

## Why
When no family or template matches a noun, Yard today falls back to a closed shape (a 24" cube for
Taj Mahal, Colosseum, cardboard marble run) or silently swaps in the nearest template (deck stairs builds
a deck, Murphy bed a platform bed). Grade 2da150e: 25 novel prompts, 1 Pass / 7 Partial / 17 Fail.

## User scenarios
1. **Named object with no template** — "Taj Mahal cardboard" builds a plinth, a central onion dome on a
   drum, four corner minarets and arched iwans, at real proportions, in craft stock with glue.
2. **Typed count honored** — "cedar compost bin 3 bays" builds 3 open slatted bays sharing posts.
3. **Outdoor size words** — "pergola 10x10" reads feet: 120" × 120" on 4×4 posts.
4. **Unsupported defining part** — if a recipe's defining part cannot be built, the page says plainly in
   positive words which part is shown roughly ("Shown as a rough shape: the fold mechanism comes next"),
   and never relabels the nearest template as the named object.
5. **Offline** — a saved recipe rebuilds the same model with no network and no AI call.

## Requirements
- **R1 Recipe, not shape.** The AI lookup returns a structured recipe: defining parts with roles (post,
  rail, tower, cable, deck, wheel+axle, roof, bay, dome, minaret, stringer, tread, cleat, lid, hinge…),
  real proportions (ratios to the overall), connections and what supports what, a typical real size and
  stock, and moving parts (fold, hinge, pivot, spin).
- **R2 Store.** Recipes live in `src/lib/yard/recipes.json`, committed. Key = normalized head noun plus
  modifiers (`compost-bin|bays`), with synonyms that resolve to the same key. Each recipe has `version`
  and `trust: "candidate" | "trusted"`; Critic grades promote or demote. No runtime store and no paid
  infra; a runtime save path is a separate proposal.
- **R3 Build from existing builders.** The engine maps each role to an existing family/builder part
  (members, panels, arcs, cables, wheels). A recipe never adds geometry code of its own.
- **R4 Validate.** Every recipe build runs the standard checks: load path for every part, parts after
  supports, no closed-shell fallback, typed sizes and counts honored, hardware equal across notes, Buy and
  model, page == engine. A failure retries once with the failure text fed back to the lookup; a second
  failure ships as a plainly labelled rough shape.
- **R5 Stock.** Typed stock follows the stockForm rule; a stock switch keeps the form and exact W×D×H.
- **R6 Deterministic.** Trusted recipes build with no AI call; the build is a pure function of
  (recipe, prompt, stock).
- **R7 Guards.** linen closet 31.5 × 78 × 16 is unchanged; uiPath and existing guards stay green.

## Acceptance
All 25 novel prompts of grade 2da150e (w01–w07, o01–o06, l01–l06, x01–x06) are acceptance tests. Seed
recipes first: Taj Mahal, Colosseum, cardboard marble run, cedar compost bin 3 bays, deck stairs, Murphy
bed queen, mudroom locker 3 bays, floating desk, pergola 10x10, Brooklyn Bridge, balsa glider, toy
airplane with propeller, ferris wheel, tipi with cover, reindeer with antlers, popsicle treasure chest.
Each test checks the defining roles exist, sizes/counts match, and the build passes R4.

## Cost and usage
- Lookup uses the existing `chat()` in `src/lib/ai/grok.ts` (grok-4.5, JSON mode): at most 2 calls per
  unseen noun (lookup + one retry), 0 for any noun with a saved recipe.
- Cache: committed recipes plus an in-memory per-instance map; misses on cold serverless instances
  repeat the call until the recipe is committed. Promoting candidates into the JSON is the durable cache.

## Out of scope
Runtime writes to a store (proposal only); new geometry primitives; Critic items 3, 6, 7 (queued after).
