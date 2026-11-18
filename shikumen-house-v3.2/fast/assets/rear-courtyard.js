import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { REAR_COURTYARD_DATA } from './rear-courtyard-data.js';

const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const d=REAR_COURTYARD_DATA,geometries=[],materials=new Map(),textures=new Map();
 const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(a){const raw=FAST_BYTES(a);return new THREE.BufferAttribute(new arrays[a.type](raw.buffer),a.size,!!a.normalized);}
 function geometry(i){if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;}
 function texture(i,color=false){const key=i+':'+color;if(textures.has(key))return textures.get(key);const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=4;textures.set(key,t);return t;}
 function material(i,colored=false){const key=i+':'+colored;if(materials.has(key))return materials.get(key);const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];const m=new THREE.MeshStandardMaterial({name:s.name+'_后天井v1',color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??0,vertexColors:colored});m.userData={asset:d.assetId,rearCourtyardMaterial:i,rearCourtyardRevision:1};if(typeof document!=='undefined'){if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}}if(s.emissiveFactor)m.emissive.fromArray(s.emissiveFactor);if(s.alphaMode==='BLEND')m.depthWrite=false;materials.set(key,m);return m;}
 function node(s){const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={rearCourtyardRevision:1};m.castShadow=true;m.receiveShadow=true;o.add(m);}for(const ch of s.children||[])o.add(node(ch));return o;}
 const c={material,part:name=>{const g=new THREE.Group();g.name='后天井_'+name;g.position.set(0,0,0);g.userData={rearCourtyardRevision:1,part:name};for(const n of d.parts[name]||[])g.add(node(n));return g;}};caches.set(THREE,c);return c;
}


