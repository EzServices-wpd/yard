/**
 * Ideas feed: the shape the page renders (PR-PLAN.md (a)). Until SWE's live feed lands, `curatedFeed()`
 * adapts today's curated lists and passing recipes into it; the live feed drops in as another IdeasFeed.
 * Pure: no engine import (the drawings are baked by scripts/gen-idea-drawings.ts).
 */
import { CURATED_IDEAS, IDEAS, IDEA_SECTIONS, type Idea } from "@/lib/yard/ideas";
import { ideaSearchScore, ideaStem } from "@/lib/yard/ideaLibrary";
import DRAWINGS from "./drawings.json";

export type DrawingRef = { src: string; model?: string; w: number; h: number; parts: number; v: string };
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
  /** Display size as today's cards print it (format waits on decisions.md #2). */
  size: string;
  status: "checked" | "new";
  blurb?: string;
  stock?: string;
  section: string;
  drawing: DrawingRef | null;
};
export type IdeaSection = { id: string; title: string; order: number; total: number; cards: IdeaCard[] };
export type IdeaHero = { slug: string; examplePrompt: string; title: string; count: number };
export type IdeasFeed = { at: string; live: boolean; countsLive: boolean; hero: IdeaHero | null; sections: IdeaSection[] };

/** Cards a section shows before "Show all". */
export const SECTION_SHOW = 8;

type Manifest = Record<string, { v: string; w: number; h: number; parts: number; model?: string }>;
export function drawingFor(slug: string, manifest: Manifest = DRAWINGS as Manifest): DrawingRef | null {
  const m = manifest[slug];
  if (!m) return null;
  const base = `/ideas/drawings/${slug}.${m.v}`;
  return { src: `${base}.svg`, ...(m.model ? { model: m.model } : {}), w: m.w, h: m.h, parts: m.parts, v: m.v };
}

/** One build type per card: the prompt stem without sizes or filler ("bookshelf 36x12x72" → "bookshelf"). */
export function buildTypeOf(prompt: string): string {
  return ideaStem(prompt) || prompt.trim().toLowerCase();
}

export type RecipeLike = { id: string; label: string; prompt: string; size: string; blurb: string; box?: { width: number; height: number; depth: number } };

/** Card titles in Yard's voice where the curated label is a brand (the prompt keeps the unit it names). */
export const TITLE_FIX: Record<string, string> = { window: "Double-hung window" };

function fromIdea(d: Idea): IdeaCard {
  return {
    slug: d.id, buildType: buildTypeOf(d.prompt), title: TITLE_FIX[d.id] ?? d.label, count: 0, lastSeen: null, examplePrompt: d.prompt,
    recipeKey: null, dims: null, size: d.size, status: "checked", blurb: d.blurb, stock: d.stock, section: d.section, drawing: drawingFor(d.id),
  };
}
function fromRecipe(r: RecipeLike, status: IdeaCard["status"], section: string, count = 0): IdeaCard {
  return {
    slug: r.id, buildType: buildTypeOf(r.prompt), title: r.label, count, lastSeen: null, examplePrompt: r.prompt,
    recipeKey: r.id.replace(/^recipe-/, ""), dims: r.box ?? null, size: r.size, status, blurb: r.blurb, section, drawing: drawingFor(r.id),
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
    return { id: slugify(title), title, order, total: cards.length, cards };
  });
  const learned = byCount([
    ...recipes.popular.map((r) => fromRecipe(r, "checked", LEARNED_SECTION, recipes.counts?.[r.prompt] ?? 0)),
    ...recipes.fresh.map((r) => fromRecipe(r, "new", LEARNED_SECTION, recipes.counts?.[r.prompt] ?? 0)),
  ]);
  sections.push({ id: "learned", title: LEARNED_SECTION, order: sections.length, total: learned.length, cards: learned });
  return { at: "", live: false, countsLive: false, hero: null, sections: dedupe(sections) };
}

/** Every searchable card: the page's cards plus near-variants (search still reaches every idea). */
export function searchPool(feed: IdeasFeed): IdeaCard[] {
  const onPage = feed.sections.flatMap((s) => s.cards);
  const have = new Set(onPage.map((c) => c.slug));
  return [...onPage, ...IDEAS.filter((d) => !have.has(d.id)).map(fromIdea)];
}

export function searchCards(pool: IdeaCard[], query: string): IdeaCard[] {
  const q = query.trim();
  if (!q) return [];
  return pool
    .map((c, index) => ({ c, index, score: ideaSearchScore({ label: c.title, size: c.size, blurb: c.blurb ?? "", section: c.section, stock: c.stock, prompt: c.examplePrompt }, q) }))
    .filter((h) => h.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((h) => h.c);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
