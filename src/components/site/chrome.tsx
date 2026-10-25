import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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

/**
 * The header's line shows only once the page has scrolled (4B): a 1px sentinel at the top of the page
 * flips data-scrolled when it leaves the viewport. No scroll listener, no layout change (CLS 0).
 */
export function useScrolled() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [sentinel, scrolled] as const;
}

/** Top-of-page marker for useScrolled. */
export function ScrollSentinel({ at }: { at: RefObject<HTMLDivElement | null> }) {
  return <div ref={at} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />;
}

/** Header nav and small links: 44px tall on a phone, 36px on a desktop (6B). */
export const NAV_LINK = "inline-flex min-h-11 items-center px-2.5 text-sm transition-colors duration-150 lg:min-h-9";

export function SiteChrome({
  children,
  active,
}: {
  children: ReactNode;
  active?: "ideas" | "about" | "privacy" | "terms" | "home";
}) {
  const [sentinel, scrolled] = useScrolled();
  return (
    <div className="yard-site relative min-h-screen bg-paper text-ink">
      <ScrollSentinel at={sentinel} />
      <header className="yard-head sticky top-0 z-40 bg-paper/90 backdrop-blur" data-scrolled={scrolled || undefined}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex min-h-11 items-center" aria-label="Yard home">
            <Logo inverted className="h-7 w-auto" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((n) => {
              const on = n.to === "/ideas" && active === "ideas";
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  // Test flags ride along from Ideas to the workbench (offline runs stay offline).
                  search={(prev: Record<string, unknown>) => pickTestFlags(prev) as never}
                  className={`${NAV_LINK} ${on ? "text-ink" : "text-ink-muted hover:text-ink"}`}
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
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">Yard · Think it up. Yard works it out.</p>
        <nav aria-label="Footer" className="-mx-2.5 flex flex-wrap items-center gap-x-1">
          {FOOT.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`${NAV_LINK} ${
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
          <a href="mailto:hello@yard.wiki?subject=Yard%20feedback" className={`${NAV_LINK} text-ink-muted hover:text-ink`}>
            Feedback
          </a>
        </nav>
      </div>
    </footer>
  );
}
