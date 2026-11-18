import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { ATTIC_STORAGE_DATA } from './attic-storage-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=ATTIC_STORAGE_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const transmission=s.extensions?.KHR_materials_transmission,Mat=transmission?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;const m=new Mat({...(transmission?{transmission:transmission.transmissionFactor||0,ior:s.extensions?.KHR_materials_ior?.ior||1.5}:{}),name:s.name+'_阁楼v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});m.userData={asset:d.assetId,atticStorageMaterial:i,atticStorageRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);m.emissiveIntensity=s.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};delete o.userData.windowRevision;if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={atticStorageRevision:1};m.castShadow=!(m.material.transmission>0);m.receiveShadow=!(m.material.transmission>0);o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,geometry,node,part:name=>{const g=new THREE.Group();g.name='阁楼_'+name;g.position.set(0,6.7,-5.4);g.userData={atticStorageRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

const ROOF_PLANES=[{axis:1,value:6.45,sign:1},{axis:2,value:-8.50,sign:1},{axis:2,value:-4.78,sign:-1}];
const WALL_PLANES=[{axis:2,value:-8.4,sign:1},{axis:2,value:-5.4,sign:-1}];
function joinGeometry(T,parts){
 if(parts.length===1)return parts[0];const out=new T.BufferGeometry();
 for(const [name,a]of Object.entries(parts[0].attributes)){const values=new a.array.constructor(parts.reduce((sum,g)=>sum+g.attributes[name].array.length,0));let n=0;for(const g of parts){values.set(g.attributes[name].array,n);n+=g.attributes[name].array.length;}out.setAttribute(name,new T.BufferAttribute(values,a.itemSize,a.normalized));}
 parts.forEach(g=>g.dispose());out.computeBoundingSphere();return out;
}
// Cut only the room's replacement volume. Instance tint is baked into colour
// attributes; all remaining geometry and surfaces outside the attic are kept.
function trimRegion(T,root,parent,planes,keepInside=false){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),targets=[];parent.traverse(o=>{if(o.isMesh)targets.push(o);});
 for(const o of targets){
  const matrix=inv.clone().multiply(o.matrixWorld),parts=[];let changed=false;
  const consume=(geometry,color)=>{const split=sliceGeometry(T,geometry,matrix,planes),keep=keepInside?split.inside:split.outside,drop=keepInside?split.outside:split.inside;if(drop){changed=true;drop.dispose();}if(!keep)return;
   if(o.isInstancedMesh&&o.instanceColor){const old=keep.attributes.color,a=new Float32Array(keep.attributes.position.count*3);for(let j=0;j<a.length/3;j++){a[j*3]=(old?old.getX(j):1)*color.r;a[j*3+1]=(old?old.getY(j):1)*color.g;a[j*3+2]=(old?old.getZ(j):1)*color.b;}keep.setAttribute('color',new T.BufferAttribute(a,3));}parts.push(keep);};
  if(o.isInstancedMesh){const m=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);if(o.instanceColor)o.getColorAt(i,color);const g=o.geometry.clone().applyMatrix4(m);consume(g,color);g.dispose();}}else consume(o.geometry,null);
  if(!changed){parts.forEach(g=>g.dispose());continue;}if(!parts.length){o.removeFromParent();continue;}
  const mat=o.isInstancedMesh&&o.instanceColor?o.material.clone():o.material;if(o.isInstancedMesh&&o.instanceColor)mat.vertexColors=true;
  const n=new T.Mesh(joinGeometry(T,parts),mat);n.name=o.name;n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.userData={...o.userData};n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;n.visible=o.visible;o.parent.add(n);o.removeFromParent();
 }
}
function prepareLighting(T,lighting){
 const emissive=[];lighting.traverse(o=>{if(o.name.includes('白瓷座壁灯'))o.userData.houseLampId='atticStorage';if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];o.material=mats.map(m=>{if(!m.name.includes('钨丝'))return m;const n=m.clone();n.emissive.set(0xffb95e);n.emissiveIntensity=0;emissive.push(n);return n;});if(!Array.isArray(o.material)||mats.length===1)o.material=o.material[0];if(mats.some(m=>/玻璃|钨丝|灯泡内部细支架/.test(m.name)))o.castShadow=false;});lighting.userData.houseLampId='atticStorage';return emissive;
}
function wireConnection(T,root){
 const group=new T.Group();group.name='阁楼_接入楼下既有壁灯线';group.userData.atticStorageRevision=1;
 const mat=new T.MeshStandardMaterial({name:'阁楼接线_旧米灰护套',color:0xa29987,roughness:.86});
 const points=[[3.838,6.15,-8.77],[3.838,6.40,-8.77],[3.838,6.40,-6.87],[3.93,6.40,-6.87],[3.93,6.54,-6.87]];
 for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),d=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(.0033,.0033,d.length(),10),mat);m.name='阁楼_连续供电支线_'+i;m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());group.add(m);}
 root.getObjectByName('L2_二楼').add(group);return points;
}


