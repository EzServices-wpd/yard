"""
No third-party runtime loads (Critic row 113): open every page at desk and phone size, with the CSP from vercel.json
enforced on each document, and fail on any request to another origin, any CSP violation, or a font that is not ours.

Usage: python3 scripts/e2e/no-third-party.py http://127.0.0.1:8131
Pages use ?test=1&offline=1; site data is cleared per page.
"""
import json, sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8131").rstrip("/")
PAGES = ["/", "/ideas", "/about", "/privacy", "/workspace?q=linen%20closet%2031.5%20wide%2078%20tall%2016%20deep"]
VIEWS = {"desk": dict(viewport={"width": 1280, "height": 800}), "phone": dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)}
cfg = json.load(open("vercel.json"))
CSP = next(x["value"] for h in cfg["headers"] for x in h["headers"] if x["key"].lower().startswith("content-security-policy") and "default-src" in x["value"])
origin = urlparse(BASE).netloc
fails, seen = [], 0
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for vname, vopts in VIEWS.items():
        for page in PAGES:
            ctx = b.new_context(**vopts)
            ctx.add_init_script("try{localStorage.clear();sessionStorage.clear()}catch(e){};window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")
            pg = ctx.new_page()
            off = []
            def route(r):
                u = urlparse(r.request.url)
                if u.scheme in ("data", "blob") or u.netloc == origin:
                    if r.request.resource_type == "document":
                        resp = r.fetch(headers={**r.request.headers, "x-yard-test": "1"})
                        r.fulfill(response=resp, headers={**resp.headers, "content-security-policy": CSP})
                    else:
                        r.continue_(headers={**r.request.headers, "x-yard-test": "1"})
                else:
                    off.append(f"{r.request.resource_type} {r.request.url[:120]}")
                    r.abort()
            pg.route("**/*", route)
            sep = "&" if "?" in page else "?"
            pg.goto(f"{BASE}{page}{sep}test=1&offline=1", wait_until="load")
            pg.wait_for_timeout(6000)
            fonts = pg.evaluate("()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)")
            csp = pg.evaluate("()=>window.__csp")
            seen += 1
            for o in off: fails.append(f"{vname} {page}: third-party {o}")
            for c in csp: fails.append(f"{vname} {page}: CSP violation {c}")
            print(f"{vname:5} {page[:40]:40} off-site {len(off)}  csp {len(csp)}  fonts {sorted(set(fonts))}", flush=True)
            ctx.close()
    b.close()
for f in fails: print("FAILING:", f)
print("PASS" if not fails else "FAIL", f"{seen} pages, {len(fails)} failing")
sys.exit(1 if fails else 0)
