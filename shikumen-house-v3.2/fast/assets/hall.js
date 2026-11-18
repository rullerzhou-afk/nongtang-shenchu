import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { HALL_DATA } from './hall-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=HALL_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const m=new THREE.MeshStandardMaterial({name:s.name+'_客堂v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??0,vertexColors:colored});m.userData={asset:d.assetId,hallMaterial:i,hallRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={hallRevision:1};m.castShadow=true;m.receiveShadow=true;o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,part:name=>{const g=new THREE.Group();g.name='客堂_'+name;g.position.set(.24,.1,-3.24);g.userData={hallRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}

// Split triangles at exact room boundaries, retaining all original attributes and
// the untouched polygons. This changes the finish, not the architectural outline.
function sliceGeometry(THREE,source,toRoot,planes){
 const g=source.index?source.toNonIndexed():source,attrs=Object.entries(g.attributes).filter(([,a])=>!a.isInterleavedBufferAttribute),inside={},outside={};for(const[k]of attrs){inside[k]=[];outside[k]=[];}
 const q=new THREE.Vector3();
 function vertex(i){const a={};for(const[k,v]of attrs)a[k]=Array.from(v.array.slice(i*v.itemSize,(i+1)*v.itemSize));a.root=q.fromArray(a.position).applyMatrix4(toRoot).toArray();return a;}
 function interpolate(a,b,t){const r={};for(const[k,v]of Object.entries(a))r[k]=v.map((n,i)=>n+(b[k][i]-n)*t);return r;}
 function clip(poly,p,keep){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=p.sign*(a.root[p.axis]-p.value),db=p.sign*(b.root[p.axis]-p.value),ia=keep?da>=-1e-6:da<=1e-6,ib=keep?db>=-1e-6:db<=1e-6;if(ia)out.push(a);if(ia!==ib)out.push(interpolate(a,b,da/(da-db)));}return out;}
 function append(poly,dest){for(let i=1;i<poly.length-1;i++)for(const v of[poly[0],poly[i],poly[i+1]])for(const[k]of attrs)dest[k].push(...v[k]);}
 for(let i=0;i<g.attributes.position.count;i+=3){let poly=[vertex(i),vertex(i+1),vertex(i+2)];for(const p of planes){if(!poly.length)break;const d=poly.map(v=>p.sign*(v.root[p.axis]-p.value));if(d.every(n=>n>=-1e-6))continue;if(d.every(n=>n< -1e-6)){append(poly,outside);poly=[];break;}append(clip(poly,p,false),outside);poly=clip(poly,p,true);}append(poly,inside);}
 function result(a){if(!a.position.length)return null;const o=new THREE.BufferGeometry();for(const[k,v]of attrs)o.setAttribute(k,new THREE.BufferAttribute(new Float32Array(a[k]),v.itemSize,v.normalized));o.computeBoundingSphere();return o;}
 return {inside:result(inside),outside:result(outside)};
}
function worldUV(THREE,g,matrix,domain,side){const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2),q=new THREE.Vector3(),normal=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(matrix);for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(matrix);if(n)normal.fromBufferAttribute(n,i).applyMatrix3(nm);const x=q.x-.24,y=-q.z-3.24,z=q.y-.1;let u=side==='floor'?x:side==='west'||side==='east'?y:x,v=side==='floor'?y:z;if(side!=='floor'&&Math.abs(normal.y)>.7)v+=side==='west'||side==='east'?q.x-(side==='west'?.24:3.84):q.z-(side==='north'?-7.74:-3.24);uv[i*2]=(u-domain[0])/(domain[1]-domain[0]);uv[i*2+1]=1-(v-domain[2])/(domain[3]-domain[2]);}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.deleteAttribute('color');}

