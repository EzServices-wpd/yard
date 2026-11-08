# Plan drawer across a live submit with a delayed, mocked house brief (window.fetch shim delays the
# real captured /_serverFn brief response). Usage: python3 scripts/e2e/plan-drawer-brief.py <delay_s> <width> url2
# against `npx vite dev --port 8090`. Pass: the drawer stays OPEN from SUBMIT through BRIEF_LAND.
import json,sys,time
from playwright.sync_api import sync_playwright
DELAY=float(sys.argv[1]); W=int(sys.argv[2]); flow=sys.argv[3]
body=json.load(open("scripts/e2e/house-brief.fixture.json"))[0]["body"]
INIT="""window.__d=[];const t0=performance.now();const f=()=>{const open=!!document.querySelector('[data-yard-nest-hero],[data-yard-cut-progress]')||[...document.querySelectorAll('p')].some(p=>p.textContent==='Build plan');const busy=document.querySelector('[data-yard-primary]')?.dataset.yardPrimary;const s=(open?'OPEN':'closed')+'|'+busy;const l=window.__d[window.__d.length-1];if(!l||l.s!==s)window.__d.push({s,t:Math.round(performance.now()-t0)});requestAnimationFrame(f)};requestAnimationFrame(f);
window.addEventListener('yard-build-start',()=>window.__d.push({s:'SUBMIT',t:Math.round(performance.now()-t0)}));"""
with sync_playwright() as p:
  b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
  c=b.new_context(viewport={"width":W,"height":900 if W>500 else 844}); c.add_init_script(INIT)
  pg=c.new_page(); pg.set_default_timeout(120000)
  hits=[]
  def route(r):
    pd=r.request.post_data or ""
    if '"prompt"' in pd and "alcove" in pd:
      hits.append(time.time()); time.sleep(DELAY); r.fulfill(status=200,headers={"content-type":"application/json"},body=body)
    else: r.continue_()
  c.add_init_script("window.__BRIEF="+json.dumps(body)+";window.__DELAY="+str(int(DELAY*1000))+";"+"""
const of=window.fetch;window.__hits=[];window.fetch=async(u,o)=>{const url=String(u&&u.url||u);const b=o&&typeof o.body==='string'?o.body:'';
if(url.includes('/_serverFn/')&&b.includes('"prompt"')&&b.includes('alcove')){window.__hits.push(Math.round(performance.now()));window.__d.push({s:'BRIEF_REQ',t:Math.round(performance.now())});
await new Promise(r=>setTimeout(r,window.__DELAY));window.__d.push({s:'BRIEF_LAND',t:Math.round(performance.now())});return new Response(window.__BRIEF,{status:200,headers:{'content-type':'application/json'}})}return of(u,o)};""")
  if flow in("url","url2"):
    pg.goto("http://127.0.0.1:8090/workspace?q=linen%20closet%20for%20a%2031.5%20inch%20alcove")
  else:
    pg.goto("http://127.0.0.1:8090/workspace?q=bookshelf%2036x12x72")
    pg.wait_for_selector('[data-yard-primary="plan"]',timeout=90000); pg.wait_for_timeout(1000)
    pg.click('[data-yard-primary="plan"]'); pg.wait_for_timeout(800)
    i=pg.locator('form input').first; i.fill("linen closet for a 31.5 inch alcove"); i.press("Enter")
  for k in range(int((DELAY+30)/0.3)):
    pg.wait_for_timeout(300)
    try:
      if pg.locator('[data-yard-primary="plan"]').count() and not pg.evaluate("window.__opened"):
        pg.click('[data-yard-primary="plan"]',timeout=8000,force=True); pg.evaluate("window.__opened=performance.now()")
    except Exception as e: print("ERR",str(e)[-600:]); break
  if flow=="url2":
    pg.evaluate("window.__d.push({s:'ENTER',t:Math.round(performance.now())})")
    pg.locator('form input').first.press("Enter")
    pg.wait_for_timeout(DELAY*1000+20000)
  print(flow,W,"brief_hits",pg.evaluate("window.__hits"),pg.evaluate("window.__d"),"opened_at",pg.evaluate("window.__opened")); b.close()
