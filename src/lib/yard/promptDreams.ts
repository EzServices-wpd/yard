import { POCKET_DREAM } from "./pocket";

export const DREAMS = [
  {
    id: "eiffel",
    label: "3-ft popsicle Eiffel",
    prompt: "3 foot Eiffel Tower from popsicle sticks",
    blurb: "The north star — true-scale lattice, pack count, ordered steps.",
  },
  {
    id: "pyramid-small",
    label: "12-in popsicle pyramid",
    prompt: "12 inch popsicle stick pyramid",
    blurb: "Tabletop Giza — same door, a weekend of sticks.",
  },
  {
    id: "closet",
    label: "Bathroom pocket vanity",
    prompt: POCKET_DREAM,
    blurb: "The original — a wonky trapezoid, a straight unit, a plan you can cut.",
  },
  {
    id: "arch",
    label: "PVC garden arch",
    prompt: "6 foot garden arch from 3/4 inch PVC pipe",
    blurb: "Two legs and a curved crown in shop-length pipe.",
  },
  {
    id: "pyramid",
    label: "Craft-stick pyramid",
    prompt: "3 ft popsicle stick pyramid",
    blurb: "Stepped square rings, real stick lengths.",
  },
  {
    id: "window",
    label: "Andersen 36×48 hung",
    prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    blurb: "Pick the unit. Frame its RO. Buy the window and the lumber.",
  },
  {
    id: "bridge",
    label: "Straw bridge",
    prompt: "4 foot bridge from plastic drinking straws",
    blurb: "Deck, piers, a raised mid-span.",
  },
  {
    id: "desk",
    label: "60\" desk with drawers",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    blurb: "Same engine as the pocket — measure it, cut it, sit at it.",
  },
] as const;
