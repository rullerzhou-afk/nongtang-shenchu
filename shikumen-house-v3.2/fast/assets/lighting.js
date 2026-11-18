import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { LIGHTING_DATA } from './lighting-data.js';
import { sliceGeometry } from './courtyard.js';

// B1 night lighting: nine approved fixtures plus two existing desk lamps.
// Fixtures are attached to each room's furniture group so room inspection clones carry them.
const caches=new WeakMap(),registries=new WeakMap(),cutaways=new WeakMap();
const LAMPS=Object.fromEntries(LIGHTING_DATA.lamps.map(l=>[l.id,l]));
const EMISSIVE=/^(钨丝|日光灯管_荧光粉白|透光_)/;
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=LIGHTING_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv1',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(info,color=false){const i=info.index,channel=info.texCoord||0,key=i+':'+color+':'+channel;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.channel=channel;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const transmission=s.extensions?.KHR_materials_transmission,Mat=transmission?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Mat({...(transmission?{transmission:transmission.transmissionFactor||0,ior:s.extensions?.KHR_materials_ior?.ior||1.5}:{}),name:s.name+'_灯具v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided||/^透光_/.test(s.name)?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});m.userData={asset:d.assetId,lightingMaterial:i,houseLightingRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture);if(s.normalTexture){m.normalMap=texture(s.normalTexture);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);m.emissiveIntensity=s.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={houseLightingRevision:1};
   // Glass, filaments, tubes and translucent shades let the lamp's own light through.
   const lightPart=m.material.transmission>0||/^(钨丝|日光灯管_荧光粉白|透光_|透明白炽灯|灯泡玻璃芯柱|灯泡内部细支架)/.test(m.material.name);m.castShadow=!lightPart;m.receiveShadow=!(m.material.transmission>0);o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,node};caches.set(THREE,c);return c;
}

export function installHouseLighting(T,root){if(!FAST_ENABLED("lighting"))return;
 if(root.userData.houseLighting)return;
 const c=cache(T);root.updateMatrixWorld(true);const rootInv=root.matrixWorld.clone().invert(),removed=[],reg=new Map();
 // 鹿鹿 2026-11-13: the household already has many thermos flasks; the marital bedside one makes room for the table lamp.
 const thermos=root.getObjectByName('婚房_furniture')?.getObjectByName('暖水瓶');if(thermos){thermos.removeFromParent();removed.push('婚房_furniture/暖水瓶');}
 for(const f of LIGHTING_DATA.fixtures){
  const parent=root.getObjectByName(f.parent);if(!parent)throw new Error('Missing lamp parent '+f.parent);
  const n=c.node(f.node),house=new T.Matrix4().fromArray(f.node.matrix),rel=rootInv.clone().multiply(parent.matrixWorld);
  rel.invert().multiply(house).decompose(n.position,n.quaternion,n.scale);
  n.name='屋内灯具_'+f.name;n.userData={...n.userData,houseLampId:f.id,houseLightingRevision:1};
  // Per-fixture copies of the light-emitting materials so each lamp can be switched alone.
  const own=[];n.traverse(o=>{if(!o.isMesh)return;const list=Array.isArray(o.material)?o.material:[o.material];const next=list.map(m=>{if(!EMISSIVE.test(m.name))return m;const k=m.clone();own.push(k);return k;});o.material=Array.isArray(o.material)?next:next[0];});
  reg.set(f.id,(reg.get(f.id)||[]).concat(own));parent.add(n);
 }
 registries.set(root,reg);
 root.userData.houseLighting={revision:1,source:LIGHTING_DATA.source,lamps:LIGHTING_DATA.lamps.map(l=>l.id).concat(['middleDesk','childDesk']),lightPoints:LIGHTING_DATA.lights.length,removed,placement:'house-local mounts measured 2026-11-13',userVisualApproved:'fixtures approved 2026-11-13; house placement pending'};
 root.userData.textureCount=(root.userData.textureCount||0)+LIGHTING_DATA.images.length;
}

// The three upstairs pendants hang from roof purlins above the +6.70 wall top.
// Retain their original meshes for the complete house; use a cached geometric
// section below that wall top while the roof is removed (also inherited by room clones).
export function setHouseLightingRoof(T,root,roofVisible){
 let entries=cutaways.get(root);
 if(!entries){
  if(roofVisible)return;
  root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();entries=[];
  root.traverse(f=>{
   if(!['lounge','maritalCeiling','childCeiling'].includes(f.userData.houseLampId))return;
   f.traverse(m=>{
    if(!m.isMesh)return;
    const original=m.geometry,toRoot=inv.clone().multiply(m.matrixWorld);
    if(!original.boundingBox)original.computeBoundingBox();
    const bounds=original.boundingBox.clone().applyMatrix4(toRoot);
    if(bounds.max.y<=6.70)return;
    let section=null;
    if(bounds.min.y<6.70){const split=sliceGeometry(T,original,toRoot,[{axis:1,value:6.70,sign:-1}]);section=split.inside;split.outside?.dispose();}
    entries.push({mesh:m,original,section,visible:m.visible});
   });
  });
  cutaways.set(root,entries);
 }
 for(const e of entries){e.mesh.geometry=roofVisible?e.original:(e.section||e.original);e.mesh.visible=e.visible&&(roofVisible||!!e.section);}
}

// on: {lampId: boolean}. Emissive parts follow each lamp; returned light points only count visible fixtures.
export function getHouseLighting(T,root,on={}){
 const reg=registries.get(root)||new Map();
 for(const[id,mats]of reg){const lit=!!on[id],glow=LAMPS[id]?.glow||0;
  for(const m of mats){
   if(/^钨丝/.test(m.name))m.emissiveIntensity=lit?1.8:0;
   else if(/^日光灯管_荧光粉白/.test(m.name))m.emissiveIntensity=lit?1.6:0;
   else if(/^透光_/.test(m.name)){const want=lit&&glow>0;if(m.userData.glowOn!==want){m.userData.glowOn=want;if(want){m.emissive.set(id==='maritalCeiling'?0xfff0dc:0xffeedd);m.emissiveMap=m.map;m.emissiveIntensity=glow;}else{m.emissive.set(0);m.emissiveMap=null;m.emissiveIntensity=1;}m.needsUpdate=true;}}
  }}
 const visible=new Set();let childBulb=null;
 root.traverseVisible(o=>{if(o.userData.houseLampId)visible.add(o.userData.houseLampId);if(o.name==='弯颈小台灯')visible.add('middleDesk');if(o.name==='RL03_蓝绿深罩金属软颈台灯')visible.add('childDesk');if(!childBulb&&o.isMesh&&o.material?.name?.startsWith('老式白炽灯泡乳白玻璃'))childBulb=o.material;});
 if(childBulb){const want=!!on.childDesk;if(childBulb.userData.deskLampOn!==want){childBulb.userData.deskLampOn=want;childBulb.emissive.set(want?0xffe4b8:0);childBulb.emissiveIntensity=want?1.4:1;}}
 root.updateMatrixWorld(true);
 return LIGHTING_DATA.lights.map(l=>({id:l.id,lamp:l.lamp,position:root.localToWorld(new T.Vector3().fromArray(l.position)).toArray(),energy:l.energy,color:l.color,present:visible.has(l.lamp),visible:!!on[l.lamp]&&visible.has(l.lamp)}));
}

export const HOUSE_LAMP_IDS=['hall','frontWing','middleCeiling','middleDesk','kitchen','rearWing','tingzijian','stair','lounge','maritalCeiling','maritalBedside','childCeiling','childDesk','storage','atticRoom'];
