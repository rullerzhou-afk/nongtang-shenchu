import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { applyBicycleReflections } from './bicycle-reflections.js';
import { sliceGeometry } from './courtyard.js';
import { STAIRWELL_PROPS_DATA } from './stairwell-props-data.js';

const caches=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=STAIRWELL_PROPS_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const transmission=s.extensions?.KHR_materials_transmission,Mat=transmission?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Mat({...(transmission?{transmission:transmission.transmissionFactor||0,ior:s.extensions?.KHR_materials_ior?.ior||1.5}:{}),name:s.name+'_楼梯陈设v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});m.userData={asset:d.assetId,stairwellPropsMaterial:i,stairwellPropsRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);m.emissiveIntensity=s.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={stairwellPropsRevision:1};m.castShadow=!(m.material.transmission>0);m.receiveShadow=!(m.material.transmission>0);o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,part:name=>{const g=new THREE.Group();g.name='楼梯间陈设_'+name;g.position.set(0,0,0);g.userData={stairwellPropsRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

// The addition GLB uses the building's local coordinates. Attach to the actual
// supporting wall floor, not the height of the landing that the lamp serves.
export function installStairwellProps(T,root){if(!FAST_ENABLED("stairwell-props"))return;
 if(root.userData.stairwellProps)return;
 const c=cache(T),floors=[{key:'ground',name:'楼梯间陈设_一楼',parent:'L0_一楼',min:0,max:4},{key:'second',name:'楼梯间陈设_二楼',parent:'L2_二楼',min:4,max:6.7}];
 const wiring=c.part('wiring');wiring.updateMatrixWorld(true);const meshes=[];wiring.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const walls=[{name:'west',planes:[{axis:0,value:.30,sign:-1}]},{name:'south',planes:[{axis:0,value:.30,sign:1},{axis:0,value:3.79,sign:-1}]},{name:'east',planes:[{axis:0,value:3.79,sign:1}]}];
 const splitAudit=[];
 for(const floor of floors){
  const group=c.part(floor.key);group.name=floor.name;group.userData.stairwellPropsGroup=true;root.getObjectByName(floor.parent).add(group);
  const wireGroup=new T.Group();wireGroup.name='明线与开关_'+floor.key;wireGroup.userData.stairwellPropsRevision=1;group.add(wireGroup);
  for(const o of meshes){
   const matrix=o.matrixWorld.clone();const bounds=new T.Box3().setFromObject(o);
   if(bounds.max.y<floor.min||bounds.min.y>floor.max)continue;
   for(const wall of walls){
    if(wall.name==='west'&&bounds.min.x>.30||wall.name==='east'&&bounds.max.x<3.79||wall.name==='south'&&(bounds.max.x<.30||bounds.min.x>3.79))continue;
    // Partition only the wiring, keeping every original triangle on one side or
    // the other. Both floor bands meet exactly when the whole house is shown.
    const cut=sliceGeometry(T,o.geometry,matrix,[{axis:1,value:floor.min,sign:1},{axis:1,value:floor.max,sign:-1},...wall.planes]);
    cut.outside?.dispose();if(!cut.inside)continue;
    const n=new T.Mesh(cut.inside,o.material);n.name=o.name+'_'+floor.key+'_'+wall.name;matrix.decompose(n.position,n.quaternion,n.scale);n.userData={...o.userData,stairwellPropsRevision:1,stairwellMountedWall:wall.name,sourceNode:o.name};n.castShadow=n.receiveShadow=true;wireGroup.add(n);splitAudit.push({source:o.name,floor:floor.key,wall:wall.name,vertices:n.geometry.attributes.position.count});
   }
  }
 }
 root.userData.stairwellProps={revision:1,source:STAIRWELL_PROPS_DATA.source,counts:STAIRWELL_PROPS_DATA.counts,lamps:STAIRWELL_PROPS_DATA.lights,placement:'unchanged from approved independent trial',bicycle:'original Claude saddle restored; other local bicycle refinements retained; parked 7 degrees left',splitWiringBySupportingWallAndFloor:splitAudit.length,userVisualApproved:false};
 if(typeof document!=='undefined')applyBicycleReflections(T,root);
 root.userData.textureCount=(root.userData.textureCount||0)+STAIRWELL_PROPS_DATA.images.length;
}

// Viewer-owned point lights follow the actual visible fixtures, including
// inspection clones. Hidden/removed walls do not leave a floating lit fixture.
export function getStairwellLighting(T,root,on=true){
 const c=cache(T);for(let i=0;i<STAIRWELL_PROPS_DATA.materials.length;i++)if(STAIRWELL_PROPS_DATA.materials[i].name.includes('钨丝'))c.material(i).emissiveIntensity=on?1.8:0;
 const visible=new Set();root.traverseVisible(o=>{if(o.userData.stairwellLampId)visible.add(o.userData.stairwellLampId);});root.updateMatrixWorld(true);
 return STAIRWELL_PROPS_DATA.lights.map(l=>({id:l.id,position:root.localToWorld(new T.Vector3().fromArray(l.threePosition)).toArray(),energy:l.energy,present:visible.has(l.id),visible:on&&visible.has(l.id)}));
}

export function setStairwellBicycleReflections(T,root,level=1){applyBicycleReflections(T,root,level);}
