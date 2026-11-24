// Original vector animation. Coordinates normalized to 1 tile width; no external art/runtime.
const TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const ease=x=>1-(1-clamp(x))**3;
const palette={ink:"#130f17",ember:"#ff521c",gold:"#ffae4d",hot:"#fff1ac",ash:"#716375",dust:"#d5ad76",edge:"#fffafa"};
const fract=n=>n-Math.floor(n);
const rand=n=>fract(Math.sin(n*127.17+9.83)*43758.5453123);
const lerp=(a,b,t)=>a+(b-a)*t;
const stroke=(g,pts,c,w=2)=>{if(pts.length<2)return;g.beginPath();g.moveTo(...pts[0]);for(const [x,y] of pts.slice(1))g.lineTo(x,y);g.strokeStyle=c;g.lineWidth=w;g.stroke()};
const fill=(g,pts,c)=>{g.beginPath();g.moveTo(...pts[0]);for(const [x,y] of pts.slice(1))g.lineTo(x,y);g.closePath();g.fillStyle=c;g.fill()};
const oval=(g,x,y,rx,ry,c)=>{if(!(rx>0&&ry>0))return;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fillStyle=c;g.fill()};
const ring=(g,x,y,rx,ry,c,w,a=0,b=TAU)=>{if(!(rx>0&&ry>0))return;g.beginPath();g.ellipse(x,y,rx,ry,0,a,b);g.strokeStyle=c;g.lineWidth=w;g.stroke()};
const glow=(g,x,y,r,stops)=>{
 if(!(r>0))return;
 const grad=g.createRadialGradient(x,y,0,x,y,r);
 for(const [u,c] of stops)grad.addColorStop(u,c);
 oval(g,x,y,r,r,grad);
};
const rgba=(hex,a)=>{const s=hex.replace("#",""),x=Number.parseInt(s,16);return "rgba("+[x>>16&255,x>>8&255,x&255,clamp(a)].join(",")+")"};
function star(g,x,y,r,color){
 fill(g,[[x-r,y],[x-r*.17,y-r*.17],[x,y-r],[x+r*.17,y-r*.17],[x+r,y],[x+r*.17,y+r*.17],[x,y+r],[x-r*.17,y+r*.17]],color);
}
function radial(g,t,n,fn){for(let i=0;i<n;i++){const a=(i+rand(i+3)*.62)*TAU/n;fn(i,a,rand(i+71),rand(i+201),t);}}
function flame(g,x,y,s,theta,c0,c1,alpha,wobble=0) {
 if(!(s>0))return;g.save();g.translate(x,y);g.rotate(theta);g.scale(s,s);
 const q=g.createLinearGradient(0,12,0,-82);
 q.addColorStop(0,rgba(c0,alpha));q.addColorStop(.45,rgba(c1,alpha*.83));q.addColorStop(1,rgba(c1,0));
 g.beginPath();g.moveTo(-26,12);g.bezierCurveTo(-55,-15,-18,-53,-9,-85);g.bezierCurveTo(-7,-44,29+wobble,-27,34,6);g.bezierCurveTo(24,35,-10,35,-26,12);g.fillStyle=q;g.fill();
 g.beginPath();g.moveTo(-11,14);g.quadraticCurveTo(-23,-9,5,-42);g.quadraticCurveTo(23+wobble*.24,-4,16,14);g.quadraticCurveTo(6,28,-11,14);g.fillStyle=rgba(c0,alpha*.82);g.fill();g.restore();
}
function blast(g,t,c){
 const radius=6+ease(t)*98, op=(1-t)**1.25;
 glow(g,0,1,radius,[[0,rgba(palette.hot,op*.8)],[.22,rgba(palette.gold,op*.72)],[.60,rgba(c,op*.52)],[1,rgba(c,0)]]);
 radial(g,t,12,(i,a,r,j)=>{const d=lerp(4,78+18*j,ease(t));const x=Math.cos(a)*d,y=Math.sin(a)*d*.86;flame(g,x,y,(.26+r*.49)*(0.5+op),a+Math.PI/2+j*.4,palette.hot,c,op*(.48+.45*r),Math.sin(t*17+i)*14);});
 radial(g,t,25,(i,a,r,j)=>{const d=ease(t)*(56+r*85),x=Math.cos(a)*d,y=Math.sin(a)*d*.87;stroke(g,[[x-Math.cos(a)*10*(1-t),y-Math.sin(a)*10*(1-t)],[x,y]],rgba(i%3?palette.gold:palette.hot,op*(.35+j*.65)),.8+j*2);});
 if(t>.20)radial(g,t,7,(i,a,r,j)=>{const d=35+ease(t)*52,rx=(14+r*14)*(t+.3);glow(g,Math.cos(a)*d,Math.sin(a)*d*.76,rx,[[0,rgba(palette.ash,Math.sin(t*Math.PI)*r*.25)],[1,rgba(palette.ash,0)]]);});
}
function jet(g,t,c,mist=false) {
 const activity=smooth(t*7)*(1-smooth((t-.60)*2.5));
 const tail=132*ease(t*2), melt=1-smooth((t-.60)*2.5);
 // The nozzle is stationary on the left edge; the hot stream moves inward.
 glow(g,-52,0,28+19*activity,[[0,rgba(mist?"#fff9ea":palette.hot,activity*.62)],[1,rgba(c,0)]]);
 for(let i=0;i<7;i++){
  const a=(i-3)*.115, x=-57+tail*(.45+rand(10+i)*.48), y=(Math.sin(t*18+i)+i-3)*5+Math.sin(a)*x*.28;
  const grad=g.createLinearGradient(-60,0,tail-50,y);grad.addColorStop(0,rgba(mist?"#f8f4e8":palette.hot,activity*.73));grad.addColorStop(.34,rgba(c,activity*.66));grad.addColorStop(1,rgba(c,0));
  g.beginPath();g.moveTo(-61,2*(i-3));g.bezierCurveTo(-24,(i-3)*11,16,y*1.75,x,y+12);
  g.bezierCurveTo(x*.70,y-5,6,y*.45,-61,2*(i-3)-5);g.fillStyle=grad;g.fill();
 }
 for(let i=0;i<18;i++){const u=fract(t*1.85+rand(i)),x=-58+u*tail,r=rand(i+90),y=(r-.5)*(12+u*72)+Math.sin(t*12+i)*6;
  if(mist)glow(g,x,y,8+25*u,[[0,rgba(c,.27*activity*(1-u))],[1,rgba(c,0)]]);
  else stroke(g,[[x-6-r*12,y+2],[x,y]],rgba(i%3?palette.gold:palette.hot,melt*(1-u)*r),.9+r*1.9);
 }
}
function pit(g,t,c,closedArt) {
 const open=smooth((t-.07)/.66), d=open*41;
 // A local mask overlays the already opened persistent tile; its rim stays matched.
 const img=closedArt;
 const hasImage=img?.complete&&img?.naturalWidth>0;
 if(hasImage){
  const half=img.naturalWidth/2, start=-50, scale=100, shift=ease(open)*43;
  g.save();g.beginPath();g.rect(-37,-39,74,78);g.clip();
  g.globalAlpha=1-smooth((t-.63)*2.66);
  g.drawImage(img,0,0,half,img.naturalHeight,start-shift,start,scale/2,scale);
  g.drawImage(img,half,0,half,img.naturalHeight,shift,start,scale/2,scale);
  g.restore();
 } else {
 g.save(); g.beginPath();g.rect(-45,-45,90,90);g.clip();
 oval(g,0,0,8+37*open,6+36*open,rgba("#110e16",.54*open));
 for(const side of [-1,1]){
  const x=side*(24+d),f=1-smooth((t-.63)*2.66);
  const q=g.createLinearGradient(0,-49,0,46);q.addColorStop(0,rgba("#858077",f));q.addColorStop(.55,rgba("#57534d",f));q.addColorStop(1,rgba("#423b36",f));
  fill(g,[[x-26,-47],[x+26,-47],[x+26,46],[x-26,46]],q);
  for(const yy of [-30,-8,18,35])stroke(g,[[x-25,yy],[x+25,yy+2]],rgba("#190f14",f*.59),2);
  stroke(g,[[x-side*24,-47],[x-side*24,46]],rgba("#d8ba92",f*.68),3);
 }
 g.restore();
 }
 const op=Math.sin(t*Math.PI);
 radial(g,t,17,(i,a,r,j)=>{const d=15+ease(t)*65;const x=Math.cos(a)*d,y=Math.sin(a)*d*.61;oval(g,x,y,1.3+r*3,1+j*1.8,rgba(c,op*(.23+r*.42)));});
}
function stone(g,t,c){
 const bounce=smooth(t*3), op=1-t;
 radial(g,t,10,(i,a,r,j)=>{const x=Math.cos(a)*(22+bounce*46)*r,y=Math.sin(a)*bounce*51+(r*27-55)*(1-bounce);
  const s=5+j*13;g.save();g.translate(x,y);g.rotate(i+t*.8);fill(g,[[-s*.8,-s*.43],[s*.1,-s*.9],[s*.86,-s*.2],[s*.53,s*.83],[-s*.58,s*.62]],rgba(c,op*.86));stroke(g,[[-s*.62,-s*.4],[0,-s*.70],[s*.54,-s*.29]],rgba(palette.dust,op*.59),1.8);g.restore();});
 for(let i=0;i<9;i++){const x=(i-4)*(6+16*bounce),y=Math.sin(i)*8+bounce*19;glow(g,x,y,6+26*bounce,[[0,rgba(c,Math.sin(t*Math.PI)*.32)],[1,rgba(c,0)]]);}
}
function metal(g,t,c,cage=false) {
 const drive=smooth(t*5), fade=(1-t)**.75, fall=(1-drive)*40;
 if(cage){for(let i=-3;i<=3;i++){const x=i*10;stroke(g,[[x,-39-fall],[x,37-fall]],rgba(c,fade*.86),2.8);}for(const yy of [-38,33])stroke(g,[[-39,yy-fall],[39,yy-fall]],rgba("#f8eacb",fade*.8),4);}
 else {ring(g,0,0,4+drive*62,3+drive*42,rgba(c,fade*.82),2.5);ring(g,0,0,9+drive*48,6+drive*29,rgba(c,fade*.25),5);}
 radial(g,t,16,(i,a,r,j)=>{const d=32+75*ease(t)*r,x=Math.cos(a)*d,y=Math.sin(a)*d*.80;stroke(g,[[x-Math.cos(a)*14*r,y-Math.sin(a)*14*r],[x,y]],rgba(i%2?c:palette.hot,fade*j),.5+j*2.1);});
}
function darts(g,t,c){
 for(let i=0;i<10;i++){const u=clamp((t-i*.037)*2.1),x=-129+u*250,y=-51+(i%6)*19+(i-5)*2*u;
  if(u<=0||u===1)continue;const a=Math.sin(u*Math.PI);stroke(g,[[x-27,y],[x+3,y]],rgba(c,a*.78),2.3);fill(g,[[x+11,y],[x+1,y-3.9],[x+1,y+3.9]],rgba("#ffedc0",a));}
}
function slash(g,t,c){
 const op=1-t;for(let i=0;i<3;i++){const start=-Math.PI*.86+ease(t)*TAU+i*TAU/3;const r=63+i*4;ring(g,0,0,r,r*.83,rgba(c,op*.55),7,start-.77,start);ring(g,0,0,r,r*.83,rgba("#fff9f1",op*.95),2,start-.49,start+.18);
  const x=Math.cos(start)*r,y=Math.sin(start)*r*.83;star(g,x,y,6*op,rgba(palette.hot,op));}
}
function waves(g,t,c) {
 const op=Math.sin(t*Math.PI);
 for(let i=0;i<5;i++){
  const x= -88+180*ease(t)-i*14;const pts=Array.from({length:21},(_,j)=>[x+Math.sin(j/3-t*13)*11,(j-10)*5]);
  stroke(g,pts,rgba(c,op*(.52-i*.07)),7-i*.8);stroke(g,pts,rgba("#d8fbf5",op*(.58-i*.08)),1.1);
 }
 radial(g,t,15,(i,a,r,j)=>{const d=25+85*t*r;oval(g,Math.cos(a)*d,Math.sin(a)*d*.67,1.5+r*3,.9+j*1.3,rgba(c,op*.7));});
}
function frost(g,t,c,shatter=false) {
 const op=Math.sin(t*Math.PI), ext=ease(t);
 radial(g,t,shatter?18:11,(i,a,r,j)=>{
 const d=(shatter?35+90*ext:25+61*ext)*(.35+r*.65),p=Math.cos(a),q=Math.sin(a)*.91,s=shatter?10+8*j:8+14*j,x=p*d,y=q*d;
 fill(g,[[p*(d-s*2.1),q*(d-s*2.1)],[x-q*s*.34,y+p*s*.34],[p*(d+s),q*(d+s)],[x+q*s*.3,y-p*s*.3]],rgba(c,op*(.35+r*.55)));
 stroke(g,[[p*(d-s*1.9),q*(d-s*1.9)],[p*(d+s),q*(d+s)]],rgba("#faffe9",op*.82),1.05);
 if(!shatter&&r>.32){stroke(g,[[p*(d-s*.9),q*(d-s*.9)],[x+q*s*.5,y-p*s*.5]],rgba(c,op),1.65);star(g,x,y,op*(3+r*5),rgba("#f1fbff",op));}
 });
}
function vapour(g,t,c,acid=false) {
 const op=Math.sin(t*Math.PI), travel=ease(t);
 radial(g,t,23,(i,a,r,j)=>{const d=(37+r*72)*travel,x=Math.cos(a)*d,y=Math.sin(a)*d*.75;
  if(acid&&i%2===0){const s=(2+r*8)*(1-t);oval(g,x,y,s,s*.62,rgba(c,(.27+j*.55)*op));ring(g,x,y,s*1.4,s*.73,rgba("#f9ffb6",op*.43),1);}
  else glow(g,x,y,7+(15+r*17)*travel,[[0,rgba(c,op*(acid?.28:.38)*r)],[.53,rgba(c,op*.18*j)],[1,rgba(c,0)]]);
 });
}
function lightning(g,t,c){
 const op=Math.exp(-t*2)*(1-t), drift=Math.floor(t*5)*53;
 for(let j=0;j<5;j++){
  const pts=Array.from({length:10},(_,i)=>[-82+i*19,i===0||i===9?(j-2)*11:(rand(i*2+j*100+drift)-.5)*71+(j-2)*12]);
  stroke(g,pts,rgba(c,op*.23),9);stroke(g,pts,rgba(c,op*.69),3.7);
  stroke(g,pts,rgba("#e9fcff",op*.89),.8);
 }
}
function rune(g,t,c,mode) {
 const op=Math.sin(t*Math.PI), zoom=ease(t), r=19+60*zoom;
 if(mode==="portal")glow(g,0,0,r+9,[[0,rgba("#11102b",op*.89)],[.58,rgba(c,op*.36)],[.79,rgba(c,op*.8)],[1,rgba(c,0)]]);
 else glow(g,0,0,r,[[0,rgba(c,op*.18)],[1,rgba(c,0)]]);
 for(let i=0;i<3;i++){const rr=r*(.62+i*.19),a=t*(i%2?-.7:1.4)+i*.6;ring(g,0,0,rr,rr*.78,rgba(c,op*(.63-i*.12)),i===0?1.8:2.4,a,a+TAU-.35);}
 for(let i=0;i<10;i++){const a=i*TAU/10-t*.8,x=Math.cos(a)*r,y=Math.sin(a)*r*.8;star(g,x,y,1.5+op*(4+rand(i)*4),rgba(i%2?c:"#f9e9fb",op*.85));}
}
function shock(g,t,c,alarm=false){
 const op=1-t;
 for(let i=0;i<4;i++){const u=clamp(t*(alarm?1.5:1.25)-i*.18),r=u*(alarm?86:115);if(u>0&&u<1)ring(g,0,0,r,r*.82,rgba(c,(1-u)*op*.78),3.5-i*.6);}
 if(alarm)star(g,0,0,6+17*Math.sin(t*Math.PI),rgba(c,op*.72));
 else glow(g,0,0,52*ease(t),[[0,rgba(c,op*.53)],[1,rgba(c,0)]]);
}
function snare(g,t,c,vines=false){
 const closing=smooth(t*2.4),op=1-smooth((t-.5)*2);
 for(let i=0;i<(vines?8:2);i++){const a=i*TAU/(vines?8:2),r=59-36*closing,x=Math.cos(a)*r,y=Math.sin(a)*r;
  g.beginPath();g.moveTo(Math.cos(a)*87,Math.sin(a)*76);g.bezierCurveTo(x-y*.4,y+x*.36,x+y*.57,y-x*.36,x,y);
  g.strokeStyle=rgba(c,op*.92);g.lineWidth=vines?4.6:3.6;g.stroke();
  if(vines)oval(g,x*.88,y*.87,3.6,2,rgba("#c4eb79",op));
 }
 if(!vines)ring(g,0,0,22+28*(1-closing),15+23*(1-closing),rgba(c,op*.86),3);
}
function jaw(g,t,c){
 const open=Math.sin(Math.PI*ease(t)), gap=7+44*open, op=1-smooth((t-.66)*3);
 for(const s of [-1,1]){
 const ym=s*gap;oval(g,0,ym,50,15,rgba("#401721",op));ring(g,0,ym,50,15,rgba(c,op*.84),4);
 for(let i=-4;i<=4;i++){const x=i*9,y=ym+(1-Math.abs(i)*.09)*s*-9,l=7+rand(i+44)*9;fill(g,[[x-4,y],[x+4,y],[x+s*2,y-s*l]],rgba("#ffdcaa",op*.94));}
 }
 if(t>.4)shock(g,(t-.4)/.6,c);
}
const DRAW={blast,jet,pit,stone,metal,darts,slash,water:waves,ice:frost,glass:(g,t,c)=>frost(g,t,c,true),gas:vapour,acid:(g,t,c)=>vapour(g,t,c,true),lightning,rune,portal:(g,t,c)=>rune(g,t,c,"portal"),shock,alarm:(g,t,c)=>shock(g,t,c,true),snare,vines:(g,t,c)=>snare(g,t,c,true),jaw,cage:(g,t,c)=>metal(g,t,c,true),steam:(g,t,c)=>jet(g,t,c,true)};
export function paintEffect(g,f,t,{reduced=false,closedArt=null}={}) {
 t=clamp(t);
 g.save();g.lineCap="round";g.lineJoin="round";
 if(reduced) {
  const opacity=.56*Math.sin(t*Math.PI);
  glow(g,0,0,70,[[0,rgba(f.color,opacity*.34)],[.75,rgba(f.color,opacity*.31)],[1,rgba(f.color,0)]]);
  ring(g,0,0,52,43,rgba(f.color,opacity),2.6);
 } else if(f.paint==="pit")pit(g,t,f.color,closedArt);
 else (DRAW[f.paint]??shock)(g,t,f.color);
 g.restore();
}
