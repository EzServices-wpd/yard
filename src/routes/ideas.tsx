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
          These are real builds — not a catalogue of lies. Tap one. Yard fills the bar and returns a cut list,
          hardware, and steps. Or type your own size.
        </p>

        {IDEA_SECTIONS.map((section) => {
          const rows = IDEAS.filter((d) => d.section === section);
          if (!rows.length) return null;
          const weekend = section === "Weekend";
          return (
            <section key={section} className={weekend ? "mt-20" : "mt-14"}>
              {weekend ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">Weekend</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
                    From popsicle / PVC / straw.
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
                    Same bench as the house. Named stock. The size you typed.
                  </p>
                </>
              ) : (
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{section}</h2>
              )}
              <div className={`mt-4 grid gap-3 ${weekend ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {rows.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => go(d.prompt)}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border border-rule bg-paper text-left transition-[border-color,background-color] duration-150 hover:border-ink/35 hover:bg-surface/40 ${
                      weekend ? "p-5 sm:p-6" : "p-4"
                    }`}
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-ink/0 transition-colors duration-150 group-hover:bg-ink/40" />
                    {d.stock && (
                      <span className="font-display text-[13px] italic leading-none text-ink-muted">{d.stock}</span>
                    )}
                    <span className={`font-display text-ink group-hover:underline ${weekend ? "mt-2 text-xl" : "text-lg"}`}>
                      {d.label}
                    </span>
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
