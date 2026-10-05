import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { capturePromptSnapshot, type PromptSnapshot } from "./promptSnapshots.ts";

const here = dirname(fileURLToPath(import.meta.url));
const goldens = JSON.parse(
  readFileSync(join(here, "promptSnapshots.goldens.json"), "utf8"),
) as PromptSnapshot[];

describe("prompt snapshot goldens", () => {
  it("locks about forty representative prompts across four buckets", () => {
    assert.ok(goldens.length >= 40, `expected >=40 goldens, got ${goldens.length}`);
    const buckets = new Set(goldens.map((g) => g.bucket));
    for (const b of ["fitted-house", "weekend-named-stock", "craft-kit", "unknown-fallback"] as const) {
      assert.ok(buckets.has(b), `missing bucket ${b}`);
      assert.ok(goldens.filter((g) => g.bucket === b).length >= 8, `thin bucket ${b}`);
    }
  });

  for (const golden of goldens) {
    it(`${golden.bucket}: ${golden.id}`, () => {
      const live = capturePromptSnapshot({
        id: golden.id,
        prompt: golden.prompt,
        bucket: golden.bucket,
      });
      assert.equal(live.name, golden.name, "name");
      assert.equal(live.kind, golden.kind, "kind");
      assert.equal(live.material, golden.material, "material");
      assert.deepEqual(live.overall, golden.overall, "overall");
      assert.equal(live.panels, golden.panels, "panels");
      assert.equal(live.instances, golden.instances, "instances");
      assert.deepEqual(live.uniqueParts, golden.uniqueParts, "uniqueParts");
      assert.deepEqual(live.notesHead, golden.notesHead, "notesHead");
      assert.deepEqual(live.signals, golden.signals, "signals");
    });
  }

  it("linen closet stays exactly 31.5 × 78 × 16", () => {
    const linen = goldens.find((g) => g.id === "linen-closet");
    assert.ok(linen);
    assert.deepEqual(linen!.overall, { width: 31.5, height: 78, depth: 16 });
    assert.equal(linen!.signals.linenExact, true);
    const live = capturePromptSnapshot({
      id: linen!.id,
      prompt: linen!.prompt,
      bucket: linen!.bucket,
    });
    assert.deepEqual(live.overall, { width: 31.5, height: 78, depth: 16 });
    assert.equal(live.signals.linenExact, true);
  });
});