// Hall-only correction, based on the framed inset panels visible in Shanghai
// conservation photographs. The kitchen and other houses keep their own doors.
function rebuildHallDoors(THREE,root,c,doorNames=['前厢_木门','中厢_木门'],leafGaps={}){
 const report=[];
 const iron=new THREE.MeshStandardMaterial({name:'客堂旧铁拉手与合页',color:0x292622,roughness:.73,metalness:.72});
 for(const name of doorNames){
  const door=root.getObjectByName(name),[width,h]=door.userData.clearOpening;
  const leaves=door.children.filter(o=>o.userData.kind==='door_leaf');
  // Rebuild the complete frame as well, so the former stop strips, hinge plates
  // and decorative components cannot remain inside the corrected installation.
  door.clear();
  const fixedWood=(name,x,y,z,w,h,d)=>{
   const g=new THREE.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2),vertical=h>=w;
   for(let i=0;i<p.count;i++){
    const q=[p.getX(i),p.getY(i),p.getZ(i)],nn=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],axis=nn.indexOf(Math.max(...nn)),along=vertical?1:0;
    let a=[0,1,2].find(v=>v!==along&&v!==axis),b=axis===along?2:along;if(a===undefined)a=vertical?0:1;
    uv[i*2]=q[a]/.5+.17;uv[i*2+1]=1-q[b]/1.5;
   }
   g.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=new THREE.Mesh(g,c.material(HALL_DATA.surfaceSlots['joinery-wood'].material));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData={hallRevision:2,hallSurface:'door-frame'};door.add(m);
  };
  for(const sign of[-1,1]){
   fixedWood('老木门框_通长边挺',sign*(width/2+.0325),h/2+.025,0,.065,h+.05,.15);
   fixedWood('老木门框_前侧止口',sign*(width/2-.001),h/2,.035,.014,h,.018);
  }
  fixedWood('老木门框_上横榫',0,h+.030,0,width+.13,.07,.15);
  fixedWood('老木门框_上止口',0,h+.002,.035,width-.012,.014,.018);
  for(const leaf of leaves)door.add(leaf);
  door.userData.construction='上下四块平整嵌板、木框挺与中横档；无窄拼板装饰和背穿带';
  for(const leaf of leaves){
   const sign=leaf.userData.hinge==='right'?-1:1,w=width/leaves.length-(leaves.length===2?.009:(leafGaps[name]??.006)),cx=sign*(.003+w/2);
   leaf.clear();leaf.position.z=-.026;leaf.userData={...leaf.userData,hallDoorRevision:2,leafWidth:w,leafHeight:h,thickness:.048,panelCount:4,pivotAtRear:true,hingeClearance:.003};
   const wood=(name,x,y,z,sx,sy,sz,grain='vertical',bevel=.0015)=>{
    const b=Math.min(bevel,sx*.10,sy*.10,sz*.2),shape=new THREE.Shape();
    shape.moveTo(-sx/2+b,-sy/2+b);shape.lineTo(sx/2-b,-sy/2+b);shape.lineTo(sx/2-b,sy/2-b);shape.lineTo(-sx/2+b,sy/2-b);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:sz-2*b,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:b,bevelThickness:b,curveSegments:1});geo.translate(x,y,z-sz/2+b);
    const p=geo.attributes.position,n=geo.attributes.normal,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
     let u=(sign*p.getX(i)-.003)/w,v=p.getY(i)/h;
     if(Math.abs(n.getX(i))>.65)u+=(p.getZ(i)-.026)/.8;
     if(Math.abs(n.getY(i))>.65)v+=(p.getZ(i)-.026)/h;
     uv[i*2]=u;uv[i*2+1]=1-v;
    }
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const m=new THREE.Mesh(geo,c.material(HALL_DATA.surfaceSlots['door-'+grain].material));m.name=name;m.castShadow=m.receiveShadow=true;m.userData={hallRevision:2,hallSurface:'door',grain};leaf.add(m);return m;
   };
   const stile=Math.min(.095,w*.15),top=.115,bottom=.155,middle=.115,mid=h*.425,muntin=.048,depth=.048,z=.026;
   for(const x of[cx-w/2+stile/2,cx+w/2-stile/2])wood('老木门_通长边挺',x,h/2,z,stile,h-.014,depth);
   for(const[y,t]of[[bottom/2+.007,bottom],[mid,middle],[h-top/2-.007,top]])wood('老木门_榫接横档',cx,y,z,w-2*stile,t,depth,'horizontal');
   const bands=[[bottom+.007,mid-middle/2],[mid+middle/2,h-top-.007]];
   for(const[lo,hi]of bands){
    wood('老木门_中竖梃',cx,(lo+hi)/2,z,muntin,hi-lo,depth);
    const pw=(w-2*stile-muntin)/2;
    for(const s of[-1,1]){
     const px=cx+s*(pw+muntin)/2,ph=hi-lo;
     // A plain rebated panel, with a shallow bevel visible on both faces.
     wood('老木门_平整嵌板',px,(lo+hi)/2,z,pw+.005,ph+.005,.020,'vertical',.0015);
     wood('老木门_板心平面',px,(lo+hi)/2,z,pw-.018,ph-.018,.027,'vertical',.0035);
    }
   }
   const metal=(name,geo,x,y,z)=>{const m=new THREE.Mesh(geo,iron);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData={hallRevision:2,doorAttached:true};leaf.add(m);return m;};
   for(const y of[h*.17,h*.80]){
    metal('老木门_随动合页片',new THREE.BoxGeometry(.038,.10,.004),sign*.022,y,-.002);
    metal('老木门_合页轴',new THREE.CylinderGeometry(.006,.006,.105,8),0,y,0);
    const fixed=new THREE.Mesh(new THREE.BoxGeometry(.038,.10,.004),iron);fixed.name='老木门框_固定合页片';fixed.position.set(leaf.position.x-sign*.022,y,-.028);fixed.castShadow=true;fixed.userData={hallRevision:2,fixedHardware:true};door.add(fixed);
   }
   const hx=sign*(w-stile*.56),hy=Math.min(1.06,h*.49);
   for(const face of[-1,1]){
    const bz=z+face*(depth/2+.0025);
    metal('老木门_旧铁拉手底板',new THREE.BoxGeometry(.029,.108,.004),hx,hy,bz);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(hx,hy-.035,bz),new THREE.Vector3(hx,hy-.030,bz+face*.025),new THREE.Vector3(hx,hy+.030,bz+face*.025),new THREE.Vector3(hx,hy+.035,bz)]);
    metal('老木门_弓形拉手',new THREE.TubeGeometry(curve,10,.004,6,false),0,0,0);
   }
   report.push({door:name,hinge:leaf.userData.hinge,width:w,height:h,panels:4,thickness:.048});
  }
 }
 return report;
}

