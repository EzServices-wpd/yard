import { POCKET_SHORT } from "./pocket";

export type DreamGroup = "house" | "weekend";

/** Hero chips. House first. Weekend second. Paper stays in the engine, off the homepage. */
export const DREAMS = [
  {
    id: "pocket",
    group: "house" as const,
    label: "Pocket vanity",
    prompt: POCKET_SHORT,
    blurb: "Fits the bathroom pocket you measured.",
  },
  {
    id: "linen",
    group: "house" as const,
    label: "31.5″ linen closet",
    prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    blurb: "The alcove you typed is the unit you get.",
  },
  {
    id: "window",
    group: "house" as const,
    label: "Andersen 36×48 hung",
    prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    blurb: "Pick the unit. Frame its RO. Buy the window and the lumber.",
  },
  {
    id: "desk",
    group: "house" as const,
    label: "60″ desk with drawers",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    blurb: "Drawers, 24″ knee, sit down.",
  },
  {
    id: "eiffel",
    group: "weekend" as const,
    label: "3-ft popsicle Eiffel",
    prompt: "3 foot Eiffel Tower from popsicle sticks",
    blurb: "Four arches, four piers, one shaft. Weekend lattice at the size you typed.",
  },
  {
    id: "arch",
    group: "weekend" as const,
    label: "PVC garden arch",
    prompt: "6 foot garden arch from 3/4 inch PVC pipe",
    blurb: "Walk-through portal: four posts, front + back crowns, side rails only.",
  },
  {
    id: "bridge",
    group: "weekend" as const,
    label: "Straw Warren bridge",
    prompt: "4 foot bridge from plastic drinking straws",
    blurb: "Single stock + joiner. Continuous chords, Warren truss, densified deck.",
  },
] as const;
