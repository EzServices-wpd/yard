import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { IdeaCard } from "./IdeaCard";
import { IdeaHero } from "./IdeaHero";
import { SECTION_SHOW, buildHref, curatedFeed, heroCard, searchCards, searchPlans, searchPool, showAllLabel, type IdeaCard as Card, type IdeaSection, type IdeasFeed } from "@/lib/ideas/feed";
import type { TestFlags } from "@/lib/ideas/testFlags";
import RECIPE_CARDS from "@/lib/ideas/recipes.json";
import type { LearnedIdea } from "@/lib/yard/ideaLibrary";

/** Live 3D in the hero (VITE_IDEAS_HERO_3D=0 keeps the drawing only). */
const HERO_LIVE = (import.meta.env?.VITE_IDEAS_HERO_3D ?? "1") !== "0";

let feedMemo: IdeasFeed | null = null;
/** Today's lists through the feed adapter; SWE's live feed replaces this call. */
export function ideasFeed(): IdeasFeed {
  return (feedMemo ??= curatedFeed(RECIPE_CARDS));
}

/**
 * Ideas: the search box is the prompt bar (typing filters; Enter opens the top match; "Build ‘…’ instead"
 * is always there), then one section per kind of build, 8 cards each with "Show all". On a phone each
 * section is one swipeable row, so the page is about 3 screens instead of 13.
 */
type Build = (q: string, from?: HTMLElement | null) => void;
/** `flags`: the page URL's test flags, so every card's href carries them (same on the server and in the tab). */
export function IdeasPageView({ incoming, learned, onBuild, onIntent, feed = ideasFeed(), flags = {} }: { incoming: string; learned: LearnedIdea[]; onBuild: Build; onIntent?: (q: string) => void; feed?: IdeasFeed; flags?: TestFlags }) {
  const [query, setQuery] = useState(incoming);
  useEffect(() => setQuery(incoming), [incoming]);
  const q = query.trim();
  const pool = useMemo(() => searchPool(feed), [feed]);
  const hits = useMemo(() => searchCards(pool, q).slice(0, 24), [pool, q]);
  const plans = useMemo(() => (q ? searchPlans(q, pool) : []), [q, pool]);
  const flagQuery = new URLSearchParams(Object.entries(flags).map(([k, v]) => [k, String(v)])).toString();
  const hero = useMemo(() => heroCard(feed), [feed]);
  const root = useRef<HTMLElement>(null);
  // Drawings start in pencil only once JS can ink them (no-JS and SSR show wood).
  useEffect(() => root.current?.classList.add("ideas-live"), []);
  const kept: Card[] = learned.map((d) => ({
    slug: `kept-${d.id}`, buildType: `kept-${d.id}`, title: d.label, count: 0, lastSeen: null, examplePrompt: d.prompt,
    // A kept plan's size was typed, not solved, so it prints none (the size rule); search still reads it.
    recipeKey: null, dims: null, size: "", sizeAria: "", typedSize: d.size, status: "checked", blurb: d.blurb, stock: "From a printed plan", section: "From your plans", drawing: null,
  }));
  const sections: IdeaSection[] = kept.length ? [{ id: "kept", title: "From your plans", order: -1, total: kept.length, cards: kept }, ...feed.sections] : feed.sections;

  return (
    <main ref={root} className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">Ideas</h1>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-ink">Pick a start, or type your own. Every idea opens as a 3D model with a cut list.</p>
      <form
        className="mt-5 max-w-xl"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q) return;
          onBuild(hits[0]?.examplePrompt ?? q);
        }}
      >
        <label className="block">
          <span className="sr-only">Search ideas, or describe what to build</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="bookshelf, closet, birdhouse…"
            autoComplete="off"
            enterKeyHint="go"
            data-ideas-search
            className="h-12 w-full rounded-full border border-transparent bg-[var(--yard-fill)] px-5 text-base text-ink outline-none ring-ink/20 placeholder:text-ink-muted transition-[box-shadow] duration-150 focus:ring-2"
          />
        </label>
      </form>

      {q ? (
        <section className="mt-4" aria-live="polite" data-ideas-results>
          <p className="text-sm text-ink">{hits.length === 0 ? "No saved idea yet." : hits.length === 1 ? "1 idea. Enter opens it." : `${hits.length} ideas. Enter opens the first.`}</p>
          <button
            type="button"
            onClick={() => onBuild(q)}
            data-ideas-build-instead
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-transparent bg-[var(--yard-fill)] px-4 text-sm text-ink hover:bg-rule/60 lg:min-h-9"
          >
            <span className="truncate">Build “{q}” instead</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </button>
          {plans.length > 0 ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-1 text-sm text-ink" data-ideas-plans>
              <span>Free plans:</span>
              {plans.map((p) => <a key={p.slug} href={`/plans/${p.slug}${flagQuery ? `?${flagQuery}` : ""}`} className="inline-flex min-h-11 items-center px-1.5 underline underline-offset-2 lg:min-h-9">{p.name}</a>)}
            </p>
          ) : null}
          {hits.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {hits.map((c, i) => <IdeaCard key={c.slug} card={c} href={buildHref(c.examplePrompt, flags)} eager={i < 4} onOpen={(el) => onBuild(c.examplePrompt, el)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} showCount={feed.countsLive} />)}
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {hero ? <IdeaHero card={hero} live={HERO_LIVE} href={buildHref(hero.examplePrompt, flags)} onBuild={() => onBuild(hero.examplePrompt)} /> : null}
          {sections.map((s) => <Section key={s.id} section={s} first={false} onBuild={onBuild} onIntent={onIntent} showCount={feed.countsLive} flags={flags} />)}
        </>
      )}
    </main>
  );
}

