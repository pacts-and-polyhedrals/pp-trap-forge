import test from "node:test";
import assert from "node:assert/strict";
import {readFile,stat} from "node:fs/promises";
import {ID,normalize} from "../scripts/core.mjs";
import {CATALOG} from "../scripts/catalog.mjs";
import {FAMILIES,familyFor,artFor,audioFor} from "../scripts/av-profiles.mjs";
import {classifyDelivery,receiveCue,validatedCue,clearEffects} from "../scripts/av-runtime.mjs";
const asset=p=>new URL("../"+p.replace("modules/pp-trap-forge/",""),import.meta.url);
test("every preset and family has a visible and audible locally packaged asset",async()=>{
 const counts=new Map();
 for(const t of CATALOG) {
  const k=familyFor(t);
  assert.ok(FAMILIES[k], t.name);
  counts.set(k,(counts.get(k)??0)+1);
 }
 assert.ok(counts.size>=20,[...counts.keys()].join(", "));
 for(const [key,p] of Object.entries(FAMILIES)){
  assert.ok(p.duration>=600);
  const svg=await readFile(asset(artFor(key)),"utf8");assert.ok(svg.includes("<svg"));
  assert.ok(!/<(?:script|image|foreignObject|embed|iframe)\b|\son\w+\s*=/i.test(svg),key);
  const ogg=await readFile(asset(audioFor(key)));assert.equal(ogg.subarray(0,4).toString(),"OggS");assert.ok(ogg.length>1000,key);
  assert.ok((await stat(asset(artFor(key)))).size<128000,key);
 }
 assert.equal(familyFor({name:"Pressure Plate Pit"}),"pit");
 assert.equal(familyFor({name:"Wall Flame Jet",damageType:"fire"}),"fire-jet");
 assert.equal(familyFor({name:"Glyph of Flame",damageType:"fire"}),"fire-blast");
 assert.equal(familyFor({name:"Lava Vent"}),"fire-jet");
 assert.equal(familyFor({name:"Ice Shelf Break",av:"water"}),"water");
 assert.equal(familyFor({av:"none"}),null);
});
test("cue validation rejects external paths, malformed coordinates and unknown profiles",()=>{
 assert.equal(validatedCue({family:"__proto__",scene:"a"}),null);
 const c={family:"pit",scene:"s",x:42,y:43,w:100,h:100,rotation:90,gain:.8};
 assert.equal(validatedCue({...c,sound:"../evil.ogg"}).sound,null);
 assert.equal(validatedCue({...c,sound:"https://example.com/a.ogg"}).sound,null);
 assert.equal(validatedCue({...c,sound:"worlds/test/a.ogg"}).sound,"worlds/test/a.ogg");
 assert.equal(validatedCue({...c,x:Infinity}),null);
 assert.equal(normalize({sound:"bad.exe",gain:.3,direction:90}).sound,"");
});
const gm={id:"gm",isGM:true},pc={id:"pc",isGM:false};
let now=Date.now(),sounds=[];
globalThis.canvas={ready:true,scene:{id:"s"},level:{id:"first"},visibility:{tokenVision:true,testVisibility:()=>true}};
globalThis.game={user:pc,settings:{get:()=>undefined}};
globalThis.foundry={audio:{AudioHelper:{play:(d,b)=>sounds.push({d,b})}}};
const msg=(id,opts={},author=gm,whisper=[])=>({id,author,whisper,getFlag:(key,field)=>key===ID&&field==="cue"?{family:"pit",scene:"s",level:"first",x:40,y:45,w:100,h:100,rotation:0,gain:.8,sfxOn:true,vfxOn:false,createdAt:Date.now(),markVisible:true, ...opts}:undefined});
test("audio playback is local, single-shot, and respects mute",()=>{
 const m=msg("audible");
 assert.equal(receiveCue(m),true);assert.equal(receiveCue(m),false);
 assert.equal(sounds.length,1);
 assert.equal(sounds[0].b,false);
 assert.match(sounds[0].d.src,/audio\/pit.ogg$/);
 assert.equal(sounds[0].d.volume,.576);
 game.settings.get=(id,key)=>key==="sfxVolume"?0:undefined;
 assert.equal(receiveCue(msg("muted")),true);assert.equal(sounds.length,1);
 game.settings.get=()=>undefined;
 assert.equal(receiveCue(msg("sound-off",{sfxOn:false})),true);assert.equal(sounds.length,1);
});
test("no media from untrusted authors, older cards, private tests, fog, other scenes or floors",()=>{
 assert.equal(classifyDelivery(msg("spurious",{},pc)),null);
 assert.equal(classifyDelivery(msg("old",{createdAt:now-60000})),null);
 assert.equal(classifyDelivery(msg("other-scene",{scene:"other"})),null);
 assert.equal(classifyDelivery(msg("other-floor",{level:"second"})),null);
 assert.equal(classifyDelivery(msg("private",{private:true},gm,["pc"])),null);
 assert.equal(classifyDelivery(msg("secret",{markVisible:false})),null);
 canvas.visibility.testVisibility=()=>false;
 assert.equal(classifyDelivery(msg("fog")),null);
 game.user=gm;
 assert.ok(classifyDelivery(msg("private-gm",{private:true},gm,["gm"])));
 assert.equal(classifyDelivery(msg("not-recipient",{private:true},gm,["pc"])),null);
 canvas.visibility.testVisibility=()=>true;
 clearEffects();game.user=pc;
});

test("local visual follows pan/zoom, stops after hiding tile, and never intercepts clicks",()=>{
 let order=0;const frames=new Map(), layers=new Set();
 globalThis.innerWidth=960;globalThis.innerHeight=540;globalThis.devicePixelRatio=1;
 globalThis.requestAnimationFrame=cb=>{const id=++order;frames.set(id,cb);return id;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 let offset=0,zoom=1;
 canvas.clientCoordinatesFromCanvas=({x,y})=>({x:440+(x-40)*zoom+offset,y:240+(y-45)*zoom});
 const commands=[];let attrs={};
 const brush=new Proxy({},{
  get:(_t,k)=>k==="createRadialGradient"||k==="createLinearGradient"?()=>({addColorStop(){}}):(...args)=>commands.push([k,...args]),
  set(){return true;}
 });
 const makeEl=()=>({style:{},width:0,height:0,setAttribute:(k,v)=>{attrs[k]=v;},getContext:()=>brush,remove(){layers.delete(this);}});
 globalThis.document={body:{append:e=>layers.add(e)},createElement:makeEl};
 const step=(delay=150)=>{const [id,f]=frames.entries().next().value;frames.delete(id);f(performance.now()+delay);};
 try{
  assert.equal(receiveCue(msg("draw",{family:"fire-jet",sfxOn:false,vfxOn:true})),true);
  assert.equal(receiveCue(msg("draw",{family:"fire-jet",vfxOn:true})),false);
  assert.equal(layers.size,1);
  const el=[...layers][0];
  assert.equal(el.className,"tf-fx-layer");
  assert.equal(attrs["aria-hidden"],"true");
  step(290);assert.equal(el.style.left,"440px");
  const w1=el.width;
  offset=100;zoom=1.5;step(320);assert.equal(el.style.left,"540px");assert.ok(el.width>w1);
  assert.ok(commands.some(x=>x[0]==="bezierCurveTo"));
  canvas.visibility.testVisibility=()=>false;step(330);assert.equal(layers.size,0);
  assert.equal(frames.size,0);
 }finally{
  clearEffects();canvas.visibility.testVisibility=()=>true;delete globalThis.document;
 }
});
