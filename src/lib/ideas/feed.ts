/**
 * Ideas feed: the shape the page renders (PR-PLAN.md (a)). Until SWE's live feed lands, `curatedFeed()`
 * adapts today's curated lists and passing recipes into it; the live feed drops in as another IdeasFeed.
 * Pure: no engine import (the drawings are baked by scripts/gen-idea-drawings.ts).
 */
import { CURATED_IDEAS, IDEAS, IDEA_SECTIONS, type Idea } from "@/lib/yard/ideas";
import { ideaSearchScore, ideaStem, ideaTokens } from "@/lib/yard/ideaLibrary";
import { PLANS, type PlanPage } from "@/lib/yard/plans";
import type { TestFlags } from "./testFlags";
import DRAWINGS from "./drawings.json";
import TYPES from "./types.json";
import { formatSize, type SolvedDims } from "./size";

/** Build type per card: the engine result key (scripts/gen-idea-types.ts), so log rows fold into it. */
const typeFor = (slug: string, prompt: string) => (TYPES as Record<string, string>)[slug] ?? buildTypeOf(prompt);

export type DrawingRef = { src: string; model?: string; w: number; h: number; parts: number; v: string; dims?: SolvedDims };
export type IdeaCard = {
  slug: string;
  buildType: string;
  title: string;
  /** Real builds. Hidden in the UI until SWE's test-traffic filter is live (`countsLive`). */
  count: number;
  lastSeen: string | null;
  examplePrompt: string;
  recipeKey: string | null;
  dims: { width: number; height: number; depth: number } | null;
  /** "W × D × H in", formatted from the engine's solved dims (the drawing's labels), never from a typed string. Empty when there are none. */
  size: string;
  /** The size spelled out for screen readers ("31 and a half inches wide, 16 deep, 78 tall"). */
  sizeAria: string;
  /** The typed size, for search only (never printed). */
  typedSize?: string;
  status: "checked" | "new";
  /** The log has only ever seen this type as Unverified. A search / See-all row, never a picture card. */
  unverified?: boolean;
  /** Slugs this card used to publish. An old link still resolves to the card. */
  aliases?: string[];
  /** Earlier names (the header before this title, the build type). Search only, never printed. */
  aka?: string;
  blurb?: string;
  /** Feature note printed after the size in the text face ("from 2×4", "for a 36 × 48 double-hung"). */
  stock?: string;
  section: string;
  drawing: DrawingRef | null;
};
export type IdeaSection = { id: string; title: string; order: number; total: number; cards: IdeaCard[] };
export type IdeaHero = { slug: string; examplePrompt: string; title: string; count: number };
/** `all`: the live feed's whole catalog, one card per build type, drawn or not (liveFeed); absent on the fallback feed. */
export type IdeasFeed = { at: string; live: boolean; countsLive: boolean; hero: IdeaHero | null; sections: IdeaSection[]; all?: IdeaCard[] };

/** Cards a section shows before "Show all". */
export const SECTION_SHOW = 8;
/** All ideas rows shown at first, and added per "Show more". */
export const ALL_SHOW = 24;

/**
 * The Show all control's words, from the section's own numbers: the count it opens, and the real total when the feed
 * sent fewer (liveFeed sends the top SECTION_MAX and sets `total` to every card the section has).
 */
export function showAllLabel(s: Pick<IdeaSection, "cards" | "total">): string {
  return s.total > s.cards.length ? `Show top ${s.cards.length} of ${s.total}` : `Show all ${s.cards.length}`;
}

type Manifest = Record<string, { v: string; w: number; h: number; parts: number; model?: string; dims?: SolvedDims }>;

/** Old public slug → the slug the card uses now. Filled when a title change renames the slug. */
const SLUG_ALIAS = new Map<string, string>();
export function rememberIdeaSlug(from: string, to: string) {
  if (from && to && from !== to) SLUG_ALIAS.set(from, to);
}
/** The slug a card publishes now. An unknown or current slug comes back unchanged. */
export function resolveIdeaSlug(slug: string): string {
  const seen = new Set<string>();
  let s = slug;
  while (SLUG_ALIAS.has(s) && !seen.has(s)) {
    seen.add(s);
    s = SLUG_ALIAS.get(s)!;
  }
  return s;
}
function manifestKey(slug: string, manifest: Manifest): string | null {
  if (manifest[slug]) return slug;
  const next = resolveIdeaSlug(slug);
  if (manifest[next]) return next;
  for (const [from, to] of SLUG_ALIAS) if ((to === slug || from === slug) && manifest[from]) return from;
  return null;
}

