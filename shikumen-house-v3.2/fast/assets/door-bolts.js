import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { DOOR_BOLTS_DATA } from './door-bolts-data.js';

// Approved H03/H04 meshes, fitted to B1 without changing other houses.
const caches = new WeakMap();
function reflection(T){
  const w=128,h=64,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=(x+.5)/w,v=(y+.5)/h,base=.15+.12*Math.max(0,Math.sin((v-.5)*Math.PI));
    const panel=(cu,cv,su,sv,p)=>p*Math.exp(-Math.pow((u-cu)/su,6)-Math.pow((v-cv)/sv,6));
    const light=panel(.23,.57,.09,.21,1.9)+panel(.72,.62,.14,.17,1.2)+.3*Math.exp(-Math.pow((v-.88)/.07,4));
    const i=4*(y*w+x);data[i]=base+light;data[i+1]=base+light*.985;data[i+2]=base+light*.96;data[i+3]=1;
  }
  const t=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);t.mapping=T.EquirectangularReflectionMapping;t.colorSpace=T.LinearSRGBColorSpace;t.needsUpdate=true;t.name='门把手_室内柔和反射';return t;
}



function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = DOOR_BOLTS_DATA, geometries = [], materials = new Map(), textures = new Map();
  const env=typeof document!=='undefined'?reflection(THREE):null;
  const arrays = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function attribute(a) { const raw = FAST_BYTES(a); return new THREE.BufferAttribute(new arrays[a.type](raw.buffer), a.size, !!a.normalized); }
  function geometry(i) {
    if (geometries[i]) return geometries[i];
    const s = d.geometries[i], g = new THREE.BufferGeometry(), names = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', TANGENT: 'tangent' };
    for (const [k, a] of Object.entries(s.attributes)) g.setAttribute(names[k], attribute(a));
    if (s.indices) g.setIndex(attribute(s.indices));
    g.computeBoundingSphere(); return geometries[i] = g;
  }
  function texture(info, color = false) {
    const i = info.index, channel = info.texCoord || 0, key = i + ':' + color + ':' + channel;
    if (textures.has(key)) return textures.get(key);
    const def = d.textures[i], im = d.images[def.source], sam = d.samplers[def.sampler] || {};
    const t = new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href, () => { window.dispatchEvent(new Event('shikumen-asset-ready')); });
    t.flipY = false; t.channel = channel; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = sam.wrapS === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = sam.wrapT === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 8; textures.set(key, t); return t;
  }
  function material(i) {
    if (materials.has(i)) return materials.get(i);
    const s = d.materials[i], p = s.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1];
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_旧铁插销', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    m.userData = { asset: d.assetId, doorBoltsMaterial: i, houseDoorBoltsRevision: 1 };
    if (typeof document !== 'undefined') {
      if (p.baseColorTexture) m.map = texture(p.baseColorTexture, true);
      if (p.metallicRoughnessTexture) { m.roughnessMap = m.metalnessMap = texture(p.metallicRoughnessTexture); }
      if (s.normalTexture) { m.normalMap = texture(s.normalTexture); m.normalScale.setScalar(s.normalTexture.scale ?? 1); }
    }
    if(env){m.envMap=env;m.envMapIntensity=.65;}
    materials.set(i, m); return m;
  }
  function node(s) {
    const o = new THREE.Group(); o.name = s.name; o.userData = { ...s.extras };
    if (s.matrix) new THREE.Matrix4().fromArray(s.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (s.translation) o.position.fromArray(s.translation); if (s.rotation) o.quaternion.fromArray(s.rotation); if (s.scale) o.scale.fromArray(s.scale); }
    for (const p of s.primitives || []) {
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseDoorBoltsRevision: 1 };
      m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

function mortise(T, reference, meshes, bounds){
 reference.updateWorldMatrix(true,true);const inv=reference.matrixWorld.clone().invert(),planes=[0,1,2].flatMap(axis=>[{axis,value:bounds[0][axis],sign:1},{axis,value:bounds[1][axis],sign:-1}]);
 let count=0;
 for(const o of meshes){
  o.updateWorldMatrix(true,false);const matrix=inv.clone().multiply(o.matrixWorld);if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  if(!o.geometry.boundingBox.clone().applyMatrix4(matrix).intersectsBox(new T.Box3(new T.Vector3(...bounds[0]),new T.Vector3(...bounds[1]))))continue;
  const source=o.geometry.index?o.geometry.toNonIndexed():o.geometry,groups=source.groups.length?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}],parts=[];
  for(const group of groups){
   const part=new T.BufferGeometry();for(const[k,a]of Object.entries(source.attributes))part.setAttribute(k,new T.BufferAttribute(a.array.slice(group.start*a.itemSize,(group.start+group.count)*a.itemSize),a.itemSize,a.normalized));
   const result=sliceGeometry(T,part,matrix,planes);part.dispose();result.inside?.dispose();if(result.outside)parts.push({g:result.outside,materialIndex:Array.isArray(o.material)?group.materialIndex:0});
  }
  const out=new T.BufferGeometry(),total=parts.reduce((n,p)=>n+p.g.attributes.position.count,0);
  for(const[k,a]of Object.entries(source.attributes)){const arr=new a.array.constructor(total*a.itemSize);let offset=0;for(const p of parts){arr.set(p.g.attributes[k].array,offset);offset+=p.g.attributes[k].array.length;}out.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
  let start=0;for(const p of parts){const n=p.g.attributes.position.count;out.addGroup(start,n,p.materialIndex);start+=n;p.g.dispose();}
  out.computeBoundingSphere();o.geometry=out;count++;
 }
 return count;
}
function woodMeshes(group){const a=[];group.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.metalness<.2))a.push(o);});return a;}

