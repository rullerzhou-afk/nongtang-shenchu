// 一楼后厢 · 杂物间 · 负责人：曦宝
// 分镜：concepts/room-vignettes/杂物间分镜.md（鹿鹿 2026-11-18 看过草案后说“可以”，并要求演完除了“回后天井”还能直接“回客堂”）。
// 从后天井尽头那扇门进来，转一圈：樟木箱（开盖）→ 木架上的被头 → 旧皮箱 → 席子 → 浴盆和面盆。都是一年四季收起来的东西。
// 不用阿婆的口吻。词条写法、读音、录音（W61–W65）是占位，等鹿鹿定。没有改房子模型；樟木箱里的被头和布包是照屋里现成的复制了一份放进去的。

// 把屋里现成的一样东西复制一份，摆到指定的位置（世界坐标：x、z 是中心，y 是底）
const copyTo = (h, name, x, yBottom, z, turn = 0) => {
  const T = h.THREE, src = h.find(name); if (!src) return null;
  const c = src.clone(true); c.name = '樟木箱里_' + name; src.parent.add(c); c.rotation.y += turn; c.updateWorldMatrix(true, true);
  const b = new T.Box3().setFromObject(c), ctr = b.getCenter(new T.Vector3()), want = new T.Vector3(x, yBottom + (ctr.y - b.min.y), z);
  const p = c.parent, a = p.worldToLocal(ctr.clone()), w = p.worldToLocal(want.clone()); c.position.add(w.sub(a)); c.updateWorldMatrix(true, true); return c;
};

