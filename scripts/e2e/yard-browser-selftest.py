"""Self-test for scripts/e2e/yard_browser.py: a browser whose software GPU process crashes (3 kills, Chromium's
crash limit) still has WebGL and the workspace still becomes ready; and a page with no WebGL fails at once with
NoWebGL instead of sitting out the wait.

  python3 scripts/e2e/yard-browser-selftest.py http://127.0.0.1:8941 [--old-flags]

--old-flags launches with the pre-2026-10-23 args (no watchdog/crash-limit switches) to show the test fails there.
Kills only the GPU processes of the browser this script started. Exit 0 = pass.
"""
import os, signal, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
import yard_browser as yb

BASE = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "http://127.0.0.1:8131").rstrip("/")
OLD = "--old-flags" in sys.argv
Q = "/workspace?offline=1&test=1&q=linen%20closet%2031.5%20wide%2078%20tall%2016%20deep"


def gpu_pids():
    """GPU processes under this script's own process tree."""
    rows = [l.split(None, 2) for l in subprocess.run(["ps", "-eo", "pid,ppid,args"], capture_output=True, text=True).stdout.splitlines()[1:]]
    kids = {}
    for r in rows:
        if len(r) == 3: kids.setdefault(int(r[1]), []).append((int(r[0]), r[2]))
    out, st = [], [os.getpid()]
    while st:
        for c, a in kids.get(st.pop(), []):
            st.append(c)
            if "--type=gpu-process" in a: out.append(c)
    return out


fails = []
with sync_playwright() as p:
    b = p.chromium.launch(args=yb.GPU_ARGS[:3]) if OLD else yb.launch(p)
    pg = b.new_page()
    pg.goto("about:blank")
    for _ in range(3):
        for pid in gpu_pids(): os.kill(pid, signal.SIGKILL)
        time.sleep(1.5)
    if not pg.evaluate(yb.HAS_WEBGL): fails.append("after 3 GPU process crashes the browser has no WebGL")
    d = yb.watch(pg)
    pg.goto(BASE + Q)
    try:
        yb.wait_ready(pg, 60000, "selftest linen", d)
    except yb.NoWebGL as e:
        fails.append(f"page not ready: {e}")
    b.close()
    # A page with no WebGL is reported at once (NoWebGL), not after the full wait.
    b = p.chromium.launch(args=["--disable-webgl"])
    pg = b.new_page(); pg.goto(BASE + Q); t0 = time.time()
    try:
        yb.wait_ready(pg, 60000, "selftest no-webgl")
        fails.append("no-WebGL page counted as ready")
    except yb.NoWebGL:
        if time.time() - t0 > 20: fails.append(f"NoWebGL took {time.time() - t0:.0f} s")
    except Exception as e:
        fails.append(f"no-WebGL page timed out instead of raising NoWebGL: {str(e)[:80]}")
    b.close()
print("PASS yard-browser selftest" if not fails else "FAIL yard-browser selftest: " + "; ".join(fails))
sys.exit(1 if fails else 0)
