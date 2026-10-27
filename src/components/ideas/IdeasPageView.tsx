import { type Ref, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { IdeaCard, IdeaRow } from "./IdeaCard";
import { ALL_SHOW, buildHref, curatedFeed, searchCards, searchPlans, searchPool, type IdeaCard as Card, type IdeasFeed } from "@/lib/ideas/feed";
import { FEATURED, groupCards, groupView, stockOf, withStock, type Group as G } from "@/lib/ideas/groups";
import type { TestFlags } from "@/lib/ideas/testFlags";
import RECIPE_CARDS from "@/lib/ideas/recipes.json";
import type { LearnedIdea } from "@/lib/yard/ideaLibrary";

let feedMemo: IdeasFeed | null = null;
/** Today's lists through the feed adapter; SWE's live feed replaces this call. */
export function ideasFeed(): IdeasFeed {
  return (feedMemo ??= curatedFeed(RECIPE_CARDS));
}

/**
 * Ideas (12a, Ezra via Chief 10-26: an exploration, not a flat list): the search box is the prompt bar (typing filters;
 * Enter opens the top match; "Build ‘…’ instead" is always there), stock chips, five featured builds, then one section
 * per kind of build (groups.ts) with "See all" in place. On a phone each row swipes. No price and no 3D file here.
 */
type Build = (q: string, from?: HTMLElement | null) => void;
const CHIP = "inline-flex min-h-11 items-center rounded-full px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/60 lg:min-h-9";
const chipTone = (on: boolean) => (on ? "bg-ink text-paper" : "bg-[var(--yard-fill)] text-ink hover:bg-rule/60");
// relative: a card's sr-only size text is absolutely positioned; without a positioned row it escapes the row's scroll clip
// and widens the page (768: 1783px wide).
const ROW = "relative -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0";
/** `flags`: the page URL's test flags, so every card's href carries them (same on the server and in the tab). */
export function IdeasPageView({ incoming, learned, onBuild, onIntent, feed = ideasFeed(), flags = {} }: { incoming: string; learned: LearnedIdea[]; onBuild: Build; onIntent?: (q: string) => void; feed?: IdeasFeed; flags?: TestFlags }) {
  const [query, setQuery] = useState(incoming);
  useEffect(() => setQuery(incoming), [incoming]);
  const q = query.trim();
  const pool = useMemo(() => searchPool(feed), [feed]);
  const hits = useMemo(() => searchCards(pool, q).slice(0, 24), [pool, q]);
  const plans = useMemo(() => (q ? searchPlans(q, pool) : []), [q, pool]);
  // Drawn hits show first as cards, then hits with no drawing as rows; Enter opens the first one shown.
  const drawn = hits.filter((c) => c.drawing), text = hits.filter((c) => !c.drawing);
  const flagQuery = new URLSearchParams(Object.entries(flags).map(([k, v]) => [k, String(v)])).toString();
  const root = useRef<HTMLElement>(null);
  // Drawings start in pencil only once JS can ink them (no-JS and SSR show wood).
  useEffect(() => root.current?.classList.add("ideas-live"), []);
  const kept: Card[] = learned.map((d) => ({
    slug: `kept-${d.id}`, buildType: `kept-${d.id}`, title: d.label, count: 0, lastSeen: null, examplePrompt: d.prompt,
    // A kept plan's size was typed, not solved, so it prints none (the size rule); search still reads it.
    recipeKey: null, dims: null, size: "", sizeAria: "", typedSize: d.size, status: "checked", blurb: d.blurb, stock: "From a printed plan", section: "From your plans", drawing: null,
  }));
  // Browse: every listed type once (the live feed's catalog, else the fallback's sections), narrowed by the stock chip.
  const browse = useMemo(() => feed.all ?? feed.sections.flatMap((s) => s.cards), [feed]);
  const stocks = useMemo(() => [...new Set(browse.map(stockOf).filter((s): s is string => !!s))], [browse]);
  const [stock, setStock] = useState<string | null>(null);
  const shown = withStock(browse, stock);
  const featured = FEATURED.map((t) => shown.find((c) => c.buildType === t && c.status === "checked" && c.drawing)).filter((c): c is Card => !!c);
  const fitted = useMemo(() => ({ label: "Fitted to a hole", types: new Set(feed.sections.find((s) => s.id === "fitted-to-a-hole")?.cards.map((c) => c.buildType)) }), [feed]);
  const groups: G[] = [...(kept.length && !stock ? [{ id: "kept", title: "From your plans", line: "", cards: kept }] : []), ...groupCards(shown)];

  return (
    <main ref={root} className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
      <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">Pick a build. See how it goes together.</h1>
      <p className="mt-2 max-w-xl text-base leading-relaxed text-ink">Browse by kind of build, or type your own. Every idea opens as a 3D model with a cut list.</p>
      <form
        className="mt-5 max-w-xl"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q) return;
          onBuild((drawn[0] ?? text[0])?.examplePrompt ?? q);
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
          {/* Only a plan found: the plan link below is the result, so no "nothing found" line above it. */}
          {hits.length === 0 && plans.length > 0 ? null : (
            <p className="text-sm text-ink">{hits.length === 0 ? "No saved idea yet." : hits.length === 1 ? "1 idea. Enter opens it." : `${hits.length} ideas. Enter opens the first.`}</p>
          )}
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
          {drawn.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {drawn.map((c, i) => <IdeaCard key={c.slug} card={c} href={buildHref(c.examplePrompt, flags)} eager={i < 4} onOpen={(el) => onBuild(c.examplePrompt, el)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} showCount={feed.countsLive} />)}
            </div>
          ) : null}
          {/* Hits with no drawing yet are rows (title and size), never a blank picture. */}
          {text.length > 0 ? <Rows cards={text} onBuild={onBuild} onIntent={onIntent} flags={flags} /> : null}
        </section>
      ) : (
        <>
          {stocks.length > 0 ? (
            // One row that swipes below lg: its height never depends on how the chip words wrap once the font loads (CLS).
            <div role="group" aria-label="Show builds by stock" className="relative -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0" data-ideas-stocks>
              {[null, ...stocks].map((s) => (
                <button key={s ?? "all"} type="button" aria-pressed={stock === s} onClick={() => setStock(s)} data-ideas-stock={s ?? "all"} className={`${CHIP} shrink-0 ${chipTone(stock === s)}`}>
                  {s ?? "All stock"}
                </button>
              ))}
            </div>
          ) : null}
          {featured.length > 0 ? (
            <section className="mt-8 sm:mt-10" data-ideas-featured aria-labelledby="ideas-featured">
              <h2 id="ideas-featured" className="font-display text-xl text-ink">Featured</h2>
              <ul className={ROW}>
                {featured.map((c, i) => (
                  <li key={c.slug} className={`shrink-0 snap-start lg:w-auto ${i === 0 ? "w-[72%] sm:w-[46%] lg:col-span-2 lg:row-span-2" : "w-[44%] sm:w-[30%]"}`}>
                    <IdeaCard card={c} href={buildHref(c.examplePrompt, flags)} eager={i === 0} onOpen={(el) => onBuild(c.examplePrompt, el)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} showCount={feed.countsLive} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {groups.map((g) => <Group key={g.id} group={g} sub={g.id === "furniture" && fitted.types.size ? fitted : undefined} onBuild={onBuild} onIntent={onIntent} showCount={feed.countsLive} flags={flags} />)}
        </>
      )}
    </main>
  );
}

type RowsProps = { cards: Card[]; onBuild: Build; onIntent?: (q: string) => void; flags: TestFlags };
function Rows({ cards, onBuild, onIntent, flags, id, listRef }: RowsProps & { id?: string; listRef?: Ref<HTMLUListElement> }) {
  return (
    <ul id={id} ref={listRef} className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <li key={c.slug}>
          <IdeaRow card={c} href={buildHref(c.examplePrompt, flags)} onOpen={() => onBuild(c.examplePrompt)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One kind of build: up to SECTION_SHOW drawn cards, then "See all N" opens the rest in place as rows (the old All ideas
 * list, now per group), ALL_SHOW at a time; "Show more" moves focus to the first new row. Nothing animates. `sub` is a
 * chip inside the group (Furniture: Fitted to a hole). An offscreen group skips layout (content-visibility).
 * groupView (groups.ts) decides what shows; this only renders it.
 */
function Group({ group, sub, showCount, ...rest }: { group: G; sub?: { label: string; types: Set<string> }; showCount: boolean } & Omit<RowsProps, "cards">) {
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState(false);
  const [n, setN] = useState(ALL_SHOW);
  const list = useRef<HTMLUListElement>(null);
  const from = useRef(-1);
  useEffect(() => {
    if (from.current >= 0) list.current?.querySelectorAll("a")[from.current]?.focus();
    from.current = -1;
  }, [n]);
  const cards = sub && only ? group.cards.filter((c) => sub.types.has(c.buildType)) : group.cards;
  // A group with no drawn card shows its rows at once: never an empty grid, never a blank picture.
  const v = groupView(cards, open, n);
  const id = `ideas-${group.id}`;
  const { onBuild, onIntent, flags } = rest;
  return (
    <section className="mt-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:mt-14" data-ideas-group={group.id} aria-labelledby={id}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={id} className="font-display text-xl text-ink">{group.title}</h2>
        {v.button ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={`${id}-all`} data-ideas-show-all={v.label} className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm text-ink hover:underline lg:min-h-9">
            {open ? "Show fewer" : v.label}
            <span className="sr-only"> {group.title}</span>
          </button>
        ) : null}
      </div>
      {group.line ? <p className="max-w-xl text-sm text-ink">{group.line}</p> : null}
      {sub ? (
        <div className="mt-2 flex">
          <button type="button" aria-pressed={only} onClick={() => setOnly((v) => !v)} data-ideas-sub={sub.label} className={`${CHIP} ${chipTone(only)}`}>{sub.label}</button>
        </div>
      ) : null}
      {v.top.length > 0 ? (
        <ul className={ROW}>
          {v.top.map((c) => (
            <li key={c.slug} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
              <IdeaCard card={c} href={buildHref(c.examplePrompt, flags)} onOpen={(el) => onBuild(c.examplePrompt, el)} onIntent={onIntent && (() => onIntent(c.examplePrompt))} showCount={showCount} />
            </li>
          ))}
        </ul>
      ) : null}
      {/* Always in the markup, so the See all button's aria-controls names a real element; empty while shut. */}
      <div id={`${id}-all`} data-ideas-all={group.id}>
        {v.rows.length > 0 ? (
          <>
            <Rows cards={v.rows} id={`${id}-rows`} listRef={list} onBuild={onBuild} onIntent={onIntent} flags={flags} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4">
              <p className="text-sm text-ink" aria-live="polite" data-ideas-all-count>{`${v.shown} of ${cards.length} shown`}</p>
              {v.left > 0 ? (
                <button type="button" aria-controls={`${id}-rows`} data-ideas-all-more onClick={() => { from.current = n; setN(n + ALL_SHOW); }} className="inline-flex min-h-11 items-center rounded-full bg-[var(--yard-fill)] px-4 text-sm text-ink hover:bg-rule/60 lg:min-h-9">
                  {`Show ${Math.min(ALL_SHOW, v.left)} more`}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
