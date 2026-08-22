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

function LandingPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  function go(text: string) {
    const q = text.trim();
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

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

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16">
        <section className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            Measure a space. Get a plan.
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Type it. Buy the parts. Build it.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Type the opening — a 31.5″ linen closet, a wonky bathroom pocket, a 36×48 window — and Yard returns a cut list, hardware, and shop links. Crafts still work. Same engine.
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
                placeholder="linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep"
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
  items: typeof DREAMS[number][];
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
