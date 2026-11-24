import {ID} from "./core.mjs";
import {FAMILIES,AV_BASE,audioFor} from "./av-profiles.mjs";
import {paintEffect} from "./av-paint.mjs";
const activeFx=new Set(), received=new Set(), recordedOrder=[];
let sequence=0, closedPit=null;
export function warmAssets(){if(typeof Image==="function"&&!closedPit){closedPit=new Image();closedPit.src=AV_BASE+"/tiles/pit-closed.svg";}}
export const MAX_ACTIVE=8;
const setting=(k,def)=>{try{return globalThis.game?.settings?.get(ID,k)??def;}catch{return def;}};
export function validatedCue(p) {
 if(!p||!Object.hasOwn(FAMILIES,p.family)||!p.scene||
   ![p.x,p.y,p.w,p.h,p.rotation,p.gain].every(Number.isFinite)||
   p.w<1||p.h<1||p.w>50000||p.h>50000||p.gain<0||p.gain>1)return null;
 const src=typeof p.sound==="string"&&/^[\w% +@()./-]+\.(?:ogg|opus|wav|mp3|m4a|flac|webm)$/i.test(p.sound)&&!p.sound.startsWith("/")&&!p.sound.split("/").includes("..")?p.sound:null;
 return {...p,sound:src};
}
function clientPoint(x,y){
 return canvas.clientCoordinatesFromCanvas?.({x,y})??null;
}
const currentLevel=()=>typeof canvas.level==="string"?canvas.level:canvas.level?.id;
function visible(c) {
 if(!globalThis.canvas?.ready||canvas.scene?.id!==c.scene)return false;
 if(c.level&&currentLevel()!==c.level)return false;
 if(!game.user?.isGM) {
  if(c.private||!c.markVisible) return false;
  const vision=canvas.visibility??canvas.effects?.visibility;
  if(vision?.tokenVision&&typeof vision.testVisibility==="function"){
   try{return !!vision.testVisibility({x:c.x,y:c.y,elevation:c.elevation??0},{tolerance:0});}catch{return false;}
  }
 }
 return true;
}
export function classifyDelivery(msg,now=Date.now()){
 const c=validatedCue(msg?.getFlag?.(ID,"cue"));
 const recipients=msg?.whisper??[];
 if(!c||!msg.id||!msg.author?.isGM||!Number.isFinite(c.createdAt)||c.createdAt<now-12000||c.createdAt>now+12000)return null;
 if(c.private&&(!game.user?.isGM||!recipients.includes(game.user.id)))return null;
 if(recipients.length&&!recipients.includes(game.user?.id))return null;
 if(!visible(c))return null;
 return c;
}
function playSound(c) {
 const scale=setting("sfxVolume",0.72);
 const src=c.sound??audioFor(c.family), volume=Number.isFinite(scale)?Math.max(0,Math.min(1,c.gain*scale)):0;
 if(!c.sfxOn||!src||volume===0)return;
 try{
  const cls=globalThis.foundry?.audio?.AudioHelper;
  if(typeof cls?.play==="function"){cls.play({src,volume,loop:false,autoplay:true},false);return;}
  // Defensive fallback for stripped clients/harnesses; use the same local asset.
  const a=new Audio(src); a.volume=volume;void a.play().catch(()=>{});
 }catch(e){console.debug("Trap Forge: sound unavailable",e);}
}
export function clearEffects() {
 for(const fx of [...activeFx])fx.stop();
}
function playVisual(c) {
 if(!c.vfxOn||setting("disableEffects",false)||typeof document==="undefined")return;
 if(c.family==="pit")warmAssets();
 const f=FAMILIES[c.family], ratios=globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
 const el=document.createElement("canvas");el.className="tf-fx-layer";el.setAttribute("aria-hidden","true");
 const g=el.getContext("2d");if(!g)return;
 // Use a short-lived local layer, not a persistent canvas object. User’s pan/zoom labels
 // stay aligned through the documented world-to-client transformation every frame.
 (document.body??document.documentElement).append(el);
 const duration=ratios?Math.min(850,f.duration):f.duration;
 const start=performance.now();let token=null,stopped=false;
 const fx={id:++sequence,stop(){if(stopped)return;stopped=true;if(token!==null)cancelAnimationFrame(token);el.remove();activeFx.delete(fx);}};
 activeFx.add(fx);while(activeFx.size>MAX_ACTIVE)[...activeFx][0].stop();
 function frame(now){
  if(stopped)return;
  const t=(now-start)/duration;
  if(t>=1||!visible(c)){fx.stop();return;}
  try {
   const p=clientPoint(c.x,c.y),x=clientPoint(c.x+100,c.y),y=clientPoint(c.x,c.y+100);
   if(!p||!x||!y||![p.x,p.y,x.x,x.y,y.x,y.y].every(Number.isFinite)){fx.stop();return;}
   const baseX=Math.hypot(x.x-p.x,x.y-p.y)/100,baseY=Math.hypot(y.x-p.x,y.y-p.y)/100;
   const maxSize=Math.max(c.w*baseX,c.h*baseY),size=Math.ceil(Math.min(1500,Math.max(100,3.45*maxSize))),ratio=Math.min(1.65,Math.max(1,globalThis.devicePixelRatio||1));
   if(p.x+size/2<0||p.y+size/2<0||p.x-size/2>globalThis.innerWidth||p.y-size/2>globalThis.innerHeight){fx.stop();return;}
   el.style.left=p.x+"px";el.style.top=p.y+"px";el.style.width=size+"px";el.style.height=size+"px";
   const np=Math.ceil(size*ratio);if(el.width!==np||el.height!==np){el.width=np;el.height=np;}
   g.setTransform(ratio,0,0,ratio,size/2*ratio,size/2*ratio);g.clearRect(-size/2,-size/2,size,size);
   g.rotate((c.rotation||0)*Math.PI/180);
   const sx=c.w*baseX/100,sy=c.h*baseY/100;
   g.scale(Math.max(.03,sx),Math.max(.03,sy));
   paintEffect(g,f,Math.max(0,t),{reduced:ratios,closedArt:c.family==="pit"?closedPit:null});
  } catch(e) {fx.stop();console.debug("Trap Forge: visual cue unavailable",e);return;}
  token=requestAnimationFrame(frame);
 }
 token=requestAnimationFrame(frame);
}
export function receiveCue(msg){
 if(received.has(msg?.id))return false;
 const c=classifyDelivery(msg);if(!c)return false;
 received.add(msg.id);recordedOrder.push(msg.id);
 if(recordedOrder.length>256)received.delete(recordedOrder.shift());
 playSound(c);playVisual(c);return true;
}
export function registerMediaSettings(){
 game.settings.register(ID,"sfxVolume",{name:"Trap Forge: sound volume",hint:"Local trap cues only. Set to zero to mute.",scope:"client",config:true,type:Number,default:.72,range:{min:0,max:1,step:.05}});
 game.settings.register(ID,"disableEffects",{name:"Trap Forge: disable moving effects",hint:"Keeps permanent reveal art and sound settings. OS reduced-motion already uses a gentle cue.",scope:"client",config:true,type:Boolean,default:false});
}
