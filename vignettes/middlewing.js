// 中厢 · 读书缝纫间 · 负责人：曦宝
// 分镜：concepts/room-vignettes/中厢分镜.md。从客堂东墙靠北那扇门进来，顺时针一圈（鹿鹿 2026-11-17：先看书桌，最后看书橱）：
// 坐到写字台前 → 凑近看玻璃台板下的照片 → 缝纫机 → 落地扇 → 针线匾 → 书橱。
// 不用阿婆的口吻。词条写法、读音、录音（W21–W26）、风扇和缝纫机的声音都是占位，等鹿鹿定。
// 书橱里的书云宝 2026-11-17 傍晚已换成有书名的（约 30 本，裁剪缝纫类为主）；这里只管开门。

// 世界坐标里的一段位移，换算成某个父物件自己坐标里的位移
const localDelta = (T, parent, dx, dy, dz) => { parent.updateWorldMatrix(true, false); const a = parent.worldToLocal(new T.Vector3(0, 0, 0)); return parent.worldToLocal(new T.Vector3(dx, dy, dz)).sub(a); };

export default {
  spot: { pos: [2.5, 1.55, -7.175], look: [4.2, 1.1, -6.4] },   // 跨进门，正对东窗下的缝纫机，右手是写字台
  next: { to: 'hall', label: '回客堂' },
  sit: /木靠背椅/,
  names: { '完整脚踏缝纫机': '缝纫机', '中厢落地扇': '落地扇', '西墙窄书柜': '书橱', '北墙布料矮柜': '矮柜', '针线笸箩': '针线匾', '单侧抽屉书桌': '写字台', '书桌木靠背椅': '靠背椅', '缝纫方木凳': '方凳',
    '弯颈小台灯': '台灯', '摊开练习本': '练习本', '笔筒与铅笔': '笔筒', '桌上旧书_1': '旧书', '桌上旧书_2': '旧书', '桌上旧书_3': '旧书', '折叠薄棉布_1': '布料', '折叠薄棉布_2': '布料', '折叠薄棉布_3': '布料',
    '准确刻线软尺': '软尺', '裁缝剪刀': '剪刀', '缝纫台蓝灰垂布': '一块布', 'middle-wing_新增道具': '搪瓷杯 · 工作证', '中厢书桌玻璃板和压着的照片': '玻璃台板', '墙上挂贴_中厢南墙年历': '年历',
    '屋内灯具_中厢吊链日光灯': '日光灯', '屋内帘子_中厢东窗米白小圆点纱半帘': '纱帘' },
  story: {
    setup(h, d) {
      const T = h.THREE;
      // 书橱上面两扇玻璃门
      d.doors = ['玻璃上门木下门书柜_门轴_MW04_1', '玻璃上门木下门书柜_门轴_MW04_2'].map(n => h.find(n)).filter(Boolean).map(o => ({ o, home: o.quaternion.clone() }));
      // 落地扇的扇叶：从整台里单独拿出来套一个转轴（pivot），轴向取“扇叶中心 → 前面那枚红色圆徽”
      const fan = h.find('中厢落地扇'); let blade = null, badge = null;
      fan?.traverse(o => { if (!o.isMesh) return; if (/扇叶/.test(o.material.name)) blade = o; if (/红色圆徽/.test(o.material.name)) badge = o; });
      if (blade && badge) {
        const c = new T.Box3().setFromObject(blade).getCenter(new T.Vector3()), b = new T.Box3().setFromObject(badge).getCenter(new T.Vector3()), parent = blade.parent, p = new T.Group(); p.name = '中厢落地扇_扇叶转轴';
        parent.updateWorldMatrix(true, false); p.position.copy(parent.worldToLocal(c.clone())); parent.add(p); p.attach(blade);
        d.fan = { p, blade, parent, home: p.quaternion.clone(), axis: localDelta(T, parent, b.x - c.x, b.y - c.y, b.z - c.z).normalize(), on: false, speed: 0, angle: 0, last: 0 };
        const q = new T.Quaternion();
        d.stopFan = h.loop(now => { const f = d.fan, dt = Math.min(.05, (now - (f.last || now)) / 1000); f.last = now; f.speed += ((f.on ? 9 : 0) - f.speed) * Math.min(1, dt * 1.2); if (f.speed < .01) return; f.angle += f.speed * dt; f.p.quaternion.copy(f.home).multiply(q.setFromAxisAngle(f.axis, f.angle)); });
      }
      // 玻璃台板下的照片和纸条：模型里是朝南摆的，坐在写字台前（人在北侧）看是倒的。各自原地转半圈，正对坐着的人。
      // 这是房子模型里的遗留问题，这里只在游戏里转正；等正式改模型时一并改掉
      d.slips = []; h.find('玻璃板下的照片和纸条')?.traverse(o => { if (o.isMesh) d.slips.push(o); });
      d.slips = d.slips.map(o => { const c = new T.Box3().setFromObject(o).getCenter(new T.Vector3()), parent = o.parent, p = new T.Group(); p.name = '压着的纸_转正'; parent.updateWorldMatrix(true, false); p.position.copy(parent.worldToLocal(c)); parent.add(p); p.attach(o); p.rotateY(Math.PI); p.position.add(localDelta(T, parent, 0, .0004, 0)); return { o, p, parent }; });   // 顺手抬高 0.4 毫米（仍在玻璃下面）：原来和桌面贴在同一个高度，镜头一动两层面会抢着显示、一闪一闪
      // 缝纫机的针：独立零件，可以上下走
      d.needle = h.find('缝纫机细钢针'); if (d.needle) { d.needleHome = d.needle.position.clone(); d.needleUp = localDelta(T, d.needle.parent, 0, 1, 0); }
    },
    dispose(h, d) {
      d.stopFan?.(); d.stopFanSound?.(); for (const x of d.doors || []) x.o.quaternion.copy(x.home);
      if (d.fan) { d.fan.p.quaternion.copy(d.fan.home); d.fan.parent.attach(d.fan.blade); d.fan.parent.remove(d.fan.p); }
      if (d.needle) d.needle.position.copy(d.needleHome);
      for (const x of d.slips || []) { x.p.rotateY(Math.PI); x.parent.attach(x.o); x.parent.remove(x.p); }
    },
    beats: [
      // 写字台：坐到靠背椅上（朝向和高度按椅子自己量）
      { id: 'desk', audio: 'W25', label: '坐一坐', sub: '写字台前一把靠背椅。', target: '书桌木靠背椅', sit: true,
        card: { hu: '写字台', zh: '书桌', note: '一边一只抽屉，台面上一块玻璃。小囡做功课，大人记账，都在这里。' } },
      // 玻璃台板：从椅子上探身过去，凑近看压在下面的照片
      // 照片内容见 README（2026-11-15 收尾）：年轻时和纺织厂小姐妹的黑白合影、1994 年 3 月退休那天厂门口的彩照
      { id: 'photo', audio: 'W26', label: '玻璃台板', sub: '玻璃台板下压着几张照片。', target: '中厢书桌玻璃板和压着的照片', markAt: [3.25, .88, -5.47],
        pose: { pos: [3.255, 1.1, -5.74], look: [3.255, .85, -5.475] },
        act: (h, d, done) => h.wait(1500, done),
        card: { hu: '玻璃台板', zh: '桌面玻璃板', note: '照片、纸条通通压在玻璃下，一低头就能看得着。' } },
      // 缝纫机：坐到方凳的高度看。针上下走几下。声音 audio/sewing.m4a 还没有
      { id: 'sewing', audio: 'W24', label: '踏洋机', sub: '窗下是一台蝴蝶牌。', target: '完整脚踏缝纫机', markAt: [4.52, .98, -6.85],
        pose: { pos: [3.92, 1.22, -6.96], look: [4.52, .9, -7.03] },
        act: (h, d, done) => { h.sound('sewing', { volume: .5 }); if (!d.needle) return h.wait(1500, done);
          h.tween(2600, k => { const run = Math.sin(Math.min(1, k * 1.15) * Math.PI); d.needle.position.copy(d.needleHome).addScaledVector(d.needleUp, .011 * run * (.5 + .5 * Math.sin(k * 2600 / 1000 * 2 * Math.PI * 7))); }, () => { d.needle.position.copy(d.needleHome); h.wait(400, done); }); },
        card: { hu: '洋机', zh: '缝纫机', note: '上海人管缝纫机叫洋机。蝴蝶牌，脚踏的。做衣裳、改裤脚管，通通要靠它。' }, collect: ['turn', 1] },
      // 落地扇：点一下，扇叶慢慢转起来，之后一直转着。声音 audio/fan.m4a 还没有
      { id: 'fan', audio: 'W23', label: '开电风扇', sub: '墙角一台落地扇。', target: '中厢落地扇',
        pose: { pos: [3.55, 1.42, -7.45], look: [4.45, 1.14, -8.33] },
        act: (h, d, done) => { if (d.fan) d.fan.on = true; d.stopFanSound = h.sound('fan', { loop: true, volume: .35 }); h.wait(2600, done); },
        card: { hu: '电风扇', zh: '电风扇', note: '一档两档三档，大热天都要靠它。' } },
      // 针线匾：矮柜上的针线笸箩，凑近看
      { id: 'basket', audio: 'W22', label: '针线匾', sub: '矮柜上搁着针线和叠好的布。', target: '针线笸箩',
        pose: { pos: [4.05, 1.42, -9.05], look: [4.47, .99, -9.87] },
        act: (h, d, done) => h.wait(1300, done),
        card: { hu: '针线匾', zh: '针线笸箩', note: '针、线、顶针箍、纽扣都放在里面。' } },
      // 书橱：上面两扇玻璃门自己打开
      { id: 'books', audio: 'W21', label: '开书橱', sub: '书橱里多是做衣裳的书。', target: '西墙窄书柜', markAt: [2.42, 1.3, -8.88],
        pose: { pos: [3.35, 1.42, -8.75], look: [2.2, 1.25, -8.88] },
        act: (h, d, done) => { if (!d.doors?.length) return done(); const T = h.THREE, q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
          // 门该往屋里（东）开：每扇两个方向各试一下，看哪边伸进屋里
          for (const x of d.doors) { const reach = a => { x.o.quaternion.copy(x.home).multiply(q.setFromAxisAngle(up, a)); return new T.Box3().setFromObject(x.o).max.x; }; x.sign = reach(.6) > reach(-.6) ? 1 : -1; x.o.quaternion.copy(x.home); }
          h.tween(1500, k => { const e = k * k * (3 - 2 * k); for (const x of d.doors) x.o.quaternion.copy(x.home).multiply(q.setFromAxisAngle(up, x.sign * 1.65 * e)); }, () => h.wait(700, done)); },
        card: { hu: '书橱', zh: '书柜', note: '上头玻璃门，下头木头门，灰尘进不去。' } },
    ],
    outro: { after: 1500, sub: '窗外有人踏着脚踏车过去。', exit: { label: '回客堂', to: 'hall' } },
  },
};
