import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="inline-flex">
          <Logo inverted />
        </Link>
        <div>
          <h1 className="font-display text-3xl text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Optional this pass. Projects stay on this device either way.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/workspace" })}
                className="w-full rounded-md border border-rule bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink/30"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Sign-in is disabled.</p>
        )}
        <Link
          to="/workspace"
          search={{}}
          className="block text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Skip — open the bench
        </Link>
      </div>
    </main>
  );
}