// Reuse the approved ground-floor room-door construction on B1's four upper
// room doors, after each room's original material pass has finished.
export function installUpperPanelDoors(THREE,root){if(!FAST_ENABLED("hall"))return;
 const names=[];
 root.getObjectByName('L2_二楼').traverse(o=>{if(o.userData.kind==='door')names.push(o.name);});
 // The lounge latch edge sits next to the spine wall's 2 mm finish layer.
 // Leave an additional 2 mm at that edge so the first few degrees clear it.
 const report=rebuildHallDoors(THREE,root,cache(THREE),names,{'前楼_门':.008});
 for(const name of names){
  const door=root.getObjectByName(name);
  door.userData.upperPanelDoorRevision='20261111';
  door.userData.styleReference='B1一楼前厢与中厢四格平嵌板门';
 }
 root.userData.upperPanelDoors={date:'2026-11-11',scope:'B1二楼全部房门',reference:'前厢_木门',doors:report,userVisualAccepted:false};
}

function ageArchitecture(THREE,root,c){
 // The side walls and tiled floor are continuous through the open stair passage.
 // One material and one world-space UV origin avoid a visible room-boundary band.
 const hallEnd=-7.80,continuousEnd=-10.50,sideWallEnd=-10.74;
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 const sides=[['south','南_客堂木立面',[{axis:2,value:-3.239,sign:-1}]],['north','客堂后隔墙_双通口',[{axis:2,value:hallEnd,sign:1}]],['west','西_主屋承重墙_一楼',[{axis:2,value:sideWallEnd,sign:1},{axis:2,value:-3.24,sign:-1},{axis:0,value:.239,sign:1}]],['east','中隔墙_一楼',[{axis:2,value:continuousEnd,sign:1},{axis:2,value:-3.24,sign:-1},{axis:0,value:3.841,sign:-1}]]];
 for(const[side,name,planes]of sides){const group=root.getObjectByName(name),meshes=[];group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name.includes('内墙_旧石灰灰泥'))meshes.push(o);});const slot=HALL_DATA.surfaceSlots['plaster-'+side];for(const o of meshes){const transform=inv.clone().multiply(o.matrixWorld),s=sliceGeometry(THREE,o.geometry,transform,planes);if(!s.inside)continue;worldUV(THREE,s.inside,transform,slot.domain,side);const aged=new THREE.Mesh(s.inside,c.material(slot.material));aged.name=o.name+'_客堂饰面';aged.position.copy(o.position);aged.quaternion.copy(o.quaternion);aged.scale.copy(o.scale);aged.castShadow=o.castShadow;aged.receiveShadow=true;aged.userData={hallRevision:1,hallSurface:side};o.parent.add(aged);if(s.outside)o.geometry=s.outside;else o.removeFromParent();audit.push({side,name:o.name,insideVertices:s.inside.attributes.position.count,outsideVertices:s.outside?.attributes.position.count||0});}}
 // Expand the hall part of the existing instanced tiled floor, retaining the
 // original 30 cm grid, bevels and heights, through to the rear courtyard sill.
 const floor=root.getObjectByName('客堂与后梯_地砖'),inst=floor.children.find(o=>o.isInstancedMesh);if(inst){const retained=[],arr={},attrs=Object.entries(inst.geometry.attributes);for(const[k]of attrs)arr[k]=[];const slot=HALL_DATA.surfaceSlots['floor-ceramic'],world=inv.clone().multiply(inst.matrixWorld);let changed=0;for(let i=0;i<inst.count;i++){const t=new THREE.Matrix4();inst.getMatrixAt(i,t);const transformed=inst.geometry.clone().applyMatrix4(t);const sliced=sliceGeometry(THREE,transformed,world,[{axis:2,value:continuousEnd,sign:1}]);if(!sliced.inside){retained.push(i);continue;}changed++;worldUV(THREE,sliced.inside,world,slot.domain,'floor');for(const[k,a]of Object.entries(sliced.inside.attributes)){if(!arr[k])arr[k]=[];arr[k].push(...a.array);}if(sliced.outside){const m=new THREE.Mesh(sliced.outside,inst.material.clone()),col=new THREE.Color();inst.getColorAt(i,col);m.material.color.copy(col);m.name='后梯地砖_保留边界';m.position.copy(inst.position);m.quaternion.copy(inst.quaternion);m.scale.copy(inst.scale);m.receiveShadow=true;floor.add(m);}}
 const kept=new THREE.InstancedMesh(inst.geometry,inst.material,retained.length),m4=new THREE.Matrix4(),co=new THREE.Color();kept.name=inst.name+'_后梯保留';kept.position.copy(inst.position);kept.quaternion.copy(inst.quaternion);kept.scale.copy(inst.scale);retained.forEach((i,j)=>{inst.getMatrixAt(i,m4);kept.setMatrixAt(j,m4);inst.getColorAt(i,co);kept.setColorAt(j,co);});kept.castShadow=kept.receiveShadow=true;floor.add(kept);const g=new THREE.BufferGeometry();for(const[k,a]of Object.entries(arr))if(a.length)g.setAttribute(k,new THREE.Float32BufferAttribute(a,k==='uv'?2:inst.geometry.attributes[k]?.itemSize||3));g.deleteAttribute('color');g.computeBoundingSphere();const aged=new THREE.Mesh(g,c.material(slot.material));aged.name='客堂_原30cm红陶砖_做旧';aged.position.copy(inst.position);aged.quaternion.copy(inst.quaternion);aged.scale.copy(inst.scale);aged.castShadow=aged.receiveShadow=true;aged.userData={hallRevision:1,hallSurface:'floor',originalGridRetained:true};floor.add(aged);inst.removeFromParent();audit.push({side:'floor',instancesChanged:changed,instancesRetained:retained.length});}
 // Every timber retains its owning leaf/frame transform. Connected components
 // determine grain direction, and each face receives a non-collapsed projection.
 const woodSlot=HALL_DATA.surfaceSlots['joinery-wood'];
 for(const name of['客堂_对开木门','客堂_西长窗','客堂_东长窗','客堂门上横披','前厢_木门','中厢_木门']){
  const group=root.getObjectByName(name);group.traverse(o=>{if(!o.isMesh||o.material?.userData.category!=='aged_dark_wood')return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,count=p.count/3,parents=Array.from({length:count},(_,i)=>i),vertices=new Map();const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};for(let t=0;t<count;t++)for(let j=0;j<3;j++){const i=t*3+j,key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(vertices.has(key))parents[find(t)]=find(vertices.get(key));else vertices.set(key,t);}const pieces=new Map(),v=new THREE.Vector3();for(let t=0;t<count;t++){const k=find(t);if(!pieces.has(k))pieces.set(k,new THREE.Box3());for(let j=0;j<3;j++)pieces.get(k).expandByPoint(v.fromBufferAttribute(p,t*3+j));}const uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const box=pieces.get(find(Math.floor(i/3))),size=box.getSize(new THREE.Vector3()).toArray(),long=size.indexOf(Math.max(...size)),q=[p.getX(i),p.getY(i),p.getZ(i)],nn=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],normal=nn.indexOf(Math.max(...nn));let across=[0,1,2].find(a=>a!==long&&a!==normal);if(across===undefined)across=(long+1)%3;const along=normal===long?(long+2)%3:long;uv[i*2]=(q[across]-box.min.getComponent(across))/.5+(find(Math.floor(i/3))%7)*.137;uv[i*2+1]=1-(q[along]-box.min.getComponent(along))/1.5;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.deleteAttribute('color');o.geometry=g;o.material=c.material(woodSlot.material);o.userData={...o.userData,hallRevision:1,hallSurface:'joinery',timberComponents:pieces.size};audit.push({side:'joinery',name,mesh:o.name,timberComponents:pieces.size,vertices:p.count});});
 }
 root.userData.hallContinuousGroundFinish={revision:"20261116",rangeS:[3.24,10.50],westWallEndS:10.74,walls:["west","east"],originalTileGridMetres:.30};
 return audit;
}

