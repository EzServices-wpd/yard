"""
Refusal surfaces, as rendered: a refused build's tab title names what was asked for and that nothing was built
('Abacus · nothing built · Yard'), never the generic 'Workspace · Yard'; a real build's title is unchanged (linen).

  python3 scripts/e2e/refusal-surfaces.py http://127.0.0.1:8151
Offline + test flags: no AI calls, no log rows. Exit 1 on failure.
"""
import sys, urllib.parse
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8151"
CASES = [
    ("abacus 2 1/8 wide 9 rods", "Abacus · nothing built · Yard"),
    ("bookcase 1/2 wide", "Bookcase · nothing built · Yard"),
    ("linen closet 31.5 wide 78 tall 16 deep", 'Linen · 31 1/2" W × 16" D × 78" H · Yard'),
]
fails = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for q, want in CASES:
        ctx = br.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        pg.goto(f"{U}/workspace?q={urllib.parse.quote(q)}&offline=1&test=1", wait_until="networkidle")
        try:
            pg.wait_for_function("w => document.title === w", arg=want, timeout=30000)
        except Exception:
            pass
        got = pg.title()
        if got != want: fails.append(f"{q}: tab title {got!r}, want {want!r}")
        print(f"{q}: {got!r}")
        ctx.close()
    br.close()
for f in fails: print("FAIL", f)
print("refusal-surfaces:", "PASS" if not fails else "FAIL")
sys.exit(1 if fails else 0)
