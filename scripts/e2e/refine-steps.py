"""
Repeated size steps on a build (hotfix, Oct 16): Wider, Narrower, Taller x5 each, at 390 and 1440, for
linen, a bookshelf and the canary. After every step: the reveal finishes, no console errors, a model is
on screen (wood pixels inside the model's projected box), nothing in it renders black, and the camera
is framed (the model box fills a sane share of the view, not the Canvas default inside the model).

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
WIDTHS = tuple(int(w) for w in os.environ.get("WIDTHS", "390,1440").split(","))
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
                errs = []
                pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and not IGNORE.search(m.text) else None)
                pg.on("pageerror", lambda e: errs.append("pageerror " + str(e)[:200]))
                pg.goto(f"{U}/workspace?offline=1&test=1&q=" + q.replace(" ", "%20"))
                def settle():
                    pg.wait_for_function("/^(done|skip)/.test(document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal')||'')", timeout=30000)
                    pg.wait_for_timeout(700)
                settle()
                base = camera_ok(pg)
                for i, s in enumerate(["start"] + STEPS):
                    if s != "start":
                        rev0 = pg.evaluate("document.querySelector('[data-bench-host]').getAttribute('data-yard-reveal-ms')")
                        more = pg.locator("[data-yard-more][aria-expanded=false]")
                        if more.count() and more.first.is_visible(): more.first.click(); pg.wait_for_timeout(300)
                        chip = pg.locator("[data-yard-refine-chips] button", has_text=re.compile(f"^{s}$")).first
                        if chip.count() and chip.is_visible(): chip.click()
                        else:
                            box = pg.get_by_placeholder(re.compile("Taller, add")).first
                            box.fill(f"2 inches {s.lower()}"); box.press("Enter")
                        pg.wait_for_timeout(400)
                        settle()
                    c = frame_check(pg); flood = camera_ok(pg)
                    ok = c.get("wood", 0) >= 0.06 and c.get("black", 1) <= 0.02 and not errs and flood <= base * 1.6 + 0.03
                    row = {"build": name, "w": W, "step": i, "chip": s, **c, "viewWood": flood, "baseWood": base, "errors": len(errs), "ok": ok}
                    rows.append(row)
                    if OUT and (i in (0, 1, 2) or not ok):
                        pg.screenshot(path=f"{OUT}/{name}-{W}-{i:02d}-{s}.png")
                    if not ok:
                        fails.append({**row, "errs": errs[:3]})
                br.close()
    print(json.dumps({"steps": len(rows), "fails": fails}, indent=1))
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(run())