// Gongyifang pre-renovation evidence establishes six floor-height glazed leaves.
// Pane proportions and the central-pair opening are explicit scene adaptations;
// the obscured photograph does not establish an exact historical hinge chain.
function rebuildHallPartition(THREE,root,c){
 const old=root.getObjectByName('客堂_对开木门'),parent=old.parent;
 for(const name of ['客堂_对开木门','客堂_西长窗','客堂_东长窗','客堂门上横披'])root.getObjectByName(name)?.removeFromParent();
 const g=new THREE.Group();g.name='客堂_六扇落地隔扇';g.position.set(2.04,.17,-2.975);
 g.userData={hallRevision:3,kind:'hall_partition',leafCount:6,operableLeaves:2,construction:'上玻璃格、下木裙板、通长横披；网页中央两扇内开、侧四扇固定展示',reference:'公益坊修缮前室内照片；非测绘复原',clearOpening:[3.188,2.55]};parent.add(g);
 const iron=new THREE.MeshStandardMaterial({name:'隔扇旧铁五金',color:0x2f2c25,roughness:.74,metalness:.68});
 const glass=new THREE.MeshStandardMaterial({name:'隔扇浅灰旧玻璃',color:0xa1aaa4,roughness:.22,metalness:0,opacity:.23,transparent:true,depthWrite:false});
 function wood(owner,name,x,y,z,w,h,d,surface='partition-frame'){
  const geo=new THREE.BoxGeometry(w,h,d),p=geo.attributes.position,n=geo.attributes.normal,uv=new Float32Array(p.count*2),along=h>=w?1:0;
  for(let i=0;i<p.count;i++){
   const q=[p.getX(i),p.getY(i),p.getZ(i)],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],axis=normal.indexOf(Math.max(...normal));
   let a=[0,1,2].find(v=>v!==along&&v!==axis),b=axis===along?2:along;if(a===undefined)a=along===1?0:1;
   uv[i*2]=q[a]/.5+(x+2)*.173;uv[i*2+1]=1-(q[b]+(along===1?y:x))/1.5;
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=new THREE.Mesh(geo,c.material(HALL_DATA.surfaceSlots['joinery-wood'].material));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData={hallRevision:3,hallSurface:surface,grain:along===1?'vertical':'horizontal'};owner.add(m);return m;
 }
 function metal(owner,name,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),iron);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.userData={hallRevision:3,partitionHardware:true};owner.add(m);return m;}
 function pane(owner,name,x,y,z,w,h){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.004),glass);m.name=name;m.position.set(x,y,z);m.receiveShadow=true;m.userData={hallRevision:3,partitionGlass:true};owner.add(m);}
 const width=3.32,clear=3.188,step=clear/6,gap=.006,w=step-gap,h=2.544,stile=.058,depth=.044,zc=.026,split=.87,rail=.09;
 for(const side of [-1,1])wood(g,'隔扇通长边框',side*(width/2-.033),1.565,0,.066,3.13,.14);
 wood(g,'隔扇横披下通枋',0,2.59,0,clear,.08,.14);
 wood(g,'隔扇横披上通枋',0,3.095,0,clear,.07,.14);
 // Fixed transom spans all six leaves; its glazing aligns with their two columns.
 const tlo=2.63,thi=3.06,cols=12,cell=clear/cols,bar=.024;
 for(let i=1;i<cols;i++)wood(g,'横披细竖梃',-clear/2+i*cell,(tlo+thi)/2,0,bar,thi-tlo,.045);
 for(let i=0;i<cols;i++)pane(g,'通长横披玻璃_'+(i+1),-clear/2+(i+.5)*cell,(tlo+thi)/2,0,cell-bar,thi-tlo-.006);
 const leaves=[];
 for(let i=0;i<6;i++){
  const moving=i===2||i===3,sign=i===3?-1:1,left=-clear/2+i*step+gap/2,right=left+w;
  const leaf=new THREE.Group();leaf.name='落地隔扇_'+(i+1);leaf.position.set(sign===1?left:right,0,-.026);
  leaf.userData={hallRevision:3,kind:moving?'door_leaf':'hall_partition_fixed',hinge:sign===1?'left':'right',restOpening:0,openingRadians:0,partitionLeaf:true,operable:moving,leafIndex:i+1,leafWidth:w,leafHeight:h,thickness:depth,paneColumns:2,paneRows:4};g.add(leaf);leaves.push(leaf);
  const cx=sign*w/2,lo=split+rail/2,hi=h-.10;
  for(const sx of [-1,1])wood(leaf,'隔扇通长边挺',cx+sx*(w-stile)/2,h/2,zc,stile,h,depth,'partition-leaf');
  for(const[y,rh]of [[.065,.13],[split,rail],[h-.05,.10]])wood(leaf,'隔扇榫接横档',cx,y,zc,w-2*stile,rh,depth,'partition-leaf');
  wood(leaf,'隔扇下木裙板',cx,(.13+split-rail/2)/2,zc,w-2*stile+.004,split-rail/2-.13+.004,.023,'partition-leaf');
  const gw=w-2*stile,mull=.023,row=(hi-lo)/4;
  wood(leaf,'玻璃中竖梃',cx,(lo+hi)/2,zc,mull,hi-lo,depth,'partition-leaf');
  for(let k=1;k<4;k++)wood(leaf,'玻璃横梃',cx,lo+k*row,zc,gw,mull,depth,'partition-leaf');
  for(let col=0;col<2;col++)for(let r=0;r<4;r++)pane(leaf,'隔扇玻璃_'+(col+1)+'_'+(r+1),cx+(col-.5)*gw/2,lo+(r+.5)*row,zc,(gw-mull)/2-.004,row-mull-.004);
  if(moving){
   for(const y of [.40,2.08]){
    metal(leaf,'隔扇随动合页片',sign*.019,y,-.002,.035,.085,.004);
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.09,8),iron);pin.name='隔扇合页轴';pin.position.set(0,y,0);pin.userData={hallRevision:3,partitionHardware:true};leaf.add(pin);
    metal(g,'隔扇固定合页片',leaf.position.x-sign*.022,y,-.028,.036,.085,.004);
   }
   const hx=sign*(w-stile/2),hy=1.0;
   for(const face of [-1,1]){
    const z=zc+face*(depth/2+.003);metal(leaf,'隔扇拉手底板',hx,hy,z,.024,.10,.004);
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(hx,hy-.03,z),new THREE.Vector3(hx,hy-.026,z+face*.02),new THREE.Vector3(hx,hy+.026,z+face*.02),new THREE.Vector3(hx,hy+.03,z)]);
    const handle=new THREE.Mesh(new THREE.TubeGeometry(path,10,.0035,6,false),iron);handle.name='隔扇弓形拉手';handle.userData={hallRevision:3,partitionHardware:true};leaf.add(handle);
   }
  }else{
   for(const y of [.09,2.46])metal(leaf,'侧隔扇固定插销',cx,y,zc-.026,.023,.105,.008);
  }
 }
 return {name:g.name,leafCount:6,movingLeafIndices:[3,4],fixedDisplayLeafIndices:[1,2,5,6],openingDegrees:85.9437,leafWidth:w,leafHeight:h,lowerPanelTop:split,paneGrid:[2,4],transomColumns:12,clearPassageClosedM:step*2,source:'https://www.thepaper.cn/newsDetail_forward_19124381',adaptation:'照片明确六扇；格数按可见部分适配。侧四扇固定展示、中央两扇内开为交互设计，非原构造实测。'};
}

