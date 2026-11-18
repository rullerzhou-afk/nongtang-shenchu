import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
// A small neutral indoor reflection field, scoped to bicycle metal materials.
// Does not change the room lighting or other objects' materials.
const environments=new WeakMap();
function indoorEnvironment(T){
 if(environments.has(T))return environments.get(T);
 const w=512,h=256,data=new Float32Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w,v=(y+.5)/h;
  const upper=Math.max(0,Math.sin((v-.5)*Math.PI));
  const base=.035+.11*upper;
  const panel=(cu,cv,su,sv,p)=>p*Math.exp(-Math.pow((u-cu)/su,6)-Math.pow((v-cv)/sv,6));
  const daylight=panel(.23,.57,.065,.21,2.1)+panel(.72,.62,.11,.17,1.25);
  const ceiling=.35*Math.exp(-Math.pow((v-.88)/.07,4));
  const i=4*(y*w+x);
  data[i]=base*1.08+daylight+ceiling;
  data[i+1]=base*1.03+daylight*.985+ceiling;
  data[i+2]=base+daylight*.96+ceiling;
  data[i+3]=1;
 }
 const t=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);
 t.mapping=T.EquirectangularReflectionMapping;t.colorSpace=T.LinearSRGBColorSpace;
 t.needsUpdate=true;t.name='自行车金属_室内柔和反射';
 environments.set(T,t);return t;
}
export function applyBicycleReflections(T,root,level=1){
 if(!root)return;
 let environment;
 root.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){
  if(!m||!/^自行车_(旧镀铬|镀锌钢)/.test(m.name))continue;
  if(!environment)environment=indoorEnvironment(T);
  const changed=m.envMap!==environment;m.envMap=environment;
  m.envMapIntensity=(m.name.includes('旧镀铬')?.72:.35)*level;
  if(changed)m.needsUpdate=true;
 }});
}
