import assert from "node:assert/strict";
import test from "node:test";
import {ID,ready} from "../scripts/core.mjs";
import {characterProfile,parseRequest,deploymentRect,fitPlacement,blockedByWall} from "../scripts/trapwright-core.mjs";
import {actOnRequest,buildDeployment,visiblePresets} from "../scripts/trapwright.mjs";
const wrapped=(...docs)=>{const m=new Map(docs.map(x=>[x.id,x]));m[Symbol.iterator]=m.values;return m;};
const item=(type,identifier,other={})=>({type,system:{identifier,...other},flags:{[ID]:{twContent:{origin:"trapwright"}}}});
const user={id:"owner",active:true,viewedScene:"scene"};
const actor={id:"a1",name:"Iris",uuid:"Actor.a1",type:"character",items:[item("class","trapwright",{levels:5}),item("subclass","ironwork",{classIdentifier:"trapwright"})],
 system:{abilities:{int:{mod:3}},attributes:{prof:3}},testUserPermission:u=>u.id==="owner"};
const token={id:"token",actor,actorLink:true,x:200,y:200,width:1,height:1,disposition:1,level:"floor",elevation:0};
const s={id:"scene",grid:{size:100,type:1,distance:5},width:1000,height:1000,tokens:wrapped(token),tiles:wrapped(),walls:wrapped()};
const scenes=wrapped(s);
const settings={a1:{enabled:true,spent:1}};
globalThis.game={scenes,time:{worldTime:505}};
const base={scene:s.id,token:token.id,preset:"Wall Flame Jet",direction:"e"};
const build=(r={},u=user,st=settings)=>buildDeployment({...base,...r},u,{settings:st,scenes});
test("profile scales from Trapwright class level, actor proficiency and Intelligence",()=>{
 const p=characterProfile(actor);
 assert.deepEqual(p,{level:5,pb:3,int:3,dc:14,charges:6,active:3,subclass:"ironwork"});
 assert.equal(characterProfile({...actor,items:[{type:"class",system:{identifier:"trapwright",levels:20}}]}),null);
 assert.equal(visiblePresets(characterProfile({...actor,items:[item("class","trapwright",{levels:1})]})).length,2);
});
test("broker accepts only request identifiers, rejecting invalid age/path-like values",()=>{
 const now=Date.now();
 assert.deepEqual(parseRequest({...base,createdAt:now,damage:"100d100",art:"x",dc:99},now),base);
 assert.equal(parseRequest({...base,createdAt:now-45001},now),null);
 assert.equal(parseRequest({...base,token:"../token",createdAt:now},now),null);
 assert.equal(parseRequest({...base,direction:"__proto__",createdAt:now},now),null);
});
test("approved request places one hidden asset with unrelated GM dice stripped",async()=>{
 const a=await build({dc:99,damage:"99d99"});
 assert.deepEqual([a.source.x,a.source.y,a.source.width,a.spentAfter,a.max],[300,200,100,2,6]);
 const r=a.source.flags[ID].trap;
 assert.equal(r.name,"Wall Flame Jet");assert.equal(r.damage,"4d6");assert.equal(r.dc,14);
 assert.equal(r.targets,"opposed");assert.equal(r.trapwrightOwner,actor.uuid);assert.equal(r.trapwrightExpires,4105);
 assert.equal(r.reset,"once");assert.equal(r.hidden,true);assert.deepEqual(a.source.levels,["floor"]);
});
test("portable pit saves and bounded utility traps never inherit room-scale effects",async()=>{
 const r=(await build({preset:"Pressure Plate Pit"})).source.flags[ID].trap;
 assert.equal(r.damage,"4d6");assert.equal(r.failureEffect,"");
 const c=(await build({preset:"Net Drop"})).source.flags[ID].trap;
 assert.equal(c.damage,"");assert.equal(c.save,"str");assert.match(c.failureEffect,/10 feet/);
 const a=(await build({preset:"Trip Chime"})).source.flags[ID].trap;
 assert.equal(a.save,"none");assert.equal(a.damage,"");
 assert.equal(ready(r,Infinity,4105),false);
});
test("denies stranger, wrong scene, off-discipline, untrained and out of charges",async()=>{
 await assert.rejects(()=>build({}, {...user,id:"stranger"}),/actor/);
 await assert.rejects(()=>build({}, {...user,viewedScene:"other"}),/scene/);
 await assert.rejects(()=>build({preset:"Glyph of Flame"}),/unlocked/);
 await assert.rejects(()=>build({preset:"Crushing Walls"}),/unlocked/);
 await assert.rejects(()=>build({},user,{a1:{enabled:false,spent:0}}),/GM has not enabled/);
 await assert.rejects(()=>build({},user,{a1:{enabled:true,spent:6}}),/No Trap Charges/);
});
test("blocks occupied spaces, armed stacked tiles and closed walls",async()=>{
 const t={...token,id:"enemy",x:300};
 s.tokens.set(t.id,t);
 try{await assert.rejects(()=>build(),/occupied/);}finally{s.tokens.delete(t.id);}
 const existing={id:"cover",x:300,y:200,width:100,height:100,getFlag:()=>({armed:true})};
 s.tiles.set(existing.id,existing);
 try{await assert.rejects(()=>build(),/already an armed trap/);}finally{s.tiles.delete(existing.id);}
 const wall={id:"wall",c:[300,200,300,300],move:1,door:1,ds:0};
 s.walls.set(wall.id,wall);
 try{await assert.rejects(()=>build(),/movement-blocking/);wall.ds=1;assert.ok(await build());}finally{s.walls.delete(wall.id);}
});
test("placement uses adjacent edge on large bases and cannot cross the scene boundary",()=>{
 const big={...token,width:2,height:2};
 assert.deepEqual(deploymentRect(big,100,"e"),{x:400,y:200,width:100,height:100});
 const rect=deploymentRect({...token,x:0},100,"w");
 assert.equal(fitPlacement(rect,{x:0,y:0,width:1000,height:1000},[],100,"floor"),false);
 assert.equal(blockedByWall(token,deploymentRect(token,100,"e"),100,[{c:[300,201,300,299],move:0}]),false);
});


