import { POCKET_DREAM } from "./pocket";

/** Hero chips on the landing page and prompt bar. Order = prominence. */
export const DREAMS = [
  {
    id: "eiffel",
    label: "3-ft popsicle Eiffel",
    prompt: "3 foot Eiffel Tower from popsicle sticks",
    blurb: "North star — true-scale lattice, dominant base arches, pier thickening, ordered steps.",
  },
  {
    id: "arch",
    label: "PVC garden arch",
    prompt: "6 foot garden arch from 3/4 inch PVC pipe",
    blurb: "Walk-through portal: four posts, front + back crowns, side rails only.",
  },
  {
    id: "bridge",
    label: "Straw Warren bridge",
    prompt: "4 foot bridge from plastic drinking straws",
    blurb: "Single stock + joiner only. Continuous chords, Warren truss, densified deck, abutments.",
  },
  {
    id: "closet",
    label: "Bathroom pocket vanity",
    prompt: POCKET_DREAM,
    blurb: "Wonky trapezoid in, straight unit out — cut list and hardware you can buy.",
  },
  {
    id: "pyramid-small",
    label: "12-in popsicle pyramid",
    prompt: "12 inch popsicle stick pyramid",
    blurb: "Tabletop Giza — same engine, a weekend of sticks.",
  },
  {
    id: "window",
    label: "Andersen 36×48 hung",
    prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    blurb: "Pick the unit. Frame its RO. Buy the window and the lumber.",
  },
  {
    id: "desk",
    label: "60\" desk with drawers",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    blurb: "Same pocket engine — measure it, cut it, sit at it.",
  },
  {
    id: "pyramid",
    label: "3-ft craft-stick pyramid",
    prompt: "3 ft popsicle stick pyramid",
    blurb: "Stepped square rings, real stick lengths, no fake geometry.",
  },
  {
    id: "paper-house",
    label: "House on paper",
    prompt: "8x10 paper house of popsicle sticks",
    blurb: "Whole sticks on the lines. Print, glue ends, no cutting.",
  },
  {
    id: "paper-star",
    label: "Star on paper",
    prompt: "letter paper star of popsicle sticks",
    blurb: "10 full sticks, one sitting. Glue the points — never cut.",
  },
  {
    id: "paper-car",
    label: "Car on paper",
    prompt: "8x10 paper car of popsicle sticks",
    blurb: "Side-view car from whole sticks. Glue ends where lines meet.",
  },
  {
    id: "paper-frame",
    label: "Picture frame",
    prompt: "8x10 paper picture frame of popsicle sticks",
    blurb: "Outer + inner border, full sticks only. Glue, hang, done.",
  },
] as const;
