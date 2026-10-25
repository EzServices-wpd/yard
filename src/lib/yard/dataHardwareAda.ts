/**
 * Hardware and accessibility facts. The build engine does not read this file.
 * Each row cites a manufacturer sheet or the 2010 ADA Standards. No catalog text, no affiliate links.
 */

export type CitedFactTopic = "drawer-slide" | "hinge" | "pocket-screw" | "ada";

export type CitedFact = {
  id: string;
  topic: CitedFactTopic;
  summary: string;
  source: string;
};

const ACCURIDE_3832 =
  "Accuride 3832EC, https://www.accuride.com/en-us/products/drawer-slides/3832ec-easy-close-light-duty-side-mount-slide-lever-disconnect";
const KREG_K4 =
  "Kreg Pocket-Hole Jig K4 screw chart, https://www.kregtool.com/on/demandware.static/-/Library-Sites-RefArchSharedLibrary/default/dw7ad1d1da/manuals/K4PLUS_NA.pdf";
const BLUM_CLIP =
  "Blum CLIP top concealed hinge (35 mm cup), https://www.blum.com/us/en/products/hingesystems/";
const ADA =
  "2010 ADA Standards for Accessible Design, https://www.ada.gov/law-and-regs/design-standards/2010-stds/";

/** Drawer-slide lengths and clearances, hinge types, pocket-screw sizes, and ADA reach, height, and clearance figures. */
export const HARDWARE_ADA_FACTS: readonly CitedFact[] = [
  {
    id: "accuride-3832ec-lengths",
    topic: "drawer-slide",
    summary:
      "Accuride 3832EC side-mount full-extension slides come in 12, 14, 16, 18, 20, 22, 24, 26, and 28 inch lengths.",
    source: ACCURIDE_3832,
  },
  {
    id: "accuride-3832ec-clearance",
    topic: "drawer-slide",
    summary:
      "Side space is 0.50 inch +0.031/−0 per side (member is 1/2 inch thick and 1.80 inches high). Below 0.50 inch the slide may not run. For best running, make the drawer 1-1/16 inch narrower than the opening. Minimum drawer height is 1-7/8 inches, and drawer width should not exceed slide length.",
    source: ACCURIDE_3832,
  },
  {
    id: "blum-cup-35",
    topic: "hinge",
    summary:
      "A Blum CLIP top concealed cabinet hinge bores a 35 mm cup. The same cup is used for full-overlay, half-overlay, and inset doors; those are mounting classes.",
    source: BLUM_CLIP,
  },
  {
    id: "kreg-lengths",
    topic: "pocket-screw",
    summary:
      "Kreg's K4 chart, measuring from the bottom of the head to the tip: 1/2 inch stock takes a 1 inch screw, 3/4 inch stock takes 1-1/4 inch, and 1-1/2 inch stock takes 2-1/2 inch. The jig mark matches the stock thickness.",
    source: KREG_K4,
  },
  {
    id: "kreg-thread",
    topic: "pocket-screw",
    summary:
      "Kreg coarse-thread screws (their #8) are for softwood, plywood, MDF, and particleboard. Fine-thread screws (their #7) are for hardwood.",
    source: KREG_K4,
  },
  {
    id: "ada-forward-reach",
    topic: "ada",
    summary:
      "Unobstructed forward reach is 48 inches maximum high and 15 inches minimum low. Over an obstruction, high forward reach stays 48 inches through 20 inches of depth, then 44 inches, and depth stops at 25 inches.",
    source: `${ADA} §308.2.1 and §308.2.2`,
  },
  {
    id: "ada-side-reach",
    topic: "ada",
    summary:
      "Unobstructed side reach is 48 inches maximum high and 15 inches minimum low. Over an obstruction deeper than 10 inches (24 inches maximum), high side reach is 46 inches. Obstruction height is 34 inches maximum.",
    source: `${ADA} §308.3.1 and §308.3.2`,
  },
  {
    id: "ada-clearance",
    topic: "ada",
    summary:
      "Clear floor space is 30 by 48 inches minimum. Circular turning space is 60 inches in diameter minimum. Knee clearance is the space from 9 to 27 inches above the floor, 30 inches wide minimum, 25 inches deep maximum at 9 inches, and where required at least 11 inches deep at 9 inches and 8 inches deep at 27 inches. Toe clearance is below 9 inches; where required it is 17 inches minimum and 25 inches maximum.",
    source: `${ADA} §305.3, §304.3.1, §306.2, and §306.3`,
  },
  {
    id: "ada-heights",
    topic: "ada",
    summary:
      "Lavatory or sink rim or counter: 34 inches maximum. Dining and work surfaces: 28 to 34 inches. Kitchen work surface: 34 inches maximum. Door clear width: 32 inches minimum. Water-closet seat: 17 to 19 inches. Grab-bar top: 33 to 36 inches.",
    source: `${ADA} §606.3, §902.3, §804.3.2, §404.2.3, §604.4, and §609.4`,
  },
];
