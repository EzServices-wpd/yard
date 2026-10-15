import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CANARIES, snapshot } from "./weekend-canaries.ts";

// Weekend canaries (Ezra): Big Ben, the Eiffel Tower, the Brooklyn Bridge, a trebuchet, a submarine and a water wheel
// keep every part's size and position and their part count exactly as snapshotted from main before Block 1.
const want = JSON.parse(readFileSync(new URL("../evals/weekend-canaries.json", import.meta.url), "utf8"));
const now = snapshot() as Record<string, { partCount: number }>;
for (const q of CANARIES) {
  test(`weekend canary: ${q} geometry is unchanged`, () => {
    assert.equal(now[q].partCount, want[q].partCount, `${q}: part count`);
    assert.deepEqual(now[q], want[q]);
  });
}
