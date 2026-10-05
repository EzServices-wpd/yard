# Yard Constitution

## Core Principles

### I. One Model Honesty
Typed prompt + chosen stock produce one geometry that drives title, HUD, Measure, cut list, Buy list, and steps. Voice, Buy, and model never disagree. Prefer positive wording and inch fractions users can cut to.

### II. Universal Engine Rules (Not Noun Patches)
Fixes are class-level Feasibility / Functionality / Practicality standards shared across products. Never ship a one-off that only patches a single noun and invents a new problem class elsewhere.

### III. Freeze Canaries First
Before any tip ships, these stay green and exact:
- Linen closet **31.5 × 78 × 16** (name, HUD, opening, cut list) — sacred; never change casually
- Bathroom pocket vanity (original trapezoid)
- Andersen 36×48 hung + RO
- Desk 60 × 30 × 29 with 24″ knee
- 3-ft popsicle Eiffel (craft still works; never an Eiffel lattice template)

### IV. Snapshot Before Refactor
Behavior-changing engine moves require golden snapshots of representative prompts (~40) covering fitted house, weekend named-stock, craft/kit, and fallback unknowns. Split or move code only after those snapshots are green; refactor must not change snapshot output unless the change is an intentional honesty fix with an updated golden and a written reason.

### V. Laziness With Root Cause (Ponytail)
Shortest working diff after tracing the real flow. Reuse existing helpers. No unrequested abstractions or new deps. Bug fix = shared root cause, not a symptom guard on one caller. Mark deliberate ceilings with a `ponytail:` comment.

## Product Constraints

- North star: type what you want → choose material → honest instructions + buy/cut lists.
- Affiliate / store links appear on the **Buy list only** (plus a one-click “Buy this list” Amazon cart). Never in the material/stock picker. Lumber and plywood sheets may keep local store links.
- Headline: “Think it up. Yard works it out.” Subline: “One model. Every cut, part and step.” No cut diagram on the home start screen.
- Public contact: hello@yard.wiki on About/Privacy.
- Geometry stays deterministic; LLM voice does not overwrite locked named form recipes.
- Do not scrape copyrighted plan books; do not train on DIY instruction PDFs.

## Development Workflow

1. Work in `/workspace/yard-chief` (or equivalent fresh clone). Fetch and rebase on `origin/main` before every push.
2. Ship with `env -u GH_TOKEN -u GITHUB_TOKEN git push origin HEAD:main` via the box `gh` login as EzServices-wpd. Never force-push. Never read tokens from connector-secret files; if auth lapses, stop and ask Ezra.
3. Run full local CI / guards before push. If main moved, rebase, re-run guards, push again.
4. Spec Kit order for non-trivial work: constitution → specify → plan → tasks → implement → converge. Pair implement with Ponytail.
5. Ask Ezra only when a decision or irreversible action needs him; otherwise push ahead on honesty fixes.

## Governance

This constitution supersedes ad-hoc coding habits for Yard. Amendments require an updated version line and a short note in the commit. Runtime product guidance also lives in `docs/ENGINE.md` and the Refine Yard skill; when they conflict on governance, this file wins until amended.

**Version**: 1.0.0 | **Ratified**: 2026-10-05 | **Last Amended**: 2026-10-05
