"""
Repeated size steps on a build (hotfix, Oct 16): Wider, Narrower, Taller x5 each, at 390 and 1440, for
linen, a bookshelf and the canary. After every step: the reveal finishes, no console errors, a model is
on screen (wood pixels inside the model's projected box), nothing in it renders black, and the camera
is framed: every corner of the whole model's bounding box, projected through the live camera (read from
three's render call), lies in front of it and inside the canvas with a margin (NDC ±0.97), so a close-up
of the doors fails. Settles on the new build's own reveal (a rebuild remounts the canvas).

  python3 scripts/e2e/refine-steps.py http://127.0.0.1:8091 [out_dir]
Exit 1 on any failure. Offline + test flags: no AI calls, no log rows.
"""
import json, re, sys, io
from playwright.sync_api import sync_playwright
from PIL import Image

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
BUILDS = {
    "linen": "linen closet 31.5 wide 78 tall 16 deep",
    "bookshelf": "bookshelf 36x12x72",
    "canary": "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
}
import os
REPS = int(os.environ.get("REPS", "5"))
STEPS = ["Wider"] * REPS + ["Narrower"] * REPS + ["Taller"] * REPS
if os.environ.get("ONLY"): BUILDS = {k: v for k, v in BUILDS.items() if k in os.environ["ONLY"].split(",")}
CPU = int(os.environ.get("CPU", "1"))  # CPU=6 approximates a loaded box / slow phone
SETTLE_MS = int(os.environ.get("SETTLE_MS", "1500"))
WIDTHS = tuple(int(w) for w in os.environ.get("WIDTHS", "390,1440").split(","))
# Live camera + scene, read from three's own render call (three announces its renderer to a devtools hook).
HOOK = """window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const r=e.detail;if(r&&r.isWebGLRenderer&&!r.__w){r.__w=1;const o=r.render.bind(r);r.render=function(s,c){if(s&&s.isScene){window.__scene=s;window.__cam=c}return o(s,c)}}});"""
# The whole model's box (floor and shadow planes excluded), projected through the live camera.
BOUNDS = r"""(()=>{const s=window.__scene,cam=window.__cam;if(!s||!cam)return null;const V=cam.position.constructor;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],n=0;
s.updateMatrixWorld(true);cam.updateMatrixWorld(true);s.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry)return;let p=o;while(p){if(!p.visible)return;p=p.parent}const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;if(!b||!isFinite(b.min.x))return;
const sz=[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z];if(Math.max(...sz)>1500)return;if(new V(0,b.min.y,0).applyMatrix4(o.matrixWorld).y<-1)return;
for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new V(x,y,z).applyMatrix4(o.matrixWorld);mn=[Math.min(mn[0],v.x),Math.min(mn[1],v.y),Math.min(mn[2],v.z)];mx=[Math.max(mx[0],v.x),Math.max(mx[1],v.y),Math.max(mx[2],v.z)]}n++});
if(!n)return {meshes:0};let lo=[9,9],hi=[-9,-9],behind=0;for(const x of [mn[0],mx[0]])for(const y of [mn[1],mx[1]])for(const z of [mn[2],mx[2]]){const v=new V(x,y,z);if(v.clone().applyMatrix4(cam.matrixWorldInverse).z>0)behind++;v.project(cam);lo=[Math.min(lo[0],v.x),Math.min(lo[1],v.y)];hi=[Math.max(hi[0],v.x),Math.max(hi[1],v.y)]}
const r=x=>Math.round(x*10)/10;return {meshes:n,cam:[cam.position.x,cam.position.y,cam.position.z].map(r),min:mn.map(r),max:mx.map(r),behind,ndc:[lo.map(x=>+x.toFixed(2)),hi.map(x=>+x.toFixed(2))]}})()"""
NDC_MARGIN = 0.97  # every corner of the model's box inside the canvas, with a small margin
def framed(b):
    if not b or not b.get("meshes"): return False
    (x0, y0), (x1, y1) = b["ndc"]
    return b["behind"] == 0 and x0 >= -NDC_MARGIN and y0 >= -NDC_MARGIN and x1 <= NDC_MARGIN and y1 <= NDC_MARGIN and (x1 - x0) * (y1 - y0) > 0.08
def not_closeup(b):
    """During the rebuild's reveal (parts may still be flying in): camera outside, model in front and
    centred, not a door close-up (the box spans at most ~1.3 canvases)."""
    if not b or not b.get("meshes"): return True  # nothing drawn yet
    (x0, y0), (x1, y1) = b["ndc"]
    return b["behind"] == 0 and abs((x0 + x1) / 2) <= 0.75 and abs((y0 + y1) / 2) <= 0.75 and (x1 - x0) <= 2.6 and (y1 - y0) <= 2.6
IGNORE = re.compile(r"GPU stall|GL Driver|deprecated|favicon", re.I)

