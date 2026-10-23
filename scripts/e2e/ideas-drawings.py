"""
I-draw on a built site: every card /ideas?test=1 shows paints its own baked drawing. At 390 and 1440, after scrolling
to the end and opening every "Show all": no [data-idea-no-drawing] stand-in, and every card drawing <img> loaded
(complete, naturalWidth > 0). A fresh browser has no kept plans, so the stand-in has no legitimate use here.

  python3 scripts/e2e/ideas-drawings.py http://127.0.0.1:8091
Exit 1 on any failure.
"""
import sys
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
fails = []
CARDS_JS = """() => { const imgs = [...document.querySelectorAll('main .idea-ink img.idea-wood')];
  return { blank: [...document.querySelectorAll('[data-idea-no-drawing]')].map(e => e.textContent.trim()),
           imgs: imgs.length, broken: imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')) }; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for W, H in ((390, 844), (1440, 900)):
        ctx = br.new_context(viewport={"width": W, "height": H}, is_mobile=W < 500, has_touch=W < 500, extra_http_headers={"x-yard-test": "1"})
        ctx.route("**/api/ideas-log*", lambda r: r.fulfill(status=204))
        page = ctx.new_page()
        page.goto(f"{U}/ideas?test=1", wait_until="networkidle")
        page.evaluate("() => document.querySelectorAll(\"button[aria-expanded='false']\").forEach(b => b.textContent.startsWith('Show all') && b.click())")
        # Lazy drawings load as they scroll in: walk the page, then force any left lazy to load.
        for _ in range(40):
            if page.evaluate("() => { window.scrollBy(0, innerHeight); return innerHeight + scrollY >= document.body.scrollHeight - 2; }"): break
            page.wait_for_timeout(150)
        page.evaluate("() => document.querySelectorAll('main .idea-ink img').forEach(i => { i.loading = 'eager'; })")
        page.wait_for_load_state("networkidle"); page.wait_for_timeout(500)
        r = page.evaluate(CARDS_JS)
        tag = f"/ideas?test=1 @{W}"
        if not r["imgs"]: fails.append(f"{tag}: no card drawings found")
        for t in r["blank"]: fails.append(f"{tag}: card {t!r} paints no drawing (data-idea-no-drawing)")
        for s in r["broken"]: fails.append(f"{tag}: drawing {s} did not load")
        print(f"{tag}: {r['imgs']} drawings, {len(r['blank'])} stand-ins, {len(r['broken'])} broken")
        ctx.close()
    br.close()
for f in fails: print("FAIL", f)
print("ideas-drawings:", "PASS" if not fails else f"{len(fails)} failures")
sys.exit(1 if fails else 0)
