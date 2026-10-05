# Feature Specification: Engine Cleanup

**Feature Branch**: `001-engine-cleanup`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Engine cleanup: prompt snapshots + fitted.ts modularization + ARCHITECTURE.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Freeze prompt behavior with golden snapshots (Priority: P1)

Maintainers need ~40 golden prompt snapshots that lock title, overall dimensions, part counts/names, and key honesty signals across fitted house builds, weekend named-stock builds, craft/kit builds, and unknown-noun fallbacks. Snapshots must stay green in the existing unit-test / CI path before any engine file move.

**Why this priority**: Constitution IV — Snapshot Before Refactor. Without goldens, modularizing `fitted.ts` risks silent honesty regressions (especially the sacred linen closet).

**Independent Test**: Run the prompt-snapshot suite alone; all ~40 cases pass against committed goldens with no live LLM.

**Acceptance Scenarios**:

1. **Given** the committed golden set, **When** unit tests run, **Then** every case matches name, overall dims, panel/instance counts, unique part names, notes head, and honesty signals.
2. **Given** prompt `linen closet 31.5 wide 78 tall 16 deep`, **When** the snapshot suite runs, **Then** overall is exactly 31.5 × 78 × 16 and the linenExact signal is true.
3. **Given** craft prompts (popsicle / cardboard / straw / toothpick), **When** snapshots run, **Then** craftStock is true and geometry stays deterministic.
4. **Given** unknown nouns without stock, **When** snapshots run, **Then** a simple real-size piece is produced (fallback path) with stable title/dims/parts.

---

### User Story 2 - Modularize fitted.ts behind a stable facade (Priority: P2)

Maintainers need the ~7000-line `src/lib/yard/fitted.ts` split into coherent modules (parse/detect, wine, builders, buildFitted core, shared helpers) with `fitted.ts` remaining a thin re-export facade so existing importers keep working unchanged.

**Why this priority**: Enables safe ongoing honesty work without editing a monolithic file; only safe after P1 goldens are green.

**Independent Test**: After the split, the same snapshot suite and typecheck stay green; importers still resolve symbols from `./fitted` / `@/lib/yard/fitted`.

**Acceptance Scenarios**:

1. **Given** green snapshots, **When** code is moved into sibling modules and re-exported from `fitted.ts`, **Then** no public export is removed and snapshots still match.
2. **Given** an intentional honesty fix is needed during the split, **When** goldens must change, **Then** the change is documented in the commit and goldens are updated deliberately (not silently).

---

### User Story 3 - Document engine layout in ARCHITECTURE.md (Priority: P3)

Maintainers and future agents need `docs/ARCHITECTURE.md` describing the engine layout after the split, pointing at real file paths (fitted modules, prompt entry, report/steps, weekend/craft paths).

**Why this priority**: Makes the modular layout discoverable; can ship with a stub if modularization is deferred, but should point at real post-split paths when the split ships.

**Independent Test**: Open `docs/ARCHITECTURE.md` and confirm every listed path exists in the tree.

**Acceptance Scenarios**:

1. **Given** the feature is complete, **When** a reader opens `docs/ARCHITECTURE.md`, **Then** they see the prompt → parse/build → plan pipeline and the fitted module map with real paths.

---

### Edge Cases

- Snapshot suite must not call a live LLM; failures must be deterministic.
- If a split would require redesign (not a move), defer that piece and document a `ponytail:` note rather than inventing new abstractions.
- Sacred linen closet dims must never drift during refactor.
- Unknown-noun fallbacks must not inherit craft stock unless craft stock was typed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide approximately 40 golden prompt snapshot tests covering fitted-house, weekend-named-stock, craft-kit, and unknown-fallback buckets.
- **FR-002**: Each snapshot MUST lock title (name), overall width/height/depth, panel count, instance count, unique part names, notes head (first notes), and key honesty signals.
- **FR-003**: Snapshot tests MUST run through the existing TypeScript unit-test runner (`scripts/run-unit-tests.ts` / CI Unit tests step) with no new dependencies.
- **FR-004**: Snapshot tests MUST use the same pure entry points the app uses (`generateFromPrompt` / fitted parse+build path) with no network LLM.
- **FR-005**: After snapshots are green, `fitted.ts` MUST be split into coherent sibling modules with a thin re-export facade preserving public exports.
- **FR-006**: Callers that import from `fitted` MUST continue to work without import-path edits (facade obligation).
- **FR-007**: Linen closet **31.5 × 78 × 16** MUST remain exact in name/HUD/opening/cut-list signals covered by snapshots.
- **FR-008**: `docs/ARCHITECTURE.md` MUST describe the engine layout and point at real paths after the split.
- **FR-009**: Behavior MUST match snapshots unless an intentional honesty fix is documented and goldens updated.

### Key Entities

- **PromptSnapshot**: Stable capture of one prompt's engine output (id, prompt, bucket, name, kind, material, overall, panels, instances, uniqueParts, notesHead, signals).
- **FittedModule**: Logical code region moved out of the monolith (shared helpers, wine, detect/parse, specialty builders, buildFitted).
- **ExportFacade**: `src/lib/yard/fitted.ts` re-export surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 40 prompt snapshot cases are committed and pass in the local CI/guards unit-test path.
- **SC-002**: All four buckets (fitted-house, weekend-named-stock, craft-kit, unknown-fallback) are represented in the golden set.
- **SC-003**: Linen closet snapshot reports exact 31.5 × 78 × 16 after any refactor.
- **SC-004**: Public fitted exports remain importable from the original module path after modularization.
- **SC-005**: `docs/ARCHITECTURE.md` exists and lists real engine paths that match the tree.
- **SC-006**: Spec Kit artifacts for this feature exist under `specs/001-engine-cleanup/`.

## Assumptions

- Existing `node:test` + `tsx` harness is sufficient; no Vitest/Jest added.
- Mechanical move of code (not redesign) is the intended modularization.
- Work ships on `main` after fetch/rebase and green local guards.
