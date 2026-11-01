/** Tests for the grade kit's error-row replay and recorded-behaviour rows (scripts/probe-rows.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectMoves, isPrompt, NOT_FOUND, parseRows, recordExpect, replayTsv, reproduces, unmarkedRows, type Rec } from "./probe-rows.ts";

// 10 real rows of yard-errors-ranked.md (texts cut short): multi-quote, double quotes, no quote, BLOCK, an area column, no P.
const MD = [
  `| 316 | [SWE] #142 (38fef19) BLOCK: the 2-shelf build of 'bookcase 60 wide with 2 shelves' (header '· 2 shelves', 2 levels × 2 bays) is honored against a typed '4 shelves', while the correct 'bookcase 60 wide with 4 shelves' (header '· 4 shelves', 8 pieces) is graded as not honoring 4. It contradicts the PR's 'header and picker level counts are unchanged'. | P2 | 1`,
  `| 60 | Placement words ignored: "desk with a shelf above it" builds no shelf; "bunk bed with desk under it" puts no desk under. | P2 | 2`,
  `| 124 | main | liveFeed.ts isTestRow still sniffs prompt text (\\btest\\b, probe, critic, canary): 'test tube rack' logged but hidden from Ideas feed | med`,
  `| 353 | [SWE 2] #140 (35aebc0c) BLOCK: reduced motion lands on a different See-inside pose, against the PR claim "reduced motion: same pose, 150 ms fade". Phone 390×844 | P2 | 2`,
  `| 498 | [SWE] #157 r4 BLOCK (row 477 class, PR claim 'never overrides a typed number'). 'nightstand 1 metre 20 cm wide' W 20 -> 7 7/8; 'bookcase 1 meter 20 centimeters wide' and '1 m and 20 cm wide' W 36 -> 7 7/8 | P1 |`,
  `| 505 | [SWE] #157 r5 BLOCK. 'bookcase 6 ft two shelves' reads '6 ft 2 shelves' and builds 74" wide x 84" tall, so the typed 72" tall is lost.`,
  `| 653 | [SWE] honesty wording · PR #194 r5 (BLOCK). A missed typed size gets the whole-stick note 'You typed 12" tall. Whole Bamboo Skewer 12"s build it …' while the same build says '588 short pieces are cut from whole Bamboo Skewer 12"s'. | P1 | 1`,
  `| 401 | [SWE] #149 BLOCK B2: PR body cites approval as '17:22 ET, relayed via YARD Chief: "whatever you think is best" on option (a)'. | P3 | 1`,
  `| 635 | [SWE] silent typed-size ignore · PR #191 r7 (BLOCK item B7). A bare length is dropped: 'dollhouse 36 inch', '36 inch dollhouse', '36" dollhouse', '4 ft dollhouse' all build the 24×12×30 default | P1 | 1`,
  `| 319 | [SWE] #112 r5 (f558743) BLOCK: 'wardrobe 72 wide with 2 drawers' 70.5" rod + I7 71" bay bottom; 48w 46.5"; '72 wide 72 tall' 70.5" rod | P1 | 6 |`,
  `| 316 | a later duplicate of row 316 is ignored | P3 | 1`,
].join("\n");
const rows = parseRows(MD), byRow = (n: number) => rows.find((r) => r.row === n)!;

test("the parser reads row, P, BLOCK, prompts and symptom quotes from the real formats", () => {
  assert.deepEqual(rows.map((r) => r.row), [316, 60, 124, 353, 498, 505, 653, 401, 635, 319]);
  assert.deepEqual(rows.map((r) => r.p), ["P2", "P2", null, "P2", "P1", null, "P1", "P3", "P1", "P1"]);
  assert.deepEqual(rows.map((r) => r.block), [true, false, false, true, true, true, true, true, true, true]);
  assert.deepEqual(byRow(316).prompts, ["bookcase 60 wide with 2 shelves", "bookcase 60 wide with 4 shelves"]);
  assert.deepEqual(byRow(316).evidence, ["· 2 shelves", "4 shelves", "· 4 shelves", "header and picker level counts are unchanged"]);
  assert.deepEqual(byRow(60).prompts, ["desk with a shelf above it", "bunk bed with desk under it"], "double-quoted prompts");
  assert.deepEqual(byRow(124).prompts, ["test tube rack"], "a row with an area column");
  assert.deepEqual(byRow(353).prompts, [], "a quoted PR claim is not a prompt");
  assert.deepEqual(byRow(498).prompts, ["nightstand 1 metre 20 cm wide", "bookcase 1 meter 20 centimeters wide"]);
  assert.deepEqual(byRow(505).prompts, ["bookcase 6 ft two shelves"]);
  assert.deepEqual(byRow(653).prompts, [], "note text is evidence, not a prompt");
  assert.deepEqual(byRow(401).prompts, []);
  assert.deepEqual(byRow(635).prompts, ["dollhouse 36 inch", "36 inch dollhouse", "36\" dollhouse", "4 ft dollhouse"]);
  assert.deepEqual(byRow(319).prompts, ["wardrobe 72 wide with 2 drawers"], "'72 wide 72 tall' is a fragment");
  const notes = parseRows([
    `| 247 | [SWE] no sink cutout, and the note itself mentions 'where a drawer would hit the bowl'. | P1 | 19 |`,
    `| 538 | sheets headed '3/4" Plywood 4x8' while Buy buys '3/4" Plywood Project Panel 2×4' (floating shelf). | P3 | 565 |`,
    `| 653 | the note 'You typed 12" tall. Type "cut the sticks" to build it.' Typing 'cut the sticks' gives the same build. | P1 | 1 |`,
  ].join("\n"));
  assert.deepEqual(notes.map((r) => r.prompts), [[], [], []], "note, header and Buy text is never a prompt");
});

test("isPrompt keeps typed builds and drops claims, fragments and headers", () => {
  for (const q of ["toothpick tower", "5 story dollhouse", "1/4 ply dollhouse", "13 foot Eiffel Tower from popsicle sticks", "bookcase 1.8 m H, 30 W"]) assert.ok(isPrompt(q), q);
  for (const q of ["4 shelves", "48 wide", "with 12 rods", "only the stand family moves", "Floor-standing hall tree", "· 2 shelves", "stays 3/4", "5/8 plywood", "15/32\" BC exterior plywood 4x8", "toothpick", "a b c d e f g h i j k l m"]) assert.ok(!isPrompt(q), q);
});

test("unmarked rows come from the triage's class lines", () => {
  const tri = "Unmarked rows: 465 of 662.\n\n**N numbers: typed size** (3): 72, 299, 49*\n**F typed feature** (2): 316, 653\n| N | 113 | 24 |";
  assert.deepEqual([...unmarkedRows(tri)].sort((a, b) => a - b), [49, 72, 299, 316, 653]);
});

const rec = (title: string, notes: string[] = [], extra: Partial<NonNullable<Rec["d"]>> = {}): Rec =>
  ({ full: "f" + title.length, d: { title, refused: null, notes, totals: { pieces: 10, estCostUsd: 20 }, bom: [["Wood glue", 1, "bottle", 4.98]], ...extra } });

test("reproduces is yes when a quoted symptom still shows, 'symptom text not found' (never 'fixed') when none does, unknown with none quoted", () => {
  assert.equal(reproduces(byRow(316), rec("Bookcase · 2 shelves")), "yes");
  assert.equal(reproduces(byRow(316), rec("Bookcase · 3 shelves")), NOT_FOUND);
  assert.equal(reproduces(byRow(653), rec("Skewer tower", ["You typed 12\" tall. Whole Bamboo Skewer 12\"s build it to 12\" — the closest"])), "yes", "a quote ending in … matches on its start");
  assert.equal(reproduces(byRow(60), rec("Desk")), "unknown");
  assert.equal(reproduces(byRow(316), { err: "boom" }), NOT_FOUND);
});

test("the replay TSV has Critic's columns, one line per prompt, n/a for rows with no prompt", () => {
  const head = { "bookcase 60 wide with 2 shelves": rec("Bookcase · 2 shelves"), "bookcase 60 wide with 4 shelves": { err: "boom" } };
  const base = { "bookcase 60 wide with 2 shelves": rec("Bookcase · 2 shelves") };
  const t = replayTsv(rows, new Set([316, 353]), head, base, "a".repeat(40), "b".repeat(40), "2026-10-30").trim().split("\n").map((l) => l.split("\t"));
  assert.deepEqual(t[0], ["row", "P", "prompt", "reproduces", "head_sha", "base_sha", "run_date", "head_hash", "same_as_base", "built"]);
  assert.deepEqual(t.slice(1), [
    ["316", "P2", "bookcase 60 wide with 2 shelves", "yes", "aaaaaaaaaaaa", "bbbbbbbbbbbb", "2026-10-30", "f20", "yes", "built"],
    ["316", "P2", "bookcase 60 wide with 4 shelves", NOT_FOUND, "aaaaaaaaaaaa", "bbbbbbbbbbbb", "2026-10-30", "21d0bfa9" /* sha1("error: boom") */, "n/a", "error"],
    ["353", "P2", "n/a", "n/a", "aaaaaaaaaaaa", "bbbbbbbbbbbb", "2026-10-30", "n/a", "n/a", "n/a"],
  ]);
  const moved = replayTsv(rows, new Set([316]), head, { "bookcase 60 wide with 2 shelves": rec("Bookcase · 3 shelves!") }, "a", "b", "d");
  assert.equal(moved.split("\n")[1].split("\t")[8], "no", "a build that differs from base");
});

test("a recorded expectation shows each moved facet and nothing when the build is unchanged", () => {
  const r = rec("Dollhouse · 24\" W", ["Assumed 30\" tall"]), want = recordExpect(r);
  assert.deepEqual(expectMoves(want, r), []);
  assert.deepEqual(expectMoves(want, rec("Dollhouse · 24\" W", ["Assumed 30\" tall"], { totals: { pieces: 10, estCostUsd: 21 } })), ["cost"]);
  assert.deepEqual(expectMoves(want, rec("Dollhouse · 36\" W", ["Built 36\" tall"])), ["title", "notes"]);
  assert.deepEqual(expectMoves(want, rec("x", ["Assumed 30\" tall"], { refused: "Type a smaller size", totals: {} })), ["refused", "title", "pieces", "cost"]);
  assert.deepEqual(expectMoves(want, { err: "boom" }), ["refused", "title", "pieces", "cost", "notes"]);
});