function rebuildRearDoor(THREE,root,c){
 const report=[];
 const iron=new THREE.MeshStandardMaterial({name:'后井旧铁拉手与合页',color:0x292622,roughness:.73,metalness:.72});
 for(const name of ['后厢_木门']){
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
   g.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=new THREE.Mesh(g,c.material(REAR_COURTYARD_DATA.surfaceSlots.wood));m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData={rearCourtyardRevision:2,rearCourtyardSurface:'door-frame'};door.add(m);
  };
  for(const sign of[-1,1]){
   fixedWood('老木门框_通长边挺',sign*(width/2+.0325),h/2+.025,0,.065,h+.05,.15);
   fixedWood('老木门框_前侧止口',sign*(width/2-.001),h/2,.035,.014,h,.018);
  }
  fixedWood('老木门框_上横榫',0,h+.030,0,width+.13,.07,.15);
  fixedWood('老木门框_上止口',0,h+.002,.035,width-.012,.014,.018);
  for(const leaf of leaves)door.add(leaf);
  door.userData.construction='三块宽平整嵌板、通长边挺与两道横档；对应后天井概念门型';
  for(const leaf of leaves){
   const sign=leaf.userData.hinge==='right'?-1:1,w=width/leaves.length-(leaves.length===2?.009:.006),cx=sign*(.003+w/2);
   leaf.clear();leaf.position.z=-.026;leaf.userData={...leaf.userData,rearDoorRevision:2,leafWidth:w,leafHeight:h,thickness:.048,panelCount:3,pivotAtRear:true,hingeClearance:.003};
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
    const m=new THREE.Mesh(geo,c.material(REAR_COURTYARD_DATA.surfaceSlots['door-'+grain]));m.name=name;m.castShadow=m.receiveShadow=true;m.userData={rearCourtyardRevision:2,rearCourtyardSurface:'door',grain};leaf.add(m);return m;
   };
   const stile=Math.min(.095,w*.15),top=.11,bottom=.14,middle=.105,depth=.048,z=.026;
   const rail1=h*.31,rail2=h*.66;
   for(const x of[cx-w/2+stile/2,cx+w/2-stile/2])wood('后井门_通长边挺',x,h/2,z,stile,h-.014,depth);
   for(const[y,t]of[[bottom/2+.007,bottom],[rail1,middle],[rail2,middle],[h-top/2-.007,top]])wood('后井门_榫接横档',cx,y,z,w-2*stile,t,depth,'horizontal');
   for(const[lo,hi]of[[bottom+.007,rail1-middle/2],[rail1+middle/2,rail2-middle/2],[rail2+middle/2,h-top-.007]]){
    const pw=w-2*stile,ph=hi-lo;
    wood('后井门_整块退进嵌板',cx,(lo+hi)/2,z,pw+.005,ph+.005,.020,'vertical');
    wood('后井门_板心平面',cx,(lo+hi)/2,z,pw-.018,ph-.018,.027,'vertical',.0035);
    for(const face of[-1,1]){
     for(const side of[-1,1])wood('后井门_板心竖压线',cx+side*(pw/2-.008),(lo+hi)/2,z+face*.020,.016,ph,.016);
     for(const yy of[lo+.008,hi-.008])wood('后井门_板心横压线',cx,yy,z+face*.020,pw-.032,.016,.016,'horizontal');
    }
   }
   const metal=(name,geo,x,y,z)=>{const m=new THREE.Mesh(geo,iron);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData={rearCourtyardRevision:2,doorAttached:true};leaf.add(m);return m;};
   for(const y of[h*.17,h*.80]){
    metal('老木门_随动合页片',new THREE.BoxGeometry(.038,.10,.004),sign*.022,y,-.002);
    metal('老木门_合页轴',new THREE.CylinderGeometry(.006,.006,.105,8),0,y,0);
    const fixed=new THREE.Mesh(new THREE.BoxGeometry(.038,.10,.004),iron);fixed.name='老木门框_固定合页片';fixed.position.set(leaf.position.x-sign*.022,y,-.028);fixed.castShadow=true;fixed.userData={rearCourtyardRevision:2,fixedHardware:true};door.add(fixed);
   }
   const hx=sign*(w-stile*.56),hy=Math.min(1.06,h*.49);
   for(const face of[-1,1]){
    const bz=z+face*(depth/2+.0025);
    metal('老木门_旧铁拉手底板',new THREE.BoxGeometry(.029,.108,.004),hx,hy,bz);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(hx,hy-.035,bz),new THREE.Vector3(hx,hy-.030,bz+face*.025),new THREE.Vector3(hx,hy+.030,bz+face*.025),new THREE.Vector3(hx,hy+.035,bz)]);
    metal('老木门_弓形拉手',new THREE.TubeGeometry(curve,10,.004,6,false),0,0,0);
   }
   report.push({door:name,hinge:leaf.userData.hinge,width:w,height:h,panels:3,thickness:.048});
  }
 }
 return report;
}

function ageWood(THREE,root,c){const audit=[];
 for(const name of['后井采光窗']){
  const group=root.getObjectByName(name);group.traverse(o=>{if(!o.isMesh||o.material?.userData.category!=='aged_dark_wood')return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,count=p.count/3,parents=Array.from({length:count},(_,i)=>i),vertices=new Map();const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};for(let t=0;t<count;t++)for(let j=0;j<3;j++){const i=t*3+j,key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(vertices.has(key))parents[find(t)]=find(vertices.get(key));else vertices.set(key,t);}const pieces=new Map(),v=new THREE.Vector3();for(let t=0;t<count;t++){const k=find(t);if(!pieces.has(k))pieces.set(k,new THREE.Box3());for(let j=0;j<3;j++)pieces.get(k).expandByPoint(v.fromBufferAttribute(p,t*3+j));}const uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const box=pieces.get(find(Math.floor(i/3))),size=box.getSize(new THREE.Vector3()).toArray(),long=size.indexOf(Math.max(...size)),q=[p.getX(i),p.getY(i),p.getZ(i)],nn=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],normal=nn.indexOf(Math.max(...nn));let across=[0,1,2].find(a=>a!==long&&a!==normal);if(across===undefined)across=(long+1)%3;const along=normal===long?(long+2)%3:long;uv[i*2]=(q[across]-box.min.getComponent(across))/.5+(find(Math.floor(i/3))%7)*.137;uv[i*2+1]=1-(q[along]-box.min.getComponent(along))/1.5;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.deleteAttribute('color');o.geometry=g;o.material=c.material(REAR_COURTYARD_DATA.surfaceSlots.wood);o.userData={...o.userData,rearCourtyardRevision:1,rearCourtyardSurface:'joinery',timberComponents:pieces.size};audit.push({side:'joinery',name,mesh:o.name,timberComponents:pieces.size,vertices:p.count});});
 }
