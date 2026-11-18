import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { DOOR_HANDLES_DATA } from './door-handles-data.js';
import { installRearRimLock, updateRearRimLock } from './rear-rim-lock.js';

// Nine B1 doors share the approved knobs; the kitchen north door uses a rim lock.
const caches = new WeakMap();

function cache(THREE) {
  if (caches.has(THREE)) return caches.get(THREE);
  const d = DOOR_HANDLES_DATA, geometries = [], materials = new Map(), textures = new Map();
  const arrays = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function attribute(a) { const raw = FAST_BYTES(a); return new THREE.BufferAttribute(new arrays[a.type](raw.buffer), a.size, !!a.normalized); }
  function geometry(i) {
    if (geometries[i]) return geometries[i];
    const s = d.geometries[i], g = new THREE.BufferGeometry(), names = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color', TANGENT: 'tangent' };
    for (const [k, a] of Object.entries(s.attributes)) g.setAttribute(names[k], attribute(a));
    if (s.indices) g.setIndex(attribute(s.indices));
    g.computeBoundingSphere(); return geometries[i] = g;
  }
  function texture(info, color = false) {
    const i = info.index, channel = info.texCoord || 0, key = i + ':' + color + ':' + channel;
    if (textures.has(key)) return textures.get(key);
    const def = d.textures[i], im = d.images[def.source], sam = d.samplers[def.sampler] || {};
    const t = new THREE.TextureLoader().load(new URL(im.url,import.meta.url).href, () => { window.dispatchEvent(new Event('shikumen-asset-ready')); });
    t.flipY = false; t.channel = channel; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = sam.wrapS === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = sam.wrapT === 33071 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 8; textures.set(key, t); return t;
  }
  function material(i) {
    if (materials.has(i)) return materials.get(i);
    const s = d.materials[i], p = s.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1];
    const m = new THREE.MeshStandardMaterial({ name: s.name + '_门把手本地v2', color: new THREE.Color().setRGB(...f.slice(0, 3)), opacity: f[3], transparent: s.alphaMode === 'BLEND',
      alphaTest: s.alphaMode === 'MASK' ? (s.alphaCutoff ?? .5) : 0, side: s.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: p.roughnessFactor ?? 1, metalness: p.metallicFactor ?? 1 });
    if (s.alphaMode === 'BLEND') { m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
    m.userData = { asset: d.assetId, doorHandlesMaterial: i, houseDoorHandlesRevision: 1 };
    if (typeof document !== 'undefined') {
      if (p.baseColorTexture) m.map = texture(p.baseColorTexture, true);
      if (p.metallicRoughnessTexture) { m.roughnessMap = m.metalnessMap = texture(p.metallicRoughnessTexture); }
      if (s.normalTexture) { m.normalMap = texture(s.normalTexture); m.normalScale.setScalar(s.normalTexture.scale ?? 1); }
    }
    materials.set(i, m); return m;
  }
  function node(s) {
    const o = new THREE.Group(); o.name = s.name; o.userData = { ...s.extras };
    if (s.matrix) new THREE.Matrix4().fromArray(s.matrix).decompose(o.position, o.quaternion, o.scale);
    else { if (s.translation) o.position.fromArray(s.translation); if (s.rotation) o.quaternion.fromArray(s.rotation); if (s.scale) o.scale.fromArray(s.scale); }
    for (const p of s.primitives || []) {
      const m = new THREE.Mesh(geometry(p.geometry), material(p.material)); m.name = s.name + '_表面'; m.userData = { houseDoorHandlesRevision: 1 };
      m.castShadow = true; m.receiveShadow = true; o.add(m);
    }
    for (const ch of s.children || []) o.add(node(ch));
    return o;
  }
  const c = { node, materials }; caches.set(THREE, c); return c;
}

// Keep source meshes intact; only the installation spacers, spindle and latch backset vary.
const installations = new WeakMap();
const DOORS = [
  ['前厢_木门','老人房',-1,'panel'], ['中厢_木门','中厢工作间',-1,'panel'],
  ['后厢_木门','后厢杂物间',-1,'panel'], ['厨房_前木门','厨房南门',-1,'thick'],
  ['厨房_通后弄木门','厨房北门',-1,'north'], ['亭子间_前木门','亭子间',-1,'thick'],
  ['前厢二层_木门','夫妻婚房',-1,'panel'], ['后厢二层_共用廊门','孩子房',-1,'panel'],
  ['前楼_门','二楼起居间',1,'panel'], ['后楼小间_木门','衣被储藏间',-1,'panel'],
];