export function drawingFor(slug: string, manifest: Manifest = DRAWINGS as Manifest): DrawingRef | null {
  const key = manifestKey(slug, manifest);
  if (!key) return null;
  const m = manifest[key];
  const base = `/ideas/drawings/${key}.${m.v}`;
  return { src: `${base}.svg`, ...(m.model ? { model: m.model } : {}), w: m.w, h: m.h, parts: m.parts, v: m.v, ...(m.dims ? { dims: m.dims } : {}) };
}

/** Joining words a display title must not end on ("Step stool with"). */
export const TITLE_JOINERS = new Set("a an and at by for from in into nor of on or plus the to via vs with".split(" "));
export function endsOnJoiner(title: string): boolean {
  const words = title.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const last = words[words.length - 1];
  return !!last && TITLE_JOINERS.has(last);
}

const DIM_WORD = /^(?:wide|tall|long|deep|high|beam|feet|foot|ft|inches|inch)$/i;
const wordOf = (t: string) => t.replace(/^[("']+|[).,;:]+$/g, "");
const isDimWord = (t: string) => DIM_WORD.test(wordOf(t));
const isUnitNum = (t: string) => /\d/.test(t) && /['"″′]/.test(t);
const isCross = (t: string) => /^\d[\d./-]*[×x]\d/i.test(wordOf(t));
const isBareNum = (t: string) => /^\d+(?:\/\d+)?$/.test(wordOf(t));
const isSizeOp = (t: string) => /^[×x·]$/.test(wordOf(t));
const isJoinerWord = (t: string) => TITLE_JOINERS.has(wordOf(t).toLowerCase());

/**
 * The header name with measurements taken out. A count stays, after a comma ("Step stool with 2 steps"
 * → "Step stool, 2 steps"). Feet, inches, crosses (2×4, 8x10), and dimension words next to a number
 * (wide, tall, long, deep, beam) go. Not a per-build list.
 */
export function titleFromHeader(header: string): string {
  const tokens = header.replace(/[″”]/g, '"').replace(/[′’]/g, "'").trim().split(/\s+/).filter(Boolean);
  const role = tokens.map(() => "name" as "name" | "measure" | "count" | "drop");
  for (let i = 0; i < tokens.length; i++) if (isUnitNum(tokens[i]) || isCross(tokens[i])) role[i] = "measure";
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < tokens.length; i++) {
      if (role[i] === "measure") continue;
      const prev = i > 0 && role[i - 1] === "measure";
      const next = i + 1 < tokens.length && role[i + 1] === "measure";
      const t = wordOf(tokens[i]);
      const beside = prev || next;
      if (beside && (isBareNum(t) || isSizeOp(t) || isDimWord(t) || /^(?:to|by|in)$/i.test(t))) {
        role[i] = "measure";
        changed = true;
      }
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (role[i] !== "name" || !isBareNum(tokens[i])) continue;
    const noun = tokens[i + 1];
    if (!noun || role[i + 1] !== "name" || isJoinerWord(noun) || isDimWord(noun) || isSizeOp(noun)) continue;
    role[i] = "count";
    role[i + 1] = "count";
    if (i > 0 && role[i - 1] === "name" && isJoinerWord(tokens[i - 1])) role[i - 1] = "drop";
  }
  const name: string[] = [];
  const counts: string[] = [];
  let count: string[] = [];
  const flush = () => {
    if (count.length) counts.push(count.join(" "));
    count = [];
  };
  for (let i = 0; i < tokens.length; i++) {
    if (role[i] === "count") count.push(tokens[i]);
    else {
      flush();
      if (role[i] === "name") name.push(tokens[i]);
    }
  }
  flush();
  while (name.length && isJoinerWord(name[name.length - 1])) name.pop();
  let title = name.join(" ").replace(/\s+/g, " ").replace(/^[,·×.\s-]+|[,·×.\s-]+$/g, "").trim();
  if (!title) title = header.trim();
  if (counts.length) title = `${title}, ${counts.join(", ")}`;
  if (/^[a-z]/.test(title)) title = title[0].toUpperCase() + title.slice(1);
  return title;
}

/** A size or measurement still in a display title (a count such as "2 steps" is not one). */
export function titleHasMeasure(title: string): boolean {
  if (/\b(?:wide|tall|long|deep|high|beam|feet|foot|ft|inches|inch)\b/i.test(title)) return true;
  if (/['"″′·×]/.test(title)) return true;
  if (/\d\s*[x×]\s*\d/i.test(title)) return true;
  return false;
}

/** Size words a title must not claim. The size is already printed beside the card. "Big" stays inside a proper name. */
const SIZE_ADJ = /^(?:jumbo|mini|giant|tall|small|big|large|tiny|compact|huge|little|miniature|micro|slim|oversized|narrow|short|xl|xxl)$/i;
/** A word that names the thing being built. Place words (slope, toilet, base) are not in here. */
const OBJECT = /\b(?:abacus|arch|barn|bed|bench|bin|birdhouse|boat|bookcase|bookshelf|box|bridge|bunk|cabinet|cart|castle|catapult|chair|chest|closet|colosseum|console|coop|cover|crate|daybed|desk|dinosaur|dog|dollhouse|dresser|easel|engine|feeder|fort|frame|glider|goal|hanger|headboard|hood|house|island|ladder|lighthouse|mailbox|nightstand|opening|organizer|ottoman|pantry|pegboard|pergola|rack|rail|robot|rocket|sailboat|sawhorse|seat|shelf|shelves|ship|sideboard|sorter|stand|stool|submarine|swing|table|toolbox|tower|train|tree|trellis|vanity|wardrobe|wheel|windmill|window|workbench)\b/i;
const PROPER = ["Brooklyn Bridge", "Empire State Building", "Space Needle", "White House", "Taj Mahal", "Statue of Liberty", "CN Tower", "Big Ben", "Eiffel", "Leaning Tower of Pisa", "Warren"];

function properWords(title: string): Map<string, string> {
  const lower = title.toLowerCase();
  const map = new Map<string, string>();
  for (const phrase of [...PROPER].sort((a, b) => b.length - a.length)) {
    if (!lower.includes(phrase.toLowerCase())) continue;
    for (const w of phrase.split(/\s+/)) map.set(w.toLowerCase(), w);
  }
  return map;
}

export function titleHasSizeAdjective(title: string): boolean {
  const keep = properWords(title);
  return title.split(/\s+/).some((w) => { const bare = wordOf(w).toLowerCase(); return !!bare && SIZE_ADJ.test(bare) && !keep.has(bare); });
}

export function titleHasObjectNoun(title: string): boolean {
  return OBJECT.test(title) || PROPER.some((p) => title.toLowerCase().includes(p.toLowerCase()));
}

function caseToken(raw: string, first: boolean, proper: Map<string, string>): string {
  const lead = raw.match(/^[("']*/)?.[0] ?? "";
  const tail = raw.match(/[).,;:]*$/)?.[0] ?? "";
  const bare = raw.slice(lead.length, raw.length - tail.length);
  const known = proper.get(bare.toLowerCase());
  if (known) return lead + known + tail;
  if (/^[A-Z]{2,}$/.test(bare) || /\d/.test(bare)) return raw;
  if (/^[A-Za-z]-/.test(bare)) return lead + bare[0].toUpperCase() + bare.slice(1).toLowerCase() + tail;
  const low = bare.toLowerCase();
  const cased = first ? low.slice(0, 1).toUpperCase() + low.slice(1) : low;
  return lead + cased + tail;
}

export function sentenceCaseTitle(title: string): string {
  const proper = properWords(title);
  return title.split(/\s+/).filter(Boolean).map((w, i) => caseToken(w, i === 0, proper)).join(" ");
}

export function titleIsSentenceCase(title: string): boolean {
  return sentenceCaseTitle(title) === title;
}

function dropSizeWords(title: string): string {
  const keep = properWords(title);
  return title.split(/\s+/).filter((w) => { const bare = wordOf(w).toLowerCase(); return !bare || keep.has(bare) || !SIZE_ADJ.test(bare); }).join(" ").replace(/\s+/g, " ").trim();
}

function typePhrase(type: string): string {
  const parts = type.split("-");
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.length === 1 && parts[i + 1]) words.push(`${p}-${parts[++i]}`);
    else if (!SIZE_ADJ.test(p)) words.push(p);
  }
  return words.join(" ");
}

function lastObject(s?: string): string | null {
  if (!s) return null;
  const words = s.toLowerCase().replace(/-/g, " ").split(/[^a-z]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) if (OBJECT.test(words[i])) return words[i];
  return null;
}

/**
 * The Ideas title: the header name, measurements already out, then one rule. Sentence case (proper names,
 * acronyms and tokens like PVC or 2×4 keep their form). Size adjectives drop. A header with no object noun
 * takes the noun from the build type, or from the prompt when the type has none.
 */
export function ideasTitle(header: string, src?: { type?: string; prompt?: string }): string {
  let title = dropSizeWords(titleFromHeader(header));
  if (!titleHasObjectNoun(title)) {
    const phrase = src?.type ? typePhrase(src.type) : "";
    const noun = lastObject(src?.prompt) || lastObject(src?.type);
    if (phrase && titleHasObjectNoun(phrase)) title = phrase;
    else if (noun && !title.toLowerCase().includes(noun)) title = `${title} ${noun}`.trim();
  }
  return sentenceCaseTitle(title);
}

/** Names a search should still hit after the title changed. Not shown. */
export function formerNames(raw: string, title: string, type?: string): string | undefined {
  const have = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
  const bits = [raw, ...(type ? [type.replace(/-/g, " ")] : [])];
  const keep = [...new Set(bits.map((s) => s.trim()).filter((s) => s && s.toLowerCase().split(/[^a-z0-9×]+/).filter((w) => w.length > 1).some((w) => !have.has(w) && !have.has(w.replace(/×/g, "x")))))];
  return keep.length ? keep.join(" ") : undefined;
}
export function slugifyTitle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * The drawing of a build type (I-draw): its own manifest key, else the drawing baked for a card of that same engine
 * type (types.json maps each baked slug to the engine's result-key type, so "jar-rack" draws as jarshelf). Null when
 * no card of that type was ever baked; liveFeed then leaves the card off the page.
 */
const SLUG_OF_TYPE = new Map<string, string>();
for (const [slug, type] of Object.entries(TYPES as Record<string, string>)) if (!SLUG_OF_TYPE.has(type) && (DRAWINGS as Manifest)[slug]) SLUG_OF_TYPE.set(type, slug);
export function drawingForType(type: string): DrawingRef | null {
  const slug = SLUG_OF_TYPE.get(type);
  return drawingFor(type) ?? (slug ? drawingFor(slug) : null);
}

/** One build type per card: the prompt stem without sizes or filler ("bookshelf 36x12x72" → "bookshelf"). */
export function buildTypeOf(prompt: string): string {
  return ideaStem(prompt) || prompt.trim().toLowerCase();
}

export type RecipeLike = { id: string; label: string; prompt: string; size: string; blurb: string; box?: { width: number; height: number; depth: number } };

/** Card titles in Yard's voice where the curated label is a brand (the prompt keeps the unit it names). */
export const TITLE_FIX: Record<string, string> = { window: "Frame a window opening" };
/** What the build is for, after the size (the window card's build is the framing, not the window). */
export const NOTE_FIX: Record<string, string> = { window: "for a 36 × 48 double-hung" };

/** Size fields from the engine dims the drawing shows (scripts/gen-idea-drawings.ts bakes them). */
export function sizeOf(dims: SolvedDims | null | undefined): Pick<IdeaCard, "size" | "sizeAria"> {
  const f = formatSize(dims);
  return { size: f.text, sizeAria: f.aria };
}

function titled(raw: string, type: string, prompt: string): Pick<IdeaCard, "title" | "aka"> {
  const title = ideasTitle(raw, { type, prompt });
  const aka = formerNames(raw, title, type);
  return { title, ...(aka ? { aka } : {}) };
}
function fromIdea(d: Idea): IdeaCard {
  const drawing = drawingFor(d.id);
  const type = typeFor(d.id, d.prompt);
  return {
    slug: d.id, buildType: type, ...titled(TITLE_FIX[d.id] ?? d.label, type, d.prompt), count: 0, lastSeen: null, examplePrompt: d.prompt,
    recipeKey: null, dims: null, ...sizeOf(drawing?.dims), typedSize: d.size, status: "checked", blurb: d.blurb, stock: NOTE_FIX[d.id] ?? d.stock, section: d.section, drawing,
  };
}
function fromRecipe(r: RecipeLike, status: IdeaCard["status"], section: string, count = 0): IdeaCard {
  const type = typeFor(r.id, r.prompt);
  const slug = type || r.id;
  if (r.id !== slug) rememberIdeaSlug(r.id, slug);
  const drawing = drawingFor(slug);
  const aliases = r.id !== slug ? [r.id] : undefined;
  return {
    slug, buildType: type, ...titled(r.label, type, r.prompt), ...(aliases ? { aliases } : {}), count, lastSeen: null, examplePrompt: r.prompt,
    recipeKey: r.id.replace(/^recipe-/, ""), dims: r.box ?? null, ...sizeOf(drawing?.dims), typedSize: r.size, status, blurb: r.blurb, section, drawing,
  };
}

/** Sort by real build count (desc), keeping the source order on ties (curated order until counts exist). */
export function byCount(cards: IdeaCard[]): IdeaCard[] {
  return cards.map((c, i) => ({ c, i })).sort((a, b) => b.c.count - a.c.count || a.i - b.i).map((x) => x.c);
}

/** Drops any card whose slug or build type already appeared earlier on the page (first section wins). */
export function dedupe(sections: IdeaSection[]): IdeaSection[] {
  const slugs = new Set<string>(), types = new Set<string>();
  return sections
    .map((s) => {
      const cards = s.cards.filter((c) => {
        if (slugs.has(c.slug) || types.has(c.buildType)) return false;
        slugs.add(c.slug); types.add(c.buildType);
        return true;
      });
      return { ...s, cards, total: cards.length };
    })
    .filter((s) => s.cards.length > 0);
}

/** Hero when the feed names none (or counts are not live yet): the house build Yard leads with. */
export const HERO_FALLBACK = "linen";

/** The hero's card: the feed's pick, else the fallback; always one with a baked live model. */
export function heroCard(feed: IdeasFeed, pool: IdeaCard[] = feed.sections.flatMap((s) => s.cards)): IdeaCard | null {
  const pick = (slug?: string) => (slug ? pool.find((c) => c.slug === slug && c.drawing?.model) ?? null : null);
  return pick(feed.hero?.slug) ?? pick(HERO_FALLBACK) ?? pool.find((c) => c.drawing?.model) ?? null;
}

export const LEARNED_SECTION = "Learned from visitors";

/** Today's lists in the feed shape: curated sections, then passing recipes (trusted = checked, candidates = new). */
export function curatedFeed(recipes: { popular: RecipeLike[]; fresh: RecipeLike[]; counts?: Record<string, number> } = { popular: [], fresh: [] }): IdeasFeed {
  const sections: IdeaSection[] = IDEA_SECTIONS.map((title, order) => {
    const cards = byCount(CURATED_IDEAS.filter((d) => d.section === title).map(fromIdea));
    return { id: slugifyTitle(title), title, order, total: cards.length, cards };
  });
  const learned = byCount([
    ...recipes.popular.map((r) => fromRecipe(r, "checked", LEARNED_SECTION, recipes.counts?.[r.prompt] ?? 0)),
    ...recipes.fresh.map((r) => fromRecipe(r, "new", LEARNED_SECTION, recipes.counts?.[r.prompt] ?? 0)),
  ]);
  sections.push({ id: "learned", title: LEARNED_SECTION, order: sections.length, total: learned.length, cards: learned });
  return { at: "", live: false, countsLive: false, hero: null, sections: dedupe(sections) };
}

/**
 * Every searchable card, one per build type like the page: the page's cards, every other All ideas type, then ideas of a
 * type no card has yet. A near-variant of a type already carded never shows beside it ("bookshelf" found Bookcase and
 * the corner shelf's "Too small for books" variant).
 */
export function searchPool(feed: IdeasFeed): IdeaCard[] {
  const onPage = feed.sections.flatMap((s) => s.cards);
  const types = new Set(onPage.map((c) => c.buildType));
  const cards = [...onPage, ...(feed.all ?? []).filter((c) => !types.has(c.buildType))];
  const have = new Set(cards.flatMap((c) => [c.slug, c.buildType]));
  return [...cards, ...IDEAS.map(fromIdea).filter((c) => !have.has(c.slug) && !have.has(c.buildType) && !!have.add(c.buildType))];
}

/**
 * Words visitors type that no card says (Growth's Ideas review, 10-25): each maps to words the cards or plans do say.
 * The one alias table; scripts/ideas-quickwins.test.ts fails when an entry is no longer needed or points at nothing.
 * "kid" lists the stocks and builds made for kids' rooms and crafts; it never claims a build is kid-safe.
 */
export const SEARCH_ALIASES: Record<string, string[]> = {
  bookshelf: ["bookcase"],
  kid: ["toy", "popsicle", "craft", "straw", "bunk"],
  beginner: ["smallbuild"],
  cheap: ["smallbuild"],
};
/** A small build, from the baked model: at most 12 cut parts and nothing over 24 inches. The "beginner"/"cheap" rule. */
// ponytail: parts and size stand in for cost; when cards carry the engine's price, "cheap" reads that instead.
export const SMALL_BUILD = { parts: 12, inches: 24 };
const SMALL_TAG = "smallbuild";
export function isSmallBuild(c: Pick<IdeaCard, "drawing">): boolean {
  const d = c.drawing;
  return !!d?.dims && d.parts <= SMALL_BUILD.parts && Math.max(d.dims.width, d.dims.height, d.dims.depth) <= SMALL_BUILD.inches;
}

/** The query, plus each way of reading it through SEARCH_ALIASES (plurals folded: "kids" reads as "kid"). */
export function queryVariants(query: string): string[] {
  let out = [""];
  for (const t of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const alias = SEARCH_ALIASES[t] ?? SEARCH_ALIASES[t.replace(/ves$/, "f")] ?? SEARCH_ALIASES[t.replace(/s$/, "")] ?? [];
    out = out.flatMap((v) => [t, ...alias].map((w) => `${v} ${w}`)).slice(0, 32);
  }
  return out.map((v) => v.trim()).filter(Boolean);
}
const bestScore = (idea: Parameters<typeof ideaSearchScore>[0], variants: string[]) => Math.max(-1, ...variants.map((v) => ideaSearchScore(idea, v)));

export function searchCards(pool: IdeaCard[], query: string): IdeaCard[] {
  const vs = queryVariants(query.replace(/-/g, " "));
  if (!vs.length) return [];
  return pool
    .map((c, index) => ({ c, index, score: bestScore({ label: c.title, size: [c.size, c.typedSize].filter(Boolean).join(" "), blurb: [c.blurb ?? "", c.aka ?? "", (c.aliases ?? []).join(" ").replace(/-/g, " "), c.buildType.replace(/-/g, " "), isSmallBuild(c) ? SMALL_TAG : ""].join(" "), section: c.section, stock: c.stock, prompt: c.examplePrompt }, vs) }))
    .filter((h) => h.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((h) => h.c);
}

/** Free plan pages (/plans/<slug>) the query finds whose build no card in the pool already is (every word of the plan's
 * build in a card's prompt): search reaches the toy chest, and the Bookcase card is not linked twice. */
export function searchPlans(query: string, pool: IdeaCard[], plans: PlanPage[] = PLANS): PlanPage[] {
  const vs = queryVariants(query);
  const cards = pool.map((c) => new Set(ideaTokens(`${c.buildType.replace(/-/g, " ")} ${c.examplePrompt}`)));
  const carded = (p: PlanPage) => cards.some((have) => ideaTokens(p.prompt).every((t) => have.has(t)));
  return plans.filter((p) => !carded(p) && bestScore({ label: p.name, size: "", blurb: p.blurb, section: "", prompt: p.prompt }, vs) >= 0);
}

/** A build's own URL: the workbench with the prompt (and the page's test flags), so a card is a real link. */
export function buildHref(prompt: string, flags: TestFlags = {}): string {
  return `/workspace?${new URLSearchParams({ q: prompt.trim(), ...Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, String(v)])) })}`;
}

