/**
 * What one 8 ft 1×4 board of a named species costs — so Buy prices oak as oak and walnut as walnut.
 *
 * Estimates in US dollars for one surfaced (S4S) 3/4" × 3 1/2" × 8 ft board at a US home center or
 * hardwood dealer, 2026. They are estimates: Buy shows them with store search links and no "Best"
 * badge, the same way it shows any other unlisted stock. Pine keeps the checked 1×4 listings.
 */
import { NAMED_LUMBER_SPECIES, type NamedLumberSpecies } from "./namedLumberSpecies";

export const SPECIES_BOARD_USD: Record<string, number> = {
  pine: 5,
  spruce: 5,
  fir: 6,
  hemlock: 6,
  aspen: 9,
  cottonwood: 9,
  poplar: 10,
  cedar: 12,
  basswood: 14,
  cypress: 14,
  sweetgum: 14,
  balsa: 15,
  birch: 16,
  alder: 16,
  redwood: 16,
  sycamore: 18,
  elm: 18,
  oak: 20,
  ash: 20,
  beech: 20,
  maple: 22,
  hickory: 22,
  bamboo: 25,
  cherry: 30,
  butternut: 30,
  sapele: 30,
  locust: 30,
  mahogany: 34,
  walnut: 38,
  ipe: 40,
  purpleheart: 42,
  padauk: 45,
  mesquite: 45,
  osage: 50,
  wenge: 60,
  teak: 70,
  zebrawood: 70,
  rosewood: 120,
  ebony: 150,
};

/** Species named at the head of a Buy or cut-list label ("Walnut 1×4" → walnut row), else null. */
export function speciesOfBoardLabel(label?: string | null): NamedLumberSpecies | null {
  const m = (label ?? "").trim().match(/^([A-Za-z]+)\s+[124]\s*[×x]\s*\d+\b/);
  if (!m) return null;
  const head = m[1].toLowerCase();
  return NAMED_LUMBER_SPECIES.find((s) => s.display.toLowerCase() === head || s.id === head) ?? null;
}

/** Price of one 8 ft 1×4 board of this species, or null when the species has no estimate. */
export function speciesBoardUsd(species: NamedLumberSpecies | string | null | undefined): number | null {
  if (!species) return null;
  const id = typeof species === "string" ? species : species.id;
  return SPECIES_BOARD_USD[id] ?? null;
}