function removeConcealedSideFaces(T,root,level){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 for(const [name,x]of [['西_外墙',.24],['东_外墙',6.96]]){const parent=level.getObjectByName(name),targets=[];parent.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material))targets.push(o);});
 for(const o of targets){const matrix=inv.clone().multiply(o.matrixWorld),normalMatrix=new T.Matrix3().getNormalMatrix(matrix),split=sliceGeometry(T,o.geometry,matrix,[...WALL_PLANES,{axis:1,value:6.69999,sign:1},{axis:1,value:7.05001,sign:-1},{axis:0,value:x-.00001,sign:1},{axis:0,value:x+.00001,sign:-1}]);if(!split.inside){split.outside?.dispose();continue;}
 const g=split.inside,p=g.attributes.position,n=g.attributes.normal,v=new T.Vector3(),normal=new T.Vector3(),keep=[];let removed=0;
 for(let i=0;i<p.count;i+=3){let concealed=true;for(let k=0;k<3;k++){v.fromBufferAttribute(p,i+k).applyMatrix4(matrix);normal.fromBufferAttribute(n,i+k).applyMatrix3(normalMatrix);if(Math.abs(v.x-x)>.000002||Math.abs(normal.x)<.999)concealed=false;}if(concealed)removed++;else keep.push(i,i+1,i+2);}
 if(!removed){g.dispose();split.outside?.dispose();continue;}const rest=new T.BufferGeometry();for(const [key,a]of Object.entries(g.attributes)){const values=new Float32Array(keep.length*a.itemSize);let j=0;for(const i of keep)for(let k=0;k<a.itemSize;k++)values[j++]=a.array[i*a.itemSize+k];rest.setAttribute(key,new T.BufferAttribute(values,a.itemSize,a.normalized));}g.dispose();const pieces=[split.outside,keep.length?rest:null].filter(Boolean);if(!keep.length)rest.dispose();if(pieces.length)o.geometry=joinGeometry(T,pieces);else o.removeFromParent();audit.push({name:o.name,side:name,removed});}}
 return audit;
}