function retireOldHandles(T, leaf, type) {
  const removed=[];
  // The two early thick doors consolidated handles and hinges into one mesh.
  // Remove only complete handle triangles, preserving hinge and bolt attributes.
  if(type==='thick') {
    for(const o of [...leaf.children]) {
      if(!o.isMesh||!o.name.endsWith('MAT_JOINERY_old_iron'))continue;
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,keep=[],p=g.attributes.position,q=new T.Vector3();
      let retired=0;
      for(let i=0;i<p.count;i+=3){
        let handle=true;
        for(let j=0;j<3;j++){q.fromBufferAttribute(p,i+j).applyMatrix4(o.matrix);handle&&=q.x>.65&&q.y>.88&&q.y<1.15&&q.z>.09;}
        if(handle)retired++;else keep.push(i,i+1,i+2);
      }
      if(!retired)throw Error('Old thick-door handle not found: '+leaf.parent.name);
      const out=new T.BufferGeometry();
      for(const[k,a]of Object.entries(g.attributes)){const arr=new a.array.constructor(keep.length*a.itemSize);keep.forEach((j,i)=>{for(let n=0;n<a.itemSize;n++)arr[i*a.itemSize+n]=a.array[j*a.itemSize+n]});out.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
      out.computeBoundingSphere();o.geometry=out;removed.push({name:'consolidated bow handle',triangles:retired});
    }
  } else {
    const old=[];leaf.traverse(o=>{if(/老木门_(旧铁拉手底板|弓形拉手)$/.test(o.name)||/^厨房修正_门把(底板|横柄|短轴)(\.\d+)?$/.test(o.name))old.push(o);});
    for(const o of old){removed.push({name:o.name});o.removeFromParent();}
    if(!removed.length)throw Error('Old handles not found: '+leaf.parent.name);
  }
  return removed;
}

// Rectangular mortises behind the original metal apertures; retain each wood material group.
function mortise(T, reference, meshes, bounds){
 reference.updateWorldMatrix(true,true);const inv=reference.matrixWorld.clone().invert(),planes=[0,1,2].flatMap(axis=>[{axis,value:bounds[0][axis],sign:1},{axis,value:bounds[1][axis],sign:-1}]);
 let count=0;
 for(const o of meshes){
  o.updateWorldMatrix(true,false);const matrix=inv.clone().multiply(o.matrixWorld);if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  if(!o.geometry.boundingBox.clone().applyMatrix4(matrix).intersectsBox(new T.Box3(new T.Vector3(...bounds[0]),new T.Vector3(...bounds[1]))))continue;
  const source=o.geometry.index?o.geometry.toNonIndexed():o.geometry,groups=source.groups.length?source.groups:[{start:0,count:source.attributes.position.count,materialIndex:0}],parts=[];
  for(const group of groups){
   const part=new T.BufferGeometry();for(const[k,a]of Object.entries(source.attributes))part.setAttribute(k,new T.BufferAttribute(a.array.slice(group.start*a.itemSize,(group.start+group.count)*a.itemSize),a.itemSize,a.normalized));
   const result=sliceGeometry(T,part,matrix,planes);part.dispose();result.inside?.dispose();if(result.outside)parts.push({g:result.outside,materialIndex:Array.isArray(o.material)?group.materialIndex:0});
  }
  const out=new T.BufferGeometry(),total=parts.reduce((n,p)=>n+p.g.attributes.position.count,0);
  for(const[k,a]of Object.entries(source.attributes)){const arr=new a.array.constructor(total*a.itemSize);let offset=0;for(const p of parts){arr.set(p.g.attributes[k].array,offset);offset+=p.g.attributes[k].array.length;}out.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));}
  let start=0;for(const p of parts){const n=p.g.attributes.position.count;out.addGroup(start,n,p.materialIndex);start+=n;p.g.dispose();}
  out.computeBoundingSphere();o.geometry=out;count++;
 }
 return count;
}
function woodMeshes(group){const a=[];group.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.metalness<.2))a.push(o);});return a;}

