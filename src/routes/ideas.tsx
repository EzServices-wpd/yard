import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { IDEAS, IDEA_SECTIONS } from "@/lib/yard/ideas";

export const Route = createFileRoute("/ideas")({
  component: IdeasPage,
});

function IdeasPage() {
  const navigate = useNavigate();

  function go(text: string) {
    const q = text.trim();
    if (!q) return;
    void navigate({ to: "/workspace", search: { q } });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav className="flex items-center gap-5">
            <Link to="/ideas" className="text-sm text-ink">
              Ideas
            </Link>
            <Link to="/workspace" className="text-sm text-ink-muted transition-colors duration-150 hover:text-ink">
              Bench
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
          Type it. Buy the parts. Build it.
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          A house full of things you can actually build.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Tap one. Yard fills the bar with that prompt and returns a cut list, hardware, and steps.
          Or type your own size. These are the ones we already trust.
        </p>

        {IDEA_SECTIONS.map((section) => {
          const rows = IDEAS.filter((d) => d.section === section);
          if (!rows.length) return null;
          return (
            <section key={section} className="mt-14">
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{section}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => go(d.prompt)}
                    className="group flex flex-col rounded-xl border border-rule bg-surface/30 p-4 text-left transition-colors duration-150 hover:border-ink/30 hover:bg-surface/60"
                  >
                    <span className="font-display text-lg text-ink group-hover:underline">{d.label}</span>
                    <span className="mt-0.5 font-mono text-xs tracking-tight text-ink">{d.size}</span>
                    <span className="mt-2 text-sm leading-snug text-ink-muted">{d.blurb}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted group-hover:text-ink">
                      Build this
                      <ArrowRight className="size-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
