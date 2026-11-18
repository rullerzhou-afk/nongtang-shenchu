// 亭子间 · 负责人：云宝。鹿鹿 2026-11-17 确认：出门自动上二楼，本子推进后立起翻页。
import {createNotebook} from './tingzi-book.js';
import {updateWindowHardware} from '../../../shikumen-house-v3.2/assets/window-hardware.js';
export const STAND={pos:[-.65,3.85,-12.98],look:[-.3,3.35,-14.18]};
const BOOK_POSE={pos:[-.24,3.34,-13.83],look:[-.24,3.285,-14.265]};
const deskPose={pos:[-.68,3.78,-13.5],look:[-.18,3.12,-14.32]};
function windowParts(h){
  const w=h.find('亭子间_后弄木窗'),parts=[];
  for(let i=0;i<w.children.length;i++){
    const leaf=w.children[i];if(leaf.userData.kind!=='sash')continue;
    const fixed=w.children[i+1],hook=fixed.getObjectByName('风钩_室内闭尾环与下弯钩'),slide=leaf.getObjectByName('插销_活动杆'),sashEye=leaf.getObjectByName('风钩_窗扇水平扣环'),storageEye=fixed.getObjectByName('风钩_室内收纳环');
    if(!hook||!sashEye||!storageEye)throw new Error('亭子间窗五金结构不匹配');
    parts.push({leaf,hook,slide,sashEye,storageEye,interiorCabinHook:true,base:new h.THREE.Vector3().fromArray(hook.userData.anchorStart),onLeaf:sashEye.position.clone(),stowedEnd:storageEye.position.clone(),hookLength:hook.userData.lengthMetres,tipDrop:hook.userData.tipDrop,boltY:slide.position.y+(slide.userData.retracted ? .032*leaf.userData.hardware.boltScale : 0),boltScale:leaf.userData.hardware.boltScale,openAngle:leaf.userData.hardware.openAngle,sign:leaf.userData.hinge==='left'?1:-1});
  }return parts;
}
function cabinet(h,d,done){const next=!d.cabinetOpen,leaves=[];h.find('西侧双门衣柜').traverse(o=>{if(o.userData.kind==='tingzi_cabinet_leaf')leaves.push([o,o.rotation.y])});h.tween(850,k=>{for(const[o,a]of leaves)o.rotation.y=a+((next?Math.PI/2:0)*o.userData.openingSign-a)*k},()=>{d.cabinetOpen=next;done()})}
function windowToggle(h,d,done){const open=!d.windowOpen,parts=d.windows,from=parts.map(x=>x.leaf.rotation.y);parts.forEach(x=>updateWindowHardware(h.THREE,x,false));h.tween(1000,k=>parts.forEach((x,i)=>{x.leaf.rotation.y=from[i]+(-x.sign*(open?x.openAngle:0)-from[i])*k;x.leaf.userData.openingRadians=Math.abs(x.leaf.rotation.y)}),()=>{parts.forEach(x=>updateWindowHardware(h.THREE,x,open));d.windowOpen=open;done()})}
const card=(word,note,zh=word)=>({hu:word,zh,note});   // 录音编号 TZ01–TZ06 由曦宝按鹿鹿 2026-11-18 的要求编定：毛巾被、写字台、台扇、搪瓷杯、痰盂、皮箱；文件放 ../audio/TZ01.m4a 等
export default {
  linear:true,
  spot:STAND, sit:/北窗木靠背椅/, sitGuides:false,
  cue:h=>h.finished('tingzi')?{label:'上楼',screenCenter:true,seated:true,delay:0,at:[-.18,3.55,-15],run:()=>h.exit()}:null,
  exit:{label:'上楼',viaCue:true,to:'landing',route:[
    {pos:[-.65,3.85,-12.98],look:[-1.35,3.6,-12]},
    {pos:[-1.35,3.85,-12.75],look:[-1.35,3.65,-11.4],ms:1000},
    {pos:[-1.35,3.85,-11.55],look:[-1.35,3.65,-10.1],ms:1400},
    {pos:[-1.35,3.85,-10.06],look:[-.55,4.15,-10.06],ms:1800},
    {pos:[1.35,5.45,-10.06],look:[1.35,5.3,-7.3],fade:true,ms:900},
  ]},
  pick:['亭子间_后弄木窗','亭子间_前木门'],
  props:[
    {target:'西侧双门衣柜',label:'开合空柜',pose:{pos:[.1,3.8,-13.9],look:[-1.45,3.3,-14.07]},act:cabinet},
    {target:'亭子间_后弄木窗',label:'开合北窗',act:windowToggle},
    {target:'北窗木靠背椅',label:'坐一坐',sit:{at:[-.18,-13.81],facing:[0,0,-1],seatY:2.85,eye:3.55,lean:false}},
    {target:'桌上旧台扇',label:'电风扇',audio:'TZ03',card:card('电风扇','夏天做功课，打开电风扇','台扇')},
    {target:'桌上搪瓷杯',label:'搪瓷杯',audio:'TZ04',card:card('搪瓷杯','开水倒在里面，凉一凉再喝。')},
    {target:'生活器具_tingzijian',label:'痰盂',audio:'TZ05',card:card('痰盂','痰盂就放在床边。')},
    {target:'床下小皮箱',label:'皮箱',audio:'TZ06',card:card('皮箱','小皮箱平常就收在床底下。')},
  ],
  story:{
    setup(h,d){d.notebook=createNotebook(h);d.windows=windowParts(h);d.saved=[];for(const name of ['西侧双门衣柜','亭子间_后弄木窗'])h.find(name).traverse(o=>d.saved.push([o,o.position.clone(),o.quaternion.clone(),structuredClone(o.userData)]));d.cabinetOpen=false;d.windowOpen=false},
    resume(h,d){if(d.notebook){d.notebook.original.visible=false;d.notebook.g.visible=true}},
    suspend(h,d){if(d.notebook){d.notebook.reset();d.notebook.original.visible=true;d.notebook.g.visible=false}h.find('西侧双门衣柜')?.traverse(o=>{if(o.userData.kind==='tingzi_cabinet_leaf')o.rotation.y=(d.cabinetOpen?Math.PI/2:0)*o.userData.openingSign});for(const x of d.windows||[]){x.leaf.rotation.y=-x.sign*(d.windowOpen?x.openAngle:0);x.leaf.userData.openingRadians=Math.abs(x.leaf.rotation.y);updateWindowHardware(h.THREE,x,!!d.windowOpen)}},
    dispose(h,d){d.notebook?.dispose();for(const[o,p,q,u]of d.saved||[]){o.position.copy(p);o.quaternion.copy(q);o.userData=u}},
    beats:[
      {id:'bed',audio:'TZ01',label:'看看床铺',sub:'床铺收得整整齐齐。',target:'单人木床',also:['亭子间_淡黄毛巾被','亭子间_蓝白格床单床垫'],pose:{pos:[-.65,3.85,-12.98],look:[1.15,2.95,-13.65]},card:card('毛巾被头','天热了就要调毛巾被头。姆妈老是讲，脚露勒外头没关系，肚皮一定要盖好。','毛巾被')},
      {id:'desk',audio:'TZ02',label:'看看桌面',sub:'窗下放着一张小桌。',target:'北窗小书桌',pose:deskPose,card:card('写字台','写字台就在窗子下头。')},
      {id:'notebook',label:'翻翻本子',sub:'坐下，翻翻桌上的练习本。',target:(h,d)=>d.notebook.g,pose:BOOK_POSE,book:true,
        seatedReturn:{target:'北窗木靠背椅',pos:[-.18,3.55,-13.76],look:[-.18,3.55,-15],stand:[-.18,3.85,-13.39]}},
      {id:'window',label:'推窗',sub:'本子放好了，推开窗透透气。',target:'亭子间_后弄木窗',screenCenter:true,
        act:(h,d,done)=>d.windowOpen?done():windowToggle(h,d,done)},
    ],
    outro:{after:0,hold:3000,sub:'窗开了，坐一会儿。'},
  },
};
