import type { KnownTestFailure } from "./guard-known-failures";

/**
 * Test files that ran as their own CI steps before the unit tests were sharded (#143), where the
 * known-failures list never applied. The sharded runner keeps that: a failure in one of them is always real.
 */
export const NEVER_SKIPPED_TEST_FILES = ["scripts/invariants.test.ts", "scripts/hunter.test.ts", "scripts/weekend-canaries.test.ts"];

/** True when this failing test may be tolerated: listed (file + exact name), not strict, and not a never-skipped file. */
export function isKnownTestFailure(list: KnownTestFailure[], file: string, test: string, strict: boolean): boolean {
  return !strict && !NEVER_SKIPPED_TEST_FILES.includes(file) && list.some((k) => k.file === file && k.test === test);
}