// Three older frames are a single joined mesh. Separate their original connected
// timbers for this cut, then rejoin with every original UV and material intact.
function trimJoinedFrameStiles(T,door,height) {
  let trimmed=0;
  door.updateWorldMatrix(true,true);const inv=door.matrixWorld.clone().invert();
  const meshes=[];door.traverse(o=>{
    if(!o.isMesh||!o.name.includes('MAT_JOINERY_')||!(Array.isArray(o.material)?o.material:[o.material]).every(m=>m.metalness<.2))return;
    for(let p=o;p!==door;p=p.parent)if(p.userData.kind==='door_leaf')return;
    meshes.push(o);
  });
  for(const o of meshes){
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,p=g.attributes.position,count=p.count/3;
    const parents=Array.from({length:count},(_,i)=>i),vertices=new Map();
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i};
    for(let i=0;i<p.count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(','),t=Math.floor(i/3);
      if(vertices.has(key))parents[find(t)]=find(vertices.get(key));else vertices.set(key,t);
    }
    const groups=new Map();for(let t=0;t<count;t++){const key=find(t);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t*3,t*3+1,t*3+2)}
    const transform=inv.clone().multiply(o.matrixWorld),parts=[];let changed=false;
    for(const indices of groups.values()){
      let part=new T.BufferGeometry();
      for(const[k,a]of Object.entries(g.attributes)){
        const arr=new a.array.constructor(indices.length*a.itemSize);
        indices.forEach((i,j)=>{for(let n=0;n<a.itemSize;n++)arr[j*a.itemSize+n]=a.array[i*a.itemSize+n]});
        part.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));
      }
      if(Array.isArray(o.material))for(let i=0;i<indices.length;i+=3){
        const mi=g.groups.find(group=>indices[i]>=group.start&&indices[i]<group.start+group.count)?.materialIndex||0,last=part.groups.at(-1);
        if(last&&last.materialIndex===mi&&last.start+last.count===i)last.count+=3;else part.addGroup(i,3,mi);
      }
      part.computeBoundingBox();const box=part.boundingBox.clone().applyMatrix4(transform),size=box.getSize(new T.Vector3());
      if(size.y>height&&size.x<.09&&size.z>.13&&Math.abs(box.min.y)<.002){
        const cut=sliceGeometry(T,part,transform,[{axis:1,value:height-.005,sign:-1}]);
        part.dispose();cut.outside?.dispose();part=cut.inside;trimmed++;changed=true;
      }
      if(part)parts.push(part);
    }
    if(changed){
      const out=new T.BufferGeometry(),total=parts.reduce((n,p)=>n+p.attributes.position.count,0);
      for(const[k,a]of Object.entries(g.attributes)){
        const arr=new a.array.constructor(total*a.itemSize);let offset=0;
        for(const part of parts){arr.set(part.attributes[k].array,offset);offset+=part.attributes[k].array.length}
        out.setAttribute(k,new T.BufferAttribute(arr,a.itemSize,a.normalized));
      }
      if(Array.isArray(o.material)){let start=0;for(const part of parts){for(const group of part.groups)out.addGroup(start+group.start,group.count,group.materialIndex);start+=part.attributes.position.count}}
      out.computeBoundingSphere();o.geometry=out;
    }
    for(const part of parts)part.dispose();
  }
  return trimmed;
}

// The original wall opening is the clear opening. Its reveal must not remain
// on the inner face of the timber frame fitted around it. Cut only the buried
// wall surfaces, including the low-wall alternative used in section views.
function repairDoorFrameSurfaces(T, root) {
  const walls=[];
  root.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    let wall=false;
    for(let p=o;p&&p!==root;p=p.parent){
      if(['door','door_leaf','window','window_leaf'].includes(p.userData.kind))return;
      if(p.userData.kind==='wall')wall=true;
    }
    if(wall)walls.push(o);
  });
  const audit=[];
  for(const[name,room,,type]of DOORS){
    const door=root.getObjectByName(name),[w,h]=door.userData.clearOpening;
    if(door.userData.frameSurfaceCorrection==='20261111-recess-and-butt-joints'){
      audit.push({room,existingCorrectionPreserved:true});continue;
    }
    let joints=0;
    if(type==='panel'){
      // Side stiles meet the underside of the head; stop strips butt into the
      // horizontal stop instead of drawing two wood faces at the same depth.
      for(const o of door.children){
        if(o.name.startsWith('老木门框_通长边挺'))
          joints+=mortise(T,door,[o],[[-w,h-.005,-.10],[w,h+.10,.10]]);
        else if(o.name.startsWith('老木门框_前侧止口'))
          joints+=mortise(T,door,[o],[[-w,h-.014,-.10],[w,h+.10,.10]]);
        else if(o.name==='老木门框_上止口'){
          o.geometry=o.geometry.clone();o.geometry.scale((w-.016)/(w-.012),.009/.014,1);
          o.position.y=h-.0095;joints++;
        }
      }
    }
    const joinedStiles=type==='panel'?0:trimJoinedFrameStiles(T,door,h);
    let wallMeshes=0;
    const epsilon=.00002,depth=.075+epsilon;
    const cuts=[
      [[-w/2-.065-epsilon,-epsilon,-depth],[-w/2+.006,h-.005,depth]],
      [[w/2-.006,-epsilon,-depth],[w/2+.065+epsilon,h-.005,depth]],
      [[-w/2-.065-epsilon,h-.005-epsilon,-depth],[w/2+.065+epsilon,h+.065+epsilon,depth]],
    ];
    for(const bounds of cuts)wallMeshes+=mortise(T,door,walls,bounds);
    audit.push({room,wallMeshCuts:wallMeshes,buttJointParts:joints,joinedStiles,clearOpening:[w,h]});
  }
  root.userData.doorSurfaceRepair={date:'2026-11-14',method:'remove buried wall reveals and overlapping timber joint faces',doors:audit};
}

