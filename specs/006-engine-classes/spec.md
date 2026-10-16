# 006 Engine classes: purchased whole items, size phrases, named forms

## Why
Tonight's intake (yard-backlog.md, C1–C3) is 54 hits in three root classes. Fixing items one at a time regresses
neighbours; each class gets one resolver, one invariant and a whole-class test.

## What (in order)
- **C3 · Purchased whole items (I20, F47/F9/F10).** A build made only of unit-table pieces (unitItems.ts) has no cut step,
  no 0″ size, no fit warning ("Opening is tight"), no furniture effort rating, no "(size assumed)" header, plurals on the
  noun, and a Buy line that says what the steps say (a whole dowel is "used as bought", never "cut, 1/8 kerf").
  Clips are drawn as wire loops; a paper clip necklace/bracelet is a closed loop of linked clips; a typed chain length
  lands within 1/8″ or the note says "nearest whole clip". Jumbo craft sticks come from the table.
  *Invariant I20:* on a purchased-item build, no step says "Cut the <item>" and no text shows a 0″ size; the header is not
  assumed; every Buy note agrees with the steps.
- **C2 · Size phrases (I21, F2).** Size phrases are parsed and stripped before noun matching: "knee high" 18″ H,
  "waist high" 36″ H, "counter height" 36″ H (stool seat 25″), "bar height" 42″ H (seat 30″), "as wide as a twin/full/queen/king
  bed" 39/54/60/76″ W, "half a sheet of plywood" 48×48, "a full sheet of plywood" 48×96, "N foot" with no axis = the
  form's long axis, "for a N inch TV" sizes the stand to the TV (N″ diagonal → 0.87·N + 4″ W).
  *Invariant I21:* every typed or phrase-derived axis holds within 1/2″.
- **C1 · Named forms (I22, F17).** A head-noun + purpose resolver maps a request to a known form (the head noun wins over
  "that fits / for a" objects) and a form library adds named silhouettes sized from the one typed axis with real
  proportions. Existing detailed landmarks (Big Ben, Eiffel, the named bridges, the trebuchet) keep their geometry.
  *Invariant I22:* no request that names a known form or purpose falls back to "Not learned yet" or a generic form.

## Gates
Each invariant runs per build in invariants.ts, plus a whole-class test and a 20-prompt sweep saved under
`evals/sweeps/` (c3-purchased.md, c2-size-phrases.md, c1-named-forms.md). Weekend canaries 6/6 unchanged, linen
exact ($183.70), eval never drops, gate exits 0. No xAI calls.
