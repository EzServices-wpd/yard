import { Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/site/chrome";

/** A friendly 404: say so, offer the prompt box and Ideas. */
export function NotFound() {
  return (
    <SiteChrome>
      <main className="mx-auto max-w-xl px-4 pb-20 pt-14 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">404</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">That page isn't here</h1>
        <p className="mt-3 text-ink-muted">But your next build can be. Type what you want and Yard works it out.</p>
        <form action="/workspace" method="get" className="mt-6 flex gap-2">
          <input name="q" required aria-label="What do you want to build?" placeholder="a bookshelf 36 wide, 72 tall" className="h-11 min-w-0 flex-1 rounded-full border border-rule bg-transparent px-4 text-ink outline-none focus:ring-2" />
          <button type="submit" className="h-11 rounded-full bg-ink px-5 text-sm font-medium text-paper">Build it</button>
        </form>
        <p className="mt-6 text-sm"><Link to="/ideas" className="underline decoration-rule underline-offset-4 hover:decoration-ink">Or browse Ideas</Link></p>
      </main>
    </SiteChrome>
  );
}
