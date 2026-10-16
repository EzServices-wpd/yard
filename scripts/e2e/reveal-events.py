import json,sys
from playwright.sync_api import sync_playwright
q=sys.argv[1];W=int(sys.argv[2]);mode=sys.argv[3];U=sys.argv[4] if len(sys.argv)>4 else "http://127.0.0.1:8090";K=sys.argv[5] if len(sys.argv)>5 else ""
INIT="""window.__ev=[];const T=()=>Math.round(performance.now());
new MutationObserver(()=>{const h=document.querySelector('[data-bench-host]');const r=h?.getAttribute('data-yard-reveal')||'';const lp=document.querySelector('.yard-lamp');const lamp=lp?(lp.dataset.yardBuilding?'B':'F'):'-';const s=r+'|'+lamp;const l=window.__ev[window.__ev.length-1];if(!l||l.s!==s)window.__ev.push({s,t:T()})}).observe(document,{subtree:true,childList:true,attributes:true});"""
with sync_playwright() as p:
  b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
  c=b.new_context(**(p.devices["iPhone 13"] if W<500 and len(sys.argv)>6 else {"viewport":{"width":W,"height":900 if W>500 else 844},"has_touch":W<500})); c.add_init_script(INIT)
  pg=c.new_page(); pg.set_default_timeout(120000)
  if K: pg.goto(U+"/?_vercel_share="+K)
  net=[]; pg.on("requestfinished",lambda r: net.append((r.url.split("?")[0][-40:],int(r.timing["responseEnd"]))) if ("_serverFn" in r.url or "/api/" in r.url) else None)
  if mode=="url": pg.goto(U+"/workspace?q="+q.replace(" ","%20"))
  else:
    pg.goto(U+"/workspace"); pg.wait_for_timeout(2500); i=pg.locator('form input').first; i.fill(q); i.press("Enter")
  try: pg.wait_for_function("/^(done|skip)/.test(document.querySelector('[data-bench-host]')?.getAttribute('data-yard-reveal')||'')",timeout=60000)
  except Exception: print("TIMEOUT", pg.url, pg.title())
  ev=pg.evaluate("window.__ev"); print(W,mode,[(e['s'],e['t']) for e in ev],'..',[(e['s'],e['t']) for e in ev][-2:],'net',net); b.close()
