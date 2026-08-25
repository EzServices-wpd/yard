import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Yard";
/** Production domain. Env override still wins if set on Vercel. */
const host = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined) || "yard.wiki";
const ogImage = `https://${host}/og.jpg`;
const xBanner = `https://og.grok.me/v1/banner.png?host=${encodeURIComponent(host)}&title=${encodeURIComponent(APP_NAME)}`;


/** Env-gated: only loads when VITE_PUBLIC_PLAUSIBLE_DOMAIN is set (e.g. yard.wiki). */
function Plausible() {
  useEffect(() => {
    const domain = (import.meta.env.VITE_PUBLIC_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
    if (!domain) return;
    if (document.querySelector(`script[data-domain="${domain}"]`)) return;
    const s = document.createElement("script");
    s.defer = true;
    s.dataset.domain = domain;
    s.src = "https://plausible.io/js/script.js";
    document.head.appendChild(s);
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Type it. Buy the parts. Build it. Real retail materials, a 3D bench, and a shop-ready plan.",
      },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", content: "#12100e" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: "Type it. Buy the parts. Build it.",
      },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: `https://${host}/` },
      { property: "x:game:image", content: xBanner },
      { property: "x:game:image:width", content: "1200" },
      { property: "x:game:image:height", content: "264" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "canonical", href: `https://${host}/` },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
        <Plausible />
      </body>
    </html>
  ),
});
