"""
Batch C1 on the built site: every size printed on / and /ideas is in the one format (W × D × H in, or
"40 dia × 30 in"), no other size-like text sneaks onto either page, chips / nav / Show all are 44px tall
at 390 and 36px at 1440 (6B), nothing readable is under 13px, the header line shows only once scrolled
(4B), and the layout never shifts (CLS 0).

  python3 scripts/e2e/site-sizes.py http://127.0.0.1:8091
Exit 1 on any failure.
"""
import re, sys
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
N = r"(?:\d+(?: \d+/\d+)?|\d+/\d+)"
SIZE = re.compile(rf"^{N} × {N} × {N} in$|^{N} dia × {N} in$")
# Size-like text anywhere else on the page ("31 1/2 × 78", "36x12"). Notes that name a thing it is for are allowed.
LOOSE = re.compile(r"\d+(?: \d+/\d+)?\s*[×x]\s*\d+")
# Allowed: the window a build is for ("for a 36 × 48 double-hung", the "36×48 hung" chip) and nominal lumber (2×4, 2x4, 2×2).
# The feature card's example sentence is pinned by src/lib/yard/homeShowcase.test.ts (engine-owned), so it is allowed here.
NOTE_OK = re.compile(r"Type 31 1/2 × 78 × 16 and the box is 31 1/2 × 78 × 16; doors add 3/4|for a \d+ × \d+ double-hung|\d+\s*×\s*\d+ (?:double-)?hung|\b[12]\s*[×x]\s*\d{1,2}\b")
fails = []

CLS_JS = """() => new Promise((res) => { let v = 0; const src = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { v += e.value; for (const s of e.sources || []) src.push((s.node && (s.node.className || s.node.nodeName || '').toString().slice(0, 60)) + ' ' + JSON.stringify(s.previousRect) + '→' + JSON.stringify(s.currentRect)); } }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => res([v, src]), 800); })"""

def check(page, path, W):
    tag = f"{path} @{W}"
    page.goto(U + path, wait_until="networkidle")
    page.wait_for_timeout(1200)
    cls, src = page.evaluate(CLS_JS)
    # The late Figtree swap nudges the right-aligned header nav by ~4px (0.00002, same on the base build); Lighthouse reports 0.
    if cls >= 0.001: fails.append(f"{tag}: CLS {cls:.6f} {src[:3]}")
    # Header line: hidden at the top, shown once scrolled.
    line = lambda: page.evaluate("() => { const h = document.querySelector('header.yard-head'); return h ? getComputedStyle(h, '::after').opacity : 'no yard-head'; }")
    if line() != "0": fails.append(f"{tag}: header line visible at the top")
    # Open every section so every card is in the DOM.
    page.evaluate("() => document.querySelectorAll(\"[data-ideas-show-all][aria-expanded='false']\").forEach(b => b.click())")
    page.evaluate("() => window.scrollTo(0, 600)"); page.wait_for_timeout(500)
    if line() != "1": fails.append(f"{tag}: header line not shown once scrolled")
    sizes = page.eval_on_selector_all("[data-size]", "els => els.map(e => [e.getAttribute('data-size'), e.textContent])")
    if not sizes: fails.append(f"{tag}: no sizes found")
    for slug, t in sizes:
        if not SIZE.match(t): fails.append(f"{tag}: {slug} size {t!r} is not in the format")
    # Any other size-like text (outside the size spans, the drawings and the plan strip's engine part names like "3/4\" Plywood 4×8").
    stray = page.evaluate("""() => { const out = []; const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; if (n.parentElement.closest('[data-size], [data-plan-text], svg, input, [data-yard-making-now], .sr-only')) continue; out.push(n.textContent); } return out; }""")
    for t in stray:
        if LOOSE.search(NOTE_OK.sub("", t)): fails.append(f"{tag}: stray size text {t.strip()!r}")
    # 6B targets: chips, material chips, nav links, Show all.
    want = 44 if W < 1024 else 36
    hs = page.evaluate("""() => [...document.querySelectorAll('header nav a, [data-yard-home-material] button, main section button.rounded-full:not([data-ideas-hero-build]):not([type=submit]), main [aria-expanded]')]
      .filter(e => e.offsetParent).map(e => [e.textContent.trim().slice(0, 24), Math.round(e.getBoundingClientRect().height)])""")
    for name, h in hs:
        if h != want: fails.append(f"{tag}: target {name!r} is {h}px (want {want})")
    # Nothing readable under 13px.
    small = page.evaluate("""() => { const out = new Set(); for (const e of document.querySelectorAll('main *, header *, footer *')) {
        if (!e.offsetParent || e.closest('svg, .sr-only')) continue; const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (own && parseFloat(getComputedStyle(e).fontSize) < 13) out.add(e.textContent.trim().slice(0, 30)); } return [...out]; }""")
    for t in small: fails.append(f"{tag}: text under 13px: {t!r}")
    print(f"{tag}: {len(sizes)} sizes, {len(hs)} targets, CLS {cls:.4f}")

with sync_playwright() as p:
    br = p.chromium.launch()
    for W in (390, 1440):
        for path in ("/", "/ideas"):
            pg = br.new_page(viewport={"width": W, "height": 844 if W < 500 else 900}, is_mobile=W < 500, has_touch=W < 500)
            check(pg, path, W)
            pg.close()
    br.close()
for f in fails: print("FAIL", f)
print("site-sizes:", "PASS" if not fails else f"{len(fails)} failures")
sys.exit(1 if fails else 0)
