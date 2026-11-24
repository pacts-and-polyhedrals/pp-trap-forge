import {ID,ICON,BASE,SAVE_NAMES,h,normalize,legacy,ready,pathFor,crossing,saveSpec,degree,damageFor} from "./core.mjs";
import {CATALOG} from "./catalog.mjs";
import {FAMILIES,familyFor,artFor} from "./av-profiles.mjs";
import {receiveCue,clearEffects,registerMediaSettings,warmAssets} from "./av-runtime.mjs";
import {registerTrapwright} from "./trapwright.mjs";
import {installTrapwrightKit} from "./trapwright-install.mjs";
const trapwright=registerTrapwright(installTrapwrightKit);
const locks=new Map(), seen=new Set(), clientPending=new Set(), spentTravel=new Set();
let travelQueue=Promise.resolve();
const flag=(doc,key)=>doc?.getFlag?.(ID,key);
const owned=(token,user=game.user)=>Boolean(user?.isGM||token?.actor?.testUserPermission?.(user,"OWNER")||token?.testUserPermission?.(user,"OWNER"));
const active=()=>game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const chat=()=>foundry.documents.ChatMessage;
const roller=()=>foundry.dice.Roll;
const dialog=()=>foundry.applications.api.DialogV2;
const warn=(s)=>ui.notifications.warn("Trap Forge: "+s);
const err=(e)=>{console.error("Trap Forge",e);warn(e?.message??String(e));};
const byId=(gameCollection,id)=>gameCollection?.get?.(id);
const getToken=(ref)=>byId(byId(game.scenes,ref.scene)?.tokens,ref.token);
const clearSeen=()=>{if(seen.size>2500)seen.delete(seen.values().next().value);};
const getGrid=s=>s.grid?.size||s.dimensions?.size||100;
const record=(d,t)=>({x:d.x,y:d.y,w:d.width,h:d.height,rotation:d.rotation,level:t.level});
const rectDialog=(title,body,buttons,render)=>{
 const content=document.createElement("div");
 // Dynamic values are escaped by h() before they reach internally authored markup.
 content.innerHTML=body;
 return dialog().wait({window:{title},position:{width:590},content,buttons,render,rejectClose:false});
};
function serial(id,f) {
 const tail=(locks.get(id)??Promise.resolve()).catch(()=>{}).then(f);
 locks.set(id,tail);tail.finally(()=>{if(locks.get(id)===tail)locks.delete(id);}).catch(()=>{});return tail;
}
function fitState(t,tile) {
 const lev=[...(tile.levels??[])];
 return lev.length===1?{...t,level:lev[0]}:t;
}
const activeArt=(t)=>t.art===ICON?(artFor(familyFor(t))??ICON):t.art;
const textureFor=(t,hidden)=>({src:hidden?t.art:activeArt(t),rotation:hidden?0:(360+t.direction)%360});
function tags(){return "flags."+ID+".trap";}
function validate(t) {
 if(t.damage&&!roller().validate(t.damage))throw new Error("Enter a valid Foundry dice formula, e.g. 2d8 + 2.");
 if(t.minElevation!==""&&t.maxElevation!==""&&t.minElevation>t.maxElevation)throw new Error("Minimum elevation must be at or below maximum.");
 return t;
}
function allowedTarget(token,t) {
 if(!token.actor)return false;
 if(t.targets==="all")return true;
 if(t.targets==="opposed")return !!t.trapwrightOwner&&token.actor.uuid!==t.trapwrightOwner&&Math.sign(token.disposition??0)*t.trapwrightSide===-1;
 return game.users.some(u=>!u.isGM&&owned(token,u))||!!token.actor.hasPlayerOwner;
}
async function showTrigger(tile,token,{test=false,force=false}={}) {
 if(!active()||!tile||!token||tile.parent?.id!==token.parent?.id)return;
 return serial(tile.uuid,async()=>{
  if(!active())return;
  const original=flag(tile,"trap");if(!original)return;
  const t=validate(normalize(original));
  if(!test&&!force&&(!ready(t,Date.now(),game.time?.worldTime)||!allowedTarget(token,t)))return;
  const roll=t.damage?await new (roller())(t.damage,token.actor?.getRollData?.()??{}).evaluate():null;
  if(roll&&!Number.isFinite(roll.total))throw new Error("Damage formula did not produce a finite number.");
  const base=Math.max(0,Math.floor(roll?.total??0));
  const state={...t,lastAt:Date.now(),spent:t.reset==="once"||t.spent};
  const spec=saveSpec(game.system.id,t.save,t.customSave);
  const hasSave=t.save!=="none";
  const card={scene:token.parent.id,token:token.id,tile:tile.id,name:t.name,base,dc:t.dc,hasSave,save:spec,success:t.success,effect:t.failureEffect,type:t.damageType,system:game.system.id,test,resolved:false};
  const saveText=hasSave?"<p><strong>"+h(spec.label)+" save • DC "+t.dc+"</strong></p>":"";
  const result=hasSave?"<p>Pending save. The roll above is full damage before the save, resistance or immunity.</p>":(t.failureEffect?"<p><strong>Effect:</strong> "+h(t.failureEffect)+"</p>":"");
  const body='<div class="tf-chat"><h3>'+h((test?"Test: ":"")+t.name)+'</h3><p>'+h(t.triggerText)+'</p><p><strong>Target:</strong> '+h(token.name)+'</p>'+saveText+(roll?'<p><strong>'+base+' '+h(t.damageType||"")+' damage rolled</strong> ('+h(roll.formula)+')</p>':"")+result+'<div class="tf-actions"></div></div>';
  // Roll before committing the tile; never consume a trap for an invalid formula.
  const before={hidden:tile.hidden,alpha:tile.alpha,texture:{src:tile.texture?.src??t.art,rotation:tile.texture?.rotation??0}};
  const family=familyFor(t);
  const cue=family?{family,scene:token.parent.id,x:tile.x+tile.width/2,y:tile.y+tile.height/2,
   w:tile.width,h:tile.height,rotation:(tile.rotation||0)+t.direction,
   level:fitState(t,tile).level||token.level||"",elevation:tile.elevation??0,markVisible:t.reveal||!tile.hidden,
   createdAt:0,private:test,vfxOn:t.vfxOn,sfxOn:t.sfxOn,sound:t.sound,gain:t.gain}:null;
  if(!test)await tile.update({[tags()]:state,...(t.reveal?{hidden:false,alpha:1,texture:textureFor(t,false)}:{})});
  try{
   if(cue)cue.createdAt=Date.now();
   await chat().create({content:body,speaker:chat().getSpeaker({token}),...(roll?{rolls:[roll]}:{}),...(test?{whisper:[game.user.id]}:{}),flags:{[ID]:{trigger:card,...(cue?{cue}:{})}}});
   return true;
  } catch(e) {
   if(!test)await tile.update({[tags()]:t,...before}).catch(()=>{});
   throw e;
  }
 });
}
function onMove(token,move){
 if(!active()||!token?.parent||token.hidden)return;
 const marker=move.id?token.uuid+":"+move.id:null;
 if(marker){if(seen.has(marker))return;seen.add(marker);clearSeen();}
 const path=pathFor(move,token);if(path.length<2)return;
 const tele=/teleport/i.test(move.method??"");
 const hits=[];
 for(const tile of token.parent.tiles){
  const raw=flag(tile,"trap");if(!raw)continue;
  const t=fitState(normalize(raw),tile);if(!ready(t,Date.now(),game.time?.worldTime)||!allowedTarget(token,t))continue;
  if(t.trapwrightOwner&&(tele||/forced/i.test(move.method??"")||path.some(p=>/forced|teleport/i.test(p.action??""))))continue;
  const time=crossing(path,record(tile,t),getGrid(token.parent),t,tele);
  if(time!==null)hits.push({tile,time,portable:!!t.trapwrightOwner});
 }
 hits.sort((a,b)=>a.time-b.time||a.tile.id.localeCompare(b.tile.id));
 if(!hits.length)return;
 const travelId=token.uuid+":"+(move.subpathId??move.id??crypto.randomUUID());
 travelQueue=travelQueue.catch(()=>{}).then(async()=>{
  for(const {tile,portable} of hits){
   if(!active())break;
   if(portable&&spentTravel.has(travelId))continue;
   const triggered=await showTrigger(tile,token).catch(err);
   if(portable&&triggered){
    spentTravel.add(travelId);
    if(spentTravel.size>1500)spentTravel.delete(spentTravel.values().next().value);
   }
  }
 });
}
const toRoll=x=>Array.isArray(x)?x.find(y=>Number.isFinite(y?.total)):Array.isArray(x?.rolls)?x.rolls[0]:x;
function natural(roll){
 const die=roll?.dice?.find(x=>x.faces===20);
 const r=die?.results?.find(x=>x.active!==false&&!x.discarded);
 return r?.result;
}
async function postResult(msg,roll) {
 if(!roll||!Number.isFinite(roll.total))return;
 await chat().create({content:"<p>Trap Forge saving throw: "+h(msg.id)+"</p>",rolls:[roll],speaker:msg.speaker,
 ...(msg.whisper?.length?{whisper:[...msg.whisper]}:{}),
 flags:{[ID]:{response:{request:msg.id}}}});
}
async function playerSave(msg,c,token) {
 if(!owned(token)||clientPending.has(msg.id)||flag(msg,"resolved"))return;
 clientPending.add(msg.id);
 try{
  const a=token.actor,s=c.save.key;
  let roll;
  if(c.system==="dnd5e" && /^[a-z]{3}$/.test(s) && s!=="none"){
   if(typeof a.rollSavingThrow==="function"){
    // dnd5e 5.x/6.x: separate roll, dialog and message configs.
    roll=toRoll(await a.rollSavingThrow({ability:s,target:c.dc},{},{create:false}));
    if(!roll)return;
   } else if(typeof a.rollAbilitySave==="function") {
    roll=toRoll(await a.rollAbilitySave(s,{chatMessage:false}));
    if(!roll)return;
   }
  }
  if(!roll&&c.system==="pf2e"&&["fortitude","reflex","will"].includes(s)&&a.saves?.[s]?.check?.roll){
   roll=toRoll(await a.saves[s].check.roll({dc:{value:c.dc},createMessage:false}));
   if(!roll)return;
  }
  if(!roll){
   const form='<p>'+h(c.save.label)+' save. Use your system’s normal save if it uses a different mechanic, then ask the GM to record it.</p><label>Die formula <input name="formula" type="text" value="1d20"></label><label>Modifier <input name="mod" type="number" step="1" min="-100" max="100" value="0"></label>';
   const answer=await rectDialog("Roll a trap save",form,[{action:"roll",label:"Roll",callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"cancel",label:"Cancel",callback:()=>null}]);
   if(!answer)return;
   const f=String(answer.formula??"").trim(), m=Math.max(-100,Math.min(100,Number(answer.mod)||0));
   if(!/^(?:[1-9]|[1-9]\d)d(?:[2-9]|[1-9]\d{1,2})$/i.test(f))throw new Error("Use one dice expression, e.g. 1d20 or 2d6.");
   roll=await new (roller())(f+(m<0?" - ":" + ")+Math.abs(m)).evaluate();
  }
  await postResult(msg,roll);
 }finally{clientPending.delete(msg.id);}
}
async function resolve(msg,c,{total,nat,override}={}) {
 if(!active())return;
 return serial("chat:"+msg.id,async()=>{
  if(!active())return;
  if(flag(msg,"resolved"))return;
  const d=override??degree(c.system,total,c.dc,nat);
  const n=damageFor(c.base,d,c.success,c.system);
  await msg.setFlag(ID,"resolved",{degree:d,total:total??null,amount:n});
  const label=d===2?"Critical success":d===1?"Success":d===-1?"Critical failure":"Failure";
  const content='<div class="tf-chat"><h3>'+h((c.test?"Test: ":"")+c.name+" result")+'</h3><p><strong>'+label+'</strong>'+(total===undefined?"":" • save "+h(total)+" against DC "+c.dc)+'</p><p><strong>'+n+' '+h(c.type||"")+' damage</strong> before resistances or other adjustments.</p>'+(d<1&&c.effect?'<p><strong>Effect:</strong> '+h(c.effect)+'</p>':'')+'</div>';
  try{await chat().create({content,speaker:msg.speaker,...(msg.whisper?.length?{whisper:[...msg.whisper]}:{})});}
  catch(e){await msg.unsetFlag(ID,"resolved").catch(()=>{});throw e;}
 });
}
function onSaveMessage(response,options,userId) {
 if(!active())return;
 const ref=flag(response,"response"); if(!ref?.request || !response.rolls?.length)return;
 const msg=game.messages.get(ref.request), c=flag(msg,"trigger"), user=game.users.get(userId)??response.author;
 if(!c?.hasSave||!msg.author?.isGM||!user||!owned(getToken(c),user)||response.author?.id!==user.id)return;
 const r=response.rolls[0];if(!Number.isFinite(r?.total))return;
 resolve(msg,c,{total:r.total,nat:natural(r)}).catch(err);
}
function renderCard(msg,html) {
 const c=flag(msg,"trigger");
 if(!c?.hasSave||!msg.author?.isGM)return;
 const area=html.querySelector(".tf-actions");if(!area)return;
 const token=getToken(c),done=flag(msg,"resolved");
 if(done){area.textContent="Save resolved.";return;}
 if(!token||!owned(token))return;
 const b=(label,func)=>{const el=document.createElement("button");el.type="button";el.textContent=label;el.addEventListener("click",async()=>{
  el.disabled=true;try{await func();}catch(e){err(e);}finally{el.disabled=false;}
 });area.append(el);};
 b("Roll "+c.save.label+" save",()=>playerSave(msg,c,token));
 if(active())b("GM: record save",async()=>{
  const out=await rectDialog("Record trap save",'<p>Use a result from any system, or choose success/failure on a narrative ruling.</p><label>Total <input name="total" type="number" placeholder="Optional for a ruling"></label>',[
   {action:"score",label:"Resolve total",callback:(_e,b)=>{const v=b.form.elements.total.value;return v===""?null:{total:Number(v)};}},
   {action:"success",label:"Success",callback:()=>({override:1})},{action:"failure",label:"Failure",callback:()=>({override:0})}]);
  if(out)await resolve(msg,c,out);
 });
}
const escOpt=(items,current)=>items.map(([k,v])=>'<option value="'+h(k)+'" '+(String(k)===String(current)?"selected":"")+'>'+h(v)+'</option>').join("");
const sel=(label,name,options,value)=>'<label>'+h(label)+'<select name="'+name+'">'+escOpt(options,value)+'</select></label>';
const input=(label,name,value,type="text",extra="")=>'<label>'+h(label)+'<input name="'+name+'" type="'+type+'" value="'+h(value)+'" '+extra+'></label>';
const check=(label,name,on)=>'<label class="tf-check"><input type="checkbox" name="'+name+'" '+(on?"checked":"")+'> '+h(label)+'</label>';
const ta=(label,name,value)=>'<label>'+h(label)+'<textarea name="'+name+'" rows="2">'+h(value)+'</textarea></label>';
const groups=[...new Set(CATALOG.map(p=>p.category))];
function choosePreset() {
 let selected=null;
 const options=()=>'<option value="">Blank/custom trap</option>'+groups.map(g=>'<optgroup label="'+h(g)+'">'+CATALOG.map((p,i)=>[p,i]).filter(([p])=>p.category===g).map(([p,i])=>'<option value="'+i+'">'+h(p.name)+'</option>').join("")+'</optgroup>').join("");
 return rectDialog("Trap Forge • choose a preset",'<div class="tf-form"><p>Choose one of '+CATALOG.length+' presets or start blank. All statistics are editable.</p><label>Search presets<input name="filter" type="search" placeholder="Mechanism, name or damage type"></label><label>Preset<select name="preset" size="10">'+options()+'</select></label><p class="tf-preview" aria-live="polite"></p></div>',[{action:"edit",label:"Configure trap",callback:(_e,b)=>{const x=b.form.elements.preset.value;return x===""?{...BASE}:CATALOG[Number(x)];}},{action:"cancel",label:"Cancel",callback:()=>null}],(_ev,app)=>{
  const el=app.element,filter=el.querySelector('[name="filter"]'),menu=el.querySelector('[name="preset"]'),preview=el.querySelector(".tf-preview");
  const show=()=>{selected=menu.value===""?null:CATALOG[menu.value];preview.textContent=selected?selected.triggerText+" "+(selected.damage||"No damage roll"): "Configure any trap from scratch.";};
  filter.addEventListener("input",()=>{const needle=filter.value.trim().toLowerCase();for(const o of menu.options){const p=CATALOG[o.value];o.hidden=Boolean(p&&!(p.name+" "+p.category+" "+p.damageType).toLowerCase().includes(needle));}if(menu.selectedOptions[0]?.hidden)menu.value="";show();});menu.addEventListener("change",show);show();
 });
}
function connectAssetBrowser(app){
 const root=app?.element;
 if(!root)return;
 for(const b of root.querySelectorAll("button[data-tf-browse]")){
  const field=root.querySelector('[name="'+b.dataset.tfBrowse+'"]');
  if(!field)continue;
  b.addEventListener("click",()=>{
   try{
    const Picker=foundry.applications.apps.FilePicker?.implementation??foundry.applications.apps.FilePicker;
    if(!Picker)return warn("File picker not available; enter a Foundry Data path.");
    const picker=new Picker({type:b.dataset.tfType,current:field.value,callback:path=>{field.value=path;}});
    picker.render({force:true});
   }catch(e){err(e);}
  });
 }
}
const assetInput=(label,name,value,type)=>'<div class="tf-asset">'+input(label,name,value)+'<button type="button" data-tf-browse="'+name+'" data-tf-type="'+type+'">Browse</button></div>';
function fromForm(f){
 const v=Object.fromEntries(new FormData(f));for(const k of ["hidden","reveal","destinationOnly","vfxOn","sfxOn"])v[k]=f.elements[k].checked;
 return v;
}
async function config(seed,tile=null){
 const t=normalize(seed), content='<div class="tf-form">'+input("Name","name",t.name)+ta("Trigger narration","triggerText",t.triggerText)+'<div class="tf-columns">'+
 input("Damage dice","damage",t.damage)+input("Damage type","damageType",t.damageType)+sel("Save","save",Object.entries(SAVE_NAMES),t.save)+input("DC","dc",t.dc,"number",'min="0" max="100"')+
 input("Custom save label","customSave",t.customSave)+sel("Damage on success","success",[["none","None"],["half","Half"],["full","Full"]],t.success)+'</div>'+
 ta("Effect on failure (instruction in chat)","failureEffect",t.failureEffect)+
 '<div class="tf-columns">'+input("Width (grid cells)","sizeX",t.sizeX,"number",'min=".25" max="25" step=".25"')+input("Height (grid cells)","sizeY",t.sizeY,"number",'min=".25" max="25" step=".25"')+
 sel("Reset rule","reset",[["once","Single use until rearmed"],["repeat","Every new entry"],["cooldown","Cooldown"]],t.reset)+input("Cooldown (seconds)","cooldown",t.cooldown,"number",'min="0"')+
 input("Minimum elevation (optional)","minElevation",t.minElevation,"number",'step="any"')+input("Maximum elevation (optional)","maxElevation",t.maxElevation,"number",'step="any"')+
 sel("Eligible targets","targets",[["pcs","Player-owned actors"],["all","All actors"],...(t.trapwrightOwner?[["opposed","Opposing creatures (Trapwright)"]]:[])],t.targets)+'</div>'+
 '<p class="tf-divider">Reveal artwork, animation and sound</p>'+
 '<p>Auto chooses a matching cue and reveal art. A custom image or video overrides only the permanent tile art.</p>'+
 '<div class="tf-columns">'+sel("Effect profile","av",[["auto","Auto by trap"],["none","No reveal art or cue"],...Object.entries(FAMILIES).map(([k,v])=>[k,v.title])],t.av)+
 input("Cue angle (0° emits from left edge)","direction",t.direction,"number",'min="-180" max="360" step="5"')+
 check("Animate on trigger","vfxOn",t.vfxOn)+check("Play sound on trigger","sfxOn",t.sfxOn)+
 input("Trap sound level","gain",t.gain,"number",'min="0" max="1" step=".05"')+'</div>'+
 assetInput("Custom sound path (blank = built-in)","sound",t.sound,"audio")+
 assetInput("Image/video path in Foundry Data","art",t.art,"imagevideo")+
 '<div class="tf-columns">'+check("Start hidden", "hidden",t.hidden)+check("Reveal on trigger","reveal",t.reveal)+check("Destination only (no swept crossing)","destinationOnly",t.destinationOnly)+'</div></div>';
 let values=await rectDialog(tile?"Edit "+t.name:"Configure trap",content,[{action:"save",label:tile?"Save changes":"Place hidden tile",callback:(_e,b)=>fromForm(b.form)},{action:"cancel",label:"Cancel",callback:()=>null}],(_ev,app)=>connectAssetBrowser(app));
 if(!values)return null;
 try{return validate(normalize({...t,...values}));}
 catch(e){warn(e.message);return config({...t,...values},tile);}
}
function viewLevel(){
 const l=canvas.level??canvas.scene?.viewedLevel;
 return typeof l==="string"?l:l?.id;
}
async function place(t,scene=canvas.scene){
 if(!game.user.isGM||!scene||canvas.scene?.id!==scene.id)return warn("Open the target scene as GM first.");
 const g=getGrid(scene),w=Math.round(t.sizeX*g),height=Math.round(t.sizeY*g),chosen=canvas.tokens?.controlled?.[0];
 const origin=chosen?.center??canvas.stage?.pivot??{x:scene.width/2,y:scene.height/2};
 const rect=canvas.dimensions?.sceneRect??scene.dimensions?.sceneRect;
 const nx=rect?.x??0,ny=rect?.y??0;
 const xy={x:nx+Math.round((origin.x-w/2-nx)/g)*g,y:ny+Math.round((origin.y-height/2-ny)/g)*g};
 const level=chosen?.document?.level??viewLevel();
 const [tile]=await scene.createEmbeddedDocuments("Tile",[{name:t.name,...xy,width:w,height,texture:textureFor(t,t.hidden),hidden:t.hidden,alpha:t.hidden ? 0.55 : 1,
  ...(level?{levels:[level]}:{}),flags:{[ID]:{trap:{...t,level:level??"",armed:true,spent:false,lastAt:0}}}}]);
 if(!tile)throw new Error("The tile was not created.");
 canvas.tiles?.activate?.(); tile.object?.control?.({releaseOthers:true});
 ui.notifications.info("Trap Forge: "+t.name+" placed; drag it into position.");
 return tile;
}
async function manage(scene=canvas.scene){
 const all=[...scene.tiles].filter(t=>flag(t,"trap"));if(!all.length)return warn("No Trap Forge tiles on this scene.");
 const result=await rectDialog("Manage scene traps",'<div class="tf-form">'+sel("Trap tile","tile",all.map(d=>{const t=flag(d,"trap");return [d.id,t.name+" • "+(!t.armed?"disarmed":t.reset==="once"&&t.spent?"spent":"armed")];}),all[0].id)+
 '<p>Select a token on the canvas first for a private test. Test cards do not alter the trap or hit points.</p></div>',
 [["edit","Edit"],["arm","Rearm & hide"],["disarm","Disarm"],["test","Test selected token"]].map(([action,label])=>({action,label,callback:(_e,b)=>({action,id:b.form.elements.tile.value})})));
 if(!result)return;
 const tile=scene.tiles.get(result.id);if(!tile)return;
 const t=normalize(flag(tile,"trap")),g=getGrid(scene);
 if(result.action==="edit") {const next=await config(t,tile);if(next)await tile.update({name:next.name,[tags()]:next,texture:textureFor(next,tile.hidden),width:Math.round(next.sizeX*g),height:Math.round(next.sizeY*g)});}
 if(result.action==="arm")await tile.update({[tags()]:{...t,armed:true,spent:false,lastAt:0},hidden:t.hidden,alpha:t.hidden ? 0.55 : 1,texture:textureFor(t,t.hidden)});
 if(result.action==="disarm")await tile.setFlag(ID,"trap",{...t,armed:false});
 if(result.action==="test"){const token=canvas.tokens?.controlled?.[0]?.document;if(!token)return warn("Select a token before testing.");if(!active())return warn("The active GM must run the test.");await showTrigger(tile,token,{test:true});}
}
const oldKeys=["trap-forge-pro-tile-fix","trap-forge","trap-forge-v04","trap-forge-v0-4"];
function oldData(tile){return Object.entries(tile.flags??{}).find(([k,v])=>k!==ID&&(oldKeys.includes(k)||/^trap.?forge/i.test(k))&&v?.trap)?.[1]?.trap;}
async function migrate(scene=canvas.scene){
 const all=[...scene.tiles].filter(t=>!flag(t,"trap")&&oldData(t));if(!all.length)return warn("No legacy Trap Forge tiles were found on this scene.");
 const yes=await dialog().confirm({window:{title:"Adopt legacy trap tiles?"},content:"<p>Adopt "+all.length+" legacy tiles? Existing art, position and old flags are preserved. Stop running the old macro first to avoid duplicate hooks.</p>",rejectClose:false});
 if(!yes)return;
 const g=getGrid(scene);
 await scene.updateEmbeddedDocuments("Tile",all.map(t=>({_id:t.id,[tags()]:{...legacy(oldData(t),t),sizeX:t.width/g,sizeY:t.height/g,level:[...(t.levels??[])][0]??""}})));
 ui.notifications.info("Trap Forge: adopted "+all.length+" legacy tiles.");
}
async function open(){
 if(!game.user.isGM||!canvas.scene)return warn("Open a scene as GM.");
 const action=await rectDialog("Pacts & Polyhedrals • Trap Forge",'<div class="tf-form"><p>Place a trap at a selected token or the viewport centre, then drag the tile into position. An active GM is required for automation.</p><p>'+CATALOG.length+' original fantasy presets • no system dependency</p></div>',
  [["new","Place trap"],["manage","Manage traps"],["legacy","Adopt old tiles"],...(game.system.id==="dnd5e"?[["trapwright","Trapwright class kit"]]:[])].map(([action,label])=>({action,label})));
 if(action==="new"){const preset=await choosePreset();if(preset){const spec=await config(preset);if(spec)await place(spec);}}
 if(action==="manage")await manage();
 if(action==="legacy")await migrate();
 if(action==="trapwright")await trapwright.manage();
}
Hooks.on("getSceneControlButtons",controls=>{
 if(!game.user?.isGM)return;
 const group=controls.tiles??controls.tokens;if(!group)return;
 group.tools[ID]={name:ID,title:"Trap Forge",icon:"fa-solid fa-skull-crossbones",order:Math.max(0,...Object.values(group.tools).map(t=>Number(t.order)||0))+1,button:true,visible:true,onChange:()=>open().catch(err)};
});
Hooks.on("moveToken",onMove);
Hooks.on("renderChatMessageHTML",renderCard);
Hooks.once("init",registerMediaSettings);
Hooks.on("canvasTearDown",clearEffects);
Hooks.on("createChatMessage",(m,o,u)=>{onSaveMessage(m,o,u);receiveCue(m);});
Hooks.once("ready",()=>{
 warmAssets();
 game.modules.get(ID).api={open,trapwright,place:async(s)=>place(validate(normalize(s))),presets:()=>CATALOG.map(s=>({...s})),trigger:async(tile,token,{test=true}={})=>showTrigger(tile,token,{test,force:!test})};
});
