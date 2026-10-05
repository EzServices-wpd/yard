import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ClipboardList, Hammer, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/site/chrome";
import { DREAMS } from "@/lib/yard/prompt";
import { promptWithHomeStock } from "@/lib/yard/promptHelpers";
import { affiliateDisclosure } from "@/lib/yard/outbound";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const HOUSE = DREAMS.filter((d) => d.group === "house");
const WEEKEND = DREAMS.filter((d) => d.group === "weekend");

/** One class row for every build: sheet, board, round, pipe. A chip names the class, not a brand. */
const STOCKS = [
  { id: "sheet", label: "¾″ plywood", say: "¾″ plywood", append: "from 3/4 plywood" },
  { id: "board", label: "2×4 lumber", say: "2×4 lumber", append: "from 2x4" },
  { id: "round", label: "½″ dowel", say: "½″ dowel", append: "from 1/2 inch dowel" },
  { id: "pipe", label: "PVC pipe", say: "PVC pipe", append: "from 3/4 inch PVC" },
] as const;

type StockId = (typeof STOCKS)[number]["id"];

const STEPS = [
  { n: "1", title: "Type what you want", body: "A shelf, a desk, a weekend build. Add the sizes you have." },
  { n: "2", title: "Choose the material", body: "Sheet, board, round, or pipe." },
  { n: "3", title: "Get the plan", body: "Step-by-step instructions, a buy list, and a cut list." },
] as const;

/** Finished pieces. Each card opens that plan on the bench. */
const PIECES = [
  {
    id: "pocket",
    src: "/heroes/pocket.jpg",
    label: "Pocket vanity",
    size: "38 × 102 × 17 · trapezoid fit",
    prompt: DREAMS.find((d) => d.id === "pocket")?.prompt ?? "pocket vanity",
    caption: "Knee space, drawers, and uppers shaped to the pocket",
  },
  {
    id: "linen",
    src: "/heroes/linen.jpg",
    label: "Linen closet",
    size: "31 1/2 × 78 × 16",
    prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    caption: "Sized to the alcove you typed",
  },
  {
    id: "desk",
    src: "/heroes/desk.jpg",
    label: "60″ desk",
    size: "60 × 30 × 29 · 24″ knee",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    caption: "Drawers plus roomy knee space",
  },
] as const;

const CHIP =
  "rounded-full border border-rule bg-paper px-3.5 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-rule/50";

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const y = new URLSearchParams(window.location.search).get("y");
    if (y) void navigate({ to: "/workspace", search: { y } });
  }, [navigate]);
  const [prompt, setPrompt] = useState("");
  const [stockId, setStockId] = useState<StockId | null>(null);

  const stock = STOCKS.find((s) => s.id === stockId) ?? null;
  const disclosure = affiliateDisclosure();

  function withStock(text: string) {
    return promptWithHomeStock(text, stock?.append);
  }

  function go(text: string) {
    const q = withStock(text);
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

  /** Weekend chips and photo cards already name their stock, so they open as written. */
  function open(text: string) {
    const q = text.trim();
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

  function pickStock(id: StockId) {
    setStockId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center" aria-label="Yard home">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav className="flex items-center gap-5">
            <Link to="/ideas" className="text-sm text-ink-muted transition-colors duration-150 hover:text-ink">
              Ideas
            </Link>
            <Link to="/workspace" className="text-sm text-ink-muted transition-colors duration-150 hover:text-ink">
              Bench
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="yard-hero-in mx-auto flex max-w-3xl flex-col items-center pt-12 text-center sm:pt-20 lg:pt-24">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            The plan the lumber aisle should have printed
          </p>
          <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            <span className="block">Think it up.</span>
            <span className="block">Yard works it out.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            One model. Every cut, part and step.
          </p>

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
            <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-paper p-2 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-18px_rgba(18,16,14,0.25)] transition-[box-shadow,border-color] duration-150 focus-within:border-ink/30 focus-within:ring-2 focus-within:ring-ink/15 sm:flex-row sm:items-center">
              <input
                id="dream"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="bookshelf 30 wide, 60 tall, five shelves"
                autoComplete="off"
                enterKeyHint="go"
                className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-muted"
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
                <span className="mr-1 text-sm text-ink-muted">Material</span>
                {STOCKS.map((s) => {
                  const on = stockId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickStock(s.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors duration-150 ${
                        on
                          ? "border-ink bg-ink text-paper"
                          : "border-rule bg-paper text-ink hover:border-ink/40"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {stock
                  ? prompt.trim() && promptWithHomeStock(prompt, stock.append) === prompt.trim().replace(/\s+/g, " ").trim()
                    ? "The material in the sentence wins."
                    : `Building from ${stock.say}.`
                  : "Leave it open and Yard picks a good fit."}
              </p>
            </fieldset>
          </form>
        </section>

        <ol className="yard-hero-in yard-hero-in-2 mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-2 sm:mt-12 sm:gap-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex flex-col items-center gap-2 rounded-xl border border-rule bg-white/50 px-2 py-3 text-center sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:text-left"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs text-paper">
                {s.n}
              </span>
              <div>
                <p className="text-[13px] font-medium leading-tight text-ink sm:text-sm">{s.title}</p>
                <p className="mt-1 hidden text-xs leading-snug text-ink-muted sm:block">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="yard-hero-in yard-hero-in-2 mx-auto mt-12 grid max-w-3xl gap-8 text-center sm:grid-cols-2 sm:text-left">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">For the house</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {HOUSE.map((d) => (
                <button key={d.id} type="button" onClick={() => go(d.prompt)} className={CHIP}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">For the weekend</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {WEEKEND.map((d) => (
                <button key={d.id} type="button" onClick={() => open(d.prompt)} className={CHIP}>
                  {d.label}
                </button>
              ))}
            </div>
            <Link
              to="/ideas"
              className="mt-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              More ideas
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="yard-hero-in yard-hero-in-3 mt-20">
          <h2 className="text-center font-display text-2xl text-ink sm:text-3xl">Made on Yard</h2>
          <p className="mt-2 text-center text-sm text-ink-muted">Tap a piece to open its full plan.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PIECES.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => open(h.prompt)}
                className="group flex flex-col overflow-hidden rounded-xl border border-rule bg-white/50 text-left transition-colors duration-150 hover:border-ink/30"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-paper">
                  <img
                    src={h.src}
                    alt={`${h.label} ${h.size}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    width={1280}
                    height={960}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-center p-4">
                  <span className="font-display text-base text-ink group-hover:underline">{h.label}</span>
                  <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{h.size}</span>
                  <span className="mt-1 text-xs leading-snug text-ink-muted">{h.caption}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          <Feature
            icon={<Hammer className="size-5" />}
            title="The size you typed"
            body="Type 31 1/2 × 78 × 16 and you get a 31 1/2 × 78 × 16 build, with steps written in plain words."
          />
          <Feature
            icon={<ClipboardList className="size-5" />}
            title="Cut list + hardware"
            body="Every part with its size, plus the screws, hinges, and shelf pins it takes. The sheet layout lives inside each plan."
          />
          <Feature
            icon={<ShoppingBag className="size-5" />}
            title="Shop, then build"
            body="A buy list with packs, prices, and shop links. Print the plan and head to the store."
          />
        </section>

        {disclosure ? (
          <p className="mt-10 text-center text-xs text-ink-muted" data-yard-affiliate-disclosure="1">
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

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-rule bg-white/50 p-5">
      <div className="flex size-9 items-center justify-center rounded-md border border-rule bg-paper text-ink">{icon}</div>
      <h2 className="mt-3 font-display text-lg text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
