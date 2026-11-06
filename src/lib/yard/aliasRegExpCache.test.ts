import assert from "node:assert/strict";
import { it } from "node:test";
import { aliasToRegExp, legPhraseFor, NAMED_LUMBER_SPECIES, namedLegLumberFromPrompt, namedLumberFromPrompt, spokenLegSpecies } from "./namedLumberSpecies.ts";
import { familyWord } from "./placeEveryPart.ts";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The patterns as they were built on every call before they were cached. */
function freshAlias(alias: string): RegExp {
  const bits = alias.trim().toLowerCase().split(/\s+/).map(esc);
  return bits.length === 1 ? new RegExp(`\\b${bits[0]}\\b`) : new RegExp(`\\b${bits.join("\\s+")}\\b`);
}
function freshLeg(alias: string): RegExp {
  const src = freshAlias(alias).source;
  return new RegExp(`${src}\\s+(?:table\\s+)?legs?\\b|\\blegs?\\s+(?:in|of|made\\s+of|from)\\s+${src}`);
}
const ALIASES = [...new Set(NAMED_LUMBER_SPECIES.flatMap((s) => s.aliases.map((a) => a.toLowerCase())))];

it("a cached alias pattern is the pattern a fresh build makes: same source, same flags, no g/y state", () => {
  for (const a of ALIASES) {
    const c = aliasToRegExp(a), f = freshAlias(a);
    assert.equal(c, aliasToRegExp(a), `${a}: one compiled RegExp per alias`);
    assert.deepEqual([c.source, c.flags], [f.source, f.flags], a);
    assert.ok(!c.global && !c.sticky, `${a}: a shared pattern must keep no lastIndex`);
    const l = legPhraseFor(a), fl = freshLeg(a);
    assert.equal(l, legPhraseFor(a), `${a}: one compiled leg phrase per alias`);
    assert.deepEqual([l.source, l.flags], [fl.source, fl.flags], a);
    assert.ok(!l.global && !l.sticky, a);
  }
});

it("species reads answer the same on the first call, the second, and after other prompts ran", () => {
  const qs = ["oak table with walnut legs", "pine desk from oak", "cedar bench from 2x4", "legs from walnut, top of maple", "bookshelf", "red oak dresser", "white oak console made of plywood"];
  const read = (q: string) => JSON.stringify([namedLumberFromPrompt(q)?.id ?? null, namedLegLumberFromPrompt(q)?.id ?? null, spokenLegSpecies(q)?.phrase ?? null]);
  const first = qs.map(read);
  assert.deepEqual([...qs].reverse().map(read).reverse(), first);
  assert.deepEqual(qs.map(read), first);
});

it("familyWord answers the same cached and uncached (the cache holds whole names only)", () => {
  const names = ["Left upright", "Leg front left 1", "Left drawer front 2", "Post front left A", "Shelf (fixed) 3", "Top", "step", "Back", "Drawer front", "Upper left back"];
  const first = names.map(familyWord);
  assert.deepEqual(names.map(familyWord), first);
  assert.deepEqual(first.slice(0, 3), ["upright", "leg", "drawer front"]);
});