export function installHall(THREE,root){if(!FAST_ENABLED("hall"))return;const c=cache(THREE),gf=root.getObjectByName('L0_一楼'),furniture=c.part('furniture');gf.add(furniture);root.updateMatrixWorld(true);const mounted=[];furniture.traverse(o=>{if(o.userData.mountSide==='north')mounted.push(o);});for(const o of mounted)root.getObjectByName('客堂后隔墙_双通口').getObjectByName('完整墙体').attach(o);const doorAudit=rebuildHallDoors(THREE,root,c),audit=ageArchitecture(THREE,root,c),partitionAudit=rebuildHallPartition(THREE,root,c);installations.set(root,{furniture});root.userData.hall={revision:3,conceptApproved:true,userVisualAccepted:false,origin:[.24,.1,-3.24],size:[3.6,4.5],assetId:HALL_DATA.assetId,materialAudit:audit,doorAudit,partitionAudit};root.userData.roomProgram='B1主户厨房与客堂已装配；客堂六扇落地隔扇已按实景修正、待视觉确认';root.userData.textureCount=(root.userData.textureCount||0)+HALL_DATA.images.length;}
export function setHallCabinetOpening(root,degrees=0){const i=installations.get(root);if(!i)return;const angle=Math.max(0,Math.min(90,degrees))*Math.PI/180;i.furniture.traverse(o=>{if(o.userData.kind==='hall_cabinet_leaf')o.rotation.y=(o.userData.openingSign??(o.userData.hinge==='right'?1:-1))*angle;});root.updateMatrixWorld(true);}

