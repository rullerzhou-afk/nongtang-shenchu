import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { BRASS_RING_DATA } from './brass-ring-data.js';

// One geometry and material are shared by all door instances.
const cache=new WeakMap();
const decode=s=>FAST_BYTES(s);
function array(record){
  const bytes=decode(record);
  const Type={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[record.componentType];
  return new Type(bytes.buffer);
}
export function createBrassRing(THREE){
  let shared=cache.get(THREE);
  if(!shared){
    const geometry=new THREE.BufferGeometry();
    for(const [gltf,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
      const record=BRASS_RING_DATA.attributes[gltf];
      geometry.setAttribute(name,new THREE.BufferAttribute(array(record),record.itemSize));
    }
    geometry.setIndex(new THREE.BufferAttribute(array(BRASS_RING_DATA.indices),1));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({name:'MAT_BRASS_RING_LUX3D',color:0xffffff,roughness:1,metalness:1,vertexColors:true});
    material.userData={asset:'brass-ring-fitted-v2',sourceTaskId:'4896612',textureCount:2};
    // Node exports geometry first, then embeds the original image bytes directly.
    if(typeof document!=='undefined'){
      const loader=new THREE.TextureLoader();
      const textures=BRASS_RING_DATA.images.map((image,index)=>{
        const texture=loader.load(new URL(image.url,import.meta.url).href,()=>window.dispatchEvent(new Event('shikumen-asset-ready')));
        texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        if(index===BRASS_RING_DATA.textures[BRASS_RING_DATA.material.pbrMetallicRoughness.baseColorTexture.index].source)texture.colorSpace=THREE.SRGBColorSpace;
        return texture;
      });
      const pbr=BRASS_RING_DATA.material.pbrMetallicRoughness;
      material.map=textures[BRASS_RING_DATA.textures[pbr.baseColorTexture.index].source];
      material.roughnessMap=material.metalnessMap=textures[BRASS_RING_DATA.textures[pbr.metallicRoughnessTexture.index].source];
    }
    shared={geometry,material};cache.set(THREE,shared);
  }
  const mesh=new THREE.Mesh(shared.geometry,shared.material);
  mesh.name='铜门环_贴门底座_140mm';mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={kind:'mounted_brass_ring',sourceTaskId:'4896612',heightMetres:.14,basePlateDepthMetres:.006,mountingPlane:'local Z=0'};
  return mesh;
}
