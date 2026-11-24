import {normalize} from "./core.mjs";
export const CLASS_ID="trapwright";
export const SPEC_IDS=Object.freeze(["ironwork","sigil","wildway","maw"]);
export const STARTERS=Object.freeze([
 Object.freeze({name:"Practice Snare",category:"Trapwright",save:"dex",damage:"",damageType:"",failureEffect:"The target's Speed is reduced by 10 feet until the start of your next turn.",triggerText:"A weighted loop pulls taut.",av:"snare"}),
 Object.freeze({name:"Practice Dart",category:"Trapwright",save:"dex",damage:"1d6",damageType:"piercing",failureEffect:"",triggerText:"A compact dart snaps out of the trap.",av:"darts"})
]);
export const DIRECTIONS=Object.freeze({n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]});
const bound=(n,min,max,fall)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):fall;
const id=(d)=>String(d?.system?.identifier??"").toLowerCase();
const feature=(d)=>d?.getFlag?.("pp-trap-forge","twContent")??d?.flags?.["pp-trap-forge"]?.twContent;
export function characterProfile(actor){
 if(!actor||actor.type!=="character")return null;
 const items=Array.from(actor.items??[]);
 const cls=items.find(i=>i.type==="class"&&id(i)===CLASS_ID&&feature(i)?.origin===CLASS_ID);
 if(!cls)return null;
 const level=Math.floor(bound(cls.system?.levels,1,20,1));
 const spec=items.find(i=>i.type==="subclass"&&i.system?.classIdentifier===CLASS_ID&&SPEC_IDS.includes(id(i))&&feature(i)?.origin===CLASS_ID);
 const int=Math.floor(bound(actor.system?.abilities?.int?.mod,-5,10,0));
 const pb=Math.floor(bound(actor.system?.attributes?.prof,2,6,2+Math.floor((level-1)/4)));
 return {level,pb,int,dc:8+pb+int,charges:2*pb,active:pb,subclass:level>=3&&spec?id(spec):null};
}
const UTILITY={
 ironwork:"The target's Speed is reduced by 10 feet until the start of the Trapwright's next turn (minimum 0).",
 sigil:"The target cannot take Reactions until the start of the Trapwright's next turn.",
 wildway:"This 5-foot space is Difficult Terrain for the target until the start of the Trapwright's next turn.",
 maw:"Until the start of the Trapwright's next turn, you know the direction of the target while it is within 30 feet, not its precise location."
};
export function portableTrap(p,{tier,dc,actorUUID,disposition,subclass}){
 const base=STARTERS.find(s=>s.name===p.name);
 const dice=base?.damage??(p.damage?({3:"2d6",5:"4d6",11:"6d6",17:"8d6"})[tier]??"2d6":"");
 const save=base?.save??(dice&&p.save==="none"?"dex":p.save);
 return normalize({...p,damage:dice,save,dc,success:"half",
  failureEffect:base?.failureEffect??(dice?"":save==="none"?"Quiet cue if the Trapwright is within 60 feet. No damage.":UTILITY[subclass]??"Resolve the portable utility effect with the GM. No damage."),
  armed:true,hidden:true,reveal:true,reset:"once",cooldown:0,lastAt:0,spent:false,
  sizeX:1,sizeY:1,targets:"opposed",trapwrightOwner:actorUUID,trapwrightSide:disposition,destinationOnly:false});
}
export function deploymentRect(token,grid,direction){
 if(!Object.hasOwn(DIRECTIONS,direction)||!Number.isFinite(grid)||grid<4||!Number.isFinite(token?.x)||!Number.isFinite(token?.y))return null;
 const [dx,dy]=DIRECTIONS[direction],w=grid*(token.width??1),h=grid*(token.height??1);
 if(!(w>0&&h>0))return null;
 const x=dx<0?token.x-grid:dx>0?token.x+w:token.x+Math.floor((w-grid)/(2*grid))*grid;
 const y=dy<0?token.y-grid:dy>0?token.y+h:token.y+Math.floor((h-grid)/(2*grid))*grid;
 return {x:Math.round(x),y:Math.round(y),width:grid,height:grid};
}
export function fitPlacement(candidate, bounds, tokens, grid, level){
 if(!candidate||!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height))return false;
 const b=candidate, bx=bounds.x??0, by=bounds.y??0;
 if(b.x<bx||b.y<by||b.x+b.width>bx+bounds.width||b.y+b.height>by+bounds.height)return false;
 return !Array.from(tokens??[]).some(t=>(!level||!t.level||t.level===level)&&b.x<t.x+(t.width??1)*grid&&b.x+b.width>t.x&&b.y<t.y+(t.height??1)*grid&&b.y+b.height>t.y);
}
export const validId=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(s);
export function parseRequest(p,now){
 if(!p||!validId(p.scene)||!validId(p.token)||!Object.hasOwn(DIRECTIONS,p.direction)||
  typeof p.preset!=="string"||!p.preset||p.preset.length>90||!Number.isFinite(p.createdAt)||Math.abs(now-p.createdAt)>45000)return null;
 // Whitelist only identifiers and directional choice. Damage/DC/art never come from a player.
 return {scene:p.scene,token:p.token,direction:p.direction,preset:p.preset};
}

/** Conservative basic-wall check; directional, height/terrain and module-specific walls are GM adjudication. */
export function blockedByWall(token,rect,grid,walls){
 const a=[token.x+(token.width??1)*grid/2,token.y+(token.height??1)*grid/2];
 const b=[rect.x+rect.width/2,rect.y+rect.height/2];
 const cross=(u,v)=>u[0]*v[1]-u[1]*v[0], subtract=(u,v)=>[u[0]-v[0],u[1]-v[1]];
 const r=subtract(b,a);
 return Array.from(walls??[]).some(w=>{
  const c=w.c;if(!Array.isArray(c)||c.length!==4||!c.every(Number.isFinite)||!Number(w.move)||w.door&&Number(w.ds)===1)return false;
  const p=[c[0],c[1]],q=[c[2],c[3]],s=subtract(q,p),den=cross(r,s),ap=subtract(p,a);
  if(Math.abs(den)<1e-9)return false;
  const at=cross(ap,s)/den, along=cross(ap,r)/den;
  return at>1e-7&&at<=1+1e-7&&along>=-1e-7&&along<=1+1e-7;
 });
}
