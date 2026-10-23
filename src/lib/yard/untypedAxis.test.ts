import { stripSizeStamp } from "./voiceHonesty";
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

it("row 239: a typed size before a sentence's period lands ('desk 60.', 'cabinet 30.')", () => {
  for (const [q, w] of [["desk 60.", 60], ["I want a desk 60.", 60], ["make me a desk 60. thanks", 60], ["cabinet 30.", 30]] as const) {
    const p = generateFromPrompt(q);
    assert.equal(p.overall.width, w, q);
    assert.deepEqual(i43(p, q), [], q);
  }
  // A decimal is still one number: '24.5 deep' never reads as 24 then a period.
  assert.equal(generateFromPrompt("desk 24.5 deep").overall.depth, 24.5);
});

it("row 241: I43 catches a dropped number before a period, and a family default equal to the whole number is no leak", () => {
  // A build of 'desk 60.' at the 48" default width (what #115 at c8d0974 built) is flagged.
  const p = generateFromPrompt("desk 60.");
  const dropped = { ...p, overall: { ...p.overall, width: 48 } };
  assert.match(i43(dropped, "desk 60.")[0]?.msg ?? "", /width is 48" with the period after the typed number, 60" without it/);
  // 'nightstand 24 1/2 wide' is 24" tall because a nightstand is; 'desk 24 1/2 wide' is 24" deep because a desk is.
  for (const q of ["nightstand 24 1/2 wide", "nightstand 24 1/2 wide.", "desk 24 1/2 wide", "desk 24 1/2 wide."]) assert.deepEqual(i43(generateFromPrompt(q), q), [], q);
});

it("row 240: a re-stamped title never prints the size twice", () => {
  for (const [q, name] of [
    ["pantry 24.5 deep", 'Pantry 24 1/2" deep'],
    ["broom closet 72.5 tall", 'Broom closet 72 1/2" tall'],
    ["wardrobe 6ft 2 1/2in tall", 'Wardrobe 74 1/2" tall'],
    ["wardrobe 15 1/2 deep", 'Wardrobe 15 1/2" deep'],
  ] as const) assert.equal(generateFromPrompt(q).name, name, q);
});

it("row 279: fractional sizes on any axis, in any typed form, are stripped once and stamped once", () => {
  for (const q of ["closet 19 3/4 deep", "wardrobe 19 3/4 deep", 'wardrobe 19 3/4" deep', "pantry 24.5 deep", "wardrobe 21¾ deep", "closet 20½ deep", "pantry 23½ deep",
    "bookcase 30 3/4 wide", "dresser 20½ wide", "bookcase 23½ wide", "bookcase 24.5 wide", "wardrobe 70 3/4 tall", "pantry 80½ tall", "closet 72.5 tall", "bookcase 59½ tall"]) {
    const name = generateFromPrompt(q).name;
    assert.equal((name.match(/\d+(?:\.\d+)?(?: \d+\/\d+)?"/g) ?? []).length <= 3 && !/(\d[\d /.]*")[^"]*\1/.test(name), true, `${q} -> ${name}`);
  }
  for (const stem of ["Wardrobe", "Closet", "Pantry"]) for (const ax of ["deep", "wide", "tall"]) for (const f of ["19 3/4", "21¾", "20½", "23½", "24.5", '19 3/4"', '21¾"', "19 3/4 in", "24.5 inch", "19 3/4″"]) {
    assert.equal(stripSizeStamp(`${stem} ${f} ${ax}`), stem, `${stem} ${f} ${ax}`);
    assert.equal(stripSizeStamp(`${stem} ${f} ${ax} ${f} ${ax}`), stem, `twice: ${stem} ${f} ${ax}`);
  }
  assert.equal(stripSizeStamp('Wardrobe 19 3/4" × 72" × 21¾"'), "Wardrobe");
  assert.equal(stripSizeStamp("Bookcase"), "Bookcase");
});