function Section({ section, first, onBuild, onIntent, showCount, flags }: { section: IdeaSection; first: boolean; onBuild: Build; onIntent?: (q: string) => void; showCount: boolean; flags: TestFlags }) {
  const [all, setAll] = useState(false);
  const cards = all ? section.cards : section.cards.slice(0, SECTION_SHOW);
  const more = section.cards.length - SECTION_SHOW;
  // ponytail: Popular can have more cards than the feed sends (SECTION_MAX); the label says so instead of paging the rest.
  const capped = section.total > section.cards.length;
  const list = `ideas-${section.id}-list`;
  const label = showAllLabel(section);
  return (
    <section className="mt-8 sm:mt-12" data-ideas-section={section.id} aria-labelledby={`ideas-${section.id}`}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={`ideas-${section.id}`} className="font-display text-xl text-ink">{section.title}</h2>
        {more > 0 ? (
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} aria-controls={list} data-ideas-show-all={label} className="relative inline-flex min-h-11 shrink-0 items-center px-2 text-sm text-ink hover:underline lg:min-h-9">
            {all ? "Show fewer" : label}
            <span className="sr-only"> {section.title} ideas</span>
          </button>
        ) : null}
      </div>
      {/* relative: the cards' sr-only size text is absolutely positioned, so without a positioned row it escapes the row's
          scroll clip and widens the page (768: 1783px wide). */}
      <ul
        id={list}
        className={
          all
            ? "mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4"
            : "relative -mx-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0"
        }
      >
        {cards.map((c, i) => (
          <li key={c.slug} className={all ? "" : "w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto"}>
            <IdeaCard card={c} href={buildHref(c.examplePrompt, flags)} eager={first && i < 4} onOpen={(el) => onBuild(c.examplePrompt, el)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} showCount={showCount} />
          </li>
        ))}
      </ul>
      {all && capped ? <p className="mt-2 text-sm text-ink" data-ideas-top>The top {section.cards.length} of {section.total} are shown.</p> : null}
    </section>
  );
}