export default {
  spot: { pos: [3.1, 1.55, -12.05], look: [3.6, 1.0, -14.3] },   // 进门后往里一步、站到门扇北边：房门朝屋里开着（门扇占 x 1.88–2.73、z -11.65 一线），站在门口正好站进门扇里
  next: { to: 'rearwell', label: '回后天井' },
  names: { '南侧_樟木箱总成': '樟木箱', '樟木箱可开合总成': '樟木箱', '西侧_四层木架': '木架', '北侧_窗下平台': '矮平台', '北平台_旅行箱': '皮箱', '架底_小旧皮箱': '皮箱', '东木箱上_小旧皮箱': '皮箱',
    '北平台_被褥1': '被头', '北平台_被褥2': '被头', '北平台_被褥3': '被头', '架二_米被1': '被头', '架二_米被2': '被头', '架二_米被3': '被头', '架二_蓝被1': '被头', '架顶_米被': '被头', '架顶_蓝被': '被头',
    '东北_竹凉席': '席子', '东北_大被褥袋': '被褥袋', '东侧_低木箱': '木箱', '东侧_提梁竹篮': '竹篮', '架二_空竹篮': '竹篮', '架三_藤篮': '藤篮', '架三_小带盖藤篮': '藤篮', '东侧_整理用木凳': '木凳', '木凳上_格布': '木凳',
    '架底_报纸1': '旧报纸', '架底_报纸2': '旧报纸', '箱边_捆扎报纸': '旧报纸', '生活器具_rear-wing': '浴盆和面盆', '后厢侧立浅木澡盆': '浴盆', '后厢悬挂搪瓷脸盆': '面盆',
    '屋内灯具_后厢吊线白炽灯': '电灯', '屋内帘子_后厢北窗旧花布帘': '窗帘' },
  story: {
    setup(h, d) {
      // 樟木箱：箱盖和三只搭扣是独立零件（房子自带的开合：箱盖绕后沿转，搭扣翻上去）
      const chest = h.find('樟木箱可开合总成'); d.lids = []; d.hasps = [];
      chest?.traverse(o => { if (o.userData.kind === 'chest_lid') d.lids.push(o); if (o.userData.kind === 'chest_hasp') d.hasps.push(o); });
      // 箱子里原来是空的。放两床叠着的被头和一只衣裳包（都是屋里现成东西的复制品）
      d.inside = [copyTo(h, '架二_米被1', 3.12, .2, -10.8, Math.PI / 2), copyTo(h, '架二_蓝被1', 3.12, .39, -10.8, Math.PI / 2), copyTo(h, '架顶_蓝灰衣物布包', 3.64, .2, -10.8, Math.PI / 2)].filter(Boolean);
    },
    dispose(h, d) {
      d.lids?.forEach(o => { o.rotation.x = 0; }); d.hasps?.forEach(o => { o.rotation.x = 0; });
      d.inside?.forEach(o => o.parent?.remove(o)); d.inside = [];
    },
    beats: [
      // 樟木箱：搭扣翻开，箱盖掀起来，看得见里面的被头和衣裳包
      { id: 'chest', audio: 'W61', label: '开樟木箱', sub: '南墙下一只樟木箱。', target: '樟木箱可开合总成', also: ['南侧_樟木箱总成'], markAt: [3.34, .74, -10.85],
        pose: { pos: [3.34, 1.5, -12.0], look: [3.34, .42, -10.8] },
        act: (h, d, done) => { if (!d.lids.length) return h.wait(1200, done);
          h.tween(350, k => { d.hasps.forEach(o => { o.rotation.x = -175 * Math.PI / 180 * k; }); }, () =>
            h.tween(1500, k => { const e = k * k * (3 - 2 * k); d.lids.forEach(o => { o.rotation.x = -95 * Math.PI / 180 * e; }); }, () => h.wait(900, done))); },
        card: { hu: '樟木箱', zh: '樟木箱', note: '樟木有香气，不会蛀掉。冬天衣裳、被头收在里面，一开箱子就一股樟木味道。' } },
      // 被头：西墙木架上叠着的棉被
      { id: 'quilts', audio: 'W62', label: '被头', sub: '木架上叠着一床一床被头。', target: '架二_蓝被1', also: ['架二_米被1', '架二_米被2', '架二_米被3', '西侧_四层木架'], markAt: [2.3, 1.0, -13.3],
        pose: { pos: [3.55, 1.4, -13.05], look: [2.2, .98, -13.2] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '被头', zh: '被子', note: '换季的时候汏清爽，晒晒再收起来。' } },
      // 皮箱：北窗下矮平台上的旧皮箱
      { id: 'case', audio: 'W63', label: '皮箱', sub: '窗下一只旧皮箱。', target: '北平台_旅行箱', also: ['旅行箱上_布包'], markAt: [2.98, .58, -14.3],
        pose: { pos: [3.25, 1.4, -13.25], look: [2.98, .55, -14.42] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '皮箱', zh: '皮箱', note: '包铜角的硬皮箱。' } },
      // 席子：东北角卷起来立着的竹席
      { id: 'mat', audio: 'W64', label: '席子', sub: '墙角立着一卷席子。', target: '东北_竹凉席', markAt: [4.76, 1.0, -14.6],
        pose: { pos: [3.8, 1.45, -13.45], look: [4.72, .82, -14.58] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '席子', zh: '凉席', note: '夏天铺在床上，天风凉了揩清爽，卷好放好。' } },
      // 浴盆和面盆：东墙下侧立的木浴盆，墙上挂着红双喜的搪瓷面盆
      { id: 'basin', audio: 'W65', label: '面盆', sub: '墙上挂一只面盆，底下是木头浴盆。', target: '后厢侧立浅木澡盆', also: ['后厢悬挂搪瓷脸盆', '生活器具_rear-wing'], markAt: [4.82, 1.36, -13.52],
        pose: { pos: [3.2, 1.4, -13.52], look: [4.85, .82, -13.52] },
        act: (h, d, done) => h.wait(1700, done),
        card: { hu: '面盆', zh: '脸盆', note: '搪瓷面盆，红双喜，结婚是时候买个。底下是只木头浴盆，汏浴用个。' } },
    ],
    outro: { after: 1200, sub: '一年四季的东西，都收在这里。', exit: [{ label: '回后天井', to: 'rearwell' }, { label: '回客堂', to: 'hall' }] },
  },
};