return audit;}

function ageBrick(THREE,root,c){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),targets=[],audit=[];
 // Surface-only finish within this yard. Retain the material/vertex colours outside it.
 const planes=[{axis:0,value:.23,sign:1},{axis:0,value:3.85,sign:-1},{axis:2,value:-11.945,sign:1},{axis:2,value:-10.735,sign:-1},{axis:1,value:3.2,sign:-1}];
 root.getObjectByName('L0_一楼').traverse(o=>{for(let a=o;a;a=a.parent)if(a.name==='西_外墙_厨房')return;if(o.isMesh&&!Array.isArray(o.material)&&/红砖|青灰砖|风化石灰|旧石灰灰泥|风化砂岩|旧灰缝/.test(o.material.name)&&!o.userData.rearCourtyardRevision)targets.push(o);});
 const pos=new THREE.Vector3(),norm=new THREE.Vector3(),color=new THREE.Color(),im=new THREE.Matrix4();
 for(const o of targets){
  const world=inv.clone().multiply(o.matrixWorld),chunks=[],kept=[];
  function process(geo,tint){
   const b=geo.boundingBox||(geo.computeBoundingBox(),geo.boundingBox),box=b.clone().applyMatrix4(world);
   if(planes.some(p=>p.sign===1?box.max.getComponent(p.axis)<p.value:box.min.getComponent(p.axis)>p.value))return {inside:null,outside:geo};
   const part=sliceGeometry(THREE,geo,world,planes);if(!part.inside)return part;
   const g=part.inside,p=g.attributes.position,n=g.attributes.normal,co=g.attributes.color,uv=new Float32Array(p.count*2),colors=new Float32Array(p.count*3),nm=new THREE.Matrix3().getNormalMatrix(world);
   for(let i=0;i<p.count;i++){
    pos.fromBufferAttribute(p,i).applyMatrix4(world);norm.fromBufferAttribute(n,i).applyMatrix3(nm);
    const northing=-pos.z;
    const perimeter=Math.abs(norm.x)>.7?(pos.x>2?3.6+northing-10.74:8.4+11.94-northing):(northing<11.34?pos.x-.24:4.8+3.84-pos.x);
    uv[i*2]=perimeter/9.6;const surfaceHeight=pos.y+(Math.abs(norm.y)>.7?northing-(northing<11.34?10.74:11.94):0);uv[i*2+1]=1-surfaceHeight/3.2;
    if(co)color.fromBufferAttribute(co,i);else color.setRGB(1,1,1);color.multiply(o.material.color).multiply(tint);colors.set(color.toArray(),i*3);
   }
   g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('color',new THREE.BufferAttribute(colors,3));return part;
  }
  if(o.isInstancedMesh){
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const g=o.geometry.clone().applyMatrix4(im),tint=o.instanceColor?(o.getColorAt(i,color),color.clone()):new THREE.Color(1,1,1),p=process(g,tint);
    if(!p.inside){kept.push(i);g.dispose();continue;}chunks.push(p.inside);
    if(p.outside){const m=o.material.clone();m.color.multiply(tint);const x=new THREE.Mesh(p.outside,m);x.name=o.name+'_未改动边界';x.position.copy(o.position);x.quaternion.copy(o.quaternion);x.scale.copy(o.scale);x.castShadow=x.receiveShadow=true;o.parent.add(x);}g.dispose();
   }
   if(!chunks.length)continue;
   if(kept.length){const k=new THREE.InstancedMesh(o.geometry,o.material,kept.length);k.name=o.name;k.position.copy(o.position);k.quaternion.copy(o.quaternion);k.scale.copy(o.scale);k.userData={...o.userData};kept.forEach((i,j)=>{o.getMatrixAt(i,im);k.setMatrixAt(j,im);if(o.instanceColor){o.getColorAt(i,color);k.setColorAt(j,color);}});k.castShadow=k.receiveShadow=true;o.parent.add(k);}
  }else{const p=process(o.geometry,new THREE.Color(1,1,1));if(!p.inside)continue;chunks.push(p.inside);if(p.outside){const k=o.clone(false);k.geometry=p.outside;o.parent.add(k);}}
  const attrs={};for(const g of chunks)for(const[k,a]of Object.entries(g.attributes)){if(!attrs[k])attrs[k]={size:a.itemSize,values:[]};attrs[k].values.push(...a.array);}
  const g=new THREE.BufferGeometry();for(const[k,a]of Object.entries(attrs))g.setAttribute(k,new THREE.Float32BufferAttribute(a.values,a.size));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,c.material(REAR_COURTYARD_DATA.surfaceSlots.brick,true));mesh.name=o.name+'_后井饰面';mesh.position.copy(o.position);mesh.quaternion.copy(o.quaternion);mesh.scale.copy(o.scale);mesh.userData={rearCourtyardRevision:1,surface:'retained-brick-with-local-aging'};mesh.castShadow=mesh.receiveShadow=true;o.parent.add(mesh);o.removeFromParent();audit.push({mesh:mesh.name,vertices:g.attributes.position.count});
 }
 return audit;
}

