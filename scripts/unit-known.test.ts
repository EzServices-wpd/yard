import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { KNOWN_TEST_FAILURES } from "./guard-known-failures.ts";
import { isKnownTestFailure, NEVER_SKIPPED_TEST_FILES } from "./unit-known.ts";

test("the unit runner never tolerates a listed failure in the invariants, hunter or weekend canaries files", () => {
  const list = [...NEVER_SKIPPED_TEST_FILES, "scripts/plans.test.ts"].map((file) => ({ file, test: "t", why: "test" }));
  for (const file of NEVER_SKIPPED_TEST_FILES) {
    assert.ok(fs.existsSync(file), `${file} exists (a renamed file would silently fall back to the list)`);
    assert.equal(isKnownTestFailure(list, file, "t", false), false, file);
  }
  assert.equal(isKnownTestFailure(list, "scripts/plans.test.ts", "t", false), true, "other listed files still match");
  assert.equal(isKnownTestFailure(list, "scripts/plans.test.ts", "t", true), false, "GUARD_STRICT=1 ignores the list");
  assert.deepEqual(KNOWN_TEST_FAILURES.filter((k) => NEVER_SKIPPED_TEST_FILES.includes(k.file)), [], "no known entry names a never-skipped file");
});
