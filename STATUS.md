# See inside PR 1 (swe2-see-inside-1) — LOCAL ONLY, do not push

Waits until #39 and #83 land in release/2026-10-21. Worktree /workspace/see-inside from origin/release/2026-10-21 (a690e3a).
Spec: /workspace/see-inside-walk/PLAN.md. Push once, then PR -> release/2026-10-21.

## Steps
- [x] (a) EPV e2e scripts/e2e/see-inside-every-piece.py + ?test=1 hook window.__yardExplode (idPass, soloPass, corners, safeRect, settled, stepper stub, canary)
- [ ] (a) baseline run (today's explode) — running, /tmp/si/base/baseline.log
- [ ] (b) staged unit explode + layout solver (PLAN §2)
- [ ] (c) camera: fit the exploded box, 32° look-down, phone pose (PLAN §3)
- [ ] guards, Lighthouse, after-run, screenshots

## Log
