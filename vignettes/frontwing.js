// 前厢 · 老人房 · 负责人：曦宝
// 分镜：concepts/room-vignettes/老人房分镜.md。从客堂掀门帘进来，顺时针一圈：被头 → 大橱 → 无线电 → 台钟 → 坐竹摇椅。
// 不用阿婆的口吻。词卡用鹿鹿录制的沪语配音。

// 给物件套一个“转轴”（pivot）：轴心在它正下方的中心，压扁、回弹时底面不动
function pivotUnder(h, o) {
  const T = h.THREE, bb = new T.Box3().setFromObject(o), p = new T.Group(), parent = o.parent; p.name = o.name + '_转轴';
  parent.updateWorldMatrix(true, false); p.position.copy(parent.worldToLocal(new T.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2))); parent.add(p); p.attach(o);
  return { p, undo() { parent.attach(o); parent.remove(p); } };
}

export default {
  spot: { pos: [2.5, 1.55, -4.15], look: [3.7, 1.15, -1.6] },   // 掀开门帘跨进来，床在左手，大橱在右手，尽头是南窗
  next: { to: 'hall', label: '回客堂' },
  sit: /竹摇椅/,
  // 点到物件时显示的名字（模型里的名字是给做的人看的，不能直接给玩家看）
  names: { 'front-wing_新增道具': '台钟', '生活器具_front-wing': '痰盂', '指针收音机': '无线电', '老人房三开门大橱': '大橱', '老人房柜顶皮箱和樟木箱': '皮箱 · 樟木箱', '老人房大橱里的衣服': '大橱里的衣裳',
    '南窗下三抽矮柜': '矮柜', '老人房矮柜_钩花柜顶巾': '钩花台布', '高低木床': '木床', '床头小柜': '床头柜', '竹器_老人房竹摇椅': '竹摇椅', '墙上挂贴_老人房北墙退休证': '退休证',
    '老人房_牡丹国民床单床垫': '牡丹床单', '老人房_牡丹床单垂边_东': '牡丹床单', '老人房_牡丹床单垂边_西': '牡丹床单', '老人房_绿缎面叠被': '被头', '老人房_绿缎面叠被_转轴': '被头', '老人房_橙红枕巾枕头_1': '枕头', '老人房_橙红枕巾枕头_2': '枕头',
    '屋内灯具_老人房荷叶罩吊灯': '吊灯', '屋内帘子_老人房东窗帘': '窗帘', '屋内帘子_老人房南窗帘': '窗帘', '屋内帘子_老人房西窗帘': '窗帘', '屋内帘子_老人房东窗白网眼纱半帘': '纱帘' },
  story: {
    setup(h, d) {
      d.quilt = h.find('老人房_绿缎面叠被'); if (d.quilt) d.quiltPivot = pivotUnder(h, d.quilt);
      d.door = h.find('大橱镜门_门轴'); if (d.door) d.doorHome = d.door.quaternion.clone();
    },
    dispose(h, d) {
      if (d.quiltPivot) { d.quiltPivot.p.scale.set(1, 1, 1); d.quiltPivot.undo(); } if (d.door) d.door.quaternion.copy(d.doorHome);
    },
    beats: [
      // 被头：走到床边凑近看。点了以后被子像被拍了一下，往下一沉再弹回来
      { id: 'quilt', audio: 'W11', label: '被头', sub: '床上的被头叠得方方正正。', target: '老人房_绿缎面叠被',
        pose: { pos: [2.98, 1.5, -3.5], look: [3.95, .72, -3.36] },
        act: (h, d, done) => { if (!d.quiltPivot) return done(); const p = d.quiltPivot.p; h.tween(900, k => { const s = 1 - .13 * Math.exp(-4 * k) * Math.sin(k * Math.PI * 3); p.scale.set(1 + (1 - s) * .25, s, 1 + (1 - s) * .25); }, () => { p.scale.set(1, 1, 1); done(); }); },
        card: { hu: '被头', zh: '被子', note: '缎子被面，白布被里。每年黄梅天过脱之后，要拆开来汏、翻棉花毯。' } },
      // 大橱：中间的镜门自己打开，露出挂着的中山装
      { id: 'wardrobe', audio: 'W12', label: '开大橱', sub: '大橱的镜子有点花了。', target: '老人房三开门大橱', markAt: [2.62, 1.3, -2.9],
        pose: { pos: [3.85, 1.5, -2.75], look: [2.3, 1.25, -2.9] },
        act: (h, d, done) => { if (!d.door) return done(); const T = h.THREE, q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), reach = a => { d.door.quaternion.copy(d.doorHome).multiply(q.setFromAxisAngle(up, a)); return new T.Box3().setFromObject(d.door).max.x; };
          const sign = reach(.6) > reach(-.6) ? 1 : -1; reach(0);   // 门该往屋里（东）开：两个方向各试一下，看哪边伸进屋里
          h.tween(1500, k => { const e = k * k * (3 - 2 * k); d.door.quaternion.copy(d.doorHome).multiply(q.setFromAxisAngle(up, sign * 1.75 * e)); }, () => h.wait(700, done)); },
        card: { hu: '大橱', zh: '大衣柜', note: '三开门，当中一面镜子。出客衣裳挂在里面，橱顶上头是樟木箱。' } },
      // 无线电：镜头停留片刻后出词卡
      { id: 'radio', audio: 'W13', label: '开无线电', sub: '矮柜上摆着一只无线电。', target: '指针收音机',
        pose: { pos: [2.78, 1.42, -1.5], look: [3.36, .88, -.58] },
        act: (h, d, done) => h.wait(1800, done),
        card: { hu: '无线电', zh: '收音机', note: '上海人管收音机叫无线电。早上听新闻，夜里听说书。' }, collect: ['turn', 3] },
      // 台钟：就在无线电旁边，不用挪步。报时声 audio/clock.m4a 也还没有
      { id: 'clock', audio: 'W14', label: '台钟', sub: '旁边一只红壳子的台钟。', target: '老人房矮柜台钟',
        act: (h, d, done) => { h.sound('clock', { volume: .6 }); h.gaze([3.12, .9, -.58], { go: 700, hold: 1500 }, done); },
        card: { hu: '台钟', zh: '座钟', note: '三五牌台钟，上海造。上好一趟发条，好走十五天。三五一十五。' } },
      // 竹摇椅：坐进去，往后一靠（朝向和高度按椅子自己量）
      { id: 'sit', audio: 'W15', label: '坐一坐', sub: '窗下一把竹摇椅。', target: '竹器_老人房竹摇椅', sit: true,
        card: { hu: '摇椅', zh: '摇椅', note: '竹头做的摇椅，夏天坐上去凉飕飕的。' } },
      // 鹿鹿 2026-11-17：坐在摇椅上不要下来（起身会退到摇椅后面），直接转头看北墙上的退休证
      { id: 'cert', audio: 'W16', label: '退休证', sub: '床头的墙上挂着一张证书。', target: '墙上挂贴_老人房北墙退休证',
        pose: { pos: [2.94, 1.52, -4.42], look: [2.92, 1.52, -5.12] },   // 点了以后从摇椅上起来，走到证书跟前（床头柜前），证书占到画面中间
        act: (h, d, done) => h.wait(1400, done),
        // 厂史出处（2026-11-17 查）：澎湃 https://m.thepaper.cn/baijiahao_29366496 。证书上的单位名是鹿鹿 11-14 定的“上海龙头（十七棉）股份有限公司”
        card: { hu: '退休证', zh: '退休证', note: '阿婆在厂里做了三十二年。这片厂个前身是裕丰纱厂，解放后头是国营个上海第十七棉纺织厂。' } },
    ],
    // 看完退休证就可以直接回客堂：画面下方出“回客堂”，不点也可以接着坐（鹿鹿 11-17：是回客堂，不是回弄堂）
    outro: { after: 1500, sub: '屋里静悄悄的，只有钟在走。', exit: { label: '回客堂', to: 'hall' } },
  },
};
