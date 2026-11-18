import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { TERRACE_DATA } from './terrace-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=TERRACE_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const transmission=s.extensions?.KHR_materials_transmission,Mat=transmission?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Mat({...(transmission?{transmission:transmission.transmissionFactor||0,ior:s.extensions?.KHR_materials_ior?.ior||1.5}:{}),name:s.name+'_晒台v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});m.userData={asset:d.assetId,terraceMaterial:i,terraceRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);m.emissiveIntensity=s.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={terraceRevision:1};m.castShadow=!(m.material.transmission>0);m.receiveShadow=!(m.material.transmission>0);o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,part:name=>{const g=new THREE.Group();g.name='晒台_'+name;g.position.set(0,0,0);g.userData={terraceRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

function finishArchitecture(THREE,root,c){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),targets=[],audit=[];
 const planes=[{axis:0,value:.235,sign:1},{axis:0,value:3.845,sign:-1},{axis:1,value:4.795,sign:1},{axis:1,value:6.701,sign:-1},{axis:2,value:-14.801,sign:1},{axis:2,value:-12.115,sign:-1}];
 root.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&!o.userData.terraceRevision&&/红砖|灰缝|砂岩|压顶/.test(o.material.name))targets.push(o);});
 const im=new THREE.Matrix4(),col=new THREE.Color(),pos=new THREE.Vector3(),nor=new THREE.Vector3();
 for(const o of targets){
  const world=inv.clone().multiply(o.matrixWorld),inside=[],outside=[],stone=/砂岩|压顶/.test(o.material.name),slot=TERRACE_DATA.surfaceSlots[stone?'stone':'brick'];
  function process(g,tint){
   const s=sliceGeometry(THREE,g,world,planes);
   if(s.inside){const a=s.inside,p=a.attributes.position,n=a.attributes.normal,co=a.attributes.color,uv=new Float32Array(p.count*2),colors=new Float32Array(p.count*3),nm=new THREE.Matrix3().getNormalMatrix(world);
    for(let i=0;i<p.count;i++){
     pos.fromBufferAttribute(p,i).applyMatrix4(world);nor.fromBufferAttribute(n,i).applyMatrix3(nm);
     uv[i*2]=(Math.abs(nor.x)>.7?-pos.z:pos.x)/2;uv[i*2+1]=(Math.abs(nor.y)>.7?-pos.z:pos.y)/2;
     col.setRGB(co?.getX(i)??1,co?.getY(i)??1,co?.getZ(i)??1).multiply(o.material.color).multiply(tint);colors.set(col.toArray(),i*3);
    }
    a.setAttribute('uv',new THREE.BufferAttribute(uv,2));if(stone)a.deleteAttribute('color');else a.setAttribute('color',new THREE.BufferAttribute(colors,3));inside.push(a);
   }
   if(s.outside)outside.push({g:s.outside,tint:tint.clone()});return !!s.inside;
  }
  if(o.isInstancedMesh){
   const keep=[];for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const tint=o.instanceColor?(o.getColorAt(i,col),col.clone()):new THREE.Color(1,1,1),g=o.geometry.clone().applyMatrix4(im);const n=outside.length;if(!process(g,tint)){keep.push(i);outside.splice(n);}g.dispose();}
   if(!inside.length){outside.forEach(x=>x.g.dispose());continue;}
   if(keep.length){const k=new THREE.InstancedMesh(o.geometry,o.material,keep.length);k.name=o.name;k.position.copy(o.position);k.quaternion.copy(o.quaternion);k.scale.copy(o.scale);k.userData={...o.userData};keep.forEach((i,j)=>{o.getMatrixAt(i,im);k.setMatrixAt(j,im);if(o.instanceColor){o.getColorAt(i,col);k.setColorAt(j,col);}});k.castShadow=k.receiveShadow=true;o.parent.add(k);}
  }else{if(!process(o.geometry,new THREE.Color(1,1,1))){outside.forEach(x=>x.g.dispose());continue;}}
  for(const x of outside){const m=o.material.clone();m.color.multiply(x.tint);const mesh=new THREE.Mesh(x.g,m);mesh.name=o.name+'_晒台范围外保留';mesh.position.copy(o.position);mesh.quaternion.copy(o.quaternion);mesh.scale.copy(o.scale);mesh.castShadow=mesh.receiveShadow=true;o.parent.add(mesh);}
  const g=new THREE.BufferGeometry();for(const name of Object.keys(inside[0].attributes)){const size=inside[0].attributes[name].itemSize,count=inside.reduce((s,a)=>s+a.attributes[name].array.length,0),arr=new Float32Array(count);let offset=0;for(const a of inside){arr.set(a.attributes[name].array,offset);offset+=a.attributes[name].array.length;}g.setAttribute(name,new THREE.BufferAttribute(arr,size));}
  const mesh=new THREE.Mesh(g,c.material(slot,!stone));mesh.name=o.name+'_晒台旧感';mesh.userData={terraceRevision:1};mesh.position.copy(o.position);mesh.quaternion.copy(o.quaternion);mesh.scale.copy(o.scale);mesh.castShadow=mesh.receiveShadow=true;o.parent.add(mesh);o.removeFromParent();inside.forEach(a=>a.dispose());audit.push({name:mesh.name,vertices:g.attributes.position.count});
 }
 return audit;
}
export function installTerrace(THREE,root){if(!FAST_ENABLED("terrace"))return;
 const c=cache(THREE),terrace=root.getObjectByName('L2H_晒台');terrace.getObjectByName('固定晾衣杆')?.removeFromParent();
 // Recess the side-draining sump above y=4.69; retain the slab underside at 4.64
 // so the terrace drain does not open through the occupied room's ceiling.
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),slab=root.getObjectByName('晒台_灰砂实体屋面板');
 slab?.traverse(o=>{if(!o.isMesh)return;const world=inv.clone().multiply(o.matrixWorld),s=sliceGeometry(THREE,o.geometry,world,[{axis:0,value:3.46,sign:1},{axis:0,value:3.68,sign:-1},{axis:2,value:-14.68,sign:1},{axis:2,value:-14.46,sign:-1},{axis:1,value:4.69,sign:1}]);if(s.inside){o.geometry=s.outside;s.inside.dispose();}});
 const audit=finishArchitecture(THREE,root,c),f=c.part('furniture');terrace.add(f);f.traverse(o=>{if(o.isMesh&&/旧水泥找坡面|地漏斜底/.test(o.name))o.castShadow=false;});
 root.userData.terrace={revision:1,assetId:TERRACE_DATA.assetId,conceptApproved:true,standalonePartsApproved:true,integratedSceneApproved:false,poleLength:2.9,poleCenters:[[1.99,6.495,-13.57],[1.99,6.495,-14.43]],drain:[3.57,4.812,-14.57],surfaceAudit:audit};
 root.userData.textureCount=(root.userData.textureCount||0)+TERRACE_DATA.images.length;
}
