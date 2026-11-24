/** Local raster QA. Uses the shipped renderer and an optional development-only Skia adapter. */
import {mkdir,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join} from "node:path";
import {FAMILIES,artFor,audioFor} from "../scripts/av-profiles.mjs";
import {paintEffect} from "../scripts/av-paint.mjs";
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require("@napi-rs/canvas");
const DEST=process.argv[2]??"/tmp/trap-forge-render";
const w=960,h=540;
const asset=p=>new URL("../"+p.replace("modules/pp-trap-forge/",""),import.meta.url).pathname;
const art=Object.fromEntries(await Promise.all(Object.keys(FAMILIES).map(async key=>[key,await loadImage(asset(artFor(key)))])));
const closed=await loadImage(asset("modules/pp-trap-forge/assets/tiles/pit-closed.svg"));
await mkdir(DEST,{recursive:true});
const cv=createCanvas(w,h),g=cv.getContext("2d");
const sample=createCanvas(w,h),sg=sample.getContext("2d");
function back(g){
 const q=g.createRadialGradient(w*.5,h*.5,20,w*.5,h*.5,w*.66);q.addColorStop(0,"#5d4d3f");q.addColorStop(.68,"#2b2829");q.addColorStop(1,"#16151a");g.fillStyle=q;g.fillRect(0,0,w,h);
 g.strokeStyle="#eace9f28";g.lineWidth=1;g.beginPath();
 for(let x=w/2%64;x<w;x+=64){g.moveTo(x,0);g.lineTo(x,h);}
 for(let y=h/2%64;y<h;y+=64){g.moveTo(0,y);g.lineTo(w,y);}g.stroke();
}
function make(key,t,{reduced=false,show=true,degree=0}={}){
 back(g);
 g.save();g.translate(w/2,h/2);g.rotate(degree*Math.PI/180);g.shadowColor="#140e13";g.shadowBlur=16;g.drawImage(key==="pit"&&t<0?closed:art[key],-105,-105,210,210);g.restore();
 sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,w,h);
 if(show){sg.save();sg.translate(w/2,h/2);sg.rotate(degree*Math.PI/180);sg.scale(2.1,2.1);paintEffect(sg,FAMILIES[key],t,{closedArt:closed,reduced});sg.restore();}
 g.drawImage(sample,0,0);
 g.fillStyle="#211b1ff0";g.fillRect(0,0,w,86);g.fillRect(0,h-43,w,43);g.fillStyle="#98744b";g.fillRect(0,86,w,1);g.fillRect(0,h-43,w,1);
 g.fillStyle="#ffe1a2";g.font="bold 27px Georgia";g.fillText("Pacts & Polyhedrals · Trap Forge",25,35);
 g.fillStyle="#ffdda1";g.font="bold 16px sans-serif";g.fillText(FAMILIES[key].title.toUpperCase(),26,61);
 g.fillStyle="#d5c7b3";g.font="14px sans-serif";g.fillText("MODULE ART, MOTION & SOUND  /  STANDALONE PREVIEW",25,h-17);
 let occ=0;
 if(show){const d=sg.getImageData(0,0,w,h).data;for(let i=3;i<d.length;i+=4)occ+=d[i]>5;}
 return occ;
}
const checks={};
for(const k of Object.keys(FAMILIES)) {
 checks[k]=[.08,.30,.53,.78,.90].map(t=>make(k,t));
 if(Math.max(...checks[k])<350)throw Error("Empty FX profile "+k);
}
if(make("fire-jet",.42,{degree:90})<350)throw Error("Empty rotated jet");
if(make("fire-blast",.5,{reduced:true})<350)throw Error("Empty reduced-motion cue");
for(const [k,t] of [["fire-blast",.24],["fire-jet",.43],["pit",.34],["water",.52],["mimic",.36],["lightning",.29]]){
 make(k,t);await writeFile(join(DEST,k+".png"),cv.toBuffer("image/png"));
}
await writeFile(join(DEST,"frame-qa.json"),JSON.stringify(checks,null,2));
console.log("Rendered",Object.keys(checks).length,"profiles at five frames, plus rotated and reduced-motion checks.");
if(process.argv.includes("--frames")){
 const cues=["fire-blast","fire-jet","pit","lightning","poison","mimic"];
 const fps=24, shots=60;
 for(let j=0;j<cues.length;j++)for(let i=0;i<shots;i++){
  const key=cues[j],t=(i/fps-.35)/(FAMILIES[key].duration/1000);
  make(key,t,{show:t>=0&&t<1});
  await writeFile(join(DEST,"shot-"+String(j*shots+i).padStart(4,"0")+".jpg"),cv.toBuffer("image/jpeg",88));
 }
 await writeFile(join(DEST,"audio.txt"),cues.map(k=>asset(audioFor(k))).join("\n")+"\n");
}
