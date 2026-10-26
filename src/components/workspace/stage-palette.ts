/**
 * Night shop marks on the 3D stage, for three.js, which can't read CSS variables. Each is an @theme token in
 * src/styles.css (scripts/stage-palette.test.ts keeps them equal). The stage ground (bg, floor, grid) is Yard
 * Design's SHOP_GROUND in shop-light.ts; part materials are not palette colours.
 */
export const STAGE = {
  ghost: "#8c9299", // --color-faint: the opening's ghost outline
  mark: "#7cb2ff", // --color-mark: the measure box
} as const;
