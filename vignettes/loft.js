// 阁楼（局部储藏阁楼）· 负责人：曦宝
// 鹿鹿 2026-11-18：阁楼要做，亮点是老虎窗；做一个能望出去的视角，或者直接淡入淡出过渡出去，看到天空、看到街区全景。
// 三拍：阁楼（一堆箱子）→ 老虎窗（抬头看）→ 望出去（叠化到窗外，朝正前方看屋顶和天，一群鸽子飞过去）。
// 鹿鹿 2026-11-18 看过第一版：左右两边没有建模，转头看光秃秃的很怪——不转头了，停在窗外也只能小幅度转；“再高一点”那一拍去掉；天上画几只飞鸟。
// 不用阿婆的口吻。词条写法、读音、录音（LF01–LF03）是占位，等鹿鹿定。没有改房子模型。

// 一块看不见的板，给不是陈设的地方（窗口、天上）当可以点的目标
const mark = (h, name, w, hh, at) => { const T = h.THREE, m = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })); m.name = name; m.position.fromArray(at); h.scene.add(m); return m; };
const OUT = [-.44, 8.72, -4.5];   // 老虎窗外、贴着窗口的位置（窗玻璃在 z -4.73 到 -5.06，朝南）
// 一群鸽子：每只是两片会扇的三角形翅膀，本地做的，不是生成的模型。从东边斜着往西南飞过窗前的天，飞完隔几秒再来一趟
const FLY = 8200, REST = 3600, FROM = [36, 14.5, 20], TO = [-40, 19, 46];
const flock = (h) => {
  const T = h.THREE, mat = new T.MeshBasicMaterial({ color: 0x33363b, side: T.DoubleSide, fog: false }), g = new T.Group(); g.name = '窗外的鸽子'; g.visible = false;
  const wing = new T.BufferGeometry(); wing.setAttribute('position', new T.Float32BufferAttribute([0, 0, .1, 0, 0, -.13, .34, 0, .07,  .34, 0, .07, 0, 0, -.13, .68, 0, -.2], 3));   // 翅根—翅肘—翅尖，翅尖往后掠
  const body = new T.BufferGeometry(); body.setAttribute('position', new T.Float32BufferAttribute([0, 0, .27, .055, 0, 0, -.055, 0, 0,  .055, 0, 0, 0, 0, -.33, -.055, 0, 0], 3));
  const yaw = Math.atan2(TO[0] - FROM[0], TO[2] - FROM[2]);   // 身子朝着飞的方向
  const birds = [[0, 0, 0, 0], [1.6, .3, -1.8, .13], [-1.5, -.2, -2.1, .31], [3.1, .7, -3.9, .52], [-3.3, .4, -4.6, .74], [.4, -.5, -6.2, .9]].map(([x, y, z, ph]) => {
    const b = new T.Group(), l = new T.Mesh(wing, mat), r = new T.Mesh(wing, mat); r.scale.x = -1; b.add(l, r, new T.Mesh(body, mat)); b.rotation.y = yaw; b.scale.setScalar(1.5); g.add(b); return { b, l, r, off: new T.Vector3(x, y, z).applyAxisAngle(new T.Vector3(0, 1, 0), yaw), ph };
  });
  h.scene.add(g);
  return { g, mat, wing, body, birds, t0: 0 };
};
const fly = (f, now) => {
  if (!f.t0) return; const t = (now - f.t0) % (FLY + REST), k = t / FLY; f.g.visible = k <= 1; if (k > 1) return;
  for (const { b, l, r, off, ph } of f.birds) {
    b.position.set(FROM[0] + (TO[0] - FROM[0]) * k + off.x, FROM[1] + (TO[1] - FROM[1]) * k + off.y + Math.sin(now / 700 + ph * 9) * .25, FROM[2] + (TO[2] - FROM[2]) * k + off.z);
    const a = Math.sin(now / 95 + ph * 20) * .6 + .12; l.rotation.z = a; r.rotation.z = -a;
  }
};

