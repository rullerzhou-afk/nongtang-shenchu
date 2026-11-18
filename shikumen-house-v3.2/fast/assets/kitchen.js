import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { KITCHEN_DATA } from './kitchen-data.js';

// Approved kitchen only. Geometry and UVs come from the retained v7 scene;
// data URLs keep the viewer usable offline and the exporter independent of Canvas.
const caches=new WeakMap(),installations=new WeakMap();
function cache(THREE){
  if(caches.has(THREE))return caches.get(THREE);
  const d=KITCHEN_DATA,geometries=[],materials=new Map(),textures=new Map();
  function attribute(a){const raw=FAST_BYTES(a);const T={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.type];return new THREE.BufferAttribute(new T(raw.buffer),a.size,a.normalized);}
  function geometry(i){
    if(geometries[i])return geometries[i];const s=d.geometries[i],g=new THREE.BufferGeometry();
    const names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'};
    for(const[k,a]of Object.entries(s.attributes))g.setAttribute(names[k],attribute(a));if(s.indices)g.setIndex(attribute(s.indices));g.computeBoundingSphere();return geometries[i]=g;
  }
  function texture(i,color=false){
    const key=i+':'+color;if(textures.has(key))return textures.get(key);
    const def=d.textures[i],im=d.images[def.source],sam=d.samplers[def.sampler]||{};
    const t=new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>{window.dispatchEvent(new Event('shikumen-asset-ready'));});
    t.flipY=false;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.wrapS=sam.wrapS===33071?THREE.ClampToEdgeWrapping:sam.wrapS===33648?THREE.MirroredRepeatWrapping:THREE.RepeatWrapping;
    t.wrapT=sam.wrapT===33071?THREE.ClampToEdgeWrapping:sam.wrapT===33648?THREE.MirroredRepeatWrapping:THREE.RepeatWrapping;
    t.anisotropy=4;textures.set(key,t);return t;
  }
  function material(i,colored){
    const key=i+':'+colored;if(materials.has(key))return materials.get(key);
    const s=d.materials[i],p=s.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1];
    const m=new THREE.MeshStandardMaterial({name:s.name+'_厨房v7'+(colored?'_顶点色':''),color:new THREE.Color().setRGB(...f.slice(0,3)),opacity:f[3],transparent:s.alphaMode==='BLEND',alphaTest:s.alphaMode==='MASK'?(s.alphaCutoff??.5):0,side:s.doubleSided?THREE.DoubleSide:THREE.FrontSide,roughness:p.roughnessFactor??1,metalness:p.metallicFactor??1,vertexColors:colored});
    m.userData={asset:d.assetId,kitchenMaterial:i,approvedRevision:7};
    if(typeof document!=='undefined'){
      if(p.baseColorTexture)m.map=texture(p.baseColorTexture.index,true);
      if(p.metallicRoughnessTexture)m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);
      if(s.normalTexture){m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale??1);}
    }
    if(s.alphaMode==='BLEND')m.depthWrite=false;
    materials.set(key,m);return m;
  }
  function node(s){
    const o=new THREE.Group();o.name=s.name;o.userData={...s.extras};
    if(s.matrix){new THREE.Matrix4().fromArray(s.matrix).decompose(o.position,o.quaternion,o.scale);}else{if(s.translation)o.position.fromArray(s.translation);if(s.rotation)o.quaternion.fromArray(s.rotation);if(s.scale)o.scale.fromArray(s.scale);}
    for(const p of s.primitives||[]){const g=geometry(p.geometry),m=new THREE.Mesh(g,material(p.material,!!g.attributes.color));m.name=s.name+'_表面';m.userData={kitchenApproved:'v7'};m.castShadow=true;m.receiveShadow=true;o.add(m);}
    for(const c of s.children||[])o.add(node(c));return o;
  }
  const c={material,part:(name)=>{const g=new THREE.Group();g.name='已确认厨房_'+name;g.position.set(.24,.1,-12.12);for(const s of d.parts[name])g.add(node(s));g.userData={kitchenApproved:'v7',part:name};return g;}};
  caches.set(THREE,c);return c;
}
function ageSouthKitchenDoor(THREE,root,c){
  const config=KITCHEN_DATA.southDoorAging;if(!config)return;
  const door=root.getObjectByName('厨房_前木门');if(!door)throw new Error('Kitchen south door missing');
  root.updateMatrixWorld(true);const audit=[];
  door.traverse(o=>{
    if(!o.isMesh||o.material?.userData.category!=='aged_dark_wood')return;
    let ref=o.parent;while(ref&&ref.userData.kind!=='door'&&ref.userData.kind!=='door_leaf')ref=ref.parent;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal;
    const transform=ref.matrixWorld.clone().invert().multiply(o.matrixWorld),nm=new THREE.Matrix3().getNormalMatrix(transform);
    // The pre-existing consolidated meshes retain disconnected timber pieces.
    // Classify each connected piece so rails receive grain along their length.
    const count=p.count/3,parents=Array.from({length:count},(_,i)=>i),vertices=new Map();
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
    for(let t=0;t<count;t++)for(let j=0;j<3;j++){
      const i=t*3+j,key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
      if(vertices.has(key))parents[find(t)]=find(vertices.get(key));else vertices.set(key,t);
    }
    const pieces=new Map();const q=new THREE.Vector3();
    for(let t=0;t<count;t++){const k=find(t);if(!pieces.has(k))pieces.set(k,new THREE.Box3());for(let j=0;j<3;j++){q.fromBufferAttribute(p,t*3+j).applyMatrix4(transform);pieces.get(k).expandByPoint(q);}}
    const orientations=new Map();for(const[k,b]of pieces){const size=b.getSize(new THREE.Vector3());orientations.set(k,size.x>.15&&size.x>size.y*2.2&&size.y<.17?1:0);}
    const uv=new Float32Array(p.count*2),normal=new THREE.Vector3(),stationary=ref.userData.kind==='door',D=config.domain;
    for(let i=0;i<p.count;i++){
      q.fromBufferAttribute(p,i).applyMatrix4(transform);normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();
      const x=q.x+(stationary?.45:0);let u=x,v=q.y;
      if(Math.abs(normal.x)>.7){u=.42+q.z;v=q.y;}else if(Math.abs(normal.y)>.7){u=x;v=.55+q.z;}
      uv[i*2]=(u-D[0])/(D[1]-D[0]);uv[i*2+1]=1-(v-D[2])/(D[3]-D[2]);
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.deleteAttribute('color');g.clearGroups();
    let start=0,previous=orientations.get(find(0));
    for(let t=1;t<=count;t++){const current=t<count?orientations.get(find(t)):-1;if(current!==previous){g.addGroup(start*3,(t-start)*3,previous);start=t;previous=current;}}
    o.geometry=g;o.material=config.materialIndices.map(i=>c.material(i,false));o.userData={...o.userData,southDoorAging:config.revision};
    audit.push({name:o.name,vertices:p.count,timberPieces:pieces.size,horizontalPieces:[...orientations.values()].filter(i=>i===1).length});
  });
  door.userData.noTextures=false;door.userData.southDoorAging={revision:config.revision,geometryUnchanged:true,scope:'wood frame and leaf; original hardware and opening retained',materials:config.materialIndices,meshes:audit};
}
export function installApprovedKitchen(THREE,root){if(!FAST_ENABLED("kitchen"))return;
  const c=cache(THREE),kitchen=root.getObjectByName('厨房'),gf=root.getObjectByName('L0_一楼');
  const findWall=name=>{const wall=root.getObjectByName(name);if(!wall)throw new Error('Kitchen wall missing: '+name);return wall.getObjectByName('完整墙体');};
  const north=findWall('北_厨房后弄墙'),south=findWall('南_厨房前墙'),west=findWall('西_厨房边墙'),east=findWall('中隔墙_一楼');
  root.updateMatrixWorld(true);
  const add=(name,parent)=>{const g=c.part(name);root.add(g);root.updateMatrixWorld(true);parent.attach(g);return g;};
  const replaceSurface=(wall,name)=>{
    const remove=[];wall.traverse(o=>{if(o.isMesh&&(/内墙_旧石灰灰泥|内侧石灰饰面|石灰墙面_顶点色渗痕/.test(o.name)))remove.push(o);});for(const o of remove)o.removeFromParent();return add(name,wall);
  };
  const oldFloor=kitchen.getObjectByName('厨房_地砖');for(const child of [...oldFloor.children])if(child.name!=='楼板实心分块')child.removeFromParent();
  add('floor',oldFloor);add('fixtures',gf);add('backsplashNorth',north);add('backsplashWest',west);
  replaceSurface(north,'plasterNorth');replaceSurface(south,'plasterSouth');replaceSurface(west,'plasterWest');
  // The east partition continues into other rooms. Preserve its structure and
  // position the approved kitchen-facing finish 2 mm in front of the old surface.
  const eastFinish=add('plasterEast',east);eastFinish.position.x-=.002;
  root.getObjectByName('厨房_通后弄木门').removeFromParent();add('northDoor',north);
  root.getObjectByName('厨房_后弄窗').removeFromParent();
  const closed=add('northWindowClosed',north),open=add('northWindowOpen',north);open.visible=false;
  installations.set(root,{closed,open});
  const keys=createKitchenKeyBunch(THREE);root.updateMatrixWorld(true);
  keys.position.copy(root.worldToLocal(new THREE.Vector3(-.826,1.1501,-14.903)));keys.rotation.y=0;
  root.add(keys);root.updateMatrixWorld(true);north.attach(keys);
  root.userData.kitchenKeys={revision:2,date:'2026-11-15',count:5,newCredits:0,placement:'北窗室内右侧露出窗台的中央',layout:'approved wide irregular fan',concept:'concepts/kitchen-keys-v1/keys-spread-concept-v1.png',source:'local procedural geometry; scene-designed keys, no real key copied'};
  root.userData.roomProgram='B1厨房已安装确认版水斗、灶台、器具、碗柜与做旧内墙地砖；其余房间保留空建筑';
  ageSouthKitchenDoor(THREE,root,c);
  root.userData.textureCount=9+KITCHEN_DATA.images.length;
  root.userData.kitchen={revision:7,approved:true,origin:[.24,.1,-12.12],size:[3.6,2.64],source:KITCHEN_DATA.source,installationDate:'2026-11-09',southDoorAging:KITCHEN_DATA.southDoorAging?.revision||null};
}

// Five distinct flat keys, open bow holes, cut teeth and a wound split ring.
export function createKitchenKeyBunch(T){
  const bunch=new T.Group();bunch.name='厨房窗台_一串旧钥匙';bunch.userData.kitchenKeyBunch=true;bunch.userData.layoutRevision=2;
  const brass=new T.MeshStandardMaterial({name:'钥匙_旧黄铜',color:0xb59854,metalness:.78,roughness:.43,vertexColors:true});
  const nickel=new T.MeshStandardMaterial({name:'钥匙_旧镍银',color:0xb2b4ac,metalness:.82,roughness:.39,vertexColors:true});
  const dark=new T.MeshStandardMaterial({name:'钥匙_铣槽暗面',color:0x625f50,metalness:.55,roughness:.62});
  const add=(parent,name,g,m)=>{const o=new T.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  function wear(g){const p=g.attributes.position,c=[];for(let i=0;i<p.count;i++){const v=.88+.12*Math.sin(p.getX(i)*941+p.getY(i)*381+p.getZ(i)*127);c.push(v,v,v);}g.setAttribute('color',new T.Float32BufferAttribute(c,3));return g;}
  // Ring stands obliquely on its lower arc; separated coils leave real wire ends.
  class Ring extends T.Curve{getPoint(t,target=new T.Vector3()){const a=-.2+t*Math.PI*3.82;return target.set(.014*Math.sin(a),.0152-.014*Math.cos(a),-.0012+t*.0024);}}
  const ring=add(bunch,'双层开口钢钥匙圈',wear(new T.TubeGeometry(new Ring(),160,.0011,10,false)),nickel);ring.geometry.rotateZ(.12);
  const specs=[[-68,-1.19,.044,0],[-34,-.59,.054,1],[0,.025,.048,0],[36,.63,.060,1],[70,1.22,.039,0]];
  specs.forEach(([arc,fan,L,silver],i)=>{
    const a=arc*Math.PI/180,headHeight=.0152-.014*Math.cos(a),key=new T.Group();key.name='旧钥匙_'+(i+1);key.userData.kitchenKeyIndex=i+1;bunch.add(key);
    key.position.set(.014*Math.sin(a),headHeight,0);key.rotation.order='YXZ';key.rotation.y=fan;key.rotation.x=Math.PI/2+Math.atan2(headHeight-.0012,L+.003);key.userData.fanAngleDegrees=fan*180/Math.PI;
    const sh=new T.Shape();sh.moveTo(-.0045,.010);sh.lineTo(-.0045,L-.002);sh.lineTo(-.002,L);sh.lineTo(.0032,L);
    for(let k=0;k<5;k++){const y=L-.004-k*.0044,depth=[.0012,.0029,.0018,.0033,.0015][(k+i)%5];sh.lineTo(.0042,y+.0015);sh.lineTo(.0042-depth,y);sh.lineTo(.0042,y-.0014);}
    sh.lineTo(.0045,.010);for(let k=0;k<=48;k++){const t=(60-k*300/48)*Math.PI/180;const r=i===2?1+.10*Math.cos(6*t):i===1||i===4?.92/Math.max(Math.abs(Math.cos(t)),Math.abs(Math.sin(t))):1;sh.lineTo(.009*r*Math.cos(t),.0115*r*Math.sin(t));}sh.closePath();
    const eye=new T.Path();eye.absellipse(0,-.003,.0042,.0046,0,Math.PI*2,true);sh.holes.push(eye);
    const geo=new T.ExtrudeGeometry(sh,{depth:.0017,bevelEnabled:true,bevelThickness:.00018,bevelSize:.00018,bevelSegments:2,steps:1,curveSegments:24});geo.translate(0,.003,-.00085);
    add(key,'带齿与穿孔的钥匙片_'+(i+1),wear(geo),silver?nickel:brass);
    const groove=add(key,'钥匙片纵向铣槽_'+(i+1),new T.BoxGeometry(.00065,L-.020,.00012),dark);groove.position.set(-.0021,(L+.020)/2,-.00093);
    // Each blade rests on the sill while its bow stays threaded on the lower ring arc.
    let lo=0,hi=.42;for(let j=0;j<28;j++){const tilt=(lo+hi)/2;key.rotation.x=Math.PI/2+tilt;key.updateMatrixWorld(true);const minY=new T.Box3().setFromObject(key,true).min.y;if(minY>.0002)lo=tilt;else hi=tilt;}key.rotation.x=Math.PI/2+(lo+hi)/2;
  });
  bunch.updateMatrixWorld(true);const bottom=new T.Box3().setFromObject(bunch,true).min.y;
  for(const child of bunch.children)child.position.y-=bottom;
  return bunch;
}
export function updateApprovedKitchen(root,windowsOpen){const i=installations.get(root);if(i){i.closed.visible=!windowsOpen;i.open.visible=!!windowsOpen;}}
