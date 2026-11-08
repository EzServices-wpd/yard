/**
 * Oracle for compact feet-inches (Critic #103 F1): 'bookcase 5ft6in tall' built 6" because `ft\b` fails when a digit
 * follows. I35 reads sizes through the same reader as the build, so it can't see a misread: this test owns its
 * answers. Every expected value below is a literal, worked out by hand, and the build is measured from its parts'
 * own extent, never through measureText.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import type { YardProject } from "./types";

const extent = (p: YardProject, a: "x" | "y" | "z", k: "width" | "height" | "depth") =>
  Math.max(...p.panels.map((q) => q.position[a] + q.size[k])) - Math.min(...p.panels.map((q) => q.position[a]));
const AXIS = { wide: ["x", "width"], tall: ["y", "height"], deep: ["z", "depth"] } as const;

/** Prompt, axis word, inches (by hand). */
const ORACLE: [string, keyof typeof AXIS, number][] = [
  ["bookcase 5ft6in tall", "tall", 66],
  ["bookcase 5ft6 tall", "tall", 66],
  ["bookcase 5FT6IN tall", "tall", 66],
  ["bookcase 5ft 6in tall", "tall", 66],
  ["bookcase 5ft6in. tall", "tall", 66],
  [`bookcase 5'6"tall`, "tall", 66],
  ["bookcase 4ft11in tall", "tall", 59],
  ["bookcase 6ft tall", "tall", 72],
  ["bookcase 5ft6 1/2in tall", "tall", 66.5],
  ["cabinet 2ft3in wide", "wide", 27],
  ["cabinet 2ft3 wide", "wide", 27],
  ["cabinet 2ft wide", "wide", 24],
  ["cabinet 30in wide", "wide", 30],
  ["bookcase 3ft1in wide", "wide", 37],
  ["bookcase 1ft2in deep", "deep", 14],
  ["bookcase 1ft deep", "deep", 12],
];

it("compact feet-inches build the inches worked out by hand (5ft6in = 66, 5ft6 = 66, 2ft3in = 27, ...)", () => {
  const bad: string[] = [];
  for (const [q, word, want] of ORACLE) {
    const p = generateFromPrompt(q);
    const [a, k] = AXIS[word];
    const got = extent(p, a, k);
    if (Math.abs(got - want) > 1 / 16) bad.push(`${q}: built ${got.toFixed(3)}" ${word}, want ${want}"`);
  }
  assert.deepEqual(bad, []);
});

it("'in' as a word is never an inch mark: 'bookcase 30 wide in oak' stays 30\" wide", () => {
  const p = generateFromPrompt("bookcase 30 wide in oak");
  assert.ok(Math.abs(extent(p, "x", "width") - 30) < 1 / 16);
});
