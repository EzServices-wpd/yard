/**
 * Fitted engine facade — public exports stay here so callers keep importing from ./fitted.
 * Implementation lives in fittedShared / fittedWine / fittedDetect / fittedParse / fittedBuilders / fittedBuild.
 */
export {
  STUD_CENTER_IN,
  HINGE_ARM_CLEAR_IN,
  shallowWallCabinetFace,
  backReachesTwoStuds,
  spokenBottleCount,
  typedHeightInches,
  SHELF_MIN_CLEAR,
  isKidsBookcase,
} from "./fittedShared";

export {
  WINE_BOTTLE_CLEAR,
  WINE_RAIL_H,
  WINE_CRADLE_LIP,
  WINE_ROW_CLEAR,
  WINE_ROW_SLACK,
  WINE_ROW_MAX_CLEAR,
  WINE_OPEN_MIN,
  WINE_OPEN_MAX,
  WINE_PLINTH_SETBACK,
  wineCradle,
  wineCradleOutline,
  wantsBottleFill,
  wineRackLayout,
  inch16,
  wineCapacityVoice,
  type WineRackLayout,
} from "./fittedWine";

export { looksLikeFitted, detectProgram } from "./fittedDetect";

export { parseBrief } from "./fittedParse";

export { isLitterCabinet } from "./fittedBuilders";

export { buildFitted, fittedFromPocketProject } from "./fittedBuild";
