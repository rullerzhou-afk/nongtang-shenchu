import {readBytes as FAST_BYTES,moduleEnabled as FAST_ENABLED,rooms as FAST_ROOMS,roomOf as FAST_ROOM} from '../data-runtime.js';
import { sliceGeometry } from './courtyard.js';
// Visible service connections, in metres in the existing B1 house coordinate system.
// Scene reconstruction only; this is not an electrical or gas installation drawing.
export function installHouseServices(T,root){if(!FAST_ENABLED("house-services"))return;
 if(root.userData.houseServices)return;
 root.updateMatrixWorld(true);
 const rootInverse=root.matrixWorld.clone().invert(),groups=[],routes=[],removed=[];
 const mat=(name,color,roughness,metalness=0)=>new T.MeshStandardMaterial({name:'补接_'+name,color,roughness,metalness});
 const wire=mat('旧米灰明线',0x9e9787,.86),clip=mat('米灰固定卡',0xb7af9c,.82),porcelain=mat('旧白瓷',0xd7d0bd,.33),bakelite=mat('深棕胶木',0x38271d,.5),flex=mat('旧黑胶软线',0x2c2923,.88),metal=mat('旧镀锌',0x86867c,.58,.7),brass=mat('旧黄铜',0x927442,.54,.72),rubber=mat('旧煤气胶管',0x494236,.9),cord=mat('棉拉绳',0xa49a84,1),cream=mat('调速器米白塑料',0xcfc7b0,.45),blackPlug=mat('黑胶木插头',0x161616,.45),creamFlex=mat('落地扇米白软线',0xb0a893,.7);
 const parents={hall:'客堂_furniture',frontWing:'前厢_furniture',middleWing:'中厢_furniture',kitchen:'已确认厨房_fixtures',tingzi:'亭子间_furniture',lounge:'起居间_furniture',marital:'婚房_furniture',childRoom:'孩子卧房_furniture',storage:'储藏间_furniture',atticRoom:'阁梯间_furniture',stair:'楼梯间陈设_一楼',stairUpper:'楼梯间陈设_二楼'};
 function group(room,side,name){const parent=root.getObjectByName(parents[room]);if(!parent)throw Error('Missing services parent '+room);const g=new T.Group();g.name='生活连接_'+name;g.userData={houseServiceRevision:1,serviceRoom:room,serviceSide:side,components:[]};rootInverse.clone().multiply(parent.matrixWorld).invert().decompose(g.position,g.quaternion,g.scale);parent.add(g);groups.push(g);return g;}
 function part(g,name,geo,m,p,q){const n=new T.Mesh(geo,m);n.name=name;n.position.fromArray(p);if(q)n.quaternion.copy(q);n.castShadow=n.receiveShadow=true;g.add(n);g.userData.components.push(name);return n;}
 function rod(g,name,a,b,r,m=wire){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);return part(g,name,new T.CylinderGeometry(r,r,d.length(),10),m,av.add(bv).multiplyScalar(.5).toArray(),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));}
 function run(g,name,p,r=.0033,m=wire,clips=true){routes.push({name,room:g.userData.serviceRoom,side:g.userData.serviceSide,points:p,radius:r});for(let i=1;i<p.length;i++){rod(g,name+'_'+i,p[i-1],p[i],r,m);if(!clips)continue;const a=new T.Vector3(...p[i-1]),b=new T.Vector3(...p[i]),n=Math.ceil(a.distanceTo(b)/.45);for(let j=1;j<n;j++)part(g,name+'_线卡',new T.BoxGeometry(.014,.009,.014),clip,a.clone().lerp(b,j/n).toArray());}}
 function soft(g,name,p,r=.0027,m=flex){const curve=new T.CatmullRomCurve3(p.map(v=>new T.Vector3(...v)),false,'centripetal');part(g,name,new T.TubeGeometry(curve,Math.max(20,p.length*10),r,8,false),m,[0,0,0]);routes.push({name,room:g.userData.serviceRoom,points:p,radius:r,curve:'centripetal'});}
 const normal=side=>({west:[1,0,0],east:[-1,0,0],south:[0,0,-1],north:[0,0,1],ceiling:[0,-1,0]}[side]);
 function offset(p,n,d){return p.map((v,i)=>v+n[i]*d);}
 function disk(g,name,p,n,r,h,m){return rod(g,name,offset(p,n,-h/2),offset(p,n,h/2),r,m);}
 function junction(g,p,side=g.userData.serviceSide){const n=normal(side);disk(g,'小圆接线盒',offset(p,n,.007),n,.021,.018,bakelite);disk(g,'盒盖小螺钉',offset(p,n,.017),n,.0024,.002,metal);}
 function sleeve(g,a,b){rod(g,'穿墙瓷套管',a,b,.0085,porcelain);}
 function switchAt(g,p,side=g.userData.serviceSide){const n=normal(side),center=offset(p,n,.009);disk(g,'圆胶木明装开关',center,n,.032,.024,bakelite);const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));part(g,'胶木拨钮',new T.BoxGeometry(.014,.021,.014),bakelite,offset(center,n,.017),q);for(const dy of [-.022,.022])disk(g,'开关固定螺钉',offset([p[0],p[1]+dy,p[2]],n,.022),n,.0024,.002,metal);}
 // Ceiling-fan speed regulator: cream plastic box (7.5 x 10.5 x 4.5 cm) with a bakelite knob and pointer ridge.
 function regulator(g,p,side=g.userData.serviceSide){const n=normal(side),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));part(g,'吊扇调速器盒',new T.BoxGeometry(.075,.105,.045),cream,offset(p,n,.0225),q);disk(g,'调速器旋钮',offset([p[0],p[1]+.012,p[2]],n,.053),n,.017,.016,bakelite);part(g,'调速器旋钮指示棱',new T.BoxGeometry(.004,.026,.006),bakelite,offset([p[0],p[1]+.012,p[2]],n,.063),q);for(const dy of [-.043,.043])disk(g,'调速器固定螺钉',offset([p[0],p[1]+dy,p[2]],n,.046),n,.0024,.002,metal);}
 function socket(g,p,side,plugCount=1,plugMat=bakelite){const n=normal(side),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));const width=plugCount===2?.105:.066;part(g,'白瓷明装插座',new T.BoxGeometry(width,.07,.023),porcelain,offset(p,n,.012),q);const ends=[];for(let i=0;i<plugCount;i++){const along=plugCount===2?(i-.5)*.048:0;const local=new T.Vector3(along,0,0).applyQuaternion(q).toArray(),pos=p.map((v,k)=>v+local[k]);part(g,'已插入胶木两脚插头',new T.BoxGeometry(.029,.034,.027),plugMat,offset(pos,n,.031),q);const exit=offset([pos[0],pos[1]-.023,pos[2]],n,.034);rod(g,'插头下出线护套',offset([pos[0],pos[1]-.010,pos[2]],n,.034),exit,.0042,plugMat);ends.push(exit);}return ends;}
 // House entry at the existing stairwell wall. Keep the external supply beyond the scene boundary.
 let g=group('stair','west','楼梯进线与一层分支');sleeve(g,[.10,3.72,-8.04],[.264,3.72,-8.04]);run(g,'墙内来线接既有楼梯竖线',[[.10,3.72,-8.04],[.254,3.72,-8.04]],.0033,wire,false);junction(g,[.254,3.72,-8.04]);
 run(g,'至客堂穿墙口',[[.254,3.72,-8.04],[.254,3.72,-7.88]]);sleeve(g,[.254,3.72,-7.88],[.254,3.72,-7.728]);
 let h=group('hall','west','客堂西墙开关与来线');// Hall rearranged 2026-11-14 (assets/hall-rearrange.js): pendant lamp now at X 1.29, Z -5.34; a ceiling fan at X 2.34 replaces the desk fan.
 run(h,'客堂西墙线',[[.254,3.72,-7.88],[.254,3.72,-7.726],[.254,3.72,-5.34],[.254,3.826,-5.34]]);junction(h,[.254,3.72,-7.55]);run(h,'客堂开关支线',[[.254,3.72,-7.55],[.254,1.48,-7.55]]);switchAt(h,[.254,1.48,-7.55]);
 junction(h,[.254,3.72,-7.37]);run(h,'吊扇调速器来线',[[.254,3.72,-7.37],[.254,1.50,-7.37]]);regulator(h,[.24,1.45,-7.36]);run(h,'调速器至吊扇线',[[.254,1.50,-7.35],[.254,3.69,-7.35],[.254,3.69,-5.40],[.254,3.826,-5.40]]);
 h=group('hall','ceiling','客堂顶灯与吊扇接线');run(h,'客堂顶棚线至灯线盒',[[.254,3.826,-5.34],[1.29,3.826,-5.34]]);run(h,'客堂顶棚线至吊扇',[[.254,3.826,-5.40],[2.34,3.826,-5.40]]);
 h=group('hall','north','客堂分配至厢房');run(h,'客堂北墙分配线',[[.254,3.72,-7.726],[3.826,3.72,-7.726]]);
 h=group('hall','north','客堂冰箱与收录机插座');junction(h,[2.265,3.72,-7.726]);run(h,'冰箱收录机插座来线',[[2.265,3.72,-7.726],[2.265,1.455,-7.726]]);const hallNorthPlugs=socket(h,[2.265,1.42,-7.74],'north',2);
 soft(h,'冰箱背后至插头',[[2.56,.34,-7.712],[2.44,.36,-7.722],[2.345,.46,-7.724],[2.318,.72,-7.724],[2.312,1.05,-7.722],[2.305,1.27,-7.716],[2.296,1.345,-7.708],hallNorthPlugs[1]],.0030);
 soft(h,'收录机背后至插头',[[1.86,1.352,-7.566],[1.885,1.318,-7.592],[1.95,1.3075,-7.632],[2.06,1.3075,-7.664],[2.15,1.3075,-7.682],[2.205,1.318,-7.698],[2.232,1.355,-7.706],hallNorthPlugs[0]],.0024);
 h=group('hall','east','客堂电器与老人房分支');run(h,'客堂东墙分配线',[[3.826,3.72,-7.726],[3.826,3.72,-5.02],[4.034,3.72,-5.02]]);sleeve(h,[3.826,3.72,-5.02],[4.034,3.72,-5.02]);junction(h,[3.826,3.72,-6.63]);run(h,'电视插座来线',[[3.826,3.72,-6.63],[3.826,.55,-6.63]]);const hallPlug=socket(h,[3.84,.55,-6.63],'east',1)[0];
 soft(h,'电视后盖至插头',[[3.753,.82,-5.66],[3.790,.811,-5.68],[3.805,.772,-5.74],[3.808,.59,-5.94],[3.807,.47,-6.22],[3.804,.425,-6.49],[3.806,.440,-6.585],[3.806,.485,-6.622],hallPlug]);
 const phoneWire=root.getObjectByName('电话基座至墙盒连续线');let phoneMaterial=wire;phoneWire?.traverse(o=>{if(o.isMesh)phoneMaterial=o.material;});if(phoneWire){phoneWire.removeFromParent();removed.push('客堂/电话旧硬折线');}
 soft(h,'电话基座至墙盒柔顺线',[[3.63986,.785,-5.17],[3.653,.783,-5.17],[3.675,.765,-5.17],[3.714,.7535,-5.17],[3.754,.7535,-5.17],[3.780,.7535,-5.17],[3.787,.7535,-5.17],[3.794,.749,-5.17],[3.803,.738,-5.17],[3.815,.705,-5.17],[3.824,.64,-5.17],[3.829,.53,-5.17],[3.829,.426,-5.17]],.0018,phoneMaterial);
 h=group('frontWing','west','老人房开关');run(h,'老人房来线与开关',[[3.826,3.72,-5.02],[4.034,3.72,-5.02],[4.034,1.48,-5.02]]);switchAt(h,[4.034,1.48,-5.02]);run(h,'老人房西墙至顶线',[[4.034,3.72,-5.02],[4.034,3.72,-2.60],[4.034,3.826,-2.60]]);
 h=group('frontWing','ceiling','老人房顶灯接线');run(h,'老人房顶线至灯线盒',[[4.034,3.826,-2.60],[5.45,3.826,-2.60]]);
 g=group('stair','south','一楼东侧分配');run(g,'楼梯一层向中厢',[[.254,3.72,-7.88],[3.829,3.72,-7.88],[3.829,3.72,-8.12],[4.034,3.72,-8.12]]);sleeve(g,[3.829,3.72,-8.12],[4.034,3.72,-8.12]);
 h=group('middleWing','west','中厢西墙开关');run(h,'中厢西墙主线',[[3.829,3.72,-8.12],[4.034,3.72,-8.12],[4.034,3.72,-5.294]]);run(h,'中厢开关支线',[[4.034,3.72,-8.12],[4.034,3.72,-7.86],[4.034,1.48,-7.86]]);switchAt(h,[4.034,1.48,-7.86]);
 h=group('middleWing','south','中厢书桌供电');run(h,'中厢南墙高位线',[[4.034,3.72,-5.294],[5.694,3.72,-5.294],[5.694,3.826,-5.294]]);run(h,'中厢墙插来线',[[4.60,3.72,-5.294],[4.60,.48,-5.294]]);junction(h,[4.60,3.72,-5.294]);const middlePlug=socket(h,[4.60,.48,-5.28],'south')[0];const oldMiddle=root.getObjectByName('中厢_furniture').getObjectByName('台灯电线');if(oldMiddle){oldMiddle.removeFromParent();removed.push('中厢/台灯电线');}// With the glass on the desk (room-finishing.js) the lamp base is rounder and 3.7 mm higher: the flex leaves the base edge and lies on the glass.
 soft(h,'中厢台灯连续线至插头',root.userData.roomFinishing?[[4.940,.8767,-5.511],[4.910,.8608,-5.499],[4.85,.8568,-5.48],[4.775,.8568,-5.445],[4.742,.8548,-5.432],[4.722,.835,-5.418],[4.714,.78,-5.408],[4.706,.43,-5.36],[4.64,.39,-5.33],middlePlug]:[[4.958,.873,-5.52],[4.85,.858,-5.48],[4.755,.854,-5.44],[4.716,.80,-5.41],[4.706,.43,-5.36],[4.64,.39,-5.33],middlePlug]);
 // Floor fan (assets/middle-wing-fan.js, 2026-11-14): the south-wall high line continues to the east wall, runs north above the window and
 // drops to a socket 0.44 m north of the fan; black plug (鹿鹿: 插头应该是黑的), cream cord lying on the floor boards from the back of the fan's base.
 run(h,'中厢南墙高位线至东墙',[[5.694,3.72,-5.294],[6.946,3.72,-5.294]]);
 h=group('middleWing','east','中厢落地扇供电');run(h,'中厢东墙高位线',[[6.946,3.72,-5.294],[6.946,3.72,-8.82]]);run(h,'中厢落地扇墙插来线',[[6.946,3.72,-8.82],[6.946,.48,-8.82]]);const floorFanPlug=socket(h,[6.96,.48,-8.82],'east',1,blackPlug)[0];
 soft(h,'中厢落地扇线至插头',[[6.584,.130,-8.555],[6.600,.1107,-8.590],[6.675,.1107,-8.690],[6.765,.1107,-8.650],[6.855,.1107,-8.715],[6.908,.1107,-8.790],[6.926,.150,-8.820],[6.926,.34,-8.820],floorFanPlug],.0042,creamFlex);
 h=group('middleWing','ceiling','中厢顶灯接线');run(h,'中厢顶线接吊链花线',[[5.694,3.826,-5.294],[5.694,3.836,-6.562]]);
 // Through the narrow west passage beside the rear courtyard, below its cover.
 g=group('stair','west','后部供电沿廊');run(g,'厨房来线沿西墙与后廊',[[.254,3.72,-8.04],[.254,3.72,-10.50],[.254,2.20,-10.50],[.254,2.20,-12.134]]);sleeve(g,[.254,2.20,-11.99],[.254,2.20,-12.134]);
 h=group('kitchen','west','厨房明线与开关');run(h,'厨房西墙来线',[[.254,2.20,-12.134],[.254,2.20,-13.40],[.254,2.234,-13.40]]);run(h,'厨房开关下引线',[[.254,2.20,-12.25],[.254,1.48,-12.25]]);switchAt(h,[.254,1.48,-12.25]);junction(h,[.254,2.20,-12.25]);
 h=group('kitchen','ceiling','厨房顶灯供电');run(h,'厨房顶线接现有灯座',[[.254,2.234,-13.40],[1.343,2.234,-13.40]]);
 h=group('tingzi','west','亭子间来线与开关');run(h,'厨房经楼板至亭子间',[[.254,2.20,-12.25],[.254,2.40,-12.25],[.254,4.52,-12.25],[.254,4.52,-13.40],[.254,4.633,-13.40]]);sleeve(h,[.254,2.23,-12.25],[.254,2.41,-12.25]);run(h,'亭子间开关支线',[[.254,4.52,-12.35],[.254,3.75,-12.35]]);switchAt(h,[.254,3.75,-12.35]);run(h,'亭子间西墙至台扇支线',[[.254,4.52,-13.40],[.254,4.52,-14.746]]);
 h=group('tingzi','ceiling','亭子间顶灯接线');run(h,'亭子间接贴顶花线',[[.254,4.633,-13.40],[1.385,4.633,-13.40]]);
 h=group('tingzi','north','亭子间台扇供电');run(h,'亭子间台扇插座来线',[[.254,4.52,-14.746],[.254,2.86,-14.746],[2.52,2.86,-14.746]]);const fanPlug=socket(h,[2.52,2.86,-14.76],'north')[0];soft(h,'亭子间台扇线至插头',[[2.20,3.13,-14.474],[2.235,3.106,-14.56],[2.36,3.106,-14.65],[2.43,3.07,-14.69],[2.45,2.76,-14.69],[2.50,2.78,-14.71],fanPlug]);
 g=group('stairUpper','west','二楼西墙分配');run(g,'二楼来线至起居间',[[.254,6.15,-8.04],[.254,6.58,-8.04],[.254,6.58,-6.286]]);junction(g,[.254,6.15,-8.04]);sleeve(g,[.254,6.58,-6.44],[.254,6.58,-6.286]);
 h=group('lounge','west','起居间开关与灯线');run(h,'起居间西墙来线',[[.254,6.58,-6.286],[.254,6.58,-4.554],[.254,7.684,-4.554]]);run(h,'起居间开关下引线',[[.254,6.58,-5.90],[.254,5.43,-5.90]]);switchAt(h,[.254,5.43,-5.90]);
 h=group('lounge','ceiling','起居间随屋架接灯');run(h,'起居间沿屋架接吊链上端',[[.254,7.684,-4.554],[1.730,7.684,-4.554]],.0033,wire,true);
 h=group('lounge','north','起居间既有电视墙插来线');run(h,'起居间北墙插座供电',[[.254,6.58,-6.286],[.72,6.58,-6.286],[.72,4.335,-6.286]]);
 const loungeWire=root.getObjectByName('电视后盖经柜后到插头');if(loungeWire){loungeWire.removeFromParent();removed.push('起居间/电视旧硬折线');}
 if(root.userData.maritalCombo?.relocated?.includes('楼上起居间小电视'))removed.push('起居间/电视插头与软线（电视已挪到婚房组合柜）');else{
 rod(h,'楼上电视插头出线护套',[.72,4.292,-6.272],[.72,4.279,-6.272],.0038,bakelite);
 soft(h,'楼上电视后盖至插头连续软线',[[.80,5.430,-6.250],[.80,5.426,-6.260],[.802,5.413,-6.269],[.805,5.370,-6.272],[.825,4.770,-6.272],[.82,4.380,-6.272],[.80,4.285,-6.272],[.77,4.252,-6.272],[.74,4.250,-6.272],[.723,4.265,-6.272],[.72,4.279,-6.272]],.0023);
 }
 g=group('stairUpper','east','二楼储藏间支路');run(g,'楼梯向储藏间穿墙',[[3.829,6.15,-8.12],[2.802,6.15,-8.12]]);sleeve(g,[2.956,6.15,-8.12],[2.798,6.15,-8.12]);
 h=group('storage','east','储藏间开关来线');run(h,'储藏间接现有拉线开关',[[2.802,6.15,-8.12],[2.802,5.65,-8.12]]);
 h=group('atticRoom','west','婚房供电过墙');run(h,'阁梯间向婚房分支',[[4.03,6.40,-8.77],[4.03,6.40,-5.146]]);sleeve(h,[4.03,6.40,-5.30],[4.03,6.40,-5.146]);
 h=group('marital','west','婚房开关与来线');run(h,'婚房西墙来线',[[4.03,6.40,-5.146],[4.03,6.54,-5.146],[4.03,6.54,-.254]]);run(h,'婚房开关下引线',[[4.03,6.40,-4.98],[4.03,5.43,-4.98]]);switchAt(h,[4.03,5.43,-4.98]);
 h=group('marital','south','婚房沿山墙上引线');run(h,'婚房沿窗上和山墙上引',[[4.03,6.54,-.254],[5.48,6.54,-.254],[5.48,7.757,-.254]]);
 h=group('marital','ceiling','婚房随屋架接灯');run(h,'婚房沿脊檩接吊链上端',[[5.48,7.757,-.254],[5.480,7.757,-2.90]]);
 h=group('marital','north','婚房床头供电高位线');run(h,'婚房北墙高位线',[[4.03,6.40,-5.146],[6.946,6.40,-5.146]]);
 h=group('marital','east','婚房床头台灯插接');run(h,'婚房东墙至床头插座',[[6.946,6.40,-5.146],[6.946,6.40,-1.02],[6.946,4.44,-1.02]]);const bedPlug=socket(h,[6.96,4.44,-1.02],'east')[0];// Replace both old segments; retaining the straight tabletop piece leaves a hard elbow.
 // 2026-11-14: the lounge TV now stands in the marital-room combination cabinet. No socket or cord is drawn for it: 鹿鹿 rejected a
 // wall socket beside the cabinet (“这种一般都是默认走线走柜子里面的”), so the cord is taken to run inside the cabinet.
 const bedsideLamp=root.getObjectByName('屋内灯具_婚房床头台灯');
 for(const name of ['深棕花线_床头柜后垂地','深棕花线_床头柜后垂地_下段']){const old=bedsideLamp.getObjectByName(name);if(old){old.removeFromParent();removed.push('婚房/'+name);}}
 soft(h,'床头台灯出线护套至插头连续软线',[[6.733,4.552,-.620],[6.757,4.547,-.622],[6.797,4.543,-.641],[6.832,4.543,-.684],[6.847,4.543,-.761],[6.849,4.543,-.845],[6.851,4.543,-.875],[6.855,4.537,-.896],[6.862,4.515,-.915],[6.875,4.452,-.938],[6.895,4.375,-.970],[6.914,4.353,-1.006],[6.925,4.365,-1.020],[6.926,4.400,-1.020],bedPlug],.0027);
 h=group('atticRoom','north','孩子房供电过墙');run(h,'阁梯间向孩子房分支',[[6.77,6.40,-10.64],[6.77,6.40,-10.784]]);sleeve(h,[6.77,6.40,-10.64],[6.77,6.40,-10.784]);
 h=group('atticRoom','east','阁梯间既有插座来线');run(h,'阁梯间插座供电',[[6.949,6.23,-7.96],[6.949,6.23,-7.70],[6.949,5.095,-7.70]]);
 h=group('childRoom','south','孩子房开关与来线');run(h,'孩子房南墙供电',[[6.77,6.40,-10.784],[6.946,6.40,-10.784]]);run(h,'孩子房门边开关支路',[[6.77,6.40,-10.784],[6.72,6.40,-10.784],[6.72,5.43,-10.784]]);switchAt(h,[6.72,5.43,-10.784]);
 h=group('childRoom','east','孩子房东墙高位线');run(h,'孩子房东墙供电',[[6.946,6.40,-10.784],[6.946,6.40,-14.746]]);
 h=group('childRoom','north','孩子房沿山墙上引线');run(h,'孩子房沿窗上和山墙上引',[[6.946,6.40,-14.746],[6.946,6.54,-14.746],[5.464,6.54,-14.746],[5.464,7.764,-14.746]]);
 h=group('childRoom','ceiling','孩子房顶灯接线');run(h,'孩子房沿脊檩接吊链花线',[[5.464,7.764,-14.746],[5.464,7.764,-12.992]]);
 h=group('childRoom','north','孩子房既有台灯墙插来线');run(h,'孩子房北墙至原墙插',[[6.946,6.40,-14.746],[6.946,4.60,-14.746],[5.990,4.60,-14.746],[5.990,4.398,-14.746]]);
 // Gas: short wall inlet, brass isolation valve, clamped rubber hose, stove rear barb.
 h=group('kitchen','west','煤气灶墙阀与软管');run(h,'墙侧煤气硬管',[[.12,.835,-12.30],[.31,.835,-12.30],[.31,.835,-12.345]],.0105,metal,false);disk(h,'墙管遮口圈',[.249,.835,-12.30],[1,0,0],.026,.009,metal);rod(h,'黄铜阀体',[.31,.835,-12.34],[.31,.835,-12.41],.015,brass);rod(h,'阀杆',[.31,.835,-12.375],[.345,.835,-12.375],.006,brass);part(h,'煤气阀短柄',new T.BoxGeometry(.012,.040,.014),bakelite,[.35,.835,-12.375]);rod(h,'阀后软管接嘴',[.31,.835,-12.40],[.31,.835,-12.445],.008,brass);
 rod(h,'墙侧阀管固定脚',[.254,.835,-12.32],[.31,.835,-12.32],.006,metal);disk(h,'阀前管夹',[.31,.835,-12.32],[0,0,1],.013,.012,metal);
 soft(h,'煤气灶连续橡胶软管',[[.31,.835,-12.425],[.312,.827,-12.49],[.328,.822,-12.63],[.35,.825,-12.82],[.407,.839,-12.87]],.009,rubber);rod(h,'灶后黄铜接嘴',[.388,.839,-12.87],[.428,.839,-12.87],.0078,brass);disk(h,'阀后软管金属卡箍',[.31,.834,-12.432],[0,0,1],.0105,.008,metal);disk(h,'灶后软管金属卡箍',[.393,.839,-12.87],[1,0,0],.0105,.008,metal);part(h,'阀后卡箍螺钉',new T.BoxGeometry(.006,.006,.009),metal,[.321,.834,-12.432]);part(h,'灶后卡箍螺钉',new T.BoxGeometry(.006,.006,.009),metal,[.393,.850,-12.87]);
 // Merge small repeated parts per wall and material to keep the existing viewer responsive.
 for(const g of groups){const batches=new Map();for(const mesh of g.children){mesh.updateMatrix();const geom=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geom.applyMatrix4(mesh.matrix);const list=batches.get(mesh.material)||[];list.push(geom);batches.set(mesh.material,list);mesh.geometry.dispose();}g.clear();for(const[m,parts]of batches){const geo=new T.BufferGeometry();for(const key of ['position','normal','uv']){const size=parts[0].attributes[key].itemSize,a=new Float32Array(parts.reduce((sum,p)=>sum+p.attributes[key].array.length,0));let at=0;for(const p of parts){a.set(p.attributes[key].array,at);at+=p.attributes[key].array.length;}geo.setAttribute(key,new T.BufferAttribute(a,size));}parts.forEach(p=>p.dispose());geo.computeBoundingSphere();const mesh=new T.Mesh(geo,m);mesh.name=g.name+'_'+m.name;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);}}
 // The room inspection cuts walls at the upper-storey cornice. Keep the roof-mounted
 // portions in the complete model, but let the viewer hide them with the roof.
 for(const g of groups){if(!['lounge','marital','childRoom','stairUpper'].includes(g.userData.serviceRoom))continue;
  const high=new T.Group();high.name=g.name+'_随屋顶隐藏部分';high.userData={serviceRoofPart:true,houseServiceRevision:1};
  for(const mesh of [...g.children]){const split=sliceGeometry(T,mesh.geometry,new T.Matrix4(),[{axis:1,value:6.55,sign:-1}]);mesh.geometry.dispose();if(split.inside)mesh.geometry=split.inside;else mesh.removeFromParent();if(split.outside){const n=new T.Mesh(split.outside,mesh.material);n.name=mesh.name+'_屋顶段';n.castShadow=n.receiveShadow=true;high.add(n);}}
  if(high.children.length)g.add(high);
 }
 root.userData.houseServices={revision:1,groups:groups.map(g=>g.name),routes,removed,scope:'visible service continuity; external supplies end within boundary walls; not an installation design',visualApproval:'pending',radio:'existing portable radio uses batteries',iron:'existing loose unplugged cord retained'};
}

