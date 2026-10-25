"""
I-draw on a built site: every card /ideas?test=1 shows paints its own baked drawing. At 390 and 1440, after scrolling
to the end and opening every "Show all": no [data-idea-no-drawing] stand-in, and every card drawing <img> loaded
(complete, naturalWidth > 0). A fresh browser has no kept plans, so the stand-in has no legitimate use here.

  python3 scripts/e2e/ideas-drawings.py http://127.0.0.1:8091 [--trace-dir DIR]
Exit 1 on any failure. One run, no retries (a failure is a finding, not a flake); a failing width saves a Playwright
trace (screenshots + DOM snapshots) to DIR/ideas-drawings-<width>.zip for `npx playwright show-trace`.
"""
import sys
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
U = args[0].rstrip("/") if args else "http://127.0.0.1:8091"
TRACE = sys.argv[sys.argv.index("--trace-dir") + 1] if "--trace-dir" in sys.argv else "/tmp"
if TRACE in args: args.remove(TRACE)
fails = []
CARDS_JS = """() => { const imgs = [...document.querySelectorAll('main .idea-ink img.idea-wood')];
  return { blank: [...document.querySelectorAll('[data-idea-no-drawing]')].map(e => e.textContent.trim()),
           imgs: imgs.length, broken: imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')) }; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for W, H in ((390, 844), (1440, 900)):
        ctx = br.new_context(viewport={"width": W, "height": H}, is_mobile=W < 500, has_touch=W < 500, extra_http_headers={"x-yard-test": "1"})
        ctx.tracing.start(screenshots=True, snapshots=True)
        ctx.route("**/api/ideas-log*", lambda r: r.fulfill(status=204))
        page = ctx.new_page()
        page.goto(f"{U}/ideas?test=1", wait_until="networkidle")
        page.evaluate("() => document.querySelectorAll(\"[data-ideas-show-all][aria-expanded='false']\").forEach(b => b.click())")
        # Each Show all opens the number its label says ("Show all 12", "Show top 24 of 38"), and the list it controls.
        for lab, n in page.evaluate("""() => [...document.querySelectorAll('[data-ideas-show-all]')].map(b => [b.dataset.ideasShowAll,
            document.getElementById(b.getAttribute('aria-controls'))?.children.length ?? -1])"""):
            m = __import__("re").match(r"Show (?:all|top) (\d+)", lab or "")
            if not m or int(m.group(1)) != n: fails.append(f"/ideas?test=1 @{W}: {lab!r} opened {n} cards")
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
        bad = not r["imgs"] or r["blank"] or r["broken"]
        ctx.tracing.stop(path=f"{TRACE}/ideas-drawings-{W}.zip" if bad else None)
        if bad: print(f"{tag}: trace {TRACE}/ideas-drawings-{W}.zip")
        ctx.close()
    br.close()
for f in fails: print("FAIL", f)
print("ideas-drawings:", "PASS" if not fails else f"{len(fails)} failures")
sys.exit(1 if fails else 0)
