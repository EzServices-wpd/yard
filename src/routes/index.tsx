import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowRight, Box, Ruler, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DREAMS } from "@/lib/yard/prompt";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const HOUSE = DREAMS.filter((d) => d.group === "house");
const WEEKEND = DREAMS.filter((d) => d.group === "weekend");

const STOCKS = [
  { id: "plywood", label: "¾ plywood", append: "from 3/4 plywood" },
  { id: "popsicle", label: "popsicle", append: "from popsicle sticks" },
  { id: "pvc", label: "PVC", append: "from 3/4 inch PVC" },
] as const;

const HEROES = [
  {
    id: "pocket",
    src: "/heroes/pocket.jpg",
    label: "Pocket vanity",
    size: "38 × 102 × 17 · trapezoid fit",
    prompt: DREAMS.find((d) => d.id === "pocket")?.prompt ?? "pocket vanity",
    caption: "Knee, drawers, uppers — the unit the pocket actually holds",
    featured: true,
  },
  {
    id: "linen",
    src: "/heroes/linen.jpg",
    label: "Linen closet",
    size: "31.5 × 78 × 16",
    prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    caption: "The alcove you typed is the unit you get",
    featured: false,
  },
  {
    id: "desk",
    src: "/heroes/desk.jpg",
    label: "60″ desk",
    size: "60 × 30 × 29 · 24″ knee",
    prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
    caption: "Drawers + clear knee space",
    featured: false,
  },
] as const;

const CHIP =
  "rounded-full border border-rule bg-paper px-3.5 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-rule/50";

function LandingPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [stockId, setStockId] = useState<(typeof STOCKS)[number]["id"] | null>(null);

  const stock = STOCKS.find((s) => s.id === stockId) ?? null;

  function withStock(text: string) {
    const q = text.trim();
    if (!q) return "";
    if (!stock) return q;
    const hay = q.toLowerCase();
    if (hay.includes(stock.append.toLowerCase()) || hay.includes(stock.label.toLowerCase())) return q;
    return `${q} ${stock.append}`;
  }

  function go(text: string) {
    const q = withStock(text);
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

  function pickStock(id: (typeof STOCKS)[number]["id"]) {
    const next = stockId === id ? null : id;
    setStockId(next);
    const chosen = STOCKS.find((s) => s.id === next);
    const t = prompt.trim();
    if (!t || !chosen) return;
    const stripped = t.replace(/\s+from\s+(?:3\/4(?:\s+inch)?\s+plywood|popsicle sticks|3\/4 inch PVC)\s*$/i, "").trim();
    setPrompt(`${stripped} ${chosen.append}`);
  }

  const featured = HEROES.find((h) => h.featured) ?? HEROES[0];
  const rest = HEROES.filter((h) => h.id !== featured.id);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center">
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

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:pt-12">
        <section className="grid items-end gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="yard-hero-in lg:col-span-5 lg:pb-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
              The plan the lumber aisle should have printed
            </p>
            <h1 className="mt-4 max-w-xl font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Type it. Buy the parts. Build it.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              Measure a space. Yard returns a cut list, hardware, and shop links — for the hole you actually have.
            </p>

            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                go(prompt);
              }}
            >
              <label htmlFor="dream" className="sr-only">
                What do you want to build?
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="dream"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="bathroom vanity, 36 wide"
                  className="h-12 flex-1 rounded-lg border border-rule bg-paper px-4 text-base text-ink outline-none ring-ink/20 placeholder:text-ink-muted transition-[box-shadow,border-color] duration-150 focus:border-ink/30 focus:ring-2"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Build this
                  <ArrowRight className="size-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                <span className="mr-1">from</span>
                {STOCKS.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && <span className="mx-1.5 text-rule">/</span>}
                    <button
                      type="button"
                      onClick={() => pickStock(s.id)}
                      className={`rounded-full px-2 py-0.5 transition-colors duration-150 ${
                        stockId === s.id
                          ? "bg-ink text-paper"
                          : "text-ink underline decoration-rule underline-offset-[5px] hover:decoration-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  </span>
                ))}
              </p>
            </form>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">For the house</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HOUSE.map((d) => (
                    <button key={d.id} type="button" onClick={() => go(d.prompt)} className={CHIP}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <Link
                  to="/ideas"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
                >
                  See more of the house
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">For the weekend</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {WEEKEND.map((d) => (
                    <button key={d.id} type="button" onClick={() => go(d.prompt)} className={CHIP}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => go(featured.prompt)}
            className="yard-hero-in yard-hero-in-2 group relative overflow-hidden rounded-xl border border-rule bg-surface/40 text-left lg:col-span-7"
          >
            <div className="relative aspect-[4/3] bg-paper sm:aspect-[5/4]">
              <img
                src={featured.src}
                alt={`${featured.label} ${featured.size}`}
                className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                width={1280}
                height={960}
              />
            </div>
            <div className="flex flex-col p-4 sm:absolute sm:inset-x-0 sm:bottom-0 sm:bg-gradient-to-t sm:from-paper sm:via-paper/90 sm:to-transparent sm:p-5 sm:pt-16">
              <span className="font-display text-lg text-ink group-hover:underline">{featured.label}</span>
              <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{featured.size}</span>
              <span className="mt-1.5 text-sm leading-snug text-ink-muted">{featured.caption}</span>
            </div>
          </button>
        </section>

        <section className="yard-hero-in yard-hero-in-3 mt-4 grid gap-4 sm:grid-cols-2">
          {rest.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => go(h.prompt)}
              className="group flex overflow-hidden rounded-xl border border-rule bg-surface/40 text-left transition-colors duration-150 hover:border-ink/30"
            >
              <div className="relative aspect-[4/3] w-2/5 shrink-0 overflow-hidden bg-paper sm:w-1/2">
                <img
                  src={h.src}
                  alt={`${h.label} ${h.size}`}
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
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          <Feature
            icon={<Ruler className="size-5" />}
            title="The size you typed"
            body="31.5 × 78 × 16 means 31.5 × 78 × 16. Geometry is deterministic. Grok writes the assembly voice — it does not invent a 36″ closet."
          />
          <Feature
            icon={<Box className="size-5" />}
            title="Cut list + hardware"
            body="¾″ plywood, screws, shelf pins, a window unit. Nominal retail sizes — not fake geometry."
          />
          <Feature
            icon={<ShoppingBag className="size-5" />}
            title="Shop, then build"
            body="BOM with packs, prices, and deep links. Print the plan. Buy the parts. Crafts (Eiffel, arch, bridge) use the same bench."
          />
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-rule bg-surface/30 p-5">
      <div className="flex size-9 items-center justify-center rounded-md border border-rule bg-paper text-ink">{icon}</div>
      <h2 className="mt-3 font-display text-lg text-ink">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
