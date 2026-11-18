import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { REAR_RIM_LOCK_DATA } from './rear-rim-lock-data.js';

const caches = new WeakMap();
const installations = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = REAR_RIM_LOCK_DATA, geometries = [], materials = new Map(), textures = new Map();
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
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_后门方盒锁', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    m.userData = { asset: d.assetId, rearRimLockMaterial: i, rearRimLockRevision: 1 };
    if (typeof document !== 'undefined') {
      if (p.baseColorTexture) m.map = texture(p.baseColorTexture, true);
      if (p.metallicRoughnessTexture) { m.roughnessMap = m.metalnessMap = texture(p.metallicRoughnessTexture); }
      if (s.normalTexture) { m.normalMap = texture(s.normalTexture); m.normalScale.setScalar(s.normalTexture.scale ?? 1); }
    }
    materials.set(i, m); return m;
  }
  function node(s) {
    const o = new THREE.Group(); o.name = s.name; o.userData = { ...s.extras };
    if (s.matrix) new THREE.Matrix4().fromArray(s.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (s.translation) o.position.fromArray(s.translation); if (s.rotation) o.quaternion.fromArray(s.rotation); if (s.scale) o.scale.fromArray(s.scale); }
    for (const p of s.primitives || []) {
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { rearRimLockRevision: 1 };
      m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

export function createRearRimLock(T) { return cache(T).node(REAR_RIM_LOCK_DATA.node); }

export function installRearRimLock(T, root, door, leaf, removed, mortise) {if(!FAST_ENABLED("rear-rim-lock"))return;
  const edge=.885,height=1.030,innerSurface=-.084,thickness=.088;
  const gap=door.userData.clearOpening[0]/2-(leaf.position.x+edge);
  // The frame face is 31 mm proud of the closed leaf. A fitted wood mounting
  // block brings the box and receiver to a shared plane, without changing the door.
  const frameInner=-.075,plane=frameInner-leaf.position.z-.0002;
  const packing=innerSurface-plane,rail=leaf.getObjectByName('厨房修正_门中横枋_表面');
  if(!rail||packing<0||packing>.04||Math.abs(gap-.015)>.0001)throw Error('Rear lock mounting surfaces changed; re-survey this door');
  const wood=rail.material;
  const block=new T.Mesh(new T.BoxGeometry(.146,.100,packing),wood);
  const bp=block.geometry.attributes.position,bn=block.geometry.attributes.normal,uv=block.geometry.attributes.uv;
  for(let i=0;i<bp.count;i++){
    const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);
    if(Math.abs(bn.getZ(i))>.5)uv.setXY(i,x/.735+.5,y/.135+.5);
    else if(Math.abs(bn.getY(i))>.5)uv.setXY(i,x/.735+.5,z/.088+.5);
    else uv.setXY(i,z/.088+.5,y/.135+.5);
  }
  block.name='后门方盒锁_实木安装垫座';block.position.set(edge-.074,height,innerSurface-packing/2);
  block.castShadow=block.receiveShadow=true;block.userData={rearRimLockPacking:true};leaf.add(block);
  const set=createRearRimLock(T);set.name='后门_棕漆方盒明装锁';set.position.set(edge,height,plane);
  set.userData={rearRimLockSet:true,revision:1,door:door.name};leaf.add(set);
  const outer=set.getObjectByName('RIM_外侧黄铜锁芯');outer.position.z+=packing;
  // The outer cylinder passes through an actual concealed opening. Starting from
  // the original kitchen door avoids leaving the former cylindrical-latch mortise.
  const leafWood=[];leaf.traverse(o=>{if(o.isMesh&&!o.userData.rearRimLockRevision&&o!==block)leafWood.push(o)});
  const aperture=mortise(T,leaf,[...leafWood,block],[[edge-.100,height-.007,plane-.001],[edge-.080,height+.015,innerSurface+thickness+.001]]);
  const keeper=set.getObjectByName('RIM_独立门框扣座');root.updateMatrixWorld(true);door.attach(keeper);
  keeper.name='后门方盒锁_固定门框扣座';keeper.userData={rearRimLockKeeper:true,revision:1};
  // The plaster reveal projects past the wooden frame face. Cut a real local
  // receiver pocket through that reveal, then close the freshly exposed edges.
  const reveal=[];root.getObjectByName('北_厨房后弄墙').traverse(o=>{
    if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===door)return;reveal.push(o);
  });
  const pocket=[[.447,height-.053,-.151],[.492,height+.053,-.0747]];
  const revealCuts=mortise(T,door,reveal,pocket);
  const mortar=reveal.find(o=>o.name.includes('旧灰缝'))?.material;
  if(!mortar)throw Error('Rear lock reveal mortar missing');
  for(const [name,position,size]of [
    ['外侧壁',[.49225,height,-.11275],[.0005,.106,.0765]],
    ['下沿',[.4695,height-.05325,-.11275],[.045,.0005,.0765]],
    ['上沿',[.4695,height+.05325,-.11275],[.045,.0005,.0765]],
  ]){
    const lining=new T.Mesh(new T.BoxGeometry(...size),mortar);lining.name='后门扣座凹位_'+name;lining.position.fromArray(position);
    if(mortar.vertexColors)lining.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(lining.geometry.attributes.position.count*3).fill(1),3));
    lining.castShadow=lining.receiveShadow=true;door.add(lining);
  }
  const latch=set.getObjectByName('RIM_活动锁舌'),grip=set.getObjectByName('RIM_内侧旋钮');
  installations.set(root,{leaf,set,keeper,latch,grip,gripHome:grip.quaternion.clone()});
  leaf.userData.restOpening=0;leaf.userData.doorHandleRevision='rear-rim-lock-20261115';
  root.userData.rearRimLock={revision:1,date:'2026-11-15',source:REAR_RIM_LOCK_DATA.source,door:door.name,bodyMm:[140,94,30],
    leafThickness:thickness,height,edge,leafInsideSurface:innerSurface,mountingPlane:plane,packingDepth:packing,frameGap:gap,
    cylinderApertureMeshes:aperture,revealPocket:{bounds:pocket,cutMeshes:revealCuts,closedEdges:3},removed,boltClosedEnd:.033,boltRetractedEnd:-.010,receiverEntry:.016,receiverDepth:.027,
    newCredits:0,scope:'Only B1 kitchen north door; other nine cylindrical locks and black gate bolts unchanged'};
  root.userData.textureCount=(root.userData.textureCount||0)+REAR_RIM_LOCK_DATA.images.length;
  updateRearRimLock(root);
}

export function updateRearRimLock(root) {
  const r=installations.get(root);if(!r)return;
  const open=Math.abs(r.leaf.rotation.y)>1e-5;
  r.latch.position.x=open?-.043:0;
  r.grip.quaternion.copy(r.gripHome);if(open)r.grip.rotateZ(-.65);
}