def frame_check(pg):
    f = pg.evaluate("window.__yardFrame")
    png = pg.screenshot()
    im = Image.open(io.BytesIO(png)).convert("RGB")
    sx = im.width / f["viewport"]["w"]
    xs = [c["x"] for c in f["corners"]]; ys = [c["y"] for c in f["corners"]]
    host = pg.evaluate("(()=>{const r=document.querySelector('[data-bench-host] canvas').getBoundingClientRect();return [r.left,r.top]})()")
    l, t = max(0, min(xs)), max(0, min(ys)); r, b = min(f["viewport"]["w"], max(xs)), min(f["viewport"]["h"], max(ys))
    box = (int((host[0] + l) * sx), int((host[1] + t) * sx), int((host[0] + r) * sx), int((host[1] + b) * sx))
    if box[2] - box[0] < 8 or box[3] - box[1] < 8:
        return {"ok": False, "why": "model box off screen"}
    px = list(im.crop(box).resize((96, 96)).get_flattened_data())
    wood = sum(1 for R, G, B in px if R > 120 and G > 85 and R > B + 35) / len(px)
    black = sum(1 for R, G, B in px if R + G + B < 30) / len(px)
    return {"wood": round(wood, 3), "black": round(black, 3), "box": box}

def camera_ok(pg):
    # The live camera, not the rig's report: the rendered model's wood must sit inside the framed box,
    # and the camera must not be left at the Canvas default inside the model (wood flooding the view).
    png = pg.screenshot(); im = Image.open(io.BytesIO(png)).convert("RGB").resize((120, 90))
    px = list(im.get_flattened_data())
    return round(sum(1 for R, G, B in px if R > 120 and G > 85 and R > B + 35) / len(px), 3)

def run():
    fails, rows = [], []
    with sync_playwright() as p:
        for W in WIDTHS:
            for name, q in BUILDS.items():
                br = p.chromium.launch()
                pg = br.new_page(viewport={"width": W, "height": 844 if W < 500 else 900}, has_touch=W < 500)
                pg.add_init_script(HOOK)
                if CPU > 1: pg.context.new_cdp_session(pg).send("Emulation.setCPUThrottlingRate", {"rate": CPU})
                errs = []
                pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and not IGNORE.search(m.text) else None)
                pg.on("pageerror", lambda e: errs.append("pageerror " + str(e)[:200]))
                pg.goto(f"{U}/workspace?offline=1&test=1&q=" + q.replace(" ", "%20"))
                def settle(canvas_before=None):
                    if canvas_before is not None:
                        # A rebuild remounts the canvas: wait for the new one, then for its own reveal.
                        try:
                            pg.wait_for_function("c => document.querySelector('[data-bench-host] canvas') !== c", arg=canvas_before, timeout=10000)
                        except Exception:
                            pass  # the step changed nothing (the card says so); still checked below
                        # The rebuild's first reveal frames: sample the live camera as soon as the new
                        # reveal is under way (this is what a user sees in the first second).
                        early.clear()
                        try:
                            pg.wait_for_function("/^(wire|\\d)/.test(document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal')||'')", timeout=8000, polling="raf")
                            early.append(pg.evaluate(BOUNDS))
                        except Exception:
                            pass
                    pg.wait_for_function("/^(done|skip)/.test(document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal')||'')", timeout=30000)
                    pg.wait_for_timeout(SETTLE_MS)
                early = []
                settle()
                base = camera_ok(pg)
                for i, s in enumerate(["start"] + STEPS):
                    if s != "start":
                        before = pg.evaluate_handle("document.querySelector('[data-bench-host] canvas')")
                        more = pg.locator("[data-yard-more][aria-expanded=false]")
                        if more.count() and more.first.is_visible(): more.first.click(); pg.wait_for_timeout(300)
                        chip = pg.locator("[data-yard-refine-chips] button", has_text=re.compile(f"^{s}$")).first
                        if chip.count() and chip.is_visible(): chip.click()
                        else:
                            box = pg.get_by_placeholder(re.compile("Taller, add")).first
                            box.fill(f"2 inches {s.lower()}"); box.press("Enter")
                        settle(before)
                    c = frame_check(pg); flood = camera_ok(pg); b = pg.evaluate(BOUNDS); fr = framed(b)
                    ea = all(not_closeup(e) for e in early) if s != "start" else True
                    ok = fr and ea and c.get("wood", 0) >= 0.06 and c.get("black", 1) <= 0.02 and not errs and flood <= base * 1.6 + 0.03
                    row = {"build": name, "w": W, "step": i, "chip": s, **c, "viewWood": flood, "baseWood": base, "framed": fr, "earlyOk": ea, "earlyCam": (early[0] or {}).get("cam") if early else None, "earlyNdc": (early[0] or {}).get("ndc") if early else None, "cam": (b or {}).get("cam"), "ndc": (b or {}).get("ndc"), "meshes": (b or {}).get("meshes"), "errors": len(errs), "ok": ok}
                    rows.append(row)
                    print(f"  {name} {W} {i:2d} {s:9} framed={fr} early={ea} {row['earlyCam']} cam={row['cam']} ndc={row['ndc']} ok={ok}", file=sys.stderr, flush=True)
                    if OUT and (i in (0, 1, 2) or not ok):
                        pg.screenshot(path=f"{OUT}/{name}-{W}-{i:02d}-{s}.png")
                    if not ok:
                        fails.append({**row, "errs": errs[:3]})
                br.close()
    print(json.dumps({"steps": len(rows), "fails": fails}, indent=1))
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(run())
