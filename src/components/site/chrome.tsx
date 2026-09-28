import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

const NAV = [
  { to: "/gallery" as const, label: "Gallery" },
  { to: "/ideas" as const, label: "Ideas" },
  { to: "/workspace" as const, label: "Bench" },
];

const FOOT = [
  { to: "/about" as const, label: "About" },
  { to: "/gallery" as const, label: "Gallery" },
  { to: "/ideas" as const, label: "Ideas" },
  { to: "/privacy" as const, label: "Privacy" },
];

export function SiteChrome({
  children,
  active,
}: {
  children: ReactNode;
  active?: "gallery" | "ideas" | "about" | "privacy" | "home";
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center" aria-label="Yard home">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav className="flex items-center gap-5">
            {NAV.map((n) => {
              const on =
                (n.to === "/gallery" && active === "gallery") ||
                (n.to === "/ideas" && active === "ideas");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`text-sm transition-colors duration-150 ${
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

export function SiteFooter({ active }: { active?: "gallery" | "ideas" | "about" | "privacy" | "home" }) {
  return (
    <footer className="border-t border-rule/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">Yard · type it, buy the parts, build it.</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {FOOT.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`text-sm transition-colors duration-150 ${
                (n.to === "/about" && active === "about") ||
                (n.to === "/privacy" && active === "privacy") ||
                (n.to === "/gallery" && active === "gallery") ||
                (n.to === "/ideas" && active === "ideas")
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
