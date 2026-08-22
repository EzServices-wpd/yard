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
    id: "paper-car",
    label: "8×10 car (paper)",
    prompt: "8x10 paper with a car of popsicle sticks",
    blurb: "Kids path — printable 2D map, then Convert to 3D if you want depth.",
  },
  {
    id: "paper-dino",
    label: "Letter dinosaur",
    prompt: "letter paper dinosaur from craft sticks",
    blurb: "Side-view dino silhouette on letter stock. Print, glue, or lift to 3D.",
  },
  {
    id: "paper-castle",
    label: "8×10 castle outline",
    prompt: "8x10 paper castle of popsicle sticks",
    blurb: "Towers + wall + gate outline for the bench or the classroom.",
  },
  {
    id: "paper-star",
    label: "Star on paper",
    prompt: "printable star of toothpicks on letter paper",
    blurb: "Simple 2D star map — fastest kids craft in the catalog.",
  },
] as const;
