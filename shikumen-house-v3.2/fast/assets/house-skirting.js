import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { HOUSE_SKIRTING_DATA } from './house-skirting-data.js';
import { sliceGeometry } from './courtyard.js';

// B1 only: the two accepted 120 mm samples, fitted to the finished wall faces.
// Coordinates use the house frame, even when a wall lives in a translated group.
const caches=new WeakMap();
function materials(T){
 if(caches.has(T))return caches.get(T);
 const d=HOUSE_SKIRTING_DATA,tex=new Map();
 const texture=(i,color=false)=>{const key=i+':'+color;if(tex.has(key))return tex.get(key);const im=d.images[d.textures[i].source],t=new T.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>window.dispatchEvent(new Event('shikumen-asset-ready')));t.flipY=false;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;tex.set(key,t);return t;};
 const result=d.materials.map((s,i)=>{const p=s.pbrMetallicRoughness,m=new T.MeshStandardMaterial({name:s.name,color:new T.Color().fromArray(p.baseColorFactor),roughness:p.roughnessFactor,metalness:0});m.userData={asset:d.assetId,skirtingMaterial:i};if(typeof document!=='undefined'){m.map=texture(p.baseColorTexture.index,true);m.roughnessMap=texture(p.metallicRoughnessTexture.index);m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale);}return m;});
 caches.set(T,result);return result;
}
function stripGeometry(T,a,b,normal,floor,height,thick,wood,offset,endThickness=thick,outwardCaps=false){
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,bevel=Math.min(wood?.002:.003,thick*.3,endThickness*.3);
 const profile=[[0,0],[thick,0],[thick,height-bevel],[thick-bevel,height],[0,height]],pos=[],uv=[],faces=[];
 const point=(s,k)=>[a[0]+dx*s+normal[0]*profile[k][0]*(1+(endThickness/thick-1)*s/length),floor+profile[k][1],a[1]+dz*s+normal[1]*profile[k][0]*(1+(endThickness/thick-1)*s/length)];
 for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length;faces.push([[0,i],[length,i],[length,j]],[[0,i],[length,j],[0,j]]);}
 for(let i=1;i<profile.length-1;i++)if(outwardCaps)faces.push([[0,0],[0,i],[0,i+1]],[[length,0],[length,i+1],[length,i]]);else faces.push([[0,0],[0,i+1],[0,i]],[[length,0],[length,i],[length,i+1]]);
 for(const face of faces)for(const[s,k]of face){pos.push(...point(s,k));const[dep,h]=profile[k];if(wood)uv.push((h+dep)/.5+offset,1-(s+offset)/1.5);else uv.push((s+offset)/1.2,(h+dep)/1.2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 if(dx*normal[1]-dz*normal[0]<0){for(let i=0;i<g.attributes.position.count;i+=3)for(const at of[g.attributes.position,g.attributes.uv])for(let c=0;c<at.itemSize;c++){const k=(i+1)*at.itemSize+c,j=(i+2)*at.itemSize+c,tmp=at.array[k];at.array[k]=at.array[j];at.array[j]=tmp;}}
 g.computeVertexNormals();
 const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
 for(let i=0;i<p.count;i++)if(Math.abs(n.getX(i)*dx+n.getZ(i)*dz)>.9){const depth=(p.getX(i)-a[0])*normal[0]+(p.getZ(i)-a[1])*normal[1];u.setXY(i,depth/.5+offset,(p.getY(i)-floor)/.5+offset);}
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function replaceGroundFloors(T,root,wood){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),sources=[];
 const upper=root.getObjectByName('二楼_东厢连续木楼板_共用廊与三间');
 upper.traverse(o=>{if(o.isMesh&&o.userData.maritalSurface==='floor')sources.push(o);});
 if(!sources.length)throw Error('已确认婚房杉木地板缺失');
 const planes=[{axis:0,value:4.02,sign:1},{axis:0,value:6.96,sign:-1},{axis:2,value:-5.16,sign:1},{axis:2,value:-.24,sign:-1}],audit=[];
 for(const[label,floorName,z0,length]of[['老人房','前厢_地面',-.24,4.92],['中厢工作间','中厢_地面',-5.28,4.86]]){
  const floor=root.getObjectByName(floorName),removed=[];
  for(const child of [...floor.children]){if(child.name!=='楼板实心分块'){removed.push(child.name);child.removeFromParent();}else{
   const mat=wood.clone();mat.name='旧杉木地板垫层';child.material=mat;const g=child.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,u=[];
   for(let i=0;i<p.count;i++)u.push((Math.abs(n.getX(i))>.8?p.getY(i):p.getX(i))/.5,1-(Math.abs(n.getZ(i))>.8?p.getY(i):p.getZ(i))/1.5);
   g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.deleteAttribute('color');child.geometry=g;
  }}
  let count=0;
  for(const source of sources){const transform=inv.clone().multiply(source.matrixWorld),part=sliceGeometry(T,source.geometry,transform,planes).inside;if(!part)continue;
   part.applyMatrix4(transform);const p=part.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i),p.getY(i)-3.9,z0+(p.getZ(i)+.24)*length/4.92);part.computeBoundingBox();part.computeBoundingSphere();
   const m=new T.Mesh(part,source.material);m.name=label+'_17cm旧杉木地板';m.castShadow=m.receiveShadow=true;m.userData={houseFloorRevision:'20261114',room:label,source:'已确认夫妻婚房杉木地板',floorSurface:true,top:.1};floor.updateWorldMatrix(true,false);m.applyMatrix4(floor.matrixWorld.clone().invert().multiply(root.matrixWorld));floor.add(m);count++;
  }
  if(!count)throw Error('地板复制为空: '+label);floor.userData={...floor.userData,floorFinish:'wood',houseFloorRevision:'20261114'};audit.push({room:label,floorName,removed,newMeshCount:count,level:.1,originalFloorLevelPreserved:true,source:'婚房_原17cm杉木板_做旧'});
 }
 return audit;
}
// These two original thick doors hinged at the front skin and swept through
// the plaster when opened. Put the joint and its hinge hardware on the rear
// edge, like the existing entrance-door joint, without moving the closed leaf.
function fitThickDoorPivots(T,root){
 const audit=[];
 for(const name of ['厨房_前木门','亭子间_前木门']){
  const door=root.getObjectByName(name),leaf=door?.children.find(o=>o.userData.kind==='door_leaf');if(!leaf)throw Error('厚木门缺失: '+name);
  const originalAngle=leaf.rotation.y,h=door.userData.clearOpening[1],hy=[h*.17,h*.80];leaf.rotation.y=0;root.updateMatrixWorld(true);
  const oldPivot=leaf.position.z,leafInv=leaf.matrixWorld.clone().invert(),doorInv=door.matrixWorld.clone().invert(),body=[];
  leaf.traverse(o=>{if(o.isMesh&&!(/铁|metal|iron/i.test(o.name)))body.push({o,matrix:o.matrixWorld.clone()});});
  let movingVertices=0,fixedVertices=0;
  function modify(o,frameInv,moving){
   if(!o.isMesh||!(/铁|metal|iron/i.test(o.name)))return;
   const transform=frameInv.clone().multiply(o.matrixWorld),back=transform.clone().invert(),normalTransform=new T.Matrix3().getNormalMatrix(transform),normalBack=new T.Matrix3().getNormalMatrix(back),g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,q=new T.Vector3(),normal=new T.Vector3();let changed=0;
   const selected=[];
   for(let i=0;i<p.count;i++){
    q.fromBufferAttribute(p,i).applyMatrix4(transform);
    const ok=hy.some(y=>Math.abs(q.y-y)<.07)&&(moving?Math.abs(q.x)<.06&&Math.abs(q.z)<.025:Math.abs(q.x-leaf.position.x)<.055&&Math.abs(q.z-.038)<.006);
    selected.push(ok);if(!ok)continue;
    q.z=moving?-q.z-.088:q.z-.082;q.applyMatrix4(back);p.setXYZ(i,q.x,q.y,q.z);
    if(moving&&n){normal.fromBufferAttribute(n,i).applyMatrix3(normalTransform);normal.z=-normal.z;normal.applyMatrix3(normalBack).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}changed++;
   }
   if(!changed){g.dispose();return;}
   if(moving)for(let i=0;i<p.count;i+=3){if(selected[i]!==selected[i+1]||selected[i]!==selected[i+2])throw Error('铰链范围穿过非铰链面');if(selected[i])for(const attr of Object.values(g.attributes))for(let k=0;k<attr.itemSize;k++){const a=(i+1)*attr.itemSize+k,b=(i+2)*attr.itemSize+k,t=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=t;}}
   g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;if(moving)movingVertices+=changed;else fixedVertices+=changed;
  }
  leaf.traverse(o=>modify(o,leafInv,true));for(const o of door.children)if(o!==leaf)o.traverse(m=>modify(m,doorInv,false));
  leaf.position.z-=.088;for(const child of leaf.children)child.position.z+=.088;root.updateMatrixWorld(true);
  const maxClosedTransformError=Math.max(0,...body.flatMap(({o,matrix})=>o.matrixWorld.elements.map((v,i)=>Math.abs(v-matrix.elements[i]))));
  if(maxClosedTransformError>1e-10||!movingVertices||!fixedVertices)throw Error('厚门门轴校正未保持关门位置');
  leaf.userData={...leaf.userData,pivotAtRear:true,skirtingDoorFitRevision:'20261114'};leaf.rotation.y=originalAngle;
  audit.push({door:name,oldPivotZ:oldPivot,newPivotZ:leaf.position.z,closedBodyPositionPreserved:true,maxClosedTransformError,movingHingeVertices:movingVertices,fixedHingeVertices:fixedVertices});
 }
 root.updateMatrixWorld(true);return audit;
}

