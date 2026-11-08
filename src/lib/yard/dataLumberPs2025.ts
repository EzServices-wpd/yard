/**
 * NIST/DOC Voluntary Product Standard PS 20-25 (January 2025),
 * American Softwood Lumber Standard, Table 3,
 * "Nominal and minimum-dressed sizes of boards, dimension, and timbers."
 * https://www.nist.gov/document/ps-20-25-final
 * https://www.nist.gov/system/files/documents/2024/12/11/PS%2020-25%20Final.pdf
 *
 * Imperial inches are the units of record. Retail "actual" size is the dry minimum
 * dressed size (19 percent maximum moisture content; Table 3 note a, §§2.7 and 2.11).
 * Dressed lumber shall equal or exceed that minimum (§5.2). Green is the unseasoned
 * column of the same table. Thicknesses apply to all widths and widths apply to all
 * thicknesses. Classes follow §3.4: boards are under 2 in nominal thickness; dimension
 * is from 2 in up to but not including 5 in; timbers are 5 in or greater in the least
 * dimension, so a 4×4 is dimension and a 6×6 is a timber.
 *
 * Table 3 also lists other board thicknesses and nominal widths 5, 7, 9, 11, 14, and 16.
 * The rows below are the 1×2 through 2×12 series plus 4×4 and 6×6.
 * Data only. Nothing in the build engine reads this file.
 */

export const PS2025_SOURCE =
  "NIST/DOC Voluntary Product Standard PS 20-25 (January 2025), American Softwood Lumber Standard, Table 3. https://www.nist.gov/document/ps-20-25-final";

export type Ps2025LumberClass = "board" | "dimension" | "timber";

export type Ps2025LumberSize = {
  nominalThicknessIn: number;
  nominalWidthIn: number;
  /** Table 3 dry minimum dressed thickness, the retail "actual" thickness. */
  dryThicknessIn: number;
  /** Table 3 dry minimum dressed width, the retail "actual" width. */
  dryWidthIn: number;
  /** Table 3 green minimum dressed thickness. */
  greenThicknessIn: number;
  /** Table 3 green minimum dressed width. */
  greenWidthIn: number;
  lumberClass: Ps2025LumberClass;
};

/** whole + num/den. Table 3 denominators are powers of two, so the sum is exact. */
const inches = (whole: number, num = 0, den = 1) => whole + num / den;

const size = (
  lumberClass: Ps2025LumberClass,
  nominalThicknessIn: number,
  nominalWidthIn: number,
  dryThicknessIn: number,
  dryWidthIn: number,
  greenThicknessIn: number,
  greenWidthIn: number,
): Ps2025LumberSize => ({
  lumberClass,
  nominalThicknessIn,
  nominalWidthIn,
  dryThicknessIn,
  dryWidthIn,
  greenThicknessIn,
  greenWidthIn,
});

/**
 * Boards, nominal 1 in. Source: NIST/DOC PS 20-25 (January 2025), Table 3.
 * https://www.nist.gov/document/ps-20-25-final
 * Dry thickness 3/4 in; green thickness 25/32 in.
 */
export const PS2025_BOARDS: readonly Ps2025LumberSize[] = [
  size("board", 1, 2, inches(0, 3, 4), inches(1, 1, 2), inches(0, 25, 32), inches(1, 9, 16)),
  size("board", 1, 3, inches(0, 3, 4), inches(2, 1, 2), inches(0, 25, 32), inches(2, 9, 16)),
  size("board", 1, 4, inches(0, 3, 4), inches(3, 1, 2), inches(0, 25, 32), inches(3, 9, 16)),
  size("board", 1, 6, inches(0, 3, 4), inches(5, 1, 2), inches(0, 25, 32), inches(5, 5, 8)),
  size("board", 1, 8, inches(0, 3, 4), inches(7, 1, 4), inches(0, 25, 32), inches(7, 1, 2)),
  size("board", 1, 10, inches(0, 3, 4), inches(9, 1, 4), inches(0, 25, 32), inches(9, 1, 2)),
  size("board", 1, 12, inches(0, 3, 4), inches(11, 1, 4), inches(0, 25, 32), inches(11, 1, 2)),
];

/**
 * Dimension, including 2×2 through 2×12 and 4×4. Source: NIST/DOC PS 20-25 (January 2025), Table 3.
 * https://www.nist.gov/document/ps-20-25-final
 * Nominal 2 in dresses dry to 1-1/2 and green to 1-9/16. Nominal 4 in dresses dry to 3-1/2 and green to 3-9/16.
 */
export const PS2025_DIMENSION: readonly Ps2025LumberSize[] = [
  size("dimension", 2, 2, inches(1, 1, 2), inches(1, 1, 2), inches(1, 9, 16), inches(1, 9, 16)),
  size("dimension", 2, 3, inches(1, 1, 2), inches(2, 1, 2), inches(1, 9, 16), inches(2, 9, 16)),
  size("dimension", 2, 4, inches(1, 1, 2), inches(3, 1, 2), inches(1, 9, 16), inches(3, 9, 16)),
  size("dimension", 2, 6, inches(1, 1, 2), inches(5, 1, 2), inches(1, 9, 16), inches(5, 5, 8)),
  size("dimension", 2, 8, inches(1, 1, 2), inches(7, 1, 4), inches(1, 9, 16), inches(7, 1, 2)),
  size("dimension", 2, 10, inches(1, 1, 2), inches(9, 1, 4), inches(1, 9, 16), inches(9, 1, 2)),
  size("dimension", 2, 12, inches(1, 1, 2), inches(11, 1, 4), inches(1, 9, 16), inches(11, 1, 2)),
  size("dimension", 4, 4, inches(3, 1, 2), inches(3, 1, 2), inches(3, 9, 16), inches(3, 9, 16)),
];

/**
 * Timbers. Source: NIST/DOC PS 20-25 (January 2025), Table 3.
 * https://www.nist.gov/document/ps-20-25-final
 * The "5 & 6" row is 1/2 in off nominal, dry and green, on thickness and width.
 */
export const PS2025_TIMBERS: readonly Ps2025LumberSize[] = [
  size("timber", 6, 6, inches(5, 1, 2), inches(5, 1, 2), inches(5, 1, 2), inches(5, 1, 2)),
];

export const PS2025_LUMBER: readonly Ps2025LumberSize[] = [
  ...PS2025_BOARDS,
  ...PS2025_DIMENSION,
  ...PS2025_TIMBERS,
];

const nominalKey = (thicknessIn: number, widthIn: number) => `${thicknessIn}x${widthIn}`;

export function ps2025ByNominal(
  nominalThicknessIn: number,
  nominalWidthIn: number,
): Ps2025LumberSize | undefined {
  return PS2025_LUMBER.find(
    (row) =>
      nominalKey(row.nominalThicknessIn, row.nominalWidthIn) ===
      nominalKey(nominalThicknessIn, nominalWidthIn),
  );
}
