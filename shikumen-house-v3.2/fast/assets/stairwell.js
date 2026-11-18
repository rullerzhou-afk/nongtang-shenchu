import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
import { STAIRWELL_DATA as D } from './stairwell-data.js';
const caches=new WeakMap();
function cache(T){
 if(caches.has(T))return caches.get(T);const mats=new Map(),tex=new Map();
 const texture=(i,color=false)=>{const key=i+':'+color;if(tex.has(key))return tex.get(key);const def=D.textures[i],im=D.images[def.source],t=new T.TextureLoader().load(new URL(im.url,import.meta.url).href,()=>window.dispatchEvent(new Event('shikumen-asset-ready')));t.flipY=false;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;tex.set(key,t);return t;};
 const material=key=>{if(mats.has(key))return mats.get(key);const i=D.surfaceSlots[key].material,s=D.materials[i],p=s.pbrMetallicRoughness,m=new T.MeshStandardMaterial({name:s.name,color:new T.Color().fromArray(p.baseColorFactor||[1,1,1]),roughness:p.roughnessFactor,metalness:0});m.userData={asset:D.assetId,stairwellMaterial:i};if(typeof document!=='undefined'){m.map=texture(p.baseColorTexture.index,true);m.roughnessMap=m.metalnessMap=texture(p.metallicRoughnessTexture.index);m.normalMap=texture(s.normalTexture.index);m.normalScale.setScalar(s.normalTexture.scale);}mats.set(key,m);return m;};
 const c={material};caches.set(T,c);return c;
}
function grainUV(T,g,long=1,offset=0){const p=g.attributes.position,n=g.attributes.normal,uv=[];for(let i=0;i<p.count;i++){const q=[p.getX(i),p.getY(i),p.getZ(i)],nn=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))],normal=nn.indexOf(Math.max(...nn));let across=[0,1,2].find(a=>a!==normal&&a!==long),along=long;if(across===undefined){across=(long+1)%3;along=(long+2)%3;}uv.push(q[across]/.5+offset,1-q[along]/1.5);}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.deleteAttribute('color');return g;}
function helpers(T,c){
 const group=(parent,name,data={})=>{const g=new T.Group();g.name=name;g.userData={...data,stairwellRevision:1};parent.add(g);return g;};
 const mesh=(p,name,g,key)=>{const m=new T.Mesh(g,c.material(key));m.name=name;m.castShadow=m.receiveShadow=true;m.userData={stairwellRevision:1,part:name};p.add(m);return m;};
 const box=(p,name,pos,size,key='timber',long=size.indexOf(Math.max(...size)))=>{const g=grainUV(T,new T.BoxGeometry(...size),long,(pos[0]*.37+pos[2]*.13)%1),m=mesh(p,name,g,key);m.position.fromArray(pos);return m;};
 const beam=(p,name,a,b,w,d,key='timber',round=false)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),delta=vb.clone().sub(va),len=delta.length();let g;if(round){const sh=new T.Shape(),r=.008,x=w/2,y=d/2;sh.moveTo(-x+r,-y);sh.lineTo(x-r,-y);sh.quadraticCurveTo(x,-y,x,-y+r);sh.lineTo(x,y-r);sh.quadraticCurveTo(x,y,x-r,y);sh.lineTo(-x+r,y);sh.quadraticCurveTo(-x,y,-x,y-r);sh.lineTo(-x,-y+r);sh.quadraticCurveTo(-x,-y,-x+r,-y);g=new T.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false,curveSegments:3});g.rotateX(-Math.PI/2);g.translate(0,-len/2,0);}else g=new T.BoxGeometry(w,len,d);grainUV(T,g,1,a[0]*.21+a[2]*.17);const m=mesh(p,name,g,key);m.position.copy(va).add(vb).multiplyScalar(.5);const by=delta.normalize(),bx=Math.hypot(by.x,by.z)>.001?new T.Vector3(by.z,0,-by.x).normalize():new T.Vector3(1,0,0),bz=new T.Vector3().crossVectors(bx,by);m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(bx,by,bz));return m;};
 const riser=(p,name,a,b,height,thick)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va),m=box(p,name,va.clone().add(vb).multiplyScalar(.5).toArray(),[d.length(),height,thick],'timber',0);m.rotation.y=-Math.atan2(d.z,d.x);return m;};
 const post=(p,pos,h=.94)=>{box(p,'方形起止柱',[pos[0],pos[1]+h/2,pos[2]],[.064,h,.064]);box(p,'方柱平顶帽',[pos[0],pos[1]+h+.008,pos[2]],[.071,.016,.071],'handrail');};
 const guard=(p,name,points,posts=true,ends=[true,true])=>{const g=group(p,name,{kind:'stair-side-guard'});points.forEach((q,i)=>{const top=q[3]??q[1]+.90;if((i===0||i===points.length-1)&&!ends[i===0?0:1]){}else if(posts&&(i===0||i===points.length-1))post(g,q,top-q[1]+.04);else box(g,'方截面直栏杆',[q[0],(q[1]+top)/2,q[2]],[.028,top-q[1],.028]);if(i){const a=points[i-1],at=a[3]??a[1]+.90;beam(g,'圆角连续扶手',[a[0],at,a[2]],[q[0],top,q[2]],.066,.052,'handrail',true);beam(g,'直木下横档',[a[0],at-.77,a[2]],[q[0],top-.77,q[2]],.030,.034);}});return g;};
 const prism=(p,name,poly,top,thick,key,axis=0,origin=[0,0],width=.88)=>{const sh=new T.Shape();poly.forEach(([x,s],i)=>i?sh.lineTo(x,s):sh.moveTo(x,s));sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,top-thick,0);grainUV(T,g,Math.abs(Math.sin(axis))>.7?0:2,origin[0]*.137);if(key.startsWith('tread')){const pos=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<pos.count;i++)if(n.getY(i)>.9){const x=pos.getX(i),s=-pos.getZ(i);const u=(x-origin[0])*Math.cos(axis)+(s-origin[1])*Math.sin(axis);const v=-(x-origin[0])*Math.sin(axis)+(s-origin[1])*Math.cos(axis)+width/2;uv.setXY(i,(u+.012)/.34,1-(v+(1.1-width)/2)/1.1);}}const m=mesh(p,name,g,key);if(key.startsWith('tread')){m.material=[c.material(key),c.material('timber')];g.clearGroups();const n=g.attributes.normal;let previous=-1,start=0;for(let i=0;i<n.count;i+=3){const slot=n.getY(i)>.9?0:1;if(previous!==slot){if(previous>=0)g.addGroup(start,i-start,previous);start=i;previous=slot;}}g.addGroup(start,n.count-start,previous);}return m;};
 return {group,mesh,box,beam,guard,post,prism,riser};
}
function makeFlight(T,h,parent,info,name){
 const {start,end,risers,treads,width}=info,bottom=start[1],top=end[1],dx=end[0]-start[0],ds=-end[2]+start[2],len=Math.hypot(dx,ds),ux=dx/len,us=ds/len,rise=(top-bottom)/risers,going=len/treads,px=-us,ps=ux;
 const g=h.group(parent,name,{...info,kind:'stair-flight'}),at=(u,v,y)=>[start[0]+ux*u+px*v,y,start[2]-us*u-ps*v];
 for(let i=0;i<treads;i++){const y=bottom+(i+1)*rise,u=i*going,pts=[[u-.012,-width/2],[u+going,-width/2],[u+going,width/2],[u-.012,width/2]].map(([a,b])=>{const q=at(a,b,y);return[q[0],-q[2]];});
 const o=at(u,0,y);h.prism(g,'踏板_'+(i+1),pts,y,.044,'tread-'+(i%3),Math.atan2(us,ux),[o[0],-o[2]],width);
 // The riser meets the underside of the 44 mm tread, leaving one exposed face.
 h.riser(g,'竖向踢板_'+(i+1),at(u,-width/2,y-(rise+.044)/2),at(u,width/2,y-(rise+.044)/2),rise-.044,.024);
 // Small rounded lip stays inside the pre-existing 12 mm overhang envelope.
 h.beam(g,'磨圆踏鼻_'+(i+1),at(u-.006,-width/2,y-.008),at(u-.006,width/2,y-.008),.016,.016,'timber',true);
 }
 // The existing 16 cm landing slab supplies the upper part of the last riser.
 if(treads===risers-1)h.riser(g,'平台最后踢板',at(len,-width/2,top-(rise+.16)/2),at(len,width/2,top-(rise+.16)/2),rise-.16,.024);
 for(const sign of[-1,1]){
 const sh=new T.Shape();sh.moveTo(0,bottom+.005);sh.lineTo(len,top-.24);sh.lineTo(len,top-.035);if(treads===risers)sh.lineTo(len-going,top-.035);sh.lineTo(0,bottom+rise-.035);sh.closePath();
 const sg=new T.ExtrudeGeometry(sh,{depth:.075,bevelEnabled:false,curveSegments:1});sg.translate(0,0,-.0375);grainUV(T,sg,0);const pp=sg.attributes.position,nn=sg.attributes.normal,uv=sg.attributes.uv,angle=Math.atan2(top-bottom,len);for(let j=0;j<pp.count;j++)if(Math.abs(nn.getZ(j))>.8)uv.setXY(j,(pp.getY(j)-bottom-pp.getX(j)*(top-bottom)/len)/.5,1-(pp.getX(j)*Math.cos(angle)+(pp.getY(j)-bottom)*Math.sin(angle))/1.5);
 const board=h.mesh(g,'连续实木梯侧板',sg,'timber');board.position.fromArray(at(0,sign*(width/2-.045),0));board.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(ux,0,-us),new T.Vector3(0,1,0),new T.Vector3(us,0,ux)));
 const points=[];points.push(at(0,sign*(width/2-.032),bottom));for(let i=0;i<treads;i++)points.push([...at((i+.5)*going,sign*(width/2-.032),bottom+(i+1)*rise),bottom+(top-bottom)*(i+.5)/treads+.90]);points.push(at(len,sign*(width/2-.032),top));const ends=[true,true];if(sign===1&&name==='主梯第1段_入门短步向北')ends[1]=false;if(sign===1&&name==='主梯第1段_转西至亭子平台')ends[0]=false;h.guard(g,sign<0?'左侧木扶手':'右侧木扶手',points,true,ends);}
 return g;
}
function makeWinders(T,h,parent){
 const g=h.group(parent,'主梯_三块实木转角扇步',{kind:'winder-stair',count:3}),cx=2.96,cs=8.50,w=.88,r=2.3/12,base=.1+3*r;
 const edge=t=>{const co=Math.cos(t),si=Math.sin(t),rad=w/Math.max(co,si);return[cx+rad*co,cs+rad*si];};
 for(let k=0;k<3;k++){const a=k*Math.PI/6,b=(k+1)*Math.PI/6,pa=edge(a),pb=edge(b),poly=[[cx,cs],pa];if(a<Math.PI/4&&b>Math.PI/4)poly.push([cx+w,cs+w]);poly.push(pb);const y=base+(k+1)*r;
 h.prism(g,'转角扇步_'+(k+1),poly,y,.048,'tread-'+k,Math.PI/2,[cx,cs],w);h.riser(g,'扇步竖踢板_'+(k+1),[cx,y-(r+.048)/2,-cs],[pa[0],y-(r+.048)/2,-pa[1]],r-.048,.025);
 h.beam(g,'扇步磨圆踏鼻',[cx,y-.008,-cs],[pa[0],y-.008,-pa[1]],.016,.016,'timber',true);
 }
 // One continuous inner newel receives both straight handrails at their own heights.
 // The outer winder edge is held at the wall; no unsupported hanging short posts.
 const newelTop=base+3*r+.94,newelBase=.1;
 h.box(g,'转角内侧共用方柱',[cx+.032,(newelBase+newelTop)/2,-cs-.032],[.064,newelTop-newelBase,.064]);
 h.box(g,'转角共用柱帽',[cx+.032,newelTop+.008,-cs-.032],[.071,.016,.071],'handrail');
 const outer=[];for(let k=0;k<=6;k++){
 const a=k*Math.PI/12,railBase=base+k/6*3*r,p=edge(a),x=p[0]-.032,s=p[1]-.032;
 // Match each baluster foot to its actual winder; keep the handrail's smooth slope.
 const step=Math.max(1,Math.min(3,Math.floor(Math.atan2(s-cs,x-cx)/(Math.PI/6))+1));
 const foot=k===0?base:k===6?base+3*r:base+step*r;
 outer.push([x,foot,-s,railBase+.9]);
 }
 h.guard(g,'转角外扶手',outer);
 return g;
}
// Apply the already accepted downstairs joinery to the existing B1 attic run.
// Its footprint, levels, tread count and opening remain the building's own.
export function installAtticStairStyle(T,root){if(!FAST_ENABLED("stairwell"))return;
 const old=root.getObjectByName('阁梯_共用廊向南上局部阁楼');
 if(!old)throw Error('阁梯原有梯段缺失');
 const c=cache(T),h=helpers(T,c),info={...old.userData};
 const flight=makeFlight(T,h,old.parent,info,old.name);old.removeFromParent();
 flight.userData.atticStairStyleRevision=1;
 const loft=root.getObjectByName('局部阁楼_杉木楼板_独立梯口');
 for(const name of ['阁楼_梯孔东缘木护栏','阁楼_北缘东厢木护栏'])loft.getObjectByName(name)?.removeFromParent();
 // Continue from the stair's east top newel around the opening, without a
 // doubled post or the former gap between stair handrail and landing guard.
 const top=info.end[1],x=info.end[0]+info.width/2-.032,z=info.end[2];
 const corners=[[x,top,z],[5.012,top,z],[5.012,top,-8.375],[6.93,top,-8.375]],points=[corners[0]],cornerIndices=[];
 for(let j=1;j<corners.length;j++){const a=corners[j-1],b=corners[j],n=Math.max(1,Math.ceil(new T.Vector3(...a).distanceTo(new T.Vector3(...b))/.16));for(let i=1;i<=n;i++)points.push(a.map((v,k)=>v+(b[k]-v)*i/n));if(j<corners.length-1)cornerIndices.push(points.length-1);}
 const guard=h.guard(loft,'阁梯口_同楼下连续木护栏',points,true,[false,true]);
 for(const i of cornerIndices){const p=points[i];for(const o of [...guard.children])if(o.name==='方截面直栏杆'&&Math.abs(o.position.x-p[0])<.00001&&Math.abs(o.position.z-p[2])<.00001)o.removeFromParent();h.post(guard,p);}
 guard.userData.atticStairStyleRevision=1;
 return {revision:1,source:'accepted downstairs stairwell helpers and PBR materials',start:info.start,end:info.end,risers:info.risers,treads:info.treads,width:info.width,going:info.going,rise:info.rise,guardCorners:corners,style:['磨圆踏鼻','实木踢板','连续梯侧板','方形起止柱','方截面直栏杆','圆角连续扶手','直木下横档']};
}
function surfaceUV(T,g,matrix,side){const p=g.attributes.position,n=g.attributes.normal,uv=[],q=new T.Vector3(),normal=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(matrix),Dmn=D.surfaceSlots[side==='floor'?'floor':'plaster-'+side].domain;for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(nm);const reveal=side==='north'&&Math.abs(normal.x)>.7,u=side==='west'||side==='east'?-q.z-7.74:reveal?-q.z-10.50:q.x-.24,v=side==='floor'?-q.z-7.86:q.y-.1;uv.push(u/Dmn[1],1-v/Dmn[3]);}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.deleteAttribute('color');}
export function projectStairwellWallUV(T,g,matrix,faceX){
 surfaceUV(T,g,matrix,'east');const uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal,q=new T.Vector3(),normal=new T.Vector3(),nm=new T.Matrix3().getNormalMatrix(matrix),domain=D.surfaceSlots['plaster-east'].domain;
 // Turn the same metric texture around reveals instead of flattening their UVs.
 for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(nm);if(Math.abs(normal.z)>.7)uv.setX(i,uv.getX(i)+(q.x-faceX)/domain[1]);if(Math.abs(normal.y)>.7)uv.setY(i,uv.getY(i)+(q.x-faceX)/domain[3]);}
}
function seatWallJunctions(T,root){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 const cut=(name,planes,keep)=>{const parent=root.getObjectByName(name),items=[];parent?.traverse(o=>{if(o.isMesh)items.push(o);});let changed=0;
 for(const o of items){const matrix=inv.clone().multiply(o.matrixWorld),result=sliceGeometry(T,o.geometry,matrix,planes);if(!result[keep==='inside'?'outside':'inside'])continue;if(result[keep])o.geometry=result[keep];else o.removeFromParent();changed++;}audit.push({name,keep,changed});};
 // The existing 16 cm floor occupies these two rectangles. Remove masonry faces
 // buried within it, including coplanar wall caps; the timber fills the opening.
 // Only the stairwell portion of the ground-floor walls is affected.
 for(const name of ['西_主屋承重墙_一楼','中隔墙_一楼','客堂后隔墙_双通口','北_主屋后墙_一楼'])for(const [x0,x1,s0,s1]of [[.119,3.961,7.74,8.50],[2.94,3.961,8.50,10.621]])cut(name,[{axis:0,value:x0,sign:1},{axis:0,value:x1,sign:-1},{axis:2,value:-s1,sign:1},{axis:2,value:-s0,sign:-1},{axis:1,value:3.839,sign:1},{axis:1,value:4.001,sign:-1}],'outside');
 // Seat closed timber edges 1 mm clear of the finished plaster. Move their
 // boundary vertices together so there is no open cut face or changed tread level.
 const seat=(name,axis,value)=>{const parent=root.getObjectByName(name);let changed=0;parent?.traverse(o=>{if(!o.isMesh)return;const matrix=inv.clone().multiply(o.matrixWorld),back=matrix.clone().invert(),g=o.geometry.clone(),p=g.attributes.position,q=new T.Vector3();let moved=0;for(let i=0;i<p.count;i++){q.fromBufferAttribute(p,i).applyMatrix4(matrix);if(q.getComponent(axis)<value){q.setComponent(axis,value).applyMatrix4(back);p.setXYZ(i,q.x,q.y,q.z);moved++;}}if(moved){g.computeBoundingSphere();o.geometry=g;changed++;}});audit.push({name,axis,minimum:value,changed});};
 for(const name of ['亭子平台_西侧转身与地面通路上盖','亭子间_西侧窄桥_保持后井露天','晒台短梯_上平台','晒台平台_西侧回廊','晒台_西侧窄桥_保持后井露天'])seat(name,0,.245);
 seat('主梯第2段_向东至二楼',2,-10.495);
 return audit;
}
function ageSurfaces(T,root,c){
 // Same physical partition centre as hall.ageArchitecture; leave no bare band.
 const hallEnd=-7.80;
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),audit=[];
 const specs=[['west','西_主屋承重墙_二楼',[{axis:0,value:.245,sign:1}]],['east','中隔墙_二楼',[{axis:0,value:3.841,sign:-1}]],['north','北_主屋后墙_二楼',[{axis:2,value:-10.499,sign:1}]],['west','西_主屋承重墙_一楼',[{axis:0,value:.245,sign:1}]],['east','中隔墙_一楼',[{axis:0,value:3.841,sign:-1}]],['south','客堂后隔墙_双通口',[{axis:2,value:hallEnd,sign:-1}]],['north','北_主屋后墙_一楼',[{axis:2,value:-10.499,sign:1}]]];
 for(const[side,name,extra]of specs){const group=root.getObjectByName(name);if(!group){audit.push({side,missing:name});continue;}const items=[];group.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name.includes('内墙_旧石灰灰泥'))items.push(o);});for(const o of items){const m=inv.clone().multiply(o.matrixWorld),s=sliceGeometry(T,o.geometry,m,[{axis:2,value:-10.50,sign:1},{axis:2,value:hallEnd,sign:-1},...extra]);if(!s.inside)continue;surfaceUV(T,s.inside,m,side);const q=new T.Mesh(s.inside,c.material('plaster-'+side));q.name='楼梯间_'+side+'_旧灰泥';q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.castShadow=o.castShadow;q.receiveShadow=true;q.userData={stairwellRevision:1,surface:side};o.parent.add(q);if(s.outside)o.geometry=s.outside;else o.removeFromParent();audit.push({side,vertices:s.inside.attributes.position.count});}}
 // Finish the actual passage returns with the same plaster as the adjoining
 // continuous wall. Reassign original faces; never stack a second surface.
 let passageMaterial;root.getObjectByName('西_主屋承重墙_一楼')?.traverse(o=>{if(o.material?.name==='客堂_plaster-west_客堂v1')passageMaterial=o.material;});
 const rearWall=root.getObjectByName('北_主屋后墙_一楼');
 for(const [surface,planes]of [
  ['侧边',[{axis:0,value:1.13999,sign:1},{axis:0,value:1.14001,sign:-1},{axis:1,value:2.15001,sign:-1}]],
  ['上口',[{axis:1,value:2.14999,sign:1},{axis:1,value:2.15001,sign:-1},{axis:0,value:1.14001,sign:-1}]]
 ]){const items=[];rearWall?.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.name==='砌筑_旧灰缝')items.push(o);});
  for(const o of items){const matrix=inv.clone().multiply(o.matrixWorld),part=sliceGeometry(T,o.geometry,matrix,[{axis:2,value:-10.741,sign:1},{axis:2,value:-10.499,sign:-1},{axis:1,value:.099,sign:1},...planes]);if(!part.inside)continue;
   const p=part.inside.attributes.position,uv=new Float32Array(p.count*2),v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);uv[i*2]=(-v.z-3.24)/4.5;uv[i*2+1]=1-(surface==='上口'?v.x-.24:v.y-.1)/3.2;}part.inside.setAttribute('uv',new T.BufferAttribute(uv,2));part.inside.deleteAttribute('color');
   const q=new T.Mesh(part.inside,passageMaterial||c.material('plaster-north'));q.name='后井通口_'+surface+'_连续灰泥';q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.castShadow=o.castShadow;q.receiveShadow=true;q.userData={stairwellRevision:1,surface:'rear-passage-reveal'};o.parent.add(q);if(part.outside)o.geometry=part.outside;else o.removeFromParent();audit.push({side:'rear-passage-'+surface,vertices:part.inside.attributes.position.count});
  }
 }
 // Hall already finishes the same continuous floor; do not split/repaint it.
 if(root.userData.hallContinuousGroundFinish)return audit;
 const floor=root.getObjectByName('客堂与后梯_地砖');const items=[];floor?.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)items.push(o);});
 const instances=[];floor?.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});
 for(const inst of instances){const m=inv.clone().multiply(inst.matrixWorld);for(let i=0;i<inst.count;i++){const t=new T.Matrix4();inst.getMatrixAt(i,t);const mat=inst.material.clone();if(inst.instanceColor){const col=new T.Color();inst.getColorAt(i,col);mat.color.multiply(col);}const q=new T.Mesh(inst.geometry.clone().applyMatrix4(t),mat);q.position.copy(inst.position);q.quaternion.copy(inst.quaternion);q.scale.copy(inst.scale);q.name='原红陶砖_'+i;q.castShadow=q.receiveShadow=true;inst.parent.add(q);items.push(q);}inst.removeFromParent();}
 root.updateMatrixWorld(true);
 for(const o of items){const m=inv.clone().multiply(o.matrixWorld),s=sliceGeometry(T,o.geometry,m,[{axis:2,value:hallEnd,sign:-1}]);if(!s.inside)continue;surfaceUV(T,s.inside,m,'floor');const q=new T.Mesh(s.inside,c.material('floor'));q.name='楼梯间_原红陶地砖';q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.receiveShadow=true;q.userData={stairwellRevision:1,surface:'floor'};o.parent.add(q);if(s.outside)o.geometry=s.outside;else o.removeFromParent();}
 return audit;
}
function seatBridge(T,root,wallName,top){
 // The tingzi facade used to end at the terrace walking surface. Its cap and
 // projecting brick skin fought with the bridge boards and roof slab. Keep
 // the wall below the existing 16 cm slab, only across the bridge opening.
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),wall=root.getObjectByName(wallName),items=[],audit=[];
 wall.traverse(o=>{if(o.isMesh)items.push(o);});
 const planes=[{axis:0,value:.239,sign:1},{axis:0,value:1.141,sign:-1},{axis:1,value:top-.161,sign:1},{axis:1,value:top+.001,sign:-1}];
 for(const o of items){const world=inv.clone().multiply(o.matrixWorld),pieces=[],keep=[];
  const trim=(g,material,index)=>{const b=new T.Box3().setFromBufferAttribute(g.attributes.position).applyMatrix4(world);if(b.max.x<.239||b.min.x>1.141||b.max.y<top-.161||b.min.y>top+.001)return false;
   const cut=sliceGeometry(T,g,world,planes);if(!cut.inside){cut.outside?.dispose();return false;}cut.inside.dispose();if(cut.outside)pieces.push({geometry:cut.outside,material,index});return true;};
  if(o.isInstancedMesh){const mt=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,mt);const g=o.geometry.clone().applyMatrix4(mt),material=o.material.clone();if(o.instanceColor){o.getColorAt(i,color);material.color.multiply(color);}if(!trim(g,material,i)){keep.push(i);material.dispose();}g.dispose();}
   if(keep.length===o.count)continue;
   if(keep.length){const n=new T.InstancedMesh(o.geometry,o.material,keep.length);n.name=o.name;n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.userData={...o.userData};keep.forEach((i,j)=>{o.getMatrixAt(i,mt);n.setMatrixAt(j,mt);if(o.instanceColor){o.getColorAt(i,color);n.setColorAt(j,color);}});n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;o.parent.add(n);}
  }else if(!trim(o.geometry,o.material,null))continue;
  for(const p of pieces){const n=new T.Mesh(p.geometry,p.material);n.name=o.name+'_木桥承口';n.position.copy(o.position);n.quaternion.copy(o.quaternion);n.scale.copy(o.scale);n.userData={...o.userData,terraceBridgeRepair:1};n.castShadow=o.castShadow;n.receiveShadow=o.receiveShadow;o.parent.add(n);}
  audit.push({name:o.name,trimmedInstances:o.isInstancedMesh?o.count-keep.length:undefined});o.removeFromParent();
 }
 return audit;
}
export function installStairwell(T,root){if(!FAST_ENABLED("stairwell"))return;
 const c=cache(T),h=helpers(T,c),system=root.getObjectByName('V3_一楼至二楼横向木梯'),upper=root.getObjectByName('V3_二楼至晒台短回梯');const parts=[];
 for(const parent of[system,upper])for(const old of [...parent.children]){if(old.userData.kind==='stair-flight'){makeFlight(T,h,parent,old.userData,old.name);parts.push({name:old.name,...old.userData});old.removeFromParent();}if(old.userData.kind==='winder-stair'){makeWinders(T,h,parent);old.removeFromParent();}}
 const floors=['亭子平台_西侧转身与地面通路上盖','亭子间_西侧窄桥_保持后井露天','晒台短梯_上平台','晒台平台_西侧回廊','晒台_西侧窄桥_保持后井露天'];
 for(const name of floors){const g=root.getObjectByName(name);if(!g)continue;const floorKey=['亭子平台_西侧转身与地面通路上盖','亭子间_西侧窄桥_保持后井露天'].includes(name)?'floor-timber':'timber';const items=[];g.traverse(o=>{if(o.isMesh&&o.material.name.includes('杉木'))items.push(o);});for(const o of items){if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const mt=new T.Matrix4();o.getMatrixAt(i,mt);const geo=o.geometry.clone().applyMatrix4(mt);grainUV(T,geo,2,i*.183);const q=new T.Mesh(geo,c.material(floorKey));q.name='平台独立杉木板_'+i;q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.userData={stairwellRevision:1};q.castShadow=q.receiveShadow=true;o.parent.add(q);}o.removeFromParent();}else{o.geometry=grainUV(T,o.geometry.clone(),2);o.material=c.material(floorKey);o.userData={...o.userData,stairwellRevision:1};}}}

 const rails=[['亭子平台_南缘木护栏',[.27,2.4,-8.515],[1.11,2.4,-8.515]],['亭子平台_两跑间短护栏',[1.115,2.4,-9.40],[1.115,2.4,-9.60]],['二楼东廊_两梯口间短护栏',[2.96,4,-9.40],[2.96,4,-9.60]],['晒台平台_北缘护栏',[1.14,4.8,-9.355],[2.17,4.8,-9.355]],['晒台西廊_东缘护栏',[1.115,4.8,-9.38],[1.115,4.8,-10.48]]];
 for(const[name,a,b]of rails){const old=root.getObjectByName(name);if(!old)continue;const n=Math.max(1,Math.ceil(new T.Vector3(...a).distanceTo(new T.Vector3(...b))/.16)),points=Array.from({length:n+1},(_,i)=>a.map((v,j)=>v+(b[j]-v)*i/n));h.guard(old.parent,name,points);old.removeFromParent();}
 // Both outdoor bridges continue the accepted indoor timber guard style.
 for(const [bridgeName,top]of [['晒台_西侧窄桥_保持后井露天',4.8],['亭子间_西侧窄桥_保持后井露天',2.4]]){
  const bridge=root.getObjectByName(bridgeName);
  for(const [name,x]of [['西桥_西缘木栏杆',top===2.4?.315:.280],['西桥_东缘木栏杆',1.105]]){const old=bridge.getObjectByName(name),points=Array.from({length:8},(_,i)=>[x,top,-10.81-(11.875-10.81)*i/7]);h.guard(bridge,name,points);old.removeFromParent();}
 }
 // Adjacent flights and landing guards share one solid newel at each junction.
 // Merge overlapping coplanar caps rather than leaving doubled, flickering top faces.
 root.updateMatrixWorld(true);const caps=[];root.traverse(o=>{if(o.name==='方柱平顶帽')caps.push(o);});const used=new Set(),newelJoins=[];
 for(const first of caps){if(used.has(first))continue;const cluster=[first];used.add(first);for(let i=0;i<cluster.length;i++){const a=cluster[i],ab=new T.Box3().setFromObject(a);for(const b of caps){if(used.has(b))continue;const bb=new T.Box3().setFromObject(b);if(Math.abs(ab.max.y-bb.max.y)<.0001&&Math.min(ab.max.x,bb.max.x)-Math.max(ab.min.x,bb.min.x)>.001&&Math.min(ab.max.z,bb.max.z)-Math.max(ab.min.z,bb.min.z)>.001){cluster.push(b);used.add(b);}}}if(cluster.length<2)continue;
 const capBounds=new T.Box3(),postBounds=new T.Box3(),parent=first.parent;
 for(const cap of cluster){capBounds.union(new T.Box3().setFromObject(cap));const post=cap.parent.children.find(o=>o.name==='方形起止柱'&&Math.abs(o.position.x-cap.position.x)<.0001&&Math.abs(o.position.z-cap.position.z)<.0001);if(post){postBounds.union(new T.Box3().setFromObject(post));post.removeFromParent();}cap.removeFromParent();}
 const toLocal=parent.matrixWorld.clone().invert();capBounds.applyMatrix4(toLocal);postBounds.applyMatrix4(toLocal);h.box(parent,'转角共用方柱',postBounds.getCenter(new T.Vector3()).toArray(),postBounds.getSize(new T.Vector3()).toArray());h.box(parent,'共用方柱平顶',capBounds.getCenter(new T.Vector3()).toArray(),capBounds.getSize(new T.Vector3()).toArray(),'handrail');newelJoins.push({mergedCaps:cluster.length,top:capBounds.max.y});
 }
 // Retexture only the second-floor arrival strip within the stairwell.
 const landing=root.getObjectByName('二楼_主开间木楼板_横向梯井');root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),items=[];
 landing.traverse(o=>{if(o.isMesh)items.push(o);});
 for(const o of items){if(Array.isArray(o.material)||!o.material.name.includes('杉木'))continue;const matrix=inv.clone().multiply(o.matrixWorld),pieces=[];
 if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const mt=new T.Matrix4();o.getMatrixAt(i,mt);pieces.push({geo:o.geometry.clone().applyMatrix4(mt),tint:i});}}else pieces.push({geo:o.geometry.clone()});
 for(const {geo,tint}of pieces){const cut=sliceGeometry(T,geo,matrix,[{axis:2,value:-7.74,sign:-1}]);for(const [kind,g]of Object.entries(cut)){if(!g)continue;const mat=kind==='inside'?c.material('timber'):o.material.clone();if(kind==='inside')grainUV(T,g,2,(tint||0)*.137);else if(o.isInstancedMesh&&o.instanceColor){const col=new T.Color();o.getColorAt(tint,col);mat.color.multiply(col);}const q=new T.Mesh(g,mat);q.name=kind==='inside'?'二楼落脚区_旧杉木板':o.name+'_原区域';q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.castShadow=q.receiveShadow=true;if(kind==='inside')q.userData.stairwellRevision=1;o.parent.add(q);}}
 o.removeFromParent();}
 root.userData.textureCount=(root.userData.textureCount||0)+D.images.length;
 const wallJunctions=seatWallJunctions(T,root);
 const terraceBridgeJunction=seatBridge(T,root,'南_亭子间前墙',4.8);
 const tingziBridgeJunction=seatBridge(T,root,'南_厨房前墙',2.4);
 root.userData.stairwell={revision:1,conceptAccepted:true,userVisualAccepted:false,newelJoins,wallJunctions,parts,costCredits:0,authorizedCredits:500,materialAudit:ageSurfaces(T,root,c)};
 root.userData.stairwell.terraceBridgeRepair={revision:1,wallJunction:terraceBridgeJunction,tingziWallJunction:tingziBridgeJunction,upperBridgeStyleAccepted:true,railStyle:'existing square timber posts, balusters and rounded rectangular handrail',userVisualAccepted:false};
}
export function createStairwellInspection(T,root,reverse=false,options={}){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),out=new T.Group();out.name='楼梯间查看剖面';out.userData.stairwellInspection=true;
 const planes=[{axis:0,value:.12,sign:1},{axis:0,value:3.96,sign:-1},{axis:2,value:-11.94,sign:1},{axis:2,value:-7.74,sign:-1},{axis:1,value:options.maxHeight??6.7,sign:-1}];
 const removed=reverse===null?new Set():reverse?new Set(['北_主屋后墙_一楼','北_主屋后墙_二楼','中隔墙_一楼','中隔墙_二楼','后楼小间_轻隔墙','后楼小间_北隔墙']):new Set(['客堂后隔墙_双通口','西_主屋承重墙_一楼','西_主屋承重墙_二楼','后楼小间_轻隔墙','后楼小间_北隔墙']);
 if(options.retainSideWalls){removed.delete('西_主屋承重墙_一楼');removed.delete('西_主屋承重墙_二楼');removed.delete('中隔墙_一楼');removed.delete('中隔墙_二楼');}
 const removedMounts=new Set();if(removed.has('西_主屋承重墙_一楼'))removedMounts.add('west');if(removed.has('中隔墙_一楼'))removedMounts.add('east');if(removed.has('客堂后隔墙_双通口'))removedMounts.add('south');
 function copy(o){if(!o.visible||removed.has(o.name)||o.userData.floor==='roof'||removedMounts.has(o.userData.stairwellMountedWall))return null;let q;
 if(o.isInstancedMesh){q=new T.Group();for(let i=0;i<o.count;i++){const mt=new T.Matrix4();o.getMatrixAt(i,mt);const g=sliceGeometry(T,o.geometry.clone().applyMatrix4(mt),inv.clone().multiply(o.matrixWorld),planes).inside;if(!g)continue;const m=o.material.clone();if(o.instanceColor){const col=new T.Color();o.getColorAt(i,col);m.color.multiply(col);}const child=new T.Mesh(g,m);child.castShadow=child.receiveShadow=true;q.add(child);}}
 else if(o.isMesh){const g=sliceGeometry(T,o.geometry,inv.clone().multiply(o.matrixWorld),planes).inside;if(!g)return null;q=new T.Mesh(g,o.material);q.castShadow=o.castShadow;q.receiveShadow=o.receiveShadow;}else q=new T.Group();q.name=o.name;q.position.copy(o.position);q.quaternion.copy(o.quaternion);q.scale.copy(o.scale);q.userData={...o.userData,stairwellInspection:true};for(const ch of o.children){const n=copy(ch);if(n)q.add(n);}return q;
 }
 const names=['楼梯间陈设_一楼','楼梯间陈设_二楼','V3_一楼至二楼横向木梯','V3_二楼至晒台短回梯','亭子间_西侧窄桥_保持后井露天','晒台_西侧窄桥_保持后井露天','二楼_主开间木楼板_横向梯井','客堂与后梯_地砖','西_主屋承重墙_一楼','西_主屋承重墙_二楼','中隔墙_一楼','中隔墙_二楼','客堂后隔墙_双通口','北_主屋后墙_一楼','北_主屋后墙_二楼'];
 for(const name of names){const ch=root.getObjectByName(name);if(!ch)continue;const q=copy(ch);if(q){inv.clone().multiply(ch.matrixWorld).decompose(q.position,q.quaternion,q.scale);out.add(q);}}return out;
}
