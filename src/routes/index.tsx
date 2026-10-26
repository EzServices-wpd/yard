import { Fragment, memo } from "react";
import { currentTestFlags, pickTestFlags, type TestFlags } from "@/lib/ideas/testFlags";
import { MakingNow } from "@/components/ideas/MakingNow";
import { useOffscreen } from "@/hooks/use-offscreen";
import { leavesIn, swing } from "@/components/home/showcase-doors";
import { drawerSpecs, drawersIn, setOpen, slide, type DrawerSpec } from "@/components/home/showcase-drawers";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { canonical } from "@/lib/canonical";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NAV_LINK, ScrollSentinel, SiteFooter, useScrolled } from "@/components/site/chrome";
import { drawingSize, formatSize, inch, inchWords } from "@/lib/ideas/size";
import { DREAMS } from "@/lib/yard/promptDreams";
import type { promptWithHomeStock as PromptWithHomeStock } from "@/lib/yard/promptHelpers";
import { affiliateDisclosure } from "@/lib/yard/outbound";
import { PLANS, TAGLINE } from "@/lib/yard/plans";
import type { Showcase } from "@/lib/yard/homeShowcase";

const SHOWCASE_CAPTION = "Live Yard output, not a photo.";

export const Route = createFileRoute("/")({
  head: () => canonical("/"),
  // F28: the "Made on Yard" cards come from the engine; build them once per server instance, not in the visitor's tab.
  // C2: the plan strip (one real plan: the linen canary) and the chips' baked drawings come from the server too.
  loader: async () => ({ shows: await homeShows(), plan: await homePlan(), chipArt: await homeChipArt() }),
  validateSearch: (s: Record<string, unknown>): { q?: string } & TestFlags => ({
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.slice(0, 200) } : {}),
    ...pickTestFlags(s),
  }),
  component: LandingPage,
});

/** C2: at most 6 example chips, each with its small baked Ideas drawing (public/ideas/drawings). */
const CHIP_IDS = ["corner", "slope", "pocket", "desk", "eiffel", "arch"] as const;
const CHIPS = DREAMS.filter((d) => (CHIP_IDS as readonly string[]).includes(d.id)).slice(0, 6);
const HOUSE = CHIPS.filter((d) => d.group === "house");
const WEEKEND = CHIPS.filter((d) => d.group === "weekend");

/** One class row for every build: sheet, board, round, pipe. A chip names the class, not a brand. */
const STOCKS = [
  { id: "sheet", label: "¾″ plywood", say: "¾″ plywood", append: "from 3/4 plywood" },
  { id: "board", label: "2×4 lumber", say: "2×4 lumber", append: "from 2x4" },
  { id: "round", label: "½″ dowel", say: "½″ dowel", append: "from 1/2 inch dowel" },
  { id: "pipe", label: "PVC pipe", say: "PVC pipe", append: "from 3/4 inch PVC" },
] as const;

type StockId = (typeof STOCKS)[number]["id"];

/** C2 (5A): one real plan in the strip: the linen canary (31 1/2 × 16 × 78 in, 11 cut pieces, Buy list $193.68). */
const PLAN_PROMPT = "linen closet 31.5 wide 78 tall 16 deep";

/** Finished pieces. Each card opens that plan on the bench. The size is never typed here: the loader formats it from the engine. */
const PIECES = [
  {
    id: "pocket",
    label: "Pocket vanity",
    note: "trapezoid fit",
    prompt: DREAMS.find((d) => d.id === "pocket")?.prompt ?? "pocket vanity",
    caption: "Knee space, drawers, and uppers shaped to the pocket",
  },
  {
    // C3: the linen closet already leads the plan strip ($193.68), so this card shows a different idea; one linen price on home.
    id: "ldesk",
    label: DREAMS.find((d) => d.id === "ldesk")?.label ?? "L in the corner",
    note: "",
    prompt: DREAMS.find((d) => d.id === "ldesk")?.prompt ?? "L-shaped corner desk 60 by 48 30 tall",
    caption: DREAMS.find((d) => d.id === "ldesk")?.blurb ?? "Two walls, one desk, the sizes you typed.",
  },
  {
    id: "desk",
    label: "60″ desk",
    note: "24″ knee",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    caption: "Drawers plus roomy knee space",
  },
] as const;