export function installRearCourtyard(THREE,root){if(!FAST_ENABLED("rear-courtyard"))return;
 const c=cache(THREE),yard=root.getObjectByName('后天井'),props=c.part('rear');
 root.getObjectByName('后天井_青石地')?.removeFromParent();root.getObjectByName('后井西侧通路')?.removeFromParent();root.getObjectByName('后井地漏')?.removeFromParent();yard.add(props);
 // The old floor atlas contains a second, differently sized paving grid.
 // Keep every real stone and joint; use the existing plain stone texture so
 // painted joints cannot cross the actual edges or double at the passage.
 const stone=root.getObjectByName('石库门门槛').material,tint=new THREE.Color(0x68766f);stone.vertexColors=true;
 root.updateMatrixWorld(true);const floorInv=root.matrixWorld.clone().invert();let stones=0;
 props.traverse(o=>{if(!o.isMesh||o.material.name!=='后井青石_复用细砂纹理_后天井v1')return;const g=o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2),matrix=floorInv.clone().multiply(o.matrixWorld),nm=new THREE.Matrix3().getNormalMatrix(matrix),q=new THREE.Vector3(),normal=new THREE.Vector3();for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(nm);const axis=Math.abs(normal.y)>.7?'y':Math.abs(normal.x)>.7?'x':'z';uv[i*2]=(axis==='x'?-q.z:q.x)/.8;uv[i*2+1]=(axis==='y'?-q.z:q.y)/.8;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));const colors=new Float32Array(p.count*3);for(let i=0;i<p.count;i++)tint.toArray(colors,i*3);g.setAttribute('color',new THREE.BufferAttribute(colors,3));o.geometry=g;o.material=stone;o.userData={...o.userData,plainStoneGrain:true};stones++;});
 root.userData.rearPassageFinish={revision:'20261116',stones,geometryAndJointsRetained:true,textureSource:stone.userData.asset};
 // The pipe follows the architectural floor groups, including cutaway visibility.
 root.updateMatrixWorld(true);const source=props.getObjectByName('后天井_雨水管');
 if(source){
  for(const[name,a,b]of[['L0_一楼',-1,4],['L2_二楼',4,6.7],['L3_局部阁楼',6.7,7]]){
   const group=new THREE.Group();group.name='后井雨水管_'+name;group.userData={rearCourtyardRevision:1};
   source.traverse(o=>{if(!o.isMesh)return;const t=root.matrixWorld.clone().invert().multiply(o.matrixWorld),p=sliceGeometry(THREE,o.geometry,t,[{axis:1,value:a,sign:1},{axis:1,value:b,sign:-1}]);if(!p.inside)return;const m=new THREE.Mesh(p.inside,o.material);m.name=o.name;t.decompose(m.position,m.quaternion,m.scale);m.castShadow=m.receiveShadow=true;m.userData={...o.userData,rearCourtyardRevision:1};group.add(m);});root.getObjectByName(name).add(group);
  }source.removeFromParent();
 }
 const doors=rebuildRearDoor(THREE,root,c),wood=ageWood(THREE,root,c),brick=ageBrick(THREE,root,c);
 root.userData.rearCourtyard={revision:2,doors,drainCenterXS:[3.64,10.96],bucketAxisXS:[2.1,11.06],assetId:REAR_COURTYARD_DATA.assetId,scope:'B1',size:[2.7,1.2],westPassage:.9,grateTop:.022,perimeterFloorTop:.025,userVisualAccepted:false,wood,brick};
}

