"""Shared Chromium launch and readiness wait for Yard's browser e2e scripts.

Why (2026-10-23, the #98 e2e hang): on a loaded box every build timed out at the first
`wait_for_function` (120 s) for hours, with no page error, and the same build passed later. Forced probe:
kill the software GPU process 3 times and Chromium blocks WebGL for the whole browser (its GPU crash limit).
The workspace then shows its no-WebGL card ([data-yard-no-webgl]) and never sets data-yard-reveal, so a wait
on the reveal sat out its full timeout and said nothing. Chromium's GPU watchdog kills a starved software
GPU process, which is how a busy box gets there.

So, for every script:
- launch(): SwiftShader WebGL with no GPU watchdog and no GPU crash limit (a slow software GPU is restarted,
  never blocked), plus a WebGL preflight that fails at once if the browser has none.
- wait_ready(): the reveal is done/skipped, or the page says it has no WebGL. The latter raises NoWebGL
  ("ENV", not an app result) at once instead of a silent 120 s timeout. Same timeout, nothing loosened.
- wait_or_diag(): any wait that times out prints the page state (reveal, lamp, rAF/s, WebGL, hook, title,
  errors) and saves a screenshot, then raises as before.
"""
import json, os

GPU_ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
            "--disable-gpu-watchdog", "--disable-gpu-process-crash-limit"]
HAS_WEBGL = "() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }"
READY = """() => {
  if (document.querySelector('[data-yard-no-webgl]')) return 'no-webgl';
  const r = document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal') || '';
  return /^(done|skip)/.test(r) ? r : false;
}"""
PAGE_STATE = """async () => {
  const h = document.querySelector('[data-bench-host]');
  let frames = 0; const t = performance.now();
  await new Promise(res => { const f = () => { frames++; if (performance.now() - t < 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); setTimeout(res, 3000); });
  const c = document.createElement('canvas');
  return { reveal: h ? h.getAttribute('data-yard-reveal') : 'no host', noWebgl: !!document.querySelector('[data-yard-no-webgl]'),
    webgl: !!(c.getContext('webgl2') || c.getContext('webgl')), lamp: !!document.querySelector('.yard-lamp[data-yard-building]'),
    hidden: document.hidden, rafPerSec: frames, hook: !!window.__yardExplode, canvas: !!h?.querySelector('canvas'),
    title: document.title, status: (document.querySelector('[data-yard-reveal-status]')?.textContent || '').slice(0, 120) };
}"""


class NoWebGL(RuntimeError):
    """The browser has no WebGL (GPU process crashed or blocked): an environment failure, not an app result."""


def launch(p, args=None, **kw):
    b = p.chromium.launch(args=GPU_ARGS + list(args or []), **kw)
    pg = b.new_page()
    try:
        if not pg.evaluate(HAS_WEBGL):
            b.close()
            raise NoWebGL("ENV: this Chromium has no WebGL at launch (SwiftShader unavailable)")
    finally:
        if b.is_connected(): pg.close()
    return b


def watch(pg):
    """Collect page errors, console errors and failed requests for wait_or_diag."""
    d = {"errors": [], "console": [], "failed": []}
    pg.on("pageerror", lambda e: d["errors"].append(str(e)[:200]))
    pg.on("console", lambda m: d["console"].append(f"{m.type}: {m.text[:160]}") if m.type == "error" else None)
    pg.on("requestfailed", lambda r: d["failed"].append(f"{r.url[:120]} {r.failure}"))
    return d


def wait_or_diag(pg, expr, timeout, tag, diag=None, out=""):
    try:
        return pg.wait_for_function(expr, timeout=timeout)
    except Exception:
        try: st = pg.evaluate(PAGE_STATE)
        except Exception as e2: st = {"evaluate_failed": str(e2)[:160]}
        d = diag or {}
        print(f"DIAG {tag}: state {json.dumps(st)} pageerrors {d.get('errors', [])[:3]} console {d.get('console', [])[:5]} failed {d.get('failed', [])[:5]}", flush=True)
        if out:
            try: pg.screenshot(path=os.path.join(out, tag.replace(" ", "-") + "-timeout.png"), timeout=15000)
            except Exception: pass
        raise


def wait_ready(pg, timeout, tag, diag=None, out=""):
    """The build's reveal is done or skipped. Raises NoWebGL at once when the page has no WebGL."""
    v = wait_or_diag(pg, READY, timeout, tag, diag, out).json_value()
    if v == "no-webgl":
        raise NoWebGL(f"ENV {tag}: the page has no WebGL (GPU process crashed or blocked); not an app result")
    return v
