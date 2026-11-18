import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { WINDOW_HARDWARE_DATA } from './window-hardware-data.js';

const cache=new WeakMap();
function resources(THREE){
  if(cache.has(THREE))return cache.get(THREE);
  const geometries={};
  for(const [name,data]of Object.entries(WINDOW_HARDWARE_DATA.parts)){
    const geometry=new THREE.BufferGeometry();
    const unpack=r=>{const bytes=FAST_BYTES(r);return new ({5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[r.componentType])(bytes.buffer);};
    for(const [key,attr]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])if(data.attributes[key])geometry.setAttribute(attr,new THREE.BufferAttribute(unpack(data.attributes[key]),data.attributes[key].itemSize));
    geometry.setIndex(new THREE.BufferAttribute(unpack(data.indices),1));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries[name]=geometry;
  }
  const material=new THREE.MeshStandardMaterial({name:'窗五金_做旧黑铁',color:0x373a36,metalness:.72,roughness:.60});
  const shared={geometries,material,hookVariants:new Map()};cache.set(THREE,shared);return shared;
}
function part(THREE,parent,type,name){
  const r=resources(THREE),mesh=new THREE.Mesh(r.geometries[type],r.material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={kind:'window_hardware',part:type,sourceTaskId:WINDOW_HARDWARE_DATA.parts[type].sourceTaskId,generatedGeometry:WINDOW_HARDWARE_DATA.parts[type].generatedGeometry};parent.add(mesh);return mesh;
}
function rod(THREE,parent,a,b,radius,name){
  const {material}=resources(THREE),av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,d.length(),8),material);mesh.name=name;
  mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(mesh);return mesh;
}
function eye(THREE,parent,position,rotationY,name){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(.007,.0022,6,14),resources(THREE).material);mesh.name=name;mesh.position.fromArray(position);mesh.rotation.y=rotationY;parent.add(mesh);return mesh;
}
export function installWindowHardware(THREE,frameGroup,leaf,{hingeX,sign,frame,leafW,leafH,stile,dormer,long,hookSide='exterior',boltSide='exterior'}){if(!FAST_ENABLED("window-hardware"))return;
  const fixed=new THREE.Group();fixed.name='固定窗框五金';frameGroup.add(fixed);
  const moving=new THREE.Group();moving.name='随扇活动五金';leaf.add(moving);
  const hingeScale=dormer?.66:long?1.1:1;
  for(const y of [Math.max(.075,leafH*.20),Math.min(leafH-.075,leafH*.82)]){
    const stationary=part(THREE,fixed,'hingeFixed','合页_固定半片与销轴');stationary.position.set(hingeX,frame+.004+y,leaf.position.z);stationary.scale.set(sign*hingeScale,hingeScale,hingeScale);
    const rotating=part(THREE,moving,'hingeMoving','合页_随扇半片');rotating.position.set(0,y,0);rotating.scale.set(sign*hingeScale,hingeScale,hingeScale);
  }
  const boltScale=dormer?.55:long?1:.8,boltX=sign*(leafW-stile*.5),boltY=leafH-.134*boltScale;
  const interiorBolt=boltSide==='interior',face=interiorBolt?-1:1;
  const bolt=part(THREE,moving,'boltBody','插销_固定座');bolt.position.set(boltX,boltY,(interiorBolt?-.072:0)-.0022*hingeScale);bolt.scale.setScalar(boltScale);if(interiorBolt)bolt.rotation.y=Math.PI;bolt.userData.mountingSide=boltSide;
  const slide=part(THREE,moving,'boltSlide','插销_活动杆');slide.position.copy(bolt.position);slide.scale.copy(bolt.scale);slide.rotation.copy(bolt.rotation);slide.userData.mountingSide=boltSide;
  const keeperX=hingeX+boltX,keeperY=frame+.004+leafH+.012*boltScale,keeperZ=leaf.position.z+bolt.position.z+face*.009*boltScale;
  const keeper=eye(THREE,fixed,[keeperX,keeperY,keeperZ],0,'插销_窗框扣座');keeper.rotation.x=Math.PI/2;keeper.scale.setScalar(boltScale);
  keeper.userData.mountingSide=boltSide;
  rod(THREE,fixed,[keeperX,keeperY,face*.073],[keeperX,keeperY,keeperZ],.0028*boltScale,'插销扣座安装脚');
  const reach=Math.max(.065,leafW*.67);let hookLength=Math.max(.10,Math.min(.22,leafW*.44));
  const base=new THREE.Vector3(hingeX+sign*reach,frame*.48,.164),onLeaf=new THREE.Vector3(sign*reach,.020,.024);
  if(long){const onY=stile+.026+Math.min(.70,leafH*.26);base.set(hingeX-sign*.015,frame+.004+onY,leaf.position.z+.016);onLeaf.set(sign*Math.min(.25,leafW*.60),onY,.024);}
  if(dormer){const mountY=.35;base.set(hingeX-sign*.015,mountY,leaf.position.z+.016);onLeaf.set(sign*(leafW-stile*.5),mountY-frame-.004+.012,.024);}
  const point=angle=>onLeaf.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-sign*angle).add(leaf.position);
  if(hookSide==='interior'){
    let a=0,b=1.35;for(let i=0;i<45;i++){const mid=(a+b)/2;if(point(mid).distanceTo(base)<hookLength)a=mid;else b=mid;}
    return installInteriorCabinHook(THREE,{fixed,moving,leaf,hingeX,sign,frame,leafW,openAngle:(a+b)/2,slide,boltY,boltScale,hingeScale});
  }
  // Leave clearance behind/above the sill; the screw starts within actual wood.
  const fixedMount=[base.x,base.y,leaf.position.z-.0022*hingeScale];
  rod(THREE,fixed,fixedMount,base.toArray(),.0028,'风钩固定眼螺杆');
  const baseEye=eye(THREE,fixed,base.toArray(),Math.PI/2,'风钩_固定环眼');
  const sashEye=eye(THREE,moving,onLeaf.toArray(),Math.PI/2,'风钩_窗扇扣环');
  rod(THREE,moving,[onLeaf.x,onLeaf.y,-.010],onLeaf.toArray(),.0028,'风钩扣环安装脚');
  const hook=part(THREE,fixed,'hook','风钩_生成铁杆');hook.position.copy(base);
  const stowedEnd=null;
  if(long||dormer)hookLength=point(.72).distanceTo(base);
  let lo=0,hi=1.35;for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(point(mid).distanceTo(base)<hookLength)lo=mid;else hi=mid;}
  const hardware={sign,leaf,hook,base,onLeaf,baseEye,sashEye,hookLength,stowedEnd,openAngle:(long||dormer) ? .72 : (lo+hi)/2,slide,boltY,boltScale};
  hook.userData={...hook.userData,lengthMetres:hookLength,mount:'fixed-frame-eye / moving-sash-eye',mountingSide:hookSide};
  leaf.userData.hardware={hingeAxis:[0,1,0],openAngle:hardware.openAngle,hookLength,hingeScale,boltScale};
  return hardware;
}
function fittedHookGeometry(THREE,length){
  const r=resources(THREE),key=length.toFixed(7);if(r.hookVariants.has(key))return r.hookVariants.get(key);
  const g=r.geometries.hook.clone(),a=g.attributes.position,L=WINDOW_HARDWARE_DATA.hookAttachmentLength,t=.75,extra=length-L*t;
  // Extend the straight shaft only; the eye, hook curve and rod diameter stay slender.
  for(let i=0;i<a.count;i++){const y=a.getY(i),weight=Math.max(0,Math.min(1,(y-.020)/(L-.025-.020)));a.setXYZ(i,a.getX(i)*t,y*t+extra*weight,a.getZ(i)*t);}
  a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();r.hookVariants.set(key,g);return g;
}
export function updateWindowHardware(THREE,h,open){
  if(h.interiorCabinHook){poseInteriorCabinHook(THREE,h,open);return;}
  const start=h.base,end=open?h.onLeaf.clone().applyEuler(h.leaf.rotation).add(h.leaf.position):(h.stowedEnd?.clone()??start.clone().add(new THREE.Vector3(0,-h.hookLength,0)));
  const d=end.clone().sub(start),length=d.length(),sourceLength=WINDOW_HARDWARE_DATA.hookAttachmentLength;
  h.hook.position.copy(start);h.hook.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());h.hook.geometry=fittedHookGeometry(THREE,h.hookLength);h.hook.scale.setScalar(1);
  h.hook.userData.engaged=!!open;h.hook.userData.anchorStart=start.toArray();h.hook.userData.anchorEnd=end.toArray();
  h.slide.position.y=h.boltY-(open?.032*h.boltScale:0);h.slide.userData.retracted=!!open;
}

