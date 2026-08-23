# Yard production board — 2026-08-22

Locked with Ezra. Overnight refiner **paused**. No new form classes until the four house demos are honest.

## Decisions

| # | Call |
|---|---|
| Audience | Both. Homepage hero = **house** (measure a space). Weekend crafts stay, second row. |
| Done in 2 weeks | A stranger can finish a real build from a Yard PDF. |
| Primary path | Closet / fitted. Craft secondary, not forgotten. |
| Paper | Demoted. Engine stays; off the homepage and chip bar. |
| Money | Shop links untagged. Ask before public launch. |
| Accounts | Later. Local save is enough. |
| Launch sizes | Invented (below). |
| Automation | Evening push 8:30–11pm EDT 22 Aug — 20 min slices. Overnight refiner stays paused. |

## Freeze walk (must stay green)

1. Bathroom pocket vanity (original trapezoid)
2. Linen closet **31.5 × 78 × 16** — name, HUD, opening, and cut list all say those numbers
3. Andersen 36×48 hung + rough opening
4. 60″ desk, 30 deep, 29 high, 24″ knee
5. 3-ft popsicle Eiffel (weekend, still works)
6. PVC garden arch (weekend)
7. Straw Warren (weekend)

## 10 invented launch builds

House (PDF must be followable):

1. Bathroom pocket vanity — original prompt
2. Linen closet 31.5 × 78 × 16 bathroom alcove
3. Andersen 100 Series 36×48 double hung, frame the RO
4. Desk 60 × 30 × 29 with drawers and 24″ knee
5. Hall pantry 24 wide × 84 tall × 14 deep, 5 shelves, ¾″ plywood
6. Mudroom bench 48 wide × 18 deep × 18 high with 3 cubbies
7. Kids bookcase 30 wide × 11 deep × 48 high, 4 shelves
8. Media console 60 wide × 16 deep × 24 high, two doors, open center

Weekend (same engine, not the hero):

9. 3 foot Eiffel Tower from popsicle sticks
10. 6 foot garden arch from ¾ inch PVC pipe

## Sequence

1. **Shipped** — house-first landing, paper chips off, closet size lock (bathroom ≠ vanity, envelope = unit).
2. **Shipped** — fitted plan voice: confirm → cut (counts × sizes) → stand carcase → dividers/drawers/shelves/doors → shim or level. Unique to the panels on the bench.
3. **Walk the 10** — `scripts/walk-launch.ts` 10/10 green locally. Re-walk on production after deploy.
4. **Ask Ezra** before Amazon tag, domain, or accounts.

## Evening push (22 Aug 2026)

- **Shipped 8:30** — studio lighting: shadow camera actually covers a closet, ply face veneer (not stick grain), fitted 3/4 eye-level, contact shadow sized to the unit. Eiffel still skips per-stick shadows.
- **Shipped 8:46** — Cut / Don’t cut on the HUD. Ply/closet stays Cut. Popsicle/straw default Don’t cut. Paper locked whole. Regenerates the graph/plan language.
- **Shipped 9:06** — Closet shop truth: edge banding on cut edges, two concealed hinges + bar pull per door, cup pull on drawers, 32mm-style pin holes on uprights. Hardware rides the door when it swings.
- **Shipped 9:26** — Stock shape: popsicle rounded on the 3/8″ face (not the thin edge); PVC/straw are hollow at catalog ID; ¾″ doors are 0.75″ not 0.35″; sheet cuts honor cutLength.

## Do not

- Add 2D silhouettes or more paper chips
- Restart the hourly refiner
- Push empty / PLACEHOLDER files
- Invent a size the prompt did not give
