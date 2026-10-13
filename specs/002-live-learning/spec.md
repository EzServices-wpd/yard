# Feature Specification: Learning on the spot

**Feature**: `002-live-learning` · **Status**: Draft · **Created**: 2026-10-13

## Why
Grade e4447aa (Grok, 100 prompts): 18 new nouns showed "Not learned yet" and stayed that way on rerun.
The lookup ran and often passed, but the page said "couldn't learn" after 22 s while it was still
learning, and a reload dropped the result.

## User scenarios
1. **Learn in the session** — a visitor types a noun nothing owns. The bench shows a grey placeholder and
   "Yard is learning the <noun>" until the lookup ends (up to ~155 s). When the recipe passes the checks, the
   real model, steps and Buy list replace the placeholder in that same session, with no reload.
2. **Rerun or reload** — the same visitor types it again or reloads: the learned model shows at once.
3. **Everyone later** — the passed recipe is proposed to the recipe-bot PR; once CI passes and it merges,
   every visitor gets it from `recipes.json` with no AI call.
4. **Honest failure** — if both lookup calls fail, the placeholder stays with "Yard couldn't learn the
   <noun> yet": no price, no stock chip, no parts.

## Requirements
- **R1** The banner says "learning" while the lookup runs and "couldn't learn" only after it ends.
- **R2** A passed recipe renders in the visitor's session as soon as it passes.
- **R3** A passed recipe is kept in the visitor's browser (localStorage) and reused on rerun or reload.
- **R4** A recipe is keyed by the typed noun without stock words ("knife block", not "block" or
  "knife block maple"), so it never takes over a noun the engine already builds.
- **R5** At most 2 AI lookup calls per object; a saved recipe needs none.
- **R6** The recipe bot proposes each passed recipe; a fresh PR starts from main.

## Acceptance tests (Grok's 18, live yard.wiki, fresh headless session, wait up to 210 s)
cribbage board · cornhole board · birdhouse shaped like a church · Adirondack footrest · beehive box from
cedar · raised dog feeder stand · wall-mounted mail organizer · sawbuck from 2x4 · miter saw station ·
router table · compost tumbler frame · rain barrel stand from 2x4 · wall clock frame 12 inch · knife block
from maple · cutting board 12 by 18 · toy train track riser · window box from cedar 30 inches · barn birdhouse

Pass = the session ends on a learned model (no placeholder banner), or on the honest "couldn't learn"
banner after both calls fail (counted separately as a lookup miss, never a silent guess).
