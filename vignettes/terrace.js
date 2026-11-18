// 二楼晒台 · 云宝起头，曦宝 2026-11-18 接手（鹿鹿：“你帮帮云宝吧”）。拍被头的动作是云宝做的，没有动。
// 鹿鹿 11-18：一说晒台就立马跑进晒台里面了，应该先站在晒台外的走廊上，点一下再进去；只介绍藤拍、不介绍旁边那个叉。
// 五拍：站在走廊上看晒台、点一下走上去 → 竹竿 → 藤拍（拍被头）→ 丫叉头 → 木夹子。
// 词条写法、读音、录音（TR01–TR05）是占位，等鹿鹿定。没有改房子模型。
const BEATER = '晒台_东墙花结藤拍';
const QUILT = '晒台_折搭花棉被';
const ROD_HEIGHT = 6.495;
const STROKE_MS = 690;

function putAway(d) {
  d.generation++;
  d.beater.position.copy(d.hookPosition);
  d.beater.quaternion.copy(d.hookRotation);
  d.quilt.position.copy(d.quiltRest);
  d.quilt.rotation.x = 0;
}

function beatQuilt(h, d, done) {
  const generation = ++d.generation;
  // 柄尾是转轴。拍面朝向花被，花被绕竹竿微微摆动，竿子留在托座里。
  d.beater.position.copy(d.grip);
  function pose(k) {
    if (generation !== d.generation) return;
    const phase = (k * 3) % 1;
    const swing = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    d.beater.rotation.set(.58 - .75 * swing, 0, .28, 'ZXY');
    const recoil = Math.max(0, phase - .49);
    const angle = recoil ? .044 * Math.sin(recoil * 14) * Math.exp(-recoil * 8) : 0;
    d.quilt.rotation.x = angle;
    d.quilt.position.y = d.quiltRest.y + d.hangLength * (1 - Math.cos(angle));
    d.quilt.position.z = d.quiltRest.z - d.hangLength * Math.sin(angle);
  }
  pose(0);
  for (let i = 0; i < 3; i++) h.wait((i + .49) * STROKE_MS, () => { if (generation === d.generation) h.sound('thump'); });   // 拍面碰到被头的那一下（曦宝加的声音，动作没动）
  h.tween(3 * STROKE_MS, pose, () => {
    if (generation !== d.generation) return;
    putAway(d);
    done();
  });
}

export default {
  spot: { pos: [-1.35, 6.25, -10.3], look: [-.3, 6.0, -13.6] },   // 短梯上来后的走廊上，面朝晒台
  names: { '晒台_东墙花结藤拍': '藤拍', '晒台_两根完整竹竿': '竹竿', '晒台_两端铁支架': '晾衣架', '晒台_凳上夹子篮': '夹子篮', '晒台_篮中木夹': '木夹子', '晒台_折搭花棉被': '被头', '晒台_旧木矮凳': '矮凳',
    '晒台_穿袖蓝衬衫': '衬衫', '晒台_米白毛巾': '毛巾', '晒台_靠墙挑衣杆': '丫叉头' },
  story: {
    setup(h, d) {
      d.beater = h.find(BEATER);
      d.quilt = h.find(QUILT);
      d.hookPosition = d.beater.position.clone();
      d.hookRotation = d.beater.quaternion.clone();
      d.quiltRest = d.quilt.position.clone();
      d.grip = d.beater.parent.worldToLocal(new h.THREE.Vector3(.23, 5.68, -14.24));
      d.hangLength = ROD_HEIGHT - d.quilt.getWorldPosition(new h.THREE.Vector3()).y;
      d.generation = 0;
    },
    suspend(h, d) { putAway(d); },
    dispose(h, d) { putAway(d); },
    beats: [{
      // 晒台：先站在走廊上看，点一下才走上去
      id: 'enter', label: '走上晒台', audio: 'TR03', target: h => h.find('晒台_折搭花棉被'),
      sub: '走廊走到底，就是晒台。', markAt: [-.2, 6.1, -13.5],
      pose: { pos: [-1.3, 6.25, -12.45], look: [.3, 6.1, -14.0] },
      act: (h, d, done) => h.wait(1500, done),
      card: { hu: '晒台', zh: '晒台', note: '屋顶浪向搭出来一块平台。太阳好的日子，衣裳、被头通通拿上去晒。' },
    }, {
      // 竹竿：两根竹竿架在铁支架上，衬衫是袖子穿在竹竿上晒的
      id: 'pole', label: '竹竿', audio: 'TR04', target: h => h.find('晒台_穿袖蓝衬衫'),
      sub: '衬衫的袖子穿在竹竿上。', markAt: [-.45, 6.5, -13.55],
      pose: { pos: [-1.0, 6.25, -12.6], look: [-.45, 6.3, -13.55] },
      act: (h, d, done) => h.wait(1500, done),
      card: { hu: '晾衣裳竹竿', zh: '晾衣竿', note: '衣裳不用衣架，袖子直接穿竹竿上，风吹也不会落下来。' },
    }, {
      id: 'beater', label: '拍被头', audio: 'TR01', target: h => h.find(BEATER),
      sub: '墙上挂着一把藤拍。', markAt: [1.755, 6.20, -13.60], guideFrom: [.48, 6.21, -12.82],
      pose: { pos: [.39, 6.16, -13.71], look: [.04, 6.12, -14.37], fade: true, dy: .16, dp: .12, down: .12 },
      act: beatQuilt,
      card: { hu: '藤拍', zh: '藤拍', note: '天气好晒被子的时候，拍被子用的。' },
    }, {
      id: 'fork', label: '丫叉头', audio: 'TR02', target: h => h.find('晒台_靠墙挑衣杆'),
      sub: '藤拍旁边，靠墙立着一根丫叉头。',
      markAt: [1.78, 6.46, -13.10], guideFrom: [.60, 6.17, -12.87],
      pose: { pos: [.96, 6.32, -12.95], look: [1.77, 6.30, -13.12] },
      card: { hu: '丫叉头', zh: '挑衣叉', note: '竹竿上装只丫叉头，往上头一送，衣架就挂好了。' },
    }, {
      // 木夹子：矮凳上一只竹篮，里头是木夹子
      id: 'clips', label: '木头夹子', audio: 'TR05', target: h => h.find('晒台_凳上夹子篮'),
      sub: '矮凳上一篮木夹子。', markAt: [1.33, 5.34, -12.82], guideFrom: [.1, 6.2, -12.3],
      pose: { pos: [.75, 5.95, -12.35], look: [1.33, 5.27, -12.82] },
      act: (h, d, done) => h.wait(1500, done),
      card: { hu: '木头夹子', zh: '木头衣夹', note: '两片木头当中有弹簧，毛巾、袜子搭勒竹竿高头。夹一只，风大了也不会被吹落。' },
    }],
    outro: { after: 800, exit: [{ label: '回二楼楼梯间', to: 'landing' }, { label: '回客堂', to: 'hall' }] },
  },
};