export function installHouseSkirting(T,root){if(!FAST_ENABLED("house-skirting"))return;
 if(root.userData.houseSkirting)return;
 const[wood,cement]=materials(T),floorChanges=replaceGroundFloors(T,root,wood),doorFit=fitThickDoorPivots(T,root),records=[];
 root.updateMatrixWorld(true);
 const resolve=name=>Array.isArray(name)?root.getObjectsByProperty('name',name[0])[name[1]]:root.getObjectByName(name);
 function attach(mesh,parent){parent.updateWorldMatrix(true,false);mesh.applyMatrix4(parent.matrixWorld.clone().invert().multiply(root.matrixWorld));parent.add(mesh);}
 function run(room,kind,wallName,axis,fixed,from,to,sign,y,extraCuts=[],options={}){
  const wall=resolve(wallName);if(!wall)throw Error('踢脚所依附墙体缺失: '+wallName);
  const height=.12,thick=options.thickness??(kind==='wood'?.014:.008),holes=(wall.userData.openings||[]).filter(h=>h.y0<y+height&&h.y1>y+.001).map(h=>[h.a-.001,h.b+.001]);
  const cuts=[...holes,...extraCuts].filter(([a,b])=>b>from&&a<to).sort((a,b)=>a[0]-b[0]);let spans=[[from,to]];
  for(const[a,b]of cuts)spans=spans.flatMap(([s,e])=>b<=s||a>=e?[[s,e]]:[[s,Math.max(s,a)],[Math.min(e,b),e]].filter(([u,v])=>v-u>.003));
  for(const[s,e]of spans){if(e-s<.015)continue;const a=axis==='x'?[s,fixed]:[fixed,s],b=axis==='x'?[e,fixed]:[fixed,e],normal=axis==='x'?[0,sign]:[sign,0];
   const index=records.length,g=stripGeometry(T,a,b,normal,y,height,thick,kind==='wood',.13+(index%9)*.117,options.endThickness??thick,!!options.outwardCaps),mesh=new T.Mesh(g,kind==='wood'?wood:cement);
   mesh.name=(kind==='wood'?'木踢脚_':'水泥踢脚_')+room+'_'+index;mesh.castShadow=mesh.receiveShadow=true;mesh.userData={houseSkirtingRevision:'20261114',skirtingRoom:room,skirtingKind:kind,height,thickness:thick,endThickness:options.endThickness??thick,wallFixed:true,wallName:wall.name};
   const full=options.full||wall.getObjectByName('完整墙体')||wall;attach(mesh,full);
   // Wall cuts are alternate representations of the same wall, never two active strips.
   const low=options.low||wall.children.find(o=>/^剖切/.test(o.name));if(low){const copy=new T.Mesh(g,mesh.material);copy.name=mesh.name;copy.castShadow=copy.receiveShadow=true;copy.userData={...mesh.userData,cutRepresentation:true};attach(copy,low);}
   records.push({name:mesh.name,room,kind,wall:wall.name,a,b,normal,floor:y,height,thickness:thick,endThickness:options.endThickness??thick,hasCutRepresentation:!!low});
  }
 }
 function rectangle(room,kind,x0,x1,north,south,y,walls,cut={}){
  const t=kind==='wood'?.014:.008;
  if(walls.west)run(room,kind,walls.west,'z',x0,north,south,1,y,cut.west);
  if(walls.east)run(room,kind,walls.east,'z',x1,north,south,-1,y,cut.east);
  if(walls.north)run(room,kind,walls.north,'x',north,x0+t,x1-t,1,y,cut.north);
  if(walls.south)run(room,kind,walls.south,'x',south,x0+t,x1-t,-1,y,cut.south);
 }
 const lower={west:'中隔墙_一楼',east:'东_厢房承重墙_一楼'};
 rectangle('老人房','wood',4.024,6.956,-5.159,-.244,.1,{...lower,south:'南_侧厢一层外墙',north:['厢房_一楼分隔',0]});
 rectangle('中厢工作间','wood',4.024,6.956,-10.141,-5.279,.1,{...lower,south:['厢房_一楼分隔',0],north:['厢房_一楼分隔',1]});
 rectangle('后厢杂物间','cement',4.024,6.956,-14.756,-10.259,.1,{...lower,south:['厢房_一楼分隔',1],north:'北_侧厢一层外墙'});
 rectangle('客堂','cement',.245,3.836,-7.739,-3.244,.1,{west:'西_主屋承重墙_一楼',east:'中隔墙_一楼',north:'客堂后隔墙_双通口',south:'南_客堂木立面'});
 rectangle('厨房','cement',.245,3.836,-14.755,-12.125,.1,{west:'西_厨房边墙',east:'中隔墙_一楼',north:'北_厨房后弄墙',south:'南_厨房前墙'},
  {west:[[-14.756,-12.35]],north:[[.24,1.44],[1.554,2.602]]});
 rectangle('楼梯间一楼','cement',.245,3.836,-10.496,-7.861,.1,{west:'西_主屋承重墙_一楼',east:'中隔墙_一楼',north:'北_主屋后墙_一楼',south:'客堂后隔墙_双通口'});
 rectangle('亭子间','wood',.245,3.836,-14.756,-12.124,2.4,{east:'中隔墙_一楼',north:'北_亭子间后弄墙',south:'南_亭子间前墙'});
 run('亭子间','wood','西_亭子间边墙','z',.245,-14.756,-12.261,1,2.4);
 run('亭子间','wood','西_亭子间边墙','z',.245,-12.239,-12.124,1,2.4,[],{thickness:.003});
 const upper={west:'中隔墙_二楼',east:'东_厢房承重墙_二楼'};
 rectangle('夫妻婚房','wood',4.024,6.956,-5.159,-.244,4,{...upper,north:'前厢_二楼分隔',south:'南_侧厢二层外墙'});
 rectangle('阁梯间','wood',4.024,6.956,-10.649,-5.281,4,{...upper,north:'后厢_二楼北移分隔',south:'前厢_二楼分隔'});
 rectangle('孩子房','wood',4.024,6.956,-14.756,-10.771,4,{...upper,north:'北_侧厢二层外墙',south:'后厢_二楼北移分隔'});
 rectangle('起居间','wood',.245,3.836,-6.299,-3.244,4,{west:'西_主屋承重墙_二楼',east:'中隔墙_二楼',north:'前楼_后期轻分隔',south:'南_二楼前楼木立面'});
 rectangle('衣被储藏间','wood',.245,2.818,-8.379,-6.421,4,{west:'西_主屋承重墙_二楼',east:'后楼小间_轻隔墙',north:'后楼小间_北隔墙',south:'前楼_后期轻分隔'},{west:[[-8.047,-8.033]]});
 // Circulation has no wall across its open edges or stair holes.
 run('二楼共用廊','wood','中隔墙_二楼','z',3.836,-10.496,-6.70,-1,4);
 run('二楼共用廊','wood','中隔墙_二楼','z',3.836,-6.70,-6.56,-1,4,[],{endThickness:.003});
 run('二楼共用廊','wood','中隔墙_二楼','z',3.836,-6.56,-6.421,-1,4,[],{thickness:.003});
 run('二楼共用廊','wood','后楼小间_轻隔墙','z',2.942,-8.50,-7.049,1,4);
 run('二楼共用廊','wood','后楼小间_轻隔墙','z',2.942,-7.049,-6.421,1,4,[],{thickness:.003});
 run('二楼东侧落脚区','wood','北_主屋后墙_二楼','x',-10.496,2.956,3.822,1,4);
 run('亭子转身平台','wood','西_主屋承重墙_一楼','z',.245,-10.495,-8.50,1,2.4);
 run('晒台上平台','wood','西_主屋承重墙_二楼','z',.245,-10.495,-8.50,1,4.8);
 // The loft has open north/south edges. Only its side walls and central partition receive skirting.
 run('储藏阁楼西侧','wood','西_主屋檐墙','z',.244,-8.4,-5.4,1,6.7);
 run('储藏阁楼东侧','wood','东_厢房檐墙','z',6.956,-8.4,-5.4,-1,6.7);
 const partition=root.getObjectByName('阁层_中隔墙与低矮通口'),parts=root.getObjectsByProperty('name','阁楼_partition');
 if(parts.length!==2)throw Error('阁楼墙体全高/剖切表示缺失');
 const opts={full:parts[0],low:parts[1]};
 run('储藏阁楼隔墙西','wood',partition.name,'z',3.839,-8.4,-5.4,-1,6.7,[[-6.818,-5.982]],opts);
 run('储藏阁楼隔墙东','wood',partition.name,'z',4.021,-8.4,-5.4,1,6.7,[[-6.801,-5.999]],opts);
 // The partition opens against these continuous side walls. Close the former
 // 122 mm gap between the two room runs, retaining every existing strip/UV.
 run('客堂楼梯交接','cement','西_主屋承重墙_一楼','z',.245,-7.861,-7.739,1,.1);
 run('客堂楼梯交接','cement','中隔墙_一楼','z',3.836,-7.861,-7.739,-1,.1);
 // Continue the indoor skirting through the rear passage reveals, stopping at
 // the exterior brick face. Append runs so the existing strips retain their UVs.
 run('后井通口西侧延续','cement','西_主屋承重墙_一楼','z',.245,-10.739,-10.496,1,.1,[],{outwardCaps:true});
 // The 1 mm seat meets the front-wall strip's opening clearance without a gap.
 run('后井通口右侧回转','cement','北_主屋后墙_一楼','z',1.141,-10.739,-10.488,-1,.1,[],{thickness:.009,outwardCaps:true});
 // The covered west passage continues beyond the doorway. Carry its skirting
 // to the kitchen's existing stone plinth, rather than stopping at the reveal.
 run('后井西侧整段通路','cement','西_后井围墙','z',.245,-11.895,-10.739,1,.1,[],{outwardCaps:true});
 root.userData.rearPassageSkirting={revision:'20261116',height:.12,floor:.1,westEndS:11.895,rightRevealEndS:10.739,records:records.slice(-3)};
 root.userData.houseSkirting={revision:'20261114',sampleVisualAccepted:true,wholeHouseVisualAccepted:false,floorChanges,doorFit,records,excluded:'露天天井（后井西侧有顶通路延续室内踢脚）、晒台水泥地坪与开敞木桥；厨房瓷砖挡水墙沿用原收口'};
 root.userData.textureCount=(root.userData.textureCount||0)+HOUSE_SKIRTING_DATA.images.length;
 root.updateMatrixWorld(true);
}
