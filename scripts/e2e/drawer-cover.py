"""Open drawers and fixed parts paint in true 3D order, both ways, on every home card that has drawers.

Usage: python3 scripts/e2e/drawer-cover.py http://127.0.0.1:8097
For each drawer card, three moments: full open on hover, the middle of the once-play's hold, and reduced motion
(the instant toggle). Inside every painted face of each open drawer it samples points and asks the browser which
part is painted on top there (elementsFromPoint, by fill; a lone outline stroke gets no verdict). The truth is per
pixel, from the engine's 3D parts (drawer-pairs.ts): the view ray through the point is cut by every part's box (open
drawers moved out by their slide), and the nearest box must be the one painted. A sample gets a verdict only where the
truth holds 1.5 px to either side (corners and grazing rays are antialiasing, counted as edge-only). (a) A fixed part painted where an open
drawer is nearest fails; (b) the other way, sampled inside every painted face of every fixed part: an open drawer
painted where a fixed part is nearest fails (the desk top, the vanity counter). Ties (shared faces) and non-box parts
get no verdict. Any open
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
(card, truth) => {
  // Per-pixel 3D truth: the overview's projection (fit from the model's extremes, as the card does) turns a screen
  // point into a view ray along (1,1,1); each part's box (open drawers moved out by their slide) is cut by that ray,
  // and the box whose exit point is nearest the viewer is what must show there.
  const specs = JSON.parse(card.getAttribute('data-yard-drawers') || '[]');
  const ids = new Set(specs.flatMap(s => s.ids));
  const svg = card.querySelector('svg[data-yard-overview], svg');
  const style = document.getElementById('cover-check') || Object.assign(document.head.appendChild(document.createElement('style')), { id: 'cover-check' });
  style.textContent = 'svg [data-part], svg [data-part] * { pointer-events: visiblePainted !important; }';
  const name = (g) => g ? (g.getAttribute('data-part-name') || g.querySelector('title')?.textContent || g.getAttribute('data-part')) : null;
  const C = Math.cos(Math.PI / 6);
  const view = truth.view;
  const bbOf = id => { const bs = [...card.querySelectorAll(`g[data-part="${CSS.escape(id)}"]:not([data-drawer-copy])`)].map(g => g.getBBox()); return { l: Math.min(...bs.map(b => b.x)), r: Math.max(...bs.map(b => b.x + b.width)), t: Math.min(...bs.map(b => b.y)) }; };
  const L = bbOf(view[0][0]), R = bbOf(view[1][0]), T = bbOf(view[2][0]);
  const k = (R.r - L.l) / (view[1][1] - view[0][1]), ox = L.l - k * view[0][1], oy = T.t - k * view[2][1];
  const moved = (g) => { const t = getComputedStyle(g).transform; if (t === 'none') return false; const m = new DOMMatrix(t); return Math.hypot(m.e, m.f) > 0.5; };
  const openIds = new Set([...ids].filter(id => [...card.querySelectorAll(`g[data-part="${CSS.escape(id)}"]`)].some(moved)));
  const boxes = Object.entries(truth.boxes).map(([id, v]) => { const b = [...v.b]; if (openIds.has(id)) { b[2] += truth.openOf[id]; b[5] += truth.openOf[id]; } return { id, b, plain: v.plain }; });
  const svgCTM = svg.getScreenCTM().inverse();
  // Nearest box along the ray through screen point (x, y); null if none, or if the nearest two tie (a shared face).
  const nearest = (x, y) => {
    const q = new DOMPoint(x, y).matrixTransform(svgCTM);
    const u = (q.x - ox) / k, v = (q.y - oy) / k;
    const base = [(u / C + 2 * v) / 2, 0, (2 * v - u / C) / 2];
    const hits = [];
    for (const { id, b, plain } of boxes) {
      const sIn = Math.max(b[0] - base[0], b[1] - base[1], b[2] - base[2]), sOut = Math.min(b[3] - base[0], b[4] - base[1], b[5] - base[2]);
      if (sIn < sOut - 1e-3) hits.push({ id, s: sOut, plain });
    }
    hits.sort((a, b) => b.s - a.s);
    if (!hits.length || !hits[0].plain) return null;
    if (hits[1] && hits[0].s - hits[1].s < 0.05) return null;
    return hits[0].id;
  };
  let edges = 0;
  // The part painted on top here, by its fill. Where only an outline stroke reaches (a ~1 px line on an edge two
  // parts share) it is line work, not cover: no verdict for that sample.
  const topPart = (x, y) => {
    const e = document.elementsFromPoint(x, y).find(e => svg.contains(e) && e.closest('g[data-part]'));
    if (!e) return null;
    if (e.isPointInFill) {
      const m = e.getScreenCTM(); const q = new DOMPoint(x, y).matrixTransform(m.inverse());
      const pt = svg.createSVGPoint(); pt.x = q.x; pt.y = q.y;
      if (!e.isPointInFill(pt)) { edges++; return null; }
    }
    return e.closest('g[data-part]');
  };
  const pts = (sh, f) => {
    if (!sh.isPointInFill) return;
    const r = sh.getBoundingClientRect(), m = sh.getScreenCTM();
    if (!m || r.width < 2 || r.height < 2) return;
    const inv = m.inverse();
    for (let x = r.left + 1; x < r.right - 1; x += 3) for (let y = r.top + 1; y < r.bottom - 1; y += 3) {
      const p = new DOMPoint(x, y).matrixTransform(inv);
      const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y;
      if (sh.isPointInFill(pt)) f(x, y);
    }
  };
  const bad = {}; let samples = 0, samplesB = 0, judged = 0;
  // Only samples where the 3D truth holds 1.5 px to either side get a verdict (where faces meet at a corner, or a ray
  // just grazes a box edge, a pixel is antialiasing, not order). What is painted is not smoothed: a wrong strip as thin
  // as a divider's front edge still fails.
  const N4 = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]];
  const judge = (x, y, drawerSide) => {
    const top = topPart(x, y); if (!top) return;
    const tid = top.getAttribute('data-part'), want = nearest(x, y);
    if (N4.some(([a, b]) => nearest(x + a, y + b) !== want)) { edges++; return; }
    if (!want || want === tid) { if (want) judged++; return; }
    judged++;
    const wantOpen = openIds.has(want), topOpen = openIds.has(tid);
    // (a) a fixed part painted where an open drawer is nearest; (b) an open drawer painted where a fixed part is nearest.
    if (wantOpen && !ids.has(tid)) { const n = `(a) ${name(top)} over ${want}`; bad[n] = (bad[n] || 0) + 1; }
    else if (topOpen && !ids.has(want)) { const n = `(b) ${name(top)} over ${want}`; bad[n] = (bad[n] || 0) + 1; }
  };
  // (a) inside every painted face of each open drawer part; (b) inside every painted face of each fixed part.
  for (const g of card.querySelectorAll('g[data-part]')) {
    const id = g.getAttribute('data-part');
    if (g.hasAttribute('data-drawer-copy')) continue;
    const isDrawer = ids.has(id);
    if (isDrawer && !openIds.has(id)) continue;
    for (const sh of g.querySelectorAll('path, polygon, rect')) pts(sh, (x, y) => { if (isDrawer) samples++; else samplesB++; judge(x, y, isDrawer); });
  }
  style.textContent = '';
  return { samples, samplesB, judged, edges, open: openIds.size, bad };
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
    NEAR = {k: {"boxes": PAIRS[k]["boxes"], "openOf": PAIRS[k]["openOf"], "view": PAIRS[k]["view"]} for k in ids}
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
        r = c.evaluate(CHECK, NEAR[ids[i]]) if n else {"samples": 0, "samplesB": 0, "bad": {"once-play already done": 1}}
        if not r.get("open"): r["bad"]["no drawer open"] = 1
        rows.append((i, "once hold", r)); fails += [(i, "once hold", r)] if r["bad"] else []
        c.evaluate("c => { for (const g of c.querySelectorAll('g[data-part]')) for (const a of g.getAnimations()) a.finish(); }")
        pg.wait_for_timeout(300)
        shut_order[i] = c.evaluate(ORDER)
        # Hover: full open (fill forwards), then shut.
        btn = c.locator("xpath=ancestor-or-self::*[self::button or self::a][1]")
        target = btn if btn.count() else c
        target.hover(); pg.wait_for_timeout(900 + 70 * 6 + 400)
        r = c.evaluate(CHECK, NEAR[ids[i]])
        if not r.get("open"): r["bad"]["no drawer open"] = 1
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
        if not r.get("open"): r["bad"]["no drawer open"] = 1
        rows.append((i, "reduced open", r)); fails += [(i, "reduced open", r)] if r["bad"] else []
        pg.mouse.move(2, 2); pg.wait_for_timeout(300)
        if c.evaluate(ORDER) != before:
            fails.append((i, "reduced order after shut", {"samples": 0, "bad": {"paint order not restored": 1}}))
    b.close()

for i, k, r in fails:
    print("FAILING:", ids[i] if isinstance(i, int) else i, k, r["bad"])
print("3D: no open drawer part overlaps a fixed part" if not any(k == "3D overlap" for _, k, _ in fails) else "3D: OVERLAPS")
for i, k, r in rows:
    print(f"card {ids[i]:10s} {k:13s} open {r.get('open', 0):2d} drawer-px {r['samples']:5d} fixed-px {r.get('samplesB', 0):5d} judged {r.get('judged', 0):5d} edge-only {r.get('edges', 0):4d} wrong {r['bad'] or '-'}")
print("FAIL" if fails else "PASS", f"{len(rows)} checks, {len(fails)} failing")
sys.exit(1 if fails else 0)
