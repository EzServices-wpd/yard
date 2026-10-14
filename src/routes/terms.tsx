import type React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";

const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms · Yard" },
      {
        name: "description",
        content: "The terms for using Yard.",
      },
      { property: "og:title", content: "Terms · Yard" },
      { property: "og:url", content: `https://${host}/terms` },
    ],
    links: [{ rel: "canonical", href: `https://${host}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const sec = (h: string, p: React.ReactNode) => (
    <section>
      <h2 className="font-display text-xl text-ink">{h}</h2>
      <p className="mt-2">{p}</p>
    </section>
  );
  return (
    <SiteChrome active="terms">
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:pt-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">Terms</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">Terms of Use</h1>
        <p className="mt-4 text-sm text-ink-muted">Last updated 14 Oct 2026.</p>
        <div className="mt-8 space-y-8 text-base leading-relaxed text-ink-muted">
          {sec("Using Yard", "Yard is free to use at yard.wiki. Plans, cut lists and Buy lists are guidance for your own projects. You can share and build them however you like.")}
          {sec("Check before you build", "Measure your space and your stock, and confirm walls, studs, loads and local codes yourself. Yard is not an engineer or an inspector, and you build at your own risk. Use the safety gear your tools call for.")}
          {sec("AI lookups", "Some builds are worked out with an AI lookup. Each visitor gets a fair number of lookups per day. Built-in shapes and saved recipes always work.")}
          {sec("Shop links", "Some Buy links are affiliate links. Yard may earn a small commission at no extra cost to you. Prices and stock come from the store.")}
          {sec("Fair use", "Please don't overload the site, scrape it at scale, or use it to break the law.")}
          <section>
            <h2 className="font-display text-xl text-ink">Contact</h2>
            <p className="mt-2">
              Questions or feedback: <a href="mailto:hello@yard.wiki" className="underline decoration-rule underline-offset-4 hover:decoration-ink">hello@yard.wiki</a>. See also the 
              <Link to="/privacy" className="underline decoration-rule underline-offset-4 hover:decoration-ink">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </main>
    </SiteChrome>
  );
}
