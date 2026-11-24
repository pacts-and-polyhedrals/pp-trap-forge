"""Chromium rendering/decode harness. Requires Python Playwright and local Chromium."""
from pathlib import Path
from threading import Thread
from tempfile import TemporaryDirectory
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import argparse, json, shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--output",type=Path,default=Path("/tmp/trap-forge-browser-qa"))
parser.add_argument("--chromium",default="/usr/bin/chromium")
parser.add_argument("--frames",action="store_true",help="Save synchronized preview frames")
a=parser.parse_args()
a.output.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
with TemporaryDirectory() as d, sync_playwright() as p:
 d=Path(d);(d/"modules").mkdir();(d/"modules/pp-trap-forge").symlink_to(ROOT,target_is_directory=True)
 srv=ThreadingHTTPServer(("127.0.0.1",0),partial(QuietHandler,directory=d))
 Thread(target=srv.serve_forever,daemon=True).start()
 b=p.chromium.launch(executable_path=a.chromium,headless=True,args=["--no-sandbox"])
 page=b.new_page(viewport={"width":960,"height":540},device_scale_factor=1)
 errors=[];page.on("pageerror",lambda e: errors.append(str(e)))
 page.on("response",lambda r: errors.append(f"{r.status} {r.url}") if r.status>=400 and "favicon" not in r.url else None)
 page.goto(f"http://127.0.0.1:{srv.server_port}/modules/pp-trap-forge/test/fixtures/av-browser.html")
 page.locator('body[data-ready="yes"]').wait_for()
 art=page.evaluate("""() => Object.fromEntries(lab.families.map(k => [k,[0.08,0.32,0.54,0.74,0.9].map(t=>lab.frame(k,t))]))""")
 assert all(any(p>350 for p in v) for k,v in art.items()),art
 # Direction is intentionally visible. Capture contrast points from the same painter.
 assert page.evaluate("lab.frame('fire-jet',.40,{direction:90})")>350
 assert page.evaluate("lab.frame('pit',.29)")>250
 assert page.evaluate("lab.frame('fire-blast',.5,{reduced:true})")>100
 decoded=page.evaluate("lab.audio()"); assert len(decoded)==len(art)
 assert all(0.4<d<3 and ch==1 for _,d,ch,_ in decoded)
 assert page.evaluate("lab.event('fire-jet','once')") is True
 assert page.evaluate("lab.event('fire-jet','once')") is False
 layer=page.locator(".tf-fx-layer")
 layer.wait_for(state="attached")
 page.wait_for_timeout(200)
 assert layer.count()==1
 assert layer.evaluate("el => el.style.left")=="480px"
 page.evaluate("lab.move(55,1.47)")
 page.wait_for_timeout(80)
 assert layer.evaluate("el => el.style.left")=="535px"
 assert page.evaluate("lab.audioLog.length")==1
 assert layer.evaluate("el => getComputedStyle(el).pointerEvents")=="none"
 page.screenshot(path=str(a.output/"Runtime-wall-fire-zoom-and-pan.png"))
 page.evaluate("lab.fog(true)")
 layer.wait_for(state="detached")
 assert page.evaluate("lab.event('pit','secret')") is False
 page.evaluate("lab.fog(false)");page.evaluate("lab.move(0,1)")
 for k,t in [("fire-blast",.24),("fire-jet",.43),("pit",.34),("water",.52),("mimic",.36),("lightning",.29)]:
  page.evaluate("([k,t])=>lab.frame(k,t)",[k,t]); page.screenshot(path=str(a.output/f"{k}.png"))
 if a.frames:
  cues=[("fire-blast",1.10),("fire-jet",1.25),("pit",.85),("lightning",.85),("poison",1.45),("mimic",1.05)]
  fps=24; length=2.5
  for j,(k,dur) in enumerate(cues):
   for i in range(round(fps*length)):
    tt=i/fps
    if k=="pit" and tt<.35:
     page.evaluate("() => {lab.frame('pit',0,{show:false});document.querySelector('#tile').src='/modules/pp-trap-forge/assets/tiles/pit-closed.svg'}")
    else:
     t=(tt-.35)/dur
     page.evaluate("([k,t])=>lab.frame(k,t,{show:t>=0&&t<1})",[k,t])
    page.screenshot(path=str(a.output/f"shot-{j*60+i:04d}.png"),animations="disabled")
 assert not errors,errors
 (a.output/"browser-qa.json").write_text(json.dumps({"profiles":len(art),"paintedPixels":art,"decodedAudio":decoded,"checked":"Render all animation profiles; verify asset decode, directional motion, reduced-motion view, duplicate suppression, console clean, pan and zoom alignment, fog cleanup and pointer transparency"},indent=2))
 print(f"Browser QA passed: {len(art)} motion profiles, {len(decoded)} browser audio decodes, runtime pan/zoom/visibility/single-play.")
 b.close();srv.shutdown()
