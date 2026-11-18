import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { COURTYARD_DATA } from './courtyard-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=COURTYARD_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const m=new THREE.MeshStandardMaterial({name:s.name+'_前天井v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??0,vertexColors:colored});m.userData={asset:d.assetId,courtyardMaterial:i,courtyardRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={courtyardRevision:1};m.castShadow=true;m.receiveShadow=true;o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,plant:id=>{const n=d.parts.courtyard.find(n=>n.extras?.partId===id);if(!n||!['CY01','CY02'].includes(id))throw new Error('Unknown courtyard plant: '+id);return node(n);},part:name=>{const g=new THREE.Group();g.name='前天井_'+name;g.position.set(0,0,0);g.userData={courtyardRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

// Reuse the approved complete plant and clay pot without altering B1 or its shared resources.
export function createCourtyardPlant(THREE,{id,source='CY01',height,width,angle=0,owner}){
 const plant=cache(THREE).plant(source);plant.position.set(0,0,0);plant.rotation.set(0,angle,0);
 plant.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(plant),size=bounds.getSize(new THREE.Vector3());
 const horizontal=width/Math.max(size.x,size.z);plant.scale.set(horizontal,height/size.y,horizontal);
 plant.updateMatrixWorld(true);bounds.setFromObject(plant);const center=bounds.getCenter(new THREE.Vector3());
 plant.position.set(-center.x,-bounds.min.y,-center.z);
 const root=new THREE.Group();root.name='街区盆栽_'+id;root.add(plant);
 root.userData={kind:'block_potted_plant',id,owner,sourcePart:source,sourceAsset:COURTYARD_DATA.assetId,heightMetres:height,maxCrownWidthMetres:width,reusedApprovedAsset:true,newGenerationCost:0};
 return root;
}

export function sliceGeometry(THREE,source,toRoot,planes){
 // 结果与改前逐字节相同：完全在所有切面内侧、或在第一张起作用的切面外侧的三角形，直接按原顺序拷数值；
 // 只有真正被切开的三角形才走原来的逐顶点插值。改前每个顶点都新建数组，阁楼和阁楼储藏切几百个构件时要好几秒。
 const g=source.index?source.toNonIndexed():source,attrs=Object.entries(g.attributes).filter(([,a])=>!a.isInterleavedBufferAttribute),inside={},outside={};for(const[k]of attrs){inside[k]=[];outside[k]=[];}
 const q=new THREE.Vector3(),groupLists=new Map([[inside,[]],[outside,[]]]);let activeMaterial=0;
 const comp=(v,i,j)=>v.normalized?v.getComponent(i,j):v.array[i*v.itemSize+j];
 function vertex(i){const a={};for(const[k,v]of attrs)a[k]=Array.from({length:v.itemSize},(_,j)=>v.getComponent(i,j));a.root=q.fromArray(a.position).applyMatrix4(toRoot).toArray();return a;}
 function interpolate(a,b,t){const r={};for(const[k,v]of Object.entries(a))r[k]=v.map((n,i)=>n+(b[k][i]-n)*t);return r;}
 function clip(poly,p,keep){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=p.sign*(a.root[p.axis]-p.value),db=p.sign*(b.root[p.axis]-p.value),ia=keep?da>=-1e-6:da<=1e-6,ib=keep?db>=-1e-6:db<=1e-6;if(ia)out.push(a);if(ia!==ib)out.push(interpolate(a,b,da/(da-db)));}return out;}
 function group(dest,start,count){if(count&&source.groups.length){const groups=groupLists.get(dest),last=groups[groups.length-1];if(last&&last.materialIndex===activeMaterial&&last.start+last.count===start)last.count+=count;else groups.push({start,count,materialIndex:activeMaterial});}}
 function append(poly,dest){const start=dest.position.length/3;for(let i=1;i<poly.length-1;i++)for(const v of[poly[0],poly[i],poly[i+1]])for(const[k]of attrs)dest[k].push(...v[k]);group(dest,start,dest.position.length/3-start);}
 function copyTriangle(i,dest){const start=dest.position.length/3;for(let n=i;n<i+3;n++)for(const[k,v]of attrs){const d=dest[k];for(let j=0;j<v.itemSize;j++)d.push(comp(v,n,j));}group(dest,start,dest.position.length/3-start);}
 const pos=g.attributes.position,r=[[0,0,0],[0,0,0],[0,0,0]];
 function slow(i){let poly=[vertex(i),vertex(i+1),vertex(i+2)];for(const p of planes){if(!poly.length)break;const d=poly.map(v=>p.sign*(v.root[p.axis]-p.value));if(d.every(n=>n>=-1e-6))continue;if(d.every(n=>n< -1e-6)){append(poly,outside);poly=[];break;}append(clip(poly,p,false),outside);poly=clip(poly,p,true);}append(poly,inside);}
 for(let i=0;i<pos.count;i+=3){
  activeMaterial=g.groups.find(v=>i>=v.start&&i<v.start+v.count)?.materialIndex||0;
  for(let n=0;n<3;n++){q.set(comp(pos,i+n,0),comp(pos,i+n,1),comp(pos,i+n,2)).applyMatrix4(toRoot);r[n][0]=q.x;r[n][1]=q.y;r[n][2]=q.z;}
  let fate='inside';
  for(const p of planes){const d0=p.sign*(r[0][p.axis]-p.value),d1=p.sign*(r[1][p.axis]-p.value),d2=p.sign*(r[2][p.axis]-p.value);
   if(d0>=-1e-6&&d1>=-1e-6&&d2>=-1e-6)continue;
   fate=d0< -1e-6&&d1< -1e-6&&d2< -1e-6?'outside':'cut';break;}
  if(fate==='inside')copyTriangle(i,inside);else if(fate==='outside')copyTriangle(i,outside);else slow(i);
 }
 function result(a){if(!a.position.length)return null;const o=new THREE.BufferGeometry();for(const[k,v]of attrs)o.setAttribute(k,new THREE.BufferAttribute(new Float32Array(a[k]),v.itemSize,v.normalized));o.groups=groupLists.get(a);o.computeBoundingSphere();return o;}
 return {inside:result(inside),outside:result(outside)};
}

export function installCourtyard(THREE,root){if(!FAST_ENABLED("courtyard"))return;
 const c=cache(THREE),yard=root.getObjectByName('前天井');
 for(const name of ['露天前井_青石地','前天井线性排水'])root.getObjectByName(name)?.removeFromParent();
 const props=c.part('courtyard');yard.add(props);root.userData.courtyard={revision:2,assetId:COURTYARD_DATA.assetId,generatedAssets:6,userVisualAccepted:false,clearSize:[3.6,2.76],northFloorY:.025,drainTopY:.005,rackProjectionReductionM:.12};
 root.userData.textureCount=(root.userData.textureCount||0)+COURTYARD_DATA.images.length;
}
export function createCourtyardInspection(THREE,root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),out=new THREE.Group();out.name='前天井查看建筑';out.userData={courtyardInspection:true};
 function clone(o,planes){
  if(!o?.visible)return null;let c;
  if(!planes.length){c=o.clone(false);if(o.geometry)c.geometry=o.geometry.clone();for(const ch of o.children){const a=clone(ch,planes);if(a)c.add(a);}return c;}
  if(o.isInstancedMesh){c=new THREE.Group();const im=new THREE.Matrix4(),col=new THREE.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const g=o.geometry.clone().applyMatrix4(im),t=inv.clone().multiply(o.matrixWorld),part=sliceGeometry(THREE,g,t,planes).inside;g.dispose();if(!part)continue;const mat=o.material.clone();if(o.instanceColor){o.getColorAt(i,col);mat.color.multiply(col);}const ch=new THREE.Mesh(part,mat);ch.name=o.name+'_'+i;ch.castShadow=ch.receiveShadow=true;c.add(ch);}}
  else if(o.isMesh){const t=inv.clone().multiply(o.matrixWorld),g=sliceGeometry(THREE,o.geometry,t,planes).inside;if(!g)return null;c=new THREE.Mesh(g,o.material);c.castShadow=o.castShadow;c.receiveShadow=o.receiveShadow;}
  else c=new THREE.Group();c.name=o.name;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);c.userData={...o.userData,courtyardInspection:true};for(const ch of o.children){const a=clone(ch,planes);if(a)c.add(a);}return c;
 }
 const capped=new Set();
 const sides=[['south',root.getObjectByName('南_前围墙')],['floor',root.getObjectByName('石库门门槛')],['west',root.getObjectByName('西_天井围墙')],['north',root.getObjectByName('南_客堂木立面')],['east',root.getObjectByName('中隔墙_一楼')],['pipe',root.getObjectByName('前檐_分层雨水管')],['props',root.getObjectByName('前天井_courtyard')]];
 root.getObjectByName('东侧厢房').children.filter(o=>o.name==='中隔墙_露天一侧红砖饰层').forEach(o=>sides.push(['east',o]));
 for(const [side,original]of sides){
  // Open hall leaves extend north of the courtyard wall into the hall.
  const planes=side==='props'?[]:[{axis:2,value:side==='north'?-3.80:-3.24,sign:1},{axis:2,value:.30,sign:-1},{axis:1,value:3.40,sign:-1}];
  const g=clone(original,planes);if(!g)continue;inv.clone().multiply(original.matrixWorld).decompose(g.position,g.quaternion,g.scale);g.userData.courtyardSide=side;out.add(g);
  if(['north','south','west','east'].includes(side)&&!capped.has(side)){
   capped.add(side);
   const capMat=new THREE.MeshStandardMaterial({name:'天井查看_剖面封口',color:0xafa18b,roughness:.96});
   const caps=side==='west'?[[[.12,3.4,-1.62],[.24,.002,2.76]]]:side==='east'?[[[3.93,3.4,-1.62],[.18,.002,2.76]]]:side==='north'?[[[2.04,3.4,-3.12],[3.6,.002,.24]]]:[[[2.01,3.4,-.12],[4.02,.002,.24]]];
   for(const [position,size]of caps){const cap=new THREE.Mesh(new THREE.BoxGeometry(...size),capMat);cap.name='天井查看剖面封口';cap.position.fromArray(position);cap.userData={courtyardSide:side,courtyardInspection:true};out.add(cap);}
  }
 }
 return out;
}