/** A sample card's model plus its size, formatted from the engine's solved dims: the drawing's own labels, else the model's box. */
type HomeShow = Showcase & { size: string; sizeAria: string; drawers: DrawerSpec[] };
let showsMemo: Promise<Record<string, HomeShow>> | undefined;
function homeShows(): Promise<Record<string, HomeShow>> {
  // Drawers: the same model's drawer groups (part ids match the drawing's <g data-part>), so the card can slide them.
  showsMemo ??= Promise.all([import("@/lib/yard/homeShowcase"), import("@/lib/yard/prompt")]).then(([{ showcaseFor }, { generateFromPrompt }]) =>
    Object.fromEntries(
      PIECES.map((piece) => {
        const show = showcaseFor(piece.prompt);
        const f = drawingSize(show.svg, show.overall);
        return [piece.id, { ...show, size: f.text, sizeAria: f.aria, drawers: drawerSpecs(generateFromPrompt(piece.prompt).panels) }];
      }),
    ),
  );
  return showsMemo;
}

/** The plan strip's numbers, straight from the engine's plan (cut list, Buy list, totals). No store links: those live on Buy lists only. */
type HomePlan = {
  size: string;
  sizeAria: string;
  pieces: number;
  usd: string;
  cuts: { label: string; name: string; qty: number; size: string; aria: string }[];
  buy: { name: string; qty: number; unit: string; usd: string }[];
};
let planMemo: Promise<HomePlan> | undefined;
function homePlan(): Promise<HomePlan> {
  planMemo ??= Promise.all([import("@/lib/yard/prompt"), import("@/lib/yard/report")]).then(([{ generateFromPrompt }, { buildPlan }]) => {
    const project = generateFromPrompt(PLAN_PROMPT);
    const plan = buildPlan(project);
    const f = formatSize(project.overall);
    const usd = (n: number) => n.toFixed(2);
    return {
      size: f.text,
      sizeAria: f.aria,
      pieces: plan.totals.pieces,
      usd: usd(plan.totals.estCostUsd),
      cuts: plan.cutList.map((c) => ({
        label: c.label ?? "",
        name: c.name,
        qty: c.quantity,
        size: `${inch(c.lengthIn)} × ${inch(c.widthIn)} × ${inch(c.thicknessIn)} in`,
        aria: `${inchWords(c.lengthIn)} by ${inchWords(c.widthIn)} by ${inchWords(c.thicknessIn)} inches`,
      })),
      buy: plan.bom.map((b) => ({ name: b.name, qty: b.quantity, unit: b.unit, usd: usd(b.estimatedCost ?? 0) })),
    };
  });
  return planMemo;
}

/** Each chip's small drawing: the baked Ideas drawing for the same idea (versioned file, cached forever). */
async function homeChipArt(): Promise<Record<string, string>> {
  const m = (await import("@/lib/ideas/drawings.json")).default as Record<string, { v: string }>;
  return Object.fromEntries([...CHIP_IDS, "linen"].filter((id) => m[id]).map((id) => [id, `/ideas/drawings/${id}.${m[id].v}.svg`]));
}

/** 6B: chips are 44px tall on a phone, 36px on a desktop. 4B (row 57): a fill, not an outline (only sample cards are outlined). */
const CHIP =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-[var(--yard-fill)] pl-1 pr-3.5 text-sm text-ink transition-colors duration-150 hover:bg-rule/60 lg:min-h-9";

