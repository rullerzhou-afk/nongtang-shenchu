// Lossless publication data. Authoring sources and the full offline export stay independent.
const records=new Map(),buffers=new Map(),pending=new Map();
export const rooms=new Set(['courtyard','rear-courtyard','terrace']);
export const allRooms=['kitchen','hall','courtyard','rear-courtyard','front-wing','rear-wing','middle-wing','stairwell-props','tingzijian','marital','lounge','storage','child-room','attic-room','attic-storage','terrace'];
const parentRooms=[['厨房','kitchen'],['客堂','hall'],['前天井','courtyard'],['后天井','rear-courtyard'],['前厢','front-wing'],['后厢','rear-wing'],['中厢','middle-wing'],['亭子间','tingzijian'],['婚房','marital'],['起居间','lounge'],['孩子','child-room'],['五斗橱_抽屉','child-room'],['储藏间','storage'],['阁梯间','attic-room'],['阁楼','attic-storage'],['晒台','terrace'],['楼梯间','stairwell-props']];
export function roomOf(v){const s=typeof v==='string'?v:[v?.parent,v?.from,v?.toGroup,v?.to,v?.node?.name,v?.newName].filter(x=>typeof x==='string').join(' ');return parentRooms.find(([p])=>s.includes(p))?.[1]||allRooms.find(r=>s.includes(r));}
function enabled(r){return !r||rooms.has(r);}
function keepItem(v){return enabled(roomOf(v));}
const forcedRooms={'hall-rearrange':'hall','marital-combo':'marital','elder-wardrobe':'front-wing','middle-wing-fan':'middle-wing','kitchen-snack':'kitchen','kitchen-condiments':'kitchen','kitchen-wash':'kitchen'};
export function moduleEnabled(name){return enabled(forcedRooms[name]);}
export function registerData(name,d){
 records.set(name,d);Object.defineProperty(d,'_transfers',{value:[...(d.rehome||[]),...(d.relocate||[])]});
 if(d.parts){for(const key of Object.keys(d.parts)){
  const owner=key==='furniture'?name:name==='kitchen'&&key==='fixtures'?'kitchen':name==='stairwell-props'&&key==='ground'?'stairwell-props':null;
  if(owner&&allRooms.includes(owner)){const value=d.parts[key];Object.defineProperty(d.parts,key,{enumerable:true,get:()=>enabled(owner)?value:name==='stairwell-props'?value.filter(n=>n.name.includes('墙灯')):[]});}
 }}
 // Room-independent structural finishes and window curtains remain available from outside.
 for(const key of ['fixtures','retire','move','relocate','reshape','lift']){
  if(!Array.isArray(d[key])||name==='curtains'||name==='lighting')continue;
  const value=d[key];Object.defineProperty(d,key,{enumerable:true,get:()=>moduleEnabled(name)?value.filter(keepItem):[]});
 }
 return d;
}
export function readBytes(value){
 const ref=value?._binary||value;
 if(!ref?.file)throw new Error('Missing binary descriptor');
 const raw=buffers.get(ref.file);if(!raw)throw new Error('Geometry not prepared: '+ref.file);
 // The legacy constructors use raw.buffer; return an exactly bounded buffer without a JS per-byte loop.
 return new Uint8Array(raw.slice(ref.offset,ref.offset+ref.length));
}
async function loadBuffer(file){
 if(buffers.has(file))return;if(pending.has(file))return pending.get(file);
 const job=(async()=>{const response=await fetch(new URL('./'+file,import.meta.url));if(!response.ok)throw new Error('Resource unavailable: '+file+' ('+response.status+')');const stream=response.body.pipeThrough(new DecompressionStream('gzip'));const raw=await new Response(stream).arrayBuffer();buffers.set(file,raw);})();pending.set(file,job);
 try{await job;}finally{pending.delete(file);}
}
function visit(v,fn){if(Array.isArray(v)){for(const x of v)visit(x,fn);}else if(v&&typeof v==='object'){fn(v);for(const[k,x]of Object.entries(v))if(k!=='geometries'&&k!=='images'&&k!=='materials'&&k!=='textures'&&k!=='samplers')visit(x,fn);}}
export async function prepareRooms(next=[]){
 // Cross-room reused objects keep their source room available during the original installation sequence.
 const previous=new Set(rooms);for(const r of next)rooms.add(r);
 let changed=true;while(changed){changed=false;for(const d of records.values())for(const r of d._transfers){const target=roomOf(r.toGroup||r.to);const source=roomOf(r.from)|| (d===records.get('hall-rearrange')?'hall':null);if(target&&rooms.has(target)&&source&&!rooms.has(source)){rooms.add(source);changed=true;}}}
 const needed=new Set();
 for(const[name,d]of records){if(!moduleEnabled(name))continue;
  const indices=new Set();visit(d,v=>{if(Number.isInteger(v.geometry))indices.add(v.geometry);if(v._binary)needed.add(v._binary.file);});
  for(const i of indices)visit(d.geometries?.[i],v=>{if(v._binary)needed.add(v._binary.file);});
 }
 const queue=[...needed];let i=0;try{await Promise.all(Array.from({length:Math.min(16,queue.length)},async()=>{while(i<queue.length)await loadBuffer(queue[i++]);}));}catch(e){rooms.clear();for(const r of previous)rooms.add(r);throw e;}
 return [...rooms];
}
export function runtimeStatus(){return {rooms:[...rooms],binaryFiles:buffers.size,binaryBytes:[...buffers.values()].reduce((s,b)=>s+b.byteLength,0)};}