function reflection(T){
  const w=128,h=64,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=(x+.5)/w,v=(y+.5)/h,base=.15+.12*Math.max(0,Math.sin((v-.5)*Math.PI));
    const panel=(cu,cv,su,sv,p)=>p*Math.exp(-Math.pow((u-cu)/su,6)-Math.pow((v-cv)/sv,6));
    const light=panel(.23,.57,.09,.21,1.9)+panel(.72,.62,.14,.17,1.2)+.3*Math.exp(-Math.pow((v-.88)/.07,4));
    const i=4*(y*w+x);data[i]=base+light;data[i+1]=base+light*.985;data[i+2]=base+light*.96;data[i+3]=1;
  }
  const t=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);t.mapping=T.EquirectangularReflectionMapping;t.colorSpace=T.LinearSRGBColorSpace;t.needsUpdate=true;t.name='门把手_室内柔和反射';return t;
}

export function installHouseDoorHandles(T, root) {if(!FAST_ENABLED("door-handles"))return;
  if(installations.has(root))return;
  const c=cache(T),records=[],audit=[];let env;
  for(const [name,room,inside,type]of DOORS){
    const door=root.getObjectByName(name),leaf=door?.children.find(o=>o.userData.kind==='door_leaf');
    if(!leaf)throw Error('Door for approved handles missing: '+name);
    const originalAngle=leaf.rotation.y;leaf.rotation.y=0;root.updateMatrixWorld(true);
    const removed=retireOldHandles(T,leaf,type),edge=type==='panel'?leaf.userData.leafWidth+.003:.885;
    if(type==='north') {
      installRearRimLock(T,root,door,leaf,removed,mortise);
      if(typeof document!=='undefined'){
        env ||= reflection(T);
        door.traverse(o=>{if(o.isMesh&&o.userData.rearRimLockRevision&&o.material.metalness>.7){o.material.envMap=env;o.material.envMapIntensity=.65;}});
      }
      leaf.rotation.y=originalAngle;
      continue;
    }
    const thickness=type==='panel'?.048:.088,centre=type==='panel'?.026:type==='north'?-.040:.048;
    // Narrow original stiles need a shorter concealed backset, never a floating rosette.
    const backset=type==='panel'?.060:.040,height=Math.min(1.06,door.userData.clearOpening[1]*.49),axis=edge-backset;
    const set=c.node(DOOR_HANDLES_DATA.node);set.name='已确认球形门锁_'+room;
    set.position.set(axis,height,centre);set.rotation.x=inside===1?0:Math.PI;
    set.userData={doorHandleSet:true,houseDoorHandlesRevision:1,room,door:name,insideSign:inside,backset,thickness};
    leaf.add(set);
    const inner=set.getObjectByName('H01-inner_内侧保险钮'),outer=set.getObjectByName('H01-outer_外侧内凹锁孔');
    inner.position.z=thickness/2+.00015;outer.position.z=-thickness/2-.00015;
    const shaft=set.getObjectByName('H01_随把手转动方轴');shaft.scale.z=(thickness+.045)/.090;
    const housing=set.getObjectByName('H01_锁舌壳体');housing.position.x=(.004+backset-.002)/2;housing.scale.y=(backset-.006)/.056;
    for(const o of set.children)if(o.name==='H01_门边锁舌面板'||o.name.startsWith('H01_面板固定螺钉')||o.name==='H01_活动斜舌')o.position.x+=backset-.062;
    const latch=set.getObjectByName('H01_活动斜舌'),latchHome=latch.position.x;
    const keeper=set.getObjectByName('H01_独立门框扣座'),gap=door.userData.clearOpening[0]/2-(leaf.position.x+edge);
    const pad=Math.max(0,gap-.003),effectiveGap=gap-pad;
    keeper.position.x+=backset+effectiveGap+.001-.070;
    const wood=door.children.filter(o=>o!==leaf).flatMap(woodMeshes);
    if(pad>.0001){
      const candidates=wood.map(o=>Array.isArray(o.material)?o.material[0]:o.material);
      const material=candidates.find(m=>m.userData.asset)||candidates[0];
      const support=new T.Mesh(new T.BoxGeometry(pad,.096,.048),material);support.name='锁扣实木垫座_'+room;
      support.position.set(leaf.position.x+edge+gap-pad/2,height,leaf.position.z+centre);support.castShadow=support.receiveShadow=true;
      support.userData={doorHandlePacking:true,houseDoorHandlesRevision:1};door.add(support);wood.push(support);
    }
    const faceX=leaf.position.x+edge+effectiveGap,faceZ=leaf.position.z+centre;
    const frameMortises=mortise(T,door,wood,[[faceX-.002,height-.0098,faceZ-.0098],[faceX+.023,height+.0098,faceZ+.0098]]);
    const leafWood=woodMeshes(leaf).filter(o=>!o.userData.houseDoorHandlesRevision);
    const leafMortises=mortise(T,leaf,leafWood,[[edge-.023,height-.0085,centre-.0085],[edge+.003,height+.0085,centre+.0085]]);
    // Seat the complete metal plates in the timber, not just their latch holes.
    // Their outer faces were exactly coplanar with the uncut wood, causing flicker.
    const framePlateSeats=mortise(T,door,wood,[[faceX-.0002,height-.0292,faceZ-.0147],[faceX+.0023,height+.0292,faceZ+.0147]]);
    const leafPlateSeats=mortise(T,leaf,leafWood,[[edge-.0023,height-.0282,centre-.0122],[edge+.0003,height+.0282,centre+.0122]]);
    root.updateMatrixWorld(true);door.attach(keeper);keeper.name='固定门框锁扣_'+room;keeper.userData={doorHandleKeeper:true,room,houseDoorHandlesRevision:1};
    const grips=[inner.getObjectByName('H01-inner_可旋拧把手'),outer.getObjectByName('H01-outer_可旋拧把手')];
    const rotations=grips.map(g=>g.quaternion.clone());records.push({leaf,set,keeper,latch,latchHome,grips,rotations});
    if(typeof document!=='undefined'){
      env ||= reflection(T);
      set.traverse(o=>{if(!o.isMesh||o.material.metalness<.7)return;o.material.envMap=env;o.material.envMapIntensity=.75;});
      keeper.traverse(o=>{if(o.isMesh&&o.material.metalness>=.7){o.material.envMap=env;o.material.envMapIntensity=.75;}});
    }
    leaf.userData.doorHandleRevision='local-v2-installed-20261114';
    audit.push({door:name,room,insideSign:inside,axis:[axis,height,centre],edge,thickness,backset,frameGap:gap,packingDepth:pad,effectiveGap,frameMortises,leafMortises,framePlateSeats,leafPlateSeats,removed});
    leaf.rotation.y=originalAngle;
  }
  installations.set(root,records);root.userData.doorHandles={revision:3,source:DOOR_HANDLES_DATA.source,count:records.length,plateSeatRevision:'20261117',doors:audit,excluded:['入户黑漆双门','客堂六扇隔扇','厨房北门（另装方盒明装锁）'],newCredits:0};
  root.userData.textureCount=(root.userData.textureCount||0)+DOOR_HANDLES_DATA.images.length;
  repairDoorFrameSurfaces(T,root);
  updateHouseDoorHandles(root);root.updateMatrixWorld(true);
}

export function updateHouseDoorHandles(root){
  updateRearRimLock(root);
  for(const r of installations.get(root)||[]){
    // The door toggle first retracts the latch, then swings the leaf.
    const t=Math.abs(r.leaf.rotation.y)>1e-5?1:0;
    r.latch.position.x=r.latchHome-.017*t;
    r.grips.forEach((g,i)=>{g.quaternion.copy(r.rotations[i]);g.rotateZ((i===0?-.65:.65)*t);});
  }
}