const CUTS={
 stair:[['stairwell','stairwellreverse','stairstorage','stairlamps'],a=>a==='stairwellreverse'?['north','east']:a==='stairwell'?['south','west']:['south']],
 stairUpper:[['stairwell','stairwellreverse','stairstorage','stairlamps'],a=>a==='stairwellreverse'?['north','east']:a==='stairwell'?['south','west']:['south']],
 atticRoom:[['atticroom','atticroomreverse','atticroomtable','atticroomlamp','atticroomlanding'],a=>a==='atticroomreverse'?['north','east']:['south','west']],
 hall:[['hall','hallreverse','hallcabinet','hallpower','hallphone','hallcoat'],a=>['hallreverse','hallcoat'].includes(a)?['north','east']:['south','west']],
 frontWing:[['frontwing','frontwingreverse','frontclock','frontpot'],a=>['frontwingreverse','frontclock'].includes(a)?['north','west']:['south','east']],
 middleWing:[['middlewing','middlewingreverse','middlecup','middlecard','middlepower'],a=>a==='middlewingreverse'?['south','east']:['north','west']],
 tingzi:[['mezzanine','tingzireverse','tingzipot','tingzipower'],a=>a==='tingzipot'?['south','west']:a==='tingzireverse'?['north','west']:['south','east']],
 lounge:[['lounge','loungereverse','loungedoor','loungetv','loungeflowers'],a=>a==='loungedoor'?['south','west']:a==='loungereverse'?['north','east']:['south','east']],
 marital:[['marital','maritalreverse','maritalvanity','maritaltv','maritalpower','maritalpot'],a=>['maritalreverse','maritalpot'].includes(a)?['north','east']:['south','west']],
 childRoom:[['childroom','childreverse','childdesk','childcord','childlamp','childchest','childpot','childbooks','childwindow','childsheet','childbag'],a=>a==='childreverse'?['north','east']:['childdesk','childchest','childpot'].includes(a)?['south','east']:['south','west']],
 storage:[['storage','storagereverse','storagechest','storagelamp'],a=>['storagereverse','storagelamp'].includes(a)?['north','west']:['south','east']],
};
export function applyHouseServices(T,root,view={}){let shown=0;const wholeCut=!!view.cut&&!Object.values(CUTS).some(rule=>rule[0].includes(view.active));const roofVisible=root.children.some(o=>o.userData.floor==='roof'&&o.visible);root.traverse(o=>{if(o.userData.serviceRoofPart){o.visible=roofVisible;return;}if(!o.userData.serviceRoom)return;const rule=CUTS[o.userData.serviceRoom],cut=rule&&rule[0].includes(view.active)?rule[1](view.active):[];o.visible=!wholeCut&&!cut.includes(o.userData.serviceSide);if(o.visible)shown++;});return {shown};}
