/**
 * Named lumber species class pack — single source for densify/Buy identity.
 * Spoken maple/oak/cherry/… bind to lumber-1x4-8 and label as "Maple 1×4" etc.
 * Do not hand-maintain divergent lists in catalog / detectMaterial / display.
 *
 * Pack data mirrors named-lumber-species.json (curated ~39 retail/craft species).
 */
export type NamedLumberSpecies = {
  id: string;
  display: string;
  aliases: string[];
  densifyLabel: string;
  notes?: string;
};

export const CATALOG_LUMBER_BIND = "lumber-1x4-8" as const;

export const NAMED_LUMBER_SPECIES: NamedLumberSpecies[] = [
  {
    id: "cedar",
    display: "Cedar",
    aliases: [
      "cedar",
      "cedar 1x4",
      "cedar board",
      "cedar lumber",
      "western red cedar",
      "red cedar",
      "aromatic cedar",
      "cedar plank",
    ],
    densifyLabel: "Cedar 1×4",
  },
  {
    id: "pine",
    display: "Pine",
    aliases: [
      "pine",
      "pine 1x4",
      "pine board",
      "pine lumber",
      "white pine",
      "eastern white pine",
      "southern yellow pine",
      "syp",
      "yellow pine",
      "ponderosa pine",
      "clear pine",
    ],
    densifyLabel: "Pine 1×4",
  },
  {
    id: "redwood",
    display: "Redwood",
    aliases: [
      "redwood",
      "redwood 1x4",
      "redwood board",
      "redwood lumber",
      "california redwood",
      "coast redwood",
    ],
    densifyLabel: "Redwood 1×4",
  },
  {
    id: "spruce",
    display: "Spruce",
    aliases: [
      "spruce",
      "spruce 1x4",
      "spruce board",
      "sitka spruce",
      "white spruce",
      "spf",
    ],
    densifyLabel: "Spruce 1×4",
  },
  {
    id: "fir",
    display: "Fir",
    aliases: [
      "fir",
      "fir 1x4",
      "fir board",
      "douglas fir",
      "doug fir",
      "douglas-fir",
      "hemi-fir",
    ],
    densifyLabel: "Fir 1×4",
  },
  {
    id: "hemlock",
    display: "Hemlock",
    aliases: [
      "hemlock",
      "hemlock 1x4",
      "hemlock board",
      "western hemlock",
      "eastern hemlock",
    ],
    densifyLabel: "Hemlock 1×4",
  },
  {
    id: "cypress",
    display: "Cypress",
    aliases: [
      "cypress",
      "cypress 1x4",
      "cypress board",
      "bald cypress",
      "baldcypress",
      "pond cypress",
    ],
    densifyLabel: "Cypress 1×4",
  },
  {
    id: "balsa",
    display: "Balsa",
    aliases: [
      "balsa",
      "balsa 1x4",
      "balsa board",
      "balsa wood",
      "balsa stick",
    ],
    densifyLabel: "Balsa 1×4",
  },
  {
    id: "basswood",
    display: "Basswood",
    aliases: [
      "basswood",
      "basswood 1x4",
      "basswood board",
      "linden",
      "limewood",
    ],
    densifyLabel: "Basswood 1×4",
  },
  {
    id: "maple",
    display: "Maple",
    aliases: [
      "maple",
      "maple 1x4",
      "maple board",
      "maple lumber",
      "hard maple",
      "soft maple",
      "sugar maple",
      "rock maple",
      "birdseye maple",
    ],
    densifyLabel: "Maple 1×4",
  },
  {
    id: "oak",
    display: "Oak",
    aliases: [
      "oak",
      "oak 1x4",
      "oak board",
      "oak lumber",
      "red oak",
      "white oak",
      "quartersawn oak",
      "whiteoak",
      "redoak",
    ],
    densifyLabel: "Oak 1×4",
  },
  {
    id: "walnut",
    display: "Walnut",
    aliases: [
      "walnut",
      "walnut 1x4",
      "walnut board",
      "walnut lumber",
      "black walnut",
      "american walnut",
    ],
    densifyLabel: "Walnut 1×4",
  },
  {
    id: "cherry",
    display: "Cherry",
    aliases: [
      "cherry",
      "cherry 1x4",
      "cherry board",
      "cherry lumber",
      "black cherry",
      "american cherry",
    ],
    densifyLabel: "Cherry 1×4",
  },
  {
    id: "birch",
    display: "Birch",
    aliases: [
      "birch",
      "birch 1x4",
      "birch board",
      "yellow birch",
      "white birch",
      "paper birch",
    ],
    densifyLabel: "Birch 1×4",
  },
  {
    id: "poplar",
    display: "Poplar",
    aliases: [
      "poplar",
      "poplar 1x4",
      "poplar board",
      "yellow poplar",
      "tulip poplar",
      "tuliptree",
    ],
    densifyLabel: "Poplar 1×4",
  },
  {
    id: "ash",
    display: "Ash",
    aliases: [
      "ash",
      "ash 1x4",
      "ash board",
      "white ash",
      "black ash",
      "green ash",
    ],
    densifyLabel: "Ash 1×4",
  },
  {
    id: "alder",
    display: "Alder",
    aliases: [
      "alder",
      "alder 1x4",
      "alder board",
      "red alder",
      "western alder",
    ],
    densifyLabel: "Alder 1×4",
  },
  {
    id: "beech",
    display: "Beech",
    aliases: [
      "beech",
      "beech 1x4",
      "beech board",
      "american beech",
    ],
    densifyLabel: "Beech 1×4",
  },
  {
    id: "hickory",
    display: "Hickory",
    aliases: [
      "hickory",
      "hickory 1x4",
      "hickory board",
      "pecan",
      "pecan hickory",
    ],
    densifyLabel: "Hickory 1×4",
  },
  {
    id: "aspen",
    display: "Aspen",
    aliases: [
      "aspen",
      "aspen 1x4",
      "aspen board",
      "quaking aspen",
      "popple",
    ],
    densifyLabel: "Aspen 1×4",
  },
  {
    id: "sycamore",
    display: "Sycamore",
    aliases: [
      "sycamore",
      "sycamore 1x4",
      "sycamore board",
      "american sycamore",
    ],
    densifyLabel: "Sycamore 1×4",
  },
  {
    id: "elm",
    display: "Elm",
    aliases: [
      "elm",
      "elm 1x4",
      "elm board",
      "red elm",
      "slippery elm",
      "american elm",
    ],
    densifyLabel: "Elm 1×4",
  },
  {
    id: "butternut",
    display: "Butternut",
    aliases: [
      "butternut",
      "butternut 1x4",
      "butternut board",
      "white walnut",
    ],
    densifyLabel: "Butternut 1×4",
  },
  {
    id: "cottonwood",
    display: "Cottonwood",
    aliases: [
      "cottonwood",
      "cottonwood 1x4",
      "cottonwood board",
      "eastern cottonwood",
    ],
    densifyLabel: "Cottonwood 1×4",
  },
  {
    id: "mahogany",
    display: "Mahogany",
    aliases: [
      "mahogany",
      "mahogany 1x4",
      "mahogany board",
      "genuine mahogany",
      "honduran mahogany",
      "american mahogany",
      "philippine mahogany",
      "khaya",
      "african mahogany",
    ],
    densifyLabel: "Mahogany 1×4",
  },
  {
    id: "teak",
    display: "Teak",
    aliases: [
      "teak",
      "teak 1x4",
      "teak board",
      "teak lumber",
      "burmese teak",
    ],
    densifyLabel: "Teak 1×4",
  },
  {
    id: "sapele",
    display: "Sapele",
    aliases: [
      "sapele",
      "sapele 1x4",
      "sapele board",
      "sapelli",
    ],
    densifyLabel: "Sapele 1×4",
  },
  {
    id: "padauk",
    display: "Padauk",
    aliases: [
      "padauk",
      "padauk 1x4",
      "padouk",
      "african padauk",
    ],
    densifyLabel: "Padauk 1×4",
  },
  {
    id: "purpleheart",
    display: "Purpleheart",
    aliases: [
      "purpleheart",
      "purple heart",
      "purpleheart 1x4",
      "amaranth",
    ],
    densifyLabel: "Purpleheart 1×4",
  },
  {
    id: "ipe",
    display: "Ipe",
    aliases: [
      "ipe",
      "ipe 1x4",
      "ipe decking",
      "brazilian walnut",
    ],
    densifyLabel: "Ipe 1×4",
  },
  {
    id: "ebony",
    display: "Ebony",
    aliases: [
      "ebony",
      "ebony 1x4",
      "ebony board",
      "gaboon ebony",
      "macassar ebony",
    ],
    densifyLabel: "Ebony 1×4",
  },
  {
    id: "rosewood",
    display: "Rosewood",
    aliases: [
      "rosewood",
      "rosewood 1x4",
      "indian rosewood",
      "cocobolo",
    ],
    densifyLabel: "Rosewood 1×4",
  },
  {
    id: "wenge",
    display: "Wenge",
    aliases: [
      "wenge",
      "wenge 1x4",
      "wenge board",
    ],
    densifyLabel: "Wenge 1×4",
  },
  {
    id: "zebrawood",
    display: "Zebrawood",
    aliases: [
      "zebrawood",
      "zebra wood",
      "zebrawood 1x4",
      "zebrano",
    ],
    densifyLabel: "Zebrawood 1×4",
  },
  {
    id: "bamboo",
    display: "Bamboo",
    aliases: [
      "bamboo",
      "bamboo 1x4",
      "bamboo board",
      "bamboo lumber",
      "bamboo plank",
    ],
    densifyLabel: "Bamboo 1×4",
    notes: "Catalog also has bamboo-skewer-12. Prefer skewer when prompt says skewer; else named bamboo lumber binds lumber-1x4-8 for densify/buy identity.",
  },
  {
    id: "mesquite",
    display: "Mesquite",
    aliases: [
      "mesquite",
      "mesquite 1x4",
      "mesquite board",
    ],
    densifyLabel: "Mesquite 1×4",
  },
  {
    id: "osage",
    display: "Osage",
    aliases: [
      "osage",
      "osage orange",
      "osage 1x4",
      "hedge apple",
      "bois d'arc",
    ],
    densifyLabel: "Osage 1×4",
  },
  {
    id: "locust",
    display: "Locust",
    aliases: [
      "locust",
      "black locust",
      "locust 1x4",
      "honey locust",
    ],
    densifyLabel: "Locust 1×4",
  },
  {
    id: "sweetgum",
    display: "Sweetgum",
    aliases: [
      "sweetgum",
      "sweet gum",
      "sweetgum 1x4",
      "redgum",
    ],
    densifyLabel: "Sweetgum 1×4",
  },
];

