# 007 Live path, bought-item size table, typed noun as title

## Why
The engine built ship/pirate ship/landmarks/purpose asks, but the live bar (run-prompt.ts) decided "learn" before the
build from a craft guess and ignored the purpose resolver and form library, so buildable prompts went to the learner.
14 countable bought items fell outside the unit table (placeholder / stand-in builds). Library forms titled builds with
their own name ("Sailing ship" for "pirate ship"), and longship/viking ship built the galleon.

## What (in order)
- **L1 · Live path (I23, F17).** One ownership rule (formOwnership.ts `routesToLearner`) used by run-prompt.ts and by
  I23: route to the learner only when the engine has no form. Engine forms = purpose resolver, a library form that reaches
  the typed head noun (`namedFormReachesHead`; landmarks own their proper name; "wall clock" is a clock, not a Wall), or a
  weekend mechanism (trebuchet). A half-read prompt still learns unless the resolver consumed it or the title carries
  the words ("Dutch Windmill"); "lap desk", "cold frame", "chicken tractor", "wall clock" still learn.
  *Invariant I23:* no prompt that names a form or purpose the engine builds routes to the learner.
  Live-path test runs runYardPrompt (stubbed AI) on ship, pirate ship, keys and every C1 sweep prompt.
- **C2 · Bought-item size table (I20).** `BOUGHT_SIZES` fallback in unitSizes.ts: zip/cable tie, marble, clothespin,
  16d nail, rubber band, button, binder clip, golf tee, straw, pipe cleaner, cork, shoelace, bottle cap, cotton ball —
  one piece each, cited trade size, sold by the pack. A purchased-item build counts one bought piece per drawn part;
  sizes under 1/32" print in thousandths, never 0".
  *Invariant I20 (extended):* a prompt naming one size-table item on its own builds as a purchased item.
- **C3 · Typed noun as title (I24).** A library-form title uses the typed form words when the form's own name differs
  ("Pirate ship", "Galleon", "Tall ship"). Fitted builds keep their trade titles (Planter box, Coat bench); I24 covers library-form builds. A
  Longship form (long low hull, one mast, upswept stem and stern) answers viking ship / longship / drakkar.
  *Invariant I24:* the title contains the typed head noun (head = last content word before from/with/for…).

## Gates
Per-build I23/I24 in invariants.ts; whole-class tests classL1/classC2b/classC3t + livePath.test.ts; sweeps
evals/sweeps/l1-live-path.md, c2b-bought-items.md, c3t-typed-title.md (20 prompts each). Canaries 6/6, linen $183.70,
eval 854/874 (20 misses, unchanged). Live bar also skips the hint/interpret server calls for engine-owned prompts (cost leak), gate 0, no xAI.
