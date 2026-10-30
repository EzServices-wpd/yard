"""
Ideas cards at 390 (Chief, 10-28), on the built site: every card's size is one line inside its card at 360, 390, 768
and 1440, for the longest sizes any card on the page prints (each is tried in every kind of card: featured, a group's
top row, a search hit), and from 390 up every card drawing is drawn 200px wide or more, where its labels render 12px or more
(scripts/ideas-card-labels.test.ts). No sideways scroll.

  python3 scripts/e2e/ideas-card-fit.py http://127.0.0.1:8091
Exit 1 on any failure.
"""
import sys
from playwright.sync_api import sync_playwright

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
fails = []
FIT = """([longest, minDraw]) => {
  const out = [];
  const fits = (el) => { const a = el.closest('a[data-idea]'), cs = getComputedStyle(a), r = a.getBoundingClientRect(), m = el.getBoundingClientRect();
    return el.getClientRects().length === 1 && m.left >= r.left + parseFloat(cs.paddingLeft) - 0.5 && m.right <= r.right - parseFloat(cs.paddingRight) + 0.5; };
  const cards = [...document.querySelectorAll('a[data-idea] [data-size]')].filter((e) => e.offsetParent);
  for (const el of cards) if (!fits(el)) out.push(`${el.dataset.size}: "${el.textContent}" breaks or leaves its card`);
  // Every kind of card (by its list item's width class) with each of the longest sizes on the page.
  const kinds = new Map();
  for (const el of cards) kinds.set(el.closest('li')?.className ?? 'grid', el);
  for (const [kind, el] of kinds) { const was = el.textContent;
    for (const t of longest) { el.textContent = t; if (!fits(el)) out.push(`"${t}" breaks in a ${kind.slice(0, 40)} card`); }
    el.textContent = was; }
  for (const i of document.querySelectorAll('a[data-idea] .idea-wood')) if (i.offsetParent && i.getBoundingClientRect().width < minDraw) out.push(`${i.closest('a').dataset.idea}: drawing ${Math.round(i.getBoundingClientRect().width)}px wide`);
  if (document.documentElement.scrollWidth > innerWidth) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
  return [cards.length, kinds.size, out];
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for W, H in [(360, 780), (390, 844), (768, 1024), (1440, 900)]:
        ctx = b.new_context(viewport={"width": W, "height": H}, is_mobile=W < 500, has_touch=W < 500, extra_http_headers={"x-yard-test": "1"})
        ctx.route("**/api/ideas-log*", lambda r: r.fulfill(status=204))
        pg = ctx.new_page(); pg.goto(f"{U}/ideas?test=1", wait_until="networkidle"); pg.wait_for_timeout(1000)
        pg.evaluate("() => document.querySelectorAll(\"[data-ideas-show-all][aria-expanded='false']\").forEach(b => b.click())"); pg.wait_for_timeout(300)
        sizes = pg.eval_on_selector_all("[data-size]", "els => [...new Set(els.map(e => e.textContent))]")
        longest = sorted(sizes, key=len, reverse=True)[:6]
        n, k, out = pg.evaluate(FIT, [longest, 199.5 if W >= 390 else 0])
        pg.fill("main input", "bench"); pg.wait_for_timeout(500)
        n2, k2, out2 = pg.evaluate(FIT, [longest, 199.5 if W >= 390 else 0])
        fails += [f"@{W}: {x}" for x in out + [f"search: {y}" for y in out2]]
        if n < 8 or k < 3 or n2 < 1: fails.append(f"@{W}: only {n} cards in {k} kinds, {n2} search cards")
        print(f"@{W}: {n} cards in {k} kinds + {n2} search cards; {len(sizes)} sizes, longest {longest[0]!r}")
        ctx.close()
    b.close()
for f in fails: print("FAIL", f)
print("FAIL" if fails else "PASS", "ideas-card-fit")
sys.exit(1 if fails else 0)
