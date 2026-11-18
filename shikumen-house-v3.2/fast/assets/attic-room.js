import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { installAtticStairStyle, projectStairwellWallUV } from './stairwell.js';
import { ATTIC_ROOM_DATA } from './attic-room-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=ATTIC_ROOM_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const transmission=s.extensions?.KHR_materials_transmission,Mat=transmission?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Mat({...(transmission?{transmission:transmission.transmissionFactor||0,ior:s.extensions?.KHR_materials_ior?.ior||1.5}:{}),name:s.name+'_阁梯间v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});m.userData={asset:d.assetId,atticRoomMaterial:i,atticRoomRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);m.emissiveIntensity=s.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={atticRoomRevision:1};m.castShadow=!(m.material.transmission>0);m.receiveShadow=!(m.material.transmission>0);o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,geometry,node,part:name=>{const g=new THREE.Group();g.name='阁梯间_'+name;g.position.set(4.02,4,-5.28);g.userData={atticRoomRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

const ROOM_PARTS=[['floor','二楼_东厢连续木楼板_共用廊与三间'],['floor','二楼_主开间木楼板_横向梯井'],['east','东_厢房承重墙_二楼'],['west','中隔墙_二楼'],['south','前厢_二楼分隔'],['north','后厢_二楼北移分隔'],['stair','V3_中厢独立上阁木梯'],['loft','局部阁楼_杉木楼板_独立梯口']];
const roomPlanes=[{axis:0,value:3.82,sign:1},{axis:0,value:7.22,sign:-1},{axis:2,value:-10.78,sign:1},{axis:2,value:-5.16,sign:-1},{axis:1,value:3.72,sign:1},{axis:1,value:8,sign:-1}];
function isOpening(o){return o.userData.kind==='window'&&o.name==='东厢二层_临主弄木窗'||o.name==='后厢二层_共用廊门';}
function surfaceUV(T,g,matrix,kind,side){
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2),v=new T.Vector3(),normal=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(matrix);
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(nm);const x=v.x-4.02,y=-v.z-5.28,z=v.y-4;let u,w;
  if(kind==='floor'){if(Math.abs(normal.y)>.7){u=x/2.94;w=y/5.37;}else if(Math.abs(normal.x)>.7){u=z/2.94;w=y/5.37;}else{u=x/2.94;w=z/5.37;}}
  else{u=['east','west'].includes(side)?y/5.37:x/2.94;w=z/2.7;}
  uv[i*2]=u;uv[i*2+1]=1-w;
 }
 g.setAttribute('uv',new T.BufferAttribute(uv,2));g.deleteAttribute('color');g.deleteAttribute('tangent');
}
function ageArchitecture(T,root,c){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),offset=new T.Matrix4().makeTranslation(4.02,4,-5.28),audit=[];
 const templates=ATTIC_ROOM_DATA.woodTemplates.map(t=>{const matrix=offset.clone().multiply(new T.Matrix4().fromArray(t.matrix)),g=c.geometry(t.primitives[0].geometry);g.computeBoundingBox();return {t,matrix,bounds:g.boundingBox.clone().applyMatrix4(matrix)};});
 for(const[side,name]of ROOM_PARTS){
  const parent=root.getObjectByName(name);if(!parent)throw Error('阁梯间结构缺失: '+name);const list=[];
  parent.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material))list.push(o);});
  for(const o of list){
   const materialName=o.material.name;let kind=null,slot;
   if(materialName.includes('灰泥')||materialName.includes('plaster')){kind='wall';slot='阁梯间_旧灰泥_'+side;}
   else if(/floor-wood|楼板_旧杉木板/.test(materialName)){kind=side==='floor'?'floor':'wood';slot=kind==='floor'?'阁梯间_夫妻婚房同款杉木地板':'阁梯间_深棕旧木';}
   else if(/木构_旧深褐漆|aged_dark_wood|joinery-wood|door-vertical|door-horizontal|木构_磨损露木/.test(materialName)){kind='wood';slot=o.name.includes('扶手')?'阁梯间_磨润木扶手':['north','south','east','west'].includes(side)?'阁梯间_深棕窗门木':'阁梯间_深棕旧木';}
   if(!kind||ATTIC_ROOM_DATA.surfaceSlots[slot]===undefined)continue;
   let opening=false;for(let a=o;a&&a!==parent;a=a.parent)if(isOpening(a)){const pos=new T.Vector3().setFromMatrixPosition(inverse.clone().multiply(a.matrixWorld));if(pos.z>-10.8&&pos.z<-5.2)opening=true;}
   const world=inverse.clone().multiply(o.matrixWorld);
   let planes=opening||side==='stair'?[]:roomPlanes;
   if(kind==='wall')planes=[{axis:0,value:4.019,sign:1},{axis:0,value:6.961,sign:-1},{axis:2,value:-10.651,sign:1},{axis:2,value:-5.279,sign:-1},{axis:1,value:3.999,sign:1},{axis:1,value:6.701,sign:-1}];
   // Carry the existing floor finish through the wall depth at both entries.
   // The north edge meets the child's floor exactly; the main slab contributes
   // only its narrow western doorway strip, leaving the finished corridor intact.
   if(kind==='floor')planes=name==='二楼_主开间木楼板_横向梯井'
    ?[{axis:0,value:3.84,sign:1},{axis:0,value:3.96,sign:-1},{axis:2,value:-10.50,sign:1},{axis:2,value:-9.65,sign:-1},{axis:1,value:3.839,sign:1},{axis:1,value:4.001,sign:-1}]
    :[{axis:0,value:3.96,sign:1},{axis:0,value:6.961,sign:-1},{axis:2,value:-10.769,sign:1},{axis:2,value:-5.279,sign:-1},{axis:1,value:3.839,sign:1},{axis:1,value:4.001,sign:-1}];
   const pieces=[];let altered=false;
   function consume(g,tint){
    const split=sliceGeometry(T,g,world,planes);if(split.outside){const m=tint?o.material.clone():o.material;if(tint)m.color.multiply(tint);pieces.push([split.outside,m,false]);}
    if(!split.inside)return;altered=true;let geometry=split.inside;
    if(kind==='wood'){
     geometry.computeBoundingBox();const b=geometry.boundingBox.clone().applyMatrix4(world),cent=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());
     const matches=templates.map(t=>({t,error:cent.distanceTo(t.bounds.getCenter(new T.Vector3()))+size.distanceTo(t.bounds.getSize(new T.Vector3()))})).sort((a,b)=>a.error-b.error);const chosen=matches[0];
     if(!chosen||chosen.error>.0001)throw Error('阁梯间木作模板不匹配: '+o.name+' '+chosen?.error);
     geometry.dispose();geometry=c.geometry(chosen.t.t.primitives[0].geometry).clone().applyMatrix4(world.clone().invert().multiply(chosen.t.matrix));slot=ATTIC_ROOM_DATA.materials[chosen.t.t.primitives[0].material].name;
    }else surfaceUV(T,geometry,world,kind,side);
    // The former vertex-tinted grime skin is replaced by the room's approved PBR wall.
    if(kind==='wall'&&o.name.startsWith('石灰墙面_顶点色渗痕'))geometry.dispose();else pieces.push([geometry,c.material(ATTIC_ROOM_DATA.surfaceSlots[slot]),true]);
   }
   if(o.isInstancedMesh){const m=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(o.instanceColor)o.getColorAt(i,color);const g=o.geometry.clone().applyMatrix4(m);consume(g,o.instanceColor?color.clone():null);g.dispose();}}else consume(o.geometry,null);
   if(!altered){for(const[g]of pieces)g.dispose();continue;}
   for(const[g,m,aged]of pieces){const mesh=new T.Mesh(g,m);mesh.name=o.name+(aged?'_阁梯间饰面':'_阁梯间范围外保留');mesh.position.copy(o.position);mesh.quaternion.copy(o.quaternion);mesh.scale.copy(o.scale);mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;mesh.userData={...o.userData,...(aged?{atticRoomRevision:1,atticRoomSurface:side}:{})};o.parent.add(mesh);}
   o.removeFromParent();audit.push({side,name:o.name,kind,pieces:pieces.length});
  }
 }
 return audit;
}
// The shared landing is outside both room finish masks. Finish only its two
// wall-facing sides, continuing the adjacent stairwell plaster and its UVs.
export function finishSharedCorridor(T,root){
 if(!root.userData.atticRoom||root.userData.corridorWallFinish)return;
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),audit=[];
 const region=[{axis:2,value:-10.50,sign:1},{axis:2,value:-6.42,sign:-1},{axis:1,value:4,sign:1},{axis:1,value:6.70,sign:-1}];
 let material;root.getObjectByName('中隔墙_二楼').traverse(o=>{if(o.material?.name==='楼梯间_plaster-east')material=o.material;});
 if(!material)throw Error('二楼共用廊缺少相邻楼梯墙面材质');
 for(const name of ['中隔墙_二楼','后楼小间_轻隔墙']){
  const west=name==='后楼小间_轻隔墙',faceX=west?2.94:3.84;
  // Include exposed returns, stopping at the existing room-side finish mask.
  const planes=[...region,{axis:0,value:west?2.821:3.837,sign:1},{axis:0,value:west?2.943:4.019,sign:-1}];
  const wall=root.getObjectByName(name),items=[];
  wall.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name==='内墙_旧石灰灰泥')items.push(o);});
  for(const o of items){
   const matrix=inverse.clone().multiply(o.matrixWorld),part=sliceGeometry(T,o.geometry,matrix,planes);if(!part.inside){part.outside?.dispose();continue;}
   const oldGrime=o.name.startsWith('石灰墙面_顶点色渗痕');
   if(oldGrime)part.inside.dispose();
   else{
    projectStairwellWallUV(T,part.inside,matrix,faceX);
    const face=new T.Mesh(part.inside,material);face.name=o.name+'_二楼共用廊连续灰泥';face.position.copy(o.position);face.quaternion.copy(o.quaternion);face.scale.copy(o.scale);face.castShadow=o.castShadow;face.receiveShadow=o.receiveShadow;face.userData={...o.userData,corridorWallRevision:'20261116'};o.parent.add(face);
   }
   if(part.outside)o.geometry=part.outside;else o.removeFromParent();
   audit.push({wall:name,original:o.name,oldGrimeRemoved:oldGrime});
  }
 }
 root.userData.corridorWallFinish={revision:'20261116',material:material.name,audit};
}
// Remove only concealed coplanar contact faces, exposed by the full-house export.
// The first-floor partition cap coincides with the upper plank tops; the loft
// slab's west edge coincides with the finished room-side partition plane.
function repairAtticRoomJoints(T,root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 const cases=[{parent:root.getObjectByName('L0_一楼'),axis:1,value:4,normal:1,planes:[{axis:0,value:4.02,sign:1},{axis:0,value:6.96,sign:-1},{axis:2,value:-10.65,sign:1},{axis:2,value:-5.28,sign:-1}]},
 {parent:root.getObjectByName('东_厢房承重墙_二楼'),axis:1,value:6.7,normal:1,planes:[{axis:0,value:6.959,sign:1},{axis:0,value:7.081,sign:-1},{axis:2,value:-8.40,sign:1},{axis:2,value:-5.40,sign:-1}]},
 {parent:root.getObjectByName('局部阁楼_杉木楼板_独立梯口'),axis:0,value:4.02,normal:0,planes:[{axis:1,value:6.53,sign:1},{axis:1,value:6.701,sign:-1},{axis:2,value:-8.4,sign:1},{axis:2,value:-5.4,sign:-1}]}];
 for(const c of cases){const targets=[];c.parent.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&(c.axis===0||o.material.name.includes('灰泥')))targets.push(o);});
  for(const o of targets){const transform=inv.clone().multiply(o.matrixWorld),nm=new T.Matrix3().getNormalMatrix(transform),split=sliceGeometry(T,o.geometry,transform,[...c.planes,{axis:c.axis,value:c.value-.00001,sign:1},{axis:c.axis,value:c.value+.00001,sign:-1}]);if(!split.inside){split.outside?.dispose();continue;}
   const g=split.inside,p=g.attributes.position,n=g.attributes.normal,keep=[],point=new T.Vector3(),normal=new T.Vector3();let removed=0;
   for(let i=0;i<p.count;i+=3){let flat=true;for(let k=0;k<3;k++){point.fromBufferAttribute(p,i+k).applyMatrix4(transform);normal.fromBufferAttribute(n,i+k).applyMatrix3(nm);if(Math.abs(point.getComponent(c.axis)-c.value)>.000002||Math.abs(normal.getComponent(c.normal))<.999)flat=false;}if(flat)removed++;else keep.push(i,i+1,i+2);}
   if(!removed){g.dispose();split.outside?.dispose();continue;}
   const output=new T.BufferGeometry();for(const[name,a]of Object.entries(g.attributes)){const other=split.outside?.attributes[name],arr=new Float32Array((keep.length+(other?.count||0))*a.itemSize);let offset=0;for(const i of keep)for(let k=0;k<a.itemSize;k++)arr[offset++]=a.array[i*a.itemSize+k];if(other)arr.set(other.array,offset);output.setAttribute(name,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
   output.computeBoundingSphere();o.geometry=output;o.userData={...o.userData,atticRoomJointCorrection:'20261113-concealed-coplanar-faces'};g.dispose();split.outside?.dispose();audit.push({name:o.name,parent:c.parent.name,removedTriangles:removed,plane:[c.axis,c.value]});
  }
 }
 return audit;
}

