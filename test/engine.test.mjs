import test from "node:test";
import assert from "node:assert/strict";
import {ID,normalize,legacy,crossing,pathFor,ready,saveSpec,degree,damageFor} from "../scripts/core.mjs";
import {CATALOG} from "../scripts/catalog.mjs";
const R={x:100,y:100,w:100,h:100,rotation:0};
const p=(x,y,elevation=0,level="A",action="")=>({x,y,elevation,level,action,width:1,height:1});
const hit=(pts,t=R,s={},teleport=false)=>crossing(pts,t,100,normalize(s),teleport);
test("crosses a whole trap in one move and returns order",()=>assert.equal(hit([p(0,100),p(300,100)]),1/6));
test("walks past trap and ignores merely touching an edge",()=>{assert.equal(hit([p(0,50),p(300,50)]),null);assert.equal(hit([p(0,49),p(300,49)]),null);});
test("enters on a later segment; no trigger from untraversed pending waypoints",()=>{
 const origin=p(0,0), turn=p(0,100), dest=p(300,100);
 assert.ok(hit(pathFor({origin,destination:dest,passed:{waypoints:[turn]},pending:{waypoints:[p(100,100)]}},{}))>1);
 assert.equal(hit(pathFor({origin,destination:p(300,0),pending:{waypoints:[p(100,100)]}},{})),null);
});
test("starts inside, leaves, then reenters",()=>{
 assert.equal(hit([p(100,100),p(200,100)]),null);
 assert.notEqual(hit([p(100,100),p(200,100),p(100,100)]),null);
});
test("ignores teleport travel, but triggers on a destination in bounds",()=>{
 assert.equal(hit([p(0,100),p(300,100)],R,{},true),null);
 assert.equal(hit([p(0,100),p(100,100)],R,{},true),1);
 assert.equal(hit([p(0,100),p(300,100,0,"A","teleport")]),null);
});
test("respects elevation incl. exactly on bounds and scene levels",()=>{
 assert.equal(hit([p(0,100,9),p(300,100,9)],R,{maxElevation:3}),null);
 assert.notEqual(hit([p(0,100,3),p(300,100,3)],R,{minElevation:3,maxElevation:6}),null);
 assert.equal(hit([p(0,100,0,"B"),p(300,100,0,"B")],R,{level:"A"}),null);
});
test("rotated tile and destination-only mode",()=>{
 const t={x:100,y:140,w:100,h:20,rotation:90};
 assert.notEqual(hit([p(98,0),p(98,300)],t),null);
 assert.equal(hit([p(70,0),p(70,300)],t),null);
 assert.equal(hit([p(98,0),p(98,300)],t,{destinationOnly:true}),null);
});
test("old tile conversion keeps mechanics without modifying source",()=>{
 const raw={name:"Old trap",saveAbility:"con",saveDc:17,damageFormula:"4d8",halfOnSuccess:true,state:{armed:true,triggered:true}};
 const t=legacy(raw,{hidden:true,texture:{src:"worlds/room/tile.webm"}});
 assert.deepEqual([t.save,t.dc,t.damage,t.success,t.spent,t.art],["con",17,"4d8","half",true,"worlds/room/tile.webm"]);
 assert.equal(raw.name,"Old trap");
});
test("cooldown and non-system-specific dice rules",()=>{
 assert.equal(ready(normalize({reset:"cooldown",lastAt:1000,cooldown:4}),4999),false);
 assert.equal(ready(normalize({reset:"cooldown",lastAt:1000,cooldown:4}),5000),true);
 assert.equal(saveSpec("pf2e","dex").key,"reflex");
 assert.equal(degree("pf2e",24,15,20),2);
 assert.equal(damageFor(9,1,"half","custom"),4);
 assert.equal(damageFor(9,-1,"half","pf2e"),18);
});
test("catalog names are unique and assets are sanitized",()=>{
 assert.equal(CATALOG.length,86); assert.equal(new Set(CATALOG.map(s=>s.name)).size,86);
 assert.ok(CATALOG.every(p=>!p.damage||/^\d+d\d+$/.test(p.damage)));
 assert.match(normalize({art:"https://example.com/a.svg"}).art,/^modules\//);
});
const hooks=new Map(), logs=new Map(), scene={id:"test-scene",grid:{size:100},tiles:new Map(),tokens:new Map()};
globalThis.Hooks={on:(key,cb)=>hooks.set(key,cb),once:(key,cb)=>hooks.set(key,cb)};
const gm={id:"gm",isGM:true}, otherGM={id:"other-gm",isGM:true}, player={id:"player",isGM:false}, stranger={id:"stranger",isGM:false};
const users=new Map([gm,otherGM,player,stranger].map(u=>[u.id,u]));users.activeGM=gm;users.some=fn=>[...users.values()].some(fn);
const actor={hasPlayerOwner:true,testUserPermission:u=>u.id==="player",getRollData:()=>({})};
const token={id:"token",uuid:"Scene.test-scene.Token.token",parent:scene,name:"Test & Brave",width:1,height:1,actor};
scene.tokens.set(token.id,token);
scene.tiles[Symbol.iterator]=scene.tiles.values;
globalThis.game={user:gm,users,system:{id:"not-dnd"},messages:logs,scenes:new Map([[scene.id,scene]]),modules:new Map([[ID,{}]])};
globalThis.ui={notifications:{info(){},warn(msg){throw new Error(msg);}}};
class Roll {
 static validate(f){return f!=="nonsense";}
 constructor(f){this.formula=f;this.dice=[];}
 async evaluate(){this.total=this.formula==="2d10"?9:16;return this;}
}
let failCreate=false;
class Chat {
 static getSpeaker({token}){return {alias:token.name};}
 static async create(input){
  if(failCreate){failCreate=false;throw new Error("chat failure");}
  const m={...input,id:"m"+(logs.size+1),author:game.user,flags:input.flags??{},
   getFlag(i,k){return this.flags[i]?.[k];},async setFlag(i,k,val){(this.flags[i]??={})[k]=val;},async unsetFlag(i,k){delete this.flags[i][k];}};
  logs.set(m.id,m);hooks.get("createChatMessage")?.(m,{},m.author.id);return m;
 }
}
globalThis.foundry={documents:{ChatMessage:Chat},dice:{Roll}};
await import("../scripts/main.mjs");
hooks.get("ready")();
function tile(id,t={},x=100){
 const a={id,uuid:"Tile."+id,parent:scene,x,y:100,width:100,height:100,rotation:0,hidden:true,alpha:.44,texture:{src:"old.svg"},levels:new Set(),
  config:normalize(t),getFlag(i,k){return i===ID&&k==="trap"?this.config:undefined;},
  async update(data){const k="flags."+ID+".trap";if(k in data)this.config=data[k];if("hidden" in data)this.hidden=data.hidden;if("alpha" in data)this.alpha=data.alpha;if(data.texture)this.texture=data.texture;return this;}};
 scene.tiles.set(id,a);return a;
}
const wait=()=>new Promise(r=>setTimeout(r,20));
test("simulated end-to-end v14 hook: one reveal/card, wrong-owner rejected, real owner resolves",async()=>{
 const t=tile("one",{name:"Trap <b>",damage:"2d10",save:"dex",dc:14,success:"half"});
 const moved={id:"move-1",origin:p(0,100),destination:p(300,100)};
 game.user=otherGM;hooks.get("moveToken")(token,moved);assert.equal(t.hidden,true);
 game.user=gm;hooks.get("moveToken")(token,moved);hooks.get("moveToken")(token,moved);await wait();
 assert.equal(t.hidden,false);assert.equal(t.config.spent,true);
 const msgs=[...logs.values()];assert.equal(msgs.length,1);
 assert.match(msgs[0].content,/Trap &lt;b&gt;/);assert.match(msgs[0].content,/Dexterity save/);assert.equal(msgs[0].rolls[0].total,9);
 const buttons=[];
 globalThis.document={createElement:()=>({addEventListener(ev,fn){this.fn=fn;}})};
 game.user=stranger;hooks.get("renderChatMessageHTML")(msgs[0],{querySelector:()=>({append:e=>buttons.push(e)})});assert.equal(buttons.length,0);
 game.user=player;hooks.get("renderChatMessageHTML")(msgs[0],{querySelector:()=>({append:e=>buttons.push(e)})});assert.equal(buttons[0].textContent,"Roll Dexterity save");
 game.user=gm;
 const makeResponse=u=>({author:u,rolls:[{total:17}],getFlag:(i,k)=>k==="response"?{request:msgs[0].id}:undefined});
 hooks.get("createChatMessage")(makeResponse(stranger),{},stranger.id);await wait();assert.equal(logs.size,1);
 hooks.get("createChatMessage")(makeResponse(player),{},player.id);hooks.get("createChatMessage")(makeResponse(player),{},player.id);await wait();
 assert.equal(logs.size,2);assert.equal(msgs[0].getFlag(ID,"resolved").amount,4);
 const result=[...logs.values()][1];assert.match(result.content,/4 piercing damage/);
});
test("private test has no scene mutation; failure rolls tile state back",async()=>{
 const t=tile("private",{save:"none"});const api=game.modules.get(ID).api;
 const n=logs.size;
 await api.trigger(t,token);
 assert.equal(t.hidden,true);assert.equal(t.config.spent,false);assert.deepEqual([...logs.values()].at(-1).whisper,["gm"]);
 assert.equal(logs.size,n+1);
 failCreate=true;await assert.rejects(api.trigger(t,token,{test:false}),/chat failure/);
 assert.equal(t.hidden,true);assert.equal(t.alpha,.44);assert.equal(t.config.spent,false);
});

test("trigger applies persistent art; custom art, rotation and reveal-off are respected",async()=>{
 const api=game.modules.get(ID).api;
 let t=tile("p", {name:"Pressure Plate Pit",direction:90});
 await api.trigger(t,token,{test:false});
 const last=[...logs.values()].at(-1);
 assert.match(t.texture.src,/\/pit-open.svg$/);
 assert.equal(t.texture.rotation,90);
 assert.equal(last.getFlag(ID,"cue").family,"pit");
 assert.equal(last.getFlag(ID,"cue").rotation,90);
 t=tile("other", {name:"Wall Flame Jet",art:"worlds/my-world/custom.webp"});
 await api.trigger(t,token,{test:false});
 assert.equal(t.texture.src,"worlds/my-world/custom.webp");
 assert.equal([...logs.values()].at(-1).getFlag(ID,"cue").family,"fire-jet");
 t=tile("covert", {name:"Alarm",reveal:false,av:"none"});
 await api.trigger(t,token,{test:false});
 assert.equal(t.texture.src,"old.svg");
 assert.equal(t.hidden,true);
 assert.equal([...logs.values()].at(-1).getFlag(ID,"cue"),undefined);
});

test("native adapter contracts and active GM resolution in 5e and PF2e mocks",async()=>{
 const api=game.modules.get(ID).api, current=actor.rollSavingThrow;
 function paint(req){
  const actions=[];
  hooks.get("renderChatMessageHTML")(req,{querySelector:()=>({append:e=>actions.push(e)})});
  return actions[0];
 }
 const fake={total:17,dice:[{faces:20,results:[{result:13,active:true}]}]};
 const nativeCalls=[];
 actor.rollSavingThrow=async(...a)=>{nativeCalls.push(["5e",a]);return [fake];};
 actor.saves={reflex:{check:{roll:async(...a)=>{nativeCalls.push(["PF2e",a]);return fake;}}}};
 try{
  for(const sys of ["dnd5e","pf2e"]){
   game.user=gm;game.system.id=sys;
   const t=tile("native-"+sys,{name:"Hidden Dart Gallery",save:"dex",dc:15});
   await api.trigger(t,token,{test:false});
   const request=[...logs.values()].at(-1);
   game.user=player;
   assert.match(paint(request).textContent,sys==="pf2e"?/Reflex/:/Dexterity/);
   await paint(request).fn({});
   const reply=[...logs.values()].at(-1);
   game.user=gm;hooks.get("createChatMessage")(reply,{},player.id);await wait();
   assert.equal(request.getFlag(ID,"resolved").degree,1);
  }
  assert.deepEqual(nativeCalls[0],["5e",[{ability:"dex",target:15},{},{create:false}]]);
  assert.deepEqual(nativeCalls[1],["PF2e",[{dc:{value:15},createMessage:false}]]);
 }finally{
   if(current)actor.rollSavingThrow=current;else delete actor.rollSavingThrow;
   delete actor.saves;game.system.id="not-dnd";game.user=gm;
 }
});

test("one portable trap per opposing movement, without suppressing GM hazards",async()=>{
 scene.tiles.clear();actor.uuid="Actor.runner";token.disposition=-1;
 const setup={name:"Practice Dart",targets:"opposed",trapwrightOwner:"Actor.setter",trapwrightSide:1,damage:"1d6"};
 const a=tile("portable-one",setup,100),b=tile("portable-two",setup,220),c=tile("ordinary",{name:"GM",targets:"all"},340);
 hooks.get("moveToken")(token,{id:"opposed-first",subpathId:"tw-route",origin:p(0,100),destination:p(420,100)});await wait();
 assert.equal(a.config.spent,true);assert.equal(b.config.spent,false);assert.equal(c.config.spent,true);
 hooks.get("moveToken")(token,{id:"opposed-checkpoint",subpathId:"tw-route",origin:p(140,100),destination:p(400,100)});await wait();
 assert.equal(b.config.spent,false);
 token.disposition=1;
 hooks.get("moveToken")(token,{id:"friendly-route",origin:p(140,100),destination:p(400,100)});await wait();
 assert.equal(b.config.spent,false);
 token.disposition=-1;
 hooks.get("moveToken")(token,{id:"forced-route",method:"forced",origin:p(140,100),destination:p(400,100)});await wait();
 assert.equal(b.config.spent,false);
 hooks.get("moveToken")(token,{id:"fresh-route",origin:p(140,100),destination:p(400,100)});await wait();
 assert.equal(b.config.spent,true);
 delete actor.uuid;delete token.disposition;
});
