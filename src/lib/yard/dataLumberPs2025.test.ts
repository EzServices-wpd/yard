import assert from "node:assert/strict";
import test from "node:test";
import { FORGE_CATALOG } from "./catalog.ts";
import { HARDWARE_ADA_FACTS } from "./dataHardwareAda.ts";
import {
  PS2025_BOARDS,
  PS2025_DIMENSION,
  PS2025_LUMBER,
  PS2025_SOURCE,
  PS2025_TIMBERS,
  ps2025ByNominal,
  type Ps2025LumberSize,
} from "./dataLumberPs2025.ts";

/**
 * Catalog lumber-NxM rows whose cross-section is not the PS 20-25 Table 3 dry minimum.
 * Audited against FORGE_CATALOG: every such row matches, so this list is empty.
 * On a real disagreement, record the observed inches and a reason here. Do not edit catalog.ts.
 */
export type Ps2025CatalogException = {
  id: string;
  catalogThicknessIn: number;
  catalogWidthIn: number;
  standardDryThicknessIn: number | null;
  standardDryWidthIn: number | null;
  reason: string;
};

export const PS2025_CATALOG_EXCEPTIONS: readonly Ps2025CatalogException[] = [];

type SectionRow = { id: string; thicknessIn: number; widthIn: number };

const NOMINAL_LUMBER_ID = /^lumber-(\d+)x(\d+)-(\d+)$/;

/** Ids in catalog.ts when this pin was written. A later size that matches the table may be added. */
const PINNED_CATALOG_IDS = [
  "lumber-1x2-8 lumber-1x3-8 lumber-1x4-8 lumber-1x6-8 lumber-1x8-8 lumber-1x10-8",
  "lumber-1x12-8 lumber-2x2-8 lumber-2x4-8 lumber-2x6-8 lumber-2x8-8 lumber-2x10-8",
  "lumber-2x10-10 lumber-2x12-8 lumber-2x12-10 lumber-4x4-8",
]
  .join(" ")
  .split(" ");

function lumberSectionProblems(
  rows: readonly SectionRow[],
  exceptions: readonly Ps2025CatalogException[],
): string[] {
  const problems: string[] = [];
  const byId = new Map<string, Ps2025CatalogException>();
  const seen = new Set<string>();
  for (const ex of exceptions) {
    if (byId.has(ex.id)) problems.push(`${ex.id}: duplicate exception`);
    byId.set(ex.id, ex);
    if (ex.reason.trim().length < 12) problems.push(`${ex.id}: exception reason is too short`);
  }
  for (const row of rows) {
    seen.add(row.id);
    const parsed = NOMINAL_LUMBER_ID.exec(row.id);
    const standard = parsed ? ps2025ByNominal(Number(parsed[1]), Number(parsed[2])) : undefined;
    const matches = sameSection(standard, row);
    const ex = byId.get(row.id);
    if (matches && standard) {
      if (ex) problems.push(`${row.id}: stale exception`);
      continue;
    }
    if (!ex) {
      const expected = standard
        ? `${standard.dryThicknessIn}x${standard.dryWidthIn}`
        : "no Table 3 row";
      problems.push(
        `${row.id}: catalog ${row.thicknessIn}x${row.widthIn} vs ${expected}; document a PS2025_CATALOG_EXCEPTIONS entry`,
      );
      continue;
    }
    if (ex.catalogThicknessIn !== row.thicknessIn || ex.catalogWidthIn !== row.widthIn)
      problems.push(`${row.id}: exception catalog inches differ from the row`);
    if (
      (ex.standardDryThicknessIn ?? null) !== (standard?.dryThicknessIn ?? null) ||
      (ex.standardDryWidthIn ?? null) !== (standard?.dryWidthIn ?? null)
    )
      problems.push(`${row.id}: exception standard inches differ from Table 3`);
  }
  for (const ex of exceptions)
    if (!seen.has(ex.id)) problems.push(`${ex.id}: exception has no catalog row`);
  return problems;
}

function sameSection(standard: Ps2025LumberSize | undefined, row: SectionRow): boolean {
  return (
    standard != null &&
    standard.dryThicknessIn === row.thicknessIn &&
    standard.dryWidthIn === row.widthIn
  );
}

