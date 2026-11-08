import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { KNOWN_TEST_FAILURES } from "./guard-known-failures.ts";
import { isKnownTestFailure } from "./unit-known.ts";

test("the unit runner never tolerates a listed failure in the invariants, hunter or weekend canaries files", () => {
  // Literal paths, not NEVER_SKIPPED_TEST_FILES: dropping one from that array must fail here (Critic row 415).
  const pinned = ["scripts/invariants.test.ts", "scripts/hunter.test.ts", "scripts/weekend-canaries.test.ts"];
  const list = [...pinned, "scripts/plans.test.ts"].map((file) => ({ file, test: "t", why: "test" }));
  for (const file of pinned) {
    assert.ok(fs.existsSync(file), `${file} exists (a renamed file would silently fall back to the list)`);
    assert.equal(isKnownTestFailure(list, file, "t", false), false, file);
  }
  assert.equal(isKnownTestFailure(list, "scripts/plans.test.ts", "t", false), true, "other listed files still match");
  assert.equal(isKnownTestFailure(list, "scripts/plans.test.ts", "t", true), false, "GUARD_STRICT=1 ignores the list");
  assert.deepEqual(KNOWN_TEST_FAILURES.filter((k) => pinned.includes(k.file)), [], "no known entry names a never-skipped file");
});

test("run-unit-tests.ts decides known failures only through isKnownTestFailure", () => {
  // Source-level (Critic row 416): the runner spawns real test files, so a live run is too heavy for a unit test.
  const src = fs.readFileSync("scripts/run-unit-tests.ts", "utf8");
  assert.match(src, /^import \{ isKnownTestFailure \} from "\.\/unit-known";$/m);
  assert.match(src, /const isKnown = \(name: string\) => isKnownTestFailure\(KNOWN_TEST_FAILURES, file, name, strict\);/);
  assert.doesNotMatch(src, /\.some\(\(k\) => k\.file === file/, "no second list match that would skip the never-skipped rule");
});
