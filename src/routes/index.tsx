import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowRight, Box, Ruler, ShoppingBag } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { DREAMS } from "@/lib/yard/prompt";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const { user, isPending } = useCurrentUserState();

  function go(q: string) {
    const value = q.trim();
    if (!value) return;
    void navigate({ to: "/workspace", search: { q: value } });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo inverted />
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link to="/workspace" search={{}} className="hidden text-sm text-ink-muted hover:text-ink sm:inline">
              Bench
            </Link>
            {isPending ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-rule" />
            ) : user ? (
              <SignedIn>
                <UserButton />
              </SignedIn>
            ) : (
              <SignedOut>
                <Link to="/login" className="text-sm text-ink-muted hover:text-ink">
                  Sign in
                </Link>
              </SignedOut>
            )}
            <Link
              to="/workspace"
              search={{ q: DREAMS[0].prompt }}
              className="inline-flex h-9 items-center rounded-md bg-ink px-3.5 text-sm font-medium text-paper"
            >
              Open the bench
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            The material universe
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Type it. Buy the parts. Build it.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
            Give it a space and a use — a wonky bathroom pocket, a 60″ desk, a bookcase — and Yard returns the unit, the cut list, and the hardware. Makers get the same bench for a popsicle Eiffel.
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
                placeholder="3 foot Eiffel Tower from popsicle sticks"
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

          <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DREAMS.map((d) => (
              <li key={d.id}>
                <Link
                  to="/workspace"
                  search={{ q: d.prompt }}
                  className="block h-full rounded-lg border border-rule px-3.5 py-3 transition hover:border-ink/30 hover:bg-white"
                >
                  <p className="text-sm font-medium text-ink">{d.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-muted">{d.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-rule bg-white/50 py-14">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-3">
            <Step
              icon={<Box className="size-5" />}
              n="01"
              title="Real parts"
              body="Popsicle sticks, paper-towel cores, PVC, 2×4s. Nominal retail sizes — not fake geometry."
            />
            <Step
              icon={<Ruler className="size-5" />}
              n="02"
              title="A bench you can trust"
              body="Orbit, snap, measure an opening. Closet, lattice, arch — same engine."
            />
            <Step
              icon={<ShoppingBag className="size-5" />}
              n="03"
              title="A plan you can shop"
              body="Cut list, pack counts, store searches, plates you can print."
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid items-end gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl text-ink sm:text-4xl">
                Geometry first. Language second.
              </h2>
              <p className="mt-3 max-w-md text-ink-muted leading-relaxed">
                Spans and stick counts are deterministic. Grok writes the assembly voice — it does not invent a 4.5″ stick that is 5″ long.
              </p>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              Guidance only. Not stamped engineering. Better to over-warn than under-warn.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule py-8 text-center text-sm text-ink-muted">
        Yard · every piece is something you can buy
      </footer>
    </div>
  );
}

function Step({
  icon,
  n,
  title,
  body,
}: {
  icon: ReactNode;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 text-ink-muted">
        <span className="grid size-9 place-items-center rounded-md border border-rule">{icon}</span>
        <span className="font-mono text-xs tracking-widest">{n}</span>
      </div>
      <h3 className="mt-3 font-display text-xl text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