export function createHallInspection(THREE,root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),out=new THREE.Group();out.name='客堂查看建筑';out.userData={hallInspection:true};
 function clone(o,planes){
  if(!o.visible)return null;let c;
  if(o.isInstancedMesh){c=new THREE.Group();const im=new THREE.Matrix4(),col=new THREE.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const g=o.geometry.clone().applyMatrix4(im),t=inv.clone().multiply(o.matrixWorld),part=sliceGeometry(THREE,g,t,planes).inside;if(!part)continue;const mat=o.material.clone();if(o.instanceColor){o.getColorAt(i,col);mat.color.multiply(col);}const child=new THREE.Mesh(part,mat);child.name=o.name+'_'+i;child.castShadow=child.receiveShadow=true;c.add(child);}}
  else if(o.isMesh){const t=inv.clone().multiply(o.matrixWorld),g=sliceGeometry(THREE,o.geometry,t,planes).inside;if(!g)return null;c=new THREE.Mesh(g,o.material);c.castShadow=o.castShadow;c.receiveShadow=o.receiveShadow;}
  else c=new THREE.Group();c.name=o.name;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);c.userData={...o.userData,hallInspection:true};for(const ch of o.children){const a=clone(ch,planes);if(a)c.add(a);}return c;
 }
 for(const[side,name]of[['floor','客堂与后梯_地砖'],['south','南_客堂木立面'],['north','客堂后隔墙_双通口'],['west','西_主屋承重墙_一楼'],['east','中隔墙_一楼']]){
  const planes=[{axis:1,value:3.84,sign:-1}];if(['floor','west','east'].includes(side))planes.push({axis:2,value:side==='floor'?-7.74:-7.86,sign:1},{axis:2,value:side==='floor'?-3.24:-3.0,sign:-1});const original=root.getObjectByName(name),g=clone(original,planes);if(!g)continue;inv.clone().multiply(original.matrixWorld).decompose(g.position,g.quaternion,g.scale);g.userData.hallSide=side;out.add(g);
  // Seal only the display section planes; these caps never enter the house.
  const capMat=new THREE.MeshStandardMaterial({name:'客堂查看_剖面封口',color:0xafa18b,roughness:.96});
  const cap=(position,size)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),capMat);m.name='查看剖面_封口';m.position.fromArray(position);m.userData={hallInspection:true,hallSide:side};m.receiveShadow=true;out.add(m);};
  if(side==='floor')cap([2.04,.0,-7.74],[3.6,.16,.002]);
  if(side==='west'){cap([.12,3.84,-5.43],[.24,.002,4.86]);for(const z of[-3,-7.86])cap([.12,1.87,z],[.24,3.94,.002]);}
  if(side==='east'){cap([3.93,3.84,-5.43],[.18,.002,4.86]);for(const z of[-3,-7.86])cap([3.93,1.87,z],[.18,3.94,.002]);}
  if(side==='north')cap([2.04,3.84,-7.8],[3.6,.002,.12]);
  if(side==='south')cap([2.04,3.84,-3.12],[3.6,.002,.24]);
 }
 return out;
}