test("real dispatcher mocks: one enrolled request uses one charge, rejects spoof, refunds failed tile",async()=>{
 const gm={id:"gm",isGM:true,active:true};
 const beforeGame=globalThis.game, beforeFoundry=globalThis.foundry, beforeCreate=s.createEmbeddedDocuments;
 const humans=wrapped(gm,user,{id:"stranger",active:true});humans.activeGM=gm;
 let ledger={a1:{enabled:true,spent:0}}, deliveries=[],created=0,fail=false;
 globalThis.game={...beforeGame,user:gm,users:humans,system:{id:"dnd5e"},settings:{get:()=>ledger,async set(_a,_b,v){ledger=v;return v;}}};
 globalThis.foundry={documents:{ChatMessage:{create:async input=>{deliveries.push(input);return input;}}}};
 s.createEmbeddedDocuments=async(type,docs)=>{
  assert.equal(type,"Tile");assert.equal(docs.length,1);
  if(fail)throw Error("simulated permission error");created++;return [{id:"T"+created}];
 };
 const request=label=>{
  const flags={twRequest:{...base,createdAt:Date.now()}};
  return {id:label,author:user,whisper:["gm","owner"],getFlag:(_a,k)=>flags[k],async setFlag(_a,k,v){flags[k]=v;}};
 };
 try{
  const msg=request("valid-request");
  await actOnRequest(msg,"stranger");assert.equal(ledger.a1.spent,0);
  await Promise.all([actOnRequest(msg,"owner"),actOnRequest(msg,"owner")]);
  assert.equal(created,1);assert.equal(ledger.a1.spent,1);assert.equal(msg.getFlag(ID,"twHandled"),true);
  assert.match(deliveries[0].content,/Wall Flame Jet/);assert.deepEqual(deliveries[0].whisper,["owner","gm"]);
  fail=true;
  await actOnRequest(request("failed-request"),"owner");
  assert.equal(ledger.a1.spent,1);assert.match(deliveries.at(-1).content,/simulated permission error/);
 }finally{globalThis.game=beforeGame;globalThis.foundry=beforeFoundry;s.createEmbeddedDocuments=beforeCreate;}
});
