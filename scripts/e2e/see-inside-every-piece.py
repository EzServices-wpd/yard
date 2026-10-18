"""See inside: when exploded, you can really see every piece (EPV, PLAN §1; Ezra's hard rule, 2026-10-17).

Usage: python3 scripts/e2e/see-inside-every-piece.py http://127.0.0.1:8131 [--out DIR] [--only dresser,desk] [--views desk,phone] [--no-rm] [--json FILE]

For each build at 1280×800 and 390×844: load /workspace?offline=1&test=1&q=… (x-yard-test: 1 on this origin only),
turn on See inside with the real tool button, wait for window.__yardExplode.settled, then for EVERY engine part
(project.panels, live names) measure from an ID buffer of the live scene (same renderer, camera and pose):
  (a) visible / footprint >= 30%      footprint = the part rendered alone (soloPass), visible = its ids in idPass
  (b) visible >= 200 CSS px²
  (c) no single other part covers > 60% of its footprint
  (d) all 8 corners inside the free stage rect (safeRect: not off-screen, not under the bench panel or tray)
Built like drawer-cover.py: the truth is per pixel, from the engine's own parts. Also:
  - canary: the result card (parts, price), the plan's cut list / Buy / totals and every panel are byte-identical
    before and after See inside; the linen run also checks 31 1/2 x 16 x 78, 11 parts, $183.70.
  - reduced motion: the same final pose (every part's projected corners within 0.75 px of the motion run).
Expected-stepper parts (PLAN §4: pass per stepper group, PR 2) are reported as STEP, not as failures.
Exits 1 on any failure that is not expected-stepper.
"""
import argparse, json, os, re, sys, time
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("base", nargs="?", default="http://127.0.0.1:8131")
ap.add_argument("--out", default="")
ap.add_argument("--only", default="")
ap.add_argument("--views", default="desk,phone")
ap.add_argument("--no-rm", action="store_true")
ap.add_argument("--json", default="")
ap.add_argument("--strict", action="store_true", help="expected-stepper parts fail too")
A = ap.parse_args()
BASE = A.base.rstrip("/")

LINEN_Q = "linen closet 31.5 wide 78 tall 16 deep"
BUILDS = [
    ("dresser", "3 drawer dresser"),
    ("nightstand", "nightstand with 2 drawers"),
    ("desk", '60" desk with drawers'),
    ("filing", "filing cabinet 2 drawers"),
    ("pocket-vanity", "pocket vanity"),
    ("linen", LINEN_Q),
    ("pantry", "pantry cabinet 30 wide 84 tall 18 deep"),
    ("jewelry", "jewelry box with drawers"),
]
VIEWS = {"desk": (1280, 800, False), "phone": (390, 844, True)}
# PLAN §4 "Builds that need the stepper": these parts may fail in the whole-model frame; they must pass per
# stepper group (PR 2). Pocket vanity: too many small parts for one frame at 104" tall. Jewelry box: the
# hinges are tiny. Desk: the toekicks. Filing cabinet: Shelf 1 runs through Drawer 1 in the engine (§5).
EXPECTED_STEPPER = {
    "pocket-vanity": r".",
    "jewelry": r"hinge",
    "desk": r"toekick",
    "filing": r"^shelf 1$",
}
N, M, O = 0.30, 200, 0.60

MEASURE = r"""
() => {
  const X = window.__yardExplode;
  const { w: W, h: H } = X.viewport;
  const ids = X.idPass();
  const safe = X.safeRect;
  const rows = [];
  X.parts.forEach((p, i) => {
    const id = i + 1;
    const solo = X.soloPass(p.id);
    let foot = 0, vis = 0; const cov = new Map();
    for (let k = 0; k < solo.length; k++) {
      if (solo[k] !== id) continue;
      foot++;
      const o = ids[k];
      if (o === id) vis++; else if (o) cov.set(o, (cov.get(o) || 0) + 1);
    }
    let top = 0, by = 0;
    for (const [o, n] of cov) if (n > top) { top = n; by = o; }
    const cs = X.corners(p.id);
    const off = safe ? cs.filter(c => c.x < safe.left - 0.5 || c.x > safe.right + 0.5 || c.y < safe.top - 0.5 || c.y > safe.bottom + 0.5).length : -1;
    rows.push({ id: p.id, name: p.name, role: p.role, group: p.group, foot, vis, frac: foot ? vis / foot : 0,
      cover: foot ? top / foot : 0, by: by ? X.parts[by - 1].name : null, off, corners: cs.map(c => [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100]) });
  });
  return { W, H, safe, camera: X.camera, solved: X.solved, groups: X.stepper.groups, rows };
}
"""

def route_for(page):
    def handle(r):
        if r.request.url.startswith(BASE):
            r.continue_(headers={**r.request.headers, "x-yard-test": "1"})
        else:
            r.continue_()
    page.route("**/*", handle)

def click_tool(pg, tool):
    for _ in range(4):
        b = pg.locator(f'[data-yard-tool="{tool}"]:visible').first
        if b.count():
            b.click(); pg.wait_for_timeout(250)
            m = pg.locator('[data-yard-more="1"][aria-expanded="true"]:visible').first
            if m.count(): m.click(); pg.wait_for_timeout(250)
            return True
        s = pg.locator('[data-yard-tools-show]:visible').first
        if s.count(): s.click(); pg.wait_for_timeout(300); continue
        m = pg.locator('[data-yard-more="1"]:visible').first
        if m.count(): m.click(); pg.wait_for_timeout(400)
    return False