function finishSideWalls(T,root,level,c){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 for(const name of ['西_外墙','东_外墙']){const parent=level.getObjectByName(name);if(!parent)continue;const targets=[];parent.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!Array.isArray(o.material)&&/灰泥|plaster/.test(o.material.name))targets.push(o);});
 for(const o of targets){const matrix=inv.clone().multiply(o.matrixWorld),split=sliceGeometry(T,o.geometry,matrix,WALL_PLANES);if(!split.inside){split.outside?.dispose();continue;}
 // The accepted gable plaster starts at 6.91 m. Remove the old concealed
 // upper strip and its 7.05 m cap, which otherwise leaves a bright overlap seam.
 const base=sliceGeometry(T,split.inside,matrix,[{axis:1,value:6.91,sign:-1}]);split.inside.dispose();base.outside?.dispose();split.inside=base.inside;if(!split.inside)throw Error('阁楼墙脚范围异常');
 const g=split.inside,p=g.attributes.position,uv=new Float32Array(p.count*2),v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);uv[i*2]=(-v.z-5.4)/5.37;uv[i*2+1]=1-(v.y-6.7)/2.7;}g.setAttribute('uv',new T.BufferAttribute(uv,2));g.deleteAttribute('color');g.deleteAttribute('tangent');
 // Align the 4 mm old plaster skin to the accepted gable's room-facing plane.
 // Otherwise its thin top face remains visible as a bright horizontal ledge.
 g.applyMatrix4(matrix.clone().invert().multiply(new T.Matrix4().makeTranslation(name==='西_外墙'?-.004:.004,0,0)).multiply(matrix));
 const agedGeometry=o.name.startsWith('石灰墙面_顶点色渗痕')?null:g;if(!agedGeometry)g.dispose();
 for(const [geom,mat]of [[split.outside,o.material],[agedGeometry,c.material(ATTIC_STORAGE_DATA.surfaceSlots['阁梯间_旧灰泥_west'])]]){if(!geom)continue;const n=new T.Mesh(geom,mat);n.name=o.name+'_阁楼墙面';n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.castShadow=n.receiveShadow=true;o.parent.add(n);}audit.push(o.name);o.removeFromParent();}}
 return audit;
}

// The cached attic roof includes an old exterior gable and a plaster-coloured
// mortar core. Keep the live exterior masonry; retain the cached room-facing
// plaster and all approved roof/dormer geometry.
function exteriorGables(T,root,roof){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),saved=[],bases=[];
 function selectFaces(source,matrix,x,sign,keepExterior){
  const g=source.index?source.toNonIndexed():source,p=g.attributes.position,n=g.attributes.normal,nm=new T.Matrix3().getNormalMatrix(matrix),v=new T.Vector3(),normal=new T.Vector3(),keep=[];let removed=0;
  for(let i=0;i<p.count;i+=3){let exterior=true;for(let k=0;k<3;k++){v.fromBufferAttribute(p,i+k).applyMatrix4(matrix);normal.fromBufferAttribute(n,i+k).applyMatrix3(nm).normalize();if(Math.abs(v.x-x)>.00001||normal.x*sign<.999)exterior=false;}if(exterior===keepExterior)keep.push(i,i+1,i+2);else removed++;}
  if(!keep.length)return {geometry:null,removed};const out=new T.BufferGeometry();for(const[key,a]of Object.entries(g.attributes)){const data=new Float32Array(keep.length*a.itemSize);keep.forEach((i,j)=>{for(let k=0;k<a.itemSize;k++)data[j*a.itemSize+k]=a.getComponent(i,k);});out.setAttribute(key,new T.BufferAttribute(data,a.itemSize,a.normalized));}out.computeBoundingSphere();return {geometry:out,removed};
 }
 for(const [side,x,sign]of [['西',0,-1],['东',root.userData.dimensions.width,1]]){
  const edge=roof.getObjectByName(side+'_屋面边部'),brick=edge?.getObjectByName('三角山墙清水红砖'),core=edge?.getObjectByName('实心山墙');
  if(brick){saved.push({parent:brick.parent,brick});brick.removeFromParent();}
  if(core){const matrix=inv.clone().multiply(core.matrixWorld),split=sliceGeometry(T,core.geometry,matrix,ROOF_PLANES);split.outside?.dispose();if(split.inside){const selected=selectFaces(split.inside,matrix,x,sign,true);split.inside.dispose();if(selected.geometry){const m=new T.Mesh(selected.geometry,core.material);m.name=side+'_山墙_沿用墙身灰缝基面';m.position.copy(core.position);m.quaternion.copy(core.quaternion);m.scale.copy(core.scale);m.castShadow=core.castShadow;m.receiveShadow=core.receiveShadow;bases.push({parent:core.parent,mesh:m});}}}
 }
 return function restore(cached){
  for(const {parent,brick}of saved)parent.add(brick);for(const {parent,mesh}of bases)parent.add(mesh);
  const oldBricks=[];cached.traverse(o=>{if(o.name.startsWith('三角山墙清水红砖'))oldBricks.push(o);});oldBricks.forEach(o=>o.removeFromParent());
  root.updateMatrixWorld(true);let removed=0;const cores=[];cached.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==cached;p=p.parent)if(p.name.startsWith('实心山墙')){cores.push(o);break;}});
  for(const o of cores){const matrix=inv.clone().multiply(o.matrixWorld);let g=o.geometry;for(const[x,sign]of[[0,-1],[root.userData.dimensions.width,1]]){const selected=selectFaces(g,matrix,x,sign,false);removed+=selected.removed;if(g!==o.geometry)g.dispose();g=selected.geometry;if(!g)break;}if(g)o.geometry=g;else o.removeFromParent();}
  return {liveBrickFaces:saved.length,liveMortarPatches:bases.length,removedCachedBrickGroups:oldBricks.length,removedCachedExteriorTriangles:removed};
 };
}

