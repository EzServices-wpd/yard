/**
 * Night shop stage colours for three.js, which can't read CSS variables. Each one is an @theme token in
 * src/styles.css (scripts/stage-palette.test.ts keeps them equal), so the bench and the page are one dark ground.
 * Wood, steel and other part materials are not palette colours and stay where they are.
 */
export const STAGE = {
  bg: "#131518", // --color-bg
  floor: "#1c1f23", // --color-surface
  grid: "#2c3136", // --color-border
  ghost: "#8c9299", // --color-faint: the opening's ghost outline
  mark: "#7cb2ff", // --color-mark: the measure box
} as const;