def verdict(r, slug):
    why = []
    if r["foot"] == 0: why.append("not drawn")
    else:
        if r["frac"] < N: why.append(f"a {r['frac']*100:.0f}%")
        if r["vis"] < M: why.append(f"b {r['vis']}px")
        if r["cover"] > O: why.append(f"c {r['cover']*100:.0f}% by {r['by']}")
    if r["off"] != 0: why.append(f"d {r['off']} corners off")
    if not why: return "PASS", why
    pat = EXPECTED_STEPPER.get(slug)
    if pat and not A.strict and re.search(pat, r["name"], re.I): return "STEP", why
    return "FAIL", why

def run(b, slug, q, vname, rm):
    w, h, mobile = VIEWS[vname]
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, reduced_motion="reduce" if rm else "no-preference")
    pg = ctx.new_page(); pg.set_default_timeout(120000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    route_for(pg)
    pg.goto(f"{BASE}/workspace?offline=1&test=1&q=" + q.replace(" ", "%20").replace('"', "%22"))
    pg.wait_for_function("/^(done|skip)/.test(document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal')||'')", timeout=120000)
    pg.wait_for_function("() => !!window.__yardExplode", timeout=30000)
    pg.wait_for_timeout(800)
    pg.keyboard.press("Escape")
    before = pg.evaluate("() => window.__yardExplode.canary()")
    card0 = pg.evaluate("() => document.querySelector('[data-yard-result-card]')?.textContent || ''")
    title0 = pg.evaluate("() => document.querySelector('[data-yard-workbench-title]')?.textContent || ''")
    if not click_tool(pg, "inside"): raise RuntimeError("See inside tool not found")
    t0 = time.time()
    pg.wait_for_function("() => window.__yardExplode && window.__yardExplode.settled === true", timeout=60000)
    settle_ms = int((time.time() - t0) * 1000)
    # A late card resize (fonts, tray) refits with a short glide: measure only once the frame is current and settled.
    for _ in range(20):
        pg.wait_for_timeout(400)
        if pg.evaluate("() => window.__yardExplode.settled === true && window.__yardExplode.frameFresh === true"): break
    m = pg.evaluate(MEASURE)
    shot = ""
    if A.out:
        shot = os.path.join(A.out, f"{slug}-{vname}{'-rm' if rm else ''}.png"); pg.screenshot(path=shot)
    after = pg.evaluate("() => window.__yardExplode.canary()")
    title1 = pg.evaluate("() => document.querySelector('[data-yard-workbench-title]')?.textContent || ''")
    ctx.close()
    return {"slug": slug, "view": vname, "rm": rm, "settle_ms": settle_ms, "m": m, "canary_same": before == after,
            "card": card0, "title": title0, "title_after": title1, "errs": errs, "shot": shot}

only = [s for s in A.only.split(",") if s]
views = [v for v in A.views.split(",") if v]
results, fails = [], []
if A.out: os.makedirs(A.out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    try:
        for slug, q in BUILDS:
            if only and slug not in only: continue
            for v in views:
                try:
                    r = run(b, slug, q, v, False)
                except Exception as e:
                    fails.append(f"{slug} {v}: run error {str(e)[:160]}"); print("ERROR", slug, v, str(e)[:300], flush=True); continue
                rows = r["m"]["rows"]
                for row in rows: row["v"], row["why"] = verdict(row, slug)
                if not r["canary_same"]: fails.append(f"{slug} {v}: cut list / Buy / price / parts changed by See inside")
                if r["errs"]: fails.append(f"{slug} {v}: page errors {r['errs'][:2]}")
                if slug == "linen":
                    if "11 parts" not in r["card"] or "$183.70" not in r["card"]: fails.append(f"linen {v}: card is {r['card']!r}, want 11 parts and $183.70")
                    if v == "desk" and r["title"] != 'Linen · 31 1/2" W × 16" D × 78" H': fails.append(f"linen header {r['title']!r}")
                if not A.no_rm:
                    try:
                        rr = run(b, slug, q, v, True)
                        dmax = 0.0
                        mc = {x["id"]: x["corners"] for x in rows}
                        for x in rr["m"]["rows"]:
                            for (a, c) in zip(mc.get(x["id"], []), x["corners"]):
                                dmax = max(dmax, abs(a[0] - c[0]), abs(a[1] - c[1]))
                        r["rm_dmax"] = round(dmax, 2)
                        if dmax > 0.75: fails.append(f"{slug} {v}: reduced motion lands on a different pose ({dmax:.2f} px)")
                    except Exception as e:
                        fails.append(f"{slug} {v}: reduced-motion run error {str(e)[:160]}")
                n = len(rows); np_ = sum(x["v"] == "PASS" for x in rows); ns = sum(x["v"] == "STEP" for x in rows)
                bad = [x for x in rows if x["v"] == "FAIL"]
                for x in bad: fails.append(f"{slug} {v}: {x['name']} ({', '.join(x['why'])})")
                r["pass"], r["step"], r["total"] = np_, ns, n
                results.append(r)
                print(f"{slug:14s} {v:5s} {np_:2d}/{n:2d} pass  step {ns:2d}  fail {len(bad):2d}  settle {r['settle_ms']}ms  rm {r.get('rm_dmax','-')}  "
                      + "; ".join(f"{x['name']}: {', '.join(x['why'])}" for x in rows if x["v"] != "PASS"), flush=True)
    finally:
        b.close()

if A.json:
    json.dump(results, open(A.json, "w"), indent=1)
print()
print("| build | view | pass | stepper | fail |")
print("|---|---|---|---|---|")
for r in results: print(f"| {r['slug']} | {r['view']} | {r['pass']}/{r['total']} | {r['step']} | {r['total'] - r['pass'] - r['step']} |")
for f in fails: print("FAILING:", f)
print("FAIL" if fails else "PASS", f"{len(results)} runs, {len(fails)} failing")
sys.exit(1 if fails else 0)