function installRoomLamp(T,root,furniture){
 const source=root.getObjectByName('L3_墙灯');if(!source)throw Error('已确认楼梯间壁灯缺失');
 const service=new T.Group();service.name='阁梯间_壁灯明线与拉线开关';service.position.set(-4.02,-4,5.28);furniture.add(service);
 const fixture=source.clone(true),emissive=[];fixture.name='阁梯间_白瓷座透明钨丝壁灯';fixture.position.set(6.958,6.23,-7.96);
 fixture.traverse(o=>{delete o.userData.stairwellLampId;delete o.userData.stairwellMountedWall;if(!o.isMesh)return;const old=Array.isArray(o.material)?o.material:[o.material],next=old.map(m=>{if(!m.name.includes('钨丝'))return m;const n=m.clone();emissive.push(n);return n;});o.material=Array.isArray(o.material)?next:next[0];if(next.some(m=>m.transmission>0||/玻璃|钨丝|支架/.test(m.name)))o.castShadow=false;});
 fixture.userData={...fixture.userData,houseLampId:'atticRoom',atticMountedWall:'east',atticRoomLampRevision:1,reusedFixture:'L3_墙灯'};service.add(fixture);
 const wire=new T.MeshStandardMaterial({name:'阁梯间_米灰明线护套',color:0x9e9787,roughness:.86}),clip=new T.MeshStandardMaterial({name:'阁梯间_浅色明线卡',color:0xb7af9c,roughness:.82}),porcelain=new T.MeshStandardMaterial({name:'阁梯间_旧白瓷拉线开关',color:0xd9d4c7,roughness:.34}),cord=new T.MeshStandardMaterial({name:'阁梯间_棉质拉绳',color:0xa49a84,roughness:1}),bakelite=new T.MeshStandardMaterial({name:'阁梯间_拉绳胶木坠',color:0x37261b,roughness:.55});
 const part=(name,geometry,material,pos,wall)=>{const m=new T.Mesh(geometry,material);m.name=name;m.position.fromArray(pos);m.castShadow=m.receiveShadow=true;m.userData={atticRoomLampRevision:1,atticMountedWall:wall};service.add(m);return m;};
 const rod=(name,a,b,radius,material,wall)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),m=part(name,new T.CylinderGeometry(radius,radius,delta.length(),12),material,av.clone().add(bv).multiplyScalar(.5).toArray(),wall);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;};
 // Connect to the existing upstairs stair-light branch through its shared wall,
 // then stay on wall faces above the door and beside the window. No loose end.
 const paths=[{wall:'west',p:[[3.838,6.15,-8.77],[4.03,6.15,-8.77],[4.03,6.40,-8.77],[4.03,6.40,-10.64]]},{wall:'north',p:[[4.03,6.40,-10.64],[6.77,6.40,-10.64]]},{wall:'north',p:[[6.77,6.40,-10.64],[6.77,6.23,-10.64]]},{wall:'north',p:[[6.77,6.23,-10.64],[6.949,6.23,-10.64]]},{wall:'east',p:[[6.949,6.23,-10.64],[6.949,6.23,-7.96],[6.932,6.23,-7.96]]}];
 const wallSleeve=rod('阁梯间_共用墙穿线瓷套管',[3.838,6.15,-8.77],[4.034,6.15,-8.77],.009,porcelain,'west');wallSleeve.userData.connection='existing L3 lamp branch';
 for(const [pi,path]of paths.entries())for(let i=1;i<path.p.length;i++){const a=path.p[i-1],b=path.p[i];rod('阁梯间_连续明线_'+pi+'_'+i,a,b,.0033,wire,path.wall);const d=new T.Vector3(...b).sub(new T.Vector3(...a)),count=Math.ceil(d.length()/.40);for(let j=1;j<count;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/count),vertical=Math.abs(d.y)>.01,size=path.wall==='north'?(vertical?[.016,.009,.013]:[.009,.016,.013]):(vertical?[.013,.009,.016]:[.013,.016,.009]);part('阁梯间_明线固定卡',new T.BoxGeometry(...size),clip,p,path.wall);}}
 const sw=part('阁梯间_门边瓷拉线开关',new T.CylinderGeometry(.031,.034,.026,32),porcelain,[6.77,6.23,-10.629],'north');sw.rotation.x=Math.PI/2;
 rod('阁梯间_开关下垂棉绳',[6.77,6.207,-10.61],[6.77,5.33,-10.61],.0018,cord,'north');
 part('阁梯间_拉线胶木坠',new T.SphereGeometry(.012,12,8),bakelite,[6.77,5.318,-10.61],'north').scale.set(.75,1.3,.75);
 return {emissive,position:[6.842,6.23,-7.96],energy:32,color:'#ffc080',fixturePosition:fixture.position.toArray(),wirePaths:paths,sourceFixture:'L3_墙灯',switchPosition:[6.77,6.23,-10.629],pullCordEnd:[6.77,5.318,-10.61]};
}
export function installAtticRoom(T,root){if(!FAST_ENABLED("attic-room"))return;
 const c=cache(T),furniture=c.part('furniture');root.getObjectByName('L2_二楼').add(furniture);const materialAudit=ageArchitecture(T,root,c),jointCorrection=repairAtticRoomJoints(T,root),stairStyle=installAtticStairStyle(T,root),lamp=installRoomLamp(T,root,furniture);installations.set(root,{furniture,lamp});
 const {emissive,...lampInfo}=lamp;
 root.userData.atticRoom={assetId:ATTIC_ROOM_DATA.assetId,revision:2,independentRoomAccepted:true,integratedVisualAccepted:true,lampStairVisualAccepted:false,origin:[4.02,4,-5.28],materialAudit,jointCorrection,stairStyle,lamp:lampInfo,ironUnplugged:true,powerStrip:false};
 root.userData.textureCount=(root.userData.textureCount||0)+ATTIC_ROOM_DATA.images.length;
 const room=root.userData.rooms.find(r=>r.name==='共用上阁间');if(room){room.name='阁梯间兼衣物整理角';room.use='通往局部阁楼，兼衣物整理与临时熨烫；熨斗未接电';}
}
export function getAtticRoomLighting(T,root,on=false){
 const lamp=installations.get(root)?.lamp;if(!lamp)return [];
 for(const m of lamp.emissive)m.emissiveIntensity=on?1.8:0;
 let present=false;root.traverseVisible(o=>{if(o.userData.houseLampId==='atticRoom')present=true;});root.updateMatrixWorld(true);
 return [{id:'atticRoom-main',lamp:'atticRoom',position:root.localToWorld(new T.Vector3(...lamp.position)).toArray(),energy:lamp.energy,color:lamp.color,present,visible:on&&present}];
}
export function setAtticCabinetOpening(root,degrees=0){const f=installations.get(root)?.furniture;if(!f)return;const a=Math.max(0,Math.min(90,degrees))*Math.PI/180;f.traverse(o=>{if(o.userData.kind==='attic_cabinet_leaf')o.rotation.y=o.userData.openingSign*a;});root.updateMatrixWorld(true);}
export function createAtticRoomInspection(T,root,{reverse=false,full=false,landing=false}={}){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),out=new T.Group();out.name='阁梯间查看建筑';
 function clone(o,planes){if(!o?.visible)return null;if(isOpening(o)){const z=new T.Vector3().setFromMatrixPosition(inv.clone().multiply(o.matrixWorld)).z;if(z>-10.8&&z<-5.2)planes=[];}let n;
  if(o.isInstancedMesh){n=new T.Group();const m=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const g=o.geometry.clone().applyMatrix4(m),s=sliceGeometry(T,g,inv.clone().multiply(o.matrixWorld),planes);g.dispose();s.outside?.dispose();if(!s.inside)continue;const mat=o.material.clone();if(o.instanceColor){o.getColorAt(i,color);mat.color.multiply(color);}const q=new T.Mesh(s.inside,mat);q.castShadow=q.receiveShadow=true;n.add(q);}}
  else if(o.isMesh){const s=sliceGeometry(T,o.geometry,inv.clone().multiply(o.matrixWorld),planes);s.outside?.dispose();if(!s.inside)return null;n=new T.Mesh(s.inside,o.material);n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;}else n=new T.Group();
  n.name=o.name;n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.userData={...o.userData,atticRoomInspection:true};for(const ch of o.children){const q=clone(ch,planes);if(q)n.add(q);}return n;
 }
 const hidden=full?[]:reverse?['north','east']:['south','west'];
 for(const[side,name]of ROOM_PARTS){if(!full&&!landing&&side==='loft'||hidden.includes(side))continue;const original=root.getObjectByName(name),q=clone(original,side==='stair'?[]:side==='loft'&&!full?[...roomPlanes,{axis:0,value:4.021,sign:1},{axis:0,value:6.959,sign:-1}]:roomPlanes);if(!q)continue;inv.clone().multiply(original.matrixWorld).decompose(q.position,q.quaternion,q.scale);q.userData.atticRoomSide=side;out.add(q);}
 const furniture=installations.get(root).furniture.clone(true);furniture.traverse(o=>{if(hidden.includes(o.userData.atticMountedWall))o.visible=false;});out.add(furniture);return out;
}
