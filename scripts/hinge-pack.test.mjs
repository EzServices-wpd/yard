import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../src/lib/yard/listings.ts", import.meta.url), "utf8");

test("cabinet hinge listing is one pair, so two doors buy two packs", () => {
  const block = src.slice(src.indexOf('catalogId: "cabinet-hinges"'), src.indexOf('catalogId: "cabinet-bar-pulls"'));
  const packQty = Number(block.match(/packQty:\s*(\d+)/)[1]);
  assert.equal(packQty, 1, "a pair listing must count as one pack, not two hinges");
  const pairs = 2;
  const packsNeeded = Math.max(1, Math.ceil(pairs / Math.max(1, packQty)));
  assert.equal(packsNeeded, 2);
});
