export const ID = "pp-trap-forge";
export const ICON = "modules/pp-trap-forge/assets/trap.svg";
export const SAVE_NAMES = {str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma",fortitude:"Fortitude",reflex:"Reflex",will:"Will",custom:"Custom",none:"No save"};
export const BASE = Object.freeze({name:"New Trap",category:"Custom",damage:"2d10",damageType:"piercing",save:"dex",dc:14,success:"half",failureEffect:"",triggerText:"A hidden trap activates.",customSave:"",sizeX:1,sizeY:1,art:ICON,hidden:true,reveal:true,reset:"once",cooldown:0,targets:"pcs",minElevation:"",maxElevation:"",level:"",destinationOnly:false,av:"auto",vfxOn:true,sfxOn:true,sound:"",gain:.8,direction:0,trapwrightOwner:"",trapwrightSide:0,trapwrightExpires:null,armed:true,lastAt:0,spent:false});
const clamp=(v,a,b,d)=> Number.isFinite(Number(v)) ? Math.max(a,Math.min(b,Number(v))) : d;
export const h=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const valid=(v,x,d)=>x.includes(v)?v:d;
const str=(v,n)=>String(v??"").trim().slice(0,n);
const bool=(x,d)=>x===undefined?d: !(x===false||x==="false"||x===0||x==="0");
export function normalize(input={}) {
 const a={...BASE,...input}, damage=str(a.damage,90), path=str(a.art,650);
 // Only portable relative asset paths, not data/HTML URLs or animation database keys.
 const sound=str(a.sound,650);
 const checkedSound=/^[\w% +@()./-]+\.(?:ogg|opus|wav|mp3|m4a|flac|webm)$/i.test(sound)&&!sound.startsWith("/")&&!sound.split("/").includes("..")?sound:"";
 const art= /^(?:[\w% .()@+\-/]+)\.(?:svg|webp|png|jpe?g|webm|mp4|avif)$/i.test(path) && !path.split("/").some(p=>p==="..") && !path.startsWith("/") ? path : ICON;
 return {name:str(a.name,90)||BASE.name,category:str(a.category,48),damage,damageType:str(a.damageType,40),save:valid(a.save,Object.keys(SAVE_NAMES),"custom"),customSave:str(a.customSave,100),dc:Math.round(clamp(a.dc,0,100,14)),
 success:valid(a.success,["half","none","full"],"half"),failureEffect:str(a.failureEffect,600),triggerText:str(a.triggerText,600),
 sizeX:clamp(a.sizeX,.25,25,1),sizeY:clamp(a.sizeY,.25,25,1),art,hidden:bool(a.hidden,true),reveal:bool(a.reveal,true),
 reset:valid(a.reset,["once","repeat","cooldown"],"once"),cooldown:clamp(a.cooldown,0,3600,0),targets:valid(a.targets,["pcs","all","opposed"],"pcs"),
 minElevation:a.minElevation===""||a.minElevation==null?"":clamp(a.minElevation,-100000,100000,0),
 maxElevation:a.maxElevation===""||a.maxElevation==null?"":clamp(a.maxElevation,-100000,100000,0),
 level:str(a.level,90),destinationOnly:bool(a.destinationOnly,false),av:str(a.av,42)||"auto",vfxOn:bool(a.vfxOn,true),sfxOn:bool(a.sfxOn,true),sound:checkedSound,gain:clamp(a.gain,0,1,.8),direction:clamp(a.direction,-180,360,0),trapwrightOwner:str(a.trapwrightOwner,160),trapwrightSide:Math.sign(clamp(a.trapwrightSide,-1,1,0)),trapwrightExpires:Number.isFinite(a.trapwrightExpires)?a.trapwrightExpires:null,armed:bool(a.armed,true),lastAt:clamp(a.lastAt,0,Number.MAX_SAFE_INTEGER,0),spent:bool(a.spent,false)};
}
export function legacy(data,tile) {
 const d=data??{}, st=d.state??{}, save=d.save??{}, effect=d.effect??{};
 return normalize({name:d.name,save:d.saveAbility??save.ability??"dex",dc:d.saveDc??save.dc??14,
 damage:d.damageFormula??effect.damage??"2d10",damageType:d.damageType??effect.damageType??"piercing",
 success:(d.halfOnSuccess??save.halfDamageOnSuccess??effect.halfDamageOnSuccess)? "half":"none",
 failureEffect:(d.condition&&d.condition!=="none")?d.condition:"",
 triggerText:d.flavor??d.chat?.publicTriggerText??BASE.triggerText,
 art:d.tileImageResolved??d.tilePath??tile?.texture?.src??ICON,hidden:d.tileHidden??tile?.hidden??true,
 reveal:d.revealOnTrigger??true,armed:st.armed!==false&&!st.disabled,spent:!!st.triggered,
 reset:d.reset?.mode==="repeat"?"repeat":"once"});
}
export function ready(t,now,worldTime) {
 return t.armed && !(t.trapwrightOwner&&Number.isFinite(t.trapwrightExpires)&&Number.isFinite(worldTime)&&worldTime>=t.trapwrightExpires) && !(t.reset==="once"&&t.spent) && !(t.reset==="cooldown"&&t.lastAt&&now-t.lastAt<t.cooldown*1000);
}
const validPt=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const mk=(p,doc)=>({x:p.x,y:p.y,width:p.width??doc.width??1,height:p.height??doc.height??1,elevation:p.elevation??doc.elevation??0,level:p.level??doc.level,action:p.action??""});
export function pathFor(move,doc) {
 if(!validPt(move?.origin)||!validPt(move?.destination))return [];
 return [move.origin,...(Array.isArray(move.passed?.waypoints)?move.passed.waypoints.filter(validPt):[]),move.destination].map(p=>mk(p,doc));
}
// Liang-Barsky slab bounds. Boundaries alone do not count as occupancy.
function clip(a,b,r) {
 let lo=0,hi=1;
 for(const [v,d,min,max,strict] of [[a.x,b.x-a.x,r.x,r.x+r.w,true],[a.y,b.y-a.y,r.y,r.y+r.h,true],[a.z,b.z-a.z,r.min,r.max,false]]) {
  if(Math.abs(d)<1e-9) {if(v<min||v>max||(strict&&(v===min||v===max))) return null;continue;}
  const p=(min-v)/d,q=(max-v)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
  if(hi<lo+1e-9)return null;
 }
 return [lo,hi];
}
function local(p,t,grid) {
 const x=p.x+(p.width??1)*grid/2-(t.x+t.w/2),y=p.y+(p.height??1)*grid/2-(t.y+t.h/2),rad=(t.rotation||0)*Math.PI/180;
 return {x:x*Math.cos(rad)+y*Math.sin(rad),y:-x*Math.sin(rad)+y*Math.cos(rad),z:p.elevation??0};
}
const inside=(p,r)=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h&&p.z>=r.min&&p.z<=r.max;
export function crossing(path,t,grid,settings,teleport=false) {
 if(path.length<2 || !(t.w>0&&t.h>0))return null;
 const r={x:-t.w/2,y:-t.h/2,w:t.w,h:t.h,min:settings.minElevation===""?-Infinity:settings.minElevation,max:settings.maxElevation===""?Infinity:settings.maxElevation};
 const ok=p=>!settings.level||settings.level===p.level;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],A=local(a,t,grid),B=local(b,t,grid);
  if(!ok(b))continue;
  if(inside(A,r)&&ok(a))continue;
  if(teleport||settings.destinationOnly||!ok(a)||/^(teleport|blink)$/i.test(b.action)) {
   if(inside(B,r))return i;
  } else {
   // XY stationary while changing elevations still enters a bounded trap zone.
   if(Math.abs(A.x-B.x)+Math.abs(A.y-B.y)+Math.abs(A.z-B.z)<1e-8)continue;
   const intersect=clip(A,B,r);
   if(intersect)return i-1+intersect[0];
   if(inside(B,r))return i;
  }
 }
 return null;
}
export function saveSpec(system,label,name="") {
 const map={str:"fortitude",dex:"reflex",con:"fortitude",int:"will",wis:"will",cha:"will"};
 const pf=system==="pf2e";
 const key=pf?(map[label]??label):label;
 return {key,label:label==="custom"?(name||"the appropriate save"):(SAVE_NAMES[key]??key)};
}
export function degree(system,total,dc,natural) {
 let d=total>=dc?1:0;
 if(system==="pf2e"){
  d=total>=dc+10?2:total<=dc-10?-1:d;
  if(natural===20)d=Math.min(d+1,2);
  if(natural===1)d=Math.max(d-1,-1);
 }
 return d;
}
export function damageFor(base,outcome,success,system) {
 if(outcome<0&&system==="pf2e")return base*2;
 if(outcome===2&&system==="pf2e")return 0;
 if(outcome<1)return base;
 return success==="none"?0:success==="half"?Math.floor(base/2):base;
}
