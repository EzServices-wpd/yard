"""No fixed part is painted over an open drawer, on every home card that has drawers.

Usage: python3 scripts/e2e/drawer-cover.py http://127.0.0.1:8097
For each drawer card, three moments: full open on hover, the middle of the once-play's hold, and reduced motion
(the instant toggle). Inside every painted face of each open drawer it samples points and asks the browser which
part is on top there (elementsFromPoint). A fixed part on top is a failure only if the engine's 3D parts say the open
drawer part is in front of it (drawer-pairs.ts; a desk top overhanging an open drawer may rightly hide it). Any open
drawer part that overlaps a fixed part in 3D is a failure too (a drawer sliding through solid wood). After shutting, the
drawing's own paint order must be back. Exits 1 on any failure.
"""
import json, os, subprocess, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8097").rstrip("/")
# 3D truth from the engine's own parts: per open drawer part, the fixed parts it is in front of; and any overlap.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAIRS = json.loads(subprocess.run(["npx", "tsx", "scripts/e2e/drawer-pairs.ts"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

CHECK = r"""
(card, nearer) => {
  const specs = JSON.parse(card.getAttribute('data-yard-drawers') || '[]');
  const ids = new Set(specs.flatMap(s => s.ids));
  const svg = card.querySelector('svg[data-yard-overview], svg');
  const style = document.getElementById('cover-check') || Object.assign(document.head.appendChild(document.createElement('style')), { id: 'cover-check' });
  style.textContent = 'svg [data-part], svg [data-part] * { pointer-events: visiblePainted !important; }';
  const name = (g) => g ? (g.getAttribute('data-part-name') || g.querySelector('title')?.textContent || g.getAttribute('data-part')) : null;
  const bad = {}; let samples = 0;
  const drawerShapes = [...ids].flatMap(id => [...card.querySelectorAll(`g[data-part="${CSS.escape(id)}"]`)]).flatMap(g => [...g.querySelectorAll('path, polygon, rect')].map(sh => ({ g, sh })));
  // Was this screen point inside the drawer when shut? (Undo the group's current slide, test the shapes' fills.)
  const wasShut = (x, y, dx, dy) => drawerShapes.some(({ sh }) => {
    const m = sh.getScreenCTM(); if (!m || !sh.isPointInFill) return false;
    const q = new DOMPoint(x - dx, y - dy).matrixTransform(m.inverse());
    const pt = svg.createSVGPoint(); pt.x = q.x; pt.y = q.y; return sh.isPointInFill(pt);
  });
  for (const id of ids) {
    for (const g of card.querySelectorAll(`g[data-part="${CSS.escape(id)}"]`)) {
      const tm = new DOMMatrix(getComputedStyle(g).transform === 'none' ? undefined : getComputedStyle(g).transform);
      const sc = svg.getScreenCTM(); const k = sc ? Math.hypot(sc.a, sc.b) : 1; // CSS px on the group → screen px
      const dx = tm.e * k, dy = tm.f * k;
      if (Math.hypot(dx, dy) < 2) continue; // not open
      for (const sh of g.querySelectorAll('path, polygon, rect')) {
        if (!sh.isPointInFill) continue;
        const r = sh.getBoundingClientRect(), m = sh.getScreenCTM();
        if (!m || r.width < 2 || r.height < 2) continue;
        const inv = m.inverse();
        for (let x = r.left + 1; x < r.right - 1; x += 3) for (let y = r.top + 1; y < r.bottom - 1; y += 3) {
          const p = new DOMPoint(x, y).matrixTransform(inv);
          const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
          if (!sh.isPointInFill(pt)) continue;
          samples++;
          const top = document.elementsFromPoint(x, y).find(e => svg.contains(e) && e.closest('g[data-part]'));
          const part = top?.closest('g[data-part]');
          // A fixed part on top here is wrong only if, in 3D, this open drawer part is in front of it.
          const fid = part && part.getAttribute('data-part');
          if (fid && !ids.has(fid) && (nearer[id] || []).includes(fid)) { const n = name(part); bad[n] = (bad[n] || 0) + 1; }
        }
      }
    }
  }
  style.textContent = '';
  return { samples, bad };
}
"""

ORDER = r"""
(card) => [...card.querySelectorAll('g[data-part]')].map(g => g.getAttribute('data-part')).join(',')
"""

def cards(pg):
    pg.wait_for_selector("[data-yard-drawers]", state="attached", timeout=60000)
    out = []
    for c in pg.locator("[data-yard-drawers]").all():
        if json.loads(c.get_attribute("data-yard-drawers") or "[]"):
            out.append(c)
    return out

