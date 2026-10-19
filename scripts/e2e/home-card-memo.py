"""Home cards: the drawing's SVG nodes survive the idle re-render ~1 s after hydration, and a door swing
started before it still finishes.

  python3 scripts/e2e/home-card-memo.py [base_url]     (default http://127.0.0.1:8090; exit 1 on failure)

Before the fix, the idle stock-merge load re-rendered the page and React re-set each card's innerHTML, which
swapped the <svg> (and cancelled any running door swing) about a second after load.
"""
import sys
from playwright.sync_api import sync_playwright

U = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
# Tag each card's <svg> before hydration finishes; count every time a card's children are replaced.
INIT = """window.__swaps=0;
new MutationObserver(ms=>{for(const m of ms) if(m.type==='childList' && m.target.matches && m.target.matches('[data-yard-showcase]') && m.removedNodes.length) window.__swaps++})
 .observe(document,{subtree:true,childList:true});"""
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    try:
        c = b.new_context(viewport={"width": 1280, "height": 800})
        c.route("**/api/ideas-log*", lambda r: r.fulfill(status=204))
        c.add_init_script(INIT)
        pg = c.new_page()
        pg.goto(U + "/?test=1&offline=1", wait_until="domcontentloaded")
        pg.wait_for_function("!!document.querySelector('[data-yard-showcase=pocket] svg')")
        pg.evaluate("document.querySelectorAll('[data-yard-showcase] svg').forEach(s=>s.__tag=1)")
        # Start a door swing by hand right away (before the idle re-render): a 2.5 s animation on every door leaf.
        started = pg.evaluate("""() => { window.__anims=[...document.querySelectorAll('[data-yard-showcase=pocket] g[data-hinge-axis]')]
          .map(g=>g.animate([{opacity:1},{opacity:0.99},{opacity:1}],{duration:2500})); return window.__anims.length }""")
        if not started:
            fails.append("no door leaves on the pocket vanity card")
        # The idle load fires by ~1 s (requestIdleCallback timeout 4 s); wait past it and past the swing.
        pg.wait_for_timeout(4500)
        kept = pg.evaluate("[...document.querySelectorAll('[data-yard-showcase] svg')].map(s=>!!s.__tag)")
        swaps = pg.evaluate("window.__swaps")
        states = pg.evaluate("window.__anims.map(a=>a.playState+':'+a.effect.target.isConnected)")
        if not kept or not all(kept):
            fails.append(f"card svg replaced after load: kept={kept}")
        if swaps:
            fails.append(f"{swaps} card drawing child swaps after load")
        if any(s != "finished:true" for s in states):
            fails.append(f"door swing did not finish on a live node: {states}")
        print("kept", kept, "swaps", swaps, "swings", states)
    finally:
        b.close()
print("FAIL: " + "; ".join(fails) if fails else "PASS")
sys.exit(1 if fails else 0)
