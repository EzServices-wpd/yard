/**
 * Row 161 (I43): an axis the prompt does not type comes from the family's defaults, never from another typed axis.
 * Literal answers (the family default widths, worked out from the untyped builds 'cabinet', 'desk'), measured from
 * the build's overall, never through measureText.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { i43 } from "./invariants";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

/** Prompt, the typed axis and its value, the untyped width the family default gives. */
const ORACLE: [string, "depth" | "height", number, number][] = [
  ["cabinet 12 1/2 deep", "depth", 12.5, 36],
  ["cabinet 12.5 deep", "depth", 12.5, 36],
  ["cabinet 30 1/2 tall", "height", 30.5, 36],
  ["cabinet 22 1/2 tall", "height", 22.5, 36],
  ["desk 30 1/2 tall", "height", 30.5, 48],
  ["desk 24.5 deep", "depth", 24.5, 48],
];

it("row 161: an untyped width is the family default, never the whole number of a typed depth or height", () => {
  const bad = ORACLE.map(([q, a, v, w]) => [q, generateFromPrompt(q).overall, a, v, w] as const).filter(([, o, a, v, w]) => o[a] !== v || o.width !== w);
  assert.deepEqual(bad, []);
});

it("row 161: I43 passes on every oracle build", () => {
  for (const [q] of ORACLE) assert.deepEqual(i43(generateFromPrompt(q), q), [], q);
});

it("I43 catches an untyped axis that took a typed axis's whole number", () => {
  const p = generateFromPrompt("cabinet 12.5 deep");
  const bent = { ...p, overall: { ...p.overall, width: 12 } };
  assert.equal(i43(bent, "cabinet 12.5 deep").length, 1);
  assert.match(i43(bent, "cabinet 12.5 deep")[0].msg, /untyped width is 12", the whole number of the typed 12 1\/2" depth/);
});

it("a bare size by the noun is still its width ('desk 60', '60 inch desk', 'cabinet 30', '31.5 inch linen closet')", () => {
  for (const [q, w] of [["desk 60", 60], ["60 inch desk", 60], ["cabinet 30", 30], ["31.5 inch linen closet", 31.5], ["table 70 inch", 70], ["workbench 72 inches", 72]] as const)
    assert.equal(generateFromPrompt(q).overall.width, w, q);
});