export const NAMED_LUMBER_IDS: string[] = NAMED_LUMBER_SPECIES.map((s) => s.id);

export const NAMED_LUMBER_ID_SET = new Set(NAMED_LUMBER_IDS);

/** Escape a spoken alias for RegExp (literal match). */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Alias → species, longest alias first (specific before generic). */
function aliasIndex(): { alias: string; species: NamedLumberSpecies }[] {
  const rows: { alias: string; species: NamedLumberSpecies }[] = [];
  for (const species of NAMED_LUMBER_SPECIES) {
    for (const alias of species.aliases) {
      rows.push({ alias: alias.toLowerCase(), species });
    }
  }
  rows.sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias));
  return rows;
}

const ALIAS_INDEX = aliasIndex();

/** Catalog aliases for lumber-1x4-8: size codes + every pack alias (longest first). */
export function catalogLumberAliases(sizeAliases: string[] = ["1x4", "one by four"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...sizeAliases, ...ALIAS_INDEX.map((r) => r.alias)]) {
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** Catalog tags: base + every species id. */
export function catalogLumberTags(base: string[] = ["lumber", "trim", "shelf"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...base, ...NAMED_LUMBER_IDS]) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Word-bounded regex for one alias (multi-word: flexible whitespace). */
export function aliasToRegExp(alias: string): RegExp {
  const bits = alias.trim().toLowerCase().split(/\s+/).map(escapeRe);
  if (bits.length === 1) return new RegExp(`\\b${bits[0]}\\b`);
  return new RegExp(`\\b${bits.join("\\s+")}\\b`);
}

/**
 * detectMaterial phrases for named lumber → lumber-1x4-8.
 * Longest alias first. Caller must place bamboo-skewer ahead of these.
 */
export function namedLumberDetectPhrases(): [RegExp, string][] {
  const seen = new Set<string>();
  const out: [RegExp, string][] = [];
  for (const { alias } of ALIAS_INDEX) {
    if (seen.has(alias)) continue;
    seen.add(alias);
    out.push([aliasToRegExp(alias), CATALOG_LUMBER_BIND]);
  }
  return out;
}

/** Spoken-stock test used by followOnNamesStock / explicit-stock paths. */
export function namedLumberSpokenTest(): RegExp {
  const alts = ALIAS_INDEX.map(({ alias }) => {
    const bits = alias.trim().split(/\s+/).map(escapeRe);
    return bits.length === 1 ? `\\b${bits[0]}\\b` : `\\b${bits.join("\\s+")}\\b`;
  });
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const a of alts) {
    if (seen.has(a)) continue;
    seen.add(a);
    uniq.push(a);
  }
  return new RegExp(uniq.join("|"));
}

const SPOKEN_TEST = namedLumberSpokenTest();

export function promptNamesNamedLumber(prompt: string): boolean {
  return SPOKEN_TEST.test((prompt || "").toLowerCase());
}

/** Match spoken alias → pack row (longest alias wins). */
export function namedLumberFromPrompt(prompt: string): NamedLumberSpecies | null {
  const lower = (prompt || "").toLowerCase();
  for (const { alias, species } of ALIAS_INDEX) {
    if (aliasToRegExp(alias).test(lower)) return species;
  }
  return null;
}

export function densifyLabelForPrompt(prompt: string): string | null {
  return namedLumberFromPrompt(prompt)?.densifyLabel ?? null;
}

export function isNamedLumberSpeciesId(id: string): boolean {
  return NAMED_LUMBER_ID_SET.has(id.toLowerCase());
}