/** The chip's drawing: fixed box (CLS 0), lazy, decorative (the label names it). */
function ChipArt({ src }: { src?: string }) {
  return src ? (
    <span className="size-9 shrink-0 overflow-hidden rounded-full bg-paper lg:size-7" aria-hidden>
      {/* The model sits small in its 4:3 sheet: zoom in (transform only, no layout). */}
      <img src={src} alt="" width={36} height={36} loading="lazy" decoding="async" className="h-full w-full scale-[1.7] object-cover" />
    </span>
  ) : (
    <span className="size-9 shrink-0 rounded-full bg-paper lg:size-7" aria-hidden />
  );
}

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const y = new URLSearchParams(window.location.search).get("y");
    if (y) void navigate({ to: "/workspace", search: { y, ...currentTestFlags() } });
  }, [navigate]);
  const search = Route.useSearch();
  const [prompt, setPrompt] = useState(search.q ?? "");
  const [stockId, setStockId] = useState<StockId | null>(null);
  // F28: the showcases are built in the loader (server-rendered on first load), never on the main thread at startup.
  const { shows, plan, chipArt } = Route.useLoaderData() as { shows: Record<string, HomeShow | undefined>; plan?: HomePlan; chipArt?: Record<string, string> };
  const [sentinel, scrolled] = useScrolled();

  const stock = STOCKS.find((s) => s.id === stockId) ?? null;
  const disclosure = affiliateDisclosure();
  // The engine's stock merge loads after first paint, so the home page never waits on the engine bundle.
  const [mergeStock, setMergeStock] = useState<typeof PromptWithHomeStock | null>(null);
  // F29: preload the stock merge when the browser is idle (and at the latest on first input), so a tap is never spent loading it.
  useEffect(() => {
    let done = false;
    const evs = ["pointerdown", "keydown"] as const;
    const load = () => {
      if (done) return;
      done = true;
      evs.forEach((e) => window.removeEventListener(e, load, true));
      void import("@/lib/yard/promptHelpers").then((m) => setMergeStock(() => m.promptWithHomeStock));
    };
    evs.forEach((e) => window.addEventListener(e, load, { capture: true, passive: true }));
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(load, { timeout: 4000 }) : setTimeout(load, 2000);
    return () => { evs.forEach((e) => window.removeEventListener(e, load, true)); if ("cancelIdleCallback" in window) window.cancelIdleCallback(id as number); else clearTimeout(id as number); };
  }, []);
  const promptWithHomeStock: typeof PromptWithHomeStock = (t, a) => (mergeStock ? mergeStock(t, a) : a ? `${t.trim()} ${a}`.replace(/\s+/g, " ").trim() : t.trim());

  function withStock(text: string) {
    return promptWithHomeStock(text, stock?.append);
  }

  function go(text: string) {
    const q = withStock(text);
    if (!q) return;
    void navigate({ to: "/workspace", search: { q, ...currentTestFlags() } });
  }

  /** Weekend chips and photo cards already name their stock, so they open as written. */
  function open(text: string) {
    const q = text.trim();
    if (!q) return;
    void navigate({ to: "/workspace", search: { q, ...currentTestFlags() } });
  }

  function pickStock(id: StockId) {
    setStockId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="yard-site relative min-h-screen bg-paper text-ink">
      <ScrollSentinel at={sentinel} />
      <header className="yard-head sticky top-0 z-40 bg-paper/90 backdrop-blur" data-scrolled={scrolled || undefined}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex min-h-11 items-center" aria-label="Yard home">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <Link to="/ideas" search={pickTestFlags(search)} className={`${NAV_LINK} text-ink-muted hover:text-ink`}>
              Ideas
            </Link>
            <Link to="/workspace" search={pickTestFlags(search)} className={`${NAV_LINK} text-ink-muted hover:text-ink`}>
              Workbench
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="yard-hero-in relative isolate mx-auto flex max-w-3xl overflow-x-clip flex-col items-center pt-12 text-center sm:pt-20 lg:pt-24">
          <svg className="yard-grain" viewBox="0 0 800 600" preserveAspectRatio="none" aria-hidden>
            <g fill="none" stroke="currentColor" strokeWidth="1.2">
              {Array.from({ length: 14 }, (_, i) => (
                <path key={i} d={`M-20 ${30 + i * 40} C 180 ${10 + i * 40 + (i % 3) * 14}, 380 ${60 + i * 40 - (i % 4) * 12}, 560 ${28 + i * 40} S 760 ${50 + i * 40}, 840 ${34 + i * 40}`} />
              ))}
            </g>
          </svg>
          <p className="text-base font-medium text-ink">The plan the lumber aisle should have printed</p>
          <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {/* Words rise in once; the full line stays in the accessible name and the layout never shifts. */}
            {[["Think", "it", "up."], ["Yard", "works", "it", "out."]].map((line, li) => (
              <span key={li} className="block">
                {line.map((w, wi) => (
                  <Fragment key={w + wi}>
                    {wi > 0 && " "}
                    <span className="yard-word" style={{ ["--i" as string]: li * 3 + wi }}>{w}</span>
                  </Fragment>
                ))}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink sm:text-lg">
            One model. Every cut, part and step.
          </p>
          <p className="mt-1 text-base italic text-ink">{TAGLINE}</p>

          <form
            className="mt-9 w-full max-w-2xl"
            data-yard-home-prompt="1"
            onSubmit={(e) => {
              e.preventDefault();
              go(prompt);
            }}
          >
            <label htmlFor="dream" className="sr-only">
              What do you want to build?
            </label>
            {/* 4B: no outline and no resting shadow; a lighter fill, and the shadow only while typing. */}
            <div className="flex flex-col gap-2 rounded-2xl bg-[var(--yard-fill)] p-2 transition-shadow duration-150 focus-within:shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-18px_rgba(18,16,14,0.3)] focus-within:ring-2 focus-within:ring-ink/20 sm:flex-row sm:items-center">
              <input
                id="dream"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="bookshelf 30 wide, 60 tall, five shelves"
                autoComplete="off"
                enterKeyHint="go"
                className="h-12 min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-muted"
              />
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Build this
                <ArrowRight className="size-4" />
              </button>
            </div>

            <fieldset className="mt-4" data-yard-home-material="1">
              <legend className="sr-only">Material</legend>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="mr-1 text-sm text-ink">Material</span>
                {STOCKS.map((s) => {
                  const on = stockId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickStock(s.id)}
                      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-colors duration-150 lg:min-h-9 ${
                        on
                          ? "border-ink bg-ink text-paper"
                          : "border-transparent bg-[var(--yard-fill)] text-ink hover:bg-rule/60"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-ink">
                {stock
                  ? prompt.trim() && promptWithHomeStock(prompt, stock.append) === prompt.trim().replace(/\s+/g, " ").trim()
                    ? "The material in the sentence wins."
                    : `Building from ${stock.say}.`
                  : "Leave it open and Yard picks a good fit."}
              </p>
            </fieldset>
          </form>
        </section>

        <section className="yard-hero-in yard-hero-in-2 mx-auto mt-12 grid max-w-3xl gap-8 text-center sm:grid-cols-2 sm:text-left">
          <div>
            <p className="text-base font-medium text-ink">For the house</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {HOUSE.map((d) => (
                <button key={d.id} type="button" onClick={() => go(d.prompt)} className={CHIP}>
                  <ChipArt src={chipArt?.[d.id]} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-base font-medium text-ink">For the weekend</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {WEEKEND.map((d) => (
                <button key={d.id} type="button" onClick={() => open(d.prompt)} className={CHIP}>
                  <ChipArt src={chipArt?.[d.id]} />
                  {d.label}
                </button>
              ))}
            </div>
            <Link
              to="/ideas"
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-ink transition-colors duration-150 hover:underline lg:min-h-9"
            >
              More ideas
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        {plan ? <PlanStrip plan={plan} art={chipArt?.linen} onOpen={() => open(PLAN_PROMPT)} /> : null}

        <section className="yard-hero-in yard-hero-in-3 mt-12 sm:mt-20">
          <h2 className="text-center font-display text-2xl text-ink sm:text-3xl">Made on Yard</h2>
          <p className="mt-2 text-center text-base text-ink">Drawn live by the Yard engine. Tap a piece to open its full plan.</p>
          <ShowcaseGrid>
            {PIECES.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => open(h.prompt)}
                className="yard-card group flex flex-col overflow-hidden rounded-xl border border-rule bg-white/50 text-left transition-colors duration-150 hover:border-ink/30"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-paper">
                  {shows[h.id] ? (
                    <ShowcaseArt
                      id={h.id}
                      label={`Yard drawing of the ${h.label}, ${shows[h.id]!.sizeAria}`}
                      svg={shows[h.id]!.svg}
                      drawers={shows[h.id]!.drawers.length ? JSON.stringify(shows[h.id]!.drawers) : undefined}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-ink">Drawing the model…</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center p-4">
                  <span className="font-display text-base text-ink group-hover:underline">{h.label}</span>
                  {shows[h.id]?.size ? (
                    <span className="mt-0.5 text-sm text-ink">
                      <span className="yard-measure" data-size={h.id} aria-hidden>{shows[h.id]!.size}</span>
                      <span className="sr-only">{shows[h.id]!.sizeAria}</span>
                      {h.note ? ` · ${h.note}` : null}
                    </span>
                  ) : null}
                  <span className="mt-1 text-sm leading-snug text-ink">{h.caption}</span>
                  {shows[h.id] ? (
                    <span className="yard-num mt-1 text-sm text-ink" data-yard-showcase-totals={h.id}>
                      {shows[h.id]!.pieces} cut pieces · Buy list ~${shows[h.id]!.buyUsd.toLocaleString("en-US")}
                    </span>
                  ) : null}
                  <span className="mt-1 text-[13px] italic leading-snug text-ink">{SHOWCASE_CAPTION}</span>
                </div>
              </button>
            ))}
          </ShowcaseGrid>
        </section>

        <nav aria-label="Free plans" className="mt-12 text-center text-sm text-ink">
          Free plans:{" "}
          {PLANS.map((p, i) => (
            <Fragment key={p.slug}>{i > 0 && " · "}<Link to="/plans/$slug" params={{ slug: p.slug }} className="underline-offset-2 hover:underline max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">{p.name}</Link></Fragment>
          ))}
        </nav>

        <MakingNow />

        {disclosure ? (
          <p className="mt-10 text-center text-[13px] text-ink-muted" data-yard-affiliate-disclosure="1">
            {disclosure}{" "}
            <Link to="/about" className="underline decoration-rule underline-offset-4 hover:text-ink">
              How shop links work
            </Link>
          </p>
        ) : null}
      </main>
      <SiteFooter active="home" />
    </div>
  );
}

/**
 * A card's engine drawing, memoized: a parent re-render (the idle stock-merge load ~1 s after hydration) must not
 * re-set its innerHTML, which swaps the SVG nodes the door swings animate and cancels a swing mid-way.
 */
const ShowcaseArt = memo(function ShowcaseArt({ id, label, svg, drawers }: { id: string; label: string; svg: string; drawers?: string }) {
  return <div role="img" aria-label={label} data-yard-showcase={id} data-yard-drawers={drawers} className="yard-alive h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
});

/** Home sample models turn in once when the grid first comes on screen (held paused until then). */
/** The drawer groups the loader put on a card (empty when it has none or the attribute is unreadable). */
function cardDrawers(card: HTMLElement): DrawerSpec[] {
  try { return JSON.parse(card.dataset.yardDrawers ?? "[]") as DrawerSpec[]; } catch { return []; }
}

function ShowcaseGrid({ children }: { children: ReactNode }) {
  const [ref, off] = useOffscreen<HTMLDivElement>("-10% 0px", true);
  // Doors and lids: open once after the turn-in (first time on screen), ease open on hover.
  // Paused with the grid (off screen or hidden tab); reduced motion keeps them shut and still.
  const anims = useRef<Animation[]>([]);
  const played = useRef(false);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Reduced motion: doors stay shut; drawers open and shut at once on hover (no slide). Wired on first view,
      // like the motion path (the cards are settled by then).
      if (off || played.current) return;
      played.current = true;
      root.querySelectorAll<HTMLElement>("[data-yard-showcase]").forEach((card) => {
        const drawers = drawersIn(card, cardDrawers(card));
        const btn = card.closest("button");
        if (!btn || !drawers.length) return;
        btn.addEventListener("pointerenter", (ev) => ev.pointerType === "mouse" && setOpen(drawers, true));
        btn.addEventListener("pointerleave", (ev) => ev.pointerType === "mouse" && setOpen(drawers, false));
      });
      return;
    }
    if (off) {
      anims.current.forEach((a) => a.playState === "running" && a.pause());
      return;
    }
    anims.current.forEach((a) => a.playState === "paused" && a.play());
    if (played.current) return;
    played.current = true;
    const cards = [...root.querySelectorAll<HTMLElement>("[data-yard-showcase]")];
    cards.forEach((card, i) => {
      const btn = card.closest("button");
      const leaves = leavesIn(card);
      const drawers = drawersIn(card, cardDrawers(card));
      // Doors swing and drawers slide once after the entrance settles, card by card.
      if (leaves.length) anims.current.push(...swing(leaves, "once", 1250 + i * 260));
      if (drawers.length) anims.current.push(...slide(drawers, "once", 1250 + i * 260));
      if (!btn) return;
      let hovering: Animation[] = [];
      let raf = 0;
      btn.addEventListener("pointermove", (ev) => {
        if (ev.pointerType !== "mouse") return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = btn.getBoundingClientRect();
          const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
          btn.style.setProperty("--tx", `${(x * 7).toFixed(2)}deg`);
          btn.style.setProperty("--ty", `${(-y * 5).toFixed(2)}deg`);
        });
      });
      btn.addEventListener("pointerenter", (ev) => {
        if (ev.pointerType !== "mouse") return;
        btn.setAttribute("data-hover", "");
        hovering = [...(leaves.length ? swing(leaves, "open") : []), ...(drawers.length ? slide(drawers, "open") : [])];
        anims.current = [...anims.current.filter((a) => a.playState !== "finished"), ...hovering];
      });
      btn.addEventListener("pointerleave", (ev) => {
        if (ev.pointerType !== "mouse") return; // F46: touch scrolls fire pointerleave too
        cancelAnimationFrame(raf);
        btn.removeAttribute("data-hover");
        btn.style.removeProperty("--tx");
        btn.style.removeProperty("--ty");
        if (!leaves.length && !drawers.length) return;
        // Mid-swing: run the same swing back from where it is; fully open: the closing swing (and slide).
        if (hovering.some((a) => a.playState === "running")) hovering.forEach((a) => a.reverse());
        else anims.current = [...anims.current.filter((a) => a.playState !== "finished"), ...(leaves.length ? swing(leaves, "close") : []), ...(drawers.length ? slide(drawers, "close") : [])];
        hovering = [];
      });
    });
  }, [off, ref]);
  // Set once on first view; the turn-in keyframes only exist after this (nothing runs at load).
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!off && !seen) setSeen(true);
  }, [off, seen]);
  return (
    <div ref={ref} data-offscreen={off || undefined} data-in={seen || undefined} className="yard-alive-grid mt-6 grid gap-4 sm:grid-cols-3">
      {children}
    </div>
  );
}