def label(c):
    return c.evaluate("c => c.closest('[data-show-id]')?.getAttribute('data-show-id') || c.querySelector('[data-part]')?.closest('figure, li, div')?.textContent?.slice(0,30) || '?'")

fails, rows = [], []
for k, v in PAIRS.items():
    for dr in v["drawers"]:
        if dr["through"]:
            fails.append((k, "3D overlap", {"samples": 0, "bad": {t: 1 for t in dr["through"]}}))
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. Motion: the once-play's hold, then full open on hover, then shut.
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    pg.goto(BASE + "/?offline=1", wait_until="networkidle")
    cs = cards(pg)
    ids = [c.get_attribute("data-yard-showcase") or str(i) for i, c in enumerate(cs)]
    NEAR = {k: {pid: v for dr in PAIRS.get(k, {}).get("drawers", []) for pid, v in dr["nearer"].items()} for k in ids}
    shut_order = {}
    for i, c in enumerate(cs):
        c.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        shut_order[i] = None
    # Freeze every card's once-play as soon as it starts, so each one can be checked at the middle of its hold.
    pg.wait_for_function("() => document.getAnimations().some(a => a.effect && a.effect.getTiming().duration === 3000)", timeout=15000)
    pg.evaluate("() => { for (const a of document.getAnimations()) if (a.effect.getTiming().duration === 3000) a.pause(); }")
    for i, c in enumerate(cs):
        c.scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        # Once-play: pin every drawer animation in this card at the middle of its hold (fully open).
        n = c.evaluate("""c => { let n = 0; for (const g of c.querySelectorAll('g[data-part]')) for (const a of g.getAnimations()) {
            const t = a.effect.getTiming(); if (t.duration !== 3000) continue; a.pause(); a.currentTime = t.delay + 1500; n++; } return n; }""")
        pg.wait_for_timeout(400)
        r = c.evaluate(CHECK, NEAR[ids[i]]) if n else {"samples": 0, "bad": {}, "note": "once-play already done"}
        rows.append((i, "once hold", r)); fails += [(i, "once hold", r)] if r["bad"] else []
        c.evaluate("c => { for (const g of c.querySelectorAll('g[data-part]')) for (const a of g.getAnimations()) a.finish(); }")
        pg.wait_for_timeout(300)
        shut_order[i] = c.evaluate(ORDER)
        # Hover: full open (fill forwards), then shut.
        btn = c.locator("xpath=ancestor-or-self::*[self::button or self::a][1]")
        target = btn if btn.count() else c
        target.hover(); pg.wait_for_timeout(900 + 70 * 6 + 400)
        r = c.evaluate(CHECK, NEAR[ids[i]])
        rows.append((i, "hover open", r)); fails += [(i, "hover open", r)] if r["bad"] else []
        pg.mouse.move(2, 2); pg.wait_for_timeout(700 + 70 * 6 + 500)
        if c.evaluate(ORDER) != shut_order[i]:
            fails.append((i, "order after shut", {"samples": 0, "bad": {"paint order not restored": 1}}))
    pg.close()
    # 2. Reduced motion: the instant toggle on hover.
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    pg = ctx.new_page()
    pg.goto(BASE + "/?offline=1", wait_until="networkidle")
    cs = cards(pg)
    for i, c in enumerate(cs):
        c.scroll_into_view_if_needed(); pg.wait_for_timeout(400)
    for i, c in enumerate(cs):
        c.scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        before = c.evaluate(ORDER)
        btn = c.locator("xpath=ancestor-or-self::*[self::button or self::a][1]")
        (btn if btn.count() else c).hover(); pg.wait_for_timeout(300)
        r = c.evaluate(CHECK, NEAR[ids[i]])
        rows.append((i, "reduced open", r)); fails += [(i, "reduced open", r)] if r["bad"] else []
        pg.mouse.move(2, 2); pg.wait_for_timeout(300)
        if c.evaluate(ORDER) != before:
            fails.append((i, "reduced order after shut", {"samples": 0, "bad": {"paint order not restored": 1}}))
    b.close()

for i, k, r in fails:
    print("FAILING:", ids[i] if isinstance(i, int) else i, k, r["bad"])
print("3D: no open drawer part overlaps a fixed part" if not any(k == "3D overlap" for _, k, _ in fails) else "3D: OVERLAPS")
for i, k, r in rows:
    print(f"card {ids[i]:10s} {k:13s} samples {r['samples']:5d} covered-by {r['bad'] or '-'}")
print("FAIL" if fails else "PASS", f"{len(rows)} checks, {len(fails)} failing")
sys.exit(1 if fails else 0)