test("PS 20-25 tables cite Table 3 and keep dry minima under nominal", () => {
  assert.match(PS2025_SOURCE, /PS 20-25/);
  assert.match(PS2025_SOURCE, /Table 3/);
  assert.match(PS2025_SOURCE, /nist\.gov/);
  assert.equal(
    PS2025_LUMBER.length,
    PS2025_BOARDS.length + PS2025_DIMENSION.length + PS2025_TIMBERS.length,
  );
  assert.deepEqual(
    [PS2025_BOARDS.length, PS2025_DIMENSION.length, PS2025_TIMBERS.length],
    [7, 8, 1],
  );
  const keys = PS2025_LUMBER.map((row) => `${row.nominalThicknessIn}x${row.nominalWidthIn}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const row of PS2025_LUMBER) {
    assert.ok(row.dryThicknessIn < row.nominalThicknessIn && row.dryWidthIn < row.nominalWidthIn);
    assert.ok(row.greenThicknessIn >= row.dryThicknessIn && row.greenWidthIn >= row.dryWidthIn);
    assert.ok(
      row.greenThicknessIn <= row.nominalThicknessIn && row.greenWidthIn <= row.nominalWidthIn,
    );
  }
  const dry = (t: number, w: number) => {
    const row = ps2025ByNominal(t, w);
    assert.ok(row);
    return [
      row.lumberClass,
      row.dryThicknessIn,
      row.dryWidthIn,
      row.greenThicknessIn,
      row.greenWidthIn,
    ];
  };
  assert.deepEqual(dry(2, 4), ["dimension", 1.5, 3.5, 1.5625, 3.5625]);
  assert.deepEqual(dry(1, 8), ["board", 0.75, 7.25, 0.78125, 7.5]);
  assert.deepEqual(dry(4, 4), ["dimension", 3.5, 3.5, 3.5625, 3.5625]);
  assert.deepEqual(dry(6, 6), ["timber", 5.5, 5.5, 5.5, 5.5]);
});

test("catalog.ts nominal lumber matches PS 20-25 dry minima except documented exceptions", () => {
  const rows: SectionRow[] = [];
  for (const item of FORGE_CATALOG) {
    if (!NOMINAL_LUMBER_ID.test(item.id)) continue;
    const thicknessIn = item.dims.thickness ?? item.dims.height;
    const widthIn = item.dims.width;
    assert.ok(thicknessIn != null && widthIn != null, `${item.id}: missing cross-section`);
    rows.push({ id: item.id, thicknessIn, widthIn });
  }
  for (const id of PINNED_CATALOG_IDS)
    assert.ok(
      rows.some((row) => row.id === id),
      id,
    );
  assert.deepEqual(lumberSectionProblems(rows, PS2025_CATALOG_EXCEPTIONS), []);
});

test("a mismatch must be listed, and a match must not stay listed", () => {
  const listed: Ps2025CatalogException = {
    id: "lumber-2x4-8",
    catalogThicknessIn: 2,
    catalogWidthIn: 4,
    standardDryThicknessIn: 1.5,
    standardDryWidthIn: 3.5,
    reason: "Synthetic documented disagreement, not a catalog.ts row.",
  };
  const off = [{ id: "lumber-2x4-8", thicknessIn: 2, widthIn: 4 }];
  assert.match(lumberSectionProblems(off, []).join("\n"), /PS2025_CATALOG_EXCEPTIONS/);
  assert.deepEqual(lumberSectionProblems(off, [listed]), []);
  const stale: Ps2025CatalogException = { ...listed, catalogThicknessIn: 1.5, catalogWidthIn: 3.5 };
  assert.match(
    lumberSectionProblems([{ id: "lumber-2x4-8", thicknessIn: 1.5, widthIn: 3.5 }], [stale]).join(
      "\n",
    ),
    /stale exception/,
  );
});

test("hardware and ADA rows cite a manufacturer or the ADA standard", () => {
  const topics = new Set(HARDWARE_ADA_FACTS.map((fact) => fact.topic));
  for (const topic of ["drawer-slide", "hinge", "pocket-screw", "ada"] as const)
    assert.ok(topics.has(topic), topic);
  for (const fact of HARDWARE_ADA_FACTS) {
    assert.ok(fact.summary.length > 20, fact.id);
    assert.match(
      fact.source,
      /https:\/\/(www\.)?(accuride\.com|kregtool\.com|blum\.com|ada\.gov)/,
      fact.id,
    );
  }
});