export default {
  spot: { pos: [2.45, 8.05, -6.2], look: [.3, 7.55, -6.5] },   // 从阁梯间的梯子上来。阁楼矮，人眼只到 1.35 米
  names: { 'W01_后排樟木箱': '樟木箱', 'W02_前排低木箱': '木箱', 'E01_后排旧木箱': '木箱', 'E02_右侧低木箱': '木箱', 'L01_直立旧板条箱': '板条箱', 'ST01_四直腿方凳': '方凳',
    'S01_木箱上棕皮箱': '皮箱', 'S02_下层深棕皮箱': '皮箱', 'S03_中层深棕皮箱': '皮箱', 'S04_上层旧黑皮箱': '皮箱', 'S05_右侧箱上皮箱': '皮箱',
    'G01_横长竹编箱': '竹箱', 'G02_高竹编箱': '竹箱', 'G02b_小竹编箱': '竹箱', 'G03_帆布旅行包': '旅行袋', 'G04_大圆口竹篮': '竹篮', 'G04b_套放小竹篮': '竹篮',
    'BK01_整摞旧书': '旧书', 'BK02_整摞旧书': '旧书', 'BK03_整摞旧书': '旧书', 'NP01_旧报纸捆': '旧报纸', 'NP02_旧报纸捆': '旧报纸', 'M01_横放卷席': '席子', 'M02_横放卷席': '席子', 'M03_横放卷席': '席子',
    'B01_蓝灰扎口包': '衣裳包', 'B02_旧布包': '衣裳包', 'B03_米白扎口包': '衣裳包', 'Q01_捆扎衣被包': '被头包', 'Q02_捆扎衣被包': '被头包' },
  story: {
    setup(h, d) {
      d.win = mark(h, '老虎窗', .9, .9, [-.44, 8.58, -5.1]);          // 窗口
      d.flock = flock(h); d.stopBirds = h.loop(now => fly(d.flock, now));
    },
    dispose(h, d) { d.stopBirds?.(); if (d.win) { h.scene.remove(d.win); d.win.geometry.dispose(); d.win.material.dispose(); } if (d.flock) { h.scene.remove(d.flock.g); d.flock.wing.dispose(); d.flock.body.dispose(); d.flock.mat.dispose(); } },
    beats: [
      // 阁楼：北墙下叠着的皮箱和樟木箱
      { id: 'attic', audio: 'LF01', label: '阁楼', sub: '屋顶底下，一只一只箱子叠着。', target: 'S03_中层深棕皮箱', also: ['S02_下层深棕皮箱', 'S04_上层旧黑皮箱', 'W01_后排樟木箱', 'B02_旧布包'], markAt: [-.05, 7.3, -7.9],
        pose: { pos: [.9, 7.95, -6.6], look: [-.25, 7.1, -7.9] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '阁楼', zh: '阁楼', note: '屋顶下头搭出来个一层。平常不用的东西，都放在上头。' } },
      // 老虎窗：走到窗底下抬头看
      { id: 'dormer', audio: 'LF02', label: '老虎窗', sub: '屋面上开着一扇老虎窗。', target: (h, d) => d.win, markAt: [-.44, 8.58, -5.1],
        pose: { pos: [-.44, 8.0, -7.2], look: [-.44, 8.56, -4.9] },
        act: (h, d, done) => h.wait(1600, done),
        card: { hu: '老虎窗', zh: '屋顶天窗', note: '屋顶上头搭出来一扇窗。英文叫 roof，上海宁听成“老虎”，就叫老虎窗。' } },
      // 望出去：叠化到窗外，朝正前方、略微抬头，不转头。鸽子飞过去。没有词卡。停在这里只能小幅度转头（dy、dp 收得很小），两边没建模的地方看不到
      { id: 'out', label: '望出去', sub: '探出头去，一片一片都是屋顶。', target: (h, d) => d.win, markAt: [-.44, 8.58, -5.1],
        pose: { pos: OUT, look: [-.44, 9.5, 4], fade: true, dy: .16, dp: .1, down: .1 },
        act: (h, d, done) => h.wait(900, () => { d.flock.t0 = performance.now(); h.wait(1500, () => h.sound('flap', { volume: .5 })); h.wait(FLY - 1800, done); }) },
    ],
    // 鹿鹿 2026-11-18：一般从阁楼望出去，游戏就结束了——鸟飞过去之后出“结束”按钮。结束画面上的字是占位，等鹿鹿定
    outro: { after: 800, exit: [{ label: '结束', end: { title: '回阿婆家', lines: ['屋里的东西都还在老地方。', '下趟再来。'] } }, { label: '回阁梯间', to: 'atticroom' }, { label: '回客堂', to: 'hall' }] },
  },
};