export function installAtticStorage(T,root){if(!FAST_ENABLED("attic-storage"))return;
 const c=cache(T),level=root.getObjectByName('L3_局部阁楼'),roof=root.getObjectByName('ROOF_相交小青瓦屋盖');if(!level||!roof)throw Error('阁楼建筑结构缺失');
 const old=root.getObjectByName('局部阁楼_杉木楼板_独立梯口'),loft=c.part('loft');old.removeFromParent();level.add(loft);
 const furniture=c.part('furniture'),lighting=c.part('lighting');level.add(furniture,lighting);
 const oldDormers=[];roof.traverse(o=>{if(o.userData.kind==='v3-dormer')oldDormers.push(o);});oldDormers.forEach(o=>o.removeFromParent());
 const restoreExterior=exteriorGables(T,root,roof);trimRegion(T,root,roof,ROOF_PLANES);const roofPart=c.part('roof');roof.add(roofPart);const exteriorGableRepair=restoreExterior(roofPart);
 let dormer;roofPart.traverse(o=>{if(o.userData.kind==='v3-dormer')dormer=o;});if(!dormer)throw Error('阁楼老虎窗缺失');
 const opening=c.part('openWindow');root.updateMatrixWorld(true);roofPart.add(opening);opening.position.set(0,0,0);root.updateMatrixWorld(true);dormer.attach(opening);opening.visible=false;
 const partition=root.getObjectByName('阁层_中隔墙与低矮通口'),full=partition.getObjectByName('完整墙体'),low=partition.getObjectByName('剖切_阁层矮墙');
 trimRegion(T,root,full,WALL_PLANES);trimRegion(T,root,low,WALL_PLANES);
 const partitionFull=c.part('partition');full.add(partitionFull);partitionFull.traverse(o=>{if(o.name==='剖切_阁层矮墙')o.visible=false;});
 const partitionLow=partitionFull.clone(true);low.add(partitionLow);trimRegion(T,root,partitionLow,[{axis:1,value:7.4,sign:-1}],true);
 const concealedSideFaces=removeConcealedSideFaces(T,root,level),sideWallAudit=finishSideWalls(T,root,level,c),emissive=prepareLighting(T,lighting),wire=wireConnection(T,root),joints=[];furniture.traverse(part=>{if(part.userData.partId==='W02_前排低木箱')part.traverse(o=>{if(['storage_chest_lid','storage_chest_hasp'].includes(o.userData.kind))joints.push({o,rest:o.quaternion.clone()});});});
 installations.set(root,{loft,furniture,lighting,roofPart,partitionFull,partitionLow,opening,joints,emissive,c});
 root.userData.atticStorage={assetId:ATTIC_STORAGE_DATA.assetId,standaloneVisualAccepted:true,integratedVisualAccepted:false,origin:[0,6.7,-5.4],source:ATTIC_STORAGE_DATA.source,sideWallAudit,concealedSideFaces,exteriorGableRepair,sidePlasterTopM:6.91,sidePlasterFlushOffsetM:.004,wireConnection:wire,lamps:[[3.68,8.61,-7.27],[4.18,8.61,-7.27]],roofReplacementPlanes:ROOF_PLANES};
 root.userData.textureCount=(root.userData.textureCount||0)+ATTIC_STORAGE_DATA.images.length;
 const room=root.userData.rooms.find(r=>/阁楼|阁层/.test(r.name));if(room)room.use='已布置的低矮储物阁楼；旧箱包、书报、卷席和竹篮，保留梯口与通路';
}
export function setAtticStorageOpening(root,{windowsOpen=false,cabinetOpen=false,cut=false}={}){
 const v=installations.get(root);if(!v)return;v.roofPart.traverse(o=>{if(o.userData.windowVariant==='closed')o.visible=!windowsOpen;});v.opening.visible=windowsOpen;v.lighting.visible=!cut;
 for(const {o,rest}of v.joints){const a=o.userData.kind==='storage_chest_lid'?(o.userData.openingSign||-1)*(o.userData.openMaxRadians||Math.PI/2):(o.userData.unlatchedRadians||-Math.PI/2);o.quaternion.copy(rest).multiply(new o.quaternion.constructor().setFromAxisAngle({x:1,y:0,z:0},cabinetOpen?a:0));}
}
export function getAtticStorageLighting(T,root,on=false){
 const v=installations.get(root);if(!v)return [];for(const m of v.emissive)m.emissiveIntensity=on?6:0;let present=false;root.traverseVisible(o=>{if(o.userData.houseLampId==='atticStorage')present=true;});root.updateMatrixWorld(true);
 return [[3.68,8.61,-7.27],[4.18,8.61,-7.27]].map((p,i)=>({id:'atticStorage-'+i,lamp:'atticStorage'+(i?'East':'West'),position:root.localToWorld(new T.Vector3(...p)).toArray(),energy:24,color:'#ffbf77',present,visible:on&&present}));
}
export function createAtticStorageInspection(T,root,{roof=false,low=true}={}){
 const v=installations.get(root),out=new T.Group();out.name='阁楼_近景查看';if(!v)return out;
 for(const p of [v.loft,v.furniture,v.lighting,v.roofPart,low?v.partitionLow:v.partitionFull]){const q=p.clone(true);q.visible=p===v.lighting?!low:true;if(p===v.roofPart&&!roof){const keep=new Set();q.traverse(o=>{if(o.userData.kind==='v3-dormer')for(let a=o;a&&a!==q;a=a.parent)keep.add(a);});function mask(o){if(o.userData.kind==='v3-dormer')return;for(const ch of o.children){ch.visible=keep.has(ch);if(ch.visible)mask(ch);}}mask(q);}out.add(q);}
 const sides=v.c.part('inspectionSides');sides.visible=roof;out.add(sides);root.updateMatrixWorld(true);const skirtInv=root.matrixWorld.clone().invert();root.traverse(o=>{if(o.userData.houseSkirtingRevision&&!o.userData.cutRepresentation&&['储藏阁楼西侧','储藏阁楼东侧'].includes(o.userData.skirtingRoom)){const q=o.clone(false);skirtInv.clone().multiply(o.matrixWorld).decompose(q.position,q.quaternion,q.scale);q.visible=roof;out.add(q);}});const stair=root.getObjectByName('V3_中厢独立上阁木梯');if(stair){const q=stair.clone(true);root.updateMatrixWorld(true);root.matrixWorld.clone().invert().multiply(stair.matrixWorld).decompose(q.position,q.quaternion,q.scale);out.add(q);}return out;
}
