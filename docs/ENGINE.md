# Yard engine

How a prompt becomes a buildable pile of stock. This is the product, not a CAD plugin.

## Priority

1. **Look like the thing.** Published measures and real anatomy first. A 3-ft Eiffel follows the 324 m / 125 m / 57·115·276 m stations, not a stacked wedding cake.
2. **Map the stock they named.** Toothpicks get more bays than popsicle sticks. No material quantity cap. The renderer may hitch past ~1,500 pieces; that is not a materials limit.
3. **Then make it stand.** One connected frame, a downward load path, bracing so it cannot rack. A figure is still built even if it will not take load — we offer a spine, we do not invent one.

## What we evaluated (and did not import)

| Approach | What it is | Why it is not the runtime |
|---|---|---|
| Grasshopper / Dynamo / Houdini | Node graphs for parametric solids | We need a prompt → stock mapping in the browser, not a Rhino plugin. The loft below is the same idea, written as code. |
| SIMP / topology optimization | Density fields that eat material where stress is low | Stick models have a discrete catalog. You cannot “thin” a popsicle stick. We keep members that carry the silhouette or triangulate a bay, and drop the rest. |
| Karamba / millipede | FEA on a mesh | Guidance, not stamped engineering. A downward path + closed hoops + Warren faces is the conservative check. |
| Ground-structure truss opt | Start with every node-to-node bar, drop unused | Too many bars at Eiffel scale. We generate only the loft + arches + decks, then weld and stitch. |

The useful idea we kept: **a parametric loft plus a cleanup pass**, not a black-box optimizer.

## Pipeline

```
prompt
  → size + material + named form (wiki / Grok when the key is set)
  → FormRecipe (strokes / ops) or the Eiffel loft
  → StructureGraph (nodes + edges)
  → weld · stitch · downward path
  → graphToInstances (stock length, lap splices)
  → bench + cut list + steps + plates
```

Closets and stock windows never enter this loft. They stay the contractor path (opening → carcase / RO).

## The loft

`src/lib/yard/lattice.ts` — `buildSquareLoft`

- A square section whose half-width is a function of height (`halfAt(t)`).
- Corner chords run the full height. That is the silhouette.
- Face posts keep the same *u* fraction from story to story so lacing continues instead of restarting.
- **Hoops only at the base, the published platforms, and a belt every few stories.** A hoop on every story is what made the last pass look like separate floors.
- Face lacing is a Warren field (one diagonal per bay, alternating). That triangulates the face without a chicken-wire floor plate.

Eiffel zones, from the real tower:

- **Piers** (ground → first platform, 57/324): four separate lattice legs. No face between them except the arch and the first deck.
- **Merge** (first → second, 115/324): the four chords come in; the face lattice starts.
- **Shaft** (second → tip): one tapering pylon. Lantern at the top.

Profile stations (outer face, meters) live on `EIFFEL_REAL.profile` in `ghost.ts` so the historic overlay and the stock share the same curve.

Any taper (clock tower, lighthouse, generic tower) uses the same loft. Grok strokes are resampled to stock spacing, snapped at shared ends, then welded.

## Structural pass (`connect.ts`)

After the loft:

1. **Weld** nodes that sit on the same joint.
2. **Stitch** leftover islands into the main body (mid-span crossings count).
3. **Downward path** — every node above the base has an edge to something lower. That is the load path.
4. **Spine** is optional. Figures always generate; the bench asks before adding a mast.

This is not analysis. It is a buildable topology. The plan still says so.

## Credits

## Any prompt

The named list (Eiffel, Taj, giraffe, …) is a **shortcut**, not the product. Every prompt goes through the same four steps:

1. **Class** — loft / shell / figure / span / carcase / opening. `classifyAnatomy` does this from the words, including “looks like …”. Unknown names still get a class (a dragon is a winged figure; an unnamed tower is a loft).
2. **Silhouette** — published wire if we have one; otherwise a default skeleton for that class. Grok, when the key is set, **replaces** the wire with the true form. It does not invent SKUs.
3. **Stock** — map the material they named onto that wire. Toothpicks pack tighter than popsicle sticks. No piece cap.
4. **Finish** — weld, stitch, downward path. Figures also get ribs at the hips and shoulders so the stick figure is one cage.

If Grok is down, the class default still builds. Closets and windows never enter this path.

See `src/lib/yard/anatomy.ts`.
