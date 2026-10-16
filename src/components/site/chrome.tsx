import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { pickTestFlags } from "@/lib/ideas/testFlags";

const NAV = [
  { to: "/ideas" as const, label: "Ideas" },
  { to: "/workspace" as const, label: "Workbench" },
];

const FOOT = [
  { to: "/about" as const, label: "About" },
  { to: "/privacy" as const, label: "Privacy" },
  { to: "/terms" as const, label: "Terms" },
];

export function SiteChrome({
  children,
  active,
}: {
  children: ReactNode;
  active?: "ideas" | "about" | "privacy" | "terms" | "home";
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex min-h-11 items-center" aria-label="Yard home">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const on = n.to === "/ideas" && active === "ideas";
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  // Test flags ride along from Ideas to the workbench (offline runs stay offline).
                  search={(prev: Record<string, unknown>) => pickTestFlags(prev) as never}
                  className={`inline-flex min-h-11 items-center px-2.5 text-sm transition-colors duration-150 ${
                    on ? "text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
      <SiteFooter active={active} />
    </div>
  );
}

export function SiteFooter({ active }: { active?: "ideas" | "about" | "privacy" | "terms" | "home" }) {
  return (
    <footer className="border-t border-rule/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">Yard · Think it up. Yard works it out.</p>
        <nav className="-mx-2.5 flex flex-wrap items-center gap-x-1">
          {FOOT.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`inline-flex min-h-11 items-center px-2.5 text-sm transition-colors duration-150 ${
                (n.to === "/about" && active === "about") ||
                (n.to === "/privacy" && active === "privacy") ||
                (n.to === "/terms" && active === "terms")
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <a href="mailto:hello@yard.wiki?subject=Yard%20feedback" className="inline-flex min-h-11 items-center px-2.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink">
            Feedback
          </a>
        </nav>
      </div>
    </footer>
  );
}
