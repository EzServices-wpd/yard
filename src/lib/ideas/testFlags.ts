/**
 * Test traffic flags (#56: offline=1, local=1, test=1). Ideas carries them onto every build URL, so a
 * Critic or canary run that opens Ideas offline stays offline in the workspace (no AI calls, no log rows).
 */
import { sessionTest } from "./testSession";

export const TEST_FLAGS = ["offline", "local", "test"] as const;
// Numbers, not "1": the router writes a numeric-looking string as JSON ("%221%22"), which breaks the
// `offline=1` checks downstream; a number serializes as plain `offline=1`.
export type TestFlags = Partial<Record<(typeof TEST_FLAGS)[number], 1>>;

export function pickTestFlags(src: Record<string, unknown> | URLSearchParams | string | null | undefined): TestFlags {
  const out: TestFlags = {};
  if (!src) return out;
  const get = (k: string): unknown =>
    typeof src === "string" ? new URLSearchParams(src).get(k) : src instanceof URLSearchParams ? src.get(k) : (src as Record<string, unknown>)[k];
  for (const k of TEST_FLAGS) {
    const v = get(k);
    if (v === "1" || v === 1 || v === true || v === '"1"') out[k] = 1;
  }
  return out;
}

/** Flags on the current page, plus test=1 when this tab session is a test run (client only; SSR has none). */
export function currentTestFlags(): TestFlags {
  if (typeof window === "undefined") return {};
  const out = pickTestFlags(window.location.search);
  if (sessionTest()) out.test = 1;
  return out;
}