/**
 * C2 (5A): one strip showing a real plan, not three icon cards: the step picture, the cut list and the Buy list of
 * the linen canary, all from the engine's plan. Static (no motion); the whole strip is in the SSR HTML (CLS 0).
 */
function PlanStrip({ plan, art, onOpen }: { plan: HomePlan; art?: string; onOpen: () => void }) {
  return (
    <section className="mx-auto mt-12 max-w-5xl sm:mt-16" aria-labelledby="yard-plan-strip" data-yard-plan-strip>
      <h2 id="yard-plan-strip" className="text-center font-display text-2xl text-ink sm:text-3xl">Get the plan</h2>
      <p className="mt-2 text-center text-base text-ink">Step-by-step instructions, a buy list, and a cut list.</p>
      <div className="mt-6 rounded-2xl bg-[var(--yard-fill)] p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-display text-xl text-ink">
            Linen closet{" "}
            <span className="yard-measure text-base" data-size="plan" aria-hidden>{plan.size}</span>
            <span className="sr-only">{plan.sizeAria}</span>
          </p>
          <p className="yard-num text-sm text-ink" data-yard-plan-totals>
            {plan.pieces} cut pieces · Buy list ${plan.usd}
          </p>
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.15fr_1fr]">
          <div>
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-paper sm:aspect-[4/3]">
              {art ? <img src={art} alt={`Yard drawing of the linen closet, ${plan.sizeAria}`} width={480} height={360} loading="lazy" decoding="async" className="h-full w-full object-contain" /> : null}
            </div>
            <h3 className="mt-3 font-display text-lg text-ink">The size you typed</h3>
            {/* Copy pinned by src/lib/yard/homeShowcase.test.ts (engine-owned), so it keeps its typed W × H × D order; flagged to SWE. */}
            <p className="mt-1 text-sm leading-relaxed text-ink">Type 31 1/2 × 78 × 16 and the box is 31 1/2 × 78 × 16; doors add 3/4. Steps come in plain words.</p>
          </div>
          <div>
            <h3 className="font-display text-lg text-ink">Cut list + hardware</h3>
            <ul className="mt-2 divide-y divide-rule/70 text-sm text-ink">
              {plan.cuts.map((c) => (
                <li key={c.label + c.name} className="flex items-baseline gap-2 py-1.5">
                  <span className="yard-num w-4 shrink-0 font-medium">{c.label}</span>
                  <span className="min-w-0 flex-1" data-plan-text>{c.name} <span className="yard-num">×{c.qty}</span></span>
                  <span className="yard-measure shrink-0" data-size={`cut-${c.label}`} aria-hidden>{c.size}</span>
                  <span className="sr-only">{c.aria}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-lg text-ink">Shop, then build</h3>
            <ul className="mt-2 divide-y divide-rule/70 text-sm text-ink">
              {plan.buy.map((b) => (
                <li key={b.name} className="flex items-baseline gap-2 py-1.5">
                  <span className="min-w-0 flex-1" data-plan-text>{b.name}</span>
                  <span className="yard-num shrink-0 text-ink-muted">{b.qty} {b.unit}</span>
                  <span className="yard-num w-16 shrink-0 text-right">${b.usd}</span>
                </li>
              ))}
              <li className="flex items-baseline gap-2 py-1.5 font-medium">
                <span className="flex-1">Buy list</span>
                <span className="yard-num shrink-0">${plan.usd}</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={onOpen}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.96] lg:min-h-9"
            >
              Build this
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
