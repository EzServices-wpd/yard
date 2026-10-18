# See inside PR 1 (swe2-see-inside-1) — LOCAL ONLY, do not push

Waits until #39 and #83 land in release/2026-10-21. Worktree /workspace/see-inside from origin/release/2026-10-21 (a690e3a).
Spec: /workspace/see-inside-walk/PLAN.md. Push once, then PR -> release/2026-10-21.

## Steps
- [x] (a) EPV e2e scripts/e2e/see-inside-every-piece.py + ?test=1 hook window.__yardExplode (idPass, soloPass, corners, safeRect, settled, stepper stub, canary)
- [x] (a) baseline run (today's explode): FAIL 16 runs, 101 failing — /workspace/see-inside-research/before/baseline.log (+ screenshots)
- [x] (b) staged unit explode + layout solver (PLAN §2) — 50a09c2 (first cut; e2e all builds pass on it except reduced-motion/tween tweaks below)
- [x] (b2) tween safety: scripts/see-inside-layout.test.ts (no part passes through another unit at any frame; hardware rides host).
      Fixes: drawers slide out first, then step sideways + spread (Pose.lat); drawer start dist ≥ clear of case front;
      shelves after drawers; hardware follows host's stage window; filing (doors both sides) slides out past the doors then steps aside
- [x] guards at 8781905: all STEP_OK (tsc … build; see-inside-layout.test 41 ok), /tmp/si/guards.log
- [x] e2e frameFresh wait (f630031): a late card refit raced the reduced-motion comparison (0.9–3 px, first build only)
- [x] (c) camera (in 50a09c2: fitPoints over posed corners, 32° look-down, overlay refit glide, phone DPR) — committed with (b)
- [x] after-run (all 8 builds × desk/phone + reduced motion): 16 runs, every piece passes; expected-stepper only desk phone toekicks (2) and pocket-vanity toekicks (2). One rm one-off on the first build (0.90 px), e2e now re-measures and reports it.
- [x] Lighthouse mobile (release 8131 vs this 8133, box under load): home median 88/88, Ideas 92.5/90 over 6 (identical Ideas JS, noise), workspace 29/29 (+8.3 KB gz). CLS 0.00015 on both (pre-existing).
- [x] guards green; tsc, linen exact, weekend canaries 6/6, see-inside-layout 41/41 at HEAD
- [x] servers/Chrome killed. Not pushed: waits for #39 and #83 in release/2026-10-21 (merge-tree with today's release: clean).

## Log
- Artifacts: /workspace/see-inside-research/{before,after}/ (screenshots, logs, json), lighthouse.log, guards.log
- [x] drawer lookup for SWE's hollow drawers (drawerIdOf/drawerPartOf/setDrawerTag in explode-layout.ts; field name TBD)
