/** Spec 006 C1 · named forms and purposes: I22 over the whole class, and the landmarks that keep their own geometry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { checkBuild, genericFormMark } from "./invariants";
import { PURPOSES, resolvePurpose } from "./purposeForms";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";

const PURPOSE_ASKS = [
  "something to hang my keys", "a place to hang my car keys", "a place for my dog to sleep", "somewhere for my puppy to nap", "a place for my cat to sleep",
  "organize my tools", "a way to hang my tools", "plants by the window", "somewhere for my plants", "a holder for 6 fishing rods", "store my fishing rods",
  "somewhere to store my shoes", "a way to store my books", "hang my coats", "store firewood", "hold my wine bottles",
];
const SHIPS = ["pirate ship", "galleon", "tall ship", "sailing ship", "schooner", "viking ship", "pirate ship 18 inches long"];

test("C1: every purpose in the table has an ask that resolves to it", () => {
  for (const p of PURPOSES) assert.ok(PURPOSE_ASKS.some((q) => resolvePurpose(q)?.form === p.form), p.form);
});

test("C1/I22: no named form or purpose falls back to a generic stand-in (whole class)", () => {
  const bad: string[] = [];
  for (const q of [...SWEEPS.c1.prompts, ...PURPOSE_ASKS, ...SHIPS]) {
    const p = generateFromPrompt(q);
    const v = checkBuild(p, q).filter((x) => x.id === "I22");
    if (v.length || genericFormMark(p)) bad.push(`${q}: ${v.map((x) => x.msg).join("; ") || genericFormMark(p)}`);
  }
  assert.deepEqual(bad, []);
});

test("C1: a sailing ship is a hull with ribs, masts and yards, sized from its typed length", () => {
  const p = generateFromPrompt("pirate ship 24 inches long");
  assert.equal(p.name, "Pirate ship"); // Spec 007 C3: typed noun as title (was "Sailing ship").
  assert.equal(p.overall.width, 24);
  assert.ok((p.instances?.length ?? 0) > 100);
  assert.ok(p.overall.height > p.overall.depth * 2, "masts stand well above the beam");
});

test("C1: the head noun wins over 'that fits / for a' objects", () => {
  assert.match(generateFromPrompt("bookshelf that fits a 55 inch TV").name, /Bookcase/);
});

test("C1: detailed landmarks keep their own geometry", () => {
  const keep: [string, string, number][] = [["Big Ben", "Big Ben", 385], ["Eiffel Tower", "Eiffel Tower", 446], ["Golden Gate Bridge 36 inches long", "Golden Gate Bridge", 251], ["Brooklyn Bridge 36 inches", "Brooklyn Bridge", 295], ["trebuchet", "Trebuchet", 191], ["Tower Bridge", "Tower Bridge", 346]];
  for (const [q, name, n] of keep) {
    const p = generateFromPrompt(q);
    assert.deepEqual([p.name, p.instances?.length], [name, n], q);
  }
});
