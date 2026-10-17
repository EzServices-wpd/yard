"""
Test flags on links: on / and /ideas opened with ?test=1 (and ?offline=1, ?local=1: the same TEST_FLAGS helper),
every internal link keeps the flag. That covers the header, chips, cards, ticker, Free plans, More ideas and the
footer, at 1440 and 390, after scrolling to the end and opening every "Show all"; and a card/chip button's
navigate() to the workspace. The root route's
retainSearchParams(TEST_FLAGS) builds these hrefs, so a router <Link> can't drop them. A plain <a href="/..."> could.

  python3 scripts/e2e/link-flags.py http://127.0.0.1:8091
Exit 1 on any failure.
"""
import sys
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
FLAGS = ["test=1", "offline=1", "local=1"]
LINKS_JS = """() => [...document.querySelectorAll('a[href]')].map(a => [a.getAttribute('href'), (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 40)])"""
fails, seen = [], 0
_row = lambda i, p, size: {"key": f"k{i}", "prompt": p, "size": size, "resultKey": f"builtin:x{i}", "status": "Trusted", "count": 9 - i, "lastSeen": "2026-10-17T12:00:00.000Z", "at": "2026-10-17T12:00:00.000Z", "source": "live"}
_rows = [_row(0, "bookshelf 36 wide 72 tall 12 deep", "36×12×72"), _row(1, "shoe rack 30 wide", "30×12×18"), _row(2, "nightstand 18 wide", "18×16×24")]
SNAP = __import__("json").dumps({"at": "2026-10-17T12:00:00.000Z", "live": True, "rows": _rows, "popular": _rows, "recent": _rows})

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in [(1440, 900), (390, 844)]:
        ctx = b.new_context(viewport={"width": W, "height": H})
        # Test flags only: offline/local keep the page off the network; test=1 tags API calls. Block the store anyway.
        ctx.route("**/api/ideas-log*", lambda r: r.fulfill(status=204))
        # A live snapshot so the Making-now ticker and Popular/Recent rows render their links too.
        ctx.route("**/api/ideas-snapshot*", lambda r: r.fulfill(status=200, content_type="application/json", body=SNAP))
        page = ctx.new_page()
        for path in ["/", "/ideas"]:
            for flag in FLAGS:
                page.goto(f"{U}{path}?{flag}", wait_until="networkidle")
                page.wait_for_timeout(800)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(600)
                for btn in page.get_by_role("button", name="Show all").all():
                    try: btn.click(timeout=1500)
                    except Exception: pass
                page.wait_for_timeout(300)
                links = [l for l in page.evaluate(LINKS_JS) if l[0].startswith("/") and not l[0].startswith("//")]
                if not links: fails.append(f"{path}?{flag} @{W}: no internal links found")
                seen += len(links)
                for href, text in links:
                    if flag not in href.split("#")[0]:
                        fails.append(f"{path}?{flag} @{W}: {text!r} -> {href}")
                print(f"{path}?{flag} @{W}: {len(links)} internal links, {sum(1 for h, _ in links if flag not in h)} missing the flag")
        # Cards and chips are buttons that navigate(): the build URL keeps the flag too.
        if W == 1440:
            for path in ["/", "/ideas"]:
                for flag in FLAGS:
                    page = ctx.new_page()  # a fresh tab: test=1 from an earlier run would otherwise stick (by design)
                    page.goto(f"{U}{path}?{flag}", wait_until="networkidle")
                    page.wait_for_timeout(600)
                    # Home: a Made on Yard card. Ideas: the first card.
                    page.locator("main button.yard-card" if path == "/" else "main button:has(svg), main button:has(img)").first.click()
                    try: page.wait_for_url("**/workspace**", timeout=8000)
                    except Exception: pass
                    ok = "/workspace" in page.url and flag in page.url
                    print(f"{path}?{flag}: first card/chip -> {page.url.replace(U, '')[:90]}")
                    if not ok: fails.append(f"{path}?{flag}: card/chip navigation -> {page.url}")
        ctx.close()
    b.close()

print(f"{seen} links checked")
if fails:
    print("FAIL"); [print("  " + f) for f in fails]; sys.exit(1)
print("link-flags: PASS")
