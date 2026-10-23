import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { listLocalYards, saveLocalYard, yardIsSavable } from "./persist";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});

test("a refused build is never saved to Saved yards; a built one is", () => {
  const refused = generateFromPrompt("abacus 4 wide 8 rods");
  const built = generateFromPrompt("bookcase 36 wide 72 tall");
  assert.equal(yardIsSavable(refused), false);
  assert.equal(yardIsSavable(built), true);
  saveLocalYard(refused);
  assert.equal(store.has(`yard_full_${refused.id}`), false);
  assert.deepEqual(listLocalYards(), []);
  saveLocalYard(built);
  assert.deepEqual(listLocalYards().map((c) => c.id), [built.id]);
});

test("a refusal saved before the rule is left out of Saved yards", () => {
  const refused = generateFromPrompt("abacus 1 wide 1 rod");
  store.set(`yard_full_${refused.id}`, JSON.stringify(refused));
  const cards = JSON.parse(store.get("yard_library_v1") ?? "[]");
  store.set("yard_library_v1", JSON.stringify([{ id: refused.id, name: refused.name, prompt: refused.prompt, kind: refused.kind, savedAt: "", pieces: 0 }, ...cards]));
  assert.ok(!listLocalYards().some((c) => c.id === refused.id));
});
