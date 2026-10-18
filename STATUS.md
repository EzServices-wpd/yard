# See inside PR 1 (swe2-see-inside-1) — LOCAL ONLY, do not push

Waits until #39 and #83 land in release/2026-10-21. Worktree /workspace/see-inside from origin/release/2026-10-21 (a690e3a).
Spec: /workspace/see-inside-walk/PLAN.md. Push once, then PR -> release/2026-10-21.

## Steps
- [x] (a) EPV e2e scripts/e2e/see-inside-every-piece.py + ?test=1 hook window.__yardExplode (idPass, soloPass, corners, safeRect, settled, stepper stub, canary)
- [x] (a) baseline run (today's explode): FAIL 16 runs, 101 failing — /workspace/see-inside-research/before/baseline.log (+ screenshots)
- [x] (b) staged unit explode + layout solver (PLAN §2) — 50a09c2 (first cut; e2e all builds pass on it except reduced-motion/tween tweaks below)
- [ ] (b2) tween safety: scripts/see-inside-layout.test.ts (no part passes through another unit at any frame; hardware rides host).
      Fixes: drawers slide out first, then step sideways + spread (Pose.lat); drawer start dist ≥ clear of case front;
      shelves after drawers; hardware follows host's stage window; filing (doors both sides) — WIP
- [ ] (c) camera: fit the exploded box, 32° look-down, phone pose (PLAN §3)
- [ ] guards, Lighthouse, after-run, screenshots

## Log