const installations=new WeakMap();
// Only the four old merged assemblies retain slide-bolt triangles.
function retireOldBolts(T,leaf){
 const removed=[],empty=[];
 leaf.traverse(o=>{
  if(!o.isMesh||!o.name.endsWith('MAT_JOINERY_old_iron'))return;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,p=g.attributes.position,keep=[];let retired=0;
  for(let i=0;i<p.count;i+=3){let bolt=true;for(let j=0;j<3;j++)bolt&&=Math.abs(p.getX(i+j))>.35&&p.getY(i+j)>1.18&&p.getY(i+j)<1.49;
   if(bolt)retired++;else keep.push(i,i+1,i+2);
  }
  if(!retired)return;
  if(!keep.length){empty.push(o);removed.push({mesh:o.name,triangles:retired});return;}
  const out=new T.BufferGeometry();
  for(const[k,a]of Object.entries(g.attributes)){const arr=new a.array.constructor(keep.length*a.itemSize);keep.forEach((j,i)=>{for(let n=0;n<a.itemSize;n++)arr[i*a.itemSize+n]=a.array[j*a.itemSize+n]});out.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
  out.computeBoundingSphere();o.geometry=out;removed.push({mesh:o.name,triangles:retired});
 });empty.forEach(o=>o.removeFromParent());return removed;
}

export function installHouseDoorBolts(T,root){if(!FAST_ENABLED("door-bolts"))return;
 if(installations.has(root))return;
 const c=cache(T),records=[],audit=[];
 // Room doors retain only their approved knobs; remove legacy bolts too.
 for(const info of root.userData.doorHandles.doors){
  const door=root.getObjectByName(info.door),leaf=door.children.find(o=>o.userData.kind==='door_leaf');
  audit.push({type:'removed-room-bolt',door:info.door,room:info.room,removed:retireOldBolts(T,leaf)});
 }
 const gate=root.getObjectByName('石库门_双扇黑漆门'),leaves=gate.children.filter(o=>o.userData.kind==='door_leaf'),[active,fixed]=leaves,angles=leaves.map(l=>l.rotation.y);
 leaves.forEach(l=>l.rotation.y=0);root.updateMatrixWorld(true);
 const removed=leaves.flatMap(l=>retireOldBolts(T,l));
 const bar=c.node(DOOR_BOLTS_DATA.nodes.H03);bar.name='大门活动扇横闩';bar.position.set(.580,1.43,.00385);bar.rotation.y=Math.PI;active.add(bar);root.updateMatrixWorld(true);
 const receiver=bar.getObjectByName('H03_独立承口');fixed.attach(receiver);receiver.name='大门固定扇横闩承口';
 const move=bar.getObjectByName('H03_活动铁闩');records.push({type:'H03',leaf:active,other:fixed,set:bar,keeper:receiver,move,axis:'x',offset:.060,home:move.position.x});
 audit.push({type:'H03',door:gate.name,removed,receiverParent:fixed.name,position:bar.position.toArray()});
 // H04 uses the two approved assemblies separately at the head and sill.
 const vertical=c.node(DOOR_BOLTS_DATA.nodes.H04);
 for(const[ident,height,sign]of [['上插销',2.464,1],['下插销',.134,-1]]){
  const set=vertical.getObjectByName('H04_'+ident);set.removeFromParent();set.position.set(-.653,height,.00385);set.rotation.set(0,Math.PI,sign<0?Math.PI:0);
  // The small bend points toward the fixed leaf's hinge, away from the meeting gap.
  set.scale.x=sign>0?-1:1;fixed.add(set);root.updateMatrixWorld(true);
  const keeper=new T.Group();keeper.name='大门'+ident+'固定承孔';gate.add(keeper);
  for(const o of [...set.children])if(o.name.includes('承孔'))keeper.attach(o);
  const rod=set.getObjectByName('H04_'+ident+'_活动杆');records.push({type:'H04',leaf:fixed,set,keeper,move:rod,axis:'y',offset:-.043,home:rod.position.y});
  // Notch only the last few millimetres of the old back batten under the plate.
  const notches=mortise(T,fixed,woodMeshes(fixed),[[-.674,height-.109,-.040],[-.632,height+.109,.0039]]);
  const holeX=fixed.position.x-.653,holeZ=fixed.position.z+.00385-.011;
  const wood=sign>0?woodMeshes(gate).filter(o=>{for(let p=o;p&&p!==gate;p=p.parent)if(p.userData.kind==='door_leaf')return false;return true}):[root.getObjectByName('石库门门槛')];
  const holeY=height+sign*.132;
  const holes=mortise(T,gate,wood,[[holeX-.0069,holeY-.020,holeZ-.0069],[holeX+.0069,holeY+.020,holeZ+.0069]]);
  audit.push({type:'H04',position:ident,door:gate.name,keeperParent:gate.name,battenNotches:notches,receivingHoles:holes,hole:[holeX,holeY,holeZ]});
 }
 leaves.forEach((l,i)=>l.rotation.y=angles[i]);installations.set(root,records);
 root.userData.doorBolts={revision:1,source:DOOR_BOLTS_DATA.source,H02:0,H03:1,H04:2,roomBoltsRemoved:10,installations:audit,newCredits:0};
 root.userData.textureCount=(root.userData.textureCount||0)+DOOR_BOLTS_DATA.images.length;
 updateHouseDoorBolts(root);root.updateMatrixWorld(true);
}

export function updateHouseDoorBolts(root){
 for(const r of installations.get(root)||[]){
  const open=Math.abs(r.leaf.rotation.y)>1e-5||r.other&&Math.abs(r.other.rotation.y)>1e-5;
  r.move.position[r.axis]=r.home+(open?r.offset:0);
  r.set.userData.boltRetracted=!!open;r.set.userData.boltType=r.type;
 }
}
