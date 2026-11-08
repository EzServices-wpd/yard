"""
Hotfix: on the built app, [data-yard-workbench-title] reads exactly the plan header with a build
(linen: 'Linen · 31 1/2" W × 16" D × 78" H') and "Workbench" on an empty bench. At 1440 (the title is md+).
The Measure readout ([data-yard-measure-readout]) as rendered opens with the header's W × D × H (row 134).

  python3 scripts/e2e/workbench-title.py http://127.0.0.1:8091
Offline + test flags: no AI calls, no log rows. Exit 1 on failure.
"""
import sys, urllib.parse
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
LINEN = "linen closet 31.5 wide 78 tall 16 deep"
WANT = 'Linen · 31 1/2" W × 16" D × 78" H'
fails = []
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(f"{U}/workspace?offline=1&test=1", wait_until="networkidle")
    sel = "[data-yard-workbench-title]"
    pg.wait_for_selector(sel, state="attached")
    empty = pg.inner_text(sel).strip()
    # A fresh browser context has no saved build: the title must say Workbench.
    if empty != "Workbench": fails.append(f"empty bench title {empty!r}")
    pg.goto(f"{U}/workspace?q={urllib.parse.quote(LINEN)}&offline=1&test=1", wait_until="networkidle")
    try:
        pg.wait_for_function("w => document.querySelector('[data-yard-workbench-title]')?.textContent.trim() === w", arg=WANT, timeout=30000)
    except Exception:
        pass
    got = pg.inner_text(sel).strip()
    if got != WANT: fails.append(f"linen title {got!r}, want {WANT!r}")
    print("empty:", repr(empty), "| linen:", repr(got))
    # Row 134: the bench's Measure readout as rendered opens with the header's own W × D × H (same words, same order).
    for q in (LINEN, "filing cabinet 30x30x24 2 doors 2 drawers", "vanity with drawers"):
        pg.goto(f"{U}/workspace?q={urllib.parse.quote(q)}&offline=1&test=1", wait_until="networkidle")
        pg.wait_for_function("() => /·/.test(document.querySelector('[data-yard-workbench-title]')?.textContent || '')", timeout=30000)
        head = pg.inner_text(sel).strip()
        axes = head.split(" · ")[1] if " · " in head else head
        ro = pg.inner_text("[data-yard-measure-readout]").strip()
        if not ro.startswith(axes): fails.append(f"{q}: readout {ro!r} does not open with the header's {axes!r}")
        print(f"{q}: header {head!r} | readout {ro!r}")
    br.close()
for f in fails: print("FAIL", f)
print("workbench-title:", "PASS" if not fails else "FAIL")
sys.exit(1 if fails else 0)
