export const AV_BASE="modules/pp-trap-forge/assets";
export const FAMILIES=Object.freeze({
 "fire-blast":{title:"Fireball burst",paint:"blast",art:"fire-blast",audio:"fire-blast",color:"#ff7f27",duration:1100},
 "fire-jet":{title:"Wall flame jet",paint:"jet",art:"fire-jet",audio:"fire-jet",color:"#ff8329",duration:1250},
 "pit":{title:"Opening pit",paint:"pit",art:"pit-open",audio:"pit",color:"#b7a58e",duration:850},
 "stone":{title:"Falling or rolling stone",paint:"stone",art:"rockfall",audio:"stone",color:"#9e8d78",duration:900},
 "metal":{title:"Metal impact",paint:"metal",art:"pressure-plate",audio:"metal",color:"#cfbf92",duration:720},
 "darts":{title:"Dart volley",paint:"darts",art:"darts",audio:"darts",color:"#dfc37d",duration:670},
 "snare":{title:"Snapping snare",paint:"snare",art:"snare",audio:"snare",color:"#cf9b54",duration:830},
 "water":{title:"Rushing water",paint:"water",art:"flood",audio:"water",color:"#56ccea",duration:1300},
 "ice":{title:"Growing frost",paint:"ice",art:"frost",audio:"ice",color:"#8ee8f9",duration:1100},
 "thunder":{title:"Thunder shockwave",paint:"shock",art:"shockwave",audio:"thunder",color:"#e9a4ff",duration:950},
 "lightning":{title:"Forked lightning",paint:"lightning",art:"lightning",audio:"lightning",color:"#75c8ff",duration:850},
 "magic":{title:"Igniting rune",paint:"rune",art:"rune",audio:"magic",color:"#9d87f9",duration:1150},
 "poison":{title:"Gas cloud",paint:"gas",art:"poison",audio:"poison",color:"#a7d449",duration:1450},
 "acid":{title:"Acid splash",paint:"acid",art:"acid",audio:"acid",color:"#d0ed47",duration:1050},
 "organic":{title:"Grasping roots",paint:"vines",art:"vines",audio:"organic",color:"#9bb65b",duration:1100},
 "alarm":{title:"Warning pulse",paint:"alarm",art:"alarm",audio:"alarm",color:"#ffc961",duration:1200},
 "pulse":{title:"Force pulse",paint:"shock",art:"shockwave",audio:"pulse",color:"#ac9eff",duration:880},
 "slash":{title:"Sweeping blades",paint:"slash",art:"blade",audio:"slash",color:"#d7dfeb",duration:850},
 "cage":{title:"Dropping cage",paint:"cage",art:"pressure-plate",audio:"cage",color:"#aeb3b5",duration:930},
 "portal":{title:"Opening portal",paint:"portal",art:"magic-portal",audio:"portal",color:"#69e6c9",duration:1200},
 "spores":{title:"Spore burst",paint:"gas",art:"poison",audio:"spores",color:"#eda1b5",duration:1350},
 "glass":{title:"Shattering glass",paint:"glass",art:"frost",audio:"glass",color:"#9be0d2",duration:830},
 "steam":{title:"Grate steam jet",paint:"steam",art:"fire-jet",audio:"steam",color:"#e1e6dc",duration:1250},
 "collapse":{title:"Structural collapse",paint:"stone",art:"rockfall",audio:"collapse",color:"#c6aa84",duration:1100},
 "crystal":{title:"Resonating crystal",paint:"ice",art:"frost",audio:"crystal",color:"#e1a8ff",duration:1100},
 "mimic":{title:"Mimic jaws",paint:"jaw",art:"mimic",audio:"mimic",color:"#e67c63",duration:1050},
 "chime":{title:"Chime and alarm",paint:"alarm",art:"alarm",audio:"chime",color:"#f2d694",duration:1100},
 "shadow":{title:"Closing shadow",paint:"rune",art:"shadow",audio:"magic",color:"#9e78c9",duration:1100}
});
const NAME_RULES=[
 [/steam grate/i,"steam"],[/wall.*(?:flame|fire)|flame.*jet/i,"fire-jet"],[/glyph of flame/i,"fire-blast"],
 [/pit|false floor|sinkhole|severed bridge/i,"pit"],[/needle (?:lock|trap)|dart|spear gallery/i,"darts"],
 [/glass/i,"glass"],[/ceiling|scree slide|sandstone slide|ice shelf break/i,"collapse"],[/rolling stone/i,"stone"],
 [/blade|scythe|pendulum/i,"slash"],[/portcullis|hammer|coffin lid|iron jaw|false lever/i,"metal"],
 [/cage|lockdown/i,"cage"],[/net|rope snare|quicksand/i,"snare"],[/flood|undertow|drowning|rising chamber/i,"water"],
 [/spore/i,"spores"],[/sonic geode/i,"crystal"],[/roots|razorvine|whispering web/i,"organic"],
 [/teleport|portal|summoning/i,"portal"],[/alarm/i,"alarm"],[/chime/i,"chime"],
 [/mimic|maw|hungry floor|door with teeth|living hallway|chest that dreams/i,"mimic"],
 [/shadow|anti-healing|curse|dread|illusion|memory|sleep/i,"shadow"],
 [/force|gravity|hourglass|weighing room/i,"pulse"],
 [/lava/i,"fire-jet"]
];
const TYPES={fire:"fire-blast",cold:"ice",lightning:"lightning",thunder:"thunder",poison:"poison",acid:"acid",necrotic:"shadow",psychic:"rune",force:"pulse",radiant:"magic",piercing:"darts",slashing:"slash",bludgeoning:"stone"};
export function familyFor(t={}) {
 const chosen=typeof t.av==="string"?t.av:"auto";
 if(chosen==="none")return null;
 if(Object.hasOwn(FAMILIES,chosen))return chosen;
 for(const [r,k] of NAME_RULES)if(r.test(t.name??""))return k;
 const type=String(t.damageType??"").toLowerCase();
 return (TYPES[type]==="rune"?"magic":TYPES[type])??(t.category==="Living & Mimic"?"organic":t.category==="Magical"?"magic":"metal");
}
export const artFor=(k)=>FAMILIES[k]?AV_BASE+"/tiles/"+FAMILIES[k].art+".svg":null;
export const audioFor=(k)=>FAMILIES[k]?AV_BASE+"/audio/"+FAMILIES[k].audio+".ogg":null;
