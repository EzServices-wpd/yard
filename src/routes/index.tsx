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

function LandingPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  function go(text: string) {
    const q = text.trim();
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

  const featured = HEROES.find((h) => h.featured) ?? HEROES[0];
  const rest = HEROES.filter((h) => h.id !== featured.id);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
            <span className="font-display text-lg tracking-tight">Yard</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/workspace" className="text-ink-muted hover:text-ink">
              Bench
            </Link>
            <Link
              to="/workspace"
              className="inline-flex h-9 items-center rounded-md bg-ink px-3.5 text-sm font-medium text-paper"
            >
              Open the bench
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10">
        <section className="mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            The plan the lumber aisle should have printed
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => go(featured.prompt)}
              className="group flex flex-col overflow-hidden rounded-xl border border-rule bg-surface/40 text-left transition hover:border-ink/30 hover:bg-surface lg:col-span-3"
            >
              <div className="relative aspect-[4/3] bg-paper">
                <img
                  src={featured.src}
                  alt={`${featured.label} ${featured.size}`}
                  className="h-full w-full object-cover"
                  width={1280}
                  height={960}
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="font-display text-lg text-ink group-hover:underline">{featured.label}</span>
                <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{featured.size}</span>
                <span className="mt-1.5 text-sm leading-snug text-ink-muted">{featured.caption}</span>
              </div>
            </button>
            <div className="grid gap-4 lg:col-span-2">
              {rest.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => go(h.prompt)}
                  className="group flex overflow-hidden rounded-xl border border-rule bg-surface/40 text-left transition hover:border-ink/30 hover:bg-surface sm:flex-col"
                >
                  <div className="relative aspect-[4/3] w-2/5 shrink-0 bg-paper sm:w-full">
                    <img
                      src={h.src}
                      alt={`${h.label} ${h.size}`}
                      className="h-full w-full object-cover"
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
          </div>
        </section>

        <section className="max-w-3xl">
          <h1 className="max-w-3xl font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Type it. Buy the parts. Build it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Measure a space. Yard returns a cut list, hardware, and shop links — for the hole you actually have. Crafts still work. Same engine.
          </p>

          <form
            className="mt-8 max-w-3xl"
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
                className="h-12 flex-1 rounded-lg border border-rule bg-paper px-4 text-base text-ink outline-none ring-ink/20 placeholder:text-ink-muted focus:ring-2"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-paper"
              >
                Build this
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>

          <ChipRow title="For the house" items={HOUSE} onGo={go} />
          <ChipRow title="For the weekend" items={WEEKEND} onGo={go} />
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

function ChipRow({
  title,
  items,
  onGo,
}: {
  title: string;
  items: (typeof DREAMS)[number][];
  onGo: (text: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-10">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{title}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onGo(d.prompt)}
              className="group flex h-full w-full flex-col rounded-xl border border-rule bg-surface/40 p-4 text-left transition hover:border-ink/30 hover:bg-surface"
            >
              <span className="font-display text-base text-ink group-hover:underline">{d.label}</span>
              <span className="mt-1.5 text-xs leading-snug text-ink-muted">{d.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
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
