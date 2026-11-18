import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { THRESHOLD_STONE_DATA } from './threshold-stone-data.js';
import { PEDIMENT_RELIEF_DATA } from './pediment-relief-data.js';
import { RAINWATER_HOPPER_DATA } from './rainwater-hopper-data.js';

const materialCache=new WeakMap();
function materialFor(THREE,data){
  let cache=materialCache.get(THREE);
  if(!cache){cache=new Map();materialCache.set(THREE,cache);}
  if(cache.has(data.assetId))return cache.get(data.assetId);
  const source=data.material,pbr=source.pbrMetallicRoughness;
  const material=new THREE.MeshStandardMaterial({name:source.name,
    color:new THREE.Color().fromArray(pbr.baseColorFactor||[1,1,1]),
    roughness:pbr.roughnessFactor??1,metalness:pbr.metallicFactor??1});
  material.userData={asset:data.assetId,textureSize:data.textureSize||[1,1],textureCount:data.images.length};
  if(typeof document!=='undefined'){
    const loader=new THREE.TextureLoader();
    const textures=data.textures.map(info=>{
      const img=data.images[info.source],sampler=data.samplers?.[info.sampler]||{};
      const texture=loader.load(new URL(img.url,import.meta.url).href,()=>window.dispatchEvent(new Event('shikumen-asset-ready')));
      texture.flipY=false;
      texture.wrapS=sampler.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
      texture.wrapT=sampler.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
      return texture;
    });
    if(pbr.baseColorTexture){material.map=textures[pbr.baseColorTexture.index];material.map.colorSpace=THREE.SRGBColorSpace;}
    if(pbr.metallicRoughnessTexture)material.roughnessMap=material.metalnessMap=textures[pbr.metallicRoughnessTexture.index];
    if(source.normalTexture){material.normalMap=textures[source.normalTexture.index];material.normalScale.setScalar(source.normalTexture.scale??1);}
  }
  cache.set(data.assetId,material);return material;
}

export function getThresholdStoneMaterial(THREE){return materialFor(THREE,THRESHOLD_STONE_DATA);}

const reliefGeometryCache=new WeakMap();
export function createPedimentRelief(THREE){
  let geometry=reliefGeometryCache.get(THREE);
  if(!geometry){
    const decode=record=>{
      const bytes=FAST_BYTES(record);
      const Type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[record.componentType];
      return new Type(bytes.buffer);
    };
    geometry=new THREE.BufferGeometry();
    for(const [gltf,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
      const record=PEDIMENT_RELIEF_DATA.attributes[gltf];
      geometry.setAttribute(name,new THREE.BufferAttribute(decode(record),record.itemSize));
    }
    geometry.setIndex(new THREE.BufferAttribute(decode(PEDIMENT_RELIEF_DATA.indices),1));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();reliefGeometryCache.set(THREE,geometry);
  }
  const mesh=new THREE.Mesh(geometry,materialFor(THREE,PEDIMENT_RELIEF_DATA));
  mesh.name='灰石盾形卷草_三角浅浮雕';mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={kind:'mounted_pediment_relief',asset:PEDIMENT_RELIEF_DATA.assetId,sourceTaskId:PEDIMENT_RELIEF_DATA.sourceTaskId};
  return mesh;
}

const hopperGeometryCache=new WeakMap();
export function createRainwaterHopper(THREE){
  let geometry=hopperGeometryCache.get(THREE);
  if(!geometry){
    const decode=record=>{
      const bytes=FAST_BYTES(record);
      const Type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[record.componentType];
      return new Type(bytes.buffer);
    };
    geometry=new THREE.BufferGeometry();
    for(const [gltf,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
      const record=RAINWATER_HOPPER_DATA.attributes[gltf];
      geometry.setAttribute(name,new THREE.BufferAttribute(decode(record),record.itemSize));
    }
    geometry.setIndex(new THREE.BufferAttribute(decode(RAINWATER_HOPPER_DATA.indices),1));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();hopperGeometryCache.set(THREE,geometry);
  }
  const mesh=new THREE.Mesh(geometry,materialFor(THREE,RAINWATER_HOPPER_DATA));
  mesh.name='白铁皮敞口雨水斗';mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={kind:'mounted_rainwater_hopper',asset:RAINWATER_HOPPER_DATA.assetId,sourceTaskId:RAINWATER_HOPPER_DATA.sourceTaskId,outletCentreLocal:RAINWATER_HOPPER_DATA.outletCentreLocal};
  return mesh;
}
