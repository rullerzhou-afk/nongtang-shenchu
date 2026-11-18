// 亭子间 · 云宝。只在游戏运行时替换静态纸页；离开游戏恢复原件。
// 摘抄沿用 concepts/literary-quotes-v1/选定摘抄.md，未声称完成纸质版校勘。
export const PAGES = [
  { title: '门外文谈', lines: ['鲁迅', '', '听说今年上海的热，', '是六十年来所未有的。', '白天出去混饭，', '晚上低头回家，'] },
  { lines: ['屋子里还是热，', '并且加上蚊子。', '这时候，只有门外', '是天堂。因为海边的', '缘故罢，总有些风，', '用不着挥扇。'] },
  { lines: ['虽然彼此有些认识，', '却不常见面的寓在', '四近的亭子间或搁楼', '里的邻人也都坐出来了，'] },
  { lines: ['他们有的是店员，', '有的是书局里的校对员，', '有的是制图工人的好手。', '', '——《门外文谈》节录'] },
];
export function createNotebook(h) {
  const T=h.THREE, original=h.find('桌上摊开的书');
  if(!original) throw new Error('亭子间本子不存在');
  original.updateWorldMatrix(true,true);
  const savedVisible=original.visible, g=new T.Group();g.name='亭子间_可翻阅练习本';
  const rest=original.position.clone(), restQ=original.quaternion.clone();
  g.position.copy(rest);g.quaternion.copy(restQ);original.parent.add(g); original.visible=false;
  const width=.142,height=.205, textures=[], materials=[], geometries=[];
  const material=(o)=>{const m=new T.MeshStandardMaterial(o);materials.push(m);return m};
  const geo=(o)=>{geometries.push(o);return o};
  function texture(page) {
    const c=document.createElement('canvas');c.width=768;c.height=1108;const x=c.getContext('2d');
    x.fillStyle='#eee5cd';x.fillRect(0,0,c.width,c.height);
    const shade=x.createLinearGradient(0,0,c.width,0);shade.addColorStop(0,'rgba(102,76,39,.16)');shade.addColorStop(.1,'rgba(102,76,39,0)');shade.addColorStop(1,'rgba(102,76,39,.035)');x.fillStyle=shade;x.fillRect(0,0,c.width,c.height);
    x.strokeStyle='rgba(104,126,135,.35)';x.lineWidth=2;
    for(let y=186;y<1020;y+=86){x.beginPath();x.moveTo(45,y);x.lineTo(726,y);x.stroke()}
    x.strokeStyle='rgba(151,83,66,.3)';x.beginPath();x.moveTo(45,103);x.lineTo(726,103);x.stroke();
    x.fillStyle='#364450';x.textAlign='left';x.font='43px "Kaiti SC","STKaiti","KaiTi",serif';
    if(page.title){x.font='54px "Kaiti SC","STKaiti",serif';x.fillText(page.title,72,164);x.font='43px "Kaiti SC","STKaiti",serif'}
    page.lines.forEach((line,i)=>x.fillText(line,65, page.title?250+i*86:250+i*86));
    x.font='26px serif';x.fillStyle='#8e8778';x.fillText(String(textures.length+1),365,1060);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;textures.push(tex);return tex;
  }
  const paperM=PAGES.map(p=>material({map:texture(p),roughness:.96,side:T.FrontSide}));
  const cover=material({color:0x7b806a,roughness:.95}),edge=material({color:0xd1c6a8,roughness:1});
  const mesh=(geometry,mat,parent=g)=>{const m=new T.Mesh(geo(geometry),mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
  // XY 页面，正面 +z；平放时转到向上。书脊中心固定，阅读时整本立起。
  const pages=new T.Group();pages.rotation.x=-Math.PI/2;g.add(pages);
  for(const sign of [-1,1]){const c=mesh(new T.BoxGeometry(width+.004,height+.006,.0015),cover,pages);c.position.set(sign*width/2,0,-.002);const e=mesh(new T.BoxGeometry(width-.001,height-.002,.004),edge,pages);e.position.set(sign*width/2,0,.001)}
  const left=mesh(new T.PlaneGeometry(width,height,20,1),paperM[0],pages);left.position.set(-width/2,0,.0035);
  const right=mesh(new T.PlaneGeometry(width,height,20,1),paperM[1],pages);right.position.set(width/2,0,.0035);
  const turn=new T.Group();turn.position.z=.004;pages.add(turn);turn.visible=false;
  const front=mesh(new T.PlaneGeometry(width,height,28,1),paperM[1],turn);front.position.x=width/2;
  const back=mesh(new T.PlaneGeometry(width,height,28,1),paperM[2],turn);back.position.x=width/2;back.rotation.y=Math.PI;
  const upright=rest.clone().add(new T.Vector3(0,.185,.015));
  let spread=0, busy=false, raised=false, lift=0;
  function setLift(k){lift=k;g.position.copy(rest).lerp(upright,k);g.quaternion.copy(restQ).slerp(new T.Quaternion(),k);pages.rotation.x=-Math.PI/2*(1-k)}
  function setSpread(n){spread=n;left.material=paperM[n*2];right.material=paperM[n*2+1];turn.visible=false;g.userData.spread=n}
  function flip(direction, tween, done){
    const next=spread+direction;if(busy||!raised||next<0||next>=PAGES.length/2)return false;
    busy=true;turn.visible=true;
    if(direction>0){front.material=paperM[spread*2+1];back.material=paperM[next*2];right.material=paperM[next*2+1]}
    else {front.material=paperM[next*2+1];back.material=paperM[spread*2];left.material=paperM[next*2]}
    tween(850,k=>{
      const a=direction>0?k:1-k;turn.rotation.y=-Math.PI*a;
      for(const m of [front,back]){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const u=(p.getX(i)+width/2)/width;p.setZ(i,Math.sin(u*Math.PI)*Math.sin(a*Math.PI)*.016*(m===front?1:-1))}p.needsUpdate=true;m.geometry.computeVertexNormals()}
    },()=>{setSpread(next);busy=false;done?.()});return true;
  }
  return {g,original,rest, get spread(){return spread},get busy(){return busy},get raised(){return raised},get lift(){return lift},total:PAGES.length/2,
    raise(tween,done){busy=true;tween(1000,k=>setLift(k),()=>{busy=false;raised=true;done?.()})},
    lower(tween,done){if(busy)return;busy=true;const from=lift;tween(800,k=>setLift(from*(1-k)),()=>{busy=false;raised=false;setSpread(0);done?.()})},
    flip, reset(){busy=false;raised=false;setLift(0);setSpread(0)},
    dispose(){g.removeFromParent();original.visible=savedVisible;for(const x of [...textures,...materials,...geometries])x.dispose()},
  };
}
