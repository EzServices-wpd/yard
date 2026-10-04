/**
 * Known guard failures — the ONE explicit skip list for the guard suite.
 *
 * Every guard calls `guardFail(guard, kind, message, extra)` instead of exiting on its own.
 *   - A message that matches an entry below prints `KNOWN …` and the guard keeps going.
 *   - Any other message prints `FAIL …` and exits 1, which turns the CI check red.
 *
 * Rules for this list:
 *   - One entry per failing check, matched on the exact FAIL message text (prefix match).
 *   - Each entry says why it is tolerated and who owns the fix.
 *   - Delete the entry the moment the fix lands. The guard prints `STALE KNOWN` for an entry
 *     that did not fire in this run, so the list shrinks as work lands.
 *
 * Environment:
 *   GUARD_STRICT=1   ignore this list (every failure exits).
 *   GUARD_AUDIT=1    treat every failure as known and keep going (to count failures locally).
 */

export type KnownFailure = {
  /** Guard file id: "honesty-smoke" | "honesty" | "weekend" | "climb-buy" */
  guard: string;
  /** Start of the FAIL message, matched exactly. */
  message: string;
  /** Why it is tolerated today, and who owns the fix. */
  why: string;
};

export const KNOWN_FAILURES: KnownFailure[] = [
  // ---- yard-honesty-smoke.ts --------------------------------------------------------------
  // The smoke exited at the desk check for months, so every check after it went unseen. These were
  // already failing on origin/main before the CI work (2026-10-02 audit); each needs its own fix.
  { guard: "honesty-smoke", message: "pyramid piece count drifted", why: "popsicle pyramid grew to ~7,200 pieces (pre-existing; prompt re-added to the smoke on 2026-10-02) — owner: craft structures" },
  { guard: "honesty-smoke", message: "pyramid structure should stay stepped courses", why: "pyramid courses read as a lattice (pre-existing) — owner: craft structures" },
  { guard: "honesty-smoke", message: "pyramid faces got laced shut", why: "pyramid faces skinned shut (pre-existing) — owner: craft structures" },
  { guard: "honesty-smoke", message: "golden gate needs a road you can walk", why: "popsicle Golden Gate has no deck (pre-existing) — owner: craft structures (bridges)" },
  { guard: "honesty-smoke", message: "straw bridge needs a road", why: "straw bridge has no deck (pre-existing) — owner: craft structures (bridges)" },
  { guard: "honesty-smoke", message: "golden gate plan lost the forge steps / road", why: "Golden Gate steps lost the road/forge steps (pre-existing) — owner: craft structures (bridges)" },

  // ---- yard-honesty-guards.ts ------------------------------------------------------------
  // None: c7306d3 ("Honesty guards to zero") cleared the last ones on 2026-10-02.
];

/**
 * Unit tests (tsx --test) known to fail on origin/main before the CI work. Matched on file + test
 * name; a parent test is tolerated when every failing child under it is listed. Same rules as above.
 */
export type KnownTestFailure = { file: string; test: string; why: string };
// Empty: productPrompt and stockPersonas were fixed on main by 67112a1 (2026-10-02). Add an entry
// here (file, test name, why + owner) only for a failure that is already on main.
export const KNOWN_TEST_FAILURES: KnownTestFailure[] = [];

const hits = new Set<KnownFailure>();
let auditCount = 0;
const guardsSeen = new Set<string>();
let hooked = false;

function hookExit() {
  if (hooked) return;
  hooked = true;
  process.on("exit", (code) => {
    if (code !== 0) return;
    for (const k of hits) console.warn(`KNOWN (skip list) ${k.guard}: ${k.message} — ${k.why}`);
    for (const k of KNOWN_FAILURES) {
      if (guardsSeen.has(k.guard) && !hits.has(k)) {
        console.warn(`STALE KNOWN ${k.guard}: "${k.message}" did not fire — remove it from scripts/guard-known-failures.ts`);
      }
    }
    if (auditCount) console.warn(`AUDIT: ${auditCount} failure(s) recorded with GUARD_AUDIT=1`);
  });
}

/** Register a guard id so stale entries for it can be reported at exit. */
export function guardStart(guard: string) {
  guardsSeen.add(guard);
  hookExit();
}

export function guardFail(guard: string, kind: string, msg: string, extra?: unknown): void {
  guardStart(guard);
  if (process.env.GUARD_STRICT !== "1") {
    const known = KNOWN_FAILURES.find((k) => k.guard === guard && msg.startsWith(k.message));
    if (known) {
      hits.add(known);
      console.warn(`KNOWN ${kind}`, msg);
      return;
    }
    if (process.env.GUARD_AUDIT === "1") {
      auditCount++;
      console.error(`FAIL ${kind}`, msg, extra ?? "");
      return;
    }
  }
  console.error(`FAIL ${kind}`, msg, extra ?? "");
  process.exit(1);
}