// This pair uses a precise, local hook: a horizontal closed tail eye and a
// downward J tip. The original generated hook remains unchanged on other windows.
function cabinHookGeometry(THREE,length){
  const loop=new THREE.TorusGeometry(.0078,.0016,8,40);loop.rotateX(Math.PI/2);
  const points=[new THREE.Vector3(.0078,0,0),new THREE.Vector3(length-.014,0,0)];
  for(let i=1;i<=20;i++){const a=Math.PI*(1-i/20);points.push(new THREE.Vector3(length-.007+.007*Math.cos(a),.007*Math.sin(a),0));}
  points.push(new THREE.Vector3(length,-.020,0));
  const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(points[i-1],points[i]));
  const shaft=new THREE.TubeGeometry(path,128,.0016,8,false),out=new THREE.BufferGeometry();
  for(const key of ['position','normal']){
    const arrays=[loop,shaft].map(g=>g.toNonIndexed().attributes[key].array),data=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));
    let off=0;for(const a of arrays){data.set(a,off);off+=a.length;}out.setAttribute(key,new THREE.BufferAttribute(data,3));
  }
  out.computeBoundingBox();out.computeBoundingSphere();return out;
}
function installInteriorCabinHook(THREE,h){
  const {fixed,moving,leaf,hingeX,sign,frame,leafW}=h,r=.0078;
  const reach=Math.max(.10,Math.min(.17,leafW*.23));
  const fixedEyeCenter=new THREE.Vector3(hingeX+sign*reach,frame+.0225,-.055);
  const base=fixedEyeCenter.clone().add(new THREE.Vector3(sign*r,.002,0));
  const onLeaf=new THREE.Vector3(sign*reach,.020,-.098);
  const end=onLeaf.clone().applyAxisAngle(new THREE.Vector3(0,1,0),-sign*h.openAngle).add(leaf.position);
  const tipDrop=.010,hookLength=Math.sqrt(base.distanceToSquared(end)-tipDrop*tipDrop);
  const makeEye=(parent,p,normal,name)=>{
    const m=new THREE.Mesh(new THREE.TorusGeometry(r,.0016,8,40),resources(THREE).material);m.name=name;m.position.copy(p);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal));parent.add(m);return m;
  };
  const baseEye=makeEye(fixed,fixedEyeCenter,[0,0,1],'风钩_固定竖环');
  rod(THREE,fixed,[fixedEyeCenter.x,frame-.012,fixedEyeCenter.z],[fixedEyeCenter.x,fixedEyeCenter.y-r,fixedEyeCenter.z],.0018,'风钩固定环入木螺杆');
  const sashEye=makeEye(moving,onLeaf,[0,1,0],'风钩_窗扇水平扣环');
  rod(THREE,moving,[onLeaf.x,onLeaf.y,-.069],[onLeaf.x,onLeaf.y,onLeaf.z+r],.0018,'风钩扣环入木螺杆');
  const stowedEnd=base.clone().add(new THREE.Vector3(sign*hookLength,-tipDrop,0));
  const storageEye=makeEye(fixed,stowedEnd,[0,1,0],'风钩_室内收纳环');
  rod(THREE,fixed,[stowedEnd.x,frame-.010,stowedEnd.z+r],[stowedEnd.x,stowedEnd.y,stowedEnd.z+r],.0018,'风钩收纳环入木安装脚');
  const hook=new THREE.Mesh(cabinHookGeometry(THREE,hookLength),resources(THREE).material);hook.name='风钩_室内闭尾环与下弯钩';hook.castShadow=true;fixed.add(hook);
  hook.userData={kind:'window_hardware',part:'hook',generatedGeometry:false,localRepair:'perpendicular linked tail eye and downward J tip',lengthMetres:hookLength,mountingSide:'interior',mount:'fixed-frame-eye / moving-sash-eye',tipDrop};
  const hardware={...h,interiorCabinHook:true,hook,base,onLeaf,fixedEyeCenter,baseEye,sashEye,storageEye,stowedEnd,hookLength,tipDrop};
  leaf.userData.hardware={hingeAxis:[0,1,0],openAngle:h.openAngle,hookLength,hingeScale:h.hingeScale,boltScale:h.boltScale,operation:'unhook before moving sash; engage only at retained opening angle'};
  return hardware;
}
function poseInteriorCabinHook(THREE,h,open){
  const end=open?h.onLeaf.clone().applyEuler(h.leaf.rotation).add(h.leaf.position):h.stowedEnd.clone();
  const d=end.clone().sub(h.base).normalize(),up=new THREE.Vector3(0,1,0).addScaledVector(d,-d.y).normalize();
  const a=Math.atan2(h.tipDrop,h.hookLength),x=d.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,Math.sin(a));
  const y=d.clone().multiplyScalar(-Math.sin(a)).addScaledVector(up,Math.cos(a)),z=x.clone().cross(y);
  h.hook.position.copy(h.base);h.hook.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  h.hook.userData={...h.hook.userData,engaged:!!open,attachment:open?'sash eye':'storage eye',anchorStart:h.base.toArray(),anchorEnd:end.toArray(),tipDirection:y.clone().negate().toArray(),receiverNormal:[0,1,0]};
  h.slide.position.y=h.boltY-(open?.032*h.boltScale:0);h.slide.userData.retracted=!!open;
}