export function createRearCourtyardInspection(THREE,root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),out=new THREE.Group();out.name='后天井查看建筑';
 function clone(o,planes){
  if(!o?.visible)return null;let c;
  if(o.isInstancedMesh){c=new THREE.Group();const im=new THREE.Matrix4(),col=new THREE.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);const g=o.geometry.clone().applyMatrix4(im),t=inv.clone().multiply(o.matrixWorld),part=sliceGeometry(THREE,g,t,planes).inside;g.dispose();if(!part)continue;const mat=o.material.clone();if(o.instanceColor){o.getColorAt(i,col);mat.color.multiply(col);}const ch=new THREE.Mesh(part,mat);ch.name=o.name+'_'+i;ch.castShadow=ch.receiveShadow=true;c.add(ch);}}
  else if(o.isMesh){const t=inv.clone().multiply(o.matrixWorld),g=sliceGeometry(THREE,o.geometry,t,planes).inside;if(!g)return null;c=new THREE.Mesh(g,o.material);c.castShadow=o.castShadow;c.receiveShadow=o.receiveShadow;}
  else c=new THREE.Group();c.name=o.name;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);c.userData={...o.userData,rearInspection:true};for(const ch of o.children){const a=clone(ch,planes);if(a)c.add(a);}return c;
 }
 const sides=[['south',root.getObjectByName('北_主屋后墙_一楼')],['north',root.getObjectByName('南_厨房前墙')],['east',root.getObjectByName('中隔墙_一楼')],['west',root.getObjectByName('西_后井围墙')],['floor',root.getObjectByName('后天井')],['pipe',root.getObjectByName('后井雨水管_L0_一楼')]];
 root.getObjectByName('东侧厢房').children.filter(o=>o.name==='中隔墙_露天一侧红砖饰层').forEach(o=>sides.push(['east',o]));
 for(const[side,o]of sides){
  if(!o)continue;const planes=[{axis:2,value:side==='north'?-13.05:-12.12,sign:1},{axis:2,value:side==='floor'?-10.74:-10.5,sign:-1},{axis:1,value:2.65,sign:-1}];
  const g=clone(o,planes);if(!g)continue;inv.clone().multiply(o.matrixWorld).decompose(g.position,g.quaternion,g.scale);g.userData.rearSide=side;out.add(g);
 }
 const capMat=new THREE.MeshStandardMaterial({name:'后井查看_剖面封口',color:0xafa18b,roughness:.96});
 for(const[side,position,size]of[
  ['south',[2.49,2.65,-10.62],[2.7,.002,.24]],['east',[3.93,2.65,-11.31],[.18,.002,1.62]],
  ['west',[.12,2.65,-11.34],[.24,.002,1.2]],['east',[3.93,1.325,-10.5],[.18,2.65,.002]],['east',[3.93,1.325,-12.12],[.18,2.65,.002]],
 ]){const cap=new THREE.Mesh(new THREE.BoxGeometry(...size),capMat);cap.name='后井查看剖面封口';cap.position.fromArray(position);cap.userData={rearSide:side,rearInspection:true};out.add(cap);}
 return out;
}
