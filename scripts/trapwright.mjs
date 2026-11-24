import {ID,ICON,h,ready} from "./core.mjs";
import {characterProfile,STARTERS,DIRECTIONS,validId,portableTrap,deploymentRect,fitPlacement,parseRequest,blockedByWall} from "./trapwright-core.mjs";
import {getTrapwrightPresets,getTrapwrightAssignment,TRAPWRIGHT_SPECIALIZATIONS} from "./trapwright-catalog.mjs";

const SETTING="trapwrightRoster";
const enabled=()=>globalThis.game?.system?.id==="dnd5e";
const authority=()=>enabled()&&game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const own=(actor,user)=>Boolean(user?.isGM||actor?.testUserPermission?.(user,"OWNER"));
const roster=()=>game.settings.get(ID,SETTING)??{};
const isEnrolled=(actor)=>actor?.id&&Object.hasOwn(roster(),actor.id)&&roster()[actor.id]?.enabled===true;
const selected=(actor)=>canvas.tokens?.controlled?.filter(t=>!actor||t.actor?.uuid===actor.uuid||t.actor?.id===actor.id)??[];
const show=(s)=>ui.notifications.warn("Trapwright: "+s);
const logErr=(err)=>{console.error("Trapwright",err);show(err.message??String(err));};
const msgClass=()=>foundry.documents.ChatMessage;
const localHandled=new Set();
let queue=Promise.resolve();
const lock=(f)=>{queue=queue.catch(()=>{}).then(f);return queue;};
const ageClock={now:()=>Date.now()};
function openDialog(title,body,buttons){
 const content=document.createElement("div");content.innerHTML=body;
 return foundry.applications.api.DialogV2.wait({window:{title},position:{width:500},content,buttons,rejectClose:false});
}
const btn=(action,label,callback)=>({action,label,...(callback?{callback}:{})});
const opt=(v,l)=>'<option value="'+h(v)+'">'+h(l)+'</option>';
export function visiblePresets(p){
 return [...STARTERS,...(p.subclass?getTrapwrightPresets(p.subclass,p.level):[])];
}
export function ledgerStatus(actor,p){
 const r=Object.hasOwn(roster(),actor.id)?roster()[actor.id]:null;
 return {allowed:r?.enabled===true,spent:Number.isSafeInteger(r?.spent)?Math.max(0,r.spent):0,max:p.charges,left:Math.max(0,p.charges-(Number.isSafeInteger(r?.spent)?Math.max(0,r.spent):0))};
}
const gridType=s=>Number(s.grid?.type??1);
const extractSceneGrid=s=>Number(s.grid?.size??s.dimensions?.size??100);
const supportedGrid=s=>gridType(s)<=1&&(s.grid?.distance==null||Number(s.grid.distance)===5);
const record=(actor,spent,source={})=>({...source,[actor.id]:{enabled:true,spent}});
const plainName=n=>h(n??"Trapwright");
async function cleanOwned(actor){
 for(const s of game.scenes.values()){
  const updates=Array.from(s.tiles??[]).filter(t=>{
   const trap=t.getFlag?.(ID,"trap");return trap?.trapwrightOwner===actor.uuid&&trap.armed&&!trap.spent;
  }).map(t=>({_id:t.id,["flags."+ID+".trap.armed"]:false}));
  if(updates.length)await s.updateEmbeddedDocuments("Tile",updates);
 }
}
async function notify(user,content){
 const ids=[...new Set([user.id,game.user.id])];
 return msgClass().create({content:'<div class="tf-chat"><h3>Trapwright</h3><p>'+content+'</p></div>',whisper:ids});
}
async function deployChooser(actor=null){
 if(!enabled())return show("This player class requires the D&D 5e system; GM Trap Forge still works everywhere.");
 if(!canvas.scene)return show("Open a scene and select your Trapwright's linked token.");
 if(!game.users.activeGM)return show("An active GM must be connected to place traps.");
 const tokens=selected(actor);
 if(tokens.length!==1)return show("Select exactly one linked Trapwright token on the active map.");
 const tok=tokens[0].document,a=tok.actor,p=characterProfile(a);
 if(!tok.actorLink||!p||!own(a,game.user))return show("Select your linked actor with the Trapwright class.");
 if(!isEnrolled(a))return show("Ask the GM to enable player deployment for this actor in Trap Forge.");
 if(!supportedGrid(canvas.scene))return show("Player deployment requires a standard 5-foot square or gridless scene. Ask the GM to place the trap here.");
 if(!Math.sign(tok.disposition??0))return show("Set the trapwright's token disposition to Friendly or Hostile, not Neutral.");
 const allowed=visiblePresets(p),charge=ledgerStatus(a,p);
 if(!charge.left)return show("No Trap Charges left. Rest first or ask the GM to check your ledger.");
 const faction=p.subclass?TRAPWRIGHT_SPECIALIZATIONS[p.subclass]:"Apprentice";
 const html='<div class="tf-form"><p><strong>'+plainName(faction)+'</strong> · '+charge.left+' / '+charge.max+' Trap Charges · save DC '+p.dc+'</p>'+
  '<p>Place one trap in a 5-foot space adjacent to this token. In combat this normally costs your action. Eligible opponents can trigger it once.</p>'+
  '<label>Schematic<select name="preset">'+allowed.map(tr=>opt(tr.name,tr.name)).join("")+'</select></label>'+
  '<label>Drop on this side<select name="direction">'+Object.keys(DIRECTIONS).map(k=>opt(k,k.toUpperCase())).join("")+'</select></label></div>';
 const result=await openDialog("Trapwright • Deploy Trap",html,[btn("deploy","Deploy trap",(e,b)=>{const f=b.form.elements;return {preset:f.preset.value,direction:f.direction.value};}),btn("cancel","Cancel",()=>null)]);
 if(!result)return;
 if(canvas.scene?.id!==tok.parent?.id)return show("The selected token’s scene changed; try again.");
 const pending={...result,scene:tok.parent.id,token:tok.id,createdAt:ageClock.now()};
 return msgClass().create({content:"<p>Requesting Trapwright placement…</p>",whisper:[...new Set([game.users.activeGM.id,game.user.id])],
  flags:{[ID]:{twRequest:pending}}});
}
export async function buildDeployment(request,requester,{scenes=game.scenes,settings=roster()}={}){
 const scene=scenes.get(request.scene),token=scene?.tokens?.get(request.token),actor=token?.actor;
 if(!token||!actor||!requester?.active||!token.actorLink||!own(actor,requester))throw Error("That linked actor is not an eligible token you own.");
 if(!validId(actor.id)||!Object.hasOwn(settings,actor.id)||settings[actor.id]?.enabled!==true)throw Error("The GM has not enabled Trapwright deployment for this actor.");
 if(!supportedGrid(scene))throw Error("Automatic deployment requires a standard 5-foot square or gridless scene.");
 if(!Math.sign(token.disposition??0)||token.hidden)throw Error("The deploying token must have a visible Friendly or Hostile disposition.");
 // A client cannot request a scene it hasn't opened, or a different level than the deployer's token.
 if(requester.viewedScene&&requester.viewedScene!==scene.id)throw Error("Activate the source token’s scene first.");
 const p=characterProfile(actor);
 if(!p)throw Error("The token needs this module’s Trapwright class item.");
 if(actor.statuses?.has?.("dead"))throw Error("A dead actor cannot deploy a trap.");
 const chosen=visiblePresets(p).find(t=>t.name===request.preset);
 if(!chosen)throw Error("That schematic isn’t unlocked for this subclass and level.");
 const spent=Number.isSafeInteger(settings[actor.id].spent)?Math.max(0,settings[actor.id].spent):0;
 if(spent>=p.charges)throw Error("No Trap Charges remain.");
 const live=Array.from(scenes.values()).flatMap(s=>Array.from(s.tiles??[])).filter(t=>{
  const data=t.getFlag?.(ID,"trap");
  return data?.trapwrightOwner===actor.uuid&&ready(data,Date.now(),game.time?.worldTime);
 }).length;
 if(live>=p.active)throw Error("You already have "+live+" active portable traps. Ask the GM to disarm one first.");
 const grid=extractSceneGrid(scene), dims=scene.dimensions?.sceneRect??{x:0,y:0,width:scene.width,height:scene.height}, sq=deploymentRect(token,grid,request.direction);
 if(!fitPlacement(sq,dims,scene.tokens,grid,token.level))throw Error("The chosen space is occupied or outside the scene.");
 if(blockedByWall(token,sq,grid,scene.walls))throw Error("A movement-blocking wall or closed door prevents placement.");
 // No stacked traps in the same space, including allied and GM-created traps.
 if(Array.from(scene.tiles??[]).some(t=>(!token.level||!t.levels?.size||t.levels.has?.(token.level))&&
   t.getFlag?.(ID,"trap")&&ready(t.getFlag(ID,"trap"),Date.now(),game.time?.worldTime)&&sq.x<t.x+t.width&&sq.x+sq.width>t.x&&sq.y<t.y+t.height&&sq.y+sq.height>t.y))throw Error("There is already an armed trap in that space.");
 const trap=portableTrap(chosen,{tier:getTrapwrightAssignment(chosen.name)?.minLevel,dc:p.dc,actorUUID:actor.uuid,disposition:Math.sign(token.disposition),subclass:p.subclass});
 // Keep class traps in the deployer's floor/elevation. Module treats this as a small portable object.
 const elevation=Number(token.elevation??0);
 Object.assign(trap,{level:token.level??"",minElevation:elevation,maxElevation:elevation,trapwrightExpires:Number.isFinite(game.time?.worldTime)?game.time.worldTime+3600:null});
 const dx=DIRECTIONS[request.direction][0],dy=DIRECTIONS[request.direction][1];
 trap.direction=((Math.atan2(dy,dx)*180/Math.PI)+360)%360;
 const source={...sq,name:trap.name,elevation,hidden:true,alpha:.55,texture:{src:ICON},
  ...(token.level?{levels:[token.level]}:{}),flags:{[ID]:{trap}}};
 return {actor,scene,source,spentAfter:spent+1,max:p.charges,catalogName:chosen.name};
}
export async function actOnRequest(msg,userId){
 if(!authority()||!msg?.id||localHandled.has(msg.id)||msg.getFlag?.(ID,"twHandled"))return;
 const raw=msg.getFlag?.(ID,"twRequest");
 if(!raw)return;
 const requester=game.users.get(userId);
 if(!requester||requester.id!==msg.author?.id||!msg.whisper?.includes(game.user.id))return;
 const request=parseRequest(raw,ageClock.now());
 if(!request)return;
 localHandled.add(msg.id);
 if(localHandled.size>600)localHandled.delete(localHandled.values().next().value);
 await lock(async()=>{
  if(!authority()||msg.getFlag?.(ID,"twHandled"))return;
  let tile=null, charged=false;
  try{
   await msg.setFlag(ID,"twHandled",true);
   const state=roster(),a=await buildDeployment(request,requester,{settings:state});
   // Charge before creating the tile; if creation fails, refund from the same serialized ledger.
   await game.settings.set(ID,SETTING,record(a.actor,a.spentAfter,state));charged=true;
   try{
    [tile]=await a.scene.createEmbeddedDocuments("Tile",[a.source]);
    if(!tile)throw Error("Foundry did not create the tile.");
   }catch(e){await game.settings.set(ID,SETTING,state);charged=false;throw e;}
   await notify(requester,"Placed <strong>"+plainName(a.catalogName)+"</strong>. "+(a.max-a.spentAfter)+" Trap Charges left.");
  }catch(e){
   const detail=charged&&tile?"Placement succeeded, but the private confirmation could not be posted.":plainName(e?.message??e);
   await notify(requester,detail).catch(logErr);
  }
 });
}
async function gmMenu(install){
 if(!authority())return show("Only the active GM can manage the Trapwright kit.");
 const [t]=canvas.tokens?.controlled??[],actor=t?.actor;
 const p=actor?characterProfile(actor):null;
 const current=p?ledgerStatus(actor,p):null;
 const status=p?'<p><strong>'+plainName(actor.name)+'</strong>: '+(current.allowed?"enabled":"not enrolled")+' · '+current.left+' / '+current.max+' charges.</p>':'<p>Select a linked Trapwright token to enable deployment or reset its charge ledger.</p>';
 const actions=[btn("install","Install class into Items"),...(p?[btn(current.allowed?"disable":"enable",current.allowed?"Disable deployment":"Enable deployment"),...(current.allowed?[btn("reset","Reset long-rest charges"),btn("adjust","Adjust charges")]:[])]:[]),btn("cancel","Cancel")];
 const a=await openDialog("Trapwright • GM tools",'<div class="tf-form">'+status+'<p>This class kit is designed for modern D&amp;D 5e. It never changes general Trap Forge permissions.</p></div>',actions);
 if(a==="install"){const result=await install();if(result)ui.notifications.info("Trapwright: class and subclasses are in your Items sidebar.");return;}
 if(!p||!a||a==="cancel"||!t.document.actorLink)return;
 let newLeft=null;
 if(a==="adjust"){
  newLeft=await openDialog("Adjust remaining Trap Charges",'<div class="tf-form"><p>Adjust the charge ledger without moving or disarming any tile.</p><label>Charges remaining (0 to '+p.charges+')<input type="number" name="left" min="0" max="'+p.charges+'" value="'+current.left+'"></label></div>',
   [btn("apply","Apply",(e,b)=>Number(b.form.elements.left.value)),btn("cancel","Cancel",()=>null)]);
  if(!Number.isSafeInteger(newLeft)||newLeft<0||newLeft>p.charges)return;
 }
 await lock(async()=>{
  if(!authority())return;
  const st=roster(),prior=Object.hasOwn(st,actor.id)?st[actor.id]:{spent:0};
  if(a==="reset"||a==="disable")await cleanOwned(actor);
  const next={enabled:a!=="disable",spent:a==="reset"?0:a==="adjust"?p.charges-newLeft:(prior.spent??0)};
  await game.settings.set(ID,SETTING,{...st,[actor.id]:next});
  ui.notifications.info("Trapwright: "+(a==="reset"?"charges restored.":a==="adjust"?"charges adjusted.":next.enabled?"deployment enabled.":"deployment disabled."));
 });
}
export function registerTrapwright(install){
 Hooks.once("init",()=>game.settings.register(ID,SETTING,{scope:"world",config:false,type:Object,default:{}}));
 Hooks.on("createChatMessage",(m,_o,u)=>actOnRequest(m,u).catch(logErr));
 Hooks.on("getHeaderControlsApplicationV2",(app,controls)=>{
  const d=app.document;
  const itemKey=d?.getFlag?.(ID,"twContent")?.kitKey??"";
  const actor=d?.documentName==="Item"&&itemKey.startsWith("feature:trapwright:1:trapcraft")?d.parent:d;
  if(!enabled()||!actor||!Array.isArray(controls)||!characterProfile(actor)||!own(actor,game.user))return;
  if(controls.some(item=>item.action==="ppTrapwrightDeploy"))return;
  controls.push({action:"ppTrapwrightDeploy",label:"Deploy Trap",icon:"fa-solid fa-screwdriver-wrench",onClick:()=>deployChooser(actor).catch(logErr)});
 });
 Hooks.on("getSceneControlButtons",controls=>{
  if(!enabled()||!controls.tokens)return;
  controls.tokens.tools["pp-trapwright"]={name:"pp-trapwright",title:"Trapwright: Deploy Trap",icon:"fa-solid fa-screwdriver-wrench",order:99,button:true,visible:true,onChange:()=>deployChooser().catch(logErr)};
 });
 Hooks.on("dnd5e.restCompleted",(actor,result,config)=>{
  // Core fires this on the client that performs the rest. GM-driven long rests can reset automatically.
  if(!authority()||!isEnrolled(actor)||!(config?.type==="long"||config?.longRest===true||result?.longRest===true))return;
  lock(async()=>{const st=roster();if(st[actor.id]?.enabled){await cleanOwned(actor);await game.settings.set(ID,SETTING,record(actor,0,st));}}).catch(logErr);
 });
 return {deploy:deployChooser,manage:()=>gmMenu(install)};
}
